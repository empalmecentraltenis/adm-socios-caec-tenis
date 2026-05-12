import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mes = searchParams.get('mes'); // YYYY-MM

  if (!mes) {
    return NextResponse.json({ error: 'Falta el parámetro mes' }, { status: 400 });
  }

  try {
    const startDate = new Date(`${mes}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const movimientos = await db.movimiento.findMany({
      where: {
        fecha: {
          gte: startDate,
          lt: endDate,
        },
      },
      orderBy: {
        fecha: 'asc',
      },
    });

    return NextResponse.json(movimientos);
  } catch (error) {
    console.error('Error fetching movimientos:', error);
    return NextResponse.json({ error: 'Error al obtener movimientos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const isReadOnly = (session.user as any).role === 'viewer';
  if (isReadOnly) {
    return NextResponse.json({ error: 'No tienes permisos para realizar esta acción' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const { fecha, descripcion, responsable, tipo, monto } = data;

    const movimiento = await db.movimiento.create({
      data: {
        fecha: new Date(fecha),
        descripcion,
        responsable,
        tipo,
        monto: parseFloat(monto),
      },
    });

    // Registrar actividad
    await db.actividad.create({
      data: {
        accion: 'movimiento_creado',
        detalle: `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado: ${descripcion} por $${monto}`,
      },
    });

    return NextResponse.json(movimiento);
  } catch (error) {
    console.error('Error creating movimiento:', error);
    return NextResponse.json({ error: 'Error al crear movimiento' }, { status: 500 });
  }
}
