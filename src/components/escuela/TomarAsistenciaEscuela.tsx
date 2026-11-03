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
      {/* Barra superior con Fecha y Resumen */}
      <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-400/10 text-amber-400 shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">
              Fecha de la Clase
            </span>
            <Input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-8 text-xs font-bold bg-[#242424] border-[#383838] text-white mt-0.5 w-auto"
            />
          </div>
        </div>

        {/* Resumen táctil rápido */}
        <div className="flex items-center gap-2 bg-[#141414] border border-[#2B2B2B] rounded-xl px-3 py-2">
          <div className="text-center px-2">
            <span className="text-[10px] text-[#888] uppercase font-bold block">Presentes</span>
            <span className="text-base font-black text-emerald-400 block">
              {totales.presentes} / {totales.total}
            </span>
          </div>
          <div className="h-6 w-px bg-[#2B2B2B]" />
          <div className="text-center px-2">
            <span className="text-[10px] text-[#888] uppercase font-bold block">Asistencia</span>
            <span className="text-base font-black text-amber-400 block">{totales.porcentaje}%</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchAsistencias}
            disabled={loading}
            className="h-8 w-8 p-0 text-[#888] hover:text-white"
            title="Refrescar lista"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Selector de Grupo (Botones grandes táctiles para celular) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <button
          type="button"
          onClick={() => setGrupoActivo('todos')}
          className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
            grupoActivo === 'todos'
              ? 'bg-amber-400 text-black border-amber-400 shadow-md scale-[1.02]'
              : 'bg-[#1C1C1C] text-[#AAAAAA] hover:text-white border-[#2E2E2E]'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Todos ({alumnos.length})</span>
        </button>

        {GRUPOS.map((g) => {
          const cfg = GRUPO_CONFIG[g];
          const Icon = cfg.icon;
          const count = alumnos.filter((a) => a.grupo === g).length;
          const presCount = alumnos.filter((a) => a.grupo === g && a.presente).length;
          const isActive = grupoActivo === g;

          return (
            <button
              key={g}
              type="button"
              onClick={() => setGrupoActivo(g)}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 border ${
                isActive
                  ? 'bg-amber-400 text-black border-amber-400 shadow-md scale-[1.02]'
                  : 'bg-[#1C1C1C] text-[#AAAAAA] hover:text-white border-[#2E2E2E]'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-black' : cfg.color}`} />
                <span>{cfg.label}</span>
              </div>
              <span className={`text-[10px] ${isActive ? 'text-black/80 font-mono' : 'text-[#777]'}`}>
                {presCount}/{count} presentes
              </span>
            </button>
          );
        })}
      </div>

      {/* Buscador y Acciones Masivas */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#888]" />
          <Input
            placeholder="Buscar alumno por nombre o tutor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-[#1C1C1C] border-[#2E2E2E] text-white"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => marcarMasivo(true)}
            disabled={savingAll || alumnosFiltrados.length === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 px-3 gap-1.5 flex-1 sm:flex-none"
            title="Marcar todos los visibles como presentes"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            <span>Todos Presentes</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => marcarMasivo(false)}
            disabled={savingAll || alumnosFiltrados.length === 0}
            className="bg-[#242424] border-[#383838] text-[#AAAAAA] hover:text-white font-bold text-xs h-9 px-3 gap-1.5 flex-1 sm:flex-none"
            title="Limpiar asistencias"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Limpiar</span>
          </Button>
        </div>
      </div>

      {/* Lista Táctil de Alumnos (Cards de 1 toque) */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-20 bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : alumnosFiltrados.length === 0 ? (
        <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-2xl p-8 text-center text-xs text-[#777]">
          <Users className="h-8 w-8 mx-auto opacity-40 text-amber-400 mb-2" />
          <p>No se encontraron alumnos para el filtro seleccionado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {alumnosFiltrados.map((al) => {
            const isSaving = savingId === al.id;
            const isPresent = al.presente;
            const cfg = GRUPO_CONFIG[al.grupo] || {
              label: al.grupo,
              color: 'text-zinc-400',
              bg: 'bg-zinc-800',
              border: 'border-zinc-700',
            };

            return (
              <div
                key={al.id}
                onClick={() => toggleAsistencia(al)}
                className={`relative cursor-pointer select-none rounded-xl p-3 border transition-all duration-200 flex items-center justify-between gap-3 active:scale-[0.98] ${
                  isPresent
                    ? 'bg-emerald-950/40 border-emerald-500/50 hover:bg-emerald-950/60 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                    : 'bg-[#1C1C1C] border-[#2E2E2E] hover:bg-[#232323] hover:border-[#3E3E3E]'
                }`}
              >
                {/* Datos del alumno */}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-white truncate block">
                      {al.nombre}
                    </span>
                    {al.edad ? (
                      <span className="text-[10px] text-[#777] shrink-0">({al.edad} años)</span>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant="outline"
                      className={`text-[9px] px-1.5 py-0 font-bold uppercase ${cfg.color} ${cfg.border} ${cfg.bg}`}
                    >
                      {al.grupo}
                    </Badge>
                    {al.tutor && (
                      <span className="text-[10px] text-[#777] truncate">Tutor: {al.tutor}</span>
                    )}
                  </div>
                </div>

                {/* Botón táctil indicador de estado */}
                <div className="shrink-0 flex items-center gap-2">
                  {isSaving ? (
                    <Loader2 className="h-6 w-6 text-amber-400 animate-spin" />
                  ) : isPresent ? (
                    <div className="flex items-center gap-1.5 bg-emerald-500 text-black px-2.5 py-1.5 rounded-lg font-black text-xs shadow-md">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>PRESENTE</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-[#252525] text-[#888888] px-2.5 py-1.5 rounded-lg font-bold text-xs border border-[#333333]">
                      <XCircle className="h-4 w-4 text-[#666]" />
                      <span>AUSENTE</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

