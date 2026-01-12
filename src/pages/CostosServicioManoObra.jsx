import React, { useState, useEffect, useCallback } from 'react';
import { CostoIndirecto, ProcesoProduccion } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Eye, X, Table } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function CostosServicioManoObra() {
  const [costos, setCostos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newItemsList, setNewItemsList] = useState([]);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [loteConsolidado, setLoteConsolidado] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [costosData, lotesData] = await Promise.all([
        CostoIndirecto.filter({ tipo_costo: 'mano_obra' }),
        ProcesoProduccion.filter({ tipo_proceso: 'recepcion' })
      ]);
      setCostos(costosData);
      // Eliminar duplicados por código de lote
      const uniqueLotes = Array.from(new Map(lotesData.map(l => [l.codigo_lote, l])).values());
      setLotes(uniqueLotes);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    if (item) {
      setCurrentItem(item);
      setNewItemsList([]);
    } else {
      setNewItemsList([{
        tipo_costo: 'mano_obra',
        codigo_lote: '',
        fecha_servicio: new Date().toISOString().split('T')[0],
        nombre_servicio: '',
        cantidad_pieles: 0,
        valor_unitario: 0,
        valor_total: 0,
        subtotal: 0
      }]);
      setCurrentItem(null);
    }
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleEditChange = (field, value) => {
    setCurrentItem(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'cantidad_pieles' || field === 'valor_unitario') {
        const cantidadPieles = parseFloat(field === 'cantidad_pieles' ? value : updated.cantidad_pieles) || 0;
        const valorUnitario = parseFloat(field === 'valor_unitario' ? value : updated.valor_unitario) || 0;
        updated.valor_total = cantidadPieles * valorUnitario;
        updated.subtotal = updated.valor_total;
      }
      return updated;
    });
  };

  const handleNewItemChange = (index, field, value) => {
    const updatedList = [...newItemsList];
    updatedList[index][field] = value;
    if (field === 'cantidad_pieles' || field === 'valor_unitario') {
      const cantidadPieles = parseFloat(updatedList[index].cantidad_pieles) || 0;
      const valorUnitario = parseFloat(updatedList[index].valor_unitario) || 0;
      updatedList[index].valor_total = cantidadPieles * valorUnitario;
      updatedList[index].subtotal = updatedList[index].valor_total;
    }
    setNewItemsList(updatedList);
  };

  const addNewItemRow = () => {
    const lastItem = newItemsList[newItemsList.length - 1];
    setNewItemsList([...newItemsList, {
      tipo_costo: 'mano_obra',
      codigo_lote: lastItem?.codigo_lote || '',
      fecha_servicio: lastItem?.fecha_servicio || new Date().toISOString().split('T')[0],
      nombre_servicio: '',
      cantidad_pieles: 0,
      valor_unitario: 0,
      valor_total: 0,
      subtotal: 0
    }]);
  };

  const removeItemRow = (index) => {
    if (newItemsList.length > 1) {
      setNewItemsList(newItemsList.filter((_, i) => i !== index));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await CostoIndirecto.update(currentItem.id, currentItem);
      } else {
        await Promise.all(newItemsList.map(item => CostoIndirecto.create(item)));
      }
      setShowModal(false);
      loadData();
      alert('Servicio(s) de mano de obra guardado(s) con éxito.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este registro?')) return;
    try {
      await CostoIndirecto.delete(id);
      loadData();
      alert('Registro eliminado.');
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleExport = () => alert('Función de exportar en desarrollo.');
  const handlePrint = () => window.print();

  const headers = ['Código Lote', 'Fecha', 'Nombre Mano de Obra', 'Cantidad Pieles', 'Valor Unitario', 'Valor Total', 'Subtotal', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td>{item.codigo_lote}</td>
      <td>{new Date(item.fecha_servicio).toLocaleDateString()}</td>
      <td>{item.nombre_servicio}</td>
      <td>{item.cantidad_pieles}</td>
      <td className="text-right">{formatCurrency(item.valor_unitario)}</td>
      <td className="text-right">{formatCurrency(item.valor_total)}</td>
      <td className="text-right font-bold text-emerald-700">{formatCurrency(item.subtotal)}</td>
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
        title="Servicio de Mano de Obra"
        description="Gestiona los costos de mano de obra."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Servicio de Mano de Obra
          </Button>
        }
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Servicios de Mano de Obra</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={costos} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Servicio de Mano de Obra</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">
            
            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Código Lote *</Label>
                    <Select value={currentItem?.codigo_lote || ''} onValueChange={v => handleEditChange('codigo_lote', v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar lote" /></SelectTrigger>
                      <SelectContent>
                        {lotes.map(lote => (
                          <SelectItem key={lote.id} value={lote.codigo_lote || `lote-${lote.id}`}>
                            {lote.codigo_lote || 'Sin código'} - {lote.tipo_proceso}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Fecha de Mano de Obra *</Label><Input type="date" value={currentItem?.fecha_servicio || ''} onChange={e => handleEditChange('fecha_servicio', e.target.value)} required /></div>
                </div>
                <div>
                  <Label>Mano de Obra *</Label>
                  <Select value={currentItem?.nombre_servicio || ''} onValueChange={v => handleEditChange('nombre_servicio', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar mano de obra" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CURTIDOR POR PIEL">CURTIDOR POR PIEL</SelectItem>
                      <SelectItem value="CARGUE AL BOMBO POR PIEL">CARGUE AL BOMBO POR PIEL</SelectItem>
                      <SelectItem value="DESCARNADA POR PIEL">DESCARNADA POR PIEL</SelectItem>
                      <SelectItem value="OPERADORES DIVIDIDA POR PIEL">OPERADORES DIVIDIDA POR PIEL</SelectItem>
                      <SelectItem value="AUXILIARES DE DIVIDIDA POR PIEL">AUXILIARES DE DIVIDIDA POR PIEL</SelectItem>
                      <SelectItem value="ESCURRIDA Y REBAJADA POR HOJA">ESCURRIDA Y REBAJADA POR HOJA</SelectItem>
                      <SelectItem value="TRANSPORTE AL LLANO POR HOJA">TRANSPORTE AL LLANO POR HOJA</SelectItem>
                      <SelectItem value="TRANSPORTE AL TOUGLE POR HOJA">TRANSPORTE AL TOUGLE POR HOJA</SelectItem>
                      <SelectItem value="ARRIENDO SECADO AL LLANO POR HOJA">ARRIENDO SECADO AL LLANO POR HOJA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>Cantidad en Pieles</Label><Input type="number" value={currentItem?.cantidad_pieles || ''} onChange={e => handleEditChange('cantidad_pieles', e.target.value)} /></div>
                  <div><Label>Valor Unitario</Label><Input type="number" step="0.01" value={currentItem?.valor_unitario || ''} onChange={e => handleEditChange('valor_unitario', e.target.value)} /></div>
                  <div><Label>Valor Total</Label><Input type="number" step="0.01" value={currentItem?.valor_total || ''} readOnly className="bg-blue-50 font-medium" /></div>
                </div>
              </>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Lista de Servicios a Agregar</Label>
                  <Button type="button" size="sm" onClick={addNewItemRow} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2"/> Agregar Item</Button>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2">Lote</th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Mano Obra</th>
                        <th className="p-2">Cant.</th>
                        <th className="p-2">V. Unit.</th>
                        <th className="p-2">Total</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newItemsList.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2 w-40">
                            <Select value={item.codigo_lote} onValueChange={v => handleNewItemChange(idx, 'codigo_lote', v)}>
                              <SelectTrigger><SelectValue placeholder="Lote" /></SelectTrigger>
                              <SelectContent>
                                {lotes.map(lote => (<SelectItem key={lote.id} value={lote.codigo_lote || `lote-${lote.id}`}>{lote.codigo_lote}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 w-32"><Input type="date" value={item.fecha_servicio} onChange={e => handleNewItemChange(idx, 'fecha_servicio', e.target.value)} /></td>
                          <td className="p-2">
                            <Select value={item.nombre_servicio} onValueChange={v => handleNewItemChange(idx, 'nombre_servicio', v)}>
                              <SelectTrigger><SelectValue placeholder="Mano de Obra" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="CURTIDOR POR PIEL">CURTIDOR POR PIEL</SelectItem>
                                <SelectItem value="CARGUE AL BOMBO POR PIEL">CARGUE AL BOMBO POR PIEL</SelectItem>
                                <SelectItem value="DESCARNADA POR PIEL">DESCARNADA POR PIEL</SelectItem>
                                <SelectItem value="OPERADORES DIVIDIDA POR PIEL">OPERADORES DIVIDIDA POR PIEL</SelectItem>
                                <SelectItem value="AUXILIARES DE DIVIDIDA POR PIEL">AUXILIARES DE DIVIDIDA POR PIEL</SelectItem>
                                <SelectItem value="ESCURRIDA Y REBAJADA POR HOJA">ESCURRIDA Y REBAJADA POR HOJA</SelectItem>
                                <SelectItem value="TRANSPORTE AL LLANO POR HOJA">TRANSPORTE AL LLANO POR HOJA</SelectItem>
                                <SelectItem value="TRANSPORTE AL TOUGLE POR HOJA">TRANSPORTE AL TOUGLE POR HOJA</SelectItem>
                                <SelectItem value="ARRIENDO SECADO AL LLANO POR HOJA">ARRIENDO SECADO AL LLANO POR HOJA</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 w-20"><Input type="number" value={item.cantidad_pieles} onChange={e => handleNewItemChange(idx, 'cantidad_pieles', e.target.value)} /></td>
                          <td className="p-2 w-24"><Input type="number" value={item.valor_unitario} onChange={e => handleNewItemChange(idx, 'valor_unitario', e.target.value)} /></td>
                          <td className="p-2 w-24 text-right">{formatCurrency(item.valor_total)}</td>
                          <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => removeItemRow(idx)} disabled={newItemsList.length === 1}><X className="w-4 h-4 text-red-500" /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Código Lote:</span> {selectedItem.codigo_lote}</p>
              <p><span className="font-semibold">Fecha:</span> {new Date(selectedItem.fecha_servicio).toLocaleDateString()}</p>
              <p><span className="font-semibold">Nombre Mano de Obra:</span> {selectedItem.nombre_servicio}</p>
              <p><span className="font-semibold">Cantidad Pieles:</span> {selectedItem.cantidad_pieles}</p>
              <p><span className="font-semibold">Valor Unitario:</span> {formatCurrency(selectedItem.valor_unitario)}</p>
              <p><span className="font-semibold">Valor Total:</span> {formatCurrency(selectedItem.valor_total)}</p>
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