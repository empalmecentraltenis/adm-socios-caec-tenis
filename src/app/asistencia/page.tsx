'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, Loader2, XCircle, UserCheck, Phone, User, ArrowRight, ArrowLeft } from 'lucide-react';

export default function AsistenciaPage() {
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [telefono, setTelefono] = useState('');

  const [step, setStep] = useState<'dni' | 'completar_datos'>('dni');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [message, setMessage] = useState('');

  // Paso 1: Verificar DNI
  const handleCheckDni = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDni = dni.trim();
    if (!cleanDni) return;

    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      // Consultamos si el DNI ya pertenece a un socio/alumno registrado
      const resCheck = await fetch(`/api/asistencias?checkDni=${cleanDni}`);
      if (resCheck.ok) {
        const checkData = await resCheck.json();

        if (checkData.existe && !checkData.esNoRegistrado) {
          // El alumno ya existe con nombre y apellido: registramos asistencia directo
          await registrarAsistenciaFinal({ dni: cleanDni });
          return;
        }

        // Si no existe o figura como "No Registrado": pedimos completar nombre, apellido y celular
        setStep('completar_datos');
        setLoading(false);
        return;
      }

      // Si falla la verificación, intentamos registrar directamente por fallback
      await registrarAsistenciaFinal({ dni: cleanDni });
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('Error de conexión. Por favor intentá nuevamente.');
      setLoading(false);
    }
  };

  // Paso 2: Registrar Asistencia final (con o sin datos adicionales)
  const registrarAsistenciaFinal = async (payload: { dni: string; nombre?: string; apellido?: string; telefono?: string }) => {
    setLoading(true);
    try {
      const res = await fetch('/api/asistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Ocurrió un error al registrar la asistencia.');
      } else {
        const socio = data.socio;

        // Calcular si hay deuda o está inactivo para advertencia
        const hoy = new Date();
        const cuotasPendientes = socio.cuotas?.filter((c: any) => c.estado === 'pendiente') || [];
        const mesesAdeudados = cuotasPendientes.filter((c: any) => {
          const [anio, mes] = c.mes.split('-');
          const vencimiento = new Date(parseInt(anio), parseInt(mes), 1);
          return hoy >= vencimiento;
        }).length;

        if (payload.nombre && payload.apellido) {
          setStatus('success');
          setMessage(`¡Bienvenido/a ${payload.nombre}! Tu ficha y asistencia fueron registradas con éxito.`);
        } else if (data.esNoRegistrado || socio.nombre === 'Alumno') {
          setStatus('success');
          setMessage(`¡Asistencia registrada correctamente!`);
        } else if (socio.estado === 'inactivo' || mesesAdeudados >= 4) {
          setStatus('warning');
          setMessage(`Asistencia registrada. Por favor, acercate a administración para regularizar tu situación.`);
        } else {
          setStatus('success');
          setMessage(`¡Hola ${socio.nombre}! Tu asistencia fue registrada correctamente.`);
        }
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
      setMessage('Error de conexión. Por favor intentá de nuevo.');
    } finally {
      setLoading(false);
      setTimeout(() => {
        handleReset();
      }, 7000); // Volver al inicio después de 7 segundos
    }
  };

  const handleSubmitDatosNuevos = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !apellido.trim()) return;

    await registrarAsistenciaFinal({
      dni: dni.trim(),
      nombre: nombre.trim(),
      apellido: apellido.trim(),
      telefono: telefono.trim(),
    });
  };

  const handleReset = () => {
    setDni('');
    setNombre('');
    setApellido('');
    setTelefono('');
    setStep('dni');
    setStatus('idle');
    setMessage('');
  };

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-[#FFCC00] tracking-tight mb-1">CAEC Tenis</h1>
          <p className="text-[#999999] text-sm">Registro de Asistencia a Clases</p>
        </div>

        <Card className="bg-[#1E1E1E] border-[#333333] shadow-2xl overflow-hidden">
          {/* Header según el estado */}
          {status === 'idle' && step === 'dni' && (
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-white text-xl">Ingresá tu DNI</CardTitle>
              <CardDescription className="text-[#888888] text-xs">
                Para marcar tu presente en la clase de hoy
              </CardDescription>
            </CardHeader>
          )}

          {status === 'idle' && step === 'completar_datos' && (
            <CardHeader className="text-center pb-2 bg-[#232323] border-b border-[#333333]">
              <div className="mx-auto w-10 h-10 rounded-full bg-[#FFCC00]/10 border border-[#FFCC00]/30 flex items-center justify-center text-[#FFCC00] mb-2">
                <UserCheck className="w-5 h-5" />
              </div>
              <CardTitle className="text-white text-lg">Completar Datos del Alumno</CardTitle>
              <CardDescription className="text-[#AAAAAA] text-xs">
                Es la primera vez que ingresás con el DNI <strong className="text-white">{dni}</strong>. Ingresá tus datos para que el profesor te tenga en su lista.
              </CardDescription>
            </CardHeader>
          )}

          <CardContent className="pt-5">
            {/* ESTADO INICIAL: INGRESO DE DNI */}
            {status === 'idle' && step === 'dni' && (
              <form onSubmit={handleCheckDni} className="space-y-4">
                <div>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Ej: 32824688"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="text-center text-2xl h-14 bg-[#2A2A2A] border-[#383838] text-white focus:border-[#FFCC00] focus:ring-[#FFCC00] font-mono tracking-wider"
                    required
                    autoFocus
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading || !dni}
                  className="w-full h-12 text-base font-bold bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] transition-transform active:scale-[0.99]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <span>Dar Presente</span>
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* ESTADO ALUMNO NUEVO: COMPLETAR NOMBRE, APELLIDO Y TELÉFONO */}
            {status === 'idle' && step === 'completar_datos' && (
              <form onSubmit={handleSubmitDatosNuevos} className="space-y-3.5 animate-in fade-in zoom-in-95 duration-200">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label htmlFor="nombre" className="text-xs text-[#CCCCCC] font-semibold flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-[#FFCC00]" /> Nombre *
                    </Label>
                    <Input
                      id="nombre"
                      type="text"
                      placeholder="Ej: Juan"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="h-10 bg-[#2A2A2A] border-[#383838] text-white text-sm focus:border-[#FFCC00]"
                      required
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="apellido" className="text-xs text-[#CCCCCC] font-semibold">
                      Apellido *
                    </Label>
                    <Input
                      id="apellido"
                      type="text"
                      placeholder="Ej: Pérez"
                      value={apellido}
                      onChange={(e) => setApellido(e.target.value)}
                      className="h-10 bg-[#2A2A2A] border-[#383838] text-white text-sm focus:border-[#FFCC00]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="tel" className="text-xs text-[#CCCCCC] font-semibold flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-[#FFCC00]" /> Celular / WhatsApp de contacto *
                  </Label>
                  <Input
                    id="tel"
                    type="tel"
                    placeholder="Ej: 3400551122"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    className="h-10 bg-[#2A2A2A] border-[#383838] text-white text-sm focus:border-[#FFCC00]"
                    required
                  />
                  <p className="text-[11px] text-[#777777]">
                    Para avisos de la clase y contacto directo del profesor.
                  </p>
                </div>

                <div className="pt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep('dni')}
                    className="h-11 px-3 border-[#383838] text-[#AAAAAA] hover:text-white hover:bg-[#2A2A2A]"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Volver
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading || !nombre.trim() || !apellido.trim() || !telefono.trim()}
                    className="flex-1 h-11 text-sm font-bold bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] transition-colors"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      'Confirmar y Dar Presente'
                    )}
                  </Button>
                </div>
              </form>
            )}

            {/* MENSAJES DE RESPUESTA */}
            {status === 'success' && (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in zoom-in duration-300">
                <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <p className="text-lg font-bold text-white px-2 leading-snug">{message}</p>
                <p className="text-xs text-[#888888]">¡Que tengas un excelente entrenamiento!</p>
              </div>
            )}

            {status === 'warning' && (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in zoom-in duration-300">
                <div className="h-16 w-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <AlertTriangle className="h-10 w-10" />
                </div>
                <p className="text-base font-bold text-white px-2 leading-snug">{message}</p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in zoom-in duration-300">
                <div className="h-16 w-16 rounded-full bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <XCircle className="h-10 w-10" />
                </div>
                <p className="text-base font-bold text-white px-2 leading-snug">{message}</p>
                <Button 
                  variant="outline" 
                  onClick={handleReset}
                  className="mt-2 border-[#383838] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white"
                >
                  Intentar de nuevo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center text-[#555555] text-xs">
          Club Atlético Empalme Central · CAEC Tenis &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
