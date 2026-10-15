import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/clases-profe - Obtener registros de clases del profesor
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateStr = searchParams.get('fecha'); // YYYY-MM-DD
    const monthStr = searchParams.get('mes'); // YYYY-MM
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    let whereClause: any = {};

    if (dateStr) {
      const [year, month, day] = dateStr.split('-').map(Number);
      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));

      whereClause = {
        fecha: {
          gte: startOfDay,
          lte: endOfDay,
        },
      };
    } else if (monthStr) {
      const [year, month] = monthStr.split('-').map(Number);
      const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

      whereClause = {
        fecha: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      };
    }

    const registros = await db.registroClaseProfesor.findMany({
      where: whereClause,
      orderBy: [
        { fecha: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    const formatted = registros.map((r) => {
      const fechaStr = r.fecha instanceof Date
        ? r.fecha.toISOString().split('T')[0]
        : String(r.fecha).split('T')[0];
      return {
        ...r,
        fecha: fechaStr,
        fechaFormateada: fechaStr,
      };
    });

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error al obtener registros de clases del profesor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al consultar registros' },
      { status: 500 }
    );
  }
}

// POST /api/clases-profe - Cargar o actualizar registro diario del profesor (solo 1 por día)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fecha, cantidadClases, cantidadAlumnos, precioTotal, observaciones } = body;

    if (!fecha) {
      return NextResponse.json(
        { error: 'La fecha es requerida' },
        { status: 400 }
      );
    }

    const parsedClases = parseInt(String(cantidadClases ?? 1), 10);
    const validClases = isNaN(parsedClases) || parsedClases < 1 ? 1 : parsedClases;

    const parsedAlumnos = parseInt(String(cantidadAlumnos), 10);
    if (isNaN(parsedAlumnos) || parsedAlumnos < 0) {
      return NextResponse.json(
        { error: 'La cantidad de alumnos debe ser un número válido igual o mayor a 0' },
        { status: 400 }
      );
    }

    const parsedPrecio = parseFloat(String(precioTotal).replace(',', '.'));
    if (isNaN(parsedPrecio) || parsedPrecio < 0) {
      return NextResponse.json(
        { error: 'El precio total debe ser un número válido igual o mayor a 0' },
        { status: 400 }
      );
    }

    // Convertir fecha YYYY-MM-DD a mediodía UTC
    const [year, month, day] = fecha.split('-').map(Number);
    const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    const fechaUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    // Verificar si ya existe registro para ese día (solo 1 carga por día)
    const existing = await db.registroClaseProfesor.findFirst({
      where: {
        fecha: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });

    let registro;
    let esActualizacion = false;

    if (existing) {
      esActualizacion = true;
      registro = await db.registroClaseProfesor.update({
        where: { id: existing.id },
        data: {
          cantidadClases: validClases,
          cantidadAlumnos: parsedAlumnos,
          precioTotal: parsedPrecio,
          observaciones: observaciones?.trim() || null,
        },
      });
    } else {
      registro = await db.registroClaseProfesor.create({
        data: {
          fecha: fechaUtc,
          cantidadClases: validClases,
          cantidadAlumnos: parsedAlumnos,
          precioTotal: parsedPrecio,
          profesor: 'Profesor',
          observaciones: observaciones?.trim() || null,
        },
      });
    }

    // Registrar actividad en el sistema
    try {
      await db.actividad.create({
        data: {
          accion: esActualizacion ? 'clase_profe_actualizada' : 'clase_profe_registrada',
          detalle: `Planilla del ${fecha} ${esActualizacion ? 'actualizada' : 'registrada'}: ${validClases} clase${validClases !== 1 ? 's' : ''}, ${parsedAlumnos} alumnos, Total: $${parsedPrecio.toLocaleString('es-AR')}`,
        },
      });
    } catch (actError) {
      console.warn('No se pudo registrar la actividad:', actError);
    }

    return NextResponse.json({
      success: true,
      mensaje: esActualizacion
        ? 'Planilla del día actualizada correctamente'
        : 'Planilla del día guardada correctamente',
      registro: {
        ...registro,
        fecha: registro.fecha instanceof Date
          ? registro.fecha.toISOString().split('T')[0]
          : String(registro.fecha).split('T')[0],
        fechaFormateada: registro.fecha instanceof Date
          ? registro.fecha.toISOString().split('T')[0]
          : String(registro.fecha).split('T')[0],
      },
    });
  } catch (error: any) {
    console.error('Error al registrar clase del profesor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al guardar el registro', details: error.message },
      { status: 500 }
    );
  }
}

// PUT /api/clases-profe - Editar un registro existente
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, fecha, cantidadClases, cantidadAlumnos, precioTotal, profesor, turno, observaciones } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const updateData: any = {};

    if (fecha) {
      const [year, month, day] = fecha.split('-').map(Number);
      updateData.fecha = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }

    if (cantidadClases !== undefined) {
      const parsedClases = parseInt(String(cantidadClases), 10);
      if (isNaN(parsedClases) || parsedClases < 1) {
        return NextResponse.json({ error: 'Cantidad de clases inválida (debe ser al menos 1)' }, { status: 400 });
      }
      updateData.cantidadClases = parsedClases;
    }

    if (cantidadAlumnos !== undefined) {
      const parsedAlumnos = parseInt(String(cantidadAlumnos), 10);
      if (isNaN(parsedAlumnos) || parsedAlumnos < 0) {
        return NextResponse.json({ error: 'Cantidad de alumnos inválida' }, { status: 400 });
      }
      updateData.cantidadAlumnos = parsedAlumnos;
    }

    if (precioTotal !== undefined) {
      const parsedPrecio = parseFloat(String(precioTotal).replace(',', '.'));
      if (isNaN(parsedPrecio) || parsedPrecio < 0) {
        return NextResponse.json({ error: 'Precio total inválido' }, { status: 400 });
      }
      updateData.precioTotal = parsedPrecio;
    }

    if (profesor !== undefined) updateData.profesor = profesor.trim() || 'Profesor';
    if (turno !== undefined) updateData.turno = turno?.trim() || null;
    if (observaciones !== undefined) updateData.observaciones = observaciones?.trim() || null;

    const updated = await db.registroClaseProfesor.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      mensaje: 'Registro actualizado correctamente',
      registro: {
        ...updated,
        fecha: updated.fecha instanceof Date
          ? updated.fecha.toISOString().split('T')[0]
          : String(updated.fecha).split('T')[0],
        fechaFormateada: updated.fecha instanceof Date
          ? updated.fecha.toISOString().split('T')[0]
          : String(updated.fecha).split('T')[0],
      },
    });
  } catch (error: any) {
    console.error('Error al actualizar registro de clase:', error);
    return NextResponse.json(
      { error: 'Error al actualizar registro', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE /api/clases-profe - Eliminar un registro
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    await db.registroClaseProfesor.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      mensaje: 'Registro eliminado correctamente',
    });
  } catch (error: any) {
    console.error('Error al eliminar registro de clase:', error);
    return NextResponse.json(
      { error: 'Error al eliminar el registro', details: error.message },
      { status: 500 }
    );
  }
}
