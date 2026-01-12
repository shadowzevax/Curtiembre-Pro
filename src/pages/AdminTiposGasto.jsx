import React, { useState, useEffect, useCallback } from "react";
import { TipoGasto } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import DataTable from "../components/common/DataTable";
import PageHeader from "../components/common/PageHeader";

export default function AdminTiposGasto() {
    const [tipos, setTipos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await TipoGasto.list();
            setTipos(data);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item || { nombre: '', descripcion: '' });
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
                await TipoGasto.update(currentItem.id, currentItem);
            } else {
                await TipoGasto.create(currentItem);
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            console.error("Error saving item:", error);
            alert("Error al guardar.");
        }
    };

    const handleDelete = async (id) => {
        if (confirm("¿Eliminar este tipo de gasto?")) {
            await TipoGasto.delete(id);
            loadData();
        }
    };

    const handleExport = () => alert("Función de exportar en desarrollo.");
    const handlePrint = () => window.print();

    const headers = ["Nombre", "Descripción", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{item.nombre}</td>
            <td>{item.descripcion}</td>
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
                title="Tipos de Gasto"
                description="Administra las categorías para los gastos."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="mr-2 h-4 w-4" /> Nuevo Tipo de Gasto
                    </Button>
                }
            />
            <Card id="tabla-imprimible">
                <CardHeader><CardTitle>Lista de Tipos de Gasto</CardTitle></CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={tipos} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Tipo de Gasto</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4 pt-4">
                        <div>
                            <Label htmlFor="nombre">Nombre</Label>
                            <Input id="nombre" value={currentItem?.nombre || ''} onChange={(e) => setCurrentItem({ ...currentItem, nombre: e.target.value })} required />
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

            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                 <DialogContent>
                    <DialogHeader><DialogTitle>{selectedItem?.nombre}</DialogTitle></DialogHeader>
                    <div className="space-y-2 pt-4">
                        <p><strong>Descripción:</strong> {selectedItem?.descripcion || 'N/A'}</p>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}