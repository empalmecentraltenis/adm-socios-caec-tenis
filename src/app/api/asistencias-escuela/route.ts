import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

const getTodayArg = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  return format(now, 'yyyy-MM-dd');
};

// GET /api/asistencias-escuela
// Params:
// - modo: 'dia' | 'semana' | 'mes' | 'rango'
// - fecha: 'YYYY-MM-DD'
// - mes: 'YYYY-MM'
// - desde: 'YYYY-MM-DD'
// - hasta: 'YYYY-MM-DD'
// - grupo: string
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const modo = searchParams.get('modo') || (searchParams.get('mes') ? 'mes' : searchParams.get('desde') ? 'rango' : 'dia');
    const fechaParam = searchParams.get('fecha') || getTodayArg();
    const grupo = searchParams.get('grupo');
    const mesParam = searchParams.get('mes');
    const desdeParam = searchParams.get('desde');
    const hastaParam = searchParams.get('hasta');

    // 1. Obtener alumnos activos
    const whereAlumno: any = { activo: true };
    if (grupo && grupo !== 'todos') {
      whereAlumno.grupo = grupo;
    }

    const alumnos = await db.alumnoEscuela.findMany({
      where: whereAlumno,
      orderBy: [
        { grupo: 'asc' },
        { nombre: 'asc' }
      ]
    });

    // CASO A: MODO DÍA (Pase de lista diario)
    if (modo === 'dia' && !mesParam && !desdeParam) {
      const asistenciasFecha = await db.asistenciaAlumnoEscuela.findMany({
        where: {
          fecha: fechaParam,
          alumno: whereAlumno,
        },
      });

      const asistenciasMap = new Map<string, boolean>();
      for (const a of asistenciasFecha) {
        asistenciasMap.set(a.alumnoId, a.presente);
      }

      const lista = alumnos.map((al) => ({
        id: al.id,
        nombre: al.nombre,
        grupo: al.grupo,
        edad: al.edad,
        tutor: al.tutor,
        telefono: al.telefono,
        presente: asistenciasMap.get(al.id) ?? false,
      }));

      return NextResponse.json({
        success: true,
        modo: 'dia',
        fecha: fechaParam,
        totalAlumnos: lista.length,
        totalPresentes: lista.filter((a) => a.presente).length,
        alumnos: lista,
      });
    }

    // CASO B: MODO REPORTE (Semanal, Mensual o Rango personalizado)
    let fechaInicioStr = '';
    let fechaFinStr = '';
    let periodoLabel = '';

    const refDate = parseISO(fechaParam);

    if (modo === 'semana') {
      const inicioSemana = startOfWeek(refDate, { weekStartsOn: 1 }); // Lunes
      const finSemana = endOfWeek(refDate, { weekStartsOn: 1 }); // Domingo
      fechaInicioStr = format(inicioSemana, 'yyyy-MM-dd');
      fechaFinStr = format(finSemana, 'yyyy-MM-dd');
      periodoLabel = `Semana del ${format(inicioSemana, 'dd/MM/yyyy')} al ${format(finSemana, 'dd/MM/yyyy')}`;
    } else if (modo === 'mes') {
      const mesAUsar = mesParam || format(refDate, 'yyyy-MM');
      const [y, m] = mesAUsar.split('-').map(Number);
      const primerDia = new Date(y, m - 1, 1);
      const ultimoDia = new Date(y, m, 0);
      fechaInicioStr = format(primerDia, 'yyyy-MM-dd');
      fechaFinStr = format(ultimoDia, 'yyyy-MM-dd');
      periodoLabel = format(primerDia, 'MMMM yyyy', { locale: es }).toUpperCase();
    } else {
      // Rango personalizado
      fechaInicioStr = desdeParam || fechaParam;
      fechaFinStr = hastaParam || fechaInicioStr;
      periodoLabel = `Período ${fechaInicioStr} al ${fechaFinStr}`;
    }

    // Buscar todas las asistencias en el rango
    const asistenciasRango = await db.asistenciaAlumnoEscuela.findMany({
      where: {
        fecha: {
          gte: fechaInicioStr,
          lte: fechaFinStr,
        },
        alumno: whereAlumno,
      },
      orderBy: { fecha: 'asc' },
    });

    // Días en los que hubo al menos 1 registro/clase
    const fechasConClaseSet = new Set<string>();
    for (const a of asistenciasRango) {
      fechasConClaseSet.add(a.fecha);
    }
    const fechasConClase = Array.from(fechasConClaseSet).sort();
    const totalClasesPeriodo = fechasConClase.length;

    // Matriz de asistencias por alumno: alumnoId -> { totalPresentes, detallePorFecha: Record<fecha, boolean> }
    const mapaAsistencias = new Map<string, { presentes: number; porFecha: Record<string, boolean> }>();
    for (const a of asistenciasRango) {
      const entry = mapaAsistencias.get(a.alumnoId) || { presentes: 0, porFecha: {} };
      entry.porFecha[a.fecha] = a.presente;
      if (a.presente) {
        entry.presentes++;
      }
      mapaAsistencias.set(a.alumnoId, entry);
    }

    const reporteAlumnos = alumnos.map((al) => {
      const datos = mapaAsistencias.get(al.id) || { presentes: 0, porFecha: {} };
      const presentes = datos.presentes;
      const porcentaje = totalClasesPeriodo > 0 ? Math.round((presentes / totalClasesPeriodo) * 100) : 0;

      return {
        id: al.id,
        nombre: al.nombre,
        grupo: al.grupo,
        edad: al.edad,
        tutor: al.tutor,
        telefono: al.telefono,
        presentes,
        totalClases: totalClasesPeriodo,
        porcentaje,
        detallePorFecha: datos.porFecha,
      };
    });

    return NextResponse.json({
      success: true,
      modo,
      fechaInicio: fechaInicioStr,
      fechaFin: fechaFinStr,
      periodoLabel,
      totalAlumnos: alumnos.length,
      totalClases: totalClasesPeriodo,
      fechasConClase,
      alumnos: reporteAlumnos,
    });
  } catch (error: any) {
    console.error('Error al obtener asistencias de escuela:', error);
    return NextResponse.json({ error: error.message || 'Error al obtener asistencias' }, { status: 500 });
  }
}

// POST /api/asistencias-escuela - Guardar o alternar asistencia de uno o varios alumnos
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const fecha = body.fecha || getTodayArg();

    // Modo 1: Marcar masivo (ej: marcar todos presentes o guardar lista de cambios)
    if (Array.isArray(body.cambios)) {
      const { cambios } = body; // Array<{ alumnoId: string, presente: boolean, grupo?: string }>

      await db.$transaction(
        cambios.map((c: any) =>
          db.asistenciaAlumnoEscuela.upsert({
            where: {
              alumnoId_fecha: {
                alumnoId: c.alumnoId,
                fecha,
              },
            },
            update: {
              presente: Boolean(c.presente),
              grupo: c.grupo || null,
            },
            create: {
              alumnoId: c.alumnoId,
              fecha,
              presente: Boolean(c.presente),
              grupo: c.grupo || null,
            },
          })
        )
      );

      return NextResponse.json({
        success: true,
        mensaje: `${cambios.length} asistencias registradas para ${fecha}`,
      });
    }

    // Modo 2: Alternar 1 alumno individual (One-Tap toggle desde el celular)
    const { alumnoId, presente, grupo } = body;
    if (!alumnoId) {
      return NextResponse.json({ error: 'alumnoId es obligatorio' }, { status: 400 });
    }

    const upserted = await db.asistenciaAlumnoEscuela.upsert({
      where: {
        alumnoId_fecha: {
          alumnoId,
          fecha,
        },
      },
      update: {
        presente: Boolean(presente),
        grupo: grupo || null,
      },
      create: {
        alumnoId,
        fecha,
        presente: Boolean(presente),
        grupo: grupo || null,
      },
    });

    return NextResponse.json({
      success: true,
      asistencia: upserted,
    });
  } catch (error: any) {
    console.error('Error al registrar asistencia de escuela:', error);
    return NextResponse.json({ error: error.message || 'Error al registrar asistencia' }, { status: 500 });
  }
}
