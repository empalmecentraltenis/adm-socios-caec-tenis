'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CalendarDays,
  Clock,
  Trophy,
  Users,
  Search,
  RefreshCw,
  FileDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MessageCircle,
  BarChart3,
  Calendar,
  Activity,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Radio,
  Filter,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, subMonths, addMonths, addDays, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface CanchaStat {
  id: number;
  nombre: string;
  reservasHistoricas: number;
  reservasMes: number;
  reservasSocios?: number;
  reservasProfe?: number;
  porcentajeMes: number;
}

interface SocioRanking {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  telefono: string;
  categoria: string;
  estado: string;
  reservasMes: number;
  reservasTotales: number;
}

interface InvitadoRanking {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  telefono: string;
  categoria: string;
  reservasInvitado: number;
  superaCupo: boolean;
  invitadosExtras: number;
  extrasPagados?: number;
  extrasPendientes?: number;
  alDia?: boolean;
}

interface ParticipanteMonitor {
  dni: string;
  nombre: string;
  categoria: string;
  telefono: string;
  esTitular: boolean;
  esInvitado: boolean;
  haValidadoQR: boolean;
}

interface TurnoMonitor {
  id: number;
  canchaId: number;
  canchaNombre: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  horario: string;
  esProfe: boolean;
  motivoBloqueo?: string | null;
  tipoPartido: string;
  estadoTurno: 'en_curso' | 'proximo' | 'finalizado';
  titular: {
    dni: string;
    nombre: string;
    telefono: string;
    categoria: string;
  };
  participantes: ParticipanteMonitor[];
  validadoTotal: boolean;
  validadoAt: string | null;
  validadosDnis: string[];
  sancionQrAplicada: boolean;
  qrEstado: 'validado' | 'parcial' | 'pendiente' | 'sin_validar' | 'no_requerido';
  qrLabel: string;
}

interface MonitorData {
  fechaSeleccionada: string;
  fechaHoy: string;
  fechaManana: string;
  horaActual: string;
  kpis: {
    totalTurnosHoy: number;
    turnosSociosHoy: number;
    turnosProfeHoy: number;
    enCursoHoy: number;
    proximosHoy: number;
    completadosHoy: number;
    validadosHoy: number;
    pendientesQRHoy: number;
    totalTurnosManana: number;
    turnosSociosManana: number;
    turnosProfeManana: number;
  };
  turnos: TurnoMonitor[];
}

interface GestionTurnosData {
  periodo: {
    mes: string;
    anio: string;
  };
  kpis: {
    totalReservasHistoricas: number;
    reservasMesActual: number;
    reservasSociosMesActual?: number;
    reservasProfeMesActual?: number;
    porcentajeSociosMes?: number;
    porcentajeProfeMes?: number;
    reservasAnioActual: number;
    topHorario: string;
    topHorarioMes: string;
    validadosMes: number;
    noValidadosMes: number;
    tasaValidacion: number;
  };
  canchasStats: CanchaStat[];
  rankingSocios: SocioRanking[];
  rankingInvitado: InvitadoRanking[];
  monitor?: MonitorData;
}

type VistaPrincipal = 'monitor' | 'mensual';
type FiltroMonitor = 'todos' | 'en_curso' | 'proximos' | 'finalizados' | 'socios' | 'profe' | 'atencion_qr';

export default function GestionTurnosPanel({ readOnly }: { readOnly?: boolean }) {
  // Selector de vista principal
  const [vistaPrincipal, setVistaPrincipal] = useState<VistaPrincipal>('monitor');

  // Estado para vista mensual
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<'socios' | 'invitados'>('socios');
  const [searchTermMensual, setSearchTermMensual] = useState<string>('');

  // Estado para Monitor en Vivo
  const getTodayLocalDateStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [fechaMonitor, setFechaMonitor] = useState<string>(getTodayLocalDateStr());
  const [filtroMonitor, setFiltroMonitor] = useState<FiltroMonitor>('todos');
  const [searchTermMonitor, setSearchTermMonitor] = useState<string>('');

  // Datos del backend
  const [data, setData] = useState<GestionTurnosData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const mesStr = format(currentDate, 'yyyy-MM');
  const anioStr = format(currentDate, 'yyyy');
  const mesNombre = format(currentDate, 'MMMM yyyy', { locale: es });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gestion-turnos?mes=${mesStr}&anio=${anioStr}&fecha=${fechaMonitor}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error al cargar datos de Gestión Turnos:', err);
    } finally {
      setLoading(false);
    }
  }, [mesStr, anioStr, fechaMonitor]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Manejo de fechas para vista mensual
  const handlePrevMonth = () => {
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  // Helper WhatsApp
  const formatWhatsappLink = (telefono?: string, socioNombre?: string) => {
    if (!telefono) return null;
    let clean = telefono.replace(/\D/g, '');
    if (!clean.startsWith('54') && clean.length === 10) {
      clean = '549' + clean;
    } else if (clean.startsWith('54') && !clean.startsWith('549')) {
      clean = '549' + clean.slice(2);
    }
    const msg = encodeURIComponent(`Hola ${socioNombre || ''}, te escribimos desde la Subcomisión de Tenis del CAEC.`);
    return `https://wa.me/${clean}?text=${msg}`;
  };

  // --- FILTRADO DE MONITOR EN VIVO ---
  const fechaHoyStr = data?.monitor?.fechaHoy || getTodayLocalDateStr();
  const fechaMananaStr = data?.monitor?.fechaManana || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  })();

  const fechaSeleccionadaNombre = useMemo(() => {
    try {
      if (!fechaMonitor) return '';
      if (fechaMonitor === fechaHoyStr) return 'Hoy';
      if (fechaMonitor === fechaMananaStr) return 'Mañana';
      const parts = fechaMonitor.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return format(d, "EEEE d 'de' MMMM", { locale: es });
      }
      return fechaMonitor;
    } catch {
      return fechaMonitor;
    }
  }, [fechaMonitor, fechaHoyStr, fechaMananaStr]);

  const turnosMonitorFiltrados = useMemo(() => {
    if (!data?.monitor?.turnos) return [];
    let list = [...data.monitor.turnos];

    // Filtro por estado
    if (filtroMonitor === 'en_curso') {
      list = list.filter((t) => t.estadoTurno === 'en_curso');
    } else if (filtroMonitor === 'proximos') {
      list = list.filter((t) => t.estadoTurno === 'proximo');
    } else if (filtroMonitor === 'finalizados') {
      list = list.filter((t) => t.estadoTurno === 'finalizado');
    } else if (filtroMonitor === 'socios') {
      list = list.filter((t) => !t.esProfe);
    } else if (filtroMonitor === 'profe') {
      list = list.filter((t) => t.esProfe);
    } else if (filtroMonitor === 'atencion_qr') {
      // Turnos en curso o finalizados que no están validados y no son de profe
      list = list.filter(
        (t) => !t.esProfe && !t.validadoTotal && (t.estadoTurno === 'en_curso' || t.estadoTurno === 'finalizado')
      );
    }

    // Búsqueda libre
    if (searchTermMonitor.trim()) {
      const term = searchTermMonitor.toLowerCase().trim();
      list = list.filter((t) => {
        const titularMatch =
          t.titular.nombre.toLowerCase().includes(term) ||
          t.titular.dni.includes(term);
        const canchaMatch = t.canchaNombre.toLowerCase().includes(term);
        const horarioMatch = t.horario.toLowerCase().includes(term);
        const participanteMatch = t.participantes.some(
          (p) => p.nombre.toLowerCase().includes(term) || p.dni.includes(term)
        );
        const motivoMatch = (t.motivoBloqueo || '').toLowerCase().includes(term);
        return titularMatch || canchaMatch || horarioMatch || participanteMatch || motivoMatch;
      });
    }

    return list;
  }, [data?.monitor?.turnos, filtroMonitor, searchTermMonitor]);

  // Exportar Excel del Día (Monitor)
  const handleExportMonitorExcel = () => {
    if (!data?.monitor?.turnos) return;

    const rows = data.monitor.turnos.map((t) => ({
      Fecha: t.fecha,
      Horario: t.horario,
      Cancha: t.canchaNombre,
      Tipo: t.tipoPartido,
      Titular: t.titular.nombre,
      'DNI Titular': t.titular.dni || '-',
      'Teléfono Titular': t.titular.telefono || '-',
      Participantes: t.participantes.map((p) => `${p.nombre} (${p.dni || 'Sin DNI'})${p.haValidadoQR ? ' [QR OK]' : ' [Pendiente]'}`).join('; '),
      'Estado Turno': t.estadoTurno === 'en_curso' ? 'En Juego' : t.estadoTurno === 'proximo' ? 'Próximo' : 'Finalizado',
      'Validación QR': t.qrLabel,
      'Validado Total': t.validadoTotal ? 'SI' : 'NO',
      'Es Clase Profe': t.esProfe ? 'SI' : 'NO',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Turnos del Día');
    XLSX.writeFile(wb, `Turnos_CAEC_${fechaMonitor}.xlsx`);
  };

  // --- FILTRADO DE RANKINGS MENSUALES ---
  const sociosFiltrados = useMemo(() => {
    if (!data?.rankingSocios) return [];
    if (!searchTermMensual.trim()) return data.rankingSocios;
    const term = searchTermMensual.toLowerCase().trim();
    return data.rankingSocios.filter(
      (s) =>
        s.nombreCompleto.toLowerCase().includes(term) ||
        s.dni.includes(term) ||
        (s.telefono && s.telefono.includes(term))
    );
  }, [data?.rankingSocios, searchTermMensual]);

  const invitadosFiltrados = useMemo(() => {
    if (!data?.rankingInvitado) return [];
    if (!searchTermMensual.trim()) return data.rankingInvitado;
    const term = searchTermMensual.toLowerCase().trim();
    return data.rankingInvitado.filter(
      (s) =>
        s.nombreCompleto.toLowerCase().includes(term) ||
        s.dni.includes(term) ||
        (s.telefono && s.telefono.includes(term))
    );
  }, [data?.rankingInvitado, searchTermMensual]);

  // Exportar Excel Mensual
  const handleExportMensualExcel = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();

    // Hoja 1: Ranking Socios
    const sociosRows = data.rankingSocios.map((s, idx) => ({
      '#': idx + 1,
      Socio: s.nombreCompleto,
      DNI: s.dni,
      Teléfono: s.telefono || '-',
      Categoría: s.categoria,
      [`Reservas ${mesNombre}`]: s.reservasMes,
      'Reservas Históricas': s.reservasTotales,
    }));
    const wsSocios = XLSX.utils.json_to_sheet(sociosRows);
    XLSX.utils.book_append_sheet(wb, wsSocios, 'Uso por Socios');

    // Hoja 2: Ranking Invitados
    const invitadosRows = data.rankingInvitado.map((s, idx) => ({
      '#': idx + 1,
      Socio: s.nombreCompleto,
      DNI: s.dni,
      Teléfono: s.telefono || '-',
      [`Invitados Año ${anioStr}`]: s.reservasInvitado,
      'Cupo Bonificado (4)': s.reservasInvitado <= 4 ? 'Bonificado' : 'Superado',
      'Invitados Extras a Cobrar': s.invitadosExtras,
    }));
    const wsInvitados = XLSX.utils.json_to_sheet(invitadosRows);
    XLSX.utils.book_append_sheet(wb, wsInvitados, 'Uso de Invitados');

    XLSX.writeFile(wb, `Gestion_Turnos_${mesStr}.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* NAVEGACIÓN SUPERIOR ENTRE VISTAS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-2.5 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-xl">
          <Button
            variant={vistaPrincipal === 'monitor' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setVistaPrincipal('monitor')}
            className={`text-xs font-bold gap-2 h-9 px-4 rounded-lg transition-all ${
              vistaPrincipal === 'monitor' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Radio className={`h-4 w-4 ${vistaPrincipal === 'monitor' ? 'text-white animate-pulse' : ''}`} />
            <span>Monitor en Vivo / Del Día</span>
            {data?.monitor?.kpis.enCursoHoy ? (
              <Badge className="bg-emerald-500 text-white font-extrabold text-[10px] px-1.5 py-0 h-4 ml-1">
                {data.monitor.kpis.enCursoHoy} en juego
              </Badge>
            ) : null}
          </Button>

          <Button
            variant={vistaPrincipal === 'mensual' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setVistaPrincipal('mensual')}
            className={`text-xs font-bold gap-2 h-9 px-4 rounded-lg transition-all ${
              vistaPrincipal === 'mensual' ? 'shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>Métricas y Rankings Mensuales</span>
          </Button>
        </div>

        {/* Acciones globales */}
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </Button>

          {vistaPrincipal === 'monitor' ? (
            <Button
              variant="default"
              size="sm"
              onClick={handleExportMonitorExcel}
              disabled={loading || !data?.monitor}
              className="text-xs gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Exportar Día</span>
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handleExportMensualExcel}
              disabled={loading || !data}
              className="text-xs gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <FileDown className="h-3.5 w-3.5" />
              <span>Exportar Mes</span>
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* VISTA 1: MONITOR EN VIVO Y CONTROL OPERATIVO DEL DÍA     */}
      {/* ========================================================= */}
      {vistaPrincipal === 'monitor' && (
        <div className="space-y-6">
          {/* BARRA DE FECHA DEL MONITOR */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={fechaMonitor === fechaHoyStr ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFechaMonitor(fechaHoyStr)}
                className="text-xs font-bold h-9"
              >
                <span>Hoy</span>
                <span className="ml-1.5 opacity-75 text-[10px]">
                  ({data?.monitor?.kpis.totalTurnosHoy ?? 0})
                </span>
              </Button>

              <Button
                variant={fechaMonitor === fechaMananaStr ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFechaMonitor(fechaMananaStr)}
                className="text-xs font-bold h-9"
              >
                <span>Mañana</span>
                <span className="ml-1.5 opacity-75 text-[10px]">
                  ({data?.monitor?.kpis.totalTurnosManana ?? 0})
                </span>
              </Button>

              {/* Selector nativo de fecha */}
              <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-lg border">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="date"
                  value={fechaMonitor}
                  onChange={(e) => {
                    if (e.target.value) setFechaMonitor(e.target.value);
                  }}
                  className="bg-transparent text-xs font-medium text-foreground outline-none cursor-pointer"
                />
              </div>

              <div className="px-3 py-1.5 bg-primary/10 text-primary font-bold text-xs rounded-lg border border-primary/20 capitalize">
                {fechaSeleccionadaNombre}
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span>Hora actual: <strong className="text-foreground">{data?.monitor?.horaActual || '--:--'} hs</strong></span>
            </div>
          </div>

          {/* 4 KPIS EN VIVO DEL MONITOR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Turnos de Hoy */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Turnos de Hoy
                </CardTitle>
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <CalendarDays className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black text-foreground">
                        {data?.monitor?.kpis.totalTurnosHoy ?? 0}
                      </p>
                      <span className="text-xs text-muted-foreground font-medium">turnos de hoy</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50">
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-1.5 text-center">
                        <span className="text-[10px] text-primary/80 block font-bold">🎾 SOCIOS</span>
                        <span className="text-base font-black text-foreground">{data?.monitor?.kpis.turnosSociosHoy ?? 0}</span>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5 text-center">
                        <span className="text-[10px] text-amber-500 block font-bold">🎓 CLASES PROFE</span>
                        <span className="text-base font-black text-amber-400">{data?.monitor?.kpis.turnosProfeHoy ?? 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KPI 2: En Cancha Ahora & Próximos */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  En Cancha y Próximos
                </CardTitle>
                <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <Activity className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                      </span>
                      <p className="text-3xl font-black text-emerald-500">
                        {data?.monitor?.kpis.enCursoHoy ?? 0}
                      </p>
                      <span className="text-xs font-semibold text-emerald-400">en juego ahora</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                      <span>⏳ Próximos: <strong className="text-foreground">{data?.monitor?.kpis.proximosHoy ?? 0}</strong></span>
                      <span>⚪ Completados: <strong className="text-foreground">{data?.monitor?.kpis.completadosHoy ?? 0}</strong></span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KPI 3: Validación QR del Día */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Validación QR Hoy
                </CardTitle>
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  <QrCode className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black text-foreground">
                        {data?.monitor?.kpis.validadosHoy ?? 0}
                      </p>
                      <span className="text-xs text-muted-foreground font-medium">validados con QR</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                      <span>
                        ⚠️ Pendientes:{' '}
                        <strong className={((data?.monitor?.kpis.pendientesQRHoy ?? 0) > 0) ? 'text-amber-400 font-bold' : 'text-foreground'}>
                          {data?.monitor?.kpis.pendientesQRHoy ?? 0}
                        </strong>
                      </span>
                      <span>
                        Tasa:{' '}
                        <strong className="text-foreground">
                          {data?.monitor?.kpis.totalTurnosHoy
                            ? Math.round(((data.monitor.kpis.validadosHoy) / (data.monitor.kpis.turnosSociosHoy || 1)) * 100)
                            : 100}
                          %
                        </strong>
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KPI 4: Reservas Programadas Mañana */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Reservas Mañana
                </CardTitle>
                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                  <Clock className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black text-purple-400">
                        {data?.monitor?.kpis.totalTurnosManana ?? 0}
                      </p>
                      <span className="text-xs text-muted-foreground font-medium">turnos mañana</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border/50">
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-1.5 text-center">
                        <span className="text-[10px] text-primary/80 block font-bold">🎾 SOCIOS</span>
                        <span className="text-base font-black text-foreground">{data?.monitor?.kpis.turnosSociosManana ?? 0}</span>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5 text-center">
                        <span className="text-[10px] text-amber-500 block font-bold">🎓 CLASES PROFE</span>
                        <span className="text-base font-black text-amber-400">{data?.monitor?.kpis.turnosProfeManana ?? 0}</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* LISTADO DE TURNOS DEL DÍA CON FILTROS */}
          <Card className="border-border">
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Radio className="h-4 w-4 text-primary" />
                      <span>Turnos del Día ({turnosMonitorFiltrados.length})</span>
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Detalle de canchas, horarios, jugadores asignados y estado de escaneo de QR
                    </CardDescription>
                  </div>

                  {/* Buscador */}
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por socio, DNI o cancha..."
                      value={searchTermMonitor}
                      onChange={(e) => setSearchTermMonitor(e.target.value)}
                      className="pl-9 h-9 text-xs bg-muted/40"
                    />
                  </div>
                </div>

                {/* Filtros rápidos en pastillas */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/40">
                  <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1 mr-1">
                    <Filter className="h-3 w-3" /> Filtrar:
                  </span>

                  <Button
                    variant={filtroMonitor === 'todos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroMonitor('todos')}
                    className="text-xs h-7 px-2.5 rounded-full"
                  >
                    Todos ({data?.monitor?.turnos.length ?? 0})
                  </Button>

                  <Button
                    variant={filtroMonitor === 'en_curso' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroMonitor('en_curso')}
                    className="text-xs h-7 px-2.5 rounded-full gap-1 border-emerald-500/30 text-emerald-500"
                  >
                    <span>🟢 En Juego</span>
                    <span className="text-[10px] opacity-75">
                      ({data?.monitor?.turnos.filter((t) => t.estadoTurno === 'en_curso').length ?? 0})
                    </span>
                  </Button>

                  <Button
                    variant={filtroMonitor === 'proximos' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroMonitor('proximos')}
                    className="text-xs h-7 px-2.5 rounded-full gap-1 text-blue-400 border-blue-500/30"
                  >
                    <span>⏳ Próximos</span>
                    <span className="text-[10px] opacity-75">
                      ({data?.monitor?.turnos.filter((t) => t.estadoTurno === 'proximo').length ?? 0})
                    </span>
                  </Button>

                  <Button
                    variant={filtroMonitor === 'finalizados' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroMonitor('finalizados')}
                    className="text-xs h-7 px-2.5 rounded-full gap-1 text-zinc-400"
                  >
                    <span>⚪ Finalizados</span>
                    <span className="text-[10px] opacity-75">
                      ({data?.monitor?.turnos.filter((t) => t.estadoTurno === 'finalizado').length ?? 0})
                    </span>
                  </Button>

                  <Button
                    variant={filtroMonitor === 'socios' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroMonitor('socios')}
                    className="text-xs h-7 px-2.5 rounded-full gap-1"
                  >
                    <span>🎾 Solo Socios</span>
                    <span className="text-[10px] opacity-75">
                      ({data?.monitor?.turnos.filter((t) => !t.esProfe).length ?? 0})
                    </span>
                  </Button>

                  <Button
                    variant={filtroMonitor === 'profe' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroMonitor('profe')}
                    className="text-xs h-7 px-2.5 rounded-full gap-1 text-amber-400 border-amber-500/30"
                  >
                    <span>🎓 Clases Profe</span>
                    <span className="text-[10px] opacity-75">
                      ({data?.monitor?.turnos.filter((t) => t.esProfe).length ?? 0})
                    </span>
                  </Button>

                  <Button
                    variant={filtroMonitor === 'atencion_qr' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFiltroMonitor('atencion_qr')}
                    className="text-xs h-7 px-2.5 rounded-full gap-1 text-destructive border-destructive/30"
                  >
                    <span>⚠️ Atención QR</span>
                    <span className="text-[10px] opacity-75">
                      ({data?.monitor?.turnos.filter((t) => !t.esProfe && !t.validadoTotal && (t.estadoTurno === 'en_curso' || t.estadoTurno === 'finalizado')).length ?? 0})
                    </span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </div>
              ) : turnosMonitorFiltrados.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground space-y-2">
                  <Calendar className="h-8 w-8 mx-auto opacity-40" />
                  <p className="font-semibold text-sm">No se encontraron turnos con los filtros seleccionados</p>
                  <p className="text-xs opacity-75">
                    Probá cambiando la fecha o limpiando el texto de búsqueda.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-36 text-xs font-bold">Horario</TableHead>
                        <TableHead className="w-28 text-xs font-bold">Cancha</TableHead>
                        <TableHead className="text-xs font-bold">Titular y Tipo</TableHead>
                        <TableHead className="text-xs font-bold">Jugadores y Escaneo QR</TableHead>
                        <TableHead className="w-40 text-center text-xs font-bold">Estado QR</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {turnosMonitorFiltrados.map((turno) => {
                        const isEnJuego = turno.estadoTurno === 'en_curso';
                        const isProximo = turno.estadoTurno === 'proximo';
                        const waLink = formatWhatsappLink(turno.titular.telefono, turno.titular.nombre);

                        return (
                          <TableRow
                            key={turno.id}
                            className={`transition-colors ${
                              isEnJuego
                                ? 'bg-emerald-500/5 hover:bg-emerald-500/10 border-l-4 border-l-emerald-500'
                                : 'hover:bg-muted/40'
                            }`}
                          >
                            {/* Horario y Estado de tiempo */}
                            <TableCell className="align-top py-3.5">
                              <div className="space-y-1">
                                <span className="font-black text-sm text-foreground block">
                                  {turno.horaInicio} - {turno.horaFin} hs
                                </span>
                                {isEnJuego && (
                                  <Badge className="bg-emerald-500 text-white font-black text-[10px] px-2 py-0 animate-pulse border-none">
                                    🟢 En Juego
                                  </Badge>
                                )}
                                {isProximo && (
                                  <Badge variant="outline" className="text-blue-400 border-blue-400/40 text-[10px] px-2 py-0">
                                    ⏳ Por Iniciar
                                  </Badge>
                                )}
                                {turno.estadoTurno === 'finalizado' && (
                                  <Badge variant="secondary" className="text-zinc-400 text-[10px] px-2 py-0">
                                    ⚪ Finalizado
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            {/* Cancha */}
                            <TableCell className="align-top py-3.5">
                              <Badge
                                variant="outline"
                                className={`font-bold text-xs ${
                                  turno.canchaId === 1
                                    ? 'border-blue-500/40 text-blue-400 bg-blue-500/5'
                                    : 'border-orange-500/40 text-orange-400 bg-orange-500/5'
                                }`}
                              >
                                {turno.canchaNombre}
                              </Badge>
                            </TableCell>

                            {/* Titular y Tipo */}
                            <TableCell className="align-top py-3.5">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  {turno.esProfe ? (
                                    <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold">
                                      🎓 Clase Profe
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] font-semibold">
                                      🎾 {turno.tipoPartido}
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-bold text-sm text-foreground">
                                  {turno.titular.nombre}
                                </p>
                                {turno.titular.dni && (
                                  <p className="text-xs text-muted-foreground">
                                    DNI: {turno.titular.dni}
                                  </p>
                                )}
                              </div>
                            </TableCell>

                            {/* Jugadores y Validación QR Individual */}
                            <TableCell className="align-top py-3.5">
                              <div className="space-y-1.5">
                                <div className="flex flex-wrap gap-1.5">
                                  {turno.participantes.map((p, pIdx) => {
                                    if (p.esInvitado) {
                                      return (
                                        <span
                                          key={pIdx}
                                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                            p.haValidadoQR
                                              ? 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                                              : 'bg-muted/70 text-purple-300 border-purple-500/20'
                                          }`}
                                        >
                                          <Sparkles className="h-3 w-3 text-purple-400" />
                                          <span>Invitado Especial</span>
                                          {p.haValidadoQR ? (
                                            <CheckCircle2 className="h-3 w-3 text-emerald-400 ml-0.5" />
                                          ) : null}
                                        </span>
                                      );
                                    }

                                    return (
                                      <span
                                        key={pIdx}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                          p.haValidadoQR
                                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold'
                                            : 'bg-muted/50 text-muted-foreground border-border/60'
                                        }`}
                                      >
                                        {p.haValidadoQR ? (
                                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                        ) : (
                                          <Clock className="h-3 w-3 text-muted-foreground" />
                                        )}
                                        <span>{p.nombre}</span>
                                        {p.dni ? (
                                          <span className="opacity-70 text-[10px]">({p.dni})</span>
                                        ) : null}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </TableCell>

                            {/* Estado General de QR */}
                            <TableCell className="align-top py-3.5 text-center">
                              {turno.qrEstado === 'validado' ? (
                                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-extrabold text-[11px] gap-1 px-2.5 py-1">
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                  <span>{turno.qrLabel}</span>
                                </Badge>
                              ) : turno.qrEstado === 'parcial' ? (
                                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold text-[11px] gap-1 px-2 py-1">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  <span>{turno.qrLabel}</span>
                                </Badge>
                              ) : turno.qrEstado === 'sin_validar' ? (
                                <Badge className="bg-destructive/15 text-destructive border border-destructive/30 font-bold text-[11px] gap-1 px-2 py-1">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  <span>Sin Validar</span>
                                </Badge>
                              ) : turno.qrEstado === 'no_requerido' ? (
                                <Badge variant="outline" className="text-muted-foreground text-[11px] font-medium px-2 py-1">
                                  No Requiere (Profe)
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] font-semibold gap-1 px-2 py-1 ${
                                    isEnJuego
                                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                                      : 'text-muted-foreground'
                                  }`}
                                >
                                  <Clock className="h-3 w-3" />
                                  <span>{turno.qrLabel}</span>
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 2: MÉTRICAS Y RANKINGS MENSUALES (HISTÓRICO)        */}
      {/* ========================================================= */}
      {vistaPrincipal === 'mensual' && (
        <div className="space-y-6">
          {/* Selector de Período y Acciones Mensuales */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevMonth}
                className="h-9 w-9"
                title="Mes anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="px-3 py-1.5 bg-muted rounded-lg font-bold text-sm text-foreground capitalize min-w-[170px] text-center border">
                {mesNombre}
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={handleNextMonth}
                className="h-9 w-9"
                title="Mes siguiente"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCurrentMonth}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mes actual
              </Button>
            </div>

            <div className="text-xs text-muted-foreground">
              Total reservas año {anioStr}: <strong className="text-foreground">{data?.kpis.reservasAnioActual || 0}</strong>
            </div>
          </div>

          {/* 4 KPI Cards Mensuales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Turnos de Socios */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Turnos de Socios
                </CardTitle>
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <Users className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <p className="text-2xl font-black text-foreground">
                      {data?.kpis.reservasSociosMesActual ?? data?.kpis.reservasMesActual ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {data?.kpis.porcentajeSociosMes ?? 100}% del mes • Turnos jugados por socios
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KPI 2: Clases Profesor / Alumnos */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Clases Profe / Alumnos
                </CardTitle>
                <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                  <Trophy className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <p className="text-2xl font-black text-amber-400">
                      {data?.kpis.reservasProfeMesActual ?? 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {data?.kpis.porcentajeProfeMes ?? 0}% del mes • Clases escuela y profesor
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KPI 3: Total Ocupación Mes */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Total Ocupación Mes
                </CardTitle>
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  <CalendarDays className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <p className="text-2xl font-black text-foreground">
                      {data?.kpis.reservasMesActual || 0}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Socios + Clases • Total {data?.periodo.anio}: {data?.kpis.reservasAnioActual || 0}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* KPI 4: Horario Pico */}
            <Card className="border-border">
              <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Horario Más Usado
                </CardTitle>
                <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
                  <Clock className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div>
                    <p className="text-xl font-black text-foreground truncate">
                      {data?.kpis.topHorarioMes || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Hora pico histórica: {data?.kpis.topHorario || 'N/A'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Ocupación por Canchas */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>Ocupación por Canchas en {mesNombre}</span>
              </CardTitle>
              <CardDescription>
                Distribución de turnos reservados por cada cancha habilitada (Socios vs Clases Profesor)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {data?.canchasStats.map((cancha) => (
                    <div
                      key={cancha.id}
                      className="p-4 rounded-xl border bg-muted/30 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-foreground text-sm">{cancha.nombre}</h4>
                          <p className="text-xs text-muted-foreground">
                            Histórico: {cancha.reservasHistoricas} turnos
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs font-bold">
                          {cancha.porcentajeMes}% del mes
                        </Badge>
                      </div>

                      <div>
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-xs text-muted-foreground font-medium">Total turnos mes</span>
                          <span className="text-lg font-black text-primary">{cancha.reservasMes}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-primary h-2.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(100, cancha.porcentajeMes)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 mt-2 border-t border-border/40">
                          <span>🎾 Socios: <strong className="text-foreground">{cancha.reservasSocios ?? '-'}</strong></span>
                          <span>🎓 Clases Profe: <strong className="text-amber-400 font-bold">{cancha.reservasProfe ?? '-'}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabs y Rankings */}
          <Card className="border-border">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex items-center p-1 bg-muted rounded-xl gap-1">
                  <Button
                    variant={activeTab === 'socios' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('socios')}
                    className="text-xs font-bold gap-1.5 h-8"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span>Uso por Socios ({data?.rankingSocios.length || 0})</span>
                  </Button>
                  <Button
                    variant={activeTab === 'invitados' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveTab('invitados')}
                    className="text-xs font-bold gap-1.5 h-8"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Uso de Invitados ({data?.rankingInvitado.length || 0})</span>
                  </Button>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar socio por nombre, DNI..."
                    value={searchTermMensual}
                    onChange={(e) => setSearchTermMensual(e.target.value)}
                    className="pl-9 h-8 text-xs bg-muted/40"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="space-y-2 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : activeTab === 'socios' ? (
                sociosFiltrados.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No se encontraron socios con reservas en este período.
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-12 text-center text-xs font-bold">#</TableHead>
                          <TableHead className="text-xs font-bold">Socio</TableHead>
                          <TableHead className="text-xs font-bold">DNI</TableHead>
                          <TableHead className="text-xs font-bold">Categoría</TableHead>
                          <TableHead className="text-center text-xs font-bold text-primary">
                            Turnos en {mesNombre}
                          </TableHead>
                          <TableHead className="text-center text-xs font-bold">
                            Turnos Totales
                          </TableHead>
                          <TableHead className="text-right text-xs font-bold">Contacto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sociosFiltrados.map((s, idx) => {
                          const waLink = formatWhatsappLink(s.telefono, s.nombre);
                          return (
                            <TableRow key={s.id || s.dni} className="hover:bg-muted/40 transition-colors">
                              <TableCell className="text-center font-bold text-xs text-muted-foreground">
                                {idx === 0 ? (
                                  <span className="text-amber-500 font-black">🥇 1</span>
                                ) : idx === 1 ? (
                                  <span className="text-zinc-400 font-black">🥈 2</span>
                                ) : idx === 2 ? (
                                  <span className="text-amber-700 font-black">🥉 3</span>
                                ) : (
                                  idx + 1
                                )}
                              </TableCell>
                              <TableCell>
                                <span className="font-bold text-sm text-foreground">
                                  {s.nombreCompleto}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{s.dni}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px] uppercase">
                                  {s.categoria}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <span className="font-extrabold text-sm text-primary">
                                  {s.reservasMes}
                                </span>
                              </TableCell>
                              <TableCell className="text-center text-xs text-muted-foreground font-semibold">
                                {s.reservasTotales}
                              </TableCell>
                              <TableCell className="text-right">
                                {waLink ? (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 hover:underline"
                                    title="Contactar por WhatsApp"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    <span>WhatsApp</span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              ) : (
                invitadosFiltrados.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    No se registraron turnos con Invitado Especial en el año {anioStr}.
                  </div>
                ) : (
                  <div className="rounded-xl border overflow-hidden">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-12 text-center text-xs font-bold">#</TableHead>
                          <TableHead className="text-xs font-bold">Socio</TableHead>
                          <TableHead className="text-xs font-bold">DNI</TableHead>
                          <TableHead className="text-center text-xs font-bold text-primary">
                            Invitados en {anioStr}
                          </TableHead>
                          <TableHead className="text-center text-xs font-bold">Estado Cupo</TableHead>
                          <TableHead className="text-center text-xs font-bold">Extras a Cobrar</TableHead>
                          <TableHead className="text-right text-xs font-bold">Contacto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invitadosFiltrados.map((s, idx) => {
                          const waLink = formatWhatsappLink(s.telefono, s.nombre);
                          return (
                            <TableRow key={s.id || s.dni} className="hover:bg-muted/40 transition-colors">
                              <TableCell className="text-center font-bold text-xs text-muted-foreground">
                                {idx + 1}
                              </TableCell>
                              <TableCell>
                                <span className="font-bold text-sm text-foreground">
                                  {s.nombreCompleto}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{s.dni}</TableCell>
                              <TableCell className="text-center">
                                <span className="font-extrabold text-sm text-foreground">
                                  {s.reservasInvitado}
                                </span>
                              </TableCell>
                              <TableCell className="text-center">
                                {s.superaCupo ? (
                                  s.extrasPendientes === 0 ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold">
                                      ✓ Extras al día
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-bold">
                                      Superó cupo bonificado
                                    </Badge>
                                  )
                                ) : (
                                  <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold">
                                    Dentro de los 4 anuales
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                {s.invitadosExtras > 0 ? (
                                  s.extrasPendientes === 0 ? (
                                    <span className="font-bold text-emerald-500 text-xs">
                                      ✓ {s.invitadosExtras} pagado{s.invitadosExtras > 1 ? 's' : ''}
                                    </span>
                                  ) : (
                                    <span className="font-black text-amber-500 text-sm">
                                      {s.extrasPendientes ?? s.invitadosExtras} ($ extra)
                                    </span>
                                  )
                                ) : (
                                  <span className="text-xs text-muted-foreground font-medium">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {waLink ? (
                                  <a
                                    href={waLink}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 hover:underline"
                                    title="Contactar por WhatsApp"
                                  >
                                    <MessageCircle className="h-3.5 w-3.5" />
                                    <span>WhatsApp</span>
                                  </a>
                                ) : (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
