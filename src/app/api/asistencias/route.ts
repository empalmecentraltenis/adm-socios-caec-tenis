import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/asistencias - Obtener últimas asistencias
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get("fecha");
    
    let whereClause = {};
    if (dateStr) {
      // Filtrar por fecha exacta (Y-m-d)
      const startOfDay = new Date(dateStr);
      startOfDay.setUTCHours(0, 0, 0, 0);
      
      const endOfDay = new Date(dateStr);
      endOfDay.setUTCHours(23, 59, 59, 999);
      
      whereClause = {
        fecha: {
          gte: startOfDay,
          lte: endOfDay,
        }
      };
    } else {
      // Por defecto traer solo las de hoy para evitar cargar toda la base de datos
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      whereClause = {
        fecha: {
          gte: today,
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
    const socio = await db.socio.findUnique({
      where: { dni },
      include: {
        cuotas: true,
        pagos: true
      }
    });

    if (!socio) {
      return NextResponse.json(
        { error: "No se encontró ningún socio con este DNI" },
        { status: 404 }
      );
    }

    // Evitar registrar múltiples veces en un rango muy corto (ej. 5 minutos)
    const hace5Minutos = new Date(Date.now() - 5 * 60 * 1000);
    const asistenciaReciente = await db.asistenciaClase.findFirst({
      where: {
        socioId: socio.id,
        fecha: {
          gte: hace5Minutos
        }
      }
    });

    if (asistenciaReciente) {
       return NextResponse.json({
        success: true,
        mensaje: "Asistencia ya registrada hace unos instantes.",
        asistencia: asistenciaReciente,
        socio
      });
    }

    // Registrar asistencia
    const asistencia = await db.asistenciaClase.create({
      data: {
        socioId: socio.id,
      },
      include: {
        socio: true
      }
    });
    
    return NextResponse.json({
      success: true,
      mensaje: "Asistencia registrada correctamente",
      asistencia,
      socio
    });

  } catch (error) {
    console.error("Error al registrar asistencia:", error);
    return NextResponse.json(
      { error: "Error interno del servidor al registrar asistencia" },
      { status: 500 }
    );
  }
}
