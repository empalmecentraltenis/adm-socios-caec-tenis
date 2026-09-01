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

export interface PlazoFijo {
  id: string;
  banco: string;
  montoInvertido: number;
  interesGenerado: number;
  fechaConstitucion: string;
  fechaVencimiento: string;
  estado: string;
}

interface PlazoFijoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plazoFijo?: PlazoFijo | null;
  onSuccess: () => void;
}

export default function PlazoFijoModal({ 
  open, 
  onOpenChange, 
  plazoFijo, 
  onSuccess 
}: PlazoFijoModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    banco: '',
    montoInvertido: '',
    interesGenerado: '',
    fechaConstitucion: format(new Date(), 'yyyy-MM-dd'),
    fechaVencimiento: format(new Date(), 'yyyy-MM-dd'),
    estado: 'activo'
  });

  const { toast } = useToast();

  useEffect(() => {
    if (plazoFijo && open) {
      setFormData({
        banco: plazoFijo.banco,
        montoInvertido: formatCurrency(plazoFijo.montoInvertido).replace('$ ', ''),
        interesGenerado: formatCurrency(plazoFijo.interesGenerado).replace('$ ', ''),
        fechaConstitucion: plazoFijo.fechaConstitucion,
        fechaVencimiento: plazoFijo.fechaVencimiento,
        estado: plazoFijo.estado
      });
    } else if (open) {
      setFormData({
        banco: '',
        montoInvertido: '',
        interesGenerado: '',
        fechaConstitucion: format(new Date(), 'yyyy-MM-dd'),
        fechaVencimiento: format(new Date(), 'yyyy-MM-dd'),
        estado: 'activo'
      });
    }
  }, [plazoFijo, open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const url = plazoFijo ? `/api/plazos-fijos/${plazoFijo.id}` : '/api/plazos-fijos';
      const method = plazoFijo ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          montoInvertido: parseCurrency(formData.montoInvertido),
          interesGenerado: parseCurrency(formData.interesGenerado)
        })
      });

      if (res.ok) {
        toast({ title: `Plazo fijo ${plazoFijo ? 'actualizado' : 'registrado'}` });
        onSuccess();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.details || errorData.error || 'Error en el servidor');
      }
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'No se pudo guardar el plazo fijo', 
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
            {plazoFijo ? 'Editar Plazo Fijo' : 'Nuevo Plazo Fijo'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="banco" className="text-[#999999]">Banco o Entidad</Label>
            <Input 
              id="banco"
              placeholder="Ej: Banco Nación"
              required
              value={formData.banco}
              onChange={(e) => setFormData({ ...formData, banco: e.target.value })}
              className="bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="montoInvertido" className="text-[#999999]">Capital Invertido ($)</Label>
              <Input 
                id="montoInvertido"
                type="text"
                required
                placeholder="0,00"
                value={formData.montoInvertido}
                onChange={(e) => setFormData({ ...formData, montoInvertido: formatInputCurrency(e.target.value) })}
                className="bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="interesGenerado" className="text-[#999999]">Interés Estimado ($)</Label>
              <Input 
                id="interesGenerado"
                type="text"
                required
                placeholder="0,00"
                value={formData.interesGenerado}
                onChange={(e) => setFormData({ ...formData, interesGenerado: formatInputCurrency(e.target.value) })}
                className="bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fechaConstitucion" className="text-[#999999]">Constitución</Label>
              <Input 
                id="fechaConstitucion"
                type="date"
                required
                value={formData.fechaConstitucion}
                onChange={(e) => setFormData({ ...formData, fechaConstitucion: e.target.value })}
                className="bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fechaVencimiento" className="text-[#999999]">Vencimiento</Label>
              <Input 
                id="fechaVencimiento"
                type="date"
                required
                value={formData.fechaVencimiento}
                onChange={(e) => setFormData({ ...formData, fechaVencimiento: e.target.value })}
                className="bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estado" className="text-[#999999]">Estado</Label>
            <Select 
              value={formData.estado} 
              onValueChange={(v: string) => setFormData({ ...formData, estado: v })}
            >
              <SelectTrigger id="estado" className="bg-[#2A2A2A] border-[#333333] text-white">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A1A] border-[#333333] text-white">
                <SelectItem value="activo" className="text-blue-500 focus:bg-blue-500/10 focus:text-blue-500">Activo</SelectItem>
                <SelectItem value="cobrado" className="text-green-500 focus:bg-green-500/10 focus:text-green-500">Cobrado</SelectItem>
              </SelectContent>
            </Select>
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
