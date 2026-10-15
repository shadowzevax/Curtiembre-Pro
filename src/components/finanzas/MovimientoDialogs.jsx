import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin, nuevaLlave } from '@/api/finanzas';
import { Tercero } from '@/entities/all';
import { mensajeError, hoy, formatCOP, CATEGORIAS_INGRESO_CAJA, CATEGORIAS_EGRESO, FORMAS_PAGO } from './utils';

function SelectorCuenta({ cuentas, value, onChange, excluir, label = 'Cuenta *' }) {
  const opciones = cuentas.filter((c) => c.id !== excluir);
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
        <SelectContent>
          {opciones.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} ({formatCOP(c.saldo)})</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ── Ingreso / Egreso ──────────────────────────────────────────────────────────
// En ingresos, "Recaudo de cartera" registra un cobro sobre la CxC de la factura (no es una venta
// nueva) y "Anticipo de cliente" un anticipo pendiente de aplicar; ambos emiten Recibo de Caja.
// Los traslados entre cuentas NO son ingresos: van por "Transferencia".
export function IngresoEgresoDialog({ open, onClose, tipo, cuentas, cuentaFija, onGuardado }) {
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [cartera, setCartera] = useState([]);
  const [clientes, setClientes] = useState([]);
  const llave = React.useRef(nuevaLlave());
  const esIngreso = tipo === 'ingreso';
  const categorias = esIngreso ? CATEGORIAS_INGRESO_CAJA : CATEGORIAS_EGRESO;

  useEffect(() => {
    if (open) {
      llave.current = nuevaLlave();
      setForm({ cuenta_id: cuentaFija?.id || '', fecha: hoy(), valor: '', concepto: '', categoria: esIngreso ? 'otros_ingresos' : categorias[0].value,
        tercero_nombre: '', medio_pago: FORMAS_PAGO.find((f) => f.tipoCuenta === cuentaFija?.tipo)?.value || '', cliente: '', obligacion_id: '', aplicacion: 'total', cliente_id: '', observaciones: '' });
      setError('');
      if (esIngreso) {
        fin.get('/obligaciones', { naturaleza: 'por_cobrar' })
          .then((l) => setCartera(l.filter((o) => o.saldo > 0 && !['pagada', 'anulada'].includes(o.estado)))).catch(() => setCartera([]));
        Tercero.list().then((t) => setClientes(t.filter((x) => x.es_cliente))).catch(() => setClientes([]));
      }
    }
  }, [open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const cuenta = cuentaFija || cuentas.find((c) => c.id === form.cuenta_id);
  const formas = FORMAS_PAGO.filter((f) => !cuenta || f.tipoCuenta === cuenta.tipo);
  useEffect(() => {
    if (cuenta && !formas.some((f) => f.value === form.medio_pago)) set('medio_pago', formas[0]?.value || '');
  }, [cuenta?.id, open]);

  const esRecaudo = esIngreso && form.categoria === 'recaudo';
  const esAnticipo = esIngreso && form.categoria === 'anticipo_cliente';
  const clientesCartera = [...new Map(cartera.map((o) => [o.tercero_id || o.tercero_nombre, o.tercero_nombre])).entries()];
  const facturas = cartera.filter((o) => (o.tercero_id || o.tercero_nombre) === form.cliente);
  const factura = facturas.find((o) => o.id === form.obligacion_id);
  const elegirFactura = (id) => {
    const o = facturas.find((x) => x.id === id);
    setForm((p) => ({ ...p, obligacion_id: id, aplicacion: 'total', valor: o ? String(o.saldo) : '' }));
  };

  const guardar = async (e) => {
    e.preventDefault();
    const cuentaId = cuentaFija?.id || form.cuenta_id;
    if (!cuentaId) { setError('Seleccione la caja, banco u otro medio donde entra el dinero'); return; }
    const valor = Number(form.valor);
    if (!(valor > 0)) { setError('El valor debe ser mayor a cero'); return; }
    const comun = { cuenta_id: cuentaId, fecha: form.fecha, valor, medio_pago: form.medio_pago || undefined,
      observaciones: form.observaciones || undefined, idempotency_key: llave.current };
    let ruta; let body;
    if (esRecaudo) {
      if (!factura) { setError('Seleccione el cliente y la factura pendiente'); return; }
      if (valor > factura.saldo) { setError(`El valor recibido supera el saldo pendiente (${formatCOP(factura.saldo)})`); return; }
      if (form.aplicacion === 'total' && valor !== factura.saldo) { setError('En pago total el valor recibido debe ser igual al saldo pendiente'); return; }
      if (form.aplicacion === 'parcial' && valor >= factura.saldo) { setError('En abono parcial el valor debe ser menor al saldo pendiente'); return; }
      ruta = 'cobro'; body = { ...comun, obligacion_id: factura.id };
    } else if (esAnticipo) {
      const t = clientes.find((x) => x.id === form.cliente_id);
      if (!t) { setError('Seleccione el cliente que entrega el anticipo'); return; }
      ruta = 'anticipo'; body = { ...comun, tipo: 'cliente', tercero_id: t.id, tercero_nombre: t.nombre, concepto: form.concepto?.trim() || undefined };
    } else {
      if (!form.concepto?.trim()) { setError('El concepto es obligatorio'); return; }
      ruta = tipo; body = { ...comun, concepto: form.concepto.trim(), categoria: form.categoria, tercero_nombre: form.tercero_nombre || undefined };
    }
    setGuardando(true); setError('');
    try {
      await fin.post(`/operaciones/${ruta}`, body);
      onGuardado(); onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  const etiquetaConcepto = { financiero: 'Concepto (intereses, rendimientos u otro ingreso financiero) *',
    reintegro: 'Concepto y origen del reintegro *' }[form.categoria] || 'Concepto *';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{esIngreso ? 'Registrar ingreso' : 'Registrar egreso'}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <div>
            <Label>Categoría</Label>
            <Select value={form.categoria ?? ''} onValueChange={(v) => setForm((p) => ({ ...p, categoria: v, valor: '', obligacion_id: '' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categorias.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {esRecaudo && <>
            <div><Label>Cliente *</Label>
              <Select value={form.cliente ?? ''} onValueChange={(v) => setForm((p) => ({ ...p, cliente: v, obligacion_id: '', valor: '' }))}>
                <SelectTrigger><SelectValue placeholder={clientesCartera.length ? 'Clientes con saldo pendiente' : 'No hay facturas pendientes'} /></SelectTrigger>
                <SelectContent>{clientesCartera.map(([k, n]) => <SelectItem key={k} value={k}>{n}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Factura pendiente *</Label>
              <Select value={form.obligacion_id ?? ''} onValueChange={elegirFactura} disabled={!form.cliente}>
                <SelectTrigger><SelectValue placeholder="Seleccionar factura" /></SelectTrigger>
                <SelectContent>{facturas.map((o) => <SelectItem key={o.id} value={o.id}>{o.documento_numero}{o.numero_interno && o.numero_interno !== o.documento_numero ? ` (${o.numero_interno})` : ''} · saldo {formatCOP(o.saldo)}</SelectItem>)}</SelectContent>
              </Select></div>
            {factura && <div className="grid grid-cols-2 gap-2 bg-slate-50 border rounded p-2 text-xs">
              <div>Valor factura<br /><strong>{formatCOP(factura.valor_original)}</strong></div>
              <div>Saldo pendiente<br /><strong>{formatCOP(factura.saldo)}</strong></div>
            </div>}
            {factura && <div><Label>Tipo de aplicación</Label>
              <Select value={form.aplicacion} onValueChange={(v) => setForm((p) => ({ ...p, aplicacion: v, valor: v === 'total' ? String(factura.saldo) : '' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="total">Pago total</SelectItem><SelectItem value="parcial">Abono parcial</SelectItem></SelectContent>
              </Select></div>}
          </>}
          {esAnticipo && <div><Label>Cliente *</Label>
            <Select value={form.cliente_id ?? ''} onValueChange={(v) => set('cliente_id', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
              <SelectContent>{clientes.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-[11px] text-slate-500 mt-1">Queda como anticipo pendiente; se aplica después a la factura desde Cuentas por Cobrar.</p></div>}
          {!cuentaFija && <SelectorCuenta cuentas={cuentas} value={form.cuenta_id ?? ''} onChange={(v) => set('cuenta_id', v)} label={esIngreso ? 'Ingresa a (caja, banco u otro medio) *' : 'Cuenta *'} />}
          {cuentaFija && <p className="text-xs text-slate-500">{esIngreso ? 'Ingresa a' : 'Cuenta'}: <strong>{cuentaFija.nombre}</strong></p>}
          {esIngreso && cuenta && <div><Label>Forma de pago</Label>
            <Select value={form.medio_pago ?? ''} onValueChange={(v) => set('medio_pago', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{formas.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
            </Select></div>}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} /></div>
            <div><Label>{esRecaudo || esAnticipo ? 'Valor recibido *' : 'Valor *'}</Label>
              <Input type="number" value={form.valor ?? ''} disabled={esRecaudo && form.aplicacion === 'total'} onChange={(e) => set('valor', e.target.value)} /></div>
          </div>
          {!esRecaudo && <div><Label>{esAnticipo ? 'Concepto' : etiquetaConcepto}</Label><Input value={form.concepto ?? ''} onChange={(e) => set('concepto', e.target.value)} /></div>}
          {!esRecaudo && !esAnticipo && <div><Label>{form.categoria === 'reintegro' ? 'Quién reintegra (opcional)' : 'Tercero (opcional)'}</Label>
            <Input value={form.tercero_nombre ?? ''} onChange={(e) => set('tercero_nombre', e.target.value)} /></div>}
          <div><Label>Observaciones</Label><Input value={form.observaciones ?? ''} onChange={(e) => set('observaciones', e.target.value)} /></div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Transferencia entre cuentas ───────────────────────────────────────────────
export function TransferenciaDialog({ open, onClose, cuentas, cuentaOrigenFija, onGuardado }) {
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const llave = React.useRef(nuevaLlave());

  useEffect(() => {
    if (open) {
      llave.current = nuevaLlave();
      setForm({ cuenta_origen_id: cuentaOrigenFija?.id || '', cuenta_destino_id: '', fecha: hoy(), valor: '', concepto: '' });
      setError('');
    }
  }, [open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.cuenta_origen_id || !form.cuenta_destino_id) { setError('Seleccione la cuenta de origen y la de destino'); return; }
    if (!(Number(form.valor) > 0)) { setError('El valor debe ser mayor a cero'); return; }
    setGuardando(true); setError('');
    try {
      await fin.post('/operaciones/transferencia', { ...form, valor: Number(form.valor), idempotency_key: llave.current });
      onGuardado(); onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Transferencia entre cuentas</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          {cuentaOrigenFija
            ? <p className="text-xs text-slate-500">Desde: <strong>{cuentaOrigenFija.nombre}</strong></p>
            : <SelectorCuenta cuentas={cuentas} value={form.cuenta_origen_id ?? ''} onChange={(v) => set('cuenta_origen_id', v)} label="Desde *" />}
          <SelectorCuenta cuentas={cuentas} value={form.cuenta_destino_id ?? ''} onChange={(v) => set('cuenta_destino_id', v)} excluir={form.cuenta_origen_id} label="Hacia *" />
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} /></div>
            <div><Label>Valor *</Label><Input type="number" value={form.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></div>
          </div>
          <div><Label>Concepto</Label><Input value={form.concepto ?? ''} onChange={(e) => set('concepto', e.target.value)} placeholder="Transferencia entre cuentas" /></div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Ajuste de caja / diferencia de arqueo (solo administrador) ───────────────
export function AjusteArqueoDialog({ open, onClose, cuenta, onGuardado }) {
  const [conteo, setConteo] = useState('');
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const llave = React.useRef(nuevaLlave());

  useEffect(() => { if (open) { llave.current = nuevaLlave(); setConteo(''); setMotivo(''); setError(''); } }, [open]);

  const diferencia = conteo !== '' ? Number(conteo) - Number(cuenta?.saldo || 0) : null;

  const guardar = async (e) => {
    e.preventDefault();
    if (conteo === '') { setError('Ingrese el saldo contado físicamente'); return; }
    if (Math.abs(diferencia) < 0.01) { setError('No hay diferencia: el saldo contado coincide con el del sistema'); return; }
    if (motivo.trim().length < 5) { setError('El motivo es obligatorio (mínimo 5 caracteres)'); return; }
    setGuardando(true); setError('');
    try {
      await fin.post('/operaciones/ajuste', { cuenta_id: cuenta.id, fecha: hoy(), naturaleza: diferencia > 0 ? 'entrada' : 'salida',
        valor: Math.abs(diferencia), motivo: motivo.trim(), idempotency_key: llave.current });
      onGuardado(); onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Arqueo de {cuenta?.nombre}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <p>Saldo según el sistema: <strong>{formatCOP(cuenta?.saldo)}</strong></p>
          <div><Label>Saldo contado físicamente *</Label><Input type="number" value={conteo} onChange={(e) => setConteo(e.target.value)} /></div>
          {conteo !== '' && (
            <p className={`text-sm font-semibold ${Math.abs(diferencia) < 0.01 ? 'text-slate-500' : diferencia > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              Diferencia: {formatCOP(diferencia)} {diferencia > 0 ? '(sobrante)' : diferencia < 0 ? '(faltante)' : ''}
            </p>
          )}
          <div><Label>Motivo del ajuste *</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Explique el sobrante o faltante" /></div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Registrar ajuste'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
