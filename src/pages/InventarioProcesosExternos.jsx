import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoExterno, Proveedor, ProductoCatalogo } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';

const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d + 'T00:00:00').toLocaleDateString('es-CO'); } catch { return d; } };
const today = () => new Date().toISOString().split('T')[0];
const diasTranscurridos = (fechaSalida, fechaFin) => {
  if (!fechaSalida) return null;
  const fin = fechaFin ? new Date(fechaFin + 'T00:00:00') : new Date();
  const inicio = new Date(fechaSalida + 'T00:00:00');
  return Math.max(0, Math.round((fin - inicio) / 86400000));
};

const ESTADO_BADGE = {
  enviado: 'bg-blue-100 text-blue-800',
  en_proceso: 'bg-purple-100 text-purple-800',
  recibido_parcial: 'bg-amber-100 text-amber-800',
  recibido_total: 'bg-green-100 text-green-800',
  recibido: 'bg-green-100 text-green-800',
  cancelado: 'bg-red-100 text-red-800',
};
const ESTADO_LABEL = {
  enviado: 'Enviado', en_proceso: 'En Proceso', recibido_parcial: 'Recibido Parcialmente',
  recibido_total: 'Recibido Totalmente', recibido: 'Recibido Totalmente', cancelado: 'Cancelado',
};

/**
 * Inventario de Procesos Externos: representa el material que físicamente
 * está fuera de la curtiembre (enviado a lijado, grabado, estampado, etc.).
 * No es una tabla propia — se alimenta 100% de ProcesoExterno, que ya es la
 * única fuente de verdad de estos movimientos (evita duplicar información).
 */
export default function InventarioProcesosExternos() {
  const [procesos, setProcesos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [tiposProceso, setTiposProceso] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState({ proveedor: '', estado: '', tipo: '', busqueda: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procData, provData, tiposData] = await Promise.all([
        ProcesoExterno.list('-created_date'),
        Proveedor.list(),
        ProductoCatalogo.filter({ categoria: 'tipo_proceso_externo' }),
      ]);
      setProcesos(Array.isArray(procData) ? procData : []);
      setProveedores(Array.isArray(provData) ? provData : []);
      setTiposProceso(Array.isArray(tiposData) ? tiposData : []);
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Solo lo que sigue físicamente fuera (no cancelado, no recibido del todo).
  const enCurso = procesos.filter(p => ['enviado', 'en_proceso', 'recibido_parcial'].includes(p.estado));

  const filtrados = enCurso.filter(p => {
    if (filtros.proveedor && p.proveedor_id !== filtros.proveedor) return false;
    if (filtros.estado && p.estado !== filtros.estado) return false;
    if (filtros.tipo && p.tipo_proceso_codigo !== filtros.tipo) return false;
    if (filtros.busqueda) {
      const q = filtros.busqueda.toLowerCase();
      const campos = [p.numero_proceso, p.codigo_producto_proceso, p.descripcion_producto_proceso, p.codigo_lote, p.codigo_lote_padre].join(' ').toLowerCase();
      if (!campos.includes(q)) return false;
    }
    return true;
  });

  const totalHojasFuera = filtrados.reduce((s, p) => s + Math.max(0, (p.cantidad_enviada || 0) - (p.cantidad_recibida || 0) - (p.cantidad_rechazada || 0)), 0);
  const vencidos = filtrados.filter(p => p.fecha_estimada_regreso && p.fecha_estimada_regreso < today()).length;

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Inventario de Procesos Externos"
        description="Material físicamente fuera de la curtiembre, enviado a procesos con terceros"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { l: 'Procesos en Curso', v: filtrados.length, c: 'blue' },
          { l: 'Hojas Fuera de la Empresa', v: totalHojasFuera, c: 'amber' },
          { l: 'Proveedores Involucrados', v: new Set(filtrados.map(p => p.proveedor_id).filter(Boolean)).size, c: 'purple' },
          { l: 'Vencidos (fecha estimada superada)', v: vencidos, c: 'red' },
        ].map(k => (
          <div key={k.l} className={`bg-${k.c}-50 border border-${k.c}-200 rounded-xl p-2 text-center`}>
            <p className="text-xs text-slate-500 leading-tight">{k.l}</p>
            <p className={`text-lg font-extrabold text-${k.c}-700`}>{k.v}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Material en Procesos Externos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar código, lote, proceso..." className="pl-8 text-xs" value={filtros.busqueda} onChange={e => setFiltros(f => ({ ...f, busqueda: e.target.value }))} />
            </div>
            <Select value={filtros.proveedor || '__all__'} onValueChange={v => setFiltros(f => ({ ...f, proveedor: v === '__all__' ? '' : v }))}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Proveedor..." /></SelectTrigger>
              <SelectContent><SelectItem value="__all__">Todos los proveedores</SelectItem>{proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filtros.tipo || '__all__'} onValueChange={v => setFiltros(f => ({ ...f, tipo: v === '__all__' ? '' : v }))}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Tipo de proceso..." /></SelectTrigger>
              <SelectContent><SelectItem value="__all__">Todos los tipos</SelectItem>{tiposProceso.map(t => <SelectItem key={t.id} value={t.codigo}>{t.descripcion}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filtros.estado || '__all__'} onValueChange={v => setFiltros(f => ({ ...f, estado: v === '__all__' ? '' : v }))}>
              <SelectTrigger className="text-xs"><SelectValue placeholder="Estado..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los estados</SelectItem>
                <SelectItem value="enviado">Enviado</SelectItem>
                <SelectItem value="recibido_parcial">Recibido Parcialmente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-2 text-left">Código Proceso</th>
                  <th className="p-2 text-left">F. Salida</th>
                  <th className="p-2 text-left">Tipo de Proceso</th>
                  <th className="p-2 text-left">Proveedor</th>
                  <th className="p-2 text-left">Producto</th>
                  <th className="p-2 text-left">Lote Padre</th>
                  <th className="p-2 text-left">Sublote</th>
                  <th className="p-2 text-right">Enviada</th>
                  <th className="p-2 text-right">Recibida</th>
                  <th className="p-2 text-right">Pendiente</th>
                  <th className="p-2 text-left">Unidad</th>
                  <th className="p-2 text-center">Estado</th>
                  <th className="p-2 text-left">F. Est. Regreso</th>
                  <th className="p-2 text-left">F. Real Recepción</th>
                  <th className="p-2 text-right">Días Fuera</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={15} className="p-4 text-center text-slate-400">Cargando...</td></tr>
                ) : filtrados.length === 0 ? (
                  <tr><td colSpan={15} className="p-4 text-center text-slate-400">No hay material actualmente en procesos externos.</td></tr>
                ) : filtrados.map(p => {
                  const pendiente = Math.max(0, (p.cantidad_enviada || 0) - (p.cantidad_recibida || 0) - (p.cantidad_rechazada || 0));
                  const vencido = p.fecha_estimada_regreso && p.fecha_estimada_regreso < today();
                  return (
                    <tr key={p.id} className={`border-t hover:bg-slate-50 ${vencido ? 'bg-red-50' : ''}`}>
                      <td className="p-2 font-mono font-bold text-blue-700">{p.numero_proceso}</td>
                      <td className="p-2">{fmtDate(p.fecha_salida)}</td>
                      <td className="p-2">{p.tipo_proceso_nombre || '—'}</td>
                      <td className="p-2">{p.proveedor_nombre || '—'}</td>
                      <td className="p-2">{p.codigo_producto_proceso} <span className="text-slate-400">— {p.descripcion_producto_proceso}</span></td>
                      <td className="p-2 font-mono">{p.codigo_lote_padre || '—'}</td>
                      <td className="p-2 font-mono">{p.codigo_lote || '—'}</td>
                      <td className="p-2 text-right font-bold">{p.cantidad_enviada}</td>
                      <td className="p-2 text-right text-emerald-700">{p.cantidad_recibida || 0}</td>
                      <td className="p-2 text-right text-amber-700 font-semibold">{pendiente}</td>
                      <td className="p-2">{p.unidad_medida || 'HOJA'}</td>
                      <td className="p-2 text-center"><Badge className={`text-xs ${ESTADO_BADGE[p.estado]}`}>{ESTADO_LABEL[p.estado]}</Badge></td>
                      <td className="p-2">{fmtDate(p.fecha_estimada_regreso)} {vencido && <span className="text-red-600 font-bold">⚠</span>}</td>
                      <td className="p-2">{fmtDate(p.fecha_recepcion)}</td>
                      <td className="p-2 text-right">{diasTranscurridos(p.fecha_salida)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
