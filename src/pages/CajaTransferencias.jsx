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
import { Plus } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function CajaTransferencias() {
    const [transferencias, setTransferencias] = useState([]);
    const [cajas, setCajas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState(null);

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

    const handleOpenModal = () => {
        setFormData({
            origen_caja_id: '',
            destino_caja_id: '',
            valor: 0,
            fecha: new Date().toISOString().split('T')[0],
            concepto: '',
            usuario_id: 'current_user'
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        if (formData.origen_caja_id === formData.destino_caja_id) {
            alert('La caja de origen y destino no pueden ser la misma.');
            return;
        }

        try {
            const cajaOrigen = cajas.find(c => c.id === formData.origen_caja_id);
            const cajaDestino = cajas.find(c => c.id === formData.destino_caja_id);

            // Crear movimiento de egreso en caja origen
            const movOrigen = await MovimientoCaja.create({
                caja_id: formData.origen_caja_id,
                fecha: formData.fecha,
                tipo: 'egreso',
                concepto: `Transferencia a ${cajaDestino?.nombre}`,
                monto: formData.valor,
                saldo_anterior: cajaOrigen?.saldo_actual || 0,
                saldo_final: (cajaOrigen?.saldo_actual || 0) - formData.valor,
                documento_soporte: 'Transferencia',
                usuario_id: formData.usuario_id
            });

            // Crear movimiento de ingreso en caja destino
            const movDestino = await MovimientoCaja.create({
                caja_id: formData.destino_caja_id,
                fecha: formData.fecha,
                tipo: 'ingreso',
                concepto: `Transferencia de ${cajaOrigen?.nombre}`,
                monto: formData.valor,
                saldo_anterior: cajaDestino?.saldo_actual || 0,
                saldo_final: (cajaDestino?.saldo_actual || 0) + formData.valor,
                documento_soporte: 'Transferencia',
                usuario_id: formData.usuario_id
            });

            // Registrar la transferencia
            await TransferenciaCaja.create({
                ...formData,
                movimiento_origen_id: movOrigen.id,
                movimiento_destino_id: movDestino.id
            });

            // Actualizar saldos de cajas
            await Caja.update(formData.origen_caja_id, { saldo_actual: (cajaOrigen?.saldo_actual || 0) - formData.valor });
            await Caja.update(formData.destino_caja_id, { saldo_actual: (cajaDestino?.saldo_actual || 0) + formData.valor });

            setShowModal(false);
            loadData();
            alert('Transferencia realizada con éxito.');
        } catch (e) {
            console.error(e);
            alert('Error al realizar la transferencia.');
        }
    };

    const headers = ["Fecha", "Caja Origen", "Caja Destino", "Valor", "Concepto", "Usuario"];
    const renderRow = (t) => {
        const origen = cajas.find(c => c.id === t.origen_caja_id);
        const destino = cajas.find(c => c.id === t.destino_caja_id);
        return (
            <tr key={t.id}>
                <td>{new Date(t.fecha).toLocaleDateString()}</td>
                <td>{origen?.nombre || 'N/A'}</td>
                <td>{destino?.nombre || 'N/A'}</td>
                <td className="text-right font-bold">{formatCurrency(t.valor)}</td>
                <td>{t.concepto}</td>
                <td>{t.usuario_id}</td>
            </tr>
        );
    };

    return (
        <div className="p-6">
            <PageHeader 
                title="Transferencias entre Cajas" 
                description="Gestiona el movimiento de dinero entre cajas."
                actionButton={
                    <Button onClick={handleOpenModal} className="bg-emerald-600 hover:bg-emerald-700">
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
                <DialogContent>
                    <DialogHeader><DialogTitle>Nueva Transferencia</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Caja Origen *</Label>
                                <Select value={formData?.origen_caja_id} onValueChange={v => setFormData({...formData, origen_caja_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} ({formatCurrency(c.saldo_actual)})</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Caja Destino *</Label>
                                <Select value={formData?.destino_caja_id} onValueChange={v => setFormData({...formData, destino_caja_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Valor *</Label><Input type="number" value={formData?.valor} onChange={e => setFormData({...formData, valor: parseFloat(e.target.value) || 0})} required /></div>
                            <div><Label>Fecha *</Label><Input type="date" value={formData?.fecha} onChange={e => setFormData({...formData, fecha: e.target.value})} required /></div>
                        </div>
                        <div><Label>Concepto</Label><Input value={formData?.concepto} onChange={e => setFormData({...formData, concepto: e.target.value})} /></div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Transferir</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}