import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET: Listar todos los alumnos ordenados por grupo y nombre
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const grupo = searchParams.get('grupo');

    const where: any = { activo: true };
    if (grupo && grupo !== 'todos') {
      where.grupo = grupo;
    }

    const alumnos = await db.alumnoEscuela.findMany({
      where,
      orderBy: [
        { grupo: 'asc' },
        { nombre: 'asc' }
      ]
    });

    return NextResponse.json({ success: true, alumnos });
  } catch (err: any) {
    console.error('Error al obtener alumnos:', err);
    return NextResponse.json({ error: 'Error al obtener alumnos' }, { status: 500 });
  }
}

// POST: Crear nuevo alumno
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nombre, grupo, edad, telefono, tutor, observaciones } = body;

    if (!nombre || !nombre.trim()) {
      return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
    }
    if (!grupo || !grupo.trim()) {
      return NextResponse.json({ error: 'El grupo es obligatorio' }, { status: 400 });
    }

    const alumno = await db.alumnoEscuela.create({
      data: {
        nombre: nombre.trim(),
        grupo: grupo.trim(),
        edad: edad ? parseInt(edad, 10) : null,
        telefono: telefono ? telefono.trim() : null,
        tutor: tutor ? tutor.trim() : null,
        observaciones: observaciones ? observaciones.trim() : null,
        activo: true,
      }
    });

    return NextResponse.json({ success: true, alumno }, { status: 201 });
  } catch (err: any) {
    console.error('Error al crear alumno:', err);
    return NextResponse.json({ error: 'Error al crear alumno' }, { status: 500 });
  }
}

// PUT: Editar alumno existente
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, nombre, grupo, edad, telefono, tutor, observaciones, activo } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID de alumno requerido' }, { status: 400 });
    }

    const alumno = await db.alumnoEscuela.update({
      where: { id },
      data: {
        ...(nombre !== undefined && { nombre: nombre.trim() }),
        ...(grupo !== undefined && { grupo: grupo.trim() }),
        ...(edad !== undefined && { edad: edad ? parseInt(edad, 10) : null }),
        ...(telefono !== undefined && { telefono: telefono ? telefono.trim() : null }),
        ...(tutor !== undefined && { tutor: tutor ? tutor.trim() : null }),
        ...(observaciones !== undefined && { observaciones: observaciones ? observaciones.trim() : null }),
        ...(activo !== undefined && { activo: Boolean(activo) }),
      }
    });

    return NextResponse.json({ success: true, alumno });
  } catch (err: any) {
    console.error('Error al actualizar alumno:', err);
    return NextResponse.json({ error: 'Error al actualizar alumno' }, { status: 500 });
  }
}

// DELETE: Eliminar alumno (física o lógicamente)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID de alumno requerido' }, { status: 400 });
    }

    await db.alumnoEscuela.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'Alumno eliminado' });
  } catch (err: any) {
    console.error('Error al eliminar alumno:', err);
    return NextResponse.json({ error: 'Error al eliminar alumno' }, { status: 500 });
  }
}

