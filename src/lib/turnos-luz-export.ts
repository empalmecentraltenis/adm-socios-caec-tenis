import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TurnoSocio {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  horario: string;
  canchaId: number;
  canchaNombre: string;
  tipoPartido: string;
  titular: {
    dni: string;
    nombre: string;
  };
  jugadores: Array<{
    nombre: string;
    esTitular: boolean;
    esInvitado: boolean;
    dni?: string;
    monto: number;
  }>;
  totalSocios: number;
  totalJugadores: number;
  montoUnitarioSocio: number;
  montoTotalTurno: number;
}

interface SocioAcumulado {
  id: string;
  nombreCompleto: string;
  dni: string;
  telefono?: string;
  cantidadTurnos: number;
  totalAPagar: number;
  turnosDetalle: Array<{
    turnoId: string;
    fecha: string;
    hora: string;
    cancha: string;
    tipoPartido: string;
    rol: string;
    monto: number;
  }>;
}

interface TurnoProfesor {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  horario: string;
  canchaId: number;
  canchaNombre: string;
  detalle: string;
  asignadoA: string;
  monto: number;
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
  } catch {
    // Si no carga la imagen, continúa sin logo
  }
};

// ============================================================================
// 1. EXPORTAR PDF PARA SECRETARÍA (SOCIOS - CONSOLIDADO Y DETALLE)
// ============================================================================
export const exportSociosLuzPDF = async (
  periodoLabel: string,
  sociosAcumulado: SocioAcumulado[],
  turnosSocios: TurnoSocio[],
  kpis: { totalSociosMonto: number; totalSociosTurnos: number; precioLuzTurno: number }
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  await tryLoadLogo(doc, 12, 11, 14, 14);

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text('CLUB ATLÉTICO EMPALME CENTRAL', 30, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Subcomisión de Tenis · Reporte de Turnos Nocturnos con Luz (Desde 19:00 hs)', 30, 21);

  // Barra de título del período
  doc.setFillColor(255, 204, 0); // Amarillo CAEC
  doc.rect(10, 26, 190, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`LIQUIDACIÓN PARA SECRETARÍA · SOCIOS · ${periodoLabel.toUpperCase()}`, 105, 31.5, { align: 'center' });

  // Cuadros resumen KPI
  doc.setFillColor(248, 248, 248);
  doc.rect(10, 37, 60, 13, 'F');
  doc.rect(75, 37, 60, 13, 'F');
  doc.rect(140, 37, 60, 13, 'F');

  doc.rect(10, 37, 60, 13, 'D');
  doc.rect(75, 37, 60, 13, 'D');
  doc.rect(140, 37, 60, 13, 'D');

  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text('TOTAL A COBRAR SOCIOS', 13, 42);
  doc.text('TURNOS JUGADOS (LUZ)', 78, 42);
  doc.text('SOCIOS A LIQUIDAR', 143, 42);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatARS(kpis.totalSociosMonto), 13, 47.5);
  doc.text(`${kpis.totalSociosTurnos} turnos`, 78, 47.5);
  doc.text(`${sociosAcumulado.length} personas`, 143, 47.5);

  // TABLA 1: Liquidación Consolidada por Socio
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Resumen Consolidado por Socio (Montos a Cobrar en Cuota/Secretaría)', 10, 56);

  const tablaSociosData = sociosAcumulado.map((s, index) => [
    (index + 1).toString(),
    s.nombreCompleto,
    s.dni ? `DNI ${s.dni}` : '-',
    `${s.cantidadTurnos} ${s.cantidadTurnos === 1 ? 'turno' : 'turnos'}`,
    formatARS(s.totalAPagar),
  ]);

  // Fila de totales
  tablaSociosData.push([
    '',
    'TOTAL GENERAL SOCIOS',
    '',
    `${kpis.totalSociosTurnos} turnos`,
    formatARS(kpis.totalSociosMonto),
  ]);

  autoTable(doc, {
    startY: 59,
    head: [['#', 'Socio (Apellido y Nombre)', 'Documento', 'Turnos con Luz', 'Total a Cobrar']],
    body: tablaSociosData,
    headStyles: {
      fillColor: [255, 204, 0],
      textColor: [0, 0, 0],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: [210, 210, 210],
      lineWidth: 0.1,
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { fontStyle: 'bold', cellWidth: 70 },
      2: { cellWidth: 35 },
      3: { halign: 'center', cellWidth: 35 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
    },
    didParseCell: (data) => {
      if (data.row.index === tablaSociosData.length - 1) {
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // TABLA 2: Detalle Turno por Turno
  const lastY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 160;
  
  // Si queda poco espacio, añadir página
  if (lastY > 230) {
    doc.addPage();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Detalle de Turnos y Jugadores Participantes', 10, 15);
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Detalle de Turnos y Jugadores Participantes', 10, lastY);
  }

  const detalleData = turnosSocios.map((t) => {
    // Formatear participantes con su monto individual
    const participantesStr = t.jugadores
      .map((j) => `${j.nombre} (${j.esInvitado ? 'Invitado' : formatARS(j.monto)})`)
      .join('\n');

    return [
      t.fecha,
      t.horario,
      t.canchaNombre,
      t.tipoPartido,
      t.titular.nombre,
      participantesStr,
      formatARS(t.montoTotalTurno),
    ];
  });

  autoTable(doc, {
    startY: lastY > 230 ? 18 : lastY + 3,
    head: [['Fecha', 'Horario', 'Cancha', 'Tipo', 'Titular', 'Jugadores y Cargo Individual', 'Total Turno']],
    body: detalleData,
    headStyles: {
      fillColor: [40, 40, 40],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: [220, 220, 220],
      lineWidth: 0.1,
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 23 },
      2: { cellWidth: 20 },
      3: { cellWidth: 16 },
      4: { cellWidth: 38 },
      5: { cellWidth: 50 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 23 },
    },
  });

  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 140, 140);
    doc.text(
      `CAEC Tenis · Emitido el ${format(new Date(), 'dd/MM/yyyy HH:mm')} · Página ${i} de ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  doc.save(`CAEC_Liquidacion_Luz_Socios_${periodoLabel.replace(/\s+/g, '_')}.pdf`);
};

// ============================================================================
// 2. EXPORTAR PDF PARA EL PROFESOR
// ============================================================================
export const exportProfesorLuzPDF = async (
  periodoLabel: string,
  turnosProfesor: TurnoProfesor[],
  kpis: { totalProfeMonto: number; totalProfeTurnos: number; precioLuzProfe: number }
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  await tryLoadLogo(doc, 12, 11, 14, 14);

  // Encabezado
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(20, 20, 20);
  doc.text('CLUB ATLÉTICO EMPALME CENTRAL', 30, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text('Subcomisión de Tenis · Liquidación de Turnos Nocturnos con Luz (Profesor)', 30, 21);

  // Barra de título del período
  doc.setFillColor(255, 204, 0);
  doc.rect(10, 26, 190, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`LIQUIDACIÓN TURNOS CON LUZ · PROFESOR · ${periodoLabel.toUpperCase()}`, 105, 31.5, { align: 'center' });

  // Cuadros resumen KPI
  doc.setFillColor(248, 248, 248);
  doc.rect(10, 37, 60, 13, 'F');
  doc.rect(75, 37, 60, 13, 'F');
  doc.rect(140, 37, 60, 13, 'F');

  doc.rect(10, 37, 60, 13, 'D');
  doc.rect(75, 37, 60, 13, 'D');
  doc.rect(140, 37, 60, 13, 'D');

  doc.setFontSize(8);
  doc.setTextColor(90, 90, 90);
  doc.text('TOTAL A COBRAR PROFESOR', 13, 42);
  doc.text('TOTAL TURNOS CLASES', 78, 42);
  doc.text('TARIFA POR TURNO', 143, 42);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatARS(kpis.totalProfeMonto), 13, 47.5);
  doc.text(`${kpis.totalProfeTurnos} turnos`, 78, 47.5);
  doc.text(formatARS(kpis.precioLuzProfe), 143, 47.5);

  const tableData = turnosProfesor.map((t, index) => [
    (index + 1).toString(),
    t.fecha,
    t.horario,
    t.canchaNombre,
    t.detalle,
    formatARS(t.monto),
  ]);

  tableData.push([
    '',
    'TOTAL GENERAL',
    '',
    '',
    `${kpis.totalProfeTurnos} turnos`,
    formatARS(kpis.totalProfeMonto),
  ]);

  autoTable(doc, {
    startY: 56,
    head: [['#', 'Fecha', 'Horario', 'Cancha', 'Detalle / Concepto', 'Importe']],
    body: tableData,
    headStyles: {
      fillColor: [255, 204, 0],
      textColor: [0, 0, 0],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'left',
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 3,
      lineColor: [210, 210, 210],
      lineWidth: 0.1,
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { cellWidth: 28 },
      2: { cellWidth: 32 },
      3: { cellWidth: 32 },
      4: { cellWidth: 50 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 36 },
    },
    didParseCell: (data) => {
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fillColor = [240, 240, 240];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(140, 140, 140);
    doc.text(
      `CAEC Tenis · Emitido el ${format(new Date(), 'dd/MM/yyyy HH:mm')} · Página ${i} de ${pageCount}`,
      105,
      290,
      { align: 'center' }
    );
  }

  doc.save(`CAEC_Liquidacion_Luz_Profesor_${periodoLabel.replace(/\s+/g, '_')}.pdf`);
};

// ============================================================================
// 3. EXPORTAR EXCEL CONSOLIDADO (.XLSX)
// ============================================================================
export const exportLuzExcel = (
  periodoLabel: string,
  sociosAcumulado: SocioAcumulado[],
  turnosSocios: TurnoSocio[],
  turnosProfesor: TurnoProfesor[],
  kpis: {
    totalGeneralMonto: number;
    totalSociosMonto: number;
    totalProfeMonto: number;
    totalSociosTurnos: number;
    totalProfeTurnos: number;
  }
) => {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen para Secretaría (Socios)
  const rowsSocios: any[][] = [
    ['CLUB ATLÉTICO EMPALME CENTRAL - SUBCOMISIÓN DE TENIS'],
    [`LIQUIDACIÓN DE TURNOS CON LUZ PARA SECRETARÍA · ${periodoLabel.toUpperCase()}`],
    ['Fecha de Emisión:', format(new Date(), 'dd/MM/yyyy HH:mm')],
    [],
    ['#', 'Socio (Apellido y Nombre)', 'Documento (DNI)', 'Cantidad Turnos con Luz', 'Total a Cobrar ($)'],
  ];

  sociosAcumulado.forEach((s, i) => {
    rowsSocios.push([i + 1, s.nombreCompleto, s.dni || 'S/D', s.cantidadTurnos, s.totalAPagar]);
  });

  rowsSocios.push([]);
  rowsSocios.push(['', 'TOTAL GENERAL SOCIOS', '', kpis.totalSociosTurnos, kpis.totalSociosMonto]);

  const wsSocios = XLSX.utils.aoa_to_sheet(rowsSocios);
  XLSX.utils.book_append_sheet(wb, wsSocios, 'Cobranza Socios');

  // Hoja 2: Detalle de Turnos de Socios
  const rowsDetalle: any[][] = [
    ['DETALLE PARTIDO POR PARTIDO (SOCIOS) · TURNOS DESDE 19:00 HS'],
    [`Período: ${periodoLabel}`],
    [],
    ['Fecha', 'Horario', 'Cancha', 'Modalidad', 'Titular', 'Acompañantes', 'Total Socios', 'Monto Unitario Socio ($)', 'Total Turno ($)'],
  ];

  turnosSocios.forEach((t) => {
    const acompNames = t.jugadores
      .filter((j) => !j.esTitular)
      .map((j) => `${j.nombre} (${j.esInvitado ? 'Invitado' : `$${j.monto}`})`)
      .join(', ');

    rowsDetalle.push([
      t.fecha,
      t.horario,
      t.canchaNombre,
      t.tipoPartido,
      t.titular.nombre,
      acompNames || 'Sin acompañante',
      t.totalSocios,
      t.montoUnitarioSocio,
      t.montoTotalTurno,
    ]);
  });

  const wsDetalle = XLSX.utils.aoa_to_sheet(rowsDetalle);
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Turnos Socios');

  // Hoja 3: Turnos Profesor
  const rowsProfe: any[][] = [
    ['LIQUIDACIÓN TURNOS CON LUZ · PROFESOR DE TENIS'],
    [`Período: ${periodoLabel}`],
    [],
    ['#', 'Fecha', 'Horario', 'Cancha', 'Detalle / Concepto', 'Importe ($)'],
  ];

  turnosProfesor.forEach((t, i) => {
    rowsProfe.push([i + 1, t.fecha, t.horario, t.canchaNombre, t.detalle, t.monto]);
  });

  rowsProfe.push([]);
  rowsProfe.push(['', 'TOTAL GENERAL PROFESOR', '', '', `${kpis.totalProfeTurnos} turnos`, kpis.totalProfeMonto]);

  const wsProfe = XLSX.utils.aoa_to_sheet(rowsProfe);
  XLSX.utils.book_append_sheet(wb, wsProfe, 'Profesor');

  XLSX.writeFile(wb, `CAEC_Reporte_Luz_${periodoLabel.replace(/\s+/g, '_')}.xlsx`);
};
