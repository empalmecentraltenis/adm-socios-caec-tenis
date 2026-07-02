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
import { Input } from '@/components/ui/input';
import { RefreshCcw, AlertTriangle, CheckCircle2, Printer, QrCode, ExternalLink, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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

export default function AsistenciasTable() {
  const [activeTab, setActiveTab] = useState('diaria');
  const [asistenciasDiarias, setAsistenciasDiarias] = useState<Asistencia[]>([]);
  const [asistenciasMensuales, setAsistenciasMensuales] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados para los selectores de fecha
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

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

  // Polling solo para el día actual si estamos en la vista diaria
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (activeTab === 'diaria') {
      const isToday = format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
      if (isToday) {
        interval = setInterval(() => fetchAsistenciasDiarias(selectedDate), 30000);
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, selectedDate, fetchAsistenciasDiarias]);

  const getAlertasSocio = (socio: Socio) => {
    const alertas: string[] = [];
    if (socio.estado === 'inactivo') {
      alertas.push('Inactivo');
    }
    const hoy = new Date();
    const cuotasPendientes = socio.cuotas?.filter(c => c.estado === 'pendiente') || [];
    const mesesAdeudados = cuotasPendientes.filter(c => {
      const [anio, mes] = c.mes.split('-');
      const vencimiento = new Date(parseInt(anio), parseInt(mes) - 1, 16); 
      return hoy >= vencimiento;
    }).length;
    if (mesesAdeudados >= 2) {
      alertas.push(`Debe ${mesesAdeudados} cuotas`);
    }
    return alertas;
  };

  // URL pública — detecta automáticamente el dominio real
  const asistenciaUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/asistencia`
    : '/asistencia';

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(asistenciaUrl)}&margin=10`;

  function handlePrintQr() {
    const win = window.open('', '_blank');
    if (!win) return;
    const printUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(asistenciaUrl)}&margin=10`;
    win.document.write(
      '<!DOCTYPE html><html><head><title>QR Asistencia - CAEC Tenis</title>' +
      '<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;}' +
      'h1{font-size:28px;margin-bottom:8px;color:#111;}p{color:#555;margin-bottom:24px;font-size:16px;}' +
      'img{border:3px solid #FFCC00;border-radius:12px;padding:8px;}.url{margin-top:16px;font-size:13px;color:#888;word-break:break-all;}</style>' +
      '</head><body>' +
      '<h1>🎾 CAEC - Clases de Tenis</h1>' +
      '<p>Escaneá este código para registrar tu asistencia</p>' +
      '<img src="' + printUrl + '" />' +
      '<p class="url">' + asistenciaUrl + '</p>' +
      '</body></html>'
    );
    win.document.close();
    win.onload = () => win.print();
  }

  function handlePrintReport() {
    window.print();
  }

  // Agrupar asistencias mensuales por socio
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
    <div className="space-y-4">
      {/* Panel QR */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4 flex flex-col sm:flex-row items-center gap-6 print:hidden">
        <div className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImageUrl}
            alt="QR de asistencia"
            width={140}
            height={140}
            className="rounded-lg border-2 border-[#FFCC00]/50"
          />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
            <QrCode className="h-4 w-4 text-[#FFCC00]" />
            <h3 className="text-white text-sm font-semibold">Código QR para Alumnos</h3>
          </div>
          <p className="text-[#999999] text-xs mb-1">
            El alumno escanea el QR con la cámara del celular, escribe su DNI y toca{' '}
            <strong className="text-white">&quot;Dar Presente&quot;</strong>.
          </p>
          <p className="text-[#666666] text-[11px] font-mono break-all mb-3">{asistenciaUrl}</p>
          <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrintQr}
              className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Imprimir QR
            </Button>
            <Button
              size="sm"
              onClick={() => window.open('/asistencia', '_blank')}
              className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] h-8 text-xs font-semibold"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Abrir página del alumno
            </Button>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-[#1E1E1E] border border-[#333333] p-1 h-12 mb-4 print:hidden">
          <TabsTrigger 
            value="diaria" 
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-sm h-10 px-6 rounded-md transition-all"
          >
            Vista Diaria
          </TabsTrigger>
          <TabsTrigger 
            value="mensual"
            className="data-[state=active]:bg-[#FFCC00] data-[state=active]:text-[#121212] text-[#999999] text-sm h-10 px-6 rounded-md transition-all"
          >
            Reporte Mensual
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Vista Diaria */}
        <TabsContent value="diaria" className="m-0 focus-visible:outline-none">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-white text-base font-semibold">
                    Asistencias del {format(selectedDate, 'dd/MM/yyyy')}
                  </h3>
                  <p className="text-[#999999] text-xs">
                    {asistenciasDiarias.length} alumno{asistenciasDiarias.length !== 1 ? 's' : ''} registrado{asistenciasDiarias.length !== 1 ? 's' : ''}
                  </p>
                </div>
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
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
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
                  onClick={() => fetchAsistenciasDiarias(selectedDate)}
                  disabled={loading}
                  className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs"
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
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Socio</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">DNI</TableHead>
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {asistenciasDiarias.length === 0 ? (
                      <TableRow className="border-[#333333]">
                        <TableCell colSpan={4} className="text-center py-10 text-[#666666] text-sm">
                          No hay asistencias registradas para esta fecha.
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
                              {format(new Date(asistencia.fecha), 'dd/MM/yyyy HH:mm')} hs
                            </TableCell>
                            <TableCell className="text-[#CCCCCC] text-sm py-3">
                              <span className="font-semibold">{asistencia.socio.apellido}</span>, {asistencia.socio.nombre}
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

        {/* Tab 2: Reporte Mensual */}
        <TabsContent value="mensual" className="m-0 focus-visible:outline-none">
          <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4 print:border-none print:p-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white text-base font-semibold print:text-black">Reporte Mensual de Asistencia</h3>
                <p className="text-[#999999] text-xs print:text-gray-600">
                  Total de clases por alumno en {format(new Date(selectedMonth + '-01T00:00:00'), 'MMMM yyyy', { locale: es })}
                </p>
              </div>
              
              <div className="flex items-center gap-2 print:hidden">
                <Input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-8 text-xs bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00] focus:ring-[#FFCC00] w-[140px]"
                />
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintReport}
                  className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs"
                >
                  <Printer className="h-3.5 w-3.5 mr-1.5" />
                  Imprimir
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchAsistenciasMensuales(selectedMonth)}
                  disabled={loading}
                  className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs"
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
                      <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 print:text-black print:font-bold">Socio</TableHead>
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
                            <span className="font-semibold">{socio.apellido}</span>, {socio.nombre}
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
    </div>
  );
}
