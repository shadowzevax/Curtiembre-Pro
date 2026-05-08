import React, { useState, useEffect } from 'react';
import { ProductoCatalogo, UnidadMedida, Proveedor } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

const TIPOS_CUERO = [
  { value: 'PELO', label: 'PELO' },
  { value: 'CROSTA', label: 'CROSTA' },
  { value: 'LIJADO', label: 'LIJADO' }
];

export default function CatalogoMateriaPrima() {
  const [productos, setProductos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodData, unidadesData, provData] = await Promise.all([
        ProductoCatalogo.filter({ categoria: 'materia_prima' }),
        UnidadMedida.list(),
        Proveedor.list()
      ]);
      setProductos(prodData);
      setUnidades(unidadesData);
      setProveedores(provData);
    } catch (error) {
      console.error('Error loading data:', error);
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
      nombre_comercial: '',
      unidad_medida: '',
      categoria: 'materia_prima',
      tipo_producto: '',
      maneja_inventario: true,
      stock_minimo: 0,
      stock_maximo: 0,
      proveedor_principal_id: '',
      estado: 'activo'
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isEditing) {
      const exists = productos.some(p => p.codigo === currentItem.codigo);
      if (exists) { alert('Ya existe un producto con este código.'); return; }
    }
    try {
      if (isEditing) {
        await ProductoCatalogo.update(currentItem.id, currentItem);
      } else {
        await ProductoCatalogo.create({ ...currentItem, categoria: 'materia_prima' });
      }
      setShowModal(false);
      loadData();
      alert('Materia prima guardada con éxito.');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try { await ProductoCatalogo.delete(id); loadData(); } catch (error) { console.error(error); }
  };

  const filteredData = productos.filter(p =>
    p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const headers = ['Código', 'Descripción', 'Tipo de Cuero', 'U. Medida', 'Estado', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono">{item.codigo}</td>
      <td>{item.descripcion}</td>
      <td>{item.tipo_cuero || 'N/A'}</td>
      <td>{item.unidad_medida}</td>
      <td><span className={`px-2 py-1 rounded-full text-xs ${item.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.estado}</span></td>
      <td>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Catálogo de Materia Prima"
        description="Gestión maestra de materias primas (pieles y cueros)."
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" /> Nueva Materia Prima
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Listado de Materia Prima</CardTitle>
          <div className="mt-2 relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredData} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Materia Prima</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código *</Label><Input value={currentItem?.codigo || ''} onChange={e => setCurrentItem({...currentItem, codigo: e.target.value})} required disabled={isEditing} /></div>
              <div><Label>Descripción *</Label><Input value={currentItem?.descripcion || ''} onChange={e => setCurrentItem({...currentItem, descripcion: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo de Cuero *</Label>
                <Select value={currentItem?.tipo_cuero || ''} onValueChange={v => setCurrentItem({...currentItem, tipo_cuero: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {TIPOS_CUERO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Nombre Comercial</Label><Input value={currentItem?.nombre_comercial || ''} onChange={e => setCurrentItem({...currentItem, nombre_comercial: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Unidad de Medida</Label>
                <Select value={currentItem?.unidad_medida || ''} onValueChange={v => setCurrentItem({...currentItem, unidad_medida: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {unidades.map(u => <SelectItem key={u.id} value={u.abreviatura}>{u.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Stock Mínimo</Label><Input type="number" value={currentItem?.stock_minimo || 0} onChange={e => setCurrentItem({...currentItem, stock_minimo: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Stock Máximo</Label><Input type="number" value={currentItem?.stock_maximo || 0} onChange={e => setCurrentItem({...currentItem, stock_maximo: parseFloat(e.target.value) || 0})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Proveedor Principal</Label>
                <Select value={currentItem?.proveedor_principal_id || ''} onValueChange={v => setCurrentItem({...currentItem, proveedor_principal_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>{proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
    </div>
  );
}