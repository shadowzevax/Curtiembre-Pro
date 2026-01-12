import React, { useState, useEffect } from 'react';
import { Actividad } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2 } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import PageHeader from '../components/common/PageHeader';

export default function AdminActividades() {
    const [actividades, setActividades] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await Actividad.list();
            setActividades(data);
        } catch (error) {
            console.error("Error loading actividades:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item || { nombre: '', proceso_asociado: 'general', unidad_produccion: '', costo_plantilla: 0, descripcion: '' });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await Actividad.update(currentItem.id, currentItem);
            } else {
                await Actividad.create(currentItem);
            }
            setShowModal(false);
            loadData();
            alert("Actividad guardada con éxito.");
        } catch (error) {
            console.error("Error saving actividad:", error);
            alert("Error al guardar la actividad.");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de que desea eliminar esta actividad?')) return;
        try {
            await Actividad.delete(id);
            loadData();
            alert("Actividad eliminada con éxito.");
        } catch (error) {
            console.error("Error deleting actividad:", error);
            alert("Error al eliminar la actividad.");
        }
    };

    const handleExport = () => alert("Función de exportar en desarrollo.");
    const handlePrint = () => window.print();

    const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

    const headers = ["Nombre", "Proceso Asociado", "Costo Plantilla", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{item.nombre}</td>
            <td className="capitalize">{item.proceso_asociado}</td>
            <td>{formatCurrency(item.costo_plantilla)}</td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <PageHeader
                title="Gestión de Actividades"
                description="Crea y administra las actividades de los procesos de producción."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Actividad
                    </Button>
                }
            />
            <Card id="tabla-imprimible">
                <CardHeader>
                    <CardTitle>Lista de Actividades</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={actividades} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Actividad</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4 pt-4">
                        <div>
                            <Label htmlFor="nombre">Nombre de la Actividad *</Label>
                            <Input id="nombre" value={currentItem?.nombre || ''} onChange={(e) => setCurrentItem({ ...currentItem, nombre: e.target.value })} required />
                        </div>
                        <div>
                            <Label htmlFor="proceso_asociado">Proceso Asociado *</Label>
                            <Select value={currentItem?.proceso_asociado || 'general'} onValueChange={(value) => setCurrentItem({ ...currentItem, proceso_asociado: value })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="recepcion">Recepción</SelectItem>
                                    <SelectItem value="limpieza">Limpieza</SelectItem>
                                    <SelectItem value="curtido">Curtido</SelectItem>
                                    <SelectItem value="acabado">Acabado</SelectItem>
                                    <SelectItem value="recurtido">Recurtido</SelectItem>
                                    <SelectItem value="general">General</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="costo_plantilla">Costo Plantilla</Label>
                            <Input id="costo_plantilla" type="number" value={currentItem?.costo_plantilla || 0} onChange={(e) => setCurrentItem({ ...currentItem, costo_plantilla: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div>
                            <Label htmlFor="unidad_produccion">Unidad de Producción</Label>
                            <Input id="unidad_produccion" placeholder="Ej: por piel, por lote..." value={currentItem?.unidad_produccion || ''} onChange={(e) => setCurrentItem({ ...currentItem, unidad_produccion: e.target.value })} />
                        </div>
                        <div>
                            <Label htmlFor="descripcion">Descripción</Label>
                            <Input id="descripcion" value={currentItem?.descripcion || ''} onChange={(e) => setCurrentItem({ ...currentItem, descripcion: e.target.value })} />
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