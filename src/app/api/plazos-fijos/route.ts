import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const plazos = await db.plazoFijo.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    // Format dates to strings for consistent frontend usage
    const formatted = plazos.map(p => ({
      ...p,
      fechaConstitucion: p.fechaConstitucion.toISOString().split('T')[0],
      fechaVencimiento: p.fechaVencimiento.toISOString().split('T')[0],
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error fetching plazos fijos:', error);
    return NextResponse.json({ error: 'Error al obtener plazos fijos' }, { status: 500 });
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
    const { banco, montoInvertido, interesGenerado, fechaConstitucion, fechaVencimiento, estado } = data;

    // Clean numeric values
    const monto = typeof montoInvertido === 'number' ? montoInvertido : parseFloat(String(montoInvertido).replace(',', '.'));
    const interes = typeof interesGenerado === 'number' ? interesGenerado : parseFloat(String(interesGenerado).replace(',', '.'));

    // Handle Timezone correctly (local noon)
    const [cYear, cMonth, cDay] = fechaConstitucion.split('-').map(Number);
    const constLocal = new Date(cYear, cMonth - 1, cDay, 12, 0, 0);

    const [vYear, vMonth, vDay] = fechaVencimiento.split('-').map(Number);
    const vencLocal = new Date(vYear, vMonth - 1, vDay, 12, 0, 0);

    const plazo = await db.plazoFijo.create({
      data: {
        banco,
        montoInvertido: monto,
        interesGenerado: interes,
        fechaConstitucion: constLocal,
        fechaVencimiento: vencLocal,
        estado: estado || 'activo'
      },
    });

    await db.actividad.create({
      data: {
        accion: 'plazo_fijo_creado',
        detalle: `Plazo fijo creado en ${banco} por $${monto}`,
      },
    });

    return NextResponse.json({
      ...plazo,
      fechaConstitucion: plazo.fechaConstitucion.toISOString().split('T')[0],
      fechaVencimiento: plazo.fechaVencimiento.toISOString().split('T')[0],
    });
  } catch (error: any) {
    console.error('Error creating plazo fijo:', error);
    return NextResponse.json({ 
      error: 'Error al crear plazo fijo',
      details: error.message 
    }, { status: 500 });
  }
}
