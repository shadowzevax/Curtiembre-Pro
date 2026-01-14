import React, { useState, useEffect } from 'react';
import { TrasladoInventario, ProductoCatalogo, MovimientoInventario, Insumo, ProductoTerminado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Eye, Trash2, Package, ArrowRightLeft } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function TrasladoInventarioPage() {
  const [traslados, setTraslados] = useState([]);
  const [filteredTraslados, setFilteredTraslados] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTraslado, setSelectedTraslado] = useState(null);
  const [productosCatalogo, setProductosCatalogo] = useState([]);

  const [formData, setFormData] = useState({
    fecha_traslado: new Date().toISOString().split('T')[0],
    ubicacion_origen: '',
    ubicacion_destino: '',
    responsable_entrega: '',
    responsable_recibe: '',
    estado: 'pendiente',
    motivo: '',
    observaciones: '',
    items: []
  });

  const [currentItem, setCurrentItem] = useState({
    producto_id: '',
    codigo: '',
    descripcion: '',
    cantidad_trasladada: 0,
    cantidad_recibida: 0,
    unidad_medida: '',
    categoria: '',
    costo_unitario: 0,
    observaciones_item: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const filtered = traslados.filter(t =>
      t.numero_traslado?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ubicacion_origen?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ubicacion_destino?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredTraslados(filtered);
  }, [searchTerm, traslados]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [trasladosData, catalogoData] = await Promise.all([
        TrasladoInventario.list(),
        ProductoCatalogo.list()
      ]);
      setTraslados(trasladosData);
      setFilteredTraslados(trasladosData);
      setProductosCatalogo(catalogoData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    const nextNumber = `TRS-${String(traslados.length + 1).padStart(4, '0')}`;
    setFormData({
      numero_traslado: nextNumber,
      fecha_traslado: new Date().toISOString().split('T')[0],
      ubicacion_origen: '',
      ubicacion_destino: '',
      responsable_entrega: '',
      responsable_recibe: '',
      estado: 'pendiente',
      motivo: '',
      observaciones: '',
      items: []
    });
    setShowModal(true);
  };

  const handleAddItem = () => {
    if (!currentItem.codigo || !currentItem.cantidad_trasladada) {
      alert('Por favor complete el código y la cantidad');
      return;
    }
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, { ...currentItem }]
    }));
    setCurrentItem({
      producto_id: '',
      codigo: '',
      descripcion: '',
      cantidad_trasladada: 0,
      cantidad_recibida: 0,
      unidad_medida: '',
      categoria: '',
      costo_unitario: 0,
      observaciones_item: ''
    });
  };

  const handleRemoveItem = (index) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const handleProductSelect = async (codigo) => {
    const producto = productosCatalogo.find(p => p.codigo === codigo);
    if (producto) {
      setCurrentItem(prev => ({
        ...prev,
        codigo: producto.codigo,
        descripcion: producto.descripcion,
        unidad_medida: producto.unidad_medida,
        categoria: producto.categoria,
        costo_unitario: producto.costo_estandar || 0
      }));
    }
  };

  const handleSaveTraslado = async () => {
    if (!formData.ubicacion_origen || !formData.ubicacion_destino || formData.items.length === 0) {
      alert('Complete todos los campos obligatorios y agregue al menos un ítem');
      return;
    }

    try {
      await TrasladoInventario.create(formData);
      alert('Traslado registrado exitosamente');
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving traslado:', error);
      alert('Error al guardar el traslado');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Está seguro de eliminar este traslado?')) {
      try {
        await TrasladoInventario.delete(id);
        alert('Traslado eliminado');
        loadData();
      } catch (error) {
        alert('Error al eliminar');
      }
    }
  };

  const handleViewDetail = (traslado) => {
    setSelectedTraslado(traslado);
    setShowDetailModal(true);
  };

  const headers = ['No. Traslado', 'Fecha', 'Origen', 'Destino', 'Estado', 'Items', 'Responsable', 'Acciones'];
  const renderRow = (traslado) => (
    <tr key={traslado.id}>
      <td className="font-mono">{traslado.numero_traslado}</td>
      <td>{formatDate(traslado.fecha_traslado)}</td>
      <td>{traslado.ubicacion_origen}</td>
      <td>{traslado.ubicacion_destino}</td>
      <td>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          traslado.estado === 'recibido' ? 'bg-green-100 text-green-700' :
          traslado.estado === 'en_transito' ? 'bg-blue-100 text-blue-700' :
          traslado.estado === 'cancelado' ? 'bg-red-100 text-red-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {traslado.estado}
        </span>
      </td>
      <td>{traslado.items?.length || 0}</td>
      <td>{traslado.responsable_entrega}</td>
      <td>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleViewDetail(traslado)}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(traslado.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Traslado de Inventarios"
        description="Gestión de traslados entre ubicaciones o bodegas"
        actionButton={
          <Button onClick={handleOpenModal} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Traslado
          </Button>
        }
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Buscar por número, origen o destino..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Listado de Traslados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <DataTable headers={headers} data={filteredTraslados} renderRow={renderRow} />
          )}
        </CardContent>
      </Card>

      {/* Modal Nuevo Traslado */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo Traslado de Inventario</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>No. Traslado</Label>
              <Input value={formData.numero_traslado} readOnly className="bg-gray-100" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={formData.fecha_traslado} onChange={(e) => setFormData({...formData, fecha_traslado: e.target.value})} />
            </div>
            <div>
              <Label>Ubicación Origen *</Label>
              <Input value={formData.ubicacion_origen} onChange={(e) => setFormData({...formData, ubicacion_origen: e.target.value})} />
            </div>
            <div>
              <Label>Ubicación Destino *</Label>
              <Input value={formData.ubicacion_destino} onChange={(e) => setFormData({...formData, ubicacion_destino: e.target.value})} />
            </div>
            <div>
              <Label>Responsable Entrega</Label>
              <Input value={formData.responsable_entrega} onChange={(e) => setFormData({...formData, responsable_entrega: e.target.value})} />
            </div>
            <div>
              <Label>Responsable Recibe</Label>
              <Input value={formData.responsable_recibe} onChange={(e) => setFormData({...formData, responsable_recibe: e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Motivo</Label>
              <Input value={formData.motivo} onChange={(e) => setFormData({...formData, motivo: e.target.value})} />
            </div>
            <div className="col-span-2">
              <Label>Observaciones</Label>
              <Textarea value={formData.observaciones} onChange={(e) => setFormData({...formData, observaciones: e.target.value})} />
            </div>
          </div>

          <div className="mt-6 border-t pt-4">
            <h3 className="font-semibold mb-3">Agregar Productos</h3>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div className="col-span-2">
                <Label>Código</Label>
                <Select value={currentItem.codigo} onValueChange={handleProductSelect}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {productosCatalogo.map(p => (
                      <SelectItem key={p.id} value={p.codigo}>{p.codigo} - {p.descripcion}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Cantidad</Label>
                <Input type="number" value={currentItem.cantidad_trasladada} onChange={(e) => setCurrentItem({...currentItem, cantidad_trasladada: parseFloat(e.target.value) || 0, cantidad_recibida: parseFloat(e.target.value) || 0})} />
              </div>
              <div>
                <Button onClick={handleAddItem} className="mt-6">Agregar</Button>
              </div>
            </div>

            {formData.items.length > 0 && (
              <div className="border rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-2 text-left">Código</th>
                      <th className="p-2 text-left">Descripción</th>
                      <th className="p-2 text-right">Cantidad</th>
                      <th className="p-2 text-left">U.M.</th>
                      <th className="p-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.items.map((item, index) => (
                      <tr key={index} className="border-t">
                        <td className="p-2">{item.codigo}</td>
                        <td className="p-2">{item.descripcion}</td>
                        <td className="p-2 text-right">{item.cantidad_trasladada}</td>
                        <td className="p-2">{item.unidad_medida}</td>
                        <td className="p-2">
                          <Button variant="destructive" size="sm" onClick={() => handleRemoveItem(index)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveTraslado}>Guardar Traslado</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalle del Traslado</DialogTitle>
          </DialogHeader>
          {selectedTraslado && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <p><span className="font-semibold">No. Traslado:</span> {selectedTraslado.numero_traslado}</p>
                <p><span className="font-semibold">Fecha:</span> {formatDate(selectedTraslado.fecha_traslado)}</p>
                <p><span className="font-semibold">Origen:</span> {selectedTraslado.ubicacion_origen}</p>
                <p><span className="font-semibold">Destino:</span> {selectedTraslado.ubicacion_destino}</p>
                <p><span className="font-semibold">Entrega:</span> {selectedTraslado.responsable_entrega}</p>
                <p><span className="font-semibold">Recibe:</span> {selectedTraslado.responsable_recibe}</p>
                <p className="col-span-2"><span className="font-semibold">Motivo:</span> {selectedTraslado.motivo}</p>
              </div>
              {selectedTraslado.items && selectedTraslado.items.length > 0 && (
                <div className="border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-2 text-left">Código</th>
                        <th className="p-2 text-left">Descripción</th>
                        <th className="p-2 text-right">Cant. Traslado</th>
                        <th className="p-2 text-right">Cant. Recibida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTraslado.items.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">{item.codigo}</td>
                          <td className="p-2">{item.descripcion}</td>
                          <td className="p-2 text-right">{item.cantidad_trasladada}</td>
                          <td className="p-2 text-right">{item.cantidad_recibida}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}