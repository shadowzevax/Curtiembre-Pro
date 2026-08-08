import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoExterno, InventarioEnProceso, MovimientoInventario, Proveedor, ProductoCatalogo } from '@/entities/all';
import { useAuth } from '@/lib/AuthContext';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Eye, PackageCheck, XCircle, Search } from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d + 'T00:00:00').toLocaleDateString('es-CO'); } catch { return d; } };
const today = () => new Date().toISOString().split('T')[0];

// Estados del proceso externo. "pendiente"/"en_proceso" quedan por
// compatibilidad con registros viejos; el flujo nuevo usa enviado →
// recibido_parcial → recibido_total (o cancelado en cualquier punto antes
// de recibirse por completo).
const ESTADO_BADGE = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  enviado: 'bg-blue-100 text-blue-800',
  en_proceso: 'bg-purple-100 text-purple-800',
  recibido: 'bg-green-100 text-green-800',
  recibido_parcial: 'bg-amber-100 text-amber-800',
  recibido_total: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
};
const ESTADO_LABEL = {
  pendiente: 'Pendiente', enviado: 'Enviado', en_proceso: 'En Proceso',
  recibido: 'Recibido Totalmente', recibido_parcial: 'Recibido Parcialmente', recibido_total: 'Recibido Totalmente',
  cancelado: 'Cancelado',
};
const diasTranscurridos = (fechaSalida, fechaFin) => {
  if (!fechaSalida) return null;
  const fin = fechaFin ? new Date(fechaFin + 'T00:00:00') : new Date();
  const inicio = new Date(fechaSalida + 'T00:00:00');
  return Math.max(0, Math.round((fin - inicio) / 86400000));
};
const agregarHistorial = (proceso, entrada, usuario) => ([
  ...(proceso.historial || []),
  { fecha: today(), hora: new Date().toTimeString().slice(0, 5), usuario: usuario || 'Sistema', ...entrada },
]);

export default function ProcesosExternos() {
  const { user } = useAuth();
  const usuarioActual = user?.full_name || user?.email || 'Sistema';
  const [procesos, setProcesos] = useState([]);
  const [inventarioProceso, setInventarioProceso] = useState([]);
  const [tiposProceso, setTiposProceso] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('procesos');

  const [showEnvioModal, setShowEnvioModal] = useState(false);
  const [recepcionProceso, setRecepcionProceso] = useState(null);
  const [detalleProceso, setDetalleProceso] = useState(null);

  const [filtros, setFiltros] = useState({ fecha: '', proveedor: '', estado: '', tipo: '', producto: '', lote: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procData, invData, tiposData, provData] = await Promise.all([
        ProcesoExterno.list('-created_date'),
        InventarioEnProceso.list(),
        ProductoCatalogo.filter({ categoria: 'tipo_proceso_externo' }),
        Proveedor.list(),
      ]);
      setProcesos(Array.isArray(procData) ? procData : []);
      setInventarioProceso(Array.isArray(invData) ? invData : []);
      setTiposProceso((Array.isArray(tiposData) ? tiposData : []).filter(t => t.estado === 'activo'));
      setProveedores(Array.isArray(provData) ? provData : []);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Indicadores ─────────────────────────────────────────────────────────
  const pendientesCount = procesos.filter(p => ['pendiente', 'enviado', 'en_proceso', 'recibido_parcial'].includes(p.estado)).length;
  const recibidosCount = procesos.filter(p => p.estado === 'recibido' || p.estado === 'recibido_total').length;
  const valorTotalServicios = procesos.reduce((s, p) => s + (parseFloat(p.valor_total_servicio) || 0), 0);

  // ── Filtro de listado ───────────────────────────────────────────────────
  const normalize = (s) => (s || '').toLowerCase();
  const procesosFiltrados = procesos.filter(p => {
    if (filtros.fecha && p.fecha_salida !== filtros.fecha) return false;
    if (filtros.proveedor && p.proveedor_id !== filtros.proveedor) return false;
    if (filtros.estado && p.estado !== filtros.estado) return false;
    if (filtros.tipo && p.tipo_proceso_codigo !== filtros.tipo) return false;
    if (filtros.producto && !normalize(p.codigo_producto_proceso).includes(normalize(filtros.producto))) return false;
    if (filtros.lote && !normalize(p.codigo_lote).includes(normalize(filtros.lote))) return false;
    return true;
  });

  // ── Reportes ────────────────────────────────────────────────────────────
  const costosPorProveedor = React.useMemo(() => {
    const map = {};
    procesos.forEach(p => {
      const key = p.proveedor_nombre || 'Sin proveedor';
      map[key] = (map[key] || 0) + (parseFloat(p.valor_total_servicio) || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [procesos]);

  const costosPorTipo = React.useMemo(() => {
    const map = {};
    procesos.forEach(p => {
      const key = p.tipo_proceso_nombre || 'Sin tipo';
      map[key] = (map[key] || 0) + (parseFloat(p.valor_total_servicio) || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [procesos]);

  const costosPorLote = React.useMemo(() => {
    const map = {};
    procesos.forEach(p => {
      const key = p.codigo_lote_padre || p.codigo_lote || 'Sin lote';
      map[key] = (map[key] || 0) + (parseFloat(p.valor_total_servicio) || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [procesos]);

  const materialVencido = React.useMemo(() => {
    const hoy = today();
    return procesos.filter(p =>
      ['enviado', 'en_proceso', 'recibido_parcial'].includes(p.estado) &&
      p.fecha_estimada_regreso && p.fecha_estimada_regreso < hoy
    );
  }, [procesos]);

  const historialCompleto = React.useMemo(() => {
    const filas = [];
    procesos.forEach(p => (p.historial || []).forEach(h => filas.push({ ...h, numero_proceso: p.numero_proceso })));
    return filas.sort((a, b) => new Date(`${b.fecha}T${b.hora || '00:00'}`) - new Date(`${a.fecha}T${a.hora || '00:00'}`));
  }, [procesos]);

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Procesos Externos"
        description="Administración de procesos realizados por terceros (lijado, grabado, estampado, planchado y otros)"
        actionButton={
          <Button onClick={() => setShowEnvioModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Envío
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { l: 'Pendientes/En Curso', v: pendientesCount, c: 'amber' },
          { l: 'Recibidos', v: recibidosCount, c: 'green' },
          { l: 'Total Procesos', v: procesos.length, c: 'blue' },
          { l: 'Valor Total Servicios', v: formatCurrency(valorTotalServicios), c: 'purple' },
        ].map(k => (
          <div key={k.l} className={`bg-${k.c}-50 border border-${k.c}-200 rounded-xl p-2 text-center`}>
            <p className="text-xs text-slate-500 leading-tight">{k.l}</p>
            <p className={`text-lg font-extrabold text-${k.c}-700`}>{k.v}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="procesos">📋 Procesos</TabsTrigger>
          <TabsTrigger value="reportes">📈 Reportes</TabsTrigger>
        </TabsList>

        <TabsContent value="procesos">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Consulta de Procesos Externos</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-3">
                <Input type="date" value={filtros.fecha} onChange={e => setFiltros(f => ({ ...f, fecha: e.target.value }))} className="text-xs" />
                <Select value={filtros.proveedor || '__all__'} onValueChange={v => setFiltros(f => ({ ...f, proveedor: v === '__all__' ? '' : v }))}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Proveedor..." /></SelectTrigger>
                  <SelectContent><SelectItem value="__all__">Todos los proveedores</SelectItem>{proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={filtros.estado || '__all__'} onValueChange={v => setFiltros(f => ({ ...f, estado: v === '__all__' ? '' : v }))}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Estado..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos los estados</SelectItem>
                    {Object.keys(ESTADO_LABEL).map(k => <SelectItem key={k} value={k}>{ESTADO_LABEL[k]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filtros.tipo || '__all__'} onValueChange={v => setFiltros(f => ({ ...f, tipo: v === '__all__' ? '' : v }))}>
                  <SelectTrigger className="text-xs"><SelectValue placeholder="Tipo de proceso..." /></SelectTrigger>
                  <SelectContent><SelectItem value="__all__">Todos los tipos</SelectItem>{tiposProceso.map(t => <SelectItem key={t.id} value={t.codigo}>{t.descripcion}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Producto..." value={filtros.producto} onChange={e => setFiltros(f => ({ ...f, producto: e.target.value }))} className="text-xs" />
                <Input placeholder="Lote..." value={filtros.lote} onChange={e => setFiltros(f => ({ ...f, lote: e.target.value }))} className="text-xs" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-2 text-left">N.º Proceso</th>
                      <th className="p-2 text-left">Tipo</th>
                      <th className="p-2 text-left">Proveedor</th>
                      <th className="p-2 text-left">Producto Enviado</th>
                      <th className="p-2 text-left">Producto Recibido</th>
                      <th className="p-2 text-right">Enviada</th>
                      <th className="p-2 text-right">Recibida</th>
                      <th className="p-2 text-right">Pendiente</th>
                      <th className="p-2 text-right">Valor Servicio</th>
                      <th className="p-2 text-left">F. Salida</th>
                      <th className="p-2 text-left">F. Recepción</th>
                      <th className="p-2 text-center">Estado</th>
                      <th className="p-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={13} className="p-4 text-center text-slate-400">Cargando...</td></tr>
                    ) : procesosFiltrados.length === 0 ? (
                      <tr><td colSpan={13} className="p-4 text-center text-slate-400">No hay procesos externos registrados.</td></tr>
                    ) : procesosFiltrados.map(p => {
                      const pend = Math.max(0, (p.cantidad_enviada || 0) - (p.cantidad_recibida || 0) - (p.cantidad_rechazada || 0));
                      return (
                        <tr key={p.id} className="border-t hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-blue-700">{p.numero_proceso}</td>
                          <td className="p-2">{p.tipo_proceso_nombre || '—'}</td>
                          <td className="p-2">{p.proveedor_nombre || '—'}</td>
                          <td className="p-2">{p.codigo_producto_proceso} <span className="text-slate-400">— {p.descripcion_producto_proceso}</span></td>
                          <td className="p-2">{p.producto_recibido_codigo ? <>{p.producto_recibido_codigo} <span className="text-slate-400">— {p.producto_recibido_descripcion}</span></> : '—'}</td>
                          <td className="p-2 text-right font-bold">{p.cantidad_enviada}</td>
                          <td className="p-2 text-right text-emerald-700">{p.cantidad_recibida || 0}</td>
                          <td className="p-2 text-right text-amber-700">{['enviado', 'en_proceso', 'recibido_parcial'].includes(p.estado) ? pend : 0}</td>
                          <td className="p-2 text-right">{formatCurrency(p.valor_total_servicio)}</td>
                          <td className="p-2">{fmtDate(p.fecha_salida)}</td>
                          <td className="p-2">{fmtDate(p.fecha_recepcion)}</td>
                          <td className="p-2 text-center"><Badge className={`text-xs ${ESTADO_BADGE[p.estado]}`}>{ESTADO_LABEL[p.estado]}</Badge></td>
                          <td className="p-2 text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetalleProceso(p)} title="Ver detalle"><Eye className="w-3 h-3" /></Button>
                              {['enviado', 'en_proceso', 'recibido_parcial'].includes(p.estado) && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-emerald-600" onClick={() => setRecepcionProceso(p)} title="Recibir Proceso Externo"><PackageCheck className="w-3 h-3" /></Button>
                              )}
                              {['pendiente', 'enviado'].includes(p.estado) && (
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => handleCancelar(p, loadData, usuarioActual)} title="Cancelar"><XCircle className="w-3 h-3" /></Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reportes">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Procesos Externos Pendientes</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead className="bg-slate-100"><tr><th className="p-2 text-left">N.º Proceso</th><th className="p-2 text-left">Producto</th><th className="p-2 text-right">Enviada</th><th className="p-2 text-left">F. Estimada Regreso</th></tr></thead>
                  <tbody>
                    {procesos.filter(p => ['pendiente', 'enviado', 'en_proceso', 'recibido_parcial'].includes(p.estado)).map(p => (
                      <tr key={p.id} className="border-t"><td className="p-2 font-mono">{p.numero_proceso}</td><td className="p-2">{p.codigo_producto_proceso}</td><td className="p-2 text-right">{p.cantidad_enviada}</td><td className="p-2">{fmtDate(p.fecha_estimada_regreso)}</td></tr>
                    ))}
                    {procesos.filter(p => ['pendiente', 'enviado', 'en_proceso', 'recibido_parcial'].includes(p.estado)).length === 0 && <tr><td colSpan={4} className="p-3 text-center text-slate-400">Sin pendientes.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Procesos Finalizados</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead className="bg-slate-100"><tr><th className="p-2 text-left">N.º Proceso</th><th className="p-2 text-left">Producto Recibido</th><th className="p-2 text-right">Recibida</th><th className="p-2 text-left">F. Recepción</th></tr></thead>
                  <tbody>
                    {procesos.filter(p => p.estado === 'recibido' || p.estado === 'recibido_total').map(p => (
                      <tr key={p.id} className="border-t"><td className="p-2 font-mono">{p.numero_proceso}</td><td className="p-2">{p.producto_recibido_codigo}</td><td className="p-2 text-right">{p.cantidad_recibida}</td><td className="p-2">{fmtDate(p.fecha_recepcion)}</td></tr>
                    ))}
                    {procesos.filter(p => p.estado === 'recibido' || p.estado === 'recibido_total').length === 0 && <tr><td colSpan={4} className="p-3 text-center text-slate-400">Sin procesos finalizados.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Costos por Proveedor</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead className="bg-slate-100"><tr><th className="p-2 text-left">Proveedor</th><th className="p-2 text-right">Valor Total</th></tr></thead>
                  <tbody>
                    {costosPorProveedor.map(([nombre, valor]) => <tr key={nombre} className="border-t"><td className="p-2">{nombre}</td><td className="p-2 text-right font-bold">{formatCurrency(valor)}</td></tr>)}
                    {costosPorProveedor.length === 0 && <tr><td colSpan={2} className="p-3 text-center text-slate-400">Sin datos.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Costos por Tipo de Proceso</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead className="bg-slate-100"><tr><th className="p-2 text-left">Tipo de Proceso</th><th className="p-2 text-right">Valor Total</th></tr></thead>
                  <tbody>
                    {costosPorTipo.map(([nombre, valor]) => <tr key={nombre} className="border-t"><td className="p-2">{nombre}</td><td className="p-2 text-right font-bold">{formatCurrency(valor)}</td></tr>)}
                    {costosPorTipo.length === 0 && <tr><td colSpan={2} className="p-3 text-center text-slate-400">Sin datos.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Costos por Lote</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead className="bg-slate-100"><tr><th className="p-2 text-left">Lote</th><th className="p-2 text-right">Valor Total</th></tr></thead>
                  <tbody>
                    {costosPorLote.map(([lote, valor]) => <tr key={lote} className="border-t"><td className="p-2 font-mono">{lote}</td><td className="p-2 text-right font-bold">{formatCurrency(valor)}</td></tr>)}
                    {costosPorLote.length === 0 && <tr><td colSpan={2} className="p-3 text-center text-slate-400">Sin datos.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card className="border-red-300">
              <CardHeader className="pb-2"><CardTitle className="text-base text-red-700">Material Vencido (superó la fecha estimada de regreso)</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead className="bg-slate-100"><tr><th className="p-2 text-left">N.º Proceso</th><th className="p-2 text-left">Proveedor</th><th className="p-2 text-left">Producto</th><th className="p-2 text-left">F. Estimada</th><th className="p-2 text-right">Días de Atraso</th></tr></thead>
                  <tbody>
                    {materialVencido.map(p => (
                      <tr key={p.id} className="border-t"><td className="p-2 font-mono">{p.numero_proceso}</td><td className="p-2">{p.proveedor_nombre}</td><td className="p-2">{p.codigo_producto_proceso}</td><td className="p-2">{fmtDate(p.fecha_estimada_regreso)}</td><td className="p-2 text-right font-bold text-red-700">{diasTranscurridos(p.fecha_estimada_regreso)}</td></tr>
                    ))}
                    {materialVencido.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-slate-400">Sin material vencido.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card className="md:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-base">Historial de Movimientos</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100"><tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Hora</th><th className="p-2 text-left">Usuario</th><th className="p-2 text-left">Proceso</th><th className="p-2 text-left">Movimiento</th><th className="p-2 text-right">Cantidad</th></tr></thead>
                    <tbody>
                      {historialCompleto.map((h, i) => (
                        <tr key={i} className="border-t"><td className="p-2">{fmtDate(h.fecha)}</td><td className="p-2">{h.hora}</td><td className="p-2">{h.usuario}</td><td className="p-2 font-mono">{h.numero_proceso}</td><td className="p-2">{h.movimiento}</td><td className="p-2 text-right font-semibold">{h.cantidad}</td></tr>
                      ))}
                      {historialCompleto.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-slate-400">Sin movimientos registrados.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ══ MODAL ENVÍO ══ */}
      {showEnvioModal && (
        <EnvioModal
          inventarioProceso={inventarioProceso}
          tiposProceso={tiposProceso}
          proveedores={proveedores}
          procesos={procesos}
          usuarioActual={usuarioActual}
          onClose={() => setShowEnvioModal(false)}
          onSave={loadData}
        />
      )}

      {/* ══ MODAL RECEPCIÓN ══ */}
      {recepcionProceso && (
        <RecepcionModal
          proceso={recepcionProceso}
          usuarioActual={usuarioActual}
          onClose={() => setRecepcionProceso(null)}
          onSave={loadData}
        />
      )}

      {/* ══ MODAL DETALLE ══ */}
      {detalleProceso && (
        <Dialog open={true} onOpenChange={() => setDetalleProceso(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Detalle del Proceso — {detalleProceso.numero_proceso}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Tipo de Proceso', detalleProceso.tipo_proceso_nombre],
                ['Proveedor', detalleProceso.proveedor_nombre],
                ['Producto Enviado', `${detalleProceso.codigo_producto_proceso} — ${detalleProceso.descripcion_producto_proceso}`],
                ['Lote Padre', detalleProceso.codigo_lote_padre || '—'],
                ['Código de Sublote', detalleProceso.codigo_lote],
                ['Color Base', detalleProceso.color_base],
                ['Calibre', detalleProceso.calibre],
                ['Cantidad Enviada', detalleProceso.cantidad_enviada],
                ['Valor por Hoja', formatCurrency(detalleProceso.valor_por_hoja)],
                ['Valor Total del Servicio', formatCurrency(detalleProceso.valor_total_servicio)],
                ['Fecha de Salida', fmtDate(detalleProceso.fecha_salida)],
                ['Fecha Estimada de Regreso', fmtDate(detalleProceso.fecha_estimada_regreso)],
                ['Estado', ESTADO_LABEL[detalleProceso.estado]],
                ['Días Transcurridos Fuera', `${diasTranscurridos(detalleProceso.fecha_salida, ['recibido', 'recibido_total'].includes(detalleProceso.estado) ? detalleProceso.fecha_recepcion : null) ?? '—'} días`],
                ['Producto Recibido (último)', detalleProceso.producto_recibido_codigo ? `${detalleProceso.producto_recibido_codigo} — ${detalleProceso.producto_recibido_descripcion}` : '—'],
                ['Cantidad Recibida (acumulada)', detalleProceso.cantidad_recibida || 0],
                ['Cantidad Rechazada (acumulada)', detalleProceso.cantidad_rechazada || 0],
                ['Cantidad Pendiente', Math.max(0, (detalleProceso.cantidad_enviada || 0) - (detalleProceso.cantidad_recibida || 0) - (detalleProceso.cantidad_rechazada || 0))],
                ['Fecha de Última Recepción', fmtDate(detalleProceso.fecha_recepcion)],
                ['Responsable que Recibió', detalleProceso.responsable_recepcion || '—'],
                ['Observaciones de Envío', detalleProceso.observaciones || '—'],
                ['Observaciones de Recepción', detalleProceso.observaciones_recepcion || '—'],
              ].map(([label, val]) => (
                <div key={label} className="bg-slate-50 rounded p-2"><p className="text-slate-500 font-semibold">{label}</p><p className="font-bold text-slate-800">{val ?? '—'}</p></div>
              ))}
            </div>

            <div className="mt-3">
              <p className="text-xs font-bold text-slate-600 mb-1">Historial de Trazabilidad</p>
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100">
                    <tr><th className="p-1.5 text-left">Fecha</th><th className="p-1.5 text-left">Hora</th><th className="p-1.5 text-left">Usuario</th><th className="p-1.5 text-left">Movimiento</th><th className="p-1.5 text-right">Cantidad</th><th className="p-1.5 text-left">Origen → Destino</th></tr>
                  </thead>
                  <tbody>
                    {(detalleProceso.historial || []).length === 0 ? (
                      <tr><td colSpan={6} className="p-2 text-center text-slate-400">Sin movimientos registrados.</td></tr>
                    ) : (detalleProceso.historial || []).map((h, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-1.5">{fmtDate(h.fecha)}</td>
                        <td className="p-1.5">{h.hora || '—'}</td>
                        <td className="p-1.5">{h.usuario || '—'}</td>
                        <td className="p-1.5">{h.movimiento}</td>
                        <td className="p-1.5 text-right font-semibold">{h.cantidad}</td>
                        <td className="p-1.5">{h.origen} → {h.destino}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-4"><Button variant="outline" onClick={() => setDetalleProceso(null)}>Cerrar</Button></div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ── Cancelar un proceso (solo si aún no fue recibido) ──────────────────────
async function handleCancelar(proceso, reload, usuarioActual) {
  // No se puede cancelar un proceso que ya generó movimientos de recepción:
  // haría falta revertir inventario ya reingresado y consumido, con riesgo
  // de inconsistencias. Debe manejarse manualmente en ese caso.
  if ((parseFloat(proceso.cantidad_recibida) || 0) > 0) {
    alert('❌ No es posible cancelar: este proceso ya tiene recepciones registradas. Cancelar aquí solo aplica a procesos que todavía no han recibido nada.');
    return;
  }
  if (!confirm(`¿Cancelar el proceso ${proceso.numero_proceso}? Si ya fue enviado, las hojas descontadas se devolverán al Inventario en Proceso de origen.`)) return;
  try {
    let historial = proceso.historial || [];
    if (proceso.estado === 'enviado' && proceso.inv_proceso_id) {
      const inv = (await InventarioEnProceso.filter({ id: proceso.inv_proceso_id }))[0]
        || (await InventarioEnProceso.list()).find(i => i.id === proceso.inv_proceso_id);
      if (inv) {
        await InventarioEnProceso.update(inv.id, { cantidad_hojas: (parseFloat(inv.cantidad_hojas) || 0) + (parseFloat(proceso.cantidad_enviada) || 0) });
        await MovimientoInventario.create({
          tipo_movimiento: 'entrada', insumo_id: inv.id, cantidad: proceso.cantidad_enviada, costo_unitario: inv.costo_promedio || 0,
          fecha_movimiento: today(), referencia: proceso.numero_proceso,
          observaciones: `Reverso por cancelación de Proceso Externo ${proceso.numero_proceso}`,
        });
        historial = agregarHistorial(proceso, {
          movimiento: 'Cancelación — reverso de envío', cantidad: proceso.cantidad_enviada,
          origen: 'Inventario de Procesos Externos', destino: 'Inventario en Proceso',
          proceso: proceso.numero_proceso, lote: proceso.codigo_lote_padre, sublote: proceso.codigo_lote, proveedor: proceso.proveedor_nombre,
        }, usuarioActual);
      }
    }
    await ProcesoExterno.update(proceso.id, { estado: 'cancelado', historial });
    reload();
  } catch (err) {
    alert('Error al cancelar: ' + err.message);
  }
}

// ── EnvioModal ──────────────────────────────────────────────────────────────
function EnvioModal({ inventarioProceso, tiposProceso, proveedores, procesos, usuarioActual, onClose, onSave }) {
  const [invId, setInvId] = useState('');
  const [tipoProcesoId, setTipoProcesoId] = useState('');
  const [proveedorId, setProveedorId] = useState('');
  const [cantidad, setCantidad] = useState(0);
  const [valorPorHoja, setValorPorHoja] = useState(0);
  const [fechaSalida, setFechaSalida] = useState(today());
  const [fechaEstimada, setFechaEstimada] = useState('');
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);

  const invDisponibles = inventarioProceso.filter(i => (parseFloat(i.cantidad_hojas) || 0) > 0);
  const invSel = inventarioProceso.find(i => i.id === invId);
  const disponible = invSel ? Math.max(0, (parseFloat(invSel.cantidad_hojas) || 0) - (parseFloat(invSel.hojas_reservadas) || 0)) : 0;
  const valorTotal = (parseFloat(cantidad) || 0) * (parseFloat(valorPorHoja) || 0);
  const tipoSel = tiposProceso.find(t => t.id === tipoProcesoId);
  const provSel = proveedores.find(p => p.id === proveedorId);

  const handleGuardar = async () => {
    if (!invSel) { alert('Seleccione el producto en proceso de origen.'); return; }
    if (!tipoSel) { alert('Seleccione el tipo de proceso.'); return; }
    if (!provSel) { alert('Seleccione el proveedor.'); return; }
    const cant = parseFloat(cantidad) || 0;
    if (cant <= 0) { alert('La cantidad enviada debe ser mayor a 0.'); return; }
    if (cant > disponible) { alert(`No hay inventario suficiente. Disponible: ${disponible} hojas.`); return; }
    if (!fechaSalida) { alert('Ingrese la fecha de salida.'); return; }

    setGuardando(true);
    try {
      const year = new Date().getFullYear();
      const existentes = procesos.filter(p => p.numero_proceso?.startsWith(`PE-${year}`));
      const maxNum = existentes.reduce((max, p) => { const n = parseInt(p.numero_proceso?.split('-').pop() || '0'); return n > max ? n : max; }, 0);
      const numero_proceso = `PE-${year}-${String(maxNum + 1).padStart(4, '0')}`;

      const historialInicial = [{
        fecha: fechaSalida, hora: new Date().toTimeString().slice(0, 5), usuario: usuarioActual || 'Sistema',
        movimiento: 'Envío a Proceso Externo', cantidad: cant,
        origen: 'Inventario en Proceso', destino: 'Inventario de Procesos Externos',
        proceso: numero_proceso, lote: invSel.codigo_lote_padre, sublote: invSel.codigo_lote, proveedor: provSel.nombre,
      }];

      await ProcesoExterno.create({
        numero_proceso,
        tipo_proceso_id: tipoSel.id, tipo_proceso_codigo: tipoSel.codigo, tipo_proceso_nombre: tipoSel.descripcion,
        proveedor_id: provSel.id, proveedor_nombre: provSel.nombre,
        inv_proceso_id: invSel.id, codigo_producto_proceso: invSel.codigo_producto_proceso || invSel.codigo, descripcion_producto_proceso: invSel.descripcion_producto_proceso || invSel.descripcion,
        codigo_lote: invSel.codigo_lote, codigo_lote_padre: invSel.codigo_lote_padre, color_base: invSel.color_base, calibre: invSel.calibre,
        unidad_medida: invSel.unidad_medida || 'HOJA',
        cantidad_enviada: cant, valor_por_hoja: parseFloat(valorPorHoja) || 0, valor_total_servicio: valorTotal,
        fecha_salida: fechaSalida, fecha_estimada_regreso: fechaEstimada, observaciones: obs,
        estado: 'enviado', cantidad_recibida: 0, cantidad_rechazada: 0,
        historial: historialInicial,
      });

      // Descuenta inmediatamente el inventario de origen y registra el Kardex.
      await InventarioEnProceso.update(invSel.id, { cantidad_hojas: Math.max(0, (parseFloat(invSel.cantidad_hojas) || 0) - cant) });
      await MovimientoInventario.create({
        tipo_movimiento: 'salida', insumo_id: invSel.id, cantidad: -cant, costo_unitario: invSel.costo_promedio || 0,
        fecha_movimiento: fechaSalida, referencia: numero_proceso,
        observaciones: `Envío a Proceso Externo (${tipoSel.descripcion}) — Proveedor: ${provSel.nombre}`,
      });

      await onSave();
      onClose();
      alert(`✅ Proceso ${numero_proceso} registrado y enviado. Inventario en Proceso actualizado.`);
    } catch (err) {
      alert('Error al guardar el envío: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo Envío a Proceso Externo</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div>
            <Label>Producto en Inventario en Proceso *</Label>
            <Select value={invId} onValueChange={setInvId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto..." /></SelectTrigger>
              <SelectContent className="max-h-64 overflow-y-auto">
                {invDisponibles.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.codigo_producto_proceso || i.codigo} — {i.descripcion_producto_proceso || i.descripcion} ({i.cantidad_hojas} hojas)</SelectItem>
                ))}
                {invDisponibles.length === 0 && <SelectItem value="__none__" disabled>Sin productos disponibles en Inventario en Proceso</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {invSel && (
            <div className="grid grid-cols-3 gap-2 text-xs bg-blue-50 border border-blue-200 rounded p-3">
              <div><span className="text-slate-500">Código:</span> <span className="font-mono font-bold">{invSel.codigo_producto_proceso || invSel.codigo}</span></div>
              <div><span className="text-slate-500">Lote/Sublote:</span> <span className="font-mono">{invSel.codigo_lote || '—'}</span></div>
              <div><span className="text-slate-500">Existencia Disponible:</span> <strong className={disponible === 0 ? 'text-red-600' : 'text-green-700'}>{disponible} hojas</strong></div>
              <div><span className="text-slate-500">Color Base:</span> {invSel.color_base || '—'}</div>
              <div><span className="text-slate-500">Calibre:</span> {invSel.calibre || '—'}</div>
              <div><span className="text-slate-500">Nombre:</span> {invSel.descripcion_producto_proceso || invSel.descripcion || '—'}</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de Proceso *</Label>
              <Select value={tipoProcesoId} onValueChange={setTipoProcesoId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{tiposProceso.map(t => <SelectItem key={t.id} value={t.id}>{t.descripcion}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Proveedor *</Label>
              <Select value={proveedorId} onValueChange={setProveedorId}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Cantidad Enviada * (máx: {disponible})</Label><Input type="number" min="0" max={disponible} value={cantidad} onChange={e => setCantidad(e.target.value)} /></div>
            <div><Label>Valor por Hoja</Label><Input type="number" min="0" value={valorPorHoja} onChange={e => setValorPorHoja(e.target.value)} /></div>
            <div><Label>Fecha de Salida *</Label><Input type="date" value={fechaSalida} onChange={e => setFechaSalida(e.target.value)} /></div>
            <div><Label>Fecha Estimada de Regreso</Label><Input type="date" value={fechaEstimada} onChange={e => setFechaEstimada(e.target.value)} /></div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-right">
            <span className="text-slate-500">Valor Total del Servicio: </span><strong className="text-emerald-700">{formatCurrency(valorTotal)}</strong>
          </div>

          <div><Label>Observaciones</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar Envío'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── RecepcionModal ──────────────────────────────────────────────────────────
function RecepcionModal({ proceso, usuarioActual, onClose, onSave }) {
  const [cantidadRecibida, setCantidadRecibida] = useState(0);
  const [cantidadRechazada, setCantidadRechazada] = useState(0);
  const [fechaRecepcion, setFechaRecepcion] = useState(today());
  const [responsable, setResponsable] = useState('');
  const [obs, setObs] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Producto en Proceso de Destino: se elige del Catálogo Maestro (solo los
  // clasificados como "Productos en Proceso"), nunca se crea uno nuevo desde
  // aquí. Determina el código con el que el material reingresa al inventario.
  const [productosDestino, setProductosDestino] = useState([]);
  const [destinoId, setDestinoId] = useState('');
  const [busquedaDestino, setBusquedaDestino] = useState('');

  useEffect(() => {
    ProductoCatalogo.filter({ categoria: 'productos_en_proceso' })
      .then(data => setProductosDestino((Array.isArray(data) ? data : []).filter(p => p.estado === 'activo')))
      .catch(() => setProductosDestino([]));
  }, []);

  const destinoSel = productosDestino.find(p => p.id === destinoId);
  const destinosFiltrados = productosDestino.filter(p => {
    if (!busquedaDestino) return true;
    const q = busquedaDestino.toLowerCase();
    return (p.codigo || '').toLowerCase().includes(q) || (p.descripcion || '').toLowerCase().includes(q);
  });

  // El proceso puede tener recepciones previas (recepción parcial): lo
  // pendiente se calcula contra lo YA recibido/rechazado acumulado, no
  // contra cero cada vez.
  const yaRecibido = parseFloat(proceso.cantidad_recibida) || 0;
  const yaRechazado = parseFloat(proceso.cantidad_rechazada) || 0;
  const pendienteAntes = Math.max(0, (proceso.cantidad_enviada || 0) - yaRecibido - yaRechazado);
  const pendienteDespues = Math.max(0, pendienteAntes - (parseFloat(cantidadRecibida) || 0) - (parseFloat(cantidadRechazada) || 0));

  const handleGuardar = async () => {
    const recibida = parseFloat(cantidadRecibida) || 0;
    const rechazada = parseFloat(cantidadRechazada) || 0;
    if (recibida < 0 || rechazada < 0) { alert('Las cantidades no pueden ser negativas.'); return; }
    if (recibida + rechazada > pendienteAntes) { alert(`No puede recibir/rechazar más de lo pendiente (${pendienteAntes} hojas).`); return; }
    if (recibida === 0 && rechazada === 0) { alert('Ingrese la cantidad recibida o rechazada.'); return; }
    if (!fechaRecepcion) { alert('Ingrese la fecha de recepción.'); return; }
    if (recibida > 0 && !destinoSel) { alert('Seleccione el Producto en Proceso de Destino.'); return; }

    setGuardando(true);
    try {
      let nuevoInv = null;
      let codigoNuevo = proceso.producto_recibido_codigo;
      let descripcionNueva = proceso.producto_recibido_descripcion;

      if (recibida > 0) {
        // Traer costo acumulado del origen para heredar + prorratear el servicio.
        const origenes = await InventarioEnProceso.filter({ id: proceso.inv_proceso_id });
        const origen = (origenes || [])[0];
        const costoAcumuladoOrigen = origen ? (parseFloat(origen.costo_acumulado) || 0) : 0;
        const costoPorHojaOrigen = (proceso.cantidad_enviada || 0) > 0 ? costoAcumuladoOrigen / proceso.cantidad_enviada : 0;
        const costoServicioPorHoja = (proceso.cantidad_enviada || 0) > 0 ? (parseFloat(proceso.valor_total_servicio) || 0) / proceso.cantidad_enviada : 0;
        const costoAcumuladoNuevo = (costoPorHojaOrigen + costoServicioPorHoja) * recibida;
        const costoPromedioNuevo = recibida > 0 ? costoAcumuladoNuevo / recibida : 0;

        codigoNuevo = destinoSel.codigo;
        descripcionNueva = destinoSel.descripcion;

        // Nunca se mezcla con el producto original: entra con el código del
        // Producto en Proceso de Destino elegido por el usuario, conservando
        // el mismo lote padre y sublote de origen para no perder trazabilidad.
        nuevoInv = await InventarioEnProceso.create({
          codigo: codigoNuevo,
          codigo_producto_proceso: codigoNuevo,
          descripcion: descripcionNueva,
          descripcion_producto_proceso: descripcionNueva,
          codigo_lote: proceso.codigo_lote,
          codigo_lote_padre: proceso.codigo_lote_padre || proceso.codigo_lote,
          color_base: proceso.color_base, calibre: proceso.calibre,
          unidad_medida: proceso.unidad_medida || 'HOJA',
          cantidad_hojas: recibida,
          costo_promedio: costoPromedioNuevo,
          costo_acumulado: costoAcumuladoNuevo,
          origen_modulo: 'procesos_externos',
          etapa_actual: 'proceso_externo',
          estado_actual: 'EN_PROCESO',
          estado_proceso: 'proceso_externo_recibido',
          proceso_origen_id: proceso.id,
          fecha_ingreso_proceso: fechaRecepcion,
        });

        await MovimientoInventario.create({
          tipo_movimiento: 'entrada', insumo_id: nuevoInv.id, cantidad: recibida, costo_unitario: costoPromedioNuevo,
          fecha_movimiento: fechaRecepcion, referencia: proceso.numero_proceso,
          observaciones: `Recepción de Proceso Externo (${proceso.tipo_proceso_nombre}) — Proveedor: ${proceso.proveedor_nombre}${responsable ? ` — Recibe: ${responsable}` : ''}`,
        });
      }

      const totalRecibidoNuevo = yaRecibido + recibida;
      const totalRechazadoNuevo = yaRechazado + rechazada;
      const completo = (totalRecibidoNuevo + totalRechazadoNuevo) >= (proceso.cantidad_enviada || 0);
      const nuevoEstado = completo ? 'recibido_total' : 'recibido_parcial';

      const historial = agregarHistorial(proceso, {
        movimiento: 'Recepción de Proceso Externo', cantidad: recibida,
        origen: `Inventario de Procesos Externos (${proceso.codigo_producto_proceso})`,
        destino: `Inventario en Proceso (${codigoNuevo || '—'})`,
        proceso: proceso.numero_proceso, lote: proceso.codigo_lote_padre, sublote: nuevoInv?.codigo_lote || proceso.codigo_lote, proveedor: proceso.proveedor_nombre,
      }, usuarioActual);
      if (rechazada > 0) {
        historial.push({
          fecha: fechaRecepcion, hora: new Date().toTimeString().slice(0, 5), usuario: usuarioActual || 'Sistema',
          movimiento: 'Rechazo en recepción', cantidad: rechazada,
          origen: 'Inventario de Procesos Externos', destino: '—',
          proceso: proceso.numero_proceso, lote: proceso.codigo_lote_padre, sublote: proceso.codigo_lote, proveedor: proceso.proveedor_nombre,
        });
      }

      await ProcesoExterno.update(proceso.id, {
        estado: nuevoEstado,
        cantidad_recibida: totalRecibidoNuevo, cantidad_rechazada: totalRechazadoNuevo,
        fecha_recepcion: fechaRecepcion, observaciones_recepcion: obs, responsable_recepcion: responsable,
        ...(nuevoInv ? { producto_recibido_id: nuevoInv.id, producto_recibido_codigo: codigoNuevo, producto_recibido_descripcion: descripcionNueva } : {}),
        historial,
      });

      await onSave();
      onClose();
      alert(completo
        ? `✅ Recepción completa. El proceso ${proceso.numero_proceso} quedó Recibido Totalmente.`
        : `✅ Recepción parcial registrada (${recibida} hojas). Quedan ${pendienteDespues} hojas pendientes de regresar.`);
    } catch (err) {
      alert('Error al registrar la recepción: ' + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Recibir Proceso Externo — {proceso.numero_proceso}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs grid grid-cols-2 gap-2">
            <div><span className="text-slate-500">Proveedor:</span> <strong>{proceso.proveedor_nombre}</strong></div>
            <div><span className="text-slate-500">Tipo de proceso:</span> <strong>{proceso.tipo_proceso_nombre}</strong></div>
            <div><span className="text-slate-500">Producto:</span> {proceso.codigo_producto_proceso}</div>
            <div><span className="text-slate-500">Lote padre / Sublote:</span> {proceso.codigo_lote_padre || '—'} / {proceso.codigo_lote}</div>
            <div><span className="text-slate-500">Cantidad enviada:</span> <strong>{proceso.cantidad_enviada}</strong></div>
            <div><span className="text-slate-500">Ya recibido/rechazado:</span> {yaRecibido} / {yaRechazado}</div>
            <div className="col-span-2"><span className="text-slate-500">Cantidad pendiente actual:</span> <strong className="text-amber-700">{pendienteAntes}</strong></div>
          </div>

          <div>
            <Label>Producto en Proceso de Destino *</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger><SelectValue placeholder="Buscar por código o nombre..." /></SelectTrigger>
              <SelectContent>
                <div className="px-2 pb-1 sticky top-0 bg-white">
                  <Input placeholder="Buscar..." value={busquedaDestino} onChange={e => setBusquedaDestino(e.target.value)} onKeyDown={e => e.stopPropagation()} className="h-8 text-xs" />
                </div>
                {destinosFiltrados.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</SelectItem>)}
                {destinosFiltrados.length === 0 && <SelectItem value="__none__" disabled>Sin productos en proceso que coincidan</SelectItem>}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-400 mt-0.5">Solo productos clasificados como "Productos en Proceso" en el Catálogo Maestro. No crea productos nuevos.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Cantidad Recibida</Label><Input type="number" min="0" max={pendienteAntes} value={cantidadRecibida} onChange={e => setCantidadRecibida(e.target.value)} /></div>
            <div><Label>Cantidad Rechazada / Dañada</Label><Input type="number" min="0" max={pendienteAntes} value={cantidadRechazada} onChange={e => setCantidadRechazada(e.target.value)} /></div>
            <div><Label>Fecha de Recepción *</Label><Input type="date" value={fechaRecepcion} onChange={e => setFechaRecepcion(e.target.value)} /></div>
            <div><Label>Responsable que Recibe</Label><Input value={responsable} onChange={e => setResponsable(e.target.value)} /></div>
          </div>
          <p className="text-xs">Quedará pendiente después de este registro: <strong className={pendienteDespues > 0 ? 'text-amber-700' : 'text-emerald-700'}>{pendienteDespues}</strong> {pendienteDespues === 0 && '— el proceso quedará Recibido Totalmente'}</p>
          <div><Label>Observaciones</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleGuardar} disabled={guardando}>{guardando ? 'Guardando...' : 'Registrar Recepción'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
