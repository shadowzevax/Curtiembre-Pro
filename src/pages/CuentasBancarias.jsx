import React, { useState, useEffect } from 'react';
import { CuentaBancaria } from '@/entities/all';
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

export default function CuentasBancarias() {
    const [cuentas, setCuentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    useEffect(() => { loadData(); }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await CuentaBancaria.list();
            setCuentas(data);
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        const nextCodigo = `CTA-${String((cuentas.length || 0) + 1).padStart(3, '0')}`;
        setCurrentItem(item || {
            codigo_cuenta: nextCodigo,
            tipo_cuenta: 'cuenta_corriente',
            banco: '',
            numero_cuenta: '',
            titular: '',
            saldo_actual: 0,
            moneda: 'COP',
            estado: 'activa',
            observaciones: ''
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await CuentaBancaria.update(currentItem.id, currentItem);
            } else {
                await CuentaBancaria.create(currentItem);
            }
            setShowModal(false);
            loadData();
            alert('Cuenta guardada exitosamente.');
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar esta cuenta?')) return;
        try {
            await CuentaBancaria.delete(id);
            loadData();
        } catch (error) {
            console.error('Error:', error);
        }
    };

    const headers = ['Banco', 'Tipo', 'No. Cuenta', 'Titular', 'Saldo', 'Estado', 'Acciones'];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{item.banco}</td>
            <td className="capitalize">{item.tipo_cuenta?.replace('_', ' ')}</td>
            <td>{item.numero_cuenta}</td>
            <td>{item.titular}</td>
            <td className="text-right font-bold text-emerald-700">{formatCurrency(item.saldo_actual)}</td>
            <td><span className={`px-2 py-1 rounded-full text-xs ${item.estado === 'activa' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.estado}</span></td>
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
                title="Cuentas Bancarias"
                description="Gestión de cuentas bancarias y billeteras digitales."
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Cuenta
                    </Button>
                }
            />
            <Card>
                <CardHeader><CardTitle>Listado de Cuentas</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={cuentas} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Cuenta</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div><Label>Tipo de Cuenta *</Label><Select value={currentItem?.tipo_cuenta} onValueChange={v => setCurrentItem({...currentItem, tipo_cuenta: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cuenta_corriente">Cuenta Corriente</SelectItem><SelectItem value="cuenta_ahorros">Cuenta de Ahorros</SelectItem><SelectItem value="nequi">Nequi</SelectItem><SelectItem value="daviplata">Daviplata</SelectItem><SelectItem value="otra_billetera">Otra Billetera</SelectItem></SelectContent></Select></div>
                        <div><Label>Banco/Entidad *</Label><Input value={currentItem?.banco} onChange={e => setCurrentItem({...currentItem, banco: e.target.value})} required /></div>
                        <div><Label>No. Cuenta *</Label><Input value={currentItem?.numero_cuenta} onChange={e => setCurrentItem({...currentItem, numero_cuenta: e.target.value})} required /></div>
                        <div><Label>Titular</Label><Input value={currentItem?.titular} onChange={e => setCurrentItem({...currentItem, titular: e.target.value})} /></div>
                        <div><Label>Saldo Inicial</Label><Input type="number" value={currentItem?.saldo_actual} onChange={e => setCurrentItem({...currentItem, saldo_actual: parseFloat(e.target.value) || 0})} /></div>
                        <div><Label>Estado</Label><Select value={currentItem?.estado} onValueChange={v => setCurrentItem({...currentItem, estado: v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="activa">Activa</SelectItem><SelectItem value="inactiva">Inactiva</SelectItem></SelectContent></Select></div>
                        <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} /></div>
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