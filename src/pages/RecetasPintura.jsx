import React, { useState, useEffect, useCallback } from 'react';
import { RecetaPintura, Insumo } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Eye, X } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function RecetasPintura() {
  const [recetas, setRecetas] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recetasData, insumosData] = await Promise.all([
        RecetaPintura.list(),
        Insumo.list()
      ]);
      setRecetas(recetasData);
      setInsumos(insumosData);
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
      tipo_cuero_terminado: 'cuero_napa',
      nombre_receta: '',
      codigo: '',
      cantidad_base_por_hoja: 0,
      costo_total_productos: 0,
      items: [],
      observaciones: ''
    });
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const addItem = () => {
    setCurrentItem(prev => ({
      ...prev,
      items: [...(prev.items || []), {
        codigo: '',
        producto: '',
        grs: 0,
        precio_por_gr: 0,
        valor_total: 0,
        observaciones: ''
      }]
    }));
  };

  const removeItem = (index) => {
    const updated = currentItem.items.filter((_, i) => i !== index);
    setCurrentItem(prev => ({
      ...prev,
      items: updated
    }));
    calculateCostoTotal(updated);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...currentItem.items];
    updated[index][field] = value;
    
    // Si cambia código (buscar en insumos)
    if (field === 'codigo') {
      const insumo = insumos.find(i => i.codigo === value);
      if (insumo) {
        updated[index].producto = insumo.nombre || insumo.descripcion || '';
      }
    }
    
    // Calcular valor_total = grs * precio_por_gr
    const grs = parseFloat(updated[index].grs) || 0;
    const precioPorGr = parseFloat(updated[index].precio_por_gr) || 0;
    updated[index].valor_total = grs * precioPorGr;
    
    setCurrentItem(prev => ({ ...prev, items: updated }));
    calculateCostoTotal(updated);
  };

  const calculateCostoTotal = (items) => {
    const total = items.reduce((sum, item) => sum + (item.valor_total || 0), 0);
    setCurrentItem(prev => ({ ...prev, costo_total_productos: total }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await RecetaPintura.update(currentItem.id, currentItem);
      } else {
        await RecetaPintura.create(currentItem);
      }
      setShowModal(false);
      loadData();
      alert('Receta de pintura guardada con éxito.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar la receta.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta receta?')) return;
    try {
      await RecetaPintura.delete(id);
      loadData();
      alert('Receta eliminada.');
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleExport = () => alert('Función de exportar en desarrollo.');
  const handlePrint = () => window.print();

  const getTipoCueroLabel = (tipo) => {
    const labels = {
      'cuero_napa': 'Cuero Napa',
      'cuero_envejecido': 'Cuero Envejecido',
      'cuero_opaco': 'Cuero Opaco',
      'cuero_napa_mate': 'Cuero Napa Mate'
    };
    return labels[tipo] || tipo;
  };

  const headers = ['Código', 'Nombre Receta', 'Tipo Cuero', 'Cant. Base/Hoja', 'Costo Total', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td>{item.codigo}</td>
      <td>{item.nombre_receta}</td>
      <td>{getTipoCueroLabel(item.tipo_cuero_terminado)}</td>
      <td>{item.cantidad_base_por_hoja}</td>
      <td className="text-right font-bold text-emerald-700">{formatCurrency(item.costo_total_productos)}</td>
      <td>
        <div className="flex space-x-2">
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
        title="Recetas de Pintura"
        description="Gestiona las recetas de pintura para diferentes tipos de cuero."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Receta
          </Button>
        }
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Recetas de Pintura</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={recetas} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Receta de Pintura</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre del Tipo de Cuero Terminado *</Label>
                <Select value={currentItem?.tipo_cuero_terminado || 'cuero_napa'} onValueChange={v => setCurrentItem({...currentItem, tipo_cuero_terminado: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cuero_napa">Cuero Napa</SelectItem>
                    <SelectItem value="cuero_envejecido">Cuero Envejecido</SelectItem>
                    <SelectItem value="cuero_opaco">Cuero Opaco</SelectItem>
                    <SelectItem value="cuero_napa_mate">Cuero Napa Mate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Código de Receta *</Label><Input value={currentItem?.codigo || ''} onChange={e => setCurrentItem({...currentItem, codigo: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Nombre de la Receta</Label><Input value={currentItem?.nombre_receta || ''} onChange={e => setCurrentItem({...currentItem, nombre_receta: e.target.value})} placeholder="Ej: Receta Napa Estándar" /></div>
              <div><Label>Cantidad Base por Hoja</Label><Input type="number" step="0.01" value={currentItem?.cantidad_base_por_hoja || ''} onChange={e => setCurrentItem({...currentItem, cantidad_base_por_hoja: parseFloat(e.target.value) || 0})} /></div>
            </div>

            <div className="border rounded-lg p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-lg">Items / Productos</h3>
                <Button type="button" onClick={addItem} size="sm"><Plus className="w-4 h-4 mr-2" />Agregar Item</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-left">Producto</th>
                      <th className="p-2 text-right">Grs</th>
                      <th className="p-2 text-right">Precio por c/Gr</th>
                      <th className="p-2 text-right">Valor Total</th>
                      <th className="p-2 text-left">Observaciones</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(currentItem?.items || []).map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">
                          <Select value={item.codigo} onValueChange={v => handleItemChange(index, 'codigo', v)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                              {insumos.map(ins => (
                                <SelectItem key={ins.id} value={ins.codigo}>
                                  {ins.codigo} - {ins.nombre || ins.descripcion}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-2"><Input value={item.producto} readOnly className="bg-gray-50" /></td>
                        <td className="p-2"><Input type="number" step="0.01" value={item.grs} onChange={e => handleItemChange(index, 'grs', e.target.value)} className="text-right" /></td>
                        <td className="p-2"><Input type="number" step="0.01" value={item.precio_por_gr} onChange={e => handleItemChange(index, 'precio_por_gr', e.target.value)} className="text-right" /></td>
                        <td className="p-2 text-right font-medium text-emerald-700">{formatCurrency(item.valor_total)}</td>
                        <td className="p-2"><Input value={item.observaciones || ''} onChange={e => handleItemChange(index, 'observaciones', e.target.value)} placeholder="Opcional" /></td>
                        <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}><X className="w-4 h-4 text-red-500" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-lg">
              <Label>Costo Total de Productos de Pintura ({getTipoCueroLabel(currentItem?.tipo_cuero_terminado)})</Label>
              <div className="mt-2 p-3 bg-white rounded border font-bold text-xl text-emerald-700">
                {formatCurrency(currentItem?.costo_total_productos || 0)}
              </div>
            </div>

            <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={3} /></div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Detalle de Receta - {selectedItem?.nombre_receta}</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Código:</span> {selectedItem.codigo}</p>
              <p><span className="font-semibold">Tipo de Cuero:</span> {getTipoCueroLabel(selectedItem.tipo_cuero_terminado)}</p>
              <p><span className="font-semibold">Cantidad Base por Hoja:</span> {selectedItem.cantidad_base_por_hoja}</p>
              
              {selectedItem.items && selectedItem.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden mt-4">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">Producto</th>
                        <th className="p-2 text-right">Grs</th>
                        <th className="p-2 text-right">Precio/Gr</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItem.items.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">{item.codigo}</td>
                          <td className="p-2">{item.producto}</td>
                          <td className="p-2 text-right">{item.grs}</td>
                          <td className="p-2 text-right">{formatCurrency(item.precio_por_gr)}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(item.valor_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              
              <div className="bg-emerald-50 p-3 rounded-lg mt-4">
                <p><span className="font-semibold">Costo Total:</span> <span className="text-emerald-700 font-bold text-xl">{formatCurrency(selectedItem.costo_total_productos)}</span></p>
              </div>
              
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}