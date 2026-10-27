'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Search,
  DollarSign,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  RefreshCw,
  FileDown,
  Clock,
  User,
  ArrowRight,
  Sparkles,
  X,
  Loader2,
  Receipt,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface SocioItem {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  telefono: string;
  categoria: string;
  estado: string;
  valorCuota: number;
  alDia: boolean;
  mesesAdeudados: number;
  deudaEstimada: number;
  ultimoMesPagado: string | null;
  mesesPendientes: string[];
}

interface PagoItem {
  id: string;
  socioId: string;
  socioNombre: string;
  socioDni: string;
  categoria: string;
  mesPagado: string;
  monto: number;
  metodoPago: string;
  hora: string;
  fecha: string;
}

interface ResumenHoy {
  totalRecaudado: number;
  totalEfectivo: number;
  totalTransferencia: number;
  cantidadCobros: number;
}

const NOMBRES_MESES: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
};

function formatMes(ym: string): string {
  try {
    const [y, m] = ym.split('-');
    const nombre = NOMBRES_MESES[m] || ym;
    return `${nombre} ${y}`;
  } catch {
    return ym;
  }
}

export default function SecretariaPage() {
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Datos del backend
  const [socios, setSocios] = useState<SocioItem[]>([]);
  const [pagosHoy, setPagosHoy] = useState<PagoItem[]>([]);
  const [resumenHoy, setResumenHoy] = useState<ResumenHoy>({
    totalRecaudado: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    cantidadCobros: 0,
  });
  const [mesActual, setMesActual] = useState<string>('');
  const [fechaHoy, setFechaHoy] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Buscador y Selección de Socio
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [socioSeleccionado, setSocioSeleccionado] = useState<SocioItem | null>(null);

  // Formulario de Cobro
  const [mesesSeleccionados, setMesesSeleccionados] = useState<string[]>([]);
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'mercadopago'>('efectivo');
  const [montoPersonalizado, setMontoPersonalizado] = useState<string>('');
  const [procesandoCobro, setProcesandoCobro] = useState<boolean>(false);
  const [ultimoCobroExitoso, setUltimoCobroExitoso] = useState<{
    socio: string;
    monto: number;
    meses: string[];
    metodo: string;
  } | null>(null);

  // Cargar datos de secretaría
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/secretaria');
      if (res.ok) {
        const json = await res.json();
        setSocios(json.socios || []);
        setPagosHoy(json.pagosHoy || []);
        setResumenHoy(json.resumenHoy || {
          totalRecaudado: 0,
          totalEfectivo: 0,
          totalTransferencia: 0,
          cantidadCobros: 0,
        });
        setMesActual(json.mesActual || '');
        setFechaHoy(json.fechaHoy || '');
      } else {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los datos de secretaría.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error al cargar datos:', err);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtrado de socios en vivo
  const sociosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const term = searchTerm.toLowerCase().trim();
    return socios
      .filter((s) => {
        return (
          s.dni.includes(term) ||
          s.apellido.toLowerCase().includes(term) ||
          s.nombre.toLowerCase().includes(term) ||
          s.nombreCompleto.toLowerCase().includes(term)
        );
      })
      .slice(0, 8); // Top 8 resultados para máxima agilidad
  }, [socios, searchTerm]);

  // Al seleccionar un socio
  const handleSeleccionarSocio = (socio: SocioItem) => {
    setSocioSeleccionado(socio);
    setSearchTerm('');
    setUltimoCobroExitoso(null);

    // Sugerir meses a cobrar:
    // Si tiene meses pendientes, sugerir los pendientes (hasta 2) o al menos el mes actual
    let mesesSugeridos: string[] = [];
    if (socio.mesesPendientes && socio.mesesPendientes.length > 0) {
      mesesSugeridos = [...socio.mesesPendientes];
    } else if (mesActual) {
      mesesSugeridos = [mesActual];
    }

    setMesesSeleccionados(mesesSugeridos);
    setMontoPersonalizado('');
  };

  // Alternar selección de un mes
  const handleToggleMes = (mes: string) => {
    setMesesSeleccionados((prev) => {
      if (prev.includes(mes)) {
        return prev.filter((m) => m !== mes);
      } else {
        return [...prev, mes].sort();
      }
    });
  };

  // Monto final calculado
  const montoSugeridoTotal = useMemo(() => {
    if (!socioSeleccionado) return 0;
    return mesesSeleccionados.length * (socioSeleccionado.valorCuota || 7000);
  }, [socioSeleccionado, mesesSeleccionados]);

  const montoFinalCobro = useMemo(() => {
    if (montoPersonalizado.trim()) {
      const parsed = parseFloat(montoPersonalizado);
      return isNaN(parsed) ? 0 : parsed;
    }
    return montoSugeridoTotal;
  }, [montoPersonalizado, montoSugeridoTotal]);

  // Registrar Cobro
  const handleRegistrarCobro = async () => {
    if (!socioSeleccionado) return;
    if (mesesSeleccionados.length === 0) {
      toast({
        title: 'Atención',
        description: 'Debes seleccionar al menos un mes a cobrar.',
        variant: 'destructive',
      });
      return;
    }

    setProcesandoCobro(true);
    try {
      const res = await fetch('/api/secretaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioId: socioSeleccionado.id,
          mesesPagados: mesesSeleccionados,
          montoTotal: montoFinalCobro,
          metodoPago,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        toast({
          title: 'Cobro Registrado con Éxito',
          description: `Se cobraron ${mesesSeleccionados.length} mes(es) a ${socioSeleccionado.nombreCompleto}.`,
        });

        setUltimoCobroExitoso({
          socio: socioSeleccionado.nombreCompleto,
          monto: montoFinalCobro,
          meses: mesesSeleccionados,
          metodo: metodoPago,
        });

        // Limpiar para el siguiente socio
        setSocioSeleccionado(null);
        setMesesSeleccionados([]);
        setMontoPersonalizado('');
        setSearchTerm('');

        // Recargar datos para actualizar la caja y estado de socios
        await fetchData();

        // Re-enfocar buscador para el próximo socio
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      } else {
        toast({
          title: 'Error al cobrar',
          description: json.error || 'No se pudo registrar el pago.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Error al procesar cobro:', err);
      toast({
        title: 'Error de conexión',
        description: 'Ocurrió un error al comunicarse con el servidor.',
        variant: 'destructive',
      });
    } finally {
      setProcesandoCobro(false);
    }
  };

  // Exportar Excel Cierre de Caja
  const handleExportExcel = () => {
    if (pagosHoy.length === 0) return;

    const rows = pagosHoy.map((p, idx) => ({
      '#': idx + 1,
      Hora: p.hora,
      Fecha: p.fecha,
      Socio: p.socioNombre,
      DNI: p.socioDni,
      Categoría: p.categoria.toUpperCase(),
      'Mes Pagado': formatMes(p.mesPagado),
      Monto: p.monto,
      'Método de Pago': p.metodoPago.toUpperCase(),
    }));

    // Fila totalizadora
    rows.push({
      '#': '' as any,
      Hora: '',
      Fecha: '',
      Socio: 'TOTAL DEL DÍA',
      DNI: '',
      Categoría: '',
      'Mes Pagado': `${pagosHoy.length} cobros`,
      Monto: resumenHoy.totalRecaudado,
      'Método de Pago': `Efectivo: $${resumenHoy.totalEfectivo} | Transferencia: $${resumenHoy.totalTransferencia}`,
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Cierre Secretaría');
    XLSX.writeFile(wb, `Cierre_Secretaria_CAEC_${fechaHoy || 'Hoy'}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#121212] text-foreground p-3 sm:p-5 lg:p-6 space-y-6 max-w-[1500px] mx-auto">
      {/* 1. HEADER PUESTO DE SECRETARÍA */}
      <header className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-black text-xl shadow-md">
            C
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">CAEC Tenis · Secretaría</h1>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                ● Puesto de Cobro Activo
              </Badge>
            </div>
            <p className="text-xs text-[#999999] mt-0.5">
              Recepción y registro ágil de cuotas sociales en mostrador (sin intermediarios)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-[#888888] block">Fecha de Operación</span>
            <span className="text-xs font-bold text-white capitalize">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="bg-[#242424] border-[#383838] text-white hover:bg-[#2F2F2F] h-9 text-xs gap-1.5"
            title="Refrescar padrón y caja"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            <span>Refrescar</span>
          </Button>
        </div>
      </header>

      {/* MENSAJE DE ÚLTIMO COBRO EXITOSO */}
      {ultimoCobroExitoso && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between gap-3 text-emerald-300 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">
                ¡Pago registrado con éxito para {ultimoCobroExitoso.socio}!
              </p>
              <p className="text-xs text-emerald-300/90 mt-0.5">
                Monto cobrado: <strong className="text-white">${ultimoCobroExitoso.monto.toLocaleString('es-AR')}</strong> • Meses:{' '}
                {ultimoCobroExitoso.meses.map(formatMes).join(', ')} • {ultimoCobroExitoso.metodo.toUpperCase()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUltimoCobroExitoso(null)}
            className="text-emerald-400 hover:text-white hover:bg-emerald-500/20 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* 2. ÁREA DE TRABAJO PRINCIPAL: BUSCADOR & FICHA + CAJA DEL DÍA */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUMNA IZQUIERDA (7 cols): BUSCADOR Y REGISTRO DE COBRO */}
        <div className="lg:col-span-7 space-y-5">
          {/* BUSCADOR RÁPIDO */}
          <Card className="bg-[#1C1C1C] border-[#2E2E2E]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                <Search className="h-4 w-4 text-amber-400" />
                <span>1. Buscar Socio para Cobrar</span>
              </CardTitle>
              <CardDescription className="text-xs text-[#999999]">
                Ingresá el número de DNI o apellido del socio presente en la secretaría
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-400" />
                <Input
                  ref={searchInputRef}
                  placeholder="Ej: 28456789 o Pérez..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-9 h-12 text-sm bg-[#242424] border-[#383838] text-white placeholder:text-[#777777] focus:border-amber-400 rounded-xl"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#777777] hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* LISTA DE RESULTADOS EN VIVO */}
              {searchTerm.trim().length > 0 && (
                <div className="bg-[#242424] border border-[#383838] rounded-xl overflow-hidden divide-y divide-[#303030] max-h-72 overflow-y-auto shadow-2xl">
                  {sociosFiltrados.length === 0 ? (
                    <div className="p-4 text-center text-xs text-[#888888]">
                      No se encontró ningún socio con &quot;{searchTerm}&quot;.
                    </div>
                  ) : (
                    sociosFiltrados.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => handleSeleccionarSocio(s)}
                        className="w-full p-3 text-left hover:bg-amber-400/10 flex items-center justify-between gap-3 transition-colors group"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white group-hover:text-amber-300">
                              {s.nombreCompleto}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                              {s.categoria}
                            </Badge>
                          </div>
                          <span className="text-xs text-[#888888]">
                            DNI: <strong className="text-[#CCCCCC]">{s.dni}</strong> • Cuota:{' '}
                            <strong className="text-white">${s.valorCuota.toLocaleString('es-AR')}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {s.alDia ? (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                              ✓ Al Día
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                              ⚠️ Debe {s.mesesAdeudados} mes{s.mesesAdeudados !== 1 ? 'es' : ''}
                            </Badge>
                          )}
                          <ArrowRight className="h-4 w-4 text-[#666666] group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* FICHA ACTIVA DE COBRO */}
          {socioSeleccionado ? (
            <Card className="bg-[#1C1C1C] border-2 border-amber-400/50 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200">
              <CardHeader className="bg-gradient-to-r from-amber-400/15 via-[#242424] to-[#1C1C1C] pb-4 border-b border-[#2E2E2E]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider block">
                      Socio Seleccionado para Cobro
                    </span>
                    <h2 className="text-xl font-black text-white mt-0.5">
                      {socioSeleccionado.nombreCompleto}
                    </h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-[#AAAAAA]">
                      <span>DNI: <strong className="text-white font-mono">{socioSeleccionado.dni}</strong></span>
                      <span>•</span>
                      <span className="capitalize">Categoría: <strong className="text-white">{socioSeleccionado.categoria}</strong></span>
                      <span>•</span>
                      <span>Cuota mensual: <strong className="text-white font-bold">${socioSeleccionado.valorCuota.toLocaleString('es-AR')}</strong></span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSocioSeleccionado(null)}
                    className="text-[#888888] hover:text-white hover:bg-[#2A2A2A] h-8 w-8 p-0"
                    title="Cancelar selección"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                {/* ALERTA DE ESTADO DEL SOCIO */}
                <div className="mt-3 pt-3 border-t border-[#333333]/60 flex items-center justify-between text-xs">
                  {socioSeleccionado.alDia ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      Socio al día (último mes abonado:{' '}
                      {socioSeleccionado.ultimoMesPagado ? formatMes(socioSeleccionado.ultimoMesPagado) : 'Sin pagos registrados'}
                      )
                    </span>
                  ) : (
                    <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                      Adeuda {socioSeleccionado.mesesAdeudados} mes{socioSeleccionado.mesesAdeudados !== 1 ? 'es' : ''}{' '}
                      (Deuda estimada: ${socioSeleccionado.deudaEstimada.toLocaleString('es-AR')})
                    </span>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-5 space-y-5">
                {/* 1. SELECCIÓN DE MESES A COBRAR */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold text-white uppercase tracking-wider block">
                      Meses a Cobrar ({mesesSeleccionados.length})
                    </label>
                    <span className="text-[11px] text-[#888888]">
                      Tocá los meses para sumar o restar al cobro
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {/* Meses pendientes del socio */}
                    {socioSeleccionado.mesesPendientes.map((mes) => {
                      const isSelected = mesesSeleccionados.includes(mes);
                      return (
                        <button
                          key={mes}
                          type="button"
                          onClick={() => handleToggleMes(mes)}
                          className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                            isSelected
                              ? 'bg-amber-400 text-black border-amber-400 shadow-md scale-[1.01]'
                              : 'bg-[#242424] text-amber-300 border-amber-500/30 hover:border-amber-400/60'
                          }`}
                        >
                          <div>
                            <span className="block leading-tight">{formatMes(mes)}</span>
                            <span className={`text-[10px] block ${isSelected ? 'text-black/80 font-medium' : 'text-amber-400/80 font-normal'}`}>
                              Adeudado
                            </span>
                          </div>
                          {isSelected && <Check className="h-4 w-4 text-black" />}
                        </button>
                      );
                    })}

                    {/* Mes actual si no estaba en pendientes */}
                    {mesActual && !socioSeleccionado.mesesPendientes.includes(mesActual) && (
                      <button
                        type="button"
                        onClick={() => handleToggleMes(mesActual)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                          mesesSeleccionados.includes(mesActual)
                            ? 'bg-amber-400 text-black border-amber-400 shadow-md'
                            : 'bg-[#242424] text-white border-[#383838] hover:border-amber-400/60'
                        }`}
                      >
                        <div>
                          <span className="block leading-tight">{formatMes(mesActual)}</span>
                          <span className={`text-[10px] block ${mesesSeleccionados.includes(mesActual) ? 'text-black/80' : 'text-[#888888]'}`}>
                            Mes actual
                          </span>
                        </div>
                        {mesesSeleccionados.includes(mesActual) && <Check className="h-4 w-4 text-black" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. MÉTODO DE PAGO */}
                <div>
                  <label className="text-xs font-bold text-white uppercase tracking-wider block mb-2">
                    Método de Pago
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setMetodoPago('efectivo')}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        metodoPago === 'efectivo'
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg scale-[1.02]'
                          : 'bg-[#242424] text-[#CCCCCC] border-[#383838] hover:text-white hover:bg-[#2C2C2C]'
                      }`}
                    >
                      <Banknote className="h-5 w-5" />
                      <span>Efectivo</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMetodoPago('transferencia')}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        metodoPago === 'transferencia'
                          ? 'bg-blue-600 text-white border-blue-400 shadow-lg scale-[1.02]'
                          : 'bg-[#242424] text-[#CCCCCC] border-[#383838] hover:text-white hover:bg-[#2C2C2C]'
                      }`}
                    >
                      <CreditCard className="h-5 w-5" />
                      <span>Transferencia</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setMetodoPago('mercadopago')}
                      className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                        metodoPago === 'mercadopago'
                          ? 'bg-sky-500 text-white border-sky-300 shadow-lg scale-[1.02]'
                          : 'bg-[#242424] text-[#CCCCCC] border-[#383838] hover:text-white hover:bg-[#2C2C2C]'
                      }`}
                    >
                      <QrCode className="h-5 w-5" />
                      <span>Mercado Pago</span>
                    </button>
                  </div>
                </div>

                {/* 3. MONTO TOTAL Y CONFIRMACIÓN */}
                <div className="bg-[#242424] border border-[#383838] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] text-[#888888] block">Monto a cobrar por {mesesSeleccionados.length} mes(es):</span>
                    <span className="text-3xl font-black text-amber-400 tracking-tight">
                      ${montoFinalCobro.toLocaleString('es-AR')}
                    </span>
                  </div>

                  <Button
                    size="lg"
                    onClick={handleRegistrarCobro}
                    disabled={procesandoCobro || mesesSeleccionados.length === 0}
                    className="w-full sm:w-auto h-12 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-sm rounded-xl shadow-lg gap-2"
                  >
                    {procesandoCobro ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Check className="h-5 w-5" />
                    )}
                    <span>CONFIRMAR COBRO</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-2xl p-10 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-amber-400/10 text-amber-400 flex items-center justify-center mx-auto">
                <Receipt className="h-7 w-7" />
              </div>
              <h3 className="font-bold text-white text-base">Esperando socio para cobrar</h3>
              <p className="text-xs text-[#888888] max-w-sm mx-auto">
                Usá el buscador superior para encontrar al socio por su número de DNI o apellido. Los datos de su cuota aparecerán automáticamente.
              </p>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA (5 cols): CIERRE DE CAJA DEL DÍA */}
        <div className="lg:col-span-5 space-y-5">
          {/* TARJETAS DE TOTALES DE CAJA */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
              <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">
                Total Cobrado Hoy
              </span>
              <span className="text-xl font-black text-white mt-1 block">
                ${resumenHoy.totalRecaudado.toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-[#AAAAAA] mt-0.5 block">
                {resumenHoy.cantidadCobros} cobro{resumenHoy.cantidadCobros !== 1 ? 's' : ''} realizados
              </span>
            </div>

            <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                Efectivo en Mano
              </span>
              <span className="text-xl font-black text-emerald-400 mt-1 block">
                ${resumenHoy.totalEfectivo.toLocaleString('es-AR')}
              </span>
              <span className="text-[11px] text-[#AAAAAA] mt-0.5 block">
                Caja física
              </span>
            </div>

            <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5 col-span-2 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">
                  Transferencias / Digital
                </span>
                <span className="text-lg font-black text-blue-400 mt-0.5 block">
                  ${resumenHoy.totalTransferencia.toLocaleString('es-AR')}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                disabled={pagosHoy.length === 0}
                className="bg-[#242424] border-[#383838] text-white hover:bg-emerald-600 hover:text-white hover:border-emerald-500 text-xs h-8 gap-1.5 transition-colors"
                title="Exportar planilla de cobros de hoy"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Planilla Cierre</span>
              </Button>
            </div>
          </div>

          {/* LISTADO DE COBROS REALIZADOS HOY */}
          <Card className="bg-[#1C1C1C] border-[#2E2E2E]">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>Cobros Realizados Hoy ({pagosHoy.length})</span>
                </CardTitle>
                <CardDescription className="text-xs text-[#888888]">
                  Historial de pagos cargados en esta jornada
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-4 space-y-2">
                  <div className="h-10 bg-[#242424] rounded-lg animate-pulse" />
                  <div className="h-10 bg-[#242424] rounded-lg animate-pulse" />
                </div>
              ) : pagosHoy.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#777777] space-y-1">
                  <Clock className="h-6 w-6 mx-auto opacity-40 text-amber-400" />
                  <p>Aún no se registraron cobros en el día de hoy.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto divide-y divide-[#2B2B2B]">
                  {pagosHoy.map((p) => (
                    <div key={p.id} className="p-3 hover:bg-[#242424] transition-colors flex items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{p.socioNombre}</span>
                          <span className="text-[10px] text-[#777777] font-mono">DNI {p.socioDni}</span>
                        </div>
                        <span className="text-[11px] text-[#999999] block">
                          Cuota {formatMes(p.mesPagado)} • <span className="font-mono text-[10px]">{p.hora}</span>
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-emerald-400 block">
                          ${p.monto.toLocaleString('es-AR')}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase px-1.5 py-0 ${
                            p.metodoPago === 'efectivo'
                              ? 'border-emerald-500/30 text-emerald-400'
                              : 'border-blue-500/30 text-blue-400'
                          }`}
                        >
                          {p.metodoPago}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
