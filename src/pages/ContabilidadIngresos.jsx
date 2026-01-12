import React, { useState, useEffect, useCallback } from 'react';
import { CuentaContable } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function ContabilidadIngresos() {
    const [ingresos, setIngresos] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await CuentaContable.filter({ tipo_cuenta: "otros_ingresos" });
            setIngresos(data);
        } catch (error) { console.error("Error loading data:", error); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    
    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item || { fecha: new Date().toISOString().split('T')[0], tipo_cuenta: "otros_ingresos", concepto: "", valor: 0, estado: "cobrada" });
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
        } catch (error) { alert("Error al guardar."); }
    };
    
    const handleDelete = async (id) => {
        if (confirm("¿Eliminar este ingreso?")) {
            await CuentaContable.delete(id);
            loadData();
        }
    };
    
    const handleExport = () => alert("Función de exportar en desarrollo.");
    const handlePrint = () => window.print();

    const headers = ["Fecha", "Concepto", "Valor", "Referencia", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{new Date(item.fecha).toLocaleDateString()}</td>
            <td>{item.concepto}</td>
            <td>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(item.valor)}</td>
            <td>{item.referencia}</td>
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
                title="Otros Ingresos"
                description="Registra ingresos no relacionados con ventas directas."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Ingreso
                    </Button>
                }
            />
            <Card id="tabla-imprimible">
                <CardHeader><CardTitle>Historial de Otros Ingresos</CardTitle></CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={ingresos} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Ingreso</DialogTitle>
                    </DialogHeader>
                     <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="fecha">Fecha</Label>
                                <Input id="fecha" type="date" value={currentItem?.fecha || ''} onChange={e => setCurrentItem({...currentItem, fecha: e.target.value})} required/>
                            </div>
                             <div>
                                <Label htmlFor="valor">Valor</Label>
                                <Input id="valor" type="number" value={currentItem?.valor || ''} onChange={e => setCurrentItem({...currentItem, valor: parseFloat(e.target.value) || 0})} required/>
                            </div>
                        </div>
                        <div>
                            <Label htmlFor="concepto">Concepto</Label>
                            <Input id="concepto" value={currentItem?.concepto || ''} onChange={e => setCurrentItem({...currentItem, concepto: e.target.value})} required/>
                        </div>
                         <div>
                            <Label htmlFor="referencia">Referencia</Label>
                            <Input id="referencia" value={currentItem?.referencia || ''} onChange={e => setCurrentItem({...currentItem, referencia: e.target.value})} />
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