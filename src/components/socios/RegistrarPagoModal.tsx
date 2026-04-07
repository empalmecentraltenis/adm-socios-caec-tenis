'use client';

import { useState } from 'react';
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
import { Loader2 } from 'lucide-react';

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

export default function RegistrarPagoModal({
  open,
  onOpenChange,
  socio,
  onSuccess,
}: RegistrarPagoModalProps) {
  const [mesPagado, setMesPagado] = useState('');
  const [monto, setMonto] = useState('7000');
  const [metodoPago, setMetodoPago] = useState('efectivo');
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Reset form when modal opens with a new socio
  function handleOpenChange(isOpen: boolean) {
    if (isOpen) {
      // Default to current month
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      setMesPagado(monthOptions[0]?.value || currentMonth);
      setMonto('7000');
      setMetodoPago('efectivo');
    }
    onOpenChange(isOpen);
  }

  async function handleSubmit() {
    if (!socio || !mesPagado || !monto) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioId: socio.id,
          mesPagado,
          monto: parseFloat(monto),
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
        title: 'Pago registrado',
        description: `Se registró el pago de $${parseFloat(monto).toLocaleString('es-AR')} para ${socio.nombre} ${socio.apellido}`,
      });

      handleOpenChange(false);
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[#1E1E1E] border-[#333333] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Registrar Pago</DialogTitle>
          <DialogDescription className="text-[#999999]">
            {socio
              ? `Registrar pago para ${socio.nombre} ${socio.apellido}`
              : 'Selecciona un socio para registrar un pago'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Month selector */}
          <div className="space-y-2">
            <Label className="text-[#CCCCCC]">Mes a pagar</Label>
            <Select value={mesPagado} onValueChange={setMesPagado}>
              <SelectTrigger className="w-full bg-[#2A2A2A] border-[#333333] text-[#CCCCCC]">
                <SelectValue placeholder="Seleccionar mes" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E1E1E] border-[#333333]">
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label className="text-[#CCCCCC]">Monto ($)</Label>
            <Input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="bg-[#2A2A2A] border-[#333333] text-[#CCCCCC]"
              min={0}
              step={100}
            />
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label className="text-[#CCCCCC]">Método de pago</Label>
            <Select value={metodoPago} onValueChange={setMetodoPago}>
              <SelectTrigger className="w-full bg-[#2A2A2A] border-[#333333] text-[#CCCCCC]">
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent className="bg-[#1E1E1E] border-[#333333]">
                <SelectItem value="efectivo" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                  Efectivo
                </SelectItem>
                <SelectItem value="transferencia" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                  Transferencia
                </SelectItem>
                <SelectItem value="mercadopago" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                  MercadoPago
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
            className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !mesPagado || !monto}
            className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-medium"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting ? 'Registrando...' : 'Confirmar Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
