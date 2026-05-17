import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, ProductoTerminado, MovimientoInventario, InventarioEnProceso } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Eye, Trash2, Lock } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';
import RecurtidoControlPanel from '../components/recurtido/RecurtidoControlPanel';

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

  // ─── HELPERS ───────────────────────────────────────────────────────────────

  const getLotePadre = (codigoLote) => {
    const match = (codigoLote || '').match(/^(.*?)-SUB\d+$/);
    return match ? match[1] : codigoLote;
  };

  const lotesCodigos = [...new Set(procesos.map(p => p.codigo_lote).filter(Boolean))];

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

    if (totalHojasLote > 0 && (totalYaRecurtido + cantNueva) > totalHojasLote) {
      alert(`❌ La cantidad ingresada supera el total del lote.\nTotal lote: ${totalHojasLote} hojas\nYa registradas: ${totalYaRecurtido} hojas\nDisponibles: ${totalHojasLote - totalYaRecurtido} hojas`);
      return;
    }

    if (!isEditing && isRecurtidoGeneralFinalizado(codigoLote)) {
      alert('❌ El Recurtido General de este lote ya fue finalizado. No se pueden agregar más registros.');
      return;
    }

    try {
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

  // ─── FINALIZAR SUBLOTE ─────────────────────────────────────────────────────

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
    // Recoger todos los sublotes del padre
    const lotePadreEfectivo = getLotePadre(codigoLote);
    const sublotes = procesos.filter(p => getLotePadre(p.codigo_lote) === lotePadreEfectivo);
    const invSubs = inventarioEnProceso.filter(i => getLotePadre(i.codigo_lote) === lotePadreEfectivo);
    const totalHojasLote = invSubs.reduce((s, i) => s + (i.cantidad_hojas || 0), 0)
      || inventarioEnProceso.find(i => i.codigo_lote === codigoLote)?.cantidad_hojas || 0;
    const totalRecurtido = sublotes.reduce((sum, p) => sum + (parseFloat(p.cantidad_pieles) || 0), 0);

    const pendientes = sublotes.filter(p => p.estado !== 'completado');
    if (pendientes.length > 0) {
      alert(`❌ Existen ${pendientes.length} sublote(s) pendientes. Debe finalizar todos los sublotes antes de cerrar el recurtido general.`);
      return;
    }
    if (totalHojasLote > 0 && totalRecurtido < totalHojasLote) {
      alert(`❌ Faltan ${totalHojasLote - totalRecurtido} hojas por registrar.\nTotal lote: ${totalHojasLote} | Total recurtido: ${totalRecurtido}`);
      return;
    }
    if (!window.confirm(`¿Finalizar el Recurtido General del lote ${lotePadreEfectivo}?\n\nEsto cerrará completamente el proceso de recurtido para este lote y bloqueará nuevos registros.`)) return;

    try {
      for (const p of sublotes) {
        await ProcesoProduccion.update(p.id, { finalizar_recurtido_general: true });
      }

      for (const inv of invSubs) {
        const sublotesInv = sublotes.filter(p => p.codigo_lote === inv.codigo_lote);
        const costoTotal = sublotesInv.reduce((sum, p) => sum + (p.subtotal_humectacion || 0) + (p.subtotal_recromado || 0) + (p.subtotal_recurtido || 0), 0);
        const costoAcum = (inv.costo_acumulado || 0) + costoTotal;
        const subloteConColor = sublotesInv.find(p => p.codigo_color || p.nombre_color);
        const totalHojasRecurtidas = sublotesInv.reduce((sum, p) => sum + (parseFloat(p.cantidad_pieles) || 0), 0);
        await InventarioEnProceso.update(inv.id, {
          etapa_actual: 'recurtido',
          estado_actual: 'FINALIZADO',
          estado_proceso: 'piel_recurtida',
          costo_acumulado: costoAcum,
          costo_promedio: totalHojasLote > 0 ? costoAcum / totalHojasLote : 0,
          codigo_color: subloteConColor?.codigo_color || inv.codigo_color || '',
          color_base: subloteConColor?.nombre_color || inv.color_base || '',
          cantidad_hojas: totalHojasRecurtidas > 0 ? totalHojasRecurtidas : (inv.cantidad_hojas || 0),
        });
      }

      await loadData();
      alert(`✅ Recurtido General del lote ${lotePadreEfectivo} finalizado correctamente.`);
    } catch (err) {
      alert('Error al finalizar recurtido general: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este sublote de recurtido?')) return;
    try { await ProcesoProduccion.delete(id); loadData(); } catch (error) { console.error(error); }
  };

  // ─── DATOS PARA MODAL ──────────────────────────────────────────────────────

  const todosLosItems = [...insumos.map(i => ({ ...i, tipo: 'insumo' })), ...productos.map(p => ({ ...p, tipo: 'producto' }))];

  const codigosYaUsados = new Set(procesos.map(p => p.inv_proceso_id).filter(Boolean));
  const invFiltrados = inventarioEnProceso.filter(inv => {
    if (codigosYaUsados.has(inv.id)) return false;
    if (!searchEnProceso) return true;
    const s = searchEnProceso.toLowerCase();
    return (inv.codigo_lote || '').toLowerCase().includes(s) || (inv.descripcion || '').toLowerCase().includes(s);
  });

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      <RecurtidoControlPanel
        procesos={procesos}
        inventarioEnProceso={inventarioEnProceso}
        getLotePadre={getLotePadre}
        getSublotesLote={getSublotesLote}
        onEdit={handleOpenModal}
        onFinalizarSublote={handleFinalizarSublote}
        onFinalizarGeneral={handleFinalizarRecurtidoGeneral}
        onDelete={handleDelete}
        onVerDetalle={(proc) => { setSelectedItem(proc); setShowDetailModal(true); }}
        onVerConsolidado={(lote) => { setLoteConsolidado(lote); setShowConsolidadoModal(true); }}
        onNuevoSublote={() => handleOpenModal()}
        onImprimir={() => window.print()}
      />

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
              <p><span className="font-semibold">Lote Padre:</span> {getLotePadre(selectedItem.codigo_lote)}</p>
              <p><span className="font-semibold">Código Sublote:</span> <span className="font-mono">{selectedItem.codigo_lote}</span></p>
              <p><span className="font-semibold">Sublote #:</span> {selectedItem.numero_sublote_recurtido}</p>
              <p><span className="font-semibold">Color:</span> {selectedItem.codigo_color} — {selectedItem.nombre_color}</p>
              <p><span className="font-semibold">Actividad:</span> <span className="capitalize">{selectedItem.actividad}</span></p>
              <p><span className="font-semibold">Cantidad Hojas:</span> {selectedItem.cantidad_pieles}</p>
              <p><span className="font-semibold">Peso Actual:</span> {selectedItem.peso_actual} kg</p>
              <p><span className="font-semibold">Operario:</span> {selectedItem.responsable || selectedItem.nombre_curtidor || '—'}</p>
              <p><span className="font-semibold">Etapa Proceso:</span> <span className="capitalize">{selectedItem.seccion || selectedItem.actividad || '—'}</span></p>
              <p><span className="font-semibold">Fecha Inicio:</span> {selectedItem.fecha_inicio ? new Date(selectedItem.fecha_inicio).toLocaleDateString('es-CO') : '—'}</p>
              {selectedItem.fecha_fin && <p><span className="font-semibold">Fecha Finalización:</span> {new Date(selectedItem.fecha_fin).toLocaleDateString('es-CO')}</p>}
              <p><span className="font-semibold">Subtotal Humectación:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.subtotal_humectacion)}</span></p>
              <p><span className="font-semibold">Subtotal Recromado:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.subtotal_recromado)}</span></p>
              <p><span className="font-semibold">Subtotal Recurtido:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.subtotal_recurtido)}</span></p>
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}
              <p><span className="font-semibold">Estado:</span>{' '}
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedItem.estado === 'completado' ? 'bg-green-100 text-green-700' : selectedItem.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {selectedItem.estado === 'completado' ? 'Finalizado' : selectedItem.estado === 'en_proceso' ? 'En Proceso' : 'Pendiente'}
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