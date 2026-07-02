import React, { useState, useEffect, useCallback } from 'react';
import { InventarioEnProceso, ProcesoProduccion } from '@/entities/all';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

const RF_LABELS = { en_pelo: 'En Pelo', crosta: 'Crosta' };

const PIPELINE = [
  { key: 'recepcion', label: 'Recepción' },
  { key: 'limpieza', label: 'Rendido / Limpieza' },
  { key: 'curtido', label: 'Curtido' },
  { key: 'recurtido', label: 'Recurtido' },
  { key: 'pintura', label: 'Pintura' },
  { key: 'terminado', label: 'Terminado' },
];

const ICONS = {
  finalizado: '🟢',
  en_proceso: '🟡',
  pendiente: '🔴',
  sin_iniciar: '⚪',
};
const STATUS_LABELS = {
  finalizado: 'Finalizado',
  en_proceso: 'En Proceso',
  pendiente: 'Pendiente',
  sin_iniciar: 'Sin Iniciar',
};

const formatDate = (d) => d ? new Date(d.length > 10 ? d : d + 'T00:00:00').toLocaleDateString('es-CO') : '—';

function construirHistorialSublote(sublote, pinturaProc) {
  return PIPELINE.map((stage) => {
    if (stage.key === 'pintura') {
      if (!pinturaProc) return { ...stage, status: 'pendiente', fechaInicio: null, fechaFin: null, responsable: null, observaciones: null };
      const finalizado = pinturaProc.estado_pedido_pintura === 'terminado' || pinturaProc.finalizar_pintura;
      return {
        ...stage,
        status: finalizado ? 'finalizado' : 'en_proceso',
        fechaInicio: pinturaProc.fecha_inicio_pintura || pinturaProc.fecha_entrega_pintor,
        fechaFin: finalizado ? pinturaProc.updated_date : null,
        responsable: pinturaProc.pintor_responsable,
        observaciones: pinturaProc.observaciones,
      };
    }
    if (stage.key === 'terminado') {
      const finalizado = pinturaProc && (pinturaProc.estado_pedido_pintura === 'terminado' || pinturaProc.finalizar_pintura);
      return { ...stage, status: finalizado ? 'finalizado' : 'pendiente', fechaInicio: null, fechaFin: finalizado ? pinturaProc.updated_date : null, responsable: null, observaciones: null };
    }
    // Etapas previas al recurtido/creación del sublote se consideran finalizadas (heredadas)
    return { ...stage, status: 'finalizado', fechaInicio: sublote.fecha_ingreso_proceso, fechaFin: sublote.fecha_ingreso_proceso, responsable: null, observaciones: null };
  });
}

export default function SeguimientoProduccionModal({ open, onOpenChange, item }) {
  const [loading, setLoading] = useState(true);
  const [allInv, setAllInv] = useState([]);
  const [pinturaProcesos, setPinturaProcesos] = useState([]);
  const [expandedIdx, setExpandedIdx] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [inv, pinturas] = await Promise.all([
        InventarioEnProceso.list(),
        ProcesoProduccion.filter({ tipo_proceso: 'pintura' }),
      ]);
      setAllInv(Array.isArray(inv) ? inv : []);
      setPinturaProcesos(Array.isArray(pinturas) ? pinturas : []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (open) { setExpandedIdx(null); loadData(); }
  }, [open, loadData]);

  if (!item) return null;

  const parentCode = item.tipo === 'SUBLOTE' ? (item.codigo_lote_padre || item.codigo_lote) : item.codigo_lote;
  const parentLote = allInv.find(i => i.codigo_lote === parentCode && i.tipo === 'LOTE') || (item.tipo === 'LOTE' ? item : null);
  const sublotesList = allInv.filter(i => i.codigo_lote_padre === parentCode && i.tipo === 'SUBLOTE');

  const sublotesData = sublotesList.map(sub => {
    const pinturaProc = pinturaProcesos.find(p => p.inv_proceso_id === sub.id);
    const historial = construirHistorialSublote(sub, pinturaProc);
    const pendiente = historial.find(h => h.status !== 'finalizado');
    const procesoActual = pendiente ? pendiente.label : 'Completado';
    const idxActual = pendiente ? PIPELINE.findIndex(p => p.key === pendiente.key) : PIPELINE.length;
    const siguienteProceso = idxActual >= 0 && idxActual < PIPELINE.length - 1 ? PIPELINE[idxActual + 1].label : (idxActual === PIPELINE.length - 1 ? '—' : 'N/A');
    return { sub, pinturaProc, historial, procesoActual, estado: pendiente?.status || 'finalizado', siguienteProceso };
  });

  const cantidadInicial = (parentLote?.cantidad_hojas || 0) > 0
    ? parentLote.cantidad_hojas
    : sublotesData.reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);
  const pesoInicial = (parentLote?.peso_actual || 0) > 0
    ? parentLote.peso_actual
    : sublotesData.reduce((s, d) => s + (parseFloat(d.sub.peso_actual) || 0), 0);
  const cantidadDistribuida = sublotesData.reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);
  const cantidadDisponible = sublotesData.reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);

  const ningunoIniciado = sublotesData.length > 0 && sublotesData.every(d => !d.pinturaProc);
  const todosFinalizados = sublotesData.length > 0 && sublotesData.every(d => d.estado === 'finalizado');
  const estadoGeneral = sublotesData.length === 0 ? 'Sin Sublotes' : ningunoIniciado ? 'Pendiente' : todosFinalizados ? 'Producción Finalizada' : 'En Producción';
  const estadoGeneralColor = estadoGeneral === 'Producción Finalizada' ? 'text-green-700' : estadoGeneral === 'En Producción' ? 'text-blue-700' : 'text-amber-700';

  const pendientesLote = [];
  sublotesData.forEach(d => {
    if (d.estado === 'pendiente') pendientesLote.push(`Falta registrar Pintura del sublote ${d.sub.codigo}.`);
    if (d.estado === 'en_proceso') pendientesLote.push(`Falta finalizar Pintura del sublote ${d.sub.codigo}.`);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🧭 Seguimiento de Producción — {parentCode || 'N/A'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center text-slate-400 py-8">Cargando trazabilidad...</p>
        ) : (
          <div className="space-y-5">
            {/* Información General del Lote */}
            <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-700 text-white px-4 py-2 font-bold text-sm">Información General del Lote</div>
              <div className="bg-slate-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Código Lote Padre</p><p className="font-mono font-bold text-slate-800">{parentCode || '—'}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Producto Inicial</p><p className="font-bold text-slate-800">{parentLote?.descripcion || '—'}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Cantidad Inicial</p><p className="font-bold text-slate-800">{cantidadInicial} hojas</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Peso Inicial</p><p className="font-bold text-slate-800">{pesoInicial} kg</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Cantidad de Sublotes</p><p className="font-bold text-slate-800">{sublotesData.length}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Hojas Distribuidas</p><p className="font-bold text-slate-800">{cantidadDistribuida}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Cantidad Disponible</p><p className="font-bold text-emerald-700">{cantidadDisponible} hojas</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Estado General</p><p className={`font-extrabold ${estadoGeneralColor}`}>{estadoGeneral}</p></div>
              </div>
            </div>

            {/* Pendientes del lote */}
            {pendientesLote.length > 0 && (
              <div className="border border-amber-300 bg-amber-50 rounded-lg p-3">
                <p className="font-bold text-amber-800 text-xs mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Pendientes del lote</p>
                <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                  {pendientesLote.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            {/* Tabla de Seguimiento de Sublotes */}
            <div className="border-2 border-indigo-400 rounded-xl overflow-hidden">
              <div className="bg-indigo-700 text-white px-4 py-2 font-bold text-sm">Tabla de Seguimiento de Sublotes</div>
              {sublotesData.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm bg-white">Este lote no tiene sublotes generados.</div>
              ) : (
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-indigo-50">
                      <tr>
                        <th className="p-2 text-left"></th>
                        <th className="p-2 text-left">Sublote</th>
                        <th className="p-2 text-left">Producto</th>
                        <th className="p-2 text-left">Base/Color</th>
                        <th className="p-2 text-left">Calibre</th>
                        <th className="p-2 text-center">Hojas</th>
                        <th className="p-2 text-center">Peso</th>
                        <th className="p-2 text-left">Proceso Actual</th>
                        <th className="p-2 text-center">Estado</th>
                        <th className="p-2 text-left">Siguiente Proceso</th>
                        <th className="p-2 text-center">Existencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sublotesData.map((d, idx) => (
                        <React.Fragment key={d.sub.id}>
                          <tr className="border-t hover:bg-indigo-50 cursor-pointer" onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}>
                            <td className="p-2">{expandedIdx === idx ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                            <td className="p-2 font-mono font-bold text-indigo-800">{d.sub.codigo}</td>
                            <td className="p-2">{RF_LABELS[d.sub.recurtido_finalizado] || '—'}</td>
                            <td className="p-2 font-semibold">{d.sub.color_base || '—'}</td>
                            <td className="p-2">{d.sub.calibre || '—'}</td>
                            <td className="p-2 text-center font-bold">{d.sub.cantidad_hojas || 0}</td>
                            <td className="p-2 text-center">{d.sub.peso_actual || 0} kg</td>
                            <td className="p-2">{d.procesoActual}</td>
                            <td className="p-2 text-center">{ICONS[d.estado]} {STATUS_LABELS[d.estado]}</td>
                            <td className="p-2">{d.siguienteProceso}</td>
                            <td className="p-2 text-center font-bold text-emerald-700">{d.sub.cantidad_hojas || 0}</td>
                          </tr>
                          {expandedIdx === idx && (
                            <tr className="border-t bg-slate-50">
                              <td colSpan={11} className="p-3">
                                <p className="font-bold text-slate-700 text-xs mb-2">Historial de Procesos — Sublote {d.sub.codigo}</p>
                                <div className="space-y-1.5">
                                  {d.historial.map((h, i) => (
                                    <div key={i} className="flex items-center gap-3 bg-white border rounded-lg p-2">
                                      <span className="text-base">{ICONS[h.status]}</span>
                                      <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-2">
                                        <div><p className="text-slate-400 text-xs">Proceso</p><p className="font-semibold text-slate-800 text-xs">{h.label}</p></div>
                                        <div><p className="text-slate-400 text-xs">Estado</p><p className="font-semibold text-xs">{STATUS_LABELS[h.status]}</p></div>
                                        <div><p className="text-slate-400 text-xs">Fecha Inicio</p><p className="text-xs">{formatDate(h.fechaInicio)}</p></div>
                                        <div><p className="text-slate-400 text-xs">Fecha Fin</p><p className="text-xs">{formatDate(h.fechaFin)}</p></div>
                                        <div><p className="text-slate-400 text-xs">Responsable</p><p className="text-xs">{h.responsable || '—'}</p></div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3"><Button onClick={() => onOpenChange(false)}>Cerrar</Button></div>
      </DialogContent>
    </Dialog>
  );
}