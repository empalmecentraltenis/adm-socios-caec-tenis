import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Helper para registrar actividad usando raw SQL (evita bug de Turbopack con Prisma Client)
async function logActividad(accion: string, detalle: string, socioId?: string) {
  try {
    const now = new Date().toISOString();
    const lowerHexId = Math.random().toString(36).substring(2, 11); // Fallback unique ID
    await db.$executeRawUnsafe(
      `INSERT INTO actividades (id, accion, detalle, socio_id, created_at) VALUES (?, ?, ?, ?, ?)`,
      lowerHexId, accion, detalle, socioId || null, now
    );
  } catch (err) {
    console.warn("No se pudo registrar actividad:", err);
  }
}

// POST /api/pagos - Registrar un nuevo pago
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { socioId, mesPagado, monto, metodoPago } = body;

    if (!socioId || !mesPagado || monto === undefined) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Verificar que no exista ya un pago para ese mes y socio
    const pagoExistente = await db.pagoCuota.findFirst({
      where: { socioId, mesPagado },
    });

    if (pagoExistente) {
      return NextResponse.json(
        { error: "Ya existe un pago registrado para ese mes" },
        { status: 409 }
      );
    }

    // Obtener datos del socio para el log
    const socio = await db.socio.findUnique({ where: { id: socioId } });

    const pago = await db.pagoCuota.create({
      data: {
        socioId,
        mesPagado,
        monto: parseFloat(monto),
        metodoPago: metodoPago || "efectivo",
      },
    });

    // Registrar actividad
    if (socio) {
      const [year, month] = mesPagado.split("-");
      const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const nombreMes = MESES[parseInt(month) - 1] || mesPagado;
      await logActividad("pago_registrado", `Pago de $${parseFloat(monto).toLocaleString("es-AR")} para ${socio.nombre} ${socio.apellido} - ${nombreMes} ${year} (${metodoPago || "efectivo"})`, socioId);
    }

    return NextResponse.json(pago, { status: 201 });
  } catch (error) {
    console.error("Error al registrar pago:", error);
    return NextResponse.json({ error: "Error al registrar pago" }, { status: 500 });
  }
}

// POST /api/pagos/masivo - Registrar pagos masivos
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { socioIds, mesPagado, monto, metodoPago } = body;

    if (!socioIds || !Array.isArray(socioIds) || socioIds.length === 0 || !mesPagado || monto === undefined) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const resultados: { socioId: string; exito: boolean; error?: string }[] = [];
    let exitosos = 0;

    for (const socioId of socioIds) {
      // Verificar que no exista ya un pago para ese mes y socio
      const pagoExistente = await db.pagoCuota.findFirst({
        where: { socioId, mesPagado },
      });

      if (pagoExistente) {
        resultados.push({ socioId, exito: false, error: "Pago ya existente" });
        continue;
      }

      // Obtener datos del socio para monto personalizado
      const socio = await db.socio.findUnique({ where: { id: socioId } });

      // Calcular monto según categoría si no se especifica uno individual
      let montoFinal = parseFloat(monto);
      if (socio) {
        const configuraciones = await db.configuracion.findMany();
        const getValor = (clave: string) => {
          const c = configuraciones.find((c) => c.clave === clave);
          return c ? parseFloat(c.valor) : 0;
        };

        const cuotaPorCategoria: Record<string, number> = {
          socio: getValor("cuota_socio") || 7000,
          alumno: getValor("cuota_alumno") || 3500,
          vitalicio: getValor("cuota_vitalicio") || 0,
        };

        if (!monto || parseFloat(monto) === 0) {
          montoFinal = cuotaPorCategoria[socio.categoria] || 7000;
        }
      }

      try {
        await db.pagoCuota.create({
          data: {
            socioId,
            mesPagado,
            monto: montoFinal,
            metodoPago: metodoPago || "efectivo",
          },
        });
        resultados.push({ socioId, exito: true });
        exitosos++;
      } catch {
        resultados.push({ socioId, exito: false, error: "Error al crear pago" });
      }
    }

    // Registrar actividad
    const [year, month] = mesPagado.split("-");
    const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const nombreMes = MESES[parseInt(month) - 1] || mesPagado;
    await logActividad("pago_masivo", `Pago masivo: ${exitosos} de ${socioIds.length} socios - ${nombreMes} ${year}`);

    return NextResponse.json({
      exitosos,
      fallidos: socioIds.length - exitosos,
      resultados,
    });
  } catch (error) {
    console.error("Error al registrar pagos masivos:", error);
    return NextResponse.json({ error: "Error al registrar pagos masivos" }, { status: 500 });
  }
}

// GET /api/pagos - Obtener pagos (opcionalmente filtrar por socio)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const socioId = searchParams.get("socioId");

    const where = socioId ? { socioId } : {};

    const pagos = await db.pagoCuota.findMany({
      where,
      include: { socio: true },
      orderBy: { mesPagado: "desc" },
    });

    return NextResponse.json(pagos);
  } catch (error) {
    console.error("Error al obtener pagos:", error);
    return NextResponse.json({ error: "Error al obtener pagos" }, { status: 500 });
  }
}
