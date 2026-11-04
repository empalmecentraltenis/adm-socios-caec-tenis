'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CreditCard,
  DollarSign,
  Calendar,
  Search,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  FileDown,
  Printer,
  Loader2,
  RefreshCw,
  Sparkles,
  GraduationCap,
  Trophy,
  Filter,
  Users,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/formatters';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PagoDetalle {
  id: string;
  monto: number;
  fechaPago: string;
  metodoPago: string;
  observaciones?: string | null;
}

interface AlumnoPagoItem {
  id: string;
  nombre: string;
  grupo: string;
  edad?: number | null;
  tutor?: string | null;
  telefono?: string | null;
  montoSugerido: number;
  pagado: boolean;
  pago: PagoDetalle | null;
}

interface ResumenPagos {
  totalAlumnos: number;
  cantidadPagados: number;
  cantidadPendientes: number;
  totalEsperado: number;
  totalRecaudado: number;
  porcentajeCobrado: number;
}

interface MesResumenItem {
  mes: string;
  numeroMes: number;
  totalRecaudado: number;
  cantidadPagados: number;
}

const GRUPOS = ['Escuelita', 'Minitenis', 'Grupo Entrenamiento'] as const;

const GRUPO_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  Escuelita: {
    label: 'Escuelita ($ 20.000)',
    icon: Sparkles,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  Minitenis: {
    label: 'Minitenis ($ 20.000)',
    icon: GraduationCap,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
  'Grupo Entrenamiento': {
    label: 'Entrenamiento ($ 35.000)',
    icon: Trophy,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
};

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

interface Props {
  readOnly?: boolean;
}

export default function PagosCuotaEscuelaPanel({ readOnly = false }: Props) {
  const { toast } = useToast();

  const getCurMonthStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [mesSeleccionado, setMesSeleccionado] = useState<string>(getCurMonthStr());
  const [grupoFiltro, setGrupoFiltro] = useState<string>('todos');
  const [estadoFiltro, setEstadoFiltro] = useState<'todos' | 'pagados' | 'pendientes'>('todos');
  const [search, setSearch] = useState<string>('');

  const [alumnos, setAlumnos] = useState<AlumnoPagoItem[]>([]);
  const [resumen, setResumen] = useState<ResumenPagos | null>(null);
  const [mesesAnio, setMesesAnio] = useState<MesResumenItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Modal para registrar o editar cobro
  const [cobroModalOpen, setCobroModalOpen] = useState(false);
  const [alumnoParaCobro, setAlumnoParaCobro] = useState<AlumnoPagoItem | null>(null);
  const [formMonto, setFormMonto] = useState<string>('20000');
  const [formFechaPago, setFormFechaPago] = useState<string>(getTodayStr());
  const [formMetodoPago, setFormMetodoPago] = useState<string>('efectivo');
  const [formObservaciones, setFormObservaciones] = useState<string>('');
  const [savingCobro, setSavingCobro] = useState(false);

  // Modal confirmación anular pago
  const [anularModalOpen, setAnularModalOpen] = useState(false);
  const [alumnoParaAnular, setAlumnoParaAnular] = useState<AlumnoPagoItem | null>(null);
  const [anulando, setAnulando] = useState(false);

  // Modal para cobro masivo
  const [masivoModalOpen, setMasivoModalOpen] = useState(false);
  const [selectedAlumnoIds, setSelectedAlumnoIds] = useState<string[]>([]);
  const [masivoGrupoFiltro, setMasivoGrupoFiltro] = useState<string>('todos');
  const [masivoFechaPago, setMasivoFechaPago] = useState<string>(getTodayStr());
  const [masivoMetodoPago, setMasivoMetodoPago] = useState<string>('efectivo');
  const [masivoObservaciones, setMasivoObservaciones] = useState<string>('');
  const [savingMasivo, setSavingMasivo] = useState(false);

  // Cargar datos
  const fetchPagos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pagos-escuela?mes=${mesSeleccionado}&grupo=${grupoFiltro}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setAlumnos(data.alumnos || []);
        setResumen(data.resumen || null);
        if (data.mesesAnio) {
          setMesesAnio(data.mesesAnio);
        }
      } else {
        toast({
          title: 'Error al cargar pagos',
          description: data.error || 'No se pudieron obtener los registros de cuotas.',
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
  }, [mesSeleccionado, grupoFiltro, toast]);

  useEffect(() => {
    fetchPagos();
  }, [fetchPagos]);

  // Alumnos filtrados
  const filteredAlumnos = useMemo(() => {
    return alumnos.filter((al) => {
      // Filtro de estado
      if (estadoFiltro === 'pagados' && !al.pagado) return false;
      if (estadoFiltro === 'pendientes' && al.pagado) return false;

      // Filtro de búsqueda
      if (search.trim()) {
        const term = search.toLowerCase();
        const nom = al.nombre.toLowerCase();
        const tut = (al.tutor || '').toLowerCase();
        const tel = (al.telefono || '').toLowerCase();
        return nom.includes(term) || tut.includes(term) || tel.includes(term);
      }

      return true;
    });
  }, [alumnos, estadoFiltro, search]);

  // Abrir modal de cobro rápido
  const handleOpenCobro = (alumno: AlumnoPagoItem) => {
    setAlumnoParaCobro(alumno);
    if (alumno.pago) {
      setFormMonto(String(alumno.pago.monto));
      setFormFechaPago(alumno.pago.fechaPago);
      setFormMetodoPago(alumno.pago.metodoPago);
      setFormObservaciones(alumno.pago.observaciones || '');
    } else {
      setFormMonto(String(alumno.montoSugerido));
      setFormFechaPago(getTodayStr());
      setFormMetodoPago('efectivo');
      setFormObservaciones('');
    }
    setCobroModalOpen(true);
  };

  // Registrar cobro
  const handleGuardarCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alumnoParaCobro) return;

    const montoNum = parseFloat(formMonto);
    if (isNaN(montoNum) || montoNum < 0) {
      toast({
        title: 'Monto inválido',
        description: 'Ingresá un valor numérico válido.',
        variant: 'destructive',
      });
      return;
    }

    setSavingCobro(true);
    try {
      const res = await fetch('/api/pagos-escuela', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId: alumnoParaCobro.id,
          mes: mesSeleccionado,
          monto: montoNum,
          fechaPago: formFechaPago,
          metodoPago: formMetodoPago,
          observaciones: formObservaciones.trim() || null,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Pago registrado',
          description: `Cuota de ${mesSeleccionado} cobrada a ${alumnoParaCobro.nombre}.`,
        });
        setCobroModalOpen(false);
        fetchPagos();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo guardar el pago',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al procesar el pago',
        variant: 'destructive',
      });
    } finally {
      setSavingCobro(false);
    }
  };

  // Anular pago
  const handleConfirmarAnular = async () => {
    if (!alumnoParaAnular || !alumnoParaAnular.pago) return;
    setAnulando(true);
    try {
      const res = await fetch(`/api/pagos-escuela?pagoId=${alumnoParaAnular.pago.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Pago anulado',
          description: `Se canceló el registro de pago de ${alumnoParaAnular.nombre}.`,
        });
        setAnularModalOpen(false);
        setAlumnoParaAnular(null);
        fetchPagos();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo anular el pago',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Error al anular pago',
        variant: 'destructive',
      });
    } finally {
      setAnulando(false);
    }
  };

  // Alumnos pendientes para el cobro masivo (filtrados por masivoGrupoFiltro)
  const alumnosPendientes = useMemo(() => {
    return alumnos.filter((al) => !al.pagado);
  }, [alumnos]);

  const alumnosPendientesEnModal = useMemo(() => {
    if (masivoGrupoFiltro === 'todos') return alumnosPendientes;
    return alumnosPendientes.filter((al) => al.grupo === masivoGrupoFiltro);
  }, [alumnosPendientes, masivoGrupoFiltro]);

  // Abrir modal de cobro masivo
  const handleOpenMasivo = () => {
    const ids = alumnosPendientes.map((al) => al.id);
    setSelectedAlumnoIds(ids);
    setMasivoGrupoFiltro(grupoFiltro !== 'todos' ? grupoFiltro : 'todos');
    setMasivoFechaPago(getTodayStr());
    setMasivoMetodoPago('efectivo');
    setMasivoObservaciones('');
    setMasivoModalOpen(true);
  };

  const toggleSelectAlumno = (id: string) => {
    setSelectedAlumnoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectAllPendientesEnModal = () => {
    const idsEnVista = alumnosPendientesEnModal.map((al) => al.id);
    setSelectedAlumnoIds((prev) => Array.from(new Set([...prev, ...idsEnVista])));
  };

  const deselectAllPendientesEnModal = () => {
    const idsEnVista = new Set(alumnosPendientesEnModal.map((al) => al.id));
    setSelectedAlumnoIds((prev) => prev.filter((id) => !idsEnVista.has(id)));
  };

  // Calcular total a cobrar masivo de los seleccionados
  const totalMontoMasivoSeleccionado = useMemo(() => {
    const mapPrecios = new Map(alumnos.map((al) => [al.id, al.montoSugerido]));
    return selectedAlumnoIds.reduce((acc, id) => acc + (mapPrecios.get(id) || 0), 0);
  }, [selectedAlumnoIds, alumnos]);

  // Ejecutar cobro masivo
  const handleEjecutarCobroMasivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedAlumnoIds.length === 0) {
      toast({
        title: 'Ningún alumno seleccionado',
        description: 'Elegí al menos un alumno para registrar el cobro.',
        variant: 'destructive',
      });
      return;
    }

    setSavingMasivo(true);
    try {
      const items = selectedAlumnoIds.map((id) => {
        const al = alumnos.find((a) => a.id === id);
        return {
          alumnoId: id,
          monto: al ? al.montoSugerido : undefined,
        };
      });

      const res = await fetch('/api/pagos-escuela', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masivo: true,
          mes: mesSeleccionado,
          fechaPago: masivoFechaPago,
          metodoPago: masivoMetodoPago,
          observaciones: masivoObservaciones,
          items,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Cobro masivo registrado',
          description: `Se cobraron ${data.guardadosCount} cuotas por un total de $${data.totalMontoCobrado?.toLocaleString('es-AR')}.`,
        });
        setMasivoModalOpen(false);
        fetchPagos();
      } else {
        toast({
          title: 'Error al registrar cobro masivo',
          description: data.error || 'No se pudo completar el cobro masivo.',
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
      setSavingMasivo(false);
    }
  };

  // Año actual seleccionado
  const anioActual = useMemo(() => {
    return mesSeleccionado.split('-')[0] || String(new Date().getFullYear());
  }, [mesSeleccionado]);

  // Funciones para navegar de año
  const handleCambiarAnio = (delta: number) => {
    const curYear = parseInt(anioActual, 10);
    const newYear = curYear + delta;
    const mesNum = mesSeleccionado.split('-')[1] || '01';
    setMesSeleccionado(`${newYear}-${mesNum}`);
  };

  // Total anual recaudado de todos los meses del año cargados
  const totalAnualRecaudado = useMemo(() => {
    return mesesAnio.reduce((acc, m) => acc + m.totalRecaudado, 0);
  }, [mesesAnio]);

  // Formato etiqueta de mes: ej. "NOVIEMBRE 2026"
  const labelMesActual = useMemo(() => {
    const [y, m] = mesSeleccionado.split('-').map(Number);
    if (!y || !m) return mesSeleccionado;
    return `${MESES_NOMBRES[m - 1].toUpperCase()} ${y}`;
  }, [mesSeleccionado]);

  // Exportar a Excel (Reporte Comisión Directiva)
  const exportarAExcel = () => {
    try {
      const rows = filteredAlumnos.map((al, idx) => ({
        'N°': idx + 1,
        'Alumno': al.nombre,
        'Grupo': al.grupo,
        'Edad': al.edad ? `${al.edad} años` : '-',
        'Tutor / Responsable': al.tutor || '-',
        'Teléfono': al.telefono || '-',
        'Valor Cuota': al.montoSugerido,
        'Estado': al.pagado ? 'COBRADO' : 'PENDIENTE',
        'Monto Cobrado': al.pago ? al.pago.monto : 0,
        'Fecha de Pago': al.pago ? al.pago.fechaPago : '-',
        'Medio de Pago': al.pago ? al.pago.metodoPago.toUpperCase() : '-',
        'Observaciones': al.pago?.observaciones || '-',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 },   // N°
        { wch: 30 },  // Alumno
        { wch: 22 },  // Grupo
        { wch: 10 },  // Edad
        { wch: 25 },  // Tutor
        { wch: 18 },  // Teléfono
        { wch: 14 },  // Valor Cuota
        { wch: 14 },  // Estado
        { wch: 16 },  // Monto Cobrado
        { wch: 14 },  // Fecha de Pago
        { wch: 16 },  // Medio de Pago
        { wch: 30 },  // Observaciones
      ];

      // Segunda solapa: Resumen para Comisión Directiva
      const resumenRows = [
        { Concepto: 'Período', Valor: labelMesActual },
        { Concepto: 'Total Alumnos Inscriptos', Valor: resumen?.totalAlumnos || 0 },
        { Concepto: 'Cantidad Alumnos Cobrados', Valor: resumen?.cantidadPagados || 0 },
        { Concepto: 'Cantidad Alumnos Pendientes', Valor: resumen?.cantidadPendientes || 0 },
        { Concepto: 'Porcentaje Cobrado', Valor: `${resumen?.porcentajeCobrado || 0}%` },
        { Concepto: 'Total Estimado / Esperado', Valor: resumen?.totalEsperado || 0 },
        { Concepto: 'TOTAL RECAUDADO', Valor: resumen?.totalRecaudado || 0 },
      ];
      const wsResumen = XLSX.utils.json_to_sheet(resumenRows);
      wsResumen['!cols'] = [{ wch: 32 }, { wch: 25 }];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen Comision Directiva');
      XLSX.utils.book_append_sheet(wb, ws, 'Detalle Alumnos');

      const fileName = `Reporte_Cuotas_Escuela_Tenis_${mesSeleccionado}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Excel generado exitosamente',
        description: `Se exportó el reporte de ${labelMesActual}.`,
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

  // Exportar a PDF Oficial para Comisión Directiva
  const exportarAPDF = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Cabecera institucional
      doc.setFillColor(26, 26, 26);
      doc.rect(10, 10, 190, 14, 'F');
      doc.setTextColor(255, 204, 0); // Amarillo #FFCC00
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('CLUB EMPALME CENTRAL — SUBCOMISIÓN DE TENIS', 105, 19, { align: 'center' });

      doc.setFillColor(255, 204, 0);
      doc.rect(10, 24, 190, 8, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.text(`REPORTE MENSUAL DE CUOTAS ESCUELA DE TENIS — ${labelMesActual}`, 105, 29.5, { align: 'center' });

      // Cuadro de Resumen Ejecutivo
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);

      const yStart = 37;
      // Recuadro Resumen
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(248, 248, 248);
      doc.rect(10, yStart, 190, 22, 'FD');

      doc.text(`Total Alumnos: ${resumen?.totalAlumnos || 0}`, 15, yStart + 6);
      doc.text(`Alumnos Cobrados: ${resumen?.cantidadPagados || 0} (${resumen?.porcentajeCobrado || 0}%)`, 15, yStart + 12);
      doc.text(`Alumnos Pendientes: ${resumen?.cantidadPendientes || 0}`, 15, yStart + 18);

      doc.text(`Total Estimado: ${formatCurrency(resumen?.totalEsperado || 0)}`, 110, yStart + 6);
      doc.setTextColor(0, 128, 0);
      doc.setFontSize(11);
      doc.text(`TOTAL RECAUDADO: ${formatCurrency(resumen?.totalRecaudado || 0)}`, 110, yStart + 14);

      // Tabla de alumnos
      const tableData = filteredAlumnos.map((al, idx) => [
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
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [26, 26, 26],
          textColor: [255, 204, 0],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [248, 248, 248],
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 42, fontStyle: 'bold' },
          2: { cellWidth: 32 },
          3: { cellWidth: 35 },
          4: { cellWidth: 20, halign: 'right' },
          5: { cellWidth: 23, halign: 'center' },
          6: { cellWidth: 18, halign: 'center' },
          7: { cellWidth: 12, halign: 'center' },
        },
      });

      // Pie de página oficial
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

      doc.save(`Reporte_Cuotas_Escuela_Tenis_${mesSeleccionado}.pdf`);

      toast({
        title: 'PDF emitido con éxito',
        description: 'Se descargó el reporte oficial para Comisión Directiva.',
      });
    } catch (err: any) {
      console.error('Error al generar PDF:', err);
      toast({
        title: 'Error al generar PDF',
        description: 'No se pudo generar el documento PDF.',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* 0. Selector General de Meses del Año con Resumen de Recaudación */}
      <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#242424]">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Vista General por Meses
            </h3>
            <span className="text-xs text-[#888888]">
              (Hacé clic en un mes para ver su detalle de alumnos y pagos)
            </span>
          </div>

          {/* Navegador de Año y Total Anual */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-[#121212] border border-[#2A2A2A] rounded-lg px-1 py-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCambiarAnio(-1)}
                className="h-6 w-6 p-0 text-[#888888] hover:text-white"
                title="Año anterior"
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs font-mono font-bold text-white px-2">
                {anioActual}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleCambiarAnio(1)}
                className="h-6 w-6 p-0 text-[#888888] hover:text-white"
                title="Año siguiente"
              >
                <ChevronRight size={14} />
              </Button>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
              <span className="text-[#888888] font-medium hidden sm:inline">Total {anioActual}:</span>
              <span className="font-mono font-bold text-emerald-400">
                ${totalAnualRecaudado.toLocaleString('es-AR')}
              </span>
            </div>
          </div>
        </div>

        {/* Carrusel / Grilla de 12 meses */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 pt-3">
          {MESES_NOMBRES.map((nombreMes, index) => {
            const numMesStr = String(index + 1).padStart(2, '0');
            const mesItemKey = `${anioActual}-${numMesStr}`;
            const esSeleccionado = mesSeleccionado === mesItemKey;
            
            const mesData = mesesAnio.find((m) => m.mes === mesItemKey) || {
              totalRecaudado: 0,
              cantidadPagados: 0,
            };

            const tieneRecaudacion = mesData.totalRecaudado > 0;

            return (
              <button
                key={mesItemKey}
                type="button"
                onClick={() => setMesSeleccionado(mesItemKey)}
                className={`relative flex flex-col items-center justify-between p-2 rounded-lg text-left transition-all cursor-pointer ${
                  esSeleccionado
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 ring-2 ring-amber-400 font-semibold'
                    : tieneRecaudacion
                    ? 'bg-[#1e1e1e] border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-[#252525] text-white'
                    : 'bg-[#141414] border border-[#262626] hover:border-[#383838] hover:bg-[#1a1a1a] text-[#888888]'
                }`}
              >
                {/* Nombre de mes */}
                <div className="flex items-center justify-between w-full">
                  <span className={`text-[11px] uppercase tracking-wider font-bold ${
                    esSeleccionado ? 'text-black' : tieneRecaudacion ? 'text-white' : 'text-[#888888]'
                  }`}>
                    {nombreMes.slice(0, 3)}
                  </span>
                  {mesData.cantidadPagados > 0 && (
                    <span className={`text-[9px] px-1 py-0.2 rounded font-mono font-bold ${
                      esSeleccionado
                        ? 'bg-black text-amber-300'
                        : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {mesData.cantidadPagados}
                    </span>
                  )}
                </div>

                {/* Total cobrado del mes */}
                <div className="w-full mt-1.5 pt-1 border-t border-black/10 dark:border-white/5">
                  <div className={`text-[10px] font-mono leading-tight ${
                    esSeleccionado
                      ? 'text-black font-extrabold'
                      : tieneRecaudacion
                      ? 'text-emerald-400 font-bold'
                      : 'text-[#555555]'
                  }`}>
                    {tieneRecaudacion ? `$${mesData.totalRecaudado.toLocaleString('es-AR')}` : '$0'}
                  </div>
                </div>

                {/* Indicador de mes actual */}
                {esSeleccionado && (
                  <div className="absolute -bottom-1 w-2 h-1 bg-amber-400 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 1. Barra de Filtros y Acciones del Mes Seleccionado */}
      <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Etiqueta del mes activo y Filtro por Grupo */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Badge de Mes Activo */}
          <div className="flex items-center gap-2 bg-[#121212] border border-amber-500/30 px-3 py-1 rounded-lg">
            <Calendar size={14} className="text-amber-400" />
            <span className="text-xs font-bold text-amber-400">
              {labelMesActual}
            </span>
          </div>

          {/* Filtro por Grupo */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={grupoFiltro === 'todos' ? 'default' : 'outline'}
              onClick={() => setGrupoFiltro('todos')}
              className={`text-xs h-7 px-2.5 ${grupoFiltro === 'todos' ? 'bg-primary text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA]'}`}
            >
              Todos
            </Button>
            <Button
              size="sm"
              variant={grupoFiltro === 'Escuelita' ? 'default' : 'outline'}
              onClick={() => setGrupoFiltro('Escuelita')}
              className={`text-xs h-7 px-2.5 ${grupoFiltro === 'Escuelita' ? 'bg-emerald-500 text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA]'}`}
            >
              Escuelita
            </Button>
            <Button
              size="sm"
              variant={grupoFiltro === 'Minitenis' ? 'default' : 'outline'}
              onClick={() => setGrupoFiltro('Minitenis')}
              className={`text-xs h-7 px-2.5 ${grupoFiltro === 'Minitenis' ? 'bg-sky-500 text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA]'}`}
            >
              Minitenis
            </Button>
            <Button
              size="sm"
              variant={grupoFiltro === 'Grupo Entrenamiento' ? 'default' : 'outline'}
              onClick={() => setGrupoFiltro('Grupo Entrenamiento')}
              className={`text-xs h-7 px-2.5 ${grupoFiltro === 'Grupo Entrenamiento' ? 'bg-amber-500 text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA]'}`}
            >
              Competencia
            </Button>
          </div>

          {/* Filtro de Estado: Todos / Cobrados / Pendientes */}
          <div className="flex items-center gap-1 pl-2 border-l border-[#2A2A2A]">
            <Button
              size="sm"
              variant={estadoFiltro === 'todos' ? 'secondary' : 'ghost'}
              onClick={() => setEstadoFiltro('todos')}
              className="text-xs h-7 px-2 text-[#AAAAAA]"
            >
              Todos
            </Button>
            <Button
              size="sm"
              variant={estadoFiltro === 'pagados' ? 'secondary' : 'ghost'}
              onClick={() => setEstadoFiltro('pagados')}
              className={`text-xs h-7 px-2 ${estadoFiltro === 'pagados' ? 'text-emerald-400 font-bold' : 'text-[#888888]'}`}
            >
              Cobrados ({resumen?.cantidadPagados || 0})
            </Button>
            <Button
              size="sm"
              variant={estadoFiltro === 'pendientes' ? 'secondary' : 'ghost'}
              onClick={() => setEstadoFiltro('pendientes')}
              className={`text-xs h-7 px-2 ${estadoFiltro === 'pendientes' ? 'text-amber-400 font-bold' : 'text-[#888888]'}`}
            >
              Pendientes ({resumen?.cantidadPendientes || 0})
            </Button>
          </div>
        </div>

        {/* Búsqueda y Botones de Exportar para Comisión Directiva */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
            <Input
              type="text"
              placeholder="Buscar alumno o tutor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-[#121212] border-[#2A2A2A] text-white"
            />
          </div>

          {!readOnly && (
            <Button
              size="sm"
              onClick={handleOpenMasivo}
              disabled={loading || alumnosPendientes.length === 0}
              className="h-8 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs gap-1.5 shadow-sm"
              title="Cobrar a múltiples o todos los alumnos de una sola vez"
            >
              <CheckCheck size={14} />
              <span>Cobro Masivo</span>
              {alumnosPendientes.length > 0 && (
                <span className="bg-black/20 text-black text-[10px] px-1.5 py-0.2 rounded-full font-extrabold">
                  {alumnosPendientes.length}
                </span>
              )}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={exportarAExcel}
            disabled={loading || filteredAlumnos.length === 0}
            className="h-8 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs gap-1.5 font-semibold"
            title="Exportar planilla Excel para Comisión Directiva"
          >
            <FileSpreadsheet size={14} />
            <span className="hidden sm:inline">Excel</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={exportarAPDF}
            disabled={loading || filteredAlumnos.length === 0}
            className="h-8 border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300 text-xs gap-1.5 font-semibold"
            title="Generar Reporte PDF Oficial para Comisión Directiva"
          >
            <FileDown size={14} />
            <span className="hidden sm:inline">PDF Oficial</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchPagos}
            disabled={loading}
            className="h-8 w-8 p-0 text-[#888888] hover:text-white"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      {/* 3. Lista de Alumnos y Carga de Pagos */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm text-[#888888]">Cargando estado de cuotas de {labelMesActual}...</p>
        </div>
      ) : filteredAlumnos.length === 0 ? (
        <Card className="bg-[#181818] border-[#2A2A2A]">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Users size={44} className="text-[#444444] mb-3" />
            <p className="text-sm font-semibold text-white">No se encontraron alumnos</p>
            <p className="text-xs text-[#888888] mt-1">
              Probá cambiando los filtros o el mes seleccionado.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#141414] text-[#888888] uppercase text-[10px] font-bold border-b border-[#2A2A2A]">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">#</th>
                  <th className="py-3 px-4">Alumno</th>
                  <th className="py-3 px-3">Grupo</th>
                  <th className="py-3 px-3">Responsable / Tel</th>
                  <th className="py-3 px-3 text-right">Valor Cuota</th>
                  <th className="py-3 px-3 text-center">Estado</th>
                  <th className="py-3 px-3">Detalle Cobro</th>
                  {!readOnly && <th className="py-3 px-4 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#242424]">
                {filteredAlumnos.map((alumno, idx) => {
                  const grp = GRUPO_CONFIG[alumno.grupo] || {
                    label: alumno.grupo,
                    icon: Users,
                    color: 'text-gray-400',
                    bg: 'bg-gray-500/10',
                    border: 'border-gray-500/20',
                  };
                  const GrpIcon = grp.icon;

                  return (
                    <tr
                      key={alumno.id}
                      className={`hover:bg-[#1C1C1C] transition-colors ${
                        alumno.pagado ? 'bg-emerald-500/[0.02]' : ''
                      }`}
                    >
                      {/* N° */}
                      <td className="py-3 px-3 text-center text-[#666666] font-mono">
                        {idx + 1}
                      </td>

                      {/* Alumno */}
                      <td className="py-3 px-4">
                        <span className="font-bold text-white text-sm block">
                          {alumno.nombre}
                        </span>
                        {alumno.edad && (
                          <span className="text-[10px] text-[#777777]">
                            {alumno.edad} años
                          </span>
                        )}
                      </td>

                      {/* Grupo */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold ${grp.color} ${grp.bg} ${grp.border}`}
                        >
                          <GrpIcon size={12} />
                          <span>{alumno.grupo === 'Grupo Entrenamiento' ? 'Competencia' : alumno.grupo}</span>
                        </span>
                      </td>

                      {/* Tutor / Teléfono */}
                      <td className="py-3 px-3">
                        <span className="text-[#CCCCCC] block">{alumno.tutor || '-'}</span>
                        {alumno.telefono && (
                          <span className="text-[10px] text-[#888888] font-mono block">
                            {alumno.telefono}
                          </span>
                        )}
                      </td>

                      {/* Valor Cuota */}
                      <td className="py-3 px-3 text-right font-mono font-bold text-white">
                        {formatCurrency(alumno.montoSugerido)}
                      </td>

                      {/* Estado */}
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {alumno.pagado ? (
                          <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold gap-1 px-2 py-0.5">
                            <Check size={12} />
                            <span>COBRADO</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 text-[11px] font-bold gap-1 px-2 py-0.5">
                            <Clock size={12} />
                            <span>PENDIENTE</span>
                          </Badge>
                        )}
                      </td>

                      {/* Detalle Cobro */}
                      <td className="py-3 px-3 text-[#AAAAAA]">
                        {alumno.pago ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-400 font-bold font-mono">
                                {formatCurrency(alumno.pago.monto)}
                              </span>
                              <span className="text-[10px] uppercase font-bold text-[#888888] px-1 py-0.2 rounded bg-[#242424]">
                                {alumno.pago.metodoPago}
                              </span>
                            </div>
                            <span className="text-[10px] text-[#777777]">
                              Fecha: {alumno.pago.fechaPago}
                              {alumno.pago.observaciones ? ` • ${alumno.pago.observaciones}` : ''}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[#555555] italic">-</span>
                        )}
                      </td>

                      {/* Botón de Acción */}
                      {!readOnly && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {alumno.pagado ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenCobro(alumno)}
                                className="h-7 text-xs border-[#333333] text-[#AAAAAA] hover:text-white"
                                title="Editar pago"
                              >
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setAlumnoParaAnular(alumno);
                                  setAnularModalOpen(true);
                                }}
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                                title="Anular cobro"
                              >
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleOpenCobro(alumno)}
                              className="h-7 bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs gap-1 shadow-sm"
                            >
                              <CheckCircle2 size={13} />
                              <span>Cobrar ${alumno.montoSugerido.toLocaleString('es-AR')}</span>
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Barra Compacta de Resumen (Abajo de todo) */}
      <div className="bg-[#141414] border border-[#262626] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {/* Recaudado */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#888888] font-bold uppercase tracking-wider">Recaudado:</span>
            <span className="font-extrabold text-emerald-400 font-mono text-sm">
              {formatCurrency(resumen?.totalRecaudado || 0)}
            </span>
            <span className="text-[10px] text-[#666666]">
              ({resumen?.cantidadPagados || 0} alumnos)
            </span>
          </div>

          <span className="text-[#333333] hidden sm:inline">•</span>

          {/* Estimado */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#888888] font-bold uppercase tracking-wider">Estimado:</span>
            <span className="font-bold text-white font-mono text-sm">
              {formatCurrency(resumen?.totalEsperado || 0)}
            </span>
          </div>

          <span className="text-[#333333] hidden sm:inline">•</span>

          {/* % Cobranza */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#888888] font-bold uppercase tracking-wider">Cobranza:</span>
            <span className="font-bold text-sky-400 font-mono text-xs">
              {resumen?.porcentajeCobrado || 0}%
            </span>
            <span className="text-[10px] text-[#666666]">
              ({resumen?.cantidadPagados || 0}/{resumen?.totalAlumnos || 0})
            </span>
          </div>

          <span className="text-[#333333] hidden sm:inline">•</span>

          {/* Pendientes */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#888888] font-bold uppercase tracking-wider">Pendientes:</span>
            <span className="font-bold text-amber-400 font-mono text-xs">
              {resumen?.cantidadPendientes || 0} alumnos
            </span>
            <span className="text-[10px] text-[#888888]">
              ({formatCurrency((resumen?.totalEsperado || 0) - (resumen?.totalRecaudado || 0))})
            </span>
          </div>
        </div>

        <div className="text-[11px] text-[#666666] font-mono">
          Período: <strong className="text-white">{labelMesActual}</strong>
        </div>
      </div>

      {/* MODAL PARA REGISTRAR O EDITAR COBRO */}
      <Dialog open={cobroModalOpen} onOpenChange={setCobroModalOpen}>
        <DialogContent className="bg-[#181818] border-[#2A2A2A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <DollarSign className="text-emerald-400 h-5 w-5" />
              <span>
                {alumnoParaCobro?.pagado ? 'Editar Cobro de Cuota' : 'Registrar Cobro de Cuota'}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888888]">
              {alumnoParaCobro?.nombre} · {alumnoParaCobro?.grupo} · Mes: {labelMesActual}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleGuardarCobro} className="space-y-4 pt-2">
            {/* Monto */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#AAAAAA]">Monto Cobrado ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400 font-bold">$</span>
                <Input
                  type="number"
                  step="500"
                  value={formMonto}
                  onChange={(e) => setFormMonto(e.target.value)}
                  className="pl-8 bg-[#121212] border-[#2A2A2A] text-white font-bold text-lg"
                  required
                />
              </div>
              <p className="text-[11px] text-[#777777]">
                Valor fijado por grupo: ${alumnoParaCobro?.montoSugerido.toLocaleString('es-AR')}
              </p>
            </div>

            {/* Fecha de Pago y Método de Pago */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#AAAAAA]">Fecha de Pago</Label>
                <Input
                  type="date"
                  value={formFechaPago}
                  onChange={(e) => setFormFechaPago(e.target.value)}
                  className="bg-[#121212] border-[#2A2A2A] text-white text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#AAAAAA]">Medio de Pago</Label>
                <Select value={formMetodoPago} onValueChange={setFormMetodoPago}>
                  <SelectTrigger className="bg-[#121212] border-[#2A2A2A] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#181818] border-[#2A2A2A] text-white">
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia / MP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Observaciones */}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#AAAAAA]">Observaciones (Opcional)</Label>
              <Input
                type="text"
                placeholder="Ej: Abonó mamá en cancha / Comprobante enviado"
                value={formObservaciones}
                onChange={(e) => setFormObservaciones(e.target.value)}
                className="bg-[#121212] border-[#2A2A2A] text-white text-xs"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCobroModalOpen(false)}
                className="border-[#2A2A2A] text-white hover:bg-white/5 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingCobro}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs gap-1.5"
              >
                {savingCobro && <Loader2 size={13} className="animate-spin" />}
                <span>Guardar Cobro</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL COBRO MASIVO */}
      <Dialog open={masivoModalOpen} onOpenChange={setMasivoModalOpen}>
        <DialogContent className="bg-[#181818] border-[#2A2A2A] text-white max-w-xl max-h-[90vh] flex flex-col p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCheck size={18} className="text-emerald-400" />
                <span>Cobro Masivo de Cuotas</span>
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                {labelMesActual}
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888888] pt-1">
              Seleccioná los alumnos que abonaron para registrar sus pagos simultáneamente con un solo clic.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEjecutarCobroMasivo} className="space-y-4 flex-1 overflow-hidden flex flex-col pt-2">
            {/* Filtros por Grupo dentro del Modal */}
            <div className="flex items-center justify-between gap-2 border-b border-[#2A2A2A] pb-3">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={masivoGrupoFiltro === 'todos' ? 'default' : 'outline'}
                  onClick={() => setMasivoGrupoFiltro('todos')}
                  className={`text-[11px] h-6 px-2 ${masivoGrupoFiltro === 'todos' ? 'bg-primary text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA]'}`}
                >
                  Todos ({alumnosPendientes.length})
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={masivoGrupoFiltro === 'Escuelita' ? 'default' : 'outline'}
                  onClick={() => setMasivoGrupoFiltro('Escuelita')}
                  className={`text-[11px] h-6 px-2 ${masivoGrupoFiltro === 'Escuelita' ? 'bg-emerald-500 text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA]'}`}
                >
                  Escuelita
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={masivoGrupoFiltro === 'Minitenis' ? 'default' : 'outline'}
                  onClick={() => setMasivoGrupoFiltro('Minitenis')}
                  className={`text-[11px] h-6 px-2 ${masivoGrupoFiltro === 'Minitenis' ? 'bg-sky-500 text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA]'}`}
                >
                  Minitenis
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={masivoGrupoFiltro === 'Grupo Entrenamiento' ? 'default' : 'outline'}
                  onClick={() => setMasivoGrupoFiltro('Grupo Entrenamiento')}
                  className={`text-[11px] h-6 px-2 ${masivoGrupoFiltro === 'Grupo Entrenamiento' ? 'bg-amber-500 text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA]'}`}
                >
                  Competencia
                </Button>
              </div>

              {/* Botones Seleccionar Todos / Deseleccionar */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={selectAllPendientesEnModal}
                  className="text-[11px] h-6 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                >
                  Marcar todos
                </Button>
                <span className="text-[#444444] text-xs">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={deselectAllPendientesEnModal}
                  className="text-[11px] h-6 px-2 text-[#888888] hover:text-white"
                >
                  Desmarcar
                </Button>
              </div>
            </div>

            {/* Lista scrollable de alumnos pendientes con checkboxes */}
            <div className="flex-1 overflow-y-auto max-h-56 pr-1 space-y-1.5 divide-y divide-[#222222]">
              {alumnosPendientesEnModal.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#666666]">
                  No hay alumnos pendientes de pago en este grupo para {labelMesActual}.
                </div>
              ) : (
                alumnosPendientesEnModal.map((al) => {
                  const isChecked = selectedAlumnoIds.includes(al.id);
                  const conf = GRUPO_CONFIG[al.grupo] || {
                    color: 'text-zinc-400',
                    bg: 'bg-zinc-500/10',
                    border: 'border-zinc-500/20',
                  };

                  return (
                    <label
                      key={al.id}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors pt-2 ${
                        isChecked ? 'bg-[#1e1e1e] border border-emerald-500/30' : 'hover:bg-white/[0.02] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectAlumno(al.id)}
                          className="w-4 h-4 rounded border-[#3A3A3A] text-emerald-500 focus:ring-emerald-500 bg-[#121212] cursor-pointer"
                        />
                        <div>
                          <div className="text-xs font-semibold text-white">{al.nombre}</div>
                          <div className="text-[10px] text-[#888888] flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] border font-medium ${conf.bg} ${conf.color} ${conf.border}`}>
                              {al.grupo === 'Grupo Entrenamiento' ? 'Entrenamiento' : al.grupo}
                            </span>
                            {al.tutor && <span>• Resp: {al.tutor}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-white">
                          ${al.montoSugerido.toLocaleString('es-AR')}
                        </div>
                        <div className="text-[10px] text-[#888888]">cuota</div>
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            {/* Datos compartidos del cobro: Fecha, Medio de Pago y Observaciones */}
            <div className="bg-[#121212] border border-[#2A2A2A] rounded-xl p-3 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-[#AAAAAA]">Fecha de Cobro</Label>
                  <Input
                    type="date"
                    value={masivoFechaPago}
                    onChange={(e) => setMasivoFechaPago(e.target.value)}
                    required
                    className="bg-[#181818] border-[#2A2A2A] text-white text-xs h-8"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-[#AAAAAA]">Medio de Pago</Label>
                  <Select value={masivoMetodoPago} onValueChange={setMasivoMetodoPago}>
                    <SelectTrigger className="bg-[#181818] border-[#2A2A2A] text-white text-xs h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#181818] border-[#2A2A2A] text-white">
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-[#AAAAAA]">Nota / Observación general (Opcional)</Label>
                <Input
                  type="text"
                  placeholder="Ej: Cobro en cancha clase sábado"
                  value={masivoObservaciones}
                  onChange={(e) => setMasivoObservaciones(e.target.value)}
                  className="bg-[#181818] border-[#2A2A2A] text-white text-xs h-8"
                />
              </div>
            </div>

            {/* Resumen del cobro a realizar */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
              <div>
                <div className="text-xs text-emerald-300 font-medium">Alumnos seleccionados:</div>
                <div className="text-sm font-bold text-white">
                  {selectedAlumnoIds.length} de {alumnosPendientes.length} pendientes
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-emerald-300 font-medium">Total a registrar:</div>
                <div className="text-base font-black text-emerald-400 font-mono">
                  ${totalMontoMasivoSeleccionado.toLocaleString('es-AR')}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMasivoModalOpen(false)}
                className="border-[#2A2A2A] text-white hover:bg-white/5 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={savingMasivo || selectedAlumnoIds.length === 0}
                className="bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-xs gap-1.5 shadow-md"
              >
                {savingMasivo && <Loader2 size={13} className="animate-spin" />}
                <span>Registrar Cobro Masivo ({selectedAlumnoIds.length})</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL CONFIRMAR ANULAR COBRO */}
      <Dialog open={anularModalOpen} onOpenChange={setAnularModalOpen}>
        <DialogContent className="bg-[#181818] border-[#2A2A2A] text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-red-400 flex items-center gap-2">
              <Trash2 size={16} />
              <span>¿Anular cobro de cuota?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888888] leading-relaxed pt-1">
              Se eliminará el pago de ${alumnoParaAnular?.pago?.monto.toLocaleString('es-AR')} registrado a nombre de{' '}
              <strong className="text-white">{alumnoParaAnular?.nombre}</strong> para el mes {labelMesActual}. El alumno volverá a figurar como pendiente.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAnularModalOpen(false)}
              className="border-[#2A2A2A] text-white hover:bg-white/5 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmarAnular}
              disabled={anulando}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5"
            >
              {anulando && <Loader2 size={13} className="animate-spin" />}
              <span>Confirmar Anulación</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

