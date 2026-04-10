import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/actividad - Obtener registro de actividad
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const actividades = await db.actividad.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await db.actividad.count();

    return NextResponse.json({
      actividades,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error al obtener actividad:", error);
    return NextResponse.json({ error: "Error al obtener actividad" }, { status: 500 });
  }
}
