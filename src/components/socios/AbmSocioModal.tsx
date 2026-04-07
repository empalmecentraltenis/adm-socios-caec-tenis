'use client';

import { useState, useEffect, useRef } from 'react';
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

interface SocioFormData {
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  telefono: string;
  estado?: string;
  categoria?: string;
}

interface AbmSocioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  socio: SocioFormData & { id: string } | null;
  onSuccess: () => void;
}

const EMPTY_FORM: SocioFormData = {
  nombre: '',
  apellido: '',
  email: '',
  dni: '',
  telefono: '',
  estado: 'activo',
  categoria: 'socio',
};

export default function AbmSocioModal({
  open,
  onOpenChange,
  socio,
  onSuccess,
}: AbmSocioModalProps) {
  const isEditing = !!socio;
  const [form, setForm] = useState<SocioFormData>({ ...EMPTY_FORM });
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const prevOpenRef = useRef(open);

  // Reset form when modal opens/closes or socio changes
  useEffect(() => {
    if (open && socio) {
      setForm({
        nombre: socio.nombre || '',
        apellido: socio.apellido || '',
        email: socio.email || '',
        dni: socio.dni || '',
        telefono: socio.telefono || '',
        estado: socio.estado || 'activo',
        categoria: socio.categoria || 'socio',
      });
    } else if (open && !socio) {
      setForm({ ...EMPTY_FORM });
    }
    prevOpenRef.current = open;
  }, [open, socio]);

  async function handleSubmit() {
    if (!form.nombre || !form.apellido || !form.email || !form.dni) {
      toast({
        title: 'Campos incompletos',
        description: 'Nombre, Apellido, Email y DNI son obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const url = '/api/socios';
      const method = isEditing ? 'PUT' : 'POST';
      const body = isEditing
        ? { id: socio!.id, ...form }
        : form;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: 'Error',
          description: data.error || 'No se pudo guardar el socio',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: isEditing ? 'Socio actualizado' : 'Socio creado',
        description: `${form.nombre} ${form.apellido} se ${isEditing ? 'actualizó' : 'creó'} correctamente.`,
      });

      onOpenChange(false);
      onSuccess();
    } catch {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E1E1E] border-[#333333] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEditing ? 'Modificar Socio' : 'Nuevo Socio'}
          </DialogTitle>
          <DialogDescription className="text-[#999999]">
            {isEditing
              ? `Editando datos de ${socio?.nombre} ${socio?.apellido}`
              : 'Complete los datos para dar de alta un nuevo socio'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[#CCCCCC] text-xs">Nombre *</Label>
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                placeholder="Juan Pablo"
                className="bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#CCCCCC] text-xs">Apellido *</Label>
              <Input
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                placeholder="Rodríguez"
                className="bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[#CCCCCC] text-xs">DNI *</Label>
              <Input
                value={form.dni}
                onChange={(e) => setForm({ ...form, dni: e.target.value })}
                placeholder="35000000"
                className="bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#CCCCCC] text-xs">Teléfono</Label>
              <Input
                value={form.telefono}
                onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                placeholder="3462 1234567"
                className="bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[#CCCCCC] text-xs">Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@ejemplo.com"
              className="bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[#CCCCCC] text-xs">Categoría</Label>
              <Select value={form.categoria || 'socio'} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger className="w-full bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#1E1E1E] border-[#333333]">
                  <SelectItem value="socio" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                    🏷️ Socio
                  </SelectItem>
                  <SelectItem value="alumno" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                    🎓 Alumno
                  </SelectItem>
                  <SelectItem value="vitalicio" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                    👑 Vitalicio
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isEditing && (
              <div className="space-y-1.5">
                <Label className="text-[#CCCCCC] text-xs">Estado</Label>
                <Select value={form.estado || 'activo'} onValueChange={(v) => setForm({ ...form, estado: v })}>
                  <SelectTrigger className="w-full bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1E1E1E] border-[#333333]">
                    <SelectItem value="activo" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                      ✅ Activo
                    </SelectItem>
                    <SelectItem value="inactivo" className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                      ⏸️ Inactivo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-medium"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitting
              ? 'Guardando...'
              : isEditing
                ? 'Guardar Cambios'
                : 'Dar de Alta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
