import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const today = new Date();
    const currentMonthStr = format(today, 'yyyy-MM');
    const currentYearStr = format(today, 'yyyy');

    const mesParam = searchParams.get('mes') || currentMonthStr; // 'YYYY-MM'
    const anioParam = searchParams.get('anio') || currentYearStr; // 'YYYY'

    // 1. Obtener canchas, socios y turnos ocupados
    const [canchasDb, sociosDb, turnosOcupados] = await Promise.all([
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

    const totalReservasHistoricas = turnosOcupados.length;

    // Helper para detectar si el turno corresponde al profesor o alumnos de escuela
    const esTurnoProfeClase = (t: any): boolean => {
      if (t.estado === 'bloqueado') return true;
      if (t.socio?.categoria === 'alumno') return true;
      const motivo = (t.motivoBloqueo || '').toLowerCase();
      return motivo.includes('clase') || motivo.includes('profe');
    };

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
    });
  } catch (error: any) {
    console.error('Error al generar métricas de Gestión Turnos:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener datos' }, { status: 500 });
  }
}
