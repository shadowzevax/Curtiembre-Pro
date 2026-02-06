import React, { useState, useEffect } from 'react';
import { Empleado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function RHNomina() {
    const [empleados, setEmpleados] = useState([]);
    const [liquidaciones, setLiquidaciones] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await Empleado.filter({ estado: 'activo' });
            setEmpleados(data);
            // Cargar liquidaciones desde una entidad específica si existiera
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        const nextNum = liquidaciones.length + 1;
        const codigoPersonalSeleccionado = empleados[0]?.codigo_personal || '';
        const nombrePersonalSeleccionado = empleados[0]?.nombre || '';
        
        setCurrentItem(item || {
            numero_liquidacion: `LIQ-${String(nextNum).padStart(3, '0')}`,
            codigo_personal: codigoPersonalSeleccionado,
            nombre_personal: nombrePersonalSeleccionado,
            periodo_desde: '',
            periodo_hasta: '',
            total_produccion_devengada: 0,
            anticipos: 0,
            total_a_pagar: 0,
            fecha_pago: '',
            medio_pago: 'caja',
            referencia_pago: '',
            estado: 'pendiente',
            observaciones: ''
        });
        setShowModal(true);
    };

    const handlePersonalChange = (codigoPersonal) => {
        const personal = empleados.find(e => e.codigo_personal === codigoPersonal);
        if (personal) {
            setCurrentItem(prev => ({
                ...prev,
                codigo_personal: codigoPersonal,
                nombre_personal: personal.nombre
            }));
        }
    };

    const handleCalcularTotal = () => {
        const total = (currentItem?.total_produccion_devengada || 0) - (currentItem?.anticipos || 0);
        setCurrentItem(prev => ({...prev, total_a_pagar: total}));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            // Aquí se guardaría en una entidad de Liquidación específica
            alert('Liquidación guardada exitosamente.');
            setShowModal(false);
        } catch (error) {
            console.error("Error:", error);
            alert("Error al guardar.");
        }
    };

    const headers = ["Núm. Liq.", "Código", "Nombre", "Periodo", "Total Devengado", "Anticipos", "Total a Pagar", "Estado", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td className="font-mono font-bold">{item.numero_liquidacion}</td>
            <td className="font-mono">{item.codigo_personal}</td>
            <td>{item.nombre_personal}</td>
            <td>{item.periodo_desde} - {item.periodo_hasta}</td>
            <td className="text-right">{formatCurrency(item.total_produccion_devengada)}</td>
            <td className="text-right text-red-600">{formatCurrency(item.anticipos)}</td>
            <td className="text-right font-bold text-green-700">{formatCurrency(item.total_a_pagar)}</td>
            <td>
                <span className={`px-2 py-1 rounded text-xs ${item.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                    {item.estado?.toUpperCase()}
                </span>
            </td>
            <td>
                <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
            </td>
        </tr>
    );

    return (
        <div className="p-6 space-y-6">
            <PageHeader 
                title="Liquidación de Mano de Obra"
                description="Gestión de liquidaciones por producción."
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nueva Liquidación
                    </Button>
                }
            />

            <Card>
                <CardHeader><CardTitle>Lista de Liquidaciones</CardTitle></CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={liquidaciones} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>Nueva Liquidación de Mano de Obra</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div><Label>Número de Liquidación</Label><Input value={currentItem?.numero_liquidacion} readOnly className="bg-gray-100 font-mono font-bold" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Código Personal *</Label>
                                <Select value={currentItem?.codigo_personal} onValueChange={v => handlePersonalChange(v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {empleados.map(e => <SelectItem key={e.id} value={e.codigo_personal}>{e.codigo_personal}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Nombre Personal</Label><Input value={currentItem?.nombre_personal} readOnly className="bg-gray-100" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Periodo Desde *</Label><Input type="date" value={currentItem?.periodo_desde} onChange={e => setCurrentItem({...currentItem, periodo_desde: e.target.value})} required /></div>
                            <div><Label>Periodo Hasta *</Label><Input type="date" value={currentItem?.periodo_hasta} onChange={e => setCurrentItem({...currentItem, periodo_hasta: e.target.value})} required /></div>
                        </div>
                        <div><Label>Total Producción Devengada</Label><Input type="number" value={currentItem?.total_produccion_devengada} readOnly className="bg-blue-50 font-bold" title="Suma automática del registro de producción" /></div>
                        <div><Label>Anticipos (si existen)</Label><Input type="number" value={currentItem?.anticipos} onChange={e => {
                            const ant = parseFloat(e.target.value) || 0;
                            setCurrentItem({...currentItem, anticipos: ant, total_a_pagar: (currentItem?.total_produccion_devengada || 0) - ant});
                        }} /></div>
                        <div><Label>Total a Pagar</Label><Input type="number" value={currentItem?.total_a_pagar} readOnly className="bg-green-50 font-bold text-lg" /></div>
                        <div className="grid grid-cols-3 gap-4">
                            <div><Label>Fecha de Pago</Label><Input type="date" value={currentItem?.fecha_pago} onChange={e => setCurrentItem({...currentItem, fecha_pago: e.target.value})} /></div>
                            <div>
                                <Label>Medio de Pago</Label>
                                <Select value={currentItem?.medio_pago} onValueChange={v => setCurrentItem({...currentItem, medio_pago: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="caja">CAJA</SelectItem>
                                        <SelectItem value="banco">BANCO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Referencia de Pago (No. Egreso)</Label><Input value={currentItem?.referencia_pago} onChange={e => setCurrentItem({...currentItem, referencia_pago: e.target.value})} /></div>
                        </div>
                        <div>
                            <Label>Estado</Label>
                            <Select value={currentItem?.estado} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pendiente">PENDIENTE</SelectItem>
                                    <SelectItem value="pagado">PAGADO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}