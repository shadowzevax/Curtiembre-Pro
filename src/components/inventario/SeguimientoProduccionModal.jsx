import React, { useState, useEffect, useCallback } from 'react';
import { InventarioEnProceso, ProcesoProduccion } from '@/entities/all';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronRight, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';

const RF_LABELS = { en_pelo: 'En Pelo', crosta: 'Crosta' };
const DESTINO_LABELS = {
  disponible_pintura: 'Disponible para Pintura',
  en_proceso_pintura: 'En proceso de Pintura',
  producto_terminado: 'Producto Terminado',
  vendido_crosta: 'Vendido como Crosta',
  agotado: 'Agotado',
  cancelado: 'Cancelado',
  merma: 'Merma',
};
const DESTINO_COLORS = {
  disponible_pintura: 'bg-green-100 text-green-700 border-green-300',
  en_proceso_pintura: 'bg-blue-100 text-blue-700 border-blue-300',
  producto_terminado: 'bg-purple-100 text-purple-700 border-purple-300',
  vendido_crosta: 'bg-amber-100 text-amber-700 border-amber-300',
  agotado: 'bg-gray-100 text-gray-500 border-gray-300',
  cancelado: 'bg-red-100 text-red-700 border-red-300',
  merma: 'bg-orange-100 text-orange-700 border-orange-300',
};
const PIPELINE = [
  { key: 'recepcion', label: 'Recepción' },
  { key: 'limpieza', label: 'Limpieza' },
  { key: 'curtido', label: 'Curtido' },
  { key: 'recurtido', label: 'Recurtido' },
  { key: 'pintura', label: 'Pintura' },
  { key: 'terminado', label: 'Terminado' },
];
const ICONS = { finalizado: '🟢', en_proceso: '🟡', pendiente: '🔴', sin_iniciar: '⚪' };
const STATUS_LABELS = { finalizado: 'Finalizado', en_proceso: 'En Proceso', pendiente: 'Pendiente', sin_iniciar: 'Sin Iniciar' };

const formatDateTime = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleString('es-CO'); } catch { return '—'; }
};
const formatDate = (d) => d ? new Date(d.length > 10 ? d : d + 'T00:00:00').toLocaleDateString('es-CO') : '—';

function construirHistorialSublote(sub, pinturaProc) {
  return PIPELINE.map((stage) => {
    if (stage.key === 'pintura') {
      if (!pinturaProc) return { ...stage, status: 'pendiente', fechaInicio: null, fechaFin: null, responsable: null };
      const finalizado = pinturaProc.estado_pedido_pintura === 'terminado' || pinturaProc.finalizar_pintura;
      return { ...stage, status: finalizado ? 'finalizado' : 'en_proceso', fechaInicio: pinturaProc.fecha_inicio_pintura, fechaFin: finalizado ? pinturaProc.updated_date : null, responsable: pinturaProc.pintor_responsable };
    }
    if (stage.key === 'terminado') {
      const finalizado = pinturaProc && (pinturaProc.estado_pedido_pintura === 'terminado' || pinturaProc.finalizar_pintura);
      return { ...stage, status: finalizado ? 'finalizado' : 'pendiente', fechaInicio: null, fechaFin: finalizado ? pinturaProc.updated_date : null, responsable: null };
    }
    return { ...stage, status: 'finalizado', fechaInicio: sub.fecha_ingreso_proceso || sub.created_date, fechaFin: sub.created_date, responsable: null };
  });
}

function construirHistorialMovimientos(parentLote, sublotesData, pinturaProcesos) {
  const movs = [];

  if (parentLote?.created_date) {
    movs.push({ fecha: parentLote.created_date, usuario: 'Sistema', movimiento: 'Creación del lote', cantidad: parentLote.cantidad_hojas || 0 });
  }

  sublotesData.forEach(d => {
    if (d.sub.created_date) {
      movs.push({ fecha: d.sub.created_date, usuario: 'Sistema', movimiento: `División en sublote: ${d.sub.codigo_lote}`, cantidad: d.sub.cantidad_hojas || 0 });
    }
    if (d.sub.codigo_producto_proceso) {
      movs.push({ fecha: d.sub.created_date, usuario: 'Sistema', movimiento: `Generación del Producto en Proceso: ${d.sub.codigo_producto_proceso}`, cantidad: d.sub.cantidad_hojas || 0 });
    }
    if (d.sub.origen_modulo === 'recurtido') {
      movs.push({ fecha: d.sub.created_date, usuario: 'Sistema', movimiento: `Ingreso al Inventario de Productos en Proceso: ${d.sub.codigo_lote}`, cantidad: d.sub.cantidad_hojas || 0 });
    }
    if (d.pinturaProc?.created_date) {
      movs.push({ fecha: d.pinturaProc.created_date, usuario: d.pinturaProc.pintor_responsable || 'Sistema', movimiento: `Envío a Pintura: ${d.sub.codigo_lote}`, cantidad: d.pinturaProc.hojas_a_consumir || d.sub.cantidad_hojas || 0 });
    }
    if (d.sub.destino_sublote === 'vendido_crosta') {
      movs.push({ fecha: d.sub.updated_date || d.sub.created_date, usuario: 'Sistema', movimiento: `Venta en Crosta: ${d.sub.codigo_lote}`, cantidad: d.sub.cantidad_hojas || 0 });
    }
    if (d.sub.destino_sublote === 'producto_terminado') {
      movs.push({ fecha: d.sub.updated_date || d.sub.created_date, usuario: 'Sistema', movimiento: `Salida hacia Producto Terminado: ${d.sub.codigo_lote}`, cantidad: d.sub.cantidad_hojas || 0 });
    }

    // historial_movimientos explícito
    (d.sub.historial_movimientos || []).forEach(h => movs.push(h));
  });

  // Ordenar por fecha descendente
  movs.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  return movs;
}

export default function SeguimientoProduccionModal({ open, onOpenChange, item }) {
  const [loading, setLoading] = useState(true);
  const [allInv, setAllInv] = useState([]);
  const [pinturaProcesos, setPinturaProcesos] = useState([]);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [showHistorial, setShowHistorial] = useState(false);

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

  useEffect(() => { if (open) { setExpandedIdx(null); setShowHistorial(false); loadData(); } }, [open, loadData]);

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
    const destino = sub.destino_sublote || 'disponible_pintura';
    return { sub, pinturaProc, historial, procesoActual, estado: pendiente?.status || 'finalizado', siguienteProceso, destino };
  });

  // ─── Cálculos Resumen ───
  const cantidadInicial = (parentLote?.cantidad_hojas || 0) > 0
    ? parentLote.cantidad_hojas
    : sublotesData.reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);
  const pesoInicial = (parentLote?.peso_actual || 0) > 0
    ? parentLote.peso_actual
    : sublotesData.reduce((s, d) => s + (parseFloat(d.sub.peso_actual) || 0), 0);

  const hojasDisponibles = sublotesData.filter(d => d.destino === 'disponible_pintura').reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);
  const hojasEnPintura = sublotesData.filter(d => d.destino === 'en_proceso_pintura').reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);
  const hojasTerminado = sublotesData.filter(d => d.destino === 'producto_terminado').reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);
  const hojasVendidasCrosta = sublotesData.filter(d => d.destino === 'vendido_crosta').reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);
  const hojasAgotadas = sublotesData.filter(d => d.destino === 'agotado').reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);
  const hojasMerma = sublotesData.filter(d => d.destino === 'merma').reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);
  const hojasEnProceso = sublotesData.filter(d => d.sub.estado_actual === 'EN_PROCESO').reduce((s, d) => s + (parseFloat(d.sub.cantidad_hojas) || 0), 0);

  const estadoGeneral = sublotesData.length === 0 ? 'Sin Sublotes' : sublotesData.every(d => d.estado === 'finalizado') ? 'Producción Finalizada' : sublotesData.every(d => !d.pinturaProc) ? 'Pendiente' : 'En Producción';
  const estadoGeneralColor = estadoGeneral === 'Producción Finalizada' ? 'text-green-700' : estadoGeneral === 'En Producción' ? 'text-blue-700' : 'text-amber-700';

  const historialMovimientos = construirHistorialMovimientos(parentLote, sublotesData, pinturaProcesos);
  const pendientesLote = [];
  sublotesData.forEach(d => {
    if (d.estado === 'pendiente') pendientesLote.push(`Falta registrar Pintura del sublote ${d.sub.codigo_lote}.`);
    if (d.estado === 'en_proceso') pendientesLote.push(`Falta finalizar Pintura del sublote ${d.sub.codigo_lote}.`);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🧭 Seguimiento de Producción — Lote {parentCode || 'N/A'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-center text-slate-400 py-8">Cargando trazabilidad...</p>
        ) : (
          <div className="space-y-4">
            {/* ═══ 1. INFORMACIÓN GENERAL ═══ */}
            <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
              <div className="bg-slate-700 text-white px-4 py-2 font-bold text-sm">📋 Información General del Lote</div>
              <div className="bg-slate-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Código del Lote</p><p className="font-mono font-bold text-slate-800">{parentCode || '—'}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Producto Inicial</p><p className="font-bold text-slate-800">{parentLote?.descripcion || '—'}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Cantidad Inicial</p><p className="font-bold text-slate-800">{cantidadInicial} hojas</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Peso Inicial</p><p className="font-bold text-slate-800">{pesoInicial} kg</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">N° Sublotes</p><p className="font-bold text-slate-800">{sublotesData.length}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Estado General</p><p className={`font-extrabold ${estadoGeneralColor}`}>{estadoGeneral}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Fecha de Creación</p><p className="text-slate-700">{formatDateTime(parentLote?.created_date)}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Última Actualización</p><p className="text-slate-700">{formatDateTime(parentLote?.updated_date)}</p></div>
              </div>
            </div>

            {/* ═══ 2. RESUMEN GENERAL DEL LOTE ═══ */}
            <div className="border-2 border-indigo-400 rounded-xl overflow-hidden">
              <div className="bg-indigo-700 text-white px-4 py-2 font-bold text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" />Resumen General del Lote</div>
              <div className="bg-indigo-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Hojas Iniciales</p><p className="text-lg font-bold text-slate-800">{cantidadInicial}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Hojas Disponibles</p><p className="text-lg font-bold text-green-700">{hojasDisponibles}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Enviadas a Pintura</p><p className="text-lg font-bold text-blue-700">{hojasEnPintura + hojasTerminado}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Vendidas como Crosta</p><p className="text-lg font-bold text-amber-700">{hojasVendidasCrosta}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Convertidas en Producto Terminado</p><p className="text-lg font-bold text-purple-700">{hojasTerminado}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Hojas en Proceso</p><p className="text-lg font-bold text-cyan-700">{hojasEnProceso}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Mermas Registradas</p><p className="text-lg font-bold text-orange-700">{hojasMerma}</p></div>
                <div className="bg-white border rounded-lg p-2 text-center"><p className="text-slate-500 font-semibold">Agotadas</p><p className="text-lg font-bold text-gray-500">{hojasAgotadas}</p></div>
              </div>
            </div>

            {/* ═══ 3. RESUMEN COMERCIAL ═══ */}
            <div className="border-2 border-emerald-400 rounded-xl overflow-hidden">
              <div className="bg-emerald-700 text-white px-4 py-2 font-bold text-sm flex items-center gap-2"><DollarSign className="w-4 h-4" />Resumen Comercial</div>
              <div className="bg-emerald-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white border border-emerald-200 rounded-lg p-3 text-center ring-1 ring-emerald-300">
                  <p className="text-emerald-600 font-semibold">Disponible para vender como Crosta</p>
                  <p className="text-2xl font-extrabold text-emerald-700">{hojasDisponibles} hojas</p>
                </div>
                <div className="bg-white border rounded-lg p-3 text-center">
                  <p className="text-blue-600 font-semibold">Reservado para Pintura</p>
                  <p className="text-2xl font-extrabold text-blue-700">{hojasEnPintura} hojas</p>
                </div>
                <div className="bg-white border rounded-lg p-3 text-center">
                  <p className="text-purple-600 font-semibold">Convertido en Producto Terminado</p>
                  <p className="text-2xl font-extrabold text-purple-700">{hojasTerminado} hojas</p>
                </div>
                <div className="bg-white border rounded-lg p-3 text-center">
                  <p className="text-amber-600 font-semibold">Vendido como Crosta</p>
                  <p className="text-2xl font-extrabold text-amber-700">{hojasVendidasCrosta} hojas</p>
                </div>
              </div>
            </div>

            {/* ═══ Pendientes ═══ */}
            {pendientesLote.length > 0 && (
              <div className="border border-amber-300 bg-amber-50 rounded-lg p-3">
                <p className="font-bold text-amber-800 text-xs mb-1 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Pendientes del lote</p>
                <ul className="list-disc list-inside text-xs text-amber-800 space-y-0.5">
                  {pendientesLote.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            {/* ═══ 4. TABLA DE SUBLOTES ═══ */}
            <div className="border-2 border-purple-400 rounded-xl overflow-hidden">
              <div className="bg-purple-700 text-white px-4 py-2 font-bold text-sm">📊 Información por Sublotes</div>
              {sublotesData.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm bg-white">Este lote no tiene sublotes generados.</div>
              ) : (
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-purple-50">
                      <tr>
                        <th className="p-2 text-left"></th>
                        <th className="p-2 text-left">Código Sublote</th>
                        <th className="p-2 text-left">Código Producto</th>
                        <th className="p-2 text-left">Descripción</th>
                        <th className="p-2 text-left">Color Base</th>
                        <th className="p-2 text-left">Calibre</th>
                        <th className="p-2 text-center">Cant. Inicial</th>
                        <th className="p-2 text-center">Existencia Actual</th>
                        <th className="p-2 text-center">Peso</th>
                        <th className="p-2 text-center">Estado</th>
                        <th className="p-2 text-left">Proceso Actual</th>
                        <th className="p-2 text-left">Destino</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sublotesData.map((d, idx) => (
                        <React.Fragment key={d.sub.id}>
                          <tr className="border-t hover:bg-purple-50 cursor-pointer" onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}>
                            <td className="p-2">{expandedIdx === idx ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</td>
                            <td className="p-2 font-mono font-bold text-purple-800">{d.sub.codigo_lote}</td>
                            <td className="p-2 font-mono font-bold text-cyan-700">{d.sub.codigo_producto_proceso || '—'}</td>
                            <td className="p-2 max-w-[120px] truncate" title={d.sub.descripcion_producto_proceso || d.sub.descripcion || ''}>{d.sub.descripcion_producto_proceso || d.sub.descripcion || '—'}</td>
                            <td className="p-2 font-semibold">{d.sub.color_base || '—'}</td>
                            <td className="p-2">{d.sub.calibre || '—'}</td>
                            <td className="p-2 text-center font-bold">{d.sub.cantidad_hojas || 0}</td>
                            <td className="p-2 text-center font-bold text-emerald-700">{d.sub.cantidad_hojas || 0}</td>
                            <td className="p-2 text-center">{d.sub.peso_actual || 0} kg</td>
                            <td className="p-2 text-center">{ICONS[d.estado]} {STATUS_LABELS[d.estado]}</td>
                            <td className="p-2">{d.procesoActual}</td>
                            <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${DESTINO_COLORS[d.destino]}`}>{DESTINO_LABELS[d.destino]}</span></td>
                          </tr>
                          {expandedIdx === idx && (
                            <tr className="border-t bg-slate-50">
                              <td colSpan={12} className="p-3">
                                <p className="font-bold text-slate-700 text-xs mb-2">Historial de Procesos — Sublote {d.sub.codigo_lote}</p>
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

            {/* ═══ 5. HISTORIAL DE MOVIMIENTOS ═══ */}
            <div className="border-2 border-blue-400 rounded-xl overflow-hidden">
              <button className="w-full bg-blue-700 text-white px-4 py-2 font-bold text-sm flex items-center justify-between" onClick={() => setShowHistorial(!showHistorial)}>
                <span className="flex items-center gap-2">📜 Historial de Movimientos</span>
                {showHistorial ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
              {showHistorial && (
                <div className="overflow-x-auto bg-white">
                  {historialMovimientos.length === 0 ? (
                    <p className="p-4 text-center text-slate-400 text-sm">No hay movimientos registrados.</p>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="p-2 text-left">Fecha</th>
                          <th className="p-2 text-left">Hora</th>
                          <th className="p-2 text-left">Usuario</th>
                          <th className="p-2 text-left">Movimiento</th>
                          <th className="p-2 text-right">Cantidad Afectada</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historialMovimientos.map((m, i) => {
                          const dt = m.fecha ? new Date(m.fecha) : null;
                          return (
                            <tr key={i} className="border-t hover:bg-blue-50/30">
                              <td className="p-2">{dt ? dt.toLocaleDateString('es-CO') : '—'}</td>
                              <td className="p-2">{dt ? dt.toLocaleTimeString('es-CO') : '—'}</td>
                              <td className="p-2">{m.usuario || '—'}</td>
                              <td className="p-2">{m.movimiento}</td>
                              <td className="p-2 text-right font-bold">{m.cantidad_afectada || 0}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
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