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
import { Plus, Edit, Trash2, Eye, X, Table } from 'lucide-react';
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
  const [stockDisponible, setStockDisponible] = useState(null);
  const [loadingStock, setLoadingStock] = useState(false);
  const [showTrazabilidad, setShowTrazabilidad] = useState(false);
  const [trazabilidadData, setTrazabilidadData] = useState(null);

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
      // FILTRO: solo registros en estado EN_PROCESO y etapa = curtido
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

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    setCurrentItem(item || {
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
      finalizar_recurtido: false
    });
    setInvSeleccionado(null);
    setSearchEnProceso('');
    setStockDisponible(null);
    setTrazabilidadData(null);
    setShowModal(true);
  };

  const calcularStock = async (inv) => {
    if (!inv) return;
    setLoadingStock(true);
    try {
      const codigoEnProceso = inv.codigo_lote;
      // Hojas en curtido (desde ProcesoProduccion tipo=curtido con este código)
      const curtidos = await ProcesoProduccion.filter({ tipo_proceso: 'curtido', codigo_lote: codigoEnProceso });
      const totalCurtido = (Array.isArray(curtidos) ? curtidos : [])
        .reduce((sum, c) => sum + (parseFloat(c.cantidad_pieles) || 0), 0);
      // Hojas ya registradas en recurtido con este código
      const recurtidos = await ProcesoProduccion.filter({ tipo_proceso: 'recurtido', codigo_lote: codigoEnProceso });
      const totalRecurtido = (Array.isArray(recurtidos) ? recurtidos : [])
        .reduce((sum, r) => sum + (parseFloat(r.cantidad_pieles) || 0), 0);
      const stock = Math.max(0, totalCurtido - totalRecurtido);
      setStockDisponible(stock);
      setTrazabilidadData({ codigoEnProceso, totalCurtido, totalRecurtido, stock });
    } catch (err) {
      console.error('Error calculando stock:', err);
      setStockDisponible(null);
    } finally {
      setLoadingStock(false);
    }
  };

  const handleSelectInvProceso = (id) => {
    const inv = inventarioEnProceso.find(i => i.id === id);
    if (!inv) return;
    setInvSeleccionado(inv);
    setSearchEnProceso('');
    setStockDisponible(null);
    setCurrentItem(prev => ({
      ...prev,
      inv_proceso_id: inv.id,
      codigo_lote: inv.codigo_lote || inv.codigo || '',
      cantidad_pieles: inv.cantidad_hojas || prev.cantidad_pieles,
      peso_actual: inv.peso_actual || prev.peso_actual
    }));
    calcularStock(inv);
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

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentItem.inv_proceso_id && !isEditing) {
      alert('⚠️ Debe seleccionar un "Código en Proceso" de la tabla central.');
      return;
    }
    // Validar stock disponible
    if (!isEditing && stockDisponible !== null) {
      const cantIngresada = parseFloat(currentItem.cantidad_pieles) || 0;
      if (cantIngresada > stockDisponible) {
        alert(`❌ La cantidad ingresada (${cantIngresada} hojas) supera el stock disponible para este código en proceso (${stockDisponible} hojas).`);
        return;
      }
      if (stockDisponible === 0) {
        alert('❌ No hay stock disponible para este código en proceso. Ya fue totalmente recurtido.');
        return;
      }
    }
    try {
      const dataToSave = {
        ...currentItem,
        numero_proceso: `${currentItem.codigo_lote}-RCT`,
        estado: currentItem.finalizar_recurtido ? 'completado' : 'pendiente',
        fecha_fin: currentItem.finalizar_recurtido && !currentItem.fecha_fin ? new Date().toISOString().split('T')[0] : currentItem.fecha_fin
      };

      let procesoId;
      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
        procesoId = currentItem.id;
      } else {
        const created = await ProcesoProduccion.create(dataToSave);
        procesoId = created.id;
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
                referencia: `RECURTIDO-${dataToSave.codigo_lote}-${dataToSave.nombre_color}`,
                observaciones: `Consumo recurtido (${dataToSave.actividad}) - Lote ${dataToSave.codigo_lote}`,
                usuario_id: 'system'
              });
              const movimientos = await MovimientoInventario.filter({ insumo_id: insumo.insumo_id });
              const nuevoStock = (Array.isArray(movimientos) ? movimientos : []).reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
              await Insumo.update(insumo.insumo_id, { stock_actual: nuevoStock });
            }
          }
        }
      }

      // ACTUALIZAR TABLA CENTRAL Y CREAR EN INVENTARIO EN PROCESO AL FINALIZAR
      if (dataToSave.finalizar_recurtido && currentItem.inv_proceso_id) {
        const invActual = inventarioEnProceso.find(i => i.id === currentItem.inv_proceso_id);
        const costoProceso = (dataToSave.subtotal_humectacion || 0) + (dataToSave.subtotal_recromado || 0) + (dataToSave.subtotal_recurtido || 0);
        const costoTotal = (invActual?.costo_acumulado || 0) + costoProceso;
        const cantidadHojas = dataToSave.cantidad_pieles || invActual?.cantidad_hojas || 0;
        const costoPromedio = cantidadHojas > 0 ? costoTotal / cantidadHojas : 0;

        // Actualizar registro en tabla central: FINALIZADO
        await InventarioEnProceso.update(currentItem.inv_proceso_id, {
          etapa_actual: 'recurtido',
          estado_actual: 'FINALIZADO',
          estado_proceso: 'piel_recurtida',
          peso_actual: dataToSave.peso_actual || (invActual?.peso_actual || 0),
          costo_acumulado: costoTotal,
          color_base: dataToSave.nombre_color || '',
          codigo_color: dataToSave.codigo_color || ''
        });
        console.log(`✅ Tabla central actualizada: etapa → recurtido, estado → FINALIZADO`);

        // Verificar consolidación de sublotes si aplica
        if (invActual?.codigo_lote_padre) {
          await verificarConsolidacion(invActual.codigo_lote_padre, costoTotal, cantidadHojas, dataToSave, procesoId);
        }
      }

      setShowModal(false);
      setCurrentItem(null);
      await loadData();
      alert('Proceso de recurtido guardado con éxito.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar el proceso: ' + error.message);
    }
  };

  // REINTEGRACIÓN AUTOMÁTICA: si todos los sublotes están FINALIZADOS
  const verificarConsolidacion = async (codigoPadre, costoUltimoSublote, cantUltimoSublote, dataToSave, procesoId) => {
    try {
      const todos = await InventarioEnProceso.list();
      const sublotesDelLote = (Array.isArray(todos) ? todos : []).filter(i => i.codigo_lote_padre === codigoPadre);
      const todosFinalizados = sublotesDelLote.length > 0 && sublotesDelLote.every(s => s.estado_actual === 'FINALIZADO');

      if (todosFinalizados) {
        // Sumar totales
        const cantidadTotal = sublotesDelLote.reduce((sum, s) => sum + (s.cantidad_hojas || 0), 0);
        const pesoTotal = sublotesDelLote.reduce((sum, s) => sum + (s.peso_actual || 0), 0);
        const costoTotal = sublotesDelLote.reduce((sum, s) => sum + (s.costo_acumulado || 0), 0);
        const costoPromedioFinal = cantidadTotal > 0 ? costoTotal / cantidadTotal : 0;

        // Crear registro consolidado FINAL en InventarioEnProceso
        const existeConsolidado = (Array.isArray(todos) ? todos : []).some(i => i.codigo_lote === `${codigoPadre}-FINAL`);
        if (!existeConsolidado) {
          await InventarioEnProceso.create({
            codigo: codigoPadre,
            descripcion: `Consolidado final de ${codigoPadre}`,
            codigo_lote: `${codigoPadre}-FINAL`,
            codigo_lote_padre: codigoPadre,
            tipo: 'LOTE',
            origen_modulo: 'recurtido',
            etapa_actual: 'recurtido',
            estado_proceso: 'piel_recurtida',
            estado_actual: 'EN_PROCESO',
            cantidad_hojas: cantidadTotal,
            cantidad_pieles: cantidadTotal,
            peso_actual: pesoTotal,
            costo_acumulado: costoTotal,
            costo_promedio: costoPromedioFinal,
            color_base: dataToSave.nombre_color || '',
            fecha_ingreso_proceso: dataToSave.fecha_fin || new Date().toISOString().split('T')[0],
            proceso_origen_id: procesoId
          });
          console.log(`✅ Lote consolidado ${codigoPadre}-FINAL creado. Total hojas: ${cantidadTotal}`);
        }

        // Marcar sublotes como CONSOLIDADO
        for (const sub of sublotesDelLote) {
          await InventarioEnProceso.update(sub.id, { estado_actual: 'CONSOLIDADO' });
        }

        alert(`✅ Todos los sublotes del lote ${codigoPadre} han finalizado. Se creó el lote consolidado ${codigoPadre}-FINAL en Inventario en Proceso.`);
      }
    } catch (err) {
      console.error('Error en consolidación:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proceso?')) return;
    try { await ProcesoProduccion.delete(id); loadData(); } catch (error) { console.error(error); }
  };

  const todosLosItems = [...insumos.map(i => ({ ...i, tipo: 'insumo' })), ...productos.map(p => ({ ...p, tipo: 'producto' }))];

  const headers = ['Lote', 'Color', 'Actividad', 'Cantidad', 'Fecha Inicio', 'Peso Actual', 'Estado', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono font-bold">{item.codigo_lote}</td>
      <td>{item.nombre_color || 'N/A'}</td>
      <td className="capitalize">{item.actividad}</td>
      <td>{item.cantidad_pieles}</td>
      <td>{new Date(item.fecha_inicio).toLocaleDateString()}</td>
      <td>{item.peso_actual} kg</td>
      <td><span className={`px-2 py-0.5 rounded text-xs ${item.estado === 'completado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{item.estado}</span></td>
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

  const invFiltrados = inventarioEnProceso.filter(inv => {
    if (!searchEnProceso) return true;
    const s = searchEnProceso.toLowerCase();
    return (inv.codigo_lote || '').toLowerCase().includes(s) || (inv.descripcion || '').toLowerCase().includes(s);
  });

  return (
    <div className="p-6">
      <PageHeader title="Proceso de Recurtido" description="Filtra lotes con etapa=CURTIDO y estado=EN_PROCESO. Al finalizar actualiza tabla central."
        onPrint={() => window.print()}
        actionButton={<Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" />Nuevo Recurtido</Button>}
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Procesos de Recurtido</CardTitle></CardHeader>
        <CardContent>{loading ? <p>Cargando...</p> : <DataTable headers={headers} data={procesos} renderRow={renderRow} />}</CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Proceso de Recurtido</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">

            {/* SELECTOR CÓDIGO EN PROCESO */}
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <Label className="font-bold text-purple-800">Código en Proceso * <span className="font-normal text-xs">(Etapa: CURTIDO | Estado: EN_PROCESO)</span></Label>
              <Input placeholder="Buscar por código lote o descripción..." value={searchEnProceso} onChange={e => setSearchEnProceso(e.target.value)} className="my-1 h-8 text-xs" />
              <Select value={currentItem?.inv_proceso_id || ''} onValueChange={handleSelectInvProceso}>
                <SelectTrigger><SelectValue placeholder="Seleccionar lote/sublote en proceso..." /></SelectTrigger>
                <SelectContent>
                  {invFiltrados.length === 0 && <SelectItem value="__empty__" disabled>No hay lotes disponibles (etapa=curtido)</SelectItem>}
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
              {currentItem?.codigo_lote && <p className="text-xs text-purple-700 mt-1 font-medium">✔ Lote asignado: {currentItem.codigo_lote}</p>}
              {/* STOCK DISPONIBLE */}
              {invSeleccionado && (
                <div className="mt-2 flex items-center gap-3">
                  {loadingStock ? (
                    <span className="text-xs text-slate-500">Calculando stock...</span>
                  ) : stockDisponible !== null ? (
                    <>
                      <div className={`px-3 py-1.5 rounded-lg text-sm font-bold ${stockDisponible > 0 ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'}`}>
                        📦 Disponible en inventario: <span className="text-lg">{stockDisponible}</span> hojas
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={() => setShowTrazabilidad(true)} className="text-xs">
                        Ver Trazabilidad
                      </Button>
                    </>
                  ) : null}
                </div>
              )}
            </div>

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
                <Label>Cantidad Hojas</Label>
                <Input type="number" value={currentItem?.cantidad_pieles || ''} onChange={e => {
                  const cant = parseFloat(e.target.value) || 0;
                  const peso = parseFloat(currentItem.peso_actual) || 0;
                  setCurrentItem({...currentItem, cantidad_pieles: cant, peso_promedio: cant > 0 ? peso / cant : 0});
                }} className={stockDisponible !== null && (parseFloat(currentItem?.cantidad_pieles) || 0) > stockDisponible ? 'border-red-500 bg-red-50' : ''} />
                {stockDisponible !== null && (parseFloat(currentItem?.cantidad_pieles) || 0) > stockDisponible && (
                  <p className="text-xs text-red-600 mt-1 font-medium">⚠️ Supera el stock disponible ({stockDisponible} hojas)</p>
                )}
              </div>
              <div>
                <Label>Actividad</Label>
                <Select value={currentItem?.actividad || 'humectacion'} onValueChange={v => setCurrentItem({...currentItem, actividad: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="humectacion">Humectación</SelectItem>
                    <SelectItem value="recromado">Recromado</SelectItem>
                    <SelectItem value="recurtido">Recurtido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div><Label>Fecha Inicio</Label><Input type="date" value={currentItem?.fecha_inicio || ''} onChange={e => setCurrentItem({...currentItem, fecha_inicio: e.target.value})} /></div>
              <div><Label>Fecha Final</Label><Input type="date" value={currentItem?.fecha_fin || ''} onChange={e => setCurrentItem({...currentItem, fecha_fin: e.target.value})} /></div>
              <div><Label>Peso Actual (kg)</Label><Input type="number" step="0.01" value={currentItem?.peso_actual || ''} onChange={e => handlePesoActualChange(e.target.value)} /></div>
              <div><Label>Peso Promedio (kg/piel)</Label><Input type="number" step="0.01" value={currentItem?.peso_promedio || ''} onChange={e => setCurrentItem({...currentItem, peso_promedio: parseFloat(e.target.value) || 0})} /></div>
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

            <div className="bg-gray-50 p-4 rounded-lg grid grid-cols-3 gap-4">
              <div><Label>Subtotal Humectación</Label><div className="mt-1 p-2 bg-white rounded border font-bold text-emerald-700">{formatCurrency(currentItem?.subtotal_humectacion || 0)}</div></div>
              <div><Label>Subtotal Recromado</Label><div className="mt-1 p-2 bg-white rounded border font-bold text-emerald-700">{formatCurrency(currentItem?.subtotal_recromado || 0)}</div></div>
              <div><Label>Subtotal Recurtido</Label><div className="mt-1 p-2 bg-white rounded border font-bold text-emerald-700">{formatCurrency(currentItem?.subtotal_recurtido || 0)}</div></div>
            </div>

            <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>

            <div className="p-4 bg-purple-50 rounded-lg space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox id="finalizar_recurtido" checked={currentItem?.finalizar_recurtido || false} onCheckedChange={v => setCurrentItem({...currentItem, finalizar_recurtido: v})} />
                <Label htmlFor="finalizar_recurtido" className="font-semibold cursor-pointer">Finalizar Recurtido</Label>
              </div>
              {currentItem?.finalizar_recurtido && (
                <div className="text-xs text-purple-700 font-medium bg-white p-2 rounded border border-purple-200">
                  <p>✅ Al finalizar:</p>
                  <p>• Tabla central: estado → FINALIZADO, etapa → RECURTIDO</p>
                  <p>• Si todos los sublotes del lote padre están finalizados → se crea registro consolidado automáticamente</p>
                </div>
              )}

              {/* Resumen de Recurtido */}
              {currentItem?.codigo_lote && (
                <div className="bg-white rounded-lg border p-3">
                  <h4 className="font-semibold text-sm mb-2 text-slate-700">Resumen</h4>
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr><th className="p-1 border">Código base</th><th className="p-1 border">Color</th><th className="p-1 border">Código lote</th><th className="p-1 border text-right">Hojas</th><th className="p-1 border text-right">Costo acum.</th></tr>
                    </thead>
                    <tbody>
                      <tr className="border-t">
                        <td className="p-1 border font-mono font-bold">{currentItem.codigo_color || '—'}</td>
                        <td className="p-1 border">{currentItem.nombre_color || '—'}</td>
                        <td className="p-1 border font-mono">{currentItem.codigo_lote}</td>
                        <td className="p-1 border text-right font-bold">{currentItem.cantidad_pieles || 0}</td>
                        <td className="p-1 border text-right">{formatCurrency((invSeleccionado?.costo_acumulado || 0) + (currentItem.subtotal_humectacion || 0) + (currentItem.subtotal_recromado || 0) + (currentItem.subtotal_recurtido || 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
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
          <DialogHeader><DialogTitle>Detalle del Proceso de Recurtido</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Código Lote:</span> {selectedItem.codigo_lote}</p>
              <p><span className="font-semibold">Color:</span> {selectedItem.codigo_color} — {selectedItem.nombre_color}</p>
              <p><span className="font-semibold">Actividad:</span> <span className="capitalize">{selectedItem.actividad}</span></p>
              <p><span className="font-semibold">Cantidad Pieles:</span> {selectedItem.cantidad_pieles}</p>
              <p><span className="font-semibold">Fecha Inicio:</span> {new Date(selectedItem.fecha_inicio).toLocaleDateString()}</p>
              {selectedItem.fecha_fin && <p><span className="font-semibold">Fecha Fin:</span> {new Date(selectedItem.fecha_fin).toLocaleDateString()}</p>}
              <p><span className="font-semibold">Peso Actual:</span> {selectedItem.peso_actual} kg</p>
              <p><span className="font-semibold">Subtotal Humectación:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.subtotal_humectacion)}</span></p>
              <p><span className="font-semibold">Subtotal Recromado:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.subtotal_recromado)}</span></p>
              <p><span className="font-semibold">Subtotal Recurtido:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.subtotal_recurtido)}</span></p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize">{selectedItem.estado}</span></p>
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && <LoteDetalleConsolidado open={showConsolidadoModal} onOpenChange={setShowConsolidadoModal} codigoLote={loteConsolidado} />}

      {/* MODAL TRAZABILIDAD */}
      <Dialog open={showTrazabilidad} onOpenChange={setShowTrazabilidad}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Trazabilidad — {trazabilidadData?.codigoEnProceso}</DialogTitle></DialogHeader>
          {trazabilidadData && (
            <div className="space-y-3 text-sm">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Hojas desde Curtido:</span>
                  <span className="font-bold text-blue-700">{trazabilidadData.totalCurtido} hojas</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Ya Recurtidas:</span>
                  <span className="font-bold text-orange-600">− {trazabilidadData.totalRecurtido} hojas</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Stock Disponible:</span>
                  <span className={`font-bold text-lg ${trazabilidadData.stock > 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {trazabilidadData.stock} hojas
                  </span>
                </div>
              </div>
              {trazabilidadData.stock === 0 && (
                <p className="text-xs text-red-600 font-medium text-center">⚠️ Este lote ya fue completamente recurtido.</p>
              )}
            </div>
          )}
          <div className="flex justify-end pt-2"><Button onClick={() => setShowTrazabilidad(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}