import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Movimiento {
  fecha: string | Date;
  descripcion: string;
  responsable: string;
  tipo: string;
  monto: number;
}

interface SummaryData {
  mesYear: string;
  saldoInicial: number;
  totalIngresos: number;
  totalEgresos: number;
  saldoCierre: number;
}

const formatARS = (val: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(val);
};

export const exportBalanceToPDF = async (
  movimientos: Movimiento[],
  summary: SummaryData
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  // Load Logo
  try {
    const logoImg = new Image();
    logoImg.src = '/logo-caec.png';
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve; // Continue anyway if logo fails
    });
    if (logoImg.complete && logoImg.naturalWidth > 0) {
      doc.addImage(logoImg, 'PNG', 12, 11, 10, 10);
    }
  } catch (e) {
    console.warn('Could not load logo for PDF');
  }

  // Header Colors (Black background, Yellow text)
  doc.setFillColor(26, 26, 26);
  doc.rect(10, 10, 190, 12, 'F');
  doc.setTextColor(255, 204, 0); // Yellow #FFCC00
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBCOMISIÓN DE TENIS — CLUB EMPALME CENTRAL', 105, 18, { align: 'center' });

  // Title (Yellow background, Black text)
  doc.setFillColor(255, 204, 0);
  doc.rect(10, 22, 190, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(11);
  doc.text(`CUENTA CORRIENTE — ${summary.mesYear.toUpperCase()}`, 105, 27, { align: 'center' });

  // Summary Section
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  
  // Saldo Inicial
  doc.setFillColor(255, 204, 0);
  doc.rect(10, 30, 130, 6); // Border
  doc.text(`SALDO INICIAL DEL EJERCICIO (${summary.mesYear}):`, 125, 34.5, { align: 'right' });
  doc.rect(140, 30, 60, 6);
  doc.text(`${formatARS(summary.saldoInicial)}`, 195, 34.5, { align: 'right' });

  // Ingresos
  doc.rect(10, 36, 130, 6);
  doc.text('TOTAL INGRESOS DEL MES:', 125, 40.5, { align: 'right' });
  doc.rect(140, 36, 60, 6);
  doc.setTextColor(34, 197, 94); // Green
  doc.text(`${formatARS(summary.totalIngresos)}`, 195, 40.5, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Egresos
  doc.rect(10, 42, 130, 6);
  doc.text('TOTAL EGRESOS DEL MES:', 125, 46.5, { align: 'right' });
  doc.rect(140, 42, 60, 6);
  doc.setTextColor(239, 68, 68); // Red
  doc.text(`${formatARS(summary.totalEgresos)}`, 195, 46.5, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Table Data Preparation
  // We want exactly 25 rows
  const tableData: any[] = [];
  let runningBalance = summary.saldoInicial;

  for (let i = 0; i < 25; i++) {
    if (i < movimientos.length) {
      const m = movimientos[i];
      if (!m || !m.fecha) {
        tableData.push([i + 1, '', '', '', '', '']);
        continue;
      }

      // Manejo robusto de fecha (string ISO o objeto Date)
      let datePart = '';
      try {
        const fechaStr = typeof m.fecha === 'string' ? m.fecha : (m.fecha as Date).toISOString();
        datePart = fechaStr.split('T')[0];
      } catch (e) {
        console.error('Error parsing date for PDF:', m.fecha);
        datePart = '0000-00-00';
      }

      const [y, mm, dd] = datePart.split('-');
      const displayFecha = y !== '0000' ? `${dd}/${mm}/${y}` : '---';
      
      runningBalance += m.tipo === 'ingreso' ? m.monto : -m.monto;
      
      tableData.push([
        i + 1,
        displayFecha,
        m.descripcion,
        m.responsable,
        `${m.tipo === 'ingreso' ? '+' : '-'}${formatARS(m.monto)}`,
        `${formatARS(runningBalance)}`,
      ]);
    } else {
      // Empty rows
      tableData.push([i + 1, '', '', '', '', '']);
    }
  }

  autoTable(doc, {
    startY: 52,
    head: [['N°', 'Fecha', 'Descripción / Concepto', 'Responsable', 'Importe (+/-)', 'Saldo']],
    body: tableData,
    headStyles: {
      fillColor: [255, 204, 0],
      textColor: [0, 0, 0],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      minCellHeight: 6,
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 25 },
      2: { cellWidth: 65 },
      3: { cellWidth: 35 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 30 },
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 52;

  // Bottom Summary (Normalizing to Yellow background with Black text)
  const drawSummaryRow = (label: string, value: string, y: number) => {
    doc.setFillColor(255, 204, 0); // Always Yellow
    doc.rect(10, y, 130, 8, 'F');
    doc.rect(140, y, 60, 8, 'F');
    
    doc.setTextColor(0, 0, 0); // Always Black
    doc.setFont('helvetica', 'bold');
    doc.text(label, 125, y + 5.5, { align: 'right' });
    doc.text(value, 195, y + 5.5, { align: 'right' });
  };

  drawSummaryRow('RESULTADO NETO DEL MES (V5):', formatARS(summary.totalIngresos - summary.totalEgresos), finalY + 5);
  drawSummaryRow('SALDO AL CIERRE DEL MES (V5):', formatARS(summary.saldoCierre), finalY + 13);

  // Signatures at the bottom of the page
  const pageHeight = doc.internal.pageSize.height;
  const signatureY = pageHeight - 20;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  doc.line(10, signatureY, 65, signatureY);
  doc.text('Firma Tesorero/a Subcomisión', 10, signatureY + 4);

  doc.line(72.5, signatureY, 127.5, signatureY);
  doc.text('Aclaración:', 72.5, signatureY + 4);

  doc.line(135, signatureY, 190, signatureY);
  doc.text('Firma Presidente Subcomisión:', 135, signatureY + 4);

  doc.save(`Balance_${summary.mesYear.replace(' ', '_')}.pdf`);
};
