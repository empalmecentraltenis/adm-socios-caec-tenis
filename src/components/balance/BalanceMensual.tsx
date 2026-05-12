'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Plus, 
  FileDown, 
  Search, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Trash2
} from 'lucide-react';
import { format, addMonths, subMonths, isSameMonth, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import MovimientoModal from './MovimientoModal';
import { exportBalanceToPDF } from '@/lib/pdf-export';
import { formatCurrency } from '@/lib/formatters';

interface Movimiento {
  id: string;
  fecha: string;
  descripcion: string;
  responsable: string;
  tipo: 'ingreso' | 'egreso';
  monto: number;
}

export default function BalanceMensual({ readOnly = false }: { readOnly?: boolean }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMovimiento, setEditingMovimiento] = useState<Movimiento | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, [currentMonth]);

  async function fetchData() {
    setLoading(true);
    const mesStr = format(currentMonth, 'yyyy-MM');
    try {
      const [movRes, configRes] = await Promise.all([
        fetch(`/api/movimientos?mes=${mesStr}`),
        fetch('/api/configuracion')
      ]);

      if (movRes.ok) {
        const data = await movRes.json();
        setMovimientos(data);
      }
      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Error fetching balance data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate Initial Balance for current month
  // This logic assumes we have a starting balance for Jan 2026 and we fetch all previous months' net result.
  // For simplicity, we could also fetch a "Saldo Mensual" or just calculate from all time movements.
  // Given the user has data desde Enero 2026, let's calculate based on that.
  const [saldoInicial, setSaldoInicial] = useState(0);

  useEffect(() => {
    calculateSaldoInicial();
  }, [currentMonth, config]);

  async function calculateSaldoInicial() {
    if (!config) return;
    
    const startDate = new Date('2026-01-01T00:00:00Z');
    
    // Si es enero 2026 o antes, el saldo inicial es el base
    if (isSameMonth(currentMonth, startDate) || currentMonth < startDate) {
      setSaldoInicial(parseFloat(config.saldo_inicial_enero_2026 || '0'));
      return;
    }

    try {
      const res = await fetch(`/api/movimientos/balance-at?date=${format(currentMonth, 'yyyy-MM-01')}`);
      if (res.ok) {
        const { balance } = await res.json();
        // La API balance-at ya incluye el saldo inicial histórico
        setSaldoInicial(balance);
      }
    } catch (error) {
      console.error('Error calculating balance:', error);
    }
  }

  const { totalIngresos, totalEgresos, saldoFinal } = useMemo(() => {
    const ingresos = movimientos
      .filter(m => m.tipo === 'ingreso')
      .reduce((acc, m) => acc + m.monto, 0);
    const egresos = movimientos
      .filter(m => m.tipo === 'egreso')
      .reduce((acc, m) => acc + m.monto, 0);
    
    return {
      totalIngresos: ingresos,
      totalEgresos: egresos,
      saldoFinal: saldoInicial + ingresos - egresos
    };
  }, [movimientos, saldoInicial]);

  const handleDelete = async (id: string) => {
    if (readOnly) return;
    if (!confirm('¿Estás seguro de eliminar este movimiento?')) return;

    try {
      const res = await fetch(`/api/movimientos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Movimiento eliminado' });
        fetchData();
      }
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  const handleExportPDF = async () => {
    try {
      await exportBalanceToPDF(movimientos, {
        mesYear: format(currentMonth, 'MMMM yyyy', { locale: es }),
        saldoInicial,
        totalIngresos,
        totalEgresos,
        saldoCierre: saldoFinal
      });
    } catch (error: any) {
      console.error('Error exporting PDF:', error);
      toast({ 
        title: 'Error al generar PDF', 
        description: error.message || 'Error desconocido',
        variant: 'destructive' 
      });
    }
  };

  const tableWithBalances = useMemo(() => {
    let running = saldoInicial;
    return movimientos.map(m => {
      running += m.tipo === 'ingreso' ? m.monto : -m.monto;
      return { ...m, saldoAcumulado: running };
    });
  }, [movimientos, saldoInicial]);

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-[#1A1A1A] border-[#333333] text-white hover:bg-[#2A2A2A]"
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#1A1A1A] border border-[#333333] rounded-lg">
            <CalendarIcon className="h-4 w-4 text-[#FFCC00]" />
            <span className="text-white font-semibold min-w-[140px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: es })}
            </span>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            className="bg-[#1A1A1A] border-[#333333] text-white hover:bg-[#2A2A2A]"
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleExportPDF}
            className="bg-white/10 hover:bg-white/20 text-white border border-white/10"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
          {!readOnly && (
            <Button 
              onClick={() => { setEditingMovimiento(null); setModalOpen(true); }}
              className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-bold"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Movimiento
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[#1A1A1A] border-[#333333] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Wallet className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-[#999999] text-xs font-medium uppercase tracking-wider">Saldo Inicial</p>
              <h4 className="text-white text-xl font-bold mt-0.5">{formatCurrency(saldoInicial)}</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#333333] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <ArrowUpCircle className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-[#999999] text-xs font-medium uppercase tracking-wider">Ingresos</p>
              <h4 className="text-green-500 text-xl font-bold mt-0.5">+{formatCurrency(totalIngresos)}</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#333333] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-500/10">
              <ArrowDownCircle className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <p className="text-[#999999] text-xs font-medium uppercase tracking-wider">Egresos</p>
              <h4 className="text-red-500 text-xl font-bold mt-0.5">-{formatCurrency(totalEgresos)}</h4>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#1A1A1A] border-[#FFCC00]/30 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#FFCC00]" />
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-[#FFCC00]/10">
              <Search className="h-6 w-6 text-[#FFCC00]" />
            </div>
            <div>
              <p className="text-[#999999] text-xs font-medium uppercase tracking-wider">Saldo Final</p>
              <h4 className="text-white text-xl font-bold mt-0.5">{formatCurrency(saldoFinal)}</h4>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#262626] border-b border-[#333333]">
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider text-center w-12">N°</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider">Fecha</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider">Descripción / Concepto</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider">Responsable</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider text-right">Importe (+/-)</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider text-right">Saldo</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333333]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#666666] italic">Cargando movimientos...</td>
                </tr>
              ) : tableWithBalances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#666666] italic">No hay movimientos registrados en este mes.</td>
                </tr>
              ) : (
                tableWithBalances.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3.5 text-center text-[#666666] font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3.5 text-white text-sm whitespace-nowrap">
                      {(() => {
                        const [y, mm, dd] = m.fecha.split('-');
                        return `${dd}/${mm}/${y}`;
                      })()}
                    </td>
                    <td className="px-4 py-3.5 text-white text-sm">
                      <div className="font-medium">{m.descripcion}</div>
                    </td>
                    <td className="px-4 py-3.5 text-[#999999] text-sm italic">
                      {m.responsable}
                    </td>
                    <td className={`px-4 py-3.5 text-right font-bold text-sm ${m.tipo === 'ingreso' ? 'text-green-500' : 'text-red-500'}`}>
                      {m.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(m.monto)}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#FFCC00] font-bold text-sm">
                      {formatCurrency(m.saldoAcumulado)}
                    </td>
                    <td className="px-4 py-3.5">
                      {!readOnly && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#666666] hover:text-white">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#1A1A1A] border-[#333333] text-white">
                            <DropdownMenuItem 
                              onClick={() => { setEditingMovimiento(m); setModalOpen(true); }}
                              className="focus:bg-[#2A2A2A] focus:text-white cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(m.id)}
                              className="focus:bg-red-500/10 focus:text-red-500 text-red-500 cursor-pointer"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Eliminar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MovimientoModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
        movimiento={editingMovimiento}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
        defaultDate={currentMonth}
      />
    </div>
  );
}
