import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Search, Eye } from 'lucide-react';

// Usamos ProductoCatalogo con categoria = 'tipo_acabado' como almacenamiento flexible
import { ProductoCatalogo } from '@/entities/all';

export default function CatalogoTipoAcabado() {
  const [items, setItems] = useState([]);
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
      // Filtramos por categoria tipo_acabado para no mezclar con otros catálogos
      const data = await ProductoCatalogo.filter({ categoria: 'tipo_acabado' });
      setItems(Array.isArray(data) ? data : []);
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
      nombre_comercial: '', // descripción detallada
      tipo_producto: '',    // familia/grupo
      estado: 'activo',
      categoria: 'tipo_acabado'
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!isEditing) {
      const exists = items.some(p => p.codigo === currentItem.codigo);
      if (exists) { alert('Ya existe un tipo de acabado con este código.'); return; }
    }
    try {
      if (isEditing) {
        await ProductoCatalogo.update(currentItem.id, currentItem);
      } else {
        await ProductoCatalogo.create({ ...currentItem, categoria: 'tipo_acabado' });
      }
      setShowModal(false);
      loadData();
      alert('Tipo de acabado guardado con éxito.');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este tipo de acabado?')) return;
    try { await ProductoCatalogo.delete(id); loadData(); } catch (error) { console.error(error); }
  };

  const filteredData = items.filter(p =>
    p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const headers = ['Código', 'Nombre/Descripción', 'Familia/Grupo', 'Estado', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono">{item.codigo}</td>
      <td>{item.descripcion}</td>
      <td>{item.tipo_producto || 'N/A'}</td>
      <td><span className={`px-2 py-1 rounded-full text-xs ${item.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.estado}</span></td>
      <td>
        <div className="flex gap-2">
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
        title="Catálogo de Tipo de Acabado"
        description="Gestión de los tipos de acabado disponibles para el proceso de pintura."
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" /> Nuevo Tipo de Acabado
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Listado de Tipos de Acabado</CardTitle>
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
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Tipo de Acabado</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Código *</Label><Input value={currentItem?.codigo || ''} onChange={e => setCurrentItem({...currentItem, codigo: e.target.value})} required disabled={isEditing} /></div>
              <div><Label>Nombre / Descripción *</Label><Input value={currentItem?.descripcion || ''} onChange={e => setCurrentItem({...currentItem, descripcion: e.target.value})} required /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Familia / Grupo</Label><Input value={currentItem?.tipo_producto || ''} onChange={e => setCurrentItem({...currentItem, tipo_producto: e.target.value})} placeholder="Ej: NAPA, ENVEJECIDO..." /></div>
              <div>
                <Label>Estado</Label>
                <Select value={currentItem?.estado || 'activo'} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="activo">Activo</SelectItem><SelectItem value="inactivo">Inactivo</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descripción detallada</Label><Textarea value={currentItem?.nombre_comercial || ''} onChange={e => setCurrentItem({...currentItem, nombre_comercial: e.target.value})} rows={2} /></div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle Tipo de Acabado</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-2 text-sm">
              <p><span className="font-semibold">Código:</span> {selectedItem.codigo}</p>
              <p><span className="font-semibold">Nombre:</span> {selectedItem.descripcion}</p>
              <p><span className="font-semibold">Familia/Grupo:</span> {selectedItem.tipo_producto || 'N/A'}</p>
              <p><span className="font-semibold">Descripción:</span> {selectedItem.nombre_comercial || 'N/A'}</p>
              <p><span className="font-semibold">Estado:</span> {selectedItem.estado}</p>
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}