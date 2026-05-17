import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, ProductoTerminado, MovimientoInventario, InventarioEnProceso } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Eye, X, Table, Filter } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function ProcesoCurtido() {
  const [procesos, setProcesos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [searchEnProceso, setSearchEnProceso] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [loteConsolidado, setLoteConsolidado] = useState(null);
  const [invSeleccionado, setInvSeleccionado] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState('todos');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, productosData, invEnProceso] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'curtido' }),
        Insumo.list(),
        ProductoTerminado.list(),
        InventarioEnProceso.list()
      ]);
      setProcesos(Array.isArray(procesosData) ? procesosData : []);
      setInsumos(Array.isArray(insumosData) ? insumosData : []);
      setProductos(Array.isArray(productosData) ? productosData : []);
      // Para el selector del modal: solo etapa=limpieza y EN_PROCESO
      // Para la columna "Código en Proceso" en tabla: necesitamos todos
      setInventarioEnProceso(Array.isArray(invEnProceso) ? invEnProceso : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    setCurrentItem(item || {
      tipo_proceso: 'curtido',
      codigo_lote: '',
      inv_proceso_id: '',
      cantidad_pieles: 0,
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '',
      peso_actual: 0,
      peso_promedio: 0,
      costo_total_curtido: 0,
      observaciones: '',
      insumos_utilizados: [],
      estado: 'pendiente',
      finalizar_curtido: false
    });
    setInvSeleccionado(null);
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
      cantidad_pieles: inv.cantidad_hojas || prev.cantidad_pieles,
      peso_actual: inv.peso_actual || prev.peso_actual
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
    calculateTotal(updated);
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
    if (field === 'costo_unitario') updated[index].costo_unitario = parseFloat(value) || 0;
    const cantidad = parseFloat(updated[index].cantidad) || 0;
    const costoUnitario = parseFloat(updated[index].costo_unitario) || 0;
    const iva = parseFloat(updated[index].iva) || 0;
    const subtotal = cantidad * costoUnitario;
    updated[index].valor_total = subtotal + (subtotal * iva);
    setCurrentItem(prev => ({ ...prev, insumos_utilizados: updated }));
    calculateTotal(updated);
  };

  const calculateTotal = (ins) => {
    const total = ins.reduce((sum, i) => sum + (i.valor_total || 0), 0);
    setCurrentItem(prev => ({ ...prev, costo_total_curtido: total }));
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
      return { ...prev, peso_actual: pesoActual, peso_promedio: pesoPromedio, insumos_utilizados: updatedInsumos, costo_total_curtido: total };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentItem.inv_proceso_id && !isEditing) {
      alert('⚠️ Debe seleccionar un "Código en Proceso" de la tabla central.');
      return;
    }
    try {
      const dataToSave = {
        ...currentItem,
        numero_proceso: `${currentItem.codigo_lote}-CRT`,
        estado: currentItem.finalizar_curtido ? 'completado' : 'pendiente',
        fecha_fin: currentItem.finalizar_curtido && !currentItem.fecha_fin ? new Date().toISOString().split('T')[0] : currentItem.fecha_fin
      };

      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        await ProcesoProduccion.create(dataToSave);
      }

      // Descontar insumos del inventario
      if (!isEditing && dataToSave.insumos_utilizados?.length > 0) {
        for (const insumo of dataToSave.insumos_utilizados) {
          if (insumo.insumo_id && insumo.cantidad > 0) {
            const insumoData = insumos.find(i => i.id === insumo.insumo_id);
            if (insumoData) {
              await MovimientoInventario.create({
                tipo_movimiento: 'salida', insumo_id: insumo.insumo_id,
                cantidad: -(insumo.cantidad), costo_unitario: insumoData.costo_promedio || 0,
                fecha_movimiento: dataToSave.fecha_inicio,
                referencia: `CURTIDO-${dataToSave.codigo_lote}`,
                observaciones: `Consumo curtido - Lote ${dataToSave.codigo_lote}`,
                usuario_id: 'system'
              });
              const movimientos = await MovimientoInventario.filter({ insumo_id: insumo.insumo_id });
              const nuevoStock = (Array.isArray(movimientos) ? movimientos : []).reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
              await Insumo.update(insumo.insumo_id, { stock_actual: nuevoStock });
            }
          }
        }
      }

      // ACTUALIZAR TABLA CENTRAL: si finaliza, avanzar etapa a 'curtido'
      if (dataToSave.finalizar_curtido && currentItem.inv_proceso_id) {
        const invActual = inventarioEnProceso.find(i => i.id === currentItem.inv_proceso_id);
        await InventarioEnProceso.update(currentItem.inv_proceso_id, {
          etapa_actual: 'curtido',
          estado_actual: 'EN_PROCESO',
          estado_proceso: 'piel_curtida',
          peso_actual: dataToSave.peso_actual || (invActual?.peso_actual || 0),
          costo_acumulado: (invActual?.costo_acumulado || 0) + (dataToSave.costo_total_curtido || 0)
        });
        console.log(`✅ Tabla central actualizada: etapa → curtido`);
      }

      setShowModal(false);
      setCurrentItem(null);
      await loadData();
      alert('Proceso de curtido guardado con éxito.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar el proceso: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proceso?')) return;
    try { await ProcesoProduccion.delete(id); loadData(); } catch (error) { console.error(error); }
  };

  const todosLosItems = [...insumos.map(i => ({ ...i, tipo: 'insumo' })), ...productos.map(p => ({ ...p, tipo: 'producto' }))];

  // ── LÓGICA DE ESTADO AUTOMÁTICO ──────────────────────────────────────────────
  const calcularEstado = (item) => {
    // CANCELADO: flag explícito
    if (item.estado === 'cancelado') return 'cancelado';
    // COMPLETADO: finalizar_curtido marcado
    if (item.finalizar_curtido || item.estado === 'completado') {
      // Validar que haya costos e insumos
      if (!item.insumos_utilizados?.length || !item.costo_total_curtido) return 'bloqueado';
      return 'completado';
    }
    // BLOQUEADO: tiene insumos pero costo 0, o no tiene inv_proceso_id
    if (!item.inv_proceso_id && !item.codigo_lote) return 'bloqueado';
    if (item.insumos_utilizados?.length > 0 && !item.costo_total_curtido) return 'bloqueado';
    // EN PROCESO: tiene fecha inicio y tiene insumos registrados
    if (item.insumos_utilizados?.length > 0 || item.peso_actual > 0) return 'en_proceso';
    // PENDIENTE: creado pero sin operaciones
    return 'pendiente';
  };

  const ESTADO_CONFIG = {
    pendiente:   { label: 'PENDIENTE',   color: 'bg-yellow-100 text-yellow-800 border-yellow-300',  tooltip: 'Proceso creado pero sin operaciones iniciadas.' },
    en_proceso:  { label: 'EN PROCESO',  color: 'bg-blue-100 text-blue-800 border-blue-300',         tooltip: 'Proceso iniciado, aún no finalizado.' },
    completado:  { label: 'COMPLETADO',  color: 'bg-green-100 text-green-800 border-green-300',      tooltip: 'Todas las etapas finalizadas y validadas correctamente.' },
    bloqueado:   { label: 'BLOQUEADO',   color: 'bg-red-100 text-red-800 border-red-300',            tooltip: 'Inconsistencia detectada: falta inventario, fórmula, costos o etapa incompleta.' },
    cancelado:   { label: 'CANCELADO',   color: 'bg-gray-100 text-gray-600 border-gray-300',         tooltip: 'Proceso anulado mediante autorización.' },
  };

  const EstadoBadge = ({ item }) => {
    const estado = calcularEstado(item);
    const cfg = ESTADO_CONFIG[estado] || ESTADO_CONFIG.pendiente;
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border cursor-default ${cfg.color}`}>
              {cfg.label}
            </span>
          </TooltipTrigger>
          <TooltipContent><p className="text-xs max-w-[200px]">{cfg.tooltip}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  // ── FILTRO POR ESTADO ────────────────────────────────────────────────────────
  const procesosFiltrados = filtroEstado === 'todos'
    ? procesos
    : procesos.filter(p => calcularEstado(p) === filtroEstado);

  // ── TABLA: cabeceras y filas ─────────────────────────────────────────────────
  const headers = ['Código en Proceso', 'Lote/Sublote', 'Cantidad Pieles', 'Fecha Inicio', 'Peso Actual', 'Peso Promedio', 'Costo Total', 'Estado', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono text-xs text-slate-600">
        {inventarioEnProceso.find(i => i.id === item.inv_proceso_id)?.codigo || item.inv_proceso_id || '—'}
      </td>
      <td className="font-mono font-bold">{item.codigo_lote}</td>
      <td>{item.cantidad_pieles}</td>
      <td>{new Date(item.fecha_inicio).toLocaleDateString()}</td>
      <td>{item.peso_actual} kg</td>
      <td>{item.peso_promedio ? `${parseFloat(item.peso_promedio).toFixed(3)} kg` : '—'}</td>
      <td className="text-right">{formatCurrency(item.costo_total_curtido)}</td>
      <td><EstadoBadge item={item} /></td>
      <td>
        <div className="flex space-x-1">
          <Button variant="outline" size="sm" onClick={() => { setLoteConsolidado(item.codigo_lote); setShowConsolidadoModal(true); }}><Table className="w-4 h-4 text-emerald-600" /></Button>
          <Button variant="outline" size="sm" onClick={() => { setSelectedItem(item); setShowDetailModal(true); }}><Eye className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );

  // Para el selector del modal: solo etapa=limpieza y EN_PROCESO
  const invParaSelector = inventarioEnProceso.filter(i => i.estado_actual === 'EN_PROCESO' && i.etapa_actual === 'limpieza');
  const invFiltrados = invParaSelector.filter(inv => {
    if (!searchEnProceso) return true;
    const s = searchEnProceso.toLowerCase();
    return (inv.codigo_lote || '').toLowerCase().includes(s) || (inv.descripcion || '').toLowerCase().includes(s);
  });

  return (
    <div className="p-6">
      <PageHeader title="Proceso de Curtido" description="Filtra lotes con etapa=LIMPIEZA y estado=EN_PROCESO."
        onPrint={() => window.print()}
        actionButton={<Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" />Nuevo Curtido</Button>}
      />
      <Card id="tabla-imprimible">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Listado de Procesos de Curtido</CardTitle>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-500">Filtrar por estado:</span>
              <Select value={filtroEstado} onValueChange={setFiltroEstado}>
                <SelectTrigger className="w-40 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                  <SelectItem value="bloqueado">Bloqueado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>{loading ? <p>Cargando...</p> : <DataTable headers={headers} data={procesosFiltrados} renderRow={renderRow} />}</CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Proceso de Curtido</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">

            {/* SELECTOR CÓDIGO EN PROCESO */}
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <Label className="font-bold text-emerald-800">Código en Proceso * <span className="font-normal text-xs">(Etapa: LIMPIEZA | Estado: EN_PROCESO)</span></Label>
              <Input placeholder="Buscar por código lote o descripción..." value={searchEnProceso} onChange={e => setSearchEnProceso(e.target.value)} className="my-1 h-8 text-xs" />
              <Select value={currentItem?.inv_proceso_id || ''} onValueChange={handleSelectInvProceso}>
                <SelectTrigger><SelectValue placeholder="Seleccionar lote/sublote en proceso..." /></SelectTrigger>
                <SelectContent>
                  {invFiltrados.length === 0 && <SelectItem value="__empty__" disabled>No hay lotes disponibles (etapa=limpieza)</SelectItem>}
                  {invFiltrados.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.codigo_lote} — {inv.descripcion} ({inv.cantidad_hojas || 0} hojas) [{inv.tipo || 'LOTE'}]
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {invSeleccionado && (
                <div className="mt-2 grid grid-cols-4 gap-2 text-xs bg-white p-2 rounded border">
                  <div><span className="font-semibold">Lote:</span> <span className="font-mono">{invSeleccionado.codigo_lote}</span></div>
                  <div><span className="font-semibold">Hojas:</span> {invSeleccionado.cantidad_hojas}</div>
                  <div><span className="font-semibold">Peso:</span> {invSeleccionado.peso_actual} kg</div>
                  <div><span className="font-semibold">Costo acum.:</span> {formatCurrency(invSeleccionado.costo_acumulado)}</div>
                </div>
              )}
              {currentItem?.codigo_lote && <p className="text-xs text-emerald-700 mt-1 font-medium">✔ Lote asignado: {currentItem.codigo_lote}</p>}
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div><Label>Cantidad Pieles</Label><Input type="number" value={currentItem?.cantidad_pieles || ''} onChange={e => {
                const cant = parseFloat(e.target.value) || 0;
                const peso = parseFloat(currentItem.peso_actual) || 0;
                setCurrentItem({...currentItem, cantidad_pieles: cant, peso_promedio: cant > 0 ? peso / cant : 0});
              }} /></div>
              <div><Label>Fecha Inicial</Label><Input type="date" value={currentItem?.fecha_inicio || ''} onChange={e => setCurrentItem({...currentItem, fecha_inicio: e.target.value})} /></div>
              <div><Label>Fecha Fin</Label><Input type="date" value={currentItem?.fecha_fin || ''} onChange={e => setCurrentItem({...currentItem, fecha_fin: e.target.value})} /></div>
              <div><Label>Peso Actual (kg)</Label><Input type="number" step="0.01" value={currentItem?.peso_actual || ''} onChange={e => handlePesoActualChange(e.target.value)} /></div>
              <div><Label>Peso Promedio/Piel (kg)</Label><Input type="number" step="0.01" value={currentItem?.peso_promedio || ''} onChange={e => setCurrentItem({...currentItem, peso_promedio: parseFloat(e.target.value) || 0})} /></div>
            </div>

            {/* ÍTEMS */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">Ítems / Productos</h3>
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
                        <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => removeInsumo(index)}><X className="w-4 h-4 text-red-500" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <Label>Costo Total Curtido</Label>
              <div className="mt-2 p-3 bg-white rounded border font-bold text-xl text-emerald-700">{formatCurrency(currentItem?.costo_total_curtido || 0)}</div>
            </div>

            <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox id="finalizar_curtido" checked={currentItem?.finalizar_curtido || false} onCheckedChange={v => setCurrentItem({...currentItem, finalizar_curtido: v})} />
                <Label htmlFor="finalizar_curtido" className="font-semibold cursor-pointer">Finalizar Curtido</Label>
              </div>
              {currentItem?.finalizar_curtido && <p className="text-xs text-blue-700 mt-1 font-medium">✅ Al finalizar, se actualizará la tabla central: etapa → CURTIDO</p>}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle del Proceso de Curtido</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Código Lote:</span> {selectedItem.codigo_lote}</p>
              <p><span className="font-semibold">Cantidad Pieles:</span> {selectedItem.cantidad_pieles}</p>
              <p><span className="font-semibold">Fecha Inicio:</span> {new Date(selectedItem.fecha_inicio).toLocaleDateString()}</p>
              {selectedItem.fecha_fin && <p><span className="font-semibold">Fecha Fin:</span> {new Date(selectedItem.fecha_fin).toLocaleDateString()}</p>}
              <p><span className="font-semibold">Peso Actual:</span> {selectedItem.peso_actual} kg</p>
              <p><span className="font-semibold">Costo Total:</span> <span className="text-emerald-700 font-bold text-lg">{formatCurrency(selectedItem.costo_total_curtido)}</span></p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize">{selectedItem.estado}</span></p>
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && <LoteDetalleConsolidado open={showConsolidadoModal} onOpenChange={setShowConsolidadoModal} codigoLote={loteConsolidado} />}
    </div>
  );
}