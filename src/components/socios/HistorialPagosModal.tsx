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
import { DollarSign, Calendar, CreditCard } from 'lucide-react';

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
    default: return metodo;
  }
}

function getMetodoColor(metodo: string): string {
  switch (metodo) {
    case 'efectivo': return 'text-green-400';
    case 'transferencia': return 'text-blue-400';
    case 'mercadopago': return 'text-cyan-400';
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

  const totalPagado = pagos.reduce((acc, p) => acc + p.monto, 0);

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
            <p className="text-[#999999] text-sm">Sin pagos registrados</p>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="bg-[#252525] border border-[#333333] rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#FFCC00]" />
                <span className="text-[#CCCCCC] text-xs">{pagos.length} pagos registrados</span>
              </div>
              <span className="text-[#FFCC00] font-bold text-sm">
                Total: ${totalPagado.toLocaleString('es-AR')}
              </span>
            </div>

            {/* Lista de pagos */}
            <div className="flex-1 overflow-y-auto space-y-2 mt-1 pr-1">
              {pagos.map((pago) => (
                <div
                  key={pago.id}
                  className="flex items-center justify-between p-3 bg-[#252525] border border-[#333333] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#FFCC00]/10 flex items-center justify-center">
                      <CreditCard className="h-4 w-4 text-[#FFCC00]" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{formatMes(pago.mesPagado)}</p>
                      <p className={`text-xs ${getMetodoColor(pago.metodoPago)}`}>
                        {formatMetodo(pago.metodoPago)}
                      </p>
                    </div>
                  </div>
                  <span className="text-white text-sm font-semibold">
                    ${pago.monto.toLocaleString('es-AR')}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
