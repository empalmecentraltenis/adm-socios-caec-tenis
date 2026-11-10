import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const anio = searchParams.get('anio') || '';

    const where: any = {};

    if (search.trim()) {
      where.OR = [
        { titulo: { contains: search, mode: 'insensitive' } },
        { subtitulo: { contains: search, mode: 'insensitive' } },
        { fechaTexto: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (anio && anio !== 'todos') {
      const anioNum = parseInt(anio, 10);
      if (!isNaN(anioNum)) {
        const start = new Date(Date.UTC(anioNum, 0, 1));
        const end = new Date(Date.UTC(anioNum, 11, 31, 23, 59, 59, 999));
        where.fechaEvento = {
          gte: start,
          lte: end,
        };
      }
    }

    const eventos = await db.eventoInforme.findMany({
      where,
      orderBy: { fechaEvento: 'desc' },
    });

    return NextResponse.json({ eventos });
  } catch (err: any) {
    console.error('Error al listar eventos informes:', err);
    return NextResponse.json({ error: 'Error al obtener informes de eventos' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      titulo,
      subtitulo,
      fechaTexto,
      fechaEvento,
      organizador = 'SubComision de Tenis',
      estado = 'finalizado',
      ingresosTorneo = [],
      egresosTorneo = [],
      ingresosCantina = [],
      egresosCantina = [],
      ingresosOtros = [],
      egresosOtros = [],
      notas = '',
    } = body;

    if (!titulo || !fechaTexto || !fechaEvento) {
      return NextResponse.json(
        { error: 'Título, texto de fecha y fecha son obligatorios' },
        { status: 400 }
      );
    }

    // Calcular subtotales
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

    const nuevo = await db.eventoInforme.create({
      data: {
        titulo: titulo.trim(),
        subtitulo: subtitulo ? subtitulo.trim() : null,
        fechaTexto: fechaTexto.trim(),
        fechaEvento: dateObj,
        organizador: organizador?.trim() || 'SubComision de Tenis',
        estado,
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

    return NextResponse.json({ evento: nuevo, success: true }, { status: 201 });
  } catch (err: any) {
    console.error('Error al crear evento informe:', err);
    return NextResponse.json({ error: err.message || 'Error al guardar evento' }, { status: 500 });
  }
}

