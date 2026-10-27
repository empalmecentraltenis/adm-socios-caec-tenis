'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Shield,
  Search,
  Clock,
  Calendar,
  Users,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Phone,
  Sparkles,
  ChevronRight,
  UserCheck,
  Flame,
  X,
  Radio,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

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
  tipo: 'socio' | 'profe' | 'bloqueado';
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

interface CanchaInfo {
  id: number;
  nombre: string;
}

interface KpisDia {
  total: number;
  enCurso?: number;
  proximos?: number;
  finalizados?: number;
  socios: number;
  profe: number;
}

type TabDia = 'hoy' | 'manana' | 'otro';
type FiltroTipo = 'todos' | 'en_curso' | 'proximos' | 'socios' | 'profe';

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
  const [horaActual, setHoraActual] = useState<string>('');
  const [relojDigital, setRelojDigital] = useState<string>('');
  const [todayStr, setTodayStr] = useState<string>('');
  const [tomorrowStr, setTomorrowStr] = useState<string>('');
  const [canchas, setCanchas] = useState<CanchaInfo[]>([]);

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

  // Reloj en vivo de cabecera
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setRelojDigital(now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
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

      setHoraActual(data.horaServidor);
      setTodayStr(data.todayStr);
      setTomorrowStr(data.tomorrowStr);
      setCanchas(data.canchas || []);
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

  // Primera carga y recarga periódica cada 30 segundos
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Turnos activos según la pestaña seleccionada
  const turnosActivos = useMemo(() => {
    if (tabDia === 'hoy') return turnosHoy;
    if (tabDia === 'manana') return turnosManana;
    return turnosOtro;
  }, [tabDia, turnosHoy, turnosManana, turnosOtro]);

  const fechaActivaStr = useMemo(() => {
    if (tabDia === 'hoy') return todayStr;
    if (tabDia === 'manana') return tomorrowStr;
    return fechaPersonalizada || todayStr;
  }, [tabDia, todayStr, tomorrowStr, fechaPersonalizada]);

  // Canchas en juego ahora mismo (solo aplica para hoy)
  const canchasEnJuegoAhora = useMemo(() => {
    if (tabDia !== 'hoy') return [];
    return turnosHoy.filter((t) => t.estadoTiempo === 'en_curso');
  }, [tabDia, turnosHoy]);

  // Filtrado de turnos
  const turnosFiltrados = useMemo(() => {
    let result = [...turnosActivos];

    // Filtro por tipo
    if (filtroTipo === 'en_curso') {
      result = result.filter((t) => t.estadoTiempo === 'en_curso');
    } else if (filtroTipo === 'proximos') {
      result = result.filter((t) => t.estadoTiempo === 'proximo');
    } else if (filtroTipo === 'socios') {
      result = result.filter((t) => !t.esProfe && t.estado !== 'bloqueado');
    } else if (filtroTipo === 'profe') {
      result = result.filter((t) => t.esProfe);
    }

    // Buscador por texto
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      result = result.filter((t) => {
        const matchTitular = t.titularNombre.toLowerCase().includes(q) || t.titularDni.includes(q);
        const matchAcomp = t.acompanante ? t.acompanante.toLowerCase().includes(q) : false;
        const matchMotivo = t.motivoBloqueo ? t.motivoBloqueo.toLowerCase().includes(q) : false;
        const matchCancha = t.canchaNombre.toLowerCase().includes(q);
        const matchParticipantes = t.participantes.some(
          (p) => p.nombre.toLowerCase().includes(q) || p.dni.includes(q)
        );
        return matchTitular || matchAcomp || matchMotivo || matchCancha || matchParticipantes;
      });
    }

    return result;
  }, [turnosActivos, filtroTipo, searchTerm]);

  return (
    <div className="min-h-screen bg-[#0F0F10] text-[#ECECEC] p-3 sm:p-5 lg:p-6 space-y-5 max-w-[1500px] mx-auto">
      {/* HEADER DE PORTERÍA */}
      <header className="bg-[#18181A] border border-[#27272A] rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-black text-white text-xl shadow-lg shadow-blue-500/20">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">CAEC Tenis · Portería</h1>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px] font-bold px-2 py-0.5 flex items-center gap-1.5 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                Control de Acceso Activo
              </Badge>
            </div>
            <p className="text-xs text-[#999999] mt-0.5">
              Visualización en vivo de turnos en juego, ingresos de socios y clases del profesor
            </p>
          </div>
        </div>

        {/* Reloj Digital & Botón Refrescar */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="bg-[#121214] border border-[#27272A] rounded-xl px-4 py-2 text-right">
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">Hora Actual</span>
            <span className="text-lg font-black text-white font-mono">{relojDigital || '--:--:--'}</span>
          </div>

          <Button
            onClick={() => fetchData(false)}
            disabled={loading}
            className="bg-[#242427] hover:bg-[#2F2F33] border border-[#333338] text-white h-11 px-4 rounded-xl gap-2 text-xs font-semibold"
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
              : 'bg-[#18181A] border-[#27272A] text-[#888888] hover:border-[#3E3E42]'
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
            <div className="text-[11px] text-[#999999] flex items-center gap-2 pt-0.5">
              <span>👥 {kpisHoy.socios} socios</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">🎓 {kpisHoy.profe} profe</span>
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
              : 'bg-[#18181A] border-[#27272A] text-[#888888] hover:border-[#3E3E42]'
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
            <div className="text-[11px] text-[#999999] flex items-center gap-2 pt-0.5">
              <span>👥 {kpisManana.socios} socios</span>
              <span>•</span>
              <span className="text-amber-400 font-semibold">🎓 {kpisManana.profe} profe</span>
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
              : 'bg-[#18181A] border-[#27272A] text-[#888888]'
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
                className="bg-[#121214] border-[#333338] text-white text-xs h-9 rounded-xl w-full max-w-[200px]"
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

      {/* SECCIÓN ESPECIAL: CANCHAS EN JUEGO AHORA (SOLO EN PESTAÑA HOY) */}
      {tabDia === 'hoy' && (
        <Card className="bg-[#18181A] border-[#27272A] rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-3.5 bg-[#141416] border-b border-[#27272A] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">
                Estado Actual de las Canchas (En Juego Ahora)
              </h2>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
              {canchasEnJuegoAhora.length} cancha{canchasEnJuegoAhora.length === 1 ? '' : 's'} en uso
            </Badge>
          </div>

          <CardContent className="p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {canchas.map((cancha) => {
                const turnoActual = canchasEnJuegoAhora.find((t) => t.canchaId === cancha.id);

                if (!turnoActual) {
                  return (
                    <div
                      key={cancha.id}
                      className="bg-[#121214] border border-[#27272A] rounded-xl p-4 flex flex-col justify-between min-h-[110px]"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-[#888888] uppercase">{cancha.nombre}</span>
                        <Badge variant="outline" className="bg-[#202022] text-[#777777] border-[#333] text-[10px]">
                          LIBRE AHORA
                        </Badge>
                      </div>
                      <p className="text-xs text-[#555] italic mt-2">Sin reserva en este horario</p>
                    </div>
                  );
                }

                const esProfe = turnoActual.esProfe;

                return (
                  <div
                    key={cancha.id}
                    className={`rounded-xl p-4 border flex flex-col justify-between min-h-[110px] transition-all shadow-md ${
                      esProfe
                        ? 'bg-amber-500/10 border-amber-500/40 text-amber-100'
                        : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-100'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-black text-sm text-white uppercase">{cancha.nombre}</span>
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 flex items-center gap-1 ${
                            esProfe
                              ? 'bg-amber-500 text-black border-amber-400'
                              : 'bg-emerald-500 text-black border-emerald-400'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping"></span>
                          EN JUEGO
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="font-black text-base text-white flex items-center gap-1.5">
                          {esProfe ? <GraduationCap className="h-4 w-4 text-amber-400 shrink-0" /> : <Users className="h-4 w-4 text-emerald-400 shrink-0" />}
                          <span className="truncate">{turnoActual.titularNombre}</span>
                        </div>
                        {turnoActual.acompanante && (
                          <div className="text-xs text-[#CCCCCC] truncate pl-5">
                            + {turnoActual.acompanante}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#333338] mt-2 text-xs">
                      <span className="font-mono font-bold text-white flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-blue-400" />
                        {turnoActual.horaInicio} - {turnoActual.horaFin} hs
                      </span>
                      {esProfe ? (
                        <span className="text-[11px] font-bold text-amber-400">Clase Profesor</span>
                      ) : (
                        <span className={`text-[11px] font-bold ${turnoActual.validadoQr ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {turnoActual.validadoQr ? '✓ QR Validado' : '⚠ QR Pendiente'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BUSCADOR DE PORTERÍA & FILTROS */}
      <div className="bg-[#18181A] border border-[#27272A] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Buscador Rápido */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="¿Quién llega al portón? Escribí Apellido, DNI o Cancha..."
              className="pl-10 pr-9 h-11 bg-[#121214] border-[#2C2C30] text-white placeholder:text-[#666] focus:border-blue-500 rounded-xl text-sm"
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
                  : 'bg-[#121214] border-[#2C2C30] text-[#888] hover:text-white'
              }`}
            >
              Todos ({turnosActivos.length})
            </Button>

            {tabDia === 'hoy' && (
              <>
                <Button
                  size="sm"
                  variant={filtroTipo === 'en_curso' ? 'default' : 'outline'}
                  onClick={() => setFiltroTipo('en_curso')}
                  className={`rounded-xl text-xs h-9 px-3 gap-1.5 ${
                    filtroTipo === 'en_curso'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#121214] border-[#2C2C30] text-[#888] hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  En Juego ({turnosActivos.filter((t) => t.estadoTiempo === 'en_curso').length})
                </Button>

                <Button
                  size="sm"
                  variant={filtroTipo === 'proximos' ? 'default' : 'outline'}
                  onClick={() => setFiltroTipo('proximos')}
                  className={`rounded-xl text-xs h-9 px-3 gap-1.5 ${
                    filtroTipo === 'proximos'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#121214] border-[#2C2C30] text-[#888] hover:text-white'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  Próximos ({turnosActivos.filter((t) => t.estadoTiempo === 'proximo').length})
                </Button>
              </>
            )}

            <Button
              size="sm"
              variant={filtroTipo === 'socios' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('socios')}
              className={`rounded-xl text-xs h-9 px-3 gap-1.5 ${
                filtroTipo === 'socios'
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#121214] border-[#2C2C30] text-[#888] hover:text-white'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Socios ({turnosActivos.filter((t) => !t.esProfe && t.estado !== 'bloqueado').length})
            </Button>

            <Button
              size="sm"
              variant={filtroTipo === 'profe' ? 'default' : 'outline'}
              onClick={() => setFiltroTipo('profe')}
              className={`rounded-xl text-xs h-9 px-3 gap-1.5 ${
                filtroTipo === 'profe'
                  ? 'bg-amber-600 text-white'
                  : 'bg-[#121214] border-[#2C2C30] text-[#888] hover:text-white'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Profe ({turnosActivos.filter((t) => t.esProfe).length})
            </Button>
          </div>
        </div>

        {/* LISTADO DE TURNOS DE LA FECHA */}
        <div className="space-y-3 pt-2">
          {loading && (
            <div className="py-12 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mx-auto" />
              <p className="text-sm text-[#888]">Cargando turnos de portería...</p>
            </div>
          )}

          {!loading && turnosFiltrados.length === 0 && (
            <div className="py-12 text-center space-y-3 bg-[#121214] rounded-2xl border border-[#27272A] p-6">
              <div className="w-12 h-12 rounded-full bg-[#202024] text-[#666] flex items-center justify-center mx-auto">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-white text-base">No se encontraron turnos</h3>
              <p className="text-xs text-[#777] max-w-sm mx-auto">
                {searchTerm
                  ? `No hay turnos que coincidan con "${searchTerm}". Probá con otro apellido o DNI.`
                  : 'No hay turnos registrados para esta fecha con el filtro seleccionado.'}
              </p>
            </div>
          )}

          {!loading && turnosFiltrados.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {turnosFiltrados.map((t) => {
                const esProfe = t.esProfe;
                const enJuego = t.estadoTiempo === 'en_curso';
                const finalizado = t.estadoTiempo === 'finalizado';

                return (
                  <div
                    key={t.id}
                    className={`rounded-2xl border p-4 sm:p-5 flex flex-col justify-between transition-all shadow-md relative overflow-hidden ${
                      enJuego
                        ? 'bg-[#12241C] border-emerald-500/60 ring-1 ring-emerald-500/40'
                        : finalizado
                        ? 'bg-[#141416] border-[#222225] opacity-65'
                        : esProfe
                        ? 'bg-[#1C1A14] border-amber-500/30 hover:border-amber-500/60'
                        : 'bg-[#151518] border-[#27272A] hover:border-[#38383E]'
                    }`}
                  >
                    {/* Indicador de Cancha y Horario */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`font-black text-xs px-2.5 py-1 uppercase rounded-lg tracking-wider ${
                              enJuego
                                ? 'bg-emerald-500 text-black'
                                : esProfe
                                ? 'bg-amber-400 text-black'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {t.canchaNombre}
                          </Badge>

                          {enJuego && (
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 animate-pulse">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              JUGANDO AHORA
                            </Badge>
                          )}

                          {t.minutosParaInicio !== null && t.minutosParaInicio > 0 && t.minutosParaInicio <= 60 && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                              Llega en {t.minutosParaInicio} min
                            </Badge>
                          )}

                          {finalizado && (
                            <Badge variant="outline" className="bg-[#1C1C20] text-[#777] border-[#333] text-[10px]">
                              Finalizado
                            </Badge>
                          )}
                        </div>

                        <div className="font-mono text-sm font-black text-white flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-[#888]" />
                          {t.horaInicio} - {t.horaFin}
                        </div>
                      </div>

                      {/* Identificación del Jugador o Profe */}
                      <div className="space-y-2">
                        {esProfe ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                              <GraduationCap className="h-4 w-4" />
                              <span>Clase Profesor / Escuela</span>
                            </div>
                            <div className="text-base font-black text-white">
                              {t.titularNombre}
                            </div>
                            {t.motivoBloqueo && t.motivoBloqueo !== t.titularNombre && (
                              <p className="text-xs text-[#999999] italic">{t.motivoBloqueo}</p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="text-xs text-[#777777] uppercase font-bold tracking-wider flex items-center justify-between">
                              <span>Socio Titular</span>
                              {t.titularDni && (
                                <span className="font-mono text-[11px] text-[#999]">DNI: {t.titularDni}</span>
                              )}
                            </div>
                            <div className="text-base font-black text-white">
                              {t.titularNombre}
                            </div>

                            {/* Acompañante / Jugadores */}
                            {t.acompanante && (
                              <div className="bg-[#1A1A1E] rounded-xl p-2.5 border border-[#2B2B30] mt-2">
                                <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block mb-1">
                                  Acompañante / Participante
                                </span>
                                <div className="text-xs font-semibold text-[#E0E0E0] flex items-center gap-1.5">
                                  <Users className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                  <span>{t.acompanante}</span>
                                </div>
                              </div>
                            )}

                            {/* Lista de participantes completos si existen */}
                            {t.participantes.length > 1 && (
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {t.participantes.map((p, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="outline"
                                    className={`text-[10px] px-2 py-0.5 ${
                                      p.haValidadoQR
                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                        : 'bg-[#202024] text-[#AAA] border-[#333]'
                                    }`}
                                  >
                                    {p.nombre} {p.haValidadoQR ? '✓' : ''}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer de la tarjeta con estado de QR y teléfono */}
                    <div className="pt-3.5 border-t border-[#26262B] mt-4 flex items-center justify-between text-xs">
                      {esProfe ? (
                        <div className="text-xs text-amber-400/90 font-medium">
                          No requiere validación QR
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {t.validadoQr ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-xs bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/30">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              QR Validado
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-bold text-xs bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/30">
                              <AlertCircle className="h-3.5 w-3.5" />
                              QR Pendiente
                            </span>
                          )}
                        </div>
                      )}

                      {t.titularTelefono ? (
                        <a
                          href={`tel:${t.titularTelefono}`}
                          className="text-[#888888] hover:text-white flex items-center gap-1 font-mono text-[11px] bg-[#202024] hover:bg-[#2A2A30] px-2 py-1 rounded-md transition-colors"
                          title="Llamar al socio"
                        >
                          <Phone className="h-3 w-3 text-blue-400" />
                          <span>{t.titularTelefono}</span>
                        </a>
                      ) : (
                        <span className="text-[11px] text-[#555] font-mono">Sin tel</span>
                      )}
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
