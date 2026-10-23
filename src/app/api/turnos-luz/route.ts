import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface JugadorTurno {
  nombre: string;
  esTitular: boolean;
  esInvitado: boolean;
  dni?: string;
  monto: number;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tipo = searchParams.get('tipo') || 'dia'; // 'dia' | 'semana' | 'mes' | 'rango'
    const fechaParam = searchParams.get('fecha');
    const desdeParam = searchParams.get('desde');
    const hastaParam = searchParams.get('hasta');
    const mesParam = searchParams.get('mes');

    // 1. Obtener tarifas activas de la configuración
    const configs = await db.configuracion.findMany({
      where: {
        clave: { in: ['precio_luz_turno', 'precio_luz_profe'] },
      },
    });

    let precioLuzTurno = 6000;
    let precioLuzProfe = 3000;

    for (const c of configs) {
      if (c.clave === 'precio_luz_turno') {
        const val = parseFloat(c.valor);
        if (!isNaN(val) && val > 0) precioLuzTurno = val;
      }
      if (c.clave === 'precio_luz_profe') {
        const val = parseFloat(c.valor);
        if (!isNaN(val) && val > 0) precioLuzProfe = val;
      }
    }

    // 2. Determinar rango de fechas
    let startDate: Date;
    let endDate: Date;

    if (tipo === 'dia' && fechaParam) {
      const [year, month, day] = fechaParam.split('-').map(Number);
      startDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    } else if (tipo === 'mes' && mesParam) {
      const [year, month] = mesParam.split('-').map(Number);
      startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    } else if (desdeParam && hastaParam) {
      const [y1, m1, d1] = desdeParam.split('-').map(Number);
      const [y2, m2, d2] = hastaParam.split('-').map(Number);
      startDate = new Date(Date.UTC(y1, m1 - 1, d1, 0, 0, 0, 0));
      endDate = new Date(Date.UTC(y2, m2 - 1, d2, 23, 59, 59, 999));
    } else {
      // Default: Hoy
      const now = new Date();
      startDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
      endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));
    }

    // 3. Consultar turnos en la base de datos
    const turnosDb = await db.turno.findMany({
      where: {
        fecha: {
          gte: startDate,
          lte: endDate,
        },
        estado: { in: ['ocupado', 'bloqueado'] },
      },
      include: {
        socio: {
          select: {
            id: true,
            dni: true,
            nombre: true,
            apellido: true,
            telefono: true,
            categoria: true,
          },
        },
        cancha: {
          select: {
            id: true,
            nombre: true,
          },
        },
      },
      orderBy: [
        { fecha: 'asc' },
        { horaInicio: 'asc' },
        { canchaId: 'asc' },
      ],
    });

    const extractTime = (dateObj: Date | string): string => {
      try {
        if (dateObj instanceof Date) {
          return dateObj.toISOString().substring(11, 16);
        }
        const str = String(dateObj);
        if (str.includes('T')) return str.split('T')[1].substring(0, 5);
        return str.substring(0, 5);
      } catch {
        return '00:00';
      }
    };

    const extractDate = (dateObj: Date | string): string => {
      try {
        if (dateObj instanceof Date) {
          return dateObj.toISOString().split('T')[0];
        }
        return String(dateObj).split('T')[0];
      } catch {
        return '';
      }
    };

    // 4. Filtrar y procesar turnos nocturnos (>= 19:00 hs)
    const turnosSocios: any[] = [];
    const turnosProfesor: any[] = [];

    // Map para acumular consumo y deuda por socio
    const acumuladoSociosMap = new Map<string, {
      id: string;
      nombreCompleto: string;
      dni: string;
      telefono?: string;
      cantidadTurnos: number;
      totalAPagar: number;
      turnosDetalle: Array<{
        turnoId: string;
        fecha: string;
        hora: string;
        cancha: string;
        tipoPartido: string;
        rol: string;
        monto: number;
      }>;
    }>();

    for (const t of turnosDb) {
      const horaStr = extractTime(t.horaInicio);
      const horaFinStr = extractTime(t.horaFin);

      // Solo turnos a partir de las 19:00 hs
      if (horaStr < '19:00') continue;

      const fechaStr = extractDate(t.fecha);
      const canchaNombre = t.cancha?.nombre || `Cancha ${t.canchaId}`;

      // A) Turnos del Profesor (bloqueados por clases)
      if (t.estado === 'bloqueado') {
        const motivo = (t.motivoBloqueo || '').trim();
        const motivoLower = motivo.toLowerCase();

        // Debe ser bloqueo de clases del profesor
        if (motivoLower.includes('clase') || motivoLower.includes('profe')) {
          turnosProfesor.push({
            id: t.id,
            fecha: fechaStr,
            horaInicio: horaStr,
            horaFin: horaFinStr,
            horario: `${horaStr} - ${horaFinStr}`,
            canchaId: t.canchaId,
            canchaNombre,
            detalle: motivo || 'Clases (Permanente)',
            asignadoA: 'Profesor',
            monto: precioLuzProfe,
          });
        }
        continue;
      }

      // B) Turnos de Socios (estado === 'ocupado')
      if (t.estado === 'ocupado') {
        const titularDni = t.socioDni || '';
        const titularNombre = t.socio
          ? `${t.socio.apellido}, ${t.socio.nombre}`
          : (titularDni ? `DNI: ${titularDni}` : 'Socio Titular');

        // Procesar acompañantes
        const rawAcomp = (t.acompanante || '').trim();
        let acompsList: string[] = [];

        if (rawAcomp) {
          // Si está separado por '/'
          if (rawAcomp.includes('/')) {
            acompsList = rawAcomp.split('/').map(s => s.trim()).filter(Boolean);
          } else {
            acompsList = [rawAcomp];
          }
        }

        const jugadores: JugadorTurno[] = [];

        // Agregar titular (siempre es socio)
        jugadores.push({
          nombre: titularNombre,
          esTitular: true,
          esInvitado: false,
          dni: titularDni,
          monto: 0,
        });

        // Agregar acompañantes identificando si son Invitados
        for (const item of acompsList) {
          const itemLower = item.toLowerCase();
          const esInvitado = itemLower.includes('especial') || itemLower.includes('invitado');

          jugadores.push({
            nombre: esInvitado ? 'Invitado Especial' : item,
            esTitular: false,
            esInvitado,
            monto: 0,
          });
        }

        // Determinar modalidad
        let tipoPartido = 'Single';
        if (jugadores.length > 2) {
          tipoPartido = jugadores.length === 4 ? 'Dobles' : `${jugadores.length} Jugadores`;
        }

        // Calcular costo por socio:
        // El costo total del turno ($ 6.000) se divide equitativamente entre los socios participantes.
        // Si hay invitados, su parte la absorbe el titular o se divide entre los socios restantes.
        const sociosParticipantes = jugadores.filter(j => !j.esInvitado);
        const sociosCount = Math.max(1, sociosParticipantes.length);
        const montoPorSocio = Math.round(precioLuzTurno / sociosCount);

        for (const j of jugadores) {
          if (!j.esInvitado) {
            j.monto = montoPorSocio;
          } else {
            j.monto = 0; // El invitado no paga individualmente en el club
          }
        }

        turnosSocios.push({
          id: t.id,
          fecha: fechaStr,
          horaInicio: horaStr,
          horaFin: horaFinStr,
          horario: `${horaStr} - ${horaFinStr}`,
          canchaId: t.canchaId,
          canchaNombre,
          tipoPartido,
          titular: {
            dni: titularDni,
            nombre: titularNombre,
          },
          jugadores,
          totalSocios: sociosCount,
          totalJugadores: jugadores.length,
          montoUnitarioSocio: montoPorSocio,
          montoTotalTurno: precioLuzTurno,
        });

        // Cargar en el acumulador de socios
        for (const j of jugadores) {
          if (j.esInvitado) continue;

          // Clave única: DNI si existe, o nombre normalizado
          const key = j.dni || j.nombre.toUpperCase();

          let entry = acumuladoSociosMap.get(key);
          if (!entry) {
            entry = {
              id: key,
              nombreCompleto: j.nombre,
              dni: j.dni || '',
              telefono: j.esTitular ? (t.socio?.telefono || '') : undefined,
              cantidadTurnos: 0,
              totalAPagar: 0,
              turnosDetalle: [],
            };
            acumuladoSociosMap.set(key, entry);
          }

          entry.cantidadTurnos += 1;
          entry.totalAPagar += j.monto;
          entry.turnosDetalle.push({
            turnoId: t.id,
            fecha: fechaStr,
            hora: `${horaStr} - ${horaFinStr}`,
            cancha: canchaNombre,
            tipoPartido,
            rol: j.esTitular ? 'Titular' : 'Acompañante',
            monto: j.monto,
          });
        }
      }
    }

    // Convertir acumulado a array ordenado por monto descendente
    const sociosAcumulado = Array.from(acumuladoSociosMap.values()).sort(
      (a, b) => b.totalAPagar - a.totalAPagar || a.nombreCompleto.localeCompare(b.nombreCompleto)
    );

    // Totales y KPIs
    const totalSociosMonto = turnosSocios.length * precioLuzTurno;
    const totalProfeMonto = turnosProfesor.length * precioLuzProfe;
    const totalGeneralMonto = totalSociosMonto + totalProfeMonto;

    return NextResponse.json({
      periodo: {
        tipo,
        desde: extractDate(startDate),
        hasta: extractDate(endDate),
      },
      tarifas: {
        precioLuzTurno,
        precioLuzProfe,
      },
      kpis: {
        totalGeneralMonto,
        totalGeneralTurnos: turnosSocios.length + turnosProfesor.length,
        totalSociosMonto,
        totalSociosTurnos: turnosSocios.length,
        totalProfeMonto,
        totalProfeTurnos: turnosProfesor.length,
        totalSociosCobranza: sociosAcumulado.length,
      },
      turnosSocios,
      sociosAcumulado,
      turnosProfesor,
    });
  } catch (error) {
    console.error('Error al consultar turnos con luz:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al consultar turnos con luz' },
      { status: 500 }
    );
  }
}
