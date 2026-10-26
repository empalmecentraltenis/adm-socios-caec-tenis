'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CalendarDays,
  Clock,
  Trophy,
  Users,
  Search,
  RefreshCw,
  FileDown,
  UserCheck,
  Flame,
  Award,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  MessageCircle,
  Phone,
  BarChart3,
  Calendar,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format, subMonths, addMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

interface CanchaStat {
  id: number;
  nombre: string;
  reservasHistoricas: number;
  reservasMes: number;
  reservasSocios?: number;
  reservasProfe?: number;
  porcentajeMes: number;
}

interface SocioRanking {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  telefono: string;
  categoria: string;
  estado: string;
  reservasMes: number;
  reservasTotales: number;
}

interface InvitadoRanking {
  id: string;
  dni: string;
  nombre: string;
  apellido: string;
  nombreCompleto: string;
  telefono: string;
  categoria: string;
  reservasInvitado: number;
  superaCupo: boolean;
  invitadosExtras: number;
}

interface GestionTurnosData {
  periodo: {
    mes: string;
    anio: string;
  };
  kpis: {
    totalReservasHistoricas: number;
    reservasMesActual: number;
    reservasSociosMesActual?: number;
    reservasProfeMesActual?: number;
    porcentajeSociosMes?: number;
    porcentajeProfeMes?: number;
    reservasAnioActual: number;
    topHorario: string;
    topHorarioMes: string;
    validadosMes: number;
    noValidadosMes: number;
    tasaValidacion: number;
  };
  canchasStats: CanchaStat[];
  rankingSocios: SocioRanking[];
  rankingInvitado: InvitadoRanking[];
}

export default function GestionTurnosPanel({ readOnly }: { readOnly?: boolean }) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [data, setData] = useState<GestionTurnosData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'socios' | 'invitados'>('socios');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const mesStr = format(currentDate, 'yyyy-MM');
  const anioStr = format(currentDate, 'yyyy');
  const mesNombre = format(currentDate, 'MMMM yyyy', { locale: es });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gestion-turnos?mes=${mesStr}&anio=${anioStr}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Error al cargar datos de Gestión Turnos:', err);
    } finally {
      setLoading(false);
    }
  }, [mesStr, anioStr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  // Filtrado de rankings
  const sociosFiltrados = useMemo(() => {
    if (!data?.rankingSocios) return [];
    if (!searchTerm.trim()) return data.rankingSocios;
    const term = searchTerm.toLowerCase().trim();
    return data.rankingSocios.filter(
      (s) =>
        s.nombreCompleto.toLowerCase().includes(term) ||
        s.dni.includes(term) ||
        (s.telefono && s.telefono.includes(term))
    );
  }, [data?.rankingSocios, searchTerm]);

  const invitadosFiltrados = useMemo(() => {
    if (!data?.rankingInvitado) return [];
    if (!searchTerm.trim()) return data.rankingInvitado;
    const term = searchTerm.toLowerCase().trim();
    return data.rankingInvitado.filter(
      (s) =>
        s.nombreCompleto.toLowerCase().includes(term) ||
        s.dni.includes(term) ||
        (s.telefono && s.telefono.includes(term))
    );
  }, [data?.rankingInvitado, searchTerm]);

  // Exportar Excel
  const handleExportExcel = () => {
    if (!data) return;

    const wb = XLSX.utils.book_new();

    // Hoja 1: Ranking Socios
    const sociosRows = data.rankingSocios.map((s, idx) => ({
      '#': idx + 1,
      Socio: s.nombreCompleto,
      DNI: s.dni,
      Teléfono: s.telefono || '-',
      Categoría: s.categoria,
      [`Reservas ${mesNombre}`]: s.reservasMes,
      'Reservas Históricas': s.reservasTotales,
    }));
    const wsSocios = XLSX.utils.json_to_sheet(sociosRows);
    XLSX.utils.book_append_sheet(wb, wsSocios, 'Uso por Socios');

    // Hoja 2: Ranking Invitados
    const invitadosRows = data.rankingInvitado.map((s, idx) => ({
      '#': idx + 1,
      Socio: s.nombreCompleto,
      DNI: s.dni,
      Teléfono: s.telefono || '-',
      [`Invitados Año ${anioStr}`]: s.reservasInvitado,
      'Cupo Bonificado (4)': s.reservasInvitado <= 4 ? 'Bonificado' : 'Superado',
      'Invitados Extras a Cobrar': s.invitadosExtras,
    }));
    const wsInvitados = XLSX.utils.json_to_sheet(invitadosRows);
    XLSX.utils.book_append_sheet(wb, wsInvitados, 'Uso de Invitados');

    XLSX.writeFile(wb, `Gestion_Turnos_${mesStr}.xlsx`);
  };

  const formatWhatsappLink = (telefono?: string, socioNombre?: string) => {
    if (!telefono) return null;
    let clean = telefono.replace(/\D/g, '');
    if (!clean.startsWith('54') && clean.length === 10) {
      clean = '549' + clean;
    } else if (clean.startsWith('54') && !clean.startsWith('549')) {
      clean = '549' + clean.slice(2);
    }
    const msg = encodeURIComponent(`Hola ${socioNombre || ''}, te escribimos desde la Subcomisión de Tenis del CAEC.`);
    return `https://wa.me/${clean}?text=${msg}`;
  };

  return (
    <div className="space-y-6">
      {/* Selector de Período y Acciones */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handlePrevMonth}
            className="h-9 w-9"
            title="Mes anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="px-3 py-1.5 bg-muted rounded-lg font-bold text-sm text-foreground capitalize min-w-[170px] text-center border">
            {mesNombre}
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={handleNextMonth}
            className="h-9 w-9"
            title="Mes siguiente"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleCurrentMonth}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Mes actual
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="flex-1 sm:flex-none text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refrescar</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handleExportExcel}
            disabled={loading || !data}
            className="flex-1 sm:flex-none text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <FileDown className="h-3.5 w-3.5" />
            <span>Exportar Excel</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Turnos de Socios */}
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Turnos de Socios
            </CardTitle>
            <div className="p-2 bg-primary/10 text-primary rounded-lg">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <p className="text-2xl font-black text-foreground">
                  {data?.kpis.reservasSociosMesActual ?? data?.kpis.reservasMesActual ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.kpis.porcentajeSociosMes ?? 100}% del mes • Turnos jugados por socios
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 2: Clases Profesor / Alumnos */}
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Clases Profe / Alumnos
            </CardTitle>
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
              <Trophy className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <p className="text-2xl font-black text-amber-400">
                  {data?.kpis.reservasProfeMesActual ?? 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.kpis.porcentajeProfeMes ?? 0}% del mes • Clases escuela y profesor
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 3: Total Ocupación Mes */}
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Ocupación Mes
            </CardTitle>
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
              <CalendarDays className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <p className="text-2xl font-black text-foreground">
                  {data?.kpis.reservasMesActual || 0}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Socios + Clases • Total {data?.periodo.anio}: {data?.kpis.reservasAnioActual || 0}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI 4: Horario Pico */}
        <Card className="border-border">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Horario Más Usado
            </CardTitle>
            <div className="p-2 bg-purple-500/10 text-purple-500 rounded-lg">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div>
                <p className="text-xl font-black text-foreground truncate">
                  {data?.kpis.topHorarioMes || 'N/A'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Hora pico histórica: {data?.kpis.topHorario || 'N/A'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Uso por Canchas */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>Ocupación por Canchas en {mesNombre}</span>
          </CardTitle>
          <CardDescription>
            Distribución de turnos reservados por cada cancha habilitada (Socios vs Clases Profesor)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data?.canchasStats.map((cancha) => (
                <div
                  key={cancha.id}
                  className="p-4 rounded-xl border bg-muted/30 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-foreground text-sm">{cancha.nombre}</h4>
                      <p className="text-xs text-muted-foreground">
                        Histórico: {cancha.reservasHistoricas} turnos
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs font-bold">
                      {cancha.porcentajeMes}% del mes
                    </Badge>
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-xs text-muted-foreground font-medium">Total turnos mes</span>
                      <span className="text-lg font-black text-primary">{cancha.reservasMes}</span>
                    </div>
                    {/* Barra de progreso */}
                    <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, cancha.porcentajeMes)}%` }}
                      />
                    </div>
                    {/* Desglose Socios vs Clases Profesor */}
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 mt-2 border-t border-border/40">
                      <span>🎾 Socios: <strong className="text-foreground">{cancha.reservasSocios ?? '-'}</strong></span>
                      <span>🎓 Clases Profe: <strong className="text-amber-400 font-bold">{cancha.reservasProfe ?? '-'}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs y Rankings */}
      <Card className="border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            {/* Tab switchers */}
            <div className="flex items-center p-1 bg-muted rounded-xl gap-1">
              <Button
                variant={activeTab === 'socios' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('socios')}
                className="text-xs font-bold gap-1.5 h-8"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Uso por Socios ({data?.rankingSocios.length || 0})</span>
              </Button>
              <Button
                variant={activeTab === 'invitados' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('invitados')}
                className="text-xs font-bold gap-1.5 h-8"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Uso de Invitados ({data?.rankingInvitado.length || 0})</span>
              </Button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar socio por nombre, DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-8 text-xs bg-muted/40"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="space-y-2 py-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : activeTab === 'socios' ? (
            /* TAB 1: Ranking de Socios */
            sociosFiltrados.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No se encontraron socios con reservas en este período.
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12 text-center text-xs font-bold">#</TableHead>
                      <TableHead className="text-xs font-bold">Socio</TableHead>
                      <TableHead className="text-xs font-bold">DNI</TableHead>
                      <TableHead className="text-xs font-bold">Categoría</TableHead>
                      <TableHead className="text-center text-xs font-bold text-primary">
                        Turnos en {mesNombre}
                      </TableHead>
                      <TableHead className="text-center text-xs font-bold">
                        Turnos Totales
                      </TableHead>
                      <TableHead className="text-right text-xs font-bold">Contacto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sociosFiltrados.map((s, idx) => {
                      const waLink = formatWhatsappLink(s.telefono, s.nombre);
                      return (
                        <TableRow key={s.id || s.dni} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="text-center font-bold text-xs text-muted-foreground">
                            {idx === 0 ? (
                              <span className="text-amber-500 font-black">🥇 1</span>
                            ) : idx === 1 ? (
                              <span className="text-zinc-400 font-black">🥈 2</span>
                            ) : idx === 2 ? (
                              <span className="text-amber-700 font-black">🥉 3</span>
                            ) : (
                              idx + 1
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-sm text-foreground">
                              {s.nombreCompleto}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.dni}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {s.categoria}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-extrabold text-sm text-primary">
                              {s.reservasMes}
                            </span>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground font-semibold">
                            {s.reservasTotales}
                          </TableCell>
                          <TableCell className="text-right">
                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 hover:underline"
                                title="Contactar por WhatsApp"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            /* TAB 2: Ranking de Invitado Especial */
            invitadosFiltrados.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                No se registraron turnos con Invitado Especial en el año {anioStr}.
              </div>
            ) : (
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12 text-center text-xs font-bold">#</TableHead>
                      <TableHead className="text-xs font-bold">Socio</TableHead>
                      <TableHead className="text-xs font-bold">DNI</TableHead>
                      <TableHead className="text-center text-xs font-bold text-primary">
                        Invitados en {anioStr}
                      </TableHead>
                      <TableHead className="text-center text-xs font-bold">Estado Cupo</TableHead>
                      <TableHead className="text-center text-xs font-bold">Extras a Cobrar</TableHead>
                      <TableHead className="text-right text-xs font-bold">Contacto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitadosFiltrados.map((s, idx) => {
                      const waLink = formatWhatsappLink(s.telefono, s.nombre);
                      return (
                        <TableRow key={s.id || s.dni} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="text-center font-bold text-xs text-muted-foreground">
                            {idx + 1}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold text-sm text-foreground">
                              {s.nombreCompleto}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{s.dni}</TableCell>
                          <TableCell className="text-center">
                            <span className="font-extrabold text-sm text-foreground">
                              {s.reservasInvitado}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {s.superaCupo ? (
                              <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-bold">
                                Superó cupo bonificado
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[10px] font-bold">
                                Dentro de los 4 anuales
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {s.invitadosExtras > 0 ? (
                              <span className="font-black text-amber-500 text-sm">
                                {s.invitadosExtras} ($ extra)
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground font-medium">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-500 hover:underline"
                                title="Contactar por WhatsApp"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                                <span>WhatsApp</span>
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </CardContent>
      </Card>
    </div>
  );
}
