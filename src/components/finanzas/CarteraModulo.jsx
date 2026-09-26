import React, { useEffect, useState, useCallback } from 'react';
import PageHeader from '../common/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, DollarSign, FileText, Ban } from 'lucide-react';
import { fin } from '@/api/finanzas';
import { anularOperacionFinanciera } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError, ESTADO_OBLIGACION } from './utils';
import { CobroPagoDialog, NotaDialog, AnticipoDialog, CruceAnticipoDialog } from './CarteraDialogs';
import { useAuth } from '@/lib/AuthContext';

// Módulo genérico de Cuentas por Cobrar / Cuentas por Pagar: cartera, cobro/pago, notas,
// anticipos y su cruce. naturaleza: 'por_cobrar' | 'por_pagar'.
export default function CarteraModulo({ naturaleza, titulo, descripcion, etiquetaTercero }) {
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin';
  const esCxc = naturaleza === 'por_cobrar';
  const [obligaciones, setObligaciones] = useState([]);
  const [anticipos, setAnticipos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('__todas__');
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionada, setSeleccionada] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [vistaAnticipos, setVistaAnticipos] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [obls, ants, cts] = await Promise.all([
        fin.get('/obligaciones', { naturaleza }),
        fin.get('/obligaciones', { naturaleza: esCxc ? 'anticipo_cliente' : 'anticipo_proveedor' }),
        fin.get('/cuentas'),
      ]);
      setObligaciones(obls); setAnticipos(ants); setCuentas(cts);
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, [naturaleza, esCxc]);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirDetalle = async (o) => {
    setSeleccionada(o); setDetalle(null);
    try { setDetalle(await fin.get(`/obligaciones/${o.id}`)); } catch (e) { setError(mensajeError(e)); }
  };

  const filtradas = obligaciones.filter((o) =>
    (filtroEstado === '__todas__' || o.estado === filtroEstado) &&
    (!busqueda || `${o.tercero_nombre} ${o.documento_numero}`.toLowerCase().includes(busqueda.toLowerCase())));
  const totalPendiente = filtradas.filter((o) => o.estado !== 'anulada' && o.estado !== 'pagada').reduce((s, o) => s + o.saldo, 0);
  const totalVencido = filtradas.filter((o) => o.estado === 'vencida').reduce((s, o) => s + o.saldo, 0);

  const anticiposFiltrados = anticipos.filter((a) => !busqueda || a.tercero_nombre?.toLowerCase().includes(busqueda.toLowerCase()));

  return (
    <div className="p-6">
      <PageHeader title={titulo} description={descripcion} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs text-slate-500">Total pendiente (filtro actual)</p><p className="text-xl font-bold">{formatCOP(totalPendiente)}</p></div>
        <div className="border rounded-lg p-3 bg-red-50"><p className="text-xs text-red-600">Vencido</p><p className="text-xl font-bold text-red-700">{formatCOP(totalVencido)}</p></div>
        <div className="border rounded-lg p-3 bg-blue-50"><p className="text-xs text-blue-600">Anticipos disponibles</p><p className="text-xl font-bold text-blue-700">{formatCOP(anticipos.reduce((s, a) => s + a.saldo, 0))}</p></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex gap-2">
          <Button size="sm" variant={!vistaAnticipos ? 'default' : 'outline'} onClick={() => setVistaAnticipos(false)}>Cartera</Button>
          <Button size="sm" variant={vistaAnticipos ? 'default' : 'outline'} onClick={() => setVistaAnticipos(true)}>Anticipos ({anticipos.length})</Button>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder={`Buscar ${etiquetaTercero.toLowerCase()} o documento…`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-56" />
          {!vistaAnticipos && (
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todos los estados</SelectItem>
                {Object.entries(ESTADO_OBLIGACION).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {vistaAnticipos && <Button size="sm" onClick={() => setDialogo('anticipo')}><Plus className="w-4 h-4 mr-1" />Nuevo anticipo</Button>}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">{error}</p>}

      {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : vistaAnticipos ? (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr className="text-left text-xs text-slate-500"><th className="p-2">Documento</th><th className="p-2">{etiquetaTercero}</th><th className="p-2">Fecha</th><th className="p-2 text-right">Valor</th><th className="p-2 text-right">Disponible</th></tr></thead>
            <tbody>
              {anticiposFiltrados.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="p-2 font-mono">{a.documento_numero}</td><td className="p-2">{a.tercero_nombre}</td>
                  <td className="p-2">{formatFecha(a.fecha)}</td><td className="p-2 text-right">{formatCOP(a.valor_original)}</td>
                  <td className="p-2 text-right font-semibold">{formatCOP(a.saldo)}</td>
                </tr>
              ))}
              {anticiposFiltrados.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin anticipos.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr className="text-left text-xs text-slate-500">
              <th className="p-2">Documento</th><th className="p-2">{etiquetaTercero}</th><th className="p-2">Vence</th>
              <th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-center">Estado</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {filtradas.map((o) => {
                const est = ESTADO_OBLIGACION[o.estado] || ESTADO_OBLIGACION.pendiente;
                return (
                  <tr key={o.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => abrirDetalle(o)}>
                    <td className="p-2 font-mono">{o.documento_numero}</td>
                    <td className="p-2">{o.tercero_nombre}</td>
                    <td className="p-2">{formatFecha(o.fecha_vencimiento)}{o.estado === 'vencida' && <span className="text-red-600 text-xs ml-1">({o.dias_vencida}d)</span>}</td>
                    <td className="p-2 text-right">{formatCOP(o.valor_original)}</td>
                    <td className="p-2 text-right font-semibold">{formatCOP(o.saldo)}</td>
                    <td className="p-2 text-center"><Badge className={est.clase}>{est.label}</Badge></td>
                    <td className="p-2 text-right">
                      {o.estado !== 'pagada' && o.estado !== 'anulada' && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); abrirDetalle(o); setDialogo('cobro'); }}>
                          <DollarSign className="w-3.5 h-3.5 mr-1" />{esCxc ? 'Cobrar' : 'Pagar'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtradas.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">Sin cuentas en este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle: historial de aplicaciones (abonos, notas, retenciones) */}
      <Dialog open={!!seleccionada && !dialogo} onOpenChange={() => setSeleccionada(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{seleccionada?.documento_numero} · {seleccionada?.tercero_nombre}</DialogTitle></DialogHeader>
          {detalle && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded p-2 text-xs">
                <div>Total: <strong>{formatCOP(detalle.valor_original)}</strong></div>
                <div>Aplicado: <strong>{formatCOP(detalle.aplicado)}</strong></div>
                <div>Saldo: <strong>{formatCOP(detalle.saldo)}</strong></div>
              </div>
              {detalle.documento_modulo && (
                <p className="text-xs text-slate-500">Documento de origen: {detalle.documento_modulo === 'OrdenVenta' ? 'Venta' : detalle.documento_modulo === 'OrdenCompra' ? 'Compra' : detalle.documento_modulo}</p>
              )}
              <table className="w-full text-xs border rounded">
                <thead className="bg-slate-100"><tr><th className="p-1.5 text-left">Fecha</th><th className="p-1.5 text-left">Tipo</th><th className="p-1.5 text-left">Documento</th><th className="p-1.5 text-right">Valor</th><th className="p-1.5"></th></tr></thead>
                <tbody>
                  {detalle.aplicaciones.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="p-1.5">{formatFecha(a.fecha)}</td><td className="p-1.5 capitalize">{a.tipo.replace(/_/g, ' ')}</td>
                      <td className="p-1.5 font-mono">{a.documento_numero || '—'}</td><td className="p-1.5 text-right">{formatCOP(a.valor)}</td>
                      <td className="p-1.5 text-right">{esAdmin && a.tipo !== 'reversa' && (
                        <button title="Anular" onClick={async () => { if (await anularOperacionFinanciera(a.operacion_id, `${a.tipo} de ${formatCOP(a.valor)}`)) { cargar(); abrirDetalle(seleccionada); } }}>
                          <Ban className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}</td>
                    </tr>
                  ))}
                  {detalle.aplicaciones.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-400">Sin abonos ni notas todavía.</td></tr>}
                </tbody>
              </table>
              <div className="flex justify-end gap-2 pt-2 border-t">
                {detalle.estado !== 'pagada' && detalle.estado !== 'anulada' && anticipos.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => setDialogo('cruce')}>Cruzar anticipo</Button>
                )}
                {detalle.estado !== 'pagada' && detalle.estado !== 'anulada' && <Button size="sm" variant="outline" onClick={() => setDialogo('nota')}><FileText className="w-4 h-4 mr-1" />Nota crédito/débito</Button>}
                {detalle.estado !== 'pagada' && detalle.estado !== 'anulada' && <Button size="sm" onClick={() => setDialogo('cobro')}>{esCxc ? 'Cobrar' : 'Pagar'}</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CobroPagoDialog open={dialogo === 'cobro'} onClose={() => setDialogo(null)} obligacion={seleccionada} cuentas={cuentas}
        onGuardado={() => { cargar(); if (seleccionada) abrirDetalle(seleccionada); }} />
      <NotaDialog open={dialogo === 'nota'} onClose={() => setDialogo(null)} obligacion={seleccionada}
        onGuardado={() => { cargar(); if (seleccionada) abrirDetalle(seleccionada); }} />
      <CruceAnticipoDialog open={dialogo === 'cruce'} onClose={() => setDialogo(null)} obligacion={seleccionada} anticipos={anticipos}
        onGuardado={() => { cargar(); if (seleccionada) abrirDetalle(seleccionada); }} />
      <AnticipoDialog open={dialogo === 'anticipo'} onClose={() => setDialogo(null)} naturaleza={naturaleza} cuentas={cuentas} onGuardado={cargar} />
    </div>
  );
}
