'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lock, Loader2, LogOut } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import SociosTable from '@/components/socios/SociosTable';
import RegistrarPagoModal from '@/components/socios/RegistrarPagoModal';
import HistorialPagosModal from '@/components/socios/HistorialPagosModal';
import PagoMasivoModal from '@/components/socios/PagoMasivoModal';
import { useToast } from '@/hooks/use-toast';

interface SocioFull {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  telefono: string;
  fechaAlta: string;
  estado: string;
  categoria: string;
  alDia: boolean;
  mesesAdeudados: number;
  totalPagado: number;
  deudaEstimada: number;
  valorCuota: number;
  pagos: Array<{ id: string; mesPagado: string; monto: number; metodoPago: string }>;
}

export default function SecretariaPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const { toast } = useToast();

  const [sociosData, setSociosData] = useState<SocioFull[]>([]);
  const [loadingSocios, setLoadingSocios] = useState(false);
  const [sociosRefreshKey, setSociosRefreshKey] = useState(0);

  // Modal states
  const [socioForPago, setSocioForPago] = useState<any>(null);
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [socioForHistorial, setSocioForHistorial] = useState<any>(null);
  const [historialModalOpen, setHistorialModalOpen] = useState(false);
  const [pagoMasivoModalOpen, setPagoMasivoModalOpen] = useState(false);

  useEffect(() => {
    // Check if previously unlocked in this session
    const isUnlocked = sessionStorage.getItem('secretaria_unlocked');
    if (isUnlocked === 'true') {
      setUnlocked(true);
    }
  }, []);

  const fetchSocios = useCallback(async () => {
    setLoadingSocios(true);
    try {
      const res = await fetch('/api/socios');
      if (res.ok) {
        const data = await res.json();
        setSociosData(data);
      }
    } catch (error) {
      console.error('Error al cargar socios:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar los socios.',
        variant: 'destructive',
      });
    } finally {
      setLoadingSocios(false);
    }
  }, [toast]);

  useEffect(() => {
    if (unlocked) {
      fetchSocios();
    }
  }, [unlocked, sociosRefreshKey, fetchSocios]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1436') {
      setUnlocked(true);
      sessionStorage.setItem('secretaria_unlocked', 'true');
      setError('');
    } else {
      setError('PIN incorrecto');
      setPin('');
    }
  };

  const handleLogout = () => {
    setUnlocked(false);
    sessionStorage.removeItem('secretaria_unlocked');
    setPin('');
  };

  const handleSocioRefresh = () => {
    setSociosRefreshKey((prev) => prev + 1);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-8 max-w-sm w-full shadow-xl">
          <div className="flex flex-col items-center mb-6">
            <div className="h-12 w-12 bg-[#FFCC00]/20 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-[#FFCC00]" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Acceso Secretaría</h2>
            <p className="text-[#999999] text-sm text-center mt-2">
              Ingrese el PIN de seguridad para acceder al registro de socios y pagos.
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
            <Button type="submit" className="w-full bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-medium">
              Ingresar
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-[#333333] bg-[#1E1E1E]">
        <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#FFCC00] flex items-center justify-center font-bold text-[#121212]">
              C
            </div>
            <div>
              <h1 className="text-foreground font-bold leading-tight">CAEC Tenis</h1>
              <p className="text-[#999999] text-xs">Portal de Secretaría</p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="text-[#999999] hover:text-foreground hover:bg-[#2A2A2A]"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Salir
          </Button>
        </div>
      </header>

      <main className="p-4 lg:p-6 max-w-[1400px] mx-auto">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">Gestión de Socios y Pagos</h2>
          <p className="text-[#999999] text-sm mt-1">Busque a un socio para registrar su pago mensual.</p>
        </div>

        {loadingSocios && sociosData.length === 0 ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-[#FFCC00]" />
          </div>
        ) : (
          <SociosTable
            refreshKey={sociosRefreshKey}
            socios={sociosData}
            onRegistrarPago={(socio) => {
              setSocioForPago(socio);
              setPagoModalOpen(true);
            }}
            onEditarSocio={() => {}} // Disabled by hideABM
            onCrearSocio={() => {}} // Disabled by hideABM
            onVerHistorial={(socio) => {
              setSocioForHistorial(socio);
              setHistorialModalOpen(true);
            }}
            onPagoMasivo={() => setPagoMasivoModalOpen(true)}
            readOnly={false} // Needs to be false to allow payments
            hideABM={true} // Hides edit/create/delete buttons
          />
        )}
      </main>

      {/* Modals */}
      <RegistrarPagoModal
        open={pagoModalOpen}
        onOpenChange={setPagoModalOpen}
        socio={socioForPago}
        onSuccess={() => { setPagoModalOpen(false); handleSocioRefresh(); }}
      />
      <PagoMasivoModal
        open={pagoMasivoModalOpen}
        onOpenChange={setPagoMasivoModalOpen}
        socios={sociosData}
        onSuccess={() => { setPagoMasivoModalOpen(false); handleSocioRefresh(); }}
      />
      <HistorialPagosModal
        open={historialModalOpen}
        onOpenChange={setHistorialModalOpen}
        socio={socioForHistorial}
      />
    </div>
  );
}
