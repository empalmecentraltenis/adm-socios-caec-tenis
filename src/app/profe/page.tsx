'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Users, 
  DollarSign, 
  Calendar as CalendarIcon, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  History, 
  Sparkles,
  ArrowRight,
  TrendingUp,
  Info
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Registro {
  id: string;
  fecha: string;
  fechaFormateada?: string;
  cantidadAlumnos: number;
  precioTotal: number;
  observaciones?: string;
  createdAt: string;
}

export default function ProfePage() {
  const getTodayStr = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [fecha, setFecha] = useState<string>(getTodayStr());
  const [cantidadAlumnos, setCantidadAlumnos] = useState<string>('');
  const [precioTotal, setPrecioTotal] = useState<string>('');
  const [observaciones, setObservaciones] = useState<string>('');

  const [existingRecord, setExistingRecord] = useState<Registro | null>(null);
  const [checkingDate, setCheckingDate] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string>('');
  const [lastSaved, setLastSaved] = useState<Registro | null>(null);

  const [recientes, setRecientes] = useState<Registro[]>([]);
  const [loadingRecientes, setLoadingRecientes] = useState<boolean>(false);

  // Consultar si ya hay una carga para la fecha seleccionada
  const checkDateRecord = useCallback(async (dateStr: string) => {
    setCheckingDate(true);
    try {
      const res = await fetch(`/api/clases-profe?fecha=${dateStr}`);
      if (res.ok) {
        const data: Registro[] = await res.json();
        if (data.length > 0) {
          const rec = data[0];
          setExistingRecord(rec);
          setCantidadAlumnos(String(rec.cantidadAlumnos));
          setPrecioTotal(String(rec.precioTotal));
          setObservaciones(rec.observaciones || '');
        } else {
          setExistingRecord(null);
          // Limpiar solo si no venimos de guardar
          if (status !== 'success') {
            setCantidadAlumnos('');
            setPrecioTotal('');
            setObservaciones('');
          }
        }
      }
    } catch (err) {
      console.error('Error al verificar fecha:', err);
    } finally {
      setCheckingDate(false);
    }
  }, [status]);

  useEffect(() => {
    if (fecha) {
      checkDateRecord(fecha);
    }
  }, [fecha, checkDateRecord]);

  const fetchRecientes = useCallback(async () => {
    setLoadingRecientes(true);
    try {
      const res = await fetch('/api/clases-profe?limit=7');
      if (res.ok) {
        const data = await res.json();
        setRecientes(data);
      }
    } catch (err) {
      console.error('Error al cargar recientes:', err);
    } finally {
      setLoadingRecientes(false);
    }
  }, []);

  useEffect(() => {
    fetchRecientes();
  }, [fetchRecientes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fecha) {
      setStatus('error');
      setMessage('Por favor, seleccioná la fecha.');
      return;
    }

    const alumnosNum = parseInt(cantidadAlumnos, 10);
    if (isNaN(alumnosNum) || alumnosNum < 0) {
      setStatus('error');
      setMessage('Ingresá una cantidad de alumnos válida.');
      return;
    }

    const precioNum = parseFloat(precioTotal.replace(/\./g, '').replace(',', '.'));
    if (isNaN(precioNum) || precioNum < 0) {
      setStatus('error');
      setMessage('Ingresá un precio total válido.');
      return;
    }

    setLoading(true);
    setStatus('idle');
    setMessage('');

    try {
      const res = await fetch('/api/clases-profe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fecha,
          cantidadAlumnos: alumnosNum,
          precioTotal: precioNum,
          observaciones: observaciones.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setMessage(data.error || 'Ocurrió un error al guardar.');
      } else {
        setStatus('success');
        setMessage(data.mensaje || '¡Planilla diaria guardada correctamente!');
        setLastSaved(data.registro);
        fetchRecientes();
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage('Error de conexión. Verificá tu señal e intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setStatus('idle');
    setMessage('');
    setCantidadAlumnos('');
    setPrecioTotal('');
    setObservaciones('');
    setFecha(getTodayStr());
    setExistingRecord(null);
  };

  const alumnosNumber = parseInt(cantidadAlumnos, 10) || 0;
  const precioNumber = parseFloat(precioTotal.replace(/\./g, '').replace(',', '.')) || 0;
  const promedioPorAlumno = alumnosNumber > 0 ? Math.round(precioNumber / alumnosNumber) : 0;

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Ocultar cualquier rastro del bot en esta página */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            #bp-web-widget,
            [class*="bp-widget"],
            iframe[src*="botpress"],
            div[id*="bp-"] {
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              pointer-events: none !important;
            }
          `,
        }}
      />
      <div className="w-full max-w-lg mx-auto space-y-6">
        {/* Header con marca CAEC */}
        <div className="text-center space-y-2 pt-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFCC00]/10 border border-[#FFCC00]/20 text-[#FFCC00] text-xs font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" /> CAEC Tenis
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#FFCC00] tracking-tight">
            Planilla Diaria de Clases
          </h1>
          <p className="text-sm text-[#999999]">
            Carga de alumnos y recaudación del día
          </p>
        </div>

        {/* Card Principal */}
        <Card className="bg-[#1E1E1E] border-[#333333] shadow-2xl overflow-hidden">
          <CardHeader className="border-b border-[#2C2C2C] pb-4 bg-gradient-to-b from-[#252525] to-[#1E1E1E]">
            <CardTitle className="text-xl text-white font-bold flex items-center justify-between">
              <span>Registro del Día</span>
              <span className="text-xs font-normal text-[#888888] bg-[#2A2A2A] px-2.5 py-1 rounded-md border border-[#3A3A3A]">
                1 carga por día
              </span>
            </CardTitle>
            <CardDescription className="text-[#888888] text-xs">
              Ingresá los alumnos que tuviste y el total recaudado en la jornada.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-6">
            {status === 'success' ? (
              <div className="py-6 flex flex-col items-center text-center space-y-5 animate-in fade-in zoom-in-95 duration-300">
                <div className="h-16 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">{message}</h3>
                  <p className="text-sm text-[#888888]">
                    Quedó asentado en la administración del club.
                  </p>
                </div>

                {lastSaved && (
                  <div className="w-full bg-[#252525] border border-[#333333] rounded-xl p-4 text-left space-y-2 text-sm">
                    <div className="flex justify-between items-center border-b border-[#333333] pb-2">
                      <span className="text-[#888888]">Día:</span>
                      <span className="font-semibold text-white capitalize">
                        {format(new Date(lastSaved.fecha), 'EEEE dd/MM/yyyy', { locale: es })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-[#333333] pb-2">
                      <span className="text-[#888888]">Total Alumnos:</span>
                      <span className="font-bold text-[#FFCC00]">
                        {lastSaved.cantidadAlumnos} alumno{lastSaved.cantidadAlumnos !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-[#333333] pb-2">
                      <span className="text-[#888888]">Total del Día:</span>
                      <span className="font-bold text-emerald-400 text-base">
                        $ {lastSaved.precioTotal.toLocaleString('es-AR')}
                      </span>
                    </div>
                    {lastSaved.cantidadAlumnos > 0 && (
                      <div className="flex justify-between items-center text-xs text-[#888888] pt-1">
                        <span>Promedio por alumno:</span>
                        <span>$ {Math.round(lastSaved.precioTotal / lastSaved.cantidadAlumnos).toLocaleString('es-AR')}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 w-full">
                  <Button
                    onClick={handleResetForm}
                    className="w-full h-12 bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-bold text-base"
                  >
                    Cargar Otro Día
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {status === 'error' && (
                  <div className="p-3.5 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-start gap-3 text-rose-300 text-sm animate-in fade-in">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-400" />
                    <span>{message}</span>
                  </div>
                )}

                {/* Fecha */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="fecha" className="text-xs uppercase font-semibold text-[#CCCCCC] flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-[#FFCC00]" />
                      Día de las Clases
                    </Label>
                    <button
                      type="button"
                      onClick={() => setFecha(getTodayStr())}
                      className="text-[11px] text-[#FFCC00] hover:underline"
                    >
                      Poner Hoy
                    </button>
                  </div>
                  <Input
                    id="fecha"
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    required
                    className="h-12 bg-[#2A2A2A] border-[#383838] text-white text-base focus:border-[#FFCC00] focus:ring-[#FFCC00]"
                  />
                  {/* Aviso si ya existe carga para este día */}
                  {existingRecord && !checkingDate && (
                    <div className="flex items-center gap-1.5 text-xs text-[#FFCC00] bg-[#FFCC00]/10 p-2 rounded-md border border-[#FFCC00]/20 mt-1">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Ya tenías una carga guardada para este día. Modificala y guardala si necesitás corregir.</span>
                    </div>
                  )}
                </div>

                {/* Grid Alumnos y Precio */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Cantidad de Alumnos */}
                  <div className="space-y-1.5">
                    <Label htmlFor="alumnos" className="text-xs uppercase font-semibold text-[#CCCCCC] flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#FFCC00]" />
                      Alumnos del Día
                    </Label>
                    <Input
                      id="alumnos"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ej: 14"
                      value={cantidadAlumnos}
                      onChange={(e) => setCantidadAlumnos(e.target.value)}
                      required
                      className="h-12 bg-[#2A2A2A] border-[#383838] text-white text-xl font-bold pl-4 focus:border-[#FFCC00] focus:ring-[#FFCC00]"
                    />
                  </div>

                  {/* Precio Total */}
                  <div className="space-y-1.5">
                    <Label htmlFor="precio" className="text-xs uppercase font-semibold text-[#CCCCCC] flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      Precio Total del Día ($)
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#888888] font-bold text-lg">
                        $
                      </span>
                      <Input
                        id="precio"
                        type="number"
                        min="0"
                        step="100"
                        placeholder="Ej: 45000"
                        value={precioTotal}
                        onChange={(e) => setPrecioTotal(e.target.value)}
                        required
                        className="h-12 bg-[#2A2A2A] border-[#383838] text-white text-xl font-bold pl-8 focus:border-[#FFCC00] focus:ring-[#FFCC00]"
                      />
                    </div>
                  </div>
                </div>

                {/* Resumen dinámico / métrica instantánea */}
                {(alumnosNumber > 0 || precioNumber > 0) && (
                  <div className="p-3 bg-[#262626] border border-[#383838] rounded-lg flex items-center justify-between text-xs animate-in fade-in">
                    <div className="flex items-center gap-2 text-[#999999]">
                      <TrendingUp className="w-4 h-4 text-[#FFCC00]" />
                      <span>Promedio por alumno:</span>
                    </div>
                    <span className="font-bold text-emerald-400 text-sm">
                      ${promedioPorAlumno.toLocaleString('es-AR')}
                    </span>
                  </div>
                )}

                {/* Observaciones */}
                <div className="space-y-1.5">
                  <Label htmlFor="obs" className="text-xs uppercase font-semibold text-[#AAAAAA]">
                    Observaciones / Notas (Opcional)
                  </Label>
                  <Input
                    id="obs"
                    type="text"
                    placeholder="Ej: Clases normales, clima lluvioso a la tarde..."
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="h-10 bg-[#262626] border-[#333333] text-white text-sm focus:border-[#FFCC00] focus:ring-[#FFCC00]"
                  />
                </div>

                {/* Botón Submit */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={loading || !cantidadAlumnos || !precioTotal}
                    className="w-full h-12 text-base font-bold bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] transition-colors shadow-lg shadow-[#FFCC00]/10"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        {existingRecord ? 'Actualizar Planilla del Día' : 'Guardar Planilla del Día'}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Sección de Últimos Registros Cargados */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#888888] flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-[#FFCC00]" />
              Tus Cargas Recientes
            </h2>
            <span className="text-[11px] text-[#666666]">Últimos días</span>
          </div>

          {loadingRecientes ? (
            <div className="p-4 text-center text-xs text-[#666666]">
              <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-[#FFCC00]" />
              Cargando historial...
            </div>
          ) : recientes.length === 0 ? (
            <div className="bg-[#1A1A1A] border border-[#2D2D2D] rounded-lg p-4 text-center text-xs text-[#666666]">
              Todavía no hay registros cargados. ¡Cargá el primero arriba!
            </div>
          ) : (
            <div className="space-y-2">
              {recientes.map((reg) => (
                <div
                  key={reg.id}
                  className="bg-[#1A1A1A] hover:bg-[#202020] border border-[#2E2E2E] rounded-xl p-3 flex items-center justify-between transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-10 rounded-lg bg-[#252525] border border-[#333333] flex flex-col items-center justify-center">
                      <span className="text-[10px] uppercase font-bold text-[#FFCC00] leading-none">
                        {format(new Date(reg.fecha), 'EEE', { locale: es })}
                      </span>
                      <span className="text-sm font-extrabold text-white leading-none mt-0.5">
                        {format(new Date(reg.fecha), 'dd/MM')}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {reg.cantidadAlumnos} alumno{reg.cantidadAlumnos !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#777777] capitalize">
                        {format(new Date(reg.fecha), 'EEEE', { locale: es })}
                        {reg.observaciones ? ` · ${reg.observaciones}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-400">
                      $ {reg.precioTotal.toLocaleString('es-AR')}
                    </span>
                    <p className="text-[10px] text-[#666666]">
                      ${reg.cantidadAlumnos > 0 ? Math.round(reg.precioTotal / reg.cantidadAlumnos).toLocaleString('es-AR') : 0} / alumno
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-[#555555] text-xs pt-4">
          Empalme Central Tenis - CAEC &copy; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
