import React, { useState, useEffect, useCallback } from 'react';
import { MovimientoBancario, CuentaBancaria } from '@/entities/all';
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

export default function MovimientosBancarios() {
    const [movimientos, setMovimientos] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [movsData, cuentasData] = await Promise.all([
                MovimientoBancario.list(),
                CuentaBancaria.list()
            ]);
            setMovimientos(movsData);
            setCuentas(cuentasData.filter(c => c.estado === 'activa'));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = (item = null) => {
        setCurrentItem(item || {
            cuenta_id: '',
            fecha: new Date().toISOString().split('T')[0],
            tipo_movimiento: 'ingreso',
            concepto: '',
            referencia: '',
            valor_entrada: 0,
            valor_salida: 0,
            saldo: 0,
            relacion_caja: '',
            tercero_nombre: '',
            observaciones: ''
        });
        setShowModal(true);
    };

    const handleInputChange = (field, value) => {
        setCurrentItem(prev => {
            const updated = { ...prev, [field]: value };
            
            if (field === 'cuenta_id') {
                const cuenta = cuentas.find(c => c.id === value);
                if (cuenta) {
                    updated.saldo = cuenta.saldo_actual || 0;
                }
            }
            
            // Bloquear entrada/salida según tipo
            if (field === 'tipo_movimiento') {
                if (value === 'ingreso') {
                    updated.valor_salida = 0;
                } else {
                    updated.valor_entrada = 0;
                }
            }
            
            if (field === 'valor_entrada' && value > 0) {
                updated.valor_salida = 0;
                updated.tipo_movimiento = 'ingreso';
            }
            
            if (field === 'valor_salida' && value > 0) {
                updated.valor_entrada = 0;
                updated.tipo_movimiento = 'egreso';
            }
            
            // Calcular saldo
            if (field === 'valor_entrada' || field === 'valor_salida' || field === 'cuenta_id') {
                const cuenta = cuentas.find(c => c.id === updated.cuenta_id);
                const saldoActual = cuenta ? (cuenta.saldo_actual || 0) : 0;
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
            await MovimientoBancario.create(currentItem);
            
            // Actualizar saldo de cuenta bancaria
            await CuentaBancaria.update(currentItem.cuenta_id, { saldo_actual: currentItem.saldo });
            
            setShowModal(false);
            loadData();
            alert('Movimiento bancario guardado.');
        } catch (e) {
            console.error(e);
            alert('Error al guardar.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este movimiento?')) return;
        try {
            await MovimientoBancario.delete(id);
            loadData();
        } catch (e) { alert('Error al eliminar.'); }
    };

    const headers = ["Fecha", "Cuenta", "Banco", "Tipo", "Concepto", "Entrada", "Salida", "Saldo", "Acciones"];
    const renderRow = (m) => {
        const cuenta = cuentas.find(c => c.id === m.cuenta_id);
        return (
            <tr key={m.id}>
                <td>{new Date(m.fecha).toLocaleDateString()}</td>
                <td className="font-mono">{cuenta?.codigo_cuenta || 'N/A'}</td>
                <td>{cuenta?.banco || 'N/A'}</td>
                <td className={m.tipo_movimiento === 'ingreso' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{m.tipo_movimiento?.toUpperCase()}</td>
                <td>{m.concepto}</td>
                <td className="text-right text-green-600 font-bold">{m.valor_entrada > 0 ? formatCurrency(m.valor_entrada) : '-'}</td>
                <td className="text-right text-red-600 font-bold">{m.valor_salida > 0 ? formatCurrency(m.valor_salida) : '-'}</td>
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
                title="Movimientos Bancarios" 
                description="Registro de movimientos en cuentas bancarias."
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Movimiento
                    </Button>
                }
            />
            <Card>
                <CardHeader><CardTitle>Listado de Movimientos Bancarios</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={movimientos} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Nuevo Movimiento Bancario</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Fecha *</Label><Input type="date" value={currentItem?.fecha} onChange={e => handleInputChange('fecha', e.target.value)} required /></div>
                            <div>
                                <Label>Cuenta Bancaria *</Label>
                                <Select value={currentItem?.cuenta_id} onValueChange={v => handleInputChange('cuenta_id', v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                                    <SelectContent>
                                        {cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numero_cuenta}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Tipo de Movimiento *</Label>
                            <Select value={currentItem?.tipo_movimiento} onValueChange={v => handleInputChange('tipo_movimiento', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ingreso">ENTRADA</SelectItem>
                                    <SelectItem value="egreso">SALIDA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>Concepto *</Label><Input value={currentItem?.concepto} onChange={e => handleInputChange('concepto', e.target.value)} required /></div>
                        <div><Label>Referencia</Label><Input value={currentItem?.referencia} onChange={e => handleInputChange('referencia', e.target.value)} placeholder="Núm. transacción" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Valor Entrada</Label><Input type="number" value={currentItem?.valor_entrada} onChange={e => handleInputChange('valor_entrada', parseFloat(e.target.value) || 0)} disabled={currentItem?.valor_salida > 0} /></div>
                            <div><Label>Valor Salida</Label><Input type="number" value={currentItem?.valor_salida} onChange={e => handleInputChange('valor_salida', parseFloat(e.target.value) || 0)} disabled={currentItem?.valor_entrada > 0} /></div>
                        </div>
                        <div><Label>Saldo (Automático)</Label><Input type="number" value={currentItem?.saldo} readOnly className="bg-blue-50 font-bold text-lg" /></div>
                        <div><Label>Relación con Caja (si aplica)</Label><Input value={currentItem?.relacion_caja} onChange={e => handleInputChange('relacion_caja', e.target.value)} placeholder="Opcional" /></div>
                        <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones} onChange={e => handleInputChange('observaciones', e.target.value)} rows={2} /></div>
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