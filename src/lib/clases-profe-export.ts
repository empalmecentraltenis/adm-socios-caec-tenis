import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface RegistroProfe {
  id: string;
  fecha: string;
  cantidadAlumnos: number;
  precioTotal: number;
  observaciones?: string;
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
// 1. EXPORTAR REPORTE SEMANAL EN PDF PARA COMISIÓN DIRECTIVA
// ============================================================================
export const exportSemanaPDF = async (
  daysOfCurrentWeek: Date[],
  registrosMap: Map<string, RegistroProfe>,
  semanaStats: { alumnos: number; total: number; diasConClase: number }
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const weekStartStr = format(daysOfCurrentWeek[0], 'dd/MM/yyyy');
  const weekEndStr = format(daysOfCurrentWeek[6], 'dd/MM/yyyy');

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

  // Fila 2: Días con Clases y Promedio por Alumno
  const promPorAlumno = semanaStats.alumnos > 0 ? Math.round(semanaStats.total / semanaStats.alumnos) : 0;
  doc.rect(10, 39, 95, 7, 'F');
  doc.rect(105, 39, 95, 7, 'F');
  doc.rect(10, 39, 95, 7, 'D');
  doc.rect(105, 39, 95, 7, 'D');
  doc.text(`DÍAS CON CLASES DICTADAS:  ${semanaStats.diasConClase} de 7 días`, 15, 43.5);
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
        `${reg.cantidadAlumnos} alumnos`,
        formatARS(reg.precioTotal),
        formatARS(prom),
        reg.observaciones || 'Clases normales',
      ]);
    } else {
      tableData.push([
        diaNombre,
        fechaFormatted,
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
    `${semanaStats.alumnos} alumnos`,
    formatARS(semanaStats.total),
    formatARS(promPorAlumno),
    `${semanaStats.diasConClase} días de clase dictados`,
  ]);

  autoTable(doc, {
    startY: 49,
    head: [['Día de la Semana', 'Fecha', 'Alumnos', 'Recaudación ($)', 'Promedio / Alumno', 'Observaciones']],
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
      0: { fontStyle: 'bold', cellWidth: 32 },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 26 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
      4: { halign: 'right', cellWidth: 30 },
      5: { cellWidth: 46 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    didParseCell: (data) => {
      // Destacar la última fila de totales
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
// 2. EXPORTAR REPORTE MENSUAL EN PDF PARA COMISIÓN DIRECTIVA
// ============================================================================
export const exportMesPDF = async (
  monthStr: string, // YYYY-MM
  registros: RegistroProfe[],
  desglosePorDiaSemana: any[],
  stats: { totalAlumnos: number; totalRecaudado: number; totalClases: number }
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const [year, monthNum] = monthStr.split('-');
  const mesNombre = format(new Date(parseInt(year), parseInt(monthNum) - 1, 1), 'MMMM yyyy', { locale: es }).toUpperCase();

  await tryLoadLogo(doc, 12, 10, 11, 11);

  // Cabecera institucional
  doc.setFillColor(26, 26, 26);
  doc.rect(10, 10, 190, 12, 'F');
  doc.setTextColor(255, 204, 0);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBCOMISIÓN DE TENIS — CLUB EMPALME CENTRAL', 105, 17.5, { align: 'center' });

  // Subtítulo
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
  const promAlumnosDia = stats.totalClases > 0 ? (stats.totalAlumnos / stats.totalClases).toFixed(1) : '0';

  doc.setFillColor(245, 245, 245);
  doc.rect(10, 32, 95, 7, 'F');
  doc.rect(105, 32, 95, 7, 'F');
  doc.rect(10, 32, 95, 7, 'D');
  doc.rect(105, 32, 95, 7, 'D');
  doc.text(`TOTAL ALUMNOS DEL MES:  ${stats.totalAlumnos}`, 15, 36.5);
  doc.text(`TOTAL RECAUDACIÓN DEL MES:  ${formatARS(stats.totalRecaudado)}`, 110, 36.5);

  doc.rect(10, 39, 95, 7, 'F');
  doc.rect(105, 39, 95, 7, 'F');
  doc.rect(10, 39, 95, 7, 'D');
  doc.rect(105, 39, 95, 7, 'D');
  doc.text(`DÍAS DE CLASES DICTADAS:  ${stats.totalClases} días`, 15, 43.5);
  doc.text(`PROMEDIO:  ~${promAlumnosDia} alumnos / día (${formatARS(promPorAlumnoMes)} / alumno)`, 110, 43.5);

  // Tabla 1: Rendimiento por Día de la Semana
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('RESUMEN DE ASISTENCIA Y RECAUDACIÓN POR DÍA DE LA SEMANA:', 10, 50);

  const diaSemanaRows = desglosePorDiaSemana.map((d) => [
    d.nombre,
    `${d.count} ${d.count === 1 ? 'clase' : 'clases'}`,
    `${d.alumnos} alumnos`,
    d.count > 0 ? `${d.avgAlumnos} alum / día` : '-',
    formatARS(d.total),
    d.count > 0 ? formatARS(d.avgPrecio) : '-',
  ]);

  autoTable(doc, {
    startY: 52,
    head: [['Día', 'Clases en el Mes', 'Total Alumnos', 'Promedio Alumnos', 'Total Recaudado', 'Promedio $ / Clase']],
    body: diaSemanaRows,
    headStyles: {
      fillColor: [230, 230, 230],
      textColor: [0, 0, 0],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [210, 210, 210],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 },
      1: { halign: 'center', cellWidth: 30 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 30 },
      3: { halign: 'center', cellWidth: 32 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 35 },
      5: { halign: 'right', cellWidth: 35 },
    },
  });

  const nextY = (doc as any).lastAutoTable.finalY + 6;

  // Tabla 2: Detalle Cronológico de Días Cargados
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('DETALLE DIARIO DE CLASES DICTADAS:', 10, nextY);

  const detalleRows: any[] = registros.map((r) => {
    const [y, m, d] = r.fecha.split('T')[0].split('-').map(Number);
    const dateObj = new Date(y, m - 1, d, 12, 0, 0);
    const diaNombre = format(dateObj, 'EEEE', { locale: es }).toUpperCase();
    const fechaFormatted = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
    const prom = r.cantidadAlumnos > 0 ? Math.round(r.precioTotal / r.cantidadAlumnos) : 0;

    return [
      diaNombre,
      fechaFormatted,
      `${r.cantidadAlumnos}`,
      formatARS(r.precioTotal),
      formatARS(prom),
      r.observaciones || '-',
    ];
  });

  // Fila total al final
  detalleRows.push([
    'TOTAL MENSUAL',
    `${stats.totalClases} días`,
    `${stats.totalAlumnos}`,
    formatARS(stats.totalRecaudado),
    formatARS(promPorAlumnoMes),
    `Promedio diario: ~${promAlumnosDia} alumnos`,
  ]);

  autoTable(doc, {
    startY: nextY + 2,
    head: [['Día', 'Fecha', 'Alumnos', 'Total del Día', 'Promedio / Alumno', 'Observaciones']],
    body: detalleRows,
    headStyles: {
      fillColor: [255, 204, 0],
      textColor: [0, 0, 0],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 1.8,
      lineColor: [210, 210, 210],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 34 },
      4: { halign: 'right', cellWidth: 32 },
      5: { cellWidth: 50 },
    },
    didParseCell: (data) => {
      if (data.row.index === detalleRows.length - 1) {
        data.cell.styles.fillColor = [255, 245, 200];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Firmas institucionales
  const finalTableY = (doc as any).lastAutoTable.finalY;
  const pageHeight = doc.internal.pageSize.height;
  let signatureY = finalTableY + 16;

  // Si queda muy cerca del final de la hoja, saltar de página
  if (signatureY + 20 > pageHeight) {
    doc.addPage();
    signatureY = 30;
  }

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
    'Total Recaudado ($)': r.total,
    'Promedio por Alumno ($)': r.promedio,
    'Observaciones': r.obs,
  }));

  const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Clases Tenis');

  // Ajustar anchos de columnas
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 14 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 },
    { wch: 35 },
  ];

  XLSX.writeFile(
    workbook,
    `Planilla_Clases_${tipo.toUpperCase()}_CAEC_${periodoLabel.replace(/[\/\s]/g, '_')}.xlsx`
  );
};
