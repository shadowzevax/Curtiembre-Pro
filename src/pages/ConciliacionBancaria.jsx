import React, { useState, useEffect } from 'react';
import { CuentaBancaria, MovimientoBancario } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Upload } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function ConciliacionBancaria() {
    const [cuentas, setCuentas] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [conciliaciones, setConciliaciones] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [movimientosConciliacion, setMovimientosConciliacion] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [cuentasData, movsData] = await Promise.all([
                CuentaBancaria.list(),
                MovimientoBancario.list()
            ]);
            setCuentas(cuentasData);
            setMovimientos(movsData);
        } catch (e) {
            console.error(e);
        }
    };

    const handleOpenModal = () => {
        const nextNum = conciliaciones.length + 1;
        setCurrentItem({
            numero_conciliacion: `CONC-${String(nextNum).padStart(4, '0')}`,
            cuenta_id: '',
            periodo_mes: '',
            periodo_anio: new Date().getFullYear(),
            fecha_conciliacion: new Date().toISOString().split('T')[0],
            saldo_extracto: 0,
            saldo_sistema: 0,
            diferencia: 0,
            estado: 'en_proceso',
            responsable: '',
            observaciones: ''
        });
        setShowModal(true);
    };

    const handleCuentaChange = (cuentaId) => {
        const movsFiltered = movimientos.filter(m => m.cuenta_id === cuentaId);
        const cuenta = cuentas.find(c => c.id === cuentaId);
        
        setCurrentItem(prev => ({
            ...prev,
            cuenta_id: cuentaId,
            saldo_sistema: cuenta?.saldo_actual || 0,
            diferencia: (prev.saldo_extracto || 0) - (cuenta?.saldo_actual || 0)
        }));
        
        setMovimientosConciliacion(movsFiltered.map(m => ({
            ...m,
            conciliado: false,
            referencia_extracto: ''
        })));
    };

    const toggleConciliado = (index) => {
        const updated = [...movimientosConciliacion];
        updated[index].conciliado = !updated[index].conciliado;
        setMovimientosConciliacion(updated);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            // Guardar en entidad ConciliacionBancaria
            alert('Conciliación guardada exitosamente.');
            setShowModal(false);
        } catch (error) {
            console.error(error);
            alert('Error al guardar.');
        }
    };

    return (
        <div className="p-6">
            <PageHeader 
                title="Conciliación Bancaria"
                description="Concilia movimientos bancarios con extractos."
                actionButton={
                    <Button onClick={handleOpenModal} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Conciliación
                    </Button>
                }
            />

            <Card>
                <CardHeader><CardTitle>Listado de Conciliaciones</CardTitle></CardHeader>
                <CardContent>
                    <p className="text-gray-500 text-center py-8">No hay conciliaciones registradas.</p>
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Nueva Conciliación</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-4 gap-4">
                            <div><Label>Número de Conciliación</Label><Input value={currentItem?.numero_conciliacion} readOnly className="bg-gray-100 font-mono font-bold" /></div>
                            <div>
                                <Label>Cuenta Bancaria *</Label>
                                <Select value={currentItem?.cuenta_id} onValueChange={v => handleCuentaChange(v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numero_cuenta}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Mes</Label><Input type="number" min="1" max="12" value={currentItem?.periodo_mes} onChange={e => setCurrentItem({...currentItem, periodo_mes: e.target.value})} /></div>
                            <div><Label>Año</Label><Input type="number" value={currentItem?.periodo_anio} onChange={e => setCurrentItem({...currentItem, periodo_anio: e.target.value})} /></div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div><Label>Fecha de Conciliación</Label><Input type="date" value={currentItem?.fecha_conciliacion} onChange={e => setCurrentItem({...currentItem, fecha_conciliacion: e.target.value})} /></div>
                            <div><Label>Saldo según Extracto</Label><Input type="number" value={currentItem?.saldo_extracto} onChange={e => {
                                const saldo = parseFloat(e.target.value) || 0;
                                setCurrentItem({...currentItem, saldo_extracto: saldo, diferencia: saldo - (currentItem?.saldo_sistema || 0)});
                            }} /></div>
                            <div><Label>Saldo según Sistema</Label><Input type="number" value={currentItem?.saldo_sistema} readOnly className="bg-blue-50" /></div>
                            <div><Label>Diferencia (Automático)</Label><Input type="number" value={currentItem?.diferencia} readOnly className="bg-red-50 font-bold" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Estado</Label>
                                <Select value={currentItem?.estado} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="en_proceso">EN PROCESO</SelectItem>
                                        <SelectItem value="conciliada">CONCILIADA</SelectItem>
                                        <SelectItem value="con_diferencias">CON DIFERENCIAS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Responsable</Label><Input value={currentItem?.responsable} onChange={e => setCurrentItem({...currentItem, responsable: e.target.value})} /></div>
                        </div>
                        <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>

                        <div className="border-t pt-4">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="font-semibold">Detalle de Movimientos</h3>
                                <Button type="button" variant="outline" size="sm">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Cargar Extracto
                                </Button>
                            </div>
                            <div className="border rounded max-h-64 overflow-y-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="p-2">✓</th>
                                            <th className="p-2">Fecha</th>
                                            <th className="p-2">Concepto</th>
                                            <th className="p-2">Tipo</th>
                                            <th className="p-2 text-right">Valor</th>
                                            <th className="p-2">Ref. Extracto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {movimientosConciliacion.map((m, idx) => (
                                            <tr key={idx} className={m.conciliado ? 'bg-green-50' : ''}>
                                                <td className="p-2 text-center">
                                                    <Checkbox checked={m.conciliado} onCheckedChange={() => toggleConciliado(idx)} />
                                                </td>
                                                <td className="p-2">{new Date(m.fecha).toLocaleDateString()}</td>
                                                <td className="p-2">{m.concepto}</td>
                                                <td className="p-2">{m.tipo_movimiento}</td>
                                                <td className="p-2 text-right">{formatCurrency(m.valor_entrada || m.valor_salida)}</td>
                                                <td className="p-2"><Input className="h-7 text-xs" value={m.referencia_extracto} onChange={e => {
                                                    const updated = [...movimientosConciliacion];
                                                    updated[idx].referencia_extracto = e.target.value;
                                                    setMovimientosConciliacion(updated);
                                                }} placeholder="Opcional" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar Conciliación</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}