import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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

export const exportBalanceToPDF = (
  movimientos: Movimiento[],
  summary: SummaryData
) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  }) as any;

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
  doc.rect(10, 30, 95, 6, 'S'); // Border only
  doc.text(`SALDO INICIAL DEL EJERCICIO (${summary.mesYear}):`, 95, 34.5, { align: 'right' });
  doc.text(`$ ${summary.saldoInicial.toLocaleString('es-AR')}`, 150, 34.5, { align: 'right' });

  // Ingresos
  doc.text('TOTAL INGRESOS DEL MES:', 95, 40.5, { align: 'right' });
  doc.setTextColor(34, 197, 94); // Green
  doc.text(`$ ${summary.totalIngresos.toLocaleString('es-AR')}`, 150, 40.5, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Egresos
  doc.text('TOTAL EGRESOS DEL MES:', 95, 46.5, { align: 'right' });
  doc.setTextColor(239, 68, 68); // Red
  doc.text(`$ ${summary.totalEgresos.toLocaleString('es-AR')}`, 150, 46.5, { align: 'right' });
  doc.setTextColor(0, 0, 0);

  // Borders for summary
  doc.rect(10, 30, 190, 6);
  doc.rect(10, 36, 190, 6);
  doc.rect(10, 42, 190, 6);
  doc.line(105, 30, 105, 48);

  // Table
  const tableData = movimientos.map((m, index) => {
    const fecha = typeof m.fecha === 'string' ? new Date(m.fecha) : m.fecha;
    return [
      index + 1,
      format(fecha, 'dd/MM/yyyy'),
      m.descripcion,
      m.responsable,
      `$ ${m.tipo === 'ingreso' ? '+' : '-'}${m.monto.toLocaleString('es-AR')}`,
      '', // Saldo will be calculated in the UI but let's see if we want it here
    ];
  });

  // Calculate cumulative balances for the table
  let runningBalance = summary.saldoInicial;
  movimientos.forEach((m, index) => {
    runningBalance += m.tipo === 'ingreso' ? m.monto : -m.monto;
    tableData[index][5] = `$ ${runningBalance.toLocaleString('es-AR')}`;
  });

  doc.autoTable({
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
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 20 },
      3: { cellWidth: 30 },
      4: { halign: 'right', cellWidth: 25 },
      5: { halign: 'right', cellWidth: 25 },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 52;

  // Bottom Summary
  doc.setFillColor(255, 204, 0);
  doc.rect(10, finalY + 5, 190, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('RESULTADO NETO DEL MES:', 130, finalY + 10.5, { align: 'right' });
  doc.text(`$ ${(summary.totalIngresos - summary.totalEgresos).toLocaleString('es-AR')}`, 160, finalY + 10.5, { align: 'right' });

  doc.setFillColor(26, 26, 26);
  doc.rect(10, finalY + 13, 190, 8, 'F');
  doc.setTextColor(255, 204, 0);
  doc.text('SALDO AL CIERRE DEL MES:', 130, finalY + 18.5, { align: 'right' });
  doc.text(`$ ${summary.saldoCierre.toLocaleString('es-AR')}`, 160, finalY + 18.5, { align: 'right' });

  // Signatures
  const signatureY = finalY + 35;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  doc.line(10, signatureY, 60, signatureY);
  doc.text('Firma Tesorero/a Subcomis', 10, signatureY + 4);

  doc.line(75, signatureY, 125, signatureY);
  doc.text('Aclaración:', 75, signatureY + 4);

  doc.line(140, signatureY, 190, signatureY);
  doc.text('Firma Presidente Subcomisión:', 140, signatureY + 4);

  doc.save(`Balance_${summary.mesYear.replace(' ', '_')}.pdf`);
};
