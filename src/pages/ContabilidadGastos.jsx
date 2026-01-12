import React, { useState, useEffect, useCallback } from "react";
import { CuentaContable, TipoGasto } from "@/entities/all";
import PageHeader from "../components/common/PageHeader";
import DataTable from "../components/common/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ContabilidadGastos() {
    const [gastos, setGastos] = useState([]);
    const [tiposGasto, setTiposGasto] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [gastosData, tiposData] = await Promise.all([
                CuentaContable.filter({ tipo_cuenta: "gastos" }),
                TipoGasto.list()
            ]);
            setGastos(gastosData);
            setTiposGasto(tiposData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item || {
            fecha: new Date().toISOString().split('T')[0],
            tipo_cuenta: "gastos",
            concepto: "",
            valor: 0,
            referencia: "",
            estado: "pagada",
            proveedor_cliente_id: "" // For tipo_gasto_id
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await CuentaContable.update(currentItem.id, currentItem);
            } else {
                await CuentaContable.create(currentItem);
            }
            setShowModal(false);
            loadData();
        } catch (error) {
            console.error("Error saving gasto:", error);
            alert("Error al guardar el gasto.");
        }
    };
    
    const handleDelete = async (id) => {
        if (confirm("¿Eliminar este gasto?")) {
            await CuentaContable.delete(id);
            loadData();
        }
    };
    
    const handleExport = () => alert("Función de exportar en desarrollo.");
    const handlePrint = () => window.print();

    const headers = ["Fecha", "Concepto", "Tipo de Gasto", "Valor", "Referencia", "Acciones"];
    const renderRow = (gasto) => (
        <tr key={gasto.id}>
            <td>{new Date(gasto.fecha).toLocaleDateString()}</td>
            <td>{gasto.concepto}</td>
            <td>{tiposGasto.find(t => t.id === gasto.proveedor_cliente_id)?.nombre || "N/A"}</td>
            <td>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(gasto.valor || 0)}</td>
            <td>{gasto.referencia}</td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(gasto)}><Edit className="w-4 h-4"/></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(gasto.id)}><Trash2 className="w-4 h-4"/></Button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <PageHeader
                title="Registro de Gastos"
                description="Administra los gastos operativos y administrativos."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="mr-2 h-4 w-4" /> Registrar Gasto
                    </Button>
                }
            />
            <Card id="tabla-imprimible">
                <CardHeader><CardTitle>Historial de Gastos</CardTitle></CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={gastos} renderRow={renderRow} loading={loading}/>
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Gasto</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div>
                            <Label htmlFor="fecha">Fecha</Label>
                            <Input id="fecha" type="date" value={currentItem?.fecha || ''} onChange={e => setCurrentItem({ ...currentItem, fecha: e.target.value })} required />
                        </div>
                        <div>
                            <Label htmlFor="concepto">Concepto</Label>
                            <Input id="concepto" value={currentItem?.concepto || ''} onChange={e => setCurrentItem({ ...currentItem, concepto: e.target.value })} required />
                        </div>
                        <div>
                            <Label htmlFor="tipo_gasto">Tipo de Gasto</Label>
                            <Select value={currentItem?.proveedor_cliente_id || ''} onValueChange={v => setCurrentItem({ ...currentItem, proveedor_cliente_id: v })}>
                                <SelectTrigger><SelectValue placeholder="Seleccione un tipo..." /></SelectTrigger>
                                <SelectContent>
                                    {tiposGasto.map(tipo => <SelectItem key={tipo.id} value={tipo.id}>{tipo.nombre}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="valor">Valor</Label>
                                <Input id="valor" type="number" value={currentItem?.valor || ''} onChange={e => setCurrentItem({ ...currentItem, valor: parseFloat(e.target.value) || 0 })} required />
                            </div>
                            <div>
                                <Label htmlFor="referencia">Referencia (Factura #, etc)</Label>
                                <Input id="referencia" value={currentItem?.referencia || ''} onChange={e => setCurrentItem({ ...currentItem, referencia: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar Gasto</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}