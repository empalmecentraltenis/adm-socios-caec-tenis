'use client';

import { useState, useEffect } from 'react';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableHead, 
  TableRow, 
  TableCell 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

interface Cuota {
  id: string;
  mes: string;
  estado: string;
}

interface Socio {
  id: string;
  nombre: string;
  apellido: string;
  dni: string;
  estado: string;
  categoria: string;
  cuotas?: Cuota[];
}

interface Asistencia {
  id: string;
  socioId: string;
  fecha: string;
  socio: Socio;
}

export default function AsistenciasTable() {
  const [asistencias, setAsistencias] = useState<Asistencia[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAsistencias = async () => {
    setLoading(true);
    try {
      // Por defecto trae las del día de hoy
      const res = await fetch('/api/asistencias');
      if (res.ok) {
        const data = await res.json();
        setAsistencias(data);
      }
    } catch (error) {
      console.error('Error fetching asistencias', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAsistencias();
    
    // Auto-refresh every 30 seconds to see new students checking in
    const interval = setInterval(fetchAsistencias, 30000);
    return () => clearInterval(interval);
  }, []);

  // Función para determinar si el socio tiene alertas que el profe deba saber
  const getAlertasSocio = (socio: Socio) => {
    const alertas = [];
    
    if (socio.estado === 'inactivo') {
      alertas.push('Inactivo');
    }

    const hoy = new Date();
    const cuotasPendientes = socio.cuotas?.filter(c => c.estado === 'pendiente') || [];
    const mesesAdeudados = cuotasPendientes.filter(c => {
      const fechaVencimiento = new Date(c.mes + '-10'); 
      return fechaVencimiento < hoy;
    }).length;

    if (mesesAdeudados >= 2) {
      alertas.push(`Debe ${mesesAdeudados} cuotas`);
    }

    return alertas;
  };

  if (loading && asistencias.length === 0) {
    return (
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4 space-y-3">
        <Skeleton className="h-8 w-48 bg-[#2A2A2A]" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full bg-[#2A2A2A]" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h3 className="text-white text-base font-semibold">
            Asistencias a Clases de Hoy
          </h3>
          <p className="text-[#999999] text-xs">
            Mostrando {asistencias.length} alumno{asistencias.length !== 1 ? 's' : ''} que dieron el presente
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={fetchAsistencias}
            disabled={loading}
            className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs"
          >
            <RefreshCcw className={`h-3.5 w-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          
          <Button 
            variant="default"
            size="sm"
            onClick={() => window.open('/asistencia', '_blank')}
            className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] h-8 text-xs font-semibold"
          >
            Abrir QR (Pantalla completa)
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[#333333] hover:bg-transparent">
              <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Hora</TableHead>
              <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Socio</TableHead>
              <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">DNI</TableHead>
              <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Estado / Alertas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {asistencias.length === 0 ? (
              <TableRow className="border-[#333333]">
                <TableCell colSpan={4} className="text-center py-10 text-[#666666] text-sm">
                  Aún no hay asistencias registradas hoy.
                </TableCell>
              </TableRow>
            ) : (
              asistencias.map((asistencia) => {
                const alertas = getAlertasSocio(asistencia.socio);
                const tieneAlertas = alertas.length > 0;
                
                return (
                  <TableRow 
                    key={asistencia.id} 
                    className={`border-[#333333] ${tieneAlertas ? 'bg-red-500/5 hover:bg-red-500/10' : 'hover:bg-[#252525]'}`}
                  >
                    <TableCell className="text-[#999999] text-sm py-3 font-mono">
                      {format(new Date(asistencia.fecha), 'HH:mm')} hs
                    </TableCell>
                    <TableCell className="text-[#CCCCCC] text-sm py-3">
                      <span className="font-semibold">{asistencia.socio.apellido}</span>, {asistencia.socio.nombre}
                    </TableCell>
                    <TableCell className="text-[#999999] text-xs font-mono py-3">
                      {asistencia.socio.dni}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      {tieneAlertas ? (
                        <div className="flex items-center justify-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-red-500" />
                          <div className="flex gap-1 flex-wrap justify-center">
                            {alertas.map((alerta, i) => (
                              <Badge key={i} variant="outline" className="bg-red-500/15 text-red-400 border-red-500/20 text-[10px]">
                                {alerta}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 text-green-500 text-xs font-medium">
                          <CheckCircle2 className="h-4 w-4" /> Al día
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
