'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, Calendar, CreditCard, AlertTriangle, AlertCircle } from 'lucide-react';

interface Pago {
  id: string;
  mesPagado: string;
  monto: number;
  metodoPago: string;
  fechaRegistro: string;
}

interface HistorialPagosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  socio: { id: string; nombre: string; apellido: string; categoria?: string } | null;
}

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function formatMes(mesPagado: string): string {
  const [year, month] = mesPagado.split('-');
  return `${MESES[parseInt(month) - 1]} ${year}`;
}

function formatMetodo(metodo: string): string {
  switch (metodo) {
    case 'efectivo': return '💵 Efectivo';
    case 'transferencia': return '🏦 Transferencia';
    case 'mercadopago': return '📱 MercadoPago';
    case 'pendiente': return 'Deuda Pendiente';
    default: return metodo;
  }
}

function getMetodoColor(metodo: string): string {
  switch (metodo) {
    case 'efectivo': return 'text-green-400';
    case 'transferencia': return 'text-blue-400';
    case 'mercadopago': return 'text-cyan-400';
    case 'pendiente': return 'text-red-400 font-bold';
    default: return 'text-gray-400';
  }
}

export default function HistorialPagosModal({ open, onOpenChange, socio }: HistorialPagosModalProps) {
  const [pagos, setPagos] = useState<Pago[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && socio) {
      setLoading(true);
      fetch(`/api/pagos?socioId=${socio.id}`)
        .then(res => res.ok ? res.json() : [])
        .then(data => {
          setPagos(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, socio]);

  const totalPagado = pagos.reduce((acc, p) => acc + (p.metodoPago !== 'pendiente' ? p.monto : 0), 0);
  const totalPendiente = pagos.reduce((acc, p) => acc + (p.metodoPago === 'pendiente' ? p.monto : 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1E1E1E] border-[#333333] sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-white">
            Historial de Pagos
          </DialogTitle>
          <DialogDescription className="text-[#999999]">
            {socio ? `${socio.nombre} ${socio.apellido}${socio.categoria ? ` (${socio.categoria})` : ''}` : ''}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 px-1">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full bg-[#2A2A2A]" />
            ))}
          </div>
        ) : pagos.length === 0 ? (
          <div className="text-center py-8">
            <DollarSign className="h-10 w-10 text-[#333333] mx-auto mb-2" />
            <p className="text-[#999999] text-sm">Sin registros</p>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="bg-[#252525] border border-[#333333] rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#FFCC00]" />
                  <span className="text-[#CCCCCC] text-xs font-semibold">{pagos.length} registros en total</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-[#1E1E1E] rounded p-2 text-center border border-[#333333]">
                  <p className="text-[#999999] text-[10px] uppercase">Total Pagado</p>
                  <p className="text-[#00AA55] font-bold text-sm">${totalPagado.toLocaleString('es-AR')}</p>
                </div>
                <div className="bg-[#1E1E1E] rounded p-2 text-center border border-[#333333]">
                  <p className="text-[#999999] text-[10px] uppercase">Deuda Pendiente</p>
                  <p className="text-red-400 font-bold text-sm">${totalPendiente.toLocaleString('es-AR')}</p>
                </div>
              </div>
            </div>

            {/* Lista de pagos */}
            <div className="flex-1 overflow-y-auto space-y-2 mt-1 pr-1">
              {pagos.map((pago) => (
                <div
                  key={pago.id}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    pago.metodoPago === 'pendiente'
                      ? 'bg-red-400/5 border-red-400/20'
                      : 'bg-[#252525] border-[#333333]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                      pago.metodoPago === 'pendiente' ? 'bg-red-400/10' : 'bg-[#FFCC00]/10'
                    }`}>
                      {pago.metodoPago === 'pendiente' ? (
                        <AlertCircle className="h-4 w-4 text-red-400" />
                      ) : (
                        <CreditCard className="h-4 w-4 text-[#FFCC00]" />
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-medium ${pago.metodoPago === 'pendiente' ? 'text-red-400' : 'text-white'}`}>
                        {formatMes(pago.mesPagado)}
                      </p>
                      <p className={`text-[11px] ${getMetodoColor(pago.metodoPago)}`}>
                        {formatMetodo(pago.metodoPago)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-semibold ${pago.metodoPago === 'pendiente' ? 'text-red-400' : 'text-white'}`}>
                      ${pago.monto.toLocaleString('es-AR')}
                    </span>
                    {pago.metodoPago !== 'pendiente' && (
                      <p className="text-[#666666] text-[10px] mt-0.5">Pagado</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
