'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
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
  ChevronDown,
  ChevronUp,
  FileArchive,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Wallet,
  BookOpen,
  Landmark,
  Eye,
  PieChart,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
} from 'lucide-react';
import EventoSlideView, { EventoInformeData } from '@/components/eventos/EventoSlideView';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import JSZip from 'jszip';

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

type TabId = 'finanzas' | 'eventos' | 'escuela' | 'profesor' | 'socios';

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

  // Tab activo para organizar la información y no saturar
  const [activeTab, setActiveTab] = useState<TabId>('finanzas');

  // Estados de búsqueda / filtros locales
  const [searchEscuela, setSearchEscuela] = useState('');
  const [filtroGrupoEscuela, setFiltroGrupoEscuela] = useState<string>('todos');
  const [searchParticulares, setSearchParticulares] = useState('');
  const [searchSocios, setSearchSocios] = useState('');
  const [searchProfesor, setSearchProfesor] = useState('');

  // Modales
  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [selectedEventoSlide, setSelectedEventoSlide] = useState<EventoInformeData | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Vistas secundarias dentro de tabs
  const [subTabEscuela, setSubTabEscuela] = useState<'escuela' | 'particulares'>('escuela');

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

  // Cálculos ejecutivos
  const balanceNetoMes = useMemo(() => {
    const ing = data?.balance?.mesActual?.ingresos || 0;
    const eg = data?.balance?.mesActual?.egresos || 0;
    return ing - eg;
  }, [data?.balance?.mesActual]);

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
  // GENERADORES DE REPORTES PDF Y ZIP
  // ==========================================

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

  const tabsConfig = [
    { id: 'finanzas' as TabId, label: 'Finanzas y Patrimonio', icon: Wallet, badge: formatCurrency(data?.balance?.mesActual?.saldoFinal ?? 0) },
    { id: 'eventos' as TabId, label: 'Torneos y Eventos', icon: Trophy, badge: data?.eventos?.length ? `${data.eventos.length}` : undefined },
    { id: 'escuela' as TabId, label: 'Escuela y Alumnos', icon: GraduationCap, badge: data?.escuela?.totalAlumnos ? `${data.escuela.totalAlumnos}` : undefined },
    { id: 'profesor' as TabId, label: 'Clases del Profesor', icon: BookOpen, badge: data?.clasesProfesor?.totalClases ? `${data.clasesProfesor.totalClases}` : undefined },
    { id: 'socios' as TabId, label: 'Padrón de Socios', icon: Users, badge: data?.socios?.total ? `${data.socios.total}` : undefined },
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-slate-100 selection:bg-amber-400 selection:text-black">
      {/* 1. Header Ejecutivo */}
      <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/logo-caec.png"
              alt="Logo CAEC"
              className="w-10 h-10 object-contain drop-shadow"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-mono tracking-widest px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20 font-bold">
                  Comisión Directiva
                </span>
                <span className="text-[10px] text-zinc-500 hidden sm:inline">• Portal Ejecutivo</span>
              </div>
              <h1 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-2">
                Club Empalme Central — Tenis
              </h1>
            </div>
          </div>

          {/* Selector de Mes Centralizado y Descarga de Paquete ZIP */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            <div className="flex items-center bg-zinc-900 border border-zinc-750 border-zinc-800 rounded-xl px-1.5 py-1 shadow-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCambiarMes(-1)}
                className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                title="Mes anterior"
              >
                <ChevronLeft size={16} />
              </Button>

              <div className="flex items-center gap-1.5 px-2">
                <Calendar size={13} className="text-amber-400" />
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
                className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
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
              className="h-9 w-9 p-0 border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white"
              title="Actualizar datos"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </Button>

            <Button
              size="sm"
              onClick={handleDescargarPaqueteZip}
              disabled={loading || downloadingZip}
              className="h-9 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs gap-1.5 shadow-md shadow-amber-400/10 px-3.5 transition-all"
              title="Descargar todos los reportes del mes en archivo ZIP"
            >
              {downloadingZip ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <FileArchive size={15} />
              )}
              <span className="hidden sm:inline">Descargar Paquete ZIP</span>
              <span className="sm:hidden">ZIP ({labelMesActual.split(' ')[0]})</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 2. Cuerpo Principal */}
      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        {/* =========================================================================
            KPI CARDS EJECUTIVAS: VISIÓN EN 1 SEGUNDO
            ========================================================================= */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Patrimonio Total Disponible */}
          <div
            onClick={() => setActiveTab('finanzas')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'finanzas'
                ? 'bg-gradient-to-br from-amber-500/15 via-zinc-900 to-zinc-950 border-amber-500/40 ring-1 ring-amber-400/20'
                : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Patrimonio Total</span>
              <Landmark size={16} className="text-amber-400" />
            </div>
            <div className="mt-2 text-lg sm:text-2xl font-black font-mono text-amber-300">
              {formatCurrency(data?.balance?.inversiones?.totalPatrimonioDisponible ?? 0)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
              <span>Caja + PF + Dólares</span>
              <span className="text-[10px] text-amber-400/90 font-medium">Ver desglose →</span>
            </div>
          </div>

          {/* Card 2: Resultado Mensual Neto */}
          <div
            onClick={() => setActiveTab('finanzas')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'finanzas'
                ? 'bg-gradient-to-br from-emerald-500/10 via-zinc-900 to-zinc-950 border-emerald-500/40'
                : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Resultado {labelMesActual.split(' ')[0]}</span>
              {balanceNetoMes >= 0 ? (
                <ArrowUpRight size={16} className="text-emerald-400" />
              ) : (
                <ArrowDownRight size={16} className="text-rose-400" />
              )}
            </div>
            <div className={`mt-2 text-lg sm:text-2xl font-black font-mono ${balanceNetoMes >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {balanceNetoMes >= 0 ? '+' : ''}{formatCurrency(balanceNetoMes)}
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
              <span className="text-emerald-400/80">+{formatCurrency(data?.balance?.mesActual?.ingresos ?? 0)}</span>
              <span className="text-rose-400/80">-{formatCurrency(data?.balance?.mesActual?.egresos ?? 0)}</span>
            </div>
          </div>

          {/* Card 3: Escuela y Recaudación */}
          <div
            onClick={() => setActiveTab('escuela')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'escuela'
                ? 'bg-gradient-to-br from-sky-500/10 via-zinc-900 to-zinc-950 border-sky-500/40'
                : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Escuela de Tenis</span>
              <GraduationCap size={16} className="text-sky-400" />
            </div>
            <div className="mt-2 text-lg sm:text-2xl font-black text-white">
              {data?.escuela?.totalAlumnos ?? 0} <span className="text-xs font-normal text-zinc-400">alumnos</span>
            </div>
            <div className="text-[11px] text-sky-400 font-semibold mt-1 flex items-center justify-between">
              <span>Recaudado: {formatCurrency(data?.escuela?.recaudadoMesActual ?? 0)}</span>
              <span className="text-[10px] text-zinc-400">Ver lista →</span>
            </div>
          </div>

          {/* Card 4: Socios Activos */}
          <div
            onClick={() => setActiveTab('socios')}
            className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
              activeTab === 'socios'
                ? 'bg-gradient-to-br from-indigo-500/10 via-zinc-900 to-zinc-950 border-indigo-500/40'
                : 'bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between text-zinc-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Padrón de Socios</span>
              <Users size={16} className="text-indigo-400" />
            </div>
            <div className="mt-2 text-lg sm:text-2xl font-black text-white">
              {data?.socios?.total ?? 0} <span className="text-xs font-normal text-zinc-400">activos</span>
            </div>
            <div className="text-[11px] text-zinc-400 mt-1 flex items-center justify-between">
              <span>Masa societaria tenis</span>
              <span className="text-[10px] text-indigo-400">Consultar →</span>
            </div>
          </div>
        </div>

        {/* =========================================================================
            BARRA DE PESTAÑAS (TABS) EJECUTIVAS
            ========================================================================= */}
        <div className="flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-zinc-800 rounded-2xl overflow-x-auto scrollbar-none">
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-1 justify-center ${
                  isSelected
                    ? 'bg-amber-400 text-black shadow-md shadow-amber-400/10'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                }`}
              >
                <Icon size={15} className={isSelected ? 'text-black' : 'text-zinc-400'} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-black/20 text-black font-extrabold' : 'bg-zinc-800 text-zinc-300'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* =========================================================================
            CONTENIDO DINÁMICO POR PESTAÑA SELECCIONADA
            ========================================================================= */}

        {/* TAB 1: FINANZAS Y PATRIMONIO */}
        {activeTab === 'finanzas' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Header de Finanzas con Descarga de PDF */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400">
                  <Wallet size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Cuenta Corriente y Balance Mensual</h2>
                  <p className="text-xs text-zinc-400">
                    Saldos del año {anioActual} y movimientos asentados en {labelMesActual}
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => generarPdfBalance(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-red-400 hover:text-red-300 border border-red-500/20 text-xs gap-1.5 font-bold h-9"
              >
                <FileDown size={14} />
                <span>Descargar PDF Balance ({labelMesActual.split(' ')[0]})</span>
              </Button>
            </div>

            {/* 4 Cards de Resumen Patrimonial */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Saldo en Caja */}
              <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400">
                  <Wallet size={18} />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Saldo en Caja (Pesos)</div>
                  <div className="text-base font-black font-mono text-white mt-0.5">
                    {formatCurrency(data?.balance?.saldoActualTotal ?? 0)}
                  </div>
                </div>
              </div>

              {/* Capital en Plazos Fijos */}
              <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <Landmark size={18} />
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Capital Plazos Fijos</div>
                  <div className="text-base font-black font-mono text-emerald-400 mt-0.5">
                    {formatCurrency(data?.balance?.inversiones?.capitalPlazosActivos ?? 0)}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {data?.balance?.inversiones?.plazosFijos?.filter((p: any) => p.estado === 'activo')?.length || 0} certificados vigentes
                  </div>
                </div>
              </div>

              {/* Ahorro en Dólares */}
              <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <DollarSign size={18} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Ahorro en Dólares</div>
                  <div className="text-base font-black font-mono text-emerald-400 mt-0.5">
                    U$S {formatCurrency(data?.balance?.inversiones?.ahorrosDolares ?? 0).replace('$', '').trim()}
                  </div>
                  <div className="text-[10px] text-zinc-500 flex items-center justify-between">
                    <span>TC: {formatCurrency(data?.balance?.inversiones?.cotizacionDolar ?? 1000)}</span>
                    <span className="text-amber-400 font-medium">{formatCurrency(data?.balance?.inversiones?.ahorrosDolaresEnPesos ?? 0)}</span>
                  </div>
                </div>
              </div>

              {/* Patrimonio Total Disponible */}
              <div className="bg-zinc-900/60 border border-amber-500/30 p-3.5 rounded-2xl flex items-center gap-3 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-400" />
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Patrimonio Total Disp.</div>
                  <div className="text-base font-black font-mono text-amber-300 mt-0.5">
                    {formatCurrency(data?.balance?.inversiones?.totalPatrimonioDisponible ?? 0)}
                  </div>
                  <div className="text-[10px] text-zinc-500">Total activo líquido subcomisión</div>
                </div>
              </div>
            </div>

            {/* Evolución Mensual (Mes a Mes) */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                  Evolución y Saldos Finales Mes a Mes ({anioActual})
                </span>
                <span className="text-xs text-zinc-400">
                  Hacé clic en cualquier mes para visualizar su detalle
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
                      className={`p-2.5 rounded-xl text-left transition-all border ${
                        isSelected
                          ? 'bg-amber-400 text-black border-amber-400 font-bold shadow-md shadow-amber-400/20'
                          : tieneMovimientos
                          ? 'bg-zinc-900 border-zinc-700/80 hover:border-amber-400/60 text-white'
                          : 'bg-zinc-950 border-zinc-850 border-zinc-800/40 text-zinc-600'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold">{nombreMes.slice(0, 3)}</div>
                      <div className={`text-[11px] font-mono mt-1 ${isSelected ? 'text-black font-extrabold' : 'text-emerald-400 font-semibold'}`}>
                        {formatCurrency(bMes.saldoFinal)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plazos Fijos Registrados */}
            {data?.balance?.inversiones?.plazosFijos?.length > 0 && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden">
                <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark size={15} className="text-emerald-400" />
                    <span className="text-xs font-bold text-white">Cartera de Plazos Fijos</span>
                  </div>
                  <span className="text-xs text-zinc-400 font-mono">
                    Total: {data.balance.inversiones.plazosFijos.length} certificados
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800">
                      <tr>
                        <th className="py-2 px-4 text-center w-10">#</th>
                        <th className="py-2 px-4">Banco / Entidad</th>
                        <th className="py-2 px-4">Constitución</th>
                        <th className="py-2 px-4">Vencimiento</th>
                        <th className="py-2 px-4 text-right">Capital Invertido</th>
                        <th className="py-2 px-4 text-right">Interés Estimado</th>
                        <th className="py-2 px-4 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {data.balance.inversiones.plazosFijos.map((p: any, idx: number) => {
                        const isActivo = p.estado === 'activo';
                        return (
                          <tr key={p.id || idx} className="hover:bg-zinc-800/30">
                            <td className="py-2 px-4 text-center text-zinc-500 font-mono">{idx + 1}</td>
                            <td className="py-2 px-4 font-semibold text-white">{p.banco}</td>
                            <td className="py-2 px-4 font-mono text-zinc-400">{p.fechaConstitucion}</td>
                            <td className="py-2 px-4 font-mono text-zinc-400">{p.fechaVencimiento}</td>
                            <td className="py-2 px-4 text-right font-mono font-bold text-emerald-400">
                              {formatCurrency(p.montoInvertido)}
                            </td>
                            <td className="py-2 px-4 text-right font-mono text-zinc-300">
                              {p.interesGenerado ? formatCurrency(p.interesGenerado) : '-'}
                            </td>
                            <td className="py-2 px-4 text-center">
                              <Badge className={`text-[10px] uppercase font-bold ${
                                isActivo
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                  : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                              }`}>
                                {p.estado}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tabla de Movimientos del Mes */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PieChart size={15} className="text-amber-400" />
                  <span className="text-xs font-bold text-white">
                    Movimientos Contables de {labelMesActual} ({data?.balance?.movimientos?.length || 0})
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400 font-mono font-bold">
                    +{formatCurrency(data?.balance?.mesActual?.ingresos ?? 0)}
                  </span>
                  <span className="text-rose-400 font-mono font-bold">
                    -{formatCurrency(data?.balance?.mesActual?.egresos ?? 0)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4 w-28">Fecha</th>
                      <th className="py-2.5 px-4">Concepto / Detalle</th>
                      <th className="py-2.5 px-4">Responsable</th>
                      <th className="py-2.5 px-4 text-center">Tipo</th>
                      <th className="py-2.5 px-4 text-right">Monto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {!data?.balance?.movimientos || data.balance.movimientos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-zinc-500 italic">
                          No hay movimientos asentados en {labelMesActual}.
                        </td>
                      </tr>
                    ) : (
                      data.balance.movimientos.map((m: any, idx: number) => (
                        <tr key={m.id} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-4 text-center text-zinc-500 font-mono">{idx + 1}</td>
                          <td className="py-2 px-4 font-mono text-zinc-400">{m.fecha}</td>
                          <td className="py-2 px-4 font-semibold text-white">{m.descripcion}</td>
                          <td className="py-2 px-4 text-zinc-400">{m.responsable || '-'}</td>
                          <td className="py-2 px-4 text-center">
                            <Badge className={`text-[10px] uppercase font-bold ${
                              m.tipo === 'ingreso'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            }`}>
                              {m.tipo}
                            </Badge>
                          </td>
                          <td className={`py-2 px-4 text-right font-mono font-bold ${
                            m.tipo === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: TORNEOS Y EVENTOS */}
        {activeTab === 'eventos' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400">
                  <Trophy size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Balances de Torneos, Interclubes y Eventos</h2>
                  <p className="text-xs text-zinc-400">
                    Informes de recaudación deportiva, cantina e insumos con diapositivas ejecutivas
                  </p>
                </div>
              </div>

              <span className="text-xs text-zinc-400 font-mono bg-zinc-800 px-3 py-1.5 rounded-xl border border-zinc-700">
                {data?.eventos?.length || 0} eventos registrados
              </span>
            </div>

            {!data?.eventos || data.eventos.length === 0 ? (
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center text-zinc-500">
                <Trophy size={36} className="mx-auto mb-2 opacity-30 text-amber-400" />
                <p className="text-sm font-semibold text-zinc-400">No se encontraron informes de torneos cargados.</p>
                <p className="text-xs text-zinc-500 mt-1">Los informes de eventos cargados en el sistema aparecerán aquí organizados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.eventos.map((ev: any) => (
                  <div
                    key={ev.id}
                    className="bg-zinc-900/70 border border-zinc-800 hover:border-amber-400/40 p-4 rounded-2xl flex flex-col justify-between transition-all gap-4 shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-black uppercase text-white truncate">{ev.titulo}</span>
                        <span className="text-xs font-mono font-black text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
                          {formatCurrency(ev.totalNeto || 0)}
                        </span>
                      </div>
                      {ev.subtitulo && (
                        <p className="text-xs font-medium text-amber-300/80 mt-1">{ev.subtitulo}</p>
                      )}
                      <p className="text-[11px] text-zinc-500 font-medium mt-1">{ev.fechaTexto}</p>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedEventoSlide(ev);
                        setSlideModalOpen(true);
                      }}
                      className="bg-zinc-800 hover:bg-amber-400 hover:text-black border border-zinc-700 text-white text-xs font-bold h-9 px-3 gap-1.5 w-full transition-all"
                    >
                      <Eye size={14} className="text-amber-400 group-hover:text-black" />
                      <span>Ver Diapositiva / Imprimir</span>
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ESCUELA Y PARTICULARES */}
        {activeTab === 'escuela' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Sub-navegación entre Escuela de Tenis y Particulares */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-400/10 border border-sky-400/20 text-sky-400">
                  <GraduationCap size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Alumnos y Actividad Pedagógica</h2>
                  <p className="text-xs text-zinc-400">
                    Alumnos de la Escuela de Tenis y clases particulares de {labelMesActual}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setSubTabEscuela('escuela')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      subTabEscuela === 'escuela' ? 'bg-sky-500 text-black' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Escuela ({data?.escuela?.totalAlumnos || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubTabEscuela('particulares')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      subTabEscuela === 'particulares' ? 'bg-purple-500 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Particulares ({data?.particulares?.totalAlumnosMesActual || 0})
                  </button>
                </div>

                {subTabEscuela === 'escuela' ? (
                  <Button
                    size="sm"
                    onClick={() => generarPdfEscuela(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/20 text-xs gap-1.5 font-bold h-9"
                  >
                    <FileDown size={14} />
                    <span>PDF Escuela</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => generarPdfParticulares(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/20 text-xs gap-1.5 font-bold h-9"
                  >
                    <FileDown size={14} />
                    <span>PDF Particulares</span>
                  </Button>
                )}
              </div>
            </div>

            {/* VISTA ESCUELA */}
            {subTabEscuela === 'escuela' && (
              <>
                {/* Resumen de Grupos */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-zinc-900/60 border border-sky-500/30 p-3.5 rounded-2xl">
                    <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Total Alumnos</div>
                    <div className="text-xl sm:text-2xl font-black text-white mt-0.5">{data?.escuela?.totalAlumnos || 0}</div>
                    <div className="text-[11px] text-emerald-400 font-semibold mt-1">
                      Recaudado: {formatCurrency(data?.escuela?.recaudadoMesActual ?? 0)}
                    </div>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl">
                    <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Escuelita</div>
                    <div className="text-xl sm:text-2xl font-black text-white mt-0.5">{data?.escuela?.porGrupo?.Escuelita || 0} chicos</div>
                    <div className="text-[11px] text-zinc-500 mt-1">Iniciación y fundamentos</div>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl">
                    <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Minitenis</div>
                    <div className="text-xl sm:text-2xl font-black text-white mt-0.5">{data?.escuela?.porGrupo?.Minitenis || 0} chicos</div>
                    <div className="text-[11px] text-zinc-500 mt-1">Desarrollo y técnica</div>
                  </div>

                  <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl">
                    <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Competencia</div>
                    <div className="text-xl sm:text-2xl font-black text-white mt-0.5">{data?.escuela?.porGrupo?.['Grupo Entrenamiento'] || 0} juveniles</div>
                    <div className="text-[11px] text-zinc-500 mt-1">Entrenamiento avanzado</div>
                  </div>
                </div>

                {/* Tabla de Alumnos */}
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-zinc-900">
                    <div className="flex items-center gap-1">
                      {['todos', 'Escuelita', 'Minitenis', 'Grupo Entrenamiento'].map((grp) => (
                        <button
                          key={grp}
                          type="button"
                          onClick={() => setFiltroGrupoEscuela(grp)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all ${
                            filtroGrupoEscuela === grp ? 'bg-sky-500 text-black shadow-sm' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          }`}
                        >
                          {grp === 'todos' ? 'Todos los grupos' : grp === 'Grupo Entrenamiento' ? 'Competencia' : grp}
                        </button>
                      ))}
                    </div>

                    <div className="relative w-full sm:w-60">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <Input
                        type="text"
                        placeholder="Buscar alumno..."
                        value={searchEscuela}
                        onChange={(e) => setSearchEscuela(e.target.value)}
                        className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 text-white rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-4 w-14 text-center">#</th>
                          <th className="py-2.5 px-4">Nombre y Apellido del Alumno</th>
                          <th className="py-2.5 px-4 text-right">Grupo Asignado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/80">
                        {escuelaFiltrada.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center py-8 text-zinc-500 italic">
                              No hay alumnos que coincidan con la búsqueda.
                            </td>
                          </tr>
                        ) : (
                          escuelaFiltrada.map((al: any, idx: number) => (
                            <tr key={al.id} className="hover:bg-zinc-800/30">
                              <td className="py-2 px-4 text-center text-zinc-500 font-mono">{idx + 1}</td>
                              <td className="py-2 px-4 font-semibold text-white">{al.nombre}</td>
                              <td className="py-2 px-4 text-right">
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
              </>
            )}

            {/* VISTA PARTICULARES */}
            {subTabEscuela === 'particulares' && (
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm space-y-0">
                <div className="p-3 border-b border-zinc-800 flex items-center justify-between gap-2 bg-zinc-900">
                  <span className="text-xs text-zinc-300 font-bold">
                    Alumnos particulares en {labelMesActual}: <strong className="text-purple-400">{data?.particulares?.totalAlumnosMesActual || 0}</strong>
                  </span>

                  <div className="relative w-full sm:w-60">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <Input
                      type="text"
                      placeholder="Buscar alumno..."
                      value={searchParticulares}
                      onChange={(e) => setSearchParticulares(e.target.value)}
                      className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 text-white rounded-xl"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800 sticky top-0">
                      <tr>
                        <th className="py-2.5 px-4 w-14 text-center">#</th>
                        <th className="py-2.5 px-4">Alumno</th>
                        <th className="py-2.5 px-4">Condición</th>
                        <th className="py-2.5 px-4 text-right">Clases Asistidas ({labelMesActual})</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/80">
                      {particularesFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-zinc-500 italic">
                            No hay registros de alumnos particulares para {labelMesActual}.
                          </td>
                        </tr>
                      ) : (
                        particularesFiltrados.map((al: any, idx: number) => (
                          <tr key={al.id} className="hover:bg-zinc-800/30">
                            <td className="py-2 px-4 text-center text-zinc-500 font-mono">{idx + 1}</td>
                            <td className="py-2 px-4 font-semibold text-white">{al.nombre}</td>
                            <td className="py-2 px-4">
                              <Badge variant="outline" className={`text-[10px] ${
                                al.esSocio ? 'border-sky-500/30 text-sky-400 bg-sky-500/10' : 'border-zinc-700 text-zinc-400'
                              }`}>
                                {al.esSocio ? 'Socio' : 'No Socio'}
                              </Badge>
                            </td>
                            <td className="py-2 px-4 text-right">
                              <span className="font-mono font-bold text-purple-300 text-xs px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20">
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
          </div>
        )}

        {/* TAB 4: CLASES DEL PROFESOR */}
        {activeTab === 'profesor' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-sky-400/10 border border-sky-400/20 text-sky-400">
                  <BookOpen size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Planilla de Clases del Profesor</h2>
                  <p className="text-xs text-zinc-400">
                    Registros cargados por el profesor en {labelMesActual} con asistencia y liquidación
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => generarPdfProfesor(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/20 text-xs gap-1.5 font-bold h-9"
              >
                <FileDown size={14} />
                <span>Descargar PDF Clases</span>
              </Button>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Total Clases Dadas</div>
                <div className="text-2xl font-black text-white mt-1">{data?.clasesProfesor?.totalClases || 0}</div>
              </div>

              <div className="bg-zinc-900/60 border border-zinc-800 p-3.5 rounded-2xl">
                <div className="text-[10px] text-sky-400 font-bold uppercase tracking-wider">Total Alumnos Atendidos</div>
                <div className="text-2xl font-black text-sky-400 mt-1">{data?.clasesProfesor?.totalAlumnos || 0}</div>
              </div>

              <div className="bg-zinc-900/60 border border-emerald-500/30 p-3.5 rounded-2xl">
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">Monto Total Liquidado</div>
                <div className="text-2xl font-black font-mono text-emerald-400 mt-1">
                  {formatCurrency(data?.clasesProfesor?.totalMonto || 0)}
                </div>
              </div>
            </div>

            {/* Tabla Clases */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between gap-2 bg-zinc-900">
                <span className="text-xs text-zinc-300 font-bold">
                  Registros asentados: <strong className="text-white">{data?.clasesProfesor?.registros?.length || 0}</strong>
                </span>

                <div className="relative w-full sm:w-60">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="text"
                    placeholder="Buscar fecha u observación..."
                    value={searchProfesor}
                    onChange={(e) => setSearchProfesor(e.target.value)}
                    className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4">Fecha</th>
                      <th className="py-2.5 px-4">Turno</th>
                      <th className="py-2.5 px-4 text-center">Clases</th>
                      <th className="py-2.5 px-4 text-center">Alumnos</th>
                      <th className="py-2.5 px-4 text-right">Monto</th>
                      <th className="py-2.5 px-4">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {profesorFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-zinc-500 italic">
                          No hay registros de clases para {labelMesActual}.
                        </td>
                      </tr>
                    ) : (
                      profesorFiltrados.map((r: any, idx: number) => (
                        <tr key={r.id} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-4 text-center text-zinc-500 font-mono">{idx + 1}</td>
                          <td className="py-2 px-4 font-mono text-white font-semibold">{r.fecha}</td>
                          <td className="py-2 px-4 text-zinc-300">{r.turno || '-'}</td>
                          <td className="py-2 px-4 text-center font-bold text-white">{r.cantidadClases}</td>
                          <td className="py-2 px-4 text-center text-sky-400 font-bold">{r.cantidadAlumnos}</td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-emerald-400">
                            {formatCurrency(r.precioTotal)}
                          </td>
                          <td className="py-2 px-4 text-zinc-400 text-[11px]">{r.observaciones || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: PADRÓN GENERAL DE SOCIOS */}
        {activeTab === 'socios' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-400/10 border border-amber-400/20 text-amber-400">
                  <Users size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Padrón General de Socios</h2>
                  <p className="text-xs text-zinc-400">
                    Nómina oficial de los {data?.socios?.total || 0} socios activos de la subcomisión
                  </p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => generarPdfSocios(false)}
                className="bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/20 text-xs gap-1.5 font-bold h-9"
              >
                <FileDown size={14} />
                <span>Descargar PDF Padrón</span>
              </Button>
            </div>

            {/* Búsqueda y Tabla */}
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="p-3 border-b border-zinc-800 flex items-center justify-between gap-2 bg-zinc-900">
                <span className="text-xs text-zinc-300 font-bold">
                  Socios en padrón: <strong className="text-amber-400">{data?.socios?.total || 0}</strong>
                </span>

                <div className="relative w-full sm:w-72">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                  <Input
                    type="text"
                    placeholder="Buscar por apellido, nombre o DNI..."
                    value={searchSocios}
                    onChange={(e) => setSearchSocios(e.target.value)}
                    className="pl-8 h-8 text-xs bg-zinc-950 border-zinc-800 text-white rounded-xl"
                  />
                </div>
              </div>

              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 font-semibold border-b border-zinc-800 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4 w-12 text-center">#</th>
                      <th className="py-2.5 px-4 w-28">DNI</th>
                      <th className="py-2.5 px-4">Apellido y Nombre</th>
                      <th className="py-2.5 px-4">Teléfono</th>
                      <th className="py-2.5 px-4">Email</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {sociosFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-zinc-500 italic">
                          No se encontraron socios con ese criterio de búsqueda.
                        </td>
                      </tr>
                    ) : (
                      sociosFiltrados.map((s: any, idx: number) => (
                        <tr key={s.id} className="hover:bg-zinc-800/30">
                          <td className="py-2 px-4 text-center text-zinc-500 font-mono">{idx + 1}</td>
                          <td className="py-2 px-4 font-mono font-bold text-sky-400">{s.dni || '-'}</td>
                          <td className="py-2 px-4 font-semibold text-white">{s.apellido}, {s.nombre}</td>
                          <td className="py-2 px-4 text-zinc-400">{s.telefono || '-'}</td>
                          <td className="py-2 px-4 text-zinc-400 font-mono text-[11px]">{s.email || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Pie de Página Oficial */}
      <footer className="border-t border-zinc-900 py-6 text-center text-xs text-zinc-500 bg-zinc-950 mt-10">
        <p className="font-semibold text-zinc-400">Club Empalme Central — Sistema Integral de Tenis</p>
        <p className="text-[11px] mt-1 text-zinc-600">
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
