'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  RefreshCcw, 
  AlertTriangle, 
  CheckCircle2, 
  Printer, 
  QrCode, 
  ExternalLink, 
  CalendarIcon,
  Plus,
  Pencil,
  Trash2,
  DollarSign,
  Users,
  TrendingUp,
  ClipboardList,
  Copy,
  Check,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  BarChart3,
  FileDown,
  Download
} from 'lucide-react';
import { exportSemanaPDF, exportMesPDF, exportMesExcel, exportClasesExcel } from '@/lib/clases-profe-export';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameDay, 
  addWeeks, 
  subWeeks 
} from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface Cuota {
  id: string;
  mes: string;
  estado: string;
}

interface Socio {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  estado: string;
  categoria: string;
  cuotas?: Cuota[];
}

interface Asistencia {
  id: string;
  socioId: string;
  fecha: string;
  socio: Socio;
}

interface ReporteSocio {
  socio: Socio;
  totalClases: number;
}

interface RegistroProfe {
  id: string;
  fecha: string;
  fechaFormateada?: string;
  cantidadClases?: number;
  cantidadAlumnos: number;
  precioTotal: number;
  observaciones?: string;
  createdAt?: string;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];



function generateMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = `${MESES[month]} ${year}`;
    options.push({ value, label });
  }
  return options;
}
const monthOptions = generateMonthOptions();

export default function AsistenciasTable({ readOnly = false }: { readOnly?: boolean } = {}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('profe'); // Default a Planilla Profesor
  const [qrType, setQrType] = useState<'profe' | 'alumnos'>('profe');
  const [copiedLink, setCopiedLink] = useState(false);

  // Estados para alumnos (DNI)
  const [asistenciasDiarias, setAsistenciasDiarias] = useState<Asistencia[]>([]);
  const [asistenciasMensuales, setAsistenciasMensuales] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para registros del profesor
  const [registrosProfeMensual, setRegistrosProfeMensual] = useState<RegistroProfe[]>([]);
  const [registroProfeDiario, setRegistroProfeDiario] = useState<RegistroProfe | null>(null);
  const [loadingProfe, setLoadingProfe] = useState(false);

  // Selectores de fecha
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [currentWeekDate, setCurrentWeekDate] = useState<Date>(new Date());

  // Estado del Modal de carga manual / edición de clase
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<RegistroProfe | null>(null);

  // Campos del formulario modal
  const [formFecha, setFormFecha] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [formClases, setFormClases] = useState<string>('1');
  const [formAlumnos, setFormAlumnos] = useState<string>('');
  const [formPrecio, setFormPrecio] = useState<string>('');
  const [formObservaciones, setFormObservaciones] = useState<string>('');
  const [submittingModal, setSubmittingModal] = useState<boolean>(false);

  // URLs públicas
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const asistenciaUrl = `${origin}/asistencia`;
  const profeUrl = `${origin}/profe`;

  const currentUrl = qrType === 'profe' ? profeUrl : asistenciaUrl;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentUrl)}&margin=10`;

  // Fetch asistencias diarias de alumnos con DNI
  const fetchAsistenciasDiarias = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const res = await fetch(`/api/asistencias?fecha=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setAsistenciasDiarias(data);
      }
    } catch (error) {
      console.error('Error fetching asistencias diarias', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch registro del profesor para la fecha diaria seleccionada
  const fetchRegistroProfeDiario = useCallback(async (date: Date) => {
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const res = await fetch(`/api/clases-profe?fecha=${dateStr}`);
      if (res.ok) {
        const data: RegistroProfe[] = await res.json();
        setRegistroProfeDiario(data.length > 0 ? data[0] : null);
      }
    } catch (error) {
      console.error('Error fetching registro profe diario', error);
    }
  }, []);

  // Fetch asistencias mensuales de alumnos
  const fetchAsistenciasMensuales = useCallback(async (monthStr: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/asistencias?mes=${monthStr}`);
      if (res.ok) {
        const data = await res.json();
        setAsistenciasMensuales(data);
      }
    } catch (error) {
      console.error('Error fetching asistencias mensuales', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch registros del profesor para el mes seleccionado
  const fetchRegistrosProfeMensual = useCallback(async (monthStr: string) => {
    setLoadingProfe(true);
    try {
      const res = await fetch(`/api/clases-profe?mes=${monthStr}`);
      if (res.ok) {
        const data = await res.json();
        setRegistrosProfeMensual(data);
      }
    } catch (error) {
      console.error('Error fetching registros profe mensual', error);
    } finally {
      setLoadingProfe(false);
    }
  }, []);

  // Carga según pestaña activa
  useEffect(() => {
    if (activeTab === 'diaria') {
      fetchAsistenciasDiarias(selectedDate);
      fetchRegistroProfeDiario(selectedDate);
    } else if (activeTab === 'profe') {
      fetchRegistrosProfeMensual(selectedMonth);
      fetchRegistroProfeDiario(selectedDate);
    } else if (activeTab === 'mensual') {
      fetchAsistenciasMensuales(selectedMonth);
      fetchRegistrosProfeMensual(selectedMonth);
    }
  }, [
    activeTab, 
    selectedDate, 
    selectedMonth, 
    fetchAsistenciasDiarias, 
    fetchRegistroProfeDiario, 
    fetchRegistrosProfeMensual, 
    fetchAsistenciasMensuales
  ]);

  // Polling para el día actual
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'diaria' || activeTab === 'profe') {
      const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      if (isToday) {
        interval = setInterval(() => {
          fetchRegistroProfeDiario(selectedDate);
        }, 30000);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, selectedDate, fetchRegistroProfeDiario]);

  // Helper de alertas de socio
  const getAlertasSocio = (socio: Socio) => {
    const alertas: string[] = [];
    if (socio.estado === 'inactivo') alertas.push('Inactivo');
    const hoy = new Date();
    const mesesAdeudados = (socio.cuotas || []).filter((c: any) => {
      if (c.estado === 'pagado') return false;
      const [anio, mes] = c.mes.split('-');
      const vencimiento = new Date(parseInt(anio), parseInt(mes), 1); 
      return hoy >= vencimiento;
    }).length;
    if (mesesAdeudados >= 4) alertas.push(`Debe ${mesesAdeudados} cuotas`);
    return alertas;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopiedLink(true);
    toast({
      title: 'Enlace copiado',
      description: 'El link directo fue copiado al portapapeles.',
    });
    setTimeout(() => setCopiedLink(false), 2500);
  };

  function handlePrintQr() {
    const win = window.open('', '_blank');
    if (!win) return;
    const isProfe = qrType === 'profe';
    const title = isProfe ? '🎾 Planilla Diaria de Clases - CAEC Tenis' : '🎾 CAEC - Asistencia a Clases';
    const subtitle = isProfe
      ? 'Escaneá para cargar la cantidad de alumnos y recaudación del día'
      : 'Escaneá este código para registrar tu asistencia';
    const printUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentUrl)}&margin=10`;

    win.document.write(
      '<!DOCTYPE html><html><head><title>' + title + '</title>' +
      '<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;}' +
      'h1{font-size:26px;margin-bottom:8px;color:#111;text-align:center;}p{color:#555;margin-bottom:24px;font-size:16px;text-align:center;}' +
      'img{border:4px solid #FFCC00;border-radius:14px;padding:8px;}.url{margin-top:16px;font-size:14px;color:#888;word-break:break-all;font-family:monospace;}</style>' +
      '</head><body>' +
      '<h1>' + title + '</h1>' +
      '<p>' + subtitle + '</p>' +
      '<img src="' + printUrl + '" />' +
      '<p class="url">' + currentUrl + '</p>' +
      '</body></html>'
    );
    win.document.close();
    win.onload = () => win.print();
  }

  // Mapa de registros por fecha (YYYY-MM-DD) para acceso O(1)
  const registrosMap = useMemo(() => {
    const map = new Map<string, RegistroProfe>();
    registrosProfeMensual.forEach((r) => {
      const fechaKey = r.fecha.split('T')[0];
      map.set(fechaKey, r);
    });
    return map;
  }, [registrosProfeMensual]);

  // Días de la semana actual (Lunes a Domingo)
  const daysOfCurrentWeek = useMemo(() => {
    const start = startOfWeek(currentWeekDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentWeekDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentWeekDate]);

  // Cálculos de la semana actual
  const semanaStats = useMemo(() => {
    let alumnos = 0;
    let total = 0;
    let diasConClase = 0;
    let clases = 0;

    daysOfCurrentWeek.forEach((day) => {
      const key = format(day, 'yyyy-MM-dd');
      const reg = registrosMap.get(key);
      if (reg) {
        alumnos += reg.cantidadAlumnos;
        total += reg.precioTotal;
        diasConClase += 1;
        clases += reg.cantidadClases ?? 1;
      }
    });

    return { alumnos, total, diasConClase, clases };
  }, [daysOfCurrentWeek, registrosMap]);

  // Cálculos del día seleccionado
  const selectedDayKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayRecord = registrosMap.get(selectedDayKey) || registroProfeDiario;

  // Cálculos del mes
  const totalRecaudadoMes = useMemo(() => {
    return registrosProfeMensual.reduce((acc, r) => acc + r.precioTotal, 0);
  }, [registrosProfeMensual]);

  const totalAlumnosMes = useMemo(() => {
    return registrosProfeMensual.reduce((acc, r) => acc + r.cantidadAlumnos, 0);
  }, [registrosProfeMensual]);

  const totalClasesMes = useMemo(() => {
    return registrosProfeMensual.reduce((acc, r) => acc + (r.cantidadClases ?? 1), 0);
  }, [registrosProfeMensual]);
  const totalDiasConClaseMes = registrosProfeMensual.length;



  // Modal ABM helpers (clases, alumnos, precio, fecha y observaciones)
  const handleOpenCreateModal = (presetDate?: string) => {
    if (readOnly) return;
    setEditingRegistro(null);
    setFormFecha(presetDate || format(selectedDate, 'yyyy-MM-dd'));
    setFormClases('1');
    setFormAlumnos('');
    setFormPrecio('');
    setFormObservaciones('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (registro: RegistroProfe) => {
    if (readOnly) return;
    setEditingRegistro(registro);
    setFormFecha(registro.fecha.split('T')[0]);
    setFormClases(String(registro.cantidadClases ?? 1));
    setFormAlumnos(String(registro.cantidadAlumnos));
    setFormPrecio(String(registro.precioTotal));
    setFormObservaciones(registro.observaciones || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const clasesNum = parseInt(formClases, 10);
    const alumnosNum = parseInt(formAlumnos, 10);
    const precioNum = parseFloat(formPrecio.replace(/\./g, '').replace(',', '.'));

    if (isNaN(clasesNum) || clasesNum < 1) {
      toast({ title: 'Error', description: 'Cantidad de clases inválida (mínimo 1)', variant: 'destructive' });
      return;
    }
    if (isNaN(alumnosNum) || alumnosNum < 0) {
      toast({ title: 'Error', description: 'Cantidad de alumnos inválida', variant: 'destructive' });
      return;
    }
    if (isNaN(precioNum) || precioNum < 0) {
      toast({ title: 'Error', description: 'Precio total inválido', variant: 'destructive' });
      return;
    }

    setSubmittingModal(true);
    try {
      const isEditing = !!editingRegistro;
      const url = '/api/clases-profe';
      const method = isEditing ? 'PUT' : 'POST';
      const body = {
        id: editingRegistro?.id,
        fecha: formFecha,
        cantidadClases: clasesNum,
        cantidadAlumnos: alumnosNum,
        precioTotal: precioNum,
        observaciones: formObservaciones.trim() || null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al guardar el registro');
      }

      toast({
        title: isEditing ? 'Registro actualizado' : 'Registro guardado',
        description: 'La planilla del día fue actualizada correctamente.',
      });

      setIsModalOpen(false);
      fetchRegistrosProfeMensual(selectedMonth);
      fetchRegistroProfeDiario(selectedDate);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo guardar la planilla.',
        variant: 'destructive',
      });
    } finally {
      setSubmittingModal(false);
    }
  };

  const handleDeleteRegistro = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este registro del día?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/clases-profe?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('No se pudo eliminar el registro');

      toast({
        title: 'Registro eliminado',
        description: 'El registro del día fue eliminado.',
      });

      fetchRegistrosProfeMensual(selectedMonth);
      fetchRegistroProfeDiario(selectedDate);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Exportar Informe Semanal en PDF para Comisión Directiva
  const handleExportSemanaPDF = async () => {
    try {
      await exportSemanaPDF(daysOfCurrentWeek, registrosMap, semanaStats);
      toast({
        title: 'Informe Semanal generado',
        description: 'Se descargó el PDF oficial con firmas para Comisión Directiva.',
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error al exportar PDF',
        description: err.message || 'No se pudo generar el documento.',
        variant: 'destructive',
      });
    }
  };

  // Exportar Informe Mensual en PDF para Comisión Directiva
  const handleExportMesPDF = async () => {
    try {
      await exportMesPDF(selectedMonth, registrosProfeMensual, undefined, {
        totalAlumnos: totalAlumnosMes,
        totalRecaudado: totalRecaudadoMes,
        totalClases: totalClasesMes,
        totalDiasConClase: totalDiasConClaseMes,
      });
      toast({
        title: 'Informe Mensual generado',
        description: 'Se descargó el PDF oficial del mes para Comisión Directiva.',
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error al exportar PDF',
        description: err.message || 'No se pudo generar el documento.',
        variant: 'destructive',
      });
    }
  };

  // Exportar Mes a Excel (.xlsx) con desglose semanal
  const handleExportMesExcel = () => {
    try {
      exportMesExcel(selectedMonth, registrosProfeMensual, {
        totalAlumnos: totalAlumnosMes,
        totalRecaudado: totalRecaudadoMes,
        totalClases: totalClasesMes,
        totalDiasConClase: totalDiasConClaseMes,
      });
      toast({
        title: 'Planilla Excel generada',
        description: 'Se descargó el archivo .xlsx con el desglose semanal del mes.',
      });
    } catch (err: any) {
      toast({
        title: 'Error al exportar Excel',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  // Reporte agrupado de alumnos
  const reporteAgrupado = asistenciasMensuales.reduce((acc: Record<string, ReporteSocio>, asistencia) => {
    if (!acc[asistencia.socio.id]) {
      acc[asistencia.socio.id] = { socio: asistencia.socio, totalClases: 0 };
    }
    acc[asistencia.socio.id].totalClases += 1;
    return acc;
  }, {});

  const reporteArray = Object.values(reporteAgrupado).sort((a, b) => 
    a.socio.apellido.localeCompare(b.socio.apellido)
  );

  return (
    <div className="space-y-5">
      {/* Panel Superior: Acceso Rápido y QR para Alumnos y Profesor */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-5 shadow-lg print:hidden">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="flex-shrink-0 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageUrl}
              alt="Código QR"
              width={130}
              height={130}
              className="rounded-xl border-2 border-[#FFCC00]/60 shadow-md bg-white p-1"
            />
            <div className="flex rounded-lg bg-[#2A2A2A] p-0.5 mt-2 border border-[#383838]">
              <button
                type="button"
                onClick={() => setQrType('profe')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all',
                  qrType === 'profe'
                    ? 'bg-[#FFCC00] text-[#121212] shadow'
                    : 'text-[#999999] hover:text-white'
                )}
              >
                QR Profe
              </button>
              <button
                type="button"
                onClick={() => setQrType('alumnos')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all',
                  qrType === 'alumnos'
                    ? 'bg-[#FFCC00] text-[#121212] shadow'
                    : 'text-[#999999] hover:text-white'
                )}
              >
                QR Alumnos
              </button>
            </div>
          </div>

          <div className="flex-1 text-center lg:text-left">
            <div className="flex items-center gap-2 justify-center lg:justify-start mb-1.5">
              <QrCode className="h-5 w-5 text-[#FFCC00]" />
              <h3 className="text-white text-base font-bold">
                {qrType === 'profe' 
                  ? 'Página del Profesor · Carga Diaria de Clases' 
                  : 'Página de Alumnos · Asistencia a Clases'}
              </h3>
              <Badge variant="outline" className="text-[10px] bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/30 font-bold uppercase">
                Pública · Sin Login
              </Badge>
            </div>

            <p className="text-[#AAAAAA] text-xs mb-2 leading-relaxed">
              {qrType === 'profe'
                ? 'El profesor ingresa a este link todos los días para registrar los alumnos que tuvo y el total recaudado del día.'
                : 'Los alumnos escanean el código con su celular e ingresan su DNI para marcar su presente.'}
            </p>

            <div className="inline-flex items-center gap-2 bg-[#121212] px-3 py-1.5 rounded-lg border border-[#333333] text-[12px] font-mono text-[#CCCCCC] mb-3 max-w-full overflow-hidden text-ellipsis">
              <span className="truncate">{currentUrl}</span>
            </div>

            <div className="flex gap-2 flex-wrap justify-center lg:justify-start">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyLink}
                className="border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
              >
                {copiedLink ? <Check className="h-3.5 w-3.5 mr-1.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
                {copiedLink ? 'Copiado!' : 'Copiar Link'}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handlePrintQr}
                className="border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
              >
                <Printer className="h-3.5 w-3.5 mr-1.5" />
                Imprimir QR
              </Button>

              <Button
                size="sm"
                onClick={() => window.open(currentUrl, '_blank')}
                className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] h-8 text-xs font-bold shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir en nueva pestaña
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#1E1E1E] border border-[#333333] p-1 h-12 mb-4 grid grid-cols-3 w-full max-w-2xl print:hidden">
          <TabsTrigger 
            value="profe" 
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-xs sm:text-sm font-semibold h-10 px-2 sm:px-3 rounded-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 overflow-hidden"
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="truncate">Planilla y Reportes</span>
          </TabsTrigger>
          <TabsTrigger 
            value="diaria" 
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-xs sm:text-sm font-semibold h-10 px-2 sm:px-3 rounded-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 overflow-hidden"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="truncate">Presentes Diarios</span>
          </TabsTrigger>
          <TabsTrigger 
            value="mensual"
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-xs sm:text-sm font-semibold h-10 px-2 sm:px-3 rounded-md transition-all flex items-center justify-center gap-1.5 sm:gap-2 overflow-hidden"
          >
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">Alumnos Mensual</span>
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            TAB 1: PLANILLA Y REPORTE: DÍA, SEMANA Y MES (REPORTE PRINCIPAL)
           ========================================================================= */}
        <TabsContent value="profe" className="m-0 space-y-5 focus-visible:outline-none">
          {/* Header con Filtro de Mes y Botones */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-white text-base font-bold flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#FFCC00]" />
                Control de Clases · Alumnos y Recaudación Diaria
              </h3>
              <p className="text-[#999999] text-xs mt-0.5">
                Seguimiento de concurrencia y valor total por día, semana y mes
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 text-xs bg-[#2A2A2A] border-[#383838] text-white focus:ring-[#FFCC00] w-[160px]">
                  <SelectValue placeholder="Seleccionar mes" />
                </SelectTrigger>
                <SelectContent className="bg-[#1E1E1E] border-[#333333] text-white">
                  {monthOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="focus:bg-[#333333] focus:text-white">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Botón Exportar Semana */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportSemanaPDF}
                className="border-[#FFCC00]/50 text-[#FFCC00] hover:bg-[#FFCC00]/10 hover:text-white h-8 text-xs font-semibold"
                title="Descargar informe semanal oficial en PDF para Comisión Directiva"
              >
                <FileDown className="h-3.5 w-3.5 mr-1" />
                Semana (PDF)
              </Button>

              {/* Botón Exportar Mes */}
              <Button
                size="sm"
                variant="outline"
                onClick={handleExportMesPDF}
                className="border-[#FFCC00]/50 text-[#FFCC00] hover:bg-[#FFCC00]/10 hover:text-white h-8 text-xs font-semibold"
                title="Descargar informe mensual oficial en PDF para Comisión Directiva"
              >
                <FileDown className="h-3.5 w-3.5 mr-1" />
                Mes (PDF)
              </Button>

              {!readOnly && (
                <Button
                  size="sm"
                  onClick={() => handleOpenCreateModal()}
                  className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] h-8 text-xs font-bold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Cargar Día
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchRegistrosProfeMensual(selectedMonth)}
                disabled={loadingProfe}
                className="border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
              >
                <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${loadingProfe ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>
          </div>

          {/* =====================================================================
              BLOQUE DE MÉTRICAS COMPARATIVAS: DÍA, SEMANA Y MES
             ===================================================================== */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. EN EL DÍA (HOY O SELECCIONADO) */}
            <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#FFCC00]/5 rounded-bl-full pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold text-[#FFCC00] tracking-wider flex items-center gap-1.5">
                    <CalendarIcon className="w-3.5 h-3.5" /> En el Día
                  </span>
                  <span className="text-[11px] text-[#888888] capitalize">
                    {format(selectedDate, 'EEEE dd/MM', { locale: es })}
                  </span>
                </div>

                {selectedDayRecord ? (
                  <div className="space-y-1.5">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-bold text-[#FFCC00] bg-[#FFCC00]/10 px-2 py-0.5 rounded border border-[#FFCC00]/20">
                          {selectedDayRecord.cantidadClases ?? 1} {(selectedDayRecord.cantidadClases ?? 1) === 1 ? 'clase' : 'clases'}
                        </span>
                        <span className="text-2xl font-extrabold text-white">
                          {selectedDayRecord.cantidadAlumnos} <span className="text-xs font-normal text-[#888888]">alumnos</span>
                        </span>
                      </div>
                      <span className="text-xl font-extrabold text-emerald-400">
                        $ {selectedDayRecord.precioTotal.toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#888888] flex items-center justify-between pt-1 border-t border-[#2C2C2C]">
                      <span>Total de clases:</span>
                      <span className="font-semibold text-[#FFCC00]">
                        {selectedDayRecord.cantidadClases ?? 1} {(selectedDayRecord.cantidadClases ?? 1) === 1 ? 'clase dictada' : 'clases dictadas'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center space-y-1">
                    <p className="text-xs text-[#888888]">Sin planilla cargada para este día</p>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleOpenCreateModal(format(selectedDate, 'yyyy-MM-dd'))}
                        className="text-xs text-[#FFCC00] hover:underline font-semibold"
                      >
                        + Cargar este día
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 text-[10px] text-[#666666]">
                Podés elegir otra fecha en el calendario inferior
              </div>
            </div>

            {/* 2. EN LA SEMANA */}
            <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1.5">
                    <CalendarDays className="w-3.5 h-3.5" /> En la Semana
                  </span>
                  <span className="text-[11px] text-[#888888]">
                    {format(daysOfCurrentWeek[0], 'dd/MM')} al {format(daysOfCurrentWeek[6], 'dd/MM')}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                        {semanaStats.clases} {semanaStats.clases === 1 ? 'clase' : 'clases'}
                      </span>
                      <span className="text-2xl font-extrabold text-white">
                        {semanaStats.alumnos} <span className="text-xs font-normal text-[#888888]">alumnos</span>
                      </span>
                    </div>
                    <span className="text-xl font-extrabold text-emerald-400">
                      $ {semanaStats.total.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#888888] flex items-center justify-between pt-1 border-t border-[#2C2C2C]">
                    <span>Días con actividad:</span>
                    <span className="font-semibold text-white">
                      {semanaStats.diasConClase} de 7 días
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-[#666666]">
                Desglose diario detallado abajo en la grilla semanal
              </div>
            </div>

            {/* 3. EN EL MES */}
            <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex flex-col justify-between shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full pointer-events-none" />
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> En el Mes
                  </span>
                  <span className="text-[11px] text-[#888888]">
                    {format(new Date(selectedMonth + '-01T00:00:00'), 'MMMM yyyy', { locale: es })}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                        {totalClasesMes} {totalClasesMes === 1 ? 'clase' : 'clases'}
                      </span>
                      <span className="text-2xl font-extrabold text-white">
                        {totalAlumnosMes} <span className="text-xs font-normal text-[#888888]">alumnos</span>
                      </span>
                    </div>
                    <span className="text-xl font-extrabold text-emerald-400">
                      $ {totalRecaudadoMes.toLocaleString('es-AR')}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#888888] flex items-center justify-between pt-1 border-t border-[#2C2C2C]">
                    <span>Días con clases:</span>
                    <span className="font-semibold text-white">
                      {totalDiasConClaseMes} {totalDiasConClaseMes === 1 ? 'día con actividad' : 'días con actividad'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-[#666666]">
                Total mensual: {totalClasesMes} clases y {totalAlumnosMes} alumnos registrados
              </div>
            </div>
          </div>

          {/* =====================================================================
              GRILLA SEMANAL POR DÍA DE LA SEMANA (LUNES A DOMINGO)
             ===================================================================== */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 sm:p-5 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#2C2C2C]">
              <div>
                <h4 className="text-white text-sm font-bold flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-[#FFCC00]" />
                  Desglose Semanal por Día de la Semana
                </h4>
                <p className="text-[#888888] text-xs">
                  Semana del {format(daysOfCurrentWeek[0], 'dd/MM/yyyy')} al {format(daysOfCurrentWeek[6], 'dd/MM/yyyy')}
                </p>
              </div>

              {/* Navegación y Exportación entre semanas */}
              <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekDate(subWeeks(currentWeekDate, 1))}
                  className="h-8 px-2 border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white text-xs"
                  title="Semana anterior"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Ant.
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekDate(new Date())}
                  className="h-8 text-xs border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white"
                >
                  Esta Semana
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentWeekDate(addWeeks(currentWeekDate, 1))}
                  className="h-8 px-2 border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white text-xs"
                  title="Semana siguiente"
                >
                  Sig. <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportSemanaPDF}
                  className="h-8 text-xs border-[#FFCC00]/50 text-[#FFCC00] hover:bg-[#FFCC00]/10 hover:text-white font-semibold"
                  title="Descargar informe semanal para presentar en Comisión Directiva"
                >
                  <FileDown className="w-3.5 h-3.5 mr-1" />
                  PDF Semana
                </Button>
              </div>
            </div>

            {/* Grilla de 7 Días de la Semana */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 pt-1">
              {daysOfCurrentWeek.map((day) => {
                const dayKey = format(day, 'yyyy-MM-dd');
                const reg = registrosMap.get(dayKey);
                const isSelected = isSameDay(day, selectedDate);
                const isToday = isSameDay(day, new Date());

                return (
                  <div
                    key={dayKey}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      'rounded-xl border p-3 flex flex-col justify-between cursor-pointer transition-all',
                      isSelected
                        ? 'bg-[#282828] border-[#FFCC00] shadow-md ring-1 ring-[#FFCC00]/50'
                        : reg
                        ? 'bg-[#222222] border-[#383838] hover:border-[#555]'
                        : 'bg-[#181818] border-[#2A2A2A] hover:border-[#383838] opacity-70 hover:opacity-100'
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn(
                          'text-xs font-bold uppercase',
                          isToday ? 'text-[#FFCC00]' : 'text-[#AAAAAA]'
                        )}>
                          {format(day, 'EEE', { locale: es })}
                        </span>
                        <span className="text-xs font-mono font-medium text-[#777777]">
                          {format(day, 'dd/MM')}
                        </span>
                      </div>

                      {reg ? (
                        <div className="my-1.5 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-[#FFCC00]">
                              {reg.cantidadClases ?? 1} {(reg.cantidadClases ?? 1) === 1 ? 'clase' : 'clases'}
                            </span>
                            <span className="text-xs font-semibold text-white">
                              {reg.cantidadAlumnos} al.
                            </span>
                          </div>
                          <div className="text-sm font-bold text-emerald-400">
                            $ {reg.precioTotal.toLocaleString('es-AR')}
                          </div>
                        </div>
                      ) : (
                        <div className="my-2.5 text-center">
                          <span className="text-[11px] text-[#555555] italic">Sin clase</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#2E2E2E] flex justify-between items-center text-[10px]">
                      {reg ? (
                        <span className="text-[#888888] truncate max-w-[90px]" title={reg.observaciones || 'Registrado'}>
                          {reg.observaciones || 'Registrado'}
                        </span>
                      ) : !readOnly ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenCreateModal(dayKey);
                          }}
                          className="text-[#FFCC00] hover:underline"
                        >
                          + Cargar
                        </button>
                      ) : (
                        <span className="text-[#555555]">-</span>
                      )}

                      {reg && !readOnly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditModal(reg);
                          }}
                          className="text-[#888888] hover:text-white"
                          title="Editar"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Resumen total al pie de la semana */}
            <div className="bg-[#171717] rounded-lg p-2.5 px-4 flex flex-col sm:flex-row items-center justify-between text-xs border border-[#2B2B2B] gap-2">
              <span className="text-[#888888]">
                Total de la semana: <strong className="text-[#FFCC00]">{semanaStats.clases} clases</strong> (<strong className="text-white">{semanaStats.alumnos} alumnos</strong>) en <strong className="text-white">{semanaStats.diasConClase} días con actividad</strong>
              </span>
              <span className="text-emerald-400 font-bold text-sm">
                Recaudación semanal: $ {semanaStats.total.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* =====================================================================
              HISTORIAL DE CARGAS DEL MES (TABLA COMPLETA)
             ===================================================================== */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-white text-sm font-bold flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-[#FFCC00]" />
                  Historial de Días Cargados en el Mes ({registrosProfeMensual.length})
                </h4>
                <span className="text-xs text-[#777777]">1 carga por día</span>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMesPDF}
                  className="h-8 text-xs border-[#FFCC00]/50 text-[#FFCC00] hover:bg-[#FFCC00]/10 hover:text-white font-semibold"
                  title="Exportar informe mensual oficial en PDF para Comisión Directiva"
                >
                  <FileDown className="w-3.5 h-3.5 mr-1" />
                  PDF Mes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportMesExcel}
                  className="h-8 text-xs border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white"
                  title="Exportar a planilla Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Excel
                </Button>
              </div>
            </div>

            {loadingProfe && registrosProfeMensual.length === 0 ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full bg-[#2A2A2A]" />
                ))}
              </div>
            ) : registrosProfeMensual.length === 0 ? (
              <div className="py-10 text-center text-sm text-[#666666]">
                No hay días registrados en este mes. Tocá &quot;Cargar Día&quot; para registrar el primero.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#333333] hover:bg-transparent">
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Día de la Semana</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Fecha</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Clases</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Alumnos del Día</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-right">Valor Total del Día</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Observaciones</TableHead>
                      {!readOnly && (
                        <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Acciones</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrosProfeMensual.map((registro) => {
                      return (
                        <TableRow key={registro.id} className="border-[#333333] hover:bg-[#252525]">
                          {/* Día de la semana */}
                          <TableCell className="py-2.5 whitespace-nowrap">
                            <Badge className="bg-[#2A2A2A] text-white border-[#444] capitalize font-bold text-xs">
                              {format(new Date(registro.fecha), 'EEEE', { locale: es })}
                            </Badge>
                          </TableCell>

                          {/* Fecha */}
                          <TableCell className="text-white text-sm py-2.5 font-mono whitespace-nowrap">
                            {format(new Date(registro.fecha), 'dd/MM/yyyy')}
                          </TableCell>

                          {/* Cantidad Clases */}
                          <TableCell className="text-center py-2.5">
                            <span className="font-bold text-white text-xs bg-[#2A2A2A] px-2 py-0.5 rounded border border-[#3A3A3A]">
                              {registro.cantidadClases ?? 1}
                            </span>
                          </TableCell>

                          {/* Cantidad Alumnos */}
                          <TableCell className="text-center py-2.5">
                            <span className="font-extrabold text-[#FFCC00] text-sm">
                              {registro.cantidadAlumnos}
                            </span>
                          </TableCell>

                          {/* Precio Total del Día */}
                          <TableCell className="text-right py-2.5 font-mono font-bold text-emerald-400 text-sm">
                            $ {registro.precioTotal.toLocaleString('es-AR')}
                          </TableCell>

                          {/* Observaciones */}
                          <TableCell className="text-[#888888] text-xs py-2.5 max-w-[220px] truncate" title={registro.observaciones || ''}>
                            {registro.observaciones || '-'}
                          </TableCell>

                          {/* Acciones */}
                          {!readOnly && (
                            <TableCell className="text-center py-2.5">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenEditModal(registro)}
                                  className="h-7 w-7 text-[#888888] hover:text-white hover:bg-[#2C2C2C]"
                                  title="Editar"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteRegistro(registro.id)}
                                  disabled={isDeleting}
                                  className="h-7 w-7 text-[#888888] hover:text-rose-400 hover:bg-rose-500/10"
                                  title="Eliminar"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 2: VISTA DIARIA (PRESENTES CON DNI + PLANILLA DEL DÍA)
           ========================================================================= */}
        <TabsContent value="diaria" className="m-0 space-y-4 focus-visible:outline-none">
          {/* Card Resumen de la Planilla del Día */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4.5 transition-all">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#FFCC00]/15 border border-[#FFCC00]/30 flex items-center justify-center text-[#FFCC00]">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-bold text-sm capitalize">
                      Planilla del {format(selectedDate, 'EEEE dd/MM/yyyy', { locale: es })}
                    </h4>
                    {registroProfeDiario && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-2">
                        Cargada
                      </Badge>
                    )}
                  </div>
                  <p className="text-[#888888] text-xs">
                    {registroProfeDiario 
                      ? `Registrado para este día`
                      : 'El profesor todavía no cargó los datos de esta fecha'}
                  </p>
                </div>
              </div>

              {registroProfeDiario ? (
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right pr-2">
                    <div className="text-sm font-bold text-emerald-400">
                      $ {registroProfeDiario.precioTotal.toLocaleString('es-AR')}
                    </div>
                    <div className="text-[11px] text-[#999999]">
                      {registroProfeDiario.cantidadClases ?? 1} {(registroProfeDiario.cantidadClases ?? 1) === 1 ? 'clase' : 'clases'} · {registroProfeDiario.cantidadAlumnos} alumno{registroProfeDiario.cantidadAlumnos !== 1 ? 's' : ''} en total
                    </div>
                  </div>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEditModal(registroProfeDiario)}
                      className="border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
                    >
                      <Pencil className="h-3.5 w-3.5 mr-1" />
                      Editar
                    </Button>
                  )}
                </div>
              ) : !readOnly ? (
                <Button
                  size="sm"
                  onClick={() => handleOpenCreateModal(format(selectedDate, 'yyyy-MM-dd'))}
                  className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] h-8 text-xs font-bold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Cargar Planilla
                </Button>
              ) : null}
            </div>

            {registroProfeDiario?.observaciones && (
              <div className="mt-3 pt-2.5 border-t border-[#2C2C2C] text-xs text-[#999999] flex items-center gap-1.5">
                <span className="font-semibold text-[#CCCCCC]">Observaciones:</span>
                <span>{registroProfeDiario.observaciones}</span>
              </div>
            )}
          </div>

          {/* Tabla de Asistencias individuales de alumnos con DNI */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white text-base font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#FFCC00]" />
                  Presentes de Alumnos con DNI ({format(selectedDate, 'dd/MM/yyyy')})
                </h3>
                <p className="text-[#999999] text-xs mt-0.5">
                  {asistenciasDiarias.length} alumno{asistenciasDiarias.length !== 1 ? 's' : ''} marcaron su presente por QR
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "h-8 text-xs justify-start text-left font-normal bg-[#2A2A2A] border-[#333333] text-white hover:bg-[#333333] hover:text-white",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 text-[#FFCC00]" />
                      {selectedDate ? format(selectedDate, 'PPP', { locale: es }) : <span>Elegir fecha</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-[#1E1E1E] border-[#333333] text-white">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => { if(date) setSelectedDate(date); }}
                      initialFocus
                      locale={es}
                      className="bg-[#1E1E1E] text-white"
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    fetchAsistenciasDiarias(selectedDate);
                    fetchRegistroProfeDiario(selectedDate);
                  }}
                  disabled={loading}
                  className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </div>

            {loading && asistenciasDiarias.length === 0 ? (
              <div className="space-y-3 mt-4">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-[#2A2A2A]" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#333333] hover:bg-transparent">
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Hora</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Socio / Alumno</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">DNI</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Estado Cuota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asistenciasDiarias.length === 0 ? (
                      <TableRow className="border-[#333333]">
                        <TableCell colSpan={4} className="text-center py-10 text-[#666666] text-sm">
                          No hay alumnos registrados con DNI para esta fecha.
                        </TableCell>
                      </TableRow>
                    ) : (
                      asistenciasDiarias.map((asistencia) => {
                        const alertas = getAlertasSocio(asistencia.socio);
                        const tieneAlertas = alertas.length > 0;
                        return (
                          <TableRow
                            key={asistencia.id}
                            className={`border-[#333333] ${tieneAlertas ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-[#252525]'}`}
                          >
                            <TableCell className="text-[#999999] text-sm py-3 font-mono">
                              {format(new Date(asistencia.fecha), 'HH:mm')} hs
                            </TableCell>
                            <TableCell className="text-[#CCCCCC] text-sm py-3">
                              <span className="font-semibold text-white">{asistencia.socio.apellido}</span>, {asistencia.socio.nombre}
                            </TableCell>
                            <TableCell className="text-[#999999] text-xs font-mono py-3">
                              {asistencia.socio.dni}
                            </TableCell>
                            <TableCell className="text-center py-3">
                              {tieneAlertas ? (
                                <div className="flex items-center justify-center gap-2">
                                  <AlertTriangle className="h-4 w-4 text-red-500" />
                                  <div className="flex gap-1 flex-wrap justify-center">
                                    {alertas.map((alerta, i) => (
                                      <Badge key={i} variant="outline" className="bg-red-500/15 text-red-400 border-red-500/20 text-[10px]">
                                        {alerta}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1 text-green-500 text-xs font-medium">
                                  <CheckCircle2 className="h-4 w-4" /> Al día
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* =========================================================================
            TAB 3: REPORTE MENSUAL DE ASISTENCIAS DE ALUMNOS (DNI)
           ========================================================================= */}
        <TabsContent value="mensual" className="m-0 space-y-4 focus-visible:outline-none">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 print:border-none print:p-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white text-base font-bold print:text-black">Reporte Mensual de Asistencia</h3>
                <p className="text-[#999999] text-xs print:text-gray-600">
                  Total de clases asistidas por alumno en {format(new Date(selectedMonth + '-01T00:00:00'), 'MMMM yyyy', { locale: es })}
                </p>
              </div>
              
              <div className="flex items-center gap-2 print:hidden">
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-8 text-xs bg-[#2A2A2A] border-[#333333] text-white focus:ring-[#FFCC00] w-[160px]">
                    <SelectValue placeholder="Seleccionar mes" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1E1E1E] border-[#333333] text-white">
                    {monthOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="focus:bg-[#333333] focus:text-white">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Imprimir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAsistenciasMensuales(selectedMonth)}
                  disabled={loading}
                  className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </div>

            {loading && reporteArray.length === 0 ? (
              <div className="space-y-3 mt-4 print:hidden">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-[#2A2A2A]" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto print:overflow-visible">
                <Table className="print:text-black">
                  <TableHeader>
                    <TableRow className="border-[#333333] hover:bg-transparent print:border-b-2 print:border-black">
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">Socio / Alumno</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">DNI</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold text-center">Total Clases Asistidas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reporteArray.length === 0 ? (
                      <TableRow className="border-[#333333] print:border-b">
                        <TableCell colSpan={3} className="text-center py-10 text-[#666666] text-sm print:text-black">
                          No hay asistencias registradas en este mes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      reporteArray.map(({ socio, totalClases }) => (
                        <TableRow
                          key={socio.id}
                          className="border-[#333333] hover:bg-[#252525] print:border-b print:border-gray-300 print:hover:bg-transparent"
                        >
                          <TableCell className="text-[#CCCCCC] text-sm py-3 print:text-black">
                            <span className="font-semibold text-white">{socio.apellido}</span>, {socio.nombre}
                          </TableCell>
                          <TableCell className="text-[#999999] text-xs font-mono py-3 print:text-black">
                            {socio.dni}
                          </TableCell>
                          <TableCell className="text-center py-3">
                            <Badge variant="outline" className="bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/20 font-bold px-3 py-0.5 print:bg-transparent print:border-none print:text-black print:p-0">
                              {totalClases} {totalClases === 1 ? 'clase' : 'clases'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal para Crear / Editar Registro del Día (Sin Profesor ni Turno) */}
      {!readOnly && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="bg-[#1E1E1E] border-[#333333] text-white sm:max-w-[440px]">
            <DialogHeader>
              <DialogTitle className="text-white font-bold text-lg flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[#FFCC00]" />
                {editingRegistro ? 'Editar Planilla del Día' : 'Cargar Planilla del Día'}
              </DialogTitle>
              <DialogDescription className="text-[#888888] text-xs">
                Ingresá los alumnos y el valor total del día (1 carga por día).
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveModal} className="space-y-4 pt-2">
              {/* Fecha */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Día</Label>
                <Input
                  type="date"
                  value={formFecha}
                  onChange={(e) => setFormFecha(e.target.value)}
                  required
                  className="bg-[#2A2A2A] border-[#383838] text-white focus:border-[#FFCC00]"
                />
              </div>

              {/* Clases, Alumnos y Precio */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Clases</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Ej: 2"
                    value={formClases}
                    onChange={(e) => setFormClases(e.target.value)}
                    required
                    className="bg-[#2A2A2A] border-[#383838] text-white font-bold focus:border-[#FFCC00]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Alumnos</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="Ej: 15"
                    value={formAlumnos}
                    onChange={(e) => setFormAlumnos(e.target.value)}
                    required
                    className="bg-[#2A2A2A] border-[#383838] text-white font-bold focus:border-[#FFCC00]"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Total ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    placeholder="Ej: 45000"
                    value={formPrecio}
                    onChange={(e) => setFormPrecio(e.target.value)}
                    required
                    className="bg-[#2A2A2A] border-[#383838] text-white font-bold focus:border-[#FFCC00]"
                  />
                </div>
              </div>

              {/* Observaciones */}
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Observaciones (Opcional)</Label>
                <Input
                  type="text"
                  placeholder="Notas adicionales..."
                  value={formObservaciones}
                  onChange={(e) => setFormObservaciones(e.target.value)}
                  className="bg-[#2A2A2A] border-[#383838] text-white focus:border-[#FFCC00]"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submittingModal}
                  className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-bold"
                >
                  {submittingModal ? 'Guardando...' : editingRegistro ? 'Guardar Cambios' : 'Guardar Día'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
