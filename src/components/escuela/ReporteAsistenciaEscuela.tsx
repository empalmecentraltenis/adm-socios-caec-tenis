'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar,
  Users,
  Search,
  FileSpreadsheet,
  RefreshCw,
  Loader2,
  TrendingUp,
  Percent,
  CheckCircle2,
  XCircle,
  Sparkles,
  GraduationCap,
  Trophy,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface AlumnoReporteItem {
  id: string;
  nombre: string;
  grupo: string;
  edad?: number | null;
  tutor?: string | null;
  telefono?: string | null;
  presentes: number;
  totalClases: number;
  porcentaje: number;
  detallePorFecha: Record<string, boolean>;
}

const GRUPOS = ['Escuelita', 'Minitenis', 'Grupo Entrenamiento'] as const;

export default function ReporteAsistenciaEscuela() {
  const { toast } = useToast();

  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getCurMonthStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const [tipoReporte, setTipoReporte] = useState<'semana' | 'mes' | 'rango'>('mes');
  const [fechaRef, setFechaRef] = useState<string>(getTodayStr());
  const [mesRef, setMesRef] = useState<string>(getCurMonthStr());
  const [fechaDesde, setFechaDesde] = useState<string>('');
  const [fechaHasta, setFechaHasta] = useState<string>('');
  const [grupoFiltro, setGrupoFiltro] = useState<string>('todos');
  const [search, setSearch] = useState<string>('');

  const [alumnos, setAlumnos] = useState<AlumnoReporteItem[]>([]);
  const [fechasConClase, setFechasConClase] = useState<string[]>([]);
  const [periodoLabel, setPeriodoLabel] = useState<string>('');
  const [totalClases, setTotalClases] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Cargar reporte del backend
  const fetchReporte = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('modo', tipoReporte);
      if (grupoFiltro !== 'todos') params.append('grupo', grupoFiltro);

      if (tipoReporte === 'semana') {
        params.append('fecha', fechaRef);
      } else if (tipoReporte === 'mes') {
        params.append('mes', mesRef);
      } else {
        if (fechaDesde) params.append('desde', fechaDesde);
        if (fechaHasta) params.append('hasta', fechaHasta);
      }

      const res = await fetch(`/api/asistencias-escuela?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAlumnos(data.alumnos || []);
        setFechasConClase(data.fechasConClase || []);
        setPeriodoLabel(data.periodoLabel || '');
        setTotalClases(data.totalClases || 0);
      } else {
        toast({
          title: 'Error al cargar reporte',
          description: 'No se pudieron obtener los datos de asistencia.',
          variant: 'destructive',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [tipoReporte, fechaRef, mesRef, fechaDesde, fechaHasta, grupoFiltro, toast]);

  useEffect(() => {
    fetchReporte();
  }, [fetchReporte]);

  // Alumnos filtrados por búsqueda
  const alumnosFiltrados = useMemo(() => {
    if (!search.trim()) return alumnos;
    const term = search.toLowerCase().trim();
    return alumnos.filter(
      (a) =>
        a.nombre.toLowerCase().includes(term) ||
        (a.tutor && a.tutor.toLowerCase().includes(term)) ||
        a.grupo.toLowerCase().includes(term)
    );
  }, [alumnos, search]);

  // Estadísticas globales del período
  const resumenStats = useMemo(() => {
    const totalAlumnos = alumnosFiltrados.length;
    if (totalAlumnos === 0) return { totalAlumnos: 0, promedioAsistencia: 0, asistenciaPerfecta: 0, ausenciasCriticas: 0 };

    const sumaPorcentajes = alumnosFiltrados.reduce((acc, a) => acc + a.porcentaje, 0);
    const promedioAsistencia = Math.round(sumaPorcentajes / totalAlumnos);
    const asistenciaPerfecta = alumnosFiltrados.filter((a) => a.porcentaje === 100 && a.totalClases > 0).length;
    const ausenciasCriticas = alumnosFiltrados.filter((a) => a.porcentaje < 50 && a.totalClases > 0).length;

    return {
      totalAlumnos,
      promedioAsistencia,
      asistenciaPerfecta,
      ausenciasCriticas,
    };
  }, [alumnosFiltrados]);

  // Exportar a Excel
  const handleExportExcel = () => {
    if (alumnosFiltrados.length === 0) return;

    const rows = alumnosFiltrados.map((a, idx) => {
      const baseRow: Record<string, any> = {
        '#': idx + 1,
        Alumno: a.nombre,
        Grupo: a.grupo,
        Edad: a.edad ?? '-',
        Tutor: a.tutor ?? '-',
        Teléfono: a.telefono ?? '-',
        'Clases Presente': a.presentes,
        'Total Clases Período': a.totalClases,
        '% Asistencia': `${a.porcentaje}%`,
      };

      // Agregar columnas de cada fecha de clase
      for (const f of fechasConClase) {
        baseRow[f] = a.detallePorFecha[f] ? 'PRESENTE' : 'AUSENTE';
      }

      return baseRow;
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Reporte Asistencias');
    XLSX.writeFile(wb, `Reporte_Asistencias_Escuela_${tipoReporte.toUpperCase()}_${new Date().toISOString().split('T')[0]}.xlsx`);

    toast({
      title: 'Excel generado',
      description: 'El reporte de asistencia se descargó con éxito.',
    });
  };

  return (
    <div className="space-y-4">
      {/* Controles de Selección de Reporte */}
      <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-2xl p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2A2A] pb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-400" />
              <span>Reportes de Asistencia de Escuela</span>
            </h3>
            <p className="text-xs text-[#888888] mt-0.5">
              {periodoLabel ? `Período: ${periodoLabel}` : 'Consulta de concurrencia y ausencias'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleExportExcel}
              disabled={alumnosFiltrados.length === 0}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Exportar Excel</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchReporte}
              disabled={loading}
              className="bg-[#242424] border-[#383838] text-white hover:bg-[#2F2F2F] h-8 w-8 p-0"
              title="Refrescar reporte"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Botones de Modo: Semana, Mes, Rango */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setTipoReporte('semana')}
            className={`p-3 rounded-xl border text-left transition-all ${
              tipoReporte === 'semana'
                ? 'bg-amber-400 text-black border-amber-400 shadow-md font-bold'
                : 'bg-[#141414] text-[#AAAAAA] hover:text-white border-[#2A2A2A]'
            }`}
          >
            <span className="text-xs uppercase font-extrabold block">Reporte Semanal</span>
            <span className="text-[11px] opacity-80 block mt-0.5">Asistencias lunes a domingo</span>
          </button>

          <button
            type="button"
            onClick={() => setTipoReporte('mes')}
            className={`p-3 rounded-xl border text-left transition-all ${
              tipoReporte === 'mes'
                ? 'bg-amber-400 text-black border-amber-400 shadow-md font-bold'
                : 'bg-[#141414] text-[#AAAAAA] hover:text-white border-[#2A2A2A]'
            }`}
          >
            <span className="text-xs uppercase font-extrabold block">Reporte Mensual</span>
            <span className="text-[11px] opacity-80 block mt-0.5">Mes calendario completo</span>
          </button>

          <button
            type="button"
            onClick={() => setTipoReporte('rango')}
            className={`p-3 rounded-xl border text-left transition-all ${
              tipoReporte === 'rango'
                ? 'bg-amber-400 text-black border-amber-400 shadow-md font-bold'
                : 'bg-[#141414] text-[#AAAAAA] hover:text-white border-[#2A2A2A]'
            }`}
          >
            <span className="text-xs uppercase font-extrabold block">Rango Personalizado</span>
            <span className="text-[11px] opacity-80 block mt-0.5">Elegir fechas desde y hasta</span>
          </button>
        </div>

        {/* Inputs dinámicos según el modo */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          {tipoReporte === 'semana' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#888]">Cualquier día de la semana:</span>
              <Input
                type="date"
                value={fechaRef}
                onChange={(e) => setFechaRef(e.target.value)}
                className="h-8 text-xs bg-[#242424] border-[#383838] text-white w-40"
              />
            </div>
          )}

          {tipoReporte === 'mes' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#888]">Mes:</span>
              <Input
                type="month"
                value={mesRef}
                onChange={(e) => setMesRef(e.target.value)}
                className="h-8 text-xs bg-[#242424] border-[#383838] text-white w-40"
              />
            </div>
          )}

          {tipoReporte === 'rango' && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-[#888]">Desde:</span>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                className="h-8 text-xs bg-[#242424] border-[#383838] text-white w-36"
              />
              <span className="text-xs text-[#888]">Hasta:</span>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                className="h-8 text-xs bg-[#242424] border-[#383838] text-white w-36"
              />
            </div>
          )}

          {/* Filtro por grupo */}
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-xs text-[#888]">Grupo:</span>
            <select
              value={grupoFiltro}
              onChange={(e) => setGrupoFiltro(e.target.value)}
              className="h-8 text-xs bg-[#242424] border border-[#383838] text-white rounded-lg px-2"
            >
              <option value="todos">Todos los grupos</option>
              {GRUPOS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tarjetas KPIs del Reporte */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
          <div className="flex items-center justify-between text-[#888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Clases Dictadas</span>
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          <span className="text-2xl font-black text-white mt-1 block">{totalClases}</span>
          <span className="text-[10px] text-[#777]">días con clase registrada</span>
        </div>

        <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
          <div className="flex items-center justify-between text-[#888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Promedio Concurrencia</span>
            <Percent className="h-4 w-4 text-amber-400" />
          </div>
          <span className="text-2xl font-black text-amber-400 mt-1 block">
            {resumenStats.promedioAsistencia}%
          </span>
          <span className="text-[10px] text-[#777]">asistencia global</span>
        </div>

        <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
          <div className="flex items-center justify-between text-[#888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Asistencia Perfecta</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <span className="text-2xl font-black text-emerald-400 mt-1 block">
            {resumenStats.asistenciaPerfecta}
          </span>
          <span className="text-[10px] text-[#777]">100% de asistencia</span>
        </div>

        <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
          <div className="flex items-center justify-between text-[#888]">
            <span className="text-[10px] font-bold uppercase tracking-wider">Alerta Ausencias</span>
            <XCircle className="h-4 w-4 text-red-400" />
          </div>
          <span className="text-2xl font-black text-red-400 mt-1 block">
            {resumenStats.ausenciasCriticas}
          </span>
          <span className="text-[10px] text-[#777]">menos del 50%</span>
        </div>
      </div>

      {/* Buscador de Alumno */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#888]" />
        <Input
          placeholder="Filtrar reporte por alumno o tutor..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-xs bg-[#1C1C1C] border-[#2E2E2E] text-white"
        />
      </div>

      {/* Tabla Detallada de Asistencias del Período */}
      <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#888] space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-400" />
            <p>Calculando reporte de asistencia...</p>
          </div>
        ) : alumnosFiltrados.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#888]">
            No se encontraron alumnos para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#242424] text-[#AAAAAA] uppercase font-bold text-[10px] border-b border-[#2E2E2E]">
                <tr>
                  <th className="py-2.5 px-3">Alumno</th>
                  <th className="py-2.5 px-2">Grupo</th>
                  <th className="py-2.5 px-2 text-center">Clases Asistidas</th>
                  <th className="py-2.5 px-2 text-center">% Asistencia</th>
                  <th className="py-2.5 px-3">Tutor / Teléfono</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262626]">
                {alumnosFiltrados.map((al) => {
                  return (
                    <tr key={al.id} className="hover:bg-[#222222] transition-colors">
                      <td className="py-3 px-3">
                        <span className="font-bold text-white block text-sm">{al.nombre}</span>
                        {al.edad ? <span className="text-[10px] text-[#777]">{al.edad} años</span> : null}
                      </td>

                      <td className="py-3 px-2">
                        <Badge
                          variant="outline"
                          className="text-[9px] font-bold uppercase border-white/10 text-[#CCCCCC]"
                        >
                          {al.grupo}
                        </Badge>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <span className="font-extrabold text-sm text-white">
                          {al.presentes} <span className="text-[11px] text-[#777] font-normal">/ {al.totalClases}</span>
                        </span>
                      </td>

                      <td className="py-3 px-2 text-center">
                        <Badge
                          className={`text-xs font-black px-2 py-0.5 border ${
                            al.porcentaje >= 80
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : al.porcentaje >= 50
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'
                          }`}
                        >
                          {al.porcentaje}%
                        </Badge>
                      </td>

                      <td className="py-3 px-3">
                        <span className="text-white block text-xs">{al.tutor || '-'}</span>
                        <span className="text-[10px] text-[#777]">{al.telefono || '-'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

