import React, { useState, useEffect, useCallback } from 'react';
import { TransferenciaCaja, Caja, MovimientoCaja } from '@/entities/all';
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

export default function CajaTransferencias() {
    const [transferencias, setTransferencias] = useState([]);
    const [cajas, setCajas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [transData, cajasData] = await Promise.all([
                TransferenciaCaja.list(),
                Caja.list()
            ]);
            setTransferencias(transData);
            setCajas(cajasData.filter(c => c.estado === 'activa'));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = (item = null) => {
        const nextNum = transferencias.length + 1;
        setCurrentItem(item || {
            numero_transferencia: `TRANS-${String(nextNum).padStart(4, '0')}`,
            origen_caja_id: '',
            origen_codigo: '',
            origen_nombre: '',
            destino_caja_id: '',
            destino_codigo: '',
            destino_nombre: '',
            valor: 0,
            fecha: new Date().toISOString().split('T')[0],
            concepto: '',
            responsable: '',
            estado: 'registrada',
            observaciones_referencia: ''
        });
        setShowModal(true);
    };

    const handleInputChange = (field, value) => {
        setCurrentItem(prev => {
            const updated = { ...prev, [field]: value };
            
            if (field === 'origen_caja_id') {
                const caja = cajas.find(c => c.id === value);
                if (caja) {
                    updated.origen_codigo = caja.codigo_caja || '';
                    updated.origen_nombre = caja.nombre || '';
                }
            }
            
            if (field === 'destino_caja_id') {
                const caja = cajas.find(c => c.id === value);
                if (caja) {
                    updated.destino_codigo = caja.codigo_caja || '';
                    updated.destino_nombre = caja.nombre || '';
                }
            }
            
            return updated;
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        // Validaciones
        if (currentItem.origen_caja_id === currentItem.destino_caja_id) {
            alert('Error: La caja origen y destino no pueden ser la misma.');
            return;
        }
        
        if (currentItem.valor <= 0) {
            alert('Error: El valor debe ser mayor a cero.');
            return;
        }
        
        const cajaOrigen = cajas.find(c => c.id === currentItem.origen_caja_id);
        if (!cajaOrigen || cajaOrigen.saldo_actual < currentItem.valor) {
            alert('Error: La caja origen no tiene saldo suficiente.');
            return;
        }
        
        const cajaDestino = cajas.find(c => c.id === currentItem.destino_caja_id);
        if (cajaDestino && cajaDestino.tipo === 'menor') {
            const nuevoSaldoDestino = cajaDestino.saldo_actual + currentItem.valor;
            if (nuevoSaldoDestino > cajaDestino.limite_monto) {
                alert(`Error: El saldo de caja menor excedería el límite de ${formatCurrency(cajaDestino.limite_monto)}.`);
                return;
            }
        }
        
        try {
            // Crear transferencia
            const transferencia = await TransferenciaCaja.create(currentItem);
            
            // Generar movimiento de salida en caja origen
            const movOrigen = await MovimientoCaja.create({
                caja_id: currentItem.origen_caja_id,
                codigo_caja: currentItem.origen_codigo,
                nombre_caja: currentItem.origen_nombre,
                fecha: currentItem.fecha,
                tipo: 'salida',
                concepto: `Transferencia a ${currentItem.destino_nombre} - ${currentItem.concepto}`,
                responsable: currentItem.responsable,
                valor_entrada: 0,
                valor_salida: currentItem.valor,
                saldo: cajaOrigen.saldo_actual - currentItem.valor,
                observaciones: `Transfer. ${currentItem.numero_transferencia}`
            });
            
            // Generar movimiento de entrada en caja destino
            const movDestino = await MovimientoCaja.create({
                caja_id: currentItem.destino_caja_id,
                codigo_caja: currentItem.destino_codigo,
                nombre_caja: currentItem.destino_nombre,
                fecha: currentItem.fecha,
                tipo: 'entrada',
                concepto: `Transferencia desde ${currentItem.origen_nombre} - ${currentItem.concepto}`,
                responsable: currentItem.responsable,
                valor_entrada: currentItem.valor,
                valor_salida: 0,
                saldo: cajaDestino.saldo_actual + currentItem.valor,
                observaciones: `Transfer. ${currentItem.numero_transferencia}`
            });
            
            // Actualizar saldos de cajas
            await Caja.update(currentItem.origen_caja_id, { saldo_actual: cajaOrigen.saldo_actual - currentItem.valor });
            await Caja.update(currentItem.destino_caja_id, { saldo_actual: cajaDestino.saldo_actual + currentItem.valor });
            
            // Actualizar transferencia con IDs de movimientos
            await TransferenciaCaja.update(transferencia.id, {
                movimiento_origen_id: movOrigen.id,
                movimiento_destino_id: movDestino.id,
                estado: 'aplicada'
            });
            
            setShowModal(false);
            loadData();
            alert('Transferencia registrada y aplicada correctamente.');
        } catch (e) {
            console.error(e);
            alert('Error al guardar transferencia.');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar esta transferencia?')) return;
        try {
            await TransferenciaCaja.delete(id);
            loadData();
        } catch (e) { alert('Error al eliminar.'); }
    };

    const headers = ["Núm. Transfer.", "Fecha", "Origen", "Destino", "Valor", "Responsable", "Estado", "Acciones"];
    const renderRow = (t) => (
        <tr key={t.id}>
            <td className="font-mono font-bold">{t.numero_transferencia}</td>
            <td>{new Date(t.fecha).toLocaleDateString()}</td>
            <td>{t.origen_nombre}</td>
            <td>{t.destino_nombre}</td>
            <td className="text-right font-bold">{formatCurrency(t.valor)}</td>
            <td>{t.responsable || 'N/A'}</td>
            <td>
                <span className={`px-2 py-1 rounded text-xs ${
                    t.estado === 'registrada' ? 'bg-yellow-100 text-yellow-700' :
                    t.estado === 'aplicada' ? 'bg-green-100 text-green-700' :
                    'bg-red-100 text-red-700'
                }`}>
                    {t.estado?.toUpperCase()}
                </span>
            </td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(t)} disabled={t.estado === 'aplicada'}><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(t.id)} disabled={t.estado === 'aplicada'}><Trash2 className="w-4 h-4" /></Button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <PageHeader 
                title="Transferencias entre Cajas" 
                description="Gestión de transferencias de efectivo entre cajas."
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Transferencia
                    </Button>
                }
            />
            <Card>
                <CardHeader><CardTitle>Listado de Transferencias</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={transferencias} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Nueva Transferencia entre Cajas</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div><Label>Número de Transferencia</Label><Input value={currentItem?.numero_transferencia} readOnly className="bg-gray-100 font-mono font-bold" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Caja Origen *</Label>
                                <Select value={currentItem?.origen_caja_id} onValueChange={v => handleInputChange('origen_caja_id', v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo_caja} - {c.nombre} (Saldo: {formatCurrency(c.saldo_actual)})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Caja Destino *</Label>
                                <Select value={currentItem?.destino_caja_id} onValueChange={v => handleInputChange('destino_caja_id', v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.codigo_caja} - {c.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Valor *</Label><Input type="number" value={currentItem?.valor} onChange={e => handleInputChange('valor', parseFloat(e.target.value) || 0)} required /></div>
                            <div><Label>Fecha *</Label><Input type="date" value={currentItem?.fecha} onChange={e => handleInputChange('fecha', e.target.value)} required /></div>
                        </div>
                        <div><Label>Concepto *</Label><Input value={currentItem?.concepto} onChange={e => handleInputChange('concepto', e.target.value)} required placeholder="Ej: Reembolso caja menor" /></div>
                        <div><Label>Responsable</Label><Input value={currentItem?.responsable} onChange={e => handleInputChange('responsable', e.target.value)} /></div>
                        <div>
                            <Label>Estado</Label>
                            <Select value={currentItem?.estado} onValueChange={v => handleInputChange('estado', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="registrada">REGISTRADA</SelectItem>
                                    <SelectItem value="aplicada">APLICADA</SelectItem>
                                    <SelectItem value="anulada">ANULADA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>Observaciones/Referencia</Label><Textarea value={currentItem?.observaciones_referencia} onChange={e => handleInputChange('observaciones_referencia', e.target.value)} rows={2} /></div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar y Aplicar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}