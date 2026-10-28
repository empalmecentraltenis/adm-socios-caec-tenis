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

const extractTime = (dateObj: Date | string): string => {
  try {
    if (dateObj instanceof Date) {
      return dateObj.toISOString().substring(11, 16);
    }
    const str = String(dateObj);
    if (str.includes('T')) return str.split('T')[1].substring(0, 5);
    return str.substring(0, 5);
  } catch {
    return '00:00';
  }
};

const extractDate = (dateObj: Date | string): string => {
  try {
    if (dateObj instanceof Date) {
      return dateObj.toISOString().split('T')[0];
    }
    return String(dateObj).split('T')[0];
  } catch {
    return '';
  }
};

// GET /api/secretaria - Obtener socios para mostrador con cuotas, turnos con luz e invitados
export async function GET() {
  try {
    // Hora local en Argentina
    const nowArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const hoyStr = format(nowArg, 'yyyy-MM-dd');
    const mesActual = format(nowArg, 'yyyy-MM');
    const anioActual = nowArg.getFullYear();
    const startOfYear = new Date(`${anioActual}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${anioActual}-12-31T23:59:59.999Z`);

    // 1. Configuraciones
    const configuraciones = await db.configuracion.findMany();
    const getValor = (clave: string) => {
      const c = configuraciones.find((item) => item.clave === clave);
      return c ? parseFloat(c.valor) : 0;
    };
    const cuotaSocio = getValor("cuota_socio") || 7000;
    const cuotaAlumno = getValor("cuota_alumno") || 3500;
    const cuotaVitalicio = getValor("cuota_vitalicio") || 0;
    const precioLuzTurno = getValor("precio_luz_turno") || 6000;
    const precioInvitadoExtra = getValor("precio_invitado_extra") || 10000;

    const cuotaPorCategoria: Record<string, number> = {
      socio: cuotaSocio,
      alumno: cuotaAlumno,
      vitalicio: cuotaVitalicio,
    };

    // 2. Obtener socios activos, turnos de 2026 y pagos de conceptos
    const [sociosDb, turnosAnioDb, pagosConceptosAnioDb] = await Promise.all([
      db.socio.findMany({
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
      }),
      db.turno.findMany({
        where: {
          fecha: {
            gte: startOfYear,
            lte: endOfYear,
          },
          estado: { in: ['ocupado', 'bloqueado'] },
        },
        include: {
          cancha: {
            select: { id: true, nombre: true },
          },
        },
        orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
      }),
      db.pagoConcepto.findMany({
        where: {
          fechaRegistro: {
            gte: startOfYear,
          },
        },
        orderBy: { fechaRegistro: 'desc' },
      }),
    ]);

    const socioMapByDni = new Map<string, typeof sociosDb[0]>();
    for (const s of sociosDb) {
      socioMapByDni.set(s.dni, s);
    }

    // Indexar pagos de conceptos (luz e invitados)
    // Map de luz: `${dni}_${turnoId}` -> PagoConcepto
    const pagosLuzMap = new Map<string, typeof pagosConceptosAnioDb[0]>();
    // Map de invitados por socio: `dni` -> PagoConcepto[]
    const pagosInvitadosPorSocio = new Map<string, typeof pagosConceptosAnioDb>();

    for (const p of pagosConceptosAnioDb) {
      if (p.tipo === 'luz' && p.turnoId) {
        pagosLuzMap.set(`${p.socioDni}_${p.turnoId}`, p);
      } else if (p.tipo === 'invitado_extra') {
        const list = pagosInvitadosPorSocio.get(p.socioDni) || [];
        list.push(p);
        pagosInvitadosPorSocio.set(p.socioDni, list);
      }
    }

    // 3. Procesar TURNOS CON LUZ nocturnos (>= 19:00 hs)
    // dni -> list of turnos
    const turnosLuzPorSocio = new Map<string, Array<{
      turnoId: string;
      fecha: string;
      hora: string;
      cancha: string;
      tipoPartido: string;
      monto: number;
      sociosCount: number;
      pagado: boolean;
      pagoId?: string;
    }>>();

    for (const t of turnosAnioDb) {
      if (t.estado !== 'ocupado') continue;
      const horaStr = extractTime(t.horaInicio);
      if (horaStr < '19:00') continue;

      const fechaStr = extractDate(t.fecha);
      const canchaNombre = t.cancha?.nombre || `Cancha ${t.canchaId}`;
      const titularDni = t.socioDni || '';

      // Identificar socios participantes
      const dnisAcomps = (t.participantesDnis || []).filter((d) => d && d !== titularDni);
      const sociosEnTurno: string[] = [];
      if (titularDni) sociosEnTurno.push(titularDni);

      if (dnisAcomps.length > 0) {
        for (const d of dnisAcomps) {
          if (d !== '123987456') {
            sociosEnTurno.push(d);
          }
        }
      } else {
        const rawAcomp = (t.acompanante || '').trim();
        const acompsList = rawAcomp.includes('/') ? rawAcomp.split('/').map((s) => s.trim()) : [rawAcomp];
        for (const item of acompsList) {
          if (!item) continue;
          const lower = item.toLowerCase();
          if (lower.includes('especial') || lower.includes('invitado')) continue;
          const norm = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          const itemNorm = norm(item);
          const matched = sociosDb.find((s) => {
            const ap = norm(s.apellido);
            const nom = norm(s.nombre);
            return itemNorm.includes(ap) || `${ap} ${nom}`.includes(itemNorm) || `${nom} ${ap}`.includes(itemNorm);
          });
          if (matched) sociosEnTurno.push(matched.dni);
        }
      }

      const uniqueSocios = Array.from(new Set(sociosEnTurno));
      const countSocios = Math.max(1, uniqueSocios.length);
      const montoPorSocio = Math.round(precioLuzTurno / countSocios);
      const tipoPartido = uniqueSocios.length > 2 ? (uniqueSocios.length === 4 ? 'Dobles' : `${uniqueSocios.length} Jugadores`) : 'Single';

      for (const dni of uniqueSocios) {
        const pagoLuz = pagosLuzMap.get(`${dni}_${t.id}`);
        const itemLuz = {
          turnoId: t.id,
          fecha: fechaStr,
          hora: horaStr,
          cancha: canchaNombre,
          tipoPartido,
          monto: montoPorSocio,
          sociosCount: countSocios,
          pagado: !!pagoLuz,
          pagoId: pagoLuz?.id,
        };

        const list = turnosLuzPorSocio.get(dni) || [];
        list.push(itemLuz);
        turnosLuzPorSocio.set(dni, list);
      }
    }

    // 4. Procesar INVITADOS (Cupo de 4 gratis anuales)
    // titularDni -> list of turnos with guests
    const turnosInvitadosPorSocio = new Map<string, Array<{
      turnoId: string;
      fecha: string;
      hora: string;
      cancha: string;
      cantidadInvitados: number;
    }>>();

    for (const t of turnosAnioDb) {
      const titularDni = t.socioDni;
      if (!titularDni) continue;

      let countInvitados = 0;
      if (t.participantesDnis && t.participantesDnis.length > 0) {
        countInvitados = t.participantesDnis.filter((d) => d === '123987456').length;
      } else if (t.acompanante) {
        const matches = t.acompanante.match(/Especial,\s*I\.|Invitado/gi);
        countInvitados = matches ? matches.length : (t.acompanante.toLowerCase().includes('invitado') || t.acompanante.toLowerCase().includes('especial') ? 1 : 0);
      }

      if (countInvitados > 0) {
        const list = turnosInvitadosPorSocio.get(titularDni) || [];
        list.push({
          turnoId: t.id,
          fecha: extractDate(t.fecha),
          hora: extractTime(t.horaInicio),
          cancha: t.cancha?.nombre || `Cancha ${t.canchaId}`,
          cantidadInvitados: countInvitados,
        });
        turnosInvitadosPorSocio.set(titularDni, list);
      }
    }

    // 5. Mapear cada socio con Cuotas + Luz + Invitados
    const [currentYear, currentMonth] = mesActual.split('-').map(Number);

    const socios = sociosDb.map((s) => {
      // A) CUOTAS
      const valorCuota = cuotaPorCategoria[s.categoria] || cuotaSocio;
      const mesesPagadosSet = new Set(s.pagos.map((p) => p.mesPagado));
      const ultimoPago = s.pagos[0]?.mesPagado || null;

      const mesesPendientes: string[] = [];
      if (s.categoria !== 'vitalicio' && s.rol !== 'admin') {
        for (let offset = -11; offset <= 0; offset++) {
          let y = currentYear;
          let m = currentMonth + offset;
          while (m <= 0) {
            y -= 1;
            m += 12;
          }
          const ymStr = `${y}-${String(m).padStart(2, '0')}`;
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
      const alDiaCuota = mesesAdeudados < 2;
      const deudaCuotas = mesesAdeudados * valorCuota;

      // B) LUZ
      const turnosLuz = turnosLuzPorSocio.get(s.dni) || [];
      const turnosLuzPendientes = turnosLuz.filter((t) => !t.pagado);
      const turnosLuzPagados = turnosLuz.filter((t) => t.pagado);
      const deudaLuz = turnosLuzPendientes.reduce((acc, t) => acc + t.monto, 0);

      // C) INVITADOS
      const turnosConInvitados = turnosInvitadosPorSocio.get(s.dni) || [];
      const totalInvitadosUsados = turnosConInvitados.reduce((acc, t) => acc + t.cantidadInvitados, 0);
      const bonificadosUsados = Math.min(4, totalInvitadosUsados);
      const bonificadosRestantes = Math.max(0, 4 - totalInvitadosUsados);
      const extrasTotal = Math.max(0, totalInvitadosUsados - 4);

      // Pagos de invitados registrados para este socio
      const pagosInvitados = pagosInvitadosPorSocio.get(s.dni) || [];
      const extrasPagadosCount = pagosInvitados.length;
      const extrasPendientesCount = Math.max(0, extrasTotal - extrasPagadosCount);
      const deudaInvitados = extrasPendientesCount * precioInvitadoExtra;

      // Desglose cronológico de invitados para la interfaz
      let acumulado = 0;
      // Contabilizar pagos por turno o generales del socio
      const pagosPorTurnoId = new Map<string, number>();
      let pagosSinTurnoId = 0;
      for (const p of pagosInvitados) {
        if (p.turnoId) {
          pagosPorTurnoId.set(p.turnoId, (pagosPorTurnoId.get(p.turnoId) || 0) + 1);
        } else {
          pagosSinTurnoId++;
        }
      }

      const desgloseInvitados = turnosConInvitados.map((t) => {
        const desde = acumulado + 1;
        acumulado += t.cantidadInvitados;
        const hasta = acumulado;

        let bonificadosEnTurno = 0;
        let conCargoEnTurno = 0;

        for (let i = desde; i <= hasta; i++) {
          if (i <= 4) bonificadosEnTurno++;
          else conCargoEnTurno++;
        }

        // Calcular cuántos cargos de este turno ya fueron pagados
        let pagadosEnTurno = pagosPorTurnoId.get(t.turnoId) || 0;
        if (pagadosEnTurno === 0 && pagosSinTurnoId > 0 && conCargoEnTurno > 0) {
          const aCubrir = Math.min(conCargoEnTurno, pagosSinTurnoId);
          pagadosEnTurno += aCubrir;
          pagosSinTurnoId -= aCubrir;
        }

        const pendientesEnTurno = Math.max(0, conCargoEnTurno - pagadosEnTurno);
        const pagado = conCargoEnTurno > 0 && pendientesEnTurno === 0;

        return {
          turnoId: t.turnoId,
          fecha: t.fecha,
          hora: t.hora,
          cancha: t.cancha,
          cantidad: t.cantidadInvitados,
          bonificados: bonificadosEnTurno,
          conCargo: conCargoEnTurno,
          pagados: pagadosEnTurno,
          pendientes: pendientesEnTurno,
          montoCargo: conCargoEnTurno * precioInvitadoExtra,
          montoPendiente: pendientesEnTurno * precioInvitadoExtra,
          pagado,
        };
      });

      // D) CONSOLIDADO
      const deudaTotal = deudaCuotas + deudaLuz + deudaInvitados;
      const alDiaGlobal = alDiaCuota && deudaLuz === 0 && deudaInvitados === 0;

      return {
        id: s.id,
        dni: s.dni,
        nombre: s.nombre,
        apellido: s.apellido,
        nombreCompleto: `${s.apellido}, ${s.nombre}`,
        telefono: s.telefono || '',
        categoria: s.categoria,
        estado: s.estado,
        // Cuotas
        valorCuota,
        alDiaCuota,
        mesesAdeudados,
        deudaCuotas,
        ultimoMesPagado: ultimoPago,
        mesesPendientes,
        mesesPagados: Array.from(mesesPagadosSet),
        // Luz
        luz: {
          totalTurnos: turnosLuz.length,
          turnosPendientes: turnosLuzPendientes,
          turnosPagados: turnosLuzPagados,
          deudaLuz,
        },
        // Invitados
        invitados: {
          totalInvitadosUsados,
          bonificadosUsados,
          bonificadosRestantes,
          extrasTotal,
          extrasPagadosCount,
          extrasPendientesCount,
          deudaInvitados,
          desglose: desgloseInvitados,
        },
        // Total
        deudaTotal,
        alDia: alDiaGlobal,
      };
    });

    // 6. Pagos cobrados en el día de hoy (Caja de mostrador)
    const inicioDeHoy = new Date(`${hoyStr}T00:00:00.000-03:00`);
    const finDeHoy = new Date(`${hoyStr}T23:59:59.999-03:00`);

    const [pagosHoyCuotasDb, pagosHoyConceptosDb] = await Promise.all([
      db.pagoCuota.findMany({
        where: {
          fechaRegistro: {
            gte: inicioDeHoy,
            lte: finDeHoy,
          },
        },
        include: {
          socio: {
            select: { id: true, nombre: true, apellido: true, dni: true, categoria: true },
          },
        },
        orderBy: { fechaRegistro: 'desc' },
      }),
      db.pagoConcepto.findMany({
        where: {
          fechaRegistro: {
            gte: inicioDeHoy,
            lte: finDeHoy,
          },
        },
        include: {
          socio: {
            select: { id: true, nombre: true, apellido: true, dni: true, categoria: true },
          },
        },
        orderBy: { fechaRegistro: 'desc' },
      }),
    ]);

    const pagosHoyUnificados = [
      ...pagosHoyCuotasDb.map((p) => {
        const reg = new Date(p.fechaRegistro);
        const horaStr = new Intl.DateTimeFormat('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          hour: '2-digit',
          minute: '2-digit',
        }).format(reg);

        return {
          id: p.id,
          tipo: 'cuota',
          concepto: `Cuota ${p.mesPagado}`,
          socioId: p.socioId,
          socioNombre: p.socio ? `${p.socio.apellido}, ${p.socio.nombre}` : 'Socio Desconocido',
          socioDni: p.socio?.dni || '-',
          categoria: p.socio?.categoria || 'socio',
          detalle: `Mes: ${p.mesPagado}`,
          monto: p.monto,
          metodoPago: p.metodoPago || 'efectivo',
          hora: `${horaStr} hs`,
          fecha: format(reg, 'yyyy-MM-dd'),
        };
      }),
      ...pagosHoyConceptosDb.map((p) => {
        const reg = new Date(p.fechaRegistro);
        const horaStr = new Intl.DateTimeFormat('es-AR', {
          timeZone: 'America/Argentina/Buenos_Aires',
          hour: '2-digit',
          minute: '2-digit',
        }).format(reg);

        return {
          id: p.id,
          tipo: p.tipo,
          concepto: p.concepto || (p.tipo === 'luz' ? 'Turno con Luz' : 'Invitado Adicional'),
          socioId: p.socioId,
          socioNombre: p.socio ? `${p.socio.apellido}, ${p.socio.nombre}` : 'Socio Desconocido',
          socioDni: p.socioDni || p.socio?.dni || '-',
          categoria: p.socio?.categoria || 'socio',
          detalle: p.concepto,
          monto: p.monto,
          metodoPago: p.metodoPago || 'efectivo',
          hora: `${horaStr} hs`,
          fecha: format(reg, 'yyyy-MM-dd'),
        };
      }),
    ].sort((a, b) => b.hora.localeCompare(a.hora));

    const totalRecaudado = pagosHoyUnificados.reduce((acc, p) => acc + p.monto, 0);
    const totalEfectivo = pagosHoyUnificados
      .filter((p) => p.metodoPago === 'efectivo')
      .reduce((acc, p) => acc + p.monto, 0);
    const totalTransferencia = pagosHoyUnificados
      .filter((p) => p.metodoPago !== 'efectivo')
      .reduce((acc, p) => acc + p.monto, 0);

    const totalCuotasHoy = pagosHoyUnificados
      .filter((p) => p.tipo === 'cuota')
      .reduce((acc, p) => acc + p.monto, 0);
    const totalLuzHoy = pagosHoyUnificados
      .filter((p) => p.tipo === 'luz')
      .reduce((acc, p) => acc + p.monto, 0);
    const totalInvitadosHoy = pagosHoyUnificados
      .filter((p) => p.tipo === 'invitado_extra')
      .reduce((acc, p) => acc + p.monto, 0);

    return NextResponse.json({
      mesActual,
      fechaHoy: hoyStr,
      anioActual,
      tarifas: {
        cuotas: {
          socio: cuotaSocio,
          alumno: cuotaAlumno,
          vitalicio: cuotaVitalicio,
        },
        precioLuzTurno,
        precioInvitadoExtra,
      },
      socios,
      pagosHoy: pagosHoyUnificados,
      resumenHoy: {
        totalRecaudado,
        totalEfectivo,
        totalTransferencia,
        totalCuotas: totalCuotasHoy,
        totalLuz: totalLuzHoy,
        totalInvitados: totalInvitadosHoy,
        cantidadCobros: pagosHoyUnificados.length,
      },
    });
  } catch (error: any) {
    console.error('Error al obtener datos de secretaría:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener datos' }, { status: 500 });
  }
}

// POST /api/secretaria - Registrar cobro en mostrador (Cuotas + Luz + Invitados)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      socioId,
      mesesPagados = [],
      turnosLuzCobrados = [],
      invitadosCobrados = [],
      montoTotal,
      metodoPago = 'efectivo',
    } = body;

    if (!socioId) {
      return NextResponse.json({ error: 'Debe especificar el socio a cobrar' }, { status: 400 });
    }

    const totalItems =
      (Array.isArray(mesesPagados) ? mesesPagados.length : 0) +
      (Array.isArray(turnosLuzCobrados) ? turnosLuzCobrados.length : 0) +
      (Array.isArray(invitadosCobrados) ? invitadosCobrados.length : 0);

    if (totalItems === 0) {
      return NextResponse.json(
        { error: 'Debe seleccionar al menos un concepto a cobrar (cuota, turno con luz o invitado extra)' },
        { status: 400 }
      );
    }

    const socio = await db.socio.findUnique({
      where: { id: socioId },
    });

    if (!socio) {
      return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 });
    }

    // Configuración para tarifas por defecto
    const configuraciones = await db.configuracion.findMany();
    const getValor = (clave: string) => {
      const c = configuraciones.find((item) => item.clave === clave);
      return c ? parseFloat(c.valor) : 0;
    };
    const cuotaDefault = socio.categoria === 'alumno' ? (getValor('cuota_alumno') || 3500) : (getValor('cuota_socio') || 7000);
    const precioInvitadoDefault = getValor('precio_invitado_extra') || 10000;

    const resultadosCobro: Array<{
      tipo: 'cuota' | 'luz' | 'invitado_extra';
      concepto: string;
      monto: number;
      id?: string;
      status: 'ok' | 'ya_pagado' | 'error';
      error?: string;
    }> = [];

    // 1. Procesar CUOTAS
    if (Array.isArray(mesesPagados) && mesesPagados.length > 0) {
      const montoPorCuota = cuotaDefault;

      for (const mes of mesesPagados) {
        const yaPago = await db.pagoCuota.findFirst({
          where: { socioId, mesPagado: mes },
        });

        if (yaPago) {
          resultadosCobro.push({
            tipo: 'cuota',
            concepto: `Cuota ${mes}`,
            monto: yaPago.monto,
            status: 'ya_pagado',
            error: `El mes ${mes} ya estaba registrado como pagado.`,
          });
          continue;
        }

        const nuevoPago = await db.pagoCuota.create({
          data: {
            socioId,
            mesPagado: mes,
            monto: montoPorCuota,
            metodoPago,
          },
        });

        // Sincronizar cuota pendiente si existiera
        const cuotaPendiente = await db.cuota.findFirst({
          where: { socioId, mes, estado: 'pendiente' },
        });

        if (cuotaPendiente) {
          await db.cuota.update({
            where: { id: cuotaPendiente.id },
            data: { estado: 'pagada' },
          });
        }

        resultadosCobro.push({
          tipo: 'cuota',
          concepto: `Cuota ${mes}`,
          monto: montoPorCuota,
          id: nuevoPago.id,
          status: 'ok',
        });
      }
    }

    // 2. Procesar TURNOS CON LUZ
    if (Array.isArray(turnosLuzCobrados) && turnosLuzCobrados.length > 0) {
      for (const item of turnosLuzCobrados) {
        const turnoId = item.turnoId;
        const monto = parseFloat(item.monto) || 3000;
        const conceptoDesc = item.concepto || `Uso de luz nocturna turno ${item.fecha || ''} ${item.hora || ''}`;

        // Verificar si ya se registró
        const yaPago = await db.pagoConcepto.findFirst({
          where: {
            socioDni: socio.dni,
            turnoId,
            tipo: 'luz',
          },
        });

        if (yaPago) {
          resultadosCobro.push({
            tipo: 'luz',
            concepto: conceptoDesc,
            monto,
            status: 'ya_pagado',
            error: `El turno de luz ya estaba registrado como pagado.`,
          });
          continue;
        }

        const nuevoPago = await db.pagoConcepto.create({
          data: {
            socioId: socio.id,
            socioDni: socio.dni,
            tipo: 'luz',
            concepto: conceptoDesc,
            turnoId,
            monto,
            metodoPago,
          },
        });

        resultadosCobro.push({
          tipo: 'luz',
          concepto: conceptoDesc,
          monto,
          id: nuevoPago.id,
          status: 'ok',
        });
      }
    }

    // 3. Procesar INVITADOS EXTRAS
    if (Array.isArray(invitadosCobrados) && invitadosCobrados.length > 0) {
      for (const item of invitadosCobrados) {
        const cantidad = parseInt(item.cantidad) || 1;
        const montoUnitario = parseFloat(item.montoUnitario) || precioInvitadoDefault;
        const conceptoDesc = item.concepto || `Invitado adicional (${cantidad}) - ${item.fecha || ''}`;

        // Verificar si ya se registraron pagos para este turno
        let yaPagadosEnTurno = 0;
        if (item.turnoId) {
          yaPagadosEnTurno = await db.pagoConcepto.count({
            where: {
              socioDni: socio.dni,
              tipo: 'invitado_extra',
              turnoId: item.turnoId,
            },
          });
        }

        const aCobrar = Math.max(0, cantidad - yaPagadosEnTurno);

        if (aCobrar === 0) {
          resultadosCobro.push({
            tipo: 'invitado_extra',
            concepto: conceptoDesc,
            monto: cantidad * montoUnitario,
            status: 'ya_pagado',
            error: `El pase de invitado ya estaba registrado como pagado.`,
          });
          continue;
        }

        for (let i = 0; i < aCobrar; i++) {
          const nuevoPago = await db.pagoConcepto.create({
            data: {
              socioId: socio.id,
              socioDni: socio.dni,
              tipo: 'invitado_extra',
              concepto: `${conceptoDesc} (Pase ${i + 1}/${aCobrar})`,
              turnoId: item.turnoId || null,
              monto: montoUnitario,
              metodoPago,
            },
          });

          resultadosCobro.push({
            tipo: 'invitado_extra',
            concepto: `${conceptoDesc} (Pase ${i + 1}/${aCobrar})`,
            monto: montoUnitario,
            id: nuevoPago.id,
            status: 'ok',
          });
        }
      }
    }

    const cobradosOk = resultadosCobro.filter((r) => r.status === 'ok');
    const omitidos = resultadosCobro.filter((r) => r.status === 'ya_pagado');
    const totalEfectivoCobrado = cobradosOk.reduce((acc, r) => acc + r.monto, 0);

    // Auditoría
    const conceptosAudit = cobradosOk.map((c) => c.concepto).join(', ');
    await logActividad(
      'pago_secretaria',
      `Cobro mostrador $${totalEfectivoCobrado.toLocaleString('es-AR')} a ${socio.nombre} ${socio.apellido} (${metodoPago}): ${conceptosAudit}`,
      socio.id
    );

    return NextResponse.json({
      success: true,
      totalCobrado: totalEfectivoCobrado,
      itemsCobrados: cobradosOk,
      itemsOmitidos: omitidos,
      message: `Cobro de ${cobradosOk.length} concepto(s) registrado por $${totalEfectivoCobrado.toLocaleString('es-AR')}.`,
      resultados: resultadosCobro,
    });
  } catch (error: any) {
    console.error('Error al registrar cobro en secretaría:', error);
    return NextResponse.json({ error: error.message || 'Error al procesar el cobro' }, { status: 500 });
  }
}
