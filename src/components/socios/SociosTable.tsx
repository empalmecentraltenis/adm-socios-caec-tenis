'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  DollarSign,
  History,
  Users,
  Phone,
  Mail,
  UserCheck,
  Loader2,
  MessageCircle,
  AlertTriangle,
  FileDown,
  CheckCircle2,
  UserX,
  Sparkles,
  ShieldAlert,
  ArrowUpDown,
  ExternalLink,
  GraduationCap,
  Crown,
  Tag,
  Filter,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Socio {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  telefono: string;
  fechaAlta: string;
  estado: string;
  categoria: string;
  rol?: string;
  alDia: boolean;
  mesesAdeudados: number;
  totalPagado: number;
  deudaEstimada: number;
  valorCuota: number;
  pagos: Array<{ id: string; mesPagado: string; monto: number; metodoPago: string }>;
}

type SortField = 'apellido' | 'nombre' | 'dni' | 'estado' | 'categoria' | 'email';
type SortDir = 'asc' | 'desc';

interface SociosTableProps {
  onRegistrarPago: (socio: { id: string; nombre: string; apellido: string }) => void;
  onEditarSocio: (socio: Socio) => void;
  onCrearSocio: () => void;
  onVerHistorial: (socio: { id: string; nombre: string; apellido: string; categoria: string }) => void;
  onPagoMasivo: () => void;
  refreshKey: number;
  socios: Socio[];
  readOnly?: boolean;
  hideABM?: boolean;
}

function getCategoriaBadge(categoria: string) {
  switch (categoria) {
    case 'socio':
      return {
        classes: 'bg-[#FFCC00]/15 text-[#FFCC00] border-[#FFCC00]/30',
        label: 'Socio',
        icon: Tag,
      };
    case 'alumno':
      return {
        classes: 'bg-blue-400/15 text-blue-300 border-blue-400/30',
        label: 'Alumno',
        icon: GraduationCap,
      };
    case 'vitalicio':
      return {
        classes: 'bg-emerald-400/15 text-emerald-300 border-emerald-400/30',
        label: 'Vitalicio',
        icon: Crown,
      };
    case 'becado':
      return {
        classes: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        label: 'Becado',
        icon: Sparkles,
      };
    default:
      return {
        classes: 'bg-zinc-700/30 text-zinc-300 border-zinc-600/30',
        label: categoria.charAt(0).toUpperCase() + categoria.slice(1),
        icon: Tag,
      };
  }
}

export default function SociosTable({
  onRegistrarPago,
  onEditarSocio,
  onCrearSocio,
  onVerHistorial,
  onPagoMasivo,
  refreshKey,
  socios,
  readOnly = false,
  hideABM = false,
}: SociosTableProps) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('apellido');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterCategoria, setFilterCategoria] = useState('todos');
  const [filterEstado, setFilterEstado] = useState('todos'); // 'todos' | 'al_dia' | 'al_dia_pagado' | 'al_dia_deuda' | 'morosos'
  const [filterActivo, setFilterActivo] = useState('activo'); // Por defecto ver socios activos
  const [deleteTarget, setDeleteTarget] = useState<Socio | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');
  const [reactivateTarget, setReactivateTarget] = useState<Socio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(false);
  }, [socios, refreshKey]);

  // Contadores globales
  const activosCount = useMemo(() => socios.filter((s) => s.estado === 'activo').length, [socios]);
  const inactivosCount = useMemo(() => socios.filter((s) => s.estado === 'inactivo').length, [socios]);
  const alDiaCount = useMemo(() => socios.filter((s) => s.estado === 'activo' && (s.alDia || s.categoria === 'vitalicio' || s.categoria === 'becado')).length, [socios]);
  const deudoresCount = useMemo(() => socios.filter((s) => s.estado === 'activo' && s.mesesAdeudados >= 4 && s.categoria !== 'becado' && s.categoria !== 'vitalicio').length, [socios]);
  const becadosCount = useMemo(() => socios.filter((s) => s.estado === 'activo' && s.categoria === 'becado').length, [socios]);
  const alumnosCount = useMemo(() => socios.filter((s) => s.estado === 'activo' && s.categoria === 'alumno').length, [socios]);
  const vitaliciosCount = useMemo(() => socios.filter((s) => s.estado === 'activo' && s.categoria === 'vitalicio').length, [socios]);

  // Filtrado y ordenamiento
  const filteredSocios = useMemo(() => {
    let result = socios;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.nombre.toLowerCase().includes(q) ||
          s.apellido.toLowerCase().includes(q) ||
          s.dni.includes(q) ||
          (s.email && s.email.toLowerCase().includes(q)) ||
          (s.telefono && s.telefono.includes(q))
      );
    }

    if (filterCategoria && filterCategoria !== 'todos') {
      result = result.filter((s) => s.categoria === filterCategoria);
    }

    if (filterActivo && filterActivo !== 'todos') {
      result = result.filter((s) => s.estado === filterActivo);
    }

    if (filterEstado === 'morosos') {
      result = result.filter((s) => s.mesesAdeudados >= 4 && s.categoria !== 'becado' && s.categoria !== 'vitalicio');
    } else if (filterEstado === 'al_dia') {
      result = result.filter((s) => s.alDia || s.categoria === 'vitalicio' || s.categoria === 'becado');
    } else if (filterEstado === 'al_dia_pagado') {
      result = result.filter((s) => s.mesesAdeudados === 0 || s.categoria === 'vitalicio' || s.categoria === 'becado' || s.rol === 'admin');
    } else if (filterEstado === 'al_dia_deuda') {
      result = result.filter((s) => s.alDia && s.mesesAdeudados > 0 && s.categoria !== 'vitalicio' && s.categoria !== 'becado' && s.rol !== 'admin');
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'apellido':
          cmp = a.apellido.localeCompare(b.apellido);
          if (cmp === 0) cmp = a.nombre.localeCompare(b.nombre);
          break;
        case 'nombre':
          cmp = a.nombre.localeCompare(b.nombre);
          if (cmp === 0) cmp = a.apellido.localeCompare(b.apellido);
          break;
        case 'dni':
          cmp = a.dni.localeCompare(b.dni);
          break;
        case 'email':
          cmp = (a.email || '').localeCompare(b.email || '');
          break;
        case 'estado':
          cmp = (a.alDia ? 0 : 1) - (b.alDia ? 0 : 1);
          if (cmp === 0) cmp = a.mesesAdeudados - b.mesesAdeudados;
          break;
        case 'categoria':
          cmp = a.categoria.localeCompare(b.categoria);
          if (cmp === 0) cmp = a.apellido.localeCompare(b.apellido);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [socios, search, sortField, sortDir, filterCategoria, filterEstado, filterActivo]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-30" />;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 inline ml-1 text-[#FFCC00]" />
      : <ChevronDown className="h-3 w-3 inline ml-1 text-[#FFCC00]" />;
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const url = `/api/socios?id=${deleteTarget.id}&hard=${deleteType === 'hard'}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (res.ok) {
        toast({
          title: deleteType === 'hard' ? 'Socio eliminado' : 'Socio dado de baja',
          description: deleteType === 'hard'
            ? `${deleteTarget.nombre} ${deleteTarget.apellido} fue eliminado definitivamente.`
            : `${deleteTarget.nombre} ${deleteTarget.apellido} pasó a estado inactivo.`,
        });
        window.location.reload();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo realizar la operación.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setDeleteType('soft');
    }
  }

  async function handleReactivate() {
    if (!reactivateTarget) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/socios', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reactivateTarget,
          estado: 'activo',
        }),
      });
      if (res.ok) {
        toast({
          title: 'Socio reactivado',
          description: `${reactivateTarget.nombre} ${reactivateTarget.apellido} volvió a estar activo.`,
        });
        window.location.reload();
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo reactivar al socio.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setReactivateTarget(null);
    }
  }

  function handleWhatsApp(socio: Socio) {
    const rawPhone = socio.telefono?.replace(/[^\d]/g, '');
    if (!rawPhone) {
      toast({
        title: 'Sin teléfono',
        description: `${socio.nombre} ${socio.apellido} no tiene teléfono registrado.`,
        variant: 'destructive',
      });
      return;
    }
    const cleanPhone = rawPhone.startsWith('0') ? rawPhone.slice(1) : rawPhone;
    const finalPhone = cleanPhone.startsWith('54') ? cleanPhone : `54${cleanPhone}`;
    const deuda = socio.deudaEstimada;
    const meses = socio.mesesAdeudados;
    
    let text = `Hola ${socio.nombre} 👋 Te escribimos desde la Subcomisión de Tenis del Club Atlético Empalme Central (CAEC).`;
    if (meses > 0 && socio.categoria !== 'vitalicio' && socio.categoria !== 'becado') {
      text += `\n\nTe recordamos que registrás ${meses} cuota${meses > 1 ? 's' : ''} pendiente${meses > 1 ? 's' : ''} por un total de $${deuda.toLocaleString('es-AR')}.\n\nPodés regularizar tu situación en secretaría o por transferencia. ¡Muchas gracias! 🎾`;
    } else {
      text += `\n\nNos comunicamos por consultas sobre tus turnos y actividades en el club. ¡Quedamos a tu disposición! 🎾`;
    }

    window.open(`https://wa.me/${finalPhone}?text=${encodeURIComponent(text)}`, '_blank');
  }

  const handleExportExcel = async (filterType: 'todos' | 'activos' | 'inactivos' | 'morosos' | 'al_dia' | 'becados') => {
    setExporting(true);
    try {
      let dataToExport: Socio[] = [];
      let label = '';

      switch (filterType) {
        case 'todos':
          dataToExport = socios;
          label = 'Completa';
          break;
        case 'activos':
          dataToExport = socios.filter((s) => s.estado === 'activo');
          label = 'Activos';
          break;
        case 'inactivos':
          dataToExport = socios.filter((s) => s.estado === 'inactivo');
          label = 'Inactivos';
          break;
        case 'morosos':
          dataToExport = socios.filter((s) => s.mesesAdeudados >= 4 && s.categoria !== 'becado' && s.categoria !== 'vitalicio');
          label = 'Morosos';
          break;
        case 'al_dia':
          dataToExport = socios.filter((s) => s.alDia || s.categoria === 'vitalicio' || s.categoria === 'becado');
          label = 'Al_Dia';
          break;
        case 'becados':
          dataToExport = socios.filter((s) => s.categoria === 'becado');
          label = 'Becados';
          break;
      }

      if (dataToExport.length === 0) {
        toast({
          title: 'Sin datos',
          description: `No hay socios en la selección "${label}" para exportar.`,
          variant: 'destructive',
        });
        return;
      }

      const allData = dataToExport.map((s) => ({
        Apellido: s.apellido,
        Nombre: s.nombre,
        DNI: s.dni,
        Email: s.email || 'N/A',
        Teléfono: s.telefono || 'N/A',
        Categoría: s.categoria.charAt(0).toUpperCase() + s.categoria.slice(1),
        Rol: s.rol === 'admin' ? 'Administrador' : s.rol === 'profesor' ? 'Profesor' : 'Socio',
        Estado: s.estado === 'activo' ? 'Activo' : 'Inactivo',
        'Al Día': s.alDia || s.categoria === 'vitalicio' || s.categoria === 'becado' ? 'Sí' : 'No',
        'Meses Adeudados': s.categoria === 'vitalicio' || s.categoria === 'becado' ? 0 : s.mesesAdeudados,
        'Deuda Estimada': s.categoria === 'vitalicio' || s.categoria === 'becado' ? 0 : s.deudaEstimada,
        'Total Pagado': s.totalPagado,
        'Fecha Alta': s.fechaAlta ? new Date(s.fechaAlta).toLocaleDateString('es-AR') : 'N/A',
      }));

      const worksheet = XLSX.utils.json_to_sheet(allData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Socios');

      XLSX.writeFile(workbook, `Lista_Socios_CAEC_${label}_${new Date().toISOString().split('T')[0]}.xlsx`);

      toast({
        title: 'Exportación exitosa',
        description: `Se exportaron ${dataToExport.length} socios (${label}).`,
      });
    } catch (error) {
      console.error('Error exportando:', error);
      toast({
        title: 'Error',
        description: 'No se pudo realizar la exportación.',
        variant: 'destructive',
      });
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-6 space-y-4">
        <Skeleton className="h-8 w-64 bg-[#242424]" />
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-[#242424] rounded-xl" />
        ))}
      </div>
    );
  }

  // Porcentaje al día
  const porcentajeAlDia = activosCount > 0 ? Math.round((alDiaCount / activosCount) * 100) : 100;

  return (
    <div className="space-y-4">
      {/* 1. TARJETAS DE TOTALES Y SEGMENTACIÓN INTERACTIVA (KPIs PRO) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Activos */}
        <div
          onClick={() => {
            setFilterActivo('activo');
            setFilterEstado('todos');
            setFilterCategoria('todos');
          }}
          className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 relative overflow-hidden group ${
            filterActivo === 'activo' && filterEstado === 'todos' && filterCategoria === 'todos'
              ? 'bg-[#1e1e1e] border-[#FFCC00]/50 shadow-lg shadow-[#FFCC00]/5 ring-1 ring-[#FFCC00]/30'
              : 'bg-[#181818] border-[#2a2a2a] hover:border-[#383838]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-[#FFCC00]/10 text-[#FFCC00] group-hover:scale-105 transition-transform">
              <Users className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-full">
              {socios.length} total
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-white tracking-tight">
              {activosCount.toLocaleString('es-AR')}
            </p>
            <p className="text-xs font-semibold text-zinc-400 mt-0.5 flex items-center justify-between">
              <span>Socios Activos</span>
              {inactivosCount > 0 && <span className="text-[10px] text-zinc-500">({inactivosCount} bajas)</span>}
            </p>
          </div>
        </div>

        {/* Al Día */}
        <div
          onClick={() => {
            setFilterActivo('activo');
            setFilterEstado('al_dia');
            setFilterCategoria('todos');
          }}
          className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 relative overflow-hidden group ${
            filterEstado === 'al_dia' && filterCategoria === 'todos'
              ? 'bg-[#1e1e1e] border-emerald-500/50 shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30'
              : 'bg-[#181818] border-[#2a2a2a] hover:border-[#383838]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {porcentajeAlDia}% padrón
            </span>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-400 tracking-tight">
              {alDiaCount.toLocaleString('es-AR')}
            </p>
            <p className="text-xs font-semibold text-zinc-400 mt-0.5">
              Al Día (Habilitados)
            </p>
          </div>
        </div>

        {/* Morosos Críticos */}
        <div
          onClick={() => {
            setFilterActivo('activo');
            setFilterEstado('morosos');
            setFilterCategoria('todos');
          }}
          className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 relative overflow-hidden group ${
            filterEstado === 'morosos'
              ? 'bg-[#1e1e1e] border-rose-500/50 shadow-lg shadow-rose-500/5 ring-1 ring-rose-500/30'
              : 'bg-[#181818] border-[#2a2a2a] hover:border-[#383838]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-105 transition-transform">
              <ShieldAlert className="h-5 w-5" />
            </div>
            {deudoresCount > 0 ? (
              <span className="text-[10px] font-bold text-rose-300 bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30">
                Inhabilitados
              </span>
            ) : (
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                0 deuda
              </span>
            )}
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-400 tracking-tight">
              {deudoresCount.toLocaleString('es-AR')}
            </p>
            <p className="text-xs font-semibold text-zinc-400 mt-0.5">
              Morosos (≥ 4 meses)
            </p>
          </div>
        </div>

        {/* Alumnos & Becados */}
        <div
          onClick={() => {
            setFilterActivo('activo');
            setFilterEstado('todos');
            setFilterCategoria(filterCategoria === 'becado' ? 'todos' : 'becado');
          }}
          className={`cursor-pointer rounded-2xl p-4 border transition-all duration-200 relative overflow-hidden group ${
            filterCategoria === 'becado'
              ? 'bg-[#1e1e1e] border-purple-500/50 shadow-lg shadow-purple-500/5 ring-1 ring-purple-500/30'
              : 'bg-[#181818] border-[#2a2a2a] hover:border-[#383838]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
              Escuelita
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black text-purple-300 tracking-tight">
                {becadosCount}
              </p>
              <span className="text-xs text-zinc-400">becados</span>
            </div>
            <p className="text-xs font-semibold text-zinc-400 mt-0.5">
              {alumnosCount} alumnos · {vitaliciosCount} vitalicios
            </p>
          </div>
        </div>
      </div>

      {/* 2. PANEL PRINCIPAL: BARRA DE BÚSQUEDA, FILTROS Y ACCIONES */}
      <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-4 md:p-5 shadow-sm space-y-4">
        {/* Barra superior de acciones y filtros */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Buscador grande con icono interactivo */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="Buscar socio por nombre, apellido, DNI o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-9 bg-[#202020] border-[#303030] text-white placeholder:text-zinc-500 h-10 text-xs md:text-sm rounded-xl focus:border-[#FFCC00]/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Botones de acción principales */}
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {deudoresCount > 0 && !readOnly && (
              <Button
                size="sm"
                variant="outline"
                onClick={onPagoMasivo}
                className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs h-9 px-3 rounded-xl font-semibold"
              >
                <Users className="h-4 w-4 mr-1.5 text-amber-400" />
                Pago Masivo ({deudoresCount})
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={exporting}
                  className="border-[#333333] bg-[#202020] text-zinc-300 hover:bg-[#282828] text-xs h-9 px-3 rounded-xl font-medium"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin text-zinc-400" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-1.5 text-zinc-400" />
                  )}
                  Exportar Excel
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-[#1e1e1e] border-[#333333] text-zinc-200 rounded-xl shadow-xl p-1.5 min-w-[200px]">
                <DropdownMenuItem onClick={() => handleExportExcel('todos')} className="focus:bg-[#2a2a2a] cursor-pointer text-xs py-2 rounded-lg">
                  Todos los socios ({socios.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportExcel('activos')} className="focus:bg-[#2a2a2a] cursor-pointer text-xs py-2 rounded-lg">
                  Solo Activos ({activosCount})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportExcel('al_dia')} className="focus:bg-[#2a2a2a] cursor-pointer text-xs py-2 rounded-lg text-emerald-400">
                  Al Día ({alDiaCount})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportExcel('morosos')} className="focus:bg-[#2a2a2a] cursor-pointer text-xs py-2 rounded-lg text-rose-400">
                  Morosos ({deudoresCount})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportExcel('becados')} className="focus:bg-[#2a2a2a] cursor-pointer text-xs py-2 rounded-lg text-purple-400">
                  Becados Escuela ({becadosCount})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportExcel('inactivos')} className="focus:bg-[#2a2a2a] cursor-pointer text-xs py-2 rounded-lg text-zinc-400">
                  Bajas / Inactivos ({inactivosCount})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!readOnly && !hideABM && (
              <Button
                size="sm"
                onClick={onCrearSocio}
                className="bg-[#FFCC00] text-black hover:bg-[#e6b800] font-bold text-xs h-9 px-3.5 rounded-xl shadow-md shadow-[#FFCC00]/10"
              >
                <Plus className="h-4 w-4 mr-1.5 stroke-[2.5]" />
                Nuevo Socio
              </Button>
            )}
          </div>
        </div>

        {/* Filtros en Píldoras Rápidas (Chips) */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-[#252525]">
          <span className="text-[11px] font-semibold text-zinc-500 mr-1 flex items-center gap-1">
            <Filter size={12} /> Filtros:
          </span>

          {/* Chips de Estado */}
          <button
            onClick={() => setFilterEstado('todos')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
              filterEstado === 'todos' && filterCategoria === 'todos'
                ? 'bg-zinc-200 text-black font-semibold'
                : 'bg-[#222] text-zinc-400 hover:text-white'
            }`}
          >
            Todos ({filteredSocios.length})
          </button>

          <button
            onClick={() => setFilterEstado('al_dia')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              filterEstado === 'al_dia'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                : 'bg-[#222] text-zinc-400 hover:text-emerald-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Al Día
          </button>

          <button
            onClick={() => setFilterEstado('al_dia_deuda')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              filterEstado === 'al_dia_deuda'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                : 'bg-[#222] text-zinc-400 hover:text-amber-300'
            }`}
            title="Socio habilitado pero adeuda el mes en curso"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            Debe mes curso
          </button>

          <button
            onClick={() => setFilterEstado('morosos')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
              filterEstado === 'morosos'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold'
                : 'bg-[#222] text-zinc-400 hover:text-rose-300'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            Morosos (≥ 4m)
          </button>

          <div className="h-4 w-[1px] bg-zinc-800 mx-1 hidden sm:block" />

          {/* Select de Categoría */}
          <Select value={filterCategoria} onValueChange={setFilterCategoria}>
            <SelectTrigger className="w-[130px] bg-[#222] border-[#303030] text-zinc-300 h-7 text-xs rounded-lg">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1e1e] border-[#333] text-zinc-300">
              <SelectItem value="todos">Todas las categorías</SelectItem>
              <SelectItem value="socio">🏷️ Socio</SelectItem>
              <SelectItem value="alumno">🎓 Alumno</SelectItem>
              <SelectItem value="vitalicio">👑 Vitalicio</SelectItem>
              <SelectItem value="becado">🌟 Becado (Escuela)</SelectItem>
            </SelectContent>
          </Select>

          {/* Select de Situación (Activo / Inactivo) */}
          <Select value={filterActivo} onValueChange={setFilterActivo}>
            <SelectTrigger className="w-[110px] bg-[#222] border-[#303030] text-zinc-300 h-7 text-xs rounded-lg">
              <SelectValue placeholder="Situación" />
            </SelectTrigger>
            <SelectContent className="bg-[#1e1e1e] border-[#333] text-zinc-300">
              <SelectItem value="activo">Solo Activos</SelectItem>
              <SelectItem value="inactivo">Solo Bajas</SelectItem>
              <SelectItem value="todos">Todos los registros</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 3. TABLA DESKTOP MODERNA */}
        <div className="hidden lg:block overflow-x-auto rounded-xl border border-[#262626]">
          <Table>
            <TableHeader className="bg-[#1c1c1c]">
              <TableRow className="border-[#282828] hover:bg-transparent">
                <TableHead
                  className="cursor-pointer text-zinc-400 hover:text-white text-xs font-bold py-3.5"
                  onClick={() => toggleSort('apellido')}
                >
                  Socio / Datos <SortIcon field="apellido" />
                </TableHead>
                <TableHead
                  className="cursor-pointer text-zinc-400 hover:text-white text-xs font-bold py-3.5"
                  onClick={() => toggleSort('categoria')}
                >
                  Categoría <SortIcon field="categoria" />
                </TableHead>
                <TableHead
                  className="cursor-pointer text-zinc-400 hover:text-white text-xs font-bold py-3.5"
                  onClick={() => toggleSort('dni')}
                >
                  DNI <SortIcon field="dni" />
                </TableHead>
                <TableHead className="text-zinc-400 text-xs font-bold py-3.5">
                  Contacto (WhatsApp / Email)
                </TableHead>
                <TableHead
                  className="cursor-pointer text-zinc-400 hover:text-white text-xs font-bold text-center py-3.5"
                  onClick={() => toggleSort('estado')}
                >
                  Estado de Cuenta <SortIcon field="estado" />
                </TableHead>
                <TableHead className="text-right text-zinc-400 text-xs font-bold py-3.5 pr-4">
                  Acciones
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSocios.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users className="h-8 w-8 text-zinc-600" />
                      <p className="text-sm font-medium">No se encontraron socios con los filtros actuales.</p>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSearch('');
                          setFilterCategoria('todos');
                          setFilterEstado('todos');
                          setFilterActivo('activo');
                        }}
                        className="text-xs text-[#FFCC00] hover:bg-[#FFCC00]/10 mt-1"
                      >
                        Limpiar filtros
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSocios.map((socio) => {
                  const catBadge = getCategoriaBadge(socio.categoria);
                  const CatIcon = catBadge.icon;
                  const isExempt = socio.categoria === 'vitalicio' || socio.categoria === 'becado';

                  return (
                    <TableRow
                      key={socio.id}
                      className="border-[#222] hover:bg-[#1f1f1f]/80 transition-colors group"
                    >
                      {/* Socio / Avatar */}
                      <TableCell className="py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase border ${
                            socio.categoria === 'becado'
                              ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                              : socio.categoria === 'vitalicio'
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                              : socio.categoria === 'alumno'
                              ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                              : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                          }`}>
                            {socio.apellido.charAt(0)}{socio.nombre.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-sm">
                                {socio.apellido}, {socio.nombre}
                              </span>
                              {socio.rol === 'admin' && (
                                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30 px-1 py-0 h-4">
                                  Admin
                                </Badge>
                              )}
                              {socio.rol === 'profesor' && (
                                <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-300 border-amber-500/30 px-1 py-0 h-4">
                                  Profesor
                                </Badge>
                              )}
                              {socio.estado === 'inactivo' && (
                                <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[9px] px-1 py-0 h-4">
                                  Inactivo
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-zinc-500 block">
                              Alta: {socio.fechaAlta ? new Date(socio.fechaAlta).toLocaleDateString('es-AR') : 'S/D'}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Categoría */}
                      <TableCell className="py-3">
                        <Badge variant="outline" className={`text-[11px] font-semibold px-2 py-0.5 gap-1 inline-flex items-center ${catBadge.classes}`}>
                          <CatIcon size={12} />
                          <span>{catBadge.label}</span>
                        </Badge>
                      </TableCell>

                      {/* DNI */}
                      <TableCell className="py-3">
                        <span className="font-mono text-xs text-zinc-300 font-medium">
                          {socio.dni}
                        </span>
                      </TableCell>

                      {/* Contacto / WhatsApp */}
                      <TableCell className="py-3">
                        <div className="space-y-1">
                          {socio.telefono ? (
                            <button
                              type="button"
                              onClick={() => handleWhatsApp(socio)}
                              className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 hover:underline font-medium"
                              title="Enviar mensaje por WhatsApp"
                            >
                              <MessageCircle size={13} className="text-emerald-400" />
                              <span>{socio.telefono}</span>
                            </button>
                          ) : (
                            <span className="text-zinc-600 text-xs">Sin teléfono</span>
                          )}
                          {socio.email && (
                            <span className="text-[11px] text-zinc-400 block truncate max-w-[170px]" title={socio.email}>
                              {socio.email}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Estado de cuenta */}
                      <TableCell className="text-center py-3">
                        {isExempt ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-bold">
                              <CheckCircle2 size={12} /> Exento cuota
                            </span>
                            <span className="text-[10px] text-zinc-500 mt-0.5">Siempre al día</span>
                          </div>
                        ) : socio.alDia ? (
                          socio.mesesAdeudados > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                                🟡 Al día
                              </span>
                              <span className="text-[10px] text-amber-400/80 mt-0.5">Debe mes curso</span>
                            </div>
                          ) : (
                            <div className="inline-flex flex-col items-center">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                                🟢 Al día
                              </span>
                              <span className="text-[10px] text-emerald-500/80 mt-0.5">Sin deuda</span>
                            </div>
                          )
                        ) : socio.mesesAdeudados >= 4 ? (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-extrabold">
                              🔴 {socio.mesesAdeudados} meses
                            </span>
                            <span className="text-[10px] text-rose-400 font-bold mt-0.5">
                              Inhabilitado (${socio.deudaEstimada.toLocaleString('es-AR')})
                            </span>
                          </div>
                        ) : (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-bold">
                              🟡 {socio.mesesAdeudados} meses
                            </span>
                            <span className="text-[10px] text-amber-400 mt-0.5">
                              ${socio.deudaEstimada.toLocaleString('es-AR')}
                            </span>
                          </div>
                        )}
                      </TableCell>

                      {/* Acciones */}
                      <TableCell className="py-3 text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          {/* Historial */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onVerHistorial({ id: socio.id, nombre: socio.nombre, apellido: socio.apellido, categoria: socio.categoria })}
                            className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
                            title="Ver historial de pagos"
                          >
                            <History size={15} />
                          </Button>

                          {/* Cobrar */}
                          {!readOnly && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => onRegistrarPago({ id: socio.id, nombre: socio.nombre, apellido: socio.apellido })}
                              className="h-8 px-2.5 text-xs text-[#FFCC00] hover:text-black hover:bg-[#FFCC00] font-bold rounded-lg transition-colors gap-1"
                              title="Registrar cobro de cuota"
                            >
                              <DollarSign size={14} className="stroke-[2.5]" />
                              <span>Cobrar</span>
                            </Button>
                          )}

                          {/* WhatsApp directo */}
                          {socio.telefono && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleWhatsApp(socio)}
                              className="h-8 w-8 p-0 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg"
                              title="Enviar WhatsApp"
                            >
                              <MessageCircle size={15} />
                            </Button>
                          )}

                          {/* Edición y baja */}
                          {!readOnly && !hideABM && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onEditarSocio(socio)}
                                className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
                                title="Editar datos del socio"
                              >
                                <Pencil size={15} />
                              </Button>

                              {socio.estado === 'inactivo' ? (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setReactivateTarget(socio)}
                                  className="h-8 w-8 p-0 text-emerald-400 hover:bg-emerald-500/10 rounded-lg"
                                  title="Reactivar socio"
                                >
                                  <UserCheck size={15} />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setDeleteTarget(socio);
                                    setDeleteType('soft');
                                  }}
                                  className="h-8 w-8 p-0 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                                  title="Dar de baja"
                                >
                                  <Trash2 size={15} />
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* 4. VISTA MOBILE / TABLET MODERNA (CARDS LIMPIAS) */}
        <div className="block lg:hidden space-y-2.5">
          {filteredSocios.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs">
              No se encontraron socios con los filtros actuales.
            </div>
          ) : (
            filteredSocios.map((socio) => {
              const catBadge = getCategoriaBadge(socio.categoria);
              const CatIcon = catBadge.icon;
              const isExempt = socio.categoria === 'vitalicio' || socio.categoria === 'becado';

              return (
                <div
                  key={socio.id}
                  className="bg-[#1f1f1f] border border-[#2c2c2c] rounded-2xl p-3.5 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs uppercase border ${
                        socio.categoria === 'becado'
                          ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                          : socio.categoria === 'vitalicio'
                          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                          : socio.categoria === 'alumno'
                          ? 'bg-blue-950/40 border-blue-500/40 text-blue-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                      }`}>
                        {socio.apellido.charAt(0)}{socio.nombre.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-white text-sm">
                          {socio.apellido}, {socio.nombre}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs text-zinc-400">{socio.dni}</span>
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${catBadge.classes}`}>
                            <CatIcon size={10} className="mr-0.5 inline" />
                            {catBadge.label}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Estado badge */}
                    <div>
                      {isExempt ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                          Exento
                        </span>
                      ) : socio.alDia ? (
                        socio.mesesAdeudados > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-bold">
                            🟡 Al día
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                            🟢 Al día
                          </span>
                        )
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[10px] font-extrabold">
                          🔴 {socio.mesesAdeudados}m
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fila de contacto */}
                  <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 border-t border-[#2a2a2a]">
                    {socio.telefono ? (
                      <button
                        type="button"
                        onClick={() => handleWhatsApp(socio)}
                        className="inline-flex items-center gap-1.5 text-emerald-400 hover:underline"
                      >
                        <MessageCircle size={13} />
                        <span>{socio.telefono}</span>
                      </button>
                    ) : (
                      <span className="text-zinc-600 text-[11px]">Sin teléfono</span>
                    )}

                    {!isExempt && socio.deudaEstimada > 0 && (
                      <span className="text-xs font-bold text-amber-400">
                        Deuda: ${socio.deudaEstimada.toLocaleString('es-AR')}
                      </span>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#2a2a2a]">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onVerHistorial({ id: socio.id, nombre: socio.nombre, apellido: socio.apellido, categoria: socio.categoria })}
                      className="h-8 px-2.5 text-xs text-zinc-400 hover:bg-[#282828] rounded-xl"
                    >
                      <History size={13} className="mr-1" /> Historial
                    </Button>

                    {!readOnly && (
                      <Button
                        size="sm"
                        onClick={() => onRegistrarPago({ id: socio.id, nombre: socio.nombre, apellido: socio.apellido })}
                        className="h-8 px-3 text-xs bg-[#FFCC00] text-black hover:bg-[#e6b800] font-bold rounded-xl"
                      >
                        <DollarSign size={13} className="mr-0.5 stroke-[2.5]" /> Cobrar
                      </Button>
                    )}

                    {!readOnly && !hideABM && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditarSocio(socio)}
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-[#282828] rounded-xl"
                      >
                        <Pencil size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Resumen inferior */}
        <div className="flex items-center justify-between pt-2 border-t border-[#262626] text-xs text-zinc-500">
          <span>Mostrando {filteredSocios.length} de {socios.length} socios</span>
          <span className="hidden sm:inline">Club Atlético Empalme Central · Tenis</span>
        </div>
      </div>

      {/* Confirmación de baja / eliminación */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={() => {
          setDeleteTarget(null);
          setDeleteType('soft');
        }}
      >
        <AlertDialogContent className="bg-[#1e1e1e] border-[#333333] text-zinc-200 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              {deleteType === 'hard' ? '¿Eliminar socio definitivamente?' : '¿Dar de baja al socio?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-sm">
              {deleteType === 'hard' ? (
                <>
                  Vas a eliminar a <strong className="text-white">{deleteTarget?.nombre} {deleteTarget?.apellido}</strong> de forma permanente.
                  <span className="text-rose-400 font-semibold block mt-1">Se borrará todo su historial y pagos. Esta acción no se puede revertir.</span>
                </>
              ) : (
                <>
                  El socio <strong className="text-white">{deleteTarget?.nombre} {deleteTarget?.apellido}</strong> pasará a estado <span className="text-rose-400 font-semibold">inactivo</span>.
                  Podrás reactivarlo en cualquier momento sin perder sus pagos.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-[#333333] bg-[#222] text-zinc-300 hover:bg-[#2a2a2a] rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className={`font-bold rounded-xl text-white ${
                deleteType === 'hard'
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-rose-600/90 hover:bg-rose-600'
              }`}
            >
              {deleting ? 'Procesando...' : deleteType === 'hard' ? 'Eliminar Definitivamente' : 'Dar de Baja'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de reactivación */}
      <AlertDialog open={!!reactivateTarget} onOpenChange={() => setReactivateTarget(null)}>
        <AlertDialogContent className="bg-[#1e1e1e] border-[#333333] text-zinc-200 rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-emerald-400" />
              ¿Reactivar a {reactivateTarget?.nombre} {reactivateTarget?.apellido}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400 text-sm">
              El socio volverá a figurar como <strong className="text-emerald-400">activo</strong> en el padrón y podrá volver a reservar canchas según su categoría.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-[#333333] bg-[#222] text-zinc-300 hover:bg-[#2a2a2a] rounded-xl">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReactivate}
              disabled={deleting}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-xl"
            >
              {deleting ? 'Procesando...' : 'Reactivar Socio'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
