'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Sidebar from '@/components/layout/Sidebar';
import KpiCards from '@/components/dashboard/KpiCards';
import RecaudacionChart from '@/components/dashboard/RecaudacionChart';
import CrecimientoChart from '@/components/dashboard/CrecimientoChart';
import MorososCriticos from '@/components/dashboard/MorososCriticos';
import DistribucionCategorias from '@/components/dashboard/DistribucionCategorias';
import IngresosPorCategoria from '@/components/dashboard/IngresosPorCategoria';
import ActividadLog from '@/components/actividad/ActividadLog';
import SociosTable from '@/components/socios/SociosTable';
import RegistrarPagoModal from '@/components/socios/RegistrarPagoModal';
import HistorialPagosModal from '@/components/socios/HistorialPagosModal';
import PagoMasivoModal from '@/components/socios/PagoMasivoModal';
import AbmSocioModal from '@/components/socios/AbmSocioModal';
import ReportesTable from '@/components/reportes/ReportesTable';
import ConfiguracionPanel from '@/components/configuracion/ConfiguracionPanel';
import { Loader2 } from 'lucide-react';

type TabType = 'dashboard' | 'socios' | 'reportes' | 'configuracion';

interface DashboardData {
  kpis: {
    totalActivos: number;
    sociosAlDia: number;
    sociosDeudores: number;
    ingresosMes: number;
    deudaTotalEstimada: number;
  };
  recaudacionMensual: { mes: string; total: number }[];
  crecimientoMensual: { mes: string; total: number }[];
  morosos: { id: string; nombre: string; apellido: string; mesesAdeudados: number }[];
  distribucionCategorias: { categoria: string; cantidad: number; cuota: number; color: string }[];
  ingresosPorCategoria: { categoria: string; total: number }[];
  ultimasActividades: { id: string; accion: string; detalle: string; createdAt: string }[];
}

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

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<TabType>('socios');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [sociosData, setSociosData] = useState<SocioFull[]>([]);
  const [sociosRefreshKey, setSociosRefreshKey] = useState(0);

  // Modal states
  const [socioForPago, setSocioForPago] = useState<any>(null);
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [socioForAbm, setSocioForAbm] = useState<any>(null);
  const [abmModalOpen, setAbmModalOpen] = useState(false);
  const [socioForHistorial, setSocioForHistorial] = useState<any>(null);
  const [historialModalOpen, setHistorialModalOpen] = useState(false);
  const [pagoMasivoModalOpen, setPagoMasivoModalOpen] = useState(false);

  const isReadOnly = session?.user && (session.user as any).role === 'viewer';

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
    } finally {
      setDashLoading(false);
    }
  }, []);

  // Fetch socios for table
  const fetchSocios = useCallback(async () => {
    try {
      const res = await fetch('/api/socios?activos=true');
      if (res.ok) {
        const data = await res.json();
        setSociosData(data);
      }
    } catch (error) {
      console.error('Error al cargar socios:', error);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'dashboard' && status === 'authenticated') {
      fetchDashboard();
    }
  }, [activeTab, fetchDashboard, status]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchSocios();
    }
  }, [sociosRefreshKey, fetchSocios, status]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center gap-4 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium animate-pulse">Cargando panel...</p>
      </div>
    );
  }

  function handleNavigate(tab: string) {
    setActiveTab(tab as TabType);
  }

  function handleRegistrarPago(socio: any) {
    if (isReadOnly) return;
    setSocioForPago(socio);
    setPagoModalOpen(true);
  }

  function handleSocioRefresh() {
    setSociosRefreshKey((prev) => prev + 1);
    if (activeTab === 'dashboard') fetchDashboard();
  }

  const pageTitles: Record<TabType, { title: string; subtitle: string }> = {
    dashboard: { title: 'Dashboard', subtitle: 'Vista general del club' },
    socios: { title: 'Socios / Pagos', subtitle: 'Gestión de socios y registro de pagos' },
    reportes: { title: 'Reportes', subtitle: 'Reporte de morosidad y financieros' },
    configuracion: { title: 'Configuración', subtitle: 'Valores de cuota y categorías' },
  };

  return (
    <div className="min-h-screen bg-[#121212]">
      <Sidebar
        activeTab={activeTab}
        onNavigate={handleNavigate}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpen={() => setSidebarOpen(true)}
      />

      <main className="lg:ml-[260px] min-h-screen">
        <div className="p-4 pt-16 lg:pt-4 lg:p-6 max-w-[1400px] mx-auto">
          {/* Page Title */}
          <div className="mb-4 flex justify-between items-center">
            <div>
                <h1 className="text-white text-xl lg:text-2xl font-bold">
                {pageTitles[activeTab].title}
                </h1>
                <p className="text-[#999999] text-sm mt-1">
                {pageTitles[activeTab].subtitle}
                </p>
            </div>
            {isReadOnly && (
                <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                    <span className="text-primary text-[10px] font-bold uppercase tracking-wider">Modo Solo Lectura</span>
                </div>
            )}
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              <KpiCards data={dashboardData?.kpis ?? null} loading={dashLoading} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <MorososCriticos data={dashboardData?.morosos ?? null} loading={dashLoading} />
                <ActividadLog />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <IngresosPorCategoria data={dashboardData?.ingresosPorCategoria ?? null} loading={dashLoading} />
                <DistribucionCategorias data={dashboardData?.distribucionCategorias ?? null} loading={dashLoading} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <RecaudacionChart data={dashboardData?.recaudacionMensual ?? null} loading={dashLoading} />
                <CrecimientoChart data={dashboardData?.crecimientoMensual ?? null} loading={dashLoading} />
              </div>
            </div>
          )}

          {/* Socios Tab */}
          {activeTab === 'socios' && (
            <SociosTable
              key={sociosRefreshKey}
              refreshKey={sociosRefreshKey}
              onRegistrarPago={handleRegistrarPago}
              onEditarSocio={(s) => { if (!isReadOnly) { setSocioForAbm(s); setAbmModalOpen(true); } }}
              onCrearSocio={() => { if (!isReadOnly) { setSocioForAbm(null); setAbmModalOpen(true); } }}
              onVerHistorial={(s) => { setSocioForHistorial(s); setHistorialModalOpen(true); }}
              onPagoMasivo={() => { if (!isReadOnly) setPagoMasivoModalOpen(true); }}
              socios={sociosData}
              readOnly={isReadOnly}
            />
          )}

          {/* Reportes Tab */}
          {activeTab === 'reportes' && <ReportesTable />}

          {/* Configuración Tab */}
          {activeTab === 'configuracion' && <ConfiguracionPanel readOnly={isReadOnly} />}
        </div>
      </main>

      {/* Modals */}
      {!isReadOnly && (
        <>
          <RegistrarPagoModal
            open={pagoModalOpen}
            onOpenChange={setPagoModalOpen}
            socio={socioForPago}
            onSuccess={() => { setPagoModalOpen(false); handleSocioRefresh(); }}
          />
          <AbmSocioModal
            key={abmModalOpen ? (socioForAbm?.id || 'new') : 'closed'}
            open={abmModalOpen}
            onOpenChange={setAbmModalOpen}
            socio={socioForAbm}
            onSuccess={() => { setAbmModalOpen(false); handleSocioRefresh(); }}
          />
          <PagoMasivoModal
            open={pagoMasivoModalOpen}
            onOpenChange={setPagoMasivoModalOpen}
            socios={sociosData}
            onSuccess={() => { setPagoMasivoModalOpen(false); handleSocioRefresh(); }}
          />
        </>
      )}

      <HistorialPagosModal
        open={historialModalOpen}
        onOpenChange={setHistorialModalOpen}
        socio={socioForHistorial}
      />
    </div>
  );
}
