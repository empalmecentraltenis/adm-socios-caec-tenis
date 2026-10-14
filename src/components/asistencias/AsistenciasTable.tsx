'use client';

import { useState, useEffect, useCallback } from 'react';
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
  Sparkles
} from 'lucide-react';
import { format } from 'date-fns';
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
  cantidadAlumnos: number;
  precioTotal: number;
  profesor?: string;
  turno?: string;
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

export default function AsistenciasTable() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('diaria');
  const [qrType, setQrType] = useState<'alumnos' | 'profe'>('profe');
  const [copiedLink, setCopiedLink] = useState(false);

  // Estados para alumnos
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

  // Estado del Modal de carga manual / edición de clase del profesor
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingRegistro, setEditingRegistro] = useState<RegistroProfe | null>(null);

  // Campos del formulario modal
  const [formFecha, setFormFecha] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [formAlumnos, setFormAlumnos] = useState<string>('');
  const [formPrecio, setFormPrecio] = useState<string>('');
  const [formProfesor, setFormProfesor] = useState<string>('Profesor');
  const [formTurno, setFormTurno] = useState<string>('Tarde');
  const [formObservaciones, setFormObservaciones] = useState<string>('');
  const [submittingModal, setSubmittingModal] = useState<boolean>(false);

  // URLs públicas
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const asistenciaUrl = `${origin}/asistencia`;
  const profeUrl = `${origin}/profe`;

  const currentUrl = qrType === 'profe' ? profeUrl : asistenciaUrl;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(currentUrl)}&margin=10`;

  // Fetch asistencias diarias de alumnos
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
    if (activeTab === 'diaria') {
      const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      if (isToday) {
        interval = setInterval(() => {
          fetchAsistenciasDiarias(selectedDate);
          fetchRegistroProfeDiario(selectedDate);
        }, 30000);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, selectedDate, fetchAsistenciasDiarias, fetchRegistroProfeDiario]);

  const getAlertasSocio = (socio: Socio) => {
    const alertas: string[] = [];
    if (socio.estado === 'inactivo') {
      alertas.push('Inactivo');
    }
    const hoy = new Date();
    const mesesAdeudados = (socio.cuotas || []).filter((c: any) => {
      if (c.estado === 'pagado') return false;
      const [anio, mes] = c.mes.split('-');
      const vencimiento = new Date(parseInt(anio), parseInt(mes), 1); 
      return hoy >= vencimiento;
    }).length;
    if (mesesAdeudados >= 4) {
      alertas.push(`Debe ${mesesAdeudados} cuotas`);
    }
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
    const title = isProfe ? '🎾 Planilla Diaria del Profesor - CAEC Tenis' : '🎾 CAEC - Asistencia a Clases';
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

  // Agrupar asistencias mensuales de alumnos
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

  // Cálculos KPIs del Profesor para el mes
  const totalRecaudadoMes = registrosProfeMensual.reduce((acc, r) => acc + r.precioTotal, 0);
  const totalAlumnosMes = registrosProfeMensual.reduce((acc, r) => acc + r.cantidadAlumnos, 0);
  const totalClasesMes = registrosProfeMensual.length;
  const promedioPorAlumnoMes = totalAlumnosMes > 0 ? Math.round(totalRecaudadoMes / totalAlumnosMes) : 0;
  const promedioAlumnosPorClase = totalClasesMes > 0 ? (totalAlumnosMes / totalClasesMes).toFixed(1) : '0';

  // Modal ABM helpers
  const handleOpenCreateModal = (presetDate?: string) => {
    setEditingRegistro(null);
    setFormFecha(presetDate || format(selectedDate, 'yyyy-MM-dd'));
    setFormAlumnos('');
    setFormPrecio('');
    setFormProfesor('Profesor');
    setFormTurno('Tarde');
    setFormObservaciones('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (registro: RegistroProfe) => {
    setEditingRegistro(registro);
    setFormFecha(registro.fecha.split('T')[0]);
    setFormAlumnos(String(registro.cantidadAlumnos));
    setFormPrecio(String(registro.precioTotal));
    setFormProfesor(registro.profesor || 'Profesor');
    setFormTurno(registro.turno || 'Tarde');
    setFormObservaciones(registro.observaciones || '');
    setIsModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const alumnosNum = parseInt(formAlumnos, 10);
    const precioNum = parseFloat(formPrecio.replace(/\./g, '').replace(',', '.'));

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
        cantidadAlumnos: alumnosNum,
        precioTotal: precioNum,
        profesor: formProfesor.trim() || 'Profesor',
        turno: formTurno,
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
        title: isEditing ? 'Registro actualizado' : 'Registro creado',
        description: 'La planilla del profesor fue guardada correctamente.',
      });

      setIsModalOpen(false);
      // Refrescar datos
      if (activeTab === 'diaria') {
        fetchRegistroProfeDiario(selectedDate);
      } else {
        fetchRegistrosProfeMensual(selectedMonth);
      }
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
    if (!window.confirm('¿Estás seguro de eliminar este registro de la planilla del profesor?')) {
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/clases-profe?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('No se pudo eliminar el registro');
      }

      toast({
        title: 'Registro eliminado',
        description: 'El registro fue quitado de la base de datos.',
      });

      if (activeTab === 'diaria') {
        fetchRegistroProfeDiario(selectedDate);
      } else {
        fetchRegistrosProfeMensual(selectedMonth);
      }
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

  return (
    <div className="space-y-5">
      {/* Panel Superior: Acceso Rápido y QR para Alumnos y Profesor */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-5 shadow-lg print:hidden">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          {/* Código QR con selector */}
          <div className="flex-shrink-0 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageUrl}
              alt="Código QR"
              width={140}
              height={140}
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

          {/* Información del enlace actual */}
          <div className="flex-1 text-center lg:text-left">
            <div className="flex items-center gap-2 justify-center lg:justify-start mb-1.5">
              <QrCode className="h-5 w-5 text-[#FFCC00]" />
              <h3 className="text-white text-base font-bold">
                {qrType === 'profe' 
                  ? 'Página del Profesor · Planilla Diaria' 
                  : 'Página de Alumnos · Asistencia a Clases'}
              </h3>
              <Badge variant="outline" className="text-[10px] bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/30 font-bold uppercase">
                Pública · Sin Login
              </Badge>
            </div>

            <p className="text-[#AAAAAA] text-xs mb-2 leading-relaxed">
              {qrType === 'profe'
                ? 'El profesor ingresa desde su celular a este link directo para cargar los alumnos del día, la fecha y el precio total recaudado.'
                : 'Los alumnos escanean el código con la cámara de su celular e ingresan su DNI para dar el presente en la clase.'}
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
        <TabsList className="bg-[#1E1E1E] border border-[#333333] p-1 h-12 mb-4 grid grid-cols-3 max-w-xl print:hidden">
          <TabsTrigger 
            value="diaria" 
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-xs sm:text-sm font-semibold h-10 rounded-md transition-all"
          >
            Vista Diaria
          </TabsTrigger>
          <TabsTrigger 
            value="profe" 
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-xs sm:text-sm font-semibold h-10 rounded-md transition-all flex items-center justify-center gap-1.5"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            Planilla Profesor
          </TabsTrigger>
          <TabsTrigger 
            value="mensual"
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-xs sm:text-sm font-semibold h-10 rounded-md transition-all"
          >
            Reporte Alumnos
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            TAB 1: VISTA DIARIA (ASISTENCIAS DE SOCIOS + PLANILLA DEL PROFE DE ESE DÍA)
           ========================================================================= */}
        <TabsContent value="diaria" className="m-0 space-y-4 focus-visible:outline-none">
          {/* Card Resumen de la Planilla del Profe para este día seleccionado */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4.5 transition-all">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#FFCC00]/15 border border-[#FFCC00]/30 flex items-center justify-center text-[#FFCC00]">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-white font-bold text-sm">
                      Planilla del Profesor · {format(selectedDate, 'dd/MM/yyyy')}
                    </h4>
                    {registroProfeDiario && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-2">
                        Cargada
                      </Badge>
                    )}
                  </div>
                  <p className="text-[#888888] text-xs">
                    {registroProfeDiario 
                      ? `${registroProfeDiario.profesor || 'Profesor'} registró clases para este día`
                      : 'El profesor todavía no cargó los datos de esta fecha'}
                  </p>
                </div>
              </div>

              {registroProfeDiario ? (
                <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right sm:text-right pr-2">
                    <div className="text-sm font-bold text-emerald-400">
                      $ {registroProfeDiario.precioTotal.toLocaleString('es-AR')}
                    </div>
                    <div className="text-[11px] text-[#999999]">
                      {registroProfeDiario.cantidadAlumnos} alumno{registroProfeDiario.cantidadAlumnos !== 1 ? 's' : ''}
                      {registroProfeDiario.turno ? ` · ${registroProfeDiario.turno}` : ''}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenEditModal(registroProfeDiario)}
                    className="border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    Editar
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleOpenCreateModal(format(selectedDate, 'yyyy-MM-dd'))}
                  className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] h-8 text-xs font-bold"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Cargar Planilla Profe
                </Button>
              )}
            </div>

            {registroProfeDiario?.observaciones && (
              <div className="mt-3 pt-2.5 border-t border-[#2C2C2C] text-xs text-[#999999] flex items-center gap-1.5">
                <span className="font-semibold text-[#CCCCCC]">Notas del profesor:</span>
                <span>{registroProfeDiario.observaciones}</span>
              </div>
            )}
          </div>

          {/* Tabla de Asistencias individuales de alumnos */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white text-base font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#FFCC00]" />
                  Presentes de Alumnos del {format(selectedDate, 'dd/MM/yyyy')}
                </h3>
                <p className="text-[#999999] text-xs mt-0.5">
                  {asistenciasDiarias.length} alumno{asistenciasDiarias.length !== 1 ? 's' : ''} marcaron su asistencia con DNI
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
            TAB 2: PLANILLA DEL PROFESOR (REGISTRO COMPLETO DIARIO DE LO QUE CARGA)
           ========================================================================= */}
        <TabsContent value="profe" className="m-0 space-y-4 focus-visible:outline-none">
          {/* Header y Filtro de Mes */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-white text-base font-bold flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-[#FFCC00]" />
                Planilla Mensual del Profesor de Tenis
              </h3>
              <p className="text-[#999999] text-xs mt-0.5">
                Registro de alumnos atendidos y recaudación diaria cargada por el profesor
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-8 text-xs bg-[#2A2A2A] border-[#383838] text-white focus:ring-[#FFCC00] w-[170px]">
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
                size="sm"
                onClick={() => handleOpenCreateModal()}
                className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] h-8 text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Nueva Carga
              </Button>

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

          {/* KPI Cards del Mes para el Profesor */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Card 1: Total Recaudado */}
            <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-[#888888] mb-1">
                <span className="text-xs uppercase font-semibold">Total Recaudado</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-emerald-400">
                $ {totalRecaudadoMes.toLocaleString('es-AR')}
              </div>
              <span className="text-[11px] text-[#666666] mt-1">En el mes seleccionado</span>
            </div>

            {/* Card 2: Total Alumnos */}
            <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-[#888888] mb-1">
                <span className="text-xs uppercase font-semibold">Alumnos Atendidos</span>
                <Users className="w-4 h-4 text-[#FFCC00]" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-white">
                {totalAlumnosMes}
              </div>
              <span className="text-[11px] text-[#666666] mt-1">Suma de presentes</span>
            </div>

            {/* Card 3: Clases Dictadas */}
            <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-[#888888] mb-1">
                <span className="text-xs uppercase font-semibold">Días con Clases</span>
                <CalendarCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-white">
                {totalClasesMes}
              </div>
              <span className="text-[11px] text-[#666666] mt-1">Planillas registradas</span>
            </div>

            {/* Card 4: Promedio por Alumno */}
            <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between text-[#888888] mb-1">
                <span className="text-xs uppercase font-semibold">Promedio / Alumno</span>
                <TrendingUp className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-xl sm:text-2xl font-extrabold text-[#FFCC00]">
                $ {promedioPorAlumnoMes.toLocaleString('es-AR')}
              </div>
              <span className="text-[11px] text-[#666666] mt-1">~{promedioAlumnosPorClase} alumnos / clase</span>
            </div>
          </div>

          {/* Tabla de Registros del Profesor */}
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 shadow-sm">
            {loadingProfe && registrosProfeMensual.length === 0 ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-[#2A2A2A]" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#333333] hover:bg-transparent">
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Fecha</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Profesor</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Turno</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Alumnos</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-right">Total del Día</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-right">Promedio / Alumno</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Observaciones</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {registrosProfeMensual.length === 0 ? (
                      <TableRow className="border-[#333333]">
                        <TableCell colSpan={8} className="text-center py-12 text-[#666666] text-sm">
                          No hay planillas cargadas por el profesor en este mes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      registrosProfeMensual.map((registro) => {
                        const promedio = registro.cantidadAlumnos > 0 
                          ? Math.round(registro.precioTotal / registro.cantidadAlumnos) 
                          : 0;

                        return (
                          <TableRow key={registro.id} className="border-[#333333] hover:bg-[#252525]">
                            {/* Fecha */}
                            <TableCell className="text-white text-sm py-3 font-medium whitespace-nowrap">
                              <span className="capitalize">
                                {format(new Date(registro.fecha), 'EEEE dd/MM/yyyy', { locale: es })}
                              </span>
                            </TableCell>

                            {/* Profesor */}
                            <TableCell className="text-[#CCCCCC] text-sm py-3">
                              {registro.profesor || 'Profesor'}
                            </TableCell>

                            {/* Turno */}
                            <TableCell className="text-center py-3">
                              <Badge variant="outline" className="text-[11px] bg-[#2A2A2A] text-[#CCCCCC] border-[#383838]">
                                {registro.turno || 'Completo'}
                              </Badge>
                            </TableCell>

                            {/* Cantidad Alumnos */}
                            <TableCell className="text-center py-3">
                              <span className="font-bold text-[#FFCC00] text-sm">
                                {registro.cantidadAlumnos}
                              </span>
                            </TableCell>

                            {/* Precio Total */}
                            <TableCell className="text-right py-3 font-mono font-bold text-emerald-400 text-sm">
                              $ {registro.precioTotal.toLocaleString('es-AR')}
                            </TableCell>

                            {/* Promedio */}
                            <TableCell className="text-right py-3 font-mono text-[#AAAAAA] text-xs">
                              $ {promedio.toLocaleString('es-AR')}
                            </TableCell>

                            {/* Observaciones */}
                            <TableCell className="text-[#888888] text-xs py-3 max-w-[200px] truncate" title={registro.observaciones || ''}>
                              {registro.observaciones || '-'}
                            </TableCell>

                            {/* Acciones */}
                            <TableCell className="text-center py-3">
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
            TAB 3: REPORTE MENSUAL DE ALUMNOS (ASISTENCIAS POR SOCIO)
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

      {/* Modal para Crear / Editar Registro del Profesor */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#1E1E1E] border-[#333333] text-white sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-white font-bold text-lg flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-[#FFCC00]" />
              {editingRegistro ? 'Editar Planilla del Profesor' : 'Cargar Planilla del Profesor'}
            </DialogTitle>
            <DialogDescription className="text-[#888888] text-xs">
              Ingresá la cantidad de alumnos y recaudación del día.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveModal} className="space-y-4 pt-2">
            {/* Fecha */}
            <div className="space-y-1.5">
              <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Fecha</Label>
              <Input
                type="date"
                value={formFecha}
                onChange={(e) => setFormFecha(e.target.value)}
                required
                className="bg-[#2A2A2A] border-[#383838] text-white focus:border-[#FFCC00]"
              />
            </div>

            {/* Alumnos y Precio */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Alumnos del Día</Label>
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
                <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Precio Total ($)</Label>
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

            {/* Turno y Profesor */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Profesor</Label>
                <Input
                  type="text"
                  placeholder="Profesor"
                  value={formProfesor}
                  onChange={(e) => setFormProfesor(e.target.value)}
                  className="bg-[#2A2A2A] border-[#383838] text-white focus:border-[#FFCC00]"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs uppercase font-semibold text-[#CCCCCC]">Turno</Label>
                <Select value={formTurno} onValueChange={setFormTurno}>
                  <SelectTrigger className="bg-[#2A2A2A] border-[#383838] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1E1E1E] border-[#333333] text-white">
                    <SelectItem value="Tarde">Tarde</SelectItem>
                    <SelectItem value="Mañana">Mañana</SelectItem>
                    <SelectItem value="Completo">Completo</SelectItem>
                    <SelectItem value="Noche">Noche</SelectItem>
                  </SelectContent>
                </Select>
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
                {submittingModal ? 'Guardando...' : editingRegistro ? 'Guardar Cambios' : 'Crear Registro'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
