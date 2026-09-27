import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Download, Trash2, Upload, FileText, Link2 } from 'lucide-react';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError } from './utils';

const TIPOS_SOPORTE = [
  { value: 'factura_proveedor', label: 'Factura del proveedor' },
  { value: 'cotizacion', label: 'Cotización' },
  { value: 'remision', label: 'Remisión' },
  { value: 'comprobante_transferencia', label: 'Comprobante de transferencia' },
  { value: 'documento_firmado', label: 'Documento firmado' },
  { value: 'foto', label: 'Foto del documento' },
  { value: 'pdf', label: 'PDF' },
  { value: 'otro', label: 'Otro' },
];

const ICONO_DOC = { FV: '📄', CH: '📄', CI: '📄', CC: '📄', REM: '📄', RC: '🧾', CE: '💸', CIN: '💰', TR: '↔️', AJ: '⚖️', NC: '➖', ND: '➕', CR: '🔗', DV: '↩️' };

// "Documentos y Soportes" (sección 4 del requerimiento): documentos generados por el ERP para
// esta venta/compra (trazabilidad automática) + archivos externos adjuntos (en Cloudflare R2).
// No es un módulo aparte: se abre desde la fila de Ventas o Compras.
export default function DocumentosSoportesModal({ open, onClose, modulo, documento }) {
  const [relacionados, setRelacionados] = useState(null);
  const [soportes, setSoportes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tipoNuevo, setTipoNuevo] = useState(TIPOS_SOPORTE[0].value);
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef(null);

  const cargar = useCallback(async () => {
    if (!open || !documento) return;
    setCargando(true); setError('');
    try {
      const [rel, sop] = await Promise.all([
        fin.get('/relacionados', { modulo, id: documento.id }),
        fin.get('/soportes', { modulo, id: documento.id }),
      ]);
      setRelacionados(rel); setSoportes(sop);
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, [open, modulo, documento]);

  useEffect(() => { cargar(); }, [cargar]);

  const subirArchivo = async (file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('El archivo supera 10 MB'); return; }
    setSubiendo(true); setError('');
    try {
      const { id, upload_url } = await fin.post('/soportes/subir', {
        documento_modulo: modulo, documento_id: documento.id, tipo_soporte: tipoNuevo, nombre: file.name, mime: file.type || 'application/octet-stream', tamano: file.size,
      });
      const put = await fetch(upload_url, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file });
      if (!put.ok) throw new Error('No se pudo subir el archivo al almacenamiento');
      await fin.post(`/soportes/${id}/confirmar`, {});
      await cargar();
    } catch (e) { setError(mensajeError(e)); } finally { setSubiendo(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const verSoporte = async (s, descargar) => {
    try {
      const { url } = await fin.get(`/soportes/${s.id}/url`, { descargar: descargar ? '1' : undefined });
      window.open(url, '_blank', 'noopener');
    } catch (e) { setError(mensajeError(e)); }
  };

  const eliminarSoporte = async (s) => {
    if (!window.confirm(`¿Eliminar "${s.nombre}"? Queda registrado en la bitácora.`)) return;
    try { await fin.del(`/soportes/${s.id}`); cargar(); } catch (e) { setError(mensajeError(e)); }
  };

  if (!documento) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>📎 Documentos y Soportes · {documento.numero_id || documento.numero_documento}</DialogTitle></DialogHeader>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : (
          <div className="space-y-5 text-sm">
            <div>
              <p className="font-semibold text-slate-700 mb-2 flex items-center gap-1"><FileText className="w-4 h-4" /> Documentos generados</p>
              {relacionados?.documentos?.length ? (
                <table className="w-full text-xs border rounded">
                  <tbody>
                    {relacionados.documentos.map((d) => (
                      <tr key={d.id} className={`border-t ${d.estado === 'anulado' ? 'opacity-50 line-through' : ''}`}>
                        <td className="p-1.5 w-8">{ICONO_DOC[d.tipo] || '📄'}</td>
                        <td className="p-1.5 font-mono">{d.numero}</td>
                        <td className="p-1.5">{formatFecha(d.fecha)}</td>
                        <td className="p-1.5">{d.concepto}</td>
                        <td className="p-1.5 text-right">{formatCOP(d.valor)}</td>
                        <td className="p-1.5 text-center">{d.estado === 'anulado' ? 'Anulado' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-xs text-slate-400">Sin documentos generados todavía (aparecerán cuando se registre un pago, cobro, nota o devolución).</p>}
            </div>

            {relacionados?.obligaciones?.length > 0 && (
              <div>
                <p className="font-semibold text-slate-700 mb-2 flex items-center gap-1"><Link2 className="w-4 h-4" /> Cuenta relacionada</p>
                <table className="w-full text-xs border rounded">
                  <tbody>
                    {relacionados.obligaciones.map((o) => (
                      <tr key={o.id} className="border-t">
                        <td className="p-1.5">{o.naturaleza === 'por_cobrar' ? 'Por cobrar' : 'Por pagar'}</td>
                        <td className="p-1.5 text-right">Total {formatCOP(o.valor_original)}</td>
                        <td className="p-1.5 text-right font-semibold">Saldo {formatCOP(o.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div>
              <p className="font-semibold text-slate-700 mb-2 flex items-center gap-1"><Upload className="w-4 h-4" /> Documentos adjuntos</p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <Select value={tipoNuevo} onValueChange={setTipoNuevo}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS_SOPORTE.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => subirArchivo(e.target.files?.[0])} accept="image/*,application/pdf,.xlsx,.xls,.docx,.doc,.csv,.txt" />
                <Button type="button" size="sm" variant="outline" disabled={subiendo} onClick={() => fileRef.current?.click()}>{subiendo ? 'Subiendo…' : 'Adjuntar archivo'}</Button>
              </div>
              {soportes.length ? (
                <table className="w-full text-xs border rounded">
                  <thead className="bg-slate-50"><tr className="text-left text-slate-500"><th className="p-1.5">Tipo</th><th className="p-1.5">Nombre</th><th className="p-1.5">Fecha</th><th className="p-1.5">Usuario</th><th className="p-1.5 text-right">Acciones</th></tr></thead>
                  <tbody>
                    {soportes.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="p-1.5">{TIPOS_SOPORTE.find((t) => t.value === s.tipo_soporte)?.label || s.tipo_soporte}</td>
                        <td className="p-1.5 truncate max-w-[10rem]" title={s.nombre}>{s.nombre}</td>
                        <td className="p-1.5">{formatFecha(s.created_date?.slice(0, 10))}</td>
                        <td className="p-1.5">{s.usuario}</td>
                        <td className="p-1.5">
                          <div className="flex justify-end gap-1">
                            <button title="Ver" onClick={() => verSoporte(s, false)}><Eye className="w-3.5 h-3.5 text-slate-600" /></button>
                            <button title="Descargar" onClick={() => verSoporte(s, true)}><Download className="w-3.5 h-3.5 text-slate-600" /></button>
                            <button title="Eliminar" onClick={() => eliminarSoporte(s)}><Trash2 className="w-3.5 h-3.5 text-red-500" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-xs text-slate-400">Sin archivos adjuntos todavía.</p>}
            </div>
          </div>
        )}
        <div className="flex justify-end pt-3 border-t"><Button variant="outline" onClick={onClose}>Cerrar</Button></div>
      </DialogContent>
    </Dialog>
  );
}
