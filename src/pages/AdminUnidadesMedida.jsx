
import React, { useState, useEffect, useCallback } from "react";
import { UnidadMedida } from "@/entities/UnidadMedida";
import DataTable from "../components/common/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Eye } from "lucide-react";

export default function AdminUnidadesMedida() {
    const [unidades, setUnidades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await UnidadMedida.list();
            setUnidades(data);
        } catch (error) {
            alert("Error al cargar las unidades de medida.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item || { nombre: '', abreviatura: '' });
        setShowModal(true);
    };

    const handleOpenDetailModal = (item) => {
        setSelectedItem(item);
        setShowDetailModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await UnidadMedida.update(currentItem.id, currentItem);
            } else {
                await UnidadMedida.create(currentItem);
            }
            alert("Unidad de medida guardada.");
            setShowModal(false);
            loadData();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Eliminar esta unidad de medida?")) {
            try {
                await UnidadMedida.delete(id);
                alert("Unidad eliminada.");
                loadData();
            } catch (error) {
                alert("Error al eliminar.");
            }
        }
    };

    const headers = ["Nombre", "Abreviatura", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{item.nombre}</td>
            <td>{item.abreviatura}</td>
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
            {/* PageHeader removed, its content moved to CardHeader */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Unidades de Medida</CardTitle>
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Unidad
                    </Button>
                </CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={unidades} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? "Editar" : "Nueva"} Unidad de Medida</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="nombre">Nombre (ej: Kilogramo)</Label>
                                <Input id="nombre" value={currentItem?.nombre || ''} onChange={(e) => setCurrentItem({ ...currentItem, nombre: e.target.value })} required />
                            </div>
                            <div>
                                <Label htmlFor="abreviatura">Abreviatura (ej: kg)</Label>
                                <Input id="abreviatura" value={currentItem?.abreviatura || ''} onChange={(e) => setCurrentItem({ ...currentItem, abreviatura: e.target.value })} required />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Detail Modal */}
            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{selectedItem?.nombre} ({selectedItem?.abreviatura})</DialogTitle>
                        <DialogDescription>Detalles de la Unidad de Medida</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 pt-4">
                        <p><strong>Nombre:</strong> {selectedItem?.nombre}</p>
                        <p><strong>Abreviatura:</strong> {selectedItem?.abreviatura}</p>
                    </div>
                    {/* The explicit close button here is removed as per outline, relying on dialog's default close behavior */}
                </DialogContent>
            </Dialog>
        </div>
    );
}
