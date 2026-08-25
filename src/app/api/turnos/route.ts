import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const fechaParam = searchParams.get("fecha");

    if (!fechaParam) {
      return NextResponse.json({ error: "Falta parámetro fecha (YYYY-MM-DD)" }, { status: 400 });
    }

    // Convertir el string YYYY-MM-DD a objeto Date
    const [year, month, day] = fechaParam.split("-").map(Number);
    const fechaQuery = new Date(Date.UTC(year, month - 1, day));

    const turnos = await db.turno.findMany({
      where: {
        fecha: fechaQuery,
      },
      include: {
        socio: {
          select: {
            nombre: true,
            apellido: true,
          }
        },
        cancha: {
          select: {
            nombre: true
          }
        }
      },
      orderBy: [
        { horaInicio: 'asc' },
        { canchaId: 'asc' }
      ]
    });

    // Como Prisma devuelve Date para Time, extraemos la hora para mandarla limpia
    const turnosFormateados = turnos.map(t => {
      // Función segura para parsear hora
      const extractTime = (dateObj: Date) => {
        try {
          return dateObj.toISOString().substring(11, 16);
        } catch (e) {
          // Si por algún motivo no es Date válido, extraer del string si aplica
          const str = String(dateObj);
          if (str.includes("T")) return str.split("T")[1].substring(0, 5);
          return str;
        }
      };

      return {
        id: t.id,
        canchaId: t.canchaId,
        canchaNombre: t.cancha?.nombre || `Cancha ${t.canchaId}`,
        horaInicio: extractTime(t.horaInicio),
        horaFin: extractTime(t.horaFin),
        estado: t.estado,
        motivoBloqueo: t.motivoBloqueo,
        socioDni: t.socioDni,
        socioNombreCompleto: t.socio ? `${t.socio.apellido}, ${t.socio.nombre}` : null,
        acompanante: t.acompanante,
      };
    });

    return NextResponse.json(turnosFormateados);
  } catch (error) {
    console.error("Error al obtener turnos:", error);
    return NextResponse.json({ error: "Error al obtener turnos" }, { status: 500 });
  }
}
