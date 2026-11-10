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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Trash2,
  Trophy,
  Coffee,
  Sparkles,
  Calendar,
  Save,
  Loader2,
  AlertCircle,
  FileText,
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

interface ItemForm {
  concepto: string;
  monto: string | number;
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

  // Secciones Financieras
  const [ingresosTorneo, setIngresosTorneo] = useState<ItemForm[]>([
    { concepto: 'Total pago Jugadores', monto: '' },
  ]);
  const [egresosTorneo, setEgresosTorneo] = useState<ItemForm[]>([
    { concepto: 'Pelotas', monto: '' },
    { concepto: 'Hidratacion', monto: '' },
  ]);

  const [habilitarCantina, setHabilitarCantina] = useState(true);
  const [ingresosCantina, setIngresosCantina] = useState<ItemForm[]>([
    { concepto: 'Total Venta en Efectivo', monto: '' },
    { concepto: 'Total Venta x Transferencia', monto: '' },
  ]);
  const [egresosCantina, setEgresosCantina] = useState<ItemForm[]>([
    { concepto: 'Hamburguesas', monto: '' },
    { concepto: 'Bebidas', monto: '' },
  ]);

  const [habilitarOtros, setHabilitarOtros] = useState(false);
  const [ingresosOtros, setIngresosOtros] = useState<ItemForm[]>([]);
  const [egresosOtros, setEgresosOtros] = useState<ItemForm[]>([]);

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

      setIngresosTorneo(
        eventoToEdit.ingresosTorneo?.length
          ? eventoToEdit.ingresosTorneo.map((i) => ({ concepto: i.concepto, monto: i.monto }))
          : [{ concepto: 'Total pago Jugadores', monto: '' }]
      );
      setEgresosTorneo(
        eventoToEdit.egresosTorneo?.length
          ? eventoToEdit.egresosTorneo.map((i) => ({ concepto: i.concepto, monto: i.monto }))
          : [{ concepto: 'Pelotas', monto: '' }]
      );

      const hasCantina =
        (eventoToEdit.ingresosCantina && eventoToEdit.ingresosCantina.length > 0) ||
        (eventoToEdit.egresosCantina && eventoToEdit.egresosCantina.length > 0);
      setHabilitarCantina(hasCantina);
      setIngresosCantina(
        eventoToEdit.ingresosCantina?.length
          ? eventoToEdit.ingresosCantina.map((i) => ({ concepto: i.concepto, monto: i.monto }))
          : []
      );
      setEgresosCantina(
        eventoToEdit.egresosCantina?.length
          ? eventoToEdit.egresosCantina.map((i) => ({ concepto: i.concepto, monto: i.monto }))
          : []
      );

      const hasOtros =
        (eventoToEdit.ingresosOtros && eventoToEdit.ingresosOtros.length > 0) ||
        (eventoToEdit.egresosOtros && eventoToEdit.egresosOtros.length > 0);
      setHabilitarOtros(hasOtros);
      setIngresosOtros(
        eventoToEdit.ingresosOtros?.length
          ? eventoToEdit.ingresosOtros.map((i) => ({ concepto: i.concepto, monto: i.monto }))
          : []
      );
      setEgresosOtros(
        eventoToEdit.egresosOtros?.length
          ? eventoToEdit.egresosOtros.map((i) => ({ concepto: i.concepto, monto: i.monto }))
          : []
      );
    } else {
      // Valores por defecto para nuevo evento
      setTitulo('');
      setSubtitulo('');
      const today = new Date().toISOString().split('T')[0];
      setFechaEvento(today);
      setFechaTexto('');
      setOrganizador('SubComision de Tenis');
      setNotas('');

      setIngresosTorneo([{ concepto: 'Total pago Jugadores', monto: '' }]);
      setEgresosTorneo([
        { concepto: 'Hidratacion', monto: '' },
        { concepto: 'Pelotas', monto: '' },
      ]);

      setHabilitarCantina(true);
      setIngresosCantina([
        { concepto: 'Total Venta en Efectivo', monto: '' },
        { concepto: 'Total Venta x Transferencia', monto: '' },
      ]);
      setEgresosCantina([
        { concepto: 'Hamburguesas', monto: '' },
        { concepto: 'Bebidas', monto: '' },
      ]);

      setHabilitarOtros(false);
      setIngresosOtros([]);
      setEgresosOtros([]);
    }
  }, [eventoToEdit, open]);

  // Manejo de arrays dinámicos
  const handleItemChange = (
    setter: React.Dispatch<React.SetStateAction<ItemForm[]>>,
    index: number,
    field: 'concepto' | 'monto',
    value: string
  ) => {
    setter((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addItem = (setter: React.Dispatch<React.SetStateAction<ItemForm[]>>, defaultConcepto = '') => {
    setter((prev) => [...prev, { concepto: defaultConcepto, monto: '' }]);
  };

  const removeItem = (setter: React.Dispatch<React.SetStateAction<ItemForm[]>>, index: number) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  // Cálculo en vivo
  const calcSum = (list: ItemForm[]) =>
    list.reduce((acc, it) => acc + (parseFloat(String(it.monto)) || 0), 0);

  const subTotalIngTorneo = calcSum(ingresosTorneo);
  const subTotalEgrTorneo = calcSum(egresosTorneo);
  const netoTorneo = subTotalIngTorneo - subTotalEgrTorneo;

  const subTotalIngCantina = habilitarCantina ? calcSum(ingresosCantina) : 0;
  const subTotalEgrCantina = habilitarCantina ? calcSum(egresosCantina) : 0;
  const netoCantina = subTotalIngCantina - subTotalEgrCantina;

  const subTotalIngOtros = habilitarOtros ? calcSum(ingresosOtros) : 0;
  const subTotalEgrOtros = habilitarOtros ? calcSum(egresosOtros) : 0;
  const netoOtros = subTotalIngOtros - subTotalEgrOtros;

  const totalGeneralNeto = netoTorneo + netoCantina + netoOtros;

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
      // Limpiar items vacíos
      const cleanList = (list: ItemForm[]) =>
        list
          .filter((it) => it.concepto.trim() || (parseFloat(String(it.monto)) || 0) > 0)
          .map((it) => ({
            concepto: it.concepto.trim() || 'Concepto sin nombre',
            monto: parseFloat(String(it.monto)) || 0,
          }));

      const payload = {
        titulo: titulo.trim(),
        subtitulo: subtitulo.trim() || null,
        fechaTexto: fechaTexto.trim(),
        fechaEvento,
        organizador: organizador.trim() || 'SubComision de Tenis',
        estado: 'finalizado',
        ingresosTorneo: cleanList(ingresosTorneo),
        egresosTorneo: cleanList(egresosTorneo),
        ingresosCantina: habilitarCantina ? cleanList(ingresosCantina) : [],
        egresosCantina: habilitarCantina ? cleanList(egresosCantina) : [],
        ingresosOtros: habilitarOtros ? cleanList(ingresosOtros) : [],
        egresosOtros: habilitarOtros ? cleanList(egresosOtros) : [],
        notas: notas.trim() || null,
      };

      const url = eventoToEdit?.id
        ? `/api/eventos-informes/${eventoToEdit.id}`
        : '/api/eventos-informes';
      const method = eventoToEdit?.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al guardar');
      }

      toast({
        title: '¡Informe guardado con éxito!',
        description: `El evento "${titulo}" se registró correctamente.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo guardar el informe del evento',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderItemRows = (
    items: ItemForm[],
    setter: React.Dispatch<React.SetStateAction<ItemForm[]>>,
    placeholderConcepto: string,
    tipo: 'ingreso' | 'egreso'
  ) => (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={item.concepto}
            onChange={(e) => handleItemChange(setter, idx, 'concepto', e.target.value)}
            placeholder={placeholderConcepto}
            className="flex-1 bg-[#121215] border-[#2b2b35] text-xs h-9 text-white placeholder:text-[#555]"
          />
          <div className="relative w-36 sm:w-44">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#777]">$</span>
            <Input
              type="number"
              step="any"
              value={item.monto}
              onChange={(e) => handleItemChange(setter, idx, 'monto', e.target.value)}
              placeholder="0"
              className="pl-6 bg-[#121215] border-[#2b2b35] text-xs h-9 text-white font-mono placeholder:text-[#555]"
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeItem(setter, idx)}
            className="h-9 w-9 p-0 text-[#777] hover:text-red-400 hover:bg-red-500/10 shrink-0"
            title="Quitar fila"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => addItem(setter)}
        className="w-full text-xs h-8 border-dashed border-[#333] hover:border-amber-400/50 hover:bg-amber-400/5 text-[#aaa] hover:text-amber-300 gap-1 mt-1"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Agregar fila de {tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</span>
      </Button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[850px] w-[95vw] bg-[#111114] border-[#26262e] text-white p-0 overflow-hidden shadow-2xl">
        <form onSubmit={handleSave} className="flex flex-col max-h-[90vh]">
          {/* Header */}
          <DialogHeader className="p-5 bg-[#16161b] border-b border-[#25252f] flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-white">
                  {eventoToEdit ? 'Editar Informe de Evento' : 'Nuevo Informe de Torneo / Evento'}
                </DialogTitle>
                <p className="text-xs text-[#888894]">
                  Cargá los ingresos y egresos para la presentación a Comisión Directiva
                </p>
              </div>
            </div>
          </DialogHeader>

          {/* Formulario con Tabs */}
          <div className="p-5 overflow-y-auto space-y-5 flex-1">
            {/* SECCIÓN 1: DATOS BÁSICOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#141419] p-4 rounded-xl border border-[#23232c]">
              <div className="sm:col-span-2">
                <Label className="text-xs text-[#aaa] font-bold">
                  Título del Evento / Torneo <span className="text-amber-400">*</span>
                </Label>
                <Input
                  required
                  value={titulo}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ej: INTERCLUBES, TORNEO DOBLE MIXTO PRIMAVERA"
                  className="mt-1 bg-[#101013] border-[#2c2c36] text-sm h-10 text-white font-bold"
                />
              </div>

              <div>
                <Label className="text-xs text-[#aaa]">Subtítulo o Aclaración</Label>
                <Input
                  value={subtitulo}
                  onChange={(e) => setSubtitulo(e.target.value)}
                  placeholder="Ej: JORNADA DE INTEGRACION ENTRE CLUBES"
                  className="mt-1 bg-[#101013] border-[#2c2c36] text-xs h-9 text-white"
                />
              </div>

              <div>
                <Label className="text-xs text-[#aaa]">Organizador / Responsable</Label>
                <Input
                  value={organizador}
                  onChange={(e) => setOrganizador(e.target.value)}
                  placeholder="SubComision de Tenis"
                  className="mt-1 bg-[#101013] border-[#2c2c36] text-xs h-9 text-white"
                />
              </div>

              <div>
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

              <div>
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

            {/* SECCIÓN 2: TABS DE INGRESOS Y EGRESOS */}
            <Tabs defaultValue="torneo" className="w-full">
              <TabsList className="grid grid-cols-3 bg-[#16161b] border border-[#262630] p-1 rounded-xl">
                <TabsTrigger value="torneo" className="text-xs font-bold gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                  <Trophy className="h-3.5 w-3.5" />
                  <span>1. Torneo / Deportivo</span>
                </TabsTrigger>
                <TabsTrigger value="cantina" className="text-xs font-bold gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                  <Coffee className="h-3.5 w-3.5" />
                  <span>2. Cantina - Kiosco</span>
                </TabsTrigger>
                <TabsTrigger value="otros" className="text-xs font-bold gap-1.5 data-[state=active]:bg-amber-500 data-[state=active]:text-black">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>3. Otros / Sponsors</span>
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: TORNEO */}
              <TabsContent value="torneo" className="mt-3 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Ingresos Torneo */}
                  <div className="bg-[#141418] border border-[#23232b] rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[#24242e] pb-2">
                      <span className="text-xs font-black uppercase text-amber-300">Ingresos Torneo</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">{formatCurrency(subTotalIngTorneo)}</span>
                    </div>
                    {renderItemRows(ingresosTorneo, setIngresosTorneo, 'Ej: Total pago Jugadores', 'ingreso')}
                  </div>

                  {/* Egresos Torneo */}
                  <div className="bg-[#141418] border border-[#23232b] rounded-xl p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-[#24242e] pb-2">
                      <span className="text-xs font-black uppercase text-amber-400">Egresos Torneo</span>
                      <span className="text-xs font-mono font-bold text-red-400">{formatCurrency(subTotalEgrTorneo)}</span>
                    </div>
                    {renderItemRows(egresosTorneo, setEgresosTorneo, 'Ej: Pelotas, Hidratación', 'egreso')}
                  </div>
                </div>

                <div className="bg-[#18181f] border border-[#292934] p-3 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-bold text-white uppercase">Resultado Neto Torneo:</span>
                  <span className="font-mono font-black text-sm text-amber-300">{formatCurrency(netoTorneo)}</span>
                </div>
              </TabsContent>

              {/* TAB 2: CANTINA */}
              <TabsContent value="cantina" className="mt-3 space-y-4">
                <div className="flex items-center justify-between bg-[#15151a] p-3 rounded-lg border border-[#24242e]">
                  <div className="text-xs">
                    <span className="font-bold text-white block">¿Incluye recaudación de Cantina / Kiosco?</span>
                    <span className="text-[#888]">Activá este tilde para agregar la segunda tabla de venta de comida y bebidas.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={habilitarCantina}
                    onChange={(e) => setHabilitarCantina(e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-700 text-amber-500 focus:ring-amber-400"
                  />
                </div>

                {habilitarCantina && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Ingresos Cantina */}
                      <div className="bg-[#141418] border border-[#23232b] rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-[#24242e] pb-2">
                          <span className="text-xs font-black uppercase text-amber-300">Ingresos Cantina</span>
                          <span className="text-xs font-mono font-bold text-emerald-400">{formatCurrency(subTotalIngCantina)}</span>
                        </div>
                        {renderItemRows(ingresosCantina, setIngresosCantina, 'Ej: Venta en Efectivo / Transferencia', 'ingreso')}
                      </div>

                      {/* Egresos Cantina */}
                      <div className="bg-[#141418] border border-[#23232b] rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-[#24242e] pb-2">
                          <span className="text-xs font-black uppercase text-amber-400">Egresos Cantina</span>
                          <span className="text-xs font-mono font-bold text-red-400">{formatCurrency(subTotalEgrCantina)}</span>
                        </div>
                        {renderItemRows(egresosCantina, setEgresosCantina, 'Ej: Hamburguesas, Bebidas, Limpieza', 'egreso')}
                      </div>
                    </div>

                    <div className="bg-[#18181f] border border-[#292934] p-3 rounded-lg flex items-center justify-between text-xs">
                      <span className="font-bold text-white uppercase">Resultado Neto Cantina:</span>
                      <span className="font-mono font-black text-sm text-amber-300">{formatCurrency(netoCantina)}</span>
                    </div>
                  </>
                )}
              </TabsContent>

              {/* TAB 3: OTROS / SPONSORS */}
              <TabsContent value="otros" className="mt-3 space-y-4">
                <div className="flex items-center justify-between bg-[#15151a] p-3 rounded-lg border border-[#24242e]">
                  <div className="text-xs">
                    <span className="font-bold text-white block">¿Hay otros ingresos o gastos especiales?</span>
                    <span className="text-[#888]">Podés registrar sponsors publicitarios, premios comprados, carpas o sonido.</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={habilitarOtros}
                    onChange={(e) => setHabilitarOtros(e.target.checked)}
                    className="w-5 h-5 rounded border-zinc-700 text-amber-500 focus:ring-amber-400"
                  />
                </div>

                {habilitarOtros && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Otros Ingresos */}
                      <div className="bg-[#141418] border border-[#23232b] rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-[#24242e] pb-2">
                          <span className="text-xs font-black uppercase text-amber-300">Auspiciantes / Sponsors</span>
                          <span className="text-xs font-mono font-bold text-emerald-400">{formatCurrency(subTotalIngOtros)}</span>
                        </div>
                        {renderItemRows(ingresosOtros, setIngresosOtros, 'Ej: Sponsor Banco Mutual', 'ingreso')}
                      </div>

                      {/* Otros Egresos */}
                      <div className="bg-[#141418] border border-[#23232b] rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between border-b border-[#24242e] pb-2">
                          <span className="text-xs font-black uppercase text-amber-400">Otros Egresos Puntuales</span>
                          <span className="text-xs font-mono font-bold text-red-400">{formatCurrency(subTotalEgrOtros)}</span>
                        </div>
                        {renderItemRows(egresosOtros, setEgresosOtros, 'Ej: Trofeos y Medallas', 'egreso')}
                      </div>
                    </div>

                    <div className="bg-[#18181f] border border-[#292934] p-3 rounded-lg flex items-center justify-between text-xs">
                      <span className="font-bold text-white uppercase">Resultado Neto Otros Rubros:</span>
                      <span className="font-mono font-black text-sm text-amber-300">{formatCurrency(netoOtros)}</span>
                    </div>
                  </>
                )}
              </TabsContent>
            </Tabs>

            {/* SECCIÓN 3: NOTAS */}
            <div>
              <Label className="text-xs text-[#aaa]">Observaciones o notas adicionales</Label>
              <Input
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Ej: Se contó con la participación de 4 clubes de la zona..."
                className="mt-1 bg-[#101013] border-[#2c2c36] text-xs h-9 text-white"
              />
            </div>
          </div>

          {/* Footer Fijo con Totales y Botón Guardar */}
          <DialogFooter className="p-4 bg-[#141418] border-t border-[#25252f] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-xs text-[#888] uppercase font-bold tracking-wider">
                Recaudación Total para Subcomisión:
              </span>
              <span className="text-lg font-black font-mono text-[#FFCC00] bg-black/40 px-3 py-1 rounded-lg border border-[#FFCC00]/30">
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

