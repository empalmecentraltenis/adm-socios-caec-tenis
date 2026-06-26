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
import { RefreshCcw, AlertTriangle, CheckCircle2, Printer, QrCode, ExternalLink } from 'lucide-react';
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
    const interval = setInterval(fetchAsistencias, 30000);
    return () => clearInterval(interval);
  }, []);

  const getAlertasSocio = (socio: Socio) => {
    const alertas: string[] = [];
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

  // URL pública — detecta automáticamente el dominio real
  const asistenciaUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/asistencia`
    : '/asistencia';

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(asistenciaUrl)}&margin=10`;

  function handlePrintQr() {
    const win = window.open('', '_blank');
    if (!win) return;
    const printUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(asistenciaUrl)}&margin=10`;
    win.document.write(
      '<!DOCTYPE html><html><head><title>QR Asistencia - CAEC Tenis</title>' +
      '<style>body{font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff;}' +
      'h1{font-size:28px;margin-bottom:8px;color:#111;}p{color:#555;margin-bottom:24px;font-size:16px;}' +
      'img{border:3px solid #FFCC00;border-radius:12px;padding:8px;}.url{margin-top:16px;font-size:13px;color:#888;word-break:break-all;}</style>' +
      '</head><body>' +
      '<h1>🎾 CAEC - Clases de Tenis</h1>' +
      '<p>Escaneá este código para registrar tu asistencia</p>' +
      '<img src="' + printUrl + '" />' +
      '<p class="url">' + asistenciaUrl + '</p>' +
      '</body></html>'
    );
    win.document.close();
    win.onload = () => win.print();
  }

  if (loading && asistencias.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4 space-y-3">
          <Skeleton className="h-8 w-48 bg-[#2A2A2A]" />
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full bg-[#2A2A2A]" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Panel QR */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4 flex flex-col sm:flex-row items-center gap-6">
        <div className="flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrImageUrl}
            alt="QR de asistencia"
            width={140}
            height={140}
            className="rounded-lg border-2 border-[#FFCC00]/50"
          />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
            <QrCode className="h-4 w-4 text-[#FFCC00]" />
            <h3 className="text-white text-sm font-semibold">Código QR para Alumnos</h3>
          </div>
          <p className="text-[#999999] text-xs mb-1">
            El alumno escanea el QR con la cámara del celular, escribe su DNI y toca{' '}
            <strong className="text-white">&quot;Dar Presente&quot;</strong>.
          </p>
          <p className="text-[#666666] text-[11px] font-mono break-all mb-3">{asistenciaUrl}</p>
          <div className="flex gap-2 flex-wrap justify-center sm:justify-start">
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrintQr}
              className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white h-8 text-xs"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Imprimir QR
            </Button>
            <Button
              size="sm"
              onClick={() => window.open('/asistencia', '_blank')}
              className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] h-8 text-xs font-semibold"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Abrir página del alumno
            </Button>
          </div>
        </div>
      </div>

      {/* Tabla de asistencias del día */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="text-white text-base font-semibold">Asistencias de Hoy</h3>
            <p className="text-[#999999] text-xs">
              {asistencias.length} alumno{asistencias.length !== 1 ? 's' : ''} registrado{asistencias.length !== 1 ? 's' : ''}
            </p>
          </div>
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
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#333333] hover:bg-transparent">
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Hora</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Socio</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">DNI</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Estado</TableHead>
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
                        {format(new Date(asistencia.fecha), 'dd/MM/yyyy HH:mm')} hs
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
    </div>
  );
}
