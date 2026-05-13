'use client';

import { useState, useEffect } from 'react';
import { Calendar, Search, Loader2, DollarSign } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Pago {
  id: string;
  monto: number;
  metodoPago: string;
  mesPagado: string;
  createdAt: string;
  socio: {
    nombre: string;
    apellido: string;
    categoria: string;
  };
}

const MESES_NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export default function PagosPorMes() {
  const [mesSeleccionado, setMesSeleccionado] = useState('');
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    // Generar opciones de meses (últimos 12 meses)
    const opts = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const lab = `${MESES_NOMBRES[d.getMonth()]} ${d.getFullYear()}`;
      opts.push({ value: val, label: lab });
    }
    setOptions(opts);
    setMesSeleccionado(opts[0].value);
  }, []);

  useEffect(() => {
    if (!mesSeleccionado) return;
    
    async function fetchPagos() {
      setLoading(true);
      try {
        const res = await fetch(`/api/reportes/pagos-mes?mes=${mesSeleccionado}`);
        if (res.ok) {
          const data = await res.json();
          setPagos(data);
        }
      } catch (error) {
        console.error('Error fetching payments:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPagos();
  }, [mesSeleccionado]);

  const totalRecaudado = pagos.reduce((acc, p) => acc + p.monto, 0);

  return (
    <Card className="bg-[#1E1E1E] border-[#333333] text-white">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-[#FFCC00]" />
            Socios que pagaron
          </CardTitle>
          <p className="text-[10px] text-[#999999] mt-1">Lista de socios que abonaron la cuota del mes elegido</p>
        </div>
        <Select value={mesSeleccionado} onValueChange={setMesSeleccionado}>
          <SelectTrigger className="w-[160px] bg-[#2A2A2A] border-[#333333] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[#1E1E1E] border-[#333333]">
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-3 p-2 bg-[#2A2A2A]/50 rounded-lg border border-[#333333]">
          <div className="text-[11px] text-[#999999]">Total Pagos: <span className="text-white font-bold">{pagos.length}</span></div>
          <div className="text-[11px] text-[#999999]">Recaudado: <span className="text-[#FFCC00] font-bold">${totalRecaudado.toLocaleString('es-AR')}</span></div>
        </div>
        
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#FFCC00]" />
          </div>
        ) : pagos.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-[#666666] text-xs gap-2">
            <Calendar className="h-8 w-8 opacity-20" />
            No hay pagos registrados para este mes
          </div>
        ) : (
          <ScrollArea className="h-[200px] pr-3">
            <div className="space-y-2">
              {pagos.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-[#252525] border border-[#333333]/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{p.socio.apellido}, {p.socio.nombre}</p>
                    <p className="text-[10px] text-[#666666] flex items-center gap-1">
                      <span className="capitalize">{p.metodoPago}</span> • {new Date(p.createdAt).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="text-xs font-bold text-[#FFCC00]">${p.monto.toLocaleString('es-AR')}</p>
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 border-[#333333] text-[#999999]">
                      {p.socio.categoria}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
