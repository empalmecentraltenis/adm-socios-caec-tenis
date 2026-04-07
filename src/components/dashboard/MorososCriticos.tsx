'use client';

import { AlertTriangle, PartyPopper } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface Moroso {
  id: string;
  nombre: string;
  apellido: string;
  mesesAdeudados: number;
}

interface MorososCriticosProps {
  data: Moroso[] | null;
  loading: boolean;
}

export default function MorososCriticos({ data, loading }: MorososCriticosProps) {
  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="h-5 w-5 text-[#EF4444]" />
        <h3 className="text-white text-lg font-semibold">Morosos Críticos</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-[#2A2A2A]" />
          ))}
        </div>
      ) : data && data.length > 0 ? (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {data.map((moroso, index) => (
            <div
              key={moroso.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-[#252525] border-l-[3px] border-l-[#EF4444] hover:bg-[#2A2A2A] transition-colors"
            >
              <span className="text-[#FFCC00] font-bold text-sm w-6 text-center">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {moroso.nombre} {moroso.apellido}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EF4444]/15 text-[#EF4444] text-xs font-medium whitespace-nowrap">
                {moroso.mesesAdeudados} {moroso.mesesAdeudados === 1 ? 'mes' : 'meses'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <PartyPopper className="h-8 w-8 text-[#00AA55]" />
          <p className="text-[#00AA55] text-sm font-medium">¡Todos al día!</p>
          <p className="text-[#999999] text-xs">No hay socios morosos</p>
        </div>
      )}
    </div>
  );
}
