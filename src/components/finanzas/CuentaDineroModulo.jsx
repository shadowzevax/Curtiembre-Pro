import React, { useEffect, useState, useCallback } from 'react';
import PageHeader from '../common/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowRightLeft, Scale, Edit } from 'lucide-react';
import { fin } from '@/api/finanzas';
import { formatCOP, mensajeError, TIPO_CUENTA_LABEL_PLURAL } from './utils';
import CuentaFormDialog from './CuentaFormDialog';
import LibroCuenta from './LibroCuenta';
import { IngresoEgresoDialog, TransferenciaDialog, AjusteArqueoDialog } from './MovimientoDialogs';
import { useAuth } from '@/lib/AuthContext';

// Módulo genérico para Caja, Bancos y Otros medios de dinero: pestaña "Libro" (por cuenta) y
// pestaña "Configuración" (crear/editar las cuentas de ese tipo). Un solo modelo de datos.
export default function CuentaDineroModulo({ tipo, titulo, descripcion }) {
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin';
  const [cuentas, setCuentas] = useState([]);
  const [todasCuentas, setTodasCuentas] = useState([]); // para transferencias (todos los tipos)
  const [cuentaId, setCuentaId] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('libro');
  const [dialogo, setDialogo] = useState(null); // 'cuenta' | 'ingreso' | 'egreso' | 'transferencia' | 'arqueo'
  const [editando, setEditando] = useState(null);
  const [recargarSenal, setRecargarSenal] = useState(0);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [propias, todas] = await Promise.all([fin.get('/cuentas', { tipo, incluir_inactivas: '1' }), fin.get('/cuentas')]);
      setCuentas(propias);
      setTodasCuentas(todas);
      setCuentaId((prev) => (prev && propias.some((c) => c.id === prev)) ? prev : (propias[0]?.id || ''));
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, [tipo]);

  useEffect(() => { cargar(); }, [cargar]);

  const cuentaActual = cuentas.find((c) => c.id === cuentaId);
  const recargarTodo = () => { cargar(); setRecargarSenal((s) => s + 1); };

  return (
    <div className="p-6">
      <PageHeader title={titulo} description={descripcion} />
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">{error}</p>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="libro">Libro</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        <TabsContent value="libro" className="pt-4">
          {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : cuentas.length === 0 ? (
            <div className="border-2 border-dashed rounded-xl p-8 text-center text-slate-400">
              <p>No hay {TIPO_CUENTA_LABEL_PLURAL[tipo]} todavía.</p>
              <Button className="mt-3" size="sm" onClick={() => { setEditando(null); setDialogo('cuenta'); }}><Plus className="w-4 h-4 mr-1" /> Crear la primera</Button>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <Select value={cuentaId} onValueChange={setCuentaId}>
                    <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                    <SelectContent>{cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}{c.estado === 'inactiva' ? ' (inactiva)' : ''}</SelectItem>)}</SelectContent>
                  </Select>
                  {cuentaActual && <span className="text-lg font-bold text-emerald-700">{formatCOP(cuentaActual.saldo)}</span>}
                  {cuentaActual && !cuentaActual.saldo_inicial_confirmado && <Badge className="bg-amber-100 text-amber-800">Saldo inicial sin confirmar</Badge>}
                </div>
                {cuentaActual && (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setDialogo('ingreso')}>+ Ingreso</Button>
                    <Button size="sm" variant="outline" onClick={() => setDialogo('egreso')}>− Egreso</Button>
                    <Button size="sm" variant="outline" onClick={() => setDialogo('transferencia')}><ArrowRightLeft className="w-4 h-4 mr-1" />Transferir</Button>
                    {tipo === 'caja' && <Button size="sm" variant="outline" onClick={() => setDialogo('arqueo')}><Scale className="w-4 h-4 mr-1" />Arqueo</Button>}
                  </div>
                )}
              </div>
              <LibroCuenta cuentaId={cuentaId} recargarSenal={recargarSenal} />
            </>
          )}
        </TabsContent>

        <TabsContent value="config" className="pt-4">
          <div className="flex justify-end mb-3">
            {esAdmin && <Button size="sm" onClick={() => { setEditando(null); setDialogo('cuenta'); }}><Plus className="w-4 h-4 mr-1" /> Nueva</Button>}
          </div>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50"><tr className="text-left text-xs text-slate-500">
                <th className="p-2">Nombre</th><th className="p-2">Detalle</th><th className="p-2 text-right">Saldo inicial</th>
                <th className="p-2 text-right">Saldo actual</th><th className="p-2 text-center">Estado</th><th className="p-2"></th>
              </tr></thead>
              <tbody>
                {cuentas.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2 font-medium">{c.nombre}</td>
                    <td className="p-2 text-xs text-slate-500">{[c.entidad, c.tipo_cuenta, c.numero].filter(Boolean).join(' · ') || '—'}</td>
                    <td className="p-2 text-right">{formatCOP(c.saldo_inicial)}{!c.saldo_inicial_confirmado && ' *'}</td>
                    <td className="p-2 text-right font-semibold">{formatCOP(c.saldo)}</td>
                    <td className="p-2 text-center"><Badge className={c.estado === 'activa' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}>{c.estado}</Badge></td>
                    <td className="p-2 text-right">{esAdmin && <Button size="icon" variant="ghost" onClick={() => { setEditando(c); setDialogo('cuenta'); }}><Edit className="w-4 h-4" /></Button>}</td>
                  </tr>
                ))}
                {cuentas.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin cuentas configuradas.</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 mt-2">* Saldo inicial pendiente de confirmar.</p>
        </TabsContent>
      </Tabs>

      <CuentaFormDialog open={dialogo === 'cuenta'} onClose={() => setDialogo(null)} tipo={tipo} cuenta={editando} onGuardado={recargarTodo} />
      <IngresoEgresoDialog open={dialogo === 'ingreso'} onClose={() => setDialogo(null)} tipo="ingreso" cuentas={cuentas} cuentaFija={cuentaActual} onGuardado={recargarTodo} />
      <IngresoEgresoDialog open={dialogo === 'egreso'} onClose={() => setDialogo(null)} tipo="egreso" cuentas={cuentas} cuentaFija={cuentaActual} onGuardado={recargarTodo} />
      <TransferenciaDialog open={dialogo === 'transferencia'} onClose={() => setDialogo(null)} cuentas={todasCuentas} cuentaOrigenFija={cuentaActual} onGuardado={recargarTodo} />
      {cuentaActual && <AjusteArqueoDialog open={dialogo === 'arqueo'} onClose={() => setDialogo(null)} cuenta={cuentaActual} onGuardado={recargarTodo} />}
    </div>
  );
}
