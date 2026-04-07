'use client';

import { useState, useEffect, useCallback } from 'react';
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

interface SocioForPago {
  id: string;
  nombre: string;
  apellido: string;
}

interface SocioForAbm {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  telefono: string;
  estado?: string;
  categoria?: string;
}

interface SocioForHistorial {
  id: string;
  nombre: string;
  apellido: string;
  categoria: string;
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
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [sociosData, setSociosData] = useState<SocioFull[]>([]);
  const [sociosRefreshKey, setSociosRefreshKey] = useState(0);

  // Modal states
  const [socioForPago, setSocioForPago] = useState<SocioForPago | null>(null);
  const [pagoModalOpen, setPagoModalOpen] = useState(false);
  const [socioForAbm, setSocioForAbm] = useState<SocioForAbm | null>(null);
  const [abmModalOpen, setAbmModalOpen] = useState(false);
  const [socioForHistorial, setSocioForHistorial] = useState<SocioForHistorial | null>(null);
  const [historialModalOpen, setHistorialModalOpen] = useState(false);
  const [pagoMasivoModalOpen, setPagoMasivoModalOpen] = useState(false);

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
    if (activeTab === 'dashboard') {
      fetchDashboard();
    }
  }, [activeTab, fetchDashboard]);

  useEffect(() => {
    fetchSocios();
  }, [sociosRefreshKey, fetchSocios]);

  function handleNavigate(tab: string) {
    setActiveTab(tab as TabType);
  }

  function handleRegistrarPago(socio: SocioForPago) {
    setSocioForPago(socio);
    setPagoModalOpen(true);
  }

  function handlePagoSuccess() {
    setPagoModalOpen(false);
    setSocioForPago(null);
    setSociosRefreshKey((prev) => prev + 1);
    if (activeTab === 'dashboard') fetchDashboard();
  }

  function handleCrearSocio() {
    setSocioForAbm(null);
    setAbmModalOpen(true);
  }

  function handleEditarSocio(socio: SocioForAbm) {
    setSocioForAbm(socio);
    setAbmModalOpen(true);
  }

  function handleAbmSuccess() {
    setAbmModalOpen(false);
    setSocioForAbm(null);
    setSociosRefreshKey((prev) => prev + 1);
    if (activeTab === 'dashboard') fetchDashboard();
  }

  function handleAbmCancel() {
    setAbmModalOpen(false);
    setSocioForAbm(null);
  }

  function handleVerHistorial(socio: SocioForHistorial) {
    setSocioForHistorial(socio);
    setHistorialModalOpen(true);
  }

  function handlePagoMasivoSuccess() {
    setPagoMasivoModalOpen(false);
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
          <div className="mb-4">
            <h1 className="text-white text-xl lg:text-2xl font-bold">
              {pageTitles[activeTab].title}
            </h1>
            <p className="text-[#999999] text-sm mt-1">
              {pageTitles[activeTab].subtitle}
            </p>
          </div>

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && (
            <div className="space-y-5">
              <KpiCards data={dashboardData?.kpis ?? null} loading={dashLoading} />
              {/* Fila superior: Morosos Críticos + Actividad Reciente */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <MorososCriticos data={dashboardData?.morosos ?? null} loading={dashLoading} />
                <ActividadLog />
              </div>
              {/* Fila media: Ingresos por Categoría (con selector mes) + Distribución por Categoría */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <IngresosPorCategoria data={dashboardData?.ingresosPorCategoria ?? null} loading={dashLoading} />
                <DistribucionCategorias data={dashboardData?.distribucionCategorias ?? null} loading={dashLoading} />
              </div>
              {/* Fila inferior: Recaudación Mensual + Evolución de Socios */}
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
              onEditarSocio={handleEditarSocio}
              onCrearSocio={handleCrearSocio}
              onVerHistorial={handleVerHistorial}
              onPagoMasivo={() => setPagoMasivoModalOpen(true)}
              socios={sociosData}
            />
          )}

          {/* Reportes Tab */}
          {activeTab === 'reportes' && <ReportesTable />}

          {/* Configuración Tab */}
          {activeTab === 'configuracion' && <ConfiguracionPanel />}
        </div>
      </main>

      {/* Modals */}
      <RegistrarPagoModal
        open={pagoModalOpen}
        onOpenChange={setPagoModalOpen}
        socio={socioForPago}
        onSuccess={handlePagoSuccess}
      />

      <AbmSocioModal
        key={abmModalOpen ? (socioForAbm?.id || 'new') : 'closed'}
        open={abmModalOpen}
        onOpenChange={(v) => { if (!v) handleAbmCancel(); else setAbmModalOpen(true); }}
        socio={socioForAbm}
        onSuccess={handleAbmSuccess}
      />

      <HistorialPagosModal
        open={historialModalOpen}
        onOpenChange={setHistorialModalOpen}
        socio={socioForHistorial}
      />

      <PagoMasivoModal
        open={pagoMasivoModalOpen}
        onOpenChange={setPagoMasivoModalOpen}
        socios={sociosData}
        onSuccess={handlePagoMasivoSuccess}
      />
    </div>
  );
}
