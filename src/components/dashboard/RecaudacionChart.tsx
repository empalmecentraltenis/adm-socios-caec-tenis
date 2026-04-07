'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface RecaudacionChartProps {
  data: { mes: string; total: number }[] | null;
  loading: boolean;
}

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('es-AR');
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#2A2A2A] border border-[#444444] rounded-lg px-3 py-2 shadow-lg">
        <p className="text-[#999999] text-xs">{label}</p>
        <p className="text-[#FFCC00] text-sm font-bold">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
}

export default function RecaudacionChart({ data, loading }: RecaudacionChartProps) {
  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Recaudación Mensual</h3>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 bg-[#2A2A2A]" />
          <Skeleton className="h-[250px] w-full bg-[#2A2A2A]" />
        </div>
      ) : data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis
              dataKey="mes"
              tick={{ fill: '#999999', fontSize: 12 }}
              axisLine={{ stroke: '#333333' }}
              tickLine={{ stroke: '#333333' }}
            />
            <YAxis
              tickFormatter={formatCurrency}
              tick={{ fill: '#999999', fontSize: 12 }}
              axisLine={{ stroke: '#333333' }}
              tickLine={{ stroke: '#333333' }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill="#FFCC00" fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[250px]">
          <p className="text-[#999999] text-sm">Sin datos disponibles</p>
        </div>
      )}
    </div>
  );
}
