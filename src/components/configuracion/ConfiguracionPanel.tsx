'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Tag, GraduationCap, Crown } from 'lucide-react';

export default function ConfiguracionPanel() {
  const [cuotaSocio, setCuotaSocio] = useState('7000');
  const [cuotaAlumno, setCuotaAlumno] = useState('3500');
  const [cuotaVitalicio, setCuotaVitalicio] = useState('0');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch('/api/configuracion');
      if (res.ok) {
        const data = await res.json();
        setCuotaSocio(String(data.cuota_socio || 7000));
        setCuotaAlumno(String(data.cuota_alumno || 3500));
        setCuotaVitalicio(String(data.cuota_vitalicio || 0));
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuota_socio: parseFloat(cuotaSocio) || 7000,
          cuota_alumno: parseFloat(cuotaAlumno) || 3500,
          cuota_vitalicio: parseFloat(cuotaVitalicio) || 0,
        }),
      });

      if (res.ok) {
        toast({
          title: 'Configuración guardada',
          description: 'Los valores de cuota se actualizaron correctamente.',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const categorias = [
    {
      key: 'socio',
      label: 'Socio',
      icon: Tag,
      color: 'text-[#FFCC00]',
      bgColor: 'bg-[#FFCC00]/10',
      borderColor: 'border-[#FFCC00]/20',
      valor: cuotaSocio,
      onChange: setCuotaSocio,
      descripcion: 'Miembro regular del club con acceso completo a las instalaciones.',
    },
    {
      key: 'alumno',
      label: 'Alumno',
      icon: GraduationCap,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/20',
      valor: cuotaAlumno,
      onChange: setCuotaAlumno,
      descripcion: 'Participante de clases o escuelas de tenis con acceso limitado.',
    },
    {
      key: 'vitalicio',
      label: 'Vitalicio',
      icon: Crown,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      borderColor: 'border-green-400/20',
      valor: cuotaVitalicio,
      onChange: setCuotaVitalicio,
      descripcion: 'Miembro vitalicio exento de pago mensual de cuota.',
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64 bg-[#2A2A2A]" />
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full bg-[#2A2A2A]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white text-lg font-semibold">Configuración de Cuotas</h3>
          <p className="text-[#999999] text-sm mt-1">
            Definí el valor de la cuota mensual para cada categoría de socio.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-medium"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {categorias.map((cat) => {
          const Icon = cat.icon;
          return (
            <Card key={cat.key} className={`bg-[#1E1E1E] border ${cat.borderColor}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${cat.bgColor}`}>
                    <Icon className={`h-5 w-5 ${cat.color}`} />
                  </div>
                  <div>
                    <CardTitle className="text-white text-base">{cat.label}</CardTitle>
                    <CardDescription className="text-[#666666] text-xs">
                      Cuota mensual
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[#999999] text-xs leading-relaxed">{cat.descripcion}</p>
                <div className="space-y-1.5">
                  <Label className="text-[#CCCCCC] text-xs">Valor ($)</Label>
                  <Input
                    type="number"
                    value={cat.valor}
                    onChange={(e) => cat.onChange(e.target.value)}
                    className="bg-[#2A2A2A] border-[#333333] text-white h-9 text-sm font-semibold"
                    min={0}
                    step={500}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
