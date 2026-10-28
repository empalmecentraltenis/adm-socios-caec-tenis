import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format, addDays } from 'date-fns';

export const dynamic = 'force-dynamic';

function extractHourStr(dateObj: Date | string): string {
  try {
    if (dateObj instanceof Date) return dateObj.toISOString().substring(11, 16);
    const str = String(dateObj);
    if (str.includes('T')) return str.split('T')[1].substring(0, 5);
    return str.substring(0, 5);
  } catch {
    return '12:00';
  }
}

function esTurnoProfe(t: any): boolean {
  if (t.socio?.categoria === 'alumno') return true;
  const motivo = (t.motivoBloqueo || '').toLowerCase();
  if (motivo.includes('clase') || motivo.includes('profe') || motivo.includes('escuela')) return true;
  if (t.estado === 'bloqueado' && (motivo.includes('profe') || motivo.includes('clase'))) return true;
  return false;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Hora oficial en Argentina
    const nowArg = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
    const todayStr = format(nowArg, 'yyyy-MM-dd');
    const tomorrowStr = format(addDays(nowArg, 1), 'yyyy-MM-dd');
    const currentHourStr = format(nowArg, 'HH:mm');

    const selectedFechaParam = searchParams.get('fecha') || todayStr;

    // Fechas que necesitamos consultar en la DB
    const datesToQuerySet = new Set<string>([todayStr, tomorrowStr, selectedFechaParam]);
    const datesToQuery = Array.from(datesToQuerySet).map((f) => {
      const [y, m, d] = f.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    });

    // Consultar canchas, socios y turnos en paralelo
    const [canchas, socios, turnosRaw] = await Promise.all([
      db.cancha.findMany({
        where: { activa: true },
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
          fecha: { in: datesToQuery },
          OR: [
            { estado: 'ocupado' },
            { estado: 'bloqueado' },
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
        orderBy: [
          { fecha: 'asc' },
          { horaInicio: 'asc' },
          { canchaId: 'asc' },
        ],
      }),
    ]);

    // Filtrar horarios huérfanos anteriores a 08:30 (ej. 07:00 que no existen en la app de socios)
    const turnosValidos = turnosRaw.filter((t) => extractHourStr(t.horaInicio) >= '08:30');

    // Mapeo rápido de socios por DNI
    const socioMap = new Map<string, any>();
    socios.forEach((s) => socioMap.set(s.dni, s));

    // Formatear un turno individual para el portero
    const formatearTurno = (t: any) => {
      const fechaStr = format(t.fecha, 'yyyy-MM-dd');
      const horaIni = extractHourStr(t.horaInicio);
      let horaFin = extractHourStr(t.horaFin);
      if (horaIni === '19:00' && (horaFin === '20:00' || horaFin === '20:30')) {
        horaFin = '20:30';
      }
      const profe = esTurnoProfe(t);

      // Determinar estado temporal
      let estadoTiempo: 'en_curso' | 'proximo' | 'finalizado' = 'proximo';
      let minutosParaInicio: number | null = null;

      if (fechaStr < todayStr) {
        estadoTiempo = 'finalizado';
      } else if (fechaStr > todayStr) {
        estadoTiempo = 'proximo';
      } else {
        // Es hoy
        if (currentHourStr >= horaIni && currentHourStr < horaFin) {
          estadoTiempo = 'en_curso';
        } else if (currentHourStr >= horaFin) {
          estadoTiempo = 'finalizado';
        } else {
          estadoTiempo = 'proximo';
          // Calcular minutos restantes
          const [hAct, mAct] = currentHourStr.split(':').map(Number);
          const [hIni, mIni] = horaIni.split(':').map(Number);
          minutosParaInicio = (hIni * 60 + mIni) - (hAct * 60 + mAct);
        }
      }

      // Titular y Tipo de Turno
      const titularDni = t.socioDni || '';
      const titularObj = titularDni ? socioMap.get(titularDni) : null;
      const motivoRaw = (t.motivoBloqueo || '').trim();
      const motivoLower = motivoRaw.toLowerCase();
      const esAdmin = titularDni === 'admin' || titularObj?.rol === 'admin';
      const esBloqueado = t.estado === 'bloqueado';

      let tipo: 'socio' | 'profe' | 'mantenimiento' | 'torneo' | 'bloqueado' = 'socio';
      let titularNombre = 'Socio';

      if (esBloqueado || esAdmin || motivoRaw) {
        if (profe || motivoLower.includes('clase') || motivoLower.includes('profe') || motivoLower.includes('escuela')) {
          tipo = 'profe';
          titularNombre = motivoRaw || 'Clases Profesor';
        } else if (motivoLower.includes('mantenimiento')) {
          tipo = 'mantenimiento';
          titularNombre = motivoRaw || 'Mantenimiento';
        } else if (
          motivoLower.includes('torneo') ||
          motivoLower.includes('doble') ||
          motivoLower.includes('mixto') ||
          motivoLower.includes('evento')
        ) {
          tipo = 'torneo';
          titularNombre = motivoRaw || 'Torneo / Dobles Mixtos';
        } else if (motivoRaw) {
          tipo = 'bloqueado';
          titularNombre = motivoRaw;
        } else if (esBloqueado) {
          tipo = 'bloqueado';
          titularNombre = 'Cancha Bloqueada';
        } else if (esAdmin) {
          tipo = 'profe';
          titularNombre = 'Clases Profesor';
        }
      } else if (titularObj) {
        titularNombre = `${titularObj.apellido}, ${titularObj.nombre}`;
      } else if (t.socio) {
        titularNombre = `${t.socio.apellido}, ${t.socio.nombre}`;
      } else if (titularDni) {
        titularNombre = `DNI ${titularDni}`;
      }

      // Participantes
      const participantesDnis: string[] = (t.participantesDnis && t.participantesDnis.length > 0)
        ? t.participantesDnis
        : (titularDni ? [titularDni] : []);

      const validadosList: string[] = t.validadosDnis || [];

      const participantes = participantesDnis.map((dni: string) => {
        if (dni === '123987456') {
          return {
            dni: '123987456',
            nombre: 'Invitado Especial',
            categoria: 'invitado',
            telefono: '',
            esTitular: false,
            haValidadoQR: validadosList.includes('123987456') || Boolean(t.validado),
          };
        }
        const s = socioMap.get(dni);
        return {
          dni,
          nombre: s ? `${s.apellido}, ${s.nombre}` : `DNI ${dni}`,
          categoria: s?.categoria || 'socio',
          telefono: s?.telefono || '',
          esTitular: dni === titularDni,
          haValidadoQR: validadosList.includes(dni) || (Boolean(t.validado) && dni === titularDni),
        };
      });

      return {
        id: t.id,
        canchaId: t.canchaId,
        canchaNombre: t.cancha?.nombre || `Cancha ${t.canchaId}`,
        fecha: fechaStr,
        horaInicio: horaIni,
        horaFin: horaFin,
        estado: t.estado,
        esProfe: tipo === 'profe',
        tipo,
        estadoTiempo,
        minutosParaInicio,
        titularNombre,
        titularDni,
        titularTelefono: titularObj?.telefono || t.socio?.telefono || '',
        acompanante: t.acompanante,
        participantes,
        validadoQr: Boolean(t.validado),
        validadosCount: participantes.filter((p: any) => p.haValidadoQR).length,
        participantesCount: participantes.length,
        motivoBloqueo: t.motivoBloqueo,
      };
    };

    const turnosFormateados = turnosValidos.map(formatearTurno);

    // Separar por hoy, mañana y fecha seleccionada
    const turnosHoy = turnosFormateados.filter((t) => t.fecha === todayStr);
    const turnosManana = turnosFormateados.filter((t) => t.fecha === tomorrowStr);
    const turnosSeleccionados = turnosFormateados.filter((t) => t.fecha === selectedFechaParam);

    // Estadísticas para hoy
    const kpisHoy = {
      total: turnosHoy.length,
      enCurso: turnosHoy.filter((t) => t.estadoTiempo === 'en_curso').length,
      proximos: turnosHoy.filter((t) => t.estadoTiempo === 'proximo').length,
      finalizados: turnosHoy.filter((t) => t.estadoTiempo === 'finalizado').length,
      socios: turnosHoy.filter((t) => t.tipo === 'socio').length,
      profe: turnosHoy.filter((t) => t.tipo === 'profe').length,
      bloqueados: turnosHoy.filter((t) => t.tipo !== 'socio' && t.tipo !== 'profe').length,
    };

    // Estadísticas para mañana
    const kpisManana = {
      total: turnosManana.length,
      socios: turnosManana.filter((t) => t.tipo === 'socio').length,
      profe: turnosManana.filter((t) => t.tipo === 'profe').length,
      bloqueados: turnosManana.filter((t) => t.tipo !== 'socio' && t.tipo !== 'profe').length,
    };

    return NextResponse.json({
      horaServidor: currentHourStr,
      todayStr,
      tomorrowStr,
      selectedFecha: selectedFechaParam,
      canchas: canchas.map((c) => ({ id: c.id, nombre: c.nombre })),
      kpisHoy,
      kpisManana,
      turnosHoy,
      turnosManana,
      turnos: turnosSeleccionados,
    });
  } catch (error) {
    console.error('Error en /api/porteria:', error);
    return NextResponse.json({ error: 'Error al obtener datos de portería' }, { status: 500 });
  }
}
