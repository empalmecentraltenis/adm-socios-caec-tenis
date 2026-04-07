'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Users } from 'lucide-react';

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function generateMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    const label = `${MESES[month]} ${year}`;
    options.push({ value, label });
  }
  return options;
}
const monthOptions = generateMonthOptions();

interface SocioMini {
  id: string;
  nombre: string;
  apellido: string;
  categoria: string;
  alDia: boolean;
}

interface PagoMasivoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  socios: SocioMini[];
  onSuccess: () => void;
}

export default function PagoMasivoModal({ open, onOpenChange, socios, onSuccess }: PagoMasivoModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mesPagado, setMesPagado] = useState('');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [submitting, setSubmitting] = useState(false);
  const [resultados, setResultados] = useState<{ exitosos: number; fallidos: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setResultados(null);
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setMesPagado(monthOptions[0]?.value || currentMonth);
      setMetodoPago('efectivo');
    }
  }, [open]);

  const deudores = useMemo(() => {
    return socios.filter(s => !s.alDia && s.categoria !== 'vitalicio');
  }, [socios]);

  function toggleSocio(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === deudores.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(deudores.map(s => s.id)));
    }
  }

  async function handleSubmit() {
    if (selectedIds.size === 0 || !mesPagado) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/pagos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioIds: Array.from(selectedIds),
          mesPagado,
          metodoPago,
          monto: 0,
        }),
      });
      const data = await res.json();
      setResultados({ exitosos: data.exitosos || 0, fallidos: data.fallidos || 0 });
      toast({
        title: 'Pago masivo registrado',
        description: `${data.exitosos} pagos exitosos${data.fallidos > 0 ? `, ${data.fallidos} fallidos` : ''}`,
      });
      onSuccess();
    } catch {
      toast({ title: 'Error', description: 'Error al registrar pagos masivos', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E1E1E] border-[#333333] sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-[#FFCC00]" />
            Pago Masivo
          </DialogTitle>
          <DialogDescription className="text-[#999999]">
            Seleccionar socios deudores para registrar pago del mes seleccionado. El monto se calcula según la categoría.
          </DialogDescription>
        </DialogHeader>

        {resultados ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="h-6 w-6" />
                <span className="text-lg font-semibold">{resultados.exitosos} exitosos</span>
              </div>
              {resultados.fallidos > 0 && (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="h-6 w-6" />
                  <span className="text-lg font-semibold">{resultados.fallidos} fallidos</span>
                </div>
              )}
            </div>
            <Button onClick={() => onOpenChange(false)} className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800]">
              Cerrar
            </Button>
          </div>
        ) : (
          <>
            {/* Mes y método */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#CCCCCC] text-xs">Mes a pagar</Label>
                <Select value={mesPagado} onValueChange={setMesPagado}>
                  <SelectTrigger className="bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1E1E1E] border-[#333333]">
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value} className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#CCCCCC] text-xs">Método de pago</Label>
                <Select value={metodoPago} onValueChange={setMetodoPago}>
                  <SelectTrigger className="bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1E1E1E] border-[#333333]">
                    <SelectItem value="efectivo" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">Efectivo</SelectItem>
                    <SelectItem value="transferencia" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">Transferencia</SelectItem>
                    <SelectItem value="mercadopago" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">MercadoPago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Selection header */}
            <div className="flex items-center justify-between border-b border-[#333333] pb-2">
              <Button variant="ghost" size="sm" onClick={toggleAll} className="text-[#FFCC00] hover:text-[#E6B800] text-xs h-7">
                {selectedIds.size === deudores.length ? 'Desmarcar todos' : 'Seleccionar todos'}
              </Button>
              <Badge variant="outline" className="border-[#FFCC00]/30 text-[#FFCC00] text-xs">
                {selectedIds.size} seleccionados
              </Badge>
            </div>

            {/* Lista de deudores */}
            <div className="flex-1 overflow-y-auto space-y-1 max-h-[300px] pr-1">
              {deudores.length === 0 ? (
                <p className="text-center text-[#999999] text-sm py-6">No hay socios deudores</p>
              ) : (
                deudores.map(socio => (
                  <div
                    key={socio.id}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedIds.has(socio.id) ? 'bg-[#FFCC00]/10 border border-[#FFCC00]/30' : 'hover:bg-[#252525] border border-transparent'
                    }`}
                    onClick={() => toggleSocio(socio.id)}
                  >
                    <Checkbox checked={selectedIds.has(socio.id)} className="border-[#666666] data-[state=checked]:bg-[#FFCC00] data-[state=checked]:border-[#FFCC00]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#CCCCCC] text-xs font-medium truncate">{socio.apellido}, {socio.nombre}</p>
                      <Badge variant="outline" className="text-[10px] border-[#333333] text-[#666666] mt-0.5">{socio.categoria}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A]">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || selectedIds.size === 0} className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-medium">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Registrando...' : `Registrar ${selectedIds.size} pagos`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
