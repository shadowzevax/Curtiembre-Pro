import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin, nuevaLlave } from '@/api/finanzas';
import { mensajeError, hoy, formatCOP, CATEGORIAS_INGRESO, CATEGORIAS_EGRESO } from './utils';

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
export function IngresoEgresoDialog({ open, onClose, tipo, cuentas, cuentaFija, onGuardado }) {
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const llave = React.useRef(nuevaLlave());
  const categorias = tipo === 'ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  useEffect(() => {
    if (open) {
      llave.current = nuevaLlave();
      setForm({ cuenta_id: cuentaFija?.id || '', fecha: hoy(), valor: '', concepto: '', categoria: categorias[0].value, tercero_nombre: '', medio_pago: '' });
      setError('');
    }
  }, [open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.cuenta_id) { setError('Seleccione la cuenta'); return; }
    if (!(Number(form.valor) > 0)) { setError('El valor debe ser mayor a cero'); return; }
    if (!form.concepto?.trim()) { setError('El concepto es obligatorio'); return; }
    setGuardando(true); setError('');
    try {
      await fin.post(`/operaciones/${tipo}`, { ...form, valor: Number(form.valor), idempotency_key: llave.current });
      onGuardado(); onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso'}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          {!cuentaFija && <SelectorCuenta cuentas={cuentas} value={form.cuenta_id ?? ''} onChange={(v) => set('cuenta_id', v)} />}
          {cuentaFija && <p className="text-xs text-slate-500">Cuenta: <strong>{cuentaFija.nombre}</strong></p>}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} /></div>
            <div><Label>Valor *</Label><Input type="number" value={form.valor ?? ''} onChange={(e) => set('valor', e.target.value)} /></div>
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={form.categoria ?? ''} onValueChange={(v) => set('categoria', v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{categorias.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Concepto *</Label><Input value={form.concepto ?? ''} onChange={(e) => set('concepto', e.target.value)} /></div>
          <div><Label>Tercero (opcional)</Label><Input value={form.tercero_nombre ?? ''} onChange={(e) => set('tercero_nombre', e.target.value)} /></div>
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
      setForm({ cuenta_origen_id: cuentaOrigenFija?.id || '', cuenta_destino_id: '', fecha: hoy(), valor: '', concepto: '', exenta_gmf: false });
      setError('');
    }
  }, [open]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const origen = cuentas.find((c) => c.id === form.cuenta_origen_id);

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
          {origen?.tipo === 'banco' && (
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!form.exenta_gmf} onChange={(e) => set('exenta_gmf', e.target.checked)} /> Exenta de GMF (traslado entre cuentas propias del mismo titular)</label>
          )}
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
