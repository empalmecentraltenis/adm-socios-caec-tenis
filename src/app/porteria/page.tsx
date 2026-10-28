'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  Search,
  Clock,
  Calendar,
  Users,
  GraduationCap,
  RefreshCw,
  Sparkles,
  UserCheck,
  X,
  Radio,
  Wrench,
  Trophy,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

export const SHIFTS = [
  { start: '08:30', end: '10:00', label: '08:30 a 10:00' },
  { start: '10:00', end: '11:30', label: '10:00 a 11:30' },
  { start: '11:30', end: '13:00', label: '11:30 a 13:00' },
  { start: '13:00', end: '14:30', label: '13:00 a 14:30' },
  { start: '14:30', end: '16:00', label: '14:30 a 16:00' },
  { start: '16:00', end: '17:30', label: '16:00 a 17:30' },
  { start: '17:30', end: '19:00', label: '17:30 a 19:00' },
  { start: '19:00', end: '20:30', label: '19:00 a 20:30' },
  { start: '20:30', end: '22:00', label: '20:30 a 22:00' },
  { start: '22:00', end: '23:30', label: '22:00 a 23:30' },
];

interface Participante {
  dni: string;
  nombre: string;
  categoria: string;
  telefono: string;
  esTitular: boolean;
  haValidadoQR: boolean;
}

interface TurnoPorteria {
  id: string;
  canchaId: number;
  canchaNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: string;
  esProfe: boolean;
  tipo: 'socio' | 'profe' | 'mantenimiento' | 'torneo' | 'bloqueado';
  estadoTiempo: 'en_curso' | 'proximo' | 'finalizado';
  minutosParaInicio: number | null;
  titularNombre: string;
  titularDni: string;
  titularTelefono: string;
  acompanante: string | null;
  participantes: Participante[];
  validadoQr: boolean;
  validadosCount: number;
  participantesCount: number;
  motivoBloqueo: string | null;
}

interface KpisDia {
  total: number;
  enCurso?: number;
  proximos?: number;
  finalizados?: number;
  socios: number;
  profe: number;
  bloqueados?: number;
}

type TabDia = 'hoy' | 'manana' | 'otro';
type FiltroTipo = 'todos' | 'en_curso' | 'socios' | 'profe' | 'bloqueados';

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function formatFechaLarga(fechaStr: string): string {
  try {
    const [y, m, d] = fechaStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return `${DIAS_SEMANA[date.getDay()]} ${d} de ${MESES[m - 1]}`;
  } catch {
    return fechaStr;
  }
}

export default function PorteriaPage() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [relojDigital, setRelojDigital] = useState<string>('');
  const [horaActualArg, setHoraActualArg] = useState<string>('');
  const [todayStr, setTodayStr] = useState<string>('');
  const [tomorrowStr, setTomorrowStr] = useState<string>('');

  // Pestaña activa
  const [tabDia, setTabDia] = useState<TabDia>('hoy');
  const [fechaPersonalizada, setFechaPersonalizada] = useState<string>('');

  // Datos
  const [turnosHoy, setTurnosHoy] = useState<TurnoPorteria[]>([]);
  const [turnosManana, setTurnosManana] = useState<TurnoPorteria[]>([]);
  const [turnosOtro, setTurnosOtro] = useState<TurnoPorteria[]>([]);
  const [kpisHoy, setKpisHoy] = useState<KpisDia>({ total: 0, socios: 0, profe: 0, enCurso: 0, proximos: 0, finalizados: 0 });
  const [kpisManana, setKpisManana] = useState<KpisDia>({ total: 0, socios: 0, profe: 0 });

  // Filtros y Buscador
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos');

  // Reloj digital en vivo en el encabezado
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setRelojDigital(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      setHoraActualArg(`${hh}:${mm}`);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cargar datos desde la API
  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      let url = '/api/porteria';
      if (tabDia === 'otro' && fechaPersonalizada) {
        url += `?fecha=${fechaPersonalizada}`;
      }
      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al cargar datos');
      const data = await res.json();

      setTodayStr(data.todayStr);
      setTomorrowStr(data.tomorrowStr);
      setTurnosHoy(data.turnosHoy || []);
      setTurnosManana(data.turnosManana || []);
      setKpisHoy(data.kpisHoy || { total: 0, socios: 0, profe: 0 });
      setKpisManana(data.kpisManana || { total: 0, socios: 0, profe: 0 });

      if (tabDia === 'otro') {
        setTurnosOtro(data.turnos || []);
      }
    } catch (err) {
      if (!isSilent) {
        toast({
          title: 'Error de conexión',
          description: 'No se pudieron sincronizar los turnos de portería.',
          variant: 'destructive',
        });
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [tabDia, fechaPersonalizada, toast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Turnos de la pestaña actual
  const turnosActivos = useMemo(() => {
    if (tabDia === 'hoy') return turnosHoy;
    if (tabDia === 'manana') return turnosManana;
    return turnosOtro;
  }, [tabDia, turnosHoy, turnosManana, turnosOtro]);

  // Determinar si un turno coincide con el buscador
  const coincideConBusqueda = useCallback((t?: TurnoPorteria) => {
    if (!t) return false;
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase().trim();
    const matchTitular = t.titularNombre.toLowerCase().includes(q) || t.titularDni.includes(q);
    const matchAcomp = t.acompanante ? t.acompanante.toLowerCase().includes(q) : false;
    const matchMotivo = t.motivoBloqueo ? t.motivoBloqueo.toLowerCase().includes(q) : false;
    const matchParticipantes = t.participantes.some(
      (p) => p.nombre.toLowerCase().includes(q) || p.dni.includes(q)
    );
    return matchTitular || matchAcomp || matchMotivo || matchParticipantes;
  }, [searchTerm]);

  // Determinar si un turno coincide con el filtro de tipo
  const coincideConFiltro = useCallback((t?: TurnoPorteria) => {
    if (!t) return false;
    if (filtroTipo === 'todos') return true;
    if (filtroTipo === 'en_curso') return t.estadoTiempo === 'en_curso';
    if (filtroTipo === 'socios') return t.tipo === 'socio';
    if (filtroTipo === 'profe') return t.tipo === 'profe';
    if (filtroTipo === 'bloqueados') return t.tipo !== 'socio' && t.tipo !== 'profe';
    return true;
  }, [filtroTipo]);

  // Componente de celda de cancha individual
  const renderCanchaCard = (canchaId: number, shift: typeof SHIFTS[0]) => {
    const turno = turnosActivos.find(
      (t) => t.canchaId === canchaId && t.horaInicio === shift.start
    );

    // Si hay búsqueda activa y este turno no coincide, se atenúa
    const cumpleBusqueda = searchTerm.trim() ? coincideConBusqueda(turno) : true;
    const cumpleFiltro = filtroTipo !== 'todos' ? coincideConFiltro(turno) : true;

    if (!turno) {
      if (filtroTipo !== 'todos' || searchTerm.trim()) {
        // En búsqueda/filtro, ocultar celdas libres para focalizar
        return (
          <div className="bg-[#121214] border border-[#222226] rounded-xl p-3 min-h-[85px] flex items-center justify-center text-[#555] text-xs italic">
            Sin reservas
          </div>
        );
      }

      return (
        <div className="bg-[#131316] border border-[#24242A] rounded-xl p-3.5 min-h-[85px] flex items-center justify-between transition-colors">
          <div className="space-y-0.5">
            <span className="text-[11px] font-black uppercase tracking-wider text-[#666]">
              Cancha {canchaId}
            </span>
            <p className="text-xs text-[#555] italic">Libre (Sin reserva)</p>
          </div>
          <Badge variant="outline" className="bg-[#1A1A1E] text-[#666] border-[#2E2E35] text-[10px]">
            Libre
          </Badge>
        </div>
      );
    }

    const tipo = turno.tipo || (turno.esProfe ? 'profe' : turno.estado === 'bloqueado' ? 'bloqueado' : 'socio');
    const esProfe = tipo === 'profe';
    const esMantenimiento = tipo === 'mantenimiento';
    const esTorneo = tipo === 'torneo';
    const esBloqueado = tipo === 'bloqueado';
    const enJuego = turno.estadoTiempo === 'en_curso' && tabDia === 'hoy';

    let cardBgClass = 'bg-[#15151A] border-[#2C2C35] hover:border-[#3D3D48]';
    let canchaBadgeClass = 'bg-blue-600 text-white';

    if (enJuego) {
      cardBgClass = 'bg-[#10241A] border-emerald-500/70 ring-1 ring-emerald-500/50 shadow-emerald-950/40';
      canchaBadgeClass = 'bg-emerald-500 text-black';
    } else if (esProfe) {
      cardBgClass = 'bg-[#1C1912] border-amber-500/40 hover:border-amber-500/60';
      canchaBadgeClass = 'bg-amber-400 text-black';
    } else if (esMantenimiento) {
      cardBgClass = 'bg-[#1C1610] border-orange-500/40 hover:border-orange-500/60';
      canchaBadgeClass = 'bg-orange-500 text-black';
    } else if (esTorneo) {
      cardBgClass = 'bg-[#171421] border-purple-500/40 hover:border-purple-500/60';
      canchaBadgeClass = 'bg-purple-500 text-white';
    } else if (esBloqueado) {
      cardBgClass = 'bg-[#17171C] border-[#383845] hover:border-[#4B4B5C]';
      canchaBadgeClass = 'bg-[#40404E] text-white';
    }

    return (
      <div
        className={`rounded-xl border p-3.5 flex flex-col justify-between transition-all min-h-[92px] shadow-sm relative ${
          !cumpleBusqueda || !cumpleFiltro ? 'opacity-35 grayscale-[50%]' : ''
        } ${cardBgClass}`}
      >
        <div>
          {/* Header de la celda de Cancha */}
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${canchaBadgeClass}`}
              >
                Cancha {canchaId}
              </span>

              {enJuego && (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-bold px-1.5 py-0 flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  EN JUEGO
                </Badge>
              )}
            </div>

            {/* Badges para Profe, Mantenimiento, Torneo o Bloqueado (Sin QR) */}
            {esProfe ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-bold">
                Clase Profe
              </Badge>
            ) : esMantenimiento ? (
              <Badge variant="outline" className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-[10px] font-bold flex items-center gap-1">
                <Wrench className="h-3 w-3" /> Mantenimiento
              </Badge>
            ) : esTorneo ? (
              <Badge variant="outline" className="bg-purple-500/15 text-purple-300 border-purple-500/30 text-[10px] font-bold flex items-center gap-1">
                <Trophy className="h-3 w-3" /> Torneo / Evento
              </Badge>
            ) : esBloqueado ? (
              <Badge variant="outline" className="bg-[#24242C] text-[#AAA] border-[#383845] text-[10px] font-bold">
                Bloqueado
              </Badge>
            ) : null}
          </div>

          {/* Datos del Jugador / Clase / Evento */}
          <div className="space-y-1">
            {esProfe ? (
              <div className="space-y-0.5">
                <div className="text-[15px] font-black text-white flex items-center gap-1.5">
                  <GraduationCap className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="truncate">{turno.titularNombre}</span>
                </div>
              </div>
            ) : esMantenimiento ? (
              <div className="space-y-0.5">
                <div className="text-[15px] font-black text-orange-200 flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-orange-400 shrink-0" />
                  <span className="truncate">{turno.titularNombre}</span>
                </div>
                <p className="text-[11px] text-orange-400/80 italic">Cancha en mantenimiento</p>
              </div>
            ) : esTorneo ? (
              <div className="space-y-0.5">
                <div className="text-[15px] font-black text-purple-100 flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-purple-400 shrink-0" />
                  <span className="truncate">{turno.titularNombre}</span>
                </div>
                <p className="text-[11px] text-purple-300/80 italic">Evento especial del club</p>
              </div>
            ) : esBloqueado ? (
              <div className="space-y-0.5">
                <div className="text-[15px] font-black text-white flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-[#888] shrink-0" />
                  <span className="truncate">{turno.titularNombre}</span>
                </div>
              </div>
            ) : (
              /* Turno normal de Socios: SOLO NOMBRES DE JUGADORES (Sin DNI, Sin Teléfono) */
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-black text-white truncate tracking-tight">
                    {turno.titularNombre}
                  </span>
                </div>

                {turno.acompanante ? (
                  <div className="text-sm font-extrabold text-blue-100 flex items-center gap-1.5 truncate bg-[#1E1E26] px-2.5 py-1 rounded-lg border border-[#353545] shadow-xs">
                    <Users className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="truncate">
                      + <span className="font-black text-white">{turno.acompanante}</span>
                    </span>
                  </div>
                ) : turno.participantes.filter((p) => !p.esTitular).length > 0 ? (
                  <div className="space-y-1">
                    {turno.participantes
                      .filter((p) => !p.esTitular)
                      .map((p, pIdx) => (
                        <div
                          key={pIdx}
                          className="text-sm font-extrabold text-blue-100 flex items-center gap-1.5 truncate bg-[#1E1E26] px-2.5 py-1 rounded-lg border border-[#353545] shadow-xs"
                        >
                          <Users className="h-4 w-4 text-blue-400 shrink-0" />
                          <span className="truncate">
                            + <span className="font-black text-white">{p.nombre}</span>
                          </span>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0C0C0E] text-[#ECECEC] p-3 sm:p-5 lg:p-6 space-y-5 max-w-[1500px] mx-auto">
      {/* HEADER DE PORTERÍA */}
      <header className="bg-[#161619] border border-[#26262B] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-blue-500/20">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">CAEC Tenis · Portería</h1>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px] font-bold px-2 py-0.5 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Control de Canchas Activo
              </Badge>
            </div>
            <p className="text-xs text-[#999999] mt-0.5">
              Puesto de control de guardia: turnos por horario en Cancha 1 y Cancha 2 (Socios y Profesor)
            </p>
          </div>
        </div>

        {/* Reloj Digital & Botón Refrescar */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="bg-[#111113] border border-[#26262B] rounded-xl px-4 py-2 text-right">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">Hora Oficial</span>
            <span className="text-lg font-black text-white font-mono">{relojDigital || '--:--:--'}</span>
          </div>

          <Button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="bg-[#222226] hover:bg-[#2C2C32] border border-[#303038] text-white h-11 px-4 rounded-xl gap-2 text-xs font-semibold"
            title="Refrescar datos en vivo"
          >
            <RefreshCw className={`h-4 w-4 text-blue-400 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>
        </div>
      </header>

      {/* SELECTOR DE DÍA: HOY / MAÑANA / OTRA FECHA */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Pestaña HOY */}
        <button
          onClick={() => setTabDia('hoy')}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
            tabDia === 'hoy'
              ? 'bg-blue-600/15 border-blue-500 text-white shadow-lg shadow-blue-500/10'
              : 'bg-[#161619] border-[#26262B] text-[#888888] hover:border-[#383840]'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-wider ${tabDia === 'hoy' ? 'text-blue-400' : 'text-[#777]'}`}>
                ☀️ HOY
              </span>
              {tabDia === 'hoy' && (
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
              )}
            </div>
            <div className="text-base font-black text-white">
              {todayStr ? formatFechaLarga(todayStr) : 'Hoy'}
            </div>
            <div className="text-[11px] text-[#999999] flex items-center gap-2 pt-0.5 flex-wrap">
              <span>👥 {kpisHoy.socios} socios</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">🎓 {kpisHoy.profe} profe</span>
              {(kpisHoy.bloqueados ?? 0) > 0 && (
                <>
                  <span>•</span>
                  <span className="text-purple-400 font-semibold">🏆 {kpisHoy.bloqueados} eventos</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-white">{kpisHoy.total}</span>
            <span className="text-[10px] text-[#888888] block font-bold uppercase">Turnos</span>
          </div>
        </button>

        {/* Pestaña MAÑANA */}
        <button
          onClick={() => setTabDia('manana')}
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
            tabDia === 'manana'
              ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-lg shadow-indigo-500/10'
              : 'bg-[#161619] border-[#26262B] text-[#888888] hover:border-[#383840]'
          }`}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black uppercase tracking-wider ${tabDia === 'manana' ? 'text-indigo-400' : 'text-[#777]'}`}>
                🌙 MAÑANA
              </span>
            </div>
            <div className="text-base font-black text-white">
              {tomorrowStr ? formatFechaLarga(tomorrowStr) : 'Mañana'}
            </div>
            <div className="text-[11px] text-[#999999] flex items-center gap-2 pt-0.5 flex-wrap">
              <span>👥 {kpisManana.socios} socios</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">🎓 {kpisManana.profe} profe</span>
              {(kpisManana.bloqueados ?? 0) > 0 && (
                <>
                  <span>•</span>
                  <span className="text-purple-400 font-semibold">🏆 {kpisManana.bloqueados} eventos</span>
                </>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-white">{kpisManana.total}</span>
            <span className="text-[10px] text-[#888888] block font-bold uppercase">Turnos</span>
          </div>
        </button>

        {/* Selector OTRA FECHA */}
        <div
          className={`flex items-center justify-between p-4 rounded-2xl border transition-all sm:col-span-2 lg:col-span-1 ${
            tabDia === 'otro'
              ? 'bg-purple-600/15 border-purple-500 text-white shadow-lg shadow-purple-500/10'
              : 'bg-[#161619] border-[#26262B] text-[#888888]'
          }`}
        >
          <div className="space-y-1 w-full">
            <span className={`text-xs font-black uppercase tracking-wider block ${tabDia === 'otro' ? 'text-purple-400' : 'text-[#777]'}`}>
              📅 OTRA FECHA
            </span>
            <div className="flex items-center gap-2 mt-1">
              <Input
                type="date"
                value={fechaPersonalizada || todayStr}
                onChange={(e) => {
                  setFechaPersonalizada(e.target.value);
                  setTabDia('otro');
                }}
                className="bg-[#111113] border-[#303038] text-white text-xs h-9 rounded-xl w-full max-w-[200px]"
              />
              <Button
                size="sm"
                variant={tabDia === 'otro' ? 'default' : 'outline'}
                onClick={() => setTabDia('otro')}
                className="text-xs h-9 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white border-0"
              >
                Ver
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* BUSCADOR DE PORTERÍA & FILTROS */}
      <div className="bg-[#161619] border border-[#26262B] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Buscador Rápido */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="¿Quién llega al portón? Escribí Apellido, DNI o Nombre..."
              className="pl-10 pr-9 h-11 bg-[#111113] border-[#2B2B32] text-white placeholder:text-[#666] focus:border-blue-500 rounded-xl text-sm"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777] hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtros Rápidos */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <Button
              size="sm"
              variant={filtroTipo === 'todos' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('todos')}
              className={`rounded-xl text-xs h-9 px-3 ${
                filtroTipo === 'todos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#111113] border-[#2B2B32] text-[#888] hover:text-white'
              }`}
            >
              Todos ({turnosActivos.length})
            </Button>

            {tabDia === 'hoy' && (
              <Button
                size="sm"
                variant={filtroTipo === 'en_curso' ? 'default' : 'outline'}
                onClick={() => setFiltroTipo('en_curso')}
                className={`rounded-xl text-xs h-9 px-3 gap-1.5 ${
                  filtroTipo === 'en_curso'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-[#111113] border-[#2B2B32] text-[#888] hover:text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                En Juego ({turnosActivos.filter((t) => t.estadoTiempo === 'en_curso').length})
              </Button>
            )}

            <Button
              size="sm"
              variant={filtroTipo === 'socios' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('socios')}
              className={`rounded-xl text-xs h-9 px-3 gap-1.5 ${
                filtroTipo === 'socios'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#111113] border-[#2B2B32] text-[#888] hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Socios ({turnosActivos.filter((t) => t.tipo === 'socio').length})
            </Button>

            <Button
              size="sm"
              variant={filtroTipo === 'profe' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('profe')}
              className={`rounded-xl text-xs h-9 px-3 gap-1.5 ${
                filtroTipo === 'profe'
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#111113] border-[#2B2B32] text-[#888] hover:text-white'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Profe ({turnosActivos.filter((t) => t.tipo === 'profe').length})
            </Button>

            {turnosActivos.some((t) => t.tipo !== 'socio' && t.tipo !== 'profe') && (
              <Button
                size="sm"
                variant={filtroTipo === 'bloqueados' ? 'default' : 'outline'}
                onClick={() => setFiltroTipo('bloqueados')}
                className={`rounded-xl text-xs h-9 px-3 gap-1.5 ${
                  filtroTipo === 'bloqueados'
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#111113] border-[#2B2B32] text-[#888] hover:text-white'
                }`}
              >
                <Trophy className="h-3.5 w-3.5" />
                Eventos / Bloqueos ({turnosActivos.filter((t) => t.tipo !== 'socio' && t.tipo !== 'profe').length})
              </Button>
            )}
          </div>
        </div>

        {/* TABLA ORGANIZADA EN RENGLONES: HORARIO - CANCHA 1 - CANCHA 2 */}
        <div className="space-y-3 pt-1">
          {/* Encabezado de Columnas (visible en desktop/tablets) */}
          <div className="hidden md:grid md:grid-cols-12 gap-3 px-4 py-2.5 bg-[#111113] border border-[#24242A] rounded-xl text-xs font-black uppercase tracking-wider text-[#888]">
            <div className="col-span-3 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-blue-400" />
              <span>Horario del Turno</span>
            </div>
            <div className="col-span-4 lg:col-span-4 flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Cancha 1</span>
            </div>
            <div className="col-span-5 lg:col-span-5 flex items-center gap-1.5 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <span>Cancha 2</span>
            </div>
          </div>

          {loading && (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-sm text-[#888]">Cargando turnos de portería...</p>
            </div>
          )}

          {!loading && (
            <div className="space-y-2.5">
              {SHIFTS.map((shift, idx) => {
                const turnoC1 = turnosActivos.find((t) => t.canchaId === 1 && t.horaInicio === shift.start);
                const turnoC2 = turnosActivos.find((t) => t.canchaId === 2 && t.horaInicio === shift.start);

                // Determinar si este horario está en curso hoy
                const esHorarioActual =
                  tabDia === 'hoy' &&
                  horaActualArg >= shift.start &&
                  horaActualArg < shift.end;

                const yaPaso =
                  tabDia === 'hoy' &&
                  horaActualArg >= shift.end;

                // Si hay filtro o búsqueda y ninguno de los dos cumple, ocultamos este renglón
                const c1Coincide = searchTerm.trim() ? coincideConBusqueda(turnoC1) : true;
                const c2Coincide = searchTerm.trim() ? coincideConBusqueda(turnoC2) : true;
                const c1Filtro = filtroTipo !== 'todos' ? coincideConFiltro(turnoC1) : true;
                const c2Filtro = filtroTipo !== 'todos' ? coincideConFiltro(turnoC2) : true;

                const tieneContenidoRelevante =
                  (turnoC1 && c1Coincide && c1Filtro) ||
                  (turnoC2 && c2Coincide && c2Filtro);

                if ((searchTerm.trim() || filtroTipo !== 'todos') && !tieneContenidoRelevante) {
                  return null;
                }

                return (
                  <div
                    key={idx}
                    className={`rounded-2xl border transition-all p-3 sm:p-4 shadow-sm ${
                      esHorarioActual
                        ? 'bg-[#101F18] border-emerald-500/70 ring-1 ring-emerald-500/40 shadow-emerald-950/40'
                        : yaPaso
                        ? 'bg-[#131316] border-[#222227] opacity-75'
                        : 'bg-[#151518] border-[#26262B] hover:border-[#383842]'
                    }`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      {/* COLUMNA 1: HORARIO (3 columnas en desktop) */}
                      <div className="md:col-span-3 flex md:flex-col items-center md:items-start justify-between md:justify-center border-b md:border-b-0 pb-2 md:pb-0 border-[#26262B]">
                        <div>
                          <span className="text-base sm:text-lg font-black font-mono text-white tracking-tight">
                            {shift.label}
                          </span>
                        </div>

                        {esHorarioActual && (
                          <div className="pt-1.5">
                            <Badge className="bg-emerald-500 text-black border-emerald-400 text-[10px] font-black px-2 py-0.5 flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-black"></span>
                              EN JUEGO AHORA
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* COLUMNA 2: CANCHA 1 (4 o 5 columnas en desktop) */}
                      <div className="md:col-span-4 lg:col-span-4">
                        <div className="md:hidden text-[10px] font-black uppercase text-emerald-400 mb-1">
                          Cancha 1
                        </div>
                        {renderCanchaCard(1, shift)}
                      </div>

                      {/* COLUMNA 3: CANCHA 2 (5 columnas en desktop) */}
                      <div className="md:col-span-5 lg:col-span-5">
                        <div className="md:hidden text-[10px] font-black uppercase text-blue-400 mb-1">
                          Cancha 2
                        </div>
                        {renderCanchaCard(2, shift)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
