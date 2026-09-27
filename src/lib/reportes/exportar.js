import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const EMPRESA = 'ArteCueros Mejía';

// Usa la misma función `render` de la columna que ya formatea la tabla en pantalla, para que
// PDF, Excel e impresión muestren siempre exactamente lo mismo (una sola fuente de formato).
const formatearCelda = (col, valor) => {
  const v = col.render ? col.render(valor) : valor;
  return v === null || v === undefined ? '' : String(v);
};

// PDF formal: encabezado con empresa, reporte, filtros, fecha/hora y usuario (requerimiento 6.21).
export function exportarPDF({ titulo, filtrosTexto, columnas, filas, totales, usuario }) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 12;
  let y = 15;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text(EMPRESA, pageWidth / 2, y, { align: 'center' }); y += 6;
  doc.setFontSize(11);
  doc.text(titulo, pageWidth / 2, y, { align: 'center' }); y += 6;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  if (filtrosTexto) { doc.text(filtrosTexto, pageWidth / 2, y, { align: 'center' }); y += 4.5; }
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')} · Usuario: ${usuario || '—'}`, pageWidth / 2, y, { align: 'center' });
  y += 7;

  const anchoDisponible = pageWidth - marginX * 2;
  const pesoTotal = columnas.reduce((s, c) => s + (c.ancho || 1), 0);
  const anchoCol = (col) => (anchoDisponible * (col.ancho || 1)) / pesoTotal;
  const xCol = (i) => marginX + columnas.slice(0, i).reduce((s, c) => s + anchoCol(c), 0);
  const rowHeight = 6;

  const dibujarEncabezado = () => {
    doc.setFillColor(30, 41, 59);
    doc.rect(marginX, y, anchoDisponible, rowHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    columnas.forEach((col, i) => {
      const x = xCol(i);
      const align = col.align === 'right' ? 'right' : 'left';
      doc.text(String(col.label), align === 'right' ? x + anchoCol(col) - 1.5 : x + 1.5, y + 4, { align });
    });
    y += rowHeight;
    doc.setTextColor(0, 0, 0);
  };

  const checkPageBreak = () => {
    if (y + rowHeight > pageHeight - 20) { doc.addPage(); y = 15; dibujarEncabezado(); }
  };

  dibujarEncabezado();
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
  filas.forEach((fila) => {
    checkPageBreak();
    columnas.forEach((col, i) => {
      const x = xCol(i);
      doc.rect(x, y, anchoCol(col), rowHeight);
      const texto = formatearCelda(col, fila[col.key]);
      const align = col.align === 'right' ? 'right' : 'left';
      doc.text(texto.slice(0, 45), align === 'right' ? x + anchoCol(col) - 1.5 : x + 1.5, y + 4, { align });
    });
    y += rowHeight;
  });

  if (totales) {
    checkPageBreak();
    doc.setFont('helvetica', 'bold');
    columnas.forEach((col, i) => {
      const x = xCol(i);
      doc.rect(x, y, anchoCol(col), rowHeight);
      const texto = totales[col.key] !== undefined ? formatearCelda(col, totales[col.key]) : (i === 0 ? 'TOTAL' : '');
      const align = col.align === 'right' ? 'right' : 'left';
      doc.text(String(texto).slice(0, 45), align === 'right' ? x + anchoCol(col) - 1.5 : x + 1.5, y + 4, { align });
    });
    y += rowHeight;
  }

  doc.save(`${titulo.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`);
}

// Excel real (.xlsx) que conserva la estructura para análisis posterior (requerimiento 6.21).
export function exportarExcel({ titulo, filtrosTexto, columnas, filas, totales }) {
  const encabezado = columnas.map((c) => c.label);
  const cuerpo = filas.map((fila) => columnas.map((c) => fila[c.key] ?? ''));
  const datos = [[titulo], ...(filtrosTexto ? [[filtrosTexto]] : []), [], encabezado, ...cuerpo];
  if (totales) datos.push(columnas.map((c) => (totales[c.key] !== undefined ? totales[c.key] : '')));
  const hoja = XLSX.utils.aoa_to_sheet(datos);
  hoja['!cols'] = columnas.map(() => ({ wch: 20 }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Reporte');
  XLSX.writeFile(libro, `${titulo.replace(/[^a-zA-Z0-9]+/g, '_')}.xlsx`);
}
