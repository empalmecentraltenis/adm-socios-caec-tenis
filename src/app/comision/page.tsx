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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

  // Estados de búsqueda / filtros locales en los bloques
  const [searchEscuela, setSearchEscuela] = useState('');
  const [searchParticulares, setSearchParticulares] = useState('');
  const [searchSocios, setSearchSocios] = useState('');
  const [filtroCategoriaSocio, setFiltroCategoriaSocio] = useState<string>('todos');
  const [filtroGrupoEscuela, setFiltroGrupoEscuela] = useState<string>('todos');

  // Estado de descarga de paquete ZIP
  const [downloadingZip, setDownloadingZip] = useState(false);

  // Cargar datos consolidados
  const fetchDatosComision = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/comision?mes=${mesSeleccionado}`);
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
  }, [mesSeleccionado, toast]);

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
        const nom = al.nombre.toLowerCase();
        const tut = (al.tutor || '').toLowerCase();
        return nom.includes(term) || tut.includes(term);
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

  const sociosFiltrados = useMemo(() => {
    if (!data?.socios?.lista) return [];
    return data.socios.lista.filter((s: any) => {
      if (filtroCategoriaSocio !== 'todos' && s.categoria !== filtroCategoriaSocio) return false;
      if (searchSocios.trim()) {
        const term = searchSocios.toLowerCase();
        const fullName = `${s.apellido} ${s.nombre}`.toLowerCase();
        const dni = String(s.dni || '');
        return fullName.includes(term) || dni.includes(term);
      }
      return true;
    });
  }, [data?.socios?.lista, filtroCategoriaSocio, searchSocios]);

  // ==========================================
  // GENERADORES INDIVIDUALES DE REPORTES (PDF Y EXCEL)
  // ==========================================

  // 1. PDF Oficial Escuela y Pagos
  const generarPdfEscuela = (returnBlob = false) => {
    if (!data?.escuela?.alumnos) return null;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Cabecera institucional
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
    doc.text(`REPORTE MENSUAL DE CUOTAS ESCUELA DE TENIS — ${labelMesActual}`, 105, 29.5, { align: 'center' });

    const yStart = 37;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(10, yStart, 190, 22, 'FD');

    doc.text(`Total Alumnos: ${data.escuela.alumnos.length}`, 15, yStart + 6);
    doc.text(`Alumnos Cobrados: ${data.escuela.cantidadPagados}`, 15, yStart + 12);
    doc.text(`Alumnos Pendientes: ${data.escuela.cantidadPendientes}`, 15, yStart + 18);

    doc.text(`Total Estimado: ${formatCurrency(data.escuela.totalEsperado)}`, 110, yStart + 6);
    doc.setTextColor(0, 128, 0);
    doc.setFontSize(11);
    doc.text(`TOTAL RECAUDADO: ${formatCurrency(data.escuela.totalRecaudado)}`, 110, yStart + 14);

    const tableData = data.escuela.alumnos.map((al: any, idx: number) => [
      idx + 1,
      al.nombre,
      al.grupo,
      al.tutor || '-',
      formatCurrency(al.montoSugerido),
      al.pagado ? `SÍ (${formatCurrency(al.pago?.monto || 0)})` : 'PENDIENTE',
      al.pago ? al.pago.fechaPago : '-',
      al.pago ? al.pago.metodoPago.toUpperCase() : '-',
    ]);

    autoTable(doc, {
      startY: yStart + 26,
      head: [['#', 'Alumno', 'Grupo', 'Responsable', 'Valor', 'Cobrado', 'Fecha', 'Medio']],
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
    doc.save(`1_Cuotas_Escuela_Tenis_${mesSeleccionado}.pdf`);
  };

  // 2. PDF Oficial Particulares
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
    doc.text(`REPORTE DE ALUMNOS DE CLASES PARTICULARES — ${labelMesActual}`, 105, 29.5, { align: 'center' });

    const yStart = 37;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(10, yStart, 190, 16, 'FD');

    doc.text(`Total Alumnos Particulares: ${data.particulares.totalAlumnos}`, 15, yStart + 6);
    doc.text(`Total Asistencias Registradas: ${data.particulares.totalAsistencias}`, 110, yStart + 6);

    const tableData = data.particulares.alumnos.map((al: any, idx: number) => [
      idx + 1,
      al.nombre,
      al.esSocio ? 'Socio' : 'No Socio',
      al.categoria || '-',
      `${al.cantidadClases} clase(s)`,
      al.fechas.join(', '),
    ]);

    autoTable(doc, {
      startY: yStart + 20,
      head: [['#', 'Alumno', 'Condición', 'Categoría', 'Total Clases', 'Fechas']],
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
    doc.save(`2_Alumnos_Particulares_${mesSeleccionado}.pdf`);
  };

  // 3. PDF Padrón General de Socios
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
    doc.text(`PADRÓN COMPLETO DE SOCIOS ACTIVOS — ${labelMesActual}`, 105, 29.5, { align: 'center' });

    const yStart = 37;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(10, yStart, 190, 16, 'FD');

    doc.text(`Total Socios Activos: ${data.socios.total}`, 15, yStart + 6);
    const catResumen = Object.entries(data.socios.porCategoria || {})
      .map(([cat, cant]) => `${cat}: ${cant}`)
      .join(' | ');
    doc.setFontSize(8);
    doc.text(`Distribución: ${catResumen}`, 15, yStart + 12);

    const tableData = data.socios.lista.map((s: any, idx: number) => [
      idx + 1,
      s.dni || '-',
      `${s.apellido}, ${s.nombre}`,
      s.categoria || '-',
      s.telefono || '-',
      s.email || '-',
    ]);

    autoTable(doc, {
      startY: yStart + 20,
      head: [['#', 'DNI', 'Apellido y Nombre', 'Categoría', 'Teléfono', 'Email']],
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
    doc.save(`3_Padron_Socios_CAEC_${mesSeleccionado}.pdf`);
  };

  // 4. PDF Balance Mensual
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
    doc.text(`BALANCE FINANCIERO MENSUAL — ${labelMesActual}`, 105, 29.5, { align: 'center' });

    const yStart = 37;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 248, 248);
    doc.rect(10, yStart, 190, 20, 'FD');

    doc.text(`Ingresos del Período: ${formatCurrency(data.balance.totalIngresos)}`, 15, yStart + 7);
    doc.text(`Egresos del Período: ${formatCurrency(data.balance.totalEgresos)}`, 15, yStart + 14);

    const esSuperavit = data.balance.resultadoNeto >= 0;
    doc.setTextColor(esSuperavit ? 0 : 200, esSuperavit ? 128 : 0, 0);
    doc.setFontSize(11);
    doc.text(
      `RESULTADO NETO: ${formatCurrency(data.balance.resultadoNeto)} (${esSuperavit ? 'SUPERÁVIT' : 'DÉFICIT'})`,
      100,
      yStart + 11
    );

    const tableData = data.balance.movimientos.map((m: any, idx: number) => [
      idx + 1,
      m.fecha,
      m.descripcion,
      m.responsable || '-',
      m.tipo.toUpperCase(),
      formatCurrency(m.monto),
    ]);

    autoTable(doc, {
      startY: yStart + 24,
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
    doc.save(`4_Balance_Mensual_${mesSeleccionado}.pdf`);
  };

  // 5. Excel Integral de Comisión Directiva (Todas las solapas en 1 solo libro)
  const generarExcelConsolidado = (returnBlob = false) => {
    if (!data) return null;

    const wb = XLSX.utils.book_new();

    // Solapa 1: Resumen
    const wsResumen = XLSX.utils.json_to_sheet([
      { Concepto: 'Período', Valor: labelMesActual },
      { Concepto: 'Total Socios Activos', Valor: data.resumenGlobal.totalSocios },
      { Concepto: 'Total Alumnos Escuela', Valor: data.resumenGlobal.totalAlumnosEscuela },
      { Concepto: 'Cuotas Escuela Cobradas', Valor: data.resumenGlobal.escuelaRecaudado },
      { Concepto: 'Alumnos en Particulares', Valor: data.resumenGlobal.totalParticulares },
      { Concepto: 'Total Asistencias Particulares', Valor: data.resumenGlobal.totalAsistenciasParticulares },
      { Concepto: 'Ingresos Balance', Valor: data.resumenGlobal.balanceIngresos },
      { Concepto: 'Egresos Balance', Valor: data.resumenGlobal.balanceEgresos },
      { Concepto: 'Resultado Neto Período', Valor: data.resumenGlobal.balanceResultadoNeto },
    ]);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Ejecutivo');

    // Solapa 2: Escuela y Pagos
    const wsEscuela = XLSX.utils.json_to_sheet(
      data.escuela.alumnos.map((al: any, idx: number) => ({
        'N°': idx + 1,
        'Alumno': al.nombre,
        'Grupo': al.grupo,
        'Edad': al.edad || '-',
        'Tutor': al.tutor || '-',
        'Teléfono': al.telefono || '-',
        'Valor Cuota': al.montoSugerido,
        'Estado': al.pagado ? 'COBRADO' : 'PENDIENTE',
        'Monto Cobrado': al.pago?.monto || 0,
        'Fecha Pago': al.pago?.fechaPago || '-',
        'Medio de Pago': al.pago?.metodoPago || '-',
        'Observaciones': al.pago?.observaciones || '-',
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsEscuela, 'Escuela y Cuotas');

    // Solapa 3: Particulares
    const wsParticulares = XLSX.utils.json_to_sheet(
      data.particulares.alumnos.map((al: any, idx: number) => ({
        'N°': idx + 1,
        'Alumno': al.nombre,
        'Condición': al.esSocio ? 'Socio' : 'No Socio',
        'DNI': al.dni || '-',
        'Categoría': al.categoria || '-',
        'Teléfono': al.telefono || '-',
        'Clases en el Mes': al.cantidadClases,
        'Fechas': al.fechas.join(', '),
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsParticulares, 'Clases Particulares');

    // Solapa 4: Socios
    const wsSocios = XLSX.utils.json_to_sheet(
      data.socios.lista.map((s: any, idx: number) => ({
        'N°': idx + 1,
        'DNI': s.dni || '-',
        'Apellido y Nombre': `${s.apellido}, ${s.nombre}`,
        'Categoría': s.categoria || '-',
        'Teléfono': s.telefono || '-',
        'Email': s.email || '-',
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsSocios, 'Padrón Socios');

    // Solapa 5: Balance
    const wsBalance = XLSX.utils.json_to_sheet(
      data.balance.movimientos.map((m: any, idx: number) => ({
        'N°': idx + 1,
        'Fecha': m.fecha,
        'Concepto': m.descripcion,
        'Responsable': m.responsable || '-',
        'Tipo': m.tipo.toUpperCase(),
        'Monto': m.monto,
      }))
    );
    XLSX.utils.book_append_sheet(wb, wsBalance, 'Movimientos Balance');

    if (returnBlob) {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    }

    XLSX.writeFile(wb, `Reporte_Consolidado_Comision_CAEC_${mesSeleccionado}.xlsx`);
  };

  // 6. Descargar Paquete Mensual Completo en formato ZIP
  const handleDescargarPaqueteZip = async () => {
    if (!data) return;
    setDownloadingZip(true);
    try {
      const zip = new JSZip();
      const folderName = `Informe_Comision_Directiva_${mesSeleccionado}`;
      const folder = zip.folder(folderName);

      // Agregar los 4 PDFs
      const pdfEscuelaBlob = generarPdfEscuela(true);
      if (pdfEscuelaBlob) folder?.file(`1_Cuotas_Escuela_Tenis_${mesSeleccionado}.pdf`, pdfEscuelaBlob);

      const pdfParticularesBlob = generarPdfParticulares(true);
      if (pdfParticularesBlob) folder?.file(`2_Alumnos_Particulares_${mesSeleccionado}.pdf`, pdfParticularesBlob);

      const pdfSociosBlob = generarPdfSocios(true);
      if (pdfSociosBlob) folder?.file(`3_Padron_Socios_CAEC_${mesSeleccionado}.pdf`, pdfSociosBlob);

      const pdfBalanceBlob = generarPdfBalance(true);
      if (pdfBalanceBlob) folder?.file(`4_Balance_Mensual_${mesSeleccionado}.pdf`, pdfBalanceBlob);

      // Agregar el Excel Completo con todas las solapas
      const excelConsolidadoBlob = generarExcelConsolidado(true);
      if (excelConsolidadoBlob) folder?.file(`Planilla_Consolidada_Comision_${mesSeleccionado}.xlsx`, excelConsolidadoBlob);

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
        description: 'Se descargaron los 4 informes PDF y la planilla Excel del mes.',
      });
    } catch (err: any) {
      console.error('Error al generar ZIP:', err);
      toast({
        title: 'Error al generar paquete',
        description: 'No se pudo compilar el archivo ZIP.',
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
            {/* Navegador de Mes */}
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

            {/* Botón Refrescar */}
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

            {/* Botón Descargar Paquete ZIP */}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Socios */}
          <div className="bg-[#141416] border border-[#242428] rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#888888]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Padrón de Socios</span>
              <Users size={18} className="text-sky-400" />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {data?.resumenGlobal?.totalSocios ?? 0}
              </div>
              <div className="text-[11px] text-[#888888] mt-0.5">Socios activos del club</div>
            </div>
          </div>

          {/* Card 2: Escuela */}
          <div className="bg-[#141416] border border-emerald-500/20 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Alumnos Escuela</span>
              <GraduationCap size={18} />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {data?.resumenGlobal?.totalAlumnosEscuela ?? 0}
              </div>
              <div className="text-[11px] text-emerald-300 font-semibold mt-0.5">
                {data?.escuela?.cantidadPagados ?? 0} cuotas cobradas ({data?.resumenGlobal?.escuelaPorcentajeCobrado ?? 0}%)
              </div>
            </div>
          </div>

          {/* Card 3: Particulares */}
          <div className="bg-[#141416] border border-purple-500/20 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-purple-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">Clases Particulares</span>
              <Sparkles size={18} />
            </div>
            <div className="mt-2">
              <div className="text-2xl sm:text-3xl font-black text-white">
                {data?.resumenGlobal?.totalParticulares ?? 0}
              </div>
              <div className="text-[11px] text-purple-300 font-semibold mt-0.5">
                {data?.resumenGlobal?.totalAsistenciasParticulares ?? 0} asistencias registradas
              </div>
            </div>
          </div>

          {/* Card 4: Balance del Mes */}
          <div className={`border rounded-2xl p-4 shadow-sm flex flex-col justify-between ${
            (data?.resumenGlobal?.balanceResultadoNeto ?? 0) >= 0
              ? 'bg-[#141416] border-emerald-500/30'
              : 'bg-[#141416] border-red-500/30'
          }`}>
            <div className="flex items-center justify-between text-[#888888]">
              <span className="text-[11px] font-bold uppercase tracking-wider">Resultado del Mes</span>
              {(data?.resumenGlobal?.balanceResultadoNeto ?? 0) >= 0 ? (
                <TrendingUp size={18} className="text-emerald-400" />
              ) : (
                <TrendingDown size={18} className="text-red-400" />
              )}
            </div>
            <div className="mt-2">
              <div className={`text-2xl sm:text-3xl font-black font-mono ${
                (data?.resumenGlobal?.balanceResultadoNeto ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {formatCurrency(data?.resumenGlobal?.balanceResultadoNeto ?? 0)}
              </div>
              <div className="text-[11px] text-[#888888] mt-0.5">
                Superávit neto de tenis
              </div>
            </div>
          </div>
        </div>

        {/* 3. BLOQUE 1: ESCUELA DE TENIS Y PAGOS DE CUOTAS */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <GraduationCap size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  1. Escuela de Tenis — Cuotas Mensuales del Profesor
                </h2>
                <p className="text-xs text-[#888888]">
                  Cobros registrados del mes {labelMesActual} por categoría ($20.000 Escuelita/Minitenis - $35.000 Competencia)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => generarPdfEscuela(false)}
                className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1 font-semibold"
              >
                <FileDown size={14} />
                <span>PDF Oficial</span>
              </Button>
            </div>
          </div>

          {/* Métricas del Bloque */}
          <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111113] border-b border-[#242428]">
            <div className="bg-[#161619] border border-[#25252A] p-2.5 rounded-xl">
              <div className="text-[10px] text-[#888888] font-bold uppercase">Total Inscriptos</div>
              <div className="text-base font-black text-white">{data?.escuela?.alumnos?.length || 0} alumnos</div>
            </div>
            <div className="bg-[#161619] border border-[#25252A] p-2.5 rounded-xl">
              <div className="text-[10px] text-emerald-400 font-bold uppercase">Cuotas Cobradas</div>
              <div className="text-base font-black text-emerald-400">{data?.escuela?.cantidadPagados || 0}</div>
            </div>
            <div className="bg-[#161619] border border-[#25252A] p-2.5 rounded-xl">
              <div className="text-[10px] text-amber-400 font-bold uppercase">Cuotas Pendientes</div>
              <div className="text-base font-black text-amber-400">{data?.escuela?.cantidadPendientes || 0}</div>
            </div>
            <div className="bg-[#161619] border border-emerald-500/30 p-2.5 rounded-xl">
              <div className="text-[10px] text-emerald-300 font-bold uppercase">Total Recaudado</div>
              <div className="text-base font-black font-mono text-emerald-400">
                {formatCurrency(data?.escuela?.totalRecaudado || 0)}
              </div>
            </div>
          </div>

          {/* Filtros locales */}
          <div className="p-3 border-b border-[#242428] flex flex-wrap items-center justify-between gap-2">
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
                placeholder="Buscar alumno o tutor..."
                value={searchEscuela}
                onChange={(e) => setSearchEscuela(e.target.value)}
                className="pl-7 h-7 text-xs bg-[#111113] border-[#25252A] text-white"
              />
            </div>
          </div>

          {/* Tabla Escuela */}
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18181B] text-[#888888] font-bold border-b border-[#242428] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Alumno</th>
                  <th className="py-2.5 px-3">Grupo</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3 text-right">Valor Cuota</th>
                  <th className="py-2.5 px-3 text-center">Estado</th>
                  <th className="py-2.5 px-3">Fecha Pago</th>
                  <th className="py-2.5 px-3">Medio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D1D20]">
                {escuelaFiltrada.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-6 text-[#666]">
                      No hay registros de escuela que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  escuelaFiltrada.map((al: any, idx: number) => (
                    <tr key={al.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-3 text-[#666] font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-white">{al.nombre}</td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#1E1E22] border border-[#2E2E34] text-[#AAA]">
                          {al.grupo === 'Grupo Entrenamiento' ? 'Competencia' : al.grupo}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[#888]">{al.tutor || '-'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-white">
                        {formatCurrency(al.montoSugerido)}
                      </td>
                      <td className="py-2 px-3 text-center">
                        {al.pagado ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            Cobrado (${al.pago?.monto?.toLocaleString('es-AR')})
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[10px] font-bold">
                            Pendiente
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-[#888] font-mono text-[11px]">{al.pago?.fechaPago || '-'}</td>
                      <td className="py-2 px-3 uppercase text-[10px] text-[#888] font-bold">
                        {al.pago?.metodoPago || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 4. BLOQUE 2: CLASES PARTICULARES CON EL PROFESOR */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Sparkles size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  2. Clases Particulares — Alumnos del Profesor
                </h2>
                <p className="text-xs text-[#888888]">
                  Socios y no socios que tomaron clases individuales en el mes {labelMesActual} con cantidad de asistencias
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => generarPdfParticulares(false)}
                className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1 font-semibold"
              >
                <FileDown size={14} />
                <span>PDF Oficial</span>
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="p-3 border-b border-[#242428] flex items-center justify-between gap-2">
            <span className="text-xs text-[#888888]">
              Total alumnos registrados en el mes: <strong className="text-white">{data?.particulares?.totalAlumnos || 0}</strong> ({data?.particulares?.totalAsistencias || 0} asistencias)
            </span>

            <div className="relative w-full sm:w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777]" />
              <Input
                type="text"
                placeholder="Buscar alumno particular..."
                value={searchParticulares}
                onChange={(e) => setSearchParticulares(e.target.value)}
                className="pl-7 h-7 text-xs bg-[#111113] border-[#25252A] text-white"
              />
            </div>
          </div>

          {/* Tabla Particulares */}
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18181B] text-[#888888] font-bold border-b border-[#242428] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Alumno</th>
                  <th className="py-2.5 px-3">Condición</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-center">Clases en el Mes</th>
                  <th className="py-2.5 px-3">Fechas de Asistencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D1D20]">
                {particularesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-[#666]">
                      No hay registros de particulares para el mes seleccionado.
                    </td>
                  </tr>
                ) : (
                  particularesFiltrados.map((al: any, idx: number) => (
                    <tr key={al.key} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-3 text-[#666] font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-semibold text-white">{al.nombre}</td>
                      <td className="py-2 px-3">
                        {al.esSocio ? (
                          <Badge className="bg-sky-500/15 text-sky-400 border-sky-500/30 text-[10px]">
                            Socio {al.dni ? `(DNI ${al.dni})` : ''}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-[#333] text-[#888] text-[10px]">
                            No Socio
                          </Badge>
                        )}
                      </td>
                      <td className="py-2 px-3 text-[#888]">{al.categoria || '-'}</td>
                      <td className="py-2 px-3 text-center">
                        <span className="font-mono font-bold text-purple-400 text-xs px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                          {al.cantidadClases} clase(s)
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[11px] text-[#888] font-mono">
                        {al.fechas.join(', ')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5. BLOQUE 3: PADRÓN GENERAL COMPLETO DE SOCIOS (SIN FILTRO DE DEUDA) */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  3. Padrón General Completo de Socios
                </h2>
                <p className="text-xs text-[#888888]">
                  Nómina completa de todos los socios activos de tenis sin importar si adeudan o están al día
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => generarPdfSocios(false)}
                className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1 font-semibold"
              >
                <FileDown size={14} />
                <span>PDF Padrón</span>
              </Button>
            </div>
          </div>

          {/* Filtros */}
          <div className="p-3 border-b border-[#242428] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-[#888888] mr-1">Categoría:</span>
              <Button
                size="sm"
                variant={filtroCategoriaSocio === 'todos' ? 'default' : 'ghost'}
                onClick={() => setFiltroCategoriaSocio('todos')}
                className={`text-xs h-7 px-2.5 ${filtroCategoriaSocio === 'todos' ? 'bg-primary text-black font-bold' : 'text-[#888888]'}`}
              >
                Todas ({data?.socios?.total || 0})
              </Button>
              {Object.entries(data?.socios?.porCategoria || {}).map(([cat, cant]) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={filtroCategoriaSocio === cat ? 'default' : 'ghost'}
                  onClick={() => setFiltroCategoriaSocio(cat)}
                  className={`text-xs h-7 px-2 ${filtroCategoriaSocio === cat ? 'bg-sky-500 text-black font-bold' : 'text-[#888888]'}`}
                >
                  {cat} ({String(cant)})
                </Button>
              ))}
            </div>

            <div className="relative w-full sm:w-56">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777]" />
              <Input
                type="text"
                placeholder="Buscar por nombre, socio o DNI..."
                value={searchSocios}
                onChange={(e) => setSearchSocios(e.target.value)}
                className="pl-7 h-7 text-xs bg-[#111113] border-[#25252A] text-white"
              />
            </div>
          </div>

          {/* Tabla Socios */}
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18181B] text-[#888888] font-bold border-b border-[#242428] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">DNI</th>
                  <th className="py-2.5 px-3">Apellido y Nombre</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Teléfono</th>
                  <th className="py-2.5 px-3">Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D1D20]">
                {sociosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-[#666]">
                      No se encontraron socios con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  sociosFiltrados.map((s: any, idx: number) => (
                    <tr key={s.id} className="hover:bg-white/[0.02]">
                      <td className="py-2 px-3 text-[#666] font-mono">{idx + 1}</td>
                      <td className="py-2 px-3 font-mono font-bold text-sky-400">
                        {s.dni || '-'}
                      </td>
                      <td className="py-2 px-3 font-semibold text-white">
                        {s.apellido}, {s.nombre}
                      </td>
                      <td className="py-2 px-3">
                        <Badge variant="outline" className="border-[#2E2E34] text-[#AAA] text-[10px]">
                          {s.categoria || '-'}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-[#888]">{s.telefono || '-'}</td>
                      <td className="py-2 px-3 text-[#888] text-[11px] font-mono">{s.email || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 6. BLOQUE 4: BALANCE FINANCIERO MENSUAL */}
        <section className="bg-[#141416] border border-[#242428] rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-[#18181B] border-b border-[#242428] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <DollarSign size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  4. Balance Financiero Mensual de Tenis
                </h2>
                <p className="text-xs text-[#888888]">
                  Ingresos, egresos y resultado económico neto registrado para el período {labelMesActual}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => generarPdfBalance(false)}
                className="h-8 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs gap-1 font-semibold"
              >
                <FileDown size={14} />
                <span>PDF Balance</span>
              </Button>
            </div>
          </div>

          {/* Resumen Financiero */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-[#111113] border-b border-[#242428]">
            <div className="bg-[#161619] border border-emerald-500/20 p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#888] font-bold uppercase">Total Ingresos</div>
                <div className="text-lg font-black font-mono text-emerald-400">
                  {formatCurrency(data?.balance?.totalIngresos || 0)}
                </div>
              </div>
              <ArrowUpRight size={24} className="text-emerald-400/50" />
            </div>

            <div className="bg-[#161619] border border-red-500/20 p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] text-[#888] font-bold uppercase">Total Egresos</div>
                <div className="text-lg font-black font-mono text-red-400">
                  {formatCurrency(data?.balance?.totalEgresos || 0)}
                </div>
              </div>
              <TrendingDown size={24} className="text-red-400/50" />
            </div>

            <div className={`p-3 rounded-xl border flex items-center justify-between ${
              (data?.balance?.resultadoNeto || 0) >= 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}>
              <div>
                <div className="text-[10px] font-bold uppercase">Resultado Neto</div>
                <div className="text-lg font-black font-mono">
                  {formatCurrency(data?.balance?.resultadoNeto || 0)}
                </div>
              </div>
              <span className="text-xs font-bold uppercase">
                {(data?.balance?.resultadoNeto || 0) >= 0 ? 'Superávit' : 'Déficit'}
              </span>
            </div>
          </div>

          {/* Tabla Movimientos */}
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#18181B] text-[#888888] font-bold border-b border-[#242428] sticky top-0">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Concepto / Descripción</th>
                  <th className="py-2.5 px-3">Responsable</th>
                  <th className="py-2.5 px-3">Tipo</th>
                  <th className="py-2.5 px-3 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1D1D20]">
                {!data?.balance?.movimientos || data.balance.movimientos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-[#666]">
                      No hay movimientos asentados para el mes de {labelMesActual}.
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
        </section>
      </main>

      {/* 7. Pie de Página Oficial */}
      <footer className="border-t border-[#222225] py-6 text-center text-xs text-[#666666] bg-[#101012]">
        <p>Club Empalme Central — Sistema Integral de Tenis</p>
        <p className="text-[11px] mt-1 text-[#444444]">
          Documentación para uso exclusivo de la Comisión Directiva del Club
        </p>
      </footer>
    </div>
  );
}

