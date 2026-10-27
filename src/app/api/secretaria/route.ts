import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

async function logActividad(accion: string, detalle: string, socioId?: string) {
  try {
    await db.actividad.create({
      data: {
        accion,
        detalle,
        socioId: socioId || null,
      },
    });
  } catch (err) {
    console.warn('No se pudo registrar actividad:', err);
  }
}

// GET /api/secretaria - Obtener socios para mostrador y pagos del día
export async function GET() {
  try {
    // Hora local en Argentina
    const nowArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const hoyStr = format(nowArg, 'yyyy-MM-dd');
    const mesActual = format(nowArg, 'yyyy-MM');

    // 1. Configuraciones de cuotas
    const configuraciones = await db.configuracion.findMany();
    const getValor = (clave: string) => {
      const c = configuraciones.find((c) => c.clave === clave);
      return c ? parseFloat(c.valor) : 0;
    };
    const cuotaSocio = getValor("cuota_socio") || 7000;
    const cuotaAlumno = getValor("cuota_alumno") || 3500;
    const cuotaVitalicio = getValor("cuota_vitalicio") || 0;

    const cuotaPorCategoria: Record<string, number> = {
      socio: cuotaSocio,
      alumno: cuotaAlumno,
      vitalicio: cuotaVitalicio,
    };

    // 2. Obtener socios activos
    const sociosDb = await db.socio.findMany({
      where: { estado: 'activo' },
      include: {
        pagos: {
          orderBy: { mesPagado: 'desc' },
        },
        cuotas: {
          orderBy: { mes: 'asc' },
        },
      },
      orderBy: { apellido: 'asc' },
    });

    const [currentYear, currentMonth] = mesActual.split('-').map(Number);
    const mesActualNum = currentYear * 12 + currentMonth;

    const socios = sociosDb.map((s) => {
      const valorCuota = cuotaPorCategoria[s.categoria] || cuotaSocio;
      const mesesPagadosSet = new Set(s.pagos.map((p) => p.mesPagado));
      const ultimoPago = s.pagos[0]?.mesPagado || null;

      // Calcular meses pendientes reales y virtuales
      const mesesPendientes: string[] = [];

      if (s.categoria !== 'vitalicio' && s.rol !== 'admin') {
        // Analizar desde los últimos 12 meses hasta el mes actual
        for (let offset = -11; offset <= 0; offset++) {
          let y = currentYear;
          let m = currentMonth + offset;
          while (m <= 0) {
            y -= 1;
            m += 12;
          }
          const ymStr = `${y}-${String(m).padStart(2, '0')}`;
          
          // Solo si es igual o posterior a su fecha de alta
          if (s.fechaAlta) {
            const fechaAltaYm = format(new Date(s.fechaAlta), 'yyyy-MM');
            if (ymStr < fechaAltaYm) continue;
          }

          if (!mesesPagadosSet.has(ymStr)) {
            mesesPendientes.push(ymStr);
          }
        }
      }

      const mesesAdeudados = mesesPendientes.length;
      const alDia = mesesAdeudados < 2;
      const deudaEstimada = mesesAdeudados * valorCuota;

      return {
        id: s.id,
        dni: s.dni,
        nombre: s.nombre,
        apellido: s.apellido,
        nombreCompleto: `${s.apellido}, ${s.nombre}`,
        telefono: s.telefono || '',
        categoria: s.categoria,
        estado: s.estado,
        valorCuota,
        alDia,
        mesesAdeudados,
        deudaEstimada,
        ultimoMesPagado: ultimoPago,
        mesesPendientes,
        mesesPagados: Array.from(mesesPagadosSet),
      };
    });

    // 3. Pagos cobrados en el día de hoy
    const inicioDeHoy = new Date(`${hoyStr}T00:00:00.000-03:00`);
    const finDeHoy = new Date(`${hoyStr}T23:59:59.999-03:00`);

    const pagosHoyDb = await db.pagoCuota.findMany({
      where: {
        fechaRegistro: {
          gte: inicioDeHoy,
          lte: finDeHoy,
        },
      },
      include: {
        socio: {
          select: {
            id: true,
            nombre: true,
            apellido: true,
            dni: true,
            categoria: true,
          },
        },
      },
      orderBy: { fechaRegistro: 'desc' },
    });

    const pagosHoy = pagosHoyDb.map((p) => {
      const reg = new Date(p.fechaRegistro);
      const horaStr = new Intl.DateTimeFormat('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit',
        minute: '2-digit',
      }).format(reg);

      return {
        id: p.id,
        socioId: p.socioId,
        socioNombre: p.socio ? `${p.socio.apellido}, ${p.socio.nombre}` : 'Socio Desconocido',
        socioDni: p.socio?.dni || '-',
        categoria: p.socio?.categoria || 'socio',
        mesPagado: p.mesPagado,
        monto: p.monto,
        metodoPago: p.metodoPago || 'efectivo',
        hora: `${horaStr} hs`,
        fecha: format(reg, 'yyyy-MM-dd'),
      };
    });

    const totalRecaudado = pagosHoy.reduce((acc, p) => acc + p.monto, 0);
    const totalEfectivo = pagosHoy
      .filter((p) => p.metodoPago === 'efectivo')
      .reduce((acc, p) => acc + p.monto, 0);
    const totalTransferencia = pagosHoy
      .filter((p) => p.metodoPago !== 'efectivo')
      .reduce((acc, p) => acc + p.monto, 0);

    return NextResponse.json({
      mesActual,
      fechaHoy: hoyStr,
      cuotas: {
        socio: cuotaSocio,
        alumno: cuotaAlumno,
        vitalicio: cuotaVitalicio,
      },
      socios,
      pagosHoy,
      resumenHoy: {
        totalRecaudado,
        totalEfectivo,
        totalTransferencia,
        cantidadCobros: pagosHoy.length,
      },
    });
  } catch (error: any) {
    console.error('Error al obtener datos de secretaría:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener datos' }, { status: 500 });
  }
}

// POST /api/secretaria - Registrar cobro en mostrador
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { socioId, mesesPagados, montoTotal, montoUnitario, metodoPago } = body;

    if (!socioId || !mesesPagados || !Array.isArray(mesesPagados) || mesesPagados.length === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar un socio y al menos un mes a cobrar' },
        { status: 400 }
      );
    }

    const socio = await db.socio.findUnique({
      where: { id: socioId },
    });

    if (!socio) {
      return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 });
    }

    // Configuración para monto por defecto
    const configuraciones = await db.configuracion.findMany();
    const getValor = (clave: string) => {
      const c = configuraciones.find((c) => c.clave === clave);
      return c ? parseFloat(c.valor) : 0;
    };
    const cuotaDefault = socio.categoria === 'alumno' ? (getValor('cuota_alumno') || 3500) : (getValor('cuota_socio') || 7000);

    const montoPorMes = montoUnitario
      ? parseFloat(montoUnitario)
      : (montoTotal ? parseFloat(montoTotal) / mesesPagados.length : cuotaDefault);

    const resultados: Array<{ mes: string; status: string; id?: string; error?: string }> = [];

    for (const mes of mesesPagados) {
      // Verificar si ya está pago
      const yaPago = await db.pagoCuota.findFirst({
        where: {
          socioId,
          mesPagado: mes,
        },
      });

      if (yaPago) {
        resultados.push({ mes, status: 'ya_pagado', error: `El mes ${mes} ya estaba registrado como pagado.` });
        continue;
      }

      // Crear el registro de pago
      const nuevoPago = await db.pagoCuota.create({
        data: {
          socioId,
          mesPagado: mes,
          monto: montoPorMes,
          metodoPago: metodoPago || 'efectivo',
        },
      });

      // Sincronizar cuota pendiente si existiera
      const cuotaPendiente = await db.cuota.findFirst({
        where: {
          socioId,
          mes,
          estado: 'pendiente',
        },
      });

      if (cuotaPendiente) {
        await db.cuota.update({
          where: { id: cuotaPendiente.id },
          data: { estado: 'pagada' },
        });
      }

      // Log de auditoría
      await logActividad(
        'pago_secretaria',
        `Cobro en Secretaría de $${montoPorMes.toLocaleString('es-AR')} a ${socio.nombre} ${socio.apellido} - Cuota ${mes} (${metodoPago || 'efectivo'})`,
        socioId
      );

      resultados.push({ mes, status: 'ok', id: nuevoPago.id });
    }

    const cobradosOk = resultados.filter((r) => r.status === 'ok');
    const omitidos = resultados.filter((r) => r.status === 'ya_pagado');
    const totalCobrado = cobradosOk.length * montoPorMes;

    return NextResponse.json({
      success: true,
      totalCobrado,
      mesesCobrados: cobradosOk.map((r) => r.mes),
      mesesOmitidos: omitidos.map((r) => ({ mes: r.mes, error: r.error })),
      message: `Cobro de ${cobradosOk.length} mes(es) registrado correctamente por un total de $${totalCobrado.toLocaleString('es-AR')}.`,
      resultados,
    });
  } catch (error: any) {
    console.error('Error al registrar cobro en secretaría:', error);
    return NextResponse.json(
      { error: error.message || 'Error al procesar el cobro' },
      { status: 500 }
    );
  }
}
