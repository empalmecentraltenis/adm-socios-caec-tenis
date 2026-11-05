import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const extractTime = (dateObj: Date | string): string => {
  try {
    if (dateObj instanceof Date) return dateObj.toISOString().substring(11, 16);
    const str = String(dateObj);
    if (str.includes('T')) return str.split('T')[1].substring(0, 5);
    return str.substring(0, 5);
  } catch {
    return '00:00';
  }
};

const extractDate = (dateObj: Date | string): string => {
  try {
    if (dateObj instanceof Date) return dateObj.toISOString().split('T')[0];
    return String(dateObj).split('T')[0];
  } catch {
    return '';
  }
};

/**
 * GET /api/socio-cuenta?dni=XXXXXXXX
 * Devuelve el resumen de cuenta de un socio:
 *   - turnosLuz: turnos nocturnos (>= 19:00) donde participó, con estado de pago
 *   - invitados:  cargos por invitados extra y su estado de pago
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dni = searchParams.get('dni');

    if (!dni) {
      return NextResponse.json({ error: 'Falta el parámetro dni' }, { status: 400 });
    }

    // Hora local Argentina
    const nowArg = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
    );
    const hoyStr = nowArg.toISOString().split('T')[0];
    const horaActualStr = nowArg.toISOString().substring(11, 16);
    const anioActual = nowArg.getFullYear();
    const startOfYear = new Date(`${anioActual}-01-01T00:00:00.000Z`);
    const endOfYear = new Date(`${anioActual}-12-31T23:59:59.999Z`);

    const esTurnoFinalizado = (fechaVal: Date | string, horaFinVal: Date | string): boolean => {
      const fStr = extractDate(fechaVal);
      const hFinStr = extractTime(horaFinVal);
      if (fStr < hoyStr) return true;
      if (fStr > hoyStr) return false;
      return hFinStr <= horaActualStr;
    };

    // 1. Configuraciones de precio
    const configs = await db.configuracion.findMany({
      where: { clave: { in: ['precio_luz_turno', 'precio_invitado_extra'] } },
    });
    let precioLuzTurno = 6000;
    let precioInvitadoExtra = 10000;
    for (const c of configs) {
      const val = parseFloat(c.valor);
      if (!isNaN(val) && val > 0) {
        if (c.clave === 'precio_luz_turno') precioLuzTurno = val;
        if (c.clave === 'precio_invitado_extra') precioInvitadoExtra = val;
      }
    }

    // 2. Buscar el socio para obtener sus datos
    const socio = await db.socio.findUnique({ where: { dni } });
    if (!socio) {
      return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 });
    }

    const allSocios = await db.socio.findMany({ select: { dni: true, nombre: true, apellido: true } });

    // 3. Turnos del año donde el socio participó (como titular o acompañante)
    const turnosAnio = await db.turno.findMany({
      where: {
        fecha: { gte: startOfYear, lte: endOfYear },
        estado: 'ocupado',
      },
      include: { cancha: { select: { id: true, nombre: true } } },
      orderBy: [{ fecha: 'desc' }, { horaInicio: 'desc' }],
    });

    // 4. Pagos de conceptos del socio en el año
    const pagosConcepto = await db.pagoConcepto.findMany({
      where: {
        socioDni: dni,
        fechaRegistro: { gte: startOfYear },
      },
      orderBy: { fechaRegistro: 'desc' },
    });

    // Indexar pagos de luz por turnoId
    const pagosLuzMap = new Map<string, typeof pagosConcepto[0]>();
    const pagosInvitados: typeof pagosConcepto = [];

    for (const p of pagosConcepto) {
      if (p.tipo === 'luz' && p.turnoId) {
        pagosLuzMap.set(p.turnoId, p);
      } else if (p.tipo === 'invitado_extra') {
        pagosInvitados.push(p);
      }
    }

    // 5. Filtrar turnos con luz donde participó este socio
    const turnosLuz: Array<{
      turnoId: string;
      fecha: string;
      horario: string;
      cancha: string;
      tipoPartido: string;
      esTitular: boolean;
      sociosCount: number;
      montoTotal: number;
      montoPorSocio: number;
      pagado: boolean;
      fechaPago: string | null;
    }> = [];

    // Fecha a partir de la cual se cobra la luz (anteriormente bonificada)
    const FECHA_INICIO_COBRO_LUZ = '2026-11-16';

    for (const t of turnosAnio) {
      const fechaStr = extractDate(t.fecha);
      // Turnos anteriores al 16/11/2026 quedan bonificados/libres de cobro
      if (fechaStr < FECHA_INICIO_COBRO_LUZ) continue;

      const horaStr = extractTime(t.horaInicio);
      if (horaStr < '19:00') continue;
      if (!esTurnoFinalizado(t.fecha, t.horaFin)) continue;

      const titularDni = t.socioDni || '';
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
          const matched = allSocios.find((s) => {
            const ap = norm(s.apellido);
            const nom = norm(s.nombre);
            return itemNorm.includes(ap) || `${ap} ${nom}`.includes(itemNorm) || `${nom} ${ap}`.includes(itemNorm);
          });
          if (matched) sociosEnTurno.push(matched.dni);
        }
      }

      const uniqueSocios = Array.from(new Set(sociosEnTurno));
      if (!uniqueSocios.includes(dni)) continue;

      const countSocios = Math.max(1, uniqueSocios.length);
      const montoPorSocio = Math.round(precioLuzTurno / countSocios);
      const esTitular = titularDni === dni;
      const tipoPartido = uniqueSocios.length > 2 ? (uniqueSocios.length === 4 ? 'Dobles' : `${uniqueSocios.length} Jugadores`) : 'Single';

      const pago = pagosLuzMap.get(t.id);
      const horaFinStr = extractTime(t.horaFin);

      turnosLuz.push({
        turnoId: t.id,
        fecha: fechaStr,
        horario: `${horaStr} - ${horaFinStr}`,
        cancha: t.cancha?.nombre || `Cancha ${t.canchaId}`,
        tipoPartido,
        esTitular,
        sociosCount: countSocios,
        montoTotal: precioLuzTurno,
        montoPorSocio,
        pagado: !!pago,
        fechaPago: pago ? extractDate(pago.fechaRegistro) : null,
      });
    }

    // 6. Invitados extra
    const invitados = pagosInvitados.map((p) => ({
      id: p.id,
      concepto: p.concepto,
      monto: p.monto,
      fechaRegistro: extractDate(p.fechaRegistro),
      metodoPago: p.metodoPago,
    }));

    // 7. Resumen
    const totalLuzPendiente = turnosLuz
      .filter((t) => !t.pagado)
      .reduce((acc, t) => acc + t.montoPorSocio, 0);
    const totalLuzPagado = turnosLuz
      .filter((t) => t.pagado)
      .reduce((acc, t) => acc + t.montoPorSocio, 0);
    const totalInvitadosPagado = invitados.reduce((acc, i) => acc + i.monto, 0);

    return NextResponse.json({
      socio: {
        nombre: socio.nombre,
        apellido: socio.apellido,
        dni: socio.dni,
        categoria: socio.categoria,
      },
      turnosLuz,
      invitados,
      resumen: {
        luzPendiente: totalLuzPendiente,
        luzPagado: totalLuzPagado,
        invitadosPagado: totalInvitadosPagado,
        totalPendiente: totalLuzPendiente,
      },
    });
  } catch (err: any) {
    console.error('Error en /api/socio-cuenta:', err);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

