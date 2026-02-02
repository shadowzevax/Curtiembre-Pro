import React, { useState, useEffect } from 'react';
import { ColorPintura } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';

export default function CatalogoColores() {
  const [colores, setColores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await ColorPintura.list();
      setColores(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    setCurrentItem(item || {
      codigo_color: '',
      nombre_color: '',
      familia_grupo: '',
      color_base_hoja: '',
      estado: 'activo',
      observaciones: ''
    });
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await ColorPintura.update(currentItem.id, currentItem);
      } else {
        await ColorPintura.create(currentItem);
      }
      setShowModal(false);
      setCurrentItem(null);
      await loadData();
      alert('Color guardado con éxito.');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este color?')) return;
    try {
      await ColorPintura.delete(id);
      loadData();
      alert('Color eliminado.');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleExport = () => alert('Función de exportar en desarrollo.');
  const handlePrint = () => window.print();

  const headers = ['Código', 'Nombre', 'Familia/Grupo', 'Color Base', 'Estado', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono">{item.codigo_color}</td>
      <td>{item.nombre_color}</td>
      <td>{item.familia_grupo}</td>
      <td>{item.color_base_hoja}</td>
      <td>
        <span className={`px-2 py-1 rounded text-xs ${
          item.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
        }`}>
          {item.estado.toUpperCase()}
        </span>
      </td>
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
        title="Catálogo de Colores (Pintura)"
        description="Gestiona los colores disponibles para pintura"
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Color
          </Button>
        }
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Colores</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={colores} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Color</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código Color *</Label>
                <Input value={currentItem?.codigo_color || ''} onChange={e => setCurrentItem({...currentItem, codigo_color: e.target.value})} required />
              </div>
              <div>
                <Label>Nombre del Color *</Label>
                <Input value={currentItem?.nombre_color || ''} onChange={e => setCurrentItem({...currentItem, nombre_color: e.target.value})} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Familia/Grupo de Color</Label>
                <Input value={currentItem?.familia_grupo || ''} onChange={e => setCurrentItem({...currentItem, familia_grupo: e.target.value})} />
              </div>
              <div>
                <Label>Color Base de la Hoja</Label>
                <Input value={currentItem?.color_base_hoja || ''} onChange={e => setCurrentItem({...currentItem, color_base_hoja: e.target.value})} />
              </div>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={currentItem?.estado || 'activo'} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={3} />
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
          <DialogHeader><DialogTitle>Detalle del Color</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Código:</span> {selectedItem.codigo_color}</p>
              <p><span className="font-semibold">Nombre:</span> {selectedItem.nombre_color}</p>
              <p><span className="font-semibold">Familia/Grupo:</span> {selectedItem.familia_grupo || 'N/A'}</p>
              <p><span className="font-semibold">Color Base Hoja:</span> {selectedItem.color_base_hoja || 'N/A'}</p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize">{selectedItem.estado}</span></p>
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