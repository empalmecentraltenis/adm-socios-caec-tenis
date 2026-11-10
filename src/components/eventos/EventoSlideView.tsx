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
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[1200px] w-[95vw] bg-[#0c0c0e] border-[#222227] p-0 overflow-hidden text-white shadow-2xl print:max-w-none print:w-full print:border-none print:p-0 print:shadow-none print:bg-white print:text-black">
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            @page {
              size: landscape;
              margin: 10mm;
            }
            body {
              visibility: hidden !important;
              background: white !important;
              color: black !important;
            }
            .slide-print-container, .slide-print-container * {
              visibility: visible !important;
            }
            .slide-print-container {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100vw !important;
              margin: 0 !important;
              padding: 0 !important;
              border: none !important;
              box-shadow: none !important;
              background: white !important;
            }
            .no-print {
              display: none !important;
            }
          }
        `}} />

        {/* HEADER MODAL (NO SE IMPRIME) */}
        <DialogHeader className="p-4 sm:p-5 bg-[#141418] border-b border-[#24242c] flex flex-row items-center justify-between no-print">
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

          <div className="flex items-center gap-2 pr-6">
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

        {/* SELECTOR DE DIAPOSITIVA (NO SE IMPRIME) */}
        <div className="px-5 py-3 bg-[#121216] border-b border-[#202028] flex items-center justify-between gap-2 flex-wrap no-print">
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

        {/* CONTENEDOR DE LA DIAPOSITIVA (DISEÑO IDÉNTICO AL POWERPOINT) */}
        <div className="p-4 sm:p-6 lg:p-8 overflow-y-auto max-h-[80vh] print:p-0 print:overflow-visible print:max-h-none">
          <div
            ref={slideRef}
            className="slide-print-container w-full bg-white text-zinc-900 border-2 border-zinc-300 rounded-none shadow-2xl p-6 sm:p-8 flex flex-col justify-between print:border-none print:shadow-none print:p-4 min-h-[520px]"
            style={{ fontFamily: 'Georgia, serif' }}
          >
            {/* 1. ENCABEZADO INSTITUCIONAL DE LA DIAPOSITIVA */}
            <div className="bg-black text-white p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 -mx-6 sm:-mx-8 print:-mx-4 -mt-6 sm:-mt-8 print:-mt-4 mb-6 border-b-4 border-[#FFCC00]">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <img
                  src="/logo-caec.png"
                  alt="CAEC Tenis"
                  className="h-16 w-auto object-contain bg-black rounded shrink-0"
                />
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wider text-white font-serif truncate">
                    {evento.titulo}
                    {slideActiva === 'cantina' && ' · CANTINA'}
                    {slideActiva === 'otros' && ' · OTROS / AUSPICIOS'}
                  </h1>
                  {evento.subtitulo && (
                    <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-[#FFCC00] mt-0.5 truncate">
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
