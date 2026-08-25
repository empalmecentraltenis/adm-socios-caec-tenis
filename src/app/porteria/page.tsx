'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Lock, LogOut, RefreshCw, Calendar as CalendarIcon, Clock, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Turno {
  id: string;
  canchaId: number;
  canchaNombre: string;
  horaInicio: string;
  horaFin: string;
  estado: string; // 'libre' | 'ocupado' | 'bloqueado'
  motivoBloqueo?: string;
  socioDni?: string;
  socioNombreCompleto?: string;
  acompanante?: string;
}

const SHIFTS = [
  { start: '13:00', end: '14:30' },
  { start: '14:30', end: '16:00' },
  { start: '16:00', end: '17:30' },
  { start: '17:30', end: '19:00' },
  { start: '19:00', end: '20:00' },
  { start: '20:00', end: '21:30' },
  { start: '21:30', end: '23:00' }
];

export default function PorteriaPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();

  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Date selection
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Week generation (from today to +6 days)
  const weekDates = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  useEffect(() => {
    const isUnlocked = sessionStorage.getItem('porteria_unlocked');
    if (isUnlocked === 'true') {
      setUnlocked(true);
    }
  }, []);

  const fetchTurnos = useCallback(async () => {
    setLoading(true);
    try {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      
      const res = await fetch(`/api/turnos?fecha=${dateStr}`);
      if (res.ok) {
        const data = await res.json();
        setTurnos(data);
        setLastUpdate(new Date());
      }
    } catch (err) {
      toast({
        title: 'Error de red',
        description: 'No se pudieron actualizar los turnos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedDate, toast]);

  // Initial fetch and auto-refresh every 60 seconds
  useEffect(() => {
    if (unlocked) {
      fetchTurnos();
      const interval = setInterval(fetchTurnos, 60000);
      return () => clearInterval(interval);
    }
  }, [unlocked, fetchTurnos]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1436') {
      setUnlocked(true);
      sessionStorage.setItem('porteria_unlocked', 'true');
      setError('');
    } else {
      setError('PIN incorrecto');
      setPin('');
    }
  };

  const handleLogout = () => {
    setUnlocked(false);
    sessionStorage.removeItem('porteria_unlocked');
    setPin('');
  };

  // Helper for formatting date parts
  const getDayName = (date: Date) => {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    return days[date.getDay()];
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-8 max-w-sm w-full shadow-xl">
          <div className="flex flex-col items-center mb-6">
            <div className="h-12 w-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Acceso Portería</h2>
            <p className="text-[#999999] text-sm text-center mt-2">
              Ingrese el PIN para visualizar los turnos del día.
            </p>
          </div>
          
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="PIN numérico"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="bg-[#2A2A2A] border-[#333333] text-center text-lg tracking-widest"
                autoFocus
              />
              {error && <p className="text-red-400 text-xs text-center">{error}</p>}
            </div>
            <Button type="submit" className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium">
              Ingresar
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="border-b border-[#333333] bg-[#1E1E1E] sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
              <CalendarIcon className="h-4 w-4" />
            </div>
            <h1 className="text-foreground font-bold text-lg">Portería CAEC</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={fetchTurnos}
              disabled={loading}
              className="text-[#999999] hover:text-foreground h-8 px-2"
              title="Actualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="text-[#999999] hover:text-foreground hover:bg-[#2A2A2A] h-8 px-2"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-2xl mx-auto">
        {/* Date Selector */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {weekDates.map((d, idx) => {
              const isSelected = d.toDateString() === selectedDate.toDateString();
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(d)}
                  className={`flex-shrink-0 flex flex-col items-center justify-center w-[4.5rem] h-16 rounded-xl border-2 transition-colors ${
                    isSelected 
                      ? 'bg-blue-600/20 border-blue-500 text-foreground' 
                      : 'bg-[#161616] border-[#2a2a2a] text-[#999999] hover:border-[#444]'
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-blue-400' : ''}`}>
                    {getDayName(d)}
                  </span>
                  <span className="text-xl font-bold leading-none">{d.getDate()}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-between items-center mb-4 px-1">
          <h2 className="font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#999]" />
            Turnos de la fecha
          </h2>
          <span className="text-xs text-[#666]">Actualizado: {lastUpdate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>

        <div className="space-y-6">
          {SHIFTS.map((shift, i) => {
            // Find courts for this specific shift time
            const turnosInShift = [1, 2].map(canchaId => { // Assuming canchas 1 and 2
              const t = turnos.find(t => t.canchaId === canchaId && t.horaInicio.startsWith(shift.start));
              return { canchaId, turno: t };
            });

            return (
              <div key={i} className="bg-[#1E1E1E] rounded-xl border border-[#333333] overflow-hidden shadow-sm">
                <div className="bg-[#121212] px-4 py-2 border-b border-[#333333] flex justify-between items-center">
                  <span className="font-bold text-white text-lg">{shift.start} <span className="text-sm font-normal text-[#999] ml-1">a {shift.end}</span></span>
                </div>
                <div className="divide-y divide-[#333333]">
                  {turnosInShift.map((item) => {
                    const isLibre = !item.turno || item.turno.estado === 'libre';
                    const isBloqueado = item.turno?.estado === 'bloqueado';
                    const isOcupado = item.turno?.estado === 'ocupado';

                    return (
                      <div key={item.canchaId} className="px-4 py-3 flex flex-col gap-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold uppercase text-[#666] tracking-wider">Cancha {item.canchaId}</span>
                          
                          {isLibre && (
                            <Badge variant="outline" className="bg-[#00AA55]/10 text-[#00AA55] border-[#00AA55]/20 font-bold px-2 py-0 h-5 text-[10px] uppercase">
                              Libre
                            </Badge>
                          )}
                          {isBloqueado && (
                            <Badge variant="outline" className="bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 font-bold px-2 py-0 h-5 text-[10px] uppercase flex items-center gap-1">
                              <ShieldAlert className="h-3 w-3" /> Bloqueado
                            </Badge>
                          )}
                          {isOcupado && (
                            <Badge variant="outline" className="bg-[#1d4ed8]/10 text-[#60a5fa] border-[#1d4ed8]/30 font-bold px-2 py-0 h-5 text-[10px] uppercase">
                              Reservado
                            </Badge>
                          )}
                        </div>

                        {isOcupado && item.turno && (
                          <div className="flex flex-col">
                            <span className="text-foreground font-semibold text-sm">
                              {item.turno.socioNombreCompleto}
                            </span>
                            {item.turno.acompanante && (
                              <span className="text-[#999999] text-xs mt-0.5">
                                + {item.turno.acompanante}
                              </span>
                            )}
                          </div>
                        )}

                        {isBloqueado && item.turno && (
                          <span className="text-foreground font-medium text-sm">
                            {item.turno.motivoBloqueo || 'Motivo no especificado'}
                          </span>
                        )}

                        {isLibre && (
                          <span className="text-[#444] text-sm italic">
                            Sin reservas
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
