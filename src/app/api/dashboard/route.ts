import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/dashboard - Obtener datos agregados para el dashboard
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesFiltro = searchParams.get("mes"); // formato YYYY-MM, opcional
    const ahora = new Date();
    const mesActual = mesFiltro || `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;

    // 1. KPIs y configuración en paralelo
    const [configuraciones, totalActivos, vitaliciosActivos, ingresosMesActual] = await Promise.all([
      db.configuracion.findMany(),
      db.socio.count({ where: { estado: "activo" } }),
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

    // Socios ACTIVOS que pagaron el mes actual (Necesario para sociosAlDia)
    const sociosAlDiaTotalPromise = (async () => {
      const sociosActivosIds = (await db.socio.findMany({
        where: { estado: "activo" },
        select: { id: true },
      })).map(s => s.id);

      const pagosMesActualCount = await db.pagoCuota.count({
        where: { mesPagado: mesActual, socioId: { in: sociosActivosIds } },
      });

      // Socios dados de alta en el mes actual (mes de gracia)
      const sociosPrimerMes = await db.socio.count({
        where: {
          estado: "activo",
          categoria: { not: "vitalicio" },
          fechaAlta: {
            gte: new Date(ahora.getFullYear(), ahora.getMonth(), 1),
            lt: new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1),
          },
        },
      });

      return pagosMesActualCount + vitaliciosActivos + sociosPrimerMes;
    })();

    // 2, 3, 4, 5, 8 en paralelo
    const [categoriaCounts, sociosActivos, recaudacionData, crecimientoData, ultimasActividades, sociosAlDiaTotal] = await Promise.all([
      db.socio.groupBy({
        by: ["categoria"],
        where: { estado: "activo" },
        _count: { id: true },
      }),
      db.socio.findMany({
        where: { estado: "activo" },
        include: { pagos: { where: { mesPagado: mesActual } } }, // Traemos solo pagos del mes para KPI
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
        `SELECT id, accion, detalle, "socio_id" as "socioId", "created_at" as "createdAt" FROM actividades ORDER BY "created_at" DESC LIMIT 10`
      ) as Promise<Array<{ id: string; accion: string; detalle: string; socioId: string | null; createdAt: string }>>,
      sociosAlDiaTotalPromise
    ]);

    const sociosDeudores = Math.max(0, totalActivos - sociosAlDiaTotal);

    const distribucionCategorias = [
      { categoria: "socio", cantidad: 0, cuota: cuotaSocio, color: "#FFCC00" },
      { categoria: "alumno", cantidad: 0, cuota: cuotaAlumno, color: "#3B82F6" },
      { categoria: "vitalicio", cantidad: 0, cuota: cuotaVitalicio, color: "#00AA55" },
    ];
    for (const cc of categoriaCounts) {
      const found = distribucionCategorias.find((d) => d.categoria === cc.categoria);
      if (found) found.cantidad = cc._count.id;
    }

    const ingresosPorCategoria = ["socio", "alumno", "vitalicio"].map(cat => {
      const total = sociosActivos
        .filter(s => s.categoria === cat)
        .reduce((acc, s) => acc + s.pagos.reduce((a, p) => a + p.monto, 0), 0);
      return { categoria: cat.charAt(0).toUpperCase() + cat.slice(1), total };
    });

    const recaudacionMensual = recaudacionData;
    const crecimientoMensual = crecimientoData;

    // 6. Morosos Críticos (top 5 que más deben)
    // Para morosos críticos necesitamos los pagos históricos, pero solo de los que sospechamos morosos.
    // Para simplificar y optimizar, vamos a buscar socios ACTIVOS que NO tengan pago en el mes actual.
    const sociosSinPago = await db.socio.findMany({
      where: {
        estado: "activo",
        categoria: { not: "vitalicio" },
        id: { notIn: (await db.pagoCuota.findMany({ where: { mesPagado: mesActual }, select: { socioId: true } })).map(p => p.socioId) }
      },
      include: { pagos: { orderBy: { mesPagado: 'desc' }, take: 1 } },
      take: 20 // Limitamos la búsqueda inicial
    });

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
      .filter((s) => s.mesesAdeudados >= 2)
      .sort((a, b) => b.mesesAdeudados - a.mesesAdeudados)
      .slice(0, 5);

    // 7. Deuda total estimada (basada en morosos críticos por ahora para velocidad)
    const deudaTotalEstimada = morosos.reduce((acc, s) => acc + s.deudaEstimada, 0);

    // 8. Últimas actividades
    const ultimasActividades = await db.$queryRawUnsafe(
      `SELECT id, accion, detalle, "socioId", "createdAt" FROM actividades ORDER BY "createdAt" DESC LIMIT 10`
    ) as Array<{ id: string; accion: string; detalle: string; socioId: string | null; createdAt: string }>;

    return NextResponse.json({
      kpis: {
        totalActivos,
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
