import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/asistencias - Obtener últimas asistencias
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("fecha");
    const monthStr = searchParams.get("mes");
    
    let whereClause = {};
    if (monthStr) {
      // Filtrar por mes (YYYY-MM) considerando zona horaria Argentina (UTC-3)
      const [year, month] = monthStr.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const startOfMonth = new Date(`${year}-${month.padStart(2, '0')}-01T00:00:00.000-03:00`);
      const endOfMonth = new Date(`${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}T23:59:59.999-03:00`);
      
      whereClause = {
        fecha: {
          gte: startOfMonth,
          lte: endOfMonth,
        }
      };
    } else if (dateStr) {
      // Filtrar por fecha exacta (YYYY-MM-DD) considerando zona horaria Argentina (UTC-3)
      const startOfDay = new Date(`${dateStr}T00:00:00.000-03:00`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999-03:00`);
      
      whereClause = {
        fecha: {
          gte: startOfDay,
          lte: endOfDay,
        }
      };
    } else {
      // Por defecto traer solo las de hoy en horario argentino (UTC-3)
      const nowArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
      const y = nowArg.getFullYear();
      const m = String(nowArg.getMonth() + 1).padStart(2, '0');
      const d = String(nowArg.getDate()).padStart(2, '0');
      const todayStr = `${y}-${m}-${d}`;
      const startOfDay = new Date(`${todayStr}T00:00:00.000-03:00`);
      whereClause = {
        fecha: {
          gte: startOfDay,
        }
      };
    }

    const asistencias = await db.asistenciaClase.findMany({
      where: whereClause,
      include: {
        socio: {
          include: {
            cuotas: true,
            pagos: true
          }
        }
      },
      orderBy: { fecha: "desc" },
    });

    return NextResponse.json(asistencias);
  } catch (error) {
    console.error("Error al obtener asistencias:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/asistencias - Registrar una nueva asistencia
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dni } = body;

    if (!dni || typeof dni !== "string") {
      return NextResponse.json(
        { error: "DNI inválido o no proporcionado" },
        { status: 400 }
      );
    }

    // Buscar al socio
    let socio = await db.socio.findUnique({
      where: { dni: dni.trim() },
      include: {
        cuotas: true,
        pagos: true,
      },
    });

    let esNoRegistrado = false;

    // Si no existe, lo creamos automáticamente como Alumno No Registrado para que siempre quede asentado
    if (!socio) {
      esNoRegistrado = true;
      socio = await db.socio.create({
        data: {
          dni: dni.trim(),
          nombre: "Alumno",
          apellido: "No Registrado",
          categoria: "alumno",
          estado: "inactivo",
          activo: false,
          telefono: "",
          email: null,
        },
        include: {
          cuotas: true,
          pagos: true,
        },
      });
    }

    // Evitar registrar múltiples veces en un rango muy corto (ej. 5 minutos)
    const hace5Minutos = new Date(Date.now() - 5 * 60 * 1000);
    const asistenciaReciente = await db.asistenciaClase.findFirst({
      where: {
        socioId: socio.id,
        fecha: {
          gte: hace5Minutos,
        },
      },
    });

    if (asistenciaReciente) {
      return NextResponse.json({
        success: true,
        esNoRegistrado,
        mensaje: "Asistencia ya registrada hace unos instantes.",
        asistencia: asistenciaReciente,
        socio,
      });
    }

    // Registrar asistencia
    const asistencia = await db.asistenciaClase.create({
      data: {
        socioId: socio.id,
        notas: esNoRegistrado ? 'Alumno No Registrado (Escaneo QR)' : null,
      },
      include: {
        socio: true,
      },
    });
    
    return NextResponse.json({
      success: true,
      esNoRegistrado,
      mensaje: esNoRegistrado
        ? `Asistencia registrada como Alumno No Registrado (DNI ${dni.trim()}). Acercate a administración para completar tu ficha.`
        : "Asistencia registrada correctamente",
      asistencia,
      socio,
    });

  } catch (error) {
    console.error("Error al registrar asistencia:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al registrar asistencia" },
      { status: 500 }
    );
  }
}

// DELETE /api/asistencias?id=xxx - Eliminar una asistencia
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await request.json();
        id = body?.id;
      } catch {}
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: 'ID de asistencia inválido o no proporcionado' },
        { status: 400 }
      );
    }

    // Verificar si existe
    const asistencia = await db.asistenciaClase.findUnique({
      where: { id },
      include: {
        socio: {
          select: {
            nombre: true,
            apellido: true,
            dni: true,
          },
        },
      },
    });

    if (!asistencia) {
      return NextResponse.json(
        { error: 'La asistencia no existe o ya fue eliminada' },
        { status: 404 }
      );
    }

    // Eliminar asistencia
    await db.asistenciaClase.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Asistencia de ${asistencia.socio.nombre} ${asistencia.socio.apellido} eliminada correctamente.`,
    });
  } catch (error: any) {
    console.error('Error al eliminar asistencia:', error);
    return NextResponse.json(
      { error: error.message || 'Error interno al eliminar la asistencia' },
      { status: 500 }
    );
  }
}

