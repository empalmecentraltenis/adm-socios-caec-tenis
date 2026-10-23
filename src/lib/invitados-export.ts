import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

interface SocioInvitadosAcumulado {
  dni: string;
  nombreCompleto: string;
  telefono?: string;
  totalInvitadosAnio: number;
  cupoGratisAnual: number;
  invitadosGratisRestantes: number;
  turnosEnPeriodo: number;
  invitadosEnPeriodo: number;
  invitadosGratisPeriodo: number;
  invitadosCobradosPeriodo: number;
  precioUnitarioExtra: number;
  totalACobrar: number;
  turnosDetalle: any[];
}

interface TurnoInvitadoItem {
  id: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  horario: string;
  canchaId: number;
  canchaNombre: string;
  modalidad: string;
  titular: {
    dni: string;
    nombre: string;
  };
  jugadores: Array<{
    nombre: string;
    esInvitado: boolean;
    esTitular: boolean;
  }>;
  cantidadInvitados: number;
  invitadosGratis: number;
  invitadosCobrados: number;
  cargoTurno: number;
  ordenInvitacionesAnual: string;
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
// 1. EXPORTAR PDF PARA SECRETARÍA (INVITADOS)
// ============================================================================
export const exportInvitadosPDF = async (
  periodoLabel: string,
  sociosAcumulado: SocioInvitadosAcumulado[],
  turnos: TurnoInvitadoItem[],
  kpis: {
    totalRecaudacion: number;
    totalInvitadosPeriodo: number;
    totalInvitadosGratis: number;
    totalInvitadosCobrados: number;
    sociosConCargo: number;
    precioInvitadoExtra: number;
    cupoInvitadosAnual: number;
  }
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
  doc.text(
    `Subcomisión de Tenis · Reporte de Invitados y Cobro de Extras ($ ${kpis.precioInvitadoExtra.toLocaleString('es-AR')} c/u tras ${kpis.cupoInvitadosAnual} gratis)`,
    30,
    21
  );

  // Barra de título del período
  doc.setFillColor(255, 204, 0); // Amarillo CAEC
  doc.rect(10, 26, 190, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `LIQUIDACIÓN PARA SECRETARÍA · INVITADOS · ${periodoLabel.toUpperCase()}`,
    105,
    31.5,
    { align: 'center' }
  );

  // Cuadros resumen KPI
  doc.setFillColor(248, 248, 248);
  doc.rect(10, 37, 45, 13, 'F');
  doc.rect(58, 37, 45, 13, 'F');
  doc.rect(106, 37, 45, 13, 'F');
  doc.rect(154, 37, 46, 13, 'F');

  doc.rect(10, 37, 45, 13, 'D');
  doc.rect(58, 37, 45, 13, 'D');
  doc.rect(106, 37, 45, 13, 'D');
  doc.rect(154, 37, 46, 13, 'D');

  doc.setFontSize(7.5);
  doc.setTextColor(90, 90, 90);
  doc.text('TOTAL A FACTURAR', 12, 42);
  doc.text('INVITADOS A COBRAR', 60, 42);
  doc.text('INVITADOS BONIFICADOS', 108, 42);
  doc.text('SOCIOS CON CARGO', 156, 42);

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatARS(kpis.totalRecaudacion), 12, 47.5);
  doc.text(`${kpis.totalInvitadosCobrados} invitados`, 60, 47.5);
  doc.text(`${kpis.totalInvitadosGratis} gratis`, 108, 47.5);
  doc.text(`${kpis.sociosConCargo} socios`, 156, 47.5);

  // TABLA 1: Resumen por Socio para Secretaría
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Resumen Consolidado por Socio Titular (Montos a Cobrar en Cuota)', 10, 56);

  const tablaSociosData = sociosAcumulado.map((s, index) => [
    (index + 1).toString(),
    s.nombreCompleto,
    s.dni ? `DNI ${s.dni}` : '-',
    `${s.totalInvitadosAnio} en el año`,
    `${s.invitadosGratisPeriodo} bonif.`,
    `${s.invitadosCobradosPeriodo} extras`,
    formatARS(s.totalACobrar),
  ]);

  tablaSociosData.push([
    '',
    'TOTAL GENERAL',
    '',
    '',
    `${kpis.totalInvitadosGratis} bonif.`,
    `${kpis.totalInvitadosCobrados} extras`,
    formatARS(kpis.totalRecaudacion),
  ]);

  autoTable(doc, {
    startY: 59,
    head: [['#', 'Socio Titular', 'Documento', 'Historial Año', 'Gratis (Período)', 'Extras a Cobrar', 'Total a Facturar']],
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
      1: { fontStyle: 'bold', cellWidth: 60 },
      2: { cellWidth: 30 },
      3: { halign: 'center', cellWidth: 25 },
      4: { halign: 'center', cellWidth: 28 },
      5: { halign: 'center', cellWidth: 25 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
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

  if (lastY > 230) {
    doc.addPage();
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Detalle de Turnos con Invitados en el Período', 10, 15);
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('2. Detalle de Turnos con Invitados en el Período', 10, lastY);
  }

  const detalleData = turnos.map((t) => {
    const estadoCobroStr = t.cargoTurno > 0
      ? `${t.invitadosCobrados} con cargo (${formatARS(t.cargoTurno)})`
      : 'Bonificado (Cupo gratis)';

    return [
      t.fecha,
      t.horario,
      t.canchaNombre,
      t.modalidad,
      t.titular.nombre,
      `${t.cantidadInvitados} invitado/s`,
      estadoCobroStr,
      formatARS(t.cargoTurno),
    ];
  });

  autoTable(doc, {
    startY: lastY > 230 ? 18 : lastY + 3,
    head: [['Fecha', 'Horario', 'Cancha', 'Tipo', 'Titular Responsable', 'Invitados', 'Estado Cobro', 'Importe']],
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
      1: { cellWidth: 24 },
      2: { cellWidth: 20 },
      3: { cellWidth: 16 },
      4: { cellWidth: 44 },
      5: { halign: 'center', cellWidth: 24 },
      6: { cellWidth: 42 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
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

  doc.save(`CAEC_Liquidacion_Invitados_${periodoLabel.replace(/\s+/g, '_')}.pdf`);
};

// ============================================================================
// 2. EXPORTAR EXCEL CONSOLIDADO (.XLSX)
// ============================================================================
export const exportInvitadosExcel = (
  periodoLabel: string,
  sociosAcumulado: SocioInvitadosAcumulado[],
  turnos: TurnoInvitadoItem[],
  kpis: {
    totalRecaudacion: number;
    totalInvitadosPeriodo: number;
    totalInvitadosGratis: number;
    totalInvitadosCobrados: number;
    sociosConCargo: number;
  }
) => {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Liquidación Socios (Secretaría)
  const rowsSocios: any[][] = [
    ['CLUB ATLÉTICO EMPALME CENTRAL - SUBCOMISIÓN DE TENIS'],
    [`LIQUIDACIÓN DE INVITADOS PARA SECRETARÍA · ${periodoLabel.toUpperCase()}`],
    ['Fecha de Emisión:', format(new Date(), 'dd/MM/yyyy HH:mm')],
    [],
    [
      '#',
      'Socio Titular',
      'Documento (DNI)',
      'Teléfono',
      'Total Invitaciones en el Año',
      'Gratis en Período (Cupo 4)',
      'Invitaciones Extras a Cobrar',
      'Valor Unitario Extra ($)',
      'Total a Facturar ($)',
    ],
  ];

  sociosAcumulado.forEach((s, i) => {
    rowsSocios.push([
      i + 1,
      s.nombreCompleto,
      s.dni || 'S/D',
      s.telefono || '',
      s.totalInvitadosAnio,
      s.invitadosGratisPeriodo,
      s.invitadosCobradosPeriodo,
      s.precioUnitarioExtra,
      s.totalACobrar,
    ]);
  });

  rowsSocios.push([]);
  rowsSocios.push([
    '',
    'TOTAL GENERAL',
    '',
    '',
    '',
    kpis.totalInvitadosGratis,
    kpis.totalInvitadosCobrados,
    '',
    kpis.totalRecaudacion,
  ]);

  const wsSocios = XLSX.utils.aoa_to_sheet(rowsSocios);
  XLSX.utils.book_append_sheet(wb, wsSocios, 'Cobranza Invitados');

  // Hoja 2: Detalle Turno por Turno
  const rowsDetalle: any[][] = [
    ['DETALLE PARTIDO POR PARTIDO CON INVITADOS'],
    [`Período: ${periodoLabel}`],
    [],
    [
      'Fecha',
      'Horario',
      'Cancha',
      'Modalidad',
      'Titular Responsable',
      'DNI Titular',
      'Cantidad Invitados',
      'Invitados Bonificados',
      'Invitados Con Cargo',
      'Orden Anual Invitación',
      'Cargo al Titular ($)',
    ],
  ];

  turnos.forEach((t) => {
    rowsDetalle.push([
      t.fecha,
      t.horario,
      t.canchaNombre,
      t.modalidad,
      t.titular.nombre,
      t.titular.dni,
      t.cantidadInvitados,
      t.invitadosGratis,
      t.invitadosCobrados,
      t.ordenInvitacionesAnual,
      t.cargoTurno,
    ]);
  });

  const wsDetalle = XLSX.utils.aoa_to_sheet(rowsDetalle);
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle Turnos');

  XLSX.writeFile(wb, `CAEC_Reporte_Invitados_${periodoLabel.replace(/\s+/g, '_')}.xlsx`);
};
