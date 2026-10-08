import React, { useEffect, useState, useCallback, useRef } from 'react';
import PageHeader from '../common/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Printer, Ban, Search } from 'lucide-react';
import { fin, nuevaLlave, anularOperacionFinanciera } from '@/api/finanzas';
import { Tercero } from '@/entities/all';
import { useAuth } from '@/lib/AuthContext';
import DocumentoFinancieroDialog, { FORMA_PAGO_LABEL } from './DocumentoFinancieroDialog';
import { formatCOP, formatFecha, mensajeError, hoy, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO, FORMAS_PAGO } from './utils';

const ETIQUETA_CUENTA = { caja: 'Caja', banco: 'Cuenta bancaria', otro_medio: 'Medio de dinero' };

const CONFIG = {
  RC: {
    titulo: 'Recibos de Caja', descripcion: 'Todo el dinero que recibe la empresa, con su soporte formal imprimible.',
    nuevo: 'Nuevo Recibo de Caja', naturaleza: 'por_cobrar', operacionFactura: 'cobro', operacionOtro: 'ingreso',
    modoFactura: 'Pago de un cliente (factura / cuenta por cobrar)', modoOtro: 'Otro ingreso (no viene de una factura)',
    tercero: 'Cliente', categorias: CATEGORIAS_INGRESO, etiquetaConcepto: 'Concepto / origen del ingreso *',
    tipos: { todos: 'RC,CIN', propios: 'RC', otros: 'CIN' },
    filtroTipos: [{ value: 'todos', label: 'Todos los ingresos' }, { value: 'propios', label: 'Solo Recibos de Caja (RC)' },
      { value: 'otros', label: 'Ingresos registrados desde Caja/Tesorería (CIN)' }],
  },
  CE: {
    titulo: 'Comprobantes de Egreso', descripcion: 'Todo el dinero que sale de la empresa, con su soporte formal imprimible.',
    nuevo: 'Nuevo Comprobante de Egreso', naturaleza: 'por_pagar', operacionFactura: 'pago', operacionOtro: 'egreso',
    modoFactura: 'Pago a un proveedor (factura / cuenta por pagar)', modoOtro: 'Otro egreso (servicios, gastos, transporte…)',
    tercero: 'Proveedor / beneficiario', categorias: CATEGORIAS_EGRESO, etiquetaConcepto: 'Concepto / motivo del egreso *',
    tipos: { todos: 'CE' }, filtroTipos: null,
  },
};

// Submódulos "Recibos de Caja" y "Comprobantes de Egreso" (Finanzas y Tesorería). No crean
// movimientos propios: registran el pago con la misma operación del motor que ya usan Cuentas por
// Cobrar/Pagar y Caja (cobro, pago, ingreso, egreso), que genera el documento, el movimiento de
// dinero, la aplicación a la cartera y el registro contable, todo enlazado.
export default function DocumentosFinancierosModulo({ tipo }) {
  const cfg = CONFIG[tipo];
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin';
  const [docs, setDocs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [desde, setDesde] = useState(hoy().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy());
  const [estado, setEstado] = useState('__todos');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [documentoAbierto, setDocumentoAbierto] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      setDocs(await fin.get('/documentos-financieros', { tipos: cfg.tipos[filtroTipo], desde, hasta,
        estado: estado === '__todos' ? undefined : estado }));
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, [cfg, filtroTipo, desde, hasta, estado]);
  useEffect(() => { cargar(); }, [cargar]);

  const anular = async (d) => {
    if (await anularOperacionFinanciera(d.operacion_id, `el documento ${d.numero}`)) cargar();
  };

  const texto = busqueda.trim().toLowerCase();
  const filtrados = texto ? docs.filter((d) => [d.numero, d.tercero_nombre, d.concepto, d.factura_relacionada]
    .some((v) => (v || '').toLowerCase().includes(texto))) : docs;
  const total = filtrados.filter((d) => d.estado !== 'anulado').reduce((s, d) => s + d.valor, 0);

  return (
    <div className="p-6 space-y-4">
      <PageHeader title={cfg.titulo} description={cfg.descripcion}
        actionButton={<Button onClick={() => setNuevoAbierto(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" />{cfg.nuevo}</Button>} />

      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
          <div><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
          <div><Label>Estado</Label>
            <Select value={estado} onValueChange={setEstado}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos</SelectItem><SelectItem value="emitido">Emitidos</SelectItem><SelectItem value="anulado">Anulados</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {cfg.filtroTipos && (
            <div><Label>Tipo</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                <SelectContent>{cfg.filtroTipos.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="flex-1 min-w-[200px]"><Label>Buscar</Label>
            <div className="relative"><Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
              <Input className="pl-8" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Número, tercero, concepto o factura" /></div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</p>}

      <Card>
        <CardContent className="pt-4 overflow-x-auto">
          {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-slate-500 border-b">
                <th className="p-2">Número</th><th className="p-2">Fecha</th><th className="p-2">{cfg.tercero}</th><th className="p-2">Concepto</th>
                <th className="p-2">Factura</th><th className="p-2">Forma de pago</th><th className="p-2">Cuenta</th>
                <th className="p-2 text-right">Valor</th><th className="p-2">Estado</th><th className="p-2"></th>
              </tr></thead>
              <tbody>
                {filtrados.map((d) => (
                  <tr key={d.id} className={`border-b last:border-0 ${d.estado === 'anulado' ? 'text-slate-400' : ''}`}>
                    <td className="p-2 font-mono">{d.numero}</td>
                    <td className="p-2">{formatFecha(d.fecha)}</td>
                    <td className="p-2">{d.tercero_nombre || '—'}</td>
                    <td className="p-2 max-w-[16rem] truncate" title={d.concepto}>{d.concepto}</td>
                    <td className="p-2 font-mono text-xs">{d.factura_relacionada || '—'}</td>
                    <td className="p-2">{FORMA_PAGO_LABEL[d.forma_pago] || d.forma_pago || '—'}</td>
                    <td className="p-2">{d.cuenta_nombre || '—'}</td>
                    <td className="p-2 text-right font-semibold">{formatCOP(d.valor)}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full ${d.estado === 'anulado' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{d.estado === 'anulado' ? 'ANULADO' : 'EMITIDO'}</span></td>
                    <td className="p-2">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setDocumentoAbierto(d.numero)}><Printer className="w-3.5 h-3.5 mr-1" />Ver / Imprimir</Button>
                        {esAdmin && d.estado !== 'anulado' && (
                          <Button size="sm" variant="ghost" className="h-7 px-2" title="Anular" onClick={() => anular(d)}><Ban className="w-3.5 h-3.5 text-red-500" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filtrados.length === 0 && <tr><td colSpan={10} className="p-6 text-center text-slate-400">No hay documentos en este período.</td></tr>}
              </tbody>
              {filtrados.length > 0 && (
                <tfoot><tr className="border-t font-semibold bg-slate-50"><td className="p-2" colSpan={7}>TOTAL (sin anulados)</td><td className="p-2 text-right">{formatCOP(total)}</td><td colSpan={2}></td></tr></tfoot>
              )}
            </table>
          )}
        </CardContent>
      </Card>

      <NuevoDocumentoDialog open={nuevoAbierto} onClose={() => setNuevoAbierto(false)} cfg={cfg} tipo={tipo}
        onGuardado={(numero) => { setNuevoAbierto(false); cargar(); if (numero) setDocumentoAbierto(numero); }} />
      <DocumentoFinancieroDialog numero={documentoAbierto} onClose={() => setDocumentoAbierto(null)} />
    </div>
  );
}

function NuevoDocumentoDialog({ open, onClose, cfg, tipo, onGuardado }) {
  const [modo, setModo] = useState('factura');
  const [obligaciones, setObligaciones] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [terceros, setTerceros] = useState([]);
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const llave = useRef(nuevaLlave());

  useEffect(() => {
    if (!open) return;
    llave.current = nuevaLlave();
    setModo('factura'); setError('');
    setForm({ obligacion_id: '', forma_pago: 'efectivo', cuenta_id: '', valor: '', fecha: hoy(), concepto: '', categoria: cfg.categorias[0].value,
      tercero_id: '__ninguno', observaciones: '' });
    Promise.all([fin.get('/obligaciones', { naturaleza: cfg.naturaleza }), fin.get('/cuentas'), Tercero.list()])
      .then(([obl, ctas, ters]) => {
        setObligaciones(obl.filter((o) => !['pagada', 'anulada'].includes(o.estado)));
        setCuentas(ctas);
        setTerceros(ters.filter((t) => t.es_cliente || t.es_proveedor));
      }).catch((e) => setError(mensajeError(e)));
  }, [open, cfg, tipo]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const forma = FORMAS_PAGO.find((f) => f.value === form.forma_pago) || FORMAS_PAGO[0];
  const cuentasForma = cuentas.filter((c) => c.tipo === forma.tipoCuenta);
  const obligacion = obligaciones.find((o) => o.id === form.obligacion_id);

  const elegirObligacion = (id) => {
    const o = obligaciones.find((x) => x.id === id);
    setForm((p) => ({ ...p, obligacion_id: id, valor: o ? String(o.saldo) : '' }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    if (modo === 'factura' && !form.obligacion_id) { setError(`Seleccione la factura / cuenta del ${cfg.tercero.toLowerCase()}`); return; }
    if (!form.cuenta_id) { setError(`Seleccione la ${ETIQUETA_CUENTA[forma.tipoCuenta].toLowerCase()} donde ${tipo === 'RC' ? 'entra' : 'sale'} el dinero`); return; }
    if (!(Number(form.valor) > 0)) { setError('El valor debe ser mayor a cero'); return; }
    if (modo === 'factura' && obligacion && Number(form.valor) > obligacion.saldo) { setError(`El valor no puede superar el saldo pendiente (${formatCOP(obligacion.saldo)})`); return; }
    if (modo === 'otro' && !form.concepto.trim()) { setError('El concepto es obligatorio'); return; }
    setGuardando(true); setError('');
    try {
      const comun = { cuenta_id: form.cuenta_id, valor: Number(form.valor), fecha: form.fecha, medio_pago: form.forma_pago,
        observaciones: form.observaciones || undefined, idempotency_key: llave.current };
      let r;
      if (modo === 'factura') {
        r = await fin.post(`/operaciones/${cfg.operacionFactura}`, { ...comun, obligacion_id: form.obligacion_id,
          concepto: form.concepto.trim() || undefined });
      } else {
        const t = terceros.find((x) => x.id === form.tercero_id);
        r = await fin.post(`/operaciones/${cfg.operacionOtro}`, { ...comun, concepto: form.concepto.trim(), categoria: form.categoria,
          tercero_id: t?.id, tercero_nombre: t?.nombre, ...(tipo === 'RC' ? { tipo_documento: 'RC' } : {}) });
      }
      onGuardado(r?.documento?.numero);
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{cfg.nuevo}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            {[['factura', cfg.modoFactura], ['otro', cfg.modoOtro]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => { setModo(v); setError(''); }}
                className={`text-left border rounded-lg p-2 text-xs ${modo === v ? 'border-emerald-500 bg-emerald-50 font-semibold' : 'border-slate-200'}`}>{l}</button>
            ))}
          </div>

          {modo === 'factura' ? (
            <div>
              <Label>Factura / cuenta pendiente *</Label>
              <Select value={form.obligacion_id ?? ''} onValueChange={elegirObligacion}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {obligaciones.map((o) => <SelectItem key={o.id} value={o.id}>{o.documento_numero} · {o.tercero_nombre} · saldo {formatCOP(o.saldo)}</SelectItem>)}
                  {obligaciones.length === 0 && <SelectItem value="__sin__" disabled>No hay cuentas pendientes</SelectItem>}
                </SelectContent>
              </Select>
              {obligacion && <p className="text-xs text-slate-500 mt-1">Total {formatCOP(obligacion.valor_original)} · saldo pendiente <strong>{formatCOP(obligacion.saldo)}</strong>. Si el pago es menor, queda como abono y el resto sigue pendiente.</p>}
            </div>
          ) : (
            <>
              <div><Label>{cfg.etiquetaConcepto}</Label><Input value={form.concepto ?? ''} onChange={(e) => set('concepto', e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Categoría</Label>
                  <Select value={form.categoria ?? ''} onValueChange={(v) => set('categoria', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{cfg.categorias.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>{cfg.tercero} (opcional)</Label>
                  <Select value={form.tercero_id ?? '__ninguno'} onValueChange={(v) => set('tercero_id', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__ninguno">— Ninguno —</SelectItem>{terceros.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Forma de pago *</Label>
              <Select value={form.forma_pago ?? 'efectivo'} onValueChange={(v) => { set('forma_pago', v); set('cuenta_id', ''); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMAS_PAGO.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{ETIQUETA_CUENTA[forma.tipoCuenta]} *</Label>
              <Select value={form.cuenta_id ?? ''} onValueChange={(v) => set('cuenta_id', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                <SelectContent>
                  {cuentasForma.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} ({formatCOP(c.saldo)})</SelectItem>)}
                  {cuentasForma.length === 0 && <SelectItem value="__sin__" disabled>No hay cuentas de este tipo en Finanzas</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} /></div>
            <div><Label>Valor *</Label><Input type="number" value={form.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></div>
          </div>
          {modo === 'factura' && <div><Label>Concepto (opcional)</Label><Input value={form.concepto ?? ''} onChange={(e) => set('concepto', e.target.value)} placeholder={`${tipo === 'RC' ? 'Cobro' : 'Pago'} ${obligacion?.documento_numero || ''}`} /></div>}
          <div><Label>Observaciones</Label><Textarea rows={2} value={form.observaciones ?? ''} onChange={(e) => set('observaciones', e.target.value)} /></div>

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : `Guardar y ver ${tipo === 'RC' ? 'el recibo' : 'el comprobante'}`}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
