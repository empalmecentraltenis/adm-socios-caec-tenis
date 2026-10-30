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

    // Enriquecer cada asistencia con el cálculo real de deuda del socio (igual a /api/socios)
    const ahora = new Date();
    const mesActual = ahora.toISOString().slice(0, 7);
    const mesActualNum = ahora.getFullYear() * 12 + (ahora.getMonth() + 1);

    const asistenciasEnriquecidas = asistencias.map((asistencia) => {
      const socio = asistencia.socio;
      if (!socio) return asistencia;

      const cuotasPendientes = (socio.cuotas || []).filter(c => c.estado === 'pendiente');
      let mesesAdeudadosReales = cuotasPendientes.length;
      let debeMesActualVirtual = false;

      if (socio.estado === 'activo' && socio.categoria !== 'vitalicio' && socio.rol !== 'admin') {
        const todosLosMesesRegistrados = [
          ...(socio.pagos || []).map(p => p.mesPagado),
          ...(socio.cuotas || []).map(c => c.mes),
        ].filter(Boolean).sort();

        let mesInicioNum: number;

        if (todosLosMesesRegistrados.length > 0) {
          const lastMes = todosLosMesesRegistrados[todosLosMesesRegistrados.length - 1];
          const [y, m] = lastMes.split("-").map(Number);
          mesInicioNum = (y * 12 + m) + 1;
          
          if (lastMes < mesActual) {
            debeMesActualVirtual = true;
          }
        } else {
          const fechaAlta = socio.fechaAlta ? new Date(socio.fechaAlta) : ahora;
          mesInicioNum = fechaAlta.getFullYear() * 12 + (fechaAlta.getMonth() + 1);
          debeMesActualVirtual = true;
        }

        if (mesInicioNum <= mesActualNum) {
          mesesAdeudadosReales += (mesActualNum - mesInicioNum + 1);
        }
      }

      // Ignorar mes actual siempre (tolerancia del mes corriente)
      const debeMesActualFisico = cuotasPendientes.some(c => c.mes === mesActual);
      if (debeMesActualFisico || debeMesActualVirtual) {
        mesesAdeudadosReales = Math.max(0, mesesAdeudadosReales - 1);
      }

      const esVitalicio = socio.categoria === "vitalicio";
      const esAdmin = socio.rol === "admin";
      const mesesAdeudados = (esVitalicio || esAdmin) ? 0 : mesesAdeudadosReales;
      const alDia = esAdmin || esVitalicio || mesesAdeudados === 0;

      return {
        ...asistencia,
        socio: {
          ...socio,
          alDia,
          mesesAdeudados,
        }
      };
    });

    return NextResponse.json(asistenciasEnriquecidas);
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

