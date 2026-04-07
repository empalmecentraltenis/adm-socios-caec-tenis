import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/actividad - Obtener registro de actividad
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const actividades = await db.$queryRawUnsafe(
      `SELECT id, accion, detalle, socioId, createdAt FROM Actividad ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
      limit, offset
    ) as Array<{ id: string; accion: string; detalle: string; socioId: string | null; createdAt: string }>;

    const totalResult = await db.$queryRawUnsafe(`SELECT COUNT(*) as count FROM Actividad`) as Array<{ count: bigint }>;
    const total = Number(totalResult[0]?.count || 0);

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
