import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/dashboard - Obtener datos agregados para el dashboard
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesFiltro = searchParams.get("mes"); // formato YYYY-MM, opcional
    const ahora = new Date();
    const mesActual = mesFiltro || `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;

    // Obtener configuración de cuotas
    const configuraciones = await db.configuracion.findMany();
    const getValor = (clave: string) => {
      const c = configuraciones.find((c) => c.clave === clave);
      return c ? parseFloat(c.valor) : 0;
    };
    const cuotaSocio = getValor("cuota_socio") || 7000;
    const cuotaAlumno = getValor("cuota_alumno") || 3500;
    const cuotaVitalicio = getValor("cuota_vitalicio") || 0;

    // 1. KPIs
    const totalActivos = await db.socio.count({ where: { estado: "activo" } });

    // Socios ACTIVOS que pagaron el mes actual
    const sociosActivosIds = (await db.socio.findMany({
      where: { estado: "activo" },
      select: { id: true },
    })).map(s => s.id);

    const pagosMesActual = await db.pagoCuota.findMany({
      where: { mesPagado: mesActual, socioId: { in: sociosActivosIds } },
      select: { socioId: true },
      distinct: ["socioId"],
    });
    const sociosAlDia = pagosMesActual.length;

    // Contar vitalicios (siempre al día)
    const vitaliciosActivos = await db.socio.count({
      where: { estado: "activo", categoria: "vitalicio" },
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
    const sociosAlDiaTotal = sociosAlDia + vitaliciosActivos + sociosPrimerMes;
    const sociosDeudores = Math.max(0, totalActivos - sociosAlDiaTotal);

    // Ingresos del mes actual
    const ingresosMesActual = await db.pagoCuota.aggregate({
      where: { mesPagado: mesActual },
      _sum: { monto: true },
    });
    const ingresosMes = ingresosMesActual._sum.monto || 0;

    // 2. Distribución por categoría
    const categoriaCounts = await db.socio.groupBy({
      by: ["categoria"],
      where: { estado: "activo" },
      _count: { id: true },
    });
    const distribucionCategorias = [
      { categoria: "socio", cantidad: 0, cuota: cuotaSocio, color: "#FFCC00" },
      { categoria: "alumno", cantidad: 0, cuota: cuotaAlumno, color: "#3B82F6" },
      { categoria: "vitalicio", cantidad: 0, cuota: cuotaVitalicio, color: "#00AA55" },
    ];
    for (const cc of categoriaCounts) {
      const found = distribucionCategorias.find((d) => d.categoria === cc.categoria);
      if (found) found.cantidad = cc._count.id;
    }

    // 3. Ingresos por categoría (mes actual o filtrado)
    const sociosActivos = await db.socio.findMany({
      where: { estado: "activo" },
      include: { pagos: true },
    });

    const ingresosPorCategoria: { categoria: string; total: number }[] = [];
    for (const cat of ["socio", "alumno", "vitalicio"]) {
      const sociosCat = sociosActivos.filter((s) => s.categoria === cat);
      const pagosCat = sociosCat.flatMap((s) => s.pagos.filter((p) => p.mesPagado === mesActual));
      const total = pagosCat.reduce((acc, p) => acc + p.monto, 0);
      ingresosPorCategoria.push({ categoria: cat.charAt(0).toUpperCase() + cat.slice(1), total });
    }

    // 4. Recaudación mensual últimos 12 meses
    const recaudacionMensual: { mes: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const mesStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
      const nombreMes = fecha.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });

      const total = await db.pagoCuota.aggregate({
        where: { mesPagado: mesStr },
        _sum: { monto: true },
      });

      recaudacionMensual.push({
        mes: nombreMes,
        total: total._sum.monto || 0,
      });
    }

    // 5. Crecimiento de socios por mes (últimos 12 meses)
    const crecimientoMensual: { mes: string; total: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
      const finMes = new Date(ahora.getFullYear(), ahora.getMonth() - i + 1, 0);
      const nombreMes = fecha.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });

      const total = await db.socio.count({
        where: {
          estado: "activo",
          fechaAlta: { lte: finMes },
        },
      });

      crecimientoMensual.push({
        mes: nombreMes,
        total,
      });
    }

    // 6. Morosos Críticos (top 5 que más deben)
    const cuotaPorCategoria: Record<string, number> = {
      socio: cuotaSocio,
      alumno: cuotaAlumno,
      vitalicio: cuotaVitalicio,
    };

    const morosos = sociosActivos
      .map((socio) => {
        const mesesPagados = socio.pagos.map((p) => p.mesPagado);
        const tienePagoMesActual = mesesPagados.includes(mesActual);

        // Mes de alta del socio (formato YYYY-MM)
        const mesAlta = `${socio.fechaAlta.getFullYear()}-${String(socio.fechaAlta.getMonth() + 1).padStart(2, "0")}`;
        const esPrimerMes = mesAlta === mesActual;

        let mesesAdeudados = 0;
        if (!tienePagoMesActual && socio.categoria !== "vitalicio" && !esPrimerMes) {
          if (socio.pagos.length > 0) {
            const ultimoPagoMes = [...mesesPagados].sort().pop();
            if (ultimoPagoMes) {
              const [y, m] = ultimoPagoMes.split("-").map(Number);
              const diff = (ahora.getFullYear() - y) * 12 + (ahora.getMonth() + 1 - m);
              mesesAdeudados = Math.max(0, diff);
            }
          } else {
            const diff =
              (ahora.getFullYear() - socio.fechaAlta.getFullYear()) * 12 +
              (ahora.getMonth() - socio.fechaAlta.getMonth());
            mesesAdeudados = Math.max(0, diff);
          }
        }

        return {
          id: socio.id,
          nombre: `${socio.nombre} ${socio.apellido}`,
          apellido: socio.apellido,
          mesesAdeudados,
          deudaEstimada: mesesAdeudados * (cuotaPorCategoria[socio.categoria] || 7000),
        };
      })
      .filter((s) => s.mesesAdeudados >= 2)
      .sort((a, b) => b.mesesAdeudados - a.mesesAdeudados)
      .slice(0, 5);

    // 7. Deuda total estimada
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
