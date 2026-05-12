'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Tag, GraduationCap, Crown, Wallet } from 'lucide-react';
import { formatCurrency, parseCurrency, formatInputCurrency } from '@/lib/formatters';

interface ConfiguracionPanelProps {
  readOnly?: boolean;
}

export default function ConfiguracionPanel({ readOnly = false }: ConfiguracionPanelProps) {
  const [cuotaSocio, setCuotaSocio] = useState('7000');
  const [cuotaAlumno, setCuotaAlumno] = useState('3500');
  const [cuotaVitalicio, setCuotaVitalicio] = useState('0');
  const [saldoInicialEnero2026, setSaldoInicialEnero2026] = useState('0');
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
        setCuotaSocio(formatCurrency(data.cuota_socio || 7000).replace('$ ', ''));
        setCuotaAlumno(formatCurrency(data.cuota_alumno || 3500).replace('$ ', ''));
        setCuotaVitalicio(formatCurrency(data.cuota_vitalicio || 0).replace('$ ', ''));
        setSaldoInicialEnero2026(formatCurrency(data.saldo_inicial_enero_2026 || 0).replace('$ ', ''));
      }
    } catch (error) {
      console.error('Error al cargar configuración:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (readOnly) return;
    setSaving(true);
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cuota_socio: parseCurrency(cuotaSocio),
          cuota_alumno: parseCurrency(cuotaAlumno),
          cuota_vitalicio: parseCurrency(cuotaVitalicio),
          saldo_inicial_enero_2026: parseCurrency(saldoInicialEnero2026),
        }),
      });

      if (res.ok) {
        toast({
          title: 'Configuración guardada',
          description: 'Los valores se actualizaron correctamente.',
        });
        // Recargar para confirmar persistencia
        fetchConfig();
      } else {
        throw new Error('Error al guardar');
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
        {!readOnly && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-medium"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        )}
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
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
                    <Input
                      type="text"
                      value={cat.valor}
                      onChange={(e) => cat.onChange(formatInputCurrency(e.target.value))}
                      className="bg-[#2A2A2A] border-[#333333] text-white h-9 pl-7 text-sm font-semibold"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 border-t border-[#333333] pt-6">
        <h3 className="text-white text-lg font-semibold">Balance de Caja</h3>
        <p className="text-[#999999] text-sm mt-1 mb-4">
          Configuración inicial para el sistema de balances.
        </p>
        
        <Card className="bg-[#1E1E1E] border-[#333333] max-w-md">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-blue-500/10">
                <Wallet className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-white text-base">Saldo Inicial Histórico</CardTitle>
                <CardDescription className="text-[#666666] text-xs">
                  Caja al 01/01/2026
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[#999999] text-xs leading-relaxed">
              Este valor se toma como base para calcular todos los saldos mensuales subsiguientes.
            </p>
            <div className="space-y-1.5">
              <Label className="text-[#CCCCCC] text-xs">Monto ($)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
                <Input
                  type="text"
                  value={saldoInicialEnero2026}
                  onChange={(e) => setSaldoInicialEnero2026(formatInputCurrency(e.target.value))}
                  className="bg-[#2A2A2A] border-[#333333] text-white h-9 pl-7 text-sm font-semibold"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
