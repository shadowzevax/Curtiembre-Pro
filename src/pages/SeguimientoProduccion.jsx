import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ProcesoProduccion, InventarioEnProceso } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Search, X, RefreshCw, Download, Eye, AlertTriangle, CheckCircle2,
  TrendingUp, Activity, Package, Clock, BarChart2, Filter, Zap, ChevronRight
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('es-CO'); } catch { return d; } };
const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const ETAPA_ORDER = ['recepcion', 'limpieza', 'curtido', 'recurtido', 'pintura', 'acabado', 'producto_terminado', 'despachado'];
const ETAPA_LABELS = {
  recepcion: 'Recepción', limpieza: 'Limpieza', curtido: 'Curtido', recurtido: 'Recurtido',
  pintura: 'Pintura', acabado: 'Acabado', producto_terminado: 'Prod. Terminado', despachado: 'Despachado'
};
const ETAPA_BG = {
  recepcion: 'bg-gray-100 text-gray-700 border-gray-300',
  limpieza: 'bg-blue-100 text-blue-700 border-blue-300',
  curtido: 'bg-amber-100 text-amber-700 border-amber-300',
  recurtido: 'bg-purple-100 text-purple-700 border-purple-300',
  pintura: 'bg-pink-100 text-pink-700 border-pink-300',
  acabado: 'bg-indigo-100 text-indigo-700 border-indigo-300',
  producto_terminado: 'bg-green-100 text-green-700 border-green-300',
  despachado: 'bg-emerald-100 text-emerald-700 border-emerald-300',
};
const ETAPA_NEXT = {
  recepcion: 'limpieza', limpieza: 'curtido', curtido: 'recurtido',
  recurtido: 'pintura', pintura: 'acabado', acabado: 'producto_terminado',
  producto_terminado: 'despachado', despachado: '—'
};
const CHART_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#f97316', '#06b6d4', '#84cc16'];

const FILTROS_RAPIDOS = [
  { key: 'alertas', label: '🔴 Solo Alertas', fn: l => l.tieneAlerta },
  { key: 'retrasados', label: '⏰ Retrasados', fn: l => l.diasSinMovimiento > 5 },
  { key: 'terminados', label: '✅ Terminados', fn: l => l.etapaActual === 'producto_terminado' || l.etapaActual === 'despachado' },
  { key: 'en_curso', label: '🔄 En Curso', fn: l => !['producto_terminado','despachado'].includes(l.etapaActual) },
  { key: 'completos', label: '💯 100% Avance', fn: l => l.pctAvance >= 100 },
];

export default function SeguimientoProduccion() {
  const [allProcesos, setAllProcesos] = useState([]);
  const [allInv, setAllInv] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetalle, setShowDetalle] = useState(false);
  const [loteDetalle, setLoteDetalle] = useState(null);
  const [filtroRapido, setFiltroRapido] = useState('');
  const [showGraficos, setShowGraficos] = useState(false);

  const [filtros, setFiltros] = useState({
    lote: '', proveedor: '', color: '', proceso: '', prioridad: '', fechaIni: '', fechaFin: ''
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

  // ─── CONSTRUIR DATOS DE LOTES ─────────────────────────────────────────────
  const lotesData = useMemo(() => {
    const recepciones = allProcesos.filter(p => p.tipo_proceso === 'recepcion');
    const lotesCodigos = [...new Set([
      ...allProcesos.map(p => p.codigo_lote).filter(Boolean),
      ...allInv.map(i => i.codigo_lote_padre || i.codigo_lote).filter(Boolean)
    ])].filter(c => c && !c.includes('-PR-') && !c.includes('-SUB'));

    const result = [];
    for (const codigo of lotesCodigos) {
      const recepcion = recepciones.find(p => p.codigo_lote === codigo);
      const invLote = allInv.find(i => i.codigo_lote === codigo && !i.codigo_lote_padre);
      const allLoteProcesos = allProcesos.filter(p => p.codigo_lote === codigo);
      const partidas = allLoteProcesos.filter(p => p.tipo_proceso === 'recurtido' && p.estado !== 'anulado');
      const pinturas = allProcesos.filter(p => p.tipo_proceso === 'pintura' &&
        partidas.some(pr => pr.numero_proceso === p.codigo_sublote || pr.inv_proceso_id === p.inv_proceso_id));
      const invPartidas = allInv.filter(i => i.codigo_lote_padre === codigo);

      // Etapa actual
      let etapaActual = 'recepcion';
      if (allLoteProcesos.some(p => p.tipo_proceso === 'limpieza')) etapaActual = 'limpieza';
      if (allLoteProcesos.some(p => p.tipo_proceso === 'curtido')) etapaActual = 'curtido';
      if (partidas.length > 0) etapaActual = 'recurtido';
      if (pinturas.length > 0) etapaActual = 'pintura';
      if (allLoteProcesos.some(p => p.tipo_proceso === 'acabado')) etapaActual = 'acabado';
      if (invPartidas.some(i => i.destino_sublote === 'producto_terminado')) etapaActual = 'producto_terminado';

      const totalHojas = parseFloat(recepcion?.cantidad_hojas || recepcion?.cantidad_total_lote_hojas || invLote?.cantidad_hojas) || 0;
      const hojasProcesadas = partidas.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
      const hojasTerminadas = pinturas.reduce((s, p) => s + (parseFloat(p.hojas_pintadas_recibidas) || parseFloat(p.hojas_buenas_finales) || 0), 0);
      const hojasPendientes = Math.max(0, totalHojas - hojasProcesadas);
      const pctAvance = totalHojas > 0 ? Math.min(100, (hojasProcesadas / totalHojas) * 100) : 0;
      const rendimiento = totalHojas > 0 && hojasTerminadas > 0 ? (hojasTerminadas / totalHojas) * 100 : pctAvance;

      const fechaRecepcion = recepcion?.fecha_inicio || invLote?.fecha_ingreso_proceso || recepcion?.created_date;
      const diasTranscurridos = fechaRecepcion ? Math.floor((Date.now() - new Date(fechaRecepcion).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      const ultimoProc = [...allLoteProcesos].sort((a, b) =>
        new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date))[0];
      const ultimoMovFecha = ultimoProc?.updated_date || ultimoProc?.created_date;
      const diasSinMovimiento = ultimoMovFecha
        ? Math.floor((Date.now() - new Date(ultimoMovFecha).getTime()) / (1000 * 60 * 60 * 24)) : 0;

      // Semáforo
      let semaforo = 'verde';
      if (diasSinMovimiento > 10 || diasTranscurridos > 60) semaforo = 'rojo';
      else if (diasSinMovimiento > 5 || diasTranscurridos > 30) semaforo = 'amarillo';

      // Alerta descriptiva
      let alertaDesc = '';
      if (diasSinMovimiento > 7) alertaDesc = `Sin movimiento ${diasSinMovimiento} días`;
      else if (hojasPendientes > 0 && etapaActual === 'recurtido') alertaDesc = `Pendiente de Pintura`;
      else if (etapaActual === 'pintura') alertaDesc = `En proceso de Pintura`;
      else if (etapaActual === 'producto_terminado') alertaDesc = `Pendiente de Despacho`;

      const costoAcumulado = parseFloat(invLote?.costo_acumulado) || 0;
      const costoPorHoja = totalHojas > 0 ? costoAcumulado / totalHojas : 0;

      result.push({
        codigo,
        etapaActual,
        proximoProceso: ETAPA_NEXT[etapaActual] || '—',
        totalHojas,
        hojasProcesadas,
        hojasTerminadas,
        hojasPendientes,
        pctAvance,
        rendimiento,
        fechaRecepcion,
        diasTranscurridos,
        diasSinMovimiento,
        semaforo,
        alertaDesc,
        proveedor: recepcion?.nombre_proveedor || invLote?.observaciones || '',
        tipoCuero: recepcion?.clase_cuero || '',
        responsable: recepcion?.responsable || recepcion?.nombre_curtidor || '',
        prioridad: diasTranscurridos > 45 ? 'Alta' : diasTranscurridos > 20 ? 'Media' : 'Baja',
        partidas,
        pinturas,
        invPartidas,
        allLoteProcesos,
        costoAcumulado,
        costoPorHoja,
        ultimoMovimiento: ultimoMovFecha,
        tieneAlerta: diasSinMovimiento > 7 || semaforo === 'rojo',
      });
    }
    return result.sort((a, b) => new Date(b.fechaRecepcion || 0) - new Date(a.fechaRecepcion || 0));
  }, [allProcesos, allInv]);

  // ─── FILTRADO ─────────────────────────────────────────────────────────────
  const lotesFiltrados = useMemo(() => {
    let res = [...lotesData];
    if (filtroRapido) {
      const fr = FILTROS_RAPIDOS.find(f => f.key === filtroRapido);
      if (fr) res = res.filter(fr.fn);
    }
    if (filtros.lote) res = res.filter(l => normalize(l.codigo).includes(normalize(filtros.lote)));
    if (filtros.proveedor) res = res.filter(l => normalize(l.proveedor).includes(normalize(filtros.proveedor)));
    if (filtros.color) res = res.filter(l => l.partidas.some(p => normalize(p.nombre_color).includes(normalize(filtros.color))));
    if (filtros.proceso) res = res.filter(l => l.etapaActual === filtros.proceso);
    if (filtros.prioridad) res = res.filter(l => l.prioridad === filtros.prioridad);
    if (filtros.fechaIni) res = res.filter(l => l.fechaRecepcion && l.fechaRecepcion >= filtros.fechaIni);
    if (filtros.fechaFin) res = res.filter(l => l.fechaRecepcion && l.fechaRecepcion <= filtros.fechaFin);
    return res;
  }, [lotesData, filtros, filtroRapido]);

  // ─── KPIs GLOBALES ─────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalLotes = lotesData.length;
    const lotesEnProd = lotesData.filter(l => !['producto_terminado','despachado'].includes(l.etapaActual)).length;
    const lotesTerminados = lotesData.filter(l => l.etapaActual === 'producto_terminado').length;
    const lotesDespachados = lotesData.filter(l => l.etapaActual === 'despachado').length;
    const lotesConAlerta = lotesData.filter(l => l.tieneAlerta).length;
    const totalHojasEnProd = lotesData.filter(l => lotesEnProd).reduce((s, l) => s + l.totalHojas, 0);
    const totalHojasTerminadas = lotesData.reduce((s, l) => s + l.hojasTerminadas, 0);
    const totalHojasPendientes = lotesData.reduce((s, l) => s + l.hojasPendientes, 0);
    const totalHojasAll = lotesData.reduce((s, l) => s + l.totalHojas, 0);
    const pctGeneral = totalHojasAll > 0 ? (lotesData.reduce((s, l) => s + l.hojasProcesadas, 0) / totalHojasAll) * 100 : 0;
    const tiempoPromedio = lotesData.length > 0 ? (lotesData.reduce((s, l) => s + l.diasTranscurridos, 0) / lotesData.length) : 0;
    const costoTotal = lotesData.reduce((s, l) => s + l.costoAcumulado, 0);
    const costoPorLote = lotesData.length > 0 ? costoTotal / lotesData.length : 0;
    return { totalLotes, lotesEnProd, lotesTerminados, lotesDespachados, lotesConAlerta, totalHojasEnProd, totalHojasTerminadas, totalHojasPendientes, pctGeneral, tiempoPromedio, costoTotal, costoPorLote };
  }, [lotesData]);

  // ─── DATOS GRÁFICOS ────────────────────────────────────────────────────────
  const dataPorEtapa = useMemo(() => {
    const counts = {};
    ETAPA_ORDER.forEach(e => { counts[e] = 0; });
    lotesData.forEach(l => { counts[l.etapaActual] = (counts[l.etapaActual] || 0) + 1; });
    return ETAPA_ORDER.map(e => ({ name: ETAPA_LABELS[e], value: counts[e] || 0 })).filter(d => d.value > 0);
  }, [lotesData]);

  const dataHojas = useMemo(() => [
    { name: 'Procesadas', value: lotesData.reduce((s, l) => s + l.hojasProcesadas, 0) },
    { name: 'Pendientes', value: lotesData.reduce((s, l) => s + l.hojasPendientes, 0) },
    { name: 'Terminadas', value: lotesData.reduce((s, l) => s + l.hojasTerminadas, 0) },
  ], [lotesData]);

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [['Lote','Proveedor','Etapa','Prioridad','Total Hojas','Procesadas','Pendientes','% Avance','Rendimiento %','Días Total','Días sin Mov.','Próx. Proceso','Costo Acumulado','Alerta']];
    lotesFiltrados.forEach(l => rows.push([
      l.codigo, l.proveedor, ETAPA_LABELS[l.etapaActual], l.prioridad,
      l.totalHojas, l.hojasProcesadas, l.hojasPendientes,
      l.pctAvance.toFixed(1)+'%', l.rendimiento.toFixed(1)+'%',
      l.diasTranscurridos, l.diasSinMovimiento,
      ETAPA_LABELS[l.proximoProceso] || l.proximoProceso,
      l.costoAcumulado, l.alertaDesc
    ]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `seguimiento_produccion_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const semaforoClass = (s) => s === 'rojo' ? 'bg-red-500' : s === 'amarillo' ? 'bg-yellow-400' : 'bg-green-500';
  const semaforoRow = (s) => s === 'rojo' ? 'bg-red-50' : s === 'amarillo' ? 'bg-yellow-50' : '';
  const prioridadClass = (p) => p === 'Alta' ? 'bg-red-100 text-red-700' : p === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

  const etapaBadge = (etapa) => (
    <Badge className={`text-xs border ${ETAPA_BG[etapa] || 'bg-gray-100 text-gray-700'}`}>
      {ETAPA_LABELS[etapa] || etapa}
    </Badge>
  );

  return (
    <div className="p-4 space-y-4 bg-slate-50 min-h-screen">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            🏭 Seguimiento General de Producción
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Tablero de control en tiempo real — solo consulta</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowGraficos(v => !v)}>
            <BarChart2 className="w-4 h-4 mr-1" />{showGraficos ? 'Ocultar' : 'Ver'} Gráficos
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" />CSV
          </Button>
        </div>
      </div>

      {/* ─── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Lotes', value: kpis.totalLotes, color: 'blue', icon: Package },
          { label: 'En Producción', value: kpis.lotesEnProd, color: 'amber', icon: Activity },
          { label: 'Terminados', value: kpis.lotesTerminados, color: 'green', icon: CheckCircle2 },
          { label: 'Con Alertas', value: kpis.lotesConAlerta, color: 'red', icon: AlertTriangle, sub: `${kpis.lotesDespachados} despachados` },
          { label: '% Avance General', value: kpis.pctGeneral.toFixed(0)+'%', color: 'purple', icon: TrendingUp, sub: `Prom. ${kpis.tiempoPromedio.toFixed(0)}d/lote` },
        ].map(k => (
          <div key={k.label} className={`bg-${k.color}-50 border border-${k.color}-200 rounded-xl p-3 text-center`}>
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`text-3xl font-extrabold text-${k.color}-700`}>{k.value}</p>
            {k.sub && <p className={`text-xs text-${k.color}-500 mt-0.5`}>{k.sub}</p>}
          </div>
        ))}
      </div>

      {/* KPIs hojas + costos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500">Total Hojas en Producción</p>
          <p className="text-2xl font-bold text-blue-700">{lotesData.reduce((s,l)=>s+l.totalHojas,0)}</p>
        </div>
        <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500">Hojas Pendientes</p>
          <p className="text-2xl font-bold text-amber-700">{kpis.totalHojasPendientes}</p>
        </div>
        <div className="bg-white border rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500">Costo Total Producción</p>
          <p className="text-lg font-bold text-emerald-700">{formatCurrency(kpis.costoTotal)}</p>
          <p className="text-xs text-slate-400">Prom/lote: {formatCurrency(kpis.costoPorLote)}</p>
        </div>
        <div className="bg-white border rounded-xl p-3">
          <p className="text-xs text-slate-500 mb-1">Avance General de Producción</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
              <div className={`h-4 rounded-full flex items-center justify-center text-white text-xs font-bold transition-all ${kpis.pctGeneral >= 100 ? 'bg-green-500' : kpis.pctGeneral > 60 ? 'bg-blue-500' : 'bg-amber-400'}`}
                style={{ width: `${Math.max(kpis.pctGeneral, 4)}%` }}>
                {kpis.pctGeneral >= 20 ? `${kpis.pctGeneral.toFixed(0)}%` : ''}
              </div>
            </div>
            <span className="text-sm font-bold text-slate-700">{kpis.pctGeneral.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* ─── GRÁFICOS ─────────────────────────────────────────────────────── */}
      {showGraficos && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Lotes por Etapa</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dataPorEtapa}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" name="Lotes" fill="#6366f1" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Distribución de Hojas</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={dataHojas} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({name,value}) => `${name}: ${value}`}>
                    {dataHojas.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── FILTROS RÁPIDOS ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-slate-500 self-center font-semibold flex items-center gap-1"><Zap className="w-3 h-3" />Filtros rápidos:</span>
        {FILTROS_RAPIDOS.map(fr => (
          <Button key={fr.key} size="sm" variant={filtroRapido === fr.key ? 'default' : 'outline'} className="h-7 text-xs"
            onClick={() => setFiltroRapido(filtroRapido === fr.key ? '' : fr.key)}>
            {fr.label}
          </Button>
        ))}
        {filtroRapido && <Button size="sm" variant="ghost" className="h-7 text-xs text-red-500" onClick={() => setFiltroRapido('')}><X className="w-3 h-3 mr-1" />Quitar</Button>}
      </div>

      {/* ─── FILTROS AVANZADOS ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Filter className="w-4 h-4 text-emerald-600" />Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
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
              <Label className="text-xs">Etapa</Label>
              <Select value={filtros.proceso} onValueChange={v => setFiltros(f => ({ ...f, proceso: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Todas —</SelectItem>
                  {ETAPA_ORDER.map(e => <SelectItem key={e} value={e}>{ETAPA_LABELS[e]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridad</Label>
              <Select value={filtros.prioridad} onValueChange={v => setFiltros(f => ({ ...f, prioridad: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Todas —</SelectItem>
                  <SelectItem value="Alta">Alta</SelectItem>
                  <SelectItem value="Media">Media</SelectItem>
                  <SelectItem value="Baja">Baja</SelectItem>
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
          <Button size="sm" variant="outline" className="h-7 text-xs mt-2" onClick={() => setFiltros({ lote:'', proveedor:'', color:'', proceso:'', prioridad:'', fechaIni:'', fechaFin:'' })}>
            <X className="w-3 h-3 mr-1" />Limpiar
          </Button>
        </CardContent>
      </Card>

      {/* ─── TABLA PRINCIPAL ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">📋 Estado de Lotes de Producción ({lotesFiltrados.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-8 text-slate-400">Cargando datos...</div>
          ) : lotesFiltrados.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No se encontraron lotes con los filtros actuales.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-800 text-white sticky top-0">
                  <tr>
                    <th className="p-2 text-center w-3">🚦</th>
                    <th className="p-2 text-left">Código Lote</th>
                    <th className="p-2 text-left">Proveedor</th>
                    <th className="p-2 text-center">Prioridad</th>
                    <th className="p-2 text-left">Etapa Actual</th>
                    <th className="p-2 text-left">Próx. Proceso</th>
                    <th className="p-2 text-left">Responsable</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-right">Procesadas</th>
                    <th className="p-2 text-right">Pendientes</th>
                    <th className="p-2 text-center min-w-[100px]">% Avance</th>
                    <th className="p-2 text-center">Rendimiento</th>
                    <th className="p-2 text-center">Días sin Mov.</th>
                    <th className="p-2 text-right">Costo/Hoja</th>
                    <th className="p-2 text-left">Alerta</th>
                    <th className="p-2 text-center">Trazabilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {lotesFiltrados.map(lote => (
                    <tr key={lote.codigo} className={`border-t hover:bg-slate-100 ${semaforoRow(lote.semaforo)}`}>
                      <td className="p-2 text-center">
                        <div className={`w-3 h-3 rounded-full mx-auto ${semaforoClass(lote.semaforo)}`} title={lote.semaforo} />
                      </td>
                      <td className="p-2 font-mono font-bold text-purple-800">{lote.codigo}</td>
                      <td className="p-2 text-slate-600 max-w-[100px] truncate">{lote.proveedor || '—'}</td>
                      <td className="p-2 text-center">
                        <Badge className={`text-xs ${prioridadClass(lote.prioridad)}`}>{lote.prioridad}</Badge>
                      </td>
                      <td className="p-2">{etapaBadge(lote.etapaActual)}</td>
                      <td className="p-2 text-slate-500 text-xs flex items-center gap-1">
                        <ChevronRight className="w-3 h-3" />{ETAPA_LABELS[lote.proximoProceso] || lote.proximoProceso}
                      </td>
                      <td className="p-2 text-slate-600 max-w-[80px] truncate">{lote.responsable || '—'}</td>
                      <td className="p-2 text-right font-bold">{lote.totalHojas}</td>
                      <td className="p-2 text-right text-emerald-700 font-bold">{lote.hojasProcesadas}</td>
                      <td className="p-2 text-right text-amber-700 font-bold">{lote.hojasPendientes}</td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px] overflow-hidden">
                            <div className={`h-2 rounded-full ${lote.pctAvance >= 100 ? 'bg-green-500' : lote.pctAvance > 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                              style={{ width: `${Math.min(100, lote.pctAvance)}%` }} />
                          </div>
                          <span className="font-bold text-slate-600 whitespace-nowrap">{lote.pctAvance.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-2 text-center">
                        <span className={`font-bold ${lote.rendimiento >= 95 ? 'text-green-700' : lote.rendimiento >= 80 ? 'text-amber-600' : 'text-red-600'}`}>
                          {lote.rendimiento.toFixed(1)}%
                        </span>
                      </td>
                      <td className="p-2 text-center">
                        <span className={`font-bold ${lote.diasSinMovimiento > 7 ? 'text-red-600' : lote.diasSinMovimiento > 4 ? 'text-amber-600' : 'text-green-600'}`}>
                          {lote.diasSinMovimiento}d
                        </span>
                      </td>
                      <td className="p-2 text-right text-emerald-700">{lote.totalHojas > 0 ? formatCurrency(lote.costoPorHoja) : '—'}</td>
                      <td className="p-2 text-xs text-slate-500 max-w-[120px] truncate" title={lote.alertaDesc}>{lote.alertaDesc || '✓ OK'}</td>
                      <td className="p-2 text-center">
                        <Button size="sm" variant="outline" className="h-7 text-xs whitespace-nowrap"
                          onClick={() => { setLoteDetalle(lote); setShowDetalle(true); }}>
                          <Eye className="w-3 h-3 mr-1" />Trazabilidad
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

      {/* ─── MODAL FICHA INTEGRAL DEL LOTE ───────────────────────────────── */}
      <Dialog open={showDetalle} onOpenChange={setShowDetalle}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>📦 Ficha Integral del Lote: <span className="font-mono text-purple-700">{loteDetalle?.codigo}</span></DialogTitle>
          </DialogHeader>
          {loteDetalle && (
            <div className="space-y-5">

              {/* Info General */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-xl border text-xs">
                <div><span className="font-semibold text-slate-500">Código Lote:</span><p className="font-mono font-bold text-purple-800">{loteDetalle.codigo}</p></div>
                <div><span className="font-semibold text-slate-500">Fecha Recepción:</span><p>{fmtDate(loteDetalle.fechaRecepcion)}</p></div>
                <div><span className="font-semibold text-slate-500">Proveedor:</span><p>{loteDetalle.proveedor || '—'}</p></div>
                <div><span className="font-semibold text-slate-500">Responsable:</span><p>{loteDetalle.responsable || '—'}</p></div>
                <div><span className="font-semibold text-slate-500">Tipo Cuero:</span><p>{loteDetalle.tipoCuero || '—'}</p></div>
                <div><span className="font-semibold text-slate-500">Etapa Actual:</span><p>{ETAPA_LABELS[loteDetalle.etapaActual]}</p></div>
                <div><span className="font-semibold text-slate-500">Prioridad:</span><Badge className={`text-xs ${prioridadClass(loteDetalle.prioridad)}`}>{loteDetalle.prioridad}</Badge></div>
                <div><span className="font-semibold text-slate-500">Semáforo:</span>
                  <div className={`w-4 h-4 rounded-full mt-0.5 ${semaforoClass(loteDetalle.semaforo)}`} /></div>
              </div>

              {/* KPIs del lote */}
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { label: 'Total Hojas', value: loteDetalle.totalHojas, color: 'blue' },
                  { label: 'Procesadas', value: loteDetalle.hojasProcesadas, color: 'emerald' },
                  { label: 'Pendientes', value: loteDetalle.hojasPendientes, color: 'amber' },
                  { label: 'Partidas PR', value: loteDetalle.partidas.length, color: 'purple' },
                  { label: 'Días en Prod.', value: loteDetalle.diasTranscurridos+'d', color: 'slate' },
                  { label: 'Rendimiento', value: loteDetalle.rendimiento.toFixed(1)+'%', color: 'green' },
                ].map(k => (
                  <div key={k.label} className={`bg-${k.color}-50 border border-${k.color}-200 rounded-lg p-2 text-center`}>
                    <p className="text-xs text-slate-500">{k.label}</p>
                    <p className={`text-xl font-bold text-${k.color}-700`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Barra avance */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-500">Avance de producción</span>
                  <span className="font-bold text-purple-700">{loteDetalle.pctAvance.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-5 overflow-hidden">
                  <div className={`h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${loteDetalle.pctAvance >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.max(loteDetalle.pctAvance, 5)}%` }}>
                    {loteDetalle.pctAvance >= 15 ? `${loteDetalle.pctAvance.toFixed(0)}%` : ''}
                  </div>
                </div>
              </div>

              {/* Costos */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-center">
                  <p className="text-slate-500">Costo Acumulado</p>
                  <p className="text-base font-bold text-emerald-700">{formatCurrency(loteDetalle.costoAcumulado)}</p>
                </div>
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-slate-500">Costo Promedio / Hoja</p>
                  <p className="text-base font-bold text-blue-700">{loteDetalle.totalHojas > 0 ? formatCurrency(loteDetalle.costoPorHoja) : '—'}</p>
                </div>
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-center">
                  <p className="text-slate-500">Indicador Rendimiento</p>
                  <p className="text-base font-bold text-purple-700">
                    {loteDetalle.hojasProcesadas} → {loteDetalle.hojasTerminadas} hojas ({loteDetalle.rendimiento.toFixed(1)}%)
                  </p>
                </div>
              </div>

              {/* Línea de tiempo */}
              <div>
                <h3 className="font-semibold text-sm text-slate-700 mb-2">🔗 Trazabilidad — Línea de Tiempo</h3>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {ETAPA_ORDER.map((etapa, i) => {
                    const etapaIdx = ETAPA_ORDER.indexOf(loteDetalle.etapaActual);
                    const isCompleted = i < etapaIdx;
                    const isCurrent = i === etapaIdx;
                    const etapaProcesos = loteDetalle.allLoteProcesos.filter(p => p.tipo_proceso === etapa.replace('_',' '));
                    const fecha = etapaProcesos[0]?.fecha_inicio;
                    return (
                      <React.Fragment key={etapa}>
                        <div className={`flex flex-col items-center min-w-[82px] px-2 py-2 rounded-lg text-center border text-xs ${isCurrent ? 'bg-purple-100 border-purple-400 text-purple-800' : isCompleted ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                          <span className="text-base">{isCompleted ? '✓' : isCurrent ? '●' : '○'}</span>
                          <span className="font-semibold mt-0.5">{ETAPA_LABELS[etapa]}</span>
                          {fecha && <span className="text-xs opacity-70">{fmtDate(fecha)}</span>}
                        </div>
                        {i < ETAPA_ORDER.length - 1 && <div className={`w-5 h-0.5 flex-shrink-0 ${i < etapaIdx ? 'bg-green-400' : 'bg-gray-200'}`} />}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>

              {/* Partidas recurtido */}
              {loteDetalle.partidas.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-slate-700 mb-2">📂 Partidas de Recurtido ({loteDetalle.partidas.length})</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-purple-800 text-white">
                        <tr>
                          <th className="p-2 text-left">Código</th>
                          <th className="p-2 text-left">Base/Color</th>
                          <th className="p-2 text-left">Código Producto</th>
                          <th className="p-2 text-right">Hojas</th>
                          <th className="p-2 text-right">Peso</th>
                          <th className="p-2 text-center">Estado</th>
                          <th className="p-2 text-center">Fecha Inicio</th>
                          <th className="p-2 text-center">Fecha Fin</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loteDetalle.partidas.map(p => (
                          <tr key={p.id} className={`border-t ${p.estado === 'completado' ? 'bg-green-50' : ''}`}>
                            <td className="p-2 font-mono font-bold text-purple-800">{p.numero_proceso}</td>
                            <td className="p-2 font-semibold">{p.nombre_color || '—'}</td>
                            <td className="p-2 text-cyan-700 font-mono">{p.codigo_producto_proceso || '—'}</td>
                            <td className="p-2 text-right font-bold">{p.cantidad_pieles}</td>
                            <td className="p-2 text-right">{p.peso_actual} kg</td>
                            <td className="p-2 text-center">
                              <Badge className={`text-xs ${p.estado === 'completado' ? 'bg-green-100 text-green-700' : p.estado === 'anulado' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {p.estado === 'completado' ? 'Finalizada' : p.estado === 'anulado' ? 'Anulada' : 'Pendiente'}
                              </Badge>
                            </td>
                            <td className="p-2 text-center text-slate-500">{fmtDate(p.fecha_inicio)}</td>
                            <td className="p-2 text-center text-slate-500">{fmtDate(p.fecha_fin)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-purple-50 font-bold border-t-2 text-xs">
                          <td colSpan={3} className="p-2 text-right">TOTAL:</td>
                          <td className="p-2 text-right">{loteDetalle.partidas.reduce((s,p)=>s+(parseFloat(p.cantidad_pieles)||0),0)}</td>
                          <td className="p-2 text-right">{loteDetalle.partidas.reduce((s,p)=>s+(parseFloat(p.peso_actual)||0),0).toFixed(2)} kg</td>
                          <td colSpan={3} className="p-2 text-center">
                            {loteDetalle.hojasPendientes === 0 ? '✔ Lote Completo' : `⚠ Faltan ${loteDetalle.hojasPendientes} hojas`}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Inventario en proceso */}
              {loteDetalle.invPartidas.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm text-slate-700 mb-2">📦 Movimientos en Inventario en Proceso</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-indigo-700 text-white">
                        <tr>
                          <th className="p-2 text-left">Código</th>
                          <th className="p-2 text-left">Descripción</th>
                          <th className="p-2 text-right">Hojas</th>
                          <th className="p-2 text-left">Destino</th>
                          <th className="p-2 text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loteDetalle.invPartidas.map(i => (
                          <tr key={i.id} className="border-t">
                            <td className="p-2 font-mono font-bold text-indigo-800">{i.codigo_lote}</td>
                            <td className="p-2">{i.descripcion || '—'}</td>
                            <td className="p-2 text-right font-bold">{i.cantidad_hojas}</td>
                            <td className="p-2 text-slate-600">{i.destino_sublote || '—'}</td>
                            <td className="p-2 text-center">
                              <Badge className="text-xs bg-blue-100 text-blue-700">{i.estado_actual || '—'}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Historial todos los procesos */}
              <div>
                <h3 className="font-semibold text-sm text-slate-700 mb-2">📋 Historial Completo de Movimientos</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {[...loteDetalle.allLoteProcesos]
                    .sort((a,b) => new Date(a.created_date||0) - new Date(b.created_date||0))
                    .map(p => (
                    <div key={p.id} className="flex items-center gap-2 text-xs p-2 bg-white border rounded-lg">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${ETAPA_BG[p.tipo_proceso] || 'bg-gray-100 text-gray-700'}`}>
                        {ETAPA_LABELS[p.tipo_proceso] || p.tipo_proceso}
                      </span>
                      <span className="font-mono text-purple-700">{p.numero_proceso || p.id_consecutivo || '—'}</span>
                      <span className="text-slate-500">{fmtDate(p.fecha_inicio)}</span>
                      {p.cantidad_pieles && <span className="text-emerald-700 font-semibold">{p.cantidad_pieles} hojas</span>}
                      {p.responsable && <span className="text-slate-400">— {p.responsable}</span>}
                      <Badge className={`text-xs ml-auto ${p.estado === 'completado' || p.estado === 'finalizado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {p.estado}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-4 border-t mt-2">
            <Button onClick={() => setShowDetalle(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}