import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format, addDays } from 'date-fns';

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

// GET /api/sanciones - Listar sanciones y métricas de reincidencia
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('search') || '').toLowerCase().trim();
    const filtro = searchParams.get('filtro') || 'todos'; // 'todos' | 'activos' | 'reincidentes' | 'criticos'

    const toDateStr = (date: Date | string | null | undefined): string => {
      if (!date) return '';
      const d = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(d.getTime())) return '';
      if (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0) {
        return d.toISOString().split('T')[0];
      }
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(d);
    };

    const today = new Date();
    const todayStr = toDateStr(today);
    const mesActualStr = todayStr.substring(0, 7);

    // 1. Obtener todas las penalizaciones con socios y turnos asociados
    const penalizacionesDb = await db.penalizacion.findMany({
      include: {
        socio: {
          select: {
            id: true,
            dni: true,
            nombre: true,
            apellido: true,
            telefono: true,
            email: true,
            categoria: true,
            estado: true,
          },
        },
        turno: {
          select: {
            id: true,
            fecha: true,
            horaInicio: true,
            horaFin: true,
            canchaId: true,
            cancha: {
              select: {
                nombre: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

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

    // 2. Agrupar por socio
    const sociosMap = new Map<string, {
      socioDni: string;
      socioId?: string;
      nombreCompleto: string;
      apellido: string;
      nombre: string;
      telefono: string;
      email: string;
      categoria: string;
      estadoSocio: string;
      totalSanciones: number;
      sancionesActivas: number;
      estaInhabilitado: boolean;
      fechaFinSancionActual: string | null;
      esReincidente: boolean;
      esCritico: boolean;
      nivelReincidencia: 'leve' | 'reincidente' | 'critico';
      nivelLabel: string;
      ultimaSancionFecha: string;
      ultimaSancionMotivo: string;
      sanciones: Array<{
        id: string;
        fechaInicio: string;
        fechaFin: string;
        motivo: string;
        activa: boolean;
        esVigente: boolean;
        createdAt: string;
        turno?: {
          fecha: string;
          horario: string;
          canchaNombre: string;
        } | null;
      }>;
    }>();

    let totalSancionesHistoricas = 0;
    let sancionesMesActual = 0;

    for (const p of penalizacionesDb) {
      totalSancionesHistoricas++;

      const pFechaInicio = toDateStr(p.fechaInicio);
      const pFechaFin = toDateStr(p.fechaFin);
      const pCreatedIso = p.createdAt.toISOString();
      const pMes = (pFechaInicio || toDateStr(p.createdAt)).substring(0, 7);
      if (pMes === mesActualStr) {
        sancionesMesActual++;
      }

      // Una sanción está vigente si activa = true y fecha_fin >= hoy
      const esVigente = Boolean(p.activa) && pFechaFin >= todayStr;

      const socioDni = p.socioDni;
      const socioObj = p.socio;
      const nombreCompleto = socioObj
        ? `${socioObj.apellido}, ${socioObj.nombre}`
        : `DNI ${socioDni}`;

      let formattedTurno: any = null;
      if (p.turno) {
        const horaInicioStr = extractTime(p.turno.horaInicio);
        const horaFinStr = extractTime(p.turno.horaFin);
        formattedTurno = {
          fecha: toDateStr(p.turno.fecha),
          horario: `${horaInicioStr} - ${horaFinStr} hs`,
          canchaNombre: p.turno.cancha?.nombre || `Cancha ${p.turno.canchaId}`,
        };
      }

      const itemDetalle = {
        id: p.id,
        fechaInicio: pFechaInicio,
        fechaFin: pFechaFin,
        motivo: p.motivo,
        activa: p.activa,
        esVigente,
        createdAt: pCreatedIso,
        turno: formattedTurno,
      };

      if (!sociosMap.has(socioDni)) {
        sociosMap.set(socioDni, {
          socioDni,
          socioId: socioObj?.id,
          nombreCompleto,
          apellido: socioObj?.apellido || '',
          nombre: socioObj?.nombre || '',
          telefono: socioObj?.telefono || '',
          email: socioObj?.email || '',
          categoria: socioObj?.categoria || 'socio',
          estadoSocio: socioObj?.estado || 'activo',
          totalSanciones: 1,
          sancionesActivas: esVigente ? 1 : 0,
          estaInhabilitado: esVigente,
          fechaFinSancionActual: esVigente ? pFechaFin : null,
          esReincidente: false,
          esCritico: false,
          nivelReincidencia: 'leve',
          nivelLabel: '1 Falta (Leve)',
          ultimaSancionFecha: pFechaInicio,
          ultimaSancionMotivo: p.motivo,
          sanciones: [itemDetalle],
        });
      } else {
        const existing = sociosMap.get(socioDni)!;
        existing.totalSanciones += 1;
        if (esVigente) {
          existing.sancionesActivas += 1;
          existing.estaInhabilitado = true;
          if (!existing.fechaFinSancionActual || pFechaFin > existing.fechaFinSancionActual) {
            existing.fechaFinSancionActual = pFechaFin;
          }
        }
        existing.sanciones.push(itemDetalle);
      }
    }

    // 3. Post-procesar niveles de reincidencia
    const sociosArray = Array.from(sociosMap.values()).map((s) => {
      const count = s.totalSanciones;
      const esReincidente = count >= 2;
      const esCritico = count >= 3;

      let nivelReincidencia: 'leve' | 'reincidente' | 'critico' = 'leve';
      let nivelLabel = '1 Falta';

      if (count === 2) {
        nivelReincidencia = 'reincidente';
        nivelLabel = '2 Faltas (Reincidente)';
      } else if (count >= 3) {
        nivelReincidencia = 'critico';
        nivelLabel = `🚨 ${count} Faltas (Crítico)`;
      }

      return {
        ...s,
        esReincidente,
        esCritico,
        nivelReincidencia,
        nivelLabel,
      };
    });

    // 4. Calcular KPIs globales
    const totalSociosConSanciones = sociosArray.length;
    const totalInhabilitadosHoy = sociosArray.filter((s) => s.estaInhabilitado).length;
    const totalReincidentes = sociosArray.filter((s) => s.esReincidente).length;
    const totalCriticos = sociosArray.filter((s) => s.esCritico).length;

    // 5. Aplicar filtros y búsqueda
    let sociosFiltrados = sociosArray;

    if (filtro === 'activos') {
      sociosFiltrados = sociosFiltrados.filter((s) => s.estaInhabilitado);
    } else if (filtro === 'reincidentes') {
      sociosFiltrados = sociosFiltrados.filter((s) => s.esReincidente);
    } else if (filtro === 'criticos') {
      sociosFiltrados = sociosFiltrados.filter((s) => s.esCritico);
    }

    if (search) {
      sociosFiltrados = sociosFiltrados.filter(
        (s) =>
          s.nombreCompleto.toLowerCase().includes(search) ||
          s.socioDni.includes(search) ||
          s.telefono.includes(search)
      );
    }

    // Ordenar: primero los actualmente inhabilitados, luego por mayor cantidad de sanciones acumuladas
    sociosFiltrados.sort((a, b) => {
      if (a.estaInhabilitado && !b.estaInhabilitado) return -1;
      if (!a.estaInhabilitado && b.estaInhabilitado) return 1;
      return b.totalSanciones - a.totalSanciones;
    });

    // 6. Lista plana de sanciones históricas y recientes
    const sancionesRecientes = penalizacionesDb.map((p) => {
      const pFechaInicio = toDateStr(p.fechaInicio);
      const pFechaFin = toDateStr(p.fechaFin);
      return {
        id: p.id,
        socioDni: p.socioDni,
        socioNombre: p.socio ? `${p.socio.apellido}, ${p.socio.nombre}` : `DNI ${p.socioDni}`,
        fechaInicio: pFechaInicio,
        fechaFin: pFechaFin,
        motivo: p.motivo,
        activa: p.activa,
        esVigente: Boolean(p.activa) && pFechaFin >= todayStr,
        createdAt: p.createdAt.toISOString(),
        canchaNombre: p.turno?.cancha?.nombre || (p.turno ? `Cancha ${p.turno.canchaId}` : 'Cancha'),
        horario: p.turno ? `${extractTime(p.turno.horaInicio)} hs` : null,
      };
    });

    return NextResponse.json({
      kpis: {
        totalSociosConSanciones,
        totalInhabilitadosHoy,
        totalReincidentes,
        totalCriticos,
        totalSancionesHistoricas,
        sancionesMesActual,
      },
      socios: sociosFiltrados,
      sancionesRecientes,
    });
  } catch (error: any) {
    console.error('Error al obtener sanciones:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener sanciones' }, { status: 500 });
  }
}

// PATCH /api/sanciones - Levantar o modificar estado de una sanción
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, activa, motivoLevantamiento } = body;

    if (!id) {
      return NextResponse.json({ error: 'Falta ID de penalización' }, { status: 400 });
    }

    const penalizacion = await db.penalizacion.findUnique({
      where: { id },
      include: { socio: true },
    });

    if (!penalizacion) {
      return NextResponse.json({ error: 'Penalización no encontrada' }, { status: 404 });
    }

    const updated = await db.penalizacion.update({
      where: { id },
      data: {
        activa: Boolean(activa),
      },
    });

    const accionText = activa ? 'Sanción reactivada' : 'Sanción levantada/perdonada';
    const socioDesc = penalizacion.socio
      ? `${penalizacion.socio.apellido}, ${penalizacion.socio.nombre} (DNI ${penalizacion.socioDni})`
      : `DNI ${penalizacion.socioDni}`;

    await logActividad(
      'sancion_modificada',
      `${accionText} para ${socioDesc}. Motivo: ${motivoLevantamiento || 'Resolución administrativa'}`
    );

    return NextResponse.json({ success: true, penalizacion: updated });
  } catch (error: any) {
    console.error('Error al actualizar penalización:', error);
    return NextResponse.json({ error: error.message || 'Error al actualizar penalización' }, { status: 500 });
  }
}

// POST /api/sanciones - Crear sanción manual o ejecutar control de QR
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. Ejecutar control de QR manualmente
    if (body.action === 'run_qr_control') {
      const res = await db.$queryRawUnsafe(`SELECT resolver_turnos_sin_validar_sql() as res;`) as any;
      const jsonRes = res && res[0]?.res ? res[0].res : { success: true, sanciones_aplicadas: 0 };
      
      await logActividad(
        'control_qr_ejecutado',
        `Control manual de turnos sin validar ejecutado. Sanciones nuevas: ${jsonRes.sanciones_aplicadas || 0}`
      );

      return NextResponse.json({
        success: true,
        sancionesAplicadas: jsonRes.sanciones_aplicadas || 0,
        motivo: jsonRes.motivo || null,
      });
    }

    // 2. Crear sanción manual extraordinaria para un socio
    const { socioDni, diasSancion = 7, motivo } = body;

    if (!socioDni || !motivo) {
      return NextResponse.json({ error: 'DNI del socio y motivo son obligatorios' }, { status: 400 });
    }

    const today = new Date();
    const fechaFin = addDays(today, Number(diasSancion));

    const nuevaPenalizacion = await db.penalizacion.create({
      data: {
        socioDni,
        fechaInicio: today,
        fechaFin,
        motivo: `[Sanción Extraordinaria CD] ${motivo}`,
        activa: true,
      },
      include: {
        socio: true,
      },
    });

    const socioDesc = nuevaPenalizacion.socio
      ? `${nuevaPenalizacion.socio.apellido}, ${nuevaPenalizacion.socio.nombre}`
      : `DNI ${socioDni}`;

    await logActividad(
      'sancion_creada',
      `Sanción extraordinaria aplicada a ${socioDesc} por ${diasSancion} días. Motivo: ${motivo}`
    );

    return NextResponse.json({ success: true, penalizacion: nuevaPenalizacion });
  } catch (error: any) {
    console.error('Error al crear sanción o ejecutar control:', error);
    return NextResponse.json({ error: error.message || 'Error en operación' }, { status: 500 });
  }
}
