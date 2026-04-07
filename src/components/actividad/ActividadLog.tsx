'use client';

import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  DollarSign, UserPlus, UserCog, UserMinus, Settings,
  Users, ChevronDown, Clock,
} from 'lucide-react';

interface ActividadItem {
  id: string;
  accion: string;
  detalle: string;
  socioId: string | null;
  createdAt: string;
}

function getAccionIcon(accion: string) {
  switch (accion) {
    case 'pago_registrado': return DollarSign;
    case 'socio_creado': return UserPlus;
    case 'socio_editado': return UserCog;
    case 'socio_dado_baja': return UserMinus;
    case 'config_actualizada': return Settings;
    case 'pago_masivo': return Users;
    default: return Clock;
  }
}

function getAccionColor(accion: string): string {
  switch (accion) {
    case 'pago_registrado': return 'text-green-400 bg-green-400/10';
    case 'socio_creado': return 'text-blue-400 bg-blue-400/10';
    case 'socio_editado': return 'text-yellow-400 bg-yellow-400/10';
    case 'socio_dado_baja': return 'text-red-400 bg-red-400/10';
    case 'config_actualizada': return 'text-purple-400 bg-purple-400/10';
    case 'pago_masivo': return 'text-cyan-400 bg-cyan-400/10';
    default: return 'text-gray-400 bg-gray-400/10';
  }
}

function formatDate(fecha: string): string {
  const d = new Date(fecha);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Ahora';
  if (mins < 60) return `Hace ${mins}m`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function ActividadLog() {
  const [actividades, setActividades] = useState<ActividadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    fetchActividad(0);
  }, []);

  async function fetchActividad(offset: number) {
    if (offset === 0) setLoading(true);
    try {
      const res = await fetch(`/api/actividad?limit=30&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        if (offset === 0) {
          setActividades(data.actividades);
        } else {
          setActividades(prev => [...prev, ...data.actividades]);
        }
        setHasMore(data.total > offset + data.limit);
      }
    } catch (error) {
      console.error('Error al cargar actividad:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#FFCC00]" />
          <h3 className="text-white text-sm font-semibold">Actividad Reciente</h3>
        </div>
        <span className="text-[#666666] text-[10px]">{actividades.length} registros</span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full bg-[#2A2A2A]" />
          ))}
        </div>
      ) : actividades.length === 0 ? (
        <div className="text-center py-6">
          <Clock className="h-8 w-8 text-[#333333] mx-auto mb-2" />
          <p className="text-[#999999] text-sm">Sin actividad registrada</p>
        </div>
      ) : (
        <>
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
            {actividades.map((act) => {
              const Icon = getAccionIcon(act.accion);
              const [iconColor, iconBg] = getAccionColor(act.accion).split(' ');
              return (
                <div
                  key={act.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-[#252525] transition-colors"
                >
                  <div className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#CCCCCC] text-xs leading-relaxed">{act.detalle}</p>
                    <p className="text-[#666666] text-[10px] mt-0.5">{formatDate(act.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {hasMore && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchActividad(actividades.length)}
              className="w-full mt-2 text-[#999999] hover:text-white hover:bg-[#252525] text-xs"
            >
              <ChevronDown className="h-3.5 w-3.5 mr-1" />
              Cargar más
            </Button>
          )}
        </>
      )}
    </div>
  );
}
