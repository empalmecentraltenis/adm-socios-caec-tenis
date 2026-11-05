'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  RefreshCw,
  Loader2,
  GraduationCap,
  Sparkles,
  Trophy,
  Filter,
  CheckSquare,
  ListOrdered,
  BarChart3,
  FileSpreadsheet,
  DollarSign,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import TomarAsistenciaEscuela from './TomarAsistenciaEscuela';
import ReporteAsistenciaEscuela from './ReporteAsistenciaEscuela';
import PagosCuotaEscuelaPanel from './PagosCuotaEscuelaPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

export interface AlumnoEscuela {
  id: string;
  nombre: string;
  grupo: 'Escuelita' | 'Minitenis' | 'Grupo Entrenamiento' | string;
  edad?: number | null;
  telefono?: string | null;
  tutor?: string | null;
  observaciones?: string | null;
  activo?: boolean;
  createdAt?: string;
}

const GRUPOS = ['Escuelita', 'Minitenis', 'Grupo Entrenamiento'] as const;

const GRUPO_STYLES: Record<string, { badge: string; border: string; icon: any; desc: string }> = {
  Escuelita: {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    border: 'border-emerald-500/30',
    icon: Sparkles,
    desc: 'Iniciación y fundamentos de tenis infantil',
  },
  Minitenis: {
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    border: 'border-sky-500/30',
    icon: GraduationCap,
    desc: 'Desarrollo psicomotriz y juego en cancha reducida',
  },
  'Grupo Entrenamiento': {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    border: 'border-amber-500/30',
    icon: Trophy,
    desc: 'Perfeccionamiento técnico y competición juvenil',
  },
};

export default function AlumnosEscuelaPanel({ 
  readOnly = false,
  hideSubNav = false,
  initialVista = 'padron'
}: { 
  readOnly?: boolean;
  hideSubNav?: boolean;
  initialVista?: 'padron' | 'asistencia' | 'reportes' | 'pagos';
} = {}) {
  const { toast } = useToast();

  const [alumnos, setAlumnos] = useState<AlumnoEscuela[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGrupo, setSelectedGrupo] = useState<string>('todos');
  const [vistaActiva, setVistaActiva] = useState<'padron' | 'asistencia' | 'reportes' | 'pagos'>(initialVista);

  // Modales
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAlumno, setEditingAlumno] = useState<AlumnoEscuela | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [alumnoToDelete, setAlumnoToDelete] = useState<AlumnoEscuela | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form State
  const [formNombre, setFormNombre] = useState('');
  const [formGrupo, setFormGrupo] = useState<string>('Escuelita');
  const [formEdad, setFormEdad] = useState('');
  const [formTelefono, setFormTelefono] = useState('');
  const [formTutor, setFormTutor] = useState('');
  const [formObservaciones, setFormObservaciones] = useState('');

  const fetchAlumnos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alumnos-escuela');
      const data = await res.json();
      if (res.ok && data.success) {
        setAlumnos(data.alumnos || []);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudieron cargar los alumnos',
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
  }, [toast]);

  useEffect(() => {
    fetchAlumnos();
  }, [fetchAlumnos]);

  // Abrir modal de creación
  const handleOpenCreate = () => {
    setEditingAlumno(null);
    setFormNombre('');
    setFormGrupo(selectedGrupo !== 'todos' ? selectedGrupo : 'Escuelita');
    setFormEdad('');
    setFormTelefono('');
    setFormTutor('');
    setFormObservaciones('');
    setModalOpen(true);
  };

  // Abrir modal de edición
  const handleOpenEdit = (alumno: AlumnoEscuela) => {
    setEditingAlumno(alumno);
    setFormNombre(alumno.nombre);
    setFormGrupo(alumno.grupo);
    setFormEdad(alumno.edad ? String(alumno.edad) : '');
    setFormTelefono(alumno.telefono || '');
    setFormTutor(alumno.tutor || '');
    setFormObservaciones(alumno.observaciones || '');
    setModalOpen(true);
  };

  // Guardar (Crear o Editar)
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      toast({ title: 'Error', description: 'El nombre es obligatorio', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        nombre: formNombre.trim(),
        grupo: formGrupo,
        edad: formEdad ? parseInt(formEdad, 10) : null,
        telefono: formTelefono.trim() || null,
        tutor: formTutor.trim() || null,
        observaciones: formObservaciones.trim() || null,
      };

      let res: Response;
      if (editingAlumno) {
        res = await fetch('/api/alumnos-escuela', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingAlumno.id, ...payload }),
        });
      } else {
        res = await fetch('/api/alumnos-escuela', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: editingAlumno ? 'Alumno actualizado' : 'Alumno registrado',
          description: `${formNombre} fue ${editingAlumno ? 'actualizado' : 'agregado'} correctamente.`,
        });
        setModalOpen(false);
        fetchAlumnos();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo guardar el alumno',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al procesar la solicitud',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Confirmar eliminación
  const handleDeleteConfirm = async () => {
    if (!alumnoToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/alumnos-escuela?id=${alumnoToDelete.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Alumno eliminado',
          description: `${alumnoToDelete.nombre} fue eliminado de la lista.`,
        });
        setDeleteAlertOpen(false);
        setAlumnoToDelete(null);
        fetchAlumnos();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo eliminar el alumno',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'Ocurrió un error al eliminar',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  // Filtrado
  const filteredAlumnos = useMemo(() => {
    return alumnos.filter((a) => {
      const matchGrupo = selectedGrupo === 'todos' || a.grupo === selectedGrupo;
      const term = search.toLowerCase().trim();
      const matchSearch =
        !term ||
        a.nombre.toLowerCase().includes(term) ||
        (a.tutor && a.tutor.toLowerCase().includes(term)) ||
        (a.observaciones && a.observaciones.toLowerCase().includes(term));
      return matchGrupo && matchSearch;
    });
  }, [alumnos, selectedGrupo, search]);

  // Agrupados para mostrar por sección
  const alumnosPorGrupo = useMemo(() => {
    const map: Record<string, AlumnoEscuela[]> = {
      Escuelita: [],
      Minitenis: [],
      'Grupo Entrenamiento': [],
    };
    for (const a of filteredAlumnos) {
      if (!map[a.grupo]) map[a.grupo] = [];
      map[a.grupo].push(a);
    }
    return map;
  }, [filteredAlumnos]);

  // Exportar padrón a Excel
  const exportarAExcel = () => {
    try {
      const dataToExport = filteredAlumnos.map((al, idx) => ({
        'N°': idx + 1,
        'Nombre y Apellido': al.nombre,
        'Grupo': al.grupo,
        'Edad': al.edad ? `${al.edad} años` : '-',
        'Tutor / Responsable': al.tutor || '-',
        'Teléfono': al.telefono || '-',
        'Observaciones': al.observaciones || '-',
        'Estado': al.activo === false ? 'Inactivo' : 'Activo',
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Anchos de columna óptimos
      ws['!cols'] = [
        { wch: 6 },   // N°
        { wch: 30 },  // Nombre
        { wch: 22 },  // Grupo
        { wch: 12 },  // Edad
        { wch: 26 },  // Tutor
        { wch: 18 },  // Teléfono
        { wch: 35 },  // Observaciones
        { wch: 12 },  // Estado
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Padrón Alumnos');

      const fechaHoy = new Date().toISOString().split('T')[0];
      const nombreArchivo = selectedGrupo === 'todos'
        ? `Padron_Alumnos_Escuela_${fechaHoy}.xlsx`
        : `Padron_Alumnos_${selectedGrupo.replace(/\s+/g, '_')}_${fechaHoy}.xlsx`;

      XLSX.writeFile(wb, nombreArchivo);

      toast({
        title: 'Exportación completada',
        description: `Se exportaron ${dataToExport.length} alumnos a Excel.`,
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

  // Contadores
  const stats = useMemo(() => {
    return {
      total: alumnos.length,
      escuelita: alumnos.filter((a) => a.grupo === 'Escuelita').length,
      minitenis: alumnos.filter((a) => a.grupo === 'Minitenis').length,
      entrenamiento: alumnos.filter((a) => a.grupo === 'Grupo Entrenamiento').length,
    };
  }, [alumnos]);

  return (
    <div className="space-y-5">
      {/* Selector de Pestaña Principal: Padrón vs Tomar Asistencia */}
      {!hideSubNav && (
        <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-2">
          <button
            type="button"
            onClick={() => setVistaActiva('padron')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              vistaActiva === 'padron'
                ? 'bg-primary text-black shadow-md'
                : 'bg-[#1C1C1C] text-[#AAAAAA] hover:text-white border border-[#2E2E2E]'
            }`}
          >
            <ListOrdered className="h-4 w-4" />
            <span>Padrón de Alumnos</span>
            <Badge className={`text-[10px] px-1.5 py-0 ${vistaActiva === 'padron' ? 'bg-black text-primary' : 'bg-[#2A2A2A] text-[#888]'}`}>
              {stats.total}
            </Badge>
          </button>

          {/* Pestaña Tomar Asistencia: solo visible para administradores y profesores (oculto en modo solo lectura) */}
          {!readOnly && (
            <button
              type="button"
              onClick={() => setVistaActiva('asistencia')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
                vistaActiva === 'asistencia'
                  ? 'bg-emerald-500 text-black shadow-md'
                  : 'bg-[#1C1C1C] text-emerald-400 hover:text-white border border-emerald-500/30'
              }`}
            >
              <CheckSquare className="h-4 w-4" />
              <span>⚡ Tomar Asistencia (Pase de Lista)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setVistaActiva('reportes')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              vistaActiva === 'reportes'
                ? 'bg-amber-400 text-black shadow-md'
                : 'bg-[#1C1C1C] text-amber-400 hover:text-white border border-amber-400/30'
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            <span>📊 Reportes Asistencia</span>
          </button>

          <button
            type="button"
            onClick={() => setVistaActiva('pagos')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              vistaActiva === 'pagos'
                ? 'bg-emerald-400 text-black shadow-md'
                : 'bg-[#1C1C1C] text-emerald-300 hover:text-white border border-emerald-500/40'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            <span>💵 Cuotas y Pagos (Comisión Directiva)</span>
          </button>
        </div>
      )}

      {/* VISTA 1: COBRO DE CUOTAS Y REPORTES PARA COMISIÓN DIRECTIVA */}
      {vistaActiva === 'pagos' && (
        <PagosCuotaEscuelaPanel readOnly={readOnly} />
      )}

      {/* VISTA 2: TOMAR ASISTENCIA RÁPIDA */}
      {vistaActiva === 'asistencia' && (
        <TomarAsistenciaEscuela />
      )}

      {/* VISTA 3: REPORTES SEMANALES Y MENSUALES DE ASISTENCIA */}
      {vistaActiva === 'reportes' && (
        <ReporteAsistenciaEscuela />
      )}

      {/* VISTA 3: PADRÓN GENERAL DE ALUMNOS */}
      {vistaActiva === 'padron' && (
        <>
          {/* KPI Cards Superiores */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#888888]">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Alumnos</span>
            <Users size={18} className="text-primary" />
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-black text-white">{stats.total}</span>
            <span className="text-xs text-[#888888] ml-2">inscriptos</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-emerald-500/20 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Escuelita</span>
            <Sparkles size={18} />
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-black text-white">{stats.escuelita}</span>
            <span className="text-xs text-[#888888] ml-2">chicos</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-sky-500/20 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-sky-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Minitenis</span>
            <GraduationCap size={18} />
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-black text-white">{stats.minitenis}</span>
            <span className="text-xs text-[#888888] ml-2">chicos</span>
          </div>
        </div>

        <div className="bg-[#181818] border border-amber-500/20 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Entrenamiento</span>
            <Trophy size={18} />
          </div>
          <div className="mt-3">
            <span className="text-2xl lg:text-3xl font-black text-white">{stats.entrenamiento}</span>
            <span className="text-xs text-[#888888] ml-2">juveniles</span>
          </div>
        </div>
      </div>

      {/* Barra de Filtros y Acciones */}
      <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Selector de Grupo */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={selectedGrupo === 'todos' ? 'default' : 'outline'}
            onClick={() => setSelectedGrupo('todos')}
            className={`text-xs h-8 ${selectedGrupo === 'todos' ? 'bg-primary text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA] hover:text-white'}`}
          >
            Todos ({stats.total})
          </Button>
          <Button
            size="sm"
            variant={selectedGrupo === 'Escuelita' ? 'default' : 'outline'}
            onClick={() => setSelectedGrupo('Escuelita')}
            className={`text-xs h-8 ${selectedGrupo === 'Escuelita' ? 'bg-emerald-500 text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA] hover:text-white'}`}
          >
            Escuelita ({stats.escuelita})
          </Button>
          <Button
            size="sm"
            variant={selectedGrupo === 'Minitenis' ? 'default' : 'outline'}
            onClick={() => setSelectedGrupo('Minitenis')}
            className={`text-xs h-8 ${selectedGrupo === 'Minitenis' ? 'bg-sky-500 text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA] hover:text-white'}`}
          >
            Minitenis ({stats.minitenis})
          </Button>
          <Button
            size="sm"
            variant={selectedGrupo === 'Grupo Entrenamiento' ? 'default' : 'outline'}
            onClick={() => setSelectedGrupo('Grupo Entrenamiento')}
            className={`text-xs h-8 ${selectedGrupo === 'Grupo Entrenamiento' ? 'bg-amber-500 text-black font-bold' : 'border-[#2A2A2A] text-[#AAAAAA] hover:text-white'}`}
          >
            Entrenamiento ({stats.entrenamiento})
          </Button>
        </div>

        {/* Búsqueda y Botón Agregar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888]" />
            <Input
              type="text"
              placeholder="Buscar alumno..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs bg-[#121212] border-[#2A2A2A] text-white placeholder:text-[#666666] focus-visible:ring-primary"
            />
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={exportarAExcel}
            disabled={loading || filteredAlumnos.length === 0}
            className="h-8 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs gap-1.5 font-semibold shrink-0"
            title="Exportar padrón a archivo Excel"
          >
            <FileSpreadsheet size={14} />
            <span className="hidden sm:inline">Exportar Excel</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={fetchAlumnos}
            disabled={loading}
            className="h-8 w-8 p-0 text-[#888888] hover:text-white"
            title="Refrescar lista"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>

          {!readOnly && (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="h-8 bg-primary hover:bg-primary/90 text-black font-bold text-xs gap-1.5 shrink-0"
            >
              <Plus size={14} />
              <span>Nuevo Alumno</span>
            </Button>
          )}
        </div>
      </div>

      {/* Contenido / Listados por Grupo */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm text-[#888888]">Cargando alumnos de la escuela...</p>
        </div>
      ) : filteredAlumnos.length === 0 ? (
        <div className="bg-[#181818] border border-[#2A2A2A] rounded-xl p-12 text-center">
          <Users size={40} className="mx-auto text-[#555555] mb-3" />
          <p className="text-white font-semibold">No se encontraron alumnos</p>
          <p className="text-xs text-[#888888] mt-1">
            {search ? 'Probá con otro término de búsqueda' : 'No hay alumnos registrados en este grupo'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {GRUPOS.filter((g) => selectedGrupo === 'todos' || selectedGrupo === g).map((grupoNombre) => {
            const list = alumnosPorGrupo[grupoNombre] || [];
            if (list.length === 0 && selectedGrupo === 'todos' && search) return null;

            const style = GRUPO_STYLES[grupoNombre] || GRUPO_STYLES['Escuelita'];
            const GroupIcon = style.icon;

            return (
              <div
                key={grupoNombre}
                className="bg-[#181818] border border-[#2A2A2A] rounded-xl overflow-hidden shadow-sm"
              >
                {/* Cabecera del Grupo */}
                <div className="px-5 py-3.5 bg-[#141414] border-b border-[#2A2A2A] flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-white/5 text-white">
                      <GroupIcon size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        {grupoNombre}
                        <Badge variant="outline" className={`text-[10px] py-0 px-2 font-bold ${style.badge}`}>
                          {list.length} {list.length === 1 ? 'alumno' : 'alumnos'}
                        </Badge>
                      </h3>
                      <p className="text-[11px] text-[#777777]">{style.desc}</p>
                    </div>
                  </div>

                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingAlumno(null);
                        setFormNombre('');
                        setFormGrupo(grupoNombre);
                        setFormEdad('');
                        setFormTelefono('');
                        setFormTutor('');
                        setFormObservaciones('');
                        setModalOpen(true);
                      }}
                      className="h-7 text-xs text-[#888888] hover:text-primary gap-1 px-2"
                    >
                      <Plus size={12} />
                      <span>Agregar a {grupoNombre}</span>
                    </Button>
                  )}
                </div>

                {/* Lista de Alumnos */}
                {list.length === 0 ? (
                  <div className="p-6 text-center text-xs text-[#666666]">
                    No hay alumnos registrados en este grupo.
                  </div>
                ) : (
                  <div className="divide-y divide-[#222222]">
                    {list.map((alumno, idx) => (
                      <div
                        key={alumno.id}
                        className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-[#1C1C1C] transition-colors group"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          {/* Número correlativo */}
                          <span className="text-xs font-mono font-bold text-[#555555] w-5 text-right">
                            {idx + 1}.
                          </span>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-white group-hover:text-primary transition-colors truncate">
                              {alumno.nombre}
                            </p>

                            {/* Metadatos adicionales si existen */}
                            {(alumno.edad || alumno.tutor || alumno.telefono || alumno.observaciones) && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[#888888] mt-0.5">
                                {alumno.edad && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="text-[#555555]">Edad:</span> {alumno.edad} años
                                  </span>
                                )}
                                {alumno.tutor && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="text-[#555555]">Tutor:</span> {alumno.tutor}
                                  </span>
                                )}
                                {alumno.telefono && (
                                  <span className="inline-flex items-center gap-1">
                                    <span className="text-[#555555]">Tel:</span> {alumno.telefono}
                                  </span>
                                )}
                                {alumno.observaciones && (
                                  <span className="text-[#AAAAAA] italic text-[11px] truncate max-w-xs">
                                    "{alumno.observaciones}"
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botones de Acción */}
                        {!readOnly && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenEdit(alumno)}
                              className="h-7 w-7 p-0 text-[#888888] hover:text-white hover:bg-white/10"
                              title="Editar alumno"
                            >
                              <Pencil size={13} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setAlumnoToDelete(alumno);
                                setDeleteAlertOpen(true);
                              }}
                              className="h-7 w-7 p-0 text-[#888888] hover:text-red-400 hover:bg-red-500/10"
                              title="Eliminar alumno"
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar Alumno */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#181818] border-[#2A2A2A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <GraduationCap size={18} className="text-primary" />
              {editingAlumno ? 'Editar Alumno' : 'Nuevo Alumno de la Escuela'}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#888888]">
              Completá los datos del alumno para el control de la escuela de tenis.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-[#AAAAAA]">Nombre completo *</Label>
              <Input
                required
                placeholder="Ej: Felipe Rodriguez"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                className="mt-1 bg-[#121212] border-[#2A2A2A] text-white text-sm focus-visible:ring-primary"
              />
            </div>

            <div>
              <Label className="text-xs text-[#AAAAAA]">Grupo *</Label>
              <select
                value={formGrupo}
                onChange={(e) => setFormGrupo(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-md bg-[#121212] border border-[#2A2A2A] text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {GRUPOS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-[#AAAAAA]">Edad (opcional)</Label>
                <Input
                  type="number"
                  placeholder="Ej: 9"
                  min="3"
                  max="25"
                  value={formEdad}
                  onChange={(e) => setFormEdad(e.target.value)}
                  className="mt-1 bg-[#121212] border-[#2A2A2A] text-white text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-[#AAAAAA]">Teléfono / WhatsApp</Label>
                <Input
                  type="text"
                  placeholder="Ej: 3400 123456"
                  value={formTelefono}
                  onChange={(e) => setFormTelefono(e.target.value)}
                  className="mt-1 bg-[#121212] border-[#2A2A2A] text-white text-sm"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs text-[#AAAAAA]">Nombre del Padre / Madre / Tutor</Label>
              <Input
                type="text"
                placeholder="Ej: Juan Rodriguez"
                value={formTutor}
                onChange={(e) => setFormTutor(e.target.value)}
                className="mt-1 bg-[#121212] border-[#2A2A2A] text-white text-sm"
              />
            </div>

            <div>
              <Label className="text-xs text-[#AAAAAA]">Observaciones / Horarios</Label>
              <Input
                type="text"
                placeholder="Ej: Viene martes y jueves 17hs"
                value={formObservaciones}
                onChange={(e) => setFormObservaciones(e.target.value)}
                className="mt-1 bg-[#121212] border-[#2A2A2A] text-white text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-[#2A2A2A] text-white hover:bg-white/5 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-black font-bold text-xs gap-1.5"
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                <span>{editingAlumno ? 'Guardar Cambios' : 'Registrar Alumno'}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Alerta Confirmar Eliminación */}
      <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent className="bg-[#181818] border-[#2A2A2A] text-white max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold text-white">
              ¿Eliminar alumno de la escuela?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-[#888888]">
              Estás a punto de eliminar a{' '}
              <strong className="text-white">{alumnoToDelete?.nombre}</strong> del grupo{' '}
              <strong className="text-white">{alumnoToDelete?.grupo}</strong>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-[#2A2A2A] text-white hover:bg-white/5 text-xs">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs gap-1.5"
            >
              {deleting && <Loader2 size={12} className="animate-spin" />}
              <span>Eliminar</span>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
        </>
      )}
    </div>
  );
}

