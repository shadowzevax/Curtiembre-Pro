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
import { Plus, Edit, Trash2, Eye, X, Table, CheckCircle2, Circle, AlertCircle } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function ProcesoLimpieza() {
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, productosData, invEnProceso] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'limpieza' }),
        Insumo.list(),
        ProductoTerminado.list(),
        InventarioEnProceso.list()
      ]);
      setProcesos(Array.isArray(procesosData) ? procesosData : []);
      setInsumos(Array.isArray(insumosData) ? insumosData : []);
      setProductos(Array.isArray(productosData) ? productosData : []);
      // FILTRO: lotes EN_PROCESO en etapa recepcion O limpieza (para continuar pelambre)
      const filtrados = (Array.isArray(invEnProceso) ? invEnProceso : [])
        .filter(i => i.estado_actual === 'EN_PROCESO' && (i.etapa_actual === 'recepcion' || i.etapa_actual === 'limpieza'));
      setInventarioEnProceso(filtrados);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const defaultItem = () => ({
    tipo_proceso: 'limpieza',
    codigo_lote: '',
    inv_proceso_id: '',
    cantidad_pieles: 0,
    seccion: 'remojo',
    fecha_inicio: new Date().toISOString().split('T')[0],
    fecha_fin: '',
    peso_actual: 0,
    peso_promedio: 0,
    costo_remojo: 0,
    costo_pelambre: 0,
    observaciones: '',
    insumos_utilizados: [],
    estado: 'pendiente',
    // Estados independientes por subproceso
    estado_remojo: 'pendiente',    // 'pendiente' | 'finalizado'
    estado_pelambre: 'pendiente',  // 'pendiente' | 'finalizado'
    finalizar_limpieza: false,
  });

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    setCurrentItem(item ? {
      ...defaultItem(),
      ...item,
      estado_remojo: item.estado_remojo || (item.finalizar_remojo ? 'finalizado' : 'pendiente'),
      estado_pelambre: item.estado_pelambre || (item.finalizar_pelambre ? 'finalizado' : 'pendiente'),
    } : defaultItem());
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
        cantidad: 0, costo_unitario: 0, iva: 0.19, valor_total: 0,
        seccion: prev.seccion
      }]
    }));
  };

  const removeInsumo = (index) => {
    const updated = currentItem.insumos_utilizados.filter((_, i) => i !== index);
    setCurrentItem(prev => ({ ...prev, insumos_utilizados: updated }));
    recalculateAllCosts(updated);
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
    recalculateAllCosts(updated);
  };

  const recalculateAllCosts = (ins) => {
    const costoRemojo = ins.filter(i => i.seccion === 'remojo').reduce((sum, i) => sum + (i.valor_total || 0), 0);
    const costoPelambre = ins.filter(i => i.seccion === 'pelambre').reduce((sum, i) => sum + (i.valor_total || 0), 0);
    setCurrentItem(prev => ({ ...prev, costo_remojo: costoRemojo, costo_pelambre: costoPelambre }));
  };

  const handlePesoActualChange = (newPeso) => {
    setCurrentItem(prev => {
      const pesoActual = parseFloat(newPeso) || 0;
      const cantidadPieles = parseFloat(prev.cantidad_pieles) || 0;
      const pesoPromedio = cantidadPieles > 0 ? pesoActual / cantidadPieles : 0;
      const updatedInsumos = (prev.insumos_utilizados || []).map(item => {
        const dosificacion = parseFloat(item.dosificacion) || 0;
        const cantidad = (pesoActual * dosificacion) / 100;
        const costoUnitario = parseFloat(item.costo_unitario) || 0;
        const iva = parseFloat(item.iva) || 0;
        const subtotal = cantidad * costoUnitario;
        return { ...item, cantidad, valor_total: subtotal + (subtotal * iva) };
      });
      const costoRemojo = updatedInsumos.filter(i => i.seccion === 'remojo').reduce((sum, i) => sum + (i.valor_total || 0), 0);
      const costoPelambre = updatedInsumos.filter(i => i.seccion === 'pelambre').reduce((sum, i) => sum + (i.valor_total || 0), 0);
      return { ...prev, peso_actual: pesoActual, peso_promedio: pesoPromedio, insumos_utilizados: updatedInsumos, costo_remojo: costoRemojo, costo_pelambre: costoPelambre };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!currentItem.inv_proceso_id && !isEditing) {
      alert('⚠️ Debe seleccionar un "Código en Proceso" de la tabla central.');
      return;
    }

    const remojoDone = currentItem.estado_remojo === 'finalizado';
    const pelhambreDone = currentItem.estado_pelambre === 'finalizado';
    const finalizandoLimpieza = currentItem.finalizar_limpieza && remojoDone && pelhambreDone;

    // Validación: Pelambre solo puede finalizarse si Remojo ya está finalizado
    if (currentItem.estado_pelambre === 'finalizado' && !remojoDone) {
      alert('⚠️ Debe finalizar primero el subproceso de Remojo antes de finalizar Pelambre.');
      return;
    }

    const dataToSave = {
      ...currentItem,
      numero_proceso: `${currentItem.codigo_lote}-LMP`,
      // El proceso de limpieza solo se marca completado cuando se finaliza limpieza completa
      estado: finalizandoLimpieza ? 'completado' : 'en_proceso',
      fecha_fin: finalizandoLimpieza && !currentItem.fecha_fin ? new Date().toISOString().split('T')[0] : currentItem.fecha_fin,
      // Guardar estados individuales
      estado_remojo: currentItem.estado_remojo,
      estado_pelambre: currentItem.estado_pelambre,
      // Compatibilidad hacia atrás
      finalizar_remojo: remojoDone,
      finalizar_pelambre: pelhambreDone,
    };

    try {
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
                referencia: `LIMPIEZA-${dataToSave.codigo_lote}-${dataToSave.seccion}`,
                observaciones: `Consumo limpieza (${dataToSave.seccion}) - Lote ${dataToSave.codigo_lote}`,
                usuario_id: 'system'
              });
              const movimientos = await MovimientoInventario.filter({ insumo_id: insumo.insumo_id });
              const nuevoStock = (Array.isArray(movimientos) ? movimientos : []).reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
              await Insumo.update(insumo.insumo_id, { stock_actual: nuevoStock });
            }
          }
        }
      }

      // ACTUALIZAR TABLA CENTRAL:
      // - Al finalizar Remojo: mantener etapa en 'limpieza', estado EN_PROCESO
      // - Al finalizar Limpieza completa: avanzar a 'limpieza' con estado piel_limpia (listo para curtido)
      if (currentItem.inv_proceso_id) {
        const costoProceso = (dataToSave.costo_remojo || 0) + (dataToSave.costo_pelambre || 0);
        const invActual = inventarioEnProceso.find(i => i.id === currentItem.inv_proceso_id);

        if (finalizandoLimpieza) {
          // Limpieza completa: avanzar etapa → listo para curtido
          await InventarioEnProceso.update(currentItem.inv_proceso_id, {
            etapa_actual: 'limpieza',
            estado_actual: 'EN_PROCESO',
            estado_proceso: 'piel_limpia',
            peso_actual: dataToSave.peso_actual || (invActual?.peso_actual || 0),
            costo_acumulado: (invActual?.costo_acumulado || 0) + costoProceso
          });
          console.log(`✅ Limpieza COMPLETA. Tabla central: etapa → limpieza (piel_limpia)`);
        } else if (remojoDone) {
          // Solo remojo finalizado: mantener en limpieza pero en_proceso
          await InventarioEnProceso.update(currentItem.inv_proceso_id, {
            etapa_actual: 'limpieza',
            estado_actual: 'EN_PROCESO',
            estado_proceso: 'piel_limpia',
            peso_actual: dataToSave.peso_actual || (invActual?.peso_actual || 0),
            costo_acumulado: (invActual?.costo_acumulado || 0) + (dataToSave.costo_remojo || 0)
          });
          console.log(`✅ Remojo finalizado. Tabla central: etapa → limpieza (en proceso)`);
        }
      }

      setShowModal(false);
      setCurrentItem(null);
      await loadData();

      const msg = finalizandoLimpieza
        ? '✅ Limpieza finalizada completamente. El lote puede avanzar a Curtido.'
        : remojoDone && !pelhambreDone
          ? '✅ Remojo finalizado. Puede continuar con Pelambre en el mismo lote.'
          : 'Proceso de limpieza guardado con éxito.';
      alert(msg);
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

  // Estado visual de cada subproceso
  const remojoDone = currentItem?.estado_remojo === 'finalizado';
  const pelhambreDone = currentItem?.estado_pelambre === 'finalizado';
  const puedeFinalizarLimpieza = remojoDone && pelhambreDone;

  const headers = ['Lote', 'Estado Remojo', 'Estado Pelambre', 'Fecha Inicio', 'Peso Actual', 'Costo Remojo', 'Costo Pelambre', 'Estado', 'Acciones'];
  const renderRow = (item) => {
    const estadoR = item.estado_remojo || (item.finalizar_remojo ? 'finalizado' : 'pendiente');
    const estadoP = item.estado_pelambre || (item.finalizar_pelambre ? 'finalizado' : 'pendiente');
    return (
      <tr key={item.id}>
        <td className="font-mono font-bold">{item.codigo_lote}</td>
        <td>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${estadoR === 'finalizado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {estadoR === 'finalizado' ? '✔ Finalizado' : 'Pendiente'}
          </span>
        </td>
        <td>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${estadoP === 'finalizado' ? 'bg-green-100 text-green-700' : estadoR === 'finalizado' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
            {estadoP === 'finalizado' ? '✔ Finalizado' : estadoR === 'finalizado' ? 'Disponible' : 'Bloqueado'}
          </span>
        </td>
        <td>{new Date(item.fecha_inicio).toLocaleDateString()}</td>
        <td>{item.peso_actual} kg</td>
        <td className="text-right">{formatCurrency(item.costo_remojo)}</td>
        <td className="text-right">{formatCurrency(item.costo_pelambre)}</td>
        <td>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${item.estado === 'completado' ? 'bg-emerald-100 text-emerald-700' : item.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {item.estado === 'completado' ? 'Limpieza Completa' : item.estado === 'en_proceso' ? 'En Proceso' : item.estado}
          </span>
        </td>
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
  };

  const invFiltrados = inventarioEnProceso.filter(inv => {
    if (!searchEnProceso) return true;
    const s = searchEnProceso.toLowerCase();
    return (inv.codigo_lote || '').toLowerCase().includes(s) || (inv.descripcion || '').toLowerCase().includes(s) || (inv.codigo || '').toLowerCase().includes(s);
  });

  return (
    <div className="p-6">
      <PageHeader title="Proceso de Limpieza" description="Remojo y Pelambre. Gestione ambos subprocesos en una misma pantalla por lote."
        onPrint={() => window.print()}
        actionButton={<Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" />Nueva Limpieza</Button>}
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Procesos de Limpieza</CardTitle></CardHeader>
        <CardContent>{loading ? <p>Cargando...</p> : <DataTable headers={headers} data={procesos} renderRow={renderRow} />}</CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Proceso de Limpieza</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">

            {/* SELECTOR CÓDIGO EN PROCESO — siempre visible */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Label className="font-bold text-blue-800">
                Código en Proceso * <span className="font-normal text-xs">(permanece activo durante todo el proceso de Limpieza)</span>
              </Label>
              <Input placeholder="Buscar por código lote o descripción..." value={searchEnProceso} onChange={e => setSearchEnProceso(e.target.value)} className="my-1 h-8 text-xs" />
              <Select value={currentItem?.inv_proceso_id || ''} onValueChange={handleSelectInvProceso}>
                <SelectTrigger><SelectValue placeholder="Seleccionar lote/sublote en proceso..." /></SelectTrigger>
                <SelectContent>
                  {invFiltrados.length === 0 && <SelectItem value="__empty__" disabled>No hay lotes disponibles</SelectItem>}
                  {invFiltrados.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.codigo_lote} — {inv.descripcion} ({inv.cantidad_hojas || 0} hojas) [{inv.etapa_actual?.toUpperCase()}]
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
              {currentItem?.codigo_lote && (
                <p className="text-xs text-blue-700 mt-1 font-medium">
                  ✔ Lote asignado: <strong>{currentItem.codigo_lote}</strong> — este código permanece activo hasta "Finalizar Limpieza"
                </p>
              )}
            </div>

            {/* INDICADOR DE PROGRESO DE SUBPROCESOS */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 border rounded-lg">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${remojoDone ? 'bg-green-100 border-green-300 text-green-700' : 'bg-yellow-50 border-yellow-300 text-yellow-700'}`}>
                {remojoDone ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                Remojo: {remojoDone ? 'Finalizado' : 'Pendiente'}
              </div>
              <span className="text-slate-400">→</span>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${pelhambreDone ? 'bg-green-100 border-green-300 text-green-700' : remojoDone ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                {pelhambreDone ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                Pelambre: {pelhambreDone ? 'Finalizado' : remojoDone ? 'Disponible' : 'Bloqueado'}
              </div>
              <span className="text-slate-400">→</span>
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${puedeFinalizarLimpieza ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-gray-100 border-gray-200 text-gray-400'}`}>
                {puedeFinalizarLimpieza ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                Limpieza Completa
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div><Label>Cantidad Hojas</Label><Input type="number" value={currentItem?.cantidad_pieles || ''} onChange={e => {
                const val = parseInt(e.target.value) || 0;
                const peso = parseFloat(currentItem.peso_actual) || 0;
                setCurrentItem({...currentItem, cantidad_pieles: val, peso_promedio: val > 0 ? peso / val : 0});
              }} /></div>
              <div>
                <Label>Sección activa *</Label>
                <Select
                  value={currentItem?.seccion || 'remojo'}
                  onValueChange={v => {
                    // Solo permitir cambiar a pelambre si remojo está finalizado
                    if (v === 'pelambre' && !remojoDone) {
                      alert('⚠️ Debe finalizar primero el subproceso de Remojo para acceder a Pelambre.');
                      return;
                    }
                    setCurrentItem({...currentItem, seccion: v});
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="remojo">Remojo</SelectItem>
                    <SelectItem value="pelambre" disabled={!remojoDone}>
                      Pelambre {!remojoDone ? '(requiere Remojo finalizado)' : ''}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Fecha Inicio</Label><Input type="date" value={currentItem?.fecha_inicio || ''} onChange={e => setCurrentItem({...currentItem, fecha_inicio: e.target.value})} /></div>
              <div><Label>Fecha Fin</Label><Input type="date" value={currentItem?.fecha_fin || ''} onChange={e => setCurrentItem({...currentItem, fecha_fin: e.target.value})} /></div>
              <div><Label>Peso Actual (kg)</Label><Input type="text" inputMode="decimal" value={currentItem?.peso_actual || ''} onChange={e => handlePesoActualChange(e.target.value.replace(/[^0-9.]/g, ''))} /></div>
              <div><Label>Peso Promedio (kg/piel)</Label><Input type="number" step="0.01" value={currentItem?.peso_promedio || ''} readOnly className="bg-blue-50 font-medium" /></div>
            </div>

            {/* ÍTEMS */}
            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">
                  Ítems / Productos — Sección: <span className="capitalize text-blue-700">{currentItem?.seccion || 'remojo'}</span>
                </h3>
                <Button type="button" onClick={addInsumo} size="sm"><Plus className="w-4 h-4 mr-2" />Agregar Item</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Código</th><th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-right">% Dosif.</th><th className="p-2 text-right">Cantidad (kg)</th>
                      <th className="p-2 text-right">Costo Unit.</th><th className="p-2 text-right">IVA</th>
                      <th className="p-2 text-right">Valor Total</th><th className="p-2 text-center">Secc.</th><th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(currentItem?.insumos_utilizados || []).map((item, index) => (
                      <tr key={index} className={`border-t ${item.seccion === 'pelambre' ? 'bg-purple-50' : ''}`}>
                        <td className="p-2">
                          <Select value={item.insumo_id} onValueChange={v => handleInsumoChange(index, 'insumo_id', v)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                              {todosLosItems.map(ins => <SelectItem key={ins.id} value={ins.id}>{ins.codigo || ins.referencia} - {ins.nombre || ins.descripcion}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2"><Input value={item.producto} readOnly className="bg-gray-50" /></td>
                        <td className="p-2"><Input type="text" inputMode="decimal" value={item.dosificacion} onChange={e => handleInsumoChange(index, 'dosificacion', e.target.value.replace(/[^0-9.]/g, ''))} className="text-right" /></td>
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
                        <td className="p-2 text-center">
                          <span className={`text-xs px-1 py-0.5 rounded ${item.seccion === 'pelambre' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {item.seccion}
                          </span>
                        </td>
                        <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => removeInsumo(index)}><X className="w-4 h-4 text-red-500" /></Button></td>
                      </tr>
                    ))}
                    {(currentItem?.insumos_utilizados || []).length === 0 && (
                      <tr><td colSpan={9} className="p-4 text-center text-slate-400 text-sm">No hay ítems. Haga clic en "Agregar Item".</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABLA DESGLOSE DE COSTOS POR SECCIÓN */}
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-700 text-white px-4 py-2 font-bold text-sm">Resumen de Costos por Sección</div>
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-2 text-left border-b">Sección</th>
                    <th className="p-2 text-right border-b">Costo Base (sin IVA)</th>
                    <th className="p-2 text-right border-b">IVA</th>
                    <th className="p-2 text-right border-b font-bold">Costo Total</th>
                  </tr>
                </thead>
                <tbody>
                  {['remojo', 'pelambre'].map(seccion => {
                    const items = (currentItem?.insumos_utilizados || []).filter(i => i.seccion === seccion);
                    const costoBase = items.reduce((sum, i) => sum + ((parseFloat(i.cantidad) || 0) * (parseFloat(i.costo_unitario) || 0)), 0);
                    const ivaTotal = items.reduce((sum, i) => sum + ((parseFloat(i.cantidad) || 0) * (parseFloat(i.costo_unitario) || 0) * (parseFloat(i.iva) || 0)), 0);
                    const costoTotal = costoBase + ivaTotal;
                    return (
                      <tr key={seccion} className="border-t">
                        <td className="p-2 font-semibold capitalize">{seccion}</td>
                        <td className="p-2 text-right text-slate-700">{formatCurrency(costoBase)}</td>
                        <td className="p-2 text-right text-orange-600">{formatCurrency(ivaTotal)}</td>
                        <td className="p-2 text-right font-bold text-emerald-700">{formatCurrency(costoTotal)}</td>
                      </tr>
                    );
                  })}
                  {(() => {
                    const allItems = currentItem?.insumos_utilizados || [];
                    const baseTotal = allItems.reduce((sum, i) => sum + ((parseFloat(i.cantidad)||0) * (parseFloat(i.costo_unitario)||0)), 0);
                    const ivaGlobal = allItems.reduce((sum, i) => sum + ((parseFloat(i.cantidad)||0) * (parseFloat(i.costo_unitario)||0) * (parseFloat(i.iva)||0)), 0);
                    return (
                      <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                        <td className="p-2 text-slate-800">TOTAL LIMPIEZA</td>
                        <td className="p-2 text-right text-slate-800">{formatCurrency(baseTotal)}</td>
                        <td className="p-2 text-right text-orange-700">{formatCurrency(ivaGlobal)}</td>
                        <td className="p-2 text-right text-emerald-800 text-base">{formatCurrency(baseTotal + ivaGlobal)}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>

            {/* PANEL DE CONTROL DE ESTADOS */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
              <h3 className="font-bold text-blue-800 text-sm">Control de Subprocesos</h3>

              {/* Finalizar Remojo */}
              <div className={`flex items-center justify-between p-3 rounded-lg border ${remojoDone ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="finalizar_remojo"
                    checked={remojoDone}
                    onCheckedChange={v => setCurrentItem({...currentItem, estado_remojo: v ? 'finalizado' : 'pendiente'})}
                    disabled={remojoDone} // no se puede des-finalizar
                  />
                  <div>
                    <Label htmlFor="finalizar_remojo" className={`font-semibold cursor-pointer ${remojoDone ? 'text-green-700' : ''}`}>
                      Finalizar Remojo
                    </Label>
                    <p className="text-xs text-slate-500">Solo marca Remojo como finalizado. El proceso de limpieza continúa activo.</p>
                  </div>
                </div>
                {remojoDone && <span className="text-green-600 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Finalizado</span>}
              </div>

              {/* Finalizar Pelambre — solo habilitado si Remojo está finalizado */}
              <div className={`flex items-center justify-between p-3 rounded-lg border ${pelhambreDone ? 'bg-green-50 border-green-200' : remojoDone ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="finalizar_pelambre"
                    checked={pelhambreDone}
                    disabled={!remojoDone || pelhambreDone}
                    onCheckedChange={v => setCurrentItem({...currentItem, estado_pelambre: v ? 'finalizado' : 'pendiente'})}
                  />
                  <div>
                    <Label htmlFor="finalizar_pelambre" className={`font-semibold ${pelhambreDone ? 'text-green-700' : !remojoDone ? 'text-gray-400' : 'cursor-pointer'}`}>
                      Finalizar Pelambre
                    </Label>
                    <p className="text-xs text-slate-500">
                      {!remojoDone ? '🔒 Requiere que Remojo esté finalizado primero.' : 'Solo marca Pelambre como finalizado. El proceso continúa activo.'}
                    </p>
                  </div>
                </div>
                {pelhambreDone && <span className="text-green-600 text-xs font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" />Finalizado</span>}
              </div>

              {/* Finalizar Limpieza — solo habilitado si AMBOS están finalizados */}
              <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${puedeFinalizarLimpieza ? 'bg-emerald-50 border-emerald-300' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="finalizar_limpieza"
                    checked={currentItem?.finalizar_limpieza || false}
                    disabled={!puedeFinalizarLimpieza}
                    onCheckedChange={v => setCurrentItem({...currentItem, finalizar_limpieza: v})}
                  />
                  <div>
                    <Label htmlFor="finalizar_limpieza" className={`font-bold text-base ${puedeFinalizarLimpieza ? 'text-emerald-700 cursor-pointer' : 'text-gray-400'}`}>
                      ✅ Finalizar Limpieza (Completa)
                    </Label>
                    <p className="text-xs text-slate-500">
                      {puedeFinalizarLimpieza
                        ? '🟢 Ambos subprocesos finalizados. Al guardar, el lote avanzará a Curtido.'
                        : '🔒 Requiere Remojo Y Pelambre finalizados.'}
                    </p>
                  </div>
                </div>
                {currentItem?.finalizar_limpieza && <span className="text-emerald-600 text-xs font-bold">→ Avanza a Curtido</span>}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" className={currentItem?.finalizar_limpieza ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                {currentItem?.finalizar_limpieza ? '✅ Finalizar Limpieza y Guardar' : 'Guardar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle del Proceso de Limpieza</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Código Lote:</span> {selectedItem.codigo_lote}</p>
              <p><span className="font-semibold">Cantidad Hojas:</span> {selectedItem.cantidad_pieles}</p>
              <p><span className="font-semibold">Fecha Inicio:</span> {new Date(selectedItem.fecha_inicio).toLocaleDateString()}</p>
              {selectedItem.fecha_fin && <p><span className="font-semibold">Fecha Fin:</span> {new Date(selectedItem.fecha_fin).toLocaleDateString()}</p>}
              <p><span className="font-semibold">Peso Actual:</span> {selectedItem.peso_actual} kg</p>
              <div className="grid grid-cols-2 gap-2 p-2 bg-gray-50 rounded">
                <p><span className="font-semibold">Estado Remojo:</span> <span className={selectedItem.estado_remojo === 'finalizado' ? 'text-green-700 font-bold' : 'text-yellow-700'}>{selectedItem.estado_remojo || 'pendiente'}</span></p>
                <p><span className="font-semibold">Estado Pelambre:</span> <span className={selectedItem.estado_pelambre === 'finalizado' ? 'text-green-700 font-bold' : 'text-yellow-700'}>{selectedItem.estado_pelambre || 'pendiente'}</span></p>
              </div>
              <p><span className="font-semibold">Costo Remojo:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.costo_remojo)}</span></p>
              <p><span className="font-semibold">Costo Pelambre:</span> <span className="text-emerald-700 font-bold">{formatCurrency(selectedItem.costo_pelambre)}</span></p>
              <p><span className="font-semibold">Estado General:</span> <span className="capitalize font-bold">{selectedItem.estado === 'completado' ? '✅ Limpieza Completa' : selectedItem.estado}</span></p>
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && <LoteDetalleConsolidado open={showConsolidadoModal} onOpenChange={setShowConsolidadoModal} codigoLote={loteConsolidado} />}
    </div>
  );
}