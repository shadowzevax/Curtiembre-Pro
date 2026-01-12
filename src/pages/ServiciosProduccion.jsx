import React, { useState, useEffect, useCallback } from 'react';
import { ServicioProduccion, ProcesoProduccion } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Table } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function ServiciosProduccion() {
    const [servicios, setServicios] = useState([]);
    const [lotes, setLotes] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [formData, setFormData] = useState({});
    const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
    const [loteConsolidado, setLoteConsolidado] = useState(null);

    const loadData = useCallback(async () => {
        try {
            const [serviciosData, lotesData] = await Promise.all([
                ServicioProduccion.list(),
                ProcesoProduccion.filter({ tipo_proceso: 'recepcion' })
            ]);
            setServicios(serviciosData);
            setLotes(lotesData);
        } catch (e) { console.error(e); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item);
        setFormData(item || {
            tipo_servicio: 'secado_llano',
            codigo_lote: '',
            fecha_envio: '',
            fecha_entrega: '',
            cantidad_hojas: 0,
            cantidad_pieles: 0,
            costo_servicio: 0,
            observaciones: ''
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) await ServicioProduccion.update(currentItem.id, formData);
            else await ServicioProduccion.create(formData);
            setShowModal(false);
            loadData();
            alert("Servicio guardado.");
        } catch (e) { alert("Error al guardar."); }
    };

    const headers = ["Tipo", "Lote", "Fecha Envío", "Cant. Hojas", "Costo", "Acciones"];
    const renderRow = (s) => (
        <tr key={s.id}>
            <td className="capitalize">{s.tipo_servicio.replace('_', ' ')}</td>
            <td>{s.codigo_lote}</td>
            <td>{s.fecha_envio}</td>
            <td>{s.cantidad_hojas}</td>
            <td className="text-right">{formatCurrency(s.costo_servicio)}</td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => { setLoteConsolidado(s.codigo_lote); setShowConsolidadoModal(true); }} title="Ver Consolidado"><Table className="w-4 h-4 text-emerald-600" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(s)}><Edit className="w-4 h-4" /></Button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <PageHeader title="Servicios de Producción" description="Gestión de servicios externos de producción." actionButton={<Button onClick={() => handleOpenModal()}><Plus className="w-4 h-4 mr-2"/> Nuevo Servicio</Button>} />
            <Card>
                <CardContent><DataTable headers={headers} data={servicios} renderRow={renderRow} /></CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Servicio</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <Label>Tipo de Servicio</Label>
                            <Select value={formData.tipo_servicio} onValueChange={v => setFormData({...formData, tipo_servicio: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="secado_llano">Secado al Llano</SelectItem>
                                    <SelectItem value="dividida">Dividida</SelectItem>
                                    <SelectItem value="escurrida_rebajada">Escurrida y Rebajada</SelectItem>
                                    <SelectItem value="templado_cuero">Templado del Cuero</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Código Lote *</Label>
                            <Select value={formData.codigo_lote} onValueChange={v => {
                                const selectedLote = lotes.find(l => l.codigo_lote === v);
                                setFormData({...formData, codigo_lote: v, loteInfo: selectedLote});
                            }}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar lote" /></SelectTrigger>
                                <SelectContent>
                                    {lotes.map(lote => (
                                        <SelectItem key={lote.id} value={lote.codigo_lote}>
                                            {lote.codigo_lote} - {lote.nombre_inventario || 'N/A'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {(formData.tipo_servicio === 'secado_llano' || formData.tipo_servicio === 'templado_cuero') && (
                             <>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Fecha Envío</Label><Input type="date" value={formData.fecha_envio} onChange={e => setFormData({...formData, fecha_envio: e.target.value})} /></div>
                                    <div><Label>Fecha Entrega</Label><Input type="date" value={formData.fecha_entrega} onChange={e => setFormData({...formData, fecha_entrega: e.target.value})} /></div>
                                </div>
                                <div><Label>Cantidad Hojas Enviadas</Label><Input type="number" value={formData.cantidad_hojas} onChange={e => setFormData({...formData, cantidad_hojas: parseFloat(e.target.value)})} /></div>
                             </>
                        )}

                        {formData.tipo_servicio === 'dividida' && (
                            <>
                                <div><Label>Fecha Dividida</Label><Input type="date" value={formData.fecha_servicio} onChange={e => setFormData({...formData, fecha_servicio: e.target.value})} /></div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><Label>Cantidad Pieles</Label><Input type="number" value={formData.cantidad_pieles} onChange={e => setFormData({...formData, cantidad_pieles: parseFloat(e.target.value)})} /></div>
                                    <div><Label>Cantidad Hojas</Label><Input type="number" value={formData.cantidad_hojas} onChange={e => setFormData({...formData, cantidad_hojas: parseFloat(e.target.value)})} /></div>
                                </div>
                            </>
                        )}
                        
                        <div><Label>Costo del Servicio</Label><Input type="number" value={formData.costo_servicio} onChange={e => setFormData({...formData, costo_servicio: parseFloat(e.target.value)})} /></div>
                        <div><Label>Observaciones</Label><Textarea value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} /></div>

                        <div className="flex justify-end pt-4"><Button type="submit">Guardar</Button></div>
                    </form>
                </DialogContent>
            </Dialog>

            {showConsolidadoModal && (
                <LoteDetalleConsolidado 
                    open={showConsolidadoModal}
                    onOpenChange={setShowConsolidadoModal}
                    codigoLote={loteConsolidado}
                />
            )}
        </div>
    );
}