import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'mes'; // 'mes' | 'semana' | 'dia' | 'anio'
    const mesParam = searchParams.get('mes'); // YYYY-MM
    const anioParam = searchParams.get('anio'); // YYYY
    const fechaParam = searchParams.get('fecha'); // YYYY-MM-DD
    const desdeParam = searchParams.get('desde'); // YYYY-MM-DD
    const hastaParam = searchParams.get('hasta'); // YYYY-MM-DD

    // 1. Obtener tarifas y cupos configurados
    const configs = await db.configuracion.findMany({
      where: {
        clave: { in: ['precio_invitado_extra', 'cupo_invitados_anual'] },
      },
    });

    let precioInvitadoExtra = 10000;
    let cupoInvitadosAnual = 4;

    for (const c of configs) {
      if (c.clave === 'precio_invitado_extra') {
        const val = parseFloat(c.valor);
        if (!isNaN(val) && val >= 0) precioInvitadoExtra = val;
      }
      if (c.clave === 'cupo_invitados_anual') {
        const val = parseInt(c.valor, 10);
        if (!isNaN(val) && val >= 0) cupoInvitadosAnual = val;
      }
    }

    // 2. Determinar el año y el rango de fechas solicitado
    const now = new Date();
    let targetYear = now.getFullYear();

    if (mesParam) {
      targetYear = parseInt(mesParam.split('-')[0], 10);
    } else if (anioParam) {
      targetYear = parseInt(anioParam, 10);
    } else if (fechaParam) {
      targetYear = parseInt(fechaParam.split('-')[0], 10);
    } else if (desdeParam) {
      targetYear = parseInt(desdeParam.split('-')[0], 10);
    }

    const startOfYear = new Date(Date.UTC(targetYear, 0, 1, 0, 0, 0, 0));
    const endOfYear = new Date(Date.UTC(targetYear, 11, 31, 23, 59, 59, 999));

    let startDate: Date;
    let endDate: Date;

    if (tipo === 'dia' && fechaParam) {
      const [y, m, d] = fechaParam.split('-').map(Number);
      startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999));
    } else if (tipo === 'mes' && mesParam) {
      const [y, m] = mesParam.split('-').map(Number);
      startDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    } else if (tipo === 'anio') {
      startDate = startOfYear;
      endDate = endOfYear;
    } else if (desdeParam && hastaParam) {
      const [y1, m1, d1] = desdeParam.split('-').map(Number);
      const [y2, m2, d2] = hastaParam.split('-').map(Number);
      startDate = new Date(Date.UTC(y1, m1 - 1, d1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(y2, m2 - 1, d2, 23, 59, 59, 999));
    } else {
      // Default: Mes actual
      startDate = new Date(Date.UTC(targetYear, now.getMonth(), 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(targetYear, now.getMonth() + 1, 0, 23, 59, 59, 999));
    }

    // 3. Consultar TODOS los turnos del año donde hubo algún invitado y los pagos de conceptos
    // Consultamos todo el año para poder calcular cronológicamente el orden de cada invitación por socio
    const [turnosYearDb, pagosConceptosYearDb] = await Promise.all([
      db.turno.findMany({
        where: {
          fecha: {
            gte: startOfYear,
            lte: endOfYear,
          },
          estado: 'ocupado',
          OR: [
            { acompanante: { contains: 'Especial, I.' } },
            { acompanante: { contains: 'invitado', mode: 'insensitive' } },
            { acompanante: { contains: 'especial', mode: 'insensitive' } },
            { participantesDnis: { has: '123987456' } },
          ],
        },
        include: {
          socio: {
            select: {
              id: true,
              dni: true,
              nombre: true,
              apellido: true,
              telefono: true,
              categoria: true,
            },
          },
          cancha: {
            select: {
              id: true,
              nombre: true,
            },
          },
        },
        orderBy: [
          { fecha: 'asc' },
          { horaInicio: 'asc' },
        ],
      }),
      db.pagoConcepto.findMany({
        where: {
          tipo: 'invitado_extra',
          fechaRegistro: {
            gte: startOfYear,
            lte: endOfYear,
          },
        },
      }),
    ]);

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

    // Indexar pagos de invitados por socio
    const pagosInvitadosPorSocio = new Map<string, typeof pagosConceptosYearDb>();
    for (const p of pagosConceptosYearDb) {
      const list = pagosInvitadosPorSocio.get(p.socioDni) || [];
      list.push(p);
      pagosInvitadosPorSocio.set(p.socioDni, list);
    }

    // 4. Agrupar cronológicamente por socio titular
    // Map: socioDni -> lista de turnos del año
    const turnosPorSocioMap = new Map<string, typeof turnosYearDb>();

    for (const t of turnosYearDb) {
      const dni = t.socioDni || 'DESCONOCIDO';
      if (!turnosPorSocioMap.has(dni)) {
        turnosPorSocioMap.set(dni, []);
      }
      turnosPorSocioMap.get(dni)!.push(t);
    }

    const turnosDetallePeriodo: any[] = [];
    const sociosAcumuladoPeriodo: any[] = [];

    // 5. Procesar socio por socio su historial anual cronológico
    for (const [dni, turnosSocio] of turnosPorSocioMap.entries()) {
      let acumuladorInvitadosAnio = 0;

      let socioNombre = '';
      let socioTelefono = '';
      let socioObj: any = null;

      let turnosEnPeriodoDelSocio = 0;
      let invitadosEnPeriodo = 0;
      let invitadosGratisPeriodo = 0;
      let invitadosCobradosPeriodo = 0;
      let totalACobrarPeriodo = 0;
      let totalPagadoPeriodo = 0;
      const turnosDetalleSocio: any[] = [];

      const pagosDelSocio = pagosInvitadosPorSocio.get(dni) || [];
      const pagosPorTurnoId = new Map<string, number>();
      let pagosSinTurnoId = 0;
      for (const p of pagosDelSocio) {
        if (p.turnoId) {
          pagosPorTurnoId.set(p.turnoId, (pagosPorTurnoId.get(p.turnoId) || 0) + 1);
        } else {
          pagosSinTurnoId++;
        }
      }

      for (const t of turnosSocio) {
        if (!socioNombre && t.socio) {
          socioNombre = `${t.socio.apellido}, ${t.socio.nombre}`;
          socioTelefono = t.socio.telefono || '';
          socioObj = t.socio;
        }

        const fechaStr = extractDate(t.fecha);
        const horaStr = extractTime(t.horaInicio);
        const horaFinStr = extractTime(t.horaFin);
        const canchaNombre = t.cancha?.nombre || `Cancha ${t.canchaId}`;

        // Parsear acompañantes e identificar cuántos invitados hay en este turno
        const rawAcomp = (t.acompanante || '').trim();
        let acompsList: string[] = [];
        if (rawAcomp.includes('/')) {
          acompsList = rawAcomp.split('/').map((s) => s.trim()).filter(Boolean);
        } else if (rawAcomp) {
          acompsList = [rawAcomp];
        }

        let invitadosEnTurno = 0;
        const jugadoresDetalle: Array<{ nombre: string; esInvitado: boolean; esTitular: boolean }> = [
          {
            nombre: socioNombre || `DNI ${dni}`,
            esInvitado: false,
            esTitular: true,
          },
        ];

        // Revisar participantesDnis oficial primero
        if (t.participantesDnis && t.participantesDnis.length > 0) {
          for (const d of t.participantesDnis) {
            if (d === dni) continue;
            const esInv = d === '123987456';
            if (esInv) invitadosEnTurno++;
            jugadoresDetalle.push({
              nombre: esInv ? 'Invitado Especial' : `DNI ${d}`,
              esInvitado: esInv,
              esTitular: false,
            });
          }
        } else {
          for (const item of acompsList) {
            const itemLower = item.toLowerCase();
            const esInv = itemLower.includes('especial') || itemLower.includes('invitado');
            if (esInv) {
              invitadosEnTurno++;
            }
            jugadoresDetalle.push({
              nombre: esInv ? 'Invitado Especial' : item,
              esInvitado: esInv,
              esTitular: false,
            });
          }
        }

        if (invitadosEnTurno === 0) continue;

        // Determinar modalidad
        let modalidad = 'Single';
        if (jugadoresDetalle.length > 2) {
          modalidad = jugadoresDetalle.length === 4 ? 'Dobles' : `${jugadoresDetalle.length} Jugadores`;
        }

        // Calcular cuántos de estos invitados caen en el cupo gratis y cuántos se cobran
        const ordenInicio = acumuladorInvitadosAnio + 1;
        let gratisEnTurno = 0;
        let cobradosEnTurno = 0;

        for (let i = 1; i <= invitadosEnTurno; i++) {
          const ordenActual = acumuladorInvitadosAnio + i;
          if (ordenActual <= cupoInvitadosAnual) {
            gratisEnTurno++;
          } else {
            cobradosEnTurno++;
          }
        }

        acumuladorInvitadosAnio += invitadosEnTurno;

        // Determinar pagos de este turno
        let pagadosEnTurno = pagosPorTurnoId.get(t.id) || 0;
        if (pagadosEnTurno === 0 && pagosSinTurnoId > 0 && cobradosEnTurno > 0) {
          const aCubrir = Math.min(cobradosEnTurno, pagosSinTurnoId);
          pagadosEnTurno += aCubrir;
          pagosSinTurnoId -= aCubrir;
        }

        const pendientesEnTurno = Math.max(0, cobradosEnTurno - pagadosEnTurno);
        const pagado = cobradosEnTurno > 0 && pendientesEnTurno === 0;
        const montoPagado = pagadosEnTurno * precioInvitadoExtra;
        const cargoTurno = pendientesEnTurno * precioInvitadoExtra;
        const cargoTotal = cobradosEnTurno * precioInvitadoExtra;

        // Comprobar si este turno pertenece al período consultado
        const turnoDate = new Date(t.fecha);
        const estaEnPeriodo = turnoDate >= startDate && turnoDate <= endDate;

        if (estaEnPeriodo) {
          turnosEnPeriodoDelSocio++;
          invitadosEnPeriodo += invitadosEnTurno;
          invitadosGratisPeriodo += gratisEnTurno;
          invitadosCobradosPeriodo += cobradosEnTurno;
          totalACobrarPeriodo += cargoTurno;
          totalPagadoPeriodo += montoPagado;

          const turnoItem = {
            id: t.id,
            fecha: fechaStr,
            horaInicio: horaStr,
            horaFin: horaFinStr,
            horario: `${horaStr} - ${horaFinStr}`,
            canchaId: t.canchaId,
            canchaNombre,
            modalidad,
            titular: {
              dni,
              nombre: socioNombre || `DNI: ${dni}`,
            },
            jugadores: jugadoresDetalle,
            cantidadInvitados: invitadosEnTurno,
            invitadosGratis: gratisEnTurno,
            invitadosCobrados: cobradosEnTurno,
            invitadosPagados: pagadosEnTurno,
            invitadosPendientes: pendientesEnTurno,
            cargoTurno, // saldo pendiente
            cargoTotal,
            montoPagado,
            pagado,
            ordenInvitacionesAnual: `${ordenInicio} a ${acumuladorInvitadosAnio}`,
            textoCupo:
              invitadosEnTurno === 1
                ? acumuladorInvitadosAnio <= cupoInvitadosAnual
                  ? `Invitado #${acumuladorInvitadosAnio} de ${cupoInvitadosAnual} (Gratis)`
                  : pagado
                  ? `Invitado #${acumuladorInvitadosAnio} (Pagado)`
                  : `Invitado #${acumuladorInvitadosAnio} del año (Paga extra)`
                : ordenInicio <= cupoInvitadosAnual && acumuladorInvitadosAnio <= cupoInvitadosAnual
                  ? `Invitados #${ordenInicio} a #${acumuladorInvitadosAnio} de ${cupoInvitadosAnual} (Gratis)`
                  : `Invitados #${ordenInicio} al #${acumuladorInvitadosAnio} (${gratisEnTurno} gratis, ${cobradosEnTurno} extras${pagado ? ' - Pagados' : ''})`,
          };

          turnosDetallePeriodo.push(turnoItem);
          turnosDetalleSocio.push(turnoItem);
        }
      }

      // Si el socio tuvo turnos con invitados en el período seleccionado
      if (turnosEnPeriodoDelSocio > 0) {
        const totalExtrasAnio = Math.max(0, acumuladorInvitadosAnio - cupoInvitadosAnual);
        const invitadosGratisUsadosAnio = Math.min(acumuladorInvitadosAnio, cupoInvitadosAnual);
        const invitadosGratisRestantes = Math.max(0, cupoInvitadosAnual - acumuladorInvitadosAnio);
        const extrasPagadosTotal = pagosDelSocio.length;
        const extrasPendientesTotal = Math.max(0, totalExtrasAnio - extrasPagadosTotal);

        sociosAcumuladoPeriodo.push({
          dni,
          nombreCompleto: socioNombre || `Socio DNI ${dni}`,
          telefono: socioTelefono,
          totalInvitadosAnio: acumuladorInvitadosAnio,
          cupoGratisAnual: cupoInvitadosAnual,
          invitadosGratisUsadosAnio,
          invitadosGratisRestantes,
          totalExtrasAnio,
          extrasPagadosTotal,
          extrasPendientesTotal,
          turnosEnPeriodo: turnosEnPeriodoDelSocio,
          invitadosEnPeriodo,
          invitadosGratisPeriodo,
          invitadosCobradosPeriodo,
          precioUnitarioExtra: precioInvitadoExtra,
          totalACobrar: totalACobrarPeriodo,
          totalPagado: totalPagadoPeriodo,
          estadoPago: extrasPendientesTotal === 0 ? (totalExtrasAnio > 0 ? 'al_dia' : 'gratis') : 'pendiente',
          turnosDetalle: turnosDetalleSocio,
        });
      }
    }

    // Ordenar turnos del período por fecha y hora descendente
    turnosDetallePeriodo.sort((a, b) => {
      const fDiff = b.fecha.localeCompare(a.fecha);
      if (fDiff !== 0) return fDiff;
      return b.horaInicio.localeCompare(a.horaInicio);
    });

    // Ordenar socios por total a cobrar descendente, luego por total de invitados
    sociosAcumuladoPeriodo.sort((a, b) => {
      if (b.totalACobrar !== a.totalACobrar) {
        return b.totalACobrar - a.totalACobrar;
      }
      return b.totalInvitadosAnio - a.totalInvitadosAnio;
    });

    // KPIs globales del período
    const totalRecaudado = sociosAcumuladoPeriodo.reduce((acc, s) => acc + (s.totalPagado || 0), 0);
    const totalPendienteCobro = sociosAcumuladoPeriodo.reduce((acc, s) => acc + s.totalACobrar, 0);
    const totalInvitadosPeriodo = turnosDetallePeriodo.reduce((acc, t) => acc + t.cantidadInvitados, 0);
    const totalInvitadosGratis = turnosDetallePeriodo.reduce((acc, t) => acc + t.invitadosGratis, 0);
    const totalInvitadosCobrados = turnosDetallePeriodo.reduce((acc, t) => acc + t.invitadosCobrados, 0);
    const sociosConCargo = sociosAcumuladoPeriodo.filter((s) => s.totalACobrar > 0).length;

    return NextResponse.json({
      periodo: {
        tipo,
        desde: extractDate(startDate),
        hasta: extractDate(endDate),
        anio: targetYear,
      },
      tarifas: {
        precioInvitadoExtra,
        cupoInvitadosAnual,
      },
      kpis: {
        totalRecaudacion: totalPendienteCobro,
        totalRecaudado,
        totalPendienteCobro,
        totalTurnosConInvitados: turnosDetallePeriodo.length,
        totalInvitadosPeriodo,
        totalInvitadosGratis,
        totalInvitadosCobrados,
        sociosConCargo,
        totalSociosParticipantes: sociosAcumuladoPeriodo.length,
      },
      turnos: turnosDetallePeriodo,
      sociosAcumulado: sociosAcumuladoPeriodo,
    });
  } catch (error) {
    console.error('Error al consultar turnos con invitados:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al procesar turnos de invitados' },
      { status: 500 }
    );
  }
}
