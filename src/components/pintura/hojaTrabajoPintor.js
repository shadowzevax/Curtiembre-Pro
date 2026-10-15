import jsPDF from 'jspdf';

// Hoja de trabajo para el pintor (Planificación y Control de Producción de Pintura).
// Solo LEE la orden y sus solicitudes vinculadas: no crea órdenes, no cambia estados ni
// cantidades. La matriz se arma con los códigos del catálogo (placa_id / color_id), así dos
// referencias con códigos distintos nunca se suman juntas aunque tengan el mismo nombre, y
// los colores/placas nuevos del catálogo aparecen solos (nada está fijo en CAN/COBRA/PRADA).

export const EMPRESA_PINTURA = 'ArteCueros Mejía';
export const TITULO_HOJA = 'ORDEN DE PRODUCCIÓN DE PINTURA — HOJA DE TRABAJO';
const LOGO = '/artecueros-logo.png';

const fmt = (f) => {
  if (!f) return '—';
  // Fecha con hora (p. ej. created_date): se muestra el día en hora de Colombia.
  if (f instanceof Date || String(f).length > 10) {
    const d = new Date(f);
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const s = String(f).slice(0, 10);
  const [a, m, d] = s.split('-');
  return a && m && d ? `${d}/${m}/${a}` : s;
};

// Etiquetas únicas: si dos códigos distintos comparten nombre, se muestra "NOMBRE (CÓDIGO)".
function etiquetar(mapa) {
  const lista = [...mapa.values()];
  const repetidos = new Set(lista.map((x) => x.nombre).filter((n, i, arr) => arr.indexOf(n) !== i));
  return lista.map((x) => ({ ...x, label: repetidos.has(x.nombre) && x.codigo ? `${x.nombre} (${x.codigo})` : x.nombre }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'));
}

export function construirHojaTrabajo(orden, solicitudes) {
  const sols = (solicitudes || []).filter((s) => (orden.solicitudes_ids || []).includes(s.id));
  const bloquesMap = new Map();
  const detalle = [];
  const observaciones = [];

  sols.forEach((sol) => {
    (sol.items || []).forEach((it) => {
      // Mismo criterio de la matriz existente: las órdenes del flujo anterior (una sola
      // combinación) solo toman los ítems de su acabado y calibre.
      if (!orden.origen_multi_solicitud) {
        const tipoOk = (it.codigo_tipo_acabado || it.tipo_cuero_nombre) === (orden.codigo_tipo_acabado || orden.tipo_cuero_nombre);
        if (!tipoOk || (it.calibre || '') !== (orden.calibre || '')) return;
      }
      const cant = Number(it.cantidad_hojas) || 0;
      const kAcab = `${it.tipo_cuero_id || it.codigo_tipo_acabado || it.tipo_cuero_nombre || 'SIN'}|${it.calibre || ''}`;
      if (!bloquesMap.has(kAcab)) {
        bloquesMap.set(kAcab, { key: kAcab, acabado: it.tipo_cuero_nombre || 'SIN ACABADO', codigoAcabado: it.codigo_tipo_acabado || '',
          calibre: it.calibre || orden.calibre || '', colores: new Map(), placas: new Map(), celdas: {} });
      }
      const b = bloquesMap.get(kAcab);
      const kColor = it.color_id || it.codigo_color || it.nombre_color || 'SIN COLOR';
      const kPlaca = it.placa_id || it.codigo_placa || it.placa_nombre || 'SIN PLACA';
      if (!b.colores.has(kColor)) b.colores.set(kColor, { key: kColor, nombre: it.nombre_color || it.codigo_color || 'SIN COLOR', codigo: it.codigo_color || '' });
      if (!b.placas.has(kPlaca)) b.placas.set(kPlaca, { key: kPlaca, nombre: it.placa_nombre || it.codigo_placa || 'SIN PLACA', codigo: it.codigo_placa || '' });
      b.celdas[kColor] = b.celdas[kColor] || {};
      b.celdas[kColor][kPlaca] = (b.celdas[kColor][kPlaca] || 0) + cant;
      detalle.push({ solicitud: sol.numero_solicitud, cliente: sol.cliente_nombre, compromiso: sol.fecha_compromiso,
        acabado: it.tipo_cuero_nombre || '', calibre: it.calibre || '', color: it.nombre_color || '', codigo_color: it.codigo_color || '',
        placa: it.placa_nombre || '', codigo_placa: it.codigo_placa || '', hojas: cant, observaciones: it.observaciones || '' });
      if (it.observaciones) observaciones.push(`${sol.numero_solicitud} — ${sol.cliente_nombre} (${it.nombre_color || ''} / ${it.placa_nombre || ''}): ${it.observaciones}`);
    });
    if (sol.observaciones) observaciones.push(`${sol.numero_solicitud} — ${sol.cliente_nombre}: ${sol.observaciones}`);
  });

  const bloques = [...bloquesMap.values()].map((b) => {
    const colores = etiquetar(b.colores);
    const placas = etiquetar(b.placas);
    const totColor = {}; const totPlaca = {};
    colores.forEach((c) => { totColor[c.key] = placas.reduce((s, p) => s + (b.celdas[c.key]?.[p.key] || 0), 0); });
    placas.forEach((p) => { totPlaca[p.key] = colores.reduce((s, c) => s + (b.celdas[c.key]?.[p.key] || 0), 0); });
    return { ...b, colores, placas, totColor, totPlaca, total: colores.reduce((s, c) => s + totColor[c.key], 0) };
  }).sort((a, b) => a.acabado.localeCompare(b.acabado, 'es'));

  const totalMatriz = bloques.reduce((s, b) => s + b.total, 0);
  const totalOrden = Number(orden.cantidad_total_hojas) || 0;
  const compromisos = sols.map((s) => s.fecha_compromiso).filter(Boolean).sort();
  const resumenSol = sols.map((s) => ({ numero: s.numero_solicitud, cliente: s.cliente_nombre, compromiso: s.fecha_compromiso,
    hojas: detalle.filter((d) => d.solicitud === s.numero_solicitud).reduce((x, d) => x + d.hojas, 0) }));
  return {
    bloques, detalle, observaciones, solicitudes: resumenSol,
    totalMatriz, totalOrden, cuadra: totalMatriz === totalOrden && sols.length > 0,
    diferencia: totalMatriz - totalOrden,
    encabezado: [
      ['N.º Orden', orden.numero_orden || '—'],
      ['Fecha de elaboración', fmt(orden.created_date)],
      ['Fecha programada de producción', fmt(orden.fecha)],
      ['Fecha de compromiso / entrega', compromisos.length ? fmt(compromisos[0]) + (compromisos.length > 1 && compromisos[0] !== compromisos[compromisos.length - 1] ? ` (hasta ${fmt(compromisos[compromisos.length - 1])})` : '') : '—'],
      ['Pintor responsable', orden.pintor_nombre || '—'],
      ['Calibre', [...new Set(bloques.map((b) => b.calibre).filter(Boolean))].join(', ') || orden.calibre || '—'],
      ['Tipo de acabado', [...new Set(bloques.map((b) => b.acabado))].join(', ') || orden.tipo_cuero_nombre || '—'],
      ['Solicitudes consolidadas', `${sols.length} (${sols.map((s) => s.numero_solicitud).join(', ') || '—'})`],
      ['Clientes', [...new Set(sols.map((s) => s.cliente_nombre).filter(Boolean))].join(', ') || '—'],
      ['Total general de hojas', String(totalMatriz)],
    ],
  };
}

export const avisoDiferencia = (h) => (h.cuadra ? null
  : `NO VALIDADA: la matriz suma ${h.totalMatriz} hojas y la orden registra ${h.totalOrden} (diferencia ${h.diferencia > 0 ? '+' : ''}${h.diferencia}).`);

async function logoDataUrl() {
  try {
    const blob = await (await fetch(LOGO)).blob();
    return await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(null); r.readAsDataURL(blob); });
  } catch { return null; }
}

// ── Excel real (.xlsx) con formato: hoja de trabajo + detalle de solicitudes ────────────
export async function exportarHojaExcel(orden, h) {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = EMPRESA_PINTURA;
  const ws = wb.addWorksheet('Hoja de trabajo', { pageSetup: { paperSize: 1, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  const borde = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
  const oscuro = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4A2C2A' } };
  const claro = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  const maxPlacas = Math.max(1, ...h.bloques.map((b) => b.placas.length));
  const ncols = maxPlacas + 2;
  ws.columns = [{ width: 24 }, ...Array.from({ length: maxPlacas }, () => ({ width: 14 })), { width: 14 }];

  const logo = await logoDataUrl();
  if (logo) {
    const id = wb.addImage({ base64: logo, extension: 'png' });
    ws.addImage(id, { tl: { col: 0, row: 0 }, ext: { width: 70, height: 70 } });
  }
  ws.mergeCells(1, 2, 1, ncols); ws.getCell(1, 2).value = EMPRESA_PINTURA;
  ws.getCell(1, 2).font = { bold: true, size: 16 };
  ws.mergeCells(2, 2, 2, ncols); ws.getCell(2, 2).value = TITULO_HOJA;
  ws.getCell(2, 2).font = { bold: true, size: 13, color: { argb: 'FF4A2C2A' } };
  ws.getRow(1).height = 26; ws.getRow(2).height = 22; ws.getRow(3).height = 12;
  let r = 5;
  const aviso = avisoDiferencia(h);
  if (aviso) {
    ws.mergeCells(r, 1, r, ncols); const c = ws.getCell(r, 1); c.value = `⚠ ${aviso}`;
    c.font = { bold: true, color: { argb: 'FFB91C1C' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; r += 2;
  }
  h.encabezado.forEach(([k, v]) => {
    ws.getCell(r, 1).value = k; ws.getCell(r, 1).font = { bold: true };
    ws.mergeCells(r, 2, r, ncols); ws.getCell(r, 2).value = v; r += 1;
  });
  r += 1;
  h.bloques.forEach((b) => {
    ws.mergeCells(r, 1, r, ncols);
    const t = ws.getCell(r, 1);
    t.value = `Tipo de acabado: ${b.acabado}${b.codigoAcabado ? ` (${b.codigoAcabado})` : ''} · Calibre: ${b.calibre || '—'}`;
    t.font = { bold: true, size: 12 }; r += 1;
    const enc = ['COLOR', ...b.placas.map((p) => p.label), 'TOTAL COLOR'];
    enc.forEach((v, i) => {
      const c = ws.getCell(r, i + 1); c.value = v; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = oscuro; c.border = borde;
      c.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    });
    r += 1;
    b.colores.forEach((col) => {
      const vals = [col.label, ...b.placas.map((p) => b.celdas[col.key]?.[p.key] || 0), b.totColor[col.key]];
      vals.forEach((v, i) => {
        const c = ws.getCell(r, i + 1); c.value = v; c.border = borde; c.alignment = { horizontal: i === 0 ? 'left' : 'center' };
        if (i === 0 || i === vals.length - 1) c.font = { bold: true };
        if (i === vals.length - 1) c.fill = claro;
      });
      r += 1;
    });
    const tot = ['TOTAL PLACA', ...b.placas.map((p) => b.totPlaca[p.key]), b.total];
    tot.forEach((v, i) => { const c = ws.getCell(r, i + 1); c.value = v; c.font = { bold: true }; c.fill = claro; c.border = borde; c.alignment = { horizontal: i === 0 ? 'left' : 'center' }; });
    r += 2;
  });
  ws.getCell(r, 1).value = 'TOTAL GENERAL DE HOJAS'; ws.getCell(r, 1).font = { bold: true, size: 12 };
  ws.getCell(r, 2).value = h.totalMatriz; ws.getCell(r, 2).font = { bold: true, size: 12 }; ws.getCell(r, 2).border = borde;
  r += 2;
  if (h.observaciones.length) {
    ws.getCell(r, 1).value = 'Observaciones de las solicitudes'; ws.getCell(r, 1).font = { bold: true }; r += 1;
    h.observaciones.forEach((o) => { ws.mergeCells(r, 1, r, ncols); ws.getCell(r, 1).value = o; r += 1; });
    r += 1;
  }
  [['Observaciones del pintor:', ''], ['', ''], ['', ''], ['Firma del responsable:', ''], ['Fecha de ejecución:', '']].forEach(([k]) => {
    ws.getCell(r, 1).value = k; ws.getCell(r, 1).font = { bold: true };
    ws.mergeCells(r, 2, r, ncols); ws.getCell(r, 2).border = { bottom: { style: 'thin' } }; r += 1;
  });

  const wd = wb.addWorksheet('Detalle solicitudes');
  wd.columns = [
    { header: 'Solicitud', key: 'solicitud', width: 16 }, { header: 'Cliente', key: 'cliente', width: 26 },
    { header: 'Fecha compromiso', key: 'compromiso', width: 16 }, { header: 'Tipo de acabado', key: 'acabado', width: 16 },
    { header: 'Calibre', key: 'calibre', width: 9 }, { header: 'Cód. color', key: 'codigo_color', width: 11 }, { header: 'Color', key: 'color', width: 16 },
    { header: 'Cód. placa', key: 'codigo_placa', width: 11 }, { header: 'Placa', key: 'placa', width: 16 }, { header: 'Hojas', key: 'hojas', width: 9 },
    { header: 'Observaciones', key: 'observaciones', width: 36 },
  ];
  h.detalle.forEach((d) => wd.addRow({ ...d, compromiso: fmt(d.compromiso) }));
  const totalRow = wd.addRow({ solicitud: 'TOTAL', hojas: h.detalle.reduce((s, d) => s + d.hojas, 0) });
  wd.getRow(1).eachCell((c) => { c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = oscuro; });
  totalRow.font = { bold: true };
  wd.eachRow((row) => row.eachCell({ includeEmpty: true }, (c) => { c.border = borde; }));

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a'); a.href = url; a.download = `hoja_trabajo_${orden.numero_orden}.xlsx`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ── PDF real, carta horizontal ───────────────────────────────────────────────────────────
export async function exportarHojaPDF(orden, h) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'landscape' });
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const mx = 12; let y = 12;
  const logo = await logoDataUrl();
  const cabecera = () => {
    if (logo) doc.addImage(logo, 'PNG', mx, y, 20, 20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.text(EMPRESA_PINTURA, mx + 24, y + 7);
    doc.setFontSize(12); doc.setTextColor(74, 44, 42); doc.text(TITULO_HOJA, mx + 24, y + 14); doc.setTextColor(0, 0, 0);
    doc.setFontSize(10); doc.text(`Orden ${orden.numero_orden}`, W - mx, y + 7, { align: 'right' });
    y += 24; doc.setDrawColor(74, 44, 42); doc.setLineWidth(0.6); doc.line(mx, y, W - mx, y); doc.setLineWidth(0.2); doc.setDrawColor(0); y += 5;
  };
  const salto = (alto) => { if (y + alto > H - 12) { doc.addPage(); y = 12; cabecera(); } };
  cabecera();
  const aviso = avisoDiferencia(h);
  if (aviso) { doc.setFillColor(254, 226, 226); doc.rect(mx, y - 4, W - 2 * mx, 7, 'F'); doc.setTextColor(185, 28, 28); doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(`! ${aviso}`, mx + 2, y + 1); doc.setTextColor(0); y += 8; }
  // Encabezado en dos columnas.
  doc.setFontSize(9.5);
  const mitad = Math.ceil(h.encabezado.length / 2);
  h.encabezado.forEach(([k, v], i) => {
    const col = i < mitad ? 0 : 1; const fila = i < mitad ? i : i - mitad;
    const x = mx + col * ((W - 2 * mx) / 2); const yy = y + fila * 5.5;
    doc.setFont('helvetica', 'bold'); doc.text(`${k}:`, x, yy);
    doc.setFont('helvetica', 'normal'); doc.text(doc.splitTextToSize(String(v), (W - 2 * mx) / 2 - 58)[0], x + 56, yy);
  });
  y += mitad * 5.5 + 4;

  h.bloques.forEach((b) => {
    const cols = b.placas.length + 2;
    const anchoTotal = W - 2 * mx;
    const anchoColor = Math.min(50, anchoTotal * 0.22);
    const anchoCelda = (anchoTotal - anchoColor) / (cols - 1);
    const fs = cols > 14 ? 7 : cols > 10 ? 8 : 10;
    const alto = 7;
    salto(alto * (b.colores.length + 3) + 6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(`Tipo de acabado: ${b.acabado}${b.codigoAcabado ? ` (${b.codigoAcabado})` : ''}   ·   Calibre: ${b.calibre || '—'}`, mx, y); y += 3;
    const xCol = (i) => (i === 0 ? mx : mx + anchoColor + (i - 1) * anchoCelda);
    const anchoDe = (i) => (i === 0 ? anchoColor : anchoCelda);
    const fila = (vals, { fondo, blanco, negrita } = {}) => {
      vals.forEach((v, i) => {
        if (fondo) { doc.setFillColor(...fondo); doc.rect(xCol(i), y, anchoDe(i), alto, 'FD'); } else doc.rect(xCol(i), y, anchoDe(i), alto);
        doc.setTextColor(...(blanco ? [255, 255, 255] : [0, 0, 0]));
        doc.setFont('helvetica', negrita || i === 0 || i === vals.length - 1 ? 'bold' : 'normal'); doc.setFontSize(fs);
        const txt = doc.splitTextToSize(String(v), anchoDe(i) - 2)[0];
        if (i === 0) doc.text(txt, xCol(i) + 1.5, y + 4.8); else doc.text(txt, xCol(i) + anchoDe(i) / 2, y + 4.8, { align: 'center' });
      });
      doc.setTextColor(0); y += alto;
    };
    fila(['COLOR', ...b.placas.map((p) => p.label), 'TOTAL'], { fondo: [74, 44, 42], blanco: true, negrita: true });
    b.colores.forEach((c) => fila([c.label, ...b.placas.map((p) => b.celdas[c.key]?.[p.key] || 0), b.totColor[c.key]]));
    fila(['TOTAL PLACA', ...b.placas.map((p) => b.totPlaca[p.key]), b.total], { fondo: [241, 245, 249], negrita: true });
    y += 6;
  });
  salto(8);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(`TOTAL GENERAL DE HOJAS: ${h.totalMatriz}`, mx, y); y += 7;
  if (h.observaciones.length) {
    salto(6 + h.observaciones.length * 4.5);
    doc.setFontSize(9.5); doc.text('Observaciones de las solicitudes:', mx, y); y += 4.5; doc.setFont('helvetica', 'normal');
    h.observaciones.forEach((o) => { doc.splitTextToSize(o, W - 2 * mx).forEach((l) => { salto(4.5); doc.text(l, mx, y); y += 4.5; }); });
    y += 2;
  }
  salto(40);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
  doc.text('Observaciones del pintor:', mx, y + 4);
  [10, 17, 24].forEach((d) => doc.line(mx, y + d, W - mx, y + d));
  y += 34;
  doc.text('Firma del responsable:', mx, y); doc.line(mx + 42, y, mx + 130, y);
  doc.text('Fecha de ejecución:', mx + 145, y); doc.line(mx + 180, y, W - mx, y);
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i += 1) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.text(`${EMPRESA_PINTURA} · ${orden.numero_orden} · Generado ${new Date().toLocaleString('es-CO')} · Página ${i} de ${n}`, W - mx, H - 6, { align: 'right' });
  }
  doc.save(`hoja_trabajo_${orden.numero_orden}.pdf`);
}

// ── Impresión: abre la vista previa del navegador (no imprime sola) ──────────────────────
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function imprimirHojaTrabajo(orden, h) {
  const aviso = avisoDiferencia(h);
  const tabla = (b) => `
    <h3>Tipo de acabado: ${esc(b.acabado)}${b.codigoAcabado ? ` (${esc(b.codigoAcabado)})` : ''} · Calibre: ${esc(b.calibre || '—')}</h3>
    <table class="m"><thead><tr><th class="l">COLOR</th>${b.placas.map((p) => `<th>${esc(p.label)}</th>`).join('')}<th>TOTAL COLOR</th></tr></thead>
    <tbody>${b.colores.map((c) => `<tr><td class="l b">${esc(c.label)}</td>${b.placas.map((p) => `<td>${b.celdas[c.key]?.[p.key] || 0}</td>`).join('')}<td class="b t">${b.totColor[c.key]}</td></tr>`).join('')}
    <tr class="t b"><td class="l">TOTAL PLACA</td>${b.placas.map((p) => `<td>${b.totPlaca[p.key]}</td>`).join('')}<td>${b.total}</td></tr></tbody></table>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Hoja de trabajo ${esc(orden.numero_orden)}</title><style>
    @page { size: letter landscape; margin: 11mm; }
    body { font-family: Arial, Helvetica, sans-serif; color: #111; font-size: 12px; margin: 0; }
    .cab { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #4a2c2a; padding-bottom: 8px; margin-bottom: 8px; }
    .cab img { height: 64px; } .emp { font-size: 20px; font-weight: bold; } .tit { font-size: 15px; font-weight: bold; color: #4a2c2a; }
    .no { margin-left: auto; font-size: 15px; font-weight: bold; border: 2px solid #4a2c2a; padding: 6px 10px; border-radius: 6px; }
    .enc { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 24px; margin-bottom: 10px; font-size: 12px; }
    .enc b { display: inline-block; min-width: 205px; }
    .aviso { background: #fee2e2; color: #b91c1c; font-weight: bold; padding: 6px 8px; border: 1px solid #b91c1c; margin-bottom: 8px; }
    h3 { font-size: 14px; margin: 12px 0 4px; }
    table.m { width: 100%; border-collapse: collapse; page-break-inside: avoid; }
    table.m th { background: #4a2c2a; color: #fff; padding: 7px 5px; border: 1px solid #333; font-size: 13px; }
    table.m td { border: 1px solid #333; padding: 7px 5px; text-align: center; font-size: 14px; }
    .l { text-align: left !important; } .b { font-weight: bold; } .t { background: #f1f5f9; }
    .total { font-size: 16px; font-weight: bold; margin: 12px 0; }
    .obs li { font-size: 11px; } .pie { margin-top: 16px; page-break-inside: avoid; }
    .linea { border-bottom: 1px solid #333; height: 22px; } .firmas { display: flex; gap: 40px; margin-top: 26px; }
    .firmas div { flex: 1; border-top: 1px solid #333; padding-top: 4px; font-weight: bold; }
  </style></head><body>
    <div class="cab"><img src="${location.origin}${LOGO}" alt=""><div><div class="emp">${EMPRESA_PINTURA}</div><div class="tit">${TITULO_HOJA}</div></div>
      <div class="no">${esc(orden.numero_orden)}</div></div>
    ${aviso ? `<div class="aviso">⚠ ${esc(aviso)}</div>` : ''}
    <div class="enc">${h.encabezado.map(([k, v]) => `<div><b>${esc(k)}:</b> ${esc(v)}</div>`).join('')}</div>
    ${h.bloques.map(tabla).join('')}
    <div class="total">TOTAL GENERAL DE HOJAS: ${h.totalMatriz}</div>
    ${h.observaciones.length ? `<div class="obs"><b>Observaciones de las solicitudes:</b><ul>${h.observaciones.map((o) => `<li>${esc(o)}</li>`).join('')}</ul></div>` : ''}
    <div class="pie"><b>Observaciones del pintor:</b><div class="linea"></div><div class="linea"></div><div class="linea"></div>
      <div class="firmas"><div>Firma del responsable</div><div>Fecha de ejecución</div></div></div>
  </body></html>`;
  const iframe = document.createElement('iframe');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const d = iframe.contentWindow.document;
  d.open(); d.write(html); d.close();
  const lanzar = () => { iframe.contentWindow.focus(); iframe.contentWindow.print(); setTimeout(() => iframe.remove(), 60000); };
  const img = d.querySelector('img');
  if (img && !img.complete) { img.onload = lanzar; img.onerror = lanzar; } else setTimeout(lanzar, 50);
}
