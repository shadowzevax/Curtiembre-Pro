import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus, Eye, Edit2, Trash2, CheckCircle2, Package, TrendingUp, Users, Clock, Layers, ChevronDown, ChevronUp, X, Save
} from "lucide-react";

const fmtDate = (d) => { if (!d) return "—"; try { return new Date(d + "T00:00:00").toLocaleDateString("es-CO"); } catch { return d; } };
const today = () => new Date().toISOString().split("T")[0];

const PRIORIDAD_BADGE = {
  normal: "bg-blue-100 text-blue-800",
  urgente: "bg-amber-100 text-amber-800",
  muy_urgente: "bg-red-100 text-red-800",
};
const PRIORIDAD_LABEL = { normal: "Normal", urgente: "Urgente", muy_urgente: "Muy Urgente" };
const ESTADO_BADGE = {
  pendiente: "bg-yellow-100 text-yellow-800",
  consolidada: "bg-blue-100 text-blue-800",
  en_produccion: "bg-purple-100 text-purple-800",
  entregada: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
  en_produccion_ord: "bg-purple-100 text-purple-800",
  suspendida: "bg-gray-100 text-gray-700",
  finalizada: "bg-green-100 text-green-800",
};
const ESTADO_LABEL = {
  pendiente: "Pendiente", consolidada: "Consolidada", en_produccion: "En Producción",
  entregada: "Entregada", cancelada: "Cancelada", suspendida: "Suspendida", finalizada: "Finalizada"
};

export default function PlanificacionProduccion() {
  const [tab, setTab] = useState("dashboard");
  const [solicitudes, setSolicitudes] = useState([]);
  const [ordenes, setOrdenes] = useState([]);
  const [avances, setAvances] = useState([]);
  const [entregas, setEntregas] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [colores, setColores] = useState([]);
  const [tiposCuero, setTiposCuero] = useState([]);
  const [placas, setPlacas] = useState([]);
  const [pintores, setPintores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showSolicitudModal, setShowSolicitudModal] = useState(false);
  const [editingSolicitud, setEditingSolicitud] = useState(null);
  const [showOrdenModal, setShowOrdenModal] = useState(false);
  const [editingOrden, setEditingOrden] = useState(null);
  const [showAvanceModal, setShowAvanceModal] = useState(false);
  const [avanceOrden, setAvanceOrden] = useState(null);
  const [showEntregaModal, setShowEntregaModal] = useState(false);
  const [showCatalogoModal, setShowCatalogoModal] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sols, ords, avs, ents, terceros, cols, tipos, placs] = await Promise.all([
        base44.entities.SolicitudProduccion.list("-created_date"),
        base44.entities.OrdenProduccionPCP.list("-created_date"),
        base44.entities.AvanceProduccionPCP.list("-created_date"),
        base44.entities.EntregaParcialPCP.list("-created_date"),
        base44.entities.Tercero.filter({ es_cliente: true }),
        base44.entities.ColorPintura.list(),
        base44.entities.TipoCueroPCP.list(),
        base44.entities.PlacaPCP.filter({ activo: true }),
      ]);
      setSolicitudes(sols);
      setOrdenes(ords);
      setAvances(avs);
      setEntregas(ents);
      setClientes(terceros);
      setColores(cols);
      setTiposCuero(tipos.filter(t => t.activo));
      setPlacas(placs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── KPIs ──
  const solsPendientes = solicitudes.filter(s => s.estado === "pendiente").length;
  const solsUrgentes = solicitudes.filter(s => ["urgente", "muy_urgente"].includes(s.prioridad) && s.estado === "pendiente").length;
  const ordsEnProduccion = ordenes.filter(o => o.estado === "en_produccion").length;
  const ordsFinalizadas = ordenes.filter(o => o.estado === "finalizada").length;
  const totalHojasPendientes = ordenes.filter(o => o.estado !== "finalizada").reduce((s, o) => s + ((o.cantidad_total_hojas || 0) - (o.hojas_producidas || 0)), 0);
  const hojasHoy = avances.filter(a => a.fecha === today()).reduce((s, a) => s + (a.cantidad_producida || 0), 0);
  const totalEntregadas = entregas.reduce((s, e) => s + (e.cantidad_entregada || 0), 0);
  const totalHojasOrdenadas = ordenes.reduce((s, o) => s + (o.cantidad_total_hojas || 0), 0);
  const totalHojasProducidas = ordenes.reduce((s, o) => s + (o.hojas_producidas || 0), 0);
  const pctCumplimiento = totalHojasOrdenadas > 0 ? ((totalHojasProducidas / totalHojasOrdenadas) * 100).toFixed(1) : 0;

  // ── CONSOLIDADO AUTOMÁTICO ──
  const consolidados = React.useMemo(() => {
    const groups = {};
    solicitudes.filter(s => s.estado === "pendiente").forEach(sol => {
      (sol.items || []).forEach(item => {
        const key = `${item.tipo_cuero_nombre}|${item.nombre_color}|${item.placa_nombre}`;
        if (!groups[key]) groups[key] = { tipo_cuero_nombre: item.tipo_cuero_nombre, nombre_color: item.nombre_color, placa_nombre: item.placa_nombre, total_hojas: 0, clientes: new Set(), solicitudes: [] };
        groups[key].total_hojas += (item.cantidad_hojas || 0);
        groups[key].clientes.add(sol.cliente_nombre);
        if (!groups[key].solicitudes.find(s2 => s2.id === sol.id)) groups[key].solicitudes.push(sol);
      });
    });
    return Object.values(groups).map(g => ({ ...g, clientes: [...g.clientes] }));
  }, [solicitudes]);

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Planificación y Control de Producción</h1>
          <p className="text-sm text-slate-500">Gestión integral de solicitudes, órdenes, avances y entregas</p>
        </div>
        <Button variant="outline" onClick={() => setShowCatalogoModal(true)} className="text-xs">⚙ Catálogos</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { l: "Sols. Pendientes", v: solsPendientes, c: "amber" },
          { l: "Urgentes", v: solsUrgentes, c: "red" },
          { l: "Órdenes en Prod.", v: ordsEnProduccion, c: "purple" },
          { l: "Órdenes Finalizadas", v: ordsFinalizadas, c: "green" },
          { l: "Hojas Pendientes", v: totalHojasPendientes, c: "blue" },
          { l: "Hojas Hoy", v: hojasHoy, c: "emerald" },
          { l: "Hojas Entregadas", v: totalEntregadas, c: "indigo" },
          { l: "% Cumplimiento", v: `${pctCumplimiento}%`, c: "slate" },
        ].map(k => (
          <div key={k.l} className={`bg-${k.c}-50 border border-${k.c}-200 rounded-xl p-2 text-center`}>
            <p className="text-xs text-slate-500 leading-tight">{k.l}</p>
            <p className={`text-xl font-extrabold text-${k.c}-700`}>{k.v}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard">📊 Seguimiento</TabsTrigger>
          <TabsTrigger value="solicitudes">📋 Solicitudes</TabsTrigger>
          <TabsTrigger value="consolidado">🔗 Consolidado</TabsTrigger>
          <TabsTrigger value="ordenes">📦 Órdenes</TabsTrigger>
          <TabsTrigger value="avances">⚙ Producción en Curso</TabsTrigger>
          <TabsTrigger value="entregas">🚚 Entregas</TabsTrigger>
          <TabsTrigger value="historial">📜 Historial</TabsTrigger>
        </TabsList>

        {/* ──────────── SEGUIMIENTO ──────────── */}
        <TabsContent value="dashboard">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Seguimiento de Pedidos en Tiempo Real</CardTitle></CardHeader>
            <CardContent>
              {loading ? <p className="text-slate-400 text-sm">Cargando...</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-800 text-white">
                      <tr>
                        <th className="p-2 text-left">Solicitud</th>
                        <th className="p-2 text-left">Cliente</th>
                        <th className="p-2 text-left">Color</th>
                        <th className="p-2 text-left">Tipo Cuero</th>
                        <th className="p-2 text-left">Placa</th>
                        <th className="p-2 text-right">Solicitadas</th>
                        <th className="p-2 text-right">Producidas</th>
                        <th className="p-2 text-right">Entregadas</th>
                        <th className="p-2 text-right">Pendientes</th>
                        <th className="p-2 text-center">% Avance</th>
                        <th className="p-2 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {solicitudes.length === 0 ? (
                        <tr><td colSpan={11} className="p-4 text-center text-slate-400">No hay solicitudes registradas.</td></tr>
                      ) : solicitudes.map(sol =>
                        (sol.items || []).map((item, idx) => {
                          const pct = item.cantidad_hojas > 0 ? Math.min(100, ((item.hojas_producidas || 0) / item.cantidad_hojas) * 100) : 0;
                          const pendiente = Math.max(0, (item.cantidad_hojas || 0) - (item.hojas_entregadas || 0));
                          return (
                            <tr key={`${sol.id}-${idx}`} className="border-t hover:bg-slate-50">
                              <td className="p-2 font-mono text-purple-700 font-bold">{sol.numero_solicitud}</td>
                              <td className="p-2">{sol.cliente_nombre}</td>
                              <td className="p-2">{item.nombre_color || "—"}</td>
                              <td className="p-2">{item.tipo_cuero_nombre || "—"}</td>
                              <td className="p-2">{item.placa_nombre || "—"}</td>
                              <td className="p-2 text-right font-bold">{item.cantidad_hojas}</td>
                              <td className="p-2 text-right">{item.hojas_producidas || 0}</td>
                              <td className="p-2 text-right">{item.hojas_entregadas || 0}</td>
                              <td className="p-2 text-right text-amber-700 font-semibold">{pendiente}</td>
                              <td className="p-2">
                                <div className="flex items-center gap-1">
                                  <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                    <div className={`h-2 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="font-bold text-slate-600 text-xs w-8">{pct.toFixed(0)}%</span>
                                </div>
                              </td>
                              <td className="p-2 text-center"><Badge className={`text-xs ${ESTADO_BADGE[sol.estado]}`}>{ESTADO_LABEL[sol.estado]}</Badge></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────────── SOLICITUDES ──────────── */}
        <TabsContent value="solicitudes">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Solicitudes de Producción</CardTitle>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingSolicitud(null); setShowSolicitudModal(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Nueva Solicitud
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-2 text-left">No. Solicitud</th>
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-left">Cliente</th>
                      <th className="p-2 text-center">Prioridad</th>
                      <th className="p-2 text-center">F. Compromiso</th>
                      <th className="p-2 text-right">Total Hojas</th>
                      <th className="p-2 text-center">Estado</th>
                      <th className="p-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {solicitudes.length === 0 ? (
                      <tr><td colSpan={8} className="p-4 text-center text-slate-400">No hay solicitudes.</td></tr>
                    ) : solicitudes.map(sol => {
                      const totalH = (sol.items || []).reduce((s, i) => s + (i.cantidad_hojas || 0), 0);
                      return (
                        <tr key={sol.id} className="border-t hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-purple-700">{sol.numero_solicitud}</td>
                          <td className="p-2">{fmtDate(sol.fecha)}</td>
                          <td className="p-2 font-semibold">{sol.cliente_nombre}</td>
                          <td className="p-2 text-center"><Badge className={`text-xs ${PRIORIDAD_BADGE[sol.prioridad]}`}>{PRIORIDAD_LABEL[sol.prioridad]}</Badge></td>
                          <td className="p-2 text-center">{fmtDate(sol.fecha_compromiso)}</td>
                          <td className="p-2 text-right font-bold">{totalH}</td>
                          <td className="p-2 text-center"><Badge className={`text-xs ${ESTADO_BADGE[sol.estado]}`}>{ESTADO_LABEL[sol.estado]}</Badge></td>
                          <td className="p-2 text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingSolicitud(sol); setShowSolicitudModal(true); }}><Edit2 className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={async () => { if (confirm("¿Eliminar solicitud?")) { await base44.entities.SolicitudProduccion.delete(sol.id); loadData(); } }}><Trash2 className="w-3 h-3" /></Button>
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

        {/* ──────────── CONSOLIDADO ──────────── */}
        <TabsContent value="consolidado">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Consolidado Automático de Producción</CardTitle></CardHeader>
            <CardContent>
              {consolidados.length === 0 ? (
                <p className="text-slate-400 text-sm text-center py-6">No hay solicitudes pendientes para consolidar.</p>
              ) : (
                <div className="space-y-3">
                  {consolidados.map((g, i) => (
                    <ConsolidadoCard key={i} grupo={g} onGenerarOrden={() => { setEditingOrden({ tipo_cuero_nombre: g.tipo_cuero_nombre, nombre_color: g.nombre_color, placa_nombre: g.placa_nombre, cantidad_total_hojas: g.total_hojas, solicitudes_ids: g.solicitudes.map(s => s.id) }); setShowOrdenModal(true); }} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────────── ÓRDENES ──────────── */}
        <TabsContent value="ordenes">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Órdenes de Producción</CardTitle>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { setEditingOrden(null); setShowOrdenModal(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Nueva Orden
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-2 text-left">No. Orden</th>
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-left">Color</th>
                      <th className="p-2 text-left">Tipo Cuero</th>
                      <th className="p-2 text-left">Placa</th>
                      <th className="p-2 text-left">Pintor</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2 text-right">Producidas</th>
                      <th className="p-2 text-right">Pendientes</th>
                      <th className="p-2 text-center">% Avance</th>
                      <th className="p-2 text-center">Estado</th>
                      <th className="p-2 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenes.length === 0 ? (
                      <tr><td colSpan={12} className="p-4 text-center text-slate-400">No hay órdenes de producción.</td></tr>
                    ) : ordenes.map(ord => {
                      const pend = Math.max(0, (ord.cantidad_total_hojas || 0) - (ord.hojas_producidas || 0));
                      const pct = ord.cantidad_total_hojas > 0 ? Math.min(100, ((ord.hojas_producidas || 0) / ord.cantidad_total_hojas) * 100) : 0;
                      return (
                        <tr key={ord.id} className="border-t hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold text-blue-700">{ord.numero_orden}</td>
                          <td className="p-2">{fmtDate(ord.fecha)}</td>
                          <td className="p-2">{ord.nombre_color || "—"}</td>
                          <td className="p-2">{ord.tipo_cuero_nombre || "—"}</td>
                          <td className="p-2">{ord.placa_nombre || "—"}</td>
                          <td className="p-2">{ord.pintor_nombre || "—"}</td>
                          <td className="p-2 text-right font-bold">{ord.cantidad_total_hojas}</td>
                          <td className="p-2 text-right text-emerald-700">{ord.hojas_producidas || 0}</td>
                          <td className="p-2 text-right text-amber-700">{pend}</td>
                          <td className="p-2">
                            <div className="flex items-center gap-1">
                              <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div className={`h-2 rounded-full ${pct >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }} />
                              </div>
                              <span className="font-bold text-xs text-slate-600">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="p-2 text-center"><Badge className={`text-xs ${ESTADO_BADGE[ord.estado]}`}>{ESTADO_LABEL[ord.estado]}</Badge></td>
                          <td className="p-2 text-center">
                            <div className="flex justify-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-purple-600" onClick={() => { setAvanceOrden(ord); setShowAvanceModal(true); }} title="Registrar avance"><TrendingUp className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600" onClick={() => { setEditingOrden(ord); setShowOrdenModal(true); }}><Edit2 className="w-3 h-3" /></Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={async () => { if (confirm("¿Eliminar orden?")) { await base44.entities.OrdenProduccionPCP.delete(ord.id); loadData(); } }}><Trash2 className="w-3 h-3" /></Button>
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

        {/* ──────────── AVANCES ──────────── */}
        <TabsContent value="avances">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Producción en Curso — Registro de Avances</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-2 text-left">Orden</th>
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-right">Cant. Producida</th>
                      <th className="p-2 text-left">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avances.length === 0 ? (
                      <tr><td colSpan={4} className="p-4 text-center text-slate-400">No hay avances registrados.</td></tr>
                    ) : avances.map(a => (
                      <tr key={a.id} className="border-t hover:bg-slate-50">
                        <td className="p-2 font-mono font-bold text-blue-700">{a.orden_numero}</td>
                        <td className="p-2">{fmtDate(a.fecha)}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">{a.cantidad_producida}</td>
                        <td className="p-2 text-slate-500">{a.observaciones || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────────── ENTREGAS ──────────── */}
        <TabsContent value="entregas">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Entregas Parciales</CardTitle>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setShowEntregaModal(true)}>
                <Plus className="w-4 h-4 mr-1" /> Registrar Entrega
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="p-2 text-left">Fecha</th>
                      <th className="p-2 text-left">Cliente</th>
                      <th className="p-2 text-left">Orden</th>
                      <th className="p-2 text-left">Solicitud</th>
                      <th className="p-2 text-right">Cantidad Entregada</th>
                      <th className="p-2 text-left">Responsable</th>
                      <th className="p-2 text-left">Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entregas.length === 0 ? (
                      <tr><td colSpan={7} className="p-4 text-center text-slate-400">No hay entregas registradas.</td></tr>
                    ) : entregas.map(e => (
                      <tr key={e.id} className="border-t hover:bg-slate-50">
                        <td className="p-2">{fmtDate(e.fecha)}</td>
                        <td className="p-2">{e.cliente_nombre || "—"}</td>
                        <td className="p-2 font-mono text-blue-700">{e.orden_numero || "—"}</td>
                        <td className="p-2 font-mono text-purple-700">{e.solicitud_numero || "—"}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">{e.cantidad_entregada}</td>
                        <td className="p-2">{e.responsable || "—"}</td>
                        <td className="p-2 text-slate-500">{e.observaciones || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ──────────── HISTORIAL ──────────── */}
        <TabsContent value="historial">
          <HistorialTab solicitudes={solicitudes} ordenes={ordenes} avances={avances} entregas={entregas} clientes={clientes} colores={colores} tiposCuero={tiposCuero} placas={placas} pintores={pintores} />
        </TabsContent>
      </Tabs>

      {/* ══ MODAL SOLICITUD ══ */}
      {showSolicitudModal && (
        <SolicitudModal
          open={showSolicitudModal}
          onClose={() => setShowSolicitudModal(false)}
          solicitud={editingSolicitud}
          clientes={clientes}
          colores={colores}
          tiposCuero={tiposCuero}
          placas={placas}
          solicitudes={solicitudes}
          onSave={loadData}
        />
      )}

      {/* ══ MODAL ORDEN ══ */}
      {showOrdenModal && (
        <OrdenModal
          open={showOrdenModal}
          onClose={() => setShowOrdenModal(false)}
          orden={editingOrden}
          colores={colores}
          tiposCuero={tiposCuero}
          placas={placas}
          ordenes={ordenes}
          onSave={loadData}
        />
      )}

      {/* ══ MODAL AVANCE ══ */}
      {showAvanceModal && avanceOrden && (
        <AvanceModal
          open={showAvanceModal}
          onClose={() => setShowAvanceModal(false)}
          orden={avanceOrden}
          onSave={loadData}
        />
      )}

      {/* ══ MODAL ENTREGA ══ */}
      {showEntregaModal && (
        <EntregaModal
          open={showEntregaModal}
          onClose={() => setShowEntregaModal(false)}
          ordenes={ordenes}
          solicitudes={solicitudes}
          clientes={clientes}
          onSave={loadData}
        />
      )}

      {/* ══ MODAL CATÁLOGOS ══ */}
      {showCatalogoModal && (
        <CatalogoModal
          open={showCatalogoModal}
          onClose={() => setShowCatalogoModal(false)}
          onSave={loadData}
        />
      )}
    </div>
  );
}

// ─── ConsolidadoCard ───
function ConsolidadoCard({ grupo, onGenerarOrden }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-blue-200 rounded-xl bg-blue-50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="font-bold text-blue-800">{grupo.tipo_cuero_nombre} — {grupo.nombre_color} — {grupo.placa_nombre}</span>
          <span className="text-slate-600">{grupo.total_hojas} hojas · {grupo.clientes.length} cliente(s)</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700" onClick={onGenerarOrden}>Generar Orden</Button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 text-xs space-y-1">
          {grupo.solicitudes.map(s => (
            <div key={s.id} className="flex items-center gap-2 bg-white rounded p-1.5 border">
              <span className="font-mono text-purple-700 font-bold">{s.numero_solicitud}</span>
              <span>{s.cliente_nombre}</span>
              <Badge className={`text-xs ${PRIORIDAD_BADGE[s.prioridad]}`}>{PRIORIDAD_LABEL[s.prioridad]}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SolicitudModal ───
function SolicitudModal({ open, onClose, solicitud, clientes, colores, tiposCuero, placas, solicitudes, onSave }) {
  const [form, setForm] = useState({ fecha: today(), prioridad: "normal", fecha_compromiso: "", cliente_id: "", cliente_nombre: "", estado: "pendiente", observaciones: "", items: [] });

  useEffect(() => {
    if (solicitud) setForm({ ...solicitud });
    else setForm({ fecha: today(), prioridad: "normal", fecha_compromiso: "", cliente_id: "", cliente_nombre: "", estado: "pendiente", observaciones: "", items: [] });
  }, [solicitud, open]);

  const addItem = () => setForm(p => ({ ...p, items: [...p.items, { codigo_producto: "", descripcion: "", tipo_cuero_id: "", tipo_cuero_nombre: "", codigo_color: "", nombre_color: "", placa_id: "", placa_nombre: "", cantidad_hojas: 0, observaciones: "" }] }));
  const updateItem = (idx, field, val) => setForm(p => { const items = [...p.items]; items[idx] = { ...items[idx], [field]: val }; return { ...p, items }; });
  const removeItem = (idx) => setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    let numero_solicitud = form.numero_solicitud;
    if (!solicitud) {
      const year = new Date().getFullYear();
      const existentes = solicitudes.filter(s => s.numero_solicitud?.startsWith(`SOL-${year}`));
      const maxNum = existentes.reduce((max, s) => { const n = parseInt(s.numero_solicitud?.split("-").pop() || "0"); return n > max ? n : max; }, 0);
      numero_solicitud = `SOL-${year}-${String(maxNum + 1).padStart(4, "0")}`;
    }
    const data = { ...form, numero_solicitud };
    if (solicitud) await base44.entities.SolicitudProduccion.update(solicitud.id, data);
    else await base44.entities.SolicitudProduccion.create(data);
    onSave();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{solicitud ? "Editar" : "Nueva"} Solicitud de Producción</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} />
            </div>
            <div>
              <Label>Cliente *</Label>
              <Select value={form.cliente_id} onValueChange={v => { const c = clientes.find(x => x.id === v); setForm(p => ({ ...p, cliente_id: v, cliente_nombre: c?.nombre || v })); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridad</Label>
              <Select value={form.prioridad} onValueChange={v => setForm(p => ({ ...p, prioridad: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="muy_urgente">Muy Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fecha Compromiso</Label>
              <Input type="date" value={form.fecha_compromiso} onChange={e => setForm(p => ({ ...p, fecha_compromiso: e.target.value }))} />
            </div>
          </div>
          <div>
            <Label>Observaciones</Label>
            <Textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} rows={2} />
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Detalle de Productos</Label>
              <Button size="sm" variant="outline" onClick={addItem}><Plus className="w-3 h-3 mr-1" /> Agregar</Button>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">Tipo Cuero</th>
                    <th className="p-2 text-left">Color</th>
                    <th className="p-2 text-left">Placa</th>
                    <th className="p-2 text-right">Cant. Hojas</th>
                    <th className="p-2 text-left">Obs.</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-1">
                        <Select value={item.tipo_cuero_id} onValueChange={v => { const t = tiposCuero.find(x => x.id === v); updateItem(idx, "tipo_cuero_id", v); updateItem(idx, "tipo_cuero_nombre", t?.nombre || ""); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo..." /></SelectTrigger>
                          <SelectContent>{tiposCuero.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-1">
                        <Select value={item.codigo_color} onValueChange={v => { const c = colores.find(x => x.id === v || x.codigo === v); updateItem(idx, "codigo_color", c?.codigo || v); updateItem(idx, "nombre_color", c?.nombre || ""); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Color..." /></SelectTrigger>
                          <SelectContent>{colores.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-1">
                        <Select value={item.placa_id} onValueChange={v => { const p = placas.find(x => x.id === v); updateItem(idx, "placa_id", v); updateItem(idx, "placa_nombre", p?.nombre || ""); }}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Placa..." /></SelectTrigger>
                          <SelectContent>{placas.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nombre}</SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                      <td className="p-1 w-20"><Input type="number" className="h-8 text-xs text-right" value={item.cantidad_hojas} onChange={e => updateItem(idx, "cantidad_hojas", parseFloat(e.target.value) || 0)} /></td>
                      <td className="p-1"><Input className="h-8 text-xs" placeholder="Obs..." value={item.observaciones} onChange={e => updateItem(idx, "observaciones", e.target.value)} /></td>
                      <td className="p-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => removeItem(idx)}><X className="w-3 h-3 text-red-500" /></Button></td>
                    </tr>
                  ))}
                  {form.items.length === 0 && <tr><td colSpan={6} className="p-3 text-center text-slate-400">Agregue al menos un ítem.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── OrdenModal ───
function OrdenModal({ open, onClose, orden, colores, tiposCuero, placas, ordenes, onSave }) {
  const [form, setForm] = useState({ fecha: today(), tipo_cuero_id: "", tipo_cuero_nombre: "", codigo_color: "", nombre_color: "", placa_id: "", placa_nombre: "", cantidad_total_hojas: 0, pintor_nombre: "", estado: "pendiente", observaciones: "" });

  useEffect(() => {
    if (orden) setForm({ fecha: today(), tipo_cuero_id: "", tipo_cuero_nombre: "", codigo_color: "", nombre_color: "", placa_id: "", placa_nombre: "", cantidad_total_hojas: 0, pintor_nombre: "", estado: "pendiente", observaciones: "", ...orden });
    else setForm({ fecha: today(), tipo_cuero_id: "", tipo_cuero_nombre: "", codigo_color: "", nombre_color: "", placa_id: "", placa_nombre: "", cantidad_total_hojas: 0, pintor_nombre: "", estado: "pendiente", observaciones: "" });
  }, [orden, open]);

  const handleSave = async () => {
    let numero_orden = form.numero_orden;
    if (!orden?.id) {
      const year = new Date().getFullYear();
      const existentes = ordenes.filter(o => o.numero_orden?.startsWith(`OP-${year}`));
      const maxNum = existentes.reduce((max, o) => { const n = parseInt(o.numero_orden?.split("-").pop() || "0"); return n > max ? n : max; }, 0);
      numero_orden = `OP-${year}-${String(maxNum + 1).padStart(4, "0")}`;
    }
    const data = { ...form, numero_orden };
    if (orden?.id) await base44.entities.OrdenProduccionPCP.update(orden.id, data);
    else await base44.entities.OrdenProduccionPCP.create(data);
    onSave();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{orden?.id ? "Editar" : "Nueva"} Orden de Producción</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha *</Label><Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
            <div>
              <Label>Estado</Label>
              <Select value={form.estado} onValueChange={v => setForm(p => ({ ...p, estado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_produccion">En Producción</SelectItem>
                  <SelectItem value="suspendida">Suspendida</SelectItem>
                  <SelectItem value="finalizada">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo Cuero</Label>
              <Select value={form.tipo_cuero_id} onValueChange={v => { const t = tiposCuero.find(x => x.id === v); setForm(p => ({ ...p, tipo_cuero_id: v, tipo_cuero_nombre: t?.nombre || "" })); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{tiposCuero.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Color</Label>
              <Select value={form.codigo_color} onValueChange={v => { const c = colores.find(x => x.id === v); setForm(p => ({ ...p, codigo_color: c?.codigo || v, nombre_color: c?.nombre || "" })); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{colores.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo} — {c.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Placa</Label>
              <Select value={form.placa_id} onValueChange={v => { const p = placas.find(x => x.id === v); setForm(p2 => ({ ...p2, placa_id: v, placa_nombre: p?.nombre || "" })); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{placas.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} — {p.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Total Hojas *</Label><Input type="number" value={form.cantidad_total_hojas} onChange={e => setForm(p => ({ ...p, cantidad_total_hojas: parseFloat(e.target.value) || 0 }))} /></div>
            <div className="col-span-2"><Label>Pintor Responsable</Label><Input value={form.pintor_nombre} onChange={e => setForm(p => ({ ...p, pintor_nombre: e.target.value }))} placeholder="Nombre del pintor..." /></div>
          </div>
          <div><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── AvanceModal ───
function AvanceModal({ open, onClose, orden, onSave }) {
  const [fecha, setFecha] = useState(today());
  const [cantidad, setCantidad] = useState(0);
  const [obs, setObs] = useState("");

  const pendiente = Math.max(0, (orden.cantidad_total_hojas || 0) - (orden.hojas_producidas || 0));

  const handleSave = async () => {
    const cant = parseFloat(cantidad) || 0;
    if (cant <= 0) { alert("La cantidad debe ser mayor a 0."); return; }
    if (cant > pendiente) { alert(`No puede registrar más de ${pendiente} hojas pendientes.`); return; }
    await base44.entities.AvanceProduccionPCP.create({ orden_id: orden.id, orden_numero: orden.numero_orden, fecha, cantidad_producida: cant, observaciones: obs });
    const nuevasProducidas = (orden.hojas_producidas || 0) + cant;
    const nuevoEstado = nuevasProducidas >= orden.cantidad_total_hojas ? "finalizada" : "en_produccion";
    await base44.entities.OrdenProduccionPCP.update(orden.id, { hojas_producidas: nuevasProducidas, estado: nuevoEstado });
    onSave();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Registrar Avance — {orden.numero_orden}</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded text-xs grid grid-cols-3 gap-2 text-center">
            <div><p className="text-slate-500">Total</p><p className="font-bold text-blue-700">{orden.cantidad_total_hojas}</p></div>
            <div><p className="text-slate-500">Producidas</p><p className="font-bold text-emerald-700">{orden.hojas_producidas || 0}</p></div>
            <div><p className="text-slate-500">Pendientes</p><p className="font-bold text-amber-700">{pendiente}</p></div>
          </div>
          <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></div>
          <div><Label>Cantidad Producida (máx: {pendiente})</Label><Input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} max={pendiente} /></div>
          <div><Label>Observaciones</Label><Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Registrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── EntregaModal ───
function EntregaModal({ open, onClose, ordenes, solicitudes, clientes, onSave }) {
  const [form, setForm] = useState({ fecha: today(), cliente_id: "", cliente_nombre: "", orden_id: "", orden_numero: "", solicitud_id: "", solicitud_numero: "", cantidad_entregada: 0, responsable: "", observaciones: "" });

  const handleSave = async () => {
    const cant = parseFloat(form.cantidad_entregada) || 0;
    if (cant <= 0) { alert("La cantidad entregada debe ser mayor a 0."); return; }
    await base44.entities.EntregaParcialPCP.create({ ...form, cantidad_entregada: cant });
    // Actualizar hojas entregadas en la orden
    if (form.orden_id) {
      const ord = ordenes.find(o => o.id === form.orden_id);
      if (ord) await base44.entities.OrdenProduccionPCP.update(ord.id, { hojas_entregadas: (ord.hojas_entregadas || 0) + cant });
    }
    onSave();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Registrar Entrega Parcial</DialogTitle></DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha</Label><Input type="date" value={form.fecha} onChange={e => setForm(p => ({ ...p, fecha: e.target.value }))} /></div>
            <div>
              <Label>Cliente</Label>
              <Select value={form.cliente_id} onValueChange={v => { const c = clientes.find(x => x.id === v); setForm(p => ({ ...p, cliente_id: v, cliente_nombre: c?.nombre || "" })); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Orden de Producción</Label>
              <Select value={form.orden_id} onValueChange={v => { const o = ordenes.find(x => x.id === v); setForm(p => ({ ...p, orden_id: v, orden_numero: o?.numero_orden || "" })); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{ordenes.map(o => <SelectItem key={o.id} value={o.id}>{o.numero_orden}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Solicitud</Label>
              <Select value={form.solicitud_id} onValueChange={v => { const s = solicitudes.find(x => x.id === v); setForm(p => ({ ...p, solicitud_id: v, solicitud_numero: s?.numero_solicitud || "" })); }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>{solicitudes.map(s => <SelectItem key={s.id} value={s.id}>{s.numero_solicitud} — {s.cliente_nombre}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Cantidad Entregada</Label><Input type="number" value={form.cantidad_entregada} onChange={e => setForm(p => ({ ...p, cantidad_entregada: e.target.value }))} /></div>
            <div><Label>Responsable</Label><Input value={form.responsable} onChange={e => setForm(p => ({ ...p, responsable: e.target.value }))} /></div>
          </div>
          <div><Label>Observaciones</Label><Textarea value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} rows={2} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Registrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── CatalogoModal ───
function CatalogoModal({ open, onClose, onSave }) {
  const [catalogoTab, setCatalogoTab] = useState("tipos");
  // Tipos de Acabado
  const [allTipos, setAllTipos] = useState([]);
  const [searchTipo, setSearchTipo] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState("");
  const [editingTipo, setEditingTipo] = useState(null); // {id, nombre}
  const [errorTipo, setErrorTipo] = useState("");
  // Placas
  const [allPlacas, setAllPlacas] = useState([]);
  const [searchPlaca, setSearchPlaca] = useState("");
  const [nuevaPlacaCod, setNuevaPlacaCod] = useState("");
  const [nuevaPlacaNom, setNuevaPlacaNom] = useState("");
  const [editingPlaca, setEditingPlaca] = useState(null); // {id, codigo, nombre}
  const [errorPlaca, setErrorPlaca] = useState("");

  const fmtDT = (d) => { if (!d) return "—"; try { return new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }); } catch { return d; } };

  const loadCatalogos = async () => {
    const [tipos, placas] = await Promise.all([
      base44.entities.TipoCueroPCP.list(),
      base44.entities.PlacaPCP.list(),
    ]);
    setAllTipos(tipos);
    setAllPlacas(placas);
  };

  useEffect(() => { if (open) loadCatalogos(); }, [open]);

  // ── Tipos de Acabado ──
  const tiposFiltrados = allTipos
    .filter(t => {
      const q = searchTipo.toLowerCase();
      return !q || t.nombre?.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "", "es"));

  const agregarTipo = async () => {
    const nombre = nuevoTipo.trim();
    if (!nombre) return;
    const dup = allTipos.find(t => t.nombre?.toLowerCase() === nombre.toLowerCase());
    if (dup) { setErrorTipo(`Ya existe un tipo de acabado con el nombre "${nombre}".`); return; }
    setErrorTipo("");
    await base44.entities.TipoCueroPCP.create({ nombre, activo: true });
    setNuevoTipo("");
    await loadCatalogos();
    onSave();
  };

  const guardarEditTipo = async () => {
    if (!editingTipo) return;
    const nombre = editingTipo.nombre.trim();
    if (!nombre) return;
    const dup = allTipos.find(t => t.nombre?.toLowerCase() === nombre.toLowerCase() && t.id !== editingTipo.id);
    if (dup) { setErrorTipo(`Ya existe un tipo de acabado con el nombre "${nombre}".`); return; }
    setErrorTipo("");
    await base44.entities.TipoCueroPCP.update(editingTipo.id, { nombre });
    setEditingTipo(null);
    await loadCatalogos();
    onSave();
  };

  const toggleActivoTipo = async (t) => {
    await base44.entities.TipoCueroPCP.update(t.id, { activo: !t.activo });
    await loadCatalogos();
    onSave();
  };

  // ── Placas ──
  const placasFiltradas = allPlacas
    .filter(p => {
      const q = searchPlaca.toLowerCase();
      return !q || p.codigo?.toLowerCase().includes(q) || p.nombre?.toLowerCase().includes(q);
    })
    .sort((a, b) => (a.codigo || "").localeCompare(b.codigo || "", "es", { numeric: true }));

  const agregarPlaca = async () => {
    const codigo = nuevaPlacaCod.trim();
    const nombre = nuevaPlacaNom.trim() || codigo;
    if (!codigo) return;
    const dupCod = allPlacas.find(p => p.codigo?.toLowerCase() === codigo.toLowerCase());
    if (dupCod) { setErrorPlaca(`Ya existe una placa con el código "${codigo}".`); return; }
    const dupNom = allPlacas.find(p => p.nombre?.toLowerCase() === nombre.toLowerCase());
    if (dupNom) { setErrorPlaca(`Ya existe una placa con el nombre "${nombre}".`); return; }
    setErrorPlaca("");
    await base44.entities.PlacaPCP.create({ codigo, nombre, activo: true });
    setNuevaPlacaCod(""); setNuevaPlacaNom("");
    await loadCatalogos();
    onSave();
  };

  const guardarEditPlaca = async () => {
    if (!editingPlaca) return;
    const codigo = editingPlaca.codigo.trim();
    const nombre = editingPlaca.nombre.trim();
    if (!codigo) return;
    const dupCod = allPlacas.find(p => p.codigo?.toLowerCase() === codigo.toLowerCase() && p.id !== editingPlaca.id);
    if (dupCod) { setErrorPlaca(`Ya existe una placa con el código "${codigo}".`); return; }
    const dupNom = allPlacas.find(p => p.nombre?.toLowerCase() === nombre.toLowerCase() && p.id !== editingPlaca.id);
    if (dupNom) { setErrorPlaca(`Ya existe una placa con el nombre "${nombre}".`); return; }
    setErrorPlaca("");
    await base44.entities.PlacaPCP.update(editingPlaca.id, { codigo, nombre });
    setEditingPlaca(null);
    await loadCatalogos();
    onSave();
  };

  const toggleActivoPlaca = async (p) => {
    await base44.entities.PlacaPCP.update(p.id, { activo: !p.activo });
    await loadCatalogos();
    onSave();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>⚙ Catálogos PCP</DialogTitle></DialogHeader>
        <Tabs value={catalogoTab} onValueChange={v => { setCatalogoTab(v); setErrorTipo(""); setErrorPlaca(""); setEditingTipo(null); setEditingPlaca(null); }}>
          <TabsList>
            <TabsTrigger value="tipos">Tipos de Acabado</TabsTrigger>
            <TabsTrigger value="placas">Placas</TabsTrigger>
          </TabsList>

          {/* ── TIPOS DE ACABADO ── */}
          <TabsContent value="tipos" className="space-y-3 mt-3">
            {/* Agregar nuevo */}
            <div className="flex gap-2">
              <Input value={nuevoTipo} onChange={e => { setNuevoTipo(e.target.value); setErrorTipo(""); }} placeholder="Nombre del tipo de acabado..." onKeyDown={e => e.key === "Enter" && agregarTipo()} />
              <Button onClick={agregarTipo} className="bg-emerald-600 hover:bg-emerald-700 shrink-0"><Plus className="w-4 h-4 mr-1" /> Agregar</Button>
            </div>
            {errorTipo && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">⚠ {errorTipo}</p>}
            {/* Búsqueda */}
            <Input value={searchTipo} onChange={e => setSearchTipo(e.target.value)} placeholder="🔍 Buscar por nombre..." className="text-xs h-8" />
            {/* Tabla */}
            <div className="border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left">Nombre</th>
                    <th className="p-2 text-center w-24">Estado</th>
                    <th className="p-2 text-center w-36">Fecha de Creación</th>
                    <th className="p-2 text-center w-36">Última Modificación</th>
                    <th className="p-2 text-center w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tiposFiltrados.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">Sin registros.</td></tr>}
                  {tiposFiltrados.map(t => (
                    <tr key={t.id} className={`border-t ${!t.activo ? "bg-gray-50 opacity-70" : "hover:bg-slate-50"}`}>
                      <td className="p-2">
                        {editingTipo?.id === t.id
                          ? <Input autoFocus value={editingTipo.nombre} onChange={e => setEditingTipo(p => ({ ...p, nombre: e.target.value }))} className="h-7 text-xs" onKeyDown={e => e.key === "Enter" && guardarEditTipo()} />
                          : <span className={!t.activo ? "line-through text-slate-400" : ""}>{t.nombre}</span>
                        }
                      </td>
                      <td className="p-2 text-center">
                        <Badge className={`text-xs ${t.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {t.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="p-2 text-center text-slate-500">{fmtDT(t.created_date)}</td>
                      <td className="p-2 text-center text-slate-500">{fmtDT(t.updated_date)}</td>
                      <td className="p-2 text-center">
                        <div className="flex justify-center gap-1">
                          {editingTipo?.id === t.id ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600" onClick={guardarEditTipo} title="Guardar"><Save className="w-3 h-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400" onClick={() => { setEditingTipo(null); setErrorTipo(""); }} title="Cancelar"><X className="w-3 h-3" /></Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-600" onClick={() => { setEditingTipo({ id: t.id, nombre: t.nombre }); setErrorTipo(""); }} title="Editar"><Edit2 className="w-3 h-3" /></Button>
                              <Button size="icon" variant="ghost" className={`h-6 w-6 ${t.activo ? "text-amber-600" : "text-emerald-600"}`} onClick={() => toggleActivoTipo(t)} title={t.activo ? "Inactivar" : "Activar"}>
                                {t.activo ? <X className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          {/* ── PLACAS ── */}
          <TabsContent value="placas" className="space-y-3 mt-3">
            {/* Agregar nuevo */}
            <div className="flex gap-2">
              <Input value={nuevaPlacaCod} onChange={e => { setNuevaPlacaCod(e.target.value); setErrorPlaca(""); }} placeholder="Código..." className="w-28" />
              <Input value={nuevaPlacaNom} onChange={e => { setNuevaPlacaNom(e.target.value); setErrorPlaca(""); }} placeholder="Nombre..." onKeyDown={e => e.key === "Enter" && agregarPlaca()} />
              <Button onClick={agregarPlaca} className="bg-emerald-600 hover:bg-emerald-700 shrink-0"><Plus className="w-4 h-4 mr-1" /> Agregar</Button>
            </div>
            {errorPlaca && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1.5">⚠ {errorPlaca}</p>}
            {/* Búsqueda */}
            <Input value={searchPlaca} onChange={e => setSearchPlaca(e.target.value)} placeholder="🔍 Buscar por código o nombre..." className="text-xs h-8" />
            {/* Tabla */}
            <div className="border rounded overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left w-28">Código</th>
                    <th className="p-2 text-left">Nombre</th>
                    <th className="p-2 text-center w-24">Estado</th>
                    <th className="p-2 text-center w-36">Fecha de Creación</th>
                    <th className="p-2 text-center w-36">Última Modificación</th>
                    <th className="p-2 text-center w-24">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {placasFiltradas.length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin registros.</td></tr>}
                  {placasFiltradas.map(p => (
                    <tr key={p.id} className={`border-t ${!p.activo ? "bg-gray-50 opacity-70" : "hover:bg-slate-50"}`}>
                      <td className="p-2 font-mono">
                        {editingPlaca?.id === p.id
                          ? <Input autoFocus value={editingPlaca.codigo} onChange={e => setEditingPlaca(prev => ({ ...prev, codigo: e.target.value }))} className="h-7 text-xs font-mono" />
                          : <span className={!p.activo ? "line-through text-slate-400" : ""}>{p.codigo}</span>
                        }
                      </td>
                      <td className="p-2">
                        {editingPlaca?.id === p.id
                          ? <Input value={editingPlaca.nombre} onChange={e => setEditingPlaca(prev => ({ ...prev, nombre: e.target.value }))} className="h-7 text-xs" onKeyDown={e => e.key === "Enter" && guardarEditPlaca()} />
                          : <span className={!p.activo ? "line-through text-slate-400" : ""}>{p.nombre}</span>
                        }
                      </td>
                      <td className="p-2 text-center">
                        <Badge className={`text-xs ${p.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {p.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      <td className="p-2 text-center text-slate-500">{fmtDT(p.created_date)}</td>
                      <td className="p-2 text-center text-slate-500">{fmtDT(p.updated_date)}</td>
                      <td className="p-2 text-center">
                        <div className="flex justify-center gap-1">
                          {editingPlaca?.id === p.id ? (
                            <>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600" onClick={guardarEditPlaca} title="Guardar"><Save className="w-3 h-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-slate-400" onClick={() => { setEditingPlaca(null); setErrorPlaca(""); }} title="Cancelar"><X className="w-3 h-3" /></Button>
                            </>
                          ) : (
                            <>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-blue-600" onClick={() => { setEditingPlaca({ id: p.id, codigo: p.codigo, nombre: p.nombre }); setErrorPlaca(""); }} title="Editar"><Edit2 className="w-3 h-3" /></Button>
                              <Button size="icon" variant="ghost" className={`h-6 w-6 ${p.activo ? "text-amber-600" : "text-emerald-600"}`} onClick={() => toggleActivoPlaca(p)} title={p.activo ? "Inactivar" : "Activar"}>
                                {p.activo ? <X className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>
        <div className="flex justify-end pt-4 border-t"><Button onClick={onClose}>Cerrar</Button></div>
      </DialogContent>
    </Dialog>
  );
}

// ─── HistorialTab ───
function HistorialTab({ solicitudes, ordenes, avances, entregas, clientes, colores, tiposCuero, placas }) {
  const [filtros, setFiltros] = useState({ cliente: "", color: "", tipo_cuero: "", placa: "", pintor: "", orden: "", solicitud: "" });
  const filtradas = solicitudes.filter(s => {
    if (filtros.cliente && !s.cliente_nombre?.toLowerCase().includes(filtros.cliente.toLowerCase())) return false;
    if (filtros.solicitud && !s.numero_solicitud?.toLowerCase().includes(filtros.solicitud.toLowerCase())) return false;
    return true;
  });
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Historial de Producción</CardTitle></CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
          <Input placeholder="Cliente..." value={filtros.cliente} onChange={e => setFiltros(p => ({ ...p, cliente: e.target.value }))} className="text-xs h-8" />
          <Input placeholder="No. Solicitud..." value={filtros.solicitud} onChange={e => setFiltros(p => ({ ...p, solicitud: e.target.value }))} className="text-xs h-8" />
          <Input placeholder="No. Orden..." value={filtros.orden} onChange={e => setFiltros(p => ({ ...p, orden: e.target.value }))} className="text-xs h-8" />
          <Input placeholder="Color..." value={filtros.color} onChange={e => setFiltros(p => ({ ...p, color: e.target.value }))} className="text-xs h-8" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-2 text-left">Solicitud</th>
                <th className="p-2 text-left">Cliente</th>
                <th className="p-2 text-left">Prioridad</th>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-right">Total Hojas</th>
                <th className="p-2 text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 ? <tr><td colSpan={6} className="p-4 text-center text-slate-400">Sin resultados.</td></tr>
                : filtradas.map(s => {
                  const totalH = (s.items || []).reduce((sum, i) => sum + (i.cantidad_hojas || 0), 0);
                  return (
                    <tr key={s.id} className="border-t hover:bg-slate-50">
                      <td className="p-2 font-mono font-bold text-purple-700">{s.numero_solicitud}</td>
                      <td className="p-2">{s.cliente_nombre}</td>
                      <td className="p-2"><Badge className={`text-xs ${PRIORIDAD_BADGE[s.prioridad]}`}>{PRIORIDAD_LABEL[s.prioridad]}</Badge></td>
                      <td className="p-2">{fmtDate(s.fecha)}</td>
                      <td className="p-2 text-right font-bold">{totalH}</td>
                      <td className="p-2 text-center"><Badge className={`text-xs ${ESTADO_BADGE[s.estado]}`}>{ESTADO_LABEL[s.estado]}</Badge></td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}