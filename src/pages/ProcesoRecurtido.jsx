import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, ProductoTerminado, MovimientoInventario, InventarioEnProceso } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Trash2, Table, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

const COLORES_MAP = {
  'PR001': 'NEGRO', 'PR002': 'CAFE', 'PR003': 'MIEL', 'PR004': 'QUEBRACHO',
  'PR005': 'BLANCO', 'PR006': 'AZUL', 'PR007': 'ROJO', 'PR008': 'VERDE'
};
const COLORES_INV = Object.fromEntries(Object.entries(COLORES_MAP).map(([k, v]) => [v, k]));

export default function ProcesoRecurtido() {
  const [procesos, setProcesos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal nuevo/editar sublote
  const [showModal, setShowModal] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchEnProceso, setSearchEnProceso] = useState('');
  const [invSeleccionado, setInvSeleccionado] = useState(null);

  // Modal detalle
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  // Consolidado
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [loteConsolidado, setLoteConsolidado] = useState(null);

  // Filtro lote activo en tabla de control
  const [loteActivoControl, setLoteActivoControl] = useState('');
  // Selectores tabla de control: lote padre + sublote específico
  const [lotePadreControl, setLotePadreControl] = useState('');
  const [subloteControl, setSubloteControl] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, productosData, invEnProceso] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'recurtido' }),
        Insumo.list(),
        ProductoTerminado.list(),
        InventarioEnProceso.list()
      ]);
      setProcesos(Array.isArray(procesosData) ? procesosData : []);
      setInsumos(Array.isArray(insumosData) ? insumosData : []);
      setProductos(Array.isArray(productosData) ? productosData : []);
      const filtrados = (Array.isArray(invEnProceso) ? invEnProceso : [])
        .filter(i => i.estado_actual === 'EN_PROCESO' && i.etapa_actual === 'curtido');
      setInventarioEnProceso(filtrados);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── CÁLCULOS DE CONTROL DE LOTE ───────────────────────────────────────────

  // Agrupa procesos de recurtido por código_lote
  const lotesCodigos = [...new Set(procesos.map(p => p.codigo_lote).filter(Boolean))];

  // Para un lote dado: total hojas del inventario en proceso
  const getTotalHojasLote = (codigoLote) => {
    const inv = inventarioEnProceso.find(i => i.codigo_lote === codigoLote);
    if (inv) return inv.cantidad_hojas || 0;
    // fallback: buscar en procesos de curtido
    return 0;
  };

  // Sublotes de recurtido para un lote
  const getSublotesLote = (codigoLote) => procesos
    .filter(p => p.codigo_lote === codigoLote)
    .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));

  const getTotalHojasRecurtidas = (codigoLote) =>
    getSublotesLote(codigoLote).reduce((sum, p) => sum + (parseFloat(p.cantidad_pieles) || 0), 0);

  const isRecurtidoGeneralFinalizado = (codigoLote) =>
    getSublotesLote(codigoLote).some(p => p.finalizar_recurtido_general === true);

  // ─── HANDLERS MODAL ────────────────────────────────────────────────────────

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    if (item) {
      setCurrentItem({ ...item });
      const inv = inventarioEnProceso.find(i => i.codigo_lote === item.codigo_lote);
      setInvSeleccionado(inv || null);
    } else {
      setCurrentItem({
        tipo_proceso: 'recurtido',
        codigo_lote: '',
        inv_proceso_id: '',
        codigo_color: '',
        nombre_color: '',
        cantidad_pieles: 0,
        actividad: 'humectacion',
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_fin: '',
        peso_actual: 0,
        peso_promedio: 0,
        subtotal_humectacion: 0,
        subtotal_recromado: 0,
        subtotal_recurtido: 0,
        observaciones: '',
        insumos_utilizados: [],
        estado: 'pendiente',
        finalizar_recurtido: false,
        finalizar_recurtido_general: false
      });
      setInvSeleccionado(null);
    }
    setSearchEnProceso('');
    setShowModal(true);
  };

  const handleSelectInvProceso = (id) => {
    const inv = inventarioEnProceso.find(i => i.id === id);
    if (!inv) return;
    setInvSeleccionado(inv);
    setSearchEnProceso('');
    setCurrentItem(prev => ({
      ...prev,
      inv_proceso_id: inv.id,
      codigo_lote: inv.codigo_lote || inv.codigo || '',
    }));
  };

  const addInsumo = () => {
    setCurrentItem(prev => ({
      ...prev,
      insumos_utilizados: [...(prev.insumos_utilizados || []), {
        insumo_id: '', codigo: '', producto: '', dosificacion: 0,
        cantidad: 0, costo_unitario: 0, iva: 0.19, valor_total: 0
      }]
    }));
  };

  const removeInsumo = (index) => {
    const updated = currentItem.insumos_utilizados.filter((_, i) => i !== index);
    setCurrentItem(prev => ({ ...prev, insumos_utilizados: updated }));
    recalculateSubtotals(updated, currentItem.actividad);
  };

  const handleInsumoChange = (index, field, value) => {
    const updated = [...currentItem.insumos_utilizados];
    updated[index][field] = value;
    if (field === 'insumo_id') {
      const item = [...insumos, ...productos].find(i => i.id === value);
      if (item) { updated[index].codigo = item.codigo || ''; updated[index].producto = item.nombre || item.descripcion || ''; updated[index].costo_unitario = item.costo_promedio || 0; }
    }
    if (field === 'dosificacion') {
      updated[index].cantidad = ((parseFloat(currentItem.peso_actual) || 0) * (parseFloat(value) || 0)) / 100;
    }
    const cantidad = parseFloat(updated[index].cantidad) || 0;
    const costoUnitario = parseFloat(updated[index].costo_unitario) || 0;
    const iva = parseFloat(updated[index].iva) || 0;
    const subtotal = cantidad * costoUnitario;
    updated[index].valor_total = subtotal + (subtotal * iva);
    setCurrentItem(prev => ({ ...prev, insumos_utilizados: updated }));
    recalculateSubtotals(updated, currentItem.actividad);
  };

  const recalculateSubtotals = (ins, actividad) => {
    const total = ins.reduce((sum, i) => sum + (i.valor_total || 0), 0);
    if (actividad === 'humectacion') setCurrentItem(prev => ({ ...prev, subtotal_humectacion: total }));
    else if (actividad === 'recromado') setCurrentItem(prev => ({ ...prev, subtotal_recromado: total }));
    else if (actividad === 'recurtido') setCurrentItem(prev => ({ ...prev, subtotal_recurtido: total }));
  };

  const handlePesoActualChange = (newPeso) => {
    setCurrentItem(prev => {
      const pesoActual = parseFloat(newPeso) || 0;
      const cantidadPieles = parseFloat(prev.cantidad_pieles) || 1;
      const pesoPromedio = cantidadPieles > 0 ? pesoActual / cantidadPieles : 0;
      const updatedInsumos = (prev.insumos_utilizados || []).map(item => {
        const dosificacion = parseFloat(item.dosificacion) || 0;
        const cantidad = (pesoActual * dosificacion) / 100;
        const costoUnitario = parseFloat(item.costo_unitario) || 0;
        const iva = parseFloat(item.iva) || 0;
        const subtotal = cantidad * costoUnitario;
        return { ...item, cantidad, valor_total: subtotal + (subtotal * iva) };
      });
      const total = updatedInsumos.reduce((sum, i) => sum + (i.valor_total || 0), 0);
      const newState = { ...prev, peso_actual: pesoActual, peso_promedio: pesoPromedio, insumos_utilizados: updatedInsumos };
      if (prev.actividad === 'humectacion') newState.subtotal_humectacion = total;
      else if (prev.actividad === 'recromado') newState.subtotal_recromado = total;
      else if (prev.actividad === 'recurtido') newState.subtotal_recurtido = total;
      return newState;
    });
  };

  // ─── GUARDAR SUBLOTE ────────────────────────────────────────────────────────

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentItem.inv_proceso_id && !isEditing) {
      alert('⚠️ Debe seleccionar un "Código en Proceso".');
      return;
    }

    const codigoLote = currentItem.codigo_lote;
    const inv = invSeleccionado || inventarioEnProceso.find(i => i.codigo_lote === codigoLote);
    const totalHojasLote = inv?.cantidad_hojas || 0;
    const sublotesExistentes = getSublotesLote(codigoLote);
    const totalYaRecurtido = sublotesExistentes
      .filter(p => !isEditing || p.id !== currentItem.id)
      .reduce((sum, p) => sum + (parseFloat(p.cantidad_pieles) || 0), 0);
    const cantNueva = parseFloat(currentItem.cantidad_pieles) || 0;

    // Validar cantidad total no supere el lote
    if (totalHojasLote > 0 && (totalYaRecurtido + cantNueva) > totalHojasLote) {
      alert(`❌ La cantidad ingresada supera el total del lote.\nTotal lote: ${totalHojasLote} hojas\nYa registradas: ${totalYaRecurtido} hojas\nDisponibles: ${totalHojasLote - totalYaRecurtido} hojas`);
      return;
    }

    // Validar que el recurtido general no esté ya finalizado
    if (!isEditing && isRecurtidoGeneralFinalizado(codigoLote)) {
      alert('❌ El Recurtido General de este lote ya fue finalizado. No se pueden agregar más registros.');
      return;
    }

    try {
      // Número de sublote = cantidad de sublotes existentes + 1
      const numSublote = isEditing
        ? (currentItem.numero_sublote_recurtido || 1)
        : sublotesExistentes.length + 1;

      const dataToSave = {
        ...currentItem,
        numero_proceso: `${codigoLote}-RCT-${String(numSublote).padStart(2, '0')}`,
        numero_sublote_recurtido: numSublote,
        estado: currentItem.finalizar_recurtido ? 'completado' : 'pendiente',
        fecha_fin: currentItem.finalizar_recurtido && !currentItem.fecha_fin
          ? new Date().toISOString().split('T')[0]
          : currentItem.fecha_fin
      };

      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        await ProcesoProduccion.create(dataToSave);
      }

      // Descontar insumos del inventario (solo en creación)
      if (!isEditing && dataToSave.insumos_utilizados?.length > 0) {
        for (const insumo of dataToSave.insumos_utilizados) {
          if (insumo.insumo_id && insumo.cantidad > 0) {
            const insumoData = insumos.find(i => i.id === insumo.insumo_id);
            if (insumoData) {
              await MovimientoInventario.create({
                tipo_movimiento: 'salida', insumo_id: insumo.insumo_id,
                cantidad: -(insumo.cantidad), costo_unitario: insumoData.costo_promedio || 0,
                fecha_movimiento: dataToSave.fecha_inicio,
                referencia: `RECURTIDO-${codigoLote}-${dataToSave.nombre_color}-S${numSublote}`,
                observaciones: `Consumo recurtido (${dataToSave.actividad}) - Lote ${codigoLote} Sublote ${numSublote}`,
                usuario_id: 'system'
              });
              const movimientos = await MovimientoInventario.filter({ insumo_id: insumo.insumo_id });
              const nuevoStock = (Array.isArray(movimientos) ? movimientos : []).reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
              await Insumo.update(insumo.insumo_id, { stock_actual: nuevoStock });
            }
          }
        }
      }

      setShowModal(false);
      await loadData();
      alert('Sublote de recurtido guardado correctamente.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar: ' + error.message);
    }
  };

  // ─── FINALIZAR SUBLOTE INDIVIDUAL ──────────────────────────────────────────

  const handleFinalizarSublote = async (proceso) => {
    if (!window.confirm(`¿Finalizar el sublote "${proceso.nombre_color} - Sublote ${proceso.numero_sublote_recurtido || '#'}"?`)) return;
    try {
      await ProcesoProduccion.update(proceso.id, {
        estado: 'completado',
        finalizar_recurtido: true,
        fecha_fin: new Date().toISOString().split('T')[0]
      });
      await loadData();
    } catch (err) {
      alert('Error al finalizar sublote: ' + err.message);
    }
  };

  // ─── FINALIZAR RECURTIDO GENERAL ───────────────────────────────────────────

  const handleFinalizarRecurtidoGeneral = async (codigoLote) => {
    const sublotes = getSublotesLote(codigoLote);
    const inv = inventarioEnProceso.find(i => i.codigo_lote === codigoLote);
    const totalHojasLote = inv?.cantidad_hojas || 0;
    const totalRecurtido = getTotalHojasRecurtidas(codigoLote);

    // Validaciones
    const pendientes = sublotes.filter(p => p.estado !== 'completado');
    if (pendientes.length > 0) {
      alert(`❌ Existen ${pendientes.length} sublote(s) pendientes. Debe finalizar todos los sublotes antes de cerrar el recurtido general.`);
      return;
    }
    if (totalHojasLote > 0 && totalRecurtido < totalHojasLote) {
      alert(`❌ Faltan ${totalHojasLote - totalRecurtido} hojas por registrar.\nTotal lote: ${totalHojasLote} | Total recurtido: ${totalRecurtido}`);
      return;
    }
    if (!window.confirm(`¿Finalizar el Recurtido General del lote ${codigoLote}?\n\nEsto cerrará completamente el proceso de recurtido para este lote y bloqueará nuevos registros.`)) return;

    try {
      // Marcar todos los procesos del lote con finalizar_recurtido_general = true
      for (const p of sublotes) {
        await ProcesoProduccion.update(p.id, { finalizar_recurtido_general: true });
      }

      // Actualizar tabla central con datos de color y cantidad hojas desde los sublotes
      if (inv) {
        const costoTotal = sublotes.reduce((sum, p) => sum + (p.subtotal_humectacion || 0) + (p.subtotal_recromado || 0) + (p.subtotal_recurtido || 0), 0);
        const costoAcum = (inv.costo_acumulado || 0) + costoTotal;
        // Tomar color del primer sublote con color definido
        const subloteConColor = sublotes.find(p => p.codigo_color || p.nombre_color);
        const totalHojasRecurtidas = sublotes.reduce((sum, p) => sum + (parseFloat(p.cantidad_pieles) || 0), 0);
        await InventarioEnProceso.update(inv.id, {
          etapa_actual: 'recurtido',
          estado_actual: 'FINALIZADO',
          estado_proceso: 'piel_recurtida',
          costo_acumulado: costoAcum,
          costo_promedio: totalHojasLote > 0 ? costoAcum / totalHojasLote : 0,
          // Sincronizar campos de color y cantidad hojas desde Recurtido
          codigo_color: subloteConColor?.codigo_color || inv.codigo_color || '',
          color_base: subloteConColor?.nombre_color || inv.color_base || '',
          cantidad_hojas: totalHojasRecurtidas > 0 ? totalHojasRecurtidas : (inv.cantidad_hojas || 0),
        });
      }

      await loadData();
      alert(`✅ Recurtido General del lote ${codigoLote} finalizado correctamente.`);
    } catch (err) {
      alert('Error al finalizar recurtido general: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este sublote de recurtido?')) return;
    try { await ProcesoProduccion.delete(id); loadData(); } catch (error) { console.error(error); }
  };

  // ─── DATOS PARA TABLA DE CONTROL ───────────────────────────────────────────

  const todosLosItems = [...insumos.map(i => ({ ...i, tipo: 'insumo' })), ...productos.map(p => ({ ...p, tipo: 'producto' }))];

  // Códigos ya usados en recurtido (para evitar duplicados en el selector)
  const codigosYaUsados = new Set(procesos.map(p => p.inv_proceso_id).filter(Boolean));

  const invFiltrados = inventarioEnProceso.filter(inv => {
    if (codigosYaUsados.has(inv.id)) return false; // ya tiene recurtido registrado
    if (!searchEnProceso) return true;
    const s = searchEnProceso.toLowerCase();
    return (inv.codigo_lote || '').toLowerCase().includes(s) || (inv.descripcion || '').toLowerCase().includes(s);
  });

  // ─── LOTES PRINCIPALES para la tabla de control ────────────────────────────
  // El lote principal es el prefijo antes de "-SUB" (o el propio código si no tiene sublotes)
  const getLotePadre = (codigoLote) => {
    const match = (codigoLote || '').match(/^(.*?)-SUB\d+$/);
    return match ? match[1] : codigoLote;
  };

  // Todos los lotes padre únicos que tienen procesos de recurtido
  const lotesPadreUnicos = [...new Set(lotesCodigos.map(getLotePadre))];

  // Cuando cambia el lote padre, resetear el sublote
  const handleLotePadreChange = (val) => {
    setLotePadreControl(val);
    setSubloteControl('');
    setLoteActivoControl('');
  };

  // Sublotes disponibles del lote padre seleccionado (códigos que tienen recurtido)
  const sublotesDelPadre = lotePadreControl
    ? lotesCodigos.filter(c => getLotePadre(c) === lotePadreControl && c !== lotePadreControl)
    : [];
  const tieneSublotes = sublotesDelPadre.length > 0;

  // Lote efectivo para mostrar en tabla (si hay sublotes, usar el sublote seleccionado; si no, el padre)
  const loteControlActual = subloteControl || lotePadreControl || loteActivoControl || lotesCodigos[0] || '';
  const sublotesControl = getSublotesLote(loteControlActual);
  const totalHojasControl = (() => {
    const inv = inventarioEnProceso.find(i => i.codigo_lote === loteControlActual);
    return inv?.cantidad_hojas || sublotesControl.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
  })();
  const totalRecurtidoControl = getTotalHojasRecurtidas(loteControlActual);
  const faltanHojas = Math.max(0, totalHojasControl - totalRecurtidoControl);
  const generalFinalizado = isRecurtidoGeneralFinalizado(loteControlActual);
  const todosFinalizados = sublotesControl.length > 0 && sublotesControl.every(p => p.estado === 'completado');
  const puedeFinalizarGeneral = todosFinalizados && faltanHojas === 0 && !generalFinalizado && sublotesControl.length > 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Proceso de Recurtido"
        description="Control por color y sublote. Finalización general del lote al completar todos los sublotes."
        onPrint={() => window.print()}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />Nuevo Sublote Recurtido
          </Button>
        }
      />

      {/* ── TABLA DE CONTROL ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2">
          <CardTitle className="text-base">Control de Recurtido por Sublote</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Selector Lote Principal */}
            <div className="flex items-center gap-1">
              <Label className="text-xs text-slate-500 whitespace-nowrap">Código Lote:</Label>
              <Select value={lotePadreControl} onValueChange={handleLotePadreChange}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Seleccionar lote..." />
                </SelectTrigger>
                <SelectContent>
                  {lotesPadreUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  {lotesPadreUnicos.length === 0 && <SelectItem value="__none__" disabled>Sin lotes registrados</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {/* Selector Sublote — solo aparece si el lote padre tiene sublotes */}
            {lotePadreControl && tieneSublotes && (
              <div className="flex items-center gap-1">
                <Label className="text-xs text-slate-500 whitespace-nowrap">Sublote:</Label>
                <Select value={subloteControl} onValueChange={setSubloteControl}>
                  <SelectTrigger className="w-52 h-8 text-xs">
                    <SelectValue placeholder="Todos / seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— Ver todos los sublotes —</SelectItem>
                    {sublotesDelPadre.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {loteControlActual && (
              <Button variant="outline" size="sm" onClick={() => { setLoteConsolidado(lotePadreControl || loteControlActual); setShowConsolidadoModal(true); }}>
                <Table className="w-3 h-3 mr-1" />Consolidado
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loteControlActual ? (
            <>
              {/* Resumen cantidades */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Total Hojas del Lote</p>
                  <p className="text-2xl font-bold text-blue-700">{totalHojasControl}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Hojas Recurtidas</p>
                  <p className="text-2xl font-bold text-emerald-700">{totalRecurtidoControl}</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${faltanHojas > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                  <p className="text-xs text-slate-500">Hojas por Recurtir</p>
                  <p className={`text-2xl font-bold ${faltanHojas > 0 ? 'text-amber-700' : 'text-green-700'}`}>{faltanHojas}</p>
                </div>
              </div>

              {/* Tabla sublotes */}
              <div className="overflow-x-auto border rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left font-medium">Código en Proceso</th>
                      <th className="p-2 text-left font-medium">Color Base</th>
                      <th className="p-2 text-center font-medium">Sublote #</th>
                      <th className="p-2 text-right font-medium">Cant. Hojas</th>
                      <th className="p-2 text-center font-medium">Estado</th>
                      <th className="p-2 text-center font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sublotesControl.length === 0 ? (
                      <tr><td colSpan={7} className="p-4 text-center text-slate-400">No hay sublotes registrados para este lote.</td></tr>
                    ) : (
                      sublotesControl.map((proc) => {
                        const finalizado = proc.estado === 'completado';
                        return (
                          <tr key={proc.id} className={`border-t ${finalizado ? 'bg-green-50' : 'bg-white'}`}>
                            <td className="p-2 font-mono font-bold text-xs">{proc.codigo_lote}</td>
                            <td className="p-2">{proc.nombre_color || '—'}</td>
                            <td className="p-2 text-center">
                              <span className="inline-block bg-slate-100 text-slate-700 rounded px-2 py-0.5 text-xs font-bold">
                                #{proc.numero_sublote_recurtido || '?'}
                              </span>
                            </td>
                            <td className="p-2 text-right font-bold">{proc.cantidad_pieles}</td>
                            <td className="p-2 text-center">
                              {finalizado
                                ? <Badge className="bg-green-100 text-green-700 border-green-300">Finalizado</Badge>
                                : <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Pendiente</Badge>
                              }
                            </td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {finalizado || generalFinalizado ? (
                                  <span className="flex items-center gap-1 text-xs text-slate-400">
                                    <Lock className="w-3 h-3" /> Bloqueado
                                  </span>
                                ) : (
                                  <>
                                    <Button size="sm" variant="outline" onClick={() => handleOpenModal(proc)} className="h-7 text-xs">Editar</Button>
                                    <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleFinalizarSublote(proc)}>
                                      <CheckCircle2 className="w-3 h-3 mr-1" />Finalizar
                                    </Button>
                                  </>
                                )}
                                <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(proc); setShowDetailModal(true); }} className="h-7">
                                  <Eye className="w-3 h-3" />
                                </Button>
                                {!finalizado && !generalFinalizado && (
                                  <Button variant="ghost" size="sm" onClick={() => handleDelete(proc.id)} className="h-7 text-red-500">
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  {sublotesControl.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2">
                        <td colSpan={3} className="p-2 text-right">TOTAL RECURTIDO:</td>
                        <td className="p-2 text-right">{totalRecurtidoControl}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Botón Finalizar General */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {generalFinalizado && (
                    <span className="flex items-center gap-1 text-green-700 font-medium">
                      <CheckCircle2 className="w-4 h-4" /> Recurtido General FINALIZADO — Lote cerrado
                    </span>
                  )}
                  {!generalFinalizado && !puedeFinalizarGeneral && sublotesControl.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-700">
                      <AlertCircle className="w-4 h-4" />
                      {faltanHojas > 0
                        ? `Faltan ${faltanHojas} hojas por registrar`
                        : `Hay ${sublotesControl.filter(p => p.estado !== 'completado').length} sublote(s) pendiente(s)`
                      }
                    </span>
                  )}
                </div>
                <Button
                  disabled={!puedeFinalizarGeneral}
                  onClick={() => handleFinalizarRecurtidoGeneral(loteControlActual)}
                  className="bg-purple-700 hover:bg-purple-800 disabled:opacity-40"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Finalizar Recurtido General
                </Button>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-center py-8 text-sm">
              {procesos.length === 0
                ? 'Aún no hay sublotes de recurtido registrados. Use el botón "Nuevo Sublote Recurtido".'
                : 'Seleccione un lote para ver el control.'
              }
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── MODAL NUEVO / EDITAR SUBLOTE ─────────────────────────────────── */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Sublote de Recurtido</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">

            {/* SELECTOR CÓDIGO EN PROCESO */}
            {!isEditing && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                <Label className="font-bold text-purple-800">Código en Proceso *</Label>
                <Input placeholder="Buscar por código lote o descripción..." value={searchEnProceso}
                  onChange={e => setSearchEnProceso(e.target.value)} className="my-1 h-8 text-xs" />
                <Select value={currentItem?.inv_proceso_id || ''} onValueChange={handleSelectInvProceso}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lote en proceso..." /></SelectTrigger>
                  <SelectContent>
                    {invFiltrados.length === 0 && <SelectItem value="__empty__" disabled>No hay lotes disponibles</SelectItem>}
                    {invFiltrados.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.codigo_lote} — {inv.descripcion} ({inv.cantidad_hojas || 0} hojas)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {invSeleccionado && (
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs bg-white p-2 rounded border">
                    <div><span className="font-semibold">Lote:</span> <span className="font-mono">{invSeleccionado.codigo_lote}</span></div>
                    <div><span className="font-semibold">Hojas totales:</span> {invSeleccionado.cantidad_hojas}</div>
                    <div><span className="font-semibold">Ya recurtidas:</span> {getTotalHojasRecurtidas(invSeleccionado.codigo_lote)} / Disponibles: {Math.max(0, (invSeleccionado.cantidad_hojas || 0) - getTotalHojasRecurtidas(invSeleccionado.codigo_lote))}</div>
                  </div>
                )}
                {currentItem?.codigo_lote && isRecurtidoGeneralFinalizado(currentItem.codigo_lote) && (
                  <p className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Este lote ya tiene el Recurtido General finalizado. No se pueden agregar más sublotes.
                  </p>
                )}
              </div>
            )}
            {isEditing && (
              <div className="p-2 bg-slate-50 rounded text-sm">
                <span className="font-semibold">Lote:</span> <span className="font-mono">{currentItem?.codigo_lote}</span>
                <span className="ml-4 font-semibold">Sublote:</span> #{currentItem?.numero_sublote_recurtido}
              </div>
            )}

            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Código Color Base</Label>
                <Select value={currentItem?.codigo_color || ''} onValueChange={v => setCurrentItem({...currentItem, codigo_color: v, nombre_color: COLORES_MAP[v] || ''})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COLORES_MAP).map(([k, v]) => <SelectItem key={k} value={k}>{k} — {v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nombre Color Base</Label>
                <Select value={currentItem?.nombre_color || ''} onValueChange={v => setCurrentItem({...currentItem, nombre_color: v, codigo_color: COLORES_INV[v] || ''})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {Object.values(COLORES_MAP).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad Hojas (este sublote)</Label>
                <Input type="number" value={currentItem?.cantidad_pieles || ''} onChange={e => {
                  const cant = parseFloat(e.target.value) || 0;
                  setCurrentItem({...currentItem, cantidad_pieles: cant,
                    peso_promedio: cant > 0 ? (parseFloat(currentItem.peso_actual) || 0) / cant : 0});
                }} className={invSeleccionado && (parseFloat(currentItem?.cantidad_pieles) || 0) >
                  Math.max(0, (invSeleccionado.cantidad_hojas || 0) - getTotalHojasRecurtidas(invSeleccionado.codigo_lote))
                  ? 'border-red-500 bg-red-50' : ''} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div><Label>Fecha Inicio</Label><Input type="date" value={currentItem?.fecha_inicio || ''} onChange={e => setCurrentItem({...currentItem, fecha_inicio: e.target.value})} /></div>
              <div><Label>Fecha Final</Label><Input type="date" value={currentItem?.fecha_fin || ''} onChange={e => setCurrentItem({...currentItem, fecha_fin: e.target.value})} /></div>
              <div><Label>Peso Actual (kg)</Label><Input type="number" step="0.01" value={currentItem?.peso_actual || ''} onChange={e => handlePesoActualChange(e.target.value)} /></div>
              <div><Label>Peso Promedio (kg/piel)</Label><Input type="number" step="0.01" value={currentItem?.peso_promedio?.toFixed ? currentItem.peso_promedio.toFixed(3) : (currentItem?.peso_promedio || '')} readOnly className="bg-gray-50" /></div>
            </div>

            {/* ÍTEMS */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Ítems / Productos</h3>
                <Button type="button" onClick={addInsumo} size="sm"><Plus className="w-4 h-4 mr-2" />Agregar Item</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Código</th><th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-right">% Dosif.</th><th className="p-2 text-right">Cantidad (kg)</th>
                      <th className="p-2 text-right">Costo Unit.</th><th className="p-2 text-right">IVA</th>
                      <th className="p-2 text-right">Valor Total</th><th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(currentItem?.insumos_utilizados || []).map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">
                          <Select value={item.insumo_id} onValueChange={v => handleInsumoChange(index, 'insumo_id', v)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                              {todosLosItems.map(ins => <SelectItem key={ins.id} value={ins.id}>{ins.codigo || ins.referencia} - {ins.nombre || ins.descripcion}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2"><Input value={item.producto} readOnly className="bg-gray-50" /></td>
                        <td className="p-2"><Input type="number" step="0.01" value={item.dosificacion} onChange={e => handleInsumoChange(index, 'dosificacion', e.target.value)} className="text-right" /></td>
                        <td className="p-2"><Input value={item.cantidad} readOnly className="text-right bg-blue-50 font-medium" /></td>
                        <td className="p-2"><Input type="number" step="0.01" value={item.costo_unitario} onChange={e => handleInsumoChange(index, 'costo_unitario', e.target.value)} className="text-right" /></td>
                        <td className="p-2">
                          <Select value={String(item.iva)} onValueChange={v => handleInsumoChange(index, 'iva', parseFloat(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0.19">19%</SelectItem><SelectItem value="0.05">5%</SelectItem><SelectItem value="0">0%</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2 text-right font-medium text-emerald-700">{formatCurrency(item.valor_total)}</td>
                        <td className="p-2">
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeInsumo(index)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {(currentItem?.insumos_utilizados || []).length === 0 && (
                      <tr><td colSpan={8} className="p-3 text-center text-slate-400 text-xs">Sin ítems agregados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <div><Label>Subtotal Recurtido</Label><div className="mt-1 p-2 bg-white rounded border font-bold text-emerald-700">{formatCurrency(currentItem?.subtotal_recurtido || 0)}</div></div>
            </div>

            <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar Sublote</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DETALLE ────────────────────────────────────────────────── */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle del Sublote de Recurtido</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Código Lote:</span> {selectedItem.codigo_lote}</p>
              <p><span className="font-semibold">Sublote #:</span> {selectedItem.numero_sublote_recurtido}</p>
              <p><span className="font-semibold">Color:</span> {selectedItem.codigo_color} — {selectedItem.nombre_color}</p>
              <p><span className="font-semibold">Actividad:</span> <span className="capitalize">{selectedItem.actividad}</span></p>
              <p><span className="font-semibold">Cantidad Hojas:</span> {selectedItem.cantidad_pieles}</p>
              <p><span className="font-semibold">Fecha Inicio:</span> {new Date(selectedItem.fecha_inicio).toLocaleDateString()}</p>
              {selectedItem.fecha_fin && <p><span className="font-semibold">Fecha Fin:</span> {new Date(selectedItem.fecha_fin).toLocaleDateString()}</p>}
              <p><span className="font-semibold">Peso Actual:</span> {selectedItem.peso_actual} kg</p>
              <p><span className="font-semibold">Subtotal Humectación:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.subtotal_humectacion)}</span></p>
              <p><span className="font-semibold">Subtotal Recromado:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.subtotal_recromado)}</span></p>
              <p><span className="font-semibold">Subtotal Recurtido:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.subtotal_recurtido)}</span></p>
              <p><span className="font-semibold">Estado:</span>{' '}
                <span className={`px-2 py-0.5 rounded text-xs ${selectedItem.estado === 'completado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {selectedItem.estado}
                </span>
              </p>
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && (
        <LoteDetalleConsolidado open={showConsolidadoModal} onOpenChange={setShowConsolidadoModal} codigoLote={loteConsolidado} />
      )}
    </div>
  );
}