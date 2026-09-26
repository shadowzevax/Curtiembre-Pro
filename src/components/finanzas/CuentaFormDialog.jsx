import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin } from '@/api/finanzas';
import { mensajeError, hoy } from './utils';

const vacio = { nombre: '', entidad: '', tipo_cuenta: '', numero: '', titular: '', saldo_inicial: '0', fecha_saldo_inicial: hoy(),
  permite_saldo_negativo: false, aplica_gmf: true, fecha_apertura: '', observaciones: '' };

// Crear/editar una cuenta de dinero (caja, banco u otro medio). El saldo inicial solo se puede
// escribir al crear; para cambiarlo después hay que dar un motivo (lo pide el servidor).
export default function CuentaFormDialog({ open, onClose, tipo, cuenta, onGuardado }) {
  const [form, setForm] = useState(vacio);
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(cuenta ? { ...vacio, ...cuenta, saldo_inicial: String(cuenta.saldo_inicial ?? 0) } : vacio);
      setMotivo(''); setError('');
    }
  }, [open, cuenta]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    const cambioSaldo = cuenta && Number(form.saldo_inicial) !== Number(cuenta.saldo_inicial);
    if (cambioSaldo && motivo.trim().length < 5) { setError('Para cambiar el saldo inicial escriba un motivo (mínimo 5 caracteres)'); return; }
    setGuardando(true); setError('');
    try {
      const body = { ...form, saldo_inicial: Number(form.saldo_inicial) || 0, motivo: motivo.trim() || undefined };
      if (cuenta) await fin.put(`/cuentas/${cuenta.id}`, body);
      else await fin.post('/cuentas', { ...body, tipo });
      onGuardado();
      onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{cuenta ? 'Editar' : 'Nueva'} {tipo === 'caja' ? 'caja' : tipo === 'banco' ? 'cuenta bancaria' : 'medio de pago'}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <div>
            <Label>Nombre *</Label>
            <Input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder={tipo === 'caja' ? 'Caja General' : tipo === 'banco' ? 'Bancolombia Ahorros' : 'Nequi'} />
          </div>
          {tipo === 'banco' && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Entidad bancaria</Label><Input value={form.entidad} onChange={(e) => set('entidad', e.target.value)} /></div>
              <div>
                <Label>Tipo de cuenta</Label>
                <Select value={form.tipo_cuenta || ''} onValueChange={(v) => set('tipo_cuenta', v)}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent><SelectItem value="ahorros">Ahorros</SelectItem><SelectItem value="corriente">Corriente</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          )}
          {tipo !== 'caja' && (
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Número / identificación</Label><Input value={form.numero} onChange={(e) => set('numero', e.target.value)} /></div>
              <div><Label>Titular</Label><Input value={form.titular} onChange={(e) => set('titular', e.target.value)} /></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Saldo inicial {cuenta ? '(cambiarlo requiere motivo)' : ''}</Label>
              <Input type="number" value={form.saldo_inicial} onChange={(e) => set('saldo_inicial', e.target.value)} />
            </div>
            <div><Label>Fecha del saldo inicial</Label><Input type="date" value={form.fecha_saldo_inicial || ''} onChange={(e) => set('fecha_saldo_inicial', e.target.value)} /></div>
          </div>
          {cuenta && (
            <div>
              <Label>Motivo del cambio (obligatorio si cambia el saldo inicial)</Label>
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: corrección tras conciliar el extracto de enero" />
            </div>
          )}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!form.permite_saldo_negativo} onChange={(e) => set('permite_saldo_negativo', e.target.checked)} /> Permite saldo negativo (sobregiro)</label>
            {tipo === 'banco' && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={!!form.aplica_gmf} onChange={(e) => set('aplica_gmf', e.target.checked)} /> Aplica GMF (4x1000)</label>}
          </div>
          {cuenta && (
            <div>
              <Label>Estado</Label>
              <Select value={form.estado || 'activa'} onValueChange={(v) => set('estado', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="activa">Activa</SelectItem><SelectItem value="inactiva">Inactiva</SelectItem></SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Observaciones</Label><Textarea value={form.observaciones || ''} onChange={(e) => set('observaciones', e.target.value)} rows={2} /></div>
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
