'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface CrecimientoChartProps {
  data: { mes: string; activos: number; inactivos: number }[] | null;
  loading: boolean;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#2A2A2A] border border-[#444444] rounded-lg px-3 py-2 shadow-lg">
        <p className="text-[#999999] text-xs mb-1">{label}</p>
        <div className="space-y-1">
          {payload.map((item: any, index: number) => (
            <p key={index} className="text-sm font-bold flex items-center gap-2" style={{ color: item.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.value} {item.name}
            </p>
          ))}
        </div>
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
              <linearGradient id="activosGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFCC00" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#FFCC00" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="inactivosGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EF4444" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
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
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'white', strokeOpacity: 0.1 }} />
            <Legend verticalAlign="top" height={36} iconType="circle" />
            <Area
              type="monotone"
              dataKey="activos"
              name="Activos"
              stroke="#FFCC00"
              strokeWidth={2}
              fill="url(#activosGradient)"
            />
            <Area
              type="monotone"
              dataKey="inactivos"
              name="Inactivos"
              stroke="#EF4444"
              strokeWidth={2}
              fill="url(#inactivosGradient)"
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
