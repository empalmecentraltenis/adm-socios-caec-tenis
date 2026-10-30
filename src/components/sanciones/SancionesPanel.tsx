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
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Gavel,
  Users,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileDown,
  Phone,
  Calendar as CalendarIcon,
  Plus,
  Clock,
  Zap,
  Trash2,
  QrCode,
  CalendarX2,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import * as XLSX from 'xlsx';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface SancionDetalle {
  id: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  activa: boolean;
  esVigente: boolean;
  createdAt: string;
  turno?: {
    fecha: string;
    horario: string;
    canchaNombre: string;
  } | null;
}

interface SocioSancionado {
  socioDni: string;
  socioId?: string;
  nombreCompleto: string;
  apellido: string;
  nombre: string;
  telefono: string;
  email: string;
  categoria: string;
  estadoSocio: string;
  totalSanciones: number;
  sancionesActivas: number;
  estaInhabilitado: boolean;
  fechaFinSancionActual: string | null;
  esReincidente: boolean;
  esCritico: boolean;
  nivelReincidencia: 'leve' | 'reincidente' | 'critico';
  nivelLabel: string;
  ultimaSancionFecha: string;
  ultimaSancionMotivo: string;
  sanciones: SancionDetalle[];
}

interface SancionReciente {
  id: string;
  socioDni: string;
  socioNombre: string;
  fechaInicio: string;
  fechaFin: string;
  motivo: string;
  activa: boolean;
  esVigente: boolean;
  createdAt: string;
  canchaNombre: string;
  horario: string | null;
}

interface ClubConfigState {
  validacionQrActiva: boolean;
  sancionesCancelacionActiva: boolean;
  climaInestable: boolean;
}

interface ApiResponse {
  configClub?: ClubConfigState;
  kpis: {
    totalSociosConSanciones: number;
    totalInhabilitadosHoy: number;
    totalReincidentes: number;
    totalCriticos: number;
    totalSancionesHistoricas: number;
    sancionesMesActual: number;
  };
  socios: SocioSancionado[];
  sancionesRecientes: SancionReciente[];
}

interface SancionesPanelProps {
  readOnly?: boolean;
}

export default function SancionesPanel({ readOnly = false }: SancionesPanelProps) {
  const { toast } = useToast();

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [runningControl, setRunningControl] = useState<boolean>(false);

  // Filtros y búsqueda
  const [search, setSearch] = useState<string>('');
  const [filtro, setFiltro] = useState<'todos' | 'activos' | 'reincidentes' | 'criticos'>('todos');
  const [mesFiltro, setMesFiltro] = useState<string>('todos');
  const [diaFiltro, setDiaFiltro] = useState<string>('todos');
  const [vista, setVista] = useState<'socios' | 'recientes'>('socios');
  const [expandedSocioDni, setExpandedSocioDni] = useState<string | null>(null);

  // Modal para levantar sanción
  const [sancionToLevantar, setSancionToLevantar] = useState<SancionDetalle | null>(null);
  const [socioTarget, setSocioTarget] = useState<SocioSancionado | null>(null);
  const [motivoLevantamiento, setMotivoLevantamiento] = useState<string>('');
  const [submittingLevantar, setSubmittingLevantar] = useState<boolean>(false);

  // Modal para confirmar eliminación definitiva de sanción
  const [sancionToDelete, setSancionToDelete] = useState<{ id: string; socioNombre: string; socioDni: string; motivo: string; fechaInicio: string } | null>(null);
  const [submittingDelete, setSubmittingDelete] = useState<boolean>(false);

  // Estados de switches de configuración (QR y Cancelación tardía)
  const [togglingQr, setTogglingQr] = useState<boolean>(false);
  const [togglingCancelacion, setTogglingCancelacion] = useState<boolean>(false);

  // Modal para nueva sanción manual
  const [nuevaSancionOpen, setNuevaSancionOpen] = useState<boolean>(false);
  const [inputDni, setInputDni] = useState<string>('');
  const [inputDias, setInputDias] = useState<number>(7);
  const [inputMotivo, setInputMotivo] = useState<string>('');
  const [submittingNueva, setSubmittingNueva] = useState<boolean>(false);

  // Cargar datos desde la API
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sanciones');
      if (!res.ok) throw new Error('Error al consultar sanciones');

      const json = await res.json();
      setData(json);
    } catch (err: any) {
      console.error('Error cargando sanciones:', err);
      toast({
        title: 'Error',
        description: 'No se pudo cargar el registro de sanciones.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Ejecutar control de turnos sin validar manualmente
  const handleEjecutarControlQR = async () => {
    if (readOnly) return;
    setRunningControl(true);
    try {
      const res = await fetch('/api/sanciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run_qr_control' }),
      });

      if (!res.ok) throw new Error('Error ejecutando control');
      const json = await res.json();

      if (json.sancionesAplicadas > 0) {
        toast({
          title: 'Control de QR ejecutado',
          description: `Se detectaron y sancionaron ${json.sancionesAplicadas} participantes por turnos sin validar.`,
        });
      } else {
        toast({
          title: 'Control de QR al día',
          description: json.motivo || 'No se encontraron turnos vencidos pendientes de validación.',
        });
      }

      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Error al ejecutar control de QR.',
        variant: 'destructive',
      });
    } finally {
      setRunningControl(false);
    }
  };

  // Confirmar levantamiento de sanción
  const handleConfirmLevantar = async () => {
    if (!sancionToLevantar || readOnly) return;
    setSubmittingLevantar(true);
    try {
      const res = await fetch('/api/sanciones', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sancionToLevantar.id,
          activa: false,
          motivoLevantamiento: motivoLevantamiento.trim() || 'Levantada por administración',
        }),
      });

      if (!res.ok) throw new Error('Error al levantar la sanción');

      toast({
        title: 'Sanción levantada',
        description: `El socio ha sido habilitado nuevamente para realizar reservas.`,
      });

      setSancionToLevantar(null);
      setSocioTarget(null);
      setMotivoLevantamiento('');
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo levantar la sanción.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingLevantar(false);
    }
  };

  // Confirmar eliminación definitiva de una sanción
  const handleConfirmDelete = async () => {
    if (!sancionToDelete || readOnly) return;
    setSubmittingDelete(true);
    try {
      const res = await fetch(`/api/sanciones?id=${sancionToDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al eliminar sanción');
      }

      toast({
        title: 'Sanción eliminada',
        description: `La sanción fue eliminada permanentemente del historial del socio.`,
      });

      setSancionToDelete(null);
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo eliminar la sanción.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingDelete(false);
    }
  };

  // Togglear configuración del club (QR o Cancelación tardía)
  const handleToggleConfig = async (clave: 'validacion_qr_activa' | 'sanciones_cancelacion_activa', nuevoValor: boolean) => {
    if (readOnly) return;
    if (clave === 'validacion_qr_activa') setTogglingQr(true);
    if (clave === 'sanciones_cancelacion_activa') setTogglingCancelacion(true);

    try {
      const res = await fetch('/api/sanciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_config',
          clave,
          valor: nuevoValor,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Error actualizando configuración');
      }

      const json = await res.json();
      if (json.configClub) {
        setData((prev) => (prev ? { ...prev, configClub: json.configClub } : null));
      }

      toast({
        title: 'Configuración actualizada',
        description: clave === 'validacion_qr_activa'
          ? (nuevoValor ? 'Validación QR obligatoria activada' : 'Validación QR opcional (sin sanción por no escanear)')
          : (nuevoValor ? 'Sanciones por cancelación tardía activadas' : 'Sanciones por cancelación tardía desactivadas'),
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo actualizar la configuración.',
        variant: 'destructive',
      });
    } finally {
      if (clave === 'validacion_qr_activa') setTogglingQr(false);
      if (clave === 'sanciones_cancelacion_activa') setTogglingCancelacion(false);
    }
  };

  // Crear sanción extraordinaria manual
  const handleCreateSancionManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputDni.trim() || !inputMotivo.trim() || readOnly) return;

    setSubmittingNueva(true);
    try {
      const res = await fetch('/api/sanciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioDni: inputDni.trim(),
          diasSancion: Number(inputDias) || 7,
          motivo: inputMotivo.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al crear sanción');
      }

      toast({
        title: 'Sanción aplicada',
        description: `Se registró la sanción de ${inputDias} días correctamente.`,
      });

      setNuevaSancionOpen(false);
      setInputDni('');
      setInputMotivo('');
      setInputDias(14);
      await fetchData();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo aplicar la sanción.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingNueva(false);
    }
  };

  // Obtener meses y días únicos presentes en las sanciones
  const { mesesDisponibles, diasDisponibles } = useMemo(() => {
    const mesesMap = new Map<string, string>();
    const diasMap = new Map<string, string>();

    const todasSanciones: Array<{ fechaInicio?: string; createdAt?: string }> = [];
    if (data?.sancionesRecientes) {
      data.sancionesRecientes.forEach((s) => todasSanciones.push(s));
    }
    if (data?.socios) {
      data.socios.forEach((soc) => {
        soc.sanciones.forEach((s) => todasSanciones.push(s));
      });
    }

    todasSanciones.forEach((s) => {
      const fecha = s.fechaInicio || (s.createdAt ? s.createdAt.substring(0, 10) : '');
      if (fecha && fecha.length >= 7) {
        const mesKey = fecha.substring(0, 7);
        try {
          const [yyyy, mm] = mesKey.split('-');
          const dateObj = new Date(Number(yyyy), Number(mm) - 1, 1);
          mesesMap.set(mesKey, format(dateObj, 'MMMM yyyy', { locale: es }));
        } catch {
          mesesMap.set(mesKey, mesKey);
        }

        if (fecha.length >= 10) {
          try {
            const [yyyy, mm, dd] = fecha.split('-');
            const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
            diasMap.set(fecha, format(dateObj, 'dd/MM/yyyy (EEE)', { locale: es }));
          } catch {
            diasMap.set(fecha, fecha);
          }
        }
      }
    });

    let diasArray = Array.from(diasMap.entries()).map(([valor, label]) => ({ valor, label }));
    if (mesFiltro !== 'todos') {
      diasArray = diasArray.filter((d) => d.valor.startsWith(mesFiltro));
    }

    const mesesArray = Array.from(mesesMap.entries())
      .map(([valor, label]) => ({ valor, label }))
      .sort((a, b) => b.valor.localeCompare(a.valor));

    diasArray.sort((a, b) => b.valor.localeCompare(a.valor));

    return { mesesDisponibles: mesesArray, diasDisponibles: diasArray };
  }, [data, mesFiltro]);

  // Filtrar socios combinando: categoría (filtro), búsqueda (search), mes (mesFiltro) y día (diaFiltro)
  const sociosFiltrados = useMemo(() => {
    if (!data?.socios) return [];
    let list = data.socios;

    // 1. Filtro por categoría (todos / activos / reincidentes / criticos)
    if (filtro === 'activos') {
      list = list.filter((s) => s.estaInhabilitado);
    } else if (filtro === 'reincidentes') {
      list = list.filter((s) => s.esReincidente);
    } else if (filtro === 'criticos') {
      list = list.filter((s) => s.esCritico);
    }

    // 2. Filtro de búsqueda por texto (nombre, DNI, teléfono)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.nombreCompleto.toLowerCase().includes(q) ||
          s.socioDni.includes(q) ||
          (s.telefono && s.telefono.includes(q))
      );
    }

    // 3. Filtro temporal (mes y día)
    if (mesFiltro !== 'todos' || diaFiltro !== 'todos') {
      list = list
        .map((socio) => {
          const sancionesEnPeriodo = socio.sanciones.filter((s) => {
            const f = s.fechaInicio || (s.createdAt ? s.createdAt.substring(0, 10) : '');
            if (diaFiltro !== 'todos') {
              return f === diaFiltro;
            }
            if (mesFiltro !== 'todos') {
              return f.startsWith(mesFiltro);
            }
            return true;
          });

          if (sancionesEnPeriodo.length === 0) return null;

          return {
            ...socio,
            sanciones: sancionesEnPeriodo,
            totalSanciones: sancionesEnPeriodo.length,
            ultimaSancionFecha: sancionesEnPeriodo[0]?.fechaInicio || socio.ultimaSancionFecha,
            ultimaSancionMotivo: sancionesEnPeriodo[0]?.motivo || socio.ultimaSancionMotivo,
          };
        })
        .filter((s): s is SocioSancionado => s !== null);
    }

    return list;
  }, [data?.socios, filtro, search, mesFiltro, diaFiltro]);

  // Filtrar sanciones recientes según mes, día, búsqueda y estado
  const sancionesRecientesFiltradas = useMemo(() => {
    if (!data?.sancionesRecientes) return [];
    let list = data.sancionesRecientes;

    // 1. Filtro temporal (mes y día)
    if (mesFiltro !== 'todos' || diaFiltro !== 'todos') {
      list = list.filter((s) => {
        const f = s.fechaInicio || (s.createdAt ? s.createdAt.substring(0, 10) : '');
        if (diaFiltro !== 'todos') {
          return f === diaFiltro;
        }
        if (mesFiltro !== 'todos') {
          return f.startsWith(mesFiltro);
        }
        return true;
      });
    }

    // 2. Filtro de búsqueda textual
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.socioNombre.toLowerCase().includes(q) ||
          s.socioDni.includes(q) ||
          s.motivo.toLowerCase().includes(q) ||
          s.canchaNombre.toLowerCase().includes(q)
      );
    }

    // 3. Filtro de inhabilitados activos
    if (filtro === 'activos') {
      list = list.filter((s) => s.esVigente);
    }

    return list;
  }, [data?.sancionesRecientes, mesFiltro, diaFiltro, search, filtro]);

  // Exportar a Excel
  const handleExportExcel = () => {
    if (!sociosList.length) return;

    const exportRows = sociosList.map((s, index) => ({
      '#': index + 1,
      'Apellido y Nombre': s.nombreCompleto,
      'DNI': s.socioDni,
      'Teléfono': s.telefono || 'Sin registrar',
      'Categoría': s.categoria.toUpperCase(),
      'Estado Actual': s.estaInhabilitado ? 'INHABILITADO' : 'HABILITADO',
      'Inhabilitado Hasta': s.fechaFinSancionActual ? format(parseISO(s.fechaFinSancionActual), 'dd/MM/yyyy') : '-',
      'Total Sanciones': s.totalSanciones,
      'Nivel de Reincidencia': s.nivelLabel,
      'Última Infracción': s.ultimaSancionFecha ? format(parseISO(s.ultimaSancionFecha), 'dd/MM/yyyy') : '-',
      'Último Motivo': s.ultimaSancionMotivo,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sanciones y Reincidentes');
    XLSX.writeFile(workbook, `CAEC_Tenis_Sanciones_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

    toast({
      title: 'Excel generado',
      description: 'El reporte de sanciones y reincidentes ha sido descargado.',
    });
  };

  const kpis = data?.kpis;
  const sociosList = sociosFiltrados;
  const configClub = data?.configClub;

  return (
    <div className="space-y-6">
      {/* 1. Header y Botones de Acción */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card border border-border p-4 lg:p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Control de Sanciones y Reincidencias</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Seguimiento de ausencias QR, cancelaciones de último momento y detección de socios recurrentes
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleEjecutarControlQR}
            disabled={runningControl || readOnly}
            className="flex items-center gap-1.5 text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
            title="Revisa turnos vencidos sin validación y aplica sanciones automáticas"
          >
            {runningControl ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Zap size={15} />
            )}
            <span>Ejecutar Control QR</span>
          </Button>

          {!readOnly && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setNuevaSancionOpen(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
            >
              <Plus size={15} />
              <span>Nueva Sanción</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5"
            disabled={loading || sociosList.length === 0}
          >
            <FileDown size={15} />
            <span className="hidden sm:inline">Exportar Excel</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="p-2"
            title="Refrescar datos"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* 1.1 Controles Maestros de Políticas de Sanción (QR y Cancelación Tardía) */}
      {!readOnly && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Card: Sanciones por Validación QR */}
          <div className="bg-card border border-border rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <div className={`p-2 rounded-lg mt-0.5 ${configClub?.validacionQrActiva ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'}`}>
                <QrCode size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">Sanciones por Validación QR</span>
                  <Badge variant="outline" className={`text-[10px] font-semibold py-0 px-1.5 ${configClub?.validacionQrActiva ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                    {configClub?.validacionQrActiva ? 'Activo (Obligatorio)' : 'Inactivo (Opcional)'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {configClub?.validacionQrActiva
                    ? 'Los turnos sin escanear aplican 7 días de inhabilitación al vencer la tolerancia.'
                    : 'Validación libre: no se sanciona automáticamente a quienes no escaneen el QR.'}
                </p>
              </div>
            </div>
            <div className="flex items-center shrink-0">
              <Switch
                checked={Boolean(configClub?.validacionQrActiva)}
                disabled={togglingQr || loading}
                onCheckedChange={(val) => handleToggleConfig('validacion_qr_activa', val)}
                className="data-[state=checked]:bg-emerald-500"
              />
            </div>
          </div>

          {/* Card: Sanciones por Cancelación Tardía */}
          <div className="bg-card border border-border rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <div className={`p-2 rounded-lg mt-0.5 ${configClub?.sancionesCancelacionActiva ? 'bg-amber-500/10 text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                <CalendarX2 size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">Sanciones por Cancelación Tardía</span>
                  <Badge variant="outline" className={`text-[10px] font-semibold py-0 px-1.5 ${configClub?.sancionesCancelacionActiva ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                    {configClub?.sancionesCancelacionActiva ? 'Activo' : 'En Pausa'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                  {configClub?.sancionesCancelacionActiva
                    ? 'Cancelaciones con menos de 2 hs (si la cancha queda vacía) o menos de 30 min inhabilitan al socio.'
                    : 'Cancelaciones libres: los socios pueden cancelar turnos en cualquier momento sin penalidad.'}
                </p>
              </div>
            </div>
            <div className="flex items-center shrink-0">
              <Switch
                checked={configClub?.sancionesCancelacionActiva !== false}
                disabled={togglingCancelacion || loading}
                onCheckedChange={(val) => handleToggleConfig('sanciones_cancelacion_activa', val)}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. Barra de Búsqueda, Filtros Temporales (Mes/Día), Categoría y Selector de Vista */}
      <div className="space-y-3">
        {/* Fila 1: Filtros de Fecha (Mes, Día y Calendario) + Buscador */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3 bg-card border border-border p-3 rounded-xl">
          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Mes */}
            <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-lg px-2.5 py-1.5">
              <CalendarIcon size={14} className="text-rose-400" />
              <span className="text-xs font-semibold text-muted-foreground">Mes:</span>
              <select
                value={mesFiltro}
                onChange={(e) => {
                  const val = e.target.value;
                  setMesFiltro(val);
                  if (val === 'todos' || (diaFiltro !== 'todos' && !diaFiltro.startsWith(val))) {
                    setDiaFiltro('todos');
                  }
                }}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                <option value="todos" className="bg-card text-foreground">Todos los meses</option>
                {mesesDisponibles.map((m) => (
                  <option key={m.valor} value={m.valor} className="bg-card text-foreground capitalize">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de Día (Días con sanciones) */}
            <div className="flex items-center gap-1.5 bg-muted/40 border border-border rounded-lg px-2.5 py-1.5">
              <Clock size={14} className="text-rose-400" />
              <span className="text-xs font-semibold text-muted-foreground">Día:</span>
              <select
                value={diaFiltro}
                onChange={(e) => {
                  const val = e.target.value;
                  setDiaFiltro(val);
                  if (val !== 'todos') {
                    setMesFiltro(val.substring(0, 7));
                  }
                }}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
              >
                <option value="todos" className="bg-card text-foreground">Todos los días</option>
                {diasDisponibles.map((d) => (
                  <option key={d.valor} value={d.valor} className="bg-card text-foreground">
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Selector de fecha puntual tipo calendario */}
            <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-lg px-2 py-1" title="Elegir una fecha puntual en el calendario">
              <span className="text-[11px] text-muted-foreground">Fecha:</span>
              <input
                type="date"
                value={diaFiltro !== 'todos' ? diaFiltro : ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val) {
                    setDiaFiltro(val);
                    setMesFiltro(val.substring(0, 7));
                  } else {
                    setDiaFiltro('todos');
                  }
                }}
                className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
              />
            </div>

            {/* Resetear filtros temporales */}
            {(mesFiltro !== 'todos' || diaFiltro !== 'todos') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMesFiltro('todos');
                  setDiaFiltro('todos');
                }}
                className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 h-8 px-2"
              >
                Limpiar fecha
              </Button>
            )}
          </div>

          {/* Buscador de socio */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por socio, DNI o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-muted/20 border-border"
            />
          </div>
        </div>

        {/* Fila 2: Filtros por Categoría de Sanción + Selector de Vista */}
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          {/* Filtros por Categoría */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <Button
              variant={filtro === 'todos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltro('todos')}
              className="text-xs h-9"
            >
              Todos ({sociosList.length})
            </Button>

            <Button
              variant={filtro === 'activos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltro('activos')}
              className={`text-xs h-9 ${filtro === 'activos' ? 'bg-rose-600 hover:bg-rose-500' : 'text-rose-400 border-rose-500/30'}`}
            >
              🔴 Inhabilitados Hoy ({kpis?.totalInhabilitadosHoy || 0})
            </Button>

            <Button
              variant={filtro === 'reincidentes' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltro('reincidentes')}
              className={`text-xs h-9 ${filtro === 'reincidentes' ? 'bg-amber-600 hover:bg-amber-500' : 'text-amber-400 border-amber-500/30'}`}
            >
              ⚠️ Reincidentes 2+ ({kpis?.totalReincidentes || 0})
            </Button>

            <Button
              variant={filtro === 'criticos' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFiltro('criticos')}
              className={`text-xs h-9 ${filtro === 'criticos' ? 'bg-red-700 hover:bg-red-600' : 'text-red-400 border-red-500/30'}`}
            >
              🚨 Críticos 3+ ({kpis?.totalCriticos || 0})
            </Button>
          </div>

          {/* Selector de Vista: Por Socio vs Cronológico */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40 shrink-0">
            <button
              onClick={() => setVista('socios')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                vista === 'socios'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Por Socio ({sociosList.length})
            </button>
            <button
              onClick={() => setVista('recientes')}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                vista === 'recientes'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Línea de Tiempo ({sancionesRecientesFiltradas.length})
            </button>
          </div>
        </div>
      </div>

      {/* 4. Tabla Principal: Vista por Socio (Reincidentes) */}
      {vista === 'socios' && (
        <Card className="border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="text-xs uppercase font-bold">Socio / Datos</TableHead>
                  <TableHead className="text-xs uppercase font-bold text-center">Nivel de Reincidencia</TableHead>
                  <TableHead className="text-xs uppercase font-bold text-center">Estado Actual</TableHead>
                  <TableHead className="text-xs uppercase font-bold">Última Infracción</TableHead>
                  <TableHead className="text-xs uppercase font-bold text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-6 w-28 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-6 w-24 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : sociosList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      <ShieldCheck size={36} className="mx-auto text-emerald-400 mb-2 opacity-80" />
                      <p className="font-bold text-sm text-foreground">No se encontraron socios sancionados</p>
                      <p className="text-xs mt-1">
                        {filtro !== 'todos' || search
                          ? 'Probá ajustando los filtros o el texto de búsqueda.'
                          : '¡Excelente! No hay registros de sanciones en el sistema.'}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  sociosList.map((socio) => {
                    const isExpanded = expandedSocioDni === socio.socioDni;

                    // Semáforo visual del socio
                    let badgeClass = 'bg-zinc-800 text-zinc-300 border-zinc-700';
                    if (socio.nivelReincidencia === 'reincidente') {
                      badgeClass = 'bg-amber-950/60 border-amber-500/40 text-amber-300';
                    } else if (socio.nivelReincidencia === 'critico') {
                      badgeClass = 'bg-rose-950/80 border-rose-500/60 text-rose-300 animate-pulse font-extrabold';
                    }

                    return (
                      <>
                        <TableRow
                          key={socio.socioDni}
                          className={`hover:bg-muted/30 transition-colors ${
                            socio.estaInhabilitado ? 'bg-rose-950/5' : ''
                          }`}
                        >
                          {/* Toggle Expandir */}
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="p-1 h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => setExpandedSocioDni(isExpanded ? null : socio.socioDni)}
                              title="Ver historial detallado de sanciones"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </Button>
                          </TableCell>

                          {/* Nombre, DNI, Categoría */}
                          <TableCell>
                            <div>
                              <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                                <span>{socio.nombreCompleto}</span>
                                {socio.estaInhabilitado && (
                                  <span className="h-2 w-2 rounded-full bg-rose-500 inline-block animate-ping" />
                                )}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span>DNI: {socio.socioDni}</span>
                                <span>•</span>
                                <span className="capitalize">{socio.categoria}</span>
                                {socio.telefono && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <Phone size={11} /> {socio.telefono}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </TableCell>

                          {/* Semáforo de Reincidencia */}
                          <TableCell className="text-center">
                            <div className="flex flex-col items-center gap-1">
                              <Badge
                                variant="outline"
                                className={`px-2.5 py-1 text-xs border uppercase tracking-wider flex items-center gap-1 ${badgeClass}`}
                              >
                                {socio.nivelReincidencia === 'critico' && <Gavel size={12} />}
                                {socio.nivelReincidencia === 'reincidente' && <AlertTriangle size={12} />}
                                <span>{socio.totalSanciones} {socio.totalSanciones === 1 ? 'Sanción' : 'Sanciones'}</span>
                              </Badge>
                              {socio.esCritico && (
                                <span className="text-[10px] text-rose-400 font-bold uppercase tracking-tight">
                                  Recurrente Crítico
                                </span>
                              )}
                              {socio.nivelReincidencia === 'reincidente' && (
                                <span className="text-[10px] text-amber-400 font-medium">
                                  Reincidente
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Estado Actual (Inhabilitado vs Habilitado) */}
                          <TableCell className="text-center">
                            {socio.estaInhabilitado ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <Badge className="bg-rose-950 text-rose-300 border border-rose-500/40 text-[11px] font-bold">
                                  🔴 Inhabilitado
                                </Badge>
                                {socio.fechaFinSancionActual && (
                                  <span className="text-[10px] text-muted-foreground mt-0.5">
                                    Hasta {format(parseISO(socio.fechaFinSancionActual), 'dd/MM/yyyy')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-zinc-700 text-[11px]">
                                ⚪ Habilitado
                              </Badge>
                            )}
                          </TableCell>

                          {/* Última Infracción */}
                          <TableCell>
                            <div className="max-w-xs">
                              <p className="text-xs text-foreground font-medium flex items-center gap-1">
                                <CalendarIcon size={12} className="text-muted-foreground shrink-0" />
                                <span>
                                  {socio.ultimaSancionFecha
                                    ? format(parseISO(socio.ultimaSancionFecha), 'dd/MM/yyyy')
                                    : '-'}
                                </span>
                              </p>
                              <p className="text-[11px] text-muted-foreground italic truncate mt-0.5" title={socio.ultimaSancionMotivo}>
                                {socio.ultimaSancionMotivo}
                              </p>
                            </div>
                          </TableCell>

                          {/* Acciones */}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Botón ver historial */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-8 px-2.5"
                                onClick={() => setExpandedSocioDni(isExpanded ? null : socio.socioDni)}
                              >
                                {isExpanded ? 'Ocultar' : `Historial (${socio.totalSanciones})`}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Fila Desplegable con el Detalle Completo de Sanciones */}
                        {isExpanded && (
                          <TableRow className="bg-muted/20 hover:bg-muted/20">
                            <TableCell colSpan={6} className="p-4 pl-12">
                              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                                <div className="flex justify-between items-center border-b border-border pb-2">
                                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Clock size={14} className="text-primary" />
                                    Historial Completo de Infracciones: {socio.nombreCompleto} ({socio.sanciones.length})
                                  </h4>
                                  {socio.estaInhabilitado && !readOnly && (
                                    <span className="text-[11px] text-rose-400 font-semibold">
                                      * Podés levantar sanciones activas haciendo clic en &quot;Habilitar&quot;
                                    </span>
                                  )}
                                </div>

                                <div className="overflow-x-auto">
                                  <Table>
                                    <TableHeader>
                                      <TableRow className="border-border">
                                        <TableHead className="text-[11px] font-bold">Fecha Sanción</TableHead>
                                        <TableHead className="text-[11px] font-bold">Vigencia (Hasta)</TableHead>
                                        <TableHead className="text-[11px] font-bold">Motivo de Infracción</TableHead>
                                        <TableHead className="text-[11px] font-bold">Turno Afectado</TableHead>
                                        <TableHead className="text-[11px] font-bold text-center">Estado</TableHead>
                                        {!readOnly && (
                                          <TableHead className="text-[11px] font-bold text-right">Acción</TableHead>
                                        )}
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {socio.sanciones.map((sancion) => (
                                        <TableRow key={sancion.id} className="border-border/60">
                                          <TableCell className="text-xs font-medium">
                                            {format(parseISO(sancion.fechaInicio), 'dd/MM/yyyy')}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            <span className={sancion.esVigente ? 'font-bold text-rose-400' : 'text-muted-foreground'}>
                                              {format(parseISO(sancion.fechaFin), 'dd/MM/yyyy')}
                                            </span>
                                          </TableCell>
                                          <TableCell className="text-xs max-w-sm">
                                            <p className="text-foreground leading-snug">{sancion.motivo}</p>
                                          </TableCell>
                                          <TableCell className="text-xs text-muted-foreground">
                                            {sancion.turno ? (
                                              <span>{sancion.turno.canchaNombre} ({sancion.turno.horario})</span>
                                            ) : (
                                              <span>-</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-center">
                                            {sancion.esVigente ? (
                                              <Badge className="bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px]">
                                                Vigente
                                              </Badge>
                                            ) : sancion.activa ? (
                                              <Badge variant="outline" className="text-zinc-400 text-[10px]">
                                                Cumplida
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
                                                Perdonada
                                              </Badge>
                                            )}
                                          </TableCell>
                                          {!readOnly && (
                                            <TableCell className="text-right">
                                              <div className="flex items-center justify-end gap-1.5">
                                                {sancion.activa && (
                                                  <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="text-[11px] h-7 px-2.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-500/30"
                                                    onClick={() => {
                                                      setSancionToLevantar(sancion);
                                                      setSocioTarget(socio);
                                                    }}
                                                    title="Levantar sanción y permitirle reservar"
                                                  >
                                                    Habilitar
                                                  </Button>
                                                )}
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                                                  onClick={() => setSancionToDelete({
                                                    id: sancion.id,
                                                    socioNombre: socio.nombreCompleto,
                                                    socioDni: socio.socioDni,
                                                    motivo: sancion.motivo,
                                                    fechaInicio: sancion.fechaInicio,
                                                  })}
                                                  title="Eliminar sanción permanentemente del historial"
                                                >
                                                  <Trash2 size={13} />
                                                </Button>
                                              </div>
                                            </TableCell>
                                          )}
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* 5. Tabla Secundaria: Vista Cronológica / Últimas Sanciones */}
      {vista === 'recientes' && (
        <Card className="border-border overflow-hidden shadow-sm">
          <CardHeader className="py-3 px-4 bg-muted/40 border-b border-border">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Últimas 20 Sanciones Aplicadas en el Club
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase font-bold">Fecha</TableHead>
                  <TableHead className="text-xs uppercase font-bold">Socio / DNI</TableHead>
                  <TableHead className="text-xs uppercase font-bold">Motivo de Infracción</TableHead>
                  <TableHead className="text-xs uppercase font-bold">Cancha / Turno</TableHead>
                  <TableHead className="text-xs uppercase font-bold">Vence</TableHead>
                  <TableHead className="text-xs uppercase font-bold text-center">Estado</TableHead>
                  {!readOnly && (
                    <TableHead className="text-xs uppercase font-bold text-right">Acción</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-60" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : sancionesRecientesFiltradas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                      No hay sanciones registradas para el período o día seleccionado.
                    </TableCell>
                  </TableRow>
                ) : (
                  sancionesRecientesFiltradas.map((item) => (
                    <TableRow key={item.id} className="border-border">
                      <TableCell className="text-xs font-medium">
                        {format(parseISO(item.fechaInicio), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-xs">
                        <p className="font-bold text-foreground">{item.socioNombre}</p>
                        <p className="text-[11px] text-muted-foreground">DNI {item.socioDni}</p>
                      </TableCell>
                      <TableCell className="text-xs max-w-sm">
                        <p className="leading-snug">{item.motivo}</p>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.canchaNombre} {item.horario && `(${item.horario})`}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {format(parseISO(item.fechaFin), 'dd/MM/yyyy')}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.esVigente ? (
                          <Badge className="bg-rose-950 text-rose-300 border border-rose-500/40 text-[10px]">
                            Vigente
                          </Badge>
                        ) : item.activa ? (
                          <Badge variant="outline" className="text-zinc-400 text-[10px]">
                            Cumplida
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 text-[10px]">
                            Perdonada
                          </Badge>
                        )}
                      </TableCell>
                      {!readOnly && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40"
                            onClick={() => setSancionToDelete({
                              id: item.id,
                              socioNombre: item.socioNombre,
                              socioDni: item.socioDni,
                              motivo: item.motivo,
                              fechaInicio: item.fechaInicio,
                            })}
                            title="Eliminar sanción permanentemente del historial"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* 5. KPI compacto al pie */}
      <div className="border border-border rounded-xl bg-card px-4 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground uppercase tracking-wider text-[10px] mr-1">Métricas globales:</span>

        <span className="flex items-center gap-1">
          <ShieldAlert size={12} className="text-rose-400" />
          <span className="font-bold text-foreground">{kpis?.totalInhabilitadosHoy ?? 0}</span>
          <span>inhabilitados hoy</span>
        </span>

        <span className="flex items-center gap-1">
          <AlertTriangle size={12} className="text-amber-400" />
          <span className="font-bold text-amber-400">{kpis?.totalReincidentes ?? 0}</span>
          <span>reincidentes (2+)</span>
        </span>

        <span className="flex items-center gap-1">
          <Gavel size={12} className="text-red-400" />
          <span className="font-bold text-red-400">{kpis?.totalCriticos ?? 0}</span>
          <span>críticos (3+)</span>
        </span>

        <span className="flex items-center gap-1">
          <Users size={12} className="text-foreground" />
          <span className="font-bold text-foreground">{kpis?.totalSancionesHistoricas ?? 0}</span>
          <span>históricas</span>
          {(kpis?.sancionesMesActual ?? 0) > 0 && (
            <span className="text-muted-foreground">({kpis?.sancionesMesActual} este mes)</span>
          )}
        </span>
      </div>

      {/* 6. Modal para Levantar Sanción */}
      <Dialog open={!!sancionToLevantar} onOpenChange={(open) => { if (!open) setSancionToLevantar(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-400">
              <ShieldCheck size={20} />
              <span>Levantar Inhabilitación</span>
            </DialogTitle>
            <DialogDescription>
              Permite habilitar nuevamente a un socio antes de que expire el plazo de sanción por motivos excepcionales (lluvia, enfermedad, error justificado).
            </DialogDescription>
          </DialogHeader>

          {sancionToLevantar && socioTarget && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted/40 rounded-xl border border-border text-xs space-y-1">
                <p><strong>Socio:</strong> {socioTarget.nombreCompleto} (DNI: {socioTarget.socioDni})</p>
                <p><strong>Infracción:</strong> {sancionToLevantar.motivo}</p>
                <p><strong>Vigencia original:</strong> Hasta el {format(parseISO(sancionToLevantar.fechaFin), 'dd/MM/yyyy')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivoLevantamiento" className="text-xs font-semibold">
                  Motivo de la excepción / justificación:
                </Label>
                <Input
                  id="motivoLevantamiento"
                  placeholder="Ej: Justificación médica / Lluvia comprobada..."
                  value={motivoLevantamiento}
                  onChange={(e) => setMotivoLevantamiento(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSancionToLevantar(null)}
              disabled={submittingLevantar}
            >
              Cancelar
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirmLevantar}
              disabled={submittingLevantar}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              {submittingLevantar ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Habilitando...
                </>
              ) : (
                'Confirmar y Habilitar Socio'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Modal para Aplicar Sanción Extraordinaria Manual */}
      <Dialog open={nuevaSancionOpen} onOpenChange={setNuevaSancionOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleCreateSancionManual}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <Gavel size={20} className="text-rose-500" />
                <span>Aplicar Sanción Extraordinaria</span>
              </DialogTitle>
              <DialogDescription>
                Aplica una inhabilitación manual a un socio por resolución de la Subcomisión (reincidencia grave o falta disciplinaria).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="dniInput" className="text-xs font-semibold">
                  DNI del Socio a sancionar:
                </Label>
                <Input
                  id="dniInput"
                  placeholder="Ej: 28456789"
                  value={inputDni}
                  onChange={(e) => setInputDni(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="diasInput" className="text-xs font-semibold">
                  Días de inhabilitación (sin poder reservar):
                </Label>
                <Input
                  id="diasInput"
                  type="number"
                  min="1"
                  max="180"
                  value={inputDias}
                  onChange={(e) => setInputDias(Number(e.target.value))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="motivoInput" className="text-xs font-semibold">
                  Motivo o Resolución de Subcomisión:
                </Label>
                <Input
                  id="motivoInput"
                  placeholder="Ej: Reincidencia crítica por reiteradas ausencias no justificadas..."
                  value={inputMotivo}
                  onChange={(e) => setInputMotivo(e.target.value)}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setNuevaSancionOpen(false)}
                disabled={submittingNueva}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submittingNueva}
                className="bg-rose-600 hover:bg-rose-500 text-white"
              >
                {submittingNueva ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                    Aplicando...
                  </>
                ) : (
                  'Aplicar Sanción'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 8. Modal para Confirmar Eliminación Definitiva de Sanción */}
      <Dialog open={!!sancionToDelete} onOpenChange={(open) => { if (!open) setSancionToDelete(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-500">
              <Trash2 size={20} />
              <span>¿Eliminar Sanción del Historial?</span>
            </DialogTitle>
            <DialogDescription>
              Esta acción borrará permanentemente la sanción de la base de datos y limpiará el historial del socio. Si la sanción estaba vigente, el socio quedará habilitado de inmediato.
            </DialogDescription>
          </DialogHeader>

          {sancionToDelete && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-rose-500/10 rounded-xl border border-rose-500/20 text-rose-200 space-y-1">
                <p><strong>Socio:</strong> {sancionToDelete.socioNombre} (DNI: {sancionToDelete.socioDni})</p>
                <p><strong>Fecha sanción:</strong> {format(parseISO(sancionToDelete.fechaInicio), 'dd/MM/yyyy')}</p>
                <p><strong>Motivo:</strong> {sancionToDelete.motivo}</p>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                Esta acción no se puede deshacer. Se registrará en la auditoría del club.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSancionToDelete(null)}
              disabled={submittingDelete}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={submittingDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {submittingDelete ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-1.5" />
                  Borrando...
                </>
              ) : (
                'Eliminar definitivamente'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
