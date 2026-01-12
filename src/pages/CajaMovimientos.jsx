import React, { useState, useEffect, useCallback } from 'react';
import { MovimientoCaja, Caja, Cliente, Proveedor, Empleado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function CajaMovimientos() {
    const [movimientos, setMovimientos] = useState([]);
    const [cajas, setCajas] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [movsData, cajasData, clientesData, provData, empData] = await Promise.all([
                MovimientoCaja.list(),
                Caja.list(),
                Cliente.list(),
                Proveedor.list(),
                Empleado.list()
            ]);
            setMovimientos(movsData);
            setCajas(cajasData);
            setClientes(clientesData);
            setProveedores(provData);
            setEmpleados(empData);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        if (item) {
            setCurrentItem(item);
        } else {
            // Calcular saldo anterior de la caja seleccionada
            setCurrentItem({
                caja_id: '',
                fecha: new Date().toISOString().split('T')[0],
                tipo: 'ingreso',
                concepto: '',
                tercero_id: '',
                tercero_nombre: '',
                monto: 0,
                documento_soporte: '',
                saldo_anterior: 0,
                saldo_final: 0,
                usuario_id: 'current_user'
            });
        }
        setShowModal(true);
    };

    const handleInputChange = async (field, value) => {
        setCurrentItem(prev => {
            const updated = { ...prev, [field]: value };
            
            // Si cambia la caja, calcular saldo anterior
            if (field === 'caja_id') {
                const caja = cajas.find(c => c.id === value);
                if (caja) {
                    updated.saldo_anterior = caja.saldo_actual || 0;
                }
            }
            
            // Calcular saldo final
            if (field === 'monto' || field === 'tipo' || field === 'caja_id') {
                const monto = parseFloat(field === 'monto' ? value : updated.monto) || 0;
                const saldoAnt = parseFloat(updated.saldo_anterior) || 0;
                if (updated.tipo === 'ingreso') {
                    updated.saldo_final = saldoAnt + monto;
                } else {
                    updated.saldo_final = saldoAnt - monto;
                }
            }
            
            return updated;
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await MovimientoCaja.update(currentItem.id, currentItem);
            } else {
                await MovimientoCaja.create(currentItem);
                // Actualizar saldo de la caja
                await Caja.update(currentItem.caja_id, { saldo_actual: currentItem.saldo_final });
            }
            setShowModal(false);
            loadData();
            alert('Movimiento guardado.');
        } catch (e) { alert('Error al guardar.'); }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este movimiento?')) return;
        try {
            await MovimientoCaja.delete(id);
            loadData();
        } catch (e) { alert('Error al eliminar.'); }
    };

    const headers = ["ID", "Fecha", "Caja", "Tipo", "Concepto", "Tercero", "Monto", "Saldo Final", "Acciones"];
    const renderRow = (m) => {
        const caja = cajas.find(c => c.id === m.caja_id);
        return (
            <tr key={m.id}>
                <td>{m.id?.slice(0, 8)}</td>
                <td>{new Date(m.fecha).toLocaleDateString()}</td>
                <td>{caja?.nombre || 'N/A'}</td>
                <td className={m.tipo === 'ingreso' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{m.tipo.toUpperCase()}</td>
                <td>{m.concepto}</td>
                <td>{m.tercero_nombre || 'N/A'}</td>
                <td className="text-right font-bold">{formatCurrency(m.monto)}</td>
                <td className="text-right">{formatCurrency(m.saldo_final)}</td>
                <td>
                    <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(m)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="p-6">
            <PageHeader 
                title="Movimientos de Caja" 
                description="Registro de entradas y salidas de efectivo."
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Movimiento
                    </Button>
                }
            />
            <Card>
                <CardHeader><CardTitle>Listado de Movimientos</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={movimientos} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Movimiento de Caja</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Caja *</Label>
                                <Select value={currentItem?.caja_id} onValueChange={v => handleInputChange('caja_id', v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
                                    <SelectContent>
                                        {cajas.filter(c => c.estado === 'activa').map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Fecha *</Label><Input type="date" value={currentItem?.fecha} onChange={e => handleInputChange('fecha', e.target.value)} required /></div>
                            <div>
                                <Label>Tipo *</Label>
                                <Select value={currentItem?.tipo} onValueChange={v => handleInputChange('tipo', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ingreso">INGRESO</SelectItem>
                                        <SelectItem value="egreso">EGRESO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div><Label>Concepto *</Label><Input value={currentItem?.concepto} onChange={e => handleInputChange('concepto', e.target.value)} required /></div>
                        <div><Label>Tercero</Label><Input value={currentItem?.tercero_nombre} onChange={e => handleInputChange('tercero_nombre', e.target.value)} placeholder="Nombre del tercero" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Monto *</Label><Input type="number" value={currentItem?.monto} onChange={e => handleInputChange('monto', parseFloat(e.target.value) || 0)} required /></div>
                            <div><Label>Documento Soporte</Label><Input value={currentItem?.documento_soporte} onChange={e => handleInputChange('documento_soporte', e.target.value)} placeholder="Ej: RC-001" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg">
                            <div><Label>Saldo Anterior</Label><Input type="number" value={currentItem?.saldo_anterior} readOnly className="bg-gray-100" /></div>
                            <div><Label>Saldo Final</Label><Input type="number" value={currentItem?.saldo_final} readOnly className="bg-emerald-100 font-bold" /></div>
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