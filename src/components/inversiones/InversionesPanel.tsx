'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Landmark, 
  TrendingUp, 
  DollarSign, 
  MoreVertical, 
  Pencil, 
  Trash2,
  Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { formatCurrency, formatInputCurrency, parseCurrency } from '@/lib/formatters';
import PlazoFijoModal, { PlazoFijo } from './PlazoFijoModal';
import { Loader2 } from 'lucide-react';

export default function InversionesPanel({ readOnly = false }: { readOnly?: boolean }) {
  const [plazos, setPlazos] = useState<PlazoFijo[]>([]);
  const [dolares, setDolares] = useState<string>('0');
  const [saldoCaja, setSaldoCaja] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlazo, setEditingPlazo] = useState<PlazoFijo | null>(null);
  
  const [editandoDolares, setEditandoDolares] = useState(false);
  const [tempDolares, setTempDolares] = useState('');
  const [savingDolares, setSavingDolares] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Para el saldo de caja, pedimos el balance hasta una fecha muy futura para traer el total actual
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const [plazosRes, configRes, balanceRes] = await Promise.all([
        fetch('/api/plazos-fijos'),
        fetch('/api/configuracion'),
        fetch(`/api/movimientos/balance-at?date=2099-12-31`)
      ]);

      if (plazosRes.ok) {
        const data = await plazosRes.json();
        setPlazos(data);
      }
      if (configRes.ok) {
        const data = await configRes.json();
        setDolares(data.ahorros_dolares || '0');
      }
      if (balanceRes.ok) {
        const data = await balanceRes.json();
        setSaldoCaja(data.balance || 0);
      }
    } catch (error) {
      console.error('Error fetching inversiones:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (readOnly) return;
    if (!confirm('¿Estás seguro de eliminar este plazo fijo?')) return;

    try {
      const res = await fetch(`/api/plazos-fijos/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast({ title: 'Plazo fijo eliminado' });
        fetchData();
      }
    } catch {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    }
  };

  const handleSaveDolares = async () => {
    setSavingDolares(true);
    try {
      const parsed = parseCurrency(tempDolares);
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ahorros_dolares: parsed })
      });
      if (res.ok) {
        setDolares(parsed.toString());
        setEditandoDolares(false);
        toast({ title: 'Dólares actualizados' });
      } else {
        throw new Error('Error saving');
      }
    } catch (e) {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    } finally {
      setSavingDolares(false);
    }
  };

  const { capitalPlazosActivos, interesesGeneradosTotal } = useMemo(() => {
    const activos = plazos.filter(p => p.estado === 'activo');
    const cap = activos.reduce((acc, p) => acc + p.montoInvertido, 0);
    const int = activos.reduce((acc, p) => acc + p.interesGenerado, 0);
    return { capitalPlazosActivos: cap, interesesGeneradosTotal: int };
  }, [plazos]);

  const dolaresNum = parseFloat(dolares) || 0;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Inversiones y Ahorros</h2>
          <p className="text-[#999999] text-sm">Resumen de plazos fijos, dólares y capital disponible.</p>
        </div>
        {!readOnly && (
          <Button 
            onClick={() => { setEditingPlazo(null); setModalOpen(true); }}
            className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-bold"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Plazo Fijo
          </Button>
        )}
      </div>

      {/* KPI Cards - Resumen General */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Saldo en Caja */}
        <Card className="bg-[#1A1A1A] border-[#333333] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <Wallet className="h-6 w-6 text-blue-500" />
            </div>
            <div>
              <p className="text-[#999999] text-xs font-medium uppercase tracking-wider">Saldo en Caja (Pesos)</p>
              <h4 className="text-white text-xl font-bold mt-0.5">{formatCurrency(saldoCaja)}</h4>
            </div>
          </CardContent>
        </Card>

        {/* Plazos Fijos Activos */}
        <Card className="bg-[#1A1A1A] border-[#333333] overflow-hidden">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-green-500/10">
              <Landmark className="h-6 w-6 text-green-500" />
            </div>
            <div>
              <p className="text-[#999999] text-xs font-medium uppercase tracking-wider">Capital Plazos Fijos</p>
              <h4 className="text-white text-xl font-bold mt-0.5">{formatCurrency(capitalPlazosActivos)}</h4>
            </div>
          </CardContent>
        </Card>

        {/* Total Pesos */}
        <Card className="bg-[#1A1A1A] border-[#FFCC00]/30 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-[#FFCC00]" />
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-[#FFCC00]/10">
              <TrendingUp className="h-6 w-6 text-[#FFCC00]" />
            </div>
            <div>
              <p className="text-[#999999] text-[10px] font-bold uppercase tracking-wider">Total Disp. (Pesos)</p>
              <h4 className="text-white text-xl font-bold mt-0.5">{formatCurrency(saldoCaja + capitalPlazosActivos)}</h4>
            </div>
          </CardContent>
        </Card>

        {/* Dólares */}
        <Card className="bg-[#1A1A1A] border-[#333333] overflow-hidden">
          <CardContent className="p-4 flex flex-col gap-2">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/10">
                <DollarSign className="h-6 w-6 text-emerald-500" />
              </div>
              <div className="flex-1">
                <p className="text-[#999999] text-[10px] font-bold uppercase tracking-wider">Ahorro Dólares</p>
                {!editandoDolares ? (
                  <div className="flex items-center justify-between">
                    <h4 className="text-emerald-500 text-xl font-bold mt-0.5">U$S {formatCurrency(dolaresNum).replace('$', '')}</h4>
                    {!readOnly && (
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-[#999999] hover:text-white" onClick={() => {
                        setTempDolares(formatCurrency(dolaresNum).replace('$ ', ''));
                        setEditandoDolares(true);
                      }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <Input 
                      value={tempDolares}
                      onChange={(e) => setTempDolares(formatInputCurrency(e.target.value))}
                      className="h-7 bg-[#2A2A2A] border-[#333333] text-white px-2 py-0 text-sm"
                      placeholder="0,00"
                      autoFocus
                    />
                    <Button 
                      size="sm" 
                      onClick={handleSaveDolares} 
                      disabled={savingDolares}
                      className="h-7 px-2 bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      {savingDolares ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Ok'}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setEditandoDolares(false)} 
                      className="h-7 px-2 text-[#999999]"
                    >
                      X
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <div className="bg-[#1A1A1A] border border-[#333333] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#333333] bg-[#262626] flex items-center justify-between">
          <h3 className="text-white font-bold text-sm">Historial de Plazos Fijos</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#262626] border-b border-[#333333]">
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider text-center w-12">N°</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider">Banco / Entidad</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider">Fechas</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider text-right">Monto Invertido</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider text-right">Interés Estimado</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider text-right">Total al Vencimiento</th>
                <th className="px-4 py-3 text-[#999999] text-[10px] font-bold uppercase tracking-wider text-center">Estado</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333333]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#666666] italic">Cargando plazos fijos...</td>
                </tr>
              ) : plazos.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#666666] italic">No hay plazos fijos registrados.</td>
                </tr>
              ) : (
                plazos.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-4 py-3.5 text-center text-[#666666] font-mono text-xs">{idx + 1}</td>
                    <td className="px-4 py-3.5 text-white text-sm font-medium">
                      {p.banco}
                    </td>
                    <td className="px-4 py-3.5 text-white text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[#999999]">Desde: <span className="text-white">{p.fechaConstitucion}</span></span>
                        <span className="text-[#999999]">Hasta: <span className="text-[#FFCC00] font-medium">{p.fechaVencimiento}</span></span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-sm text-white">
                      {formatCurrency(p.montoInvertido)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-sm text-green-500">
                      +{formatCurrency(p.interesGenerado)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-sm text-[#FFCC00]">
                      {formatCurrency(p.montoInvertido + p.interesGenerado)}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        p.estado === 'activo' 
                          ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20' 
                          : 'bg-green-500/10 text-green-500 border border-green-500/20'
                      }`}>
                        {p.estado}
                      </span>
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
                              onClick={() => { setEditingPlazo(p); setModalOpen(true); }}
                              className="focus:bg-[#2A2A2A] focus:text-white cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(p.id)}
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

      <PlazoFijoModal 
        open={modalOpen} 
        onOpenChange={setModalOpen}
        plazoFijo={editingPlazo}
        onSuccess={() => { setModalOpen(false); fetchData(); }}
      />
    </div>
  );
}
