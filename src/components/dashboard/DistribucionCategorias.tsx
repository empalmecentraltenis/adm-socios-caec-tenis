'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface DistribucionCategoriasProps {
  data: { categoria: string; cantidad: number; cuota: number; color: string }[] | null;
  loading: boolean;
}

const LABELS: Record<string, string> = {
  socio: 'Socio',
  alumno: 'Alumno',
  vitalicio: 'Vitalicio',
};

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { categoria: string; cantidad: number; cuota: number } }> }) {
  if (active && payload && payload.length) {
    const d = payload[0].payload;
    return (
      <div className="bg-[#2A2A2A] border border-[#444444] rounded-lg px-3 py-2 shadow-lg">
        <p className="text-white text-sm font-medium">{LABELS[d.categoria] || d.categoria}</p>
        <p className="text-[#999999] text-xs">{d.cantidad} miembros · ${d.cuota.toLocaleString('es-AR')}/mes</p>
      </div>
    );
  }
  return null;
}

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  return (
    <div className="flex items-center justify-center gap-4 mt-2">
      {payload.map((entry) => (
        <div key={`legend-${entry.value}-${entry.color}`} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[#999999] text-xs">{LABELS[entry.value] || entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function DistribucionCategorias({ data, loading }: DistribucionCategoriasProps) {
  const total = data ? data.reduce((acc, d) => acc + d.cantidad, 0) : 0;

  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Distribución por Categoría</h3>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-40 bg-[#2A2A2A]" />
          <Skeleton className="h-[200px] w-full bg-[#2A2A2A] rounded-full" />
        </div>
      ) : data && data.length > 0 ? (
        <div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="cantidad"
                nameKey="categoria"
                strokeWidth={0}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend content={<CustomLegend />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center mt-1">
            <span className="text-[#999999] text-xs">{total} miembros activos</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-[200px]">
          <p className="text-[#999999] text-sm">Sin datos</p>
        </div>
      )}
    </div>
  );
}
