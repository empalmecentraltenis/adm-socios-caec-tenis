import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RegistroProfe {
  id: string;
  fecha: string;
  cantidadClases?: number;
  cantidadAlumnos: number;
  precioTotal: number;
  observaciones?: string;
}

export interface SemanaResumen {
  numero: number;
  nombre: string;
  periodo: string;
  totalClases: number;
  diasConClase: number;
  totalAlumnos: number;
  totalCosto: number;
  promedioPorAlumno: number;
}

const formatARS = (val: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(val);
};

// Cargar Logo del club en el PDF
const tryLoadLogo = async (doc: jsPDF, x = 12, y = 11, w = 12, h = 12) => {
  try {
    const logoImg = new Image();
    logoImg.src = '/logo-caec.png';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      doc.addImage(logoImg, 'PNG', x, y, w, h);
    }
  } catch (e) {
    console.warn('No se pudo cargar el logo para el PDF');
  }
};

// ============================================================================
// HELPER: CALCULAR SEMANAS DEL MES (Semana 1, Semana 2... con inicio, fin y totales)
// ============================================================================
export const calcularSemanasDelMes = (
  monthStr: string, // YYYY-MM
  registros: RegistroProfe[]
): SemanaResumen[] => {
  const [yearNum, monthNum] = monthStr.split('-').map(Number);
  const firstDayOfMonth = new Date(yearNum, monthNum - 1, 1);
  const lastDayOfMonth = new Date(yearNum, monthNum, 0);

  const semanas: SemanaResumen[] = [];
  let currentStart = new Date(firstDayOfMonth);
  let weekIndex = 1;

  while (currentStart <= lastDayOfMonth) {
    const dayOfWeek = currentStart.getDay(); // 0: Dom, 1: Lun...
    const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + daysToSunday);
    if (currentEnd > lastDayOfMonth) {
      currentEnd = new Date(lastDayOfMonth);
    }

    const startStr = format(currentStart, 'yyyy-MM-dd');
    const endStr = format(currentEnd, 'yyyy-MM-dd');

    const recordsInWeek = registros.filter((r) => {
      const rDateStr = r.fecha.split('T')[0];
      return rDateStr >= startStr && rDateStr <= endStr;
    });

    const totalAlumnos = recordsInWeek.reduce((acc, r) => acc + r.cantidadAlumnos, 0);
    const totalCosto = recordsInWeek.reduce((acc, r) => acc + r.precioTotal, 0);
    const totalClases = recordsInWeek.reduce((acc, r) => acc + (r.cantidadClases ?? 1), 0);
    const diasConClase = recordsInWeek.length;
    const promedioPorAlumno = totalAlumnos > 0 ? Math.round(totalCosto / totalAlumnos) : 0;

    semanas.push({
      numero: weekIndex,
      nombre: `Semana ${weekIndex}`,
      periodo: `${format(currentStart, 'dd/MM/yyyy')} al ${format(currentEnd, 'dd/MM/yyyy')}`,
      totalClases,
      diasConClase,
      totalAlumnos,
      totalCosto,
      promedioPorAlumno,
    });

    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
    weekIndex++;
  }

  return semanas;
};

// ============================================================================
// 1. EXPORTAR REPORTE SEMANAL EN PDF PARA COMISIÓN DIRECTIVA (Detalle Diario de la Semana)
// ============================================================================
export const exportSemanaPDF = async (
  daysOfCurrentWeek: Date[],
  registrosMap: Map<string, RegistroProfe>,
  semanaStats: { alumnos: number; total: number; diasConClase: number; clases?: number }
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const weekStartStr = format(daysOfCurrentWeek[0], 'dd/MM/yyyy');
  const weekEndStr = format(daysOfCurrentWeek[6], 'dd/MM/yyyy');
  const totalClasesSemana = semanaStats.clases ?? semanaStats.diasConClase;

  await tryLoadLogo(doc, 12, 10, 11, 11);

  // Cabecera institucional (Fondo Negro #1A1A1A, Texto Amarillo #FFCC00)
  doc.setFillColor(26, 26, 26);
  doc.rect(10, 10, 190, 12, 'F');
  doc.setTextColor(255, 204, 0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBCOMISIÓN DE TENIS — CLUB EMPALME CENTRAL', 105, 17.5, { align: 'center' });

  // Subtítulo Comisión Directiva (Fondo Amarillo #FFCC00, Texto Negro)
  doc.setFillColor(255, 204, 0);
  doc.rect(10, 22, 190, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10.5);
  doc.text(`INFORME SEMANAL DE CLASES · ${weekStartStr} AL ${weekEndStr}`, 105, 27.5, { align: 'center' });

  // Cuadro de Resumen Ejecutivo de la Semana
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  // Fila 1: Total Alumnos y Total Recaudación
  doc.setFillColor(245, 245, 245);
  doc.rect(10, 32, 95, 7, 'F');
  doc.rect(105, 32, 95, 7, 'F');
  doc.rect(10, 32, 95, 7, 'D');
  doc.rect(105, 32, 95, 7, 'D');
  doc.text(`TOTAL ALUMNOS DE LA SEMANA:  ${semanaStats.alumnos}`, 15, 36.5);
  doc.text(`TOTAL RECAUDACIÓN SEMANAL:  ${formatARS(semanaStats.total)}`, 110, 36.5);

  // Fila 2: Clases Dictadas y Promedio por Alumno
  const promPorAlumno = semanaStats.alumnos > 0 ? Math.round(semanaStats.total / semanaStats.alumnos) : 0;
  doc.rect(10, 39, 95, 7, 'F');
  doc.rect(105, 39, 95, 7, 'F');
  doc.rect(10, 39, 95, 7, 'D');
  doc.rect(105, 39, 95, 7, 'D');
  doc.text(`CLASES DICTADAS:  ${totalClasesSemana} clases (${semanaStats.diasConClase} días)`, 15, 43.5);
  doc.text(`PROMEDIO ESTIMADO / ALUMNO:  ${formatARS(promPorAlumno)}`, 110, 43.5);

  // Preparar Filas de la Tabla (Lunes a Domingo)
  const tableData: any[] = [];
  daysOfCurrentWeek.forEach((day) => {
    const dayKey = format(day, 'yyyy-MM-dd');
    const reg = registrosMap.get(dayKey);
    const diaNombre = format(day, 'EEEE', { locale: es }).toUpperCase();
    const fechaFormatted = format(day, 'dd/MM/yyyy');

    if (reg) {
      const prom = reg.cantidadAlumnos > 0 ? Math.round(reg.precioTotal / reg.cantidadAlumnos) : 0;
      tableData.push([
        diaNombre,
        fechaFormatted,
        `${reg.cantidadClases ?? 1} ${(reg.cantidadClases ?? 1) === 1 ? 'clase' : 'clases'}`,
        `${reg.cantidadAlumnos} alumnos`,
        formatARS(reg.precioTotal),
        formatARS(prom),
        reg.observaciones || 'Clases normales',
      ]);
    } else {
      tableData.push([
        diaNombre,
        fechaFormatted,
        '-',
        '0 alumnos',
        '$ 0',
        '-',
        'Sin actividad registrada',
      ]);
    }
  });

  // Fila de Totales al pie de la tabla
  tableData.push([
    'TOTAL SEMANA',
    `${weekStartStr} al ${weekEndStr}`,
    `${totalClasesSemana} clases`,
    `${semanaStats.alumnos} alumnos`,
    formatARS(semanaStats.total),
    formatARS(promPorAlumno),
    `${semanaStats.diasConClase} días con actividad`,
  ]);

  autoTable(doc, {
    startY: 49,
    head: [['Día de la Semana', 'Fecha', 'Clases', 'Alumnos', 'Total Costo / Recaudación', 'Promedio / Alumno', 'Observaciones']],
    body: tableData,
    headStyles: {
      fillColor: [255, 204, 0],
      textColor: [0, 0, 0],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      valign: 'middle',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
      5: { halign: 'right', cellWidth: 26 },
      6: { cellWidth: 38 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didParseCell: (data) => {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [255, 245, 200];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Firmas institucionales para Comisión Directiva
  const pageHeight = doc.internal.pageSize.height;
  const signatureY = pageHeight - 32;

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  doc.line(15, signatureY, 65, signatureY);
  doc.text('Firma Profesor de Tenis', 15, signatureY + 4);
  doc.text('Aclaración:', 15, signatureY + 8);

  doc.line(75, signatureY, 125, signatureY);
  doc.text('Firma Subcomisión de Tenis', 75, signatureY + 4);
  doc.text('Aclaración:', 75, signatureY + 8);

  doc.line(135, signatureY, 195, signatureY);
  doc.text('Recibido Comisión Directiva CAEC', 135, signatureY + 4);
  doc.text('Fecha de Aprobación: _____/_____/2026', 135, signatureY + 8);

  doc.save(`Informe_Semana_Clases_CAEC_${weekStartStr.replace(/\//g, '-')}_al_${weekEndStr.replace(/\//g, '-')}.pdf`);
};

// ============================================================================
// 2. EXPORTAR REPORTE MENSUAL EN PDF PARA COMISIÓN DIRECTIVA (Desglose por Semana, NO diario)
// ============================================================================
export const exportMesPDF = async (
  monthStr: string, // YYYY-MM
  registros: RegistroProfe[],
  _desglosePorDiaSemana?: any[],
  stats: { totalAlumnos: number; totalRecaudado: number; totalClases: number; totalDiasConClase?: number } = { totalAlumnos: 0, totalRecaudado: 0, totalClases: 0, totalDiasConClase: 0 }
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const [year, monthNum] = monthStr.split('-');
  const mesNombre = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy', { locale: es }).toUpperCase();
  const diasDictados = stats.totalDiasConClase ?? stats.totalClases;

  await tryLoadLogo(doc, 12, 10, 11, 11);

  // Cabecera institucional
  doc.setFillColor(26, 26, 26);
  doc.rect(10, 10, 190, 12, 'F');
  doc.setTextColor(255, 204, 0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBCOMISIÓN DE TENIS — CLUB EMPALME CENTRAL', 105, 17.5, { align: 'center' });

  // Subtítulo Comisión Directiva
  doc.setFillColor(255, 204, 0);
  doc.rect(10, 22, 190, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10.5);
  doc.text(`INFORME MENSUAL DE CLASES · COMISIÓN DIRECTIVA — ${mesNombre}`, 105, 27.5, { align: 'center' });

  // Resumen del Mes
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);

  const promPorAlumnoMes = stats.totalAlumnos > 0 ? Math.round(stats.totalRecaudado / stats.totalAlumnos) : 0;
  const promAlumnosClase = stats.totalClases > 0 ? (stats.totalAlumnos / stats.totalClases).toFixed(1) : '0';

  doc.setFillColor(245, 245, 245);
  doc.rect(10, 32, 95, 7, 'F');
  doc.rect(105, 32, 95, 7, 'F');
  doc.rect(10, 32, 95, 7, 'D');
  doc.rect(105, 32, 95, 7, 'D');
  doc.text(`TOTAL ALUMNOS DEL MES:  ${stats.totalAlumnos}`, 15, 36.5);
  doc.text(`TOTAL COSTO / RECAUDACIÓN:  ${formatARS(stats.totalRecaudado)}`, 110, 36.5);

  doc.rect(10, 39, 95, 7, 'F');
  doc.rect(105, 39, 95, 7, 'F');
  doc.rect(10, 39, 95, 7, 'D');
  doc.rect(105, 39, 95, 7, 'D');
  doc.text(`TOTAL CLASES DICTADAS:  ${stats.totalClases} clases (${diasDictados} días)`, 15, 43.5);
  doc.text(`PROMEDIO:  ~${promAlumnosClase} alum / clase (${formatARS(promPorAlumnoMes)} / alumno)`, 110, 43.5);

  // =========================================================================
  // TABLA PRINCIPAL: DETALLE DE LAS CLASES SEMANALES (SEMANA 1, 2, 3...)
  // =========================================================================
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(20, 20, 20);
  doc.text('DETALLE DE CLASES SEMANALES (RESUMEN POR SEMANA):', 10, 51);

  const semanas = calcularSemanasDelMes(monthStr, registros);
  const semanasRows: any[] = semanas.map((s) => [
    s.nombre,
    s.periodo,
    `${s.totalClases} ${s.totalClases === 1 ? 'clase' : 'clases'}`,
    `${s.diasConClase} ${s.diasConClase === 1 ? 'día' : 'días'}`,
    `${s.totalAlumnos} alumnos`,
    formatARS(s.totalCosto),
    s.totalAlumnos > 0 ? formatARS(s.promedioPorAlumno) : '-',
  ]);

  // Fila de Totales del Mes
  semanasRows.push([
    'TOTAL MES',
    mesNombre,
    `${stats.totalClases} clases`,
    `${diasDictados} días`,
    `${stats.totalAlumnos} alumnos`,
    formatARS(stats.totalRecaudado),
    formatARS(promPorAlumnoMes),
  ]);

  autoTable(doc, {
    startY: 53,
    head: [['Semana', 'Período (Desde - Hasta)', 'Clases Dictadas', 'Días', 'Total Alumnos', 'Total Costo / Recaudación', 'Promedio / Alumno']],
    body: semanasRows,
    headStyles: {
      fillColor: [255, 204, 0],
      textColor: [0, 0, 0],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      valign: 'middle',
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 22 },
      1: { halign: 'center', cellWidth: 44 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 25 },
      3: { halign: 'center', cellWidth: 19 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
      6: { halign: 'right', cellWidth: 24 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didParseCell: (data) => {
      if (data.row.index === semanasRows.length - 1) {
        data.cell.styles.fillColor = [255, 245, 200];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Firmas institucionales para Comisión Directiva
  const finalTableY = (doc as any).lastAutoTable.finalY;
  const pageHeight = doc.internal.pageSize.height;
  const signatureY = Math.max(finalTableY + 35, pageHeight - 35);

  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  doc.line(15, signatureY, 65, signatureY);
  doc.text('Firma Profesor de Tenis', 15, signatureY + 4);
  doc.text('Aclaración:', 15, signatureY + 8);

  doc.line(75, signatureY, 125, signatureY);
  doc.text('Firma Subcomisión de Tenis', 75, signatureY + 4);
  doc.text('Aclaración:', 75, signatureY + 8);

  doc.line(135, signatureY, 195, signatureY);
  doc.text('Recibido Comisión Directiva CAEC', 135, signatureY + 4);
  doc.text('Fecha de Aprobación: _____/_____/2026', 135, signatureY + 8);

  doc.save(`Informe_Mensual_Clases_CAEC_${mesNombre.replace(/\s+/g, '_')}.pdf`);
};

// ============================================================================
// 3. EXPORTAR A EXCEL (XLSX) PARA COMISIÓN DIRECTIVA / TESORERÍA
// ============================================================================
export const exportMesExcel = (
  monthStr: string,
  registros: RegistroProfe[],
  stats: { totalAlumnos: number; totalRecaudado: number; totalClases: number; totalDiasConClase?: number }
) => {
  const semanas = calcularSemanasDelMes(monthStr, registros);
  const diasDictados = stats.totalDiasConClase ?? stats.totalClases;

  const dataForExcel: any[] = semanas.map((s) => ({
    'Semana': s.nombre,
    'Período': s.periodo,
    'Clases Dictadas': s.totalClases,
    'Días de Clase': s.diasConClase,
    'Total Alumnos': s.totalAlumnos,
    'Total Costo / Recaudación ($)': s.totalCosto,
    'Promedio por Alumno ($)': s.promedioPorAlumno,
  }));

  const promPorAlumnoMes = stats.totalAlumnos > 0 ? Math.round(stats.totalRecaudado / stats.totalAlumnos) : 0;
  dataForExcel.push({
    'Semana': 'TOTAL MES',
    'Período': monthStr,
    'Clases Dictadas': stats.totalClases,
    'Días de Clase': diasDictados,
    'Total Alumnos': stats.totalAlumnos,
    'Total Costo / Recaudación ($)': stats.totalRecaudado,
    'Promedio por Alumno ($)': promPorAlumnoMes,
  });

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen Semanal Mes');

  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
    { wch: 28 },
    { wch: 24 },
  ];

  XLSX.writeFile(
    workbook,
    `Resumen_Mensual_Semanas_CAEC_${monthStr}.xlsx`
  );
};

export const exportClasesExcel = (
  tipo: 'semana' | 'mes',
  periodoLabel: string,
  registros: { dia: string; fecha: string; alumnos: number; total: number; promedio: number; obs: string }[]
) => {
  const dataForExcel = registros.map((r, i) => ({
    'N°': i + 1,
    'Día de la Semana': r.dia,
    'Fecha': r.fecha,
    'Cantidad de Alumnos': r.alumnos,
    'Total Costo / Recaudación ($)': r.total,
    'Promedio por Alumno ($)': r.promedio,
    'Observaciones': r.obs,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clases Tenis');

  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 26 },
    { wch: 24 },
    { wch: 35 },
  ];

  XLSX.writeFile(
    workbook,
    `Planilla_Clases_${tipo.toUpperCase()}_CAEC_${periodoLabel.replace(/[\/\s]/g, '_')}.xlsx`
  );
};
