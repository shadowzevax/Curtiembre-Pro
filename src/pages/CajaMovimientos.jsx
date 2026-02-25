import React, { useState, useEffect, useCallback } from 'react';
import { MovimientoCaja, Caja, TransferenciaCaja } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, ArrowRightLeft } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function CajaMovimientos() {
    const [movimientos, setMovimientos] = useState([]);
    const [movimientosFiltrados, setMovimientosFiltrados] = useState([]);
    const [cajas, setCajas] = useState([]);
    const [codigoCajaSeleccionada, setCodigoCajaSeleccionada] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showTransferenciaModal, setShowTransferenciaModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [transferenciaData, setTransferenciaData] = useState({ valor: 0, concepto: 'Traslado a Caja Menor', responsable: '' });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [movsData, cajasData] = await Promise.all([
                MovimientoCaja.list(),
                Caja.list()
            ]);
            setMovimientos(movsData);
            setCajas(cajasData);
            if (cajasData.length > 0 && !codigoCajaSeleccionada) {
                setCodigoCajaSeleccionada(cajasData[0].codigo_caja);
            }
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [codigoCajaSeleccionada]);

    useEffect(() => { loadData(); }, []);

    useEffect(() => {
        if (codigoCajaSeleccionada) {
            const filtrados = movimientos.filter(m => m.codigo_caja === codigoCajaSeleccionada);
            setMovimientosFiltrados(filtrados);
        }
    }, [codigoCajaSeleccionada, movimientos]);

    const cajaActual = cajas.find(c => c.codigo_caja === codigoCajaSeleccionada);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        if (item) {
            setCurrentItem(item);
        } else {
            setCurrentItem({
                caja_id: cajaActual?.id || '',
                codigo_caja: codigoCajaSeleccionada,
                nombre_caja: cajaActual?.nombre || '',
                fecha: new Date().toISOString().split('T')[0],
                tipo: 'entrada',
                concepto: '',
                responsable: '',
                valor_entrada: 0,
                valor_salida: 0,
                saldo: cajaActual?.saldo_actual || 0,
                observaciones: '',
                documento_soporte: '',
                usuario_id: 'current_user'
            });
        }
        setShowModal(true);
    };

    const handleOpenTransferencia = () => {
        if (codigoCajaSeleccionada !== 'CAJA-GENERAL') {
            alert('Solo puede transferir desde Caja General');
            return;
        }
        setTransferenciaData({ valor: 0, concepto: 'Traslado a Caja Menor', responsable: '' });
        setShowTransferenciaModal(true);
    };

    const handleInputChange = async (field, value) => {
        setCurrentItem(prev => {
            const updated = { ...prev, [field]: value };
            
            if (field === 'caja_id') {
                const caja = cajas.find(c => c.id === value);
                if (caja) {
                    updated.codigo_caja = caja.codigo_caja || '';
                    updated.nombre_caja = caja.nombre || '';
                }
            }
            
            if (field === 'valor_entrada' && value > 0) {
                updated.valor_salida = 0;
                updated.tipo = 'entrada';
            }
            if (field === 'valor_salida' && value > 0) {
                updated.valor_entrada = 0;
                updated.tipo = 'salida';
            }
            
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
            const caja = cajas.find(c => c.id === currentItem.caja_id);
            if (!caja) {
                alert('Debe seleccionar una caja');
                return;
            }

            // Validación: Caja menor solo recibe transferencias
            if (caja.codigo_caja === 'CAJA-MENOR' && currentItem.tipo === 'entrada' && 
                !currentItem.concepto.toLowerCase().includes('recibo desde caja general')) {
                alert('Caja Menor solo puede recibir transferencias desde Caja General');
                return;
            }

            const valor = currentItem.tipo === 'entrada' ? 
                parseFloat(currentItem.valor_entrada) || 0 : 
                parseFloat(currentItem.valor_salida) || 0;

            if (valor <= 0) {
                alert('El valor debe ser mayor a cero');
                return;
            }

            const saldoAnterior = caja.saldo_actual || 0;
            const nuevoSaldo = currentItem.tipo === 'entrada' ? 
                saldoAnterior + valor : 
                saldoAnterior - valor;

            if (nuevoSaldo < 0) {
                alert('Saldo insuficiente en la caja');
                return;
            }
            
            if (isEditing) {
                await MovimientoCaja.update(currentItem.id, {...currentItem, saldo: nuevoSaldo});
            } else {
                await MovimientoCaja.create({...currentItem, saldo: nuevoSaldo});
                await Caja.update(caja.id, { saldo_actual: nuevoSaldo });
            }
            
            setShowModal(false);
            loadData();
            alert('Movimiento guardado.');
        } catch (e) { 
            console.error(e);
            alert('Error al guardar.'); 
        }
    };

    const handleTransferencia = async (e) => {
        e.preventDefault();
        try {
            const valor = parseFloat(transferenciaData.valor) || 0;
            if (valor <= 0) {
                alert('El valor debe ser mayor a cero');
                return;
            }

            const cajaOrigen = cajas.find(c => c.codigo_caja === 'CAJA-GENERAL');
            const cajaDestino = cajas.find(c => c.codigo_caja === 'CAJA-MENOR');

            if (!cajaOrigen || !cajaDestino) {
                alert('No se encontraron las cajas necesarias');
                return;
            }

            if ((cajaOrigen.saldo_actual || 0) < valor) {
                alert('Saldo insuficiente en Caja General');
                return;
            }

            const fecha = new Date().toISOString().split('T')[0];
            const nuevoSaldoOrigen = (cajaOrigen.saldo_actual || 0) - valor;
            const nuevoSaldoDestino = (cajaDestino.saldo_actual || 0) + valor;

            // Crear transferencia
            await TransferenciaCaja.create({
                numero_transferencia: `TRANS-${Date.now()}`,
                origen_caja_id: cajaOrigen.id,
                origen_codigo: cajaOrigen.codigo_caja,
                origen_nombre: cajaOrigen.nombre,
                destino_caja_id: cajaDestino.id,
                destino_codigo: cajaDestino.codigo_caja,
                destino_nombre: cajaDestino.nombre,
                valor,
                fecha,
                concepto: transferenciaData.concepto,
                responsable: transferenciaData.responsable,
                estado: 'aplicada'
            });

            // Registrar egreso en Caja General
            await MovimientoCaja.create({
                caja_id: cajaOrigen.id,
                codigo_caja: cajaOrigen.codigo_caja,
                nombre_caja: cajaOrigen.nombre,
                fecha,
                tipo: 'salida',
                concepto: transferenciaData.concepto || 'Traslado a Caja Menor',
                responsable: transferenciaData.responsable,
                valor_salida: valor,
                saldo: nuevoSaldoOrigen
            });

            // Registrar ingreso en Caja Menor
            await MovimientoCaja.create({
                caja_id: cajaDestino.id,
                codigo_caja: cajaDestino.codigo_caja,
                nombre_caja: cajaDestino.nombre,
                fecha,
                tipo: 'entrada',
                concepto: 'Recibo desde Caja General',
                responsable: transferenciaData.responsable,
                valor_entrada: valor,
                saldo: nuevoSaldoDestino
            });

            // Actualizar saldos
            await Caja.update(cajaOrigen.id, { saldo_actual: nuevoSaldoOrigen });
            await Caja.update(cajaDestino.id, { saldo_actual: nuevoSaldoDestino });

            setShowTransferenciaModal(false);
            loadData();
            alert('Transferencia realizada exitosamente');
        } catch (error) {
            console.error(error);
            alert('Error al realizar la transferencia');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Eliminar este movimiento?')) return;
        try {
            await MovimientoCaja.delete(id);
            loadData();
        } catch (e) { alert('Error al eliminar.'); }
    };

    const headers = ["Fecha", "Código Caja", "Tipo", "Concepto", "Responsable", "Entrada", "Salida", "Saldo", "Acciones"];
    const renderRow = (m) => {
        return (
            <tr key={m.id}>
                <td>{new Date(m.fecha).toLocaleDateString()}</td>
                <td className="font-mono font-bold">{m.codigo_caja || 'N/A'}</td>
                <td>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${m.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {m.tipo?.toUpperCase()}
                    </span>
                </td>
                <td>{m.concepto}</td>
                <td>{m.responsable || 'N/A'}</td>
                <td className="text-right font-bold text-green-600">{formatCurrency(m.valor_entrada)}</td>
                <td className="text-right font-bold text-red-600">{formatCurrency(m.valor_salida)}</td>
                <td className="text-right font-bold">{formatCurrency(m.saldo)}</td>
                <td>
                    <div className="flex space-x-2">
                        <Button variant="destructive" size="sm" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                </td>
            </tr>
        );
    };

    return (
        <div className="p-4 md:p-6 max-w-full overflow-x-hidden space-y-4">
            <PageHeader 
                title="Movimientos de Caja" 
                description="Registro de entradas y salidas de efectivo."
                actionButton={
                    <div className="flex gap-2">
                        <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Movimiento
                        </Button>
                        {codigoCajaSeleccionada === 'CAJA-GENERAL' && (
                            <Button onClick={handleOpenTransferencia} variant="outline" className="border-blue-600 text-blue-700">
                                <ArrowRightLeft className="w-4 h-4 mr-2" />
                                Transferir a Caja Menor
                            </Button>
                        )}
                    </div>
                }
            />

            <Card className="mb-4">
                <CardHeader><CardTitle>Filtro de Caja (Obligatorio)</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Seleccionar Código de Caja *</Label>
                            <Select value={codigoCajaSeleccionada} onValueChange={setCodigoCajaSeleccionada}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {cajas.map(c => (
                                        <SelectItem key={c.id} value={c.codigo_caja}>{c.codigo_caja} - {c.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="bg-blue-50 p-3 rounded flex items-center justify-center">
                            <p className="text-lg font-bold">Saldo Actual: {formatCurrency(cajaActual?.saldo_actual || 0)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>Movimientos de {cajaActual?.nombre || 'Caja'}</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={movimientosFiltrados} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Movimiento de Caja</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Código de Caja *</Label>
                                <Input value={currentItem?.codigo_caja} readOnly className="bg-gray-100 font-bold" />
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
                                        <SelectItem value="entrada">INGRESO</SelectItem>
                                        <SelectItem value="salida">EGRESO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div><Label>Concepto *</Label><Input value={currentItem?.concepto} onChange={e => handleInputChange('concepto', e.target.value)} required /></div>
                        <div><Label>Responsable</Label><Input value={currentItem?.responsable} onChange={e => handleInputChange('responsable', e.target.value)} placeholder="Nombre del responsable" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Valor Entrada</Label><Input type="number" step="0.01" value={currentItem?.valor_entrada} onChange={e => handleInputChange('valor_entrada', parseFloat(e.target.value) || 0)} disabled={currentItem?.valor_salida > 0} className={currentItem?.valor_salida > 0 ? 'bg-gray-100' : ''} /></div>
                            <div><Label>Valor Salida</Label><Input type="number" step="0.01" value={currentItem?.valor_salida} onChange={e => handleInputChange('valor_salida', parseFloat(e.target.value) || 0)} disabled={currentItem?.valor_entrada > 0} className={currentItem?.valor_entrada > 0 ? 'bg-gray-100' : ''} /></div>
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

            <Dialog open={showTransferenciaModal} onOpenChange={setShowTransferenciaModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Transferencia a Caja Menor</DialogTitle></DialogHeader>
                    <form onSubmit={handleTransferencia} className="space-y-4">
                        <div><Label>Valor a Transferir *</Label><Input type="number" step="0.01" value={transferenciaData.valor} onChange={e => setTransferenciaData({...transferenciaData, valor: e.target.value})} required min="0.01" /></div>
                        <div><Label>Concepto</Label><Input value={transferenciaData.concepto} onChange={e => setTransferenciaData({...transferenciaData, concepto: e.target.value})} /></div>
                        <div><Label>Responsable</Label><Input value={transferenciaData.responsable} onChange={e => setTransferenciaData({...transferenciaData, responsable: e.target.value})} /></div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowTransferenciaModal(false)}>Cancelar</Button>
                            <Button type="submit">Realizar Transferencia</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}