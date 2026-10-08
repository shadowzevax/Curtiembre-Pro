import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileDown } from 'lucide-react';
import { fin } from '@/api/finanzas';
import { EMPRESA } from '@/lib/empresa';
import { numeroALetras } from '@/lib/numeroALetras';
import { formatCOP, formatFecha, mensajeError } from './utils';

export const TITULO_DOCUMENTO = {
  RC: 'RECIBO DE CAJA', CE: 'COMPROBANTE DE EGRESO', CIN: 'COMPROBANTE DE INGRESO', TR: 'COMPROBANTE DE TRANSFERENCIA',
  AJ: 'COMPROBANTE DE AJUSTE', CR: 'CRUCE DE ANTICIPO', DV: 'DEVOLUCIÓN', NC: 'NOTA CRÉDITO', ND: 'NOTA DÉBITO',
};
export const FORMA_PAGO_LABEL = {
  efectivo: 'Efectivo', banco: 'Banco', transferencia: 'Transferencia bancaria', consignacion: 'Consignación',
  nequi: 'Nequi', otro_medio: 'Otro medio de dinero',
};
const TIPO_CUENTA_LABEL = { caja: 'Caja', banco: 'Banco', otro_medio: 'Otro medio' };
const ES_INGRESO = ['RC', 'CIN'];
const ES_EGRESO = ['CE'];

// Estilos en línea con colores fijos: la misma vista se usa en pantalla, en la impresión y en el
// PDF (que es una captura de este mismo elemento), así los tres salen idénticos.
const S = {
  hoja: { width: 780, background: '#fff', color: '#1f2937', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, padding: 28, position: 'relative', boxSizing: 'border-box' },
  encabezado: { display: 'flex', alignItems: 'center', gap: 16, borderBottom: '2px solid #4a1c17', paddingBottom: 12 },
  empresa: { flex: 1, lineHeight: 1.45 },
  caja: { border: '2px solid #4a1c17', borderRadius: 6, padding: '8px 12px', textAlign: 'center', minWidth: 210 },
  fila: { display: 'flex', borderBottom: '1px solid #e5e7eb', padding: '6px 0' },
  etiqueta: { width: 190, color: '#6b7280', fontWeight: 600 },
  valor: { flex: 1 },
  bloque: { marginTop: 14 },
  tituloBloque: { fontWeight: 700, color: '#4a1c17', marginBottom: 4, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  tabla: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  celda: { border: '1px solid #d1d5db', padding: '6px 8px' },
  firma: { flex: 1, borderTop: '1px solid #374151', paddingTop: 4, textAlign: 'center', fontSize: 11, color: '#4b5563' },
  marca: { position: 'absolute', top: '42%', left: 0, right: 0, textAlign: 'center', fontSize: 96, fontWeight: 800, color: 'rgba(220,38,38,0.16)',
    transform: 'rotate(-24deg)', pointerEvents: 'none', letterSpacing: 8 },
};

function Fila({ etiqueta, children }) {
  if (children === null || children === undefined || children === '') return null;
  return <div style={S.fila}><div style={S.etiqueta}>{etiqueta}</div><div style={S.valor}>{children}</div></div>;
}

function Documento({ d }) {
  const ingreso = ES_INGRESO.includes(d.tipo);
  const egreso = ES_EGRESO.includes(d.tipo);
  const etiquetaTercero = ingreso ? 'Recibido de' : egreso ? 'Pagado a' : 'Tercero';
  const etiquetaValor = ingreso ? 'Valor recibido' : egreso ? 'Valor pagado' : 'Valor';
  const ident = d.tercero?.identificacion ? `${(d.tercero.tipo_identificacion || '').toUpperCase() === 'NIT' ? 'NIT' : 'C.C./NIT'} ${d.tercero.identificacion}` : null;
  const cuenta = d.cuenta ? `${TIPO_CUENTA_LABEL[d.cuenta.tipo] || ''}: ${d.cuenta.nombre}${d.cuenta.numero ? ` · ${d.cuenta.numero}` : ''}` : null;

  return (
    <div style={S.hoja}>
      {d.estado === 'anulado' && <div style={S.marca}>ANULADO</div>}

      <div style={S.encabezado}>
        <img src={EMPRESA.logo} alt="Logo" crossOrigin="anonymous" style={{ width: 92, height: 92, objectFit: 'contain' }} />
        <div style={S.empresa}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#4a1c17' }}>{EMPRESA.nombre}</div>
          <div>NIT: {EMPRESA.nit}</div>
          <div>{EMPRESA.direccion}</div>
          <div>Cel: {EMPRESA.telefono}{EMPRESA.email ? ` · ${EMPRESA.email}` : ''}</div>
        </div>
        <div style={S.caja}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#4a1c17' }}>{TITULO_DOCUMENTO[d.tipo] || 'DOCUMENTO'}</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>No. {d.numero}</div>
          <div style={{ marginTop: 4 }}>Fecha: {formatFecha(d.fecha)}</div>
        </div>
      </div>

      <div style={S.bloque}>
        <Fila etiqueta={etiquetaTercero}>{d.tercero?.nombre || d.tercero_nombre || '—'}</Fila>
        <Fila etiqueta="Identificación">{ident}</Fila>
        <Fila etiqueta="Dirección / teléfono">{[d.tercero?.direccion, d.tercero?.telefono].filter(Boolean).join(' · ') || null}</Fila>
        <Fila etiqueta={ingreso ? 'Factura relacionada' : 'Factura / documento relacionado'}>{d.factura_relacionada}</Fila>
        <Fila etiqueta="Concepto">{d.concepto}</Fila>
        <Fila etiqueta="Forma de pago">{FORMA_PAGO_LABEL[d.forma_pago] || d.forma_pago}</Fila>
        <Fila etiqueta={ingreso ? 'Ingresó a' : egreso ? 'Salió de' : 'Cuenta afectada'}>{cuenta}</Fila>
      </div>

      <div style={{ ...S.bloque, border: '2px solid #4a1c17', borderRadius: 6, padding: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700 }}>{etiquetaValor}</span>
          <span style={{ fontSize: 20, fontWeight: 800 }}>{formatCOP(d.valor)}</span>
        </div>
        <div style={{ marginTop: 4, fontStyle: 'italic' }}>Son: {numeroALetras(d.valor)}</div>
        {d.gmf > 0 && <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>Además se descontó GMF (4x1000) por {formatCOP(d.gmf)}.</div>}
        {d.retencion?.valor > 0 && <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>Retención {d.retencion.tipo}: {formatCOP(d.retencion.valor)}.</div>}
      </div>

      {d.saldo && (
        <div style={S.bloque}>
          <div style={S.tituloBloque}>Aplicación a la factura</div>
          <table style={S.tabla}>
            <thead><tr>
              {['Valor factura', 'Saldo anterior', ingreso ? 'Valor abonado' : 'Valor pagado', 'Saldo posterior'].map((h) => (
                <th key={h} style={{ ...S.celda, background: '#f3f4f6', textAlign: 'right' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody><tr>
              <td style={{ ...S.celda, textAlign: 'right' }}>{formatCOP(d.saldo.valor_factura)}</td>
              <td style={{ ...S.celda, textAlign: 'right' }}>{formatCOP(d.saldo.saldo_anterior)}</td>
              <td style={{ ...S.celda, textAlign: 'right' }}>{formatCOP(d.saldo.valor_aplicado)}</td>
              <td style={{ ...S.celda, textAlign: 'right', fontWeight: 700 }}>{formatCOP(d.saldo.saldo_posterior)}</td>
            </tr></tbody>
          </table>
        </div>
      )}

      {d.observaciones && (
        <div style={S.bloque}><div style={S.tituloBloque}>Observaciones</div><div>{d.observaciones}</div></div>
      )}

      {d.anulacion && (
        <div style={{ ...S.bloque, border: '1px solid #fca5a5', background: '#fef2f2', borderRadius: 6, padding: 8, color: '#991b1b' }}>
          <strong>Documento anulado</strong>
          {d.anulacion.fecha && <> el {formatFecha(d.anulacion.fecha)}</>}
          {d.anulacion.usuario && <> por {d.anulacion.usuario}</>}.
          {d.anulacion.motivo && <> Motivo: {d.anulacion.motivo}.</>} Los movimientos de dinero y cartera de este documento fueron reversados.
        </div>
      )}

      <div style={{ display: 'flex', gap: 40, marginTop: 56 }}>
        <div style={S.firma}>{ingreso ? 'Recibido por' : 'Elaborado por'}: {d.elaborado_por || ''}</div>
        <div style={S.firma}>{ingreso ? 'Firma del cliente' : 'Firma del beneficiario / Autorizado por'}</div>
      </div>
      <div style={{ marginTop: 18, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
        Documento generado por el sistema de gestión de {EMPRESA.nombre}
      </div>
    </div>
  );
}

async function capturar(elemento) {
  return html2canvas(elemento, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
}

// Vista formal de un documento financiero (Recibo de Caja, Comprobante de Egreso…) con
// Imprimir y Descargar PDF. Recibe el número (p. ej. "RC-2026-0001").
export default function DocumentoFinancieroDialog({ numero, onClose }) {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');
  const [trabajando, setTrabajando] = useState('');
  const hojaRef = useRef(null);

  useEffect(() => {
    if (!numero) { setD(null); return; }
    setD(null); setError('');
    fin.get(`/documentos/${encodeURIComponent(numero)}/imprimible`).then(setD).catch((e) => setError(mensajeError(e)));
  }, [numero]);

  const descargarPDF = async () => {
    setTrabajando('pdf');
    try {
      const canvas = await capturar(hojaRef.current);
      const pdf = new jsPDF({ unit: 'mm', format: 'letter' });
      const ancho = pdf.internal.pageSize.getWidth() - 20;
      const alto = (canvas.height * ancho) / canvas.width;
      const altoMax = pdf.internal.pageSize.getHeight() - 20;
      const escala = alto > altoMax ? altoMax / alto : 1;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, ancho * escala, alto * escala);
      pdf.save(`${numero}.pdf`);
    } catch (e) { setError(mensajeError(e)); } finally { setTrabajando(''); }
  };

  // Se imprime la misma imagen del documento desde un marco oculto: sale igual a la pantalla y
  // al PDF, sin el menú ni los botones de la página, y sin ventanas emergentes bloqueadas.
  const imprimir = async () => {
    setTrabajando('imprimir');
    try {
      const canvas = await capturar(hojaRef.current);
      const marco = document.createElement('iframe');
      marco.style.position = 'fixed'; marco.style.width = '0'; marco.style.height = '0'; marco.style.border = '0';
      document.body.appendChild(marco);
      const docMarco = marco.contentWindow.document;
      docMarco.open();
      docMarco.write(`<html><head><title>${numero}</title><style>@page{size:letter;margin:10mm}body{margin:0}img{width:100%}</style></head>
        <body><img src="${canvas.toDataURL('image/png')}"/></body></html>`);
      docMarco.close();
      setTimeout(() => {
        marco.contentWindow.focus();
        marco.contentWindow.print();
        setTimeout(() => marco.remove(), 1000);
      }, 300);
    } catch (e) { setError(mensajeError(e)); } finally { setTrabajando(''); }
  };

  return (
    <Dialog open={!!numero} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{d ? `${TITULO_DOCUMENTO[d.tipo] || 'Documento'} ${d.numero}` : numero}</DialogTitle></DialogHeader>
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        {!d && !error && <p className="text-sm text-slate-400">Cargando…</p>}
        {d && (
          <>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={imprimir} disabled={!!trabajando}><Printer className="w-4 h-4 mr-1" />{trabajando === 'imprimir' ? 'Preparando…' : 'Imprimir'}</Button>
              <Button size="sm" onClick={descargarPDF} disabled={!!trabajando}><FileDown className="w-4 h-4 mr-1" />{trabajando === 'pdf' ? 'Generando…' : 'Descargar PDF'}</Button>
            </div>
            <div className="overflow-x-auto border rounded bg-slate-100 p-3 flex justify-center">
              <div ref={hojaRef}><Documento d={d} /></div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
