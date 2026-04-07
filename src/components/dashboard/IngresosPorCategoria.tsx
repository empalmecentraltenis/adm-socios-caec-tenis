'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CalendarDays } from 'lucide-react';

interface IngresosPorCategoriaProps {
  data: { categoria: string; total: number }[] | null;
  loading: boolean;
}

const COLORS = ['#FFCC00', '#3B82F6', '#00AA55'];

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('es-AR');
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { categoria: string } }> }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#2A2A2A] border border-[#444444] rounded-lg px-3 py-2 shadow-lg">
        <p className="text-[#999999] text-xs">{payload[0].payload.categoria}</p>
        <p className="text-[#FFCC00] text-sm font-bold">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  }
  return null;
}

function generateMonthOptions() {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const value = `${year}-${String(month + 1).padStart(2, '0')}`;
    const MESES = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];
    const label = `${MESES[month]} ${year}`;
    options.push({ value, label });
  }
  return options;
}

const monthOptions = generateMonthOptions();

export default function IngresosPorCategoria({ data: initialData, loading: initialLoading }: IngresosPorCategoriaProps) {
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || '');
  const [data, setData] = useState<{ categoria: string; total: number }[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  useEffect(() => {
    if (!selectedMonth) return;
    setLoading(true);
    fetch(`/api/dashboard?mes=${selectedMonth}`)
      .then(res => res.ok ? res.json() : null)
      .then(json => {
        if (json) {
          setData(json.ingresosPorCategoria);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  const total = data ? data.reduce((acc, d) => acc + d.total, 0) : 0;

  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white text-lg font-semibold">Ingresos por Categoría</h3>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-[#FFCC00] text-xs font-medium">{formatCurrency(total)}</span>
          )}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[150px] bg-[#2A2A2A] border-[#333333] text-[#CCCCCC] h-8 text-xs">
              <CalendarDays className="h-3 w-3 mr-1 text-[#999999]" />
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent className="bg-[#1E1E1E] border-[#333333]">
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-[#CCCCCC] focus:bg-[#2A2A2A] focus:text-white text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {loading || initialLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-32 bg-[#2A2A2A]" />
          <Skeleton className="h-[200px] w-full bg-[#2A2A2A]" />
        </div>
      ) : data && data.length > 0 ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis
              dataKey="categoria"
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
            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={60}>
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[200px]">
          <p className="text-[#999999] text-sm">Sin datos para este mes</p>
        </div>
      )}
    </div>
  );
}
