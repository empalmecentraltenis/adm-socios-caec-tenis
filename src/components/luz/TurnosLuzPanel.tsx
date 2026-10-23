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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Zap,
  GraduationCap,
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
  Moon,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  format,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  parseISO,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatInputCurrency, parseCurrency } from '@/lib/formatters';
import { exportSociosLuzPDF, exportProfesorLuzPDF, exportLuzExcel } from '@/lib/turnos-luz-export';

interface JugadorTurno {
  nombre: string;
  esTitular: boolean;
  esInvitado: boolean;
  dni?: string;
  monto: number;
}

interface TurnoSocio {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  horario: string;
  canchaId: number;
  canchaNombre: string;
  tipoPartido: string;
  titular: {
    dni: string;
    nombre: string;
  };
  jugadores: JugadorTurno[];
  totalSocios: number;
  totalJugadores: number;
  montoUnitarioSocio: number;
  montoTotalTurno: number;
}

interface SocioAcumulado {
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
}

interface TurnoProfesor {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  horario: string;
  canchaId: number;
  canchaNombre: string;
  detalle: string;
  asignadoA: string;
  monto: number;
}

interface ApiResponse {
  periodo: {
    tipo: 'dia' | 'semana' | 'mes';
    desde: string;
    hasta: string;
  };
  tarifas: {
    precioLuzTurno: number;
    precioLuzProfe: number;
  };
  kpis: {
    totalGeneralMonto: number;
    totalGeneralTurnos: number;
    totalSociosMonto: number;
    totalSociosTurnos: number;
    totalProfeMonto: number;
    totalProfeTurnos: number;
    totalSociosCobranza: number;
  };
  turnosSocios: TurnoSocio[];
  sociosAcumulado: SocioAcumulado[];
  turnosProfesor: TurnoProfesor[];
}

interface TurnosLuzPanelProps {
  readOnly?: boolean;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function TurnosLuzPanel({ readOnly = false }: TurnosLuzPanelProps) {
  const { toast } = useToast();

  // Estados de navegación temporal
  const [periodoTipo, setPeriodoTipo] = useState<'dia' | 'semana' | 'mes'>('mes');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Estados de datos
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtro de búsqueda en vista de socios
  const [searchSocio, setSearchSocio] = useState<string>('');
  const [vistaSocios, setVistaSocios] = useState<'acumulado' | 'detalle'>('acumulado');
  const [expandedSocioId, setExpandedSocioId] = useState<string | null>(null);

  // Modal para edición de tarifas
  const [editTarifasOpen, setEditTarifasOpen] = useState<boolean>(false);
  const [inputPrecioTurno, setInputPrecioTurno] = useState<string>('6000');
  const [inputPrecioProfe, setInputPrecioProfe] = useState<string>('3000');
  const [savingTarifas, setSavingTarifas] = useState<boolean>(false);

  // Calcular fechas desde/hasta según el tipo de período
  const { desdeStr, hastaStr, periodoLabel } = useMemo(() => {
    if (periodoTipo === 'dia') {
      const dStr = format(currentDate, 'yyyy-MM-dd');
      const label = format(currentDate, "EEEE d 'de' MMMM, yyyy", { locale: es });
      return { desdeStr: dStr, hastaStr: dStr, periodoLabel: label };
    }

    if (periodoTipo === 'semana') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Lunes
      const end = endOfWeek(currentDate, { weekStartsOn: 1 }); // Domingo
      const dStr = format(start, 'yyyy-MM-dd');
      const hStr = format(end, 'yyyy-MM-dd');
      const label = `Semana del ${format(start, 'd')} al ${format(end, "d 'de' MMMM, yyyy", { locale: es })}`;
      return { desdeStr: dStr, hastaStr: hStr, periodoLabel: label };
    }

    // Mes
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const dStr = format(start, 'yyyy-MM-dd');
    const hStr = format(end, 'yyyy-MM-dd');
    const label = `${format(currentDate, 'MMMM yyyy', { locale: es })}`;
    return { desdeStr: dStr, hastaStr: hStr, periodoLabel: label };
  }, [periodoTipo, currentDate]);

  // Cargar datos desde la API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/turnos-luz?tipo=${periodoTipo}`;
      if (periodoTipo === 'dia') {
        url += `&fecha=${desdeStr}`;
      } else if (periodoTipo === 'mes') {
        url += `&mes=${format(currentDate, 'yyyy-MM')}`;
      } else {
        url += `&desde=${desdeStr}&hasta=${hastaStr}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const json: ApiResponse = await res.json();
        setData(json);
        setInputPrecioTurno(String(json.tarifas.precioLuzTurno));
        setInputPrecioProfe(String(json.tarifas.precioLuzProfe));
      } else {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos de turnos con luz.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error fetching turnos luz:', err);
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

  // Navegación temporal
  const handlePrev = () => {
    if (periodoTipo === 'dia') setCurrentDate((prev) => subDays(prev, 1));
    else if (periodoTipo === 'semana') setCurrentDate((prev) => subWeeks(prev, 1));
    else setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNext = () => {
    if (periodoTipo === 'dia') setCurrentDate((prev) => addDays(prev, 1));
    else if (periodoTipo === 'semana') setCurrentDate((prev) => addWeeks(prev, 1));
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
          precio_luz_turno: parseCurrency(inputPrecioTurno),
          precio_luz_profe: parseCurrency(inputPrecioProfe),
        }),
      });

      if (res.ok) {
        toast({
          title: 'Tarifas actualizadas',
          description: 'Los nuevos valores de iluminación fueron guardados.',
        });
        setEditTarifasOpen(false);
        fetchData();
      } else {
        throw new Error('Error al guardar');
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudieron actualizar las tarifas.',
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

  // Handlers de exportación
  const handleExportSociosPDF = () => {
    if (!data) return;
    exportSociosLuzPDF(
      periodoLabel,
      data.sociosAcumulado,
      data.turnosSocios,
      {
        totalSociosMonto: data.kpis.totalSociosMonto,
        totalSociosTurnos: data.kpis.totalSociosTurnos,
        precioLuzTurno: data.tarifas.precioLuzTurno,
      }
    );
  };

  const handleExportProfePDF = () => {
    if (!data) return;
    exportProfesorLuzPDF(
      periodoLabel,
      data.turnosProfesor,
      {
        totalProfeMonto: data.kpis.totalProfeMonto,
        totalProfeTurnos: data.kpis.totalProfeTurnos,
        precioLuzProfe: data.tarifas.precioLuzProfe,
      }
    );
  };

  const handleExportExcel = () => {
    if (!data) return;
    exportLuzExcel(
      periodoLabel,
      data.sociosAcumulado,
      data.turnosSocios,
      data.turnosProfesor,
      data.kpis
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Header con Filtros de Período y Acciones */}
      <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 lg:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400 border border-amber-400/20">
                <Zap className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">Turnos con Luz</h2>
            </div>
            <p className="text-sm text-[#999999] mt-1">
              Registro y liquidación de turnos a partir de las 19:00 hs para Socios y Profesor.
            </p>
          </div>

          {/* Selector de Granularidad: Día / Semana / Mes */}
          <div className="flex items-center gap-2">
            <div className="bg-[#242424] p-1 rounded-lg flex items-center border border-[#333333]">
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
                onClick={() => setPeriodoTipo('mes')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  periodoTipo === 'mes'
                    ? 'bg-[#FFCC00] text-[#121212] shadow-sm'
                    : 'text-[#AAAAAA] hover:text-white'
                }`}
              >
                Mes
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
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Barra de Navegación de Fechas y Tarifas Activas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#2A2A2A]">
          {/* Navegación temporal */}
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
              <CalendarIcon className="h-4 w-4 text-amber-400" />
              {periodoLabel}
            </span>
          </div>

          {/* Tarifas vigentes con botón de edición rápida */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 bg-[#202020] border border-[#333333] px-3 py-1.5 rounded-lg text-xs">
              <span className="text-[#888888]">Tarifas:</span>
              <span className="text-white font-medium">
                Socios: <strong className="text-amber-400">{formatCurrency(data?.tarifas.precioLuzTurno || 6000)}</strong>
              </span>
              <span className="text-[#444444]">|</span>
              <span className="text-white font-medium">
                Profe: <strong className="text-amber-400">{formatCurrency(data?.tarifas.precioLuzProfe || 3000)}</strong>
              </span>
            </div>

            {!readOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditTarifasOpen(true)}
                className="h-8 bg-[#242424] border-[#333333] text-xs text-[#CCCCCC] hover:text-white hover:bg-[#2A2A2A]"
              >
                <Settings2 className="h-3.5 w-3.5 mr-1 text-amber-400" />
                Editar Tarifas
              </Button>
            )}

            <Button
              onClick={handleExportExcel}
              size="sm"
              disabled={loading || (!data?.turnosSocios.length && !data?.turnosProfesor.length)}
              className="h-8 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Excel Completo
            </Button>
          </div>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Recaudación Total Luz */}
        <Card className="bg-[#181818] border-[#2A2A2A] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs text-[#888888] uppercase font-bold tracking-wider">
                Total Recaudación Luz
              </CardDescription>
              <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400">
                <DollarSign className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {loading ? (
                <Skeleton className="h-8 w-28 bg-[#2A2A2A]" />
              ) : (
                formatCurrency(data?.kpis.totalGeneralMonto || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#888888]">
              {data?.kpis.totalGeneralTurnos || 0} turnos nocturnos en el período
            </p>
          </CardContent>
        </Card>

        {/* Turnos Socios */}
        <Card className="bg-[#181818] border-[#2A2A2A] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs text-[#888888] uppercase font-bold tracking-wider">
                Turnos Socios
              </CardDescription>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {loading ? (
                <Skeleton className="h-8 w-28 bg-[#2A2A2A]" />
              ) : (
                formatCurrency(data?.kpis.totalSociosMonto || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#888888]">
              {data?.kpis.totalSociosTurnos || 0} turnos jugados ($6.000 c/u)
            </p>
          </CardContent>
        </Card>

        {/* Turnos Profesor */}
        <Card className="bg-[#181818] border-[#2A2A2A] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs text-[#888888] uppercase font-bold tracking-wider">
                Turnos Profesor
              </CardDescription>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
                <GraduationCap className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {loading ? (
                <Skeleton className="h-8 w-28 bg-[#2A2A2A]" />
              ) : (
                formatCurrency(data?.kpis.totalProfeMonto || 0)
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#888888]">
              {data?.kpis.totalProfeTurnos || 0} clases nocturnas ($3.000 c/u)
            </p>
          </CardContent>
        </Card>

        {/* Socios a Liquidar */}
        <Card className="bg-[#181818] border-[#2A2A2A] shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs text-[#888888] uppercase font-bold tracking-wider">
                Socios a Cobrar
              </CardDescription>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {loading ? (
                <Skeleton className="h-8 w-28 bg-[#2A2A2A]" />
              ) : (
                `${data?.kpis.totalSociosCobranza || 0} socios`
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-[#888888]">
              Listos para facturar en secretaría
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Pestañas Principales: Socios y Profesor */}
      <Tabs defaultValue="socios" className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList className="bg-[#1E1E1E] border border-[#2A2A2A] p-1">
            <TabsTrigger
              value="socios"
              className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] font-semibold text-xs px-4"
            >
              <Users className="h-4 w-4 mr-1.5" />
              Socios ({data?.turnosSocios.length || 0})
            </TabsTrigger>
            <TabsTrigger
              value="profesor"
              className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] font-semibold text-xs px-4"
            >
              <GraduationCap className="h-4 w-4 mr-1.5" />
              Profesor ({data?.turnosProfesor.length || 0})
            </TabsTrigger>
          </TabsList>

          {/* Botones de Exportación contextuales */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportSociosPDF}
              variant="outline"
              size="sm"
              disabled={loading || !data?.sociosAcumulado.length}
              className="bg-[#242424] border-[#333333] text-white hover:bg-[#2A2A2A] text-xs"
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
              PDF Secretaría (Socios)
            </Button>
            <Button
              onClick={handleExportProfePDF}
              variant="outline"
              size="sm"
              disabled={loading || !data?.turnosProfesor.length}
              className="bg-[#242424] border-[#333333] text-white hover:bg-[#2A2A2A] text-xs"
            >
              <FileDown className="h-3.5 w-3.5 mr-1.5 text-purple-400" />
              PDF Profesor
            </Button>
          </div>
        </div>

        {/* ===================== TAB SOCIOS ===================== */}
        <TabsContent value="socios" className="space-y-4">
          <Card className="bg-[#181818] border-[#2A2A2A]">
            <CardHeader className="pb-3 border-b border-[#2A2A2A]">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="bg-[#242424] p-1 rounded-lg flex items-center border border-[#333333]">
                    <button
                      onClick={() => setVistaSocios('acumulado')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        vistaSocios === 'acumulado'
                          ? 'bg-[#FFCC00] text-[#121212]'
                          : 'text-[#AAAAAA] hover:text-white'
                      }`}
                    >
                      Resumen para Secretaría ({sociosFiltrados.length})
                    </button>
                    <button
                      onClick={() => setVistaSocios('detalle')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                        vistaSocios === 'detalle'
                          ? 'bg-[#FFCC00] text-[#121212]'
                          : 'text-[#AAAAAA] hover:text-white'
                      }`}
                    >
                      Detalle Turno por Turno ({data?.turnosSocios.length || 0})
                    </button>
                  </div>
                </div>

                {/* Buscador de socios */}
                {vistaSocios === 'acumulado' && (
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
              ) : vistaSocios === 'acumulado' ? (
                /* Sub-vista 1: Resumen Acumulado por Socio (Ideal para Secretaría) */
                sociosFiltrados.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Moon className="h-12 w-12 text-[#444444] mx-auto mb-3" />
                    <h4 className="text-white font-semibold text-base">Sin turnos con luz de socios</h4>
                    <p className="text-[#888888] text-xs mt-1">
                      No se registraron turnos nocturnos jugados por socios en este período.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-[#1F1F1F]">
                        <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                          <TableHead className="text-[#AAAAAA] text-xs font-bold w-12 text-center">#</TableHead>
                          <TableHead className="text-[#AAAAAA] text-xs font-bold">Socio</TableHead>
                          <TableHead className="text-[#AAAAAA] text-xs font-bold">Documento</TableHead>
                          <TableHead className="text-[#AAAAAA] text-xs font-bold text-center">Turnos Jugados</TableHead>
                          <TableHead className="text-[#AAAAAA] text-xs font-bold text-right">Total a Cobrar</TableHead>
                          <TableHead className="w-10"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sociosFiltrados.map((s, idx) => {
                          const isExpanded = expandedSocioId === s.id;
                          return (
                            <>
                              <TableRow
                                key={s.id}
                                className="border-[#262626] hover:bg-[#222222] transition-colors cursor-pointer"
                                onClick={() => setExpandedSocioId(isExpanded ? null : s.id)}
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
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-400/10 text-amber-400 border-amber-400/20 text-xs font-bold"
                                  >
                                    {s.cantidadTurnos} {s.cantidadTurnos === 1 ? 'turno' : 'turnos'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right font-black text-amber-400 text-sm">
                                  {formatCurrency(s.totalAPagar)}
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

                              {/* Fila expandible con el desglose turno por turno de ese socio */}
                              {isExpanded && (
                                <TableRow className="bg-[#1C1C1C] border-[#2A2A2A]">
                                  <TableCell colSpan={6} className="p-3 pl-12 pr-6">
                                    <div className="bg-[#141414] border border-[#2E2E2E] rounded-lg p-3 space-y-2">
                                      <div className="flex items-center justify-between text-xs font-bold text-[#AAAAAA] border-b border-[#262626] pb-1.5">
                                        <span>Detalle de turnos de {s.nombreCompleto}:</span>
                                        <span>Monto asignado</span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {s.turnosDetalle.map((td, i) => (
                                          <div
                                            key={i}
                                            className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#1A1A1A] text-[#CCCCCC]"
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-white font-medium">{td.fecha}</span>
                                              <span className="text-[#888888]">· {td.hora} hs</span>
                                              <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-[#262626] border-[#3A3A3A] text-white">
                                                {td.cancha}
                                              </Badge>
                                              <span className="text-[#888888] text-[11px]">({td.tipoPartido} - {td.rol})</span>
                                            </div>
                                            <span className="font-bold text-amber-400">
                                              {formatCurrency(td.monto)}
                                            </span>
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
                data?.turnosSocios.length === 0 ? (
                  <div className="text-center py-12 px-4">
                    <Moon className="h-12 w-12 text-[#444444] mx-auto mb-3" />
                    <h4 className="text-white font-semibold text-base">Sin turnos con luz de socios</h4>
                    <p className="text-[#888888] text-xs mt-1">
                      No se registraron turnos nocturnos en este período.
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
                          <TableHead className="text-[#AAAAAA] text-xs font-bold">Titular</TableHead>
                          <TableHead className="text-[#AAAAAA] text-xs font-bold">Jugadores y Cargos</TableHead>
                          <TableHead className="text-[#AAAAAA] text-xs font-bold text-right">Total Turno</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data?.turnosSocios.map((t) => (
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
                                  t.tipoPartido === 'Single'
                                    ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                }`}
                              >
                                {t.tipoPartido}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-semibold text-white text-xs">
                              {t.titular.nombre}
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="flex flex-wrap gap-1.5 py-1">
                                {t.jugadores.map((j, jIdx) => (
                                  <span
                                    key={jIdx}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] ${
                                      j.esInvitado
                                        ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                        : 'bg-[#252525] text-white border border-[#3A3A3A]'
                                    }`}
                                  >
                                    <span className="font-medium">{j.nombre}</span>
                                    <span className="font-bold text-amber-400">
                                      {j.esInvitado ? '(Invitado)' : formatCurrency(j.monto)}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-black text-white text-xs">
                              {formatCurrency(t.montoTotalTurno)}
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
        </TabsContent>

        {/* ===================== TAB PROFESOR ===================== */}
        <TabsContent value="profesor" className="space-y-4">
          <Card className="bg-[#181818] border-[#2A2A2A]">
            <CardHeader className="pb-3 border-b border-[#2A2A2A]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-white text-base font-bold flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-purple-400" />
                    Turnos Nocturnos del Profesor
                  </CardTitle>
                  <CardDescription className="text-xs text-[#888888] mt-0.5">
                    Clases permanentes agendadas desde las 19:00 hs · Tarifa: {formatCurrency(data?.tarifas.precioLuzProfe || 3000)} por turno.
                  </CardDescription>
                </div>

                <div className="bg-[#242424] border border-[#333333] px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs">
                  <span className="text-[#888888]">Total Clases:</span>
                  <span className="font-bold text-white">{data?.kpis.totalProfeTurnos || 0} turnos</span>
                  <span className="text-[#444444]">|</span>
                  <span className="text-[#888888]">Total a Liquidar:</span>
                  <span className="font-bold text-purple-400 text-sm">
                    {formatCurrency(data?.kpis.totalProfeMonto || 0)}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 space-y-3">
                  <Skeleton className="h-10 w-full bg-[#242424]" />
                  <Skeleton className="h-10 w-full bg-[#242424]" />
                </div>
              ) : data?.turnosProfesor.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <GraduationCap className="h-12 w-12 text-[#444444] mx-auto mb-3" />
                  <h4 className="text-white font-semibold text-base">Sin turnos nocturnos del profesor</h4>
                  <p className="text-[#888888] text-xs mt-1">
                    No se registraron turnos bloqueados por clases del profesor después de las 19:00 hs en este período.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#1F1F1F]">
                      <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                        <TableHead className="text-[#AAAAAA] text-xs font-bold w-12 text-center">#</TableHead>
                        <TableHead className="text-[#AAAAAA] text-xs font-bold">Fecha</TableHead>
                        <TableHead className="text-[#AAAAAA] text-xs font-bold">Horario</TableHead>
                        <TableHead className="text-[#AAAAAA] text-xs font-bold">Cancha</TableHead>
                        <TableHead className="text-[#AAAAAA] text-xs font-bold">Concepto / Motivo</TableHead>
                        <TableHead className="text-[#AAAAAA] text-xs font-bold text-right">Importe</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.turnosProfesor.map((t, idx) => (
                        <TableRow key={t.id} className="border-[#262626] hover:bg-[#202020]">
                          <TableCell className="text-center text-xs text-[#777777] font-mono">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="text-white font-medium text-xs whitespace-nowrap">
                            {t.fecha}
                          </TableCell>
                          <TableCell className="text-amber-400 font-bold text-xs whitespace-nowrap">
                            {t.horario} hs
                          </TableCell>
                          <TableCell className="text-xs text-[#CCCCCC] whitespace-nowrap">
                            {t.canchaNombre}
                          </TableCell>
                          <TableCell className="text-xs text-white">
                            <Badge variant="outline" className="bg-purple-500/10 text-purple-300 border-purple-500/20 text-xs">
                              {t.detalle}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-black text-purple-400 text-sm">
                            {formatCurrency(t.monto)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===================== MODAL EDITAR TARIFAS ===================== */}
      <Dialog open={editTarifasOpen} onOpenChange={setEditTarifasOpen}>
        <DialogContent className="bg-[#1C1C1C] border-[#333333] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              Editar Tarifas de Iluminación
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888888]">
              Modificá el valor adicional por turno nocturno a partir de las 19:00 hs.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#CCCCCC]">Valor Turno Socios (Total por turno)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
                <Input
                  type="text"
                  value={inputPrecioTurno}
                  onChange={(e) => setInputPrecioTurno(formatInputCurrency(e.target.value))}
                  className="bg-[#2A2A2A] border-[#3A3A3A] text-white pl-7 font-bold"
                />
              </div>
              <p className="text-[11px] text-[#777777]">
                Se dividirá entre los socios que integran el partido (Single: $3.000 c/u, Dobles: $1.500 c/u).
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#CCCCCC]">Valor Turno Profesor (Clases)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
                <Input
                  type="text"
                  value={inputPrecioProfe}
                  onChange={(e) => setInputPrecioProfe(formatInputCurrency(e.target.value))}
                  className="bg-[#2A2A2A] border-[#3A3A3A] text-white pl-7 font-bold"
                />
              </div>
              <p className="text-[11px] text-[#777777]">
                Valor fijo asignado por cada turno de clases nocturno del profesor.
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
