import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface JugadorTurno {
  nombre: string;
  esTitular: boolean;
  esInvitado: boolean;
  dni?: string;
  monto: number;
  pagado?: boolean;
  pagoId?: string;
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

    // 3. Consultar turnos, socios y pagos en la base de datos
    const [turnosDb, allSocios, pagosLuzDb] = await Promise.all([
      db.turno.findMany({
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
      }),
      db.socio.findMany({
        select: {
          id: true,
          dni: true,
          nombre: true,
          apellido: true,
          telefono: true,
        },
      }),
      db.pagoConcepto.findMany({
        where: {
          tipo: 'luz',
        },
      }),
    ]);

    const pagosLuzMap = new Map<string, typeof pagosLuzDb[0]>();
    for (const p of pagosLuzDb) {
      if (p.turnoId) {
        pagosLuzMap.set(`${p.socioDni}_${p.turnoId}`, p);
      }
    }

    const socioMapByDni = new Map<string, typeof allSocios[0]>();
    for (const s of allSocios) {
      socioMapByDni.set(s.dni, s);
    }

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

    // Hora local en Argentina para verificar si el turno ya terminó
    const nowArg = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
    const hoyStr = `${nowArg.getFullYear()}-${String(nowArg.getMonth() + 1).padStart(2, '0')}-${String(nowArg.getDate()).padStart(2, '0')}`;
    const horaActualStr = `${String(nowArg.getHours()).padStart(2, '0')}:${String(nowArg.getMinutes()).padStart(2, '0')}`;

    const esTurnoFinalizado = (fechaVal: Date | string, horaFinVal: Date | string): boolean => {
      const fStr = extractDate(fechaVal);
      const hFinStr = extractTime(horaFinVal);
      if (fStr < hoyStr) return true;
      if (fStr > hoyStr) return false;
      return hFinStr <= horaActualStr;
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
      // El cargo por luz solo se genera cuando el turno ya terminó
      if (!esTurnoFinalizado(t.fecha, t.horaFin)) continue;

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
        const titularSocio = titularDni ? socioMapByDni.get(titularDni) : null;
        const titularNombre = titularSocio
          ? `${titularSocio.apellido}, ${titularSocio.nombre}`
          : (t.socio ? `${t.socio.apellido}, ${t.socio.nombre}` : (titularDni ? `DNI: ${titularDni}` : 'Socio Titular'));

        const jugadores: JugadorTurno[] = [];

        // Agregar titular (siempre es socio)
        jugadores.push({
          nombre: titularNombre,
          esTitular: true,
          esInvitado: false,
          dni: titularDni,
          monto: 0,
        });

        // Resolver acompañantes usando participantesDnis (DNI oficial)
        const dnisAcomps = (t.participantesDnis || []).filter((d: string) => d && d !== titularDni);

        if (dnisAcomps.length > 0) {
          for (const d of dnisAcomps) {
            if (d === '123987456') {
              jugadores.push({
                nombre: 'Invitado Especial',
                esTitular: false,
                esInvitado: true,
                dni: '123987456',
                monto: 0,
              });
            } else {
              const socPart = socioMapByDni.get(d);
              jugadores.push({
                nombre: socPart ? `${socPart.apellido}, ${socPart.nombre}` : `DNI: ${d}`,
                esTitular: false,
                esInvitado: false,
                dni: d,
                monto: 0,
              });
            }
          }
        } else {
          // Fallback para turnos con texto libre en acompanante
          const rawAcomp = (t.acompanante || '').trim();
          let acompsList: string[] = [];

          if (rawAcomp) {
            if (rawAcomp.includes('/')) {
              acompsList = rawAcomp.split('/').map((s: string) => s.trim()).filter(Boolean);
            } else {
              acompsList = [rawAcomp];
            }
          }

          for (const item of acompsList) {
            const itemLower = item.toLowerCase();
            const esInvitado = itemLower.includes('especial') || itemLower.includes('invitado');

            if (esInvitado) {
              jugadores.push({
                nombre: 'Invitado Especial',
                esTitular: false,
                esInvitado: true,
                dni: '123987456',
                monto: 0,
              });
            } else {
              // Búsqueda inteligente por apellido en socios para completar el DNI
              const norm = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
              const itemNorm = norm(item);
              const matchedSocio = allSocios.find((s) => {
                const apNorm = norm(s.apellido);
                const nomNorm = norm(s.nombre);
                return (
                  itemNorm.includes(apNorm) ||
                  `${apNorm} ${nomNorm}`.includes(itemNorm) ||
                  `${nomNorm} ${apNorm}`.includes(itemNorm)
                );
              });

              jugadores.push({
                nombre: matchedSocio ? `${matchedSocio.apellido}, ${matchedSocio.nombre}` : item,
                esTitular: false,
                esInvitado: false,
                dni: matchedSocio ? matchedSocio.dni : '',
                monto: 0,
              });
            }
          }
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
            if (j.dni) {
              const pago = pagosLuzMap.get(`${j.dni}_${t.id}`);
              j.pagado = !!pago;
              j.pagoId = pago?.id;
            } else {
              j.pagado = false;
            }
          } else {
            j.monto = 0; // El invitado no paga individualmente en el club
            j.pagado = true;
          }
        }

        const sociosNoInv = jugadores.filter(j => !j.esInvitado);
        const pagadosCount = sociosNoInv.filter(j => j.pagado).length;
        const turnoPagadoCompleto = sociosNoInv.length > 0 && pagadosCount === sociosNoInv.length;
        const montoPagadoTurno = pagadosCount * montoPorSocio;
        const montoPendienteTurno = (sociosNoInv.length - pagadosCount) * montoPorSocio;

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
          montoPagado: montoPagadoTurno,
          montoPendiente: montoPendienteTurno,
          pagado: turnoPagadoCompleto,
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
              totalFacturado: 0,
              totalPagado: 0,
              totalPendiente: 0,
              totalAPagar: 0,
              alDia: true,
              turnosDetalle: [],
            } as any;
            acumuladoSociosMap.set(key, entry);
          }

          const entryAny = entry as any;
          entryAny.cantidadTurnos += 1;
          entryAny.totalFacturado = (entryAny.totalFacturado || 0) + j.monto;
          if (j.pagado) {
            entryAny.totalPagado = (entryAny.totalPagado || 0) + j.monto;
          } else {
            entryAny.totalPendiente = (entryAny.totalPendiente || 0) + j.monto;
          }
          entryAny.totalAPagar = entryAny.totalPendiente;
          entryAny.alDia = entryAny.totalPendiente === 0;

          entry.turnosDetalle.push({
            turnoId: t.id,
            fecha: fechaStr,
            hora: `${horaStr} - ${horaFinStr}`,
            cancha: canchaNombre,
            tipoPartido,
            rol: j.esTitular ? 'Titular' : 'Acompañante',
            monto: j.monto,
            pagado: !!j.pagado,
          } as any);
        }
      }
    }

    // Convertir acumulado a array ordenado por monto pendiente descendente
    const sociosAcumulado = Array.from(acumuladoSociosMap.values()).sort(
      (a: any, b: any) => (b.totalPendiente ?? b.totalAPagar) - (a.totalPendiente ?? a.totalAPagar) || a.nombreCompleto.localeCompare(b.nombreCompleto)
    );

    // Totales y KPIs
    const totalSociosMonto = turnosSocios.length * precioLuzTurno;
    const totalSociosPagado = turnosSocios.reduce((acc, t) => acc + (t.montoPagado || 0), 0);
    const totalSociosPendiente = turnosSocios.reduce((acc, t) => acc + (t.montoPendiente || 0), 0);
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
        totalSociosPagado,
        totalSociosPendiente,
        totalSociosTurnos: turnosSocios.length,
        totalProfeMonto,
        totalProfeTurnos: turnosProfesor.length,
        totalSociosCobranza: sociosAcumulado.length,
        sociosConDeuda: sociosAcumulado.filter((s: any) => (s.totalPendiente ?? s.totalAPagar) > 0).length,
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
