'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Pencil, Trash2, ChevronUp, ChevronDown, DollarSign, History, Users, Phone, Mail, UserCheck, UserX, MessageCircle, AlertTriangle } from 'lucide-react';
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
}

function getCategoriaBadge(categoria: string) {
  switch (categoria) {
    case 'socio': return 'bg-[#FFCC00]/15 text-[#FFCC00] border-[#FFCC00]/20';
    case 'alumno': return 'bg-blue-400/15 text-blue-400 border-blue-400/20';
    case 'vitalicio': return 'bg-green-400/15 text-green-400 border-green-400/20';
    default: return 'bg-gray-400/15 text-gray-400 border-gray-400/20';
  }
}

export default function SociosTable({ onRegistrarPago, onEditarSocio, onCrearSocio, onVerHistorial, onPagoMasivo, refreshKey, socios }: SociosTableProps) {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('apellido');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filterCategoria, setFilterCategoria] = useState('todos');
  const [filterEstado, setFilterEstado] = useState('todos'); // 'todos' | 'al_dia' | 'morosos'
  const [showInactivos, setShowInactivos] = useState(false);
  const [inactivosData, setInactivosData] = useState<Socio[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Socio | null>(null);
  const [deleteType, setDeleteType] = useState<'soft' | 'hard'>('soft');
  const [reactivateTarget, setReactivateTarget] = useState<Socio | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { toast } = useToast();

  // Fetch inactive socios when toggled
  useEffect(() => {
    if (showInactivos) {
      fetchInactivos();
    } else {
      setInactivosData([]);
    }
  }, [showInactivos, refreshKey]);

  async function fetchInactivos() {
    try {
      const res = await fetch('/api/socios?activos=false');
      if (res.ok) {
        const data = await res.json();
        setInactivosData(data);
      }
    } catch (error) {
      console.error('Error al cargar inactivos:', error);
    }
  }

  useEffect(() => {
    setLoading(false);
  }, [socios, refreshKey]);

  const filteredSocios = useMemo(() => {
    let result = socios;

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.nombre.toLowerCase().includes(q) ||
          s.apellido.toLowerCase().includes(q) ||
          s.dni.includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.telefono && s.telefono.includes(q))
      );
    }

    if (filterCategoria && filterCategoria !== 'todos') {
      result = result.filter((s) => s.categoria === filterCategoria);
    }

    if (filterEstado === 'morosos') {
      result = result.filter((s) => s.mesesAdeudados >= 2);
    } else if (filterEstado === 'al_dia') {
      result = result.filter((s) => s.alDia || s.categoria === 'vitalicio');
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
          break;
        case 'dni':
          cmp = a.dni.localeCompare(b.dni);
          break;
        case 'email':
          cmp = a.email.localeCompare(b.email);
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
  }, [socios, search, sortField, sortDir, filterCategoria, filterEstado]);

  const filteredInactivos = useMemo(() => {
    if (!search.trim()) return inactivosData;
    const q = search.toLowerCase().trim();
    return inactivosData.filter(
      (s) =>
        s.nombre.toLowerCase().includes(q) ||
        s.apellido.toLowerCase().includes(q) ||
        s.dni.includes(q) ||
        s.email.toLowerCase().includes(q)
    );
  }, [inactivosData, search]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return null;
    return sortDir === 'asc'
      ? <ChevronUp className="h-3 w-3 inline ml-1" />
      : <ChevronDown className="h-3 w-3 inline ml-1" />;
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
          id: reactivateTarget.id,
          nombre: reactivateTarget.nombre,
          apellido: reactivateTarget.apellido,
          email: reactivateTarget.email,
          dni: reactivateTarget.dni,
          telefono: reactivateTarget.telefono,
          estado: 'activo',
          categoria: reactivateTarget.categoria,
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
    const phone = socio.telefono?.replace(/[^\d]/g, '');
    if (!phone) {
      toast({
        title: 'Sin teléfono',
        description: `${socio.nombre} ${socio.apellido} no tiene teléfono registrado.`,
        variant: 'destructive',
      });
      return;
    }
    const deuda = socio.deudaEstimada;
    const meses = socio.mesesAdeudados;
    const msg = encodeURIComponent(
      `Hola ${socio.nombre} ${socio.apellido} 👋\n\nTe escribimos del club CAEC para recordarte que tenés ${meses} cuota${meses > 1 ? 's' : ''} pendiente${meses > 1 ? 's' : ''} por un total de $${deuda.toLocaleString('es-AR')}.\n\nPor favor acercate a la sede o comunicate con nosotros para regularizar tu situación. ¡Gracias! 🎾`
    );
    window.open(`https://wa.me/54${phone.startsWith('0') ? phone.slice(1) : phone}?text=${msg}`, '_blank');
  }

  const deudoresCount = socios.filter(s => s.mesesAdeudados >= 2).length;

  if (loading) {
    return (
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4 space-y-3">
        <Skeleton className="h-8 w-64 bg-[#2A2A2A]" />
        {[...Array(10)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-full bg-[#2A2A2A]" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white text-sm font-semibold">Socios Activos</h3>
            <span className="text-[#666666] text-xs">({socios.length})</span>
            <Button
              size="sm"
              onClick={onCrearSocio}
              className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-medium text-xs h-7 px-2.5"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nuevo
            </Button>
            {deudoresCount > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={onPagoMasivo}
                className="border-[#FFCC00]/30 text-[#FFCC00] hover:bg-[#FFCC00]/10 text-xs h-7 px-2.5"
              >
                <Users className="h-3.5 w-3.5 mr-1" />
                Pago Masivo ({deudoresCount})
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[130px] bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-8 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E1E1E] border-[#333333]">
                <SelectItem value="todos" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">Todos</SelectItem>
                <SelectItem value="al_dia" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">✅ Al día</SelectItem>
                <SelectItem value="morosos" className="text-[#EF4444] focus:bg-[#2A2A2A] focus:text-white">
                  🔴 Morosos ({deudoresCount})
                </SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategoria} onValueChange={setFilterCategoria}>
              <SelectTrigger className="w-[120px] bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-8 text-xs">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E1E1E] border-[#333333]">
                <SelectItem value="todos" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">Todas</SelectItem>
                <SelectItem value="socio" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">Socio</SelectItem>
                <SelectItem value="alumno" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">Alumno</SelectItem>
                <SelectItem value="vitalicio" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">Vitalicio</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#999999]" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] placeholder:text-[#666666] h-8 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Tabla compacta desktop */}
        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#333333] hover:bg-transparent">
                <TableHead
                  className="text-[#999999] font-medium text-xs cursor-pointer select-none h-9 py-1"
                  onClick={() => toggleSort('apellido')}
                >
                  Socio <SortIcon field="apellido" />
                </TableHead>
                <TableHead
                  className="text-[#999999] font-medium text-xs cursor-pointer select-none h-9 py-1"
                  onClick={() => toggleSort('categoria')}
                >
                  Cat. <SortIcon field="categoria" />
                </TableHead>
                <TableHead
                  className="text-[#999999] font-medium text-xs cursor-pointer select-none h-9 py-1"
                  onClick={() => toggleSort('dni')}
                >
                  DNI <SortIcon field="dni" />
                </TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Email</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Teléfono</TableHead>
                <TableHead
                  className="text-[#999999] font-medium text-xs cursor-pointer select-none h-9 py-1 text-center"
                  onClick={() => toggleSort('estado')}
                >
                  Estado <SortIcon field="estado" />
                </TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSocios.length === 0 ? (
                <TableRow className="border-[#333333]">
                  <TableCell colSpan={7} className="text-center py-6 text-[#999999] text-xs">
                    No se encontraron socios
                  </TableCell>
                </TableRow>
              ) : (
                filteredSocios.map((socio) => (
                  <TableRow key={socio.id} className="border-[#333333] hover:bg-[#252525]">
                    <TableCell className="text-[#CCCCCC] text-xs py-2">
                      <span className="font-medium">{socio.apellido}</span>{', '}
                      {socio.nombre}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getCategoriaBadge(socio.categoria)}`}>
                        {socio.categoria.charAt(0).toUpperCase() + socio.categoria.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[#CCCCCC] font-mono text-[11px] py-2">{socio.dni}</TableCell>
                    <TableCell className="text-[#999999] text-[11px] py-2 max-w-[160px] truncate">
                      {socio.email}
                    </TableCell>
                    <TableCell className="text-[#999999] text-[11px] py-2 whitespace-nowrap">
                      {socio.telefono ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {socio.telefono}
                        </span>
                      ) : (
                        <span className="text-[#444444]">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      {socio.alDia ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#00AA55]/15 text-[#00AA55] text-[10px] font-medium">
                          Al día
                        </span>
                      ) : socio.mesesAdeudados >= 2 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#EF4444]/15 text-[#EF4444] text-[10px] font-medium">
                          {socio.mesesAdeudados}m
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-medium">
                          {socio.mesesAdeudados}m
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="py-2">
                      <div className="flex items-center justify-center gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onVerHistorial({ id: socio.id, nombre: socio.nombre, apellido: socio.apellido, categoria: socio.categoria })}
                          className="h-7 w-7 p-0 text-[#999999] hover:text-white hover:bg-[#2A2A2A]"
                          title="Historial de Pagos"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onRegistrarPago({ id: socio.id, nombre: socio.nombre, apellido: socio.apellido })}
                          className="h-7 w-7 p-0 text-[#FFCC00] hover:text-[#E6B800] hover:bg-[#FFCC00]/10"
                          title="Registrar Pago"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </Button>
                        {socio.mesesAdeudados >= 2 && socio.categoria !== 'vitalicio' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleWhatsApp(socio)}
                            className="h-7 w-7 p-0 text-green-400 hover:text-green-300 hover:bg-green-400/10"
                            title="Enviar WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEditarSocio(socio)}
                          className="h-7 w-7 p-0 text-[#999999] hover:text-white hover:bg-[#2A2A2A]"
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => { setDeleteTarget(socio); setDeleteType('soft'); }}
                          className="h-7 w-7 p-0 text-[#999999] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                          title="Dar de baja"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Cards compactas mobile/tablet */}
        <div className="lg:hidden space-y-2">
          {filteredSocios.length === 0 ? (
            <div className="text-center py-6 text-[#999999] text-xs">
              No se encontraron socios
            </div>
          ) : (
            filteredSocios.map((socio) => (
              <div
                key={socio.id}
                className="bg-[#252525] border border-[#333333] rounded-lg p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-white text-sm font-medium truncate">{socio.apellido}, {socio.nombre}</p>
                    <p className="text-[#999999] text-[11px] truncate">{socio.email}</p>
                    {socio.telefono && (
                      <p className="text-[#999999] text-[11px] truncate">{socio.telefono}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getCategoriaBadge(socio.categoria)}`}>
                      {socio.categoria.charAt(0).toUpperCase() + socio.categoria.slice(1)}
                    </Badge>
                    {socio.alDia ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#00AA55]/15 text-[#00AA55] text-[10px] font-medium">
                        Al día
                      </span>
                    ) : socio.mesesAdeudados >= 2 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#EF4444]/15 text-[#EF4444] text-[10px] font-medium">
                        {socio.mesesAdeudados}m
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#F59E0B] text-[10px] font-medium">
                        {socio.mesesAdeudados}m
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-[#333333] flex-wrap">
                  <Button size="sm" variant="ghost" onClick={() => onVerHistorial({ id: socio.id, nombre: socio.nombre, apellido: socio.apellido, categoria: socio.categoria })} className="h-7 px-2 text-[#999999] hover:bg-[#2A2A2A] text-[10px]">
                    <History className="h-3 w-3 mr-0.5" /> Historial
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onRegistrarPago({ id: socio.id, nombre: socio.nombre, apellido: socio.apellido })} className="h-7 px-2 text-[#FFCC00] hover:bg-[#FFCC00]/10 text-[10px]">
                    <DollarSign className="h-3 w-3 mr-0.5" /> Pago
                  </Button>
                  {socio.mesesAdeudados >= 2 && socio.categoria !== 'vitalicio' && (
                    <Button size="sm" variant="ghost" onClick={() => handleWhatsApp(socio)} className="h-7 px-2 text-green-400 hover:bg-green-400/10 text-[10px]">
                      <MessageCircle className="h-3 w-3 mr-0.5" /> WhatsApp
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onEditarSocio(socio)} className="h-7 px-2 text-[#999999] hover:bg-[#2A2A2A] text-[10px]">
                    <Pencil className="h-3 w-3 mr-0.5" /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setDeleteTarget(socio); setDeleteType('soft'); }} className="h-7 px-2 text-[#999999] hover:text-[#EF4444] hover:bg-[#EF4444]/10 text-[10px]">
                    <Trash2 className="h-3 w-3 mr-0.5" /> Baja
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resumen compacto */}
        {!loading && filteredSocios.length > 0 && (
          <div className="mt-2 pt-2 border-t border-[#333333] text-[#666666] text-[10px]">
            Mostrando {filteredSocios.length} de {socios.length} socios activos
          </div>
        )}

        {/* Toggle inactivos */}
        <div className="mt-3 pt-3 border-t border-[#333333]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowInactivos(!showInactivos)}
            className="text-[#999999] hover:text-white hover:bg-[#2A2A2A] text-xs h-7"
          >
            <UserX className="h-3.5 w-3.5 mr-1.5" />
            {showInactivos ? 'Ocultar inactivos' : `Ver socios inactivos`}
            {!showInactivos && inactivosData.length > 0 && (
              <Badge variant="outline" className="ml-1.5 text-[9px] px-1.5 py-0 border-[#EF4444]/30 text-[#EF4444]">
                {inactivosData.length}
              </Badge>
            )}
          </Button>
        </div>

        {/* Lista de inactivos */}
        {showInactivos && (
          <div className="mt-3 space-y-2">
            {filteredInactivos.length === 0 ? (
              <div className="text-center py-4 text-[#999999] text-xs">
                No hay socios inactivos
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#333333] hover:bg-transparent">
                        <TableHead className="text-[#999999] font-medium text-xs h-8 py-1">Socio</TableHead>
                        <TableHead className="text-[#999999] font-medium text-xs h-8 py-1">Categoría</TableHead>
                        <TableHead className="text-[#999999] font-medium text-xs h-8 py-1">DNI</TableHead>
                        <TableHead className="text-[#999999] font-medium text-xs h-8 py-1">Email</TableHead>
                        <TableHead className="text-[#999999] font-medium text-xs h-8 py-1">Teléfono</TableHead>
                        <TableHead className="text-[#999999] font-medium text-xs h-8 py-1 text-center">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInactivos.map((socio) => (
                        <TableRow key={socio.id} className="border-[#333333] hover:bg-red-500/10 bg-red-500/5 opacity-80">
                          <TableCell className="text-[#CCCCCC] text-xs py-2">
                            <span className="font-medium">{socio.apellido}</span>, {socio.nombre}
                          </TableCell>
                          <TableCell className="py-2">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getCategoriaBadge(socio.categoria)}`}>
                              {socio.categoria.charAt(0).toUpperCase() + socio.categoria.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-[#CCCCCC] font-mono text-[11px] py-2">{socio.dni}</TableCell>
                          <TableCell className="text-[#999999] text-[11px] py-2 max-w-[160px] truncate">{socio.email}</TableCell>
                          <TableCell className="text-[#999999] text-[11px] py-2 whitespace-nowrap">
                            {socio.telefono ? socio.telefono : '—'}
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex items-center justify-center gap-0.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setReactivateTarget(socio)}
                                className="h-7 w-7 p-0 text-[#00AA55] hover:text-[#00CC66] hover:bg-[#00AA55]/10"
                                title="Reactivar socio"
                              >
                                <UserCheck className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setDeleteTarget(socio); setDeleteType('hard'); }}
                                className="h-7 w-7 p-0 text-[#999999] hover:text-[#EF4444] hover:bg-[#EF4444]/10"
                                title="Eliminar definitivamente"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile inactivos */}
                <div className="lg:hidden space-y-2">
                  {filteredInactivos.map((socio) => (
                    <div key={socio.id} className="bg-[#252525] border border-[#333333] rounded-lg p-3 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-medium truncate">{socio.apellido}, {socio.nombre}</p>
                          <p className="text-[#999999] text-[11px] truncate">{socio.email} · {socio.telefono || 'Sin teléfono'}</p>
                        </div>
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ml-2 ${getCategoriaBadge(socio.categoria)}`}>
                          {socio.categoria.charAt(0).toUpperCase() + socio.categoria.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-end gap-1 mt-2 pt-2 border-t border-[#333333]">
                        <Button size="sm" variant="ghost" onClick={() => setReactivateTarget(socio)} className="h-7 px-2 text-[#00AA55] hover:bg-[#00AA55]/10 text-[10px]">
                          <UserCheck className="h-3 w-3 mr-0.5" /> Reactivar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setDeleteTarget(socio); setDeleteType('hard'); }} className="h-7 px-2 text-[#999999] hover:text-[#EF4444] hover:bg-[#EF4444]/10 text-[10px]">
                          <Trash2 className="h-3 w-3 mr-0.5" /> Eliminar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Confirmación de baja / eliminación */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => { setDeleteTarget(null); setDeleteType('soft'); }}>
        <AlertDialogContent className="bg-[#1E1E1E] border-[#333333]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
              {deleteType === 'hard' ? '¿Eliminar definitivamente?' : '¿Dar de baja?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#999999]">
              {deleteType === 'hard' ? (
                <>
                  Vas a eliminar <span className="text-white font-medium">{deleteTarget?.nombre} {deleteTarget?.apellido}</span> definitivamente.
                  <span className="text-[#EF4444] font-medium"> Se borrarán todos sus pagos e historial.</span> Esta acción no se puede deshacer.
                </>
              ) : (
                <>
                  El socio <span className="text-white font-medium">{deleteTarget?.nombre} {deleteTarget?.apellido}</span> pasará a estado <span className="text-[#EF4444] font-medium">inactivo</span>.
                  No se eliminará su historial de pagos. Podrás reactivarlo más adelante.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className={`text-white font-medium ${deleteType === 'hard' ? 'bg-[#EF4444] hover:bg-[#DC2626]' : 'bg-[#EF4444]/80 hover:bg-[#EF4444]'}`}
            >
              {deleting ? 'Procesando...' : deleteType === 'hard' ? 'Eliminar definitivamente' : 'Dar de baja'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmación de reactivación */}
      <AlertDialog open={!!reactivateTarget} onOpenChange={() => setReactivateTarget(null)}>
        <AlertDialogContent className="bg-[#1E1E1E] border-[#333333]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">¿Reactivar a {reactivateTarget?.nombre} {reactivateTarget?.apellido}?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#999999]">
              El socio volverá a estar <span className="text-[#00AA55] font-medium">activo</span> y aparecerá en la lista de socios.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReactivate}
              disabled={deleting}
              className="bg-[#00AA55] text-white hover:bg-[#00CC66] font-medium"
            >
              {deleting ? 'Procesando...' : 'Reactivar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
