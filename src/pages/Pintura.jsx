import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, InventarioEnProceso, PedidoMarroquinero, ProductoTerminado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Eye, Table as TableIcon, X } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('es-CO') : 'N/A';

export default function Pintura() {
  const [procesos, setProcesos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [inventarioInsumos, setInventarioInsumos] = useState([]);
  const [unidadesMedida, setUnidadesMedida] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEntregasModal, setShowEntregasModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [entregasParciales, setEntregasParciales] = useState([]);
  const [consumosItems, setConsumosItems] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, pedidosData, inventarioData] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'pintura' }),
        Insumo.list(),
        PedidoMarroquinero.list(),
        InventarioEnProceso.filter({ estado_proceso: 'crosta' })
      ]);
      setProcesos(procesosData);
      setInsumos(insumosData);
      setPedidos(pedidosData);
      setInventarioEnProceso(inventarioData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenModal = async (item = null) => {
    setIsEditing(!!item);
    
    if (!item) {
      const year = new Date().getFullYear();
      const procesosDelAnio = procesos.filter(p => p.id_consecutivo?.includes(`-${year}`));
      const consecutivos = procesosDelAnio.map(p => {
        const match = p.id_consecutivo?.match(/PINT-(\d+)-\d{4}/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) + 1 : 1;
      const idConsecutivo = `PINT-${String(nextConsecutivo).padStart(4, '0')}-${year}`;
      
      setCurrentItem({
        tipo_proceso: 'pintura',
        id_consecutivo: idConsecutivo,
        fecha_entrega_pintor: new Date().toISOString().split('T')[0],
        pintor_responsable: '',
        pedido_id: '',
        numero_pedido: '',
        estado_pedido_pintura: 'pendiente',
        total_hojas_enviadas_pintura: 0,
        hojas_pintadas_recibidas: 0,
        hojas_pendientes_pintar: 0,
        codigo_lote: '',
        observaciones: '',
        entregas_parciales: []
      });
    } else {
      setCurrentItem(item);
    }
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleOpenEntregas = (item) => {
    setSelectedItem(item);
    setEntregasParciales(item.entregas_parciales || []);
    setShowEntregasModal(true);
  };

  const agregarEntrega = () => {
    setEntregasParciales([...entregasParciales, {
      fecha_entrega: new Date().toISOString().split('T')[0],
      cantidad_hojas_pintadas: 0,
      observaciones: '',
      confirmado: false
    }]);
  };

  const handleEntregaChange = (index, field, value) => {
    const updated = [...entregasParciales];
    updated[index][field] = field === 'cantidad_hojas_pintadas' ? (parseFloat(value) || 0) : value;
    setEntregasParciales(updated);
  };

  const confirmarEntrega = async (index) => {
    const entrega = entregasParciales[index];
    const totalRecibido = selectedItem.hojas_pintadas_recibidas || 0;
    const totalEnviado = selectedItem.total_hojas_enviadas_pintura || 0;
    const pendiente = totalEnviado - totalRecibido;

    if (entrega.cantidad_hojas_pintadas > pendiente) {
      alert(`Error: No puede registrar más de ${pendiente} hojas pendientes.`);
      return;
    }

    const updated = [...entregasParciales];
    updated[index].confirmado = true;
    
    const nuevasRecibidas = totalRecibido + entrega.cantidad_hojas_pintadas;
    const nuevasPendientes = totalEnviado - nuevasRecibidas;
    const nuevoEstado = nuevasPendientes === 0 ? 'terminado' : (nuevasRecibidas > 0 ? 'parcial' : 'pendiente');

    try {
      await ProcesoProduccion.update(selectedItem.id, {
        entregas_parciales: updated,
        hojas_pintadas_recibidas: nuevasRecibidas,
        hojas_pendientes_pintar: nuevasPendientes,
        estado_pedido_pintura: nuevoEstado
      });

      // Crear entrada en inventario de productos terminados
      await ProductoTerminado.create({
        codigo: `PT-${selectedItem.numero_pedido}-${Date.now()}`,
        descripcion: `Cuero pintado - Pedido ${selectedItem.numero_pedido}`,
        cantidad: entrega.cantidad_hojas_pintadas,
        unidad_medida: 'HOJA',
        pedido_id: selectedItem.pedido_id,
        proceso_origen_id: selectedItem.id,
        fecha_ingreso: entrega.fecha_entrega,
        estado: 'disponible'
      });

      alert('Entrega confirmada y registrada en inventario.');
      setShowEntregasModal(false);
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al confirmar entrega.');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...currentItem,
        numero_proceso: currentItem.id_consecutivo,
        hojas_pendientes_pintar: currentItem.total_hojas_enviadas_pintura - (currentItem.hojas_pintadas_recibidas || 0)
      };
      
      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        await ProcesoProduccion.create(dataToSave);
      }
      
      setShowModal(false);
      loadData();
      alert('Proceso de pintura guardado con éxito.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar el proceso.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proceso de pintura?')) return;
    try {
      await ProcesoProduccion.delete(id);
      loadData();
      alert('Proceso eliminado.');
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleExport = () => alert('Función de exportar en desarrollo.');

  const headers = ['ID', 'Fecha Entrega', 'Pintor', 'No. Pedido', 'Total Enviadas', 'Hojas Pintadas', 'Pendientes', 'Estado', 'Acciones'];
  
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono font-bold">{item.id_consecutivo}</td>
      <td>{formatDate(item.fecha_entrega_pintor)}</td>
      <td>{item.pintor_responsable || 'N/A'}</td>
      <td className="font-mono">{item.numero_pedido || 'N/A'}</td>
      <td className="text-center font-bold">{item.total_hojas_enviadas_pintura || 0}</td>
      <td className="text-center font-bold text-green-600">{item.hojas_pintadas_recibidas || 0}</td>
      <td className="text-center font-bold text-orange-600">{item.hojas_pendientes_pintar || 0}</td>
      <td>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          item.estado_pedido_pintura === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
          item.estado_pedido_pintura === 'parcial' ? 'bg-blue-100 text-blue-700' :
          'bg-green-100 text-green-700'
        }`}>
          {item.estado_pedido_pintura?.toUpperCase() || 'PENDIENTE'}
        </span>
      </td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenEntregas(item)} title="Entregas Parciales">
            <TableIcon className="w-4 h-4 text-purple-600" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} title="Ver Detalle">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)} title="Editar">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} title="Eliminar">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Pintura"
        description="Gestiona los procesos de pintura del cuero."
        onExportExcel={handleExport}
        onPrint={() => window.print()}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Pintura
          </Button>
        }
      />
      
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Procesos de Pintura</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={procesos} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Pintura</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ID/Consecutivo</Label>
                <Input value={currentItem?.id_consecutivo || ''} readOnly className="bg-gray-100 font-mono font-bold" />
              </div>
              <div>
                <Label>Fecha de Entrega al Pintor *</Label>
                <Input type="date" value={currentItem?.fecha_entrega_pintor || ''} onChange={e => setCurrentItem({...currentItem, fecha_entrega_pintor: e.target.value})} required />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pintor/Responsable</Label>
                <Input value={currentItem?.pintor_responsable || ''} onChange={e => setCurrentItem({...currentItem, pintor_responsable: e.target.value})} />
              </div>
              <div>
                <Label>No. ID del Pedido</Label>
                <Select value={currentItem?.pedido_id || ''} onValueChange={v => {
                  const pedido = pedidos.find(p => p.id === v);
                  setCurrentItem({...currentItem, pedido_id: v, numero_pedido: pedido?.numero_pedido || ''});
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar pedido" /></SelectTrigger>
                  <SelectContent>
                    {pedidos.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.numero_pedido} - {p.nombre_marroquinero}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Estado del Pedido en Pintura *</Label>
                <Select value={currentItem?.estado_pedido_pintura || 'pendiente'} onValueChange={v => setCurrentItem({...currentItem, estado_pedido_pintura: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">PENDIENTE</SelectItem>
                    <SelectItem value="parcial">PARCIAL</SelectItem>
                    <SelectItem value="terminado">TERMINADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Total de Hojas Enviadas a Pintura</Label>
                <Input type="number" value={currentItem?.total_hojas_enviadas_pintura || ''} onChange={e => {
                  const total = parseFloat(e.target.value) || 0;
                  const recibidas = currentItem?.hojas_pintadas_recibidas || 0;
                  setCurrentItem({...currentItem, total_hojas_enviadas_pintura: total, hojas_pendientes_pintar: total - recibidas});
                }} />
              </div>
              <div>
                <Label>Código Lote Crosta (opcional)</Label>
                <Select value={currentItem?.codigo_lote || ''} onValueChange={v => {
                  setCurrentItem({...currentItem, codigo_lote: v});
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lote" /></SelectTrigger>
                  <SelectContent>
                    {inventarioEnProceso.map(inv => (
                      <SelectItem key={inv.id} value={inv.codigo_lote}>
                        {inv.codigo_lote} - {inv.cantidad_hojas} hojas
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded">
              <div><Label>Hojas Pintadas Recibidas</Label><Input type="number" value={currentItem?.hojas_pintadas_recibidas || 0} readOnly className="bg-white font-bold" /></div>
              <div><Label>Hojas Pendientes por Pintar</Label><Input type="number" value={currentItem?.hojas_pendientes_pintar || 0} readOnly className="bg-orange-50 font-bold text-orange-700" /></div>
            </div>
            
            <div>
              <Label>Observaciones</Label>
              <Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={3} />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEntregasModal} onOpenChange={setShowEntregasModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Control de Entregas Parciales - {selectedItem?.id_consecutivo}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded grid grid-cols-3 gap-4 text-sm">
              <div><span className="font-semibold">Total Enviadas:</span> {selectedItem?.total_hojas_enviadas_pintura || 0} hojas</div>
              <div><span className="font-semibold text-green-600">Recibidas:</span> {selectedItem?.hojas_pintadas_recibidas || 0} hojas</div>
              <div><span className="font-semibold text-orange-600">Pendientes:</span> {selectedItem?.hojas_pendientes_pintar || 0} hojas</div>
            </div>

            <div className="flex justify-end">
              <Button onClick={agregarEntrega} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Entrega
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Fecha Entrega</th>
                    <th className="p-2 text-right">Cantidad Hojas Pintadas</th>
                    <th className="p-2 text-left">Observaciones</th>
                    <th className="p-2 text-center">Estado</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entregasParciales.map((entrega, idx) => (
                    <tr key={idx} className={`border-t ${entrega.confirmado ? 'bg-green-50' : ''}`}>
                      <td className="p-2">
                        <Input type="date" value={entrega.fecha_entrega} onChange={e => handleEntregaChange(idx, 'fecha_entrega', e.target.value)} disabled={entrega.confirmado} className="h-8 text-sm" />
                      </td>
                      <td className="p-2">
                        <Input type="number" value={entrega.cantidad_hojas_pintadas} onChange={e => handleEntregaChange(idx, 'cantidad_hojas_pintadas', e.target.value)} disabled={entrega.confirmado} className="h-8 text-sm text-right" />
                      </td>
                      <td className="p-2">
                        <Input value={entrega.observaciones} onChange={e => handleEntregaChange(idx, 'observaciones', e.target.value)} disabled={entrega.confirmado} className="h-8 text-sm" />
                      </td>
                      <td className="p-2 text-center">
                        {entrega.confirmado ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">CONFIRMADO</span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">PENDIENTE</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {!entrega.confirmado && (
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" onClick={() => confirmarEntrega(idx)}>Confirmar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEntregasParciales(entregasParciales.filter((_, i) => i !== idx))}>
                              <X className="w-3 h-3 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEntregasModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de Pintura</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">ID Consecutivo:</span> <span className="font-mono">{selectedItem.id_consecutivo}</span></p>
              <p><span className="font-semibold">Fecha Entrega Pintor:</span> {formatDate(selectedItem.fecha_entrega_pintor)}</p>
              <p><span className="font-semibold">Pintor/Responsable:</span> {selectedItem.pintor_responsable || 'N/A'}</p>
              <p><span className="font-semibold">Pedido:</span> <span className="font-mono">{selectedItem.numero_pedido || 'N/A'}</span></p>
              <p><span className="font-semibold">Total Enviadas:</span> {selectedItem.total_hojas_enviadas_pintura} hojas</p>
              <p><span className="font-semibold">Hojas Pintadas:</span> {selectedItem.hojas_pintadas_recibidas} hojas</p>
              <p><span className="font-semibold">Pendientes:</span> {selectedItem.hojas_pendientes_pintar} hojas</p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize font-bold">{selectedItem.estado_pedido_pintura}</span></p>
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