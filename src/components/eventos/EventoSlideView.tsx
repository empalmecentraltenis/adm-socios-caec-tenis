'use client';

import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Printer,
  Layers,
  Sparkles,
  Trophy,
  Coffee,
} from 'lucide-react';
import { formatCurrency } from '@/lib/formatters';

interface ItemFinanciero {
  concepto: string;
  monto: number;
}

export interface EventoInformeData {
  id?: string;
  titulo: string;
  subtitulo?: string | null;
  fechaTexto: string;
  fechaEvento?: string | Date;
  organizador?: string | null;
  estado?: string;
  ingresosTorneo: ItemFinanciero[];
  egresosTorneo: ItemFinanciero[];
  ingresosCantina: ItemFinanciero[];
  egresosCantina: ItemFinanciero[];
  ingresosOtros: ItemFinanciero[];
  egresosOtros: ItemFinanciero[];
  totalIngresos?: number;
  totalEgresos?: number;
  totalNeto?: number;
  notas?: string | null;
}

interface EventoSlideViewProps {
  evento: EventoInformeData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EventoSlideView({
  evento,
  open,
  onOpenChange,
}: EventoSlideViewProps) {
  const [slideActiva, setSlideActiva] = useState<'torneo' | 'cantina' | 'otros'>('torneo');
  const slideRef = useRef<HTMLDivElement>(null);

  if (!evento) return null;

  // Cálculos de subtotales por sección
  const sum = (arr: ItemFinanciero[]) =>
    (Array.isArray(arr) ? arr : []).reduce((acc, it) => acc + (Number(it.monto) || 0), 0);

  const ingTorneo = sum(evento.ingresosTorneo);
  const egrTorneo = sum(evento.egresosTorneo);
  const netoTorneo = ingTorneo - egrTorneo;

  const ingCantina = sum(evento.ingresosCantina);
  const egrCantina = sum(evento.egresosCantina);
  const netoCantina = ingCantina - egrCantina;

  const ingOtros = sum(evento.ingresosOtros);
  const egrOtros = sum(evento.egresosOtros);
  const netoOtros = ingOtros - egrOtros;

  const tieneCantina =
    (evento.ingresosCantina && evento.ingresosCantina.length > 0) ||
    (evento.egresosCantina && evento.egresosCantina.length > 0);

  const tieneOtros =
    (evento.ingresosOtros && evento.ingresosOtros.length > 0) ||
    (evento.egresosOtros && evento.egresosOtros.length > 0);

  // Imprimir diapositiva
  const handlePrint = () => {
    const printContent = slideRef.current;
    if (!printContent) {
      window.print();
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=750');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${evento.titulo} - CAEC Tenis</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: landscape;
              margin: 8mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: Georgia, serif;
              background-color: #ffffff;
              color: #111111;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              padding: 10px;
            }
            .slide-box {
              width: 100%;
              max-width: 100%;
              border: 2px solid #ccc;
              padding: 24px;
              box-sizing: border-box;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              min-height: 94vh;
            }
            .header-bar {
              background-color: #000000 !important;
              color: #ffffff !important;
              padding: 16px 20px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin: -24px -24px 24px -24px;
              border-bottom: 4px solid #FFCC00;
            }
            .header-left {
              display: flex;
              align-items: center;
              gap: 16px;
            }
            .logo-img {
              height: 60px;
              width: auto;
            }
            .header-title {
              font-size: 24px;
              font-weight: 900;
              text-transform: uppercase;
              letter-spacing: 1px;
              color: #ffffff;
            }
            .header-subtitle {
              font-size: 13px;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 2px;
              color: #FFCC00;
              margin-top: 4px;
            }
            .header-right {
              text-align: right;
            }
            .header-date {
              font-size: 15px;
              font-style: italic;
              color: #e4e4e7;
            }
            .header-org {
              font-size: 11px;
              text-transform: uppercase;
              font-weight: bold;
              color: #FFCC00;
              font-family: Arial, sans-serif;
              margin-top: 4px;
            }
            .grid-tables {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 24px;
              margin-bottom: 24px;
            }
            .table-block {
              border: 1px solid #d4d4d8;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              background-color: #ffffff;
            }
            .table-head-dark {
              background-color: #1f1f23 !important;
              color: #ffffff !important;
              padding: 10px 14px;
              display: flex;
              justify-content: space-between;
              font-family: Arial, sans-serif;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 1px;
              border-bottom: 2px solid #a1a1aa;
            }
            .table-head-yellow {
              background-color: #FFCC00 !important;
              color: #000000 !important;
              padding: 10px 14px;
              display: flex;
              justify-content: space-between;
              font-family: Arial, sans-serif;
              font-size: 12px;
              font-weight: 900;
              letter-spacing: 1px;
              border-bottom: 2px solid #a1a1aa;
            }
            .head-highlight {
              color: #fde047;
            }
            .row-item {
              padding: 10px 14px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 1px solid #e4e4e7;
              font-family: Arial, sans-serif;
              font-size: 13px;
            }
            .row-item:last-child {
              border-bottom: none;
            }
            .row-concept {
              color: #27272a;
            }
            .row-amount {
              font-family: 'Courier New', Courier, monospace;
              font-weight: bold;
              color: #09090b;
              font-size: 14px;
            }
            .subtotal-yellow {
              background-color: #FFCC00 !important;
              color: #000000 !important;
              padding: 12px 14px;
              display: flex;
              justify-content: space-between;
              font-family: Arial, sans-serif;
              font-weight: 900;
              font-size: 13px;
              border-top: 2px solid #a1a1aa;
            }
            .subtotal-dark {
              background-color: #1f1f23 !important;
              color: #ffffff !important;
              padding: 12px 14px;
              display: flex;
              justify-content: space-between;
              font-family: Arial, sans-serif;
              font-weight: 900;
              font-size: 13px;
              border-top: 2px solid #a1a1aa;
            }
            .total-banner {
              display: inline-flex;
              border: 2px solid #000000;
              margin-top: 10px;
            }
            .total-banner-dark {
              background-color: #1a1a1e !important;
              color: #ffffff !important;
              padding: 12px 20px;
              display: flex;
              flex-direction: column;
              justify-content: center;
              font-family: Arial, sans-serif;
              font-weight: 900;
              font-size: 12px;
              letter-spacing: 1px;
            }
            .total-banner-sub {
              font-size: 10px;
              color: #fde047;
            }
            .total-banner-amount {
              background-color: #FFCC00 !important;
              color: #000000 !important;
              padding: 12px 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-family: 'Courier New', Courier, monospace;
              font-weight: 900;
              font-size: 26px;
              min-width: 170px;
            }
            .footer-bar {
              margin-top: 20px;
              padding-top: 12px;
              border-top: 1px solid #d4d4d8;
              display: flex;
              justify-content: space-between;
              font-style: italic;
              font-size: 11px;
              color: #52525b;
            }
          </style>
        </head>
        <body>
          <div class="slide-box">
            <div>
              <div class="header-bar">
                <div class="header-left">
                  <img src="${window.location.origin}/logo-caec.png" alt="CAEC" class="logo-img" />
                  <div>
                    <div class="header-title">${evento.titulo} ${slideActiva === 'cantina' ? '· CANTINA' : slideActiva === 'otros' ? '· OTROS / AUSPICIOS' : ''}</div>
                    ${evento.subtitulo ? `<div class="header-subtitle">${evento.subtitulo}</div>` : ''}
                  </div>
                </div>
                <div class="header-right">
                  <div class="header-date">${evento.fechaTexto}</div>
                  <div class="header-org">${evento.organizador || 'SubComisión de Tenis'}</div>
                </div>
              </div>

              <div class="grid-tables">
                <!-- INGRESOS -->
                <div class="table-block">
                  <div>
                    <div class="table-head-dark">
                      <span class="head-highlight">INGRESOS ${slideActiva === 'cantina' ? '- CANTINA' : slideActiva === 'otros' ? '- AUSPICIANTES / OTROS' : ''}</span>
                      <span>Recaudación ($)</span>
                    </div>
                    <div>
                      ${(() => {
                        const items = slideActiva === 'cantina' ? evento.ingresosCantina : slideActiva === 'otros' ? evento.ingresosOtros : evento.ingresosTorneo;
                        if (!items || items.length === 0) return '<div class="row-item" style="color: #888; font-style: italic;">Sin ingresos registrados</div>';
                        return items.map(it => `
                          <div class="row-item">
                            <span class="row-concept">${it.concepto}</span>
                            <span class="row-amount">$ ${Number(it.monto).toLocaleString('es-AR')}</span>
                          </div>
                        `).join('');
                      })()}
                    </div>
                  </div>
                  <div class="subtotal-yellow">
                    <span>SUB-TOTAL INGRESOS</span>
                    <span>$ ${Number(slideActiva === 'cantina' ? ingCantina : slideActiva === 'otros' ? ingOtros : ingTorneo).toLocaleString('es-AR')}</span>
                  </div>
                </div>

                <!-- EGRESOS -->
                <div class="table-block">
                  <div>
                    <div class="table-head-yellow">
                      <span>EGRESOS ${slideActiva === 'cantina' ? '- CANTINA' : slideActiva === 'otros' ? '- OTROS GASTOS' : ''}</span>
                      <span>Egresos ($)</span>
                    </div>
                    <div>
                      ${(() => {
                        const items = slideActiva === 'cantina' ? evento.egresosCantina : slideActiva === 'otros' ? evento.egresosOtros : evento.egresosTorneo;
                        if (!items || items.length === 0) return '<div class="row-item" style="color: #888; font-style: italic;">Sin egresos registrados</div>';
                        return items.map(it => `
                          <div class="row-item">
                            <span class="row-concept">${it.concepto}</span>
                            <span class="row-amount">$ ${Number(it.monto).toLocaleString('es-AR')}</span>
                          </div>
                        `).join('');
                      })()}
                    </div>
                  </div>
                  <div class="subtotal-dark">
                    <span>SUB-TOTAL EGRESOS</span>
                    <span>$ ${Number(slideActiva === 'cantina' ? egrCantina : slideActiva === 'otros' ? egrOtros : egrTorneo).toLocaleString('es-AR')}</span>
                  </div>
                </div>
              </div>

              <!-- TOTAL GENERAL DE LA DIAPOSITIVA -->
              <div>
                <div class="total-banner">
                  <div class="total-banner-dark">
                    <span>TOTAL GENERAL</span>
                    <span class="total-banner-sub">DE RECAUDACIÓN P/ SUBCOMISIÓN ${slideActiva === 'cantina' ? '(CANTINA)' : ''}</span>
                  </div>
                  <div class="total-banner-amount">
                    $ ${Number(slideActiva === 'cantina' ? netoCantina : slideActiva === 'otros' ? netoOtros : netoTorneo).toLocaleString('es-AR')}
                  </div>
                </div>
              </div>
            </div>

            <div class="footer-bar">
              <span>Club Atlético Empalme Central — SubComisión de Tenis</span>
              <span style="font-family: Arial, sans-serif; font-weight: bold; font-size: 10px; text-transform: uppercase;">CAEC · Portal Oficial</span>
            </div>
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.focus();
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-[94vw] !w-[94vw] lg:!max-w-[1240px] xl:!max-w-[1340px] max-h-[92vh] flex flex-col bg-[#0c0c0e] border-[#222227] p-0 overflow-hidden text-white shadow-2xl !top-[50%] !translate-y-[-50%]">
        {/* HEADER MODAL */}
        <DialogHeader className="p-4 sm:p-5 bg-[#141418] border-b border-[#24242c] flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-white">
                Informe Oficial para Comisión Directiva
              </DialogTitle>
              <p className="text-xs text-[#888892]">
                Visualización estilo presentación institucional (Formato PowerPoint CAEC)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 pr-10">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="bg-[#1c1c22] border-[#32323c] hover:bg-[#282832] text-xs h-9 px-3 gap-1.5 text-zinc-200"
            >
              <Printer className="h-4 w-4 text-amber-400" />
              <span>Imprimir / PDF</span>
            </Button>
          </div>
        </DialogHeader>

        {/* SELECTOR DE DIAPOSITIVA */}
        <div className="px-5 py-3 bg-[#121216] border-b border-[#202028] flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#777] mr-1 flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" /> Diapositiva:
            </span>

            <Button
              size="sm"
              variant={slideActiva === 'torneo' ? 'default' : 'outline'}
              onClick={() => setSlideActiva('torneo')}
              className={`h-8 text-xs rounded-lg px-3 gap-1.5 ${
                slideActiva === 'torneo'
                  ? 'bg-amber-500 text-black font-black hover:bg-amber-400'
                  : 'bg-[#18181f] border-[#2c2c38] text-[#aaa] hover:text-white'
              }`}
            >
              <Trophy className="h-3.5 w-3.5" />
              1. Torneo / Jugadores
            </Button>

            {tieneCantina && (
              <Button
                size="sm"
                variant={slideActiva === 'cantina' ? 'default' : 'outline'}
                onClick={() => setSlideActiva('cantina')}
                className={`h-8 text-xs rounded-lg px-3 gap-1.5 ${
                  slideActiva === 'cantina'
                    ? 'bg-amber-500 text-black font-black hover:bg-amber-400'
                    : 'bg-[#18181f] border-[#2c2c38] text-[#aaa] hover:text-white'
                }`}
              >
                <Coffee className="h-3.5 w-3.5" />
                2. Cantina - Kiosco
              </Button>
            )}

            {tieneOtros && (
              <Button
                size="sm"
                variant={slideActiva === 'otros' ? 'default' : 'outline'}
                onClick={() => setSlideActiva('otros')}
                className={`h-8 text-xs rounded-lg px-3 gap-1.5 ${
                  slideActiva === 'otros'
                    ? 'bg-amber-500 text-black font-black hover:bg-amber-400'
                    : 'bg-[#18181f] border-[#2c2c38] text-[#aaa] hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                3. Otros / Sponsors
              </Button>
            )}
          </div>
        </div>

        {/* CONTENEDOR DE LA DIAPOSITIVA */}
        <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto max-h-[82vh] bg-[#111115]">
          <div
            ref={slideRef}
            className="w-full bg-white text-zinc-900 border-2 border-zinc-300 rounded shadow-2xl p-6 sm:p-8 flex flex-col justify-between min-h-[520px]"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {/* 1. ENCABEZADO INSTITUCIONAL DE LA DIAPOSITIVA */}
            <div className="bg-black text-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 -mx-6 sm:-mx-8 -mt-6 sm:-mt-8 mb-6 border-b-4 border-[#FFCC00]">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <img
                  src="/logo-caec.png"
                  alt="CAEC Tenis"
                  className="h-16 w-auto object-contain bg-black rounded shrink-0"
                />
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wider text-white font-serif">
                    {evento.titulo}
                    {slideActiva === 'cantina' && ' · CANTINA'}
                    {slideActiva === 'otros' && ' · OTROS / AUSPICIOS'}
                  </h1>
                  {evento.subtitulo && (
                    <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[#FFCC00] mt-0.5">
                      {evento.subtitulo}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-left md:text-right shrink-0">
                <span className="text-sm sm:text-base italic font-serif text-zinc-300 block">
                  {evento.fechaTexto}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-[#FFCC00] font-sans font-bold block mt-0.5">
                  {evento.organizador || 'SubComisión de Tenis'}
                </span>
              </div>
            </div>

            {/* 2. CUERPO DE TABLAS SEGÚN LA DIAPOSITIVA ACTIVA */}

            {/* VISTA 1: TORNEO / JUGADORES */}
            {slideActiva === 'torneo' && (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* TABLA INGRESOS TORNEO */}
                  <div className="border border-zinc-300 shadow-sm flex flex-col justify-between bg-white">
                    <div>
                      <div className="bg-[#1f1f23] text-white px-4 py-2.5 flex justify-between items-center border-b-2 border-zinc-400">
                        <span className="font-sans font-black text-xs uppercase tracking-wider text-amber-300">
                          INGRESOS
                        </span>
                        <span className="font-sans font-black text-xs uppercase tracking-wider text-zinc-300">
                          Recaudación ($)
                        </span>
                      </div>
                      <div className="divide-y divide-zinc-200 text-sm">
                        {evento.ingresosTorneo && evento.ingresosTorneo.length > 0 ? (
                          evento.ingresosTorneo.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center px-4 py-3 bg-white">
                              <span className="text-zinc-800 font-sans">{item.concepto}</span>
                              <span className="font-mono font-bold text-zinc-900">{formatCurrency(item.monto)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs italic text-zinc-400 bg-zinc-50">Sin ingresos cargados</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#FFCC00] text-black px-4 py-3 flex justify-between items-center font-sans font-black text-sm border-t-2 border-zinc-400">
                      <span>SUB-TOTAL INGRESOS</span>
                      <span className="font-mono text-base">{formatCurrency(ingTorneo)}</span>
                    </div>
                  </div>

                  {/* TABLA EGRESOS TORNEO */}
                  <div className="border border-zinc-300 shadow-sm flex flex-col justify-between bg-white">
                    <div>
                      <div className="bg-[#FFCC00] text-black px-4 py-2.5 flex justify-between items-center border-b-2 border-zinc-400">
                        <span className="font-sans font-black text-xs uppercase tracking-wider">
                          EGRESOS
                        </span>
                        <span className="font-sans font-black text-xs uppercase tracking-wider">
                          Egresos ($)
                        </span>
                      </div>
                      <div className="divide-y divide-zinc-200 text-sm">
                        {evento.egresosTorneo && evento.egresosTorneo.length > 0 ? (
                          evento.egresosTorneo.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center px-4 py-3 bg-white">
                              <span className="text-zinc-800 font-sans">{item.concepto}</span>
                              <span className="font-mono font-bold text-zinc-900">{formatCurrency(item.monto)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs italic text-zinc-400 bg-zinc-50">Sin egresos cargados</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#1f1f23] text-white px-4 py-3 flex justify-between items-center font-sans font-black text-sm border-t-2 border-zinc-400">
                      <span>SUB-TOTAL EGRESOS</span>
                      <span className="font-mono text-base">{formatCurrency(egrTorneo)}</span>
                    </div>
                  </div>
                </div>

                {/* CAJA TOTAL GENERAL DE ESTA DIAPOSITIVA */}
                <div className="pt-4 flex items-center justify-start">
                  <div className="flex border-2 border-black shadow-md overflow-hidden max-w-xl w-full sm:w-auto">
                    <div className="bg-[#1a1a1e] text-white px-5 py-3.5 flex flex-col justify-center">
                      <span className="font-sans font-black text-xs uppercase tracking-wider">
                        TOTAL GENERAL
                      </span>
                      <span className="font-sans font-black text-[11px] uppercase tracking-wider text-amber-300">
                        DE RECAUDACIÓN P/ SUBCOMISIÓN
                      </span>
                    </div>
                    <div className="bg-[#FFCC00] text-black px-6 py-3.5 flex items-center justify-center font-mono font-black text-2xl sm:text-3xl min-w-[180px]">
                      {formatCurrency(netoTorneo)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 2: CANTINA / KIOSCO */}
            {slideActiva === 'cantina' && (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* TABLA INGRESOS CANTINA */}
                  <div className="border border-zinc-300 shadow-sm flex flex-col justify-between bg-white">
                    <div>
                      <div className="bg-[#1f1f23] text-white px-4 py-2.5 flex justify-between items-center border-b-2 border-zinc-400">
                        <span className="font-sans font-black text-xs uppercase tracking-wider text-amber-300">
                          INGRESOS - CANTINA
                        </span>
                        <span className="font-sans font-black text-xs uppercase tracking-wider text-zinc-300">
                          Recaudación ($)
                        </span>
                      </div>
                      <div className="divide-y divide-zinc-200 text-sm">
                        {evento.ingresosCantina && evento.ingresosCantina.length > 0 ? (
                          evento.ingresosCantina.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center px-4 py-3 bg-white">
                              <span className="text-zinc-800 font-sans">{item.concepto}</span>
                              <span className="font-mono font-bold text-zinc-900">{formatCurrency(item.monto)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs italic text-zinc-400 bg-zinc-50">Sin ingresos de cantina</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#FFCC00] text-black px-4 py-3 flex justify-between items-center font-sans font-black text-sm border-t-2 border-zinc-400">
                      <span>SUB-TOTAL INGRESOS</span>
                      <span className="font-mono text-base">{formatCurrency(ingCantina)}</span>
                    </div>
                  </div>

                  {/* TABLA EGRESOS CANTINA */}
                  <div className="border border-zinc-300 shadow-sm flex flex-col justify-between bg-white">
                    <div>
                      <div className="bg-[#FFCC00] text-black px-4 py-2.5 flex justify-between items-center border-b-2 border-zinc-400">
                        <span className="font-sans font-black text-xs uppercase tracking-wider">
                          EGRESOS - CANTINA
                        </span>
                        <span className="font-sans font-black text-xs uppercase tracking-wider">
                          Egresos ($)
                        </span>
                      </div>
                      <div className="divide-y divide-zinc-200 text-sm">
                        {evento.egresosCantina && evento.egresosCantina.length > 0 ? (
                          evento.egresosCantina.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center px-4 py-2.5 bg-white">
                              <span className="text-zinc-800 font-sans">{item.concepto}</span>
                              <span className="font-mono font-bold text-zinc-900">{formatCurrency(item.monto)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs italic text-zinc-400 bg-zinc-50">Sin egresos de cantina</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#1f1f23] text-white px-4 py-3 flex justify-between items-center font-sans font-black text-sm border-t-2 border-zinc-400">
                      <span>SUB-TOTAL EGRESOS</span>
                      <span className="font-mono text-base">{formatCurrency(egrCantina)}</span>
                    </div>
                  </div>
                </div>

                {/* CAJA TOTAL CANTINA */}
                <div className="pt-4 flex items-center justify-start">
                  <div className="flex border-2 border-black shadow-md overflow-hidden max-w-xl w-full sm:w-auto">
                    <div className="bg-[#1a1a1e] text-white px-5 py-3.5 flex flex-col justify-center">
                      <span className="font-sans font-black text-xs uppercase tracking-wider">
                        TOTAL GENERAL
                      </span>
                      <span className="font-sans font-black text-[11px] uppercase tracking-wider text-amber-300">
                        DE RECAUDACIÓN P/ SUBCOMISIÓN (CANTINA)
                      </span>
                    </div>
                    <div className="bg-[#FFCC00] text-black px-6 py-3.5 flex items-center justify-center font-mono font-black text-2xl sm:text-3xl min-w-[180px]">
                      {formatCurrency(netoCantina)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VISTA 3: OTROS / SPONSORS */}
            {slideActiva === 'otros' && (
              <div className="space-y-6 flex-1 flex flex-col justify-between">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  <div className="border border-zinc-300 shadow-sm flex flex-col justify-between bg-white">
                    <div>
                      <div className="bg-[#1f1f23] text-white px-4 py-2.5 flex justify-between items-center border-b-2 border-zinc-400">
                        <span className="font-sans font-black text-xs uppercase tracking-wider text-amber-300">
                          INGRESOS - AUSPICIANTES / OTROS
                        </span>
                        <span className="font-sans font-black text-xs uppercase tracking-wider text-zinc-300">
                          Monto ($)
                        </span>
                      </div>
                      <div className="divide-y divide-zinc-200 text-sm">
                        {evento.ingresosOtros && evento.ingresosOtros.length > 0 ? (
                          evento.ingresosOtros.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center px-4 py-3 bg-white">
                              <span className="text-zinc-800 font-sans">{item.concepto}</span>
                              <span className="font-mono font-bold text-zinc-900">{formatCurrency(item.monto)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs italic text-zinc-400 bg-zinc-50">Sin otros ingresos</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#FFCC00] text-black px-4 py-3 flex justify-between items-center font-sans font-black text-sm border-t-2 border-zinc-400">
                      <span>SUB-TOTAL OTROS INGRESOS</span>
                      <span className="font-mono text-base">{formatCurrency(ingOtros)}</span>
                    </div>
                  </div>

                  <div className="border border-zinc-300 shadow-sm flex flex-col justify-between bg-white">
                    <div>
                      <div className="bg-[#FFCC00] text-black px-4 py-2.5 flex justify-between items-center border-b-2 border-zinc-400">
                        <span className="font-sans font-black text-xs uppercase tracking-wider">
                          EGRESOS - OTROS GASTOS
                        </span>
                        <span className="font-sans font-black text-xs uppercase tracking-wider">
                          Monto ($)
                        </span>
                      </div>
                      <div className="divide-y divide-zinc-200 text-sm">
                        {evento.egresosOtros && evento.egresosOtros.length > 0 ? (
                          evento.egresosOtros.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center px-4 py-3 bg-white">
                              <span className="text-zinc-800 font-sans">{item.concepto}</span>
                              <span className="font-mono font-bold text-zinc-900">{formatCurrency(item.monto)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-xs italic text-zinc-400 bg-zinc-50">Sin otros egresos</div>
                        )}
                      </div>
                    </div>

                    <div className="bg-[#1f1f23] text-white px-4 py-3 flex justify-between items-center font-sans font-black text-sm border-t-2 border-zinc-400">
                      <span>SUB-TOTAL OTROS EGRESOS</span>
                      <span className="font-mono text-base">{formatCurrency(egrOtros)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex items-center justify-start">
                  <div className="flex border-2 border-black shadow-md overflow-hidden max-w-xl w-full sm:w-auto">
                    <div className="bg-[#1a1a1e] text-white px-5 py-3.5 flex flex-col justify-center">
                      <span className="font-sans font-black text-xs uppercase tracking-wider">
                        TOTAL OTROS RUBROS
                      </span>
                      <span className="font-sans font-black text-[11px] uppercase tracking-wider text-amber-300">
                        DE RECAUDACIÓN P/ SUBCOMISIÓN
                      </span>
                    </div>
                    <div className="bg-[#FFCC00] text-black px-6 py-3.5 flex items-center justify-center font-mono font-black text-2xl sm:text-3xl min-w-[180px]">
                      {formatCurrency(netoOtros)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. PIE DE PÁGINA INSTITUCIONAL DE LA DIAPOSITIVA */}
            <div className="pt-8 mt-6 border-t border-zinc-300 flex items-center justify-between text-xs text-zinc-600 font-serif italic">
              <span>Club Atlético Empalme Central — SubComisión de Tenis</span>
              <span className="font-sans font-bold text-[10px] uppercase tracking-wider text-zinc-400">
                CAEC · Portal Oficial
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
