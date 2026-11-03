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
  Users,
  Copy,
  Check,
  Search,
  UserX,
  Award,
  Trash2,
  Loader2,
  FileSpreadsheet,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { startOfWeek, endOfWeek } from 'date-fns';
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
  alDia?: boolean;
  mesesAdeudados?: number;
}

interface Asistencia {
  id: string;
  socioId: string;
  fecha: string;
  notas?: string | null;
  socio: Socio;
}

interface ReporteSocio {
  socio: Socio;
  totalClases: number;
  esNoRegistrado: boolean;
  fechas: string[];
  ultimasNotas?: string[];
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

export default function AsistenciaAlumnosPanel({ readOnly = false }: { readOnly?: boolean } = {}) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'diaria' | 'mensual'>('diaria');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchReporte, setSearchReporte] = useState('');
  const [vistaReporte, setVistaReporte] = useState<'acumulado' | 'detalle'>('acumulado');

  // Estados para alumnos (DNI)
  const [asistenciasDiarias, setAsistenciasDiarias] = useState<Asistencia[]>([]);
  const [asistenciasMensuales, setAsistenciasMensuales] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Selectores de fecha para Reportes / Exportación
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [modoPeriodoReporte, setModoPeriodoReporte] = useState<'mes' | 'semana' | 'anio' | 'personalizado'>('mes');
  const [reporteAnio, setReporteAnio] = useState<string>('2026');
  const [reporteFechaDesde, setReporteFechaDesde] = useState<string>('');
  const [reporteFechaHasta, setReporteFechaHasta] = useState<string>('');
  const [periodoLabel, setPeriodoLabel] = useState<string>('');

  // Estado para eliminación de asistencias
  const [asistenciaParaEliminar, setAsistenciaParaEliminar] = useState<Asistencia | null>(null);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);

  // URL pública de escaneo de QR para alumnos
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const asistenciaUrl = `${origin}/asistencia`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(asistenciaUrl)}&margin=10`;

  // Eliminar asistencia
  const handleEliminarAsistencia = async () => {
    if (!asistenciaParaEliminar) return;
    const id = asistenciaParaEliminar.id;
    setEliminandoId(id);
    try {
      const res = await fetch(`/api/asistencias?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Asistencia eliminada',
          description: data.message || 'La asistencia fue eliminada exitosamente.',
        });
        setAsistenciasDiarias((prev) => prev.filter((a) => a.id !== id));
        setAsistenciasMensuales((prev) => prev.filter((a) => a.id !== id));
        setAsistenciaParaEliminar(null);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo eliminar la asistencia.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error al eliminar asistencia:', err);
      toast({
        title: 'Error',
        description: 'Ocurrió un error al intentar eliminar la asistencia.',
        variant: 'destructive',
      });
    } finally {
      setEliminandoId(null);
    }
  };

  // Fetch asistencias diarias
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

  // Fetch asistencias del período configurado (semana, mes, año, rango)
  const fetchAsistenciasPeriodo = useCallback(async () => {
    setLoading(true);
    try {
      let queryParam = '';
      if (modoPeriodoReporte === 'semana') {
        const now = new Date();
        const start = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const end = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
        queryParam = `desde=${start}&hasta=${end}`;
        setPeriodoLabel(`Semana (${format(startOfWeek(now, { weekStartsOn: 1 }), 'dd/MM')} al ${format(endOfWeek(now, { weekStartsOn: 1 }), 'dd/MM/yyyy')})`);
      } else if (modoPeriodoReporte === 'anio') {
        queryParam = `anio=${reporteAnio}`;
        setPeriodoLabel(`Año ${reporteAnio}`);
      } else if (modoPeriodoReporte === 'personalizado') {
        if (reporteFechaDesde && reporteFechaHasta) {
          queryParam = `desde=${reporteFechaDesde}&hasta=${reporteFechaHasta}`;
          setPeriodoLabel(`Período ${reporteFechaDesde} al ${reporteFechaHasta}`);
        } else {
          queryParam = `mes=${selectedMonth}`;
        }
      } else {
        // modo === 'mes'
        queryParam = `mes=${selectedMonth}`;
        setPeriodoLabel(format(new Date(selectedMonth + '-01T00:00:00'), 'MMMM yyyy', { locale: es }).toUpperCase());
      }

      const res = await fetch(`/api/asistencias?${queryParam}`);
      if (res.ok) {
        const data = await res.json();
        setAsistenciasMensuales(data);
      }
    } catch (error) {
      console.error('Error fetching asistencias del período', error);
    } finally {
      setLoading(false);
    }
  }, [modoPeriodoReporte, selectedMonth, reporteAnio, reporteFechaDesde, reporteFechaHasta]);

  useEffect(() => {
    if (activeTab === 'diaria') {
      fetchAsistenciasDiarias(selectedDate);
    } else {
      fetchAsistenciasPeriodo();
    }
  }, [activeTab, selectedDate, fetchAsistenciasDiarias, fetchAsistenciasPeriodo]);

  // Polling automático cada 20s para la vista del día de hoy
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'diaria') {
      const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      if (isToday) {
        interval = setInterval(() => {
          fetchAsistenciasDiarias(selectedDate);
        }, 20000);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, selectedDate, fetchAsistenciasDiarias]);

  // Detector si un alumno no está registrado
  const isAlumnoNoRegistrado = (asistencia: Asistencia) => {
    const ape = (asistencia.socio?.apellido || '').toLowerCase();
    const nom = (asistencia.socio?.nombre || '').toLowerCase();
    const notas = (asistencia.notas || '').toLowerCase();
    return (
      (ape === 'no registrado' && nom === 'alumno') ||
      notas.includes('no registrado') ||
      asistencia.socio?.categoria === 'alumno' && ape === 'no registrado'
    );
  };

  const getAlertasSocio = (socio: Socio) => {
    const alertas: string[] = [];
    if (socio.apellido?.toLowerCase() === 'no registrado') {
      alertas.push('DNI No Registrado');
      return alertas;
    }
    if (socio.estado === 'inactivo') alertas.push('Inactivo');
    
    // Si la API ya calculó los meses adeudados reales, usamos ese valor
    const meses = typeof socio.mesesAdeudados === 'number'
      ? socio.mesesAdeudados
      : (socio.cuotas || []).filter((c: any) => {
          if (c.estado === 'pagado') return false;
          const [anio, mes] = c.mes.split('-');
          const vencimiento = new Date(parseInt(anio), parseInt(mes), 1);
          return new Date() >= vencimiento;
        }).length;

    if (meses > 0) {
      alertas.push(meses === 1 ? 'Debe 1 mes' : `Debe ${meses} meses`);
    }
    return alertas;
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(asistenciaUrl);
    setCopiedLink(true);
    toast({
      title: 'Enlace copiado',
      description: 'El link de asistencia para alumnos fue copiado al portapapeles.',
    });
    setTimeout(() => setCopiedLink(false), 2500);
  };

  function handlePrintQr() {
    const win = window.open('', '_blank');
    if (!win) return;
    const title = '🎾 CAEC - Asistencia a Clases de Tenis';
    const subtitle = 'Escaneá este código QR con tu celular para registrar tu asistencia';
    const printUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(asistenciaUrl)}&margin=10`;

    win.document.write(
      '<!DOCTYPE html><html><head><title>' + title + '</title>' +
      '<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;}' +
      'h1{font-size:26px;margin-bottom:8px;color:#111;text-align:center;}p{color:#555;margin-bottom:24px;font-size:16px;text-align:center;}' +
      'img{border:4px solid #FFCC00;border-radius:14px;padding:8px;}.url{margin-top:16px;font-size:14px;color:#888;word-break:break-all;font-family:monospace;}</style>' +
      '</head><body>' +
      '<h1>' + title + '</h1>' +
      '<p>' + subtitle + '</p>' +
      '<img src="' + printUrl + '" />' +
      '<p class="url">' + asistenciaUrl + '</p>' +
      '</body></html>'
    );
    win.document.close();
    win.onload = () => win.print();
  }

  // Filtrado de asistencias diarias
  const filteredDiarias = useMemo(() => {
    if (!searchTerm.trim()) return asistenciasDiarias;
    const term = searchTerm.toLowerCase();
    return asistenciasDiarias.filter((a) => {
      const nombreCompleto = `${a.socio.nombre} ${a.socio.apellido}`.toLowerCase();
      const dni = a.socio.dni.toLowerCase();
      const notas = (a.notas || '').toLowerCase();
      return nombreCompleto.includes(term) || dni.includes(term) || notas.includes(term);
    });
  }, [asistenciasDiarias, searchTerm]);

  // Reporte agrupado de alumnos del período con conteo acumulado y ranking
  const rankingAlumnos = useMemo(() => {
    const agrupado = asistenciasMensuales.reduce((acc: Record<string, ReporteSocio>, asistencia) => {
      // Clave única: Si tiene socio con ID usamos socio.id; si es no registrado usamos su DNI para acumularlo por persona
      const clave = asistencia.socio?.id || `dni_${asistencia.socio?.dni || 'sin_dni'}`;
      const noReg = isAlumnoNoRegistrado(asistencia);
      
      if (!acc[clave]) {
        acc[clave] = {
          socio: asistencia.socio,
          totalClases: 0,
          esNoRegistrado: noReg,
          fechas: [],
          ultimasNotas: [],
        };
      }
      acc[clave].totalClases += 1;
      acc[clave].fechas.push(asistencia.fecha);
      if (asistencia.notas && !acc[clave].ultimasNotas?.includes(asistencia.notas)) {
        acc[clave].ultimasNotas?.push(asistencia.notas);
      }
      return acc;
    }, {});

    return Object.values(agrupado).sort((a, b) => {
      if (b.totalClases !== a.totalClases) {
        return b.totalClases - a.totalClases;
      }
      return (a.socio.apellido || '').localeCompare(b.socio.apellido || '');
    });
  }, [asistenciasMensuales]);

  // Filtrado de alumnos acumulados por término de búsqueda
  const filteredRankingAlumnos = useMemo(() => {
    if (!searchReporte.trim()) return rankingAlumnos;
    const term = searchReporte.toLowerCase().trim();
    return rankingAlumnos.filter((r) => {
      const nom = `${r.socio.nombre} ${r.socio.apellido}`.toLowerCase();
      const dni = (r.socio.dni || '').toLowerCase();
      const cat = (r.socio.categoria || '').toLowerCase();
      return nom.includes(term) || dni.includes(term) || cat.includes(term);
    });
  }, [rankingAlumnos, searchReporte]);

  // Exportar asistencias a Excel (diario o período)
  const exportarAExcel = (tipo: 'diario' | 'periodo') => {
    try {
      const lista = tipo === 'diario' ? filteredDiarias : asistenciasMensuales;

      if (lista.length === 0) {
        toast({
          title: 'Sin datos',
          description: 'No hay asistencias registradas para exportar en este período.',
          variant: 'destructive',
        });
        return;
      }

      const rows = lista.map((a, idx) => {
        const noRegistrado = isAlumnoNoRegistrado(a);
        const fechaObj = new Date(a.fecha);
        const fechaStr = format(fechaObj, 'dd/MM/yyyy');
        const horaStr = format(fechaObj, 'HH:mm');

        let nombre = `${a.socio.apellido}, ${a.socio.nombre}`;
        if (noRegistrado) {
          nombre = 'Alumno No Registrado';
        }

        let estadoCuota = 'Al día';
        if (noRegistrado) {
          estadoCuota = 'Sin ficha';
        } else if (a.socio.estado === 'inactivo') {
          estadoCuota = 'Inactivo';
        } else if ((a.socio.mesesAdeudados || 0) > 0) {
          estadoCuota = `Debe ${a.socio.mesesAdeudados} cuota(s)`;
        }

        return {
          'N°': idx + 1,
          'Fecha': fechaStr,
          'Hora': horaStr,
          'Alumno / Socio': nombre,
          'DNI': a.socio.dni,
          'Categoría': a.socio.categoria || 'Alumno',
          'Estado Cuota': estadoCuota,
          'Observaciones / Notas': a.notas || '-',
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 },   // N°
        { wch: 14 },  // Fecha
        { wch: 10 },  // Hora
        { wch: 32 },  // Nombre
        { wch: 14 },  // DNI
        { wch: 16 },  // Categoria
        { wch: 20 },  // Estado Cuota
        { wch: 35 },  // Observaciones
      ];

      const wb = XLSX.utils.book_new();
      const sheetName = tipo === 'diario' ? 'Asistencias Dia' : 'Asistencias Periodo';
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Al exportar período, la primera hoja es el Resumen Acumulado por Alumno (Total Clases en el Mes/Período)
      if (tipo === 'periodo') {
        const resumenRows = rankingAlumnos.map((r, idx) => {
          const noReg = r.esNoRegistrado;
          let estadoCuota = 'Al día';
          if (noReg) {
            estadoCuota = 'Sin ficha';
          } else if (r.socio.estado === 'inactivo') {
            estadoCuota = 'Inactivo';
          } else if ((r.socio.mesesAdeudados || 0) > 0) {
            estadoCuota = `Debe ${r.socio.mesesAdeudados} cuota(s)`;
          }

          return {
            'Puesto': idx + 1,
            'Alumno / Socio': noReg ? 'Alumno No Registrado' : `${r.socio.apellido}, ${r.socio.nombre}`,
            'DNI': r.socio.dni,
            'Categoría': noReg ? 'No Registrado' : (r.socio.categoria || 'Alumno'),
            'Total Asistencias': r.totalClases,
            'Estado Cuota': estadoCuota,
            'Fechas que Asistió': r.fechas.map((f) => format(new Date(f), 'dd/MM')).join(', '),
          };
        });

        const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
        wsResumen['!cols'] = [
          { wch: 8 },
          { wch: 32 },
          { wch: 14 },
          { wch: 18 },
          { wch: 18 },
          { wch: 20 },
          { wch: 45 },
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsResumen, 'Total Asistencias Alumnos');

        // Segunda solapa: Detalle individual paso a paso
        XLSX.utils.book_append_sheet(wb, ws, 'Detalle Individual');

        const fileName = `Asistencias_Particulares_Acumulado_${modoPeriodoReporte}_${periodoLabel.replace(/[\/\s:]+/g, '_')}.xlsx`;
        XLSX.writeFile(wb, fileName);

        toast({
          title: 'Excel generado exitosamente',
          description: `Se exportaron ${rankingAlumnos.length} alumnos acumulados (${rows.length} registros).`,
        });
        return;
      }

      const fileName = tipo === 'diario'
        ? `Asistencias_Particulares_${format(selectedDate, 'yyyy-MM-dd')}.xlsx`
        : `Asistencias_Particulares_${modoPeriodoReporte}_${periodoLabel.replace(/[\/\s:]+/g, '_')}.xlsx`;

      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Excel generado exitosamente',
        description: `Se exportaron ${rows.length} asistencias en el archivo.`,
      });
    } catch (err: any) {
      console.error('Error al exportar a Excel:', err);
      toast({
        title: 'Error al exportar',
        description: 'No se pudo generar el archivo Excel.',
        variant: 'destructive',
      });
    }
  };

  // Conteo de alumnos no registrados en el día
  const noRegistradosHoyCount = useMemo(() => {
    return asistenciasDiarias.filter(isAlumnoNoRegistrado).length;
  }, [asistenciasDiarias]);

  return (
    <div className="space-y-5">
      {/* Panel Superior: Acceso Rápido y QR para Alumnos */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-5 shadow-lg print:hidden">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="flex-shrink-0 flex flex-col items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrImageUrl}
              alt="Código QR Alumnos"
              width={130}
              height={130}
              className="rounded-xl border-2 border-[#FFCC00]/60 shadow-md bg-white p-1"
            />
            <div className="mt-2 text-center">
              <span className="text-[11px] font-bold text-[#FFCC00] uppercase tracking-wider">
                QR Asistencia
              </span>
            </div>
          </div>

          <div className="flex-1 text-center lg:text-left">
            <div className="flex items-center gap-2 justify-center lg:justify-start mb-1.5 flex-wrap">
              <QrCode className="h-5 w-5 text-[#FFCC00]" />
              <h3 className="text-white text-base font-bold">
                Página de Alumnos · Asistencia a Clases
              </h3>
              <Badge variant="outline" className="text-[10px] bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/30 font-bold uppercase">
                Pública · Escaneo QR
              </Badge>
            </div>

            <p className="text-[#AAAAAA] text-xs mb-2 leading-relaxed">
              Los alumnos escanean este código con su celular e ingresan su número de DNI para registrar su asistencia a la clase del día.
            </p>

            <div className="p-2.5 rounded-lg bg-[#2A2415] border border-amber-500/30 text-amber-300 text-xs mb-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
              <span>
                <strong>Registro Universal:</strong> Si el DNI ingresado no existe en el padrón de socios, el sistema lo registra de todas formas como <strong>&quot;Alumno No Registrado&quot;</strong> para que secretaría pueda contactarlo y asociar su ficha.
              </span>
            </div>

            <div className="inline-flex items-center gap-2 bg-[#121212] px-3 py-1.5 rounded-lg border border-[#333333] text-[12px] font-mono text-[#CCCCCC] mb-3 max-w-full overflow-hidden text-ellipsis">
              <span className="truncate">{asistenciaUrl}</span>
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
                onClick={() => window.open(asistenciaUrl, '_blank')}
                className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] h-8 text-xs font-bold shadow-sm"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Abrir en nueva pestaña
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas: Presentes Diarios vs Alumnos Mensual */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as 'diaria' | 'mensual')} className="w-full">
        <TabsList className="bg-[#1E1E1E] border border-[#333333] p-1 h-12 mb-4 grid grid-cols-2 w-full max-w-md print:hidden">
          <TabsTrigger 
            value="diaria" 
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-xs sm:text-sm font-semibold h-10 px-3 rounded-md transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Presentes Diarios ({asistenciasDiarias.length})</span>
          </TabsTrigger>
          <TabsTrigger 
            value="mensual"
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-xs sm:text-sm font-semibold h-10 px-3 rounded-md transition-all flex items-center justify-center gap-2"
          >
            <Users className="w-4 h-4 shrink-0" />
            <span>Alumnos Mensual</span>
          </TabsTrigger>
        </TabsList>

        {/* =========================================================================
            TAB 1: PRESENTES DIARIOS (ESCANEOS DEL DÍA CON DNI)
           ========================================================================= */}
        <TabsContent value="diaria" className="m-0 space-y-4 focus-visible:outline-none">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white text-base font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#FFCC00]" />
                  Presentes de Alumnos · {format(selectedDate, "EEEE dd 'de' MMMM", { locale: es })}
                </h3>
                <p className="text-[#999999] text-xs mt-0.5">
                  {asistenciasDiarias.length} alumno{asistenciasDiarias.length !== 1 ? 's' : ''} presentes en la clase
                  {noRegistradosHoyCount > 0 && (
                    <span className="ml-2 font-bold text-amber-400">
                      ({noRegistradosHoyCount} no registrado{noRegistradosHoyCount !== 1 ? 's' : ''})
                    </span>
                  )}
                </p>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
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
                      onSelect={(date) => { if (date) setSelectedDate(date); }}
                      initialFocus
                      locale={es}
                      className="bg-[#1E1E1E] text-white"
                    />
                  </PopoverContent>
                </Popover>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedDate(new Date())}
                  className="h-8 text-xs border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white"
                >
                  Hoy
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportarAExcel('diario')}
                  disabled={loading || filteredDiarias.length === 0}
                  className="h-8 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 font-semibold gap-1.5"
                  title="Exportar asistencias del día a Excel"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Exportar Excel</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAsistenciasDiarias(selectedDate)}
                  disabled={loading}
                  className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
                >
                  <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>
            </div>

            {/* Barra de búsqueda rápida */}
            <div className="mb-4">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, apellido o DNI..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-8 text-xs bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00]"
                />
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
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Alumno / Socio</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">DNI</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Estado Socio / Cuota</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Detalle / Notas</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-right w-20">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDiarias.length === 0 ? (
                      <TableRow className="border-[#333333]">
                        <TableCell colSpan={6} className="text-center py-10 text-[#666666] text-sm">
                          {searchTerm 
                            ? 'No se encontraron asistencias que coincidan con la búsqueda.'
                            : 'No hay alumnos registrados con DNI para esta fecha.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredDiarias.map((asistencia) => {
                        const noRegistrado = isAlumnoNoRegistrado(asistencia);
                        const alertas = getAlertasSocio(asistencia.socio);
                        const tieneAlertas = alertas.length > 0;

                        return (
                          <TableRow
                            key={asistencia.id}
                            className={cn(
                              'border-[#333333] transition-colors',
                              noRegistrado 
                                ? 'bg-amber-500/10 hover:bg-amber-500/15' 
                                : tieneAlertas 
                                ? 'bg-red-500/5 hover:bg-red-500/10' 
                                : 'hover:bg-[#252525]'
                            )}
                          >
                            {/* Hora */}
                            <TableCell className="text-[#999999] text-sm py-3 font-mono whitespace-nowrap">
                              {format(new Date(asistencia.fecha), 'HH:mm')} hs
                            </TableCell>

                            {/* Alumno */}
                            <TableCell className="text-[#CCCCCC] text-sm py-3">
                              {noRegistrado ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] font-bold px-2 py-0.5">
                                    <AlertTriangle className="w-3 h-3 mr-1 inline" /> Alumno No Registrado
                                  </Badge>
                                  <span className="text-xs text-amber-200/80 italic">
                                    (Escaneó QR · Requiere regularización)
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-semibold text-white">{asistencia.socio.apellido}</span>, {asistencia.socio.nombre}
                                  {asistencia.socio.categoria && (
                                    <span className="text-[11px] text-[#777777] ml-2 capitalize">
                                      ({asistencia.socio.categoria})
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>

                            {/* DNI */}
                            <TableCell className="py-3 font-mono whitespace-nowrap">
                              <span className={cn(
                                "text-xs font-bold px-2 py-1 rounded border",
                                noRegistrado 
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40" 
                                  : "bg-[#2A2A2A] text-white border-[#3A3A3A]"
                              )}>
                                {asistencia.socio.dni}
                              </span>
                            </TableCell>

                            {/* Estado Cuota */}
                            <TableCell className="text-center py-3">
                              {noRegistrado ? (
                                <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold">
                                  <UserX className="h-3 w-3 mr-1" /> Sin ficha en sistema
                                </Badge>
                              ) : tieneAlertas ? (
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

                            {/* Observaciones */}
                            <TableCell className="text-[#888888] text-xs py-3 max-w-[200px] truncate" title={asistencia.notas || ''}>
                              {asistencia.notas ? (
                                <span className={noRegistrado ? 'text-amber-300/80' : ''}>
                                  {asistencia.notas}
                                </span>
                              ) : (
                                '-'
                              )}
                            </TableCell>

                            {/* Acciones */}
                            <TableCell className="text-right py-3">
                              {!readOnly && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setAsistenciaParaEliminar(asistencia)}
                                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md transition-colors"
                                  title="Eliminar asistencia"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
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
            TAB 2: REPORTE DE PERÍODO — LISTADO Y RANKING (SEMANAL / MENSUAL / ANUAL)
           ========================================================================= */}
        <TabsContent value="mensual" className="m-0 space-y-4 focus-visible:outline-none">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 print:border-none print:p-0">
            {/* Cabecera y Selector de Período estilo Secretaría */}
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-white text-base font-bold print:text-black flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#FFCC00]" />
                    <span>Reporte de Asistencias de Alumnos</span>
                  </h3>
                  <p className="text-[#999999] text-xs print:text-gray-600 mt-0.5">
                    {periodoLabel || selectedMonth} · <strong>{asistenciasMensuales.length}</strong> asistencia{asistenciasMensuales.length !== 1 ? 's' : ''} registradas · <strong>{rankingAlumnos.length}</strong> alumnos únicos
                  </p>
                </div>

                {/* Acciones principales: Exportar Excel e Imprimir */}
                <div className="flex items-center gap-2 print:hidden self-start sm:self-auto flex-wrap">
                  {/* Selector de subvista: Acumulado (por alumno) vs Detalle individual */}
                  <div className="flex items-center bg-[#141414] border border-[#2E2E2E] rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => setVistaReporte('acumulado')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        vistaReporte === 'acumulado'
                          ? 'bg-[#FFCC00] text-black shadow-sm'
                          : 'text-[#AAAAAA] hover:text-white'
                      }`}
                    >
                      Acumulado ({rankingAlumnos.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setVistaReporte('detalle')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all ${
                        vistaReporte === 'detalle'
                          ? 'bg-[#FFCC00] text-black shadow-sm'
                          : 'text-[#AAAAAA] hover:text-white'
                      }`}
                    >
                      Pase x Pase ({asistenciasMensuales.length})
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportarAExcel('periodo')}
                    disabled={loading || asistenciasMensuales.length === 0}
                    className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 h-8 text-xs font-semibold gap-1.5"
                    title="Descargar archivo Excel con resumen acumulado de clases por alumno y detalle de asistencias"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    <span>Exportar Excel</span>
                  </Button>

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
                    onClick={() => fetchAsistenciasPeriodo()}
                    disabled={loading}
                    className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs font-semibold"
                  >
                    <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                  </Button>
                </div>
              </div>

              {/* Botonera de Períodos: Semana, Este Mes, Otro Mes, Todo el Año, Fechas */}
              <div className="bg-[#141414] border border-[#2E2E2E] rounded-xl p-3 flex flex-col gap-2.5 print:hidden">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-[11px] text-[#888888] font-bold uppercase tracking-wider">
                    Período del Reporte:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setModoPeriodoReporte('semana')}
                      className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                        modoPeriodoReporte === 'semana'
                          ? 'bg-[#FFCC00] text-black shadow-sm'
                          : 'bg-[#242424] text-[#AAAAAA] hover:text-white hover:bg-[#2C2C2C]'
                      }`}
                    >
                      Esta Semana
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModoPeriodoReporte('mes');
                        setSelectedMonth(format(new Date(), 'yyyy-MM'));
                      }}
                      className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                        modoPeriodoReporte === 'mes' && selectedMonth === format(new Date(), 'yyyy-MM')
                          ? 'bg-[#FFCC00] text-black shadow-sm'
                          : 'bg-[#242424] text-[#AAAAAA] hover:text-white hover:bg-[#2C2C2C]'
                      }`}
                    >
                      Este Mes
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoPeriodoReporte('mes')}
                      className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                        modoPeriodoReporte === 'mes' && selectedMonth !== format(new Date(), 'yyyy-MM')
                          ? 'bg-[#FFCC00] text-black shadow-sm'
                          : 'bg-[#242424] text-[#AAAAAA] hover:text-white hover:bg-[#2C2C2C]'
                      }`}
                    >
                      Otro Mes
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoPeriodoReporte('anio')}
                      className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                        modoPeriodoReporte === 'anio'
                          ? 'bg-[#FFCC00] text-black shadow-sm'
                          : 'bg-[#242424] text-[#AAAAAA] hover:text-white hover:bg-[#2C2C2C]'
                      }`}
                    >
                      Todo el Año
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoPeriodoReporte('personalizado')}
                      className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-colors ${
                        modoPeriodoReporte === 'personalizado'
                          ? 'bg-[#FFCC00] text-black shadow-sm'
                          : 'bg-[#242424] text-[#AAAAAA] hover:text-white hover:bg-[#2C2C2C]'
                      }`}
                    >
                      Rango Fechas
                    </button>
                  </div>
                </div>

                {/* Sub-selector según el modo seleccionado */}
                {modoPeriodoReporte === 'mes' && (
                  <div className="pt-2 border-t border-[#262626] flex items-center gap-2">
                    <span className="text-[11px] text-[#888]">Seleccionar Mes:</span>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="h-7 text-xs bg-[#242424] border-[#383838] text-white focus:ring-[#FFCC00] w-[180px]">
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
                  </div>
                )}

                {modoPeriodoReporte === 'anio' && (
                  <div className="pt-2 border-t border-[#262626] flex items-center justify-between gap-2">
                    <span className="text-[11px] text-[#888]">
                      Asistencias de todo el año <strong>{reporteAnio}</strong>:
                    </span>
                    <div className="flex items-center gap-1.5">
                      {['2024', '2025', '2026', '2027'].map((yr) => (
                        <Button
                          key={yr}
                          size="sm"
                          variant={reporteAnio === yr ? 'default' : 'outline'}
                          onClick={() => setReporteAnio(yr)}
                          className={`h-7 px-3 text-xs font-bold ${
                            reporteAnio === yr
                              ? 'bg-[#FFCC00] text-black'
                              : 'bg-[#242424] border-[#383838] text-[#AAAAAA] hover:text-white'
                          }`}
                        >
                          {yr}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {modoPeriodoReporte === 'personalizado' && (
                  <div className="pt-2 border-t border-[#262626] flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[#888]">Desde:</span>
                      <Input
                        type="date"
                        value={reporteFechaDesde}
                        onChange={(e) => setReporteFechaDesde(e.target.value)}
                        className="h-7 text-xs bg-[#242424] border-[#383838] text-white w-36"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-[#888]">Hasta:</span>
                      <Input
                        type="date"
                        value={reporteFechaHasta}
                        onChange={(e) => setReporteFechaHasta(e.target.value)}
                        className="h-7 text-xs bg-[#242424] border-[#383838] text-white w-36"
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => fetchAsistenciasPeriodo()}
                      disabled={!reporteFechaDesde || !reporteFechaHasta}
                      className="h-7 px-3 bg-[#FFCC00] text-black hover:bg-[#E6B800] font-bold text-xs"
                    >
                      Filtrar
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Barra de búsqueda para el Reporte de Alumnos */}
            <div className="mb-3">
              <div className="relative max-w-sm">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar en el reporte por nombre, apellido, DNI..."
                  value={searchReporte}
                  onChange={(e) => setSearchReporte(e.target.value)}
                  className="pl-9 h-8 text-xs bg-[#242424] border-[#383838] text-white focus:border-[#FFCC00]"
                />
              </div>
            </div>

            {loading && asistenciasMensuales.length === 0 ? (
              <div className="space-y-3 mt-4 print:hidden">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-[#2A2A2A]" />
                ))}
              </div>
            ) : vistaReporte === 'acumulado' ? (
              /* ==========================================================
                 TABLA 1: VISTA ACUMULADA (TOTAL ASISTENCIAS POR ALUMNO)
                 ========================================================== */
              <div className="overflow-x-auto print:overflow-visible">
                <Table className="print:text-black">
                  <TableHeader>
                    <TableRow className="border-[#333333] hover:bg-transparent print:border-b-2 print:border-black">
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 w-12 text-center print:text-black">#</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">Alumno / Socio</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">DNI</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center print:text-black print:font-bold">Total Asistencias</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center print:hidden">Estado Cuota</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black">Días que vino</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRankingAlumnos.length === 0 ? (
                      <TableRow className="border-[#333333] print:border-b">
                        <TableCell colSpan={6} className="text-center py-10 text-[#666666] text-sm print:text-black">
                          {searchReporte
                            ? 'No se encontraron alumnos que coincidan con la búsqueda.'
                            : 'No hay asistencias registradas en este período.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRankingAlumnos.map((item, idx) => {
                        const noRegistrado = item.esNoRegistrado;
                        const alertas = getAlertasSocio(item.socio);
                        const tieneAlertas = alertas.length > 0;

                        return (
                          <TableRow
                            key={item.socio.id || `dni_${item.socio.dni}_${idx}`}
                            className={cn(
                              'border-[#333333] transition-colors print:border-b print:border-gray-300',
                              noRegistrado
                                ? 'bg-amber-500/10 hover:bg-amber-500/15'
                                : tieneAlertas
                                ? 'bg-red-500/5 hover:bg-red-500/10'
                                : 'hover:bg-[#252525]'
                            )}
                          >
                            {/* Puesto */}
                            <TableCell className="text-center font-mono text-xs text-[#888888] py-3 print:text-black">
                              {idx + 1}
                            </TableCell>

                            {/* Alumno */}
                            <TableCell className="text-[#CCCCCC] text-sm py-3 print:text-black">
                              {noRegistrado ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-amber-300">Alumno No Registrado</span>
                                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold px-1.5 py-0">
                                    Sin ficha
                                  </Badge>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-semibold text-white">{item.socio.apellido}</span>, {item.socio.nombre}
                                  {item.socio.categoria && (
                                    <span className="text-[11px] text-[#777777] ml-2 capitalize">
                                      ({item.socio.categoria})
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>

                            {/* DNI */}
                            <TableCell className="py-3 font-mono whitespace-nowrap print:text-black">
                              <span className={cn(
                                "text-xs font-bold px-2 py-1 rounded border",
                                noRegistrado
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-[#2A2A2A] text-white border-[#3A3A3A]"
                              )}>
                                {item.socio.dni}
                              </span>
                            </TableCell>

                            {/* Total Asistencias (Conteo acumulado) */}
                            <TableCell className="text-center py-3">
                              <Badge className="bg-[#FFCC00]/20 text-[#FFCC00] border border-[#FFCC00]/50 text-xs font-extrabold px-3 py-1">
                                {item.totalClases} {item.totalClases === 1 ? 'clase' : 'clases'}
                              </Badge>
                            </TableCell>

                            {/* Estado Cuota */}
                            <TableCell className="text-center py-3 print:hidden">
                              {noRegistrado ? (
                                <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold">
                                  <UserX className="h-3 w-3 mr-1" /> Sin ficha
                                </Badge>
                              ) : tieneAlertas ? (
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {alertas.map((alerta, i) => (
                                    <Badge key={i} variant="outline" className="bg-red-500/15 text-red-400 border-red-500/20 text-[10px]">
                                      {alerta}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1 text-green-500 text-xs font-medium">
                                  <CheckCircle2 className="h-4 w-4" /> Al día
                                </div>
                              )}
                            </TableCell>

                            {/* Fechas que asistió */}
                            <TableCell className="text-xs text-[#AAAAAA] py-3 max-w-[280px]">
                              <div className="flex flex-wrap gap-1">
                                {item.fechas.map((f, fi) => (
                                  <span
                                    key={fi}
                                    className="px-1.5 py-0.5 rounded bg-[#242424] border border-[#383838] text-[11px] font-mono text-[#CCCCCC]"
                                    title={format(new Date(f), "dd/MM/yyyy 'a las' HH:mm 'hs'")}
                                  >
                                    {format(new Date(f), 'dd/MM')}
                                  </span>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              /* ==========================================================
                 TABLA 2: VISTA DETALLADA PASE POR PASE (CON BOTÓN ELIMINAR)
                 ========================================================== */
              <div className="overflow-x-auto print:overflow-visible">
                <Table className="print:text-black">
                  <TableHeader>
                    <TableRow className="border-[#333333] hover:bg-transparent print:border-b-2 print:border-black">
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black">Fecha</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">Alumno / Socio</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">DNI</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center print:hidden">Estado</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">Notas</TableHead>
                      {!readOnly && (
                        <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-right w-20 print:hidden">Acciones</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asistenciasMensuales.length === 0 ? (
                      <TableRow className="border-[#333333] print:border-b">
                        <TableCell colSpan={!readOnly ? 6 : 5} className="text-center py-10 text-[#666666] text-sm print:text-black">
                          No hay asistencias registradas en este período.
                        </TableCell>
                      </TableRow>
                    ) : (
                      asistenciasMensuales.map((asistencia) => {
                        const noRegistrado = isAlumnoNoRegistrado(asistencia);
                        const alertas = getAlertasSocio(asistencia.socio);
                        const tieneAlertas = alertas.length > 0;

                        return (
                          <TableRow
                            key={asistencia.id}
                            className={cn(
                              'border-[#333333] transition-colors print:border-b print:border-gray-300',
                              noRegistrado
                                ? 'bg-amber-500/10 hover:bg-amber-500/15'
                                : tieneAlertas
                                ? 'bg-red-500/5 hover:bg-red-500/10'
                                : 'hover:bg-[#252525]'
                            )}
                          >
                            {/* Fecha */}
                            <TableCell className="text-[#999999] text-sm py-3 font-mono whitespace-nowrap print:text-black">
                              {format(new Date(asistencia.fecha), "dd/MM/yyyy")}
                              <span className="ml-1 text-xs text-[#666666] print:hidden">
                                {format(new Date(asistencia.fecha), 'HH:mm')}
                              </span>
                            </TableCell>

                            {/* Alumno */}
                            <TableCell className="text-[#CCCCCC] text-sm py-3 print:text-black">
                              {noRegistrado ? (
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px] font-bold px-2 py-0.5">
                                    <AlertTriangle className="w-3 h-3 mr-1 inline" /> Alumno No Registrado
                                  </Badge>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-semibold text-white">{asistencia.socio.apellido}</span>, {asistencia.socio.nombre}
                                  {asistencia.socio.categoria && (
                                    <span className="text-[11px] text-[#777777] ml-2 capitalize">
                                      ({asistencia.socio.categoria})
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>

                            {/* DNI */}
                            <TableCell className="py-3 font-mono whitespace-nowrap print:text-black">
                              <span className={cn(
                                "text-xs font-bold px-2 py-1 rounded border",
                                noRegistrado
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                  : "bg-[#2A2A2A] text-white border-[#3A3A3A]"
                              )}>
                                {asistencia.socio.dni}
                              </span>
                            </TableCell>

                            {/* Estado */}
                            <TableCell className="text-center py-3 print:hidden">
                              {noRegistrado ? (
                                <Badge variant="outline" className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold">
                                  <UserX className="h-3 w-3 mr-1" /> Sin ficha
                                </Badge>
                              ) : tieneAlertas ? (
                                <div className="flex items-center justify-center gap-1 flex-wrap">
                                  {alertas.map((alerta, i) => (
                                    <Badge key={i} variant="outline" className="bg-red-500/15 text-red-400 border-red-500/20 text-[10px]">
                                      {alerta}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1 text-green-500 text-xs font-medium">
                                  <CheckCircle2 className="h-4 w-4" /> Al día
                                </div>
                              )}
                            </TableCell>

                            {/* Notas */}
                            <TableCell className="text-[#888888] text-xs py-3 max-w-[160px] truncate print:text-black" title={asistencia.notas || ''}>
                              {asistencia.notas ? (
                                <span className={noRegistrado ? 'text-amber-300/80' : ''}>{asistencia.notas}</span>
                              ) : (
                                '-'
                              )}
                            </TableCell>

                            {/* Acciones */}
                            {!readOnly && (
                              <TableCell className="text-right py-3 print:hidden">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setAsistenciaParaEliminar(asistencia)}
                                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-md transition-colors"
                                  title="Eliminar asistencia"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            )}
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
      </Tabs>

      {/* Diálogo de Confirmación para Eliminar Asistencia */}
      <Dialog open={Boolean(asistenciaParaEliminar)} onOpenChange={(open) => { if (!open) setAsistenciaParaEliminar(null); }}>
        <DialogContent className="bg-[#1E1E1E] border-[#333333] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-red-400">
              <Trash2 className="h-5 w-5" />
              ¿Eliminar registro de asistencia?
            </DialogTitle>
            <DialogDescription className="text-xs text-[#AAAAAA] mt-1.5 leading-relaxed">
              Esta acción eliminará la asistencia de{' '}
              <strong className="text-white">
                {asistenciaParaEliminar?.socio.nombre} {asistenciaParaEliminar?.socio.apellido}
              </strong>{' '}
              (DNI {asistenciaParaEliminar?.socio.dni}) registrada el{' '}
              {asistenciaParaEliminar?.fecha && format(new Date(asistenciaParaEliminar.fecha), "dd/MM/yyyy 'a las' HH:mm 'hs'")}.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAsistenciaParaEliminar(null)}
              className="bg-[#2A2A2A] border-[#383838] text-white hover:bg-[#333333]"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleEliminarAsistencia}
              disabled={Boolean(eliminandoId)}
              className="bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5"
            >
              {eliminandoId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              <span>Eliminar</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
