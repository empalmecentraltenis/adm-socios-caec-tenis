import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { VALORES_CUOTA, getValorCuotaPorGrupo } from '@/app/api/pagos-escuela/route';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const mesParam = searchParams.get('mes'); // YYYY-MM
    const anioParam = searchParams.get('anio'); // YYYY

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = String(now.getMonth() + 1).padStart(2, '0');
    const mes = mesParam || `${curYear}-${curMonth}`;
    const anio = anioParam ? parseInt(anioParam, 10) : parseInt(mes.substring(0, 4), 10);

    const [anioStr, mesNumStr] = mes.split('-');
    const mesNum = parseInt(mesNumStr, 10);

    // =========================================================================
    // 1. ESCUELA DE TENIS: Resumen por grupos, listado simple y visor mes por mes
    // =========================================================================
    const alumnosEscuela = await db.alumnoEscuela.findMany({
      where: { activo: true },
      orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true,
        nombre: true,
        grupo: true,
      },
    });

    const conteoPorGrupo: Record<string, number> = {
      Escuelita: 0,
      Minitenis: 0,
      'Grupo Entrenamiento': 0,
    };
    for (const al of alumnosEscuela) {
      conteoPorGrupo[al.grupo] = (conteoPorGrupo[al.grupo] || 0) + 1;
    }

    // Todos los pagos del año para el visor mensual de recaudación de escuela
    const pagosEscuelaAnio = await db.pagoCuotaEscuela.findMany({
      where: {
        mes: {
          startsWith: String(anio),
        },
      },
      select: {
        mes: true,
        monto: true,
      },
    });

    const escuelaMesesMap: Record<string, { totalRecaudado: number; cantidadPagos: number }> = {};
    for (const p of pagosEscuelaAnio) {
      if (!escuelaMesesMap[p.mes]) {
        escuelaMesesMap[p.mes] = { totalRecaudado: 0, cantidadPagos: 0 };
      }
      escuelaMesesMap[p.mes].totalRecaudado += p.monto;
      escuelaMesesMap[p.mes].cantidadPagos += 1;
    }

    const escuelaMeses = Array.from({ length: 12 }, (_, i) => {
      const mStr = `${anio}-${String(i + 1).padStart(2, '0')}`;
      const datos = escuelaMesesMap[mStr] || { totalRecaudado: 0, cantidadPagos: 0 };
      return {
        mes: mStr,
        numeroMes: i + 1,
        totalRecaudado: datos.totalRecaudado,
        cantidadPagos: datos.cantidadPagos,
      };
    });

    const escuelaRecaudadoMesActual = escuelaMesesMap[mes]?.totalRecaudado || 0;

    // =========================================================================
    // 2. CLASES PARTICULARES: Alumnos por mes, clases asistidas y visor mensual
    // =========================================================================
    // Asistencias de todo el año para armar el visor mes a mes
    const startOfYear = new Date(`${anio}-01-01T00:00:00.000-03:00`);
    const endOfYear = new Date(`${anio}-12-31T23:59:59.999-03:00`);

    const asistenciasAnio = await db.asistenciaClase.findMany({
      where: {
        fecha: {
          gte: startOfYear,
          lte: endOfYear,
        },
      },
      include: {
        socio: {
          select: {
            id: true,
            dni: true,
            nombre: true,
            apellido: true,
            categoria: true,
          },
        },
      },
      orderBy: { fecha: 'asc' },
    });

    // Mapeo por mes de particulares
    const particularesMesesMap: Record<string, Map<string, {
      id: string;
      nombre: string;
      esSocio: boolean;
      dni?: string | null;
      cantidadClases: number;
    }>> = {};

    for (const asis of asistenciasAnio) {
      const fechaIso = asis.fecha.toISOString();
      const mKey = fechaIso.substring(0, 7); // YYYY-MM
      if (!particularesMesesMap[mKey]) {
        particularesMesesMap[mKey] = new Map();
      }

      const mapMes = particularesMesesMap[mKey];
      const socio = asis.socio;
      const keyAlumno = socio ? socio.id : `asis_${asis.id}`;
      const nombre = socio ? `${socio.apellido}, ${socio.nombre}` : 'Alumno';
      const esSocio = Boolean(socio && socio.categoria !== 'alumno');

      if (!mapMes.has(keyAlumno)) {
        mapMes.set(keyAlumno, {
          id: keyAlumno,
          nombre,
          esSocio,
          dni: socio?.dni,
          cantidadClases: 0,
        });
      }

      mapMes.get(keyAlumno)!.cantidadClases += 1;
    }

    const particularesMeses = Array.from({ length: 12 }, (_, i) => {
      const mStr = `${anio}-${String(i + 1).padStart(2, '0')}`;
      const mapMes = particularesMesesMap[mStr];
      const totalAlumnos = mapMes ? mapMes.size : 0;
      let totalClases = 0;
      if (mapMes) {
        for (const item of mapMes.values()) {
          totalClases += item.cantidadClases;
        }
      }
      return {
        mes: mStr,
        numeroMes: i + 1,
        totalAlumnos,
        totalClases,
      };
    });

    const particularesAlumnosMesActual = particularesMesesMap[mes]
      ? Array.from(particularesMesesMap[mes].values()).sort((a, b) =>
          b.cantidadClases - a.cantidadClases || a.nombre.localeCompare(b.nombre)
        )
      : [];

    // =========================================================================
    // 3. CLASES PROFESOR: Registros de clases cargados por el profesor en /profe
    // =========================================================================
    const registrosProfesorMes = await db.registroClaseProfesor.findMany({
      where: {
        fecha: {
          gte: new Date(Date.UTC(anio, mesNum - 1, 1, 0, 0, 0, 0)),
          lte: new Date(Date.UTC(anio, mesNum, 0, 23, 59, 59, 999)),
        },
      },
      orderBy: [
        { fecha: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const registrosProfesorFormatted = registrosProfesorMes.map((r) => {
      const fechaStr = r.fecha instanceof Date
        ? r.fecha.toISOString().split('T')[0]
        : String(r.fecha).split('T')[0];
      return {
        id: r.id,
        fecha: fechaStr,
        cantidadClases: r.cantidadClases,
        cantidadAlumnos: r.cantidadAlumnos,
        precioTotal: r.precioTotal,
        profesor: r.profesor || 'Profesor',
        turno: r.turno || '-',
        observaciones: r.observaciones || '',
      };
    });

    const totalClasesProfesorMes = registrosProfesorFormatted.reduce((acc, r) => acc + r.cantidadClases, 0);
    const totalAlumnosProfesorMes = registrosProfesorFormatted.reduce((acc, r) => acc + r.cantidadAlumnos, 0);
    const totalMontoProfesorMes = registrosProfesorFormatted.reduce((acc, r) => acc + r.precioTotal, 0);

    // =========================================================================
    // 4. PADRÓN GENERAL DE SOCIOS: Sin categorías ("todos"), limpio
    // =========================================================================
    const socios = await db.socio.findMany({
      where: { activo: true },
      orderBy: [
        { apellido: 'asc' },
        { nombre: 'asc' },
      ],
      select: {
        id: true,
        dni: true,
        nombre: true,
        apellido: true,
        telefono: true,
        email: true,
      },
    });

    // =========================================================================
    // 5. BALANCE MENSUAL E INVERSIONES / AHORROS
    // =========================================================================
    const configs = await db.configuracion.findMany();
    const configMap: Record<string, string> = {};
    for (const c of configs) {
      configMap[c.clave] = c.valor;
    }

    const saldoBaseInicial = parseFloat(configMap['saldo_inicial_enero_2026'] || '0');
    const ahorrosDolaresNum = parseFloat(configMap['ahorros_dolares'] || '0');
    const cotizacionDolarNum = parseFloat(configMap['cotizacion_dolar'] || '1000');
    const ahorrosDolaresEnPesos = ahorrosDolaresNum * cotizacionDolarNum;

    // Plazos Fijos
    const plazosFijos = await db.plazoFijo.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const plazosFijosFormatted = plazosFijos.map((p) => ({
      ...p,
      fechaConstitucion: p.fechaConstitucion.toISOString().split('T')[0],
      fechaVencimiento: p.fechaVencimiento.toISOString().split('T')[0],
    }));

    const plazosActivos = plazosFijos.filter((p) => p.estado === 'activo');
    const capitalPlazosActivos = plazosActivos.reduce((acc, p) => acc + p.montoInvertido, 0);

    // Traer todos los movimientos históricos para calcular saldos finales de cada mes
    const todosMovimientos = await db.movimiento.findMany({
      orderBy: { fecha: 'asc' },
    });

    let runningBalance = saldoBaseInicial;
    const movimientosPorMesMap: Record<string, {
      ingresos: number;
      egresos: number;
      movimientos: any[];
    }> = {};

    for (const m of todosMovimientos) {
      const fechaStr = m.fecha.toISOString().split('T')[0];
      const mKey = fechaStr.substring(0, 7);
      if (!movimientosPorMesMap[mKey]) {
        movimientosPorMesMap[mKey] = { ingresos: 0, egresos: 0, movimientos: [] };
      }
      if (m.tipo === 'ingreso') {
        movimientosPorMesMap[mKey].ingresos += m.monto;
      } else {
        movimientosPorMesMap[mKey].egresos += m.monto;
      }
      movimientosPorMesMap[mKey].movimientos.push({
        id: m.id,
        fecha: fechaStr,
        descripcion: m.descripcion,
        responsable: m.responsable,
        tipo: m.tipo,
        monto: m.monto,
      });
    }

    // Calcular saldo acumulado mes por mes de los 12 meses del año solicitado
    // Primero acumulamos los movimientos anteriores a enero del año solicitado
    const startOfAnioDate = new Date(`${anio}-01-01T00:00:00Z`);
    let saldoAlInicioDelAnio = saldoBaseInicial;
    for (const m of todosMovimientos) {
      if (m.fecha < startOfAnioDate) {
        saldoAlInicioDelAnio += (m.tipo === 'ingreso' ? m.monto : -m.monto);
      }
    }

    let saldoAcumulado = saldoAlInicioDelAnio;
    const balanceMeses = Array.from({ length: 12 }, (_, i) => {
      const mStr = `${anio}-${String(i + 1).padStart(2, '0')}`;
      const datos = movimientosPorMesMap[mStr] || { ingresos: 0, egresos: 0, movimientos: [] };
      const saldoInicialMes = saldoAcumulado;
      const resultadoMes = datos.ingresos - datos.egresos;
      saldoAcumulado += resultadoMes;
      const saldoFinalMes = saldoAcumulado;

      return {
        mes: mStr,
        numeroMes: i + 1,
        saldoInicial: saldoInicialMes,
        ingresos: datos.ingresos,
        egresos: datos.egresos,
        resultadoNeto: resultadoMes,
        saldoFinal: saldoFinalMes,
        cantidadMovimientos: datos.movimientos.length,
      };
    });

    // Saldo actual total en tiempo real (sumando todos los movimientos de la historia)
    const saldoActualTotal = todosMovimientos.reduce((acc, m) => {
      return acc + (m.tipo === 'ingreso' ? m.monto : -m.monto);
    }, saldoBaseInicial);

    // Movimientos del mes seleccionado
    const datosMesActualBalance = balanceMeses.find((b) => b.mes === mes) || {
      mes,
      saldoInicial: 0,
      ingresos: 0,
      egresos: 0,
      resultadoNeto: 0,
      saldoFinal: 0,
    };
    const movimientosMesSeleccionado = movimientosPorMesMap[mes]?.movimientos || [];

    // =========================================================================
    // 6. EVENTOS E INTERCLUBES: Historial de informes para Comisión Directiva
    // =========================================================================
    const eventosInformes = await db.eventoInforme.findMany({
      orderBy: { fechaEvento: 'desc' },
    });

    return NextResponse.json({
      success: true,
      mes,
      anio,
      // 1. Escuela
      escuela: {
        totalAlumnos: alumnosEscuela.length,
        porGrupo: conteoPorGrupo,
        recaudadoMesActual: escuelaRecaudadoMesActual,
        meses: escuelaMeses,
        alumnos: alumnosEscuela,
      },
      // 2. Particulares
      particulares: {
        meses: particularesMeses,
        totalAlumnosMesActual: particularesAlumnosMesActual.length,
        alumnos: particularesAlumnosMesActual,
      },
      // 3. Clases Profesor
      clasesProfesor: {
        registros: registrosProfesorFormatted,
        totalClases: totalClasesProfesorMes,
        totalAlumnos: totalAlumnosProfesorMes,
        totalMonto: totalMontoProfesorMes,
      },
      // 4. Padrón Socios
      socios: {
        total: socios.length,
        lista: socios,
      },
      // 5. Balance e Inversiones
      balance: {
        saldoActualTotal,
        meses: balanceMeses,
        mesActual: datosMesActualBalance,
        movimientos: movimientosMesSeleccionado,
        // Inversiones y Ahorros
        inversiones: {
          capitalPlazosActivos,
          ahorrosDolares: ahorrosDolaresNum,
          cotizacionDolar: cotizacionDolarNum,
          ahorrosDolaresEnPesos,
          totalPatrimonioDisponible: saldoActualTotal + capitalPlazosActivos + ahorrosDolaresEnPesos,
          plazosFijos: plazosFijosFormatted,
        },
      },
      // 6. Eventos e Interclubes
      eventos: eventosInformes,
    });
  } catch (err: any) {
    console.error('Error en /api/comision:', err);
    return NextResponse.json({ error: err.message || 'Error al obtener datos de comisión' }, { status: 500 });
  }
}
