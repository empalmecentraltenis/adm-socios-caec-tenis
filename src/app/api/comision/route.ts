import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { VALORES_CUOTA, getValorCuotaPorGrupo } from '@/app/api/pagos-escuela/route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesParam = searchParams.get('mes'); // YYYY-MM

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const mes = mesParam || `${curYear}-${curMonth}`;

    const [anioStr, mesNumStr] = mes.split('-');
    const anio = parseInt(anioStr, 10);
    const mesNum = parseInt(mesNumStr, 10);

    // 1. ESCUELA DE TENIS Y PAGOS
    const alumnosEscuela = await db.alumnoEscuela.findMany({
      where: { activo: true },
      orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }],
    });

    const pagosMesEscuela = await db.pagoCuotaEscuela.findMany({
      where: { mes },
    });

    const pagosEscuelaMap = new Map<string, any>();
    for (const p of pagosMesEscuela) {
      pagosEscuelaMap.set(p.alumnoId, p);
    }

    let escuelaTotalEsperado = 0;
    let escuelaTotalRecaudado = 0;
    let escuelaCantidadPagados = 0;
    let escuelaCantidadPendientes = 0;

    const escuelaLista = alumnosEscuela.map((al) => {
      const pago = pagosEscuelaMap.get(al.id);
      const montoSugerido = getValorCuotaPorGrupo(al.grupo);
      escuelaTotalEsperado += montoSugerido;

      const pagado = Boolean(pago);
      if (pagado) {
        escuelaTotalRecaudado += pago.monto;
        escuelaCantidadPagados++;
      } else {
        escuelaCantidadPendientes++;
      }

      return {
        id: al.id,
        nombre: al.nombre,
        grupo: al.grupo,
        edad: al.edad,
        tutor: al.tutor,
        telefono: al.telefono,
        montoSugerido,
        pagado,
        pago: pago
          ? {
              id: pago.id,
              monto: pago.monto,
              fechaPago: pago.fechaPago,
              metodoPago: pago.metodoPago,
              observaciones: pago.observaciones,
            }
          : null,
      };
    });

    // 2. PARTICULARES CON EL PROFESOR (Clases y Asistencias del mes)
    const lastDayOfMonth = new Date(anio, mesNum, 0).getDate();
    const startOfMonth = new Date(`${anio}-${mesNumStr}-01T00:00:00.000-03:00`);
    const endOfMonth = new Date(`${anio}-${mesNumStr}-${String(lastDayOfMonth).padStart(2, '0')}T23:59:59.999-03:00`);

    const asistenciasParticulares = await db.asistenciaClase.findMany({
      where: {
        fecha: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      include: {
        socio: {
          select: {
            id: true,
            numeroSocio: true,
            nombre: true,
            apellido: true,
            categoria: true,
            telefono: true,
          },
        },
      },
      orderBy: { fecha: 'asc' },
    });

    // Agrupamos asistencias por alumno (socio o no socio)
    const particularesMap = new Map<string, {
      key: string;
      nombre: string;
      esSocio: boolean;
      numeroSocio?: number | null;
      categoria?: string | null;
      telefono?: string | null;
      cantidadClases: number;
      fechas: string[];
    }>();

    for (const asis of asistenciasParticulares) {
      const socio = asis.socio;
      const esSocio = Boolean(socio && socio.categoria !== 'alumno');
      const key = socio ? `socio_${socio.id}` : `asistencia_${asis.id}`;
      const nombre = socio
        ? `${socio.apellido}, ${socio.nombre}`
        : 'Alumno';

      const fechaStr = asis.fecha.toISOString().split('T')[0];

      if (!particularesMap.has(key)) {
        particularesMap.set(key, {
          key,
          nombre,
          esSocio,
          numeroSocio: socio?.numeroSocio,
          categoria: socio?.categoria,
          telefono: socio?.telefono,
          cantidadClases: 0,
          fechas: [],
        });
      }

      const item = particularesMap.get(key)!;
      item.cantidadClases++;
      item.fechas.push(fechaStr);
    }

    const particularesLista = Array.from(particularesMap.values()).sort((a, b) =>
      b.cantidadClases - a.cantidadClases || a.nombre.localeCompare(b.nombre)
    );

    // 3. PADRÓN COMPLETO DE SOCIOS ACTIVOS (Sin importar deuda)
    const socios = await db.socio.findMany({
      where: { activo: true },
      orderBy: [
        { apellido: 'asc' },
        { nombre: 'asc' },
      ],
      select: {
        id: true,
        numeroSocio: true,
        nombre: true,
        apellido: true,
        dni: true,
        categoria: true,
        telefono: true,
        email: true,
      },
    });

    // Conteo por categorías
    const categoriasConteo: Record<string, number> = {};
    for (const s of socios) {
      const cat = s.categoria || 'Sin Categoría';
      categoriasConteo[cat] = (categoriasConteo[cat] || 0) + 1;
    }

    // 4. BALANCE MENSUAL DE LA SUBCOMISIÓN
    const startBalance = new Date(`${mes}-01T00:00:00Z`);
    const endBalance = new Date(startBalance);
    endBalance.setMonth(endBalance.getMonth() + 1);

    const movimientos = await db.movimiento.findMany({
      where: {
        fecha: {
          gte: startBalance,
          lt: endBalance,
        },
      },
      orderBy: { fecha: 'asc' },
    });

    let totalIngresos = 0;
    let totalEgresos = 0;

    const movimientosFormatted = movimientos.map((m) => {
      if (m.tipo === 'ingreso') {
        totalIngresos += m.monto;
      } else {
        totalEgresos += m.monto;
      }
      return {
        id: m.id,
        fecha: m.fecha.toISOString().split('T')[0],
        descripcion: m.descripcion,
        responsable: m.responsable,
        tipo: m.tipo,
        monto: m.monto,
      };
    });

    const resultadoNeto = totalIngresos - totalEgresos;

    return NextResponse.json({
      success: true,
      mes,
      resumenGlobal: {
        totalSocios: socios.length,
        totalAlumnosEscuela: alumnosEscuela.length,
        totalParticulares: particularesLista.length,
        totalAsistenciasParticulares: asistenciasParticulares.length,
        escuelaRecaudado: escuelaTotalRecaudado,
        escuelaEsperado: escuelaTotalEsperado,
        escuelaPorcentajeCobrado: escuelaTotalEsperado > 0 ? Math.round((escuelaTotalRecaudado / escuelaTotalEsperado) * 100) : 0,
        balanceIngresos: totalIngresos,
        balanceEgresos: totalEgresos,
        balanceResultadoNeto: resultadoNeto,
      },
      escuela: {
        totalEsperado: escuelaTotalEsperado,
        totalRecaudado: escuelaTotalRecaudado,
        cantidadPagados: escuelaCantidadPagados,
        cantidadPendientes: escuelaCantidadPendientes,
        alumnos: escuelaLista,
      },
      particulares: {
        totalAlumnos: particularesLista.length,
        totalAsistencias: asistenciasParticulares.length,
        alumnos: particularesLista,
      },
      socios: {
        total: socios.length,
        porCategoria: categoriasConteo,
        lista: socios,
      },
      balance: {
        totalIngresos,
        totalEgresos,
        resultadoNeto,
        movimientos: movimientosFormatted,
      },
    });
  } catch (err: any) {
    console.error('Error en /api/comision:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener datos ejecutivos de comisión' }, { status: 500 });
  }
}

