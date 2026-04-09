'use client';

import { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import * as XLSX from 'xlsx';

interface Socio {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  dni: string;
  fechaAlta: string;
  estado: string;
  categoria: string;
  alDia: boolean;
  mesesAdeudados: number;
  totalPagado: number;
  deudaEstimada: number;
  valorCuota: number;
}

export default function ReportesTable() {
  const [allSocios, setAllSocios] = useState<Socio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSocios();
  }, []);

  async function fetchSocios() {
    setLoading(true);
    try {
      const res = await fetch('/api/socios');
      if (res.ok) {
        const data = await res.json();
        setAllSocios(data);
      }
    } catch (error) {
      console.error('Error al cargar socios:', error);
    } finally {
      setLoading(false);
    }
  }

  const deudores = useMemo(() => {
    return allSocios
      .filter((s) => s.mesesAdeudados >= 2)
      .sort((a, b) => b.mesesAdeudados - a.mesesAdeudados);
  }, [allSocios]);

  const deudaTotal = useMemo(() => {
    return deudores.reduce((acc, s) => acc + s.deudaEstimada, 0);
  }, [deudores]);

  const totalMesesAdeudados = useMemo(() => {
    return deudores.reduce((acc, s) => acc + s.mesesAdeudados, 0);
  }, [deudores]);

  function getCategoriaBadge(categoria: string) {
    switch (categoria) {
      case 'socio': return 'bg-[#FFCC00]/15 text-[#FFCC00] border-[#FFCC00]/20';
      case 'alumno': return 'bg-blue-400/15 text-blue-400 border-blue-400/20';
      case 'vitalicio': return 'bg-green-400/15 text-green-400 border-green-400/20';
      default: return 'bg-gray-400/15 text-gray-400 border-gray-400/20';
    }
  }

  function exportToExcel() {
    const ahora = new Date();
    const nombreMes = ahora.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    const exportData = deudores.map((s, index) => ({
      '#': index + 1,
      Apellido: s.apellido.toUpperCase(),
      Nombre: s.nombre,
      DNI: s.dni,
      Email: s.email,
      Categoría: s.categoria.charAt(0).toUpperCase() + s.categoria.slice(1),
      Estado: s.estado === 'activo' ? 'Activo' : 'Inactivo',
      'Meses Adeudados': s.mesesAdeudados,
      'Cuota ($)': s.valorCuota,
      'Deuda ($)': s.deudaEstimada,
    }));

    const totalRow = {
      '#': '',
      Apellido: '',
      Nombre: '',
      DNI: '',
      Email: 'TOTAL',
      Categoría: `${deudores.length} deudores`,
      Estado: '',
      'Meses Adeudados': totalMesesAdeudados,
      'Cuota ($)': '',
      'Deuda ($)': deudaTotal,
    };
    exportData.push(totalRow as (typeof exportData)[number]);

    const ws = XLSX.utils.json_to_sheet(exportData);
    ws['!cols'] = [
      { wch: 4 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 25 },
      { wch: 12 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 14 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Morosidad ${nombreMes}`);
    XLSX.writeFile(wb, `reporte_morosidad_${ahora.toISOString().split('T')[0]}.xlsx`);
  }

  function exportToPdf() {
    const ahora = new Date();
    const nombreMes = ahora.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

    let tableHtml = deudores.map((s, index) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;color:#666;text-align:center;">${index + 1}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;color:#333;font-weight:500;">${s.apellido.toUpperCase()}, ${s.nombre}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;color:#333;">${s.dni}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;color:#333;text-align:center;">${s.categoria.charAt(0).toUpperCase() + s.categoria.slice(1)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;color:#333;text-align:center;">${s.mesesAdeudados}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;color:#333;text-align:right;">$${s.valorCuota.toLocaleString('es-AR')}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #ddd;color:#d32f2f;text-align:right;font-weight:500;">$${s.deudaEstimada.toLocaleString('es-AR')}</td>
      </tr>
    `).join('');

    const totalHtml = `
      <tr style="background:#f5f5f5;font-weight:bold;">
        <td colspan="4" style="padding:8px;border-bottom:1px solid #ddd;color:#333;">TOTAL (${deudores.length} deudores)</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;color:#333;text-align:center;">${totalMesesAdeudados}</td>
        <td style="padding:8px;border-bottom:1px solid #ddd;color:#333;"></td>
        <td style="padding:8px;border-bottom:1px solid #ddd;color:#d32f2f;text-align:right;">$${deudaTotal.toLocaleString('es-AR')}</td>
      </tr>
    `;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Reporte de Morosidad - CAEC</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
          h1 { font-size: 18px; margin: 0 0 4px 0; }
          p { font-size: 12px; color: #666; margin: 0 0 16px 0; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { padding: 8px; text-align: left; background: #333; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
          .footer { margin-top: 20px; font-size: 10px; color: #999; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Empalme Central Tenis - CAEC</h1>
        <p>Reporte de Morosidad — ${nombreMes} | Generado: ${ahora.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <table>
          <thead>
            <tr>
              <th style="width:30px;text-align:center;">#</th>
              <th>Socio</th>
              <th style="width:90px;">DNI</th>
              <th style="width:80px;text-align:center;">Categoría</th>
              <th style="width:100px;text-align:center;">Meses</th>
              <th style="width:90px;text-align:right;">Cuota</th>
              <th style="width:100px;text-align:right;">Deuda</th>
            </tr>
          </thead>
          <tbody>
            ${tableHtml}
            ${totalHtml}
          </tbody>
        </table>
        <div class="footer">Este reporte fue generado automáticamente por el sistema de administración CAEC.</div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.onload = () => {
        printWindow.print();
      };
    }
  }

  if (loading) {
    return (
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4 space-y-3">
        <Skeleton className="h-8 w-48 bg-[#2A2A2A]" />
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-full bg-[#2A2A2A]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
          <div>
            <h3 className="text-white text-sm font-semibold">
              Reporte de Morosidad
            </h3>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-[#999999] text-[11px]">
                {deudores.length} {deudores.length === 1 ? 'deudor' : 'deudores'}
              </span>
              <span className="text-[#EF4444] text-[11px] font-medium">
                Deuda total: ${deudaTotal.toLocaleString('es-AR')}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={exportToPdf}
              disabled={deudores.length === 0}
              variant="outline"
              className="border-[#333333] text-[#CCCCCC] hover:bg-[#2A2A2A] hover:text-white font-medium h-8 text-xs"
            >
              <FileDown className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <Button
              onClick={exportToExcel}
              disabled={deudores.length === 0}
              className="bg-[#FFCC00] text-[#121212] hover:bg-[#E6B800] font-medium h-8 text-xs"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1" />
              Excel
            </Button>
          </div>
        </div>

        {/* Tabla compacta desktop */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#333333] hover:bg-transparent">
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 w-8">#</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">Socio</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1">DNI</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Cat.</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Meses</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-center">Cuota</TableHead>
                <TableHead className="text-[#999999] font-medium text-xs h-9 py-1 text-right">Deuda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deudores.length === 0 ? (
                <TableRow className="border-[#333333]">
                  <TableCell colSpan={7} className="text-center py-8 text-[#999999] text-xs">
                    No hay socios deudores 🎉
                  </TableCell>
                </TableRow>
              ) : (
                deudores.map((socio, index) => (
                  <TableRow key={socio.id} className="border-[#333333] hover:bg-[#252525]">
                    <TableCell className="text-[#666666] text-xs py-2">{index + 1}</TableCell>
                    <TableCell className="text-[#CCCCCC] text-xs py-2">
                      <span className="font-medium">{socio.apellido}</span>{', '}
                      {socio.nombre}
                    </TableCell>
                    <TableCell className="text-[#CCCCCC] font-mono text-[11px] py-2">{socio.dni}</TableCell>
                    <TableCell className="text-center py-2">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${getCategoriaBadge(socio.categoria)}`}>
                        {socio.categoria.charAt(0).toUpperCase() + socio.categoria.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-[#EF4444]/15 text-[#EF4444] text-[10px] font-medium min-w-[3rem]">
                        {socio.mesesAdeudados} {socio.mesesAdeudados === 1 ? 'mes' : 'meses'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <span className="text-[#999999] text-xs">
                        ${socio.valorCuota.toLocaleString('es-AR')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right py-2">
                      <span className="text-[#EF4444] text-xs font-medium">
                        ${socio.deudaEstimada.toLocaleString('es-AR')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
              {deudores.length > 0 && (
                <TableRow className="border-[#333333] bg-[#252525] font-semibold">
                  <TableCell className="text-[#666666] text-xs py-2" />
                  <TableCell className="text-white text-xs py-2" colSpan={3}>
                    TOTAL ({deudores.length} deudores)
                  </TableCell>
                  <TableCell className="text-center py-2">
                    <span className="text-white text-xs">{totalMesesAdeudados} meses</span>
                  </TableCell>
                  <TableCell className="py-2" />
                  <TableCell className="text-right py-2">
                    <span className="text-[#EF4444] text-xs font-bold">${deudaTotal.toLocaleString('es-AR')}</span>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Cards compactas mobile */}
        <div className="md:hidden space-y-2">
          {deudores.length === 0 ? (
            <div className="text-center py-8 text-[#999999] text-xs">
              No hay socios deudores 🎉
            </div>
          ) : (
            <>
              {deudores.map((socio, index) => (
                <div
                  key={socio.id}
                  className="bg-[#252525] border border-[#333333] rounded-lg p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">
                        {index + 1}. {socio.apellido}, {socio.nombre}
                      </p>
                      <p className="text-[#999999] text-[11px]">DNI: {socio.dni}</p>
                    </div>
                    <div className="text-right ml-2">
                      <Badge variant="outline" className={`text-[9px] px-1.5 py-0 mb-1 ${getCategoriaBadge(socio.categoria)}`}>
                        {socio.categoria.charAt(0).toUpperCase() + socio.categoria.slice(1)}
                      </Badge>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#EF4444]/15 text-[#EF4444] text-[10px] font-medium">
                          {socio.mesesAdeudados}m
                        </span>
                        <span className="text-[#EF4444] text-xs font-medium">
                          ${socio.deudaEstimada.toLocaleString('es-AR')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <div className="bg-[#1E1E1E] border border-[#EF4444]/30 rounded-lg p-3 flex items-center justify-between">
                <span className="text-white text-xs font-semibold">TOTAL ({deudores.length} deudores)</span>
                <span className="text-[#EF4444] text-sm font-bold">${deudaTotal.toLocaleString('es-AR')}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Reporte financiero mensual */}
      <div className="bg-[#1E1E1E] border border-[#333333] rounded-lg p-4">
        <h3 className="text-white text-sm font-semibold mb-3">Resumen Financiero por Categoría</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {(() => {
            const categorias = ['socio', 'alumno', 'vitalicio'] as const;
            const colors = { socio: '#FFCC00', alumno: '#3B82F6', vitalicio: '#00AA55' };
            const labels = { socio: 'Socio', alumno: 'Alumno', vitalicio: 'Vitalicio' };
            return categorias.map(cat => {
              const deudoresCat = allSocios.filter(s => s.categoria === cat && s.mesesAdeudados >= 2);
              const deudaCat = deudoresCat.reduce((acc, s) => acc + s.deudaEstimada, 0);
              const totalCat = allSocios.filter(s => s.categoria === cat).length;
              return (
                <div key={cat} className="bg-[#252525] border border-[#333333] rounded-xl p-5 shadow-inner">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-4 h-4 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]" style={{ backgroundColor: colors[cat] }} />
                    <span className="text-white text-base font-bold tracking-tight">{labels[cat]}</span>
                    <span className="text-[#999999] text-xs ml-auto font-medium">{totalCat} miembros</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end border-b border-[#333333] pb-2">
                      <span className="text-[#999999] text-xs uppercase tracking-wider">Deudores</span>
                      <span className="text-[#EF4444] text-lg font-bold leading-none">{deudoresCat.length}</span>
                    </div>
                    <div className="flex justify-between items-end pt-1">
                      <span className="text-[#999999] text-xs uppercase tracking-wider">Deuda Acumulada</span>
                      <span className="text-[#EF4444] text-xl font-black leading-none">${deudaCat.toLocaleString('es-AR')}</span>
                    </div>
                  </div>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}
