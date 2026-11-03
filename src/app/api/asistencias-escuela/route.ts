import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

const getTodayArg = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  return format(now, 'yyyy-MM-dd');
};

// GET /api/asistencias-escuela?fecha=YYYY-MM-DD&mes=YYYY-MM&grupo=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fecha = searchParams.get('fecha') || getTodayArg();
    const grupo = searchParams.get('grupo');
    const mes = searchParams.get('mes'); // opcional para histórico mensual

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

    // 2. Si se pide por fecha específica (para la toma rápida del día)
    if (!mes) {
      const asistenciasFecha = await db.asistenciaAlumnoEscuela.findMany({
        where: {
          fecha,
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

      const totalAlumnos = lista.length;
      const totalPresentes = lista.filter((a) => a.presente).length;

      return NextResponse.json({
        success: true,
        fecha,
        totalAlumnos,
        totalPresentes,
        alumnos: lista,
      });
    }

    // 3. Si se pide por mes (histórico / estadísticas)
    const asistenciasMes = await db.asistenciaAlumnoEscuela.findMany({
      where: {
        fecha: { startsWith: mes },
        alumno: whereAlumno,
      },
    });

    const asistenciasPorAlumno = new Map<string, number>();
    for (const a of asistenciasMes) {
      if (a.presente) {
        asistenciasPorAlumno.set(a.alumnoId, (asistenciasPorAlumno.get(a.alumnoId) || 0) + 1);
      }
    }

    const listaHistorica = alumnos.map((al) => ({
      id: al.id,
      nombre: al.nombre,
      grupo: al.grupo,
      edad: al.edad,
      asistenciasMes: asistenciasPorAlumno.get(al.id) || 0,
    }));

    return NextResponse.json({
      success: true,
      mes,
      alumnos: listaHistorica,
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

