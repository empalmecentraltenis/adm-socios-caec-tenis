'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Trophy,
  Plus,
  Search,
  Calendar,
  Layers,
  Printer,
  Edit2,
  Trash2,
  DollarSign,
  Coffee,
  Sparkles,
  RefreshCw,
  Eye,
  FileText,
  BadgeAlert,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/formatters';
import { useToast } from '@/hooks/use-toast';
import EventoSlideView, { EventoInformeData } from './EventoSlideView';
import EventoModal from './EventoModal';

interface InformesEventosPanelProps {
  readOnly?: boolean;
}

export default function InformesEventosPanel({ readOnly = false }: InformesEventosPanelProps) {
  const { toast } = useToast();

  const [eventos, setEventos] = useState<EventoInformeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [anioFiltro, setAnioFiltro] = useState<string>('todos');

  // Modales
  const [slideModalOpen, setSlideModalOpen] = useState(false);
  const [selectedEventoSlide, setSelectedEventoSlide] = useState<EventoInformeData | null>(null);

  const [formModalOpen, setFormModalOpen] = useState(false);
  const [eventoToEdit, setEventoToEdit] = useState<EventoInformeData | null>(null);

  const fetchEventos = useCallback(async () => {
    setLoading(true);
    try {
      let url = '/api/eventos-informes';
      const params = new URLSearchParams();
      if (search.trim()) params.append('search', search.trim());
      if (anioFiltro !== 'todos') params.append('anio', anioFiltro);

      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Error al cargar informes de eventos');
      const data = await res.json();
      setEventos(data.eventos || []);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los informes de eventos',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [search, anioFiltro, toast]);

  useEffect(() => {
    fetchEventos();
  }, [fetchEventos]);

  // Abrir diapositiva
  const handleVerSlide = (evento: EventoInformeData) => {
    setSelectedEventoSlide(evento);
    setSlideModalOpen(true);
  };

  // Abrir edición
  const handleEditar = (evento: EventoInformeData) => {
    setEventoToEdit(evento);
    setFormModalOpen(true);
  };

  // Crear nuevo
  const handleNuevo = () => {
    setEventoToEdit(null);
    setFormModalOpen(true);
  };

  // Eliminar
  const handleEliminar = async (evento: EventoInformeData) => {
    if (!evento.id) return;
    const confirmacion = window.confirm(
      `¿Estás seguro de eliminar el informe del evento "${evento.titulo}"? Esta acción no se puede deshacer.`
    );
    if (!confirmacion) return;

    try {
      const res = await fetch(`/api/eventos-informes/${evento.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Error al eliminar');

      toast({
        title: 'Evento eliminado',
        description: `Se eliminó el informe de "${evento.titulo}".`,
      });
      fetchEventos();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo eliminar el informe',
        variant: 'destructive',
      });
    }
  };

  // Cálculos de resumen
  const totalRecaudadoHistorico = eventos.reduce(
    (acc, ev) => acc + (Number(ev.totalNeto) || 0),
    0
  );

  return (
    <div className="space-y-6">
      {/* HEADER DEL PANEL */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#141418] border border-[#24242d] p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-black shadow-lg shadow-amber-500/20">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Informes de Eventos
              </h1>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] px-2 py-0.5">
                Comisión Directiva
              </Badge>
            </div>
            <p className="text-xs text-[#8e8e98] mt-0.5">
              Balances económicos detallados de torneos, interclubes y cantina para presentar a los directivos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEventos()}
            disabled={loading}
            className="h-10 px-3 bg-[#1b1b22] border-[#2c2c36] hover:bg-[#252530] text-xs text-zinc-300 gap-1.5"
            title="Refrescar listado"
          >
            <RefreshCw className={`h-4 w-4 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </Button>

          {!readOnly && (
            <Button
              onClick={handleNuevo}
              className="h-10 px-4 bg-[#FFCC00] hover:bg-[#e6b800] text-black font-black text-xs gap-2 shadow-lg shadow-amber-500/20"
            >
              <Plus className="h-4 w-4" />
              <span>Nuevo Informe de Evento</span>
            </Button>
          )}
        </div>
      </div>

      {/* METRIC CARD RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#141418] border border-[#24242d] p-4 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#777]">Eventos Registrados</span>
            <p className="text-2xl font-black text-white font-mono mt-0.5">{eventos.length}</p>
          </div>
          <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 border border-amber-500/20">
            <Trophy className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-[#141418] border border-[#24242d] p-4 rounded-xl flex items-center justify-between sm:col-span-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#777]">
              Total Recaudado Acumulado p/ Subcomisión
            </span>
            <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono mt-0.5">
              {formatCurrency(totalRecaudadoHistorico)}
            </p>
          </div>
          <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
            <TrendingUp className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#131317] border border-[#22222a] p-3 rounded-xl">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#777]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, fecha..."
            className="pl-9 bg-[#1a1a20] border-[#2c2c36] text-xs h-9 text-white placeholder:text-[#555]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <span className="text-xs text-[#777] font-bold uppercase tracking-wider mr-1">Año:</span>
          {['todos', '2026', '2025'].map((anio) => (
            <Button
              key={anio}
              size="sm"
              variant={anioFiltro === anio ? 'default' : 'outline'}
              onClick={() => setAnioFiltro(anio)}
              className={`h-8 text-xs rounded-lg px-2.5 ${
                anioFiltro === anio
                  ? 'bg-amber-500 text-black font-black'
                  : 'bg-[#18181f] border-[#2b2b35] text-[#999] hover:text-white'
              }`}
            >
              {anio === 'todos' ? 'Todos' : anio}
            </Button>
          ))}
        </div>
      </div>

      {/* LISTA DE INFORMES DE EVENTOS */}
      {loading ? (
        <div className="py-20 text-center space-y-3 bg-[#121215] border border-[#202026] rounded-2xl">
          <RefreshCw className="h-8 w-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-xs text-[#888]">Cargando informes de eventos...</p>
        </div>
      ) : eventos.length === 0 ? (
        <div className="py-20 text-center space-y-4 bg-[#121215] border border-[#202026] rounded-2xl p-6">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
            <Trophy className="h-8 w-8" />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-base font-bold text-white">No se encontraron eventos cargados</h3>
            <p className="text-xs text-[#777]">
              Comenzá cargando tu primer balance de torneo, interclubes o jornada con cantina para presentarlo a Comisión Directiva.
            </p>
          </div>
          {!readOnly && (
            <Button
              onClick={handleNuevo}
              className="bg-[#FFCC00] hover:bg-[#e6b800] text-black font-black text-xs gap-2 px-4 h-10"
            >
              <Plus className="h-4 w-4" />
              <span>Cargar Primer Evento</span>
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {eventos.map((ev) => {
            const hasCantina =
              (Array.isArray(ev.ingresosCantina) && ev.ingresosCantina.length > 0) ||
              (Array.isArray(ev.egresosCantina) && ev.egresosCantina.length > 0);

            const hasOtros =
              (Array.isArray(ev.ingresosOtros) && ev.ingresosOtros.length > 0) ||
              (Array.isArray(ev.egresosOtros) && ev.egresosOtros.length > 0);

            // Subtotales
            const sum = (arr: any[]) =>
              (Array.isArray(arr) ? arr : []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);

            const netoTorneo = sum(ev.ingresosTorneo) - sum(ev.egresosTorneo);
            const netoCantina = hasCantina ? sum(ev.ingresosCantina) - sum(ev.egresosCantina) : 0;
            const netoOtros = hasOtros ? sum(ev.ingresosOtros) - sum(ev.egresosOtros) : 0;

            return (
              <div
                key={ev.id}
                className="bg-[#141418] border border-[#24242e] hover:border-[#383848] rounded-2xl p-5 flex flex-col justify-between transition-all shadow-md group relative overflow-hidden"
              >
                {/* Franja superior amarilla decorativa */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-[#FFCC00] opacity-80" />

                <div className="space-y-4">
                  {/* Encabezado del Evento */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-black text-white tracking-tight uppercase group-hover:text-amber-300 transition-colors">
                          {ev.titulo}
                        </h3>
                        <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] px-2 py-0">
                          {ev.estado || 'Finalizado'}
                        </Badge>
                      </div>

                      {ev.subtitulo && (
                        <p className="text-xs font-semibold uppercase text-amber-400/90 mt-0.5">
                          {ev.subtitulo}
                        </p>
                      )}

                      <p className="text-xs text-zinc-400 italic font-serif mt-1 flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-zinc-500 not-italic" />
                        <span>{ev.fechaTexto}</span>
                      </p>
                    </div>

                    {/* Ganancia Neta Destacada */}
                    <div className="text-right shrink-0 bg-[#0e0e11] border border-[#282834] px-3.5 py-2 rounded-xl">
                      <span className="text-[10px] text-[#777] font-bold uppercase tracking-wider block">
                        Superávit Total
                      </span>
                      <span className="text-base sm:text-lg font-black font-mono text-[#FFCC00]">
                        {formatCurrency(ev.totalNeto || 0)}
                      </span>
                    </div>
                  </div>

                  {/* Resumen de Rubros */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                    {/* Torneo */}
                    <div className="bg-[#101014] border border-[#202028] p-2.5 rounded-lg space-y-0.5">
                      <span className="text-[10px] text-[#777] uppercase font-bold flex items-center gap-1">
                        <Trophy className="h-3 w-3 text-amber-400" /> Torneo
                      </span>
                      <p className="font-mono font-bold text-white text-xs">
                        {formatCurrency(netoTorneo)}
                      </p>
                    </div>

                    {/* Cantina */}
                    {hasCantina ? (
                      <div className="bg-[#101014] border border-[#202028] p-2.5 rounded-lg space-y-0.5">
                        <span className="text-[10px] text-[#777] uppercase font-bold flex items-center gap-1">
                          <Coffee className="h-3 w-3 text-amber-400" /> Cantina
                        </span>
                        <p className="font-mono font-bold text-white text-xs">
                          {formatCurrency(netoCantina)}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-[#101014] border border-[#202028] p-2.5 rounded-lg space-y-0.5 opacity-40">
                        <span className="text-[10px] text-[#666] uppercase font-bold">Cantina</span>
                        <p className="font-mono text-zinc-500 text-xs">Sin cantina</p>
                      </div>
                    )}

                    {/* Otros / Sponsors */}
                    {hasOtros ? (
                      <div className="bg-[#101014] border border-[#202028] p-2.5 rounded-lg space-y-0.5 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-[#777] uppercase font-bold flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-amber-400" /> Otros
                        </span>
                        <p className="font-mono font-bold text-white text-xs">
                          {formatCurrency(netoOtros)}
                        </p>
                      </div>
                    ) : (
                      <div className="bg-[#101014] border border-[#202028] p-2.5 rounded-lg space-y-0.5 opacity-40 col-span-2 sm:col-span-1">
                        <span className="text-[10px] text-[#666] uppercase font-bold">Otros Rubros</span>
                        <p className="font-mono text-zinc-500 text-xs">-</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* BOTONES DE ACCIÓN */}
                <div className="flex items-center justify-between border-t border-[#22222a] pt-4 mt-4 gap-2">
                  <Button
                    onClick={() => handleVerSlide(ev)}
                    className="bg-[#1f1f26] hover:bg-amber-500 hover:text-black border border-[#30303c] text-white text-xs font-bold h-9 px-3.5 gap-2 transition-all flex-1"
                  >
                    <Eye className="h-4 w-4 text-amber-400 group-hover:text-black" />
                    <span>Ver Diapositiva / Imprimir</span>
                  </Button>

                  {!readOnly && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditar(ev)}
                        className="h-9 w-9 p-0 text-[#888] hover:text-white hover:bg-[#202028]"
                        title="Editar datos"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEliminar(ev)}
                        className="h-9 w-9 p-0 text-[#888] hover:text-red-400 hover:bg-red-500/10"
                        title="Eliminar informe"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE VISTA EN DIAPOSITIVA */}
      <EventoSlideView
        evento={selectedEventoSlide}
        open={slideModalOpen}
        onOpenChange={setSlideModalOpen}
      />

      {/* MODAL DE CREACIÓN / EDICIÓN */}
      {!readOnly && (
        <EventoModal
          open={formModalOpen}
          onOpenChange={setFormModalOpen}
          eventoToEdit={eventoToEdit}
          onSuccess={fetchEventos}
        />
      )}
    </div>
  );
}
