import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/dashboard - Obtener datos agregados para el dashboard
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesFiltro = searchParams.get("mes"); // formato YYYY-MM, opcional
    const ahora = new Date();
    const mesActual = mesFiltro || `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;

    // 1. KPIs y datos base en paralelo
    const [configuraciones, totalActivos, totalInactivos, totalGeneral, vitaliciosActivos, ingresosMesActual] = await Promise.all([
      db.configuracion.findMany(),
      db.socio.count({ where: { estado: "activo" } }),
      db.socio.count({ where: { estado: "inactivo" } }),
      db.socio.count(),
      db.socio.count({ where: { estado: "activo", categoria: "vitalicio" } }),
      db.pagoCuota.aggregate({
        where: { mesPagado: mesActual },
        _sum: { monto: true },
      }),
    ]);

    const getValor = (clave: string) => {
      const c = configuraciones.find((c) => c.clave === clave);
      return c ? parseFloat(c.valor) : 0;
    };
    const cuotaSocio = getValor("cuota_socio") || 7000;
    const cuotaAlumno = getValor("cuota_alumno") || 3500;
    const cuotaVitalicio = getValor("cuota_vitalicio") || 0;

    const ingresosMes = ingresosMesActual._sum.monto || 0;

    // DEFINICIÓN DE "AL DÍA": 
    // Un socio está al día si tiene 0 o 1 mes de deuda (umbral de 2 meses para morosidad).
    // Calculamos este KPI de forma precisa analizando a todos los socios activos.
    const sociosAlDiaTotalPromise = (async () => {
      const sociosActivos = await db.socio.findMany({
        where: { estado: "activo" },
        include: { pagos: { orderBy: { mesPagado: 'desc' }, take: 1 } }
      });

      const [yA, mA] = mesActual.split("-").map(Number);
      
      const alDiaCount = sociosActivos.filter(socio => {
        if (socio.categoria === "vitalicio") return true;
        
        const ultimoPagoMes = socio.pagos[0]?.mesPagado;
        let mesesAdeudados = 0;
        
        if (ultimoPagoMes) {
          const [y, m] = ultimoPagoMes.split("-").map(Number);
          mesesAdeudados = (yA - y) * 12 + (mA - m);
        } else {
          // Si no tiene pagos, calculamos desde la fecha de alta
          mesesAdeudados = (yA - socio.fechaAlta.getFullYear()) * 12 + (mA - (socio.fechaAlta.getMonth() + 1));
        }

        return Math.max(0, mesesAdeudados) < 2;
      }).length;

      return alDiaCount;
    })();

    // 2, 3, 4, 5, 8 en paralelo
    const [categoriaCounts, revenueByCat, recaudacionData, crecimientoData, ultimasActividades, sociosAlDiaTotal] = await Promise.all([
      db.socio.groupBy({
        by: ["categoria"],
        where: { estado: "activo" },
        _count: { id: true },
      }),
      db.pagoCuota.groupBy({
        by: ["socioId"],
        where: { mesPagado: mesActual },
        _sum: { monto: true }
      }),
      Promise.all(Array.from({ length: 12 }).map(async (_, i) => {
        const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - (11 - i), 1);
        const mesStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
        const nombreMes = fecha.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
        const res = await db.pagoCuota.aggregate({ where: { mesPagado: mesStr }, _sum: { monto: true } });
        return { mes: nombreMes, total: res._sum.monto || 0 };
      })),
      Promise.all(Array.from({ length: 12 }).map(async (_, i) => {
        const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - (11 - i), 1);
        const finMes = new Date(ahora.getFullYear(), ahora.getMonth() - (11 - i) + 1, 0);
        const nombreMes = fecha.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
        const count = await db.socio.count({ where: { estado: "activo", fechaAlta: { lte: finMes } } });
        return { mes: nombreMes, total: count };
      })),
      db.$queryRawUnsafe(
        `SELECT id, accion, detalle, socio_id AS "socioId", created_at AS "createdAt" FROM actividades ORDER BY created_at DESC LIMIT 10`
      ) as Promise<Array<{ id: string; accion: string; detalle: string; socioId: string | null; createdAt: string }>>,
      sociosAlDiaTotalPromise
    ]);

    const sociosDeudores = Math.max(0, totalActivos - sociosAlDiaTotal);

    const distribucionCategorias = [
      { categoria: "socio", cantidad: 0, cuota: cuotaSocio, color: "#FFCC00" },
      { categoria: "alumno", cantidad: 0, cuota: cuotaAlumno, color: "#3B82F6" },
      { categoria: "vitalicio", cantidad: 0, cuota: cuotaVitalicio, color: "#00AA55" },
      { categoria: "inactivo", cantidad: totalInactivos, cuota: 0, color: "#999999" },
    ];
    for (const cc of categoriaCounts) {
      const found = distribucionCategorias.find((d) => d.categoria === cc.categoria);
      if (found) found.cantidad = cc._count.id;
    }

    // Ingresos por categoría optimizado
    const incomes = { socio: 0, alumno: 0, vitalicio: 0 };
    const pagosMesActual = await db.pagoCuota.findMany({
      where: { mesPagado: mesActual },
      include: { socio: { select: { categoria: true } } }
    });
    pagosMesActual.forEach(p => {
      if (p.socio.categoria in incomes) {
        incomes[p.socio.categoria as keyof typeof incomes] += p.monto;
      }
    });

    const ingresosPorCategoria = Object.entries(incomes).map(([cat, total]) => ({
      categoria: cat.charAt(0).toUpperCase() + cat.slice(1),
      total
    }));

    const recaudacionMensual = recaudacionData;
    const crecimientoMensual = crecimientoData;

    // 6. Morosos Críticos (top deudores)
    // Buscamos socios ACTIVOS que NO tengan pago en el mes actual.
    // Quitamos el límite de 20 para evaluar a todos los candidatos.
    const sociosSinPago = await db.socio.findMany({
      where: {
        estado: "activo",
        categoria: { not: "vitalicio" },
        id: { notIn: (await db.pagoCuota.findMany({ where: { mesPagado: mesActual }, select: { socioId: true } })).map(p => p.socioId) }
      },
      include: { pagos: { orderBy: { mesPagado: 'desc' }, take: 1 } }
    });

    const cuotaPorCategoria: Record<string, number> = {
      socio: cuotaSocio,
      alumno: cuotaAlumno,
      vitalicio: cuotaVitalicio,
    };

    const morosos = sociosSinPago
      .map((socio) => {
        const ultimoPagoMes = socio.pagos[0]?.mesPagado;
        const [yA, mA] = mesActual.split("-").map(Number);
        
        let mesesAdeudados = 0;
        if (ultimoPagoMes) {
          const [y, m] = ultimoPagoMes.split("-").map(Number);
          mesesAdeudados = (yA - y) * 12 + (mA - m);
        } else {
          mesesAdeudados = (yA - socio.fechaAlta.getFullYear()) * 12 + (mA - (socio.fechaAlta.getMonth() + 1));
        }

        return {
          id: socio.id,
          nombre: `${socio.nombre} ${socio.apellido}`,
          apellido: socio.apellido,
          mesesAdeudados: Math.max(0, mesesAdeudados),
          deudaEstimada: Math.max(0, mesesAdeudados) * (cuotaPorCategoria[socio.categoria] || 7000),
        };
      })
      .filter((s) => s.mesesAdeudados >= 2) // Umbral de 2 meses (un mes de deuda se considera 'Al día' o en tolerancia)
      .sort((a, b) => b.mesesAdeudados - a.mesesAdeudados)
      .slice(0, 10);

    const deudaTotalEstimada = morosos.reduce((acc, s) => acc + s.deudaEstimada, 0);

    return NextResponse.json({
      kpis: {
        totalActivos,
        totalInactivos,
        totalGeneral,
        sociosAlDia: sociosAlDiaTotal,
        sociosDeudores,
        ingresosMes,
        deudaTotalEstimada,
      },
      distribucionCategorias,
      ingresosPorCategoria,
      recaudacionMensual,
      crecimientoMensual,
      morosos,
      ultimasActividades,
    });
  } catch (error) {
    console.error("Error al obtener datos del dashboard:", error);
    return NextResponse.json({ error: "Error al obtener datos del dashboard" }, { status: 500 });
  }
}
