'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, AlertTriangle, Loader2, XCircle } from 'lucide-react';

export default function AsistenciaPage() {
  const [dni, setDni] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dni.trim()) return;

    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      const res = await fetch('/api/asistencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni: dni.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Ocurrió un error al registrar la asistencia.');
      } else {
        // Calcular si hay deuda o está inactivo para mostrar el warning
        const socio = data.socio;
        
        // Función simplificada para calcular deuda (basada en el mismo concepto del backend/dashboard)
        const hoy = new Date();
        const cuotasPendientes = socio.cuotas?.filter((c: any) => c.estado === 'pendiente') || [];
        const mesesAdeudados = cuotasPendientes.filter((c: any) => {
          const [anio, mes] = c.mes.split('-');
          const vencimiento = new Date(parseInt(anio), parseInt(mes) - 1, 16); 
          return hoy >= vencimiento;
        }).length;

        if (socio.estado === 'inactivo' || mesesAdeudados >= 2) {
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
        setDni('');
        setStatus('idle');
        setMessage('');
      }, 8000); // Volver al inicio después de 8 segundos
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#FFCC00] tracking-tight mb-2">CAEC Tenis</h1>
          <p className="text-[#999999]">Registro de Asistencia a Clases</p>
        </div>

        <Card className="bg-[#1E1E1E] border-[#333333] shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white text-xl text-center">Ingresá tu DNI</CardTitle>
            <CardDescription className="text-center text-[#666666]">
              Para marcar tu presente en la clase de hoy
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'idle' && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Input
                    type="number"
                    placeholder="Ej: 32824688"
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                    className="text-center text-2xl h-14 bg-[#2A2A2A] border-[#333333] text-white focus:border-[#FFCC00] focus:ring-[#FFCC00]"
                    required
                    autoFocus
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading || !dni}
                  className="w-full h-12 text-lg font-semibold bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800]"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    'Dar Presente'
                  )}
                </Button>
              </form>
            )}

            {status === 'success' && (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
                <p className="text-lg font-medium text-white">{message}</p>
                <p className="text-sm text-[#666666]">¡Que tengas una buena clase!</p>
              </div>
            )}

            {status === 'warning' && (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in zoom-in duration-300">
                <AlertTriangle className="h-16 w-16 text-yellow-500" />
                <p className="text-lg font-medium text-white">{message}</p>
              </div>
            )}

            {status === 'error' && (
              <div className="flex flex-col items-center justify-center py-6 space-y-4 text-center animate-in fade-in zoom-in duration-300">
                <XCircle className="h-16 w-16 text-red-500" />
                <p className="text-lg font-medium text-white">{message}</p>
                <Button 
                  variant="outline" 
                  onClick={() => setStatus('idle')}
                  className="mt-2 border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white"
                >
                  Intentar de nuevo
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center text-[#444444] text-xs">
          Empalme Central Tenis - CAEC &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
