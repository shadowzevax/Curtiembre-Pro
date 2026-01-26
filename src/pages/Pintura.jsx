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
import { Plus, Edit, Trash2, Eye, Printer, Download, Table as TableIcon, X } from 'lucide-react';
import NumericInput from '../components/common/NumericInput';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('es-CO') : 'N/A';

export default function Pintura() {
  const [procesos, setProcesos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConsumosModal, setShowConsumosModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [consumosActuales, setConsumosActuales] = useState([]);

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
      // Generar ID consecutivo PINT-0001-2026
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
        fecha: new Date().toISOString().split('T')[0],
        responsable: '',
        pedido_id: '',
        numero_pedido: '',
        estado: 'borrador',
        cantidad_entrada: 0,
        codigo_lote: '',
        observaciones: '',
        consumos: []
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

  const handleOpenConsumos = (item) => {
    setSelectedItem(item);
    setConsumosActuales(item.consumos || []);
    setShowConsumosModal(true);
  };

  const agregarConsumo = () => {
    const year = new Date().getFullYear();
    const nextNum = (consumosActuales.length || 0) + 1;
    const idConsumo = `C-${String(nextNum).padStart(6, '0')}`;
    
    setConsumosActuales([...consumosActuales, {
      id_consumo: idConsumo,
      id_pintura: selectedItem?.id_consecutivo || '',
      id_pedido: selectedItem?.numero_pedido || '',
      clase_cuero: '',
      codigo: '',
      descripcion: '',
      cantidad_utilizada: 0,
      unidad_medida: '',
      color: '',
      observaciones: '',
      estado: 'borrador'
    }]);
  };

  const handleConsumoChange = (index, field, value) => {
    const updated = [...consumosActuales];
    updated[index][field] = value;
    
    // Auto-cargar descripción y unidad desde catálogo
    if (field === 'codigo') {
      const insumo = insumos.find(i => i.codigo === value);
      if (insumo) {
        updated[index].descripcion = insumo.nombre || insumo.descripcion || '';
        updated[index].unidad_medida = insumo.unidad_medida || 'KG';
      }
    }
    
    setConsumosActuales(updated);
  };

  const guardarConsumos = async () => {
    try {
      await ProcesoProduccion.update(selectedItem.id, {
        consumos: consumosActuales
      });
      
      // Si algún consumo está en estado finalizado, afectar inventario
      for (const consumo of consumosActuales) {
        if (consumo.estado === 'finalizado' && consumo.codigo && consumo.cantidad_utilizada > 0) {
          const { MovimientoInventario } = await import('@/entities/all');
          const insumoData = insumos.find(i => i.codigo === consumo.codigo);
          
          if (insumoData) {
            await MovimientoInventario.create({
              tipo_movimiento: 'salida',
              insumo_id: insumoData.id,
              cantidad: -(consumo.cantidad_utilizada),
              costo_unitario: insumoData.costo_promedio || 0,
              fecha_movimiento: new Date().toISOString().split('T')[0],
              referencia: `PINTURA-${consumo.id_consumo}`,
              observaciones: `Consumo en pintura - ${consumo.descripcion}`,
              usuario_id: 'system'
            });
            
            const movimientos = await MovimientoInventario.filter({ insumo_id: insumoData.id });
            const nuevoStock = movimientos.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0) - consumo.cantidad_utilizada;
            
            await Insumo.update(insumoData.id, { stock_actual: nuevoStock });
          }
        }
      }
      
      setShowConsumosModal(false);
      loadData();
      alert('Consumos guardados exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar consumos');
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const dataToSave = {
        ...currentItem,
        numero_proceso: currentItem.id_consecutivo
      };
      
      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        await ProcesoProduccion.create(dataToSave);
      }
      
      // Si está finalizado, afectar inventarios
      if (dataToSave.estado === 'finalizado' && !isEditing) {
        // Descontar crosta del inventario en proceso
        const crostaItem = inventarioEnProceso.find(i => 
          i.codigo_lote === dataToSave.codigo_lote && 
          i.estado_proceso === 'crosta'
        );
        
        if (crostaItem && crostaItem.cantidad_hojas >= dataToSave.cantidad_entrada) {
          await InventarioEnProceso.update(crostaItem.id, {
            cantidad_hojas: crostaItem.cantidad_hojas - dataToSave.cantidad_entrada
          });
        }
        
        // Aumentar inventario de productos terminados (si es necesario)
        // Aquí se crearía el producto terminado pintado
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

  const handlePrint = (item) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html><head><title>Pintura ${item.id_consecutivo}</title></head>
      <body><h2>Proceso de Pintura ${item.id_consecutivo}</h2>
      <p><strong>Fecha:</strong> ${formatDate(item.fecha)}</p>
      <p><strong>Pedido:</strong> ${item.numero_pedido}</p>
      <p><strong>Cantidad Entrada:</strong> ${item.cantidad_entrada} hojas</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExport = () => alert('Función de exportar en desarrollo.');

  const headers = ['ID Consecutivo', 'Fecha', 'Responsable', 'No. Pedido', 'Cant. Entrada', 'Estado', 'Acciones'];
  
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono font-bold">{item.id_consecutivo}</td>
      <td>{formatDate(item.fecha)}</td>
      <td>{item.responsable || 'N/A'}</td>
      <td className="font-mono">{item.numero_pedido || 'N/A'}</td>
      <td className="text-center font-bold">{item.cantidad_entrada}</td>
      <td>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          item.estado === 'borrador' ? 'bg-gray-100 text-gray-700' :
          item.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' :
          'bg-green-100 text-green-700'
        }`}>
          {item.estado?.toUpperCase()}
        </span>
      </td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} title="Ver Detalle">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePrint(item)} title="Imprimir">
            <Printer className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenConsumos(item)} title="Insumos/Consumos">
            <TableIcon className="w-4 h-4 text-purple-600" />
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
                <Label>Fecha *</Label>
                <Input type="date" value={currentItem?.fecha || ''} onChange={e => setCurrentItem({...currentItem, fecha: e.target.value})} required />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Responsable</Label>
                <Input value={currentItem?.responsable || ''} onChange={e => setCurrentItem({...currentItem, responsable: e.target.value})} />
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
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Estado *</Label>
                <Select value={currentItem?.estado || 'borrador'} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="borrador">Borrador</SelectItem>
                    <SelectItem value="en_proceso">En Proceso</SelectItem>
                    <SelectItem value="finalizado">Finalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad Entrada (Crosta disponible)</Label>
                <Select value={currentItem?.codigo_lote || ''} onValueChange={v => {
                  const item = inventarioEnProceso.find(i => i.codigo_lote === v);
                  setCurrentItem({
                    ...currentItem, 
                    codigo_lote: v,
                    cantidad_entrada: item?.cantidad_hojas || 0
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lote crosta" /></SelectTrigger>
                  <SelectContent>
                    {inventarioEnProceso.map(inv => (
                      <SelectItem key={inv.id} value={inv.codigo_lote}>
                        {inv.codigo_lote} - {inv.cantidad_hojas} hojas disponibles
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="bg-blue-50 p-3 rounded">
              <p className="text-sm font-semibold">Cantidad de entrada seleccionada: <span className="text-blue-700 text-lg">{currentItem?.cantidad_entrada || 0} hojas</span></p>
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

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de Pintura</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">ID Consecutivo:</span> <span className="font-mono">{selectedItem.id_consecutivo}</span></p>
              <p><span className="font-semibold">Fecha:</span> {formatDate(selectedItem.fecha)}</p>
              <p><span className="font-semibold">Responsable:</span> {selectedItem.responsable || 'N/A'}</p>
              <p><span className="font-semibold">Pedido:</span> <span className="font-mono">{selectedItem.numero_pedido || 'N/A'}</span></p>
              <p><span className="font-semibold">Cantidad Entrada:</span> {selectedItem.cantidad_entrada} hojas</p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize">{selectedItem.estado}</span></p>
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showConsumosModal} onOpenChange={setShowConsumosModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registro de Insumos/Consumos - {selectedItem?.id_consecutivo}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={agregarConsumo} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Consumo
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">ID Consumo</th>
                    <th className="p-2 text-left">Clase Cuero</th>
                    <th className="p-2 text-left">Código</th>
                    <th className="p-2 text-left">Descripción</th>
                    <th className="p-2 text-right">Cant. Utilizada</th>
                    <th className="p-2 text-left">UM</th>
                    <th className="p-2 text-left">Color</th>
                    <th className="p-2 text-left">Estado</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {consumosActuales.map((consumo, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-1"><Input value={consumo.id_consumo} readOnly className="h-7 text-xs bg-gray-50 font-mono" /></td>
                      <td className="p-1">
                        <Select value={consumo.clase_cuero} onValueChange={v => handleConsumoChange(idx, 'clase_cuero', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="napa">NAPA</SelectItem>
                            <SelectItem value="napa_mate">NAPA MATE</SelectItem>
                            <SelectItem value="opaco">OPACO</SelectItem>
                            <SelectItem value="envejecido">ENVEJECIDO</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1">
                        <Select value={consumo.codigo} onValueChange={v => handleConsumoChange(idx, 'codigo', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Código" /></SelectTrigger>
                          <SelectContent>
                            {insumos.map(ins => (
                              <SelectItem key={ins.id} value={ins.codigo}>{ins.codigo}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1"><Input value={consumo.descripcion} readOnly className="h-7 text-xs bg-gray-50" /></td>
                      <td className="p-1"><NumericInput step="0.01" value={consumo.cantidad_utilizada || 0} onChange={v => handleConsumoChange(idx, 'cantidad_utilizada', v)} className="h-7 text-xs text-right" /></td>
                      <td className="p-1"><Input value={consumo.unidad_medida} readOnly className="h-7 text-xs bg-gray-50" /></td>
                      <td className="p-1"><Input value={consumo.color} onChange={e => handleConsumoChange(idx, 'color', e.target.value)} className="h-7 text-xs" /></td>
                      <td className="p-1">
                        <Select value={consumo.estado || 'borrador'} onValueChange={v => handleConsumoChange(idx, 'estado', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="borrador">Borrador</SelectItem>
                            <SelectItem value="en_proceso">En Proceso</SelectItem>
                            <SelectItem value="finalizado">Finalizado</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-1">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setConsumosActuales(consumosActuales.filter((_, i) => i !== idx))}>
                          <X className="w-3 h-3 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="bg-yellow-50 p-3 rounded text-sm">
              <p className="font-semibold mb-1">⚠️ Impacto en Inventario:</p>
              <p className="text-xs">• Estado <strong>Borrador/En Proceso:</strong> Solo registro, no descuenta inventario</p>
              <p className="text-xs">• Estado <strong>Finalizado:</strong> Descuenta "Inventario de Insumos y Químicos" + "Inventario en Proceso" (crosta)</p>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowConsumosModal(false)}>Cancelar</Button>
            <Button onClick={guardarConsumos}>Guardar Consumos</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}