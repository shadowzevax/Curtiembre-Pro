import React, { useState, useEffect, useCallback } from 'react';
import { MovimientoCaja, Caja } from '@/entities/all';
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
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [movsData, cajasData] = await Promise.all([
                MovimientoCaja.list(),
                Caja.list()
            ]);
            setMovimientos(movsData);
            setCajas(cajasData);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        if (item) {
            setCurrentItem(item);
        } else {
            setCurrentItem({
                caja_id: '',
                codigo_caja: '',
                nombre_caja: '',
                fecha: new Date().toISOString().split('T')[0],
                tipo: 'entrada',
                concepto: '',
                responsable: '',
                valor_entrada: 0,
                valor_salida: 0,
                saldo: 0,
                observaciones: '',
                documento_soporte: '',
                usuario_id: 'current_user'
            });
        }
        setShowModal(true);
    };

    const handleInputChange = async (field, value) => {
        setCurrentItem(prev => {
            const updated = { ...prev, [field]: value };
            
            // Si cambia la caja, traer código y nombre
            if (field === 'caja_id') {
                const caja = cajas.find(c => c.id === value);
                if (caja) {
                    updated.codigo_caja = caja.codigo_caja || '';
                    updated.nombre_caja = caja.nombre || '';
                    const saldoActual = caja.saldo_actual || 0;
                    updated.saldo = saldoActual;
                }
            }
            
            // Bloquear campos según tipo
            if (field === 'valor_entrada' && value > 0) {
                updated.valor_salida = 0;
                updated.tipo = 'entrada';
            }
            if (field === 'valor_salida' && value > 0) {
                updated.valor_entrada = 0;
                updated.tipo = 'salida';
            }
            
            // Calcular saldo
            if (field === 'valor_entrada' || field === 'valor_salida' || field === 'caja_id') {
                const caja = cajas.find(c => c.id === updated.caja_id);
                const saldoActual = caja ? (caja.saldo_actual || 0) : 0;
                const entrada = parseFloat(updated.valor_entrada) || 0;
                const salida = parseFloat(updated.valor_salida) || 0;
                updated.saldo = saldoActual + entrada - salida;
            }
            
            return updated;
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            // Validar caja menor límite
            if (currentItem.tipo === 'entrada') {
                const caja = cajas.find(c => c.id === currentItem.caja_id);
                if (caja && caja.tipo === 'menor' && currentItem.saldo > caja.limite_monto) {
                    alert(`Error: El saldo excedería el límite de ${formatCurrency(caja.limite_monto)} para caja menor.`);
                    return;
                }
            }
            
            if (isEditing) {
                await MovimientoCaja.update(currentItem.id, currentItem);
            } else {
                await MovimientoCaja.create(currentItem);
                // Actualizar saldo de la caja
                await Caja.update(currentItem.caja_id, { saldo_actual: currentItem.saldo });
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

    const headers = ["Fecha", "Código Caja", "Nombre Caja", "Tipo", "Concepto", "Responsable", "Entrada", "Salida", "Saldo", "Acciones"];
    const renderRow = (m) => {
        return (
            <tr key={m.id}>
                <td>{new Date(m.fecha).toLocaleDateString()}</td>
                <td className="font-mono">{m.codigo_caja || 'N/A'}</td>
                <td>{m.nombre_caja || 'N/A'}</td>
                <td className={m.tipo === 'entrada' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{m.tipo?.toUpperCase()}</td>
                <td>{m.concepto}</td>
                <td>{m.responsable || 'N/A'}</td>
                <td className="text-right font-bold text-green-600">{formatCurrency(m.valor_entrada)}</td>
                <td className="text-right font-bold text-red-600">{formatCurrency(m.valor_salida)}</td>
                <td className="text-right font-bold">{formatCurrency(m.saldo)}</td>
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
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Código de Caja *</Label>
                                <Select value={currentItem?.caja_id} onValueChange={v => handleInputChange('caja_id', v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar código" /></SelectTrigger>
                                    <SelectContent>
                                        {cajas.filter(c => c.estado === 'activa').map(c => (
                                            <SelectItem key={c.id} value={c.id}>{c.codigo_caja || c.nombre}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Nombre de la Caja *</Label>
                                <Input value={currentItem?.nombre_caja} readOnly className="bg-gray-100" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Fecha *</Label><Input type="date" value={currentItem?.fecha} onChange={e => handleInputChange('fecha', e.target.value)} required /></div>
                            <div>
                                <Label>Tipo de Movimiento *</Label>
                                <Select value={currentItem?.tipo} onValueChange={v => handleInputChange('tipo', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="entrada">ENTRADA</SelectItem>
                                        <SelectItem value="salida">SALIDA</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div><Label>Concepto *</Label><Input value={currentItem?.concepto} onChange={e => handleInputChange('concepto', e.target.value)} required /></div>
                        <div><Label>Responsable</Label><Input value={currentItem?.responsable} onChange={e => handleInputChange('responsable', e.target.value)} placeholder="Nombre del responsable" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Valor Entrada</Label><Input type="number" value={currentItem?.valor_entrada} onChange={e => handleInputChange('valor_entrada', parseFloat(e.target.value) || 0)} disabled={currentItem?.valor_salida > 0} className={currentItem?.valor_salida > 0 ? 'bg-gray-100' : ''} /></div>
                            <div><Label>Valor Salida</Label><Input type="number" value={currentItem?.valor_salida} onChange={e => handleInputChange('valor_salida', parseFloat(e.target.value) || 0)} disabled={currentItem?.valor_entrada > 0} className={currentItem?.valor_entrada > 0 ? 'bg-gray-100' : ''} /></div>
                        </div>
                        <div><Label>Saldo (Automático)</Label><Input type="number" value={currentItem?.saldo} readOnly className="bg-emerald-50 font-bold text-lg" /></div>
                        <div><Label>Observaciones</Label><Input value={currentItem?.observaciones} onChange={e => handleInputChange('observaciones', e.target.value)} /></div>
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