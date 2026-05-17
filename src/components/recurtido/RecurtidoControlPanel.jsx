import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2, Lock, Eye, Trash2, MoreVertical,
  Printer, Plus, Info, Grid3X3, LayoutGrid, ChevronLeft, ChevronRight, X
} from 'lucide-react';

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return d; }
};

const formatDateOnly = (d) => {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('es-CO'); } catch { return d; }
};

const EstadoDot = ({ estado, bloqueado }) => {
  if (bloqueado) return <span className="flex items-center gap-1.5 text-xs font-semibold text-red-600"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>Bloqueado</span>;
  if (estado === 'completado') return <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>Finalizado</span>;
  if (estado === 'en_proceso') return <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>En proceso</span>;
  return <span className="flex items-center gap-1.5 text-xs font-semibold text-yellow-600"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>Pendiente</span>;
};

const PAGE_SIZE = 10;

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
  onNuevoSublote,
  onImprimir,
}) {
  const [lotePadreControl, setLotePadreControl] = useState('');
  const [subloteControl, setSubloteControl] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroColor, setFiltroColor] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [vistaTabla, setVistaTabla] = useState(true); // tabla vs tarjetas
  const [pagina, setPagina] = useState(1);
  const [menuAbierto, setMenuAbierto] = useState(null); // id del proceso con menú abierto

  // ── Lotes padre únicos ─────────────────────────────────────────────────────
  const lotesCodigos = useMemo(() => [...new Set(procesos.map(p => p.codigo_lote).filter(Boolean))], [procesos]);
  const lotesPadreUnicos = useMemo(() => [...new Set(lotesCodigos.map(getLotePadre))], [lotesCodigos, getLotePadre]);

  const sublotesDelPadre = useMemo(() =>
    lotePadreControl ? lotesCodigos.filter(c => getLotePadre(c) === lotePadreControl && c !== lotePadreControl) : [],
    [lotePadreControl, lotesCodigos, getLotePadre]
  );
  const tieneSublotes = sublotesDelPadre.length > 0;
  const loteControlActual = subloteControl || lotePadreControl || lotesCodigos[0] || '';

  // ── Procesos del lote seleccionado ─────────────────────────────────────────
  const procesosDelLote = useMemo(() => {
    if (!lotePadreControl) return [];
    if (!subloteControl && tieneSublotes) {
      return procesos
        .filter(p => getLotePadre(p.codigo_lote) === lotePadreControl)
        .sort((a, b) => (a.numero_sublote_recurtido || 0) - (b.numero_sublote_recurtido || 0));
    }
    return getSublotesLote(loteControlActual);
  }, [procesos, lotePadreControl, subloteControl, tieneSublotes, loteControlActual, getLotePadre, getSublotesLote]);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const invLote = useMemo(() => {
    if (!lotePadreControl) return null;
    if (!subloteControl && tieneSublotes)
      return inventarioEnProceso.find(i => getLotePadre(i.codigo_lote) === lotePadreControl) || null;
    return inventarioEnProceso.find(i => i.codigo_lote === loteControlActual) || null;
  }, [lotePadreControl, subloteControl, tieneSublotes, inventarioEnProceso, loteControlActual, getLotePadre]);

  const totalHojasLote = useMemo(() => {
    if (!lotePadreControl) return 0;
    if (!subloteControl && tieneSublotes) {
      const invSubs = inventarioEnProceso.filter(i => getLotePadre(i.codigo_lote) === lotePadreControl);
      return invSubs.reduce((s, i) => s + (i.cantidad_hojas || 0), 0)
        || procesosDelLote.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
    }
    return invLote?.cantidad_hojas || 0;
  }, [lotePadreControl, subloteControl, tieneSublotes, inventarioEnProceso, procesosDelLote, invLote, getLotePadre]);

  const hojasFinalizadas = procesosDelLote
    .filter(p => p.estado === 'completado')
    .reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
  const hojasPendientes = Math.max(0, totalHojasLote - hojasFinalizadas);
  const totalSublotes = procesosDelLote.length;
  const sublotesFinalizados = procesosDelLote.filter(p => p.estado === 'completado').length;
  const porcentajeAvance = totalHojasLote > 0 ? Math.min(100, Math.round((hojasFinalizadas / totalHojasLote) * 100)) : 0;

  const generalFinalizado = procesosDelLote.some(p => p.finalizar_recurtido_general === true);
  const todosFinalizados = totalSublotes > 0 && procesosDelLote.every(p => p.estado === 'completado');
  const puedeFinalizarGeneral = todosFinalizados && hojasPendientes === 0 && !generalFinalizado && totalSublotes > 0;

  const coloresUnicos = [...new Set(procesosDelLote.map(p => p.nombre_color).filter(Boolean))];

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const sublotesFiltrados = useMemo(() => {
    return procesosDelLote.filter(p => {
      if (busqueda) {
        const b = busqueda.toLowerCase();
        if (!(p.codigo_lote || '').toLowerCase().includes(b) && !(p.nombre_color || '').toLowerCase().includes(b)) return false;
      }
      if (filtroEstado && p.estado !== filtroEstado) return false;
      if (filtroColor && p.nombre_color !== filtroColor) return false;
      if (filtroFechaDesde && p.fecha_inicio && p.fecha_inicio < filtroFechaDesde) return false;
      if (filtroFechaHasta && p.fecha_inicio && p.fecha_inicio > filtroFechaHasta) return false;
      return true;
    });
  }, [procesosDelLote, busqueda, filtroEstado, filtroColor, filtroFechaDesde, filtroFechaHasta]);

  const hayFiltros = busqueda || filtroEstado || filtroColor || filtroFechaDesde || filtroFechaHasta;
  const limpiarFiltros = () => {
    setBusqueda(''); setFiltroEstado(''); setFiltroColor('');
    setFiltroFechaDesde(''); setFiltroFechaHasta('');
    setPagina(1);
  };

  // Paginación
  const totalPaginas = Math.max(1, Math.ceil(sublotesFiltrados.length / PAGE_SIZE));
  const paginaActual = Math.min(pagina, totalPaginas);
  const sublotesPagina = sublotesFiltrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  const totalPesoFiltrado = sublotesFiltrados.reduce((s, p) => s + (parseFloat(p.peso_actual) || 0), 0);
  const totalHojasFiltrado = sublotesFiltrados.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);

  const handleLotePadreChange = (val) => {
    setLotePadreControl(val); setSubloteControl(''); limpiarFiltros();
  };

  return (
    <div className="space-y-4">

      {/* ── HEADER ACCIONES ───────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onImprimir} className="border-red-300 text-red-600 hover:bg-red-50">
          <Printer className="w-4 h-4 mr-2" />Imprimir
        </Button>
        <Button onClick={onNuevoSublote} className="bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4 mr-2" />Nuevo Sublote Recurtido
        </Button>
      </div>

      {/* ── RESUMEN DEL LOTE ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-800 mb-4">Resumen del lote</h2>

        {!lotePadreControl ? (
          <div className="text-slate-400 text-sm py-4 text-center">Seleccione un lote para ver el resumen.</div>
        ) : (
          <>
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Info lote */}
              <div className="min-w-[140px] space-y-3">
                <div>
                  <p className="text-xs text-slate-400">Código Lote</p>
                  <p className="text-xl font-extrabold text-slate-800">{lotePadreControl}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Color Base</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-700 inline-block flex-shrink-0"></span>
                    <p className="font-bold text-slate-800">{coloresUnicos[0] || '—'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Tipo de cuero</p>
                  <p className="font-bold text-slate-800">{invLote?.descripcion || 'BOVINO'}</p>
                </div>
              </div>

              {/* KPIs */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Total hojas del lote</p>
                  <p className="text-3xl font-extrabold text-blue-600">{totalHojasLote}</p>
                  <p className="text-xs text-slate-400 mt-1">100% del total</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Hojas recurtidas</p>
                  <p className="text-3xl font-extrabold text-emerald-600">{hojasFinalizadas}</p>
                  <p className="text-xs text-slate-400 mt-1">{porcentajeAvance}% del total</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Hojas por recurtir</p>
                  <p className={`text-3xl font-extrabold ${hojasPendientes > 0 ? 'text-amber-500' : 'text-green-500'}`}>{hojasPendientes}</p>
                  <p className="text-xs text-slate-400 mt-1">{hojasPendientes > 0 ? `${100 - porcentajeAvance}% pendiente` : 'Completado'}</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Sublotes totales</p>
                  <p className="text-3xl font-extrabold text-purple-600">{totalSublotes}</p>
                  <p className="text-xs text-slate-400 mt-1">Sublotes creados</p>
                </div>
                <div className="border border-slate-200 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Sublotes finalizados</p>
                  <p className="text-3xl font-extrabold text-green-600">{sublotesFinalizados}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {totalSublotes > 0 ? `${Math.round((sublotesFinalizados / totalSublotes) * 100)}% completado` : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Barra de progreso */}
            <div className="mt-4">
              <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                <div
                  className={`h-4 rounded-full transition-all duration-700 ${porcentajeAvance === 100 ? 'bg-green-500' : 'bg-green-400'}`}
                  style={{ width: `${Math.max(porcentajeAvance, 1)}%` }}
                />
              </div>
              <p className="text-right text-xs text-slate-500 mt-1">{porcentajeAvance}% del lote completado</p>
            </div>
          </>
        )}
      </div>

      {/* ── FILTROS ───────────────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* Código Lote */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Código Lote</p>
            <Select value={lotePadreControl} onValueChange={handleLotePadreChange}>
              <SelectTrigger className="h-9 w-40 text-sm">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {lotesPadreUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                {lotesPadreUnicos.length === 0 && <SelectItem value="__none__" disabled>Sin lotes</SelectItem>}
              </SelectContent>
            </Select>
          </div>

          {/* Estado */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Estado</p>
            <Select value={filtroEstado} onValueChange={v => { setFiltroEstado(v); setPagina(1); }}>
              <SelectTrigger className="h-9 w-32 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos</SelectItem>
                <SelectItem value="completado">Finalizado</SelectItem>
                <SelectItem value="en_proceso">En proceso</SelectItem>
                <SelectItem value="pendiente">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Color */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Color</p>
            <Select value={filtroColor} onValueChange={v => { setFiltroColor(v); setPagina(1); }}>
              <SelectTrigger className="h-9 w-32 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Todos</SelectItem>
                {coloresUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Fecha desde */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Fecha desde</p>
            <Input
              type="date"
              value={filtroFechaDesde}
              onChange={e => { setFiltroFechaDesde(e.target.value); setPagina(1); }}
              className="h-9 w-38 text-sm"
            />
          </div>

          {/* Fecha hasta */}
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-600">Fecha hasta</p>
            <Input
              type="date"
              value={filtroFechaHasta}
              onChange={e => { setFiltroFechaHasta(e.target.value); setPagina(1); }}
              className="h-9 w-38 text-sm"
            />
          </div>

          {/* Búsqueda rápida */}
          <div className="flex-1 min-w-[160px] space-y-1">
            <p className="text-xs font-medium text-slate-600">&nbsp;</p>
            <div className="relative">
              <Input
                placeholder="Buscar sublote..."
                value={busqueda}
                onChange={e => { setBusqueda(e.target.value); setPagina(1); }}
                className="h-9 pr-8 text-sm"
              />
            </div>
          </div>

          {hayFiltros && (
            <Button variant="ghost" size="sm" onClick={limpiarFiltros} className="h-9 text-slate-500 hover:text-red-500 self-end">
              <X className="w-3.5 h-3.5 mr-1" />Limpiar filtros
            </Button>
          )}
        </div>
      </div>

      {/* ── TABLA PRINCIPAL ───────────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {/* Cabecera tabla */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-slate-800">Control de Recurtido por Sublote</h3>
            {lotePadreControl && (
              <span className="bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {sublotesFiltrados.length} sublote{sublotesFiltrados.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant={vistaTabla ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setVistaTabla(true)}
              className={`h-8 text-xs px-3 ${vistaTabla ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 shadow-none' : 'text-slate-500'}`}
            >
              <Grid3X3 className="w-3.5 h-3.5 mr-1.5" />Tabla
            </Button>
            <Button
              variant={!vistaTabla ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setVistaTabla(false)}
              className={`h-8 text-xs px-3 ${!vistaTabla ? 'bg-purple-100 text-purple-700 hover:bg-purple-200 shadow-none' : 'text-slate-500'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5 mr-1.5" />Tarjetas
            </Button>
          </div>
        </div>

        {!lotePadreControl ? (
          <div className="py-16 text-center text-slate-400">
            <p className="text-sm">Seleccione un lote en los filtros para ver los sublotes.</p>
          </div>
        ) : sublotesFiltrados.length === 0 ? (
          <div className="py-12 text-center text-slate-400">
            <p className="text-sm">{hayFiltros ? 'No hay sublotes con los filtros aplicados.' : 'No hay sublotes registrados para este lote.'}</p>
          </div>
        ) : vistaTabla ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Lote Padre</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Código Sublote</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha Creación</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Cantidad (Hojas)</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Peso (kg)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Operario</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Etapa Actual</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha Finalización</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sublotesPagina.map((proc) => {
                    const finalizado = proc.estado === 'completado';
                    const bloqueado = generalFinalizado && !finalizado;
                    return (
                      <tr key={proc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-slate-600">{getLotePadre(proc.codigo_lote)}</td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-semibold text-slate-800">{proc.codigo_lote}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{formatDate(proc.fecha_inicio)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800">{proc.cantidad_pieles}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{proc.peso_actual ? parseFloat(proc.peso_actual).toFixed(2) : '—'}</td>
                        <td className="px-4 py-3 text-sm text-slate-600">{proc.responsable || proc.nombre_curtidor || '—'}</td>
                        <td className="px-4 py-3">
                          <EstadoDot estado={proc.estado} bloqueado={bloqueado} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-sm text-slate-600">
                            <span className="text-slate-400 text-xs">△</span>
                            {proc.seccion || proc.actividad || 'Recurtido'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">{finalizado ? formatDate(proc.fecha_fin) : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => onVerDetalle(proc)}
                              className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!finalizado && !generalFinalizado && (
                              <div className="relative">
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700"
                                  onClick={() => setMenuAbierto(menuAbierto === proc.id ? null : proc.id)}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                                {menuAbierto === proc.id && (
                                  <div className="absolute right-0 top-8 z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[130px]">
                                    <button
                                      onClick={() => { onEdit(proc); setMenuAbierto(null); }}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-slate-700"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => { onFinalizarSublote(proc); setMenuAbierto(null); }}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-emerald-700 font-medium"
                                    >
                                      Finalizar
                                    </button>
                                    <button
                                      onClick={() => { onDelete(proc.id); setMenuAbierto(null); }}
                                      className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 text-red-600"
                                    >
                                      Eliminar
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            {(finalizado || generalFinalizado) && (
                              <Lock className="w-3.5 h-3.5 text-slate-300" />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {/* Fila totales */}
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td colSpan={3} className="px-4 py-3 font-bold text-slate-800">Totales</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{totalHojasFiltrado}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{totalPesoFiltrado.toFixed(2)}</td>
                    <td colSpan={5}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Leyenda + Paginación */}
            <div className="flex flex-wrap items-center justify-between px-5 py-3 border-t border-slate-100 bg-white gap-2">
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span>Finalizado</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500"></span>En proceso</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-400"></span>Pendiente</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span>Bloqueado / Error</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <span>Página {paginaActual} de {totalPaginas}</span>
                <Button
                  variant="outline" size="sm"
                  className="h-7 w-7 p-0"
                  disabled={paginaActual <= 1}
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="w-7 h-7 flex items-center justify-center bg-purple-700 text-white rounded text-xs font-bold">
                  {paginaActual}
                </span>
                <Button
                  variant="outline" size="sm"
                  className="h-7 w-7 p-0"
                  disabled={paginaActual >= totalPaginas}
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          // Vista tarjetas
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sublotesPagina.map((proc) => {
              const finalizado = proc.estado === 'completado';
              const bloqueado = generalFinalizado && !finalizado;
              return (
                <div key={proc.id} className="border border-slate-200 rounded-xl p-4 space-y-3 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-mono font-bold text-sm text-slate-800">{proc.codigo_lote}</p>
                      <p className="text-xs text-slate-400">{getLotePadre(proc.codigo_lote)}</p>
                    </div>
                    <EstadoDot estado={proc.estado} bloqueado={bloqueado} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-400">Hojas:</span> <span className="font-bold">{proc.cantidad_pieles}</span></div>
                    <div><span className="text-slate-400">Peso:</span> <span className="font-bold">{proc.peso_actual ? parseFloat(proc.peso_actual).toFixed(2) : '—'} kg</span></div>
                    <div><span className="text-slate-400">Color:</span> <span className="font-bold">{proc.nombre_color || '—'}</span></div>
                    <div><span className="text-slate-400">Operario:</span> <span className="font-bold">{proc.responsable || '—'}</span></div>
                    <div><span className="text-slate-400">Inicio:</span> <span className="font-bold">{formatDateOnly(proc.fecha_inicio)}</span></div>
                    <div><span className="text-slate-400">Fin:</span> <span className="font-bold">{finalizado ? formatDateOnly(proc.fecha_fin) : '—'}</span></div>
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-slate-100">
                    <Button size="sm" variant="ghost" onClick={() => onVerDetalle(proc)} className="h-7 flex-1 text-xs"><Eye className="w-3 h-3 mr-1" />Ver</Button>
                    {!finalizado && !generalFinalizado && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onEdit(proc)} className="h-7 flex-1 text-xs">Editar</Button>
                        <Button size="sm" onClick={() => onFinalizarSublote(proc)} className="h-7 flex-1 text-xs bg-emerald-600 hover:bg-emerald-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />Finalizar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── FOOTER: INFO + FINALIZAR GENERAL ─────────────────────────────────── */}
      {lotePadreControl && (
        <div className="flex flex-wrap items-stretch gap-4">
          {/* Info box */}
          <div className="flex-1 min-w-[240px] bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-800 text-sm">Información importante</p>
              <p className="text-xs text-blue-700 mt-0.5">
                El lote se marcará como finalizado únicamente cuando todos los sublotes estén en estado Finalizado.
              </p>
            </div>
          </div>

          {/* Botón finalizar general */}
          <div className="flex flex-col items-center justify-center">
            <Button
              disabled={!puedeFinalizarGeneral}
              onClick={() => onFinalizarGeneral(lotePadreControl || loteControlActual)}
              className="bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white px-6 py-5 text-sm font-semibold h-auto"
            >
              <Lock className="w-4 h-4 mr-2" />
              Finalizar Recurtido General
            </Button>
            <p className="text-xs text-slate-400 mt-1.5 text-center">
              {generalFinalizado
                ? '✅ Proceso finalizado y cerrado'
                : puedeFinalizarGeneral
                  ? 'Listo para finalizar'
                  : 'Se habilitará cuando todos los sublotes estén finalizados'
              }
            </p>
          </div>
        </div>
      )}

      {/* Click fuera para cerrar menú contextual */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40" onClick={() => setMenuAbierto(null)} />
      )}
    </div>
  );
}