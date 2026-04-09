'use client';

import { Users, CheckCircle, AlertTriangle, DollarSign, TrendingDown } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface KpiData {
  totalActivos: number;
  totalInactivos: number;
  totalGeneral: number;
  sociosAlDia: number;
  sociosDeudores: number;
  ingresosMes: number;
  deudaTotalEstimada: number;
}

interface KpiCardsProps {
  data: KpiData | null;
  loading: boolean;
}

function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('es-AR');
}

const kpiConfig = [
  {
    key: 'totalActivos' as const,
    label: 'Activos',
    icon: Users,
    accentColor: 'text-[#FFCC00]',
    bgColor: 'bg-[#FFCC00]/10',
    borderColor: 'border-[#FFCC00]/20',
  },
  {
    key: 'totalInactivos' as const,
    label: 'Inactivos',
    icon: Users,
    accentColor: 'text-[#999999]',
    bgColor: 'bg-[#999999]/10',
    borderColor: 'border-[#999999]/20',
  },
  {
    key: 'totalGeneral' as const,
    label: 'Total General',
    icon: Users,
    accentColor: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
  },
  {
    key: 'sociosAlDia' as const,
    label: 'Al Día',
    icon: CheckCircle,
    accentColor: 'text-[#00AA55]',
    bgColor: 'bg-[#00AA55]/10',
    borderColor: 'border-[#00AA55]/20',
  },
  {
    key: 'sociosDeudores' as const,
    label: 'Deudores',
    icon: AlertTriangle,
    accentColor: 'text-[#EF4444]',
    bgColor: 'bg-[#EF4444]/10',
    borderColor: 'border-[#EF4444]/20',
  },
  {
    key: 'ingresosMes' as const,
    label: 'Ingresos Mes',
    icon: DollarSign,
    accentColor: 'text-[#FFCC00]',
    bgColor: 'bg-[#FFCC00]/10',
    borderColor: 'border-[#FFCC00]/20',
    format: true,
  },
  {
    key: 'deudaTotalEstimada' as const,
    label: 'Deuda Total',
    icon: TrendingDown,
    accentColor: 'text-[#EF4444]',
    bgColor: 'bg-[#EF4444]/10',
    borderColor: 'border-[#EF4444]/20',
    format: true,
  },
];

export default function KpiCards({ data, loading }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {kpiConfig.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.key}
            className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4 flex items-center gap-3"
          >
            <div className={`p-2.5 rounded-lg ${kpi.bgColor}`}>
              <Icon className={`h-5 w-5 ${kpi.accentColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#999999] text-[10px] font-medium uppercase tracking-wide truncate">
                {kpi.label}
              </p>
              {loading ? (
                <Skeleton className="h-7 w-20 mt-1 bg-[#2A2A2A]" />
              ) : (
                <p className="text-white text-xl font-bold mt-0.5">
                  {data
                    ? kpi.format
                      ? formatCurrency(data[kpi.key])
                      : data[kpi.key].toLocaleString('es-AR')
                    : '0'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
