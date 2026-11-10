'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Download,
  FileSpreadsheet,
  FileDown,
  Users,
  GraduationCap,
  Sparkles,
  Trophy,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  FileArchive,
  Loader2,
  ArrowUpRight,
  ShieldCheck,
  Receipt,
  Printer,
  ChevronLeft,
  ChevronRight,
  Wallet,
  BookOpen,
  Landmark,
  Eye,
} from 'lucide-react';
import EventoSlideView, { EventoInformeData } from '@/components/eventos/EventoSlideView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function ComisionDirectivaPage() {
  const { toast } = useToast();

  const getCurMonthStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const [mesSeleccionado, setMesSeleccionado] = useState<string>(getCurMonthStr());
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);

  // Estados de búsqueda / filtros locales
  const [searchEscuela, setSearchEscuela] = useState('');
  const [filtroGrupoEscuela, setFiltroGrupoEscuela] = useState<string>('todos');
  const [searchParticulares, setSearchParticulares] = useState('');
  const [searchSocios, setSearchSocios] = useState('');
  const [searchProfesor, setSearchProfesor] = useState('');

  // Estados de acordeón desplegable por sección (por defecto cerrados para una vista ejecutiva compacta y prolija)
  const [showDetalleBalance, setShowDetalleBalance] = useState(false);
  const [showDetalleInversiones, setShowDetalleInversiones] = useState(false);
  const [showDetalleEscuela, setShowDetalleEscuela] = useState(false);
  const [showDetalleParticulares, setShowDetalleParticulares] = useState(false);
  const [showDetalleProfesor, setShowDetalleProfesor] = useState(false);
  const [showDetalleSocios, setShowDetalleSocios] = useState(false);
  const [showDetalleEventos, setShowDetalleEventos] = useState(true);

  // Modal para ver diapositiva desde comisión directiva
  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [selectedEventoSlide, setSelectedEventoSlide] = useState<EventoInformeData | null>(null);

  // Estado de descarga de paquete ZIP
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Año actual
  const anioActual = useMemo(() => {
    return mesSeleccionado.split('-')[0] || String(new Date().getFullYear());
  }, [mesSeleccionado]);

  // Cargar datos consolidados
  const fetchDatosComision = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/comision?mes=${mesSeleccionado}&anio=${anioActual}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json);
      } else {
        toast({
          title: 'Error al cargar informe',
          description: json.error || 'No se pudieron obtener los datos para Comisión Directiva.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el servidor',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [mesSeleccionado, anioActual, toast]);

  useEffect(() => {
    fetchDatosComision();
  }, [fetchDatosComision]);

  // Formato etiqueta de mes: ej. "NOVIEMBRE 2026"
  const labelMesActual = useMemo(() => {
    const [y, m] = mesSeleccionado.split('-').map(Number);
    if (!y || !m) return mesSeleccionado;
    return `${MESES_NOMBRES[m - 1].toUpperCase()} ${y}`;
  }, [mesSeleccionado]);

  // Cambiar mes con botones rápidos
  const handleCambiarMes = (delta: number) => {
    const [y, m] = mesSeleccionado.split('-').map(Number);
    const date = new Date(y, m - 1 + delta, 1);
    const nextY = date.getFullYear();
    const nextM = String(date.getMonth() + 1).padStart(2, '0');
    setMesSeleccionado(`${nextY}-${nextM}`);
  };

  // Filtrados locales para búsquedas
  const escuelaFiltrada = useMemo(() => {
    if (!data?.escuela?.alumnos) return [];
    return data.escuela.alumnos.filter((al: any) => {
      if (filtroGrupoEscuela !== 'todos' && al.grupo !== filtroGrupoEscuela) return false;
      if (searchEscuela.trim()) {
        const term = searchEscuela.toLowerCase();
        return al.nombre.toLowerCase().includes(term);
      }
      return true;
    });
  }, [data?.escuela?.alumnos, filtroGrupoEscuela, searchEscuela]);

  const particularesFiltrados = useMemo(() => {
    if (!data?.particulares?.alumnos) return [];
    return data.particulares.alumnos.filter((al: any) => {
      if (searchParticulares.trim()) {
        const term = searchParticulares.toLowerCase();
        return al.nombre.toLowerCase().includes(term);
      }
      return true;
    });
  }, [data?.particulares?.alumnos, searchParticulares]);

  const profesorFiltrados = useMemo(() => {
    if (!data?.clasesProfesor?.registros) return [];
    return data.clasesProfesor.registros.filter((r: any) => {
      if (searchProfesor.trim()) {
        const term = searchProfesor.toLowerCase();
        return r.fecha.includes(term) || (r.observaciones || '').toLowerCase().includes(term) || (r.turno || '').toLowerCase().includes(term);
      }
      return true;
    });
  }, [data?.clasesProfesor?.registros, searchProfesor]);

  const sociosFiltrados = useMemo(() => {
    if (!data?.socios?.lista) return [];
    return data.socios.lista.filter((s: any) => {
      if (searchSocios.trim()) {
        const term = searchSocios.toLowerCase();
        const fullName = `${s.apellido} ${s.nombre}`.toLowerCase();
        const dni = String(s.dni || '');
        return fullName.includes(term) || dni.includes(term);
      }
      return true;
    });
  }, [data?.socios?.lista, searchSocios]);

  // ==========================================
  // GENERADORES DE REPORTES PDF Y EXCEL
  // ==========================================

  // 1. PDF Balance Mensual
  const generarPdfBalance = (returnBlob = false) => {
    if (!data?.balance?.movimientos) return null;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(26, 26, 26);
    doc.rect(10, 10, 190, 14, 'F');
    doc.setTextColor(255, 204, 0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CLUB EMPALME CENTRAL — SUBCOMISIÓN DE TENIS', 105, 19, { align: 'center' });

    doc.setFillColor(255, 204, 0);
    doc.rect(10, 24, 190, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`CUENTA CORRIENTE Y BALANCE MENSUAL — ${labelMesActual}`, 105, 29.5, { align: 'center' });

    const yStart = 37;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(10, yStart, 190, 24, 'FD');

    const mActual = data.balance.mesActual || {};
    doc.text(`Saldo Inicial del Mes: ${formatCurrency(mActual.saldoInicial || 0)}`, 15, yStart + 6);
    doc.text(`Total Ingresos: ${formatCurrency(mActual.ingresos || 0)}`, 15, yStart + 12);
    doc.text(`Total Egresos: ${formatCurrency(mActual.egresos || 0)}`, 15, yStart + 18);

    doc.setTextColor(0, 128, 0);
    doc.setFontSize(11);
    doc.text(`SALDO FINAL DE CIERRE: ${formatCurrency(mActual.saldoFinal || 0)}`, 105, yStart + 12);

    const tableData = data.balance.movimientos.map((m: any, idx: number) => [
      idx + 1,
      m.fecha,
      m.descripcion,
      m.responsable || '-',
      m.tipo.toUpperCase(),
      formatCurrency(m.monto),
    ]);

    autoTable(doc, {
      startY: yStart + 28,
      head: [['#', 'Fecha', 'Concepto / Descripción', 'Responsable', 'Tipo', 'Monto']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 204, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Documento emitido el ${new Date().toLocaleDateString('es-AR')} - Subcomisión de Tenis CAEC - Página ${i} de ${pageCount}`,
        105,
        290,
        { align: 'center' }
      );
    }

    if (returnBlob) return doc.output('blob');
    doc.save(`Balance_Mensual_CAEC_${mesSeleccionado}.pdf`);
  };

  // 2. PDF Oficial Escuela
  const generarPdfEscuela = (returnBlob = false) => {
    if (!data?.escuela?.alumnos) return null;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(26, 26, 26);
    doc.rect(10, 10, 190, 14, 'F');
    doc.setTextColor(255, 204, 0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CLUB EMPALME CENTRAL — SUBCOMISIÓN DE TENIS', 105, 19, { align: 'center' });

    doc.setFillColor(255, 204, 0);
    doc.rect(10, 24, 190, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`ALUMNOS DE ESCUELA DE TENIS Y RECAUDACIÓN — ${labelMesActual}`, 105, 29.5, { align: 'center' });

    const yStart = 37;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(10, yStart, 190, 18, 'FD');

    doc.text(`Total Alumnos: ${data.escuela.totalAlumnos}`, 15, yStart + 6);
    doc.text(`Escuelita: ${data.escuela.porGrupo?.Escuelita || 0} | Minitenis: ${data.escuela.porGrupo?.Minitenis || 0} | Competencia: ${data.escuela.porGrupo?.['Grupo Entrenamiento'] || 0}`, 15, yStart + 12);
    doc.setTextColor(0, 128, 0);
    doc.text(`Total Recaudado Cuotas: ${formatCurrency(data.escuela.recaudadoMesActual)}`, 110, yStart + 9);

    const tableData = data.escuela.alumnos.map((al: any, idx: number) => [
      idx + 1,
      al.nombre,
      al.grupo === 'Grupo Entrenamiento' ? 'Competencia' : al.grupo,
    ]);

    autoTable(doc, {
      startY: yStart + 22,
      head: [['#', 'Nombre del Alumno', 'Grupo']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 204, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    if (returnBlob) return doc.output('blob');
    doc.save(`Alumnos_Escuela_${mesSeleccionado}.pdf`);
  };

  // 3. PDF Particulares
  const generarPdfParticulares = (returnBlob = false) => {
    if (!data?.particulares?.alumnos) return null;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(26, 26, 26);
    doc.rect(10, 10, 190, 14, 'F');
    doc.setTextColor(255, 204, 0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CLUB EMPALME CENTRAL — SUBCOMISIÓN DE TENIS', 105, 19, { align: 'center' });

    doc.setFillColor(255, 204, 0);
    doc.rect(10, 24, 190, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`ALUMNOS DE CLASES PARTICULARES — ${labelMesActual}`, 105, 29.5, { align: 'center' });

    const yStart = 37;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(10, yStart, 190, 14, 'FD');

    doc.text(`Total Alumnos en el Mes: ${data.particulares.totalAlumnosMesActual}`, 15, yStart + 8);

    const tableData = data.particulares.alumnos.map((al: any, idx: number) => [
      idx + 1,
      al.nombre,
      al.esSocio ? 'Socio' : 'No Socio',
      `${al.cantidadClases} clase(s) asistida(s)`,
    ]);

    autoTable(doc, {
      startY: yStart + 18,
      head: [['#', 'Alumno', 'Condición', 'Clases Asistidas']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 204, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    if (returnBlob) return doc.output('blob');
    doc.save(`Particulares_${mesSeleccionado}.pdf`);
  };

  // 4. PDF Clases Profesor
  const generarPdfProfesor = (returnBlob = false) => {
    if (!data?.clasesProfesor?.registros) return null;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(26, 26, 26);
    doc.rect(10, 10, 190, 14, 'F');
    doc.setTextColor(255, 204, 0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CLUB EMPALME CENTRAL — SUBCOMISIÓN DE TENIS', 105, 19, { align: 'center' });

    doc.setFillColor(255, 204, 0);
    doc.rect(10, 24, 190, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`REGISTRO DE CLASES DEL PROFESOR — ${labelMesActual}`, 105, 29.5, { align: 'center' });

    const yStart = 37;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(10, yStart, 190, 16, 'FD');

    doc.text(`Total Clases Dadas: ${data.clasesProfesor.totalClases}`, 15, yStart + 6);
    doc.text(`Total Alumnos Atendidos: ${data.clasesProfesor.totalAlumnos}`, 15, yStart + 12);
    doc.text(`Monto Total Clases: ${formatCurrency(data.clasesProfesor.totalMonto)}`, 110, yStart + 9);

    const tableData = data.clasesProfesor.registros.map((r: any, idx: number) => [
      idx + 1,
      r.fecha,
      r.turno,
      r.cantidadClases,
      r.cantidadAlumnos,
      formatCurrency(r.precioTotal),
      r.observaciones || '-',
    ]);

    autoTable(doc, {
      startY: yStart + 20,
      head: [['#', 'Fecha', 'Turno', 'Clases', 'Alumnos', 'Monto', 'Observaciones']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 204, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    if (returnBlob) return doc.output('blob');
    doc.save(`Clases_Profesor_${mesSeleccionado}.pdf`);
  };

  // 5. PDF Padrón General Socios
  const generarPdfSocios = (returnBlob = false) => {
    if (!data?.socios?.lista) return null;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(26, 26, 26);
    doc.rect(10, 10, 190, 14, 'F');
    doc.setTextColor(255, 204, 0);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('CLUB EMPALME CENTRAL — SUBCOMISIÓN DE TENIS', 105, 19, { align: 'center' });

    doc.setFillColor(255, 204, 0);
    doc.rect(10, 24, 190, 8, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`PADRÓN GENERAL COMPLETO DE SOCIOS — ${labelMesActual}`, 105, 29.5, { align: 'center' });

    const yStart = 37;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(10, yStart, 190, 12, 'FD');

    doc.text(`Total Socios Activos Registrados: ${data.socios.total}`, 15, yStart + 7);

    const tableData = data.socios.lista.map((s: any, idx: number) => [
      idx + 1,
      s.dni || '-',
      `${s.apellido}, ${s.nombre}`,
      s.telefono || '-',
      s.email || '-',
    ]);

    autoTable(doc, {
      startY: yStart + 16,
      head: [['#', 'DNI', 'Apellido y Nombre', 'Teléfono', 'Email']],
      body: tableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26], textColor: [255, 204, 0], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
    });

    if (returnBlob) return doc.output('blob');
    doc.save(`Padron_Socios_CAEC_${mesSeleccionado}.pdf`);
  };

  // Descargar paquete ZIP con todos los PDFs y planillas
  const handleDescargarPaqueteZip = async () => {
    if (!data) return;
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder(`Informe_Comision_Directiva_${mesSeleccionado}`);

      const bBalance = generarPdfBalance(true);
      if (bBalance) folder?.file(`1_Balance_Mensual_${mesSeleccionado}.pdf`, bBalance);

      const bEscuela = generarPdfEscuela(true);
      if (bEscuela) folder?.file(`2_Escuela_Tenis_${mesSeleccionado}.pdf`, bEscuela);

      const bPart = generarPdfParticulares(true);
      if (bPart) folder?.file(`3_Particulares_${mesSeleccionado}.pdf`, bPart);

      const bProfe = generarPdfProfesor(true);
      if (bProfe) folder?.file(`4_Clases_Profesor_${mesSeleccionado}.pdf`, bProfe);

      const bSocios = generarPdfSocios(true);
      if (bSocios) folder?.file(`5_Padron_Socios_${mesSeleccionado}.pdf`, bSocios);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `Paquete_Comision_Directiva_CAEC_${mesSeleccionado}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      toast({
        title: 'Paquete ZIP descargado',
        description: 'Se descargaron los 5 informes oficiales de Comisión Directiva.',
      });
    } catch (err: any) {
      console.error('Error al generar ZIP:', err);
      toast({
        title: 'Error al generar paquete',
        description: 'No se pudo generar el archivo ZIP.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingZip(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0E] text-white selection:bg-amber-400 selection:text-black">
      {/* 1. Barra de Encabezado Institucional */}
      <header className="border-b border-[#222225] bg-[#121214]/90 backdrop-blur sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <img
              src="/logo-caec.png"
              alt="Logo CAEC"
              className="w-12 h-12 object-contain drop-shadow"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-bold">
                  Comisión Directiva
                </span>
                <span className="text-[10px] text-[#777777] hidden sm:inline">• Portal Ejecutivo de Gestión</span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Club Empalme Central — Subcomisión de Tenis
              </h1>
            </div>
          </div>

          {/* Selector de Mes Centralizado y Descarga de Paquete */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <div className="flex items-center bg-[#18181A] border border-[#2C2C32] rounded-xl px-1.5 py-1 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCambiarMes(-1)}
                className="h-7 w-7 p-0 text-[#AAAAAA] hover:text-white"
                title="Mes anterior"
              >
                <ChevronLeft size={16} />
              </Button>

              <div className="flex items-center gap-1.5 px-2">
                <Calendar size={14} className="text-amber-400" />
                <input
                  type="month"
                  value={mesSeleccionado}
                  onChange={(e) => setMesSeleccionado(e.target.value)}
                  className="bg-transparent text-white text-xs font-black uppercase tracking-wider cursor-pointer focus:outline-none"
                />
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCambiarMes(1)}
                className="h-7 w-7 p-0 text-[#AAAAAA] hover:text-white"
                title="Mes siguiente"
              >
                <ChevronRight size={16} />
              </Button>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={fetchDatosComision}
              disabled={loading}
              className="h-9 w-9 p-0 border-[#2C2C32] bg-[#18181A] text-[#AAAAAA] hover:text-white"
              title="Actualizar datos"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>

            <Button
              size="sm"
              onClick={handleDescargarPaqueteZip}
              disabled={loading || downloadingZip}
              className="h-9 bg-amber-400 hover:bg-amber-500 text-black font-black text-xs gap-1.5 shadow-lg shadow-amber-400/10 px-3.5"
              title="Descargar todos los reportes del mes en archivo ZIP"
            >
              {downloadingZip ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileArchive size={15} />
              )}
              <span>Descargar Paquete Mensual (ZIP)</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Cuerpo Principal */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* KPI Cards Superiores */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-[#141416] border border-[#242428] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#888888]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Padrón de Socios</span>
              <Users size={18} className="text-sky-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {data?.socios?.total ?? 0}
              </div>
              <div className="text-[11px] text-[#888888] mt-0.5">Socios activos del club</div>
            </div>
          </div>

          <div className="bg-[#141416] border border-emerald-500/20 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Alumnos Escuela</span>
              <GraduationCap size={18} />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {data?.escuela?.totalAlumnos ?? 0}
              </div>
              <div className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                Recaudado: {formatCurrency(data?.escuela?.recaudadoMesActual ?? 0)}
              </div>
            </div>
          </div>

          <div className="bg-[#141416] border border-purple-500/20 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Particulares del Mes</span>
              <Sparkles size={18} />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {data?.particulares?.totalAlumnosMesActual ?? 0}
              </div>
              <div className="text-[11px] text-purple-300 font-semibold mt-0.5">
                Alumnos activos en {labelMesActual}
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================================
            SECCIÓN 1: BALANCE FINANCIERO MENSUAL (CON SALDOS MES A MES Y DESCARGA)
            ========================================================================= */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Wallet size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  1. Balance Financiero — Saldo Mes a Mes y Resumen Oficial
                </h2>
                <p className="text-xs text-[#888888]">
                  Saldo final mes por mes del año {anioActual} y detalle de movimientos de {labelMesActual}
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => generarPdfBalance(false)}
              className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1.5 font-semibold"
            >
              <FileDown size={14} />
              <span>Descargar PDF Balance ({labelMesActual})</span>
            </Button>
          </div>

          {/* Visor Mes a Mes con Saldos Finales */}
          <div className="p-4 bg-[#111113] border-b border-[#242428]">
            <div className="text-[11px] font-bold uppercase text-[#888] mb-2 flex items-center justify-between">
              <span>Saldos Finales Mes a Mes ({anioActual}):</span>
              <span className="text-xs text-amber-400">
                Saldo Actual Total en Caja: <strong>{formatCurrency(data?.balance?.saldoActualTotal ?? 0)}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
              {MESES_NOMBRES.map((nombreMes, idx) => {
                const mKey = `${anioActual}-${String(idx + 1).padStart(2, '0')}`;
                const bMes = data?.balance?.meses?.find((m: any) => m.mes === mKey) || { saldoFinal: 0, ingresos: 0, egresos: 0 };
                const isSelected = mesSeleccionado === mKey;
                const tieneMovimientos = bMes.ingresos > 0 || bMes.egresos > 0;

                return (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => setMesSeleccionado(mKey)}
                    className={`p-2 rounded-lg text-left transition-all border ${
                      isSelected
                        ? 'bg-amber-400 text-black border-amber-400 font-bold shadow-md'
                        : tieneMovimientos
                        ? 'bg-[#18181A] border-[#2E2E34] hover:border-amber-400/50 text-white'
                        : 'bg-[#141416] border-[#222226] text-[#666]'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold">{nombreMes.slice(0, 3)}</div>
                    <div className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-black font-extrabold' : 'text-emerald-400'}`}>
                      {formatCurrency(bMes.saldoFinal)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumen del mes activo (Ingresos, Egresos y Saldo Final de Cierre) */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#131315] border-b border-[#242428]">
            <div className="bg-[#18181B] border border-emerald-500/20 p-3 rounded-xl">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Ingresos del Mes</div>
              <div className="text-base font-black font-mono text-emerald-400">
                +{formatCurrency(data?.balance?.mesActual?.ingresos ?? 0)}
              </div>
            </div>

            <div className="bg-[#18181B] border border-red-500/20 p-3 rounded-xl">
              <div className="text-[10px] text-red-400 font-bold uppercase">Egresos del Mes</div>
              <div className="text-base font-black font-mono text-red-400">
                -{formatCurrency(data?.balance?.mesActual?.egresos ?? 0)}
              </div>
            </div>

            <div className="bg-[#18181B] border border-amber-500/30 p-3 rounded-xl">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Saldo Final ({labelMesActual})</div>
              <div className="text-base font-black font-mono text-amber-400">
                {formatCurrency(data?.balance?.mesActual?.saldoFinal ?? 0)}
              </div>
            </div>
          </div>

          {/* Sub-bloque: Inversiones y Ahorros de la Subcomisión */}
          <div className="p-4 bg-[#141417] border-b border-[#242428]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                  <Landmark size={15} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-white">Inversiones, Ahorros y Patrimonio Total</h3>
                  <p className="text-[11px] text-[#777]">Plazos fijos activos, reservas en dólares y total disponible</p>
                </div>
              </div>

              {data?.balance?.inversiones?.plazosFijos?.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDetalleInversiones((prev) => !prev)}
                  className="text-xs h-7 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 gap-1 font-bold"
                >
                  <span>{showDetalleInversiones ? 'Ocultar plazos fijos' : 'Ver plazos fijos'}</span>
                  {showDetalleInversiones ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </Button>
              )}
            </div>

            {/* 4 Cards de Resumen Patrimonial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Saldo en Caja */}
              <div className="bg-[#18181C] border border-[#2A2A30] p-3 rounded-xl flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
                  <Wallet size={18} />
                </div>
                <div>
                  <div className="text-[10px] text-[#888] font-bold uppercase tracking-wider">Saldo en Caja (Pesos)</div>
                  <div className="text-sm sm:text-base font-black font-mono text-white mt-0.5">
                    {formatCurrency(data?.balance?.saldoActualTotal ?? 0)}
                  </div>
                </div>
              </div>

              {/* Capital en Plazos Fijos */}
              <div className="bg-[#18181C] border border-[#2A2A30] p-3 rounded-xl flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Landmark size={18} />
                </div>
                <div>
                  <div className="text-[10px] text-[#888] font-bold uppercase tracking-wider">Capital Plazos Fijos</div>
                  <div className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-0.5">
                    {formatCurrency(data?.balance?.inversiones?.capitalPlazosActivos ?? 0)}
                  </div>
                  <div className="text-[10px] text-[#666]">
                    {data?.balance?.inversiones?.plazosFijos?.filter((p: any) => p.estado === 'activo')?.length || 0} activos
                  </div>
                </div>
              </div>

              {/* Ahorro en Dólares */}
              <div className="bg-[#18181C] border border-[#2A2A30] p-3 rounded-xl flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <DollarSign size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-[#888] font-bold uppercase tracking-wider">Ahorro en Dólares</div>
                  <div className="text-sm sm:text-base font-black font-mono text-emerald-400 mt-0.5">
                    U$S {formatCurrency(data?.balance?.inversiones?.ahorrosDolares ?? 0).replace('$', '').trim()}
                  </div>
                  <div className="text-[10px] text-[#888] flex items-center justify-between">
                    <span>1 U$S = {formatCurrency(data?.balance?.inversiones?.cotizacionDolar ?? 1000)}</span>
                    <span className="text-amber-400 font-semibold">{formatCurrency(data?.balance?.inversiones?.ahorrosDolaresEnPesos ?? 0)}</span>
                  </div>
                </div>
              </div>

              {/* Patrimonio Total Disponible */}
              <div className="bg-[#18181C] border border-amber-500/30 p-3 rounded-xl flex items-center gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-amber-400" />
                <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Patrimonio Total Disp.</div>
                  <div className="text-sm sm:text-base font-black font-mono text-amber-300 mt-0.5">
                    {formatCurrency(data?.balance?.inversiones?.totalPatrimonioDisponible ?? 0)}
                  </div>
                  <div className="text-[10px] text-[#666]">Caja + Plazos Fijos + USD</div>
                </div>
              </div>
            </div>

            {/* Cartera de Plazos Fijos (Desplegable) */}
            {showDetalleInversiones && (
              <div className="mt-3 bg-[#111113] border border-[#242428] rounded-xl overflow-hidden animate-in fade-in duration-200">
                <div className="px-3 py-2 bg-[#18181B] border-b border-[#242428] text-xs font-bold text-white flex items-center justify-between">
                  <span>Cartera y Certificados de Plazo Fijo</span>
                  <span className="text-[11px] text-[#888]">
                    Total certificados: {data?.balance?.inversiones?.plazosFijos?.length || 0}
                  </span>
                </div>
                <div className="overflow-x-auto max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#141416] text-[#888] font-bold border-b border-[#242428] sticky top-0">
                      <tr>
                        <th className="py-2 px-3 text-center w-10">#</th>
                        <th className="py-2 px-3">Banco / Entidad</th>
                        <th className="py-2 px-3">Constitución</th>
                        <th className="py-2 px-3">Vencimiento</th>
                        <th className="py-2 px-3 text-right">Capital Invertido</th>
                        <th className="py-2 px-3 text-right">Interés Estimado</th>
                        <th className="py-2 px-3 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1D1D20]">
                      {!data?.balance?.inversiones?.plazosFijos || data.balance.inversiones.plazosFijos.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-5 text-[#666]">
                            No hay plazos fijos cargados en el sistema.
                          </td>
                        </tr>
                      ) : (
                        data.balance.inversiones.plazosFijos.map((p: any, idx: number) => {
                          const isActivo = p.estado === 'activo';
                          return (
                            <tr key={p.id || idx} className="hover:bg-white/[0.02]">
                              <td className="py-2 px-3 text-center text-[#666] font-mono">{idx + 1}</td>
                              <td className="py-2 px-3 font-semibold text-white">{p.banco}</td>
                              <td className="py-2 px-3 font-mono text-[11px] text-[#888]">{p.fechaConstitucion}</td>
                              <td className="py-2 px-3 font-mono text-[11px] text-[#888]">{p.fechaVencimiento}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                                {formatCurrency(p.montoInvertido)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-[#AAA]">
                                {p.interesGenerado ? formatCurrency(p.interesGenerado) : '-'}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <Badge className={`text-[10px] uppercase font-bold ${
                                  isActivo
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-[#2A2A30] text-[#888] border-[#3A3A40]'
                                }`}>
                                  {p.estado}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Botón desplegable / ocultable de Movimientos */}
          <div className="p-3 bg-[#131315] border-b border-[#242428] flex items-center justify-between">
            <span className="text-xs text-[#888888]">
              Movimientos registrados en {labelMesActual}: <strong className="text-white">{data?.balance?.movimientos?.length || 0}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDetalleBalance((prev) => !prev)}
              className="text-xs h-7 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 gap-1.5 font-bold"
            >
              <span>{showDetalleBalance ? 'Ocultar movimientos detallados' : 'Ver movimientos detallados'}</span>
              {showDetalleBalance ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          {/* Tabla de Movimientos del Mes (Desplegable) */}
          {showDetalleBalance && (
            <div className="overflow-x-auto max-h-72 overflow-y-auto animate-in fade-in duration-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#18181B] text-[#888888] font-bold border-b border-[#242428] sticky top-0">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Concepto / Detalle</th>
                    <th className="py-2.5 px-3">Responsable</th>
                    <th className="py-2.5 px-3">Tipo</th>
                    <th className="py-2.5 px-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D1D20]">
                  {!data?.balance?.movimientos || data.balance.movimientos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-[#666]">
                        No hay movimientos asentados en {labelMesActual}.
                      </td>
                    </tr>
                  ) : (
                    data.balance.movimientos.map((m: any, idx: number) => (
                      <tr key={m.id} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-3 text-[#666] font-mono">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-[#888]">{m.fecha}</td>
                        <td className="py-2 px-3 font-semibold text-white">{m.descripcion}</td>
                        <td className="py-2 px-3 text-[#888]">{m.responsable || '-'}</td>
                        <td className="py-2 px-3">
                          <Badge className={`text-[10px] uppercase font-bold ${
                            m.tipo === 'ingreso'
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'
                          }`}>
                            {m.tipo}
                          </Badge>
                        </td>
                        <td className={`py-2 px-3 text-right font-mono font-bold ${
                          m.tipo === 'ingreso' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* =========================================================================
            SECCIÓN EXTRA: INFORMES DE TORNEOS, INTERCLUBES Y EVENTOS
            ========================================================================= */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Trophy size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  Balances de Torneos, Interclubes y Eventos
                </h2>
                <p className="text-xs text-[#888888]">
                  Informes oficiales de recaudación deportiva, cantina e insumos con diseño institucional
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDetalleEventos((prev) => !prev)}
              className="text-xs h-8 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 gap-1.5 font-bold"
            >
              <span>{showDetalleEventos ? 'Ocultar informes' : 'Ver informes'}</span>
              {showDetalleEventos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          {showDetalleEventos && (
            <div className="p-4 sm:p-5 space-y-4">
              {!data?.eventos || data.eventos.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#777] italic">
                  No se registraron informes de eventos hasta el momento.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.eventos.map((ev: any) => (
                    <div
                      key={ev.id}
                      className="bg-[#18181C] border border-[#2A2A30] hover:border-amber-500/40 p-4 rounded-xl flex flex-col justify-between transition-all gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black uppercase text-white truncate">{ev.titulo}</span>
                          <span className="text-xs font-mono font-black text-[#FFCC00]">
                            {formatCurrency(ev.totalNeto || 0)}
                          </span>
                        </div>
                        {ev.subtitulo && (
                          <p className="text-[11px] font-semibold text-amber-400/90 uppercase mt-0.5">{ev.subtitulo}</p>
                        )}
                        <p className="text-[11px] text-[#888] italic font-serif mt-1">{ev.fechaTexto}</p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedEventoSlide(ev);
                          setSlideModalOpen(true);
                        }}
                        className="bg-[#222228] hover:bg-amber-500 hover:text-black border border-[#303038] text-white text-xs font-bold h-8 px-3 gap-1.5 w-full transition-all"
                      >
                        <Eye size={14} className="text-amber-400" />
                        <span>Ver Diapositiva / Imprimir</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* =========================================================================
            SECCIÓN 2: ESCUELA DE TENIS (TOTALES POR GRUPO, RECAUDADO Y LISTADO LIMPIO)
            ========================================================================= */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <GraduationCap size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  2. Escuela de Tenis — Alumnos y Recaudación Mensual
                </h2>
                <p className="text-xs text-[#888888]">
                  Total de alumnos divididos por grupos, recaudación mes a mes y padrón nominal
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => generarPdfEscuela(false)}
              className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1.5 font-semibold"
            >
              <FileDown size={14} />
              <span>PDF Escuela</span>
            </Button>
          </div>

          {/* Visor Mes a Mes de Recaudación de Cuotas */}
          <div className="p-4 bg-[#111113] border-b border-[#242428]">
            <div className="text-[11px] font-bold uppercase text-[#888] mb-2">
              Recaudación de Cuotas Escuela Mes por Mes ({anioActual}):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
              {MESES_NOMBRES.map((nombreMes, idx) => {
                const mKey = `${anioActual}-${String(idx + 1).padStart(2, '0')}`;
                const mData = data?.escuela?.meses?.find((m: any) => m.mes === mKey) || { totalRecaudado: 0, cantidadPagos: 0 };
                const isSelected = mesSeleccionado === mKey;
                const tieneRecaudacion = mData.totalRecaudado > 0;

                return (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => setMesSeleccionado(mKey)}
                    className={`p-2 rounded-lg text-left transition-all border ${
                      isSelected
                        ? 'bg-emerald-500 text-black border-emerald-500 font-bold shadow-md'
                        : tieneRecaudacion
                        ? 'bg-[#18181A] border-emerald-500/30 text-white hover:border-emerald-500/60'
                        : 'bg-[#141416] border-[#222226] text-[#666]'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold flex items-center justify-between">
                      <span>{nombreMes.slice(0, 3)}</span>
                      {mData.cantidadPagos > 0 && (
                        <span className={`text-[9px] px-1 rounded ${isSelected ? 'bg-black text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {mData.cantidadPagos}
                        </span>
                      )}
                    </div>
                    <div className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-black font-extrabold' : 'text-emerald-400 font-bold'}`}>
                      {formatCurrency(mData.totalRecaudado)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resumen por Grupos y Recaudado del Mes */}
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#131315] border-b border-[#242428]">
            <div className="bg-[#18181B] border border-emerald-500/30 p-3 rounded-xl">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Total Inscriptos</div>
              <div className="text-xl font-black text-white">{data?.escuela?.totalAlumnos || 0} alumnos</div>
            </div>

            <div className="bg-[#18181B] border border-[#28282E] p-3 rounded-xl">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Escuelita</div>
              <div className="text-xl font-black text-white">{data?.escuela?.porGrupo?.Escuelita || 0} chicos</div>
            </div>

            <div className="bg-[#18181B] border border-[#28282E] p-3 rounded-xl">
              <div className="text-[10px] text-sky-400 font-bold uppercase">Minitenis</div>
              <div className="text-xl font-black text-white">{data?.escuela?.porGrupo?.Minitenis || 0} chicos</div>
            </div>

            <div className="bg-[#18181B] border border-[#28282E] p-3 rounded-xl">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Grupo Entrenamiento</div>
              <div className="text-xl font-black text-white">{data?.escuela?.porGrupo?.['Grupo Entrenamiento'] || 0} juveniles</div>
            </div>
          </div>

          {/* Barra de control desplegable para el Padrón de Alumnos */}
          <div className="p-3 bg-[#131315] border-b border-[#242428] flex items-center justify-between">
            <span className="text-xs text-[#888888]">
              Alumnos registrados en escuela: <strong className="text-white">{data?.escuela?.totalAlumnos || 0}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDetalleEscuela((prev) => !prev)}
              className="text-xs h-7 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/10 gap-1.5 font-bold"
            >
              <span>{showDetalleEscuela ? 'Ocultar listado de alumnos' : 'Ver listado de alumnos'}</span>
              {showDetalleEscuela ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          {/* Filtro y Tabla Desplegables de Alumnos de Escuela */}
          {showDetalleEscuela && (
            <div className="animate-in fade-in duration-200">
              <div className="p-3 border-b border-[#242428] flex flex-wrap items-center justify-between gap-2 bg-[#121214]">
                <div className="flex items-center gap-1">
                  {['todos', 'Escuelita', 'Minitenis', 'Grupo Entrenamiento'].map((grp) => (
                    <Button
                      key={grp}
                      size="sm"
                      variant={filtroGrupoEscuela === grp ? 'default' : 'ghost'}
                      onClick={() => setFiltroGrupoEscuela(grp)}
                      className={`text-xs h-7 px-2.5 ${filtroGrupoEscuela === grp ? 'bg-primary text-black font-bold' : 'text-[#888888]'}`}
                    >
                      {grp === 'todos' ? 'Todos' : grp === 'Grupo Entrenamiento' ? 'Competencia' : grp}
                    </Button>
                  ))}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777]" />
                  <Input
                    type="text"
                    placeholder="Buscar alumno..."
                    value={searchEscuela}
                    onChange={(e) => setSearchEscuela(e.target.value)}
                    className="pl-7 h-7 text-xs bg-[#111113] border-[#25252A] text-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#18181B] text-[#888888] font-bold border-b border-[#242428] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 w-16">#</th>
                      <th className="py-2.5 px-4">Nombre y Apellido del Alumno</th>
                      <th className="py-2.5 px-4 text-right">Grupo Asignado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D1D20]">
                    {escuelaFiltrada.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-center py-6 text-[#666]">
                          No hay alumnos que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      escuelaFiltrada.map((al: any, idx: number) => (
                        <tr key={al.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-4 text-[#666] font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-semibold text-white">{al.nombre}</td>
                          <td className="py-2.5 px-4 text-right">
                            <Badge variant="outline" className={`text-[10px] font-bold ${
                              al.grupo === 'Escuelita'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                : al.grupo === 'Minitenis'
                                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                            }`}>
                              {al.grupo === 'Grupo Entrenamiento' ? 'Competencia' : al.grupo}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            SECCIÓN 3: CLASES PARTICULARES (VISOR MES POR MES Y ASISTENCIAS)
            ========================================================================= */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  3. Clases Particulares — Alumnos y Asistencias Mensuales
                </h2>
                <p className="text-xs text-[#888888]">
                  Total de alumnos particulares por mes y cantidad de clases asistidas
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => generarPdfParticulares(false)}
              className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1.5 font-semibold"
            >
              <FileDown size={14} />
              <span>PDF Particulares</span>
            </Button>
          </div>

          {/* Visor Mes por Mes de Particulares */}
          <div className="p-4 bg-[#111113] border-b border-[#242428]">
            <div className="text-[11px] font-bold uppercase text-[#888] mb-2">
              Cantidad de Alumnos Particulares por Mes ({anioActual}):
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-1.5">
              {MESES_NOMBRES.map((nombreMes, idx) => {
                const mKey = `${anioActual}-${String(idx + 1).padStart(2, '0')}`;
                const mData = data?.particulares?.meses?.find((m: any) => m.mes === mKey) || { totalAlumnos: 0, totalClases: 0 };
                const isSelected = mesSeleccionado === mKey;
                const tieneAlumnos = mData.totalAlumnos > 0;

                return (
                  <button
                    key={mKey}
                    type="button"
                    onClick={() => setMesSeleccionado(mKey)}
                    className={`p-2 rounded-lg text-left transition-all border ${
                      isSelected
                        ? 'bg-purple-500 text-white border-purple-500 font-bold shadow-md'
                        : tieneAlumnos
                        ? 'bg-[#18181A] border-purple-500/30 text-white hover:border-purple-500/60'
                        : 'bg-[#141416] border-[#222226] text-[#666]'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-bold">{nombreMes.slice(0, 3)}</div>
                    <div className={`text-[10px] font-mono mt-1 ${isSelected ? 'text-white font-extrabold' : 'text-purple-400 font-bold'}`}>
                      {mData.totalAlumnos} alum.
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barra de control desplegable para Particulares */}
          <div className="p-3 bg-[#131315] border-b border-[#242428] flex items-center justify-between">
            <span className="text-xs text-[#888888]">
              Alumnos con clases en {labelMesActual}: <strong className="text-white">{data?.particulares?.totalAlumnosMesActual || 0}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDetalleParticulares((prev) => !prev)}
              className="text-xs h-7 text-purple-400 hover:text-purple-300 hover:bg-purple-400/10 gap-1.5 font-bold"
            >
              <span>{showDetalleParticulares ? 'Ocultar listado de particulares' : 'Ver listado de particulares'}</span>
              {showDetalleParticulares ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          {/* Filtros y Tabla Particulares (Desplegables) */}
          {showDetalleParticulares && (
            <div className="animate-in fade-in duration-200">
              <div className="p-3 border-b border-[#242428] flex items-center justify-between gap-2 bg-[#121214]">
                <span className="text-xs text-[#888888]">
                  Detalle nominal de asistencias:
                </span>

                <div className="relative w-full sm:w-56">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777]" />
                  <Input
                    type="text"
                    placeholder="Buscar alumno..."
                    value={searchParticulares}
                    onChange={(e) => setSearchParticulares(e.target.value)}
                    className="pl-7 h-7 text-xs bg-[#111113] border-[#25252A] text-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#18181B] text-[#888888] font-bold border-b border-[#242428] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 w-16">#</th>
                      <th className="py-2.5 px-4">Alumno</th>
                      <th className="py-2.5 px-4">Condición</th>
                      <th className="py-2.5 px-4 text-right">Clases Asistidas ({labelMesActual})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D1D20]">
                    {particularesFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-6 text-[#666]">
                          No hay registros de particulares para {labelMesActual}.
                        </td>
                      </tr>
                    ) : (
                      particularesFiltrados.map((al: any, idx: number) => (
                        <tr key={al.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-4 text-[#666] font-mono">{idx + 1}</td>
                          <td className="py-2.5 px-4 font-semibold text-white">{al.nombre}</td>
                          <td className="py-2.5 px-4">
                            <Badge variant="outline" className={`text-[10px] ${
                              al.esSocio ? 'border-sky-500/30 text-sky-400 bg-sky-500/10' : 'border-[#333] text-[#888]'
                            }`}>
                              {al.esSocio ? 'Socio' : 'No Socio'}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <span className="font-mono font-bold text-purple-400 text-xs px-2.5 py-1 rounded bg-purple-500/10 border border-purple-500/20">
                              {al.cantidadClases} clase(s)
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            SECCIÓN 4: CLASES PROFESOR (REGISTRADAS POR EL PROFESOR EN /PROFE)
            ========================================================================= */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <BookOpen size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  4. Planilla de Clases del Profesor
                </h2>
                <p className="text-xs text-[#888888]">
                  Registros asentados por el profesor en {labelMesActual} (clases, cantidad de alumnos y liquidación)
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => generarPdfProfesor(false)}
              className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1.5 font-semibold"
            >
              <FileDown size={14} />
              <span>PDF Clases Profesor</span>
            </Button>
          </div>

          {/* Resumen */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#111113] border-b border-[#242428]">
            <div className="bg-[#161619] border border-[#25252A] p-2.5 rounded-xl">
              <div className="text-[10px] text-[#888] font-bold uppercase">Total Clases Dadas</div>
              <div className="text-lg font-black text-white">{data?.clasesProfesor?.totalClases || 0}</div>
            </div>

            <div className="bg-[#161619] border border-[#25252A] p-2.5 rounded-xl">
              <div className="text-[10px] text-sky-400 font-bold uppercase">Total Alumnos Atendidos</div>
              <div className="text-lg font-black text-sky-400">{data?.clasesProfesor?.totalAlumnos || 0}</div>
            </div>

            <div className="bg-[#161619] border border-emerald-500/30 p-2.5 rounded-xl">
              <div className="text-[10px] text-emerald-300 font-bold uppercase">Monto Total Liquidado</div>
              <div className="text-lg font-black font-mono text-emerald-400">
                {formatCurrency(data?.clasesProfesor?.totalMonto || 0)}
              </div>
            </div>
          </div>

          {/* Barra de control desplegable para Registros del Profesor */}
          <div className="p-3 bg-[#131315] border-b border-[#242428] flex items-center justify-between">
            <span className="text-xs text-[#888]">
              Registros asentados en {labelMesActual}: <strong className="text-white">{data?.clasesProfesor?.registros?.length || 0}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDetalleProfesor((prev) => !prev)}
              className="text-xs h-7 text-sky-400 hover:text-sky-300 hover:bg-sky-400/10 gap-1.5 font-bold"
            >
              <span>{showDetalleProfesor ? 'Ocultar detalle de clases' : 'Ver detalle de clases'}</span>
              {showDetalleProfesor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          {/* Filtros y Tabla Clases Profesor (Desplegables) */}
          {showDetalleProfesor && (
            <div className="animate-in fade-in duration-200">
              <div className="p-3 border-b border-[#242428] flex items-center justify-between gap-2 bg-[#121214]">
                <span className="text-xs text-[#888]">
                  Detalle de planillas por fecha:
                </span>

                <div className="relative w-full sm:w-56">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777]" />
                  <Input
                    type="text"
                    placeholder="Buscar fecha u observación..."
                    value={searchProfesor}
                    onChange={(e) => setSearchProfesor(e.target.value)}
                    className="pl-7 h-7 text-xs bg-[#111113] border-[#25252A] text-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#18181B] text-[#888888] font-bold border-b border-[#242428] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Fecha</th>
                      <th className="py-2.5 px-3">Turno</th>
                      <th className="py-2.5 px-3 text-center">Clases</th>
                      <th className="py-2.5 px-3 text-center">Alumnos</th>
                      <th className="py-2.5 px-3 text-right">Monto</th>
                      <th className="py-2.5 px-3">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D1D20]">
                    {profesorFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-[#666]">
                          No hay registros de clases para el mes de {labelMesActual}.
                        </td>
                      </tr>
                    ) : (
                      profesorFiltrados.map((r: any, idx: number) => (
                        <tr key={r.id} className="hover:bg-white/[0.02]">
                          <td className="py-2 px-3 text-[#666] font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono text-white font-semibold">{r.fecha}</td>
                          <td className="py-2 px-3 text-[#888]">{r.turno || '-'}</td>
                          <td className="py-2 px-3 text-center font-bold text-white">{r.cantidadClases}</td>
                          <td className="py-2 px-3 text-center text-sky-400 font-bold">{r.cantidadAlumnos}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">
                            {formatCurrency(r.precioTotal)}
                          </td>
                          <td className="py-2 px-3 text-[#888] text-[11px]">{r.observaciones || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        {/* =========================================================================
            SECCIÓN 5: PADRÓN GENERAL DE SOCIOS (TODOS JUNTOS SIN CATEGORÍAS)
            ========================================================================= */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  5. Padrón General de Socios
                </h2>
                <p className="text-xs text-[#888888]">
                  Nómina completa de todos los socios activos de tenis ({data?.socios?.total || 0} socios)
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => generarPdfSocios(false)}
              className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1.5 font-semibold"
            >
              <FileDown size={14} />
              <span>PDF Padrón</span>
            </Button>
          </div>

          {/* Barra de control desplegable para el Padrón de Socios */}
          <div className="p-3 bg-[#131315] border-b border-[#242428] flex items-center justify-between">
            <span className="text-xs text-[#888888]">
              Total socios registrados: <strong className="text-white">{data?.socios?.total || 0}</strong>
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDetalleSocios((prev) => !prev)}
              className="text-xs h-7 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10 gap-1.5 font-bold"
            >
              <span>{showDetalleSocios ? 'Ocultar nómina de socios' : 'Ver nómina de socios'}</span>
              {showDetalleSocios ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Button>
          </div>

          {/* Búsqueda y Tabla Socios (Desplegables) */}
          {showDetalleSocios && (
            <div className="animate-in fade-in duration-200">
              <div className="p-3 border-b border-[#242428] flex items-center justify-between gap-2 bg-[#121214]">
                <span className="text-xs text-[#888888]">
                  Buscador rápido de socios:
                </span>

                <div className="relative w-full sm:w-64">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777]" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o DNI..."
                    value={searchSocios}
                    onChange={(e) => setSearchSocios(e.target.value)}
                    className="pl-7 h-7 text-xs bg-[#111113] border-[#25252A] text-white"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#18181B] text-[#888888] font-bold border-b border-[#242428] sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 w-16">#</th>
                      <th className="py-2.5 px-4">DNI</th>
                      <th className="py-2.5 px-4">Apellido y Nombre</th>
                      <th className="py-2.5 px-4">Teléfono</th>
                      <th className="py-2.5 px-4">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1D1D20]">
                    {sociosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-[#666]">
                          No se encontraron socios con los filtros actuales.
                        </td>
                      </tr>
                    ) : (
                      sociosFiltrados.map((s: any, idx: number) => (
                        <tr key={s.id} className="hover:bg-white/[0.02]">
                          <td className="py-2 px-4 text-[#666] font-mono">{idx + 1}</td>
                          <td className="py-2 px-4 font-mono font-bold text-sky-400">{s.dni || '-'}</td>
                          <td className="py-2 px-4 font-semibold text-white">{s.apellido}, {s.nombre}</td>
                          <td className="py-2 px-4 text-[#888]">{s.telefono || '-'}</td>
                          <td className="py-2 px-4 text-[#888] text-[11px] font-mono">{s.email || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Pie de Página Oficial */}
      <footer className="border-t border-[#222225] py-6 text-center text-xs text-[#666666] bg-[#101012]">
        <p>Club Empalme Central — Sistema Integral de Tenis</p>
        <p className="text-[11px] mt-1 text-[#444444]">
          Documentación para uso exclusivo de la Comisión Directiva del Club
        </p>
      </footer>

      {/* Modal Diapositiva para Comisión Directiva */}
      <EventoSlideView
        evento={selectedEventoSlide}
        open={slideModalOpen}
        onOpenChange={setSlideModalOpen}
      />
    </div>
  );
}
