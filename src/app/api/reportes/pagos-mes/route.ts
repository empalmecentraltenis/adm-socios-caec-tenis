import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mes = searchParams.get("mes");

    if (!mes) {
      return NextResponse.json({ error: "Mes requerido" }, { status: 400 });
    }

    const pagos = await db.pagoCuota.findMany({
      where: { mesPagado: mes },
      include: {
        socio: {
          select: {
            nombre: true,
            apellido: true,
            categoria: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(pagos);
  } catch (error) {
    console.error("Error al obtener pagos por mes:", error);
    return NextResponse.json({ error: "Error al obtener pagos por mes" }, { status: 500 });
  }
}
