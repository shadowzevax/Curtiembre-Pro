import React, { useState, useEffect, useCallback } from "react";
import { ProcesoProduccion, InventarioEnProceso, ProductoTerminado } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, X, RefreshCw, Download, ChevronDown, ChevronRight, Eye, TrendingUp, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('es-CO'); } catch { return d; } };
const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const ETAPA_ORDER = ['recepcion', 'limpieza', 'curtido', 'recurtido', 'pintura', 'acabado', 'producto_terminado', 'despachado'];
const ETAPA_LABELS = {
  recepcion: 'Recepción', limpieza: 'Limpieza', curtido: 'Curtido', recurtido: 'Recurtido',
  pintura: 'Pintura', acabado: 'Acabado', producto_terminado: 'Prod. Terminado', despachado: 'Despachado'
};
const ETAPA_COLORS = {
  recepcion: 'bg-gray-100 text-gray-700', limpieza: 'bg-blue-100 text-blue-700',
  curtido: 'bg-amber-100 text-amber-700', recurtido: 'bg-purple-100 text-purple-700',
  pintura: 'bg-pink-100 text-pink-700', acabado: 'bg-indigo-100 text-indigo-700',
  producto_terminado: 'bg-green-100 text-green-700', despachado: 'bg-emerald-100 text-emerald-700'
};

export default function SeguimientoProduccion() {
  const [allProcesos, setAllProcesos] = useState([]);
  const [allInv, setAllInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetalle, setShowDetalle] = useState(false);
  const [loteDetalle, setLoteDetalle] = useState(null);

  const [filtros, setFiltros] = useState({
    lote: '', partida: '', proveedor: '', color: '', estado: '', proceso: '', fechaIni: '', fechaFin: ''
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, invData] = await Promise.all([
        ProcesoProduccion.list(),
        InventarioEnProceso.list(),
      ]);
      setAllProcesos(Array.isArray(procesosData) ? procesosData : []);
      setAllInv(Array.isArray(invData) ? invData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Construir lotes únicos con toda la información
  const lotesData = (() => {
    const recepciones = allProcesos.filter(p => p.tipo_proceso === 'recepcion');
    const lotesCodigos = [...new Set([
      ...allProcesos.map(p => p.codigo_lote).filter(Boolean),
      ...allInv.map(i => i.codigo_lote_padre || i.codigo_lote).filter(Boolean)
    ])].filter(c => c);

    const result = [];
    for (const codigo of lotesCodigos) {
      if (!codigo || codigo.includes('-PR-') || codigo.includes('-S')) continue;
      const recepcion = recepciones.find(p => p.codigo_lote === codigo) ||
        allProcesos.find(p => p.codigo_lote === codigo && p.tipo_proceso === 'recepcion');
      const invLote = allInv.find(i => i.codigo_lote === codigo && !i.codigo_lote_padre);
      const partidas = allProcesos.filter(p => p.codigo_lote === codigo && p.tipo_proceso === 'recurtido' && p.estado !== 'anulado');
      const pinturas = allProcesos.filter(p => p.tipo_proceso === 'pintura' && partidas.some(pr => pr.numero_proceso === p.codigo_sublote || pr.inv_proceso_id === p.inv_proceso_id));
      const invPartidas = allInv.filter(i => i.codigo_lote_padre === codigo);

      // Determinar etapa actual
      let etapaActual = 'recepcion';
      if (allProcesos.some(p => p.codigo_lote === codigo && p.tipo_proceso === 'limpieza')) etapaActual = 'limpieza';
      if (allProcesos.some(p => p.codigo_lote === codigo && p.tipo_proceso === 'curtido')) etapaActual = 'curtido';
      if (partidas.length > 0) etapaActual = 'recurtido';
      if (pinturas.length > 0) etapaActual = 'pintura';
      if (invPartidas.some(i => i.destino_sublote === 'producto_terminado')) etapaActual = 'producto_terminado';

      const totalHojas = parseFloat(recepcion?.cantidad_hojas || invLote?.cantidad_hojas) || 0;
      const hojasProcesadas = partidas.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
      const hojasPendientes = Math.max(0, totalHojas - hojasProcesadas);
      const pctAvance = totalHojas > 0 ? Math.min(100, (hojasProcesadas / totalHojas) * 100) : 0;
      const fechaRecepcion = recepcion?.fecha_inicio || invLote?.fecha_ingreso_proceso || recepcion?.created_date;
      const diasTranscurridos = fechaRecepcion ? Math.floor((Date.now() - new Date(fechaRecepcion).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const ultimoMovimiento = [...allProcesos.filter(p => p.codigo_lote === codigo)]
        .sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date))[0];
      const diasSinMovimiento = ultimoMovimiento?.updated_date
        ? Math.floor((Date.now() - new Date(ultimoMovimiento.updated_date).getTime()) / (1000 * 60 * 60 * 24)) : null;

      result.push({
        codigo,
        etapaActual,
        totalHojas,
        hojasProcesadas,
        hojasPendientes,
        pctAvance,
        fechaRecepcion,
        diasTranscurridos,
        diasSinMovimiento,
        proveedor: recepcion?.nombre_proveedor || '',
        tipoCuero: recepcion?.clase_cuero || '',
        responsable: recepcion?.responsable || '',
        partidas,
        pinturas,
        invPartidas,
        costoAcumulado: parseFloat(invLote?.costo_acumulado) || 0,
        ultimoMovimiento: ultimoMovimiento?.updated_date || ultimoMovimiento?.created_date,
        tieneAlerta: diasSinMovimiento !== null && diasSinMovimiento > 7,
      });
    }
    return result.sort((a, b) => new Date(b.fechaRecepcion || 0) - new Date(a.fechaRecepcion || 0));
  })();

  const lotesFiltrados = lotesData.filter(l => {
    if (filtros.lote && !normalize(l.codigo).includes(normalize(filtros.lote))) return false;
    if (filtros.proveedor && !normalize(l.proveedor).includes(normalize(filtros.proveedor))) return false;
    if (filtros.color && !l.partidas.some(p => normalize(p.nombre_color).includes(normalize(filtros.color)))) return false;
    if (filtros.proceso && l.etapaActual !== filtros.proceso) return false;
    if (filtros.fechaIni && l.fechaRecepcion && l.fechaRecepcion < filtros.fechaIni) return false;
    if (filtros.fechaFin && l.fechaRecepcion && l.fechaRecepcion > filtros.fechaFin) return false;
    return true;
  });

  // Indicadores globales
  const totalLotes = lotesData.length;
  const lotesActivos = lotesData.filter(l => l.etapaActual !== 'despachado' && l.etapaActual !== 'producto_terminado').length;
  const lotesConAlerta = lotesData.filter(l => l.tieneAlerta).length;
  const lotesCompletados = lotesData.filter(l => l.pctAvance >= 100).length;

  const exportCSV = () => {
    const rows = [['Lote', 'Proveedor', 'Etapa Actual', 'Total Hojas', 'Hojas Procesadas', 'Pendientes', '% Avance', 'Días Transcurridos', 'Costo Acumulado']];
    lotesFiltrados.forEach(l => {
      rows.push([l.codigo, l.proveedor, ETAPA_LABELS[l.etapaActual] || l.etapaActual, l.totalHojas, l.hojasProcesadas, l.hojasPendientes, l.pctAvance.toFixed(1) + '%', l.diasTranscurridos, l.costoAcumulado]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `seguimiento_produccion_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const etapaBadge = (etapa) => (
    <Badge className={`text-xs ${ETAPA_COLORS[etapa] || 'bg-gray-100 text-gray-700'}`}>
      {ETAPA_LABELS[etapa] || etapa}
    </Badge>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">🏭 Seguimiento General de Producción</h1>
          <p className="text-sm text-slate-500 mt-0.5">Vista consolidada del estado de todos los lotes — solo consulta</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-2" />Exportar CSV
          </Button>
        </div>
      </div>

      {/* Indicadores globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500">Total Lotes</p>
          <p className="text-3xl font-extrabold text-blue-700">{totalLotes}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500">Lotes en Proceso</p>
          <p className="text-3xl font-extrabold text-amber-700">{lotesActivos}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500">Con Alertas</p>
          <p className="text-3xl font-extrabold text-red-700">{lotesConAlerta}</p>
          <p className="text-xs text-red-500">+7 días sin mov.</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500">Completados</p>
          <p className="text-3xl font-extrabold text-green-700">{lotesCompletados}</p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4 text-emerald-600" />Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <div>
              <Label className="text-xs">Código Lote</Label>
              <Input className="h-8 text-xs" value={filtros.lote} onChange={e => setFiltros(f => ({ ...f, lote: e.target.value }))} placeholder="Buscar..." />
            </div>
            <div>
              <Label className="text-xs">Proveedor</Label>
              <Input className="h-8 text-xs" value={filtros.proveedor} onChange={e => setFiltros(f => ({ ...f, proveedor: e.target.value }))} placeholder="Buscar..." />
            </div>
            <div>
              <Label className="text-xs">Color Base</Label>
              <Input className="h-8 text-xs" value={filtros.color} onChange={e => setFiltros(f => ({ ...f, color: e.target.value }))} placeholder="Buscar..." />
            </div>
            <div>
              <Label className="text-xs">Etapa Actual</Label>
              <Select value={filtros.proceso} onValueChange={v => setFiltros(f => ({ ...f, proceso: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Todas —</SelectItem>
                  {ETAPA_ORDER.map(e => <SelectItem key={e} value={e}>{ETAPA_LABELS[e]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fecha Inicial</Label>
              <Input type="date" className="h-8 text-xs" value={filtros.fechaIni} onChange={e => setFiltros(f => ({ ...f, fechaIni: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Fecha Final</Label>
              <Input type="date" className="h-8 text-xs" value={filtros.fechaFin} onChange={e => setFiltros(f => ({ ...f, fechaFin: e.target.value }))} />
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs mt-2" onClick={() => setFiltros({ lote: '', partida: '', proveedor: '', color: '', estado: '', proceso: '', fechaIni: '', fechaFin: '' })}>
            <X className="w-3 h-3 mr-1" />Limpiar Filtros
          </Button>
        </CardContent>
      </Card>

      {/* Tabla principal */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">📋 Estado de Lotes de Producción ({lotesFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-400">Cargando datos...</div>
          ) : lotesFiltrados.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No se encontraron lotes con los filtros actuales.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-800 text-white">
                  <tr>
                    <th className="p-2 text-left">Código Lote</th>
                    <th className="p-2 text-left">Proveedor</th>
                    <th className="p-2 text-left">Etapa Actual</th>
                    <th className="p-2 text-right">Total Hojas</th>
                    <th className="p-2 text-right">Procesadas</th>
                    <th className="p-2 text-right">Pendientes</th>
                    <th className="p-2 text-center">% Avance</th>
                    <th className="p-2 text-center">Fecha Recepción</th>
                    <th className="p-2 text-center">Días Total</th>
                    <th className="p-2 text-center">Último Mov.</th>
                    <th className="p-2 text-right">Costo Acumulado</th>
                    <th className="p-2 text-center">Alerta</th>
                    <th className="p-2 text-center">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesFiltrados.map(lote => (
                    <tr key={lote.codigo} className={`border-t hover:bg-slate-50 ${lote.tieneAlerta ? 'bg-red-50' : ''}`}>
                      <td className="p-2 font-mono font-bold text-purple-800">{lote.codigo}</td>
                      <td className="p-2 text-slate-600">{lote.proveedor || '—'}</td>
                      <td className="p-2">{etapaBadge(lote.etapaActual)}</td>
                      <td className="p-2 text-right font-bold">{lote.totalHojas}</td>
                      <td className="p-2 text-right text-emerald-700 font-bold">{lote.hojasProcesadas}</td>
                      <td className="p-2 text-right text-amber-700 font-bold">{lote.hojasPendientes}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div className={`h-2 rounded-full ${lote.pctAvance >= 100 ? 'bg-green-500' : lote.pctAvance > 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                              style={{ width: `${Math.min(100, lote.pctAvance)}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 whitespace-nowrap">{lote.pctAvance.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-2 text-center text-slate-500">{fmtDate(lote.fechaRecepcion)}</td>
                      <td className="p-2 text-center">
                        <span className={`font-bold ${lote.diasTranscurridos > 30 ? 'text-red-600' : lote.diasTranscurridos > 14 ? 'text-amber-600' : 'text-slate-600'}`}>
                          {lote.diasTranscurridos}d
                        </span>
                      </td>
                      <td className="p-2 text-center text-slate-500">{fmtDate(lote.ultimoMovimiento)}</td>
                      <td className="p-2 text-right font-semibold text-emerald-700">{formatCurrency(lote.costoAcumulado)}</td>
                      <td className="p-2 text-center">
                        {lote.tieneAlerta ? (
                          <span className="flex items-center justify-center text-red-500" title={`Sin movimiento por ${lote.diasSinMovimiento} días`}>
                            <AlertTriangle className="w-4 h-4" />
                          </span>
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-green-400 mx-auto" />
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setLoteDetalle(lote); setShowDetalle(true); }}>
                          <Eye className="w-3 h-3 mr-1" />Ver
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Detalle Lote */}
      <Dialog open={showDetalle} onOpenChange={setShowDetalle}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📦 Detalle del Lote: <span className="font-mono text-purple-700">{loteDetalle?.codigo}</span></DialogTitle>
          </DialogHeader>
          {loteDetalle && (
            <div className="space-y-4">
              {/* Resumen */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">Total Hojas</p>
                  <p className="text-2xl font-bold text-blue-700">{loteDetalle.totalHojas}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">Procesadas</p>
                  <p className="text-2xl font-bold text-emerald-700">{loteDetalle.hojasProcesadas}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">Pendientes</p>
                  <p className="text-2xl font-bold text-amber-700">{loteDetalle.hojasPendientes}</p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">Partidas</p>
                  <p className="text-2xl font-bold text-purple-700">{loteDetalle.partidas.length}</p>
                </div>
                <div className="bg-slate-50 border rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">Días en Prod.</p>
                  <p className="text-2xl font-bold text-slate-700">{loteDetalle.diasTranscurridos}</p>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
                  <p className="text-xs text-slate-500">Costo Acumulado</p>
                  <p className="text-sm font-bold text-green-700">{formatCurrency(loteDetalle.costoAcumulado)}</p>
                </div>
              </div>

              {/* Barra avance */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Avance de producción</span>
                  <span className="font-bold text-purple-700">{loteDetalle.pctAvance.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden">
                  <div className={`h-5 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all ${loteDetalle.pctAvance >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.max(loteDetalle.pctAvance, 5)}%` }}>
                    {loteDetalle.pctAvance.toFixed(0)}%
                  </div>
                </div>
              </div>

              {/* Línea de tiempo */}
              <div>
                <h3 className="font-semibold text-sm text-slate-700 mb-2">🔗 Línea de Tiempo del Proceso</h3>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {ETAPA_ORDER.map((etapa, i) => {
                    const etapaIdx = ETAPA_ORDER.indexOf(loteDetalle.etapaActual);
                    const isCompleted = i < etapaIdx;
                    const isCurrent = i === etapaIdx;
                    return (
                      <React.Fragment key={etapa}>
                        <div className={`flex flex-col items-center min-w-[80px] px-2 py-1.5 rounded-lg text-center border ${isCurrent ? 'bg-purple-100 border-purple-400 text-purple-800' : isCompleted ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                          <span className="text-xs font-bold">{isCompleted ? '✓' : isCurrent ? '●' : '○'}</span>
                          <span className="text-xs mt-0.5">{ETAPA_LABELS[etapa]}</span>
                        </div>
                        {i < ETAPA_ORDER.length - 1 && <div className={`w-4 h-0.5 flex-shrink-0 ${i < etapaIdx ? 'bg-green-400' : 'bg-gray-200'}`} />}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Partidas de recurtido */}
              {loteDetalle.partidas.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-slate-700 mb-2">📂 Partidas de Recurtido</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-purple-800 text-white">
                        <tr>
                          <th className="p-2 text-left">Código Partida</th>
                          <th className="p-2 text-left">Base/Color</th>
                          <th className="p-2 text-right">Hojas</th>
                          <th className="p-2 text-right">Peso</th>
                          <th className="p-2 text-center">Estado</th>
                          <th className="p-2 text-center">Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loteDetalle.partidas.map(p => (
                          <tr key={p.id} className={`border-t ${p.estado === 'completado' ? 'bg-green-50' : ''}`}>
                            <td className="p-2 font-mono font-bold text-purple-800">{p.numero_proceso}</td>
                            <td className="p-2">{p.nombre_color || '—'}</td>
                            <td className="p-2 text-right font-bold">{p.cantidad_pieles}</td>
                            <td className="p-2 text-right">{p.peso_actual} kg</td>
                            <td className="p-2 text-center">
                              <Badge className={`text-xs ${p.estado === 'completado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {p.estado === 'completado' ? 'Finalizada' : 'Pendiente'}
                              </Badge>
                            </td>
                            <td className="p-2 text-center text-slate-500">{fmtDate(p.fecha_inicio)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-purple-50 font-bold border-t-2">
                          <td colSpan={2} className="p-2 text-right text-xs">TOTAL:</td>
                          <td className="p-2 text-right">{loteDetalle.partidas.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0)}</td>
                          <td className="p-2 text-right">{loteDetalle.partidas.reduce((s, p) => s + (parseFloat(p.peso_actual) || 0), 0).toFixed(2)} kg</td>
                          <td colSpan={2} className="p-2 text-center text-xs">
                            {loteDetalle.hojasPendientes === 0 ? '✔ Completo' : `⚠ Faltan ${loteDetalle.hojasPendientes} hojas`}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDetalle(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}