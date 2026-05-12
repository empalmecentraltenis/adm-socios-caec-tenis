import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const isReadOnly = (session.user as any).role === 'viewer';
  if (isReadOnly) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const data = await request.json();
    console.log('Actualizando movimiento:', { id, data });
    
    const { fecha, descripcion, responsable, tipo, monto } = data;

    // Aseguramos que el monto sea un número limpio
    const montoNumerico = typeof monto === 'number' ? monto : parseFloat(String(monto).replace(',', '.'));

    // Fix zona horaria: parsear YYYY-MM-DD y crear fecha al mediodía local
    const [year, month, day] = fecha.split('-').map(Number);
    const fechaLocal = new Date(year, month - 1, day, 12, 0, 0);

    const movimiento = await db.movimiento.update({
      where: { id },
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
        accion: 'movimiento_editado',
        detalle: `Movimiento editado: ${descripcion} (${tipo}) por $${montoNumerico}`,
      },
    });

    return NextResponse.json({
      ...movimiento,
      fecha: movimiento.fecha.toISOString().split('T')[0]
    });
  } catch (error: any) {
    console.error('Error updating movimiento:', error);
    return NextResponse.json({ 
      error: 'Error al actualizar movimiento', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const isReadOnly = (session.user as any).role === 'viewer';
  if (isReadOnly) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const movimiento = await db.movimiento.delete({
      where: { id },
    });

    // Registrar actividad
    await db.actividad.create({
      data: {
        accion: 'movimiento_eliminado',
        detalle: `Movimiento eliminado: ${movimiento.descripcion}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting movimiento:', error);
    return NextResponse.json({ 
      error: 'Error al eliminar movimiento',
      details: error.message
    }, { status: 500 });
  }
}
