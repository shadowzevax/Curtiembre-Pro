import React, { useState, useEffect, useCallback } from 'react';
import { Servicio } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import PageHeader from '../components/common/PageHeader';

export default function AdminServicios() {
    const [servicios, setServicios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await Servicio.list();
            setServicios(data);
        } catch (error) {
            console.error("Error loading servicios:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item || { 
            codigo: '', 
            nombre: '', 
            descripcion: '', 
            categoria: '',
            tipo_servicio: 'ambos',
            afecta_produccion: false,
            precio_base: 0, 
            unidad_medida: '',
            estado: 'activo'
        });
        setShowModal(true);
    };

    const handleOpenDetailModal = (item) => {
        setSelectedItem(item);
        setShowDetailModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        const isDuplicate = servicios.some(s => 
            s.nombre.trim().toLowerCase() === currentItem.nombre.trim().toLowerCase() && 
            (!isEditing || s.id !== currentItem.id)
        );

        if (isDuplicate) {
            alert('Error: Ya existe un servicio con este nombre.');
            return;
        }

        try {
            const dataToSave = {
                ...currentItem,
                precio_base: parseFloat(currentItem.precio_base) || 0,
            };

            if (isEditing) {
                await Servicio.update(currentItem.id, dataToSave);
            } else {
                await Servicio.create(dataToSave);
            }
            setShowModal(false);
            loadData();
            alert('Servicio guardado exitosamente.');
        } catch (error) {
            console.error("Error saving servicio:", error);
            alert("Error al guardar el servicio.");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de que desea eliminar este servicio?')) return;
        try {
            await Servicio.delete(id);
            loadData();
            alert('Servicio eliminado.');
        } catch (error) {
            console.error("Error deleting servicio:", error);
            alert("Error al eliminar el servicio.");
        }
    };

    const handleExport = () => alert("Función de exportar en desarrollo.");
    const handlePrint = () => window.print();

    const headers = ["Código", "Nombre", "Categoría", "Tipo Servicio", "Precio Base", "Estado", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td className="font-mono">{item.codigo || 'N/A'}</td>
            <td>{item.nombre}</td>
            <td>{item.categoria || 'N/A'}</td>
            <td><span className="text-xs">{item.tipo_servicio?.replace('_', ' ').toUpperCase()}</span></td>
            <td>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(item.precio_base || 0)}</td>
            <td><span className={`px-2 py-1 rounded text-xs ${item.estado === 'activo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{item.estado?.toUpperCase()}</span></td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleOpenDetailModal(item)}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <PageHeader
                title="Gestión de Servicios"
                description="Administra los servicios ofrecidos por la empresa."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Servicio
                    </Button>
                }
            />
            <Card id="tabla-imprimible">
                <CardHeader>
                    <CardTitle>Lista de Servicios</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={servicios} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Servicio</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="codigo">Código *</Label>
                                <Input id="codigo" value={currentItem?.codigo || ''} onChange={(e) => setCurrentItem({ ...currentItem, codigo: e.target.value })} required />
                            </div>
                            <div>
                                <Label htmlFor="nombre">Nombre *</Label>
                                <Input id="nombre" value={currentItem?.nombre || ''} onChange={(e) => setCurrentItem({ ...currentItem, nombre: e.target.value })} required />
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="descripcion">Descripción</Label>
                            <Input id="descripcion" value={currentItem?.descripcion || ''} onChange={(e) => setCurrentItem({ ...currentItem, descripcion: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="categoria">Categoría del Servicio</Label>
                                <Input id="categoria" value={currentItem?.categoria || ''} onChange={(e) => setCurrentItem({ ...currentItem, categoria: e.target.value })} placeholder="Ej: Consultoría, Mantenimiento, etc." />
                            </div>
                            <div>
                                <Label htmlFor="tipo_servicio">Tipo de Servicio *</Label>
                                <Select value={currentItem?.tipo_servicio || 'ambos'} onValueChange={(value) => setCurrentItem({ ...currentItem, tipo_servicio: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="servicio_venta">Servicio de Venta</SelectItem>
                                        <SelectItem value="servicio_compra">Servicio de Compra</SelectItem>
                                        <SelectItem value="ambos">Ambos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="afecta_produccion">Afecta Producción</Label>
                                <Select value={currentItem?.afecta_produccion ? 'si' : 'no'} onValueChange={(value) => setCurrentItem({ ...currentItem, afecta_produccion: value === 'si' })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="si">Sí</SelectItem>
                                        <SelectItem value="no">No</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="precio_base">Precio Base *</Label>
                                <Input id="precio_base" type="number" value={currentItem?.precio_base || ''} onChange={(e) => setCurrentItem({ ...currentItem, precio_base: e.target.value })} required />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="unidad_medida">Unidad de Medida</Label>
                                <Input id="unidad_medida" value={currentItem?.unidad_medida || ''} onChange={(e) => setCurrentItem({ ...currentItem, unidad_medida: e.target.value })} placeholder="Ej: hora, unidad, etc." />
                            </div>
                            <div>
                                <Label htmlFor="estado">Estado</Label>
                                <Select value={currentItem?.estado || 'activo'} onValueChange={(value) => setCurrentItem({ ...currentItem, estado: value })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="activo">Activo</SelectItem>
                                        <SelectItem value="inactivo">Inactivo</SelectItem>
                                    </SelectContent>
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
                    <DialogHeader>
                        <DialogTitle>{selectedItem?.nombre}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2 pt-4">
                        <p><strong>Código:</strong> {selectedItem?.codigo || 'N/A'}</p>
                        <p><strong>Descripción:</strong> {selectedItem?.descripcion || 'N/A'}</p>
                        <p><strong>Categoría:</strong> {selectedItem?.categoria_servicio || 'N/A'}</p>
                        <p><strong>Tipo:</strong> {selectedItem?.es_servicio_interno ? '🏢 Interno' : '🌐 Externo'}</p>
                        <p><strong>Precio Base:</strong> {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(selectedItem?.precio_base || 0)}</p>
                        <p><strong>Unidad:</strong> {selectedItem?.unidad}</p>
                        {selectedItem?.observaciones && <p><strong>Observaciones:</strong> {selectedItem.observaciones}</p>}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}