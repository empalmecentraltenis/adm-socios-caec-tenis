import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get('date'); // YYYY-MM-DD

  if (!dateStr) {
    return NextResponse.json({ error: 'Falta el parámetro date' }, { status: 400 });
  }

  try {
    const targetDate = new Date(dateStr);
    
    // Sum all movements BEFORE the target date
    const movimientos = await db.movimiento.findMany({
      where: {
        fecha: {
          lt: targetDate,
        },
      },
      select: {
        tipo: true,
        monto: true,
      },
    });

    // Obtener saldo inicial de la configuración
    const config = await db.configuracion.findUnique({
      where: { clave: 'saldo_inicial_enero_2026' }
    });
    const saldoInicial = parseFloat(config?.valor || '0');

    const totalBalance = movimientos.reduce((acc, m) => {
      return acc + (m.tipo === 'ingreso' ? m.monto : -m.monto);
    }, saldoInicial);

    return NextResponse.json({ balance: totalBalance });
  } catch (error) {
    console.error('Error calculating balance at date:', error);
    return NextResponse.json({ error: 'Error al calcular el saldo' }, { status: 500 });
  }
}
