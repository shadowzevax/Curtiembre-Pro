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

export default function CostosOtrosCostos() {
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
        CostoIndirecto.filter({ tipo_costo: 'otros_costos' }),
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
        tipo_costo: 'otros_costos',
        codigo_lote: '',
        fecha_servicio: new Date().toISOString().split('T')[0],
        nombre_servicio: '',
        cantidad_pieles: 0,
        valor_unitario: 0,
        valor_total: 0,
        cantidad_carnaza_kls: 0,
        valor_unitario_carnaza: 0,
        valor_total_carnaza: 0,
        subtotal: 0,
        // Additional fields
        costos_por_piel_puesta_en_pasto: 0,
        promedio_pie_hoja: 0,
        costo_pintura_terminada_hoja: 0
      }]);
      setCurrentItem(null);
    }
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const calculateValues = (item) => {
    const cantidadPieles = parseFloat(item.cantidad_pieles) || 0;
    const valorUnitario = parseFloat(item.valor_unitario) || 0;
    const valorTotal = cantidadPieles * valorUnitario;

    const cantCarnaza = parseFloat(item.cantidad_carnaza_kls) || 0;
    const valorUnitCarnaza = parseFloat(item.valor_unitario_carnaza) || 0;
    const valorTotalCarnaza = cantCarnaza * valorUnitCarnaza;

    const subtotal = valorTotal - valorTotalCarnaza;

    return { ...item, valor_total: valorTotal, valor_total_carnaza: valorTotalCarnaza, subtotal };
  };

  const handleEditChange = (field, value) => {
    setCurrentItem(prev => calculateValues({ ...prev, [field]: value }));
  };

  const handleNewItemChange = (index, field, value) => {
    const updatedList = [...newItemsList];
    updatedList[index][field] = value;
    updatedList[index] = calculateValues(updatedList[index]);
    setNewItemsList(updatedList);
  };

  const addNewItemRow = () => {
    const lastItem = newItemsList[newItemsList.length - 1];
    setNewItemsList([...newItemsList, {
      tipo_costo: 'otros_costos',
      codigo_lote: lastItem?.codigo_lote || '',
      fecha_servicio: lastItem?.fecha_servicio || new Date().toISOString().split('T')[0],
      nombre_servicio: '',
      cantidad_pieles: 0,
      valor_unitario: 0,
      valor_total: 0,
      cantidad_carnaza_kls: 0,
      valor_unitario_carnaza: 0,
      valor_total_carnaza: 0,
      subtotal: 0,
      costos_por_piel_puesta_en_pasto: 0,
      promedio_pie_hoja: 0,
      costo_pintura_terminada_hoja: 0
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
      alert('Otros costos guardado con éxito.');
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

  const headers = ['Código Lote', 'Fecha', 'Nombre', 'Cantidad Pieles', 'Subtotal', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td>{item.codigo_lote}</td>
      <td>{new Date(item.fecha_servicio).toLocaleDateString()}</td>
      <td>{item.nombre_servicio}</td>
      <td>{item.cantidad_pieles}</td>
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
        title="Otros Costos"
        description="Gestiona otros costos indirectos de producción."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Otros Costos
          </Button>
        }
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Otros Costos</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={costos} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Otros Costos</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">
            
            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Código Lote *</Label><Select value={currentItem?.codigo_lote || ''} onValueChange={v => handleEditChange('codigo_lote', v)}><SelectTrigger><SelectValue placeholder="Lote" /></SelectTrigger><SelectContent>{lotes.map(lote => <SelectItem key={lote.id} value={lote.codigo_lote || `lote-${lote.id}`}>{lote.codigo_lote}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Fecha *</Label><Input type="date" value={currentItem?.fecha_servicio || ''} onChange={e => handleEditChange('fecha_servicio', e.target.value)} required /></div>
                </div>
                <div>
                  <Label>Nombre *</Label>
                  <Select value={currentItem?.nombre_servicio || ''} onValueChange={v => handleEditChange('nombre_servicio', v)}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRECIO POR PIEL EN PELO - SALADA">PRECIO POR PIEL EN PELO - SALADA</SelectItem>
                      <SelectItem value="TRANSPORTE DE PIELES A LA CURTIEMBRE">TRANSPORTE DE PIELES A LA CURTIEMBRE</SelectItem>
                      <SelectItem value="DESCARGADA DE PIELES EN LA CURTIEMBRE">DESCARGADA DE PIELES EN LA CURTIEMBRE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="border-t pt-4"><h3 className="font-semibold mb-2">Costos</h3><div className="grid grid-cols-3 gap-4">
                  <div><Label>Cant. Pieles</Label><Input type="number" value={currentItem?.cantidad_pieles} onChange={e => handleEditChange('cantidad_pieles', e.target.value)} /></div>
                  <div><Label>V. Unitario</Label><Input type="number" value={currentItem?.valor_unitario} onChange={e => handleEditChange('valor_unitario', e.target.value)} /></div>
                  <div><Label>V. Total</Label><Input type="number" value={currentItem?.valor_total} readOnly className="bg-blue-50" /></div>
                </div></div>

                <div className="border-t pt-4"><h3 className="font-semibold mb-2">(-) Carnaza</h3><div className="grid grid-cols-3 gap-4">
                  <div><Label>Cant. Carnaza (kg)</Label><Input type="number" value={currentItem?.cantidad_carnaza_kls} onChange={e => handleEditChange('cantidad_carnaza_kls', e.target.value)} /></div>
                  <div><Label>V. Unit. Carnaza</Label><Input type="number" value={currentItem?.valor_unitario_carnaza} onChange={e => handleEditChange('valor_unitario_carnaza', e.target.value)} /></div>
                  <div><Label>Total Carnaza</Label><Input type="number" value={currentItem?.valor_total_carnaza} readOnly className="bg-red-50 text-red-700" /></div>
                </div></div>

                <div className="bg-emerald-50 p-4 rounded mt-4"><Label>Subtotal</Label><div className="text-2xl font-bold text-emerald-700">{formatCurrency(currentItem?.subtotal)}</div></div>
              </>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Lista de Costos a Agregar</Label>
                  <Button type="button" size="sm" onClick={addNewItemRow} className="bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4 mr-2"/> Agregar Item</Button>
                </div>
                <div className="border rounded-md overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2">Lote</th>
                        <th className="p-2">Fecha</th>
                        <th className="p-2">Nombre</th>
                        <th className="p-2">Cant.</th>
                        <th className="p-2">V.Unit</th>
                        <th className="p-2">Carnaza(kg)</th>
                        <th className="p-2">V.Carnaza</th>
                        <th className="p-2">Subtotal</th>
                        <th className="p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newItemsList.map((item, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-1 w-32"><Select value={item.codigo_lote} onValueChange={v => handleNewItemChange(idx, 'codigo_lote', v)}><SelectTrigger className="h-8"><SelectValue placeholder="Lote" /></SelectTrigger><SelectContent>{lotes.map(lote => <SelectItem key={lote.id} value={lote.codigo_lote || `lote-${lote.id}`}>{lote.codigo_lote}</SelectItem>)}</SelectContent></Select></td>
                          <td className="p-1 w-28"><Input type="date" className="h-8" value={item.fecha_servicio} onChange={e => handleNewItemChange(idx, 'fecha_servicio', e.target.value)} /></td>
                          <td className="p-1">
                            <Select value={item.nombre_servicio} onValueChange={v => handleNewItemChange(idx, 'nombre_servicio', v)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Nombre" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PRECIO POR PIEL EN PELO - SALADA">PRECIO POR PIEL EN PELO - SALADA</SelectItem>
                                <SelectItem value="TRANSPORTE DE PIELES A LA CURTIEMBRE">TRANSPORTE DE PIELES A LA CURTIEMBRE</SelectItem>
                                <SelectItem value="DESCARGADA DE PIELES EN LA CURTIEMBRE">DESCARGADA DE PIELES EN LA CURTIEMBRE</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-1 w-16"><Input className="h-8" type="number" value={item.cantidad_pieles} onChange={e => handleNewItemChange(idx, 'cantidad_pieles', e.target.value)} /></td>
                          <td className="p-1 w-20"><Input className="h-8" type="number" value={item.valor_unitario} onChange={e => handleNewItemChange(idx, 'valor_unitario', e.target.value)} /></td>
                          <td className="p-1 w-16"><Input className="h-8" type="number" value={item.cantidad_carnaza_kls} onChange={e => handleNewItemChange(idx, 'cantidad_carnaza_kls', e.target.value)} /></td>
                          <td className="p-1 w-20"><Input className="h-8" type="number" value={item.valor_unitario_carnaza} onChange={e => handleNewItemChange(idx, 'valor_unitario_carnaza', e.target.value)} /></td>
                          <td className="p-1 w-24 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                          <td className="p-1"><Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeItemRow(idx)} disabled={newItemsList.length === 1}><X className="w-4 h-4 text-red-500" /></Button></td>
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
              <p><span className="font-semibold">Nombre:</span> {selectedItem.nombre_servicio}</p>
              <p><span className="font-semibold">Subtotal:</span> {formatCurrency(selectedItem.subtotal)}</p>
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