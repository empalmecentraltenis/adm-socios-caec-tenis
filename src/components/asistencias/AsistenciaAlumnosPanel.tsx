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
  Award
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
  notas?: string | null;
  socio: Socio;
}

interface ReporteSocio {
  socio: Socio;
  totalClases: number;
  esNoRegistrado: boolean;
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
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para alumnos (DNI)
  const [asistenciasDiarias, setAsistenciasDiarias] = useState<Asistencia[]>([]);
  const [asistenciasMensuales, setAsistenciasMensuales] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);

  // Selectores de fecha
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  // URL pública de escaneo de QR para alumnos
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const asistenciaUrl = `${origin}/asistencia`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(asistenciaUrl)}&margin=10`;

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

  // Fetch asistencias mensuales
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

  useEffect(() => {
    if (activeTab === 'diaria') {
      fetchAsistenciasDiarias(selectedDate);
    } else {
      fetchAsistenciasMensuales(selectedMonth);
    }
  }, [activeTab, selectedDate, selectedMonth, fetchAsistenciasDiarias, fetchAsistenciasMensuales]);

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

  // Reporte agrupado de alumnos del mes con ranking
  const rankingAlumnos = useMemo(() => {
    const agrupado = asistenciasMensuales.reduce((acc: Record<string, ReporteSocio>, asistencia) => {
      const socioId = asistencia.socio.id;
      const noReg = (asistencia.socio.apellido?.toLowerCase() === 'no registrado') || 
                    Boolean(asistencia.notas?.toLowerCase().includes('no registrado'));
      if (!acc[socioId]) {
        acc[socioId] = { socio: asistencia.socio, totalClases: 0, esNoRegistrado: noReg };
      }
      acc[socioId].totalClases += 1;
      return acc;
    }, {});

    return Object.values(agrupado).sort((a, b) => {
      if (b.totalClases !== a.totalClases) {
        return b.totalClases - a.totalClases;
      }
      return a.socio.apellido.localeCompare(b.socio.apellido);
    });
  }, [asistenciasMensuales]);

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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDiarias.length === 0 ? (
                      <TableRow className="border-[#333333]">
                        <TableCell colSpan={5} className="text-center py-10 text-[#666666] text-sm">
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
            TAB 2: REPORTE MENSUAL Y RANKING DE ALUMNOS
           ========================================================================= */}
        <TabsContent value="mensual" className="m-0 space-y-4 focus-visible:outline-none">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-xl p-4 print:border-none print:p-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white text-base font-bold print:text-black flex items-center gap-2">
                  <Award className="w-5 h-5 text-[#FFCC00]" />
                  Ranking Mensual de Asistencia de Alumnos
                </h3>
                <p className="text-[#999999] text-xs print:text-gray-600">
                  Total de asistencias registradas en {format(new Date(selectedMonth + '-01T00:00:00'), 'MMMM yyyy', { locale: es })} ({rankingAlumnos.length} alumnos distintos)
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

            {loading && rankingAlumnos.length === 0 ? (
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
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 w-12 text-center print:text-black">#</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">Alumno / Socio</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">DNI</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold text-center">Clases Asistidas</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center print:hidden">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingAlumnos.length === 0 ? (
                      <TableRow className="border-[#333333] print:border-b">
                        <TableCell colSpan={5} className="text-center py-10 text-[#666666] text-sm print:text-black">
                          No hay asistencias registradas en este mes.
                        </TableCell>
                      </TableRow>
                    ) : (
                      rankingAlumnos.map(({ socio, totalClases, esNoRegistrado }, idx) => (
                        <TableRow
                          key={socio.id}
                          className={cn(
                            "border-[#333333] hover:bg-[#252525] print:border-b print:border-gray-300 print:hover:bg-transparent",
                            esNoRegistrado && "bg-amber-500/10"
                          )}
                        >
                          <TableCell className="text-center font-mono font-bold text-xs text-[#888888] print:text-black">
                            {idx + 1}
                          </TableCell>

                          <TableCell className="text-[#CCCCCC] text-sm py-3 print:text-black">
                            {esNoRegistrado ? (
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-amber-300">Alumno No Registrado</span>
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold">
                                  No Empadronado
                                </Badge>
                              </div>
                            ) : (
                              <div>
                                <span className="font-semibold text-white">{socio.apellido}</span>, {socio.nombre}
                              </div>
                            )}
                          </TableCell>

                          <TableCell className="text-[#999999] text-xs font-mono py-3 print:text-black">
                            {socio.dni}
                          </TableCell>

                          <TableCell className="text-center py-3">
                            <Badge variant="outline" className="bg-[#FFCC00]/10 text-[#FFCC00] border-[#FFCC00]/20 font-bold px-3 py-0.5 print:bg-transparent print:border-none print:text-black print:p-0">
                              {totalClases} {totalClases === 1 ? 'clase' : 'clases'}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-center py-3 print:hidden">
                            {esNoRegistrado ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px]">
                                Pendiente Registro
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-[#2A2A2A] text-[#AAAAAA] border-[#444444] text-[10px] capitalize">
                                {socio.categoria || 'Socio'}
                              </Badge>
                            )}
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
    </div>
  );
}
