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

    const formatted = registros.map((r) => ({
      ...r,
      fechaFormateada: r.fecha.toISOString().split('T')[0],
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Error al obtener registros de clases del profesor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al consultar registros' },
      { status: 500 }
    );
  }
}

// POST /api/clases-profe - Cargar nuevo registro diario del profesor
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fecha, cantidadAlumnos, precioTotal, profesor, turno, observaciones } = body;

    if (!fecha) {
      return NextResponse.json(
        { error: 'La fecha es requerida' },
        { status: 400 }
      );
    }

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

    // Convertir fecha YYYY-MM-DD a mediodía UTC para evitar desplazamientos de zona horaria
    const [year, month, day] = fecha.split('-').map(Number);
    const fechaUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

    const nuevoRegistro = await db.registroClaseProfesor.create({
      data: {
        fecha: fechaUtc,
        cantidadAlumnos: parsedAlumnos,
        precioTotal: parsedPrecio,
        profesor: profesor?.trim() || 'Profesor',
        turno: turno?.trim() || null,
        observaciones: observaciones?.trim() || null,
      },
    });

    // Registrar actividad en el sistema
    try {
      await db.actividad.create({
        data: {
          accion: 'clase_profe_registrada',
          detalle: `El profesor cargó la planilla del ${fecha}: ${parsedAlumnos} alumnos, Total: $${parsedPrecio.toLocaleString('es-AR')}`,
        },
      });
    } catch (actError) {
      console.warn('No se pudo registrar la actividad:', actError);
    }

    return NextResponse.json({
      success: true,
      mensaje: 'Registro de clase guardado exitosamente',
      registro: {
        ...nuevoRegistro,
        fechaFormateada: nuevoRegistro.fecha.toISOString().split('T')[0],
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
    const { id, fecha, cantidadAlumnos, precioTotal, profesor, turno, observaciones } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const updateData: any = {};

    if (fecha) {
      const [year, month, day] = fecha.split('-').map(Number);
      updateData.fecha = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
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
        fechaFormateada: updated.fecha.toISOString().split('T')[0],
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
