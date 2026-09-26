import React, { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw } from 'lucide-react';
import { fin, nuevaLlave } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError, hoy } from './utils';

// Paso B4: integraciones con Costos Indirectos y Procesos Externos. Esos módulos no se
// modifican; aquí solo se lee lo que ya generan y se conecta con Tesorería.
export default function IntegracionesPanel({ cuentas }) {
  const [costos, setCostos] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [pagando, setPagando] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [c, p] = await Promise.all([fin.get('/integraciones/costos-indirectos'), fin.get('/integraciones/procesos-externos')]);
      setCostos(c); setProcesos(p);
    } catch (e) { setMensaje(mensajeError(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const sincronizar = async () => {
    setSincronizando(true); setMensaje('');
    try {
      const r = await fin.post('/integraciones/procesos-externos/sincronizar', {});
      setMensaje(r.creadas > 0 ? `Se generaron ${r.creadas} cuenta(s) por pagar de procesos externos recibidos.` : 'No hay procesos externos nuevos por sincronizar.');
      cargar();
    } catch (e) { setMensaje(mensajeError(e)); } finally { setSincronizando(false); }
  };

  if (cargando) return null;
  if (costos.length === 0 && procesos.length === 0) return null;

  return (
    <div className="mt-4 border rounded-lg overflow-hidden">
      <div className="bg-slate-50 p-3 font-semibold text-sm">Integraciones pendientes</div>
      <div className="p-3 space-y-4 text-sm">
        {mensaje && <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">{mensaje}</p>}

        {costos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Costos Indirectos sin pagar ({costos.length})</p>
            <table className="w-full text-xs border rounded">
              <tbody>
                {costos.slice(0, 8).map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-1.5">{formatFecha(c.fecha)}</td>
                    <td className="p-1.5">{c.concepto}{c.codigo_lote ? ` · Lote ${c.codigo_lote}` : ''}</td>
                    <td className="p-1.5 text-right">{formatCOP(c.valor)}</td>
                    <td className="p-1.5 text-right"><Button size="sm" variant="outline" onClick={() => setPagando(c)}>Pagar</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {costos.length > 8 && <p className="text-xs text-slate-400 mt-1">y {costos.length - 8} más…</p>}
          </div>
        )}

        {procesos.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-1">Procesos Externos recibidos sin generar Cuenta por Pagar ({procesos.length})</p>
            <p className="text-xs text-slate-500 mb-2">Total: {formatCOP(procesos.reduce((s, p) => s + p.valor_a_generar, 0))}</p>
            <Button size="sm" onClick={sincronizar} disabled={sincronizando}><RefreshCw className="w-3.5 h-3.5 mr-1" />{sincronizando ? 'Sincronizando…' : 'Generar cuentas por pagar'}</Button>
          </div>
        )}
      </div>

      <PagoCostoDialog open={!!pagando} onClose={() => setPagando(null)} costo={pagando} cuentas={cuentas} onGuardado={cargar} />
    </div>
  );
}

function PagoCostoDialog({ open, onClose, costo, cuentas, onGuardado }) {
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const llave = React.useRef(nuevaLlave());

  useEffect(() => { if (open) { llave.current = nuevaLlave(); setForm({ cuenta_id: '', fecha: hoy() }); setError(''); } }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const guardar = async (e) => {
    e.preventDefault();
    if (!form.cuenta_id) { setError('Seleccione la cuenta de dinero'); return; }
    setGuardando(true); setError('');
    try {
      await fin.post('/integraciones/costos-indirectos/pagar', { costo_id: costo.id, cuenta_id: form.cuenta_id, fecha: form.fecha, idempotency_key: llave.current });
      onGuardado(); onClose();
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  if (!costo) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Pagar {costo.concepto}</DialogTitle></DialogHeader>
        <form onSubmit={guardar} className="space-y-3 text-sm">
          <p className="text-xs text-slate-500">Valor: <strong>{formatCOP(costo.valor)}</strong></p>
          <div>
            <Label>Cuenta de dinero *</Label>
            <Select value={form.cuenta_id ?? ''} onValueChange={(v) => set('cuenta_id', v)}>
              <SelectTrigger><SelectValue placeholder="Caja, banco u otro medio" /></SelectTrigger>
              <SelectContent>{cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre} ({formatCOP(c.saldo)})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Fecha *</Label><Input type="date" value={form.fecha ?? ''} onChange={(e) => set('fecha', e.target.value)} /></div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Pagar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
