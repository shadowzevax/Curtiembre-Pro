// Mismo criterio que el servidor (api/_lib/fin/comerciales.js → numeroVisibleVenta):
// el número visible de una venta es el No. de Documento digitado (p. ej. "FV530"); si no se
// digitó, el consecutivo interno automático VP/VS-AAAA-NNNN.
export function numeroVisibleVenta(d) {
  const nd = String(d?.numero_documento || '').trim();
  const pd = String(d?.prefijo_documento || '').trim();
  if (!nd) return d?.numero_id || '—';
  if (!pd || nd.toUpperCase().startsWith(pd.toUpperCase())) return nd;
  return `${pd}-${nd}`;
}
