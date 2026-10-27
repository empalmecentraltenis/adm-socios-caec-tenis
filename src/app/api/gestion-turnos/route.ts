import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format, addDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Hora oficial en Argentina (America/Argentina/Buenos_Aires)
    const nowArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const currentMonthStr = format(nowArg, 'yyyy-MM');
    const currentYearStr = format(nowArg, 'yyyy');
    const todayArgStr = format(nowArg, 'yyyy-MM-dd');
    const mananaArgStr = format(addDays(nowArg, 1), 'yyyy-MM-dd');
    const currentHourArg = format(nowArg, 'HH:mm');

    const mesParam = searchParams.get('mes') || currentMonthStr; // 'YYYY-MM'
    const anioParam = searchParams.get('anio') || currentYearStr; // 'YYYY'
    const fechaParam = searchParams.get('fecha') || todayArgStr; // 'YYYY-MM-DD'

    // 1. Obtener canchas, socios y turnos ocupados
    const [canchasDb, sociosDb, turnosOcupadosRaw] = await Promise.all([
      db.cancha.findMany({
        orderBy: { id: 'asc' },
      }),
      db.socio.findMany({
        select: {
          id: true,
          dni: true,
          nombre: true,
          apellido: true,
          telefono: true,
          categoria: true,
          estado: true,
        },
      }),
      db.turno.findMany({
        where: {
          OR: [
            { estado: 'ocupado' },
            {
              estado: 'bloqueado',
              OR: [
                { motivoBloqueo: { contains: 'clase', mode: 'insensitive' } },
                { motivoBloqueo: { contains: 'profe', mode: 'insensitive' } },
              ],
            },
          ],
        },
        include: {
          cancha: true,
          socio: {
            select: {
              dni: true,
              nombre: true,
              apellido: true,
              telefono: true,
              categoria: true,
            },
          },
        },
        orderBy: {
          fecha: 'desc',
        },
      }),
    ]);

    // Helper para extraer hora limpia
    const extractHourStr = (dateObj: Date | string): string => {
      try {
        if (dateObj instanceof Date) return dateObj.toISOString().substring(11, 16);
        const str = String(dateObj);
        if (str.includes('T')) return str.split('T')[1].substring(0, 5);
        return str.substring(0, 5);
      } catch {
        return '12:00';
      }
    };

    // Helper para detectar si el turno corresponde al profesor o alumnos de escuela
    const esTurnoProfeClase = (t: any): boolean => {
      if (t.estado === 'bloqueado') return true;
      if (t.socio?.categoria === 'alumno') return true;
      const motivo = (t.motivoBloqueo || '').toLowerCase();
      return motivo.includes('clase') || motivo.includes('profe');
    };

    // Excluir turnos con horarios anteriores a las 08:30 (como los turnos aislados de 07:00 que no existen en la app de socios)
    const turnosOcupados = turnosOcupadosRaw.filter((t) => extractHourStr(t.horaInicio) >= '08:30');

    const totalReservasHistoricas = turnosOcupados.length;

    // 2. Filtrar turnos por mes seleccionado y año seleccionado
    const turnosDelMes = turnosOcupados.filter((t) => {
      const fStr = format(t.fecha, 'yyyy-MM');
      return fStr === mesParam;
    });

    const turnosDelAnio = turnosOcupados.filter((t) => {
      const fStr = format(t.fecha, 'yyyy');
      return fStr === anioParam;
    });

    // Desglose Socios vs Profesor / Alumnos
    const reservasSociosMesActual = turnosDelMes.filter((t) => !esTurnoProfeClase(t)).length;
    const reservasProfeMesActual = turnosDelMes.filter((t) => esTurnoProfeClase(t)).length;
    const porcentajeSociosMes = turnosDelMes.length > 0 ? Math.round((reservasSociosMesActual / turnosDelMes.length) * 100) : 0;
    const porcentajeProfeMes = turnosDelMes.length > 0 ? Math.round((reservasProfeMesActual / turnosDelMes.length) * 100) : 0;

    // 3. Estadísticas por Cancha con desglose
    const canchasStats = canchasDb
      .filter((c) => c.id !== 3) // Excluimos Cancha 3 si está inactiva/temporal
      .map((c) => {
        const reservasHistoricas = turnosOcupados.filter((t) => t.canchaId === c.id).length;
        const turnosCanchaMes = turnosDelMes.filter((t) => t.canchaId === c.id);
        const reservasMes = turnosCanchaMes.length;
        const reservasSocios = turnosCanchaMes.filter((t) => !esTurnoProfeClase(t)).length;
        const reservasProfe = turnosCanchaMes.filter((t) => esTurnoProfeClase(t)).length;
        const porcentajeMes = turnosDelMes.length > 0 ? Math.round((reservasMes / turnosDelMes.length) * 100) : 0;
        return {
          id: c.id,
          nombre: c.nombre,
          reservasHistoricas,
          reservasMes,
          reservasSocios,
          reservasProfe,
          porcentajeMes,
        };
      });

    // 4. Horarios top (más utilizados)
    const conteoHorarios: Record<string, number> = {};
    const conteoHorariosMes: Record<string, number> = {};

    for (const t of turnosOcupados) {
      const h = extractHourStr(t.horaInicio);
      conteoHorarios[h] = (conteoHorarios[h] || 0) + 1;
    }

    for (const t of turnosDelMes) {
      const h = extractHourStr(t.horaInicio);
      conteoHorariosMes[h] = (conteoHorariosMes[h] || 0) + 1;
    }

    const topHorarioHist = Object.entries(conteoHorarios).sort((a, b) => b[1] - a[1])[0];
    const topHorarioMes = Object.entries(conteoHorariosMes).sort((a, b) => b[1] - a[1])[0];

    // 5. Ranking de Socios por cantidad de reservas en el mes y totales
    const reservasPorSocioMes: Record<string, number> = {};
    const reservasPorSocioTotal: Record<string, number> = {};

    for (const t of turnosDelMes) {
      if (t.socioDni) {
        reservasPorSocioMes[t.socioDni] = (reservasPorSocioMes[t.socioDni] || 0) + 1;
      }
    }

    for (const t of turnosOcupados) {
      if (t.socioDni) {
        reservasPorSocioTotal[t.socioDni] = (reservasPorSocioTotal[t.socioDni] || 0) + 1;
      }
    }

    const rankingSocios = sociosDb
      .map((s) => {
        const reservasMes = reservasPorSocioMes[s.dni] || 0;
        const reservasTotales = reservasPorSocioTotal[s.dni] || 0;
        return {
          id: s.id,
          dni: s.dni,
          nombre: s.nombre,
          apellido: s.apellido,
          nombreCompleto: `${s.apellido}, ${s.nombre}`,
          telefono: s.telefono,
          categoria: s.categoria,
          estado: s.estado,
          reservasMes,
          reservasTotales,
        };
      })
      .filter((s) => s.reservasTotales > 0)
      .sort((a, b) => {
        if (b.reservasMes !== a.reservasMes) {
          return b.reservasMes - a.reservasMes;
        }
        return b.reservasTotales - a.reservasTotales;
      });

    // 6. Ranking de Invitado Especial en el año seleccionado
    // Criterio: turno ocupado en el año donde acompañante contenga "Especial" o participante sea 123987456
    const conteoInvitadoPorSocio: Record<string, number> = {};

    for (const t of turnosDelAnio) {
      const esConInvitado =
        (t.acompanante && t.acompanante.toLowerCase().includes('especial')) ||
        (t.participantesDnis && t.participantesDnis.includes('123987456'));

      if (esConInvitado && t.socioDni) {
        conteoInvitadoPorSocio[t.socioDni] = (conteoInvitadoPorSocio[t.socioDni] || 0) + 1;
      }
    }

    const CUPO_BONIFICADO = 4;

    const rankingInvitado = sociosDb
      .map((s) => {
        const reservasInvitado = conteoInvitadoPorSocio[s.dni] || 0;
        const superaCupo = reservasInvitado > CUPO_BONIFICADO;
        const invitadosExtras = Math.max(0, reservasInvitado - CUPO_BONIFICADO);
        return {
          id: s.id,
          dni: s.dni,
          nombre: s.nombre,
          apellido: s.apellido,
          nombreCompleto: `${s.apellido}, ${s.nombre}`,
          telefono: s.telefono,
          categoria: s.categoria,
          reservasInvitado,
          superaCupo,
          invitadosExtras,
        };
      })
      .filter((s) => s.reservasInvitado > 0)
      .sort((a, b) => b.reservasInvitado - a.reservasInvitado);

    // 7. Resumen de Turnos Validados vs No Validados en el mes
    const validadosMes = turnosDelMes.filter((t) => Boolean(t.validado)).length;
    const noValidadosMes = turnosDelMes.length - validadosMes;
    const tasaValidacion = turnosDelMes.length > 0 ? Math.round((validadosMes / turnosDelMes.length) * 100) : 100;

    // 8. MONITOR EN VIVO Y PRÓXIMOS (Día a Día con estado QR y jugadores)
    const socioMapByDni = new Map<string, any>();
    sociosDb.forEach((s) => socioMapByDni.set(s.dni, s));

    const turnosHoy = turnosOcupados.filter((t) => format(t.fecha, 'yyyy-MM-dd') === todayArgStr);
    const turnosManana = turnosOcupados.filter((t) => format(t.fecha, 'yyyy-MM-dd') === mananaArgStr);
    const turnosFechaSeleccionada = turnosOcupados
      .filter((t) => format(t.fecha, 'yyyy-MM-dd') === fechaParam)
      .sort((a, b) => {
        const hA = extractHourStr(a.horaInicio);
        const hB = extractHourStr(b.horaInicio);
        if (hA !== hB) return hA.localeCompare(hB);
        return a.canchaId - b.canchaId;
      });

    // KPIs Monitor de Hoy
    const totalTurnosHoy = turnosHoy.length;
    const turnosSociosHoy = turnosHoy.filter((t) => !esTurnoProfeClase(t)).length;
    const turnosProfeHoy = turnosHoy.filter((t) => esTurnoProfeClase(t)).length;
    const enCursoHoy = turnosHoy.filter((t) => {
      const hIni = extractHourStr(t.horaInicio);
      const hFin = extractHourStr(t.horaFin);
      return currentHourArg >= hIni && currentHourArg < hFin;
    }).length;
    const proximosHoy = turnosHoy.filter((t) => extractHourStr(t.horaInicio) > currentHourArg).length;
    const completadosHoy = turnosHoy.filter((t) => extractHourStr(t.horaFin) <= currentHourArg).length;
    const validadosHoy = turnosHoy.filter((t) => !esTurnoProfeClase(t) && Boolean(t.validado)).length;
    const pendientesQRHoy = turnosHoy.filter((t) => !esTurnoProfeClase(t) && !t.validado).length;

    // KPIs Monitor de Mañana
    const totalTurnosManana = turnosManana.length;
    const turnosSociosManana = turnosManana.filter((t) => !esTurnoProfeClase(t)).length;
    const turnosProfeManana = turnosManana.filter((t) => esTurnoProfeClase(t)).length;

    // Formatear turnos de la fecha seleccionada
    const monitorTurnos = turnosFechaSeleccionada.map((t) => {
      const horaIni = extractHourStr(t.horaInicio);
      const horaFin = extractHourStr(t.horaFin);
      const esProfe = esTurnoProfeClase(t);

      let estadoTurno: 'en_curso' | 'proximo' | 'finalizado' = 'proximo';
      if (fechaParam < todayArgStr) {
        estadoTurno = 'finalizado';
      } else if (fechaParam > todayArgStr) {
        estadoTurno = 'proximo';
      } else {
        if (currentHourArg >= horaIni && currentHourArg < horaFin) {
          estadoTurno = 'en_curso';
        } else if (currentHourArg >= horaFin) {
          estadoTurno = 'finalizado';
        } else {
          estadoTurno = 'proximo';
        }
      }

      // Titular
      const titularDni = t.socioDni || '';
      const titularSocio = titularDni ? socioMapByDni.get(titularDni) : null;
      const titularNombre = titularSocio
        ? `${titularSocio.apellido}, ${titularSocio.nombre}`
        : (t.socio ? `${t.socio.apellido}, ${t.socio.nombre}` : (esProfe ? (t.motivoBloqueo || 'Clases Profesor') : (titularDni ? `DNI ${titularDni}` : 'Socio Titular')));

      // Participantes
      const participantesDnis = (t.participantesDnis && t.participantesDnis.length > 0)
        ? t.participantesDnis
        : (titularDni ? [titularDni] : []);

      const validadosList: string[] = t.validadosDnis || [];

      const participantes = participantesDnis.map((d: string) => {
        if (d === '123987456') {
          return {
            dni: '123987456',
            nombre: 'Invitado Especial',
            categoria: 'invitado',
            telefono: '',
            esTitular: false,
            esInvitado: true,
            haValidadoQR: validadosList.includes('123987456') || Boolean(t.validado),
          };
        }
        const soc = socioMapByDni.get(d);
        return {
          dni: d,
          nombre: soc ? `${soc.apellido}, ${soc.nombre}` : `DNI ${d}`,
          categoria: soc?.categoria || 'socio',
          telefono: soc?.telefono || '',
          esTitular: d === titularDni,
          esInvitado: false,
          haValidadoQR: validadosList.includes(d) || Boolean(t.validado),
        };
      });

      // Si no había participantesDnis pero hay texto libre en acompanante
      if (participantes.length <= 1 && t.acompanante && t.acompanante.trim()) {
        const rawAcomp = t.acompanante.trim();
        participantes.push({
          dni: '',
          nombre: rawAcomp,
          categoria: 'acompanante',
          telefono: '',
          esTitular: false,
          esInvitado: false,
          haValidadoQR: Boolean(t.validado),
        });
      }

      // Evaluación visual del QR
      let qrEstado: 'validado' | 'parcial' | 'pendiente' | 'sin_validar' | 'no_requerido' = 'pendiente';
      let qrLabel = 'Pendiente QR';

      if (esProfe) {
        qrEstado = 'no_requerido';
        qrLabel = 'Clase Profesor';
      } else if (t.validado) {
        qrEstado = 'validado';
        qrLabel = 'Validado con QR';
      } else {
        const validadosCount = participantes.filter((p) => p.haValidadoQR).length;
        if (validadosCount > 0) {
          qrEstado = 'parcial';
          qrLabel = `Validado (${validadosCount}/${participantes.length})`;
        } else if (estadoTurno === 'finalizado') {
          qrEstado = 'sin_validar';
          qrLabel = 'Sin Validar (Vencido)';
        } else if (estadoTurno === 'en_curso') {
          qrEstado = 'pendiente';
          qrLabel = 'En Cancha (Esperando QR)';
        } else {
          qrEstado = 'pendiente';
          qrLabel = 'Por Iniciar';
        }
      }

      return {
        id: t.id,
        canchaId: t.canchaId,
        canchaNombre: t.cancha?.nombre || `Cancha ${t.canchaId}`,
        fecha: format(t.fecha, 'yyyy-MM-dd'),
        horaInicio: horaIni,
        horaFin: horaFin,
        horario: `${horaIni} - ${horaFin} hs`,
        esProfe,
        motivoBloqueo: t.motivoBloqueo,
        tipoPartido: esProfe ? 'Clase Profesor' : (participantes.length > 2 ? 'Dobles' : 'Single'),
        estadoTurno,
        titular: {
          dni: titularDni,
          nombre: titularNombre,
          telefono: titularSocio?.telefono || t.socio?.telefono || '',
          categoria: titularSocio?.categoria || t.socio?.categoria || 'socio',
        },
        participantes,
        validadoTotal: Boolean(t.validado),
        validadoAt: t.validadoAt ? t.validadoAt.toISOString() : null,
        validadosDnis: validadosList,
        sancionQrAplicada: Boolean(t.sancionQrAplicada),
        qrEstado,
        qrLabel,
      };
    });

    return NextResponse.json({
      periodo: {
        mes: mesParam,
        anio: anioParam,
      },
      kpis: {
        totalReservasHistoricas,
        reservasMesActual: turnosDelMes.length,
        reservasSociosMesActual,
        reservasProfeMesActual,
        porcentajeSociosMes,
        porcentajeProfeMes,
        reservasAnioActual: turnosDelAnio.length,
        topHorario: topHorarioHist ? `${topHorarioHist[0]} hs (${topHorarioHist[1]} veces)` : 'N/A',
        topHorarioMes: topHorarioMes ? `${topHorarioMes[0]} hs (${topHorarioMes[1]} veces)` : 'N/A',
        validadosMes,
        noValidadosMes,
        tasaValidacion,
      },
      canchasStats,
      rankingSocios,
      rankingInvitado,
      monitor: {
        fechaSeleccionada: fechaParam,
        fechaHoy: todayArgStr,
        fechaManana: mananaArgStr,
        horaActual: currentHourArg,
        kpis: {
          totalTurnosHoy,
          turnosSociosHoy,
          turnosProfeHoy,
          enCursoHoy,
          proximosHoy,
          completadosHoy,
          validadosHoy,
          pendientesQRHoy,
          totalTurnosManana,
          turnosSociosManana,
          turnosProfeManana,
        },
        turnos: monitorTurnos,
      },
    });
  } catch (error: any) {
    console.error('Error al generar métricas de Gestión Turnos:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener datos' }, { status: 500 });
  }
}
