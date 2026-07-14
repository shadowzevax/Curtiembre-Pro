import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(v || 0);
const fmt2 = (v) => (parseFloat(v) || 0).toFixed(2);
const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('es-CO'); } catch { return d; } };

const ESTADO_COLORS = {
  pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  en_proceso: 'bg-blue-100 text-blue-800 border-blue-300',
  completado: 'bg-green-100 text-green-800 border-green-300',
  anulado: 'bg-red-100 text-red-800 border-red-300',
  borrador: 'bg-gray-100 text-gray-700 border-gray-300',
};
const ESTADO_LABELS = { pendiente: 'Pendiente', en_proceso: 'En proceso', completado: 'Finalizada', anulado: 'Anulada', borrador: 'Borrador' };
const estadoBadge = (estado) => (
  <Badge className={`text-xs ${ESTADO_COLORS[estado] || 'bg-gray-100 text-gray-700'}`}>{ESTADO_LABELS[estado] || estado}</Badge>
);

export default function RecurtidoFichaIntegral({ open, onClose, selectedItem, allInvProceso, procesos, getCostosControl }) {
  if (!selectedItem) return null;

  const invRec = allInvProceso.find(i => i.proceso_origen_id === selectedItem.id);
  const { costoTotal } = getCostosControl(selectedItem);
  const costoHoja = (parseFloat(selectedItem.cantidad_pieles) || 0) > 0 ? costoTotal / parseFloat(selectedItem.cantidad_pieles) : 0;
  const invPadreD = allInvProceso.find(i => i.codigo_lote === selectedItem.codigo_lote);
  const totalHPadreD = parseFloat(invPadreD?.cantidad_hojas) || 0;
  const siblingsD = (procesos || []).filter(p => p.codigo_lote === selectedItem.codigo_lote && p.estado !== 'anulado');
  const hojasUsadasD = siblingsD.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
  const pctPadreD = totalHPadreD > 0 ? Math.min(100, (hojasUsadasD / totalHPadreD) * 100) : 0;
  const diasEnProceso = selectedItem.fecha_inicio
    ? Math.floor((Date.now() - new Date(selectedItem.fecha_inicio).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const etapas = ['Recepción', 'Limpieza', 'Curtido', 'Recurtido', 'Pintura', 'Prod. Terminado'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📋 Ficha Integral — Partida: <span className="font-mono text-purple-700">{selectedItem.numero_proceso}</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">

          {/* ① INFO GENERAL */}
          <div className="p-3 bg-slate-50 border rounded-xl">
            <h3 className="font-bold text-slate-600 text-xs mb-2 uppercase tracking-wide">① Información General</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div><span className="font-semibold text-slate-500">Código Partida:</span><p className="font-mono font-bold text-purple-800">{selectedItem.numero_proceso}</p></div>
              <div><span className="font-semibold text-slate-500">Lote Padre:</span><p className="font-mono font-bold text-indigo-700">{selectedItem.codigo_lote}</p></div>
              <div><span className="font-semibold text-slate-500">Estado:</span><p className="mt-0.5">{estadoBadge(selectedItem.estado)}</p></div>
              <div><span className="font-semibold text-slate-500">Base / Color:</span><p className="font-semibold">{selectedItem.nombre_color || '—'}</p></div>
              <div><span className="font-semibold text-slate-500">Código Producto:</span><p className="font-mono text-cyan-700">{selectedItem.codigo_producto_proceso || '—'}</p></div>
              <div><span className="font-semibold text-slate-500">Descripción:</span><p>{selectedItem.descripcion_producto_proceso || '—'}</p></div>
              <div><span className="font-semibold text-slate-500">Fecha Registro:</span><p>{fmtDate(selectedItem.fecha_inicio)}</p></div>
              <div><span className="font-semibold text-slate-500">Fecha Fin:</span><p>{selectedItem.fecha_fin ? fmtDate(selectedItem.fecha_fin) : 'En proceso'}</p></div>
            </div>
          </div>

          {/* ② PRODUCCIÓN */}
          <div>
            <h3 className="font-bold text-slate-600 text-xs mb-2 uppercase tracking-wide">② Producción</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {[
                { l: 'Cant. Hojas', v: selectedItem.cantidad_pieles || 0, c: 'blue' },
                { l: 'Peso (kg)', v: `${selectedItem.peso_actual || 0} kg`, c: 'slate' },
                { l: 'Calibre', v: selectedItem.calibre || '—', c: 'amber' },
                { l: 'Días en Proceso', v: `${diasEnProceso}d`, c: 'purple' },
                { l: 'Próx. Proceso', v: selectedItem.estado === 'completado' ? '🎨 Pintura' : '⏳ Finalizar', c: 'emerald' },
              ].map(k => (
                <div key={k.l} className={`bg-${k.c}-50 border border-${k.c}-200 rounded-lg p-2 text-center`}>
                  <p className="text-xs text-slate-500">{k.l}</p>
                  <p className={`text-lg font-bold text-${k.c}-700`}>{k.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ③ COSTOS */}
          <div className="p-3 bg-violet-50 border border-violet-200 rounded-xl">
            <h3 className="font-bold text-violet-700 text-xs mb-2 uppercase tracking-wide">③ Costos</h3>
            <div className="grid grid-cols-3 gap-2 text-xs mb-2">
              <div className="bg-white rounded border p-2 text-center"><p className="text-slate-500">Costo Total</p><p className="text-base font-bold text-violet-700">{formatCurrency(costoTotal)}</p></div>
              <div className="bg-white rounded border p-2 text-center"><p className="text-slate-500">Costo / Hoja</p><p className="text-base font-bold text-emerald-700">{formatCurrency(costoHoja)}</p></div>
              <div className="bg-white rounded border p-2 text-center"><p className="text-slate-500">Ítems Químicos</p><p className="text-base font-bold text-blue-700">{(selectedItem.insumos_utilizados || []).length}</p></div>
            </div>
            {(selectedItem.insumos_utilizados || []).length > 0 && (
              <table className="w-full text-xs border rounded overflow-hidden">
                <thead className="bg-violet-200">
                  <tr><th className="p-1 text-left">Código</th><th className="p-1 text-left">Producto</th><th className="p-1 text-right">Cant.</th><th className="p-1 text-right">Costo Unit.</th><th className="p-1 text-right">Total</th></tr>
                </thead>
                <tbody>
                  {selectedItem.insumos_utilizados.map((ins, idx) => (
                    <tr key={idx} className="border-t bg-white">
                      <td className="p-1 font-mono">{ins.codigo}</td>
                      <td className="p-1">{ins.producto}</td>
                      <td className="p-1 text-right">{fmt2(ins.cantidad)}</td>
                      <td className="p-1 text-right">{formatCurrency(ins.costo_unitario)}</td>
                      <td className="p-1 text-right font-bold text-emerald-700">{formatCurrency(ins.valor_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ④ INVENTARIO EN PROCESO */}
          <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <h3 className="font-bold text-indigo-700 text-xs mb-2 uppercase tracking-wide">④ Inventario en Proceso</h3>
            {invRec ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div><span className="font-semibold text-slate-500">Código Inv.:</span><p className="font-mono text-indigo-700">{invRec.codigo_lote}</p></div>
                <div><span className="font-semibold text-slate-500">Hojas:</span><p>{invRec.cantidad_hojas}</p></div>
                <div><span className="font-semibold text-slate-500">Estado:</span><p>{invRec.estado_actual}</p></div>
                <div><span className="font-semibold text-slate-500">Destino:</span><p>{invRec.destino_sublote || '—'}</p></div>
              </div>
            ) : <p className="text-xs text-amber-700">⚠️ Sin registro en Inventario en Proceso aún.</p>}
          </div>

          {/* ⑤ ESTADO LOTE PADRE */}
          <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl">
            <h3 className="font-bold text-purple-700 text-xs mb-2 uppercase tracking-wide">⑤ Estado del Lote Padre: <span className="font-mono">{selectedItem.codigo_lote}</span></h3>
            <div className="grid grid-cols-4 gap-2 text-xs mb-2">
              <div className="bg-white rounded border p-1.5 text-center"><p className="text-slate-400">Total Hojas</p><p className="font-bold text-blue-700">{totalHPadreD}</p></div>
              <div className="bg-white rounded border p-1.5 text-center"><p className="text-slate-400">Procesadas</p><p className="font-bold text-emerald-700">{hojasUsadasD}</p></div>
              <div className="bg-white rounded border p-1.5 text-center"><p className="text-slate-400">Pendientes</p><p className="font-bold text-amber-700">{Math.max(0, totalHPadreD - hojasUsadasD)}</p></div>
              <div className="bg-white rounded border p-1.5 text-center"><p className="text-slate-400">Partidas</p><p className="font-bold text-purple-700">{siblingsD.length}</p></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-3 overflow-hidden">
                <div className={`h-3 rounded-full ${pctPadreD >= 100 ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${pctPadreD}%` }} />
              </div>
              <span className="font-bold text-purple-700 text-xs">{pctPadreD.toFixed(1)}%</span>
            </div>
            {siblingsD.length > 0 && (
              <div className="mt-2 border rounded overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-purple-200"><tr><th className="p-1 text-left">Código Partida</th><th className="p-1 text-right">Hojas</th><th className="p-1 text-center">Estado</th></tr></thead>
                  <tbody>
                    {siblingsD.map(s => (
                      <tr key={s.id} className={`border-t ${s.id === selectedItem.id ? 'bg-purple-50 font-bold' : ''}`}>
                        <td className="p-1 font-mono text-purple-800">{s.numero_proceso} {s.id === selectedItem.id ? '← actual' : ''}</td>
                        <td className="p-1 text-right">{s.cantidad_pieles}</td>
                        <td className="p-1 text-center">{estadoBadge(s.estado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ⑥ LÍNEA DE TIEMPO */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <h3 className="font-bold text-blue-700 text-xs mb-2 uppercase tracking-wide">⑥ Trazabilidad — Línea de Tiempo</h3>
            <div className="flex items-center gap-1 flex-wrap">
              {etapas.map((e, i) => (
                <React.Fragment key={e}>
                  <div className={`px-2 py-1 rounded text-xs font-semibold border ${i < 3 ? 'bg-green-100 border-green-300 text-green-800' : i === 3 ? 'bg-purple-100 border-purple-400 text-purple-800' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                    {i < 3 ? '✓ ' : i === 3 ? '● ' : '○ '}{e}
                  </div>
                  {i < etapas.length - 1 && <div className={`w-4 h-0.5 ${i < 3 ? 'bg-green-400' : 'bg-gray-200'}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* ⑦ OBSERVACIONES */}
          {selectedItem.observaciones && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <h3 className="font-bold text-amber-700 text-xs mb-1 uppercase tracking-wide">⑦ Observaciones</h3>
              <p className="text-xs text-slate-700">{selectedItem.observaciones}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t mt-2">
          <Button onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}