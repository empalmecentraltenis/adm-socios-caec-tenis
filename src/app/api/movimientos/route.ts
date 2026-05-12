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

    const formatted = movimientos.map(m => ({
      ...m,
      fecha: m.fecha.toISOString().split('T')[0]
    }));

    return NextResponse.json(formatted);
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
    console.log('Creando movimiento:', data);
    const { fecha, descripcion, responsable, tipo, monto } = data;

    // Aseguramos que el monto sea un número limpio
    const montoNumerico = typeof monto === 'number' ? monto : parseFloat(String(monto).replace(',', '.'));

    // Fix zona horaria: parsear YYYY-MM-DD y crear fecha al mediodía local
    const [year, month, day] = fecha.split('-').map(Number);
    const fechaLocal = new Date(year, month - 1, day, 12, 0, 0);

    const movimiento = await db.movimiento.create({
      data: {
        fecha: fechaLocal,
        descripcion,
        responsable,
        tipo,
        monto: montoNumerico,
      },
    });

    // Registrar actividad
    await db.actividad.create({
      data: {
        accion: 'movimiento_creado',
        detalle: `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} registrado: ${descripcion} por $${montoNumerico}`,
      },
    });

    return NextResponse.json({
      ...movimiento,
      fecha: movimiento.fecha.toISOString().split('T')[0]
    });
  } catch (error: any) {
    console.error('Error creating movimiento:', error);
    return NextResponse.json({ 
      error: 'Error al crear movimiento',
      details: error.message 
    }, { status: 500 });
  }
}
