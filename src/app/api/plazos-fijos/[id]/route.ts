import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function PUT(request: Request, context: any) {
  const { params } = context;
  const id = params.id;
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
    const { banco, montoInvertido, interesGenerado, fechaConstitucion, fechaVencimiento, estado } = data;

    const updateData: any = {};
    if (banco !== undefined) updateData.banco = banco;
    if (estado !== undefined) updateData.estado = estado;
    
    if (montoInvertido !== undefined) {
      updateData.montoInvertido = typeof montoInvertido === 'number' ? montoInvertido : parseFloat(String(montoInvertido).replace(',', '.'));
    }
    
    if (interesGenerado !== undefined) {
      updateData.interesGenerado = typeof interesGenerado === 'number' ? interesGenerado : parseFloat(String(interesGenerado).replace(',', '.'));
    }

    if (fechaConstitucion) {
      const [y, m, d] = fechaConstitucion.split('-').map(Number);
      updateData.fechaConstitucion = new Date(y, m - 1, d, 12, 0, 0);
    }

    if (fechaVencimiento) {
      const [y, m, d] = fechaVencimiento.split('-').map(Number);
      updateData.fechaVencimiento = new Date(y, m - 1, d, 12, 0, 0);
    }

    const plazo = await db.plazoFijo.update({
      where: { id },
      data: updateData,
    });

    await db.actividad.create({
      data: {
        accion: 'plazo_fijo_editado',
        detalle: `Plazo fijo editado (${banco || plazo.banco})`,
      },
    });

    return NextResponse.json({
      ...plazo,
      fechaConstitucion: plazo.fechaConstitucion.toISOString().split('T')[0],
      fechaVencimiento: plazo.fechaVencimiento.toISOString().split('T')[0],
    });
  } catch (error: any) {
    console.error('Error updating plazo fijo:', error);
    return NextResponse.json({ error: 'Error al actualizar plazo fijo' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: any) {
  const { params } = context;
  const id = params.id;
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const isReadOnly = (session.user as any).role === 'viewer';
  if (isReadOnly) {
    return NextResponse.json({ error: 'No tienes permisos' }, { status: 403 });
  }

  try {
    const plazo = await db.plazoFijo.delete({
      where: { id },
    });

    await db.actividad.create({
      data: {
        accion: 'plazo_fijo_eliminado',
        detalle: `Plazo fijo eliminado (${plazo.banco} por $${plazo.montoInvertido})`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting plazo fijo:', error);
    return NextResponse.json({ error: 'Error al eliminar plazo fijo' }, { status: 500 });
  }
}
