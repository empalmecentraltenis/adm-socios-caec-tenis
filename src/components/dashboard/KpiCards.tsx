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
    accentColor: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
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
    accentColor: 'text-chart-2',
    bgColor: 'bg-chart-2/10',
    borderColor: 'border-chart-2/20',
  },
  {
    key: 'sociosDeudores' as const,
    label: 'Deudores',
    icon: AlertTriangle,
    accentColor: 'text-destructive',
    bgColor: 'bg-destructive/10',
    borderColor: 'border-destructive/20',
  },
  {
    key: 'ingresosMes' as const,
    label: 'Ingresos Mes',
    icon: DollarSign,
    accentColor: 'text-primary',
    bgColor: 'bg-primary/10',
    borderColor: 'border-primary/20',
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
            className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 transition-all duration-300 hover:border-primary/40 hover:shadow-[0_0_15px_rgba(250,204,21,0.1)] group relative overflow-hidden"
          >
            {/* Subtle background glow effect on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            
            <div className={`relative p-2.5 rounded-lg ${kpi.bgColor} transition-transform duration-300 group-hover:scale-110`}>
              <Icon className={`h-5 w-5 ${kpi.accentColor}`} />
            </div>
            <div className="flex-1 min-w-0 relative">
              <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider truncate">
                {kpi.label}
              </p>
              {loading ? (
                <Skeleton className="h-7 w-20 mt-1 bg-muted" />
              ) : (
                <p className="text-foreground text-xl font-bold mt-0.5 tracking-tight">
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
