import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin, nuevaLlave } from '@/api/finanzas';
import { mensajeError, hoy, formatCOP } from './utils';

// ── Cobro (CxC) / Pago (CxP) ─────────────────────────────────────────────────
export function CobroPagoDialog({ open, onClose, obligacion, cuentas, onGuardado }) {
  const esCxc = obligacion?.naturaleza === 'por_cobrar';
  const [form, setForm] = useState({});
  const [conRetencion, setConRetencion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const llave = React.useRef(nuevaLlave());

  useEffect(() => {
    if (open && obligacion) {
      llave.current = nuevaLlave();
      setForm({ cuenta_id: '', fecha: hoy(), valor: String(obligacion.saldo), medio_pago: '', tipo_retencion: 'retefuente', valor_retencion: '' });
      setConRetencion(false); setError('');
    }
  }, [open, obligacion]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const totalAplicado = Number(form.valor || 0) + (conRetencion ? Number(form.valor_retencion || 0) : 0);

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.cuenta_id) { setError('Seleccione la cuenta de dinero'); return; }
    if (!(Number(form.valor) > 0)) { setError('El valor debe ser mayor a cero'); return; }
    setGuardando(true); setError('');
    try {
      const body = { obligacion_id: obligacion.id, cuenta_id: form.cuenta_id, valor: Number(form.valor), fecha: form.fecha,
        medio_pago: form.medio_pago || undefined, idempotency_key: llave.current,
        retencion: conRetencion && Number(form.valor_retencion) > 0 ? { tipo: form.tipo_retencion, valor: Number(form.valor_retencion) } : undefined };
      await fin.post(`/operaciones/${esCxc ? 'cobro' : 'pago'}`, body);
      onGuardado(); onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  if (!obligacion) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{esCxc ? 'Registrar cobro' : 'Registrar pago'} · {obligacion.documento_numero}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <div className="bg-slate-50 rounded p-2 text-xs flex justify-between"><span>{obligacion.tercero_nombre}</span><span>Saldo pendiente: <strong>{formatCOP(obligacion.saldo)}</strong></span></div>
          <div>
            <Label>Cuenta de dinero *</Label>
            <Select value={form.cuenta_id ?? ''} onValueChange={(v) => set('cuenta_id', v)}>
              <SelectTrigger><SelectValue placeholder="Caja, banco u otro medio" /></SelectTrigger>
              <SelectContent>{cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} ({formatCOP(c.saldo)})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} /></div>
            <div><Label>Valor *</Label><Input type="number" value={form.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={conRetencion} onChange={(e) => setConRetencion(e.target.checked)} /> {esCxc ? 'El cliente me practicó retención' : 'Voy a practicar retención'}</label>
          {conRetencion && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo_retencion ?? ''} onValueChange={(v) => set('tipo_retencion', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="retefuente">Retefuente</SelectItem><SelectItem value="reteiva">ReteIVA</SelectItem><SelectItem value="reteica">ReteICA</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Valor retenido</Label><Input type="number" value={form.valor_retencion ?? ''} onChange={(e) => set('valor_retencion', e.target.value)} /></div>
            </div>
          )}
          {conRetencion && <p className="text-xs text-slate-500">Total que se aplica a la cuenta: {formatCOP(totalAplicado)}</p>}
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

// ── Nota crédito / débito ─────────────────────────────────────────────────────
export function NotaDialog({ open, onClose, obligacion, onGuardado }) {
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const llave = React.useRef(nuevaLlave());

  useEffect(() => { if (open) { llave.current = nuevaLlave(); setForm({ tipo: 'credito', valor: '', motivo: '', fecha: hoy() }); setError(''); } }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!(Number(form.valor) > 0)) { setError('El valor debe ser mayor a cero'); return; }
    if (form.motivo.trim().length < 5) { setError('El motivo es obligatorio (mínimo 5 caracteres)'); return; }
    setGuardando(true); setError('');
    try {
      await fin.post('/operaciones/nota', { obligacion_id: obligacion.id, tipo: form.tipo, valor: Number(form.valor), motivo: form.motivo.trim(),
        fecha: form.fecha, idempotency_key: llave.current });
      onGuardado(); onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  if (!obligacion) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nota sobre {obligacion.documento_numero}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <p className="text-xs text-slate-500">Saldo pendiente: <strong>{formatCOP(obligacion.saldo)}</strong></p>
          <div>
            <Label>Tipo *</Label>
            <Select value={form.tipo ?? ''} onValueChange={(v) => set('tipo', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="credito">Nota crédito (disminuye el saldo)</SelectItem><SelectItem value="debito">Nota débito (aumenta el saldo)</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} /></div>
            <div><Label>Valor *</Label><Input type="number" value={form.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></div>
          </div>
          <div><Label>Motivo *</Label><Input value={form.motivo ?? ''} onChange={(e) => set('motivo', e.target.value)} placeholder="Ej: descuento comercial, recargo por transporte…" /></div>
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

// ── Anticipo (cliente o proveedor) ────────────────────────────────────────────
export function AnticipoDialog({ open, onClose, naturaleza, cuentas, onGuardado }) {
  const esCliente = naturaleza === 'por_cobrar';
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const llave = React.useRef(nuevaLlave());

  useEffect(() => { if (open) { llave.current = nuevaLlave(); setForm({ cuenta_id: '', fecha: hoy(), valor: '', tercero_nombre: '', concepto: '' }); setError(''); } }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.cuenta_id) { setError('Seleccione la cuenta'); return; }
    if (!form.tercero_nombre.trim()) { setError(`Indique el ${esCliente ? 'cliente' : 'proveedor'}`); return; }
    if (!(Number(form.valor) > 0)) { setError('El valor debe ser mayor a cero'); return; }
    setGuardando(true); setError('');
    try {
      await fin.post('/operaciones/anticipo', { tipo: esCliente ? 'cliente' : 'proveedor', cuenta_id: form.cuenta_id, fecha: form.fecha,
        valor: Number(form.valor), tercero_nombre: form.tercero_nombre.trim(), concepto: form.concepto || undefined, idempotency_key: llave.current });
      onGuardado(); onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo anticipo {esCliente ? 'de cliente' : 'a proveedor'}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <div><Label>{esCliente ? 'Cliente' : 'Proveedor'} *</Label><Input value={form.tercero_nombre ?? ''} onChange={(e) => set('tercero_nombre', e.target.value)} /></div>
          <div>
            <Label>Cuenta de dinero *</Label>
            <Select value={form.cuenta_id ?? ''} onValueChange={(v) => set('cuenta_id', v)}>
              <SelectTrigger><SelectValue placeholder="Caja, banco u otro medio" /></SelectTrigger>
              <SelectContent>{cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} ({formatCOP(c.saldo)})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} /></div>
            <div><Label>Valor *</Label><Input type="number" value={form.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></div>
          </div>
          <div><Label>Concepto</Label><Input value={form.concepto ?? ''} onChange={(e) => set('concepto', e.target.value)} /></div>
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

// ── Cruzar un anticipo contra una CxC / CxP ──────────────────────────────────
export function CruceAnticipoDialog({ open, onClose, obligacion, anticipos, onGuardado }) {
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const llave = React.useRef(nuevaLlave());
  const disponibles = (anticipos || []).filter((a) => !a.tercero_id || !obligacion?.tercero_id || a.tercero_id === obligacion.tercero_id);

  useEffect(() => { if (open) { llave.current = nuevaLlave(); setForm({ anticipo_id: '', valor: '', fecha: hoy() }); setError(''); } }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const anticipoSel = disponibles.find((a) => a.id === form.anticipo_id);

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.anticipo_id) { setError('Seleccione el anticipo'); return; }
    if (!(Number(form.valor) > 0)) { setError('El valor debe ser mayor a cero'); return; }
    setGuardando(true); setError('');
    try {
      await fin.post('/operaciones/cruce-anticipo', { anticipo_id: form.anticipo_id, obligacion_id: obligacion.id, valor: Number(form.valor),
        fecha: form.fecha, idempotency_key: llave.current });
      onGuardado(); onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  if (!obligacion) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cruzar anticipo con {obligacion.documento_numero}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <p className="text-xs text-slate-500">Saldo pendiente: <strong>{formatCOP(obligacion.saldo)}</strong></p>
          <div>
            <Label>Anticipo disponible *</Label>
            <Select value={form.anticipo_id ?? ''} onValueChange={(v) => { set('anticipo_id', v); const a = disponibles.find((x) => x.id === v); if (a) set('valor', String(Math.min(a.saldo, obligacion.saldo))); }}>
              <SelectTrigger><SelectValue placeholder="Seleccionar anticipo" /></SelectTrigger>
              <SelectContent>{disponibles.map((a) => <SelectItem key={a.id} value={a.id}>{a.documento_numero} · {a.tercero_nombre} · {formatCOP(a.saldo)} disponible</SelectItem>)}</SelectContent>
            </Select>
            {disponibles.length === 0 && <p className="text-xs text-slate-400 mt-1">No hay anticipos disponibles para este tercero.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} /></div>
            <div><Label>Valor a cruzar *</Label><Input type="number" value={form.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></div>
          </div>
          {anticipoSel && <p className="text-xs text-slate-500">Disponible en el anticipo: {formatCOP(anticipoSel.saldo)}</p>}
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Cruzar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
