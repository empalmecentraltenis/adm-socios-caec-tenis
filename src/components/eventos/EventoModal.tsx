'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Plus,
  Trash2,
  Trophy,
  Coffee,
  Sparkles,
  Calendar,
  Save,
  Loader2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';
import { useToast } from '@/hooks/use-toast';
import { EventoInformeData } from './EventoSlideView';

interface EventoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventoToEdit: EventoInformeData | null;
  onSuccess: () => void;
}

type CategoriaRubro = 'torneo' | 'cantina' | 'otros';

interface ItemFormUnificado {
  concepto: string;
  monto: string | number;
  categoria: CategoriaRubro;
}

export default function EventoModal({
  open,
  onOpenChange,
  eventoToEdit,
  onSuccess,
}: EventoModalProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Datos Generales
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [fechaTexto, setFechaTexto] = useState('');
  const [fechaEvento, setFechaEvento] = useState('');
  const [organizador, setOrganizador] = useState('SubComision de Tenis');
  const [notas, setNotas] = useState('');

  // Listas unificadas de Ingresos y Egresos (cada fila lleva su rubro/etiqueta)
  const [ingresos, setIngresos] = useState<ItemFormUnificado[]>([]);
  const [egresos, setEgresos] = useState<ItemFormUnificado[]>([]);

  useEffect(() => {
    if (eventoToEdit) {
      setTitulo(eventoToEdit.titulo || '');
      setSubtitulo(eventoToEdit.subtitulo || '');
      setFechaTexto(eventoToEdit.fechaTexto || '');
      
      let fStr = '';
      if (eventoToEdit.fechaEvento) {
        try {
          const d = new Date(eventoToEdit.fechaEvento);
          fStr = d.toISOString().split('T')[0];
        } catch (_) {}
      }
      setFechaEvento(fStr);
      setOrganizador(eventoToEdit.organizador || 'SubComision de Tenis');
      setNotas(eventoToEdit.notas || '');

      // Unificar todos los ingresos existentes con su categoría
      const unifIngresos: ItemFormUnificado[] = [
        ...(eventoToEdit.ingresosTorneo || []).map((i) => ({
          concepto: i.concepto,
          monto: i.monto,
          categoria: 'torneo' as CategoriaRubro,
        })),
        ...(eventoToEdit.ingresosCantina || []).map((i) => ({
          concepto: i.concepto,
          monto: i.monto,
          categoria: 'cantina' as CategoriaRubro,
        })),
        ...(eventoToEdit.ingresosOtros || []).map((i) => ({
          concepto: i.concepto,
          monto: i.monto,
          categoria: 'otros' as CategoriaRubro,
        })),
      ];

      // Unificar todos los egresos existentes con su categoría
      const unifEgresos: ItemFormUnificado[] = [
        ...(eventoToEdit.egresosTorneo || []).map((i) => ({
          concepto: i.concepto,
          monto: i.monto,
          categoria: 'torneo' as CategoriaRubro,
        })),
        ...(eventoToEdit.egresosCantina || []).map((i) => ({
          concepto: i.concepto,
          monto: i.monto,
          categoria: 'cantina' as CategoriaRubro,
        })),
        ...(eventoToEdit.egresosOtros || []).map((i) => ({
          concepto: i.concepto,
          monto: i.monto,
          categoria: 'otros' as CategoriaRubro,
        })),
      ];

      setIngresos(
        unifIngresos.length > 0
          ? unifIngresos
          : [{ concepto: 'Inscripción Jugadores', monto: '', categoria: 'torneo' }]
      );
      setEgresos(
        unifEgresos.length > 0
          ? unifEgresos
          : [
              { concepto: 'Pelotas / Hidratación', monto: '', categoria: 'torneo' },
              { concepto: 'Bebidas / Hamburguesas', monto: '', categoria: 'cantina' },
            ]
      );
    } else {
      // Valores por defecto para nuevo evento con sugerencias típicas
      setTitulo('');
      setSubtitulo('');
      const today = new Date().toISOString().split('T')[0];
      setFechaEvento(today);
      setFechaTexto('');
      setOrganizador('SubComision de Tenis');
      setNotas('');

      setIngresos([
        { concepto: 'Total pago Jugadores', monto: '', categoria: 'torneo' },
        { concepto: 'Venta Cantina Efectivo', monto: '', categoria: 'cantina' },
        { concepto: 'Venta Cantina Transferencia', monto: '', categoria: 'cantina' },
      ]);

      setEgresos([
        { concepto: 'Pelotas / Tubos', monto: '', categoria: 'torneo' },
        { concepto: 'Hidratación / Frutas', monto: '', categoria: 'torneo' },
        { concepto: 'Bebidas Cantina', monto: '', categoria: 'cantina' },
        { concepto: 'Hamburguesas / Comida', monto: '', categoria: 'cantina' },
      ]);
    }
  }, [eventoToEdit, open]);

  // Manejo de arrays dinámicos
  const handleItemChange = (
    setter: React.Dispatch<React.SetStateAction<ItemFormUnificado[]>>,
    index: number,
    field: 'concepto' | 'monto' | 'categoria',
    value: any
  ) => {
    setter((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addItem = (
    setter: React.Dispatch<React.SetStateAction<ItemFormUnificado[]>>,
    categoriaDefault: CategoriaRubro = 'torneo'
  ) => {
    setter((prev) => [...prev, { concepto: '', monto: '', categoria: categoriaDefault }]);
  };

  const removeItem = (
    setter: React.Dispatch<React.SetStateAction<ItemFormUnificado[]>>,
    index: number
  ) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculo en vivo
  const calcSum = (list: ItemFormUnificado[]) =>
    list.reduce((acc, it) => acc + (parseFloat(String(it.monto)) || 0), 0);

  const totalIngresos = calcSum(ingresos);
  const totalEgresos = calcSum(egresos);
  const totalGeneralNeto = totalIngresos - totalEgresos;

  // Totales por rubro para vista previa rápida
  const getSubtotal = (list: ItemFormUnificado[], cat: CategoriaRubro) =>
    list
      .filter((it) => it.categoria === cat)
      .reduce((acc, it) => acc + (parseFloat(String(it.monto)) || 0), 0);

  const ingTorneo = getSubtotal(ingresos, 'torneo');
  const egrTorneo = getSubtotal(egresos, 'torneo');
  const ingCantina = getSubtotal(ingresos, 'cantina');
  const egrCantina = getSubtotal(egresos, 'cantina');
  const ingOtros = getSubtotal(ingresos, 'otros');
  const egrOtros = getSubtotal(egresos, 'otros');

  // Guardar en la DB
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) {
      toast({ title: 'Error', description: 'El título del evento es obligatorio', variant: 'destructive' });
      return;
    }
    if (!fechaTexto.trim()) {
      toast({ title: 'Error', description: 'Por favor indicá el texto de fecha (ej. "Viernes 4 a Domingo 6 Septiembre 2026")', variant: 'destructive' });
      return;
    }
    if (!fechaEvento) {
      toast({ title: 'Error', description: 'Seleccioná una fecha calendario para ordenar cronológicamente', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Filtrar items vacíos
      const cleanList = (list: ItemFormUnificado[]) =>
        list
          .filter((it) => it.concepto.trim() || (parseFloat(String(it.monto)) || 0) > 0)
          .map((it) => ({
            concepto: it.concepto.trim() || 'Concepto sin nombre',
            monto: parseFloat(String(it.monto)) || 0,
            categoria: it.categoria,
          }));

      const allIng = cleanList(ingresos);
      const allEgr = cleanList(egresos);

      // Desglosar en los arrays que almacena la base de datos y que usa la Diapositiva
      const payload = {
        titulo: titulo.trim(),
        subtitulo: subtitulo.trim() || null,
        fechaTexto: fechaTexto.trim(),
        fechaEvento,
        organizador: organizador.trim() || 'SubComision de Tenis',
        estado: 'finalizado',
        ingresosTorneo: allIng.filter((i) => i.categoria === 'torneo').map(({ concepto, monto }) => ({ concepto, monto })),
        egresosTorneo: allEgr.filter((i) => i.categoria === 'torneo').map(({ concepto, monto }) => ({ concepto, monto })),
        ingresosCantina: allIng.filter((i) => i.categoria === 'cantina').map(({ concepto, monto }) => ({ concepto, monto })),
        egresosCantina: allEgr.filter((i) => i.categoria === 'cantina').map(({ concepto, monto }) => ({ concepto, monto })),
        ingresosOtros: allIng.filter((i) => i.categoria === 'otros').map(({ concepto, monto }) => ({ concepto, monto })),
        egresosOtros: allEgr.filter((i) => i.categoria === 'otros').map(({ concepto, monto }) => ({ concepto, monto })),
        notas: notas.trim() || null,
      };

      const endpoint = eventoToEdit?.id
        ? `/api/eventos-informes/${eventoToEdit.id}`
        : '/api/eventos-informes';
      const method = eventoToEdit?.id ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo guardar el informe');
      }

      toast({
        title: eventoToEdit ? 'Informe actualizado' : 'Informe creado',
        description: `Se guardó correctamente el balance de "${titulo}".`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      console.error(err);
      toast({
        title: 'Error al guardar',
        description: err.message || 'Ocurrió un error inesperado al guardar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderItemRows = (
    items: ItemFormUnificado[],
    setter: React.Dispatch<React.SetStateAction<ItemFormUnificado[]>>,
    placeholderConcepto: string,
    tipo: 'ingreso' | 'egreso'
  ) => (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2 group bg-[#111115] p-1.5 rounded-lg border border-[#22222a] hover:border-[#353545] transition-colors">
          {/* Selector de Rubro / Tipo */}
          <select
            value={item.categoria}
            onChange={(e) => handleItemChange(setter, idx, 'categoria', e.target.value as CategoriaRubro)}
            className="bg-[#1b1b22] border border-[#2f2f3d] text-[11px] font-bold rounded-md px-2 h-9 text-[#d0d0d8] focus:outline-none focus:ring-1 focus:ring-amber-400 shrink-0"
            title="Seleccionar rubro del movimiento"
          >
            <option value="torneo">🏆 Torneo / Evento</option>
            <option value="cantina">☕ Cantina - Kiosco</option>
            <option value="otros">✨ Otros / Sponsors</option>
          </select>

          {/* Concepto libre */}
          <Input
            value={item.concepto}
            onChange={(e) => handleItemChange(setter, idx, 'concepto', e.target.value)}
            placeholder={placeholderConcepto}
            className="flex-1 bg-[#16161b] border-[#2b2b35] text-xs h-9 text-white placeholder:text-[#555]"
          />

          {/* Importe numérico sin flechitas */}
          <div className="relative w-32 sm:w-44 shrink-0">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#777] font-bold">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={item.monto === '' ? '' : item.monto}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                handleItemChange(setter, idx, 'monto', val);
              }}
              placeholder="0"
              className="w-full pl-6 pr-2 bg-[#16161b] border border-[#2b2b35] rounded-md text-xs h-9 text-white font-mono placeholder:text-[#555] focus:outline-none focus:ring-1 focus:ring-amber-400 font-bold"
            />
          </div>

          {/* Botón quitar fila */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeItem(setter, idx)}
            className="h-9 w-9 p-0 text-[#666] hover:text-red-400 hover:bg-red-500/10 shrink-0"
            title="Quitar fila"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <div className="flex items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addItem(setter, 'torneo')}
          className="flex-1 text-xs h-8 bg-[#15151a] border-dashed border-[#333] hover:border-amber-400/50 hover:bg-amber-400/5 text-[#aaa] hover:text-amber-300 gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Agregar {tipo === 'ingreso' ? 'Ingreso' : 'Gasto'}</span>
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[95vw] !w-[95vw] lg:!max-w-[1360px] xl:!max-w-[1440px] max-h-[94vh] bg-[#111114] border-[#26262e] text-white p-0 overflow-hidden shadow-2xl !top-[50%] !translate-y-[-50%] flex flex-col">
        <form onSubmit={handleSave} className="flex flex-col h-full max-h-[94vh] overflow-hidden">
          {/* Header */}
          <DialogHeader className="p-4 sm:p-5 bg-[#16161b] border-b border-[#25252f] flex flex-row items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-white">
                  {eventoToEdit ? 'Editar Informe de Evento' : 'Nuevo Informe de Torneo / Evento'}
                </DialogTitle>
                <p className="text-xs text-[#888894]">
                  Carga unificada de ingresos y gastos de torneos, cantina y otros para Comisión Directiva
                </p>
              </div>
            </div>

            {/* Resumen rápido en header */}
            <div className="hidden md:flex items-center gap-4 bg-[#101013] px-4 py-2 rounded-xl border border-[#252530] text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[#888]">Ingresos:</span>
                <span className="font-mono font-bold text-emerald-400">{formatCurrency(totalIngresos)}</span>
              </div>
              <div className="h-4 w-px bg-[#2b2b35]" />
              <div className="flex items-center gap-1.5">
                <span className="text-[#888]">Egresos:</span>
                <span className="font-mono font-bold text-red-400">{formatCurrency(totalEgresos)}</span>
              </div>
              <div className="h-4 w-px bg-[#2b2b35]" />
              <div className="flex items-center gap-1.5 font-bold">
                <span className="text-amber-300">Resultado:</span>
                <span className={`font-mono text-sm ${totalGeneralNeto >= 0 ? 'text-[#FFCC00]' : 'text-red-400'}`}>
                  {formatCurrency(totalGeneralNeto)}
                </span>
              </div>
            </div>
          </DialogHeader>

          {/* Formulario Unificado */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-5 flex-1">
            {/* SECCIÓN 1: DATOS BÁSICOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#141419] p-4 rounded-xl border border-[#23232c]">
              <div className="sm:col-span-2">
                <Label className="text-xs text-[#aaa] font-bold">
                  Título del Evento / Torneo <span className="text-amber-400">*</span>
                </Label>
                <Input
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej: INTERCLUBES, PEÑA TENIS, TORNEO PRIMAVERA"
                  className="mt-1 bg-[#101013] border-[#2c2c36] text-sm h-10 text-white font-bold"
                />
              </div>

              <div>
                <Label className="text-xs text-[#aaa]">Subtítulo o Aclaración</Label>
                <Input
                  value={subtitulo}
                  onChange={(e) => setSubtitulo(e.target.value)}
                  placeholder="Ej: JORNADA DE INTEGRACION ENTRE CLUBES"
                  className="mt-1 bg-[#101013] border-[#2c2c36] text-xs h-10 text-white"
                />
              </div>

              <div>
                <Label className="text-xs text-[#aaa]">Organizador / Responsable</Label>
                <Input
                  value={organizador}
                  onChange={(e) => setOrganizador(e.target.value)}
                  placeholder="SubComision de Tenis"
                  className="mt-1 bg-[#101013] border-[#2c2c36] text-xs h-10 text-white"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs text-[#aaa]">
                  Texto de Fecha en Diapositiva <span className="text-amber-400">*</span>
                </Label>
                <Input
                  required
                  value={fechaTexto}
                  onChange={(e) => setFechaTexto(e.target.value)}
                  placeholder="Ej: Viernes 4 a Domingo 6 Septiembre de 2026"
                  className="mt-1 bg-[#101013] border-[#2c2c36] text-xs h-9 text-white font-serif"
                />
              </div>

              <div className="sm:col-span-2">
                <Label className="text-xs text-[#aaa]">
                  Fecha Calendario (Para orden cronológico) <span className="text-amber-400">*</span>
                </Label>
                <Input
                  required
                  type="date"
                  value={fechaEvento}
                  onChange={(e) => setFechaEvento(e.target.value)}
                  className="mt-1 bg-[#101013] border-[#2c2c36] text-xs h-9 text-white"
                />
              </div>
            </div>

            {/* SECCIÓN 2: PLANILLA UNIFICADA DE INGRESOS Y EGRESOS A DOS COLUMNAS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* COLUMNA IZQUIERDA: INGRESOS UNIFICADOS */}
              <div className="bg-[#141418] border border-[#23232b] rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#24242e] pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <TrendingUp className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-emerald-300">
                        Todos los Ingresos
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-emerald-400">
                      {formatCurrency(totalIngresos)}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#777]">
                    Podés cargar inscripciones, venta de cantina o auspicios. Elegí el rubro de cada fila con el desplegable.
                  </p>

                  {renderItemRows(ingresos, setIngresos, 'Ej: Venta de Pollos, Jugadores, etc.', 'ingreso')}
                </div>

                {/* Subtotales informativos de Ingresos */}
                <div className="pt-2 border-t border-[#1e1e24] flex items-center justify-between text-[11px] text-[#888] flex-wrap gap-2">
                  <span>🏆 Torneo: <b className="text-white font-mono">{formatCurrency(ingTorneo)}</b></span>
                  <span>☕ Cantina: <b className="text-white font-mono">{formatCurrency(ingCantina)}</b></span>
                  {ingOtros > 0 && <span>✨ Otros: <b className="text-white font-mono">{formatCurrency(ingOtros)}</b></span>}
                </div>
              </div>

              {/* COLUMNA DERECHA: EGRESOS UNIFICADOS */}
              <div className="bg-[#141418] border border-[#23232b] rounded-xl p-4 flex flex-col justify-between space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-[#24242e] pb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
                        <TrendingDown className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-red-300">
                        Todos los Gastos / Egresos
                      </span>
                    </div>
                    <span className="text-sm font-mono font-bold text-red-400">
                      {formatCurrency(totalEgresos)}
                    </span>
                  </div>

                  <p className="text-[11px] text-[#777]">
                    Cargá pelotas, hidratación, verdulería, limpieza o compras de cantina.
                  </p>

                  {renderItemRows(egresos, setEgresos, 'Ej: Pelotas, Hamburguesas, Limpieza, etc.', 'egreso')}
                </div>

                {/* Subtotales informativos de Egresos */}
                <div className="pt-2 border-t border-[#1e1e24] flex items-center justify-between text-[11px] text-[#888] flex-wrap gap-2">
                  <span>🏆 Torneo: <b className="text-white font-mono">{formatCurrency(egrTorneo)}</b></span>
                  <span>☕ Cantina: <b className="text-white font-mono">{formatCurrency(egrCantina)}</b></span>
                  {egrOtros > 0 && <span>✨ Otros: <b className="text-white font-mono">{formatCurrency(egrOtros)}</b></span>}
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: NOTAS Y OBSERVACIONES */}
            <div>
              <Label className="text-xs text-[#aaa]">Observaciones o notas adicionales</Label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: Se contó con la participación de 33 personas, 4 clubes de la zona..."
                className="mt-1 bg-[#101013] border-[#2c2c36] text-xs h-9 text-white"
              />
            </div>
          </div>

          {/* Footer Fijo con Totales y Botón Guardar */}
          <DialogFooter className="p-4 bg-[#141418] border-t border-[#25252f] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-xs uppercase tracking-wider text-[#888] font-bold">
                Recaudación Total para Subcomisión:
              </span>
              <span className={`text-base font-black font-mono px-3 py-1 rounded-lg border ${
                totalGeneralNeto >= 0
                  ? 'text-[#FFCC00] bg-black/40 border-[#FFCC00]/30'
                  : 'text-red-400 bg-red-950/30 border-red-500/30'
              }`}>
                {formatCurrency(totalGeneralNeto)}
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="text-xs h-9 bg-[#1b1b22] border-[#2c2c36] text-zinc-300"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="text-xs h-9 bg-[#FFCC00] hover:bg-[#e6b800] text-black font-black gap-1.5 px-4"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Guardar Informe</span>
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
