'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Users,
  Search,
  Sparkles,
  GraduationCap,
  Trophy,
  Loader2,
  RefreshCw,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

export interface AlumnoAsistenciaItem {
  id: string;
  nombre: string;
  grupo: string;
  edad?: number | null;
  tutor?: string | null;
  telefono?: string | null;
  presente: boolean;
}

const GRUPOS = ['Escuelita', 'Minitenis', 'Grupo Entrenamiento'] as const;

const GRUPO_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  Escuelita: {
    label: 'Escuelita',
    icon: Sparkles,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  Minitenis: {
    label: 'Minitenis',
    icon: GraduationCap,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
  },
  'Grupo Entrenamiento': {
    label: 'Entrenamiento',
    icon: Trophy,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
};

interface Props {
  initialFecha?: string;
  onClose?: () => void;
  isCompact?: boolean; // Para vista en celular / modal
}

export default function TomarAsistenciaEscuela({ initialFecha, isCompact = false }: Props) {
  const { toast } = useToast();

  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [fecha, setFecha] = useState<string>(initialFecha || getTodayStr());
  const [grupoActivo, setGrupoActivo] = useState<string>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [alumnos, setAlumnos] = useState<AlumnoAsistenciaItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState<boolean>(false);

  // Cargar datos
  const fetchAsistencias = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/asistencias-escuela?fecha=${fecha}`);
      if (res.ok) {
        const data = await res.json();
        setAlumnos(data.alumnos || []);
      } else {
        toast({
          title: 'Error al cargar',
          description: 'No se pudieron obtener los alumnos para la fecha.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [fecha, toast]);

  useEffect(() => {
    fetchAsistencias();
  }, [fetchAsistencias]);

  // Alternar asistencia individual con 1 solo toque (One-Tap Toggle)
  const toggleAsistencia = async (alumno: AlumnoAsistenciaItem) => {
    const nuevoEstado = !alumno.presente;

    // Actualización optimista inmediata en UI para que sea instantáneo
    setAlumnos((prev) =>
      prev.map((a) => (a.id === alumno.id ? { ...a, presente: nuevoEstado } : a))
    );
    setSavingId(alumno.id);

    try {
      const res = await fetch('/api/asistencias-escuela', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alumnoId: alumno.id,
          fecha,
          presente: nuevoEstado,
          grupo: alumno.grupo,
        }),
      });

      if (!res.ok) {
        // Revertir en caso de falla
        setAlumnos((prev) =>
          prev.map((a) => (a.id === alumno.id ? { ...a, presente: !nuevoEstado } : a))
        );
        toast({
          title: 'Error',
          description: 'No se pudo guardar la asistencia',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error(e);
      setAlumnos((prev) =>
        prev.map((a) => (a.id === alumno.id ? { ...a, presente: !nuevoEstado } : a))
      );
    } finally {
      setSavingId(null);
    }
  };

  // Marcar todos los del grupo/filtro actual como presentes o ausentes
  const marcarMasivo = async (presente: boolean) => {
    const filtrados = alumnosFiltrados;
    if (filtrados.length === 0) return;

    setSavingAll(true);
    const idsToUpdate = new Set(filtrados.map((a) => a.id));

    // Optimista
    setAlumnos((prev) =>
      prev.map((a) => (idsToUpdate.has(a.id) ? { ...a, presente } : a))
    );

    const cambios = filtrados.map((a) => ({
      alumnoId: a.id,
      presente,
      grupo: a.grupo,
    }));

    try {
      const res = await fetch('/api/asistencias-escuela', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha, cambios }),
      });

      if (res.ok) {
        toast({
          title: presente ? '¡Todos presentes!' : 'Se marcaron como ausentes',
          description: `${filtrados.length} alumnos actualizados`,
        });
      } else {
        await fetchAsistencias();
      }
    } catch (e) {
      console.error(e);
      await fetchAsistencias();
    } finally {
      setSavingAll(false);
    }
  };

  // Filtrado de alumnos
  const alumnosFiltrados = useMemo(() => {
    return alumnos.filter((a) => {
      const matchesGrupo = grupoActivo === 'todos' || a.grupo === grupoActivo;
      const matchesSearch =
        !searchTerm.trim() ||
        a.nombre.toLowerCase().includes(searchTerm.toLowerCase().trim()) ||
        (a.tutor && a.tutor.toLowerCase().includes(searchTerm.toLowerCase().trim()));
      return matchesGrupo && matchesSearch;
    });
  }, [alumnos, grupoActivo, searchTerm]);

  // Contadores
  const totales = useMemo(() => {
    const list = alumnosFiltrados;
    const presentes = list.filter((a) => a.presente).length;
    return {
      total: list.length,
      presentes,
      ausentes: list.length - presentes,
      porcentaje: list.length > 0 ? Math.round((presentes / list.length) * 100) : 0,
    };
  }, [alumnosFiltrados]);

  return (
    <div className="space-y-4">
      {/* Barra superior solo con Fecha y botón refrescar */}
      <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400 shrink-0">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#AAAAAA] font-bold">Fecha:</span>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-8 text-xs font-bold bg-[#242424] border-[#383838] text-white w-auto"
            />
          </div>
        </div>

        <Button
          size="sm"
          variant="ghost"
          onClick={fetchAsistencias}
          disabled={loading}
          className="h-8 w-8 p-0 text-[#888] hover:text-white"
          title="Refrescar lista"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-amber-400' : ''}`} />
        </Button>
      </div>

      {/* Filtros de grupos compactos y más chicos */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => setGrupoActivo('todos')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 border ${
            grupoActivo === 'todos'
              ? 'bg-amber-400 text-black border-amber-400 shadow-sm'
              : 'bg-[#1C1C1C] text-[#AAAAAA] hover:text-white border-[#2E2E2E]'
          }`}
        >
          Todos ({alumnos.length})
        </button>

        {GRUPOS.map((g) => {
          const cfg = GRUPO_CONFIG[g];
          const count = alumnos.filter((a) => a.grupo === g).length;
          const isActive = grupoActivo === g;

          return (
            <button
              key={g}
              type="button"
              onClick={() => setGrupoActivo(g)}
              className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all shrink-0 border ${
                isActive
                  ? 'bg-amber-400 text-black border-amber-400 shadow-sm'
                  : 'bg-[#1C1C1C] text-[#AAAAAA] hover:text-white border-[#2E2E2E]'
              }`}
            >
              <span>{cfg.label}</span>
              <span className={`ml-1 text-[11px] ${isActive ? 'text-black/80' : 'text-[#777]'}`}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      {/* Buscador y Acciones Masivas compactas */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#888]" />
          <Input
            placeholder="Buscar alumno..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-8 text-xs bg-[#1C1C1C] border-[#2E2E2E] text-white"
          />
        </div>

        <Button
          size="sm"
          onClick={() => marcarMasivo(true)}
          disabled={savingAll || alumnosFiltrados.length === 0}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 px-2.5 gap-1 shrink-0"
          title="Marcar todos los visibles como presentes"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Todos</span> Presentes
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => marcarMasivo(false)}
          disabled={savingAll || alumnosFiltrados.length === 0}
          className="bg-[#242424] border-[#383838] text-[#AAAAAA] hover:text-white font-bold text-xs h-8 px-2.5 gap-1 shrink-0"
          title="Limpiar asistencias"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Limpiar</span>
        </Button>
      </div>

      {/* Lista Táctil de Alumnos en 2 COLUMNAS (El nombre es el botón que conmuta Presente/Ausente) */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-16 bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : alumnosFiltrados.length === 0 ? (
        <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-8 text-center text-xs text-[#777]">
          <Users className="h-8 w-8 mx-auto opacity-40 text-amber-400 mb-2" />
          <p>No se encontraron alumnos para el filtro seleccionado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
          {alumnosFiltrados.map((al) => {
            const isSaving = savingId === al.id;
            const isPresent = al.presente;

            return (
              <button
                key={al.id}
                type="button"
                onClick={() => toggleAsistencia(al)}
                disabled={isSaving}
                className={`relative select-none rounded-xl p-2.5 sm:p-3 border text-left transition-all duration-150 flex flex-col justify-between min-h-[64px] active:scale-[0.97] ${
                  isPresent
                    ? 'bg-emerald-500 text-black border-emerald-400 shadow-md shadow-emerald-500/20'
                    : 'bg-[#1C1C1C] border-[#2E2E2E] text-[#AAAAAA] hover:border-[#444] hover:bg-[#222222]'
                }`}
              >
                <div className="flex items-start justify-between gap-1 w-full">
                  <span className={`font-black text-xs sm:text-sm leading-tight line-clamp-2 ${
                    isPresent ? 'text-black' : 'text-white'
                  }`}>
                    {al.nombre}
                  </span>
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-amber-400" />
                  ) : isPresent ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-black fill-black/20" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-[#555]" />
                  )}
                </div>

                <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-black/10 dark:border-white/5 w-full">
                  <span className={`text-[10px] font-bold uppercase truncate ${
                    isPresent ? 'text-black/80' : 'text-[#777]'
                  }`}>
                    {al.grupo === 'Grupo Entrenamiento' ? 'Entrenamiento' : al.grupo}
                  </span>
                  <span className={`text-[9px] font-mono uppercase tracking-wider font-extrabold px-1.5 py-0.2 rounded ${
                    isPresent ? 'bg-black text-emerald-400' : 'bg-[#282828] text-[#888]'
                  }`}>
                    {isPresent ? 'PRESENTE' : 'AUSENTE'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

