'use client';

import { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency, parseCurrency, formatInputCurrency } from '@/lib/formatters';

interface Movimiento {
  id: string;
  fecha: string;
  descripcion: string;
  responsable: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
}

interface MovimientoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimiento?: Movimiento | null;
  onSuccess: () => void;
  defaultDate?: Date;
}

export default function MovimientoModal({ 
  open, 
  onOpenChange, 
  movimiento, 
  onSuccess,
  defaultDate = new Date()
}: MovimientoModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fecha: format(defaultDate, 'yyyy-MM-dd'),
    descripcion: '',
    responsable: '',
    tipo: 'egreso' as 'ingreso' | 'egreso',
    monto: ''
  });

  const { toast } = useToast();

  useEffect(() => {
    if (movimiento) {
      setFormData({
        fecha: movimiento.fecha.split('T')[0],
        descripcion: movimiento.descripcion,
        responsable: movimiento.responsable,
        tipo: movimiento.tipo,
        monto: formatCurrency(movimiento.monto).replace('$ ', '')
      });
    } else {
      setFormData({
        fecha: format(defaultDate, 'yyyy-MM-dd'),
        descripcion: '',
        responsable: '',
        tipo: 'egreso',
        monto: ''
      });
    }
  }, [movimiento, open, defaultDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const url = movimiento ? `/api/movimientos/${movimiento.id}` : '/api/movimientos';
      const method = movimiento ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          monto: parseCurrency(formData.monto)
        })
      });

      if (res.ok) {
        toast({ title: `Movimiento ${movimiento ? 'actualizado' : 'registrado'}` });
        onSuccess();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || 'Error en el servidor');
      }
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'No se pudo guardar el movimiento', 
        variant: 'destructive' 
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1A1A1A] border-[#333333] text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-[#FFCC00]">
            {movimiento ? 'Editar Movimiento' : 'Registrar Nuevo Movimiento'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fecha" className="text-[#999999]">Fecha</Label>
              <Input 
                id="fecha"
                type="date"
                required
                value={formData.fecha}
                onChange={(e) => setFormData({ ...formData, fecha: e.target.value })}
                className="bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tipo" className="text-[#999999]">Tipo</Label>
              <Select 
                value={formData.tipo} 
                onValueChange={(v: any) => setFormData({ ...formData, tipo: v })}
              >
                <SelectTrigger id="tipo" className="bg-[#2A2A2A] border-[#333333] text-white">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A1A] border-[#333333] text-white">
                  <SelectItem value="ingreso" className="text-green-500 focus:bg-green-500/10 focus:text-green-500">Ingreso (+)</SelectItem>
                  <SelectItem value="egreso" className="text-red-500 focus:bg-red-500/10 focus:text-red-500">Egreso (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion" className="text-[#999999]">Descripción / Concepto</Label>
            <Input 
              id="descripcion"
              placeholder="Ej: Pago luz, Cobro clases..."
              required
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              className="bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsable" className="text-[#999999]">Responsable</Label>
            <Input 
              id="responsable"
              placeholder="Ej: Juan Pérez"
              required
              value={formData.responsable}
              onChange={(e) => setFormData({ ...formData, responsable: e.target.value })}
              className="bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="monto" className="text-[#999999]">Importe ($)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
              <Input 
                id="monto"
                type="text"
                required
                placeholder="0,00"
                value={formData.monto}
                onChange={(e) => setFormData({ ...formData, monto: formatInputCurrency(e.target.value) })}
                className="bg-[#2A2A2A] border-[#333333] text-white pl-7 focus:border-[#FFCC00]"
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="bg-transparent border-[#333333] text-[#999999] hover:bg-[#2A2A2A] hover:text-white"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-bold min-w-[100px]"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (movimiento ? 'Actualizar' : 'Guardar')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
