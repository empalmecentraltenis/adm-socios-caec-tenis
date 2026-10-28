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
  Zap,
  Users,
  ShieldAlert,
  FileSpreadsheet,
  SlidersHorizontal,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';

interface TurnoLuzItem {
  turnoId: string;
  fecha: string;
  hora: string;
  cancha: string;
  tipoPartido: string;
  monto: number;
  sociosCount: number;
  pagado: boolean;
  pagoId?: string;
}

interface TurnoInvitadoDesglose {
  turnoId: string;
  fecha: string;
  hora: string;
  cancha: string;
  cantidad: number;
  bonificados: number;
  conCargo: number;
  montoCargo: number;
}

interface SocioItem {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  telefono: string;
  categoria: string;
  estado: string;
  // Cuotas
  valorCuota: number;
  alDiaCuota: boolean;
  mesesAdeudados: number;
  deudaCuotas: number;
  ultimoMesPagado: string | null;
  mesesPendientes: string[];
  mesesPagados: string[];
  // Luz
  luz: {
    totalTurnos: number;
    turnosPendientes: TurnoLuzItem[];
    turnosPagados: TurnoLuzItem[];
    deudaLuz: number;
  };
  // Invitados
  invitados: {
    totalInvitadosUsados: number;
    bonificadosUsados: number;
    bonificadosRestantes: number;
    extrasTotal: number;
    extrasPagadosCount: number;
    extrasPendientesCount: number;
    deudaInvitados: number;
    desglose: TurnoInvitadoDesglose[];
  };
  // Deuda consolidada
  deudaTotal: number;
  alDia: boolean;
}

interface PagoItem {
  id: string;
  tipo: string; // 'cuota' | 'luz' | 'invitado_extra'
  concepto: string;
  socioId: string;
  socioNombre: string;
  socioDni: string;
  categoria: string;
  detalle: string;
  monto: number;
  metodoPago: string;
  hora: string;
  fecha: string;
}

interface ResumenHoy {
  totalRecaudado: number;
  totalEfectivo: number;
  totalTransferencia: number;
  totalCuotas: number;
  totalLuz: number;
  totalInvitados: number;
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

function getSiguienteMes(ym: string): string {
  try {
    const [y, m] = ym.split('-').map(Number);
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    return `${nextY}-${String(nextM).padStart(2, '0')}`;
  } catch {
    return ym;
  }
}

export default function SecretariaPage() {
  const { toast } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Pestañas activas
  const [activeTab, setActiveTab] = useState<'mostrador' | 'deudores_luz' | 'padron_general'>('mostrador');

  // Datos del backend
  const [socios, setSocios] = useState<SocioItem[]>([]);
  const [pagosHoy, setPagosHoy] = useState<PagoItem[]>([]);
  const [resumenHoy, setResumenHoy] = useState<ResumenHoy>({
    totalRecaudado: 0,
    totalEfectivo: 0,
    totalTransferencia: 0,
    totalCuotas: 0,
    totalLuz: 0,
    totalInvitados: 0,
    cantidadCobros: 0,
  });
  const [mesActual, setMesActual] = useState<string>('');
  const [fechaHoy, setFechaHoy] = useState<string>('');
  const [anioActual, setAnioActual] = useState<number>(2026);
  const [loading, setLoading] = useState<boolean>(true);

  // Buscador y Selección de Socio en Mostrador
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [socioSeleccionado, setSocioSeleccionado] = useState<SocioItem | null>(null);

  // Conceptos seleccionados para cobrar
  const [mesesSeleccionados, setMesesSeleccionados] = useState<string[]>([]);
  const [turnosLuzSeleccionados, setTurnosLuzSeleccionados] = useState<string[]>([]);
  const [turnosInvitadosSeleccionados, setTurnosInvitadosSeleccionados] = useState<string[]>([]);

  // Formulario de Cobro
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'transferencia' | 'mercadopago'>('efectivo');
  const [montoPersonalizado, setMontoPersonalizado] = useState<string>('');
  const [procesandoCobro, setProcesandoCobro] = useState<boolean>(false);
  const [ultimoCobroExitoso, setUltimoCobroExitoso] = useState<{
    socio: string;
    monto: number;
    items: string[];
    metodo: string;
  } | null>(null);

  // Filtros para Listados
  const [filtroPadron, setFiltroPadron] = useState<'todos' | 'al_dia' | 'con_deuda' | 'solo_cuotas' | 'solo_adicionales'>('con_deuda');
  const [searchPadron, setSearchPadron] = useState<string>('');
  const [searchDeudoresLuz, setSearchDeudoresLuz] = useState<string>('');

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
          totalCuotas: 0,
          totalLuz: 0,
          totalInvitados: 0,
          cantidadCobros: 0,
        });
        setMesActual(json.mesActual || '');
        setFechaHoy(json.fechaHoy || '');
        setAnioActual(json.anioActual || 2026);
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

  // Filtrado de socios en vivo en el buscador de mostrador
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
      .slice(0, 8);
  }, [socios, searchTerm]);

  // Al seleccionar un socio
  const handleSeleccionarSocio = (socio: SocioItem) => {
    setSocioSeleccionado(socio);
    setSearchTerm('');
    setUltimoCobroExitoso(null);

    // 1. Sugerir cuotas
    let mesesSugeridos: string[] = [];
    const pagados = new Set(socio.mesesPagados || []);
    const pendientesNoPagados = (socio.mesesPendientes || []).filter((m) => !pagados.has(m));

    if (pendientesNoPagados.length > 0) {
      mesesSugeridos = [...pendientesNoPagados];
    } else if (mesActual && !pagados.has(mesActual)) {
      mesesSugeridos = [mesActual];
    }
    setMesesSeleccionados(mesesSugeridos);

    // 2. Sugerir turnos con luz pendientes
    const luzPendientesIds = (socio.luz?.turnosPendientes || []).map((t) => t.turnoId);
    setTurnosLuzSeleccionados(luzPendientesIds);

    // 3. Sugerir turnos con invitados extras pendientes
    const extrasTurnosIds = (socio.invitados?.desglose || [])
      .filter((d) => d.conCargo > 0)
      .map((d) => d.turnoId);
    setTurnosInvitadosSeleccionados(extrasTurnosIds);

    setMontoPersonalizado('');
    setActiveTab('mostrador');
  };

  // Meses disponibles para cobrar
  const mesesDisponiblesParaCobrar = useMemo(() => {
    if (!socioSeleccionado) return [];
    const pagados = new Set(socioSeleccionado.mesesPagados || []);
    const pendientes = (socioSeleccionado.mesesPendientes || []).filter((m) => !pagados.has(m));

    const lista = [...pendientes];
    if (mesActual && !pagados.has(mesActual) && !lista.includes(mesActual)) {
      lista.push(mesActual);
    }

    const todos = [...Array.from(pagados), ...lista].sort();
    const ultimo = todos[todos.length - 1] || mesActual;
    let siguiente = ultimo;
    for (let i = 0; i < 2; i++) {
      siguiente = getSiguienteMes(siguiente);
      if (!pagados.has(siguiente) && !lista.includes(siguiente)) {
        lista.push(siguiente);
      }
    }

    return lista.sort();
  }, [socioSeleccionado, mesActual]);

  // Alternar cuota
  const handleToggleMes = (mes: string) => {
    setMesesSeleccionados((prev) =>
      prev.includes(mes) ? prev.filter((m) => m !== mes) : [...prev, mes].sort()
    );
  };

  // Alternar turno con luz
  const handleToggleTurnoLuz = (turnoId: string) => {
    setTurnosLuzSeleccionados((prev) =>
      prev.includes(turnoId) ? prev.filter((id) => id !== turnoId) : [...prev, turnoId]
    );
  };

  // Alternar invitado extra
  const handleToggleTurnoInvitado = (turnoId: string) => {
    setTurnosInvitadosSeleccionados((prev) =>
      prev.includes(turnoId) ? prev.filter((id) => id !== turnoId) : [...prev, turnoId]
    );
  };

  // Cálculos de subtotales seleccionados
  const subtotalCuotas = useMemo(() => {
    if (!socioSeleccionado) return 0;
    return mesesSeleccionados.length * (socioSeleccionado.valorCuota || 7000);
  }, [socioSeleccionado, mesesSeleccionados]);

  const subtotalLuz = useMemo(() => {
    if (!socioSeleccionado?.luz?.turnosPendientes) return 0;
    return socioSeleccionado.luz.turnosPendientes
      .filter((t) => turnosLuzSeleccionados.includes(t.turnoId))
      .reduce((acc, t) => acc + t.monto, 0);
  }, [socioSeleccionado, turnosLuzSeleccionados]);

  const subtotalInvitados = useMemo(() => {
    if (!socioSeleccionado?.invitados?.desglose) return 0;
    return socioSeleccionado.invitados.desglose
      .filter((d) => turnosInvitadosSeleccionados.includes(d.turnoId))
      .reduce((acc, d) => acc + d.montoCargo, 0);
  }, [socioSeleccionado, turnosInvitadosSeleccionados]);

  const montoSugeridoTotal = subtotalCuotas + subtotalLuz + subtotalInvitados;

  const montoFinalCobro = useMemo(() => {
    if (montoPersonalizado.trim()) {
      const parsed = parseFloat(montoPersonalizado);
      return isNaN(parsed) ? 0 : parsed;
    }
    return montoSugeridoTotal;
  }, [montoPersonalizado, montoSugeridoTotal]);

  const totalConceptosSeleccionados =
    mesesSeleccionados.length + turnosLuzSeleccionados.length + turnosInvitadosSeleccionados.length;

  // Registrar Cobro
  const handleRegistrarCobro = async () => {
    if (!socioSeleccionado) return;
    if (totalConceptosSeleccionados === 0) {
      toast({
        title: 'Atención',
        description: 'Debes seleccionar al menos un concepto a cobrar (cuota, luz o invitado extra).',
        variant: 'destructive',
      });
      return;
    }

    setProcesandoCobro(true);
    try {
      // Preparar payload
      const turnosLuzPayload = (socioSeleccionado.luz?.turnosPendientes || [])
        .filter((t) => turnosLuzSeleccionados.includes(t.turnoId))
        .map((t) => ({
          turnoId: t.turnoId,
          fecha: t.fecha,
          hora: t.hora,
          monto: t.monto,
          concepto: `Luz ${t.cancha} (${t.fecha} ${t.hora}hs - ${t.tipoPartido})`,
        }));

      const invitadosPayload = (socioSeleccionado.invitados?.desglose || [])
        .filter((d) => d.conCargo > 0 && turnosInvitadosSeleccionados.includes(d.turnoId))
        .map((d) => ({
          turnoId: d.turnoId,
          cantidad: d.conCargo,
          monto: d.montoCargo,
          montoUnitario: 10000,
          fecha: d.fecha,
          concepto: `Invitado con cargo (${d.conCargo} pases) - Turno ${d.fecha} ${d.hora}hs`,
        }));

      const res = await fetch('/api/secretaria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socioId: socioSeleccionado.id,
          mesesPagados: mesesSeleccionados,
          turnosLuzCobrados: turnosLuzPayload,
          invitadosCobrados: invitadosPayload,
          montoTotal: montoFinalCobro,
          metodoPago,
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        const totalCobrado = json.totalCobrado !== undefined ? json.totalCobrado : montoFinalCobro;
        const items = (json.itemsCobrados || []).map((i: any) => i.concepto);

        toast({
          title: 'Cobro Registrado con Éxito',
          description: `Se cobraron ${items.length} concepto(s) a ${socioSeleccionado.nombreCompleto} por un total de $${totalCobrado.toLocaleString('es-AR')}.`,
        });

        setUltimoCobroExitoso({
          socio: socioSeleccionado.nombreCompleto,
          monto: totalCobrado,
          items,
          metodo: metodoPago,
        });

        // Limpiar formulario
        setSocioSeleccionado(null);
        setMesesSeleccionados([]);
        setTurnosLuzSeleccionados([]);
        setTurnosInvitadosSeleccionados([]);
        setMontoPersonalizado('');
        setSearchTerm('');

        await fetchData();

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

  // Exportar Excel Cierre de Caja del Día
  const handleExportExcelCierre = () => {
    if (pagosHoy.length === 0) return;

    const rows = pagosHoy.map((p, idx) => ({
      '#': idx + 1,
      Hora: p.hora,
      Fecha: p.fecha,
      Tipo: p.tipo.toUpperCase(),
      Concepto: p.concepto,
      Socio: p.socioNombre,
      DNI: p.socioDni,
      Categoría: p.categoria.toUpperCase(),
      Detalle: p.detalle,
      Monto: p.monto,
      'Método de Pago': p.metodoPago.toUpperCase(),
    }));

    // Fila totalizadora
    rows.push({
      '#': '' as any,
      Hora: '',
      Fecha: '',
      Tipo: 'TOTALES',
      Concepto: `${pagosHoy.length} cobros realizados`,
      Socio: 'TOTAL DEL DÍA',
      DNI: '',
      Categoría: '',
      Detalle: `Cuotas: $${resumenHoy.totalCuotas} | Luz: $${resumenHoy.totalLuz} | Invitados: $${resumenHoy.totalInvitados}`,
      Monto: resumenHoy.totalRecaudado,
      'Método de Pago': `Efectivo: $${resumenHoy.totalEfectivo} | Transferencia: $${resumenHoy.totalTransferencia}`,
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Cierre Secretaría');
    XLSX.writeFile(wb, `Cierre_Secretaria_CAEC_${fechaHoy || 'Hoy'}.xlsx`);
  };

  // Socios con deuda de Luz o Adicionales (Pestaña 2)
  const sociosConDeudaAdicional = useMemo(() => {
    return socios.filter((s) => s.luz.deudaLuz > 0 || s.invitados.deudaInvitados > 0);
  }, [socios]);

  const sociosDeudoresLuzFiltrados = useMemo(() => {
    if (!searchDeudoresLuz.trim()) return sociosConDeudaAdicional;
    const term = searchDeudoresLuz.toLowerCase().trim();
    return sociosConDeudaAdicional.filter(
      (s) =>
        s.dni.includes(term) ||
        s.apellido.toLowerCase().includes(term) ||
        s.nombre.toLowerCase().includes(term) ||
        s.nombreCompleto.toLowerCase().includes(term)
    );
  }, [sociosConDeudaAdicional, searchDeudoresLuz]);

  // Exportar Excel de Deudores de Luz y Adicionales
  const handleExportExcelDeudoresLuz = () => {
    if (sociosConDeudaAdicional.length === 0) return;

    const rows = sociosConDeudaAdicional.map((s, idx) => ({
      '#': idx + 1,
      Socio: s.nombreCompleto,
      DNI: s.dni,
      Teléfono: s.telefono || '-',
      Categoría: s.categoria.toUpperCase(),
      'Turnos Luz Pendientes': s.luz.turnosPendientes.length,
      'Deuda Luz ($)': s.luz.deudaLuz,
      'Invitados Usados Año': s.invitados.totalInvitadosUsados,
      'Invitados Extra a Cobrar': s.invitados.extrasPendientesCount,
      'Deuda Invitados ($)': s.invitados.deudaInvitados,
      'Total Adicionales a Cobrar ($)': s.luz.deudaLuz + s.invitados.deudaInvitados,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Deudores Luz e Invitados');
    XLSX.writeFile(wb, `CAEC_Deudores_Luz_Invitados_${anioActual}.xlsx`);
  };

  // Padrón General con filtro (Pestaña 3)
  const sociosPadronFiltrados = useMemo(() => {
    let list = socios;

    // Filtro por estado
    if (filtroPadron === 'al_dia') {
      list = list.filter((s) => s.alDia);
    } else if (filtroPadron === 'con_deuda') {
      list = list.filter((s) => !s.alDia || s.deudaTotal > 0);
    } else if (filtroPadron === 'solo_cuotas') {
      list = list.filter((s) => s.deudaCuotas > 0);
    } else if (filtroPadron === 'solo_adicionales') {
      list = list.filter((s) => s.luz.deudaLuz > 0 || s.invitados.deudaInvitados > 0);
    }

    if (!searchPadron.trim()) return list;
    const term = searchPadron.toLowerCase().trim();
    return list.filter(
      (s) =>
        s.dni.includes(term) ||
        s.apellido.toLowerCase().includes(term) ||
        s.nombre.toLowerCase().includes(term) ||
        s.nombreCompleto.toLowerCase().includes(term)
    );
  }, [socios, filtroPadron, searchPadron]);

  // Totales métricos del Padrón
  const metricasPadron = useMemo(() => {
    const totalSocios = socios.length;
    const alDia = socios.filter((s) => s.alDia).length;
    const conDeuda = socios.filter((s) => !s.alDia || s.deudaTotal > 0).length;
    const totalDeudaClub = socios.reduce((acc, s) => acc + s.deudaTotal, 0);
    const totalDeudaCuotas = socios.reduce((acc, s) => acc + s.deudaCuotas, 0);
    const totalDeudaLuz = socios.reduce((acc, s) => acc + s.luz.deudaLuz, 0);
    const totalDeudaInvitados = socios.reduce((acc, s) => acc + s.invitados.deudaInvitados, 0);

    return {
      totalSocios,
      alDia,
      conDeuda,
      totalDeudaClub,
      totalDeudaCuotas,
      totalDeudaLuz,
      totalDeudaInvitados,
    };
  }, [socios]);

  // Exportar Excel Padrón Completo
  const handleExportExcelPadron = () => {
    if (socios.length === 0) return;

    const rows = socios.map((s, idx) => ({
      '#': idx + 1,
      Socio: s.nombreCompleto,
      DNI: s.dni,
      Categoría: s.categoria.toUpperCase(),
      Teléfono: s.telefono || '-',
      'Meses Adeudados (Cuota)': s.mesesAdeudados,
      'Deuda Cuotas ($)': s.deudaCuotas,
      'Turnos Luz Pendientes': s.luz.turnosPendientes.length,
      'Deuda Luz ($)': s.luz.deudaLuz,
      'Invitados Usados Año': s.invitados.totalInvitadosUsados,
      'Invitados Con Cargo': s.invitados.extrasPendientesCount,
      'Deuda Invitados ($)': s.invitados.deudaInvitados,
      'Estado General': s.alDia ? 'AL DÍA' : 'CON DEUDA',
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Padrón Estados Deuda');
    XLSX.writeFile(wb, `CAEC_Padron_Estados_Deuda_${anioActual}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-[#121212] text-foreground p-3 sm:p-5 lg:p-6 space-y-6 max-w-[1550px] mx-auto">
      {/* 1. HEADER PUESTO DE SECRETARÍA */}
      <header className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center font-black text-black text-2xl shadow-md">
            C
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">CAEC Tenis · Secretaría</h1>
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                ● Mostrador Activo
              </Badge>
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] font-bold">
                Año {anioActual}
              </Badge>
            </div>
            <p className="text-xs text-[#999999] mt-0.5">
              Gestión y cobro integral en mostrador: Cuotas sociales, turnos nocturnos con luz y cargos de invitados
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

      {/* 2. PESTAÑAS PRINCIPALES DE NAVEGACIÓN */}
      <div className="flex items-center gap-2 border-b border-[#2A2A2A] pb-1 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('mostrador')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
            activeTab === 'mostrador'
              ? 'bg-amber-400 text-black shadow-md'
              : 'bg-[#1C1C1C] text-[#AAAAAA] hover:text-white border border-[#2E2E2E]'
          }`}
        >
          <Receipt className="h-4 w-4" />
          <span>Mostrador de Cobro</span>
          {socioSeleccionado && (
            <Badge className="bg-black text-amber-400 border-black/40 text-[9px] px-1.5 py-0 font-mono">
              1 en atención
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('deudores_luz')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
            activeTab === 'deudores_luz'
              ? 'bg-amber-400 text-black shadow-md'
              : 'bg-[#1C1C1C] text-[#AAAAAA] hover:text-white border border-[#2E2E2E]'
          }`}
        >
          <Zap className="h-4 w-4 text-amber-500" />
          <span>Deudores de Luz e Invitados</span>
          <Badge
            className={`text-[10px] px-1.5 py-0 ${
              activeTab === 'deudores_luz'
                ? 'bg-black text-amber-400'
                : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
            }`}
          >
            {sociosConDeudaAdicional.length}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('padron_general')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shrink-0 ${
            activeTab === 'padron_general'
              ? 'bg-amber-400 text-black shadow-md'
              : 'bg-[#1C1C1C] text-[#AAAAAA] hover:text-white border border-[#2E2E2E]'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Padrón General de Deuda</span>
          <Badge
            className={`text-[10px] px-1.5 py-0 ${
              activeTab === 'padron_general'
                ? 'bg-black text-white'
                : 'bg-[#2E2E2E] text-[#AAAAAA]'
            }`}
          >
            {socios.length} socios
          </Badge>
        </button>
      </div>

      {/* MENSAJE DE ÚLTIMO COBRO EXITOSO */}
      {ultimoCobroExitoso && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-emerald-300 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="font-bold text-sm text-white">
                ¡Cobro asentado en caja para {ultimoCobroExitoso.socio}!
              </p>
              <p className="text-xs text-emerald-300/90">
                Total cobrado: <strong className="text-white font-black">${ultimoCobroExitoso.monto.toLocaleString('es-AR')}</strong> • {ultimoCobroExitoso.metodo.toUpperCase()} • Conceptos cobrados: <strong className="text-white">{ultimoCobroExitoso.items.join(' | ')}</strong>
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUltimoCobroExitoso(null)}
            className="text-emerald-400 hover:text-white hover:bg-emerald-500/20 h-8 w-8 p-0 shrink-0 self-end sm:self-center"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 1: MOSTRADOR DE COBRO (BUSCADOR + FICHA 360 + CAJA DEL DÍA) */}
      {/* ===================================================================== */}
      {activeTab === 'mostrador' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* COLUMNA IZQUIERDA (7 cols): BUSCADOR Y FICHA MULTI-CONCEPTO */}
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

                {/* RESULTADOS EN VIVO */}
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
                            <div className="flex items-center gap-2 flex-wrap">
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

                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                            {/* Badges de estado rápido */}
                            {s.luz?.deudaLuz > 0 && (
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] font-bold">
                                💡 Luz ${s.luz.deudaLuz.toLocaleString('es-AR')}
                              </Badge>
                            )}
                            {s.invitados?.deudaInvitados > 0 && (
                              <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[9px] font-bold">
                                🎾 Extra ${s.invitados.deudaInvitados.toLocaleString('es-AR')}
                              </Badge>
                            )}
                            {s.alDia ? (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                                ✓ Al Día
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                                ⚠️ Debe cuota
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

            {/* FICHA ACTIVA DE COBRO 360° */}
            {socioSeleccionado ? (
              <Card className="bg-[#1C1C1C] border-2 border-amber-400/50 rounded-2xl shadow-xl overflow-hidden animate-in fade-in duration-200">
                <CardHeader className="bg-gradient-to-r from-amber-400/15 via-[#242424] to-[#1C1C1C] pb-4 border-b border-[#2E2E2E]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] uppercase font-black text-amber-400 tracking-wider block">
                        Ficha de Socio · Mostrador
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-white mt-0.5">
                        {socioSeleccionado.nombreCompleto}
                      </h2>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-[#AAAAAA]">
                        <span>DNI: <strong className="text-white font-mono">{socioSeleccionado.dni}</strong></span>
                        <span>•</span>
                        <span className="capitalize">Categoría: <strong className="text-white">{socioSeleccionado.categoria}</strong></span>
                        <span>•</span>
                        <span>Teléfono: <strong className="text-white">{socioSeleccionado.telefono || 'Sin registrar'}</strong></span>
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
                </CardHeader>

                <CardContent className="p-5 space-y-6">
                  {/* SECCIÓN A: CUOTAS SOCIALES */}
                  <div className="bg-[#242424] border border-[#333333] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          1. Cuotas Sociales (Valor: ${socioSeleccionado.valorCuota.toLocaleString('es-AR')})
                        </span>
                      </div>
                      {socioSeleccionado.alDiaCuota ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                          ✓ Cuotas al día
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                          ⚠️ Adeuda {socioSeleccionado.mesesAdeudados} mes(es) (${socioSeleccionado.deudaCuotas.toLocaleString('es-AR')})
                        </Badge>
                      )}
                    </div>

                    <p className="text-[11px] text-[#888888]">
                      Tocá los meses para sumar o restar al cobro de cuota:
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {mesesDisponiblesParaCobrar.map((mes) => {
                        const isSelected = mesesSeleccionados.includes(mes);
                        const esPendiente = socioSeleccionado.mesesPendientes?.includes(mes);
                        const esActual = mes === mesActual;

                        return (
                          <button
                            key={mes}
                            type="button"
                            onClick={() => handleToggleMes(mes)}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center justify-between ${
                              isSelected
                                ? 'bg-amber-400 text-black border-amber-400 shadow-md scale-[1.01]'
                                : esPendiente
                                ? 'bg-[#1C1C1C] text-amber-300 border-amber-500/30 hover:border-amber-400/60'
                                : 'bg-[#1E1E22] text-[#DDD] border-[#33333A] hover:border-amber-400/60'
                            }`}
                          >
                            <div>
                              <span className="block leading-tight">{formatMes(mes)}</span>
                              <span
                                className={`text-[10px] block ${
                                  isSelected
                                    ? 'text-black/80 font-medium'
                                    : esPendiente
                                    ? 'text-amber-400 font-semibold'
                                    : 'text-[#888888] font-normal'
                                }`}
                              >
                                {esPendiente ? 'Adeudado' : esActual ? 'Mes actual' : 'Adelanto'}
                              </span>
                            </div>
                            {isSelected && <Check className="h-4 w-4 text-black" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* SECCIÓN B: TURNOS CON LUZ (NOCTURNOS 2026) */}
                  <div className="bg-[#242424] border border-[#333333] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          2. Turnos Nocturnos con Luz (Desde 19:00 hs · Año {anioActual})
                        </span>
                      </div>
                      {socioSeleccionado.luz.deudaLuz === 0 ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                          ✓ Sin deuda de luz
                        </Badge>
                      ) : (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-bold">
                          ⚠️ Adeuda {socioSeleccionado.luz.turnosPendientes.length} turno(s) (${socioSeleccionado.luz.deudaLuz.toLocaleString('es-AR')})
                        </Badge>
                      )}
                    </div>

                    {socioSeleccionado.luz.turnosPendientes.length === 0 ? (
                      <div className="p-3 bg-[#1C1C1C] rounded-lg text-xs text-[#888888] flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Este socio no tiene turnos con luz pendientes de cobro en el año.</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] text-[#888888]">
                          Seleccioná los turnos nocturnos a incluir en este cobro:
                        </p>
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {socioSeleccionado.luz.turnosPendientes.map((turno) => {
                            const isSelected = turnosLuzSeleccionados.includes(turno.turnoId);
                            return (
                              <button
                                key={turno.turnoId}
                                type="button"
                                onClick={() => handleToggleTurnoLuz(turno.turnoId)}
                                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                  isSelected
                                    ? 'bg-amber-400/15 border-amber-400 text-white shadow-sm'
                                    : 'bg-[#1C1C1C] border-[#383838] text-[#BBBBBB] hover:bg-[#282828]'
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-xs text-white">
                                      {turno.fecha} · {turno.hora} hs
                                    </span>
                                    <Badge variant="outline" className="text-[9px] border-[#444] text-[#AAA]">
                                      {turno.cancha}
                                    </Badge>
                                    <Badge variant="outline" className="text-[9px] border-[#444] text-amber-300">
                                      {turno.tipoPartido}
                                    </Badge>
                                  </div>
                                  <span className="text-[10px] text-[#888888] block">
                                    Costo compartido entre {turno.sociosCount} socio(s)
                                  </span>
                                </div>

                                <div className="flex items-center gap-2.5">
                                  <span className="font-black text-sm text-amber-400">
                                    ${turno.monto.toLocaleString('es-AR')}
                                  </span>
                                  <div
                                    className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                      isSelected
                                        ? 'bg-amber-400 border-amber-400 text-black'
                                        : 'border-[#555] bg-[#222]'
                                    }`}
                                  >
                                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN C: INVITADOS ESPECIALES (4 GRATIS AL AÑO) */}
                  <div className="bg-[#242424] border border-[#333333] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-sky-400" />
                        <span className="text-xs font-bold text-white uppercase tracking-wider">
                          3. Control de Invitados (Cupo: 4 bonificados gratis en {anioActual})
                        </span>
                      </div>
                      <Badge
                        className={`text-[10px] font-bold ${
                          socioSeleccionado.invitados.totalInvitadosUsados <= 4
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border-red-500/40'
                        }`}
                      >
                        {socioSeleccionado.invitados.totalInvitadosUsados} de 4 bonificados usados
                      </Badge>
                    </div>

                    {/* Barra de progreso visual */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-[#AAAAAA]">
                        <span>
                          Bonificados consumidos: <strong className="text-white">{socioSeleccionado.invitados.bonificadosUsados} / 4</strong>
                        </span>
                        <span>
                          {socioSeleccionado.invitados.bonificadosRestantes > 0 ? (
                            <strong className="text-emerald-400">Le quedan {socioSeleccionado.invitados.bonificadosRestantes} gratis</strong>
                          ) : (
                            <strong className="text-amber-400">Cupo gratis agotado</strong>
                          )}
                        </span>
                      </div>
                      <div className="w-full bg-[#1A1A1A] h-2.5 rounded-full overflow-hidden border border-[#333]">
                        <div
                          className={`h-full transition-all duration-300 ${
                            socioSeleccionado.invitados.totalInvitadosUsados <= 4
                              ? 'bg-emerald-500'
                              : 'bg-gradient-to-r from-emerald-500 to-red-500'
                          }`}
                          style={{
                            width: `${Math.min(100, (socioSeleccionado.invitados.totalInvitadosUsados / 4) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Alerta de invitados con cargo si superó las 4 */}
                    {socioSeleccionado.invitados.extrasTotal > 0 ? (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl space-y-2">
                        <div className="flex items-center gap-2 text-xs font-bold text-red-300">
                          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                          <span>
                            Superó las 4 invitaciones bonificadas: llevó {socioSeleccionado.invitados.extrasTotal} invitado(s) adicional(es) ($10.000 c/u).
                          </span>
                        </div>

                        {socioSeleccionado.invitados.desglose
                          .filter((d) => d.conCargo > 0)
                          .map((d) => {
                            const isSelected = turnosInvitadosSeleccionados.includes(d.turnoId);
                            return (
                              <button
                                key={d.turnoId}
                                type="button"
                                onClick={() => handleToggleTurnoInvitado(d.turnoId)}
                                className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                                  isSelected
                                    ? 'bg-red-500/20 border-red-400 text-white'
                                    : 'bg-[#1C1C1C] border-[#383838] text-[#BBB]'
                                }`}
                              >
                                <div>
                                  <span className="font-bold text-xs text-white block">
                                    {d.fecha} · {d.hora} hs ({d.cancha})
                                  </span>
                                  <span className="text-[10px] text-[#999] block">
                                    {d.conCargo} invitado(s) con cargo adicional
                                  </span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                  <span className="font-black text-sm text-red-400">
                                    ${d.montoCargo.toLocaleString('es-AR')}
                                  </span>
                                  <div
                                    className={`w-5 h-5 rounded-md flex items-center justify-center border ${
                                      isSelected
                                        ? 'bg-red-500 border-red-500 text-white'
                                        : 'border-[#555] bg-[#222]'
                                    }`}
                                  >
                                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="p-3 bg-[#1C1C1C] rounded-lg text-xs text-[#888888] flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        <span>Está dentro de su cupo gratuito anual. No debe cargos por invitados.</span>
                      </div>
                    )}
                  </div>

                  {/* SECCIÓN D: MÉTODO DE PAGO */}
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

                  {/* SECCIÓN E: RESUMEN DE COBRO Y CONFIRMACIÓN */}
                  <div className="bg-[#242424] border-2 border-amber-400/40 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-[#AAAAAA] pb-2 border-b border-[#333]">
                      <span>Desglose de conceptos seleccionados:</span>
                      <span className="font-bold text-white">
                        {mesesSeleccionados.length} cuota(s) (${subtotalCuotas.toLocaleString('es-AR')}) • {turnosLuzSeleccionados.length} luz (${subtotalLuz.toLocaleString('es-AR')}) • {turnosInvitadosSeleccionados.length} extra (${subtotalInvitados.toLocaleString('es-AR')})
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
                      <div>
                        <span className="text-[11px] text-[#888888] block">Total a liquidar en mostrador:</span>
                        <span className="text-3xl font-black text-amber-400 tracking-tight">
                          ${montoFinalCobro.toLocaleString('es-AR')}
                        </span>
                      </div>

                      <Button
                        size="lg"
                        onClick={handleRegistrarCobro}
                        disabled={procesandoCobro || totalConceptosSeleccionados === 0}
                        className="w-full sm:w-auto h-12 px-7 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-sm rounded-xl shadow-lg gap-2"
                      >
                        {procesandoCobro ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Check className="h-5 w-5" />
                        )}
                        <span>CONFIRMAR COBRO EN CAJA</span>
                      </Button>
                    </div>
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
                  Buscá al socio por DNI o apellido en el campo superior. La ficha cargará automáticamente su estado de cuotas, turnos con luz pendientes y consumo de invitados.
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
                  {resumenHoy.cantidadCobros} cobro(s) realizados
                </span>
              </div>

              <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                  Efectivo en Mano
                </span>
                <span className="text-xl font-black text-emerald-400 mt-1 block">
                  ${resumenHoy.totalEfectivo.toLocaleString('es-AR')}
                </span>
                <span className="text-[11px] text-[#AAAAAA] mt-0.5 block">Caja física</span>
              </div>

              <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5 col-span-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider block">
                    Digital (Transferencia / MP)
                  </span>
                  <span className="text-lg font-black text-blue-400 mt-0.5 block">
                    ${resumenHoy.totalTransferencia.toLocaleString('es-AR')}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcelCierre}
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
                    <Clock className="h-4 w-4 text-amber-400" />
                    <span>Cobros Realizados Hoy ({pagosHoy.length})</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-[#888888]">
                    Historial de cobros asentados en esta jornada
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
                      <div
                        key={p.id}
                        className="p-3 hover:bg-[#242424] transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{p.socioNombre}</span>
                            <span className="text-[10px] text-[#777777] font-mono">DNI {p.socioDni}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-[9px] px-1 py-0 font-bold uppercase ${
                                p.tipo === 'luz'
                                  ? 'border-amber-500/30 text-amber-400'
                                  : p.tipo === 'invitado_extra'
                                  ? 'border-red-500/30 text-red-400'
                                  : 'border-emerald-500/30 text-emerald-400'
                              }`}
                            >
                              {p.tipo === 'luz' ? 'Luz' : p.tipo === 'invitado_extra' ? 'Invitado' : 'Cuota'}
                            </Badge>
                            <span className="text-[11px] text-[#AAAAAA]">{p.concepto}</span>
                            <span className="text-[10px] text-[#666] font-mono">• {p.hora}</span>
                          </div>
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
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 2: DEUDORES DE LUZ Y ADICIONALES (LISTADO RÁPIDO) */}
      {/* ===================================================================== */}
      {activeTab === 'deudores_luz' && (
        <Card className="bg-[#1C1C1C] border-[#2E2E2E] shadow-xl">
          <CardHeader className="pb-4 border-b border-[#2A2A2A]">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <span>Socios con Deuda de Turnos Nocturnos y Adicionales ({sociosConDeudaAdicional.length})</span>
                </CardTitle>
                <CardDescription className="text-xs text-[#999999] mt-0.5">
                  Nómina de socios que jugaron turnos con luz nocturna o llevaron invitados excedentes sin cancelar en secretaría
                </CardDescription>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#888]" />
                  <Input
                    placeholder="Filtrar por nombre o DNI..."
                    value={searchDeudoresLuz}
                    onChange={(e) => setSearchDeudoresLuz(e.target.value)}
                    className="pl-9 h-9 text-xs bg-[#242424] border-[#383838] text-white"
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportExcelDeudoresLuz}
                  disabled={sociosConDeudaAdicional.length === 0}
                  className="bg-[#242424] border-[#383838] text-white hover:bg-emerald-600 hover:text-white h-9 text-xs gap-1.5 shrink-0"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Exportar Excel</span>
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {sociosDeudoresLuzFiltrados.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#888888] space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                <p className="font-bold text-white text-sm">¡Excelente! No hay socios con deuda de luz o adicionales pendientes.</p>
                <p>Todos los turnos nocturnos y cargos de invitados del año se encuentran regularizados.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#181818]">
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-white text-xs font-bold">#</TableHead>
                      <TableHead className="text-white text-xs font-bold">Socio</TableHead>
                      <TableHead className="text-white text-xs font-bold">Documento</TableHead>
                      <TableHead className="text-white text-xs font-bold">Teléfono</TableHead>
                      <TableHead className="text-white text-xs font-bold text-center">Turnos Luz</TableHead>
                      <TableHead className="text-white text-xs font-bold text-right">Deuda Luz</TableHead>
                      <TableHead className="text-white text-xs font-bold text-center">Invitados Extra</TableHead>
                      <TableHead className="text-white text-xs font-bold text-right">Deuda Invitados</TableHead>
                      <TableHead className="text-white text-xs font-bold text-right">Total Adicionales</TableHead>
                      <TableHead className="text-white text-xs font-bold text-center">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-[#262626]">
                    {sociosDeudoresLuzFiltrados.map((s, idx) => {
                      const totalAdicional = s.luz.deudaLuz + s.invitados.deudaInvitados;
                      return (
                        <TableRow key={s.id} className="border-[#2A2A2A] hover:bg-[#222222]">
                          <TableCell className="text-xs text-[#777] font-mono">{idx + 1}</TableCell>
                          <TableCell className="text-xs font-bold text-white">
                            {s.nombreCompleto}
                            <Badge variant="outline" className="text-[9px] uppercase ml-2 text-[#999]">
                              {s.categoria}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-[#CCC]">{s.dni}</TableCell>
                          <TableCell className="text-xs text-[#999]">{s.telefono || '-'}</TableCell>
                          <TableCell className="text-center">
                            {s.luz.turnosPendientes.length > 0 ? (
                              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px]">
                                {s.luz.turnosPendientes.length} turno(s)
                              </Badge>
                            ) : (
                              <span className="text-[#666] text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-amber-400">
                            {s.luz.deudaLuz > 0 ? `$${s.luz.deudaLuz.toLocaleString('es-AR')}` : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            {s.invitados.extrasPendientesCount > 0 ? (
                              <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px]">
                                {s.invitados.extrasPendientesCount} extra(s)
                              </Badge>
                            ) : (
                              <span className="text-[#666] text-xs">
                                {s.invitados.totalInvitadosUsados}/4 gratis
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-red-400">
                            {s.invitados.deudaInvitados > 0
                              ? `$${s.invitados.deudaInvitados.toLocaleString('es-AR')}`
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right text-sm font-black text-white">
                            ${totalAdicional.toLocaleString('es-AR')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              onClick={() => handleSeleccionarSocio(s)}
                              className="bg-amber-400 hover:bg-amber-500 text-black font-bold text-xs h-8 px-3 gap-1 rounded-lg"
                            >
                              <span>Cobrar</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* PESTAÑA 3: PADRÓN GENERAL DE DEUDA (TODOS LOS SOCIOS) */}
      {/* ===================================================================== */}
      {activeTab === 'padron_general' && (
        <div className="space-y-5">
          {/* TARJETAS KPI DE MOROSIDAD */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
              <span className="text-[10px] text-[#888888] font-bold uppercase tracking-wider block">
                Total Padrón Activo
              </span>
              <span className="text-2xl font-black text-white mt-1 block">
                {metricasPadron.totalSocios}
              </span>
              <span className="text-[11px] text-[#888888]">Socios en sistema</span>
            </div>

            <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                Cuotas Al Día
              </span>
              <span className="text-2xl font-black text-emerald-400 mt-1 block">
                {metricasPadron.alDia}
              </span>
              <span className="text-[11px] text-[#888888]">Socios al día</span>
            </div>

            <div className="bg-[#1C1C1C] border border-[#2E2E2E] rounded-xl p-3.5">
              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider block">
                Con Deuda de Cuota
              </span>
              <span className="text-2xl font-black text-amber-400 mt-1 block">
                {metricasPadron.conDeuda}
              </span>
              <span className="text-[11px] text-[#888888]">
                Total: ${metricasPadron.totalDeudaCuotas.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* TABLA DEL PADRÓN CON FILTROS */}
          <Card className="bg-[#1C1C1C] border-[#2E2E2E] shadow-xl">
            <CardHeader className="pb-4 border-b border-[#2A2A2A]">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Users className="h-5 w-5 text-amber-400" />
                    <span>Padrón de Socios y Estado de Deuda Integral</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-[#999999] mt-0.5">
                    Padrón de socios con detalle de cuotas sociales, turnos nocturnos con luz y cargos por invitados
                  </CardDescription>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Selector de filtros */}
                  <div className="flex items-center gap-1 bg-[#242424] p-1 rounded-xl border border-[#383838]">
                    <button
                      type="button"
                      onClick={() => setFiltroPadron('con_deuda')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        filtroPadron === 'con_deuda'
                          ? 'bg-amber-400 text-black shadow'
                          : 'text-[#AAA] hover:text-white'
                      }`}
                    >
                      Con Deuda ({metricasPadron.conDeuda})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroPadron('al_dia')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        filtroPadron === 'al_dia'
                          ? 'bg-emerald-500 text-white shadow'
                          : 'text-[#AAA] hover:text-white'
                      }`}
                    >
                      Al Día ({metricasPadron.alDia})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFiltroPadron('todos')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        filtroPadron === 'todos'
                          ? 'bg-white text-black shadow'
                          : 'text-[#AAA] hover:text-white'
                      }`}
                    >
                      Todos ({metricasPadron.totalSocios})
                    </button>
                  </div>

                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#888]" />
                    <Input
                      placeholder="Buscar en padrón..."
                      value={searchPadron}
                      onChange={(e) => setSearchPadron(e.target.value)}
                      className="pl-9 h-9 text-xs bg-[#242424] border-[#383838] text-white"
                    />
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcelPadron}
                    className="bg-[#242424] border-[#383838] text-white hover:bg-emerald-600 hover:text-white h-9 text-xs gap-1.5 shrink-0"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Exportar Padrón</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#181818]">
                    <TableRow className="border-[#2A2A2A] hover:bg-transparent">
                      <TableHead className="text-white text-xs font-bold">#</TableHead>
                      <TableHead className="text-white text-xs font-bold">Socio</TableHead>
                      <TableHead className="text-white text-xs font-bold">Documento</TableHead>
                      <TableHead className="text-white text-xs font-bold text-center">Cuotas</TableHead>
                      <TableHead className="text-white text-xs font-bold text-right">Deuda Cuotas</TableHead>
                      <TableHead className="text-white text-xs font-bold text-right">Deuda Luz</TableHead>
                      <TableHead className="text-white text-xs font-bold text-center">Invitados (Año)</TableHead>
                      <TableHead className="text-white text-xs font-bold text-right">Deuda Invitados</TableHead>
                      <TableHead className="text-white text-xs font-bold text-center">Estado</TableHead>
                      <TableHead className="text-white text-xs font-bold text-center">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-[#262626]">
                    {sociosPadronFiltrados.map((s, idx) => (
                      <TableRow key={s.id} className="border-[#2A2A2A] hover:bg-[#222222]">
                        <TableCell className="text-xs text-[#777] font-mono">{idx + 1}</TableCell>
                        <TableCell className="text-xs font-bold text-white">
                          {s.nombreCompleto}
                          <Badge variant="outline" className="text-[9px] uppercase ml-2 text-[#999]">
                            {s.categoria}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-[#CCC]">{s.dni}</TableCell>
                        <TableCell className="text-center text-xs">
                          {s.mesesAdeudados === 0 ? (
                            <span className="text-emerald-400 font-semibold">Al día</span>
                          ) : (
                            <span className="text-amber-400 font-bold">{s.mesesAdeudados} mes(es)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-[#DDD]">
                          {s.deudaCuotas > 0 ? `$${s.deudaCuotas.toLocaleString('es-AR')}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-amber-400">
                          {s.luz.deudaLuz > 0 ? `$${s.luz.deudaLuz.toLocaleString('es-AR')}` : '-'}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          <span className={s.invitados.totalInvitadosUsados > 4 ? 'text-red-400 font-bold' : 'text-[#AAA]'}>
                            {s.invitados.totalInvitadosUsados}/4
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-red-400">
                          {s.invitados.deudaInvitados > 0
                            ? `$${s.invitados.deudaInvitados.toLocaleString('es-AR')}`
                            : '-'}
                        </TableCell>

                        <TableCell className="text-center">
                          {s.alDia ? (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                              ✓ Al Día
                            </Badge>
                          ) : (
                            <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px] font-bold">
                              ⚠️ Con Deuda
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSeleccionarSocio(s)}
                            className="text-amber-400 hover:text-white hover:bg-amber-400/20 text-xs h-8 px-2.5 font-bold"
                          >
                            Cobrar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
