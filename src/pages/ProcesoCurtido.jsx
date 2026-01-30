import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, ProductoTerminado, MovimientoInventario } from '@/entities/all';
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

export default function ProcesoCurtido() {
  const [procesos, setProcesos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [lotesEnProceso, setLotesEnProceso] = useState([]);
  const [sublotesDisponibles, setSublotesDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [loteConsolidado, setLoteConsolidado] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, productosData, todosLosProcesos] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'curtido' }),
        Insumo.list(),
        ProductoTerminado.list(),
        ProcesoProduccion.list()
      ]);
      
      // Filtrar solo los lotes que NO están completados
      const lotesActivos = todosLosProcesos.filter(p => p.estado !== 'completado' && p.tipo_proceso === 'recepcion');
      setLotesEnProceso(lotesActivos);
      
      setProcesos(procesosData);
      setInsumos(insumosData);
      setProductos(productosData);
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
      codigo_sublote: '',
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
    // Reset sublotes when opening modal or changing item
    setSublotesDisponibles([]); 
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleLoteChange = (codigoLote) => {
    // Buscar el lote seleccionado
    const loteSeleccionado = lotesEnProceso.find(l => l.codigo_lote === codigoLote);
    
    if (loteSeleccionado && loteSeleccionado.dividir_lote && loteSeleccionado.sublotes && loteSeleccionado.sublotes.length > 0) {
      // Filtrar sublotes que NO estén completados
      const procesoRecepcionLote = procesos.find(p => p.codigo_lote === loteSeleccionado.codigo_lote && p.tipo_proceso === 'recepcion');
      const sublotesActivos = loteSeleccionado.sublotes.filter(s => {
        // Find if this specific sublote from the selected RECEPCION process is completed in THIS CURTIDO process
        const procesoSubloteCurtido = procesos.find(p => 
          p.codigo_lote === codigoLote && 
          p.codigo_sublote === s.codigo && 
          p.tipo_proceso === 'curtido' && 
          p.estado === 'completado'
        );
        return !procesoSubloteCurtido;
      });
      setSublotesDisponibles(sublotesActivos);
    } else {
      setSublotesDisponibles([]);
    }
    
    setCurrentItem(prev => ({ 
      ...prev, 
      codigo_lote: codigoLote,
      codigo_sublote: '' // Reset sublote when lote changes
    }));
  };

  const handleSubloteChange = (codigoSublote) => {
    // Buscar la cantidad de pieles del sublote seleccionado
    const subloteSeleccionado = sublotesDisponibles.find(s => s.codigo === codigoSublote);
    
    setCurrentItem(prev => ({ 
      ...prev, 
      codigo_sublote: codigoSublote,
      cantidad_pieles: subloteSeleccionado ? subloteSeleccionado.cantidad : 0
    }));
  };

  const addInsumo = () => {
    setCurrentItem(prev => ({
      ...prev,
      insumos_utilizados: [...(prev.insumos_utilizados || []), {
        insumo_id: '',
        codigo: '',
        producto: '',
        dosificacion: 0,
        cantidad: 0,
        costo_unitario: 0,
        iva: 0.19,
        valor_total: 0
      }]
    }));
  };

  const removeInsumo = (index) => {
    const updated = currentItem.insumos_utilizados.filter((_, i) => i !== index);
    setCurrentItem(prev => ({
      ...prev,
      insumos_utilizados: updated
    }));
    calculateTotal(updated);
  };

  const handleInsumoChange = (index, field, value) => {
    const updated = [...currentItem.insumos_utilizados];
    updated[index][field] = value;
    
    // Si cambia el código (insumo_id), traer automáticamente el producto y costo
    if (field === 'insumo_id') {
      const item = [...insumos, ...productos].find(i => i.id === value);
      if (item) {
        updated[index].codigo = item.codigo || item.referencia || '';
        updated[index].producto = item.nombre || item.descripcion || '';
        updated[index].costo_unitario = item.costo_promedio || 0;
      }
    }
    
    // Si cambia el % dosificación, recalcular cantidad automáticamente
    if (field === 'dosificacion') {
      const dosificacion = parseFloat(value) || 0;
      const pesoActual = parseFloat(currentItem.peso_actual) || 0;
      updated[index].cantidad = (pesoActual * dosificacion) / 100;
    }
    
    // Recalculate if cost unit is changed manually
    if (field === 'costo_unitario') {
      updated[index].costo_unitario = parseFloat(value) || 0;
    }

    // Calcular valor total = costo_unitario * cantidad + IVA
    const cantidad = parseFloat(updated[index].cantidad) || 0;
    const costoUnitario = parseFloat(updated[index].costo_unitario) || 0;
    const iva = parseFloat(updated[index].iva) || 0;
    const subtotal = cantidad * costoUnitario;
    updated[index].valor_total = subtotal + (subtotal * iva);
    
    setCurrentItem(prev => ({ ...prev, insumos_utilizados: updated }));
    calculateTotal(updated);
  };

  const calculateTotal = (insumos) => {
    const total = insumos.reduce((sum, item) => sum + (item.valor_total || 0), 0);
    setCurrentItem(prev => ({ ...prev, costo_total_curtido: total }));
  };

  // Recalcular cantidades si cambia el peso actual
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
        const valorTotal = subtotal + (subtotal * iva);
        return { ...item, cantidad, valor_total: valorTotal };
      });
      
      const total = updatedInsumos.reduce((sum, item) => sum + (item.valor_total || 0), 0);
      
      return {
        ...prev,
        peso_actual: pesoActual,
        peso_promedio: pesoPromedio,
        insumos_utilizados: updatedInsumos,
        costo_total_curtido: total
      };
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...currentItem,
        numero_proceso: `${currentItem.codigo_lote}-CRT`,
        estado: currentItem.finalizar_curtido ? 'completado' : 'pendiente',
        // If finishing, set fecha_fin if not already set
        fecha_fin: currentItem.finalizar_curtido && !currentItem.fecha_fin 
          ? new Date().toISOString().split('T')[0] 
          : currentItem.fecha_fin
      };

      let procesoId;
      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
        procesoId = currentItem.id;
      } else {
        const created = await ProcesoProduccion.create(dataToSave);
        procesoId = created.id;
      }
      
      // AFECTAR INVENTARIO DE INSUMOS Y QUÍMICOS (descontar insumos utilizados)
      if (!isEditing && dataToSave.insumos_utilizados && dataToSave.insumos_utilizados.length > 0) {
        for (const insumo of dataToSave.insumos_utilizados) {
          if (insumo.insumo_id && insumo.cantidad > 0) {
            // Buscar el insumo por ID
            const insumoData = insumos.find(i => i.id === insumo.insumo_id);
            
            if (insumoData) {
              // Crear movimiento de salida (negativo)
              await MovimientoInventario.create({
                tipo_movimiento: 'salida',
                insumo_id: insumo.insumo_id,
                cantidad: -(insumo.cantidad),
                costo_unitario: insumoData.costo_promedio || 0,
                fecha_movimiento: dataToSave.fecha_inicio,
                referencia: `CURTIDO-${dataToSave.codigo_lote}`,
                observaciones: `Consumo en proceso de curtido - Lote ${dataToSave.codigo_lote}`,
                usuario_id: 'system'
              });
              
              // Actualizar stock en Insumo
              const movimientos = await MovimientoInventario.filter({ insumo_id: insumo.insumo_id });
              const nuevoStock = movimientos.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0) - insumo.cantidad;
              
              await Insumo.update(insumo.insumo_id, {
                stock_actual: nuevoStock
              });
              
              console.log(`✅ Inventario actualizado: -${insumo.cantidad} kg de ${insumo.producto}`);
            }
          }
        }
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
    try {
      await ProcesoProduccion.delete(id);
      loadData();
      alert('Proceso eliminado.');
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleExport = () => alert('Función de exportar en desarrollo.');
  const handlePrint = () => window.print();

  // Combinar insumos y productos para el selector
  const todosLosItems = [
    ...insumos.map(i => ({ ...i, tipo: 'insumo' })),
    ...productos.map(p => ({ ...p, tipo: 'producto' }))
  ];

  const headers = ['Lote', 'Sublote', 'Cantidad Pieles', 'Fecha Inicio', 'Peso Actual', 'Costo Total', 'Estado', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td>{item.codigo_lote}</td>
      <td>{item.codigo_sublote || 'N/A'}</td>
      <td>{item.cantidad_pieles}</td>
      <td>{new Date(item.fecha_inicio).toLocaleDateString()}</td>
      <td>{item.peso_actual} kg</td>
      <td className="text-right">{formatCurrency(item.costo_total_curtido)}</td>
      <td><span className="capitalize">{item.estado}</span></td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => { setLoteConsolidado(item.codigo_lote); setShowConsolidadoModal(true); }} title="Ver Consolidado"><Table className="w-4 h-4 text-emerald-600" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)}><Eye className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Proceso de Curtido"
        description="Gestiona las etapas del proceso de curtido."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Curtido
          </Button>
        }
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Procesos de Curtido</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={procesos} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Proceso de Curtido</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Código Lote *</Label>
                <Select value={currentItem?.codigo_lote || ''} onValueChange={handleLoteChange}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lote en proceso" /></SelectTrigger>
                  <SelectContent>
                    {lotesEnProceso.map(lote => (
                      <SelectItem key={lote.id} value={lote.codigo_lote}>
                        {lote.codigo_lote} ({lote.estado})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código Sublote (opcional)</Label>
                <Select value={currentItem?.codigo_sublote || ''} onValueChange={handleSubloteChange} disabled={sublotesDisponibles.length === 0}>
                  <SelectTrigger><SelectValue placeholder={sublotesDisponibles.length === 0 ? "Sin sublotes disponibles" : "Seleccionar sublote"} /></SelectTrigger>
                  <SelectContent>
                    {sublotesDisponibles.map((sub, idx) => (
                      <SelectItem key={idx} value={sub.codigo}>
                        {sub.codigo} (Cant: {sub.cantidad})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad Pieles</Label>
                <Input 
                  type="number" 
                  value={currentItem?.cantidad_pieles || ''} 
                  onChange={e => {
                    const cant = parseFloat(e.target.value) || 0;
                    const peso = parseFloat(currentItem.peso_actual) || 0;
                    const prom = cant > 0 ? peso / cant : 0;
                    setCurrentItem({...currentItem, cantidad_pieles: cant, peso_promedio: prom});
                  }} 
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Fecha Inicial</Label><Input type="date" value={currentItem?.fecha_inicio || ''} onChange={e => setCurrentItem({...currentItem, fecha_inicio: e.target.value})} /></div>
              <div><Label>Fecha Fin</Label><Input type="date" value={currentItem?.fecha_fin || ''} onChange={e => setCurrentItem({...currentItem, fecha_fin: e.target.value})} /></div>
              <div><Label>Peso Actual (kg)</Label><Input type="number" step="0.01" value={currentItem?.peso_actual || ''} onChange={e => handlePesoActualChange(e.target.value)} /></div>
              <div><Label>Peso Promedio/Piel (kg)</Label><Input type="number" step="0.01" value={currentItem?.peso_promedio || ''} onChange={e => setCurrentItem({...currentItem, peso_promedio: parseFloat(e.target.value) || 0})} /></div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">Ítems / Productos</h3>
                <Button type="button" onClick={addInsumo} size="sm"><Plus className="w-4 h-4 mr-2" />Agregar Item</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-right">% Dosificación</th>
                      <th className="p-2 text-right">Cantidad (kg)</th>
                      <th className="p-2 text-right">Costo Unit. ($/kg)</th>
                      <th className="p-2 text-right">IVA</th>
                      <th className="p-2 text-right">Valor Total</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(currentItem?.insumos_utilizados || []).map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">
                          <Select value={item.insumo_id} onValueChange={v => handleInsumoChange(index, 'insumo_id', v)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                              {todosLosItems.map(ins => (
                                <SelectItem key={ins.id} value={ins.id}>
                                  {ins.codigo || ins.referencia} - {ins.nombre || ins.descripcion}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2"><Input value={item.producto} readOnly className="bg-gray-50" /></td>
                        <td className="p-2"><Input type="number" step="0.01" value={item.dosificacion} onChange={e => handleInsumoChange(index, 'dosificacion', e.target.value)} className="text-right" placeholder="%" /></td>
                        <td className="p-2"><Input type="number" step="0.01" value={item.cantidad} readOnly className="text-right bg-blue-50 font-medium" title="Auto-calculado: Peso Actual * % Dosificación" /></td>
                        <td className="p-2"><Input type="number" step="0.01" value={item.costo_unitario} onChange={e => handleInsumoChange(index, 'costo_unitario', e.target.value)} className="text-right" /></td>
                        <td className="p-2">
                          <Select value={String(item.iva)} onValueChange={v => handleInsumoChange(index, 'iva', parseFloat(v))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0.19">19%</SelectItem>
                              <SelectItem value="0.05">5%</SelectItem>
                              <SelectItem value="0">0%</SelectItem>
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
              <div className="mt-2 p-3 bg-white rounded border font-bold text-xl text-emerald-700">
                {formatCurrency(currentItem?.costo_total_curtido || 0)}
              </div>
            </div>

            <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={3} /></div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="finalizar_curtido" 
                  checked={currentItem?.finalizar_curtido || false} 
                  onCheckedChange={v => setCurrentItem({...currentItem, finalizar_curtido: v})} 
                />
                <Label htmlFor="finalizar_curtido" className="font-semibold cursor-pointer">Finalizar Curtido</Label>
              </div>
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
              <p><span className="font-semibold">Código Sublote:</span> {selectedItem.codigo_sublote || 'N/A'}</p>
              <p><span className="font-semibold">Cantidad Pieles:</span> {selectedItem.cantidad_pieles}</p>
              <p><span className="font-semibold">Fecha Inicio:</span> {new Date(selectedItem.fecha_inicio).toLocaleDateString()}</p>
              {selectedItem.fecha_fin && <p><span className="font-semibold">Fecha Fin:</span> {new Date(selectedItem.fecha_fin).toLocaleDateString()}</p>}
              <p><span className="font-semibold">Peso Actual:</span> {selectedItem.peso_actual} kg</p>
              <p><span className="font-semibold">Peso Promedio:</span> {selectedItem.peso_promedio} kg</p>
              <p><span className="font-semibold">Costo Total:</span> <span className="text-emerald-700 font-bold text-lg">{formatCurrency(selectedItem.costo_total_curtido)}</span></p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize">{selectedItem.estado}</span></p>
              {selectedItem.insumos_utilizados && selectedItem.insumos_utilizados.length > 0 && (
                <div className="mt-4">
                  <p className="font-semibold mb-2">Costos Unitarios de Insumos:</p>
                  <div className="bg-gray-50 p-2 rounded max-h-40 overflow-y-auto">
                    {selectedItem.insumos_utilizados.map((insumo, idx) => (
                      <p key={idx} className="text-xs">• {insumo.producto}: {formatCurrency(insumo.costo_unitario)}/kg</p>
                    ))}
                  </div>
                </div>
              )}
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}

              {(selectedItem.insumos_utilizados && selectedItem.insumos_utilizados.length > 0) && (
                <div className="border rounded-lg p-3">
                  <h4 className="font-semibold text-md mb-2">Insumos Utilizados:</h4>
                  <ul className="list-disc pl-5">
                    {selectedItem.insumos_utilizados.map((ins, idx) => (
                      <li key={idx} className="text-sm">
                        {ins.producto} ({ins.codigo}): {ins.cantidad} kg ({formatCurrency(ins.valor_total)})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && (
          <LoteDetalleConsolidado 
              open={showConsolidadoModal}
              onOpenChange={setShowConsolidadoModal}
              codigoLote={loteConsolidado}
          />
      )}
    </div>
  );
}