import React, { useState, useEffect } from 'react';
import { ProductoTerminado, UnidadMedida } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Search, Eye } from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);

export default function CatalogoProductosTerminados() {
  const [productos, setProductos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodData, unidadesData] = await Promise.all([
        ProductoTerminado.list(),
        UnidadMedida.list()
      ]);
      setProductos(prodData);
      setUnidades(unidadesData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    setCurrentItem(item || {
      codigo: '',
      descripcion: '',
      tipo_cuero: '',
      tipo_acabado: '',
      color_final: '',
      unidad_medida: 'HOJA',
      stock_actual: 0,
      stock_minimo: 0,
      costo_promedio: 0,
      precio_venta_1: 0,
      categoria: 'hojas_procesadas',
      estado: 'activo'
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await ProductoTerminado.update(currentItem.id, currentItem);
      } else {
        // Descripción automática
        const desc = [currentItem.tipo_cuero, currentItem.tipo_acabado, currentItem.color_final].filter(Boolean).join(' - ').toUpperCase();
        await ProductoTerminado.create({ ...currentItem, descripcion: desc || currentItem.descripcion });
      }
      setShowModal(false);
      loadData();
      alert('Producto terminado guardado con éxito.');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este producto terminado?')) return;
    try { await ProductoTerminado.delete(id); loadData(); } catch (error) { console.error(error); }
  };

  const filteredData = productos.filter(p =>
    p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.tipo_cuero?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.tipo_acabado?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.color_final?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const headers = ['Código', 'Descripción', 'Tipo Cuero', 'Tipo Acabado', 'Color Final', 'Stock', 'U.M.', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono text-xs">{item.codigo}</td>
      <td className="text-sm">{item.descripcion}</td>
      <td><span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">{item.tipo_cuero || 'N/A'}</span></td>
      <td><span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{item.tipo_acabado || 'N/A'}</span></td>
      <td>{item.color_final || 'N/A'}</td>
      <td className="text-center font-bold">{item.stock_actual || 0}</td>
      <td className="text-center">{item.unidad_medida || 'HOJA'}</td>
      <td>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => { setSelectedItem(item); setShowDetailModal(true); }}><Eye className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Catálogo de Productos Terminados"
        description="Control de productos terminados por tipo de cuero, acabado y color final."
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Listado de Productos Terminados</CardTitle>
          <div className="mt-2 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por código, tipo, acabado, color..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredData} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Producto Terminado</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código *</Label><Input value={currentItem?.codigo || ''} onChange={e => setCurrentItem({...currentItem, codigo: e.target.value})} required disabled={isEditing} /></div>
              <div><Label>Descripción</Label><Input value={currentItem?.descripcion || ''} onChange={e => setCurrentItem({...currentItem, descripcion: e.target.value})} placeholder="Se genera automática al crear" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Tipo de Cuero</Label>
                <Select value={currentItem?.tipo_cuero || ''} onValueChange={v => setCurrentItem({...currentItem, tipo_cuero: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PELO">PELO</SelectItem>
                    <SelectItem value="CROSTA">CROSTA</SelectItem>
                    <SelectItem value="LIJADO">LIJADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tipo de Acabado</Label>
                <Select value={currentItem?.tipo_acabado || ''} onValueChange={v => setCurrentItem({...currentItem, tipo_acabado: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAPA">NAPA</SelectItem>
                    <SelectItem value="OTROS">OTROS ACABADOS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Color Final</Label><Input value={currentItem?.color_final || ''} onChange={e => setCurrentItem({...currentItem, color_final: e.target.value})} placeholder="Ej: NEGRO" /></div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>Unidad de Medida</Label>
                <Select value={currentItem?.unidad_medida || 'HOJA'} onValueChange={v => setCurrentItem({...currentItem, unidad_medida: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOJA">HOJA</SelectItem>
                    {unidades.map(u => <SelectItem key={u.id} value={u.abreviatura}>{u.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Stock Actual</Label><Input type="number" value={currentItem?.stock_actual || 0} onChange={e => setCurrentItem({...currentItem, stock_actual: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Stock Mínimo</Label><Input type="number" value={currentItem?.stock_minimo || 0} onChange={e => setCurrentItem({...currentItem, stock_minimo: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Costo Promedio</Label><Input type="number" value={currentItem?.costo_promedio || 0} onChange={e => setCurrentItem({...currentItem, costo_promedio: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Precio Venta</Label><Input type="number" value={currentItem?.precio_venta_1 || 0} onChange={e => setCurrentItem({...currentItem, precio_venta_1: parseFloat(e.target.value) || 0})} /></div>
              <div>
                <Label>Estado</Label>
                <Select value={currentItem?.estado || 'activo'} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="activo">Activo</SelectItem><SelectItem value="inactivo">Inactivo</SelectItem></SelectContent>
                </Select>
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
          <DialogHeader><DialogTitle>Detalle Producto Terminado</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Código:</span> {selectedItem.codigo}</p>
              <p><span className="font-semibold">Descripción:</span> {selectedItem.descripcion}</p>
              <p><span className="font-semibold">Tipo de Cuero:</span> {selectedItem.tipo_cuero || 'N/A'}</p>
              <p><span className="font-semibold">Tipo de Acabado:</span> {selectedItem.tipo_acabado || 'N/A'}</p>
              <p><span className="font-semibold">Color Final:</span> {selectedItem.color_final || 'N/A'}</p>
              <p><span className="font-semibold">Stock Actual:</span> {selectedItem.stock_actual || 0} {selectedItem.unidad_medida || 'HOJA'}</p>
              <p><span className="font-semibold">Costo Promedio:</span> {formatCurrency(selectedItem.costo_promedio)}</p>
              <p><span className="font-semibold">Precio Venta:</span> {formatCurrency(selectedItem.precio_venta_1)}</p>
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}