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

// GET /api/socios - Obtener todos los socios con información de pagos
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const where: any = {};
    const activosParam = searchParams.get("activos");
    const categoria = searchParams.get("categoria");
    
    // Filtro estricto de estado
    if (activosParam === "true") {
      where.estado = "activo";
    } else if (activosParam === "false") {
      where.estado = "inactivo";
    }
    
    if (categoria && categoria !== "todos") {
      where.categoria = categoria;
    }

    const socios = await db.socio.findMany({
      where,
      include: {
        pagos: {
          orderBy: { mesPagado: "desc" },
        },
        cuotas: {
          orderBy: { mes: "desc" },
        },
      },
      orderBy: { apellido: "asc" },
    });

    const ahora = new Date();
    const mesActual = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}`;

    // Obtener configuración de cuotas
    const configuraciones = await db.configuracion.findMany();
    const getValor = (clave: string) => {
      const c = configuraciones.find((c) => c.clave === clave);
      return c ? parseFloat(c.valor) : 0;
    };

    const cuotaSocio = getValor("cuota_socio") || 7000;
    const cuotaAlumno = getValor("cuota_alumno") || 3500;
    const cuotaVitalicio = getValor("cuota_vitalicio") || 0;

    const cuotaPorCategoria: Record<string, number> = {
      socio: cuotaSocio,
      alumno: cuotaAlumno,
      vitalicio: cuotaVitalicio,
    };

    const sociosConEstado = socios.map((socio) => {
      // 1. Obtener cuotas pendientes reales de la nueva tabla
      const cuotasPendientes = socio.cuotas.filter(c => c.estado === 'pendiente');
      const mesesAdeudadosReales = cuotasPendientes.length;

      // 2. Lógica de compatibilidad: si no hay registros en la tabla cuotas (ej. cuotas viejas), 
      // seguimos usando el cálculo dinámico como respaldo para no perder deudas históricas.
      let mesesAdeudados = mesesAdeudadosReales;
      
      if (socio.cuotas.length === 0) {
        const mesesPagados = socio.pagos.map((p) => p.mesPagado);
        const tienePagoMesActual = mesesPagados.includes(mesActual);
        const ultimoPago = mesesPagados.length > 0
          ? new Date(Math.max(...mesesPagados.map((m) => new Date(m + "-01").getTime())))
          : new Date(socio.fechaAlta);

        const diff = ahora.getFullYear() - ultimoPago.getFullYear();
        const calcDiff = diff * 12 + (ahora.getMonth() - ultimoPago.getMonth());
        mesesAdeudados = calcDiff > 0 ? calcDiff : 0;
      }

      const valorCuota = cuotaPorCategoria[socio.categoria] || 8000;
      const esVitalicio = socio.categoria === "vitalicio";
      
      // alDia: tiene menos de 2 cuotas pendientes (o es vitalicio)
      // Un solo mes de deuda se considera dentro de la tolerancia de 'Al día' para reserva de turnos
      const alDia = esVitalicio || mesesAdeudados < 2;

      return {
        ...socio,
        alDia,
        mesesAdeudados: esVitalicio ? 0 : mesesAdeudados,
        totalPagado: socio.pagos.reduce((acc, p) => acc + p.monto, 0),
        deudaEstimada: mesesAdeudados * valorCuota,
        valorCuota,
      };
    });

    return NextResponse.json(sociosConEstado);
  } catch (error) {
    console.error("Error al obtener socios:", error);
    return NextResponse.json({ error: "Error al obtener socios" }, { status: 500 });
  }
}

// POST /api/socios - Crear un nuevo socio
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, apellido, email, dni, telefono, categoria, rol, fechaAlta, cuotasAdeudadas } = body;

    if (!nombre || !apellido || !email || !dni) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const socio = await db.socio.create({
      data: {
        nombre,
        apellido,
        email,
        dni,
        telefono: telefono || "",
        categoria: categoria || "socio",
        rol: rol || "socio",
        fechaAlta: fechaAlta ? new Date(fechaAlta) : undefined,
      },
    });

    // Generar cuotas pendientes si se especificó deuda inicial (Opción A)
    if (cuotasAdeudadas && parseInt(cuotasAdeudadas) > 0) {
      const cantidad = parseInt(cuotasAdeudadas);
      
      // Obtener valor de cuota según categoría
      const configuraciones = await db.configuracion.findMany();
      const getValor = (clave: string) => {
        const c = configuraciones.find((c) => c.clave === clave);
        return c ? parseFloat(c.valor) : 0;
      };

      const cuotaSocio = getValor("cuota_socio") || 7000;
      const cuotaAlumno = getValor("cuota_alumno") || 3500;
      const monto = categoria === "alumno" ? cuotaAlumno : (categoria === "vitalicio" ? 0 : cuotaSocio);

      if (monto > 0) {
        const ahora = new Date();
        let creadas = 0;
        let mesesAtras = 1; // Empezamos desde el mes pasado

        while (creadas < cantidad && mesesAtras < 60) { // Límite de 5 años por seguridad
          const fechaCuota = new Date(ahora.getFullYear(), ahora.getMonth() - mesesAtras, 1);
          const mesStr = `${fechaCuota.getFullYear()}-${String(fechaCuota.getMonth() + 1).padStart(2, "0")}`;
          
          await db.cuota.create({
            data: {
              socioId: socio.id,
              mes: mesStr,
              monto: monto,
              estado: 'pendiente'
            }
          });
          
          creadas++;
          mesesAtras++;
        }
      }
    }

    // Registrar actividad
    await logActividad("socio_creado", `Alta de socio: ${nombre} ${apellido} (${categoria || "socio"})${cuotasAdeudadas ? ` con ${cuotasAdeudadas} cuotas de deuda` : ""}`, socio.id);

    return NextResponse.json(socio, { status: 201 });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2002") {
      return NextResponse.json({ error: "El email o DNI ya existe" }, { status: 409 });
    }
    console.error("Error al crear socio:", error);
    return NextResponse.json({ error: "Error al crear socio" }, { status: 500 });
  }
}

// PUT /api/socios - Modificar un socio existente
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, nombre, apellido, email, dni, telefono, estado, categoria, rol, fechaAlta, cuotasAdeudadas } = body;

    if (!id || !nombre || !apellido || !email || !dni) {
      return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
    }

    const socioAnterior = await db.socio.findUnique({ 
      where: { id },
      include: { cuotas: true }
    });
    
    if (!socioAnterior) {
      return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });
    }

    // Sincronizar activo <-> estado para que la app de reservas vea lo mismo
    const activoSync = estado ? (estado === 'activo') : undefined;

    const socio = await db.socio.update({
      where: { id },
      data: {
        nombre,
        apellido,
        email,
        dni,
        telefono: telefono !== undefined ? telefono : undefined,
        estado: estado || undefined,
        activo: activoSync,
        categoria: categoria || undefined,
        rol: rol || undefined,
        fechaAlta: fechaAlta ? new Date(fechaAlta) : undefined,
      },
    });

    // Lógica Opción A: Asegurar que tenga X cuotas pendientes en total
    if (cuotasAdeudadas !== undefined) {
      const targetPendientes = parseInt(cuotasAdeudadas);
      const actualesPendientes = socioAnterior.cuotas.filter(c => c.estado === 'pendiente');
      
      if (targetPendientes > actualesPendientes.length) {
        const faltantes = targetPendientes - actualesPendientes.length;
        
        // Obtener monto
        const configuraciones = await db.configuracion.findMany();
        const getValor = (clave: string) => {
          const c = configuraciones.find((c) => c.clave === clave);
          return c ? parseFloat(c.valor) : 0;
        };

        const cuotaSocio = getValor("cuota_socio") || 7000;
        const cuotaAlumno = getValor("cuota_alumno") || 3500;
        const catActual = categoria || socioAnterior.categoria;
        const monto = catActual === "alumno" ? cuotaAlumno : (catActual === "vitalicio" ? 0 : cuotaSocio);

        if (monto > 0) {
          const ahora = new Date();
          let creadas = 0;
          let mesesAtras = 1;
          const mesesExistentes = socioAnterior.cuotas.map(c => c.mes);

          while (creadas < faltantes && mesesAtras < 60) {
            const fechaCuota = new Date(ahora.getFullYear(), ahora.getMonth() - mesesAtras, 1);
            const mesStr = `${fechaCuota.getFullYear()}-${String(fechaCuota.getMonth() + 1).padStart(2, "0")}`;
            
            if (!mesesExistentes.includes(mesStr)) {
              await db.cuota.create({
                data: {
                  socioId: id,
                  mes: mesStr,
                  monto: monto,
                  estado: 'pendiente'
                }
              });
              creadas++;
            }
            mesesAtras++;
          }
        }
      }
    }

    // Registrar actividad
    const cambios: string[] = [];
    if (socioAnterior.nombre !== nombre || socioAnterior.apellido !== apellido) cambios.push("datos personales");
    if (socioAnterior.telefono !== telefono) cambios.push("teléfono");
    if (socioAnterior.estado !== estado && estado) cambios.push(`estado: ${socioAnterior.estado} → ${estado}`);
    if (socioAnterior.categoria !== categoria && categoria) cambios.push(`categoría: ${socioAnterior.categoria} → ${categoria}`);
    if (socioAnterior.rol !== rol && rol) cambios.push(`rol: ${socioAnterior.rol} → ${rol}`);
    if (fechaAlta) cambios.push("fecha de alta");
    if (cuotasAdeudadas !== undefined) cambios.push(`deuda ajustada a ${cuotasAdeudadas} meses`);

    // Registrar actividad
    if (cambios.length > 0) {
      await logActividad("socio_editado", `Se modificó ${cambios.join(", ")} de ${nombre} ${apellido}`, id);
    }

    return NextResponse.json(socio);
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });
    }
    if (err.code === "P2002") {
      return NextResponse.json({ error: "El email o DNI ya existe" }, { status: 409 });
    }
    console.error("Error al modificar socio:", error);
    return NextResponse.json({ error: "Error al modificar socio" }, { status: 500 });
  }
}

// DELETE /api/socios - Dar de baja (soft delete) o eliminar un socio
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const hard = searchParams.get("hard") === "true";

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const socio = await db.socio.findUnique({ where: { id } });
    if (!socio) {
      return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });
    }

    if (hard) {
      await db.socio.delete({ where: { id } });
    } else {
      await db.socio.update({
        where: { id },
        data: { estado: "inactivo", activo: false },
      });

      // Registrar actividad
      await logActividad("socio_dado_baja", `Baja de socio: ${socio.nombre} ${socio.apellido}`, id);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { code?: string };
    if (err.code === "P2025") {
      return NextResponse.json({ error: "Socio no encontrado" }, { status: 404 });
    }
    console.error("Error al eliminar socio:", error);
    return NextResponse.json({ error: "Error al eliminar socio" }, { status: 500 });
  }
}
