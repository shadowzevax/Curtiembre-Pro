import React, { useState, useEffect, useCallback } from 'react';
import { MovimientoBancario, CuentaBancaria, Caja, MovimientoCaja, TransferenciaInterna } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function TransferenciasBancarias() {
    const [transferencias, setTransferencias] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [cajas, setCajas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [movsData, cuentasData, cajasData] = await Promise.all([
                TransferenciaInterna.list(),
                CuentaBancaria.list(),
                Caja.list()
            ]);
            setTransferencias(movsData);
            setCuentas(cuentasData.filter(c => c.estado === 'activa'));
            setCajas(cajasData.filter(c => c.estado === 'activa'));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = () => {
        setCurrentItem({
            tipo_origen: 'cuenta',
            origen_id: '',
            tipo_destino: 'cuenta',
            destino_id: '',
            valor: 0,
            fecha: new Date().toISOString().split('T')[0],
            concepto: '',
            estado: 'registrada',
            referencia: ''
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        if (currentItem.origen_id === currentItem.destino_id && currentItem.tipo_origen === currentItem.tipo_destino) {
            alert('Error: Origen y destino no pueden ser el mismo.');
            return;
        }
        
        try {
            // Obtener origen y destino
            let origenData, destinoData;
            if (currentItem.tipo_origen === 'cuenta') {
                origenData = cuentas.find(c => c.id === currentItem.origen_id);
                if (!origenData || origenData.saldo_actual < currentItem.valor) {
                    alert('Error: Saldo insuficiente en cuenta origen.');
                    return;
                }
            } else {
                origenData = cajas.find(c => c.id === currentItem.origen_id);
                if (!origenData || origenData.saldo_actual < currentItem.valor) {
                    alert('Error: Saldo insuficiente en caja origen.');
                    return;
                }
            }
            
            if (currentItem.tipo_destino === 'cuenta') {
                destinoData = cuentas.find(c => c.id === currentItem.destino_id);
            } else {
                destinoData = cajas.find(c => c.id === currentItem.destino_id);
            }
            
            // Crear Transferencia Interna
            const nuevaTransferencia = await TransferenciaInterna.create({
                cuenta_origen_id: currentItem.origen_id,
                cuenta_destino_id: currentItem.destino_id,
                fecha: currentItem.fecha,
                valor: currentItem.valor,
                concepto: currentItem.concepto,
                estado: 'confirmado'
            });

            // Crear movimientos
            let movOrigenId = null;
            let movDestinoId = null;

            if (currentItem.tipo_origen === 'cuenta') {
                const movOrigen = await MovimientoBancario.create({
                    cuenta_id: currentItem.origen_id,
                    fecha: currentItem.fecha,
                    tipo_movimiento: 'egreso',
                    concepto: `Transferencia a ${currentItem.tipo_destino === 'cuenta' ? destinoData.banco : destinoData.nombre}`,
                    valor: currentItem.valor,
                    saldo_posterior: origenData.saldo_actual - currentItem.valor,
                    estado: 'confirmado',
                    es_automatico: true,
                    documento_origen_tipo: 'TransferenciaInterna',
                    documento_origen_id: nuevaTransferencia.id,
                    observaciones: currentItem.concepto
                });
                movOrigenId = movOrigen.id;
                await CuentaBancaria.update(currentItem.origen_id, { saldo_actual: origenData.saldo_actual - currentItem.valor });
            } else {
                const movOrigen = await MovimientoCaja.create({
                    caja_id: currentItem.origen_id,
                    nombre_caja: origenData.nombre,
                    fecha_movimiento: currentItem.fecha,
                    tipo: 'salida',
                    concepto: `Transferencia a ${currentItem.tipo_destino === 'cuenta' ? destinoData.banco : destinoData.nombre}`,
                    monto: currentItem.valor,
                    saldo_resultante: origenData.saldo_actual - currentItem.valor,
                    documento_origen_tipo: 'TransferenciaInterna',
                    documento_origen_id: nuevaTransferencia.id
                });
                movOrigenId = movOrigen.id;
                await Caja.update(currentItem.origen_id, { saldo_actual: origenData.saldo_actual - currentItem.valor });
            }
            
            if (currentItem.tipo_destino === 'cuenta') {
                const movDestino = await MovimientoBancario.create({
                    cuenta_id: currentItem.destino_id,
                    fecha: currentItem.fecha,
                    tipo_movimiento: 'ingreso',
                    concepto: `Transferencia desde ${currentItem.tipo_origen === 'cuenta' ? origenData.banco : origenData.nombre}`,
                    valor: currentItem.valor,
                    saldo_posterior: destinoData.saldo_actual + currentItem.valor,
                    estado: 'confirmado',
                    es_automatico: true,
                    documento_origen_tipo: 'TransferenciaInterna',
                    documento_origen_id: nuevaTransferencia.id,
                    observaciones: currentItem.concepto
                });
                movDestinoId = movDestino.id;
                await CuentaBancaria.update(currentItem.destino_id, { saldo_actual: destinoData.saldo_actual + currentItem.valor });
            } else {
                const movDestino = await MovimientoCaja.create({
                    caja_id: currentItem.destino_id,
                    nombre_caja: destinoData.nombre,
                    fecha_movimiento: currentItem.fecha,
                    tipo: 'entrada',
                    concepto: `Transferencia desde ${currentItem.tipo_origen === 'cuenta' ? origenData.banco : origenData.nombre}`,
                    monto: currentItem.valor,
                    saldo_resultante: destinoData.saldo_actual + currentItem.valor,
                    documento_origen_tipo: 'TransferenciaInterna',
                    documento_origen_id: nuevaTransferencia.id
                });
                movDestinoId = movDestino.id;
                await Caja.update(currentItem.destino_id, { saldo_actual: destinoData.saldo_actual + currentItem.valor });
            }

            await TransferenciaInterna.update(nuevaTransferencia.id, {
                movimiento_origen_id: movOrigenId,
                movimiento_destino_id: movDestinoId
            });
            
            alert('Transferencia interna registrada exitosamente.');
            setShowModal(false);
            loadData();
        } catch (e) {
            console.error(e);
            alert('Error al guardar.');
        }
    };

    const headers = ["Fecha", "Origen", "Destino", "Valor", "Concepto", "Estado"];
    const renderRow = (t) => {
        const origen = cuentas.find(c => c.id === t.cuenta_origen_id)?.banco || cajas.find(c => c.id === t.cuenta_origen_id)?.nombre || 'N/A';
        const destino = cuentas.find(c => c.id === t.cuenta_destino_id)?.banco || cajas.find(c => c.id === t.cuenta_destino_id)?.nombre || 'N/A';
        return (
            <tr key={t.id}>
                <td>{new Date(t.fecha).toLocaleDateString()}</td>
                <td>{origen}</td>
                <td>{destino}</td>
                <td className="text-right font-bold">{formatCurrency(t.valor)}</td>
                <td>{t.concepto}</td>
                <td><span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">{t.estado}</span></td>
            </tr>
        );
    };

    return (
        <div className="p-4 md:p-6 max-w-full overflow-x-hidden space-y-4">
            <PageHeader 
                title="Transferencias Internas" 
                description="Transferencias entre cuentas bancarias y cajas."
                actionButton={
                    <Button onClick={handleOpenModal} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Transferencia
                    </Button>
                }
            />
            <Card>
                <CardHeader><CardTitle>Listado de Transferencias Internas</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={transferencias} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Nueva Transferencia Interna</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tipo Origen *</Label>
                                <Select value={currentItem?.tipo_origen} onValueChange={v => setCurrentItem({...currentItem, tipo_origen: v, origen_id: ''})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cuenta">Cuenta Bancaria</SelectItem>
                                        <SelectItem value="caja">Caja</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Origen (Cuenta o Caja) *</Label>
                                <Select value={currentItem?.origen_id} onValueChange={v => setCurrentItem({...currentItem, origen_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {currentItem?.tipo_origen === 'cuenta' 
                                            ? cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numero_cuenta}</SelectItem>)
                                            : cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tipo Destino *</Label>
                                <Select value={currentItem?.tipo_destino} onValueChange={v => setCurrentItem({...currentItem, tipo_destino: v, destino_id: ''})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cuenta">Cuenta Bancaria</SelectItem>
                                        <SelectItem value="caja">Caja</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Destino (Cuenta o Caja) *</Label>
                                <Select value={currentItem?.destino_id} onValueChange={v => setCurrentItem({...currentItem, destino_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {currentItem?.tipo_destino === 'cuenta' 
                                            ? cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numero_cuenta}</SelectItem>)
                                            : cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)
                                        }
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Valor *</Label><Input type="number" value={currentItem?.valor} onChange={e => setCurrentItem({...currentItem, valor: parseFloat(e.target.value) || 0})} required /></div>
                            <div><Label>Fecha *</Label><Input type="date" value={currentItem?.fecha} onChange={e => setCurrentItem({...currentItem, fecha: e.target.value})} required /></div>
                        </div>
                        <div><Label>Concepto *</Label><Input value={currentItem?.concepto} onChange={e => setCurrentItem({...currentItem, concepto: e.target.value})} required /></div>
                        <div>
                            <Label>Estado</Label>
                            <Select value={currentItem?.estado} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="registrada">REGISTRADA</SelectItem>
                                    <SelectItem value="aplicada">APLICADA</SelectItem>
                                    <SelectItem value="anulada">ANULADA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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