import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Helper para registrar actividad usando Prisma
async function logActividad(accion: string, detalle: string, socioId?: string) {
  try {
    await db.actividad.create({
      data: {
        accion,
        detalle,
        socioId: socioId || null,
      }
    });
  } catch (err) {
    console.warn("No se pudo registrar actividad:", err);
  }
}

// GET /api/configuracion - Obtener toda la configuración
export async function GET() {
  try {
    const configs = await db.configuracion.findMany();

    const configMap: Record<string, string> = {
      cuota_socio: "7000",
      cuota_alumno: "3500",
      cuota_vitalicio: "0",
      saldo_inicial_enero_2026: "0"
    };

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
    console.log("Actualizando configuración con body:", body);

    const keys = [
      "cuota_socio",
      "cuota_alumno",
      "cuota_vitalicio",
      "saldo_inicial_enero_2026"
    ];

    for (const key of keys) {
      if (body[key] !== undefined && body[key] !== null) {
        await db.configuracion.upsert({
          where: { clave: key },
          update: { valor: String(body[key]) },
          create: { clave: key, valor: String(body[key]) },
        });
      }
    }

    // Registrar actividad
    await logActividad("config_actualizada", `Configuración general actualizada.`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error al actualizar configuración:", error);
    return NextResponse.json({ error: "Error al actualizar configuración" }, { status: 500 });
  }
}
