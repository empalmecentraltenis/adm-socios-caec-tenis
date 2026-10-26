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
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UserPlus,
  Users,
  DollarSign,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Download,
  Search,
  Settings2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Ticket,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatInputCurrency, parseCurrency } from '@/lib/formatters';
import { exportInvitadosPDF, exportInvitadosExcel } from '@/lib/invitados-export';

interface SocioInvitadoAcumulado {
  dni: string;
  nombreCompleto: string;
  telefono?: string;
  totalInvitadosAnio: number;
  cupoGratisAnual: number;
  invitadosGratisUsadosAnio?: number;
  invitadosGratisRestantes: number;
  totalExtrasAnio?: number;
  turnosEnPeriodo: number;
  invitadosEnPeriodo: number;
  invitadosGratisPeriodo: number;
  invitadosCobradosPeriodo: number;
  precioUnitarioExtra: number;
  totalACobrar: number;
  turnosDetalle: Array<{
    id: string;
    fecha: string;
    horario: string;
    canchaNombre: string;
    modalidad: string;
    cantidadInvitados: number;
    invitadosGratis: number;
    invitadosCobrados: number;
    cargoTurno: number;
    ordenInvitacionesAnual: string;
    textoCupo?: string;
  }>;
}

interface TurnoInvitadoItem {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  horario: string;
  canchaId: number;
  canchaNombre: string;
  modalidad: string;
  titular: {
    dni: string;
    nombre: string;
  };
  jugadores: Array<{
    nombre: string;
    esInvitado: boolean;
    esTitular: boolean;
  }>;
  cantidadInvitados: number;
  invitadosGratis: number;
  invitadosCobrados: number;
  cargoTurno: number;
  ordenInvitacionesAnual: string;
  textoCupo?: string;
}

interface ApiResponse {
  periodo: {
    tipo: 'mes' | 'semana' | 'dia' | 'anio';
    desde: string;
    hasta: string;
    anio: number;
  };
  tarifas: {
    precioInvitadoExtra: number;
    cupoInvitadosAnual: number;
  };
  kpis: {
    totalRecaudacion: number;
    totalTurnosConInvitados: number;
    totalInvitadosPeriodo: number;
    totalInvitadosGratis: number;
    totalInvitadosCobrados: number;
    sociosConCargo: number;
    totalSociosParticipantes: number;
  };
  turnos: TurnoInvitadoItem[];
  sociosAcumulado: SocioInvitadoAcumulado[];
}

interface InvitadosPanelProps {
  readOnly?: boolean;
}

export default function InvitadosPanel({ readOnly = false }: InvitadosPanelProps) {
  const { toast } = useToast();

  const [periodoTipo, setPeriodoTipo] = useState<'mes' | 'semana' | 'dia' | 'anio'>('mes');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [searchSocio, setSearchSocio] = useState<string>('');
  const [vista, setVista] = useState<'acumulado' | 'detalle'>('acumulado');
  const [expandedSocioId, setExpandedSocioId] = useState<string | null>(null);

  // Modal para edición de tarifas de invitados
  const [editTarifasOpen, setEditTarifasOpen] = useState<boolean>(false);
  const [inputPrecioExtra, setInputPrecioExtra] = useState<string>('10000');
  const [inputCupoAnual, setInputCupoAnual] = useState<string>('4');
  const [savingTarifas, setSavingTarifas] = useState<boolean>(false);

  // Calcular fechas desde/hasta y etiqueta del período
  const { desdeStr, hastaStr, periodoLabel } = useMemo(() => {
    if (periodoTipo === 'dia') {
      const dStr = format(currentDate, 'yyyy-MM-dd');
      const label = format(currentDate, "EEEE d 'de' MMMM, yyyy", { locale: es });
      return { desdeStr: dStr, hastaStr: dStr, periodoLabel: label };
    }

    if (periodoTipo === 'semana') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      const dStr = format(start, 'yyyy-MM-dd');
      const hStr = format(end, 'yyyy-MM-dd');
      const label = `Semana del ${format(start, 'd')} al ${format(end, "d 'de' MMMM, yyyy", { locale: es })}`;
      return { desdeStr: dStr, hastaStr: hStr, periodoLabel: label };
    }

    if (periodoTipo === 'anio') {
      const yearStr = format(currentDate, 'yyyy');
      return {
        desdeStr: `${yearStr}-01-01`,
        hastaStr: `${yearStr}-12-31`,
        periodoLabel: `Año Completo ${yearStr}`,
      };
    }

    // Mes
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const dStr = format(start, 'yyyy-MM-dd');
    const hStr = format(end, 'yyyy-MM-dd');
    const label = `${format(currentDate, 'MMMM yyyy', { locale: es })}`;
    return { desdeStr: dStr, hastaStr: hStr, periodoLabel: label };
  }, [periodoTipo, currentDate]);

  // Cargar datos
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/turnos-invitados?tipo=${periodoTipo}`;
      if (periodoTipo === 'dia') {
        url += `&fecha=${desdeStr}`;
      } else if (periodoTipo === 'mes') {
        url += `&mes=${format(currentDate, 'yyyy-MM')}`;
      } else if (periodoTipo === 'anio') {
        url += `&anio=${format(currentDate, 'yyyy')}`;
      } else {
        url += `&desde=${desdeStr}&hasta=${hastaStr}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
        setInputPrecioExtra(String(json.tarifas.precioInvitadoExtra));
        setInputCupoAnual(String(json.tarifas.cupoInvitadosAnual));
      } else {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos de invitados.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error fetching invitados:', err);
      toast({
        title: 'Error',
        description: 'Error de conexión con el servidor.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [periodoTipo, desdeStr, hastaStr, currentDate, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Navegación
  const handlePrev = () => {
    if (periodoTipo === 'dia') setCurrentDate((prev) => subDays(prev, 1));
    else if (periodoTipo === 'semana') setCurrentDate((prev) => subWeeks(prev, 1));
    else if (periodoTipo === 'anio') setCurrentDate((prev) => subYears(prev, 1));
    else setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNext = () => {
    if (periodoTipo === 'dia') setCurrentDate((prev) => addDays(prev, 1));
    else if (periodoTipo === 'semana') setCurrentDate((prev) => addWeeks(prev, 1));
    else if (periodoTipo === 'anio') setCurrentDate((prev) => addYears(prev, 1));
    else setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleHoy = () => {
    setCurrentDate(new Date());
  };

  // Guardar tarifas editadas
  const handleSaveTarifas = async () => {
    if (readOnly) return;
    setSavingTarifas(true);
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          precio_invitado_extra: parseCurrency(inputPrecioExtra),
          cupo_invitados_anual: parseInt(inputCupoAnual, 10) || 4,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Configuración actualizada',
          description: 'Las tarifas y cupos de invitados fueron actualizados.',
        });
        setEditTarifasOpen(false);
        fetchData();
      } else {
        throw new Error('Error al guardar');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron actualizar los valores de invitados.',
        variant: 'destructive',
      });
    } finally {
      setSavingTarifas(false);
    }
  };

  // Socios filtrados por buscador
  const sociosFiltrados = useMemo(() => {
    if (!data?.sociosAcumulado) return [];
    if (!searchSocio.trim()) return data.sociosAcumulado;
    const q = searchSocio.toLowerCase().trim();
    return data.sociosAcumulado.filter(
      (s) =>
        s.nombreCompleto.toLowerCase().includes(q) ||
        (s.dni && s.dni.includes(q))
    );
  }, [data?.sociosAcumulado, searchSocio]);

  // Exportaciones
  const handleExportPDF = () => {
    if (!data) return;
    exportInvitadosPDF(periodoLabel, data.sociosAcumulado, data.turnos, {
      totalRecaudacion: data.kpis.totalRecaudacion,
      totalInvitadosPeriodo: data.kpis.totalInvitadosPeriodo,
      totalInvitadosGratis: data.kpis.totalInvitadosGratis,
      totalInvitadosCobrados: data.kpis.totalInvitadosCobrados,
      sociosConCargo: data.kpis.sociosConCargo,
      precioInvitadoExtra: data.tarifas.precioInvitadoExtra,
      cupoInvitadosAnual: data.tarifas.cupoInvitadosAnual,
    });
  };

  const handleExportExcel = () => {
    if (!data) return;
    exportInvitadosExcel(periodoLabel, data.sociosAcumulado, data.turnos, data.kpis);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con Filtros de Período y Acciones */}
      <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 lg:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <UserPlus className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Régimen de Invitados</h2>
            </div>
            <p className="text-sm text-[#999999] mt-1">
              Control de invitaciones bonificadas ({data?.tarifas.cupoInvitadosAnual || 4} al año por socio) y liquidación de invitados extras.
            </p>
          </div>

          {/* Granularidad: Mes / Semana / Día / Año */}
          <div className="flex items-center gap-2">
            <div className="bg-[#242424] p-1 rounded-lg flex items-center border border-[#333333]">
              <button
                onClick={() => setPeriodoTipo('mes')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  periodoTipo === 'mes'
                    ? 'bg-[#FFCC00] text-[#121212] shadow-sm'
                    : 'text-[#AAAAAA] hover:text-white'
                }`}
              >
                Mes
              </button>
              <button
                onClick={() => setPeriodoTipo('semana')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  periodoTipo === 'semana'
                    ? 'bg-[#FFCC00] text-[#121212] shadow-sm'
                    : 'text-[#AAAAAA] hover:text-white'
                }`}
              >
                Semana
              </button>
              <button
                onClick={() => setPeriodoTipo('dia')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  periodoTipo === 'dia'
                    ? 'bg-[#FFCC00] text-[#121212] shadow-sm'
                    : 'text-[#AAAAAA] hover:text-white'
                }`}
              >
                Día
              </button>
              <button
                onClick={() => setPeriodoTipo('anio')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  periodoTipo === 'anio'
                    ? 'bg-[#FFCC00] text-[#121212] shadow-sm'
                    : 'text-[#AAAAAA] hover:text-white'
                }`}
              >
                Año
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="bg-[#242424] border-[#333333] text-[#CCCCCC] hover:text-white hover:bg-[#2A2A2A] h-9"
              title="Actualizar datos"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Barra de Navegación de Fechas y Tarifas Activas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#2A2A2A]">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrev}
              className="h-8 w-8 bg-[#242424] border-[#333333] text-white hover:bg-[#2A2A2A]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleHoy}
              className="h-8 bg-[#242424] border-[#333333] text-xs font-semibold text-[#CCCCCC] hover:text-white hover:bg-[#2A2A2A]"
            >
              Hoy
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8 bg-[#242424] border-[#333333] text-white hover:bg-[#2A2A2A]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>

            <span className="text-sm font-bold text-white capitalize px-2 flex items-center gap-1.5">
              <CalendarIcon className="h-4 w-4 text-emerald-400" />
              {periodoLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-[#202020] border border-[#333333] px-3 py-1.5 rounded-lg text-xs">
              <span className="text-[#888888]">Régimen:</span>
              <span className="text-white font-medium">
                Cupo Gratis: <strong className="text-emerald-400">{data?.tarifas.cupoInvitadosAnual || 4} al año</strong>
              </span>
              <span className="text-[#444444]">|</span>
              <span className="text-white font-medium">
                Extra: <strong className="text-amber-400">{formatCurrency(data?.tarifas.precioInvitadoExtra || 10000)}</strong>
              </span>
            </div>

            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditTarifasOpen(true)}
                className="h-8 bg-[#242424] border-[#333333] text-xs text-[#CCCCCC] hover:text-white hover:bg-[#2A2A2A]"
              >
                <Settings2 className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                Editar Tarifas
              </Button>
            )}

            <Button
              onClick={handleExportPDF}
              size="sm"
              disabled={loading || !data?.sociosAcumulado.length}
              className="h-8 bg-[#242424] border-[#333333] text-white hover:bg-[#2A2A2A] text-xs font-semibold"
            >
              <FileDown className="h-3.5 w-3.5 mr-1 text-emerald-400" />
              PDF Secretaría
            </Button>

            <Button
              onClick={handleExportExcel}
              size="sm"
              disabled={loading || !data?.turnos.length}
              className="h-8 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recaudación Total Invitados */}
        <Card className="bg-[#181818] border-[#2A2A2A] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs text-[#888888] uppercase font-bold tracking-wider">
                Total a Cobrar Invitados
              </CardDescription>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {loading ? (
                <Skeleton className="h-8 w-28 bg-[#2A2A2A]" />
              ) : (
                formatCurrency(data?.kpis.totalRecaudacion || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#888888]">
              {data?.kpis.totalInvitadosCobrados || 0} invitados extras facturables
            </p>
          </CardContent>
        </Card>

        {/* Invitados en Período */}
        <Card className="bg-[#181818] border-[#2A2A2A] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs text-[#888888] uppercase font-bold tracking-wider">
                Total Invitaciones
              </CardDescription>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Ticket className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {loading ? (
                <Skeleton className="h-8 w-28 bg-[#2A2A2A]" />
              ) : (
                `${data?.kpis.totalInvitadosPeriodo || 0} personas`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#888888]">
              {data?.kpis.totalInvitadosGratis || 0} bonificadas · {data?.kpis.totalInvitadosCobrados || 0} con cargo
            </p>
          </CardContent>
        </Card>

        {/* Socios con Cargo */}
        <Card className="bg-[#181818] border-[#2A2A2A] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs text-[#888888] uppercase font-bold tracking-wider">
                Socios a Facturar
              </CardDescription>
              <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {loading ? (
                <Skeleton className="h-8 w-28 bg-[#2A2A2A]" />
              ) : (
                `${data?.kpis.sociosConCargo || 0} socios`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#888888]">
              Superaron el cupo de 4 invitados anuales
            </p>
          </CardContent>
        </Card>

        {/* Turnos con Invitados */}
        <Card className="bg-[#181818] border-[#2A2A2A] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs text-[#888888] uppercase font-bold tracking-wider">
                Partidos con Invitados
              </CardDescription>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {loading ? (
                <Skeleton className="h-8 w-28 bg-[#2A2A2A]" />
              ) : (
                `${data?.kpis.totalTurnosConInvitados || 0} turnos`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#888888]">
              Partidos single y dobles disputados
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Vistas: Resumen para Secretaría vs Detalle Turno por Turno */}
      <Card className="bg-[#181818] border-[#2A2A2A]">
        <CardHeader className="pb-3 border-b border-[#2A2A2A]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-[#242424] p-1 rounded-lg flex items-center border border-[#333333]">
                <button
                  onClick={() => setVista('acumulado')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    vista === 'acumulado'
                      ? 'bg-[#FFCC00] text-[#121212]'
                      : 'text-[#AAAAAA] hover:text-white'
                  }`}
                >
                  Resumen para Secretaría ({sociosFiltrados.length})
                </button>
                <button
                  onClick={() => setVista('detalle')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    vista === 'detalle'
                      ? 'bg-[#FFCC00] text-[#121212]'
                      : 'text-[#AAAAAA] hover:text-white'
                  }`}
                >
                  Detalle Turno por Turno ({data?.turnos.length || 0})
                </button>
              </div>
            </div>

            {vista === 'acumulado' && (
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <Input
                  type="text"
                  placeholder="Buscar socio por nombre o DNI..."
                  value={searchSocio}
                  onChange={(e) => setSearchSocio(e.target.value)}
                  className="bg-[#242424] border-[#333333] text-white pl-9 h-9 text-xs"
                />
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-3">
              <Skeleton className="h-10 w-full bg-[#242424]" />
              <Skeleton className="h-10 w-full bg-[#242424]" />
              <Skeleton className="h-10 w-full bg-[#242424]" />
            </div>
          ) : vista === 'acumulado' ? (
            /* Sub-vista 1: Resumen Consolidado por Socio para Secretaría */
            sociosFiltrados.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Users className="h-12 w-12 text-[#444444] mx-auto mb-3" />
                <h4 className="text-white font-semibold text-base">Sin uso de invitados en este período</h4>
                <p className="text-[#888888] text-xs mt-1">
                  Ningún socio titular registró turnos con invitados durante este período.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#1F1F1F]">
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-[#AAAAAA] text-xs font-bold w-12 text-center">#</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold">Socio Titular</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold">Documento</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold text-center">Cupo Anual (4 Gratis)</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold text-center">Uso en este Mes</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold text-center">Extras a Cobrar</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold text-right">Total a Facturar</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sociosFiltrados.map((s, idx) => {
                      const isExpanded = expandedSocioId === s.dni;

                      return (
                        <>
                          <TableRow
                            key={s.dni}
                            className="border-[#262626] hover:bg-[#222222] transition-colors cursor-pointer"
                            onClick={() => setExpandedSocioId(isExpanded ? null : s.dni)}
                          >
                            <TableCell className="text-center text-xs text-[#777777] font-mono">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-semibold text-white text-sm">
                              <div className="flex items-center gap-2">
                                <span>{s.nombreCompleto}</span>
                                {s.telefono && (
                                  <span className="text-[11px] text-[#777777]">({s.telefono})</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-[#AAAAAA] font-mono">
                              {s.dni ? `DNI ${s.dni}` : '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span className="font-extrabold text-xs text-white">
                                  {s.totalInvitadosAnio} en el año
                                </span>
                                {s.invitadosGratisRestantes > 0 ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] py-0 font-semibold"
                                  >
                                    ✓ Le queda{s.invitadosGratisRestantes > 1 ? 'n' : ''} {s.invitadosGratisRestantes} gratis
                                  </Badge>
                                ) : s.totalInvitadosAnio === s.cupoGratisAnual ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-zinc-800 text-zinc-400 border-zinc-700 text-[10px] py-0 font-medium"
                                  >
                                    Cupo gratis completado (0)
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-400/15 text-amber-400 border-amber-400/30 text-[10px] py-0 font-bold"
                                  >
                                    {s.totalInvitadosAnio - s.cupoGratisAnual} extra{(s.totalInvitadosAnio - s.cupoGratisAnual) > 1 ? 's' : ''} pagando
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-xs font-bold text-white">
                                  {s.invitadosEnPeriodo} en este mes
                                </span>
                                <span className="text-[10px] text-[#888888]">
                                  {s.invitadosGratisPeriodo > 0 && `${s.invitadosGratisPeriodo} gratis`}
                                  {s.invitadosGratisPeriodo > 0 && s.invitadosCobradosPeriodo > 0 && ' · '}
                                  {s.invitadosCobradosPeriodo > 0 && `${s.invitadosCobradosPeriodo} a pagar`}
                                  {s.invitadosEnPeriodo === 0 && '0 invitados'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {s.invitadosCobradosPeriodo > 0 ? (
                                <Badge className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold">
                                  {s.invitadosCobradosPeriodo} extra{s.invitadosCobradosPeriodo > 1 ? 's' : ''}
                                </Badge>
                              ) : (
                                <span className="text-xs text-[#777777]">0 extras</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-black text-sm">
                              {s.totalACobrar > 0 ? (
                                <span className="text-amber-400">{formatCurrency(s.totalACobrar)}</span>
                              ) : (
                                <span className="text-[#666666]">$ 0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-[#888888] hover:text-white"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>

                          {/* Fila expandible con los turnos del socio */}
                          {isExpanded && (
                            <TableRow className="bg-[#1C1C1C] border-[#2A2A2A]">
                              <TableCell colSpan={8} className="p-3 pl-12 pr-6">
                                <div className="bg-[#141414] border border-[#2E2E2E] rounded-lg p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs font-bold text-[#AAAAAA] border-b border-[#262626] pb-1.5">
                                    <span>Partidos con invitados de {s.nombreCompleto}:</span>
                                    <span>Cargo al Titular</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {s.turnosDetalle.map((td, i) => (
                                      <div
                                        key={i}
                                        className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-[#1A1A1A] text-[#CCCCCC]"
                                      >
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-white font-medium">{td.fecha}</span>
                                          <span className="text-[#888888]">· {td.horario} hs</span>
                                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-[#262626] border-[#3A3A3A] text-white">
                                            {td.canchaNombre}
                                          </Badge>
                                          <span className="text-[#888888] text-[11px]">({td.modalidad})</span>
                                          <span className="text-emerald-400 text-[11px] font-medium">
                                            · {td.cantidadInvitados} invitado/s
                                          </span>
                                          <span className="text-[11px] text-[#AAAAAA] font-medium">
                                            ({td.textoCupo || `Invitación #${td.ordenInvitacionesAnual} del año`})
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {td.invitadosGratis > 0 && (
                                            <span className="text-emerald-400 text-[11px]">
                                              {td.invitadosGratis} bonif.
                                            </span>
                                          )}
                                          <span className={`font-bold ${td.cargoTurno > 0 ? 'text-amber-400' : 'text-[#777777]'}`}>
                                            {formatCurrency(td.cargoTurno)}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            /* Sub-vista 2: Detalle Turno por Turno */
            data?.turnos.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Users className="h-12 w-12 text-[#444444] mx-auto mb-3" />
                <h4 className="text-white font-semibold text-base">Sin turnos con invitados en este período</h4>
                <p className="text-[#888888] text-xs mt-1">
                  No se registraron reservas con invitados durante este período.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#1F1F1F]">
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-[#AAAAAA] text-xs font-bold">Fecha</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold">Horario</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold">Cancha</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold">Modalidad</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold">Titular Responsable</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold text-center">Invitados en Turno</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold text-center">Uso del Cupo Anual</TableHead>
                      <TableHead className="text-[#AAAAAA] text-xs font-bold text-right">Cargo al Titular</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.turnos.map((t) => (
                      <TableRow key={t.id} className="border-[#262626] hover:bg-[#202020]">
                        <TableCell className="text-white font-medium text-xs whitespace-nowrap">
                          {t.fecha}
                        </TableCell>
                        <TableCell className="text-amber-400 font-bold text-xs whitespace-nowrap">
                          {t.horario} hs
                        </TableCell>
                        <TableCell className="text-xs text-[#CCCCCC] whitespace-nowrap">
                          {t.canchaNombre}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[11px] font-bold ${
                              t.modalidad === 'Single'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                            }`}
                          >
                            {t.modalidad}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-white text-xs">
                          {t.titular.nombre}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">{t.cantidadInvitados}</span>
                            {t.invitadosGratis > 0 && (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] py-0">
                                {t.invitadosGratis} gratis
                              </Badge>
                            )}
                            {t.invitadosCobrados > 0 && (
                              <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30 text-[10px] py-0 font-bold">
                                {t.invitadosCobrados} extra
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {t.textoCupo ? (
                            <Badge
                              variant="outline"
                              className={`text-[11px] font-semibold ${
                                t.invitadosCobrados > 0
                                  ? 'bg-amber-400/15 text-amber-400 border-amber-400/30'
                                  : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              }`}
                            >
                              {t.textoCupo}
                            </Badge>
                          ) : (
                            <span className="text-xs text-[#888888] font-mono">#{t.ordenInvitacionesAnual}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-black text-xs">
                          {t.cargoTurno > 0 ? (
                            <span className="text-amber-400 font-bold text-sm">{formatCurrency(t.cargoTurno)}</span>
                          ) : (
                            <span className="text-emerald-400 font-medium">Bonificado</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* ===================== MODAL EDITAR TARIFAS ===================== */}
      <Dialog open={editTarifasOpen} onOpenChange={setEditTarifasOpen}>
        <DialogContent className="bg-[#1C1C1C] border-[#333333] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-emerald-400" />
              Editar Tarifas y Cupos de Invitados
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888888]">
              Ajustá el valor adicional por invitado extra y el cupo anual gratuito por socio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#CCCCCC]">Valor Invitado Extra ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
                <Input
                  type="text"
                  value={inputPrecioExtra}
                  onChange={(e) => setInputPrecioExtra(formatInputCurrency(e.target.value))}
                  className="bg-[#2A2A2A] border-[#3A3A3A] text-white pl-7 font-bold"
                />
              </div>
              <p className="text-[11px] text-[#777777]">
                Monto que se facturará en secretaría al socio titular por cada invitado que exceda el cupo anual.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#CCCCCC]">Cupo Bonificado Anual (Gratuitos)</Label>
              <Input
                type="number"
                min="0"
                max="50"
                value={inputCupoAnual}
                onChange={(e) => setInputCupoAnual(e.target.value)}
                className="bg-[#2A2A2A] border-[#3A3A3A] text-white font-bold"
              />
              <p className="text-[11px] text-[#777777]">
                Cantidad máxima de invitaciones que cada socio titular puede usar gratis por año calendario.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditTarifasOpen(false)}
              className="bg-[#262626] border-[#3A3A3A] text-white hover:bg-[#333333]"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveTarifas}
              disabled={savingTarifas}
              className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-bold"
            >
              {savingTarifas ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                'Guardar y Actualizar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
