import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { fin } from '@/api/finanzas';
import { Tercero } from '@/entities/all';
import { formatCOP, mensajeError } from '../components/finanzas/utils';

// Configuración Contable (requerimiento 6.5/6.6): deja preparada la parametrización hacia un
// futuro plan de cuentas (sin exigirlo hoy), los parámetros del motor y las condiciones de
// cartera por tercero. No crea un plan de cuentas real: eso queda para más adelante.
export default function ContabilidadConfiguracion() {
  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Configuración Contable" description="Preparación para el futuro plan de cuentas, parámetros del motor y condiciones por tercero." />
      <Tabs defaultValue="cuentas">
        <TabsList>
          <TabsTrigger value="cuentas">Cuentas Conceptuales</TabsTrigger>
          <TabsTrigger value="parametros">Parámetros</TabsTrigger>
          <TabsTrigger value="terceros">Condiciones por Tercero</TabsTrigger>
        </TabsList>
        <TabsContent value="cuentas"><TabCuentas /></TabsContent>
        <TabsContent value="parametros"><TabParametros /></TabsContent>
        <TabsContent value="terceros"><TabTerceros /></TabsContent>
      </Tabs>
    </div>
  );
}

function TabCuentas() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null);
  const [valor, setValor] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setFilas(await fin.get('/parametrizacion-contable')); } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (cuenta_rol) => {
    try { await fin.put(`/parametrizacion-contable/${cuenta_rol}`, { cuenta_contable_id: valor.trim() || null }); setEditando(null); cargar(); }
    catch (e) { setError(mensajeError(e)); }
  };

  return (
    <Card className="mt-3">
      <CardHeader><CardTitle className="text-sm">Cuentas conceptuales usadas por el motor</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-slate-500 mb-3">Cada operación (venta, cobro, pago…) ya queda registrada contra una cuenta conceptual (ej: <code>cxc</code>, <code>ingreso_ventas</code>). Aquí se les puede asignar el código o nombre de la cuenta contable real cuando exista el plan de cuentas; mientras tanto, puede dejarse vacío sin que nada deje de funcionar.</p>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 border-b"><th className="p-2">Cuenta conceptual</th><th className="p-2">Cuenta contable asignada</th><th className="p-2">Acciones</th></tr></thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.cuenta_rol} className="border-b last:border-0">
                  <td className="p-2 font-mono text-xs">{f.cuenta_rol}</td>
                  <td className="p-2">
                    {editando === f.cuenta_rol
                      ? <Input className="h-8 w-56" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Código o nombre (opcional)" />
                      : (f.cuenta_contable_id || <span className="text-slate-400">Sin asignar</span>)}
                  </td>
                  <td className="p-2">
                    {editando === f.cuenta_rol ? (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => guardar(f.cuenta_rol)}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                      </div>
                    ) : <Button size="sm" variant="outline" onClick={() => { setEditando(f.cuenta_rol); setValor(f.cuenta_contable_id || ''); }}>Editar</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function TabParametros() {
  const [parametros, setParametros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null);
  const [valor, setValor] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try { setParametros(await fin.get('/parametros')); } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const guardar = async (clave) => {
    const n = Number(valor);
    try { await fin.put(`/parametros/${clave}`, { valor: Number.isFinite(n) ? n : valor }); setEditando(null); cargar(); }
    catch (e) { setError(mensajeError(e)); }
  };

  return (
    <Card className="mt-3">
      <CardHeader><CardTitle className="text-sm">Parámetros del motor financiero</CardTitle></CardHeader>
      <CardContent>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 border-b"><th className="p-2">Parámetro</th><th className="p-2">Valor</th><th className="p-2">Descripción</th><th className="p-2">Acciones</th></tr></thead>
            <tbody>
              {parametros.map((p) => (
                <tr key={p.clave} className="border-b last:border-0">
                  <td className="p-2 font-mono text-xs">{p.clave}</td>
                  <td className="p-2">{editando === p.clave ? <Input className="h-8 w-32" value={valor} onChange={(e) => setValor(e.target.value)} /> : String(p.valor)}</td>
                  <td className="p-2 text-xs text-slate-500">{p.descripcion}</td>
                  <td className="p-2">
                    {editando === p.clave ? (
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => guardar(p.clave)}>Guardar</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                      </div>
                    ) : <Button size="sm" variant="outline" onClick={() => { setEditando(p.clave); setValor(String(p.valor)); }}>Editar</Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function TabTerceros() {
  const [terceros, setTerceros] = useState([]);
  const [config, setConfig] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [t, c] = await Promise.all([Tercero.list(), fin.get('/terceros-config')]);
      setTerceros(t); setConfig(c);
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const configDe = (id) => config.find((c) => c.tercero_id === id);

  const guardar = async (tercero_id) => {
    try {
      await fin.put(`/terceros-config/${tercero_id}`, {
        plazo_dias: form.plazo_dias === '' ? null : Number(form.plazo_dias),
        cupo_credito: form.cupo_credito === '' ? null : Number(form.cupo_credito),
        bloqueo_automatico: !!form.bloqueo_automatico,
      });
      setEditando(null); cargar();
    } catch (e) { setError(mensajeError(e)); }
  };

  const editar = (t) => {
    const c = configDe(t.id);
    setEditando(t.id);
    setForm({ plazo_dias: c?.plazo_dias ?? '', cupo_credito: c?.cupo_credito ?? '', bloqueo_automatico: c?.bloqueo_automatico ?? false });
  };

  const conCondiciones = terceros.filter((t) => t.es_cliente || t.es_proveedor);

  return (
    <Card className="mt-3">
      <CardHeader><CardTitle className="text-sm">Plazo, cupo de crédito y bloqueo por tercero</CardTitle></CardHeader>
      <CardContent>
        <p className="text-xs text-slate-500 mb-3">Esto es informativo: hoy el motor no bloquea ventas ni compras automáticamente por cupo (eso quedaría para una fase de aprobaciones posterior); aquí solo se deja registrada la condición acordada con cada cliente o proveedor.</p>
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 border-b"><th className="p-2">Tercero</th><th className="p-2">Plazo (días)</th><th className="p-2">Cupo de crédito</th><th className="p-2">Bloqueo automático</th><th className="p-2">Acciones</th></tr></thead>
            <tbody>
              {conCondiciones.map((t) => {
                const c = configDe(t.id);
                return (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="p-2">{t.nombre}</td>
                    {editando === t.id ? (
                      <>
                        <td className="p-2"><Input className="h-8 w-20" type="number" value={form.plazo_dias} onChange={(e) => setForm((p) => ({ ...p, plazo_dias: e.target.value }))} /></td>
                        <td className="p-2"><Input className="h-8 w-32" type="number" value={form.cupo_credito} onChange={(e) => setForm((p) => ({ ...p, cupo_credito: e.target.value }))} /></td>
                        <td className="p-2"><Checkbox checked={form.bloqueo_automatico} onCheckedChange={(v) => setForm((p) => ({ ...p, bloqueo_automatico: !!v }))} /></td>
                        <td className="p-2"><div className="flex gap-1"><Button size="sm" onClick={() => guardar(t.id)}>Guardar</Button><Button size="sm" variant="outline" onClick={() => setEditando(null)}>Cancelar</Button></div></td>
                      </>
                    ) : (
                      <>
                        <td className="p-2">{c?.plazo_dias ?? '—'}</td>
                        <td className="p-2">{c?.cupo_credito != null ? formatCOP(c.cupo_credito) : '—'}</td>
                        <td className="p-2">{c?.bloqueo_automatico ? 'Sí' : 'No'}</td>
                        <td className="p-2"><Button size="sm" variant="outline" onClick={() => editar(t)}>Editar</Button></td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
