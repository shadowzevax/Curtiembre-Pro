import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { EMPRESA as DATOS_EMPRESA } from '@/lib/empresa';

const EMPRESA = DATOS_EMPRESA.nombre;
const NIT = `NIT ${DATOS_EMPRESA.nit}`;
const generado = (usuario) => `Generado: ${new Date().toLocaleString('es-CO')} · Usuario: ${usuario || '—'}`;
const nombreArchivo = (titulo) => titulo.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_');

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
  doc.text(EMPRESA, pageWidth / 2, y, { align: 'center' }); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(NIT, pageWidth / 2, y, { align: 'center' }); y += 6;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(titulo, pageWidth / 2, y, { align: 'center' }); y += 6;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  if (filtrosTexto) {
    doc.splitTextToSize(filtrosTexto, pageWidth - 30).forEach((l) => { doc.text(l, pageWidth / 2, y, { align: 'center' }); y += 4; });
    y += 0.5;
  }
  doc.text(generado(usuario), pageWidth / 2, y, { align: 'center' });
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
    if (y + rowHeight > pageHeight - 20) {
      doc.addPage(); y = 12;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.text(`${EMPRESA} · ${NIT} · ${titulo}`, marginX, y); y += 4;
      dibujarEncabezado();
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    }
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

  const paginas = doc.getNumberOfPages();
  for (let i = 1; i <= paginas; i += 1) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.text(`Página ${i} de ${paginas}`, pageWidth - marginX, pageHeight - 8, { align: 'right' });
  }
  doc.save(`${nombreArchivo(titulo)}.pdf`);
}

// Excel real (.xlsx) que conserva la estructura para análisis posterior (requerimiento 6.21).
// `excel` en la columna permite exportar un valor distinto al de pantalla (p. ej. número sin formato).
export function exportarExcel({ titulo, filtrosTexto, columnas, filas, totales, usuario }) {
  const encabezado = columnas.map((c) => c.label);
  const cuerpo = filas.map((fila) => columnas.map((c) => (c.excel ? c.excel(fila[c.key], fila) : fila[c.key]) ?? ''));
  const datos = [[EMPRESA], [NIT], [titulo], ...(filtrosTexto ? [[filtrosTexto]] : []), [generado(usuario)], [], encabezado, ...cuerpo];
  if (totales) datos.push(columnas.map((c) => (totales[c.key] !== undefined ? totales[c.key] : '')));
  const hoja = XLSX.utils.aoa_to_sheet(datos);
  hoja['!cols'] = columnas.map(() => ({ wch: 20 }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, 'Reporte');
  XLSX.writeFile(libro, `${nombreArchivo(titulo)}.xlsx`);
}

const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Impresión formal (carta): el encabezado de la empresa y de la tabla va dentro de <thead>, así el
// navegador lo repite en cada hoja. Se imprime desde un iframe oculto, sin tocar la pantalla.
export function imprimirRelacion({ titulo, filtrosTexto, columnas, filas, totales, usuario }) {
  const n = columnas.length;
  const celda = (col, v, tag = 'td') => `<${tag} style="text-align:${col.align === 'right' ? 'right' : 'left'}">${esc(formatearCelda(col, v))}</${tag}>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
    @page { size: letter; margin: 12mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 10px; margin: 0; }
    table { width: 100%; border-collapse: collapse; }
    thead { display: table-header-group; } tfoot { display: table-row-group; } tr { page-break-inside: avoid; }
    .enc td { border: none; padding: 0; }
    .cab { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #4a2c2a; padding-bottom: 6px; margin-bottom: 6px; }
    .cab img { height: 48px; } .emp { font-size: 13px; font-weight: bold; } .tit { font-size: 12px; font-weight: bold; margin-top: 2px; }
    .meta { font-size: 9px; color: #444; margin-bottom: 6px; }
    th { background: #1e293b; color: #fff; padding: 4px; font-size: 9px; border: 1px solid #1e293b; }
    td { padding: 3px 4px; border: 1px solid #cbd5e1; } tr.tot td { font-weight: bold; background: #f1f5f9; }
  </style></head><body><table>
    <thead><tr class="enc"><td colspan="${n}"><div class="cab"><img src="${location.origin}${DATOS_EMPRESA.logo}" alt="">
      <div><div class="emp">${esc(EMPRESA)}</div><div>${esc(NIT)} · ${esc(DATOS_EMPRESA.direccion)}</div><div class="tit">${esc(titulo)}</div></div></div>
      <div class="meta">${filtrosTexto ? `${esc(filtrosTexto)}<br>` : ''}${esc(generado(usuario))}</div></td></tr>
    <tr>${columnas.map((c) => `<th style="text-align:${c.align === 'right' ? 'right' : 'left'}">${esc(c.label)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map((f) => `<tr>${columnas.map((c) => celda(c, f[c.key])).join('')}</tr>`).join('')
      || `<tr><td colspan="${n}" style="text-align:center">Sin registros para los filtros aplicados.</td></tr>`}
    ${totales ? `<tr class="tot">${columnas.map((c, i) => (totales[c.key] !== undefined ? celda(c, totales[c.key]) : `<td>${i === 0 ? 'TOTAL' : ''}</td>`)).join('')}</tr>` : ''}
    </tbody></table></body></html>`;
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const d = iframe.contentWindow.document;
  d.open(); d.write(html); d.close();
  const lanzar = () => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 60000); };
  const img = d.querySelector('img');
  if (img && !img.complete) { img.onload = lanzar; img.onerror = lanzar; } else setTimeout(lanzar, 50);
}
