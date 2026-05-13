'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { Loader2, CheckSquare, Square, AlertCircle, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RegistrarPagoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  socio: { id: string; nombre: string; apellido: string } | null;
  onSuccess: () => void;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function RegistrarPagoModal({
  open,
  onOpenChange,
  socio,
  onSuccess,
}: RegistrarPagoModalProps) {
  const [pendientes, setPendientes] = useState<any[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [loadingPendientes, setLoadingPendientes] = useState(false);
  const [montoSugerido, setMontoSugerido] = useState(7000);
  const [montoManual, setMontoManual] = useState('7000');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && socio) {
      fetchPendientes();
      // Reset selections
      setSelectedMonths([]);
      setMetodoPago('efectivo');
    }
  }, [open, socio]);

  async function fetchPendientes() {
    if (!socio) return;
    setLoadingPendientes(true);
    try {
      const res = await fetch(`/api/pagos?socioId=${socio.id}`);
      if (res.ok) {
        const data = await res.json();
        // Filtrar solo los que vienen de la tabla cuotas (metodoPago === 'pendiente')
        const itemsPendientes = data.filter((item: any) => item.metodoPago === 'pendiente');
        setPendientes(itemsPendientes);
        
        if (itemsPendientes.length > 0) {
          setMontoSugerido(itemsPendientes[0].monto);
          setMontoManual(itemsPendientes[0].monto.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching pending months:', error);
    } finally {
      setLoadingPendientes(false);
    }
  }

  function toggleMonth(mes: string) {
    setSelectedMonths(prev => 
      prev.includes(mes) 
        ? prev.filter(m => m !== mes) 
        : [...prev, mes]
    );
  }

  async function handleSubmit() {
    if (!socio || selectedMonths.length === 0 || !montoManual) {
      toast({
        title: 'Atención',
        description: 'Debes seleccionar al menos un mes y especificar el monto.',
        variant: 'destructive',
      });
      return;
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioId: socio.id,
          mesesPagados: selectedMonths,
          monto: parseFloat(montoManual),
          metodoPago,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo registrar el pago',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Pagos registrados',
        description: `Se registraron ${selectedMonths.length} meses por un total de $${(parseFloat(montoManual) * selectedMonths.length).toLocaleString('es-AR')}`,
      });

      onOpenChange(false);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Error de conexión. Intente nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }

  const totalFinal = (parseFloat(montoManual) || 0) * selectedMonths.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E1E1E] border-[#333333] sm:max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">Registrar Pago Múltiple</DialogTitle>
          <DialogDescription className="text-[#999999]">
            {socio
              ? `Selecciona los meses que está pagando ${socio.nombre} ${socio.apellido}`
              : 'Cargando datos del socio...'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden py-2 space-y-4">
          {/* Pending Months List */}
          <div className="space-y-2">
            <Label className="text-[#CCCCCC] flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#FFCC00]" />
              Meses Pendientes
            </Label>
            
            {loadingPendientes ? (
              <div className="h-32 flex items-center justify-center bg-[#2A2A2A]/30 rounded-lg border border-[#333333] border-dashed">
                <Loader2 className="h-5 w-5 animate-spin text-[#999999]" />
              </div>
            ) : pendientes.length === 0 ? (
              <div className="p-4 flex flex-col items-center justify-center bg-[#2A2A2A]/30 rounded-lg border border-[#333333] border-dashed text-center">
                <AlertCircle className="h-5 w-5 text-[#00AA55] mb-2" />
                <p className="text-[11px] text-[#999999]">El socio no tiene cuotas marcadas como pendientes.</p>
                <Button 
                  variant="link" 
                  size="sm" 
                  className="text-[#FFCC00] text-[10px] h-auto p-0 mt-1"
                  onClick={() => {
                    // Si no hay pendientes, podríamos permitir elegir cualquier mes, pero por ahora solo de la lista
                    toast({ title: "Info", description: "Puedes ajustar la deuda desde el panel de edición del socio." });
                  }}
                >
                  Ajustar deuda del socio
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-40 border border-[#333333] rounded-lg bg-[#1A1A1A]">
                <div className="p-2 space-y-1">
                  {pendientes.map((p) => {
                    const [year, month] = p.mesPagado.split('-');
                    const isSelected = selectedMonths.includes(p.mesPagado);
                    return (
                      <button
                        key={p.mesPagado}
                        onClick={() => toggleMonth(p.mesPagado)}
                        className={`w-full flex items-center justify-between p-2 rounded-md transition-colors ${
                          isSelected ? 'bg-[#FFCC00]/10 border border-[#FFCC00]/30' : 'hover:bg-[#2A2A2A] border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-[#FFCC00]" />
                          ) : (
                            <Square className="h-4 w-4 text-[#666666]" />
                          )}
                          <span className={`text-xs ${isSelected ? 'text-white font-medium' : 'text-[#CCCCCC]'}`}>
                            {MESES[parseInt(month) - 1]} {year}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-[#333333] text-[#666666]">
                          ${p.monto.toLocaleString('es-AR')}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
            <p className="text-[10px] text-[#666666]">Seleccionados: {selectedMonths.length} mes(es)</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount PER MONTH */}
            <div className="space-y-2">
              <Label className="text-[#CCCCCC]">Monto por mes ($)</Label>
              <Input
                type="number"
                value={montoManual}
                onChange={(e) => setMontoManual(e.target.value)}
                className="bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm"
                min={0}
                step={100}
              />
            </div>

            {/* Payment method */}
            <div className="space-y-2">
              <Label className="text-[#CCCCCC]">Método de pago</Label>
              <Select value={metodoPago} onValueChange={setMetodoPago}>
                <SelectTrigger className="w-full bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm">
                  <SelectValue placeholder="Método" />
                </SelectTrigger>
                <SelectContent className="bg-[#1E1E1E] border-[#333333]">
                  <SelectItem value="efectivo" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">Efectivo</SelectItem>
                  <SelectItem value="transferencia" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">Transferencia</SelectItem>
                  <SelectItem value="mercadopago" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">MercadoPago</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedMonths.length > 0 && (
            <div className="p-3 bg-[#FFCC00]/5 border border-[#FFCC00]/20 rounded-lg flex items-center justify-between">
              <span className="text-xs text-[#999999]">Total a cobrar:</span>
              <span className="text-lg font-bold text-[#FFCC00]">${totalFinal.toLocaleString('es-AR')}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-9 text-xs"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || selectedMonths.length === 0 || !montoManual}
            className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-bold h-9 text-xs"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {submitting ? 'Registrando...' : `Confirmar ${selectedMonths.length} Pago(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
