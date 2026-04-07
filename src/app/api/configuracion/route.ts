import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Helper para registrar actividad usando raw SQL (evita bug de Turbopack con Prisma Client)
async function logActividad(accion: string, detalle: string, socioId?: string) {
  try {
    const now = new Date().toISOString();
    await db.$executeRawUnsafe(
      `INSERT INTO Actividad (id, accion, detalle, socioId, createdAt) VALUES (lower(hex(randomblob(8))), ?, ?, ?, ?)`,
      accion, detalle, socioId || null, now
    );
  } catch (err) {
    console.warn("No se pudo registrar actividad:", err);
  }
}

// GET /api/configuracion - Obtener toda la configuración
export async function GET() {
  try {
    const configs = await db.configuracion.findMany();

    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.clave] = c.valor;
    }

    return NextResponse.json(configMap);
  } catch (error) {
    console.error("Error al obtener configuración:", error);
    return NextResponse.json({ error: "Error al obtener configuración" }, { status: 500 });
  }
}

// PUT /api/configuracion - Actualizar valores de configuración
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { cuota_socio, cuota_alumno, cuota_vitalicio } = body;

    const updates = [
      { clave: "cuota_socio", valor: String(cuota_socio ?? 7000) },
      { clave: "cuota_alumno", valor: String(cuota_alumno ?? 3500) },
      { clave: "cuota_vitalicio", valor: String(cuota_vitalicio ?? 0) },
    ];

    for (const update of updates) {
      await db.configuracion.upsert({
        where: { clave: update.clave },
        update: { valor: update.valor },
        create: { clave: update.clave, valor: update.valor },
      });
    }

    // Registrar actividad
    await logActividad("config_actualizada", `Cuotas actualizadas: Socio $${Number(cuota_socio ?? 7000).toLocaleString("es-AR")}, Alumno $${Number(cuota_alumno ?? 3500).toLocaleString("es-AR")}, Vitalicio $${Number(cuota_vitalicio ?? 0).toLocaleString("es-AR")}`);

    return NextResponse.json({
      cuota_socio: Number(cuota_socio ?? 7000),
      cuota_alumno: Number(cuota_alumno ?? 3500),
      cuota_vitalicio: Number(cuota_vitalicio ?? 0),
    });
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 });
  }
}
