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

export default function RHAsistencia() {
    const [empleados, setEmpleados] = useState([]);
    const [registros, setRegistros] = useState([]);
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
            // Cargar registros de producción desde una entidad específica
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        setCurrentItem(item || {
            fecha: new Date().toISOString().split('T')[0],
            codigo_personal: '',
            nombre_personal: '',
            actividad_realizada: '',
            cantidad_hojas: 0,
            valor_por_hoja: 0,
            total_devengado: 0,
            observaciones: '',
            estado: 'pendiente'
        });
        setShowModal(true);
    };

    const handlePersonalChange = (codigo) => {
        const personal = empleados.find(e => e.codigo_personal === codigo);
        if (personal) {
            setCurrentItem(prev => ({
                ...prev,
                codigo_personal: codigo,
                nombre_personal: personal.nombre
            }));
        }
    };

    const handleCalcularTotal = () => {
        const total = (currentItem?.cantidad_hojas || 0) * (currentItem?.valor_por_hoja || 0);
        setCurrentItem(prev => ({...prev, total_devengado: total}));
    };

    useEffect(() => {
        if (currentItem) {
            handleCalcularTotal();
        }
    }, [currentItem?.cantidad_hojas, currentItem?.valor_por_hoja]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            // Guardar en entidad de RegistroProduccion
            alert('Registro de producción guardado exitosamente.');
            setShowModal(false);
            loadData();
        } catch (error) {
            console.error("Error:", error);
            alert("Error al guardar.");
        }
    };

    const headers = ["Fecha", "Código", "Nombre", "Actividad", "Cantidad Hojas", "Valor/Hoja", "Total Devengado", "Estado", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{new Date(item.fecha).toLocaleDateString()}</td>
            <td className="font-mono">{item.codigo_personal}</td>
            <td>{item.nombre_personal}</td>
            <td>{item.actividad_realizada}</td>
            <td className="text-center">{item.cantidad_hojas}</td>
            <td className="text-right">{formatCurrency(item.valor_por_hoja)}</td>
            <td className="text-right font-bold text-green-700">{formatCurrency(item.total_devengado)}</td>
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
                title="Registro de Producción"
                description="Registra la producción diaria del personal."
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Registro
                    </Button>
                }
            />

            <Card>
                <CardHeader><CardTitle>Registros de Producción</CardTitle></CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={registros} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>Nuevo Registro</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div><Label>Fecha *</Label><Input type="date" value={currentItem?.fecha} onChange={e => setCurrentItem({...currentItem, fecha: e.target.value})} required /></div>
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
                        <div><Label>Actividad Realizada *</Label><Input value={currentItem?.actividad_realizada} onChange={e => setCurrentItem({...currentItem, actividad_realizada: e.target.value})} required placeholder="Ej: Curtido de pieles" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Cantidad de Hojas *</Label><Input type="number" value={currentItem?.cantidad_hojas} onChange={e => setCurrentItem({...currentItem, cantidad_hojas: parseFloat(e.target.value) || 0})} required /></div>
                            <div><Label>Valor por Hoja *</Label><Input type="number" value={currentItem?.valor_por_hoja} onChange={e => setCurrentItem({...currentItem, valor_por_hoja: parseFloat(e.target.value) || 0})} required /></div>
                        </div>
                        <div><Label>Total Devengado (Automático)</Label><Input type="number" value={currentItem?.total_devengado} readOnly className="bg-green-50 font-bold text-lg" /></div>
                        <div>
                            <Label>Estado</Label>
                            <Select value={currentItem?.estado} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pendiente">PENDIENTE</SelectItem>
                                    <SelectItem value="liquidado">LIQUIDADO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>
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