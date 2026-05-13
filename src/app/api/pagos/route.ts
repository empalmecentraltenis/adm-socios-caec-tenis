import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

// POST /api/pagos - Registrar un nuevo pago
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { socioId, mesPagado, mesesPagados, monto, metodoPago } = body;

    if (!socioId || (!mesPagado && (!mesesPagados || mesesPagados.length === 0)) || monto === undefined) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    // Normalizar a array de meses
    const listaMeses: string[] = mesesPagados || [mesPagado];
    const resultados = [];

    // Obtener datos del socio para el log
    const socio = await db.socio.findUnique({ where: { id: socioId } });
    if (!socio) return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });

    for (const mes of listaMeses) {
      // Verificar que no exista ya un pago para ese mes y socio
      const pagoExistente = await db.pagoCuota.findFirst({
        where: { socioId, mesPagado: mes },
      });

      if (pagoExistente) {
        resultados.push({ mes, status: 'error', error: 'Ya existe un pago para este mes' });
        continue;
      }

      const pago = await db.pagoCuota.create({
        data: {
          socioId,
          mesPagado: mes,
          monto: parseFloat(monto),
          metodoPago: metodoPago || "efectivo",
        },
      });

      // Sincronizar: si había una cuota pendiente para ese mes, marcarla como pagada
      const cuotaPendiente = await db.cuota.findFirst({
        where: { socioId, mes: mes, estado: 'pendiente' },
      });
      
      if (cuotaPendiente) {
        await db.cuota.update({
          where: { id: cuotaPendiente.id },
          data: { estado: 'pagada' },
        });
      }

      resultados.push({ mes, status: 'ok', id: pago.id });

      // Registrar actividad por cada pago
      const [year, month] = mes.split("-");
      const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
      const nombreMes = MESES[parseInt(month) - 1] || mes;
      await logActividad("pago_registrado", `Pago de $${parseFloat(monto).toLocaleString("es-AR")} para ${socio.nombre} ${socio.apellido} - ${nombreMes} ${year} (${metodoPago || "efectivo"})`, socioId);
    }

    return NextResponse.json({ success: true, resultados }, { status: 201 });
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
        
        // Sincronizar
        const cuotaPendiente = await db.cuota.findFirst({
          where: { socioId, mes: mesPagado, estado: 'pendiente' },
        });
        
        if (cuotaPendiente) {
          await db.cuota.update({
            where: { id: cuotaPendiente.id },
            data: { estado: 'pagada' },
          });
        }

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

    const cuotasPendientes = await db.cuota.findMany({
      where: { ...where, estado: 'pendiente' },
    });

    // Formatear cuotas pendientes para que la UI las entienda como ítems del historial
    const pendientesAdaptadas = cuotasPendientes.map((c) => ({
      id: c.id,
      socioId: c.socioId,
      mesPagado: c.mes,
      monto: c.monto,
      metodoPago: 'pendiente',
      fechaRegistro: c.createdAt.toISOString(),
    }));

    // Lógica dinámica: Detectar meses faltantes entre el último pago y el mes actual
    if (socioId) {
      const ahora = new Date();
      const mesActualNum = ahora.getFullYear() * 12 + (ahora.getMonth() + 1);
      
      // Obtener socio para saber fecha de alta, categoría y ROL
      const socio = await db.socio.findUnique({ 
        where: { id: socioId }, 
        select: { fechaAlta: true, categoria: true, rol: true } 
      });

      if (socio && socio.categoria !== 'vitalicio' && socio.rol !== 'admin') {
        // Determinar desde cuándo empezar a buscar deudas
        let mesInicioNum: number;
        
        const todosLosMesesRegistrados = [
          ...pagos.map(p => p.mesPagado),
          ...cuotasPendientes.map(c => c.mes)
        ].sort();

        if (todosLosMesesRegistrados.length > 0) {
          // Si hay registros, empezamos desde el mes siguiente al último registrado
          const lastMes = todosLosMesesRegistrados[todosLosMesesRegistrados.length - 1];
          const [y, m] = lastMes.split("-").map(Number);
          mesInicioNum = (y * 12 + m) + 1;
        } else {
          // Si no hay nada, empezamos desde la fecha de alta
          const fechaAlta = socio.fechaAlta || ahora;
          mesInicioNum = fechaAlta.getFullYear() * 12 + (fechaAlta.getMonth() + 1);
        }

        // Obtener valores de cuota
        const configuraciones = await db.configuracion.findMany();
        const getValor = (clave: string) => {
          const c = configuraciones.find((c) => c.clave === clave);
          return c ? parseFloat(c.valor) : 0;
        };
        const cuotaSocio = getValor("cuota_socio") || 7000;
        const cuotaAlumno = getValor("cuota_alumno") || 3500;
        const montoBase = socio.categoria === 'alumno' ? cuotaAlumno : cuotaSocio;

        // Generar meses virtuales desde mesInicioNum hasta mesActualNum
        for (let mNum = mesInicioNum; mNum <= mesActualNum; mNum++) {
          const year = Math.floor((mNum - 1) / 12);
          const month = ((mNum - 1) % 12) + 1;
          const mesStr = `${year}-${String(month).padStart(2, "0")}`;
          
          pendientesAdaptadas.push({
            id: `virtual-${mesStr}`,
            socioId,
            mesPagado: mesStr,
            monto: montoBase,
            metodoPago: 'pendiente',
            fechaRegistro: ahora.toISOString(),
          });
        }
      }
    }

    // Combinar pagos realizados y cuotas pendientes, y ordenar cronológicamente
    const historialUnificado = [...pagos, ...pendientesAdaptadas].sort((a, b) => {
      return b.mesPagado.localeCompare(a.mesPagado);
    });

    return NextResponse.json(historialUnificado);
  } catch (error) {
    console.error("Error al obtener pagos:", error);
    return NextResponse.json({ error: "Error al obtener pagos" }, { status: 500 });
  }
}
