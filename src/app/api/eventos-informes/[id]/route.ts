import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const evento = await db.eventoInforme.findUnique({
      where: { id },
    });

    if (!evento) {
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    return NextResponse.json({ evento });
  } catch (err: any) {
    console.error('Error al obtener evento informe:', err);
    return NextResponse.json({ error: 'Error al consultar evento' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const {
      titulo,
      subtitulo,
      fechaTexto,
      fechaEvento,
      organizador,
      estado,
      ingresosTorneo = [],
      egresosTorneo = [],
      ingresosCantina = [],
      egresosCantina = [],
      ingresosOtros = [],
      egresosOtros = [],
      notas,
    } = body;

    const sumMonto = (arr: any[]) =>
      (Array.isArray(arr) ? arr : []).reduce(
        (acc: number, item: any) => acc + (parseFloat(item.monto) || 0),
        0
      );

    const sumIngresos =
      sumMonto(ingresosTorneo) + sumMonto(ingresosCantina) + sumMonto(ingresosOtros);
    const sumEgresos =
      sumMonto(egresosTorneo) + sumMonto(egresosCantina) + sumMonto(egresosOtros);
    const totalNeto = sumIngresos - sumEgresos;

    const [y, m, d] = String(fechaEvento).slice(0, 10).split('-').map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d));

    const actualizado = await db.eventoInforme.update({
      where: { id },
      data: {
        titulo: titulo.trim(),
        subtitulo: subtitulo ? subtitulo.trim() : null,
        fechaTexto: fechaTexto.trim(),
        fechaEvento: dateObj,
        organizador: organizador?.trim() || 'SubComision de Tenis',
        estado: estado || 'finalizado',
        ingresosTorneo,
        egresosTorneo,
        ingresosCantina,
        egresosCantina,
        ingresosOtros,
        egresosOtros,
        totalIngresos: sumIngresos,
        totalEgresos: sumEgresos,
        totalNeto,
        notas: notas ? notas.trim() : null,
      },
    });

    return NextResponse.json({ evento: actualizado, success: true });
  } catch (err: any) {
    console.error('Error al actualizar evento informe:', err);
    return NextResponse.json({ error: err.message || 'Error al actualizar evento' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.eventoInforme.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error al eliminar evento informe:', err);
    return NextResponse.json({ error: 'Error al eliminar evento' }, { status: 500 });
  }
}

