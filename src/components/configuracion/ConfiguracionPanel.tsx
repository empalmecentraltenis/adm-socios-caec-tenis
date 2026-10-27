'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Save,
  Tag,
  GraduationCap,
  Crown,
  Wallet,
  Zap,
  UserPlus,
  Shield,
  Receipt,
  ClipboardCheck,
  Copy,
  Check,
  ExternalLink,
  Link as LinkIcon,
} from 'lucide-react';
import { formatCurrency, parseCurrency, formatInputCurrency } from '@/lib/formatters';

interface ConfiguracionPanelProps {
  readOnly?: boolean;
}

export default function ConfiguracionPanel({ readOnly = false }: ConfiguracionPanelProps) {
  const [cuotaSocio, setCuotaSocio] = useState('7000');
  const [cuotaAlumno, setCuotaAlumno] = useState('3500');
  const [cuotaVitalicio, setCuotaVitalicio] = useState('0');
  const [saldoInicialEnero2026, setSaldoInicialEnero2026] = useState('0');
  const [precioLuzTurno, setPrecioLuzTurno] = useState('6000');
  const [precioLuzProfe, setPrecioLuzProfe] = useState('3000');
  const [precioInvitadoExtra, setPrecioInvitadoExtra] = useState('10000');
  const [cupoInvitadosAnual, setCupoInvitadosAnual] = useState('4');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    setLoading(true);
    try {
      const res = await fetch(`/api/configuracion?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        
        // Función auxiliar para limpiar el formato y dejar solo el número con coma decimal
        const clean = (val: any) => {
          const formatted = formatCurrency(val || 0);
          // Quitamos $, ARS y espacios (incluyendo non-breaking space \u00A0)
          return formatted.replace(/[$\u00A0\s]/g, '').replace('ARS', '').trim();
        };

        setCuotaSocio(clean(data.cuota_socio));
        setCuotaAlumno(clean(data.cuota_alumno));
        setCuotaVitalicio(clean(data.cuota_vitalicio));
        setSaldoInicialEnero2026(clean(data.saldo_inicial_enero_2026));
        setPrecioLuzTurno(clean(data.precio_luz_turno || '6000'));
        setPrecioLuzProfe(clean(data.precio_luz_profe || '3000'));
        setPrecioInvitadoExtra(clean(data.precio_invitado_extra || '10000'));
        setCupoInvitadosAnual(String(data.cupo_invitados_anual || '4'));
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
          precio_luz_turno: parseCurrency(precioLuzTurno),
          precio_luz_profe: parseCurrency(precioLuzProfe),
          precio_invitado_extra: parseCurrency(precioInvitadoExtra),
          cupo_invitados_anual: parseInt(cupoInvitadosAnual) || 4,
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

  const [origin, setOrigin] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const handleCopy = (path: string, label: string, key: string) => {
    const fullUrl = origin ? `${origin}${path}` : path;
    navigator.clipboard.writeText(fullUrl);
    setCopiedKey(key);
    toast({
      title: '¡Enlace copiado!',
      description: `El link de ${label} está listo para enviar: ${fullUrl}`,
    });
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const accesosRapidos = [
    {
      key: 'secretaria',
      label: 'Secretaría (Puesto de Cobro)',
      path: '/secretaria',
      icon: Receipt,
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      borderColor: 'border-amber-400/30',
      badge: 'Cobro de Cuotas',
      descripcion: 'Mostrador ágil para cobrar cuotas sociales, buscar socios por DNI y ver arqueo/caja del día. Sin login ni PIN.',
    },
    {
      key: 'porteria',
      label: 'Portería (Control de Canchas)',
      path: '/porteria',
      icon: Shield,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      borderColor: 'border-emerald-400/30',
      badge: 'Turnos en Vivo',
      descripcion: 'Turnos de hoy y mañana organizados por horario (Cancha 1 y Cancha 2), socios, acompañantes destacados y clases del profesor. Sin login ni PIN.',
    },
    {
      key: 'profesor',
      label: 'Profesor (Registro de Clases)',
      path: '/profesor',
      icon: GraduationCap,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      borderColor: 'border-purple-400/30',
      badge: 'Clases y Escuela',
      descripcion: 'Acceso para que el profesor asiente sus clases de tenis, cantidad de alumnos y liquidación.',
    },
    {
      key: 'asistencia',
      label: 'Asistencia Alumnos',
      path: '/asistencia',
      icon: ClipboardCheck,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/30',
      badge: 'Presentismo',
      descripcion: 'Planilla directa para registrar presentismo de alumnos a las clases de la escuela de tenis.',
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
    <div className="space-y-6">
      {/* SECCIÓN: ENLACES RÁPIDOS Y ACCESOS DIRECTOS */}
      <Card className="bg-[#18181A] border-[#2C2C32] rounded-2xl overflow-hidden shadow-xl">
        <CardHeader className="bg-[#141416] border-b border-[#26262B] pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                <LinkIcon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-white text-base font-bold flex items-center gap-2">
                  Enlaces Rápidos y Accesos Directos del Club
                  <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                    Sin Login / Sin PIN
                  </Badge>
                </CardTitle>
                <CardDescription className="text-[#888888] text-xs">
                  Links públicos para compartir con Secretaría, Portería, Profesor o tener siempre a mano cuando te los pidan.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {accesosRapidos.map((acc) => {
              const Icon = acc.icon;
              const isCopied = copiedKey === acc.key;
              const fullUrl = origin ? `${origin}${acc.path}` : acc.path;

              return (
                <div
                  key={acc.key}
                  className="rounded-xl border p-4 flex flex-col justify-between transition-all bg-[#121214] border-[#27272D] hover:border-[#383842] shadow-sm"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-xl ${acc.bgColor} border ${acc.borderColor} ${acc.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-white">{acc.label}</h4>
                          <span className="text-[11px] font-mono text-[#777] block">{acc.path}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={`text-[10px] font-bold ${acc.bgColor} ${acc.color} ${acc.borderColor}`}>
                        {acc.badge}
                      </Badge>
                    </div>

                    <p className="text-xs text-[#999999] leading-relaxed">
                      {acc.descripcion}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#222226] mt-3 flex items-center justify-between gap-2">
                    <div className="truncate max-w-[170px] sm:max-w-[220px]">
                      <span className="text-[11px] font-mono text-[#666] truncate block" title={fullUrl}>
                        {fullUrl}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopy(acc.path, acc.label, acc.key)}
                        className={`h-8 px-2.5 rounded-lg text-xs font-semibold gap-1.5 transition-all ${
                          isCopied
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                            : 'bg-[#1C1C20] border-[#303038] text-white hover:bg-[#282830]'
                        }`}
                        title="Copiar enlace completo al portapapeles"
                      >
                        {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-blue-400" />}
                        <span>{isCopied ? '¡Copiado!' : 'Copiar'}</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        className="h-8 px-2.5 rounded-lg text-xs font-semibold bg-[#1C1C20] border-[#303038] text-white hover:bg-[#282830] gap-1"
                        title="Abrir página en nueva pestaña"
                      >
                        <a href={acc.path} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 text-[#888]" />
                          <span>Abrir</span>
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-2">
        <div>
          <h3 className="text-white text-lg font-semibold">Configuración de Cuotas</h3>
          <p className="text-[#999999] text-sm mt-1">
            Definí el valor de la cuota mensual para cada categoría de socio.
          </p>
        </div>
        {readOnly ? (
          <div className="px-3 py-1.5 bg-[#FFCC00]/10 border border-[#FFCC00]/30 rounded-lg">
            <span className="text-[#FFCC00] text-xs font-bold uppercase tracking-wider">Modo Solo Lectura (Consulta)</span>
          </div>
        ) : (
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
                      disabled={readOnly}
                      value={cat.valor}
                      onChange={(e) => cat.onChange(formatInputCurrency(e.target.value))}
                      className={`bg-[#2A2A2A] border-[#333333] text-white h-9 pl-7 text-sm font-semibold ${readOnly ? 'opacity-80 cursor-not-allowed' : ''}`}
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
                  disabled={readOnly}
                  value={saldoInicialEnero2026}
                  onChange={(e) => setSaldoInicialEnero2026(formatInputCurrency(e.target.value))}
                  className={`bg-[#2A2A2A] border-[#333333] text-white h-9 pl-7 text-sm font-semibold ${readOnly ? 'opacity-80 cursor-not-allowed' : ''}`}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 border-t border-[#333333] pt-6">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-5 w-5 text-amber-400" />
          <h3 className="text-white text-lg font-semibold">Tarifas de Iluminación (Turnos con Luz)</h3>
        </div>
        <p className="text-[#999999] text-sm mb-4">
          Costo adicional por turno nocturno (a partir de las 19:00 hs) para socios y profesor.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <Card className="bg-[#1E1E1E] border-amber-400/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-400/10">
                  <Zap className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-base">Turno Socios (Total)</CardTitle>
                  <CardDescription className="text-[#666666] text-xs">
                    Se divide entre los socios que juegan
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[#999999] text-xs leading-relaxed">
                Single (2 socios): 50% c/u ($3.000). Dobles (4 socios): 25% c/u ($1.500). Si juegan invitados, el socio titular asume la parte del invitado.
              </p>
              <div className="space-y-1.5">
                <Label className="text-[#CCCCCC] text-xs">Monto Total Turno ($)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
                  <Input
                    type="text"
                    disabled={readOnly}
                    value={precioLuzTurno}
                    onChange={(e) => setPrecioLuzTurno(formatInputCurrency(e.target.value))}
                    className={`bg-[#2A2A2A] border-[#333333] text-white h-9 pl-7 text-sm font-semibold ${readOnly ? 'opacity-80 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1E1E1E] border-amber-400/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-amber-400/10">
                  <GraduationCap className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-base">Turno Profesor</CardTitle>
                  <CardDescription className="text-[#666666] text-xs">
                    Turnos de clases nocturnos
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[#999999] text-xs leading-relaxed">
                Valor fijo por turno bloqueado por clases del profesor a partir de las 19:00 hs.
              </p>
              <div className="space-y-1.5">
                <Label className="text-[#CCCCCC] text-xs">Monto por Turno Profe ($)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
                  <Input
                    type="text"
                    disabled={readOnly}
                    value={precioLuzProfe}
                    onChange={(e) => setPrecioLuzProfe(formatInputCurrency(e.target.value))}
                    className={`bg-[#2A2A2A] border-[#333333] text-white h-9 pl-7 text-sm font-semibold ${readOnly ? 'opacity-80 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-8 border-t border-[#333333] pt-6">
        <div className="flex items-center gap-2 mb-1">
          <UserPlus className="h-5 w-5 text-emerald-400" />
          <h3 className="text-white text-lg font-semibold">Régimen de Invitados</h3>
        </div>
        <p className="text-[#999999] text-sm mb-4">
          Definí el cupo de invitaciones bonificadas al año y el valor que se cobra por cada invitado adicional.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <Card className="bg-[#1E1E1E] border-emerald-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <UserPlus className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-base">Costo Invitado Extra</CardTitle>
                  <CardDescription className="text-[#666666] text-xs">
                    A partir de la 5ª invitación anual
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[#999999] text-xs leading-relaxed">
                Monto que se facturará en secretaría al socio titular por cada invitado que exceda el cupo anual.
              </p>
              <div className="space-y-1.5">
                <Label className="text-[#CCCCCC] text-xs">Monto por Invitado ($)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666] text-sm">$</span>
                  <Input
                    type="text"
                    disabled={readOnly}
                    value={precioInvitadoExtra}
                    onChange={(e) => setPrecioInvitadoExtra(formatInputCurrency(e.target.value))}
                    className={`bg-[#2A2A2A] border-[#333333] text-white h-9 pl-7 text-sm font-semibold ${readOnly ? 'opacity-80 cursor-not-allowed' : ''}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#1E1E1E] border-emerald-500/20">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10">
                  <Tag className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <CardTitle className="text-white text-base">Cupo Bonificado Anual</CardTitle>
                  <CardDescription className="text-[#666666] text-xs">
                    Invitaciones gratuitas por socio/año
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[#999999] text-xs leading-relaxed">
                Cantidad máxima de invitaciones sin cargo que cada socio titular puede utilizar por año calendario.
              </p>
              <div className="space-y-1.5">
                <Label className="text-[#CCCCCC] text-xs">Cantidad de Invitaciones</Label>
                <Input
                  type="number"
                  disabled={readOnly}
                  min="0"
                  max="50"
                  value={cupoInvitadosAnual}
                  onChange={(e) => setCupoInvitadosAnual(e.target.value)}
                  className={`bg-[#2A2A2A] border-[#333333] text-white h-9 text-sm font-semibold ${readOnly ? 'opacity-80 cursor-not-allowed' : ''}`}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
