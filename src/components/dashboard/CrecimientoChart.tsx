'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface CrecimientoChartProps {
  data: { mes: string; total: number }[] | null;
  loading: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#2A2A2A] border border-[#444444] rounded-lg px-3 py-2 shadow-lg">
        <p className="text-[#999999] text-xs">{label}</p>
        <p className="text-[#FFCC00] text-sm font-bold">{payload[0].value} socios</p>
      </div>
    );
  }
  return null;
}

export default function CrecimientoChart({ data, loading }: CrecimientoChartProps) {
  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-6">
      <h3 className="text-white text-lg font-semibold mb-4">Evolución de Socios</h3>
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 bg-[#2A2A2A]" />
          <Skeleton className="h-[250px] w-full bg-[#2A2A2A]" />
        </div>
      ) : data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="sociosGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFCC00" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#FFCC00" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis
              dataKey="mes"
              tick={{ fill: '#999999', fontSize: 12 }}
              axisLine={{ stroke: '#333333' }}
              tickLine={{ stroke: '#333333' }}
            />
            <YAxis
              tick={{ fill: '#999999', fontSize: 12 }}
              axisLine={{ stroke: '#333333' }}
              tickLine={{ stroke: '#333333' }}
              width={40}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#FFCC00', strokeOpacity: 0.2 }} />
            <Area
              type="monotone"
              dataKey="total"
              stroke="#FFCC00"
              strokeWidth={2}
              fill="url(#sociosGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[250px]">
          <p className="text-[#999999] text-sm">Sin datos disponibles</p>
        </div>
      )}
    </div>
  );
}
