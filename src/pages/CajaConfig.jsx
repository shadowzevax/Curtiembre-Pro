import React, { useState, useEffect, useCallback } from 'react';
import { Caja, Empleado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2 } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function CajaConfig() {
    const [cajas, setCajas] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [cajasData, empData] = await Promise.all([
                Caja.list(),
                Empleado.list()
            ]);
            setCajas(cajasData);
            setEmpleados(empData);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        const nextCodigo = cajas.length > 0 ? `CAJ-${String(cajas.length + 1).padStart(3, '0')}` : 'CAJ-001';
        setCurrentItem(item || {
            codigo_caja: nextCodigo,
            nombre: '',
            tipo: 'general',
            responsable_id: '',
            fecha_apertura: new Date().toISOString().split('T')[0],
            saldo_inicial: 0,
            limite_monto: 0,
            saldo_actual: 0,
            estado: 'activa',
            observaciones: ''
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await Caja.update(currentItem.id, currentItem);
            } else {
                await Caja.create(currentItem);
            }
            setShowModal(false);
            loadData();
            alert('Caja guardada.');
        } catch (e) { alert('Error al guardar.'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar esta caja?')) return;
        try {
            await Caja.delete(id);
            loadData();
        } catch (e) { alert('Error al eliminar.'); }
    };

    const headers = ["Código", "Nombre", "Tipo", "Responsable", "Saldo Inicial", "Saldo Actual", "Estado", "Acciones"];
    const renderRow = (c) => {
        const responsable = empleados.find(e => e.id === c.responsable_id);
        return (
            <tr key={c.id}>
                <td className="font-mono font-bold">{c.codigo_caja}</td>
                <td className="font-bold">{c.nombre}</td>
                <td className="capitalize">{c.tipo}</td>
                <td>{responsable?.nombre || 'N/A'}</td>
                <td className="text-right">{formatCurrency(c.saldo_inicial)}</td>
                <td className="text-right font-bold text-emerald-700">{formatCurrency(c.saldo_actual)}</td>
                <td><span className={`px-2 py-1 rounded-full text-xs ${c.estado === 'activa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{c.estado}</span></td>
                <td>
                    <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(c)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(c.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="p-6">
            <PageHeader 
                title="Configuración de Cajas" 
                description="Gestiona las cajas del sistema."
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Caja
                    </Button>
                }
            />
            <Card>
                <CardHeader><CardTitle>Listado de Cajas</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={cajas} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Caja</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div><Label>Código de Caja</Label><Input value={currentItem?.codigo_caja} readOnly className="bg-gray-100 font-mono font-bold" /></div>
                        <div><Label>Nombre de la Caja *</Label><Input value={currentItem?.nombre} onChange={e => setCurrentItem({...currentItem, nombre: e.target.value})} required placeholder="Ej: Caja General, Caja Menor Pablo" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tipo de Caja *</Label>
                                <Select value={currentItem?.tipo} onValueChange={v => setCurrentItem({...currentItem, tipo: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="general">GENERAL</SelectItem>
                                        <SelectItem value="menor">MENOR</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Responsable</Label>
                                <Select value={currentItem?.responsable_id} onValueChange={v => setCurrentItem({...currentItem, responsable_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {empleados.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Fecha de Apertura</Label><Input type="date" value={currentItem?.fecha_apertura} onChange={e => setCurrentItem({...currentItem, fecha_apertura: e.target.value})} /></div>
                            <div><Label>Saldo Inicial</Label><Input type="number" value={currentItem?.saldo_inicial} onChange={e => {
                                const saldo = parseFloat(e.target.value) || 0;
                                setCurrentItem({...currentItem, saldo_inicial: saldo, saldo_actual: isEditing ? currentItem.saldo_actual : saldo});
                            }} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Límite de Monto (Caja Menor)</Label><Input type="number" value={currentItem?.limite_monto} onChange={e => setCurrentItem({...currentItem, limite_monto: parseFloat(e.target.value) || 0})} /></div>
                            <div>
                                <Label>Estado</Label>
                                <Select value={currentItem?.estado} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="activa">ACTIVA</SelectItem>
                                        <SelectItem value="inactiva">INACTIVA</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>
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