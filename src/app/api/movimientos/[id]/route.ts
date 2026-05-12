import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const isReadOnly = (session.user as any).role === 'viewer';
  if (isReadOnly) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    const data = await request.json();
    const { fecha, descripcion, responsable, tipo, monto } = data;

    const movimiento = await db.movimiento.update({
      where: { id: params.id },
      data: {
        fecha: new Date(fecha),
        descripcion,
        responsable,
        tipo,
        monto: parseFloat(monto),
      },
    });

    return NextResponse.json(movimiento);
  } catch (error) {
    console.error('Error updating movimiento:', error);
    return NextResponse.json({ error: 'Error al actualizar movimiento' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const isReadOnly = (session.user as any).role === 'viewer';
  if (isReadOnly) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });

  try {
    await db.movimiento.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting movimiento:', error);
    return NextResponse.json({ error: 'Error al eliminar movimiento' }, { status: 500 });
  }
}
