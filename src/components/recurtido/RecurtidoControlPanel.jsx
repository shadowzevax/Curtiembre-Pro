import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Lock, AlertCircle, Eye, Trash2, Table,
  Search, Filter, TrendingUp, Layers, Clock, BarChart3, X
} from 'lucide-react';

const formatDate = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-CO'); } catch { return d; }
};

const EstadoBadge = ({ estado, generalFinalizado }) => {
  if (generalFinalizado) return <Badge className="bg-red-100 text-red-700 border-red-300 text-xs">Bloqueado</Badge>;
  if (estado === 'completado') return <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Finalizado</Badge>;
  if (estado === 'en_proceso') return <Badge className="bg-blue-100 text-blue-700 border-blue-300 text-xs">En Proceso</Badge>;
  return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">Pendiente</Badge>;
};

export default function RecurtidoControlPanel({
  procesos,
  inventarioEnProceso,
  getLotePadre,
  getSublotesLote,
  onEdit,
  onFinalizarSublote,
  onFinalizarGeneral,
  onDelete,
  onVerDetalle,
  onVerConsolidado,
}) {
  // ── Selectores de lote/sublote ─────────────────────────────────────────────
  const [lotePadreControl, setLotePadreControl] = useState('');
  const [subloteControl, setSubloteControl] = useState('');

  // ── Filtros avanzados ─────────────────────────────────────────────────────
  const [showFiltros, setShowFiltros] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroColor, setFiltroColor] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroResponsable, setFiltroResponsable] = useState('');

  // ── Cálculos base ─────────────────────────────────────────────────────────
  const lotesCodigos = useMemo(() => [...new Set(procesos.map(p => p.codigo_lote).filter(Boolean))], [procesos]);
  const lotesPadreUnicos = useMemo(() => [...new Set(lotesCodigos.map(getLotePadre))], [lotesCodigos, getLotePadre]);

  const sublotesDelPadre = useMemo(() =>
    lotePadreControl
      ? lotesCodigos.filter(c => getLotePadre(c) === lotePadreControl && c !== lotePadreControl)
      : [],
    [lotePadreControl, lotesCodigos, getLotePadre]
  );
  const tieneSublotes = sublotesDelPadre.length > 0;

  const loteControlActual = subloteControl || lotePadreControl || lotesCodigos[0] || '';

  // Todos los procesos del lote padre seleccionado (o del lote actual si no hay sublotes)
  const procesosDelLote = useMemo(() => {
    if (!lotePadreControl) return [];
    if (!subloteControl && tieneSublotes) {
      return procesos
        .filter(p => getLotePadre(p.codigo_lote) === lotePadreControl)
        .sort((a, b) => (a.numero_sublote_recurtido || 0) - (b.numero_sublote_recurtido || 0));
    }
    return getSublotesLote(loteControlActual);
  }, [procesos, lotePadreControl, subloteControl, tieneSublotes, loteControlActual, getLotePadre, getSublotesLote]);

  // ── Totales del lote ─────────────────────────────────────────────────────
  const totalHojasLote = useMemo(() => {
    if (!lotePadreControl) return 0;
    if (!subloteControl && tieneSublotes) {
      const invSubs = inventarioEnProceso.filter(i => getLotePadre(i.codigo_lote) === lotePadreControl);
      const sumInv = invSubs.reduce((s, i) => s + (i.cantidad_hojas || 0), 0);
      return sumInv || procesosDelLote.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
    }
    const inv = inventarioEnProceso.find(i => i.codigo_lote === loteControlActual);
    return inv?.cantidad_hojas || 0;
  }, [lotePadreControl, subloteControl, tieneSublotes, inventarioEnProceso, procesosDelLote, loteControlActual, getLotePadre]);

  const hojasPorSublote = procesosDelLote.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
  const hojasFinalizadas = procesosDelLote
    .filter(p => p.estado === 'completado')
    .reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
  const hojasPendientes = Math.max(0, totalHojasLote - hojasFinalizadas);
  const porcentajeAvance = totalHojasLote > 0 ? Math.min(100, Math.round((hojasFinalizadas / totalHojasLote) * 100)) : 0;

  const totalSublotes = procesosDelLote.length;
  const sublotesFinalizados = procesosDelLote.filter(p => p.estado === 'completado').length;
  const sublotesPendientes = totalSublotes - sublotesFinalizados;

  const generalFinalizado = procesosDelLote.some(p => p.finalizar_recurtido_general === true);
  const todosFinalizados = totalSublotes > 0 && procesosDelLote.every(p => p.estado === 'completado');
  const puedeFinalizarGeneral = todosFinalizados && hojasPendientes === 0 && !generalFinalizado && totalSublotes > 0;

  // Colores únicos del lote
  const coloresUnicos = [...new Set(procesosDelLote.map(p => p.nombre_color).filter(Boolean))];
  const responsablesUnicos = [...new Set(procesosDelLote.map(p => p.responsable || p.nombre_curtidor).filter(Boolean))];

  // Datos del primer inventario del lote para el resumen
  const invLote = useMemo(() => {
    if (!lotePadreControl) return null;
    if (!subloteControl && tieneSublotes) {
      return inventarioEnProceso.find(i => getLotePadre(i.codigo_lote) === lotePadreControl) || null;
    }
    return inventarioEnProceso.find(i => i.codigo_lote === loteControlActual) || null;
  }, [lotePadreControl, subloteControl, tieneSublotes, inventarioEnProceso, loteControlActual, getLotePadre]);

  // ── Filtrado de la tabla ──────────────────────────────────────────────────
  const sublotesFiltrados = useMemo(() => {
    return procesosDelLote.filter(p => {
      if (busqueda) {
        const b = busqueda.toLowerCase();
        if (!(p.codigo_lote || '').toLowerCase().includes(b) &&
            !(p.nombre_color || '').toLowerCase().includes(b) &&
            !(p.numero_proceso || '').toLowerCase().includes(b)) return false;
      }
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (filtroColor && p.nombre_color !== filtroColor) return false;
      if (filtroFechaDesde && p.fecha_inicio && p.fecha_inicio < filtroFechaDesde) return false;
      if (filtroFechaHasta && p.fecha_inicio && p.fecha_inicio > filtroFechaHasta) return false;
      if (filtroResponsable && (p.responsable || p.nombre_curtidor) !== filtroResponsable) return false;
      return true;
    });
  }, [procesosDelLote, busqueda, filtroEstado, filtroColor, filtroFechaDesde, filtroFechaHasta, filtroResponsable]);

  const hayFiltrosActivos = busqueda || filtroEstado || filtroColor || filtroFechaDesde || filtroFechaHasta || filtroResponsable;

  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroEstado(''); setFiltroColor('');
    setFiltroFechaDesde(''); setFiltroFechaHasta(''); setFiltroResponsable('');
  };

  const handleLotePadreChange = (val) => {
    setLotePadreControl(val);
    setSubloteControl('');
    limpiarFiltros();
  };

  // ── Color de barra de progreso ─────────────────────────────────────────────
  const barColor = porcentajeAvance === 100 ? 'bg-green-500' : porcentajeAvance >= 50 ? 'bg-blue-500' : 'bg-amber-400';

  return (
    <div className="space-y-4">
      {/* ── SELECTORES ───────────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-slate-500" />
              <Label className="text-sm font-medium text-slate-600 whitespace-nowrap">Código Lote:</Label>
              <Select value={lotePadreControl} onValueChange={handleLotePadreChange}>
                <SelectTrigger className="w-52 h-9">
                  <SelectValue placeholder="Seleccionar lote..." />
                </SelectTrigger>
                <SelectContent>
                  {lotesPadreUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  {lotesPadreUnicos.length === 0 && <SelectItem value="__none__" disabled>Sin lotes registrados</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {lotePadreControl && tieneSublotes && (
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium text-slate-600 whitespace-nowrap">Sublote:</Label>
                <Select value={subloteControl} onValueChange={setSubloteControl}>
                  <SelectTrigger className="w-56 h-9">
                    <SelectValue placeholder="— Ver todos —" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— Ver todos los sublotes —</SelectItem>
                    {sublotesDelPadre.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              {lotePadreControl && (
                <Button variant="outline" size="sm" onClick={() => onVerConsolidado(lotePadreControl)}>
                  <Table className="w-3.5 h-3.5 mr-1.5" />Consolidado
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── PANEL RESUMEN DEL LOTE ────────────────────────────────────────────── */}
      {lotePadreControl && (
        <Card className="border-2 border-slate-200">
          <CardHeader className="pb-2 pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-base font-bold text-slate-800">
                  Panel de Control — Lote: <span className="text-purple-700 font-mono">{lotePadreControl}</span>
                  {subloteControl && <span className="text-slate-500 font-normal text-sm ml-2">/ {subloteControl}</span>}
                </CardTitle>
              </div>
              {generalFinalizado && (
                <Badge className="bg-green-100 text-green-800 border-green-300 text-xs px-3 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Recurtido General Finalizado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">

            {/* Fila info del lote */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg text-xs">
              <div>
                <span className="text-slate-500 block">Código Lote</span>
                <span className="font-mono font-bold text-slate-800">{lotePadreControl}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Color Base</span>
                <span className="font-semibold text-slate-800">{coloresUnicos.join(', ') || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Tipo Cuero</span>
                <span className="font-semibold text-slate-800">{invLote?.descripcion || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Fecha Creación</span>
                <span className="font-semibold text-slate-800">{formatDate(procesosDelLote[0]?.fecha_inicio)}</span>
              </div>
            </div>

            {/* KPIs principales */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Total Hojas Lote</p>
                <p className="text-3xl font-extrabold text-blue-700">{totalHojasLote}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Hojas Recurtidas</p>
                <p className="text-3xl font-extrabold text-emerald-700">{hojasFinalizadas}</p>
              </div>
              <div className={`border rounded-xl p-3 text-center ${hojasPendientes > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                <p className="text-xs text-slate-500 mb-1">Hojas Pendientes</p>
                <p className={`text-3xl font-extrabold ${hojasPendientes > 0 ? 'text-amber-700' : 'text-green-700'}`}>{hojasPendientes}</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Total Sublotes</p>
                <p className="text-3xl font-extrabold text-purple-700">{totalSublotes}</p>
              </div>
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Finalizados</p>
                <p className="text-3xl font-extrabold text-teal-700">{sublotesFinalizados}</p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 mb-1">Pendientes</p>
                <p className="text-3xl font-extrabold text-orange-600">{sublotesPendientes}</p>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Avance del proceso de recurtido</span>
                <span className={`font-bold text-lg ${porcentajeAvance === 100 ? 'text-green-600' : porcentajeAvance >= 50 ? 'text-blue-600' : 'text-amber-600'}`}>
                  {porcentajeAvance}%
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-5 overflow-hidden">
                <div
                  className={`h-5 rounded-full transition-all duration-700 ${barColor} flex items-center justify-end pr-2`}
                  style={{ width: `${Math.max(porcentajeAvance, 3)}%` }}
                >
                  {porcentajeAvance > 10 && (
                    <span className="text-white text-xs font-bold">{porcentajeAvance}%</span>
                  )}
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>0%</span>
                <span className="text-slate-500">
                  {porcentajeAvance === 100 ? '✅ Proceso completado' : porcentajeAvance >= 75 ? '🔵 Casi listo' : porcentajeAvance >= 50 ? '🟡 En progreso' : '🟠 Iniciando'}
                </span>
                <span>100%</span>
              </div>
            </div>

          </CardContent>
        </Card>
      )}

      {/* ── TABLA PRINCIPAL ───────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Tabla de Sublotes de Recurtido</CardTitle>
            <div className="flex items-center gap-2">
              {/* Búsqueda rápida */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Buscar sublote..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="pl-8 h-8 w-44 text-xs"
                />
              </div>
              <Button
                variant={showFiltros ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFiltros(v => !v)}
                className="h-8 text-xs"
              >
                <Filter className="w-3.5 h-3.5 mr-1" />Filtros
                {hayFiltrosActivos && <span className="ml-1 w-2 h-2 bg-amber-400 rounded-full"></span>}
              </Button>
              {hayFiltrosActivos && (
                <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="h-8 text-xs text-red-500">
                  <X className="w-3.5 h-3.5 mr-1" />Limpiar
                </Button>
              )}
            </div>
          </div>

          {/* Panel de filtros avanzados */}
          {showFiltros && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-3 bg-slate-50 rounded-lg border">
              <div>
                <Label className="text-xs text-slate-500">Estado</Label>
                <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                  <SelectTrigger className="h-7 text-xs mt-0.5">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    <SelectItem value="completado">Finalizado</SelectItem>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="en_proceso">En Proceso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Color</Label>
                <Select value={filtroColor} onValueChange={setFiltroColor}>
                  <SelectTrigger className="h-7 text-xs mt-0.5">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    {coloresUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Fecha Desde</Label>
                <Input type="date" value={filtroFechaDesde} onChange={e => setFiltroFechaDesde(e.target.value)} className="h-7 text-xs mt-0.5" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Fecha Hasta</Label>
                <Input type="date" value={filtroFechaHasta} onChange={e => setFiltroFechaHasta(e.target.value)} className="h-7 text-xs mt-0.5" />
              </div>
              <div>
                <Label className="text-xs text-slate-500">Operario</Label>
                <Select value={filtroResponsable} onValueChange={setFiltroResponsable}>
                  <SelectTrigger className="h-7 text-xs mt-0.5">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todos</SelectItem>
                    {responsablesUnicos.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500">Cód. Sublote</Label>
                <Input
                  placeholder="Ej: SUB1"
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  className="h-7 text-xs mt-0.5"
                />
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {!lotePadreControl ? (
            <div className="text-center py-14 text-slate-400">
              <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Seleccione un lote para ver los sublotes de recurtido</p>
              {lotesPadreUnicos.length === 0 && (
                <p className="text-xs mt-1">Aún no hay procesos de recurtido registrados.</p>
              )}
            </div>
          ) : sublotesFiltrados.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">{hayFiltrosActivos ? 'No hay sublotes que coincidan con los filtros.' : 'No hay sublotes registrados para este lote.'}</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto border rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      <th className="p-2.5 text-left font-semibold text-slate-600 text-xs">Lote Padre</th>
                      <th className="p-2.5 text-left font-semibold text-slate-600 text-xs">Código Sublote</th>
                      <th className="p-2.5 text-left font-semibold text-slate-600 text-xs">Fecha Creación</th>
                      <th className="p-2.5 text-left font-semibold text-slate-600 text-xs">Color</th>
                      <th className="p-2.5 text-right font-semibold text-slate-600 text-xs">Cant. Hojas</th>
                      <th className="p-2.5 text-right font-semibold text-slate-600 text-xs">Peso (kg)</th>
                      <th className="p-2.5 text-left font-semibold text-slate-600 text-xs">Operario</th>
                      <th className="p-2.5 text-center font-semibold text-slate-600 text-xs">Estado</th>
                      <th className="p-2.5 text-left font-semibold text-slate-600 text-xs">Fecha Fin</th>
                      <th className="p-2.5 text-left font-semibold text-slate-600 text-xs">Observaciones</th>
                      <th className="p-2.5 text-center font-semibold text-slate-600 text-xs">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sublotesFiltrados.map((proc, idx) => {
                      const finalizado = proc.estado === 'completado';
                      const bloqueado = generalFinalizado;
                      const rowBg = bloqueado
                        ? 'bg-red-50'
                        : finalizado
                          ? 'bg-green-50'
                          : proc.estado === 'en_proceso'
                            ? 'bg-blue-50'
                            : idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                      return (
                        <tr key={proc.id} className={`border-t ${rowBg} hover:brightness-95 transition-all`}>
                          <td className="p-2 font-mono text-xs text-slate-600">{getLotePadre(proc.codigo_lote)}</td>
                          <td className="p-2">
                            <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded">
                              {proc.codigo_lote}
                            </span>
                          </td>
                          <td className="p-2 text-xs text-slate-600">{formatDate(proc.fecha_inicio)}</td>
                          <td className="p-2">
                            {proc.nombre_color
                              ? <Badge className="bg-purple-100 text-purple-700 text-xs">{proc.nombre_color}</Badge>
                              : <span className="text-slate-400 text-xs">—</span>
                            }
                          </td>
                          <td className="p-2 text-right font-bold text-slate-800">{proc.cantidad_pieles}</td>
                          <td className="p-2 text-right text-slate-600">{proc.peso_actual || '—'}</td>
                          <td className="p-2 text-xs text-slate-600">{proc.responsable || proc.nombre_curtidor || '—'}</td>
                          <td className="p-2 text-center">
                            <EstadoBadge estado={proc.estado} generalFinalizado={bloqueado && !finalizado} />
                          </td>
                          <td className="p-2 text-xs text-slate-600">{formatDate(proc.fecha_fin)}</td>
                          <td className="p-2 text-xs text-slate-500 max-w-[120px] truncate" title={proc.observaciones}>
                            {proc.observaciones || '—'}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center justify-center gap-1">
                              {!finalizado && !bloqueado && (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => onEdit(proc)} className="h-7 text-xs px-2">Editar</Button>
                                  <Button size="sm" className="h-7 text-xs px-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => onFinalizarSublote(proc)}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" />Finalizar
                                  </Button>
                                </>
                              )}
                              {(finalizado || bloqueado) && (
                                <span className="flex items-center gap-1 text-xs text-slate-400 px-1">
                                  <Lock className="w-3 h-3" />Cerrado
                                </span>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => onVerDetalle(proc)} className="h-7 w-7 p-0">
                                <Eye className="w-3.5 h-3.5 text-slate-500" />
                              </Button>
                              {!finalizado && !bloqueado && (
                                <Button variant="ghost" size="sm" onClick={() => onDelete(proc.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 font-bold">
                      <td colSpan={4} className="p-2.5 text-right text-sm text-slate-700">TOTAL:</td>
                      <td className="p-2.5 text-right text-slate-800">
                        {sublotesFiltrados.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0)}
                      </td>
                      <td colSpan={6}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Botón Finalizar General + alertas */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
                <div className="text-sm">
                  {generalFinalizado && (
                    <span className="flex items-center gap-2 text-green-700 font-semibold">
                      <CheckCircle2 className="w-5 h-5" />Recurtido General FINALIZADO — Lote cerrado
                    </span>
                  )}
                  {!generalFinalizado && !puedeFinalizarGeneral && totalSublotes > 0 && (
                    <span className="flex items-center gap-2 text-amber-700">
                      <AlertCircle className="w-4 h-4" />
                      {hojasPendientes > 0
                        ? `Faltan ${hojasPendientes} hojas por finalizar`
                        : `Hay ${sublotesPendientes} sublote(s) pendiente(s) de finalizar`
                      }
                    </span>
                  )}
                </div>
                <Button
                  disabled={!puedeFinalizarGeneral}
                  onClick={() => onFinalizarGeneral(lotePadreControl || loteControlActual)}
                  className="bg-purple-700 hover:bg-purple-800 disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Finalizar Recurtido General
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}