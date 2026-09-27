import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fin } from '@/api/finanzas';
import { formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

// Cierres Contables: bloquea un período para que no se registren ni anulen operaciones con
// fecha dentro de él (ya lo hace el motor, `verificarPeriodoAbierto`); aquí solo se administra.
export default function ContabilidadCierres() {
  const [periodos, setPeriodos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState(hoy());
  const [observacion, setObservacion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setPeriodos(await fin.get('/periodos')); } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const cerrar = async (e) => {
    e.preventDefault();
    if (!desde || !hasta) { setError('Indique el rango de fechas a cerrar'); return; }
    setGuardando(true); setError('');
    try {
      await fin.post('/periodos/cerrar', { desde, hasta, observacion });
      setDesde(''); setObservacion(''); cargar();
    } catch (e) { setError(mensajeError(e)); } finally { setGuardando(false); }
  };

  const reabrir = async (id) => {
    const motivo = window.prompt('Motivo para reabrir este período (mínimo 5 caracteres):');
    if (motivo === null) return;
    try { await fin.post(`/periodos/${id}/reabrir`, { motivo }); cargar(); }
    catch (e) { setError(mensajeError(e)); }
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Cierres Contables" description="Bloquea un rango de fechas para que no se registren ni anulen operaciones dentro de él." />
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</p>}

      <Card>
        <CardHeader><CardTitle className="text-sm">Cerrar un nuevo período</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={cerrar} className="flex flex-wrap items-end gap-3">
            <div><Label>Desde *</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
            <div><Label>Hasta *</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
            <div className="flex-1 min-w-[200px]"><Label>Observación</Label><Input value={observacion} onChange={(e) => setObservacion(e.target.value)} placeholder="Opcional" /></div>
            <Button type="submit" disabled={guardando}>{guardando ? 'Cerrando…' : 'Cerrar período'}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Historial de períodos</CardTitle></CardHeader>
        <CardContent>
          {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : periodos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No hay períodos cerrados todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 border-b"><th className="p-2">Desde</th><th className="p-2">Hasta</th><th className="p-2">Estado</th><th className="p-2">Observación</th><th className="p-2">Acciones</th></tr></thead>
              <tbody>
                {periodos.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="p-2">{formatFecha(p.desde)}</td>
                    <td className="p-2">{formatFecha(p.hasta)}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.estado === 'cerrado' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>{p.estado.toUpperCase()}</span></td>
                    <td className="p-2 text-slate-500">{p.observacion || '—'}</td>
                    <td className="p-2">{p.estado === 'cerrado' && <Button size="sm" variant="outline" onClick={() => reabrir(p.id)}>Reabrir</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
