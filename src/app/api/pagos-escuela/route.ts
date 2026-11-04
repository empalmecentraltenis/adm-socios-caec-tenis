import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Valores de cuota por grupo
export const VALORES_CUOTA: Record<string, number> = {
  'Escuelita': 20000,
  'Minitenis': 20000,
  'Grupo Entrenamiento': 35000,
};

export const getValorCuotaPorGrupo = (grupo: string): number => {
  return VALORES_CUOTA[grupo] ?? 20000;
};

// GET: Obtener estado de pagos de los alumnos para un mes específico
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesParam = searchParams.get('mes'); // YYYY-MM
    const grupoParam = searchParams.get('grupo'); // 'todos' o grupo

    // Mes actual por defecto si no viene
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const mes = mesParam || `${curYear}-${curMonth}`;

    // 1. Obtener alumnos activos
    const whereAlumno: any = { activo: true };
    if (grupoParam && grupoParam !== 'todos') {
      whereAlumno.grupo = grupoParam;
    }

    const alumnos = await db.alumnoEscuela.findMany({
      where: whereAlumno,
      orderBy: [
        { grupo: 'asc' },
        { nombre: 'asc' },
      ],
    });

    // 2. Obtener los pagos del mes seleccionado
    const pagosMes = await db.pagoCuotaEscuela.findMany({
      where: {
        mes,
        alumno: whereAlumno,
      },
    });

    const pagosMap = new Map<string, any>();
    for (const p of pagosMes) {
      pagosMap.set(p.alumnoId, p);
    }

    // 3. Estructurar respuesta por alumno
    let totalEsperado = 0;
    let totalRecaudado = 0;
    let cantidadPagados = 0;
    let cantidadPendientes = 0;

    const lista = alumnos.map((al) => {
      const pago = pagosMap.get(al.id);
      const montoSugerido = getValorCuotaPorGrupo(al.grupo);
      totalEsperado += montoSugerido;

      const pagado = Boolean(pago);
      if (pagado) {
        totalRecaudado += pago.monto;
        cantidadPagados++;
      } else {
        cantidadPendientes++;
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

    return NextResponse.json({
      success: true,
      mes,
      resumen: {
        totalAlumnos: alumnos.length,
        cantidadPagados,
        cantidadPendientes,
        totalEsperado,
        totalRecaudado,
        porcentajeCobrado: totalEsperado > 0 ? Math.round((totalRecaudado / totalEsperado) * 100) : 0,
      },
      alumnos: lista,
    });
  } catch (err: any) {
    console.error('Error al obtener pagos de escuela:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener pagos' }, { status: 500 });
  }
}

// POST: Registrar pago de cuota de un alumno
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { alumnoId, mes, monto, fechaPago, metodoPago, observaciones } = body;

    if (!alumnoId) {
      return NextResponse.json({ error: 'ID de alumno requerido' }, { status: 400 });
    }
    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json({ error: 'Mes inválido (formato YYYY-MM)' }, { status: 400 });
    }

    const alumno = await db.alumnoEscuela.findUnique({
      where: { id: alumnoId },
    });
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado' }, { status: 404 });
    }

    const montoFinal = typeof monto === 'number' && monto >= 0 ? monto : getValorCuotaPorGrupo(alumno.grupo);
    const fechaPagoFinal = fechaPago || new Date().toISOString().split('T')[0];

    // Upsert para guardar o actualizar pago del mes
    const pago = await db.pagoCuotaEscuela.upsert({
      where: {
        alumnoId_mes: {
          alumnoId,
          mes,
        },
      },
      update: {
        monto: montoFinal,
        fechaPago: fechaPagoFinal,
        metodoPago: metodoPago || 'efectivo',
        observaciones: observaciones !== undefined ? observaciones : undefined,
        grupo: alumno.grupo,
      },
      create: {
        alumnoId,
        mes,
        monto: montoFinal,
        fechaPago: fechaPagoFinal,
        metodoPago: metodoPago || 'efectivo',
        observaciones: observaciones || null,
        grupo: alumno.grupo,
      },
    });

    return NextResponse.json({
      success: true,
      pago,
      message: `Pago registrado correctamente para ${alumno.nombre}`,
    });
  } catch (err: any) {
    console.error('Error al registrar pago:', err);
    return NextResponse.json({ error: err.message || 'Error al registrar pago' }, { status: 500 });
  }
}

// DELETE: Anular o eliminar el pago de un alumno en un mes
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pagoId = searchParams.get('pagoId');
    const alumnoId = searchParams.get('alumnoId');
    const mes = searchParams.get('mes');

    if (pagoId) {
      await db.pagoCuotaEscuela.delete({
        where: { id: pagoId },
      });
      return NextResponse.json({ success: true, message: 'Pago eliminado correctamente' });
    }

    if (alumnoId && mes) {
      await db.pagoCuotaEscuela.delete({
        where: {
          alumnoId_mes: {
            alumnoId,
            mes,
          },
        },
      });
      return NextResponse.json({ success: true, message: 'Pago eliminado correctamente' });
    }

    return NextResponse.json({ error: 'Se requiere pagoId o alumnoId y mes' }, { status: 400 });
  } catch (err: any) {
    console.error('Error al eliminar pago:', err);
    return NextResponse.json({ error: err.message || 'Error al eliminar pago' }, { status: 500 });
  }
}

