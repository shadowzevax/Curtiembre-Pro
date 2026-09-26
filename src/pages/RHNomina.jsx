import React, { useState, useEffect } from 'react';
import { Empleado, LiquidacionNomina } from '@/entities/all';
import { fin, nuevaLlave, anularOperacionFinanciera } from '@/api/finanzas';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, DollarSign, Ban } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

// Integración B4: la liquidación se registra aquí (causación); el pago se hace desde Tesorería/
// Egresos con categoría "nomina", vinculado a esta liquidación. No se paga dos veces la misma.
export default function RHNomina() {
    const [empleados, setEmpleados] = useState([]);
    const [liquidaciones, setLiquidaciones] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showPagoModal, setShowPagoModal] = useState(false);
    const [pagando, setPagando] = useState(null);
    const [pagoForm, setPagoForm] = useState({});
    const [guardandoPago, setGuardandoPago] = useState(false);
    const [errorPago, setErrorPago] = useState('');
    const [currentItem, setCurrentItem] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [empleadosData, liqData, cuentasData] = await Promise.all([
                Empleado.filter({ estado: 'activo' }),
                LiquidacionNomina.list('-created_date'),
                fin.get('/cuentas'),
            ]);
            setEmpleados(empleadosData);
            setLiquidaciones(liqData);
            setCuentas(cuentasData);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        if (item) { setCurrentItem(item); setShowModal(true); return; }
        const maxNum = liquidaciones.reduce((max, l) => {
            const n = parseInt(l.numero_liquidacion?.split('-').pop() || '0');
            return n > max ? n : max;
        }, 0);
        const codigoPersonalSeleccionado = empleados[0]?.codigo_personal || '';
        const nombrePersonalSeleccionado = empleados[0]?.nombre || '';

        setCurrentItem({
            numero_liquidacion: `LIQ-${String(maxNum + 1).padStart(3, '0')}`,
            codigo_personal: codigoPersonalSeleccionado,
            nombre_personal: nombrePersonalSeleccionado,
            periodo_desde: '',
            periodo_hasta: '',
            total_produccion_devengada: 0,
            anticipos: 0,
            total_a_pagar: 0,
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

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (currentItem.id) await LiquidacionNomina.update(currentItem.id, currentItem);
            else await LiquidacionNomina.create(currentItem);
            setShowModal(false);
            loadData();
        } catch (error) {
            console.error("Error:", error);
            alert("Error al guardar: " + error.message);
        }
    };

    const abrirPago = (item) => {
        setPagando(item);
        setPagoForm({ cuenta_id: '', fecha: hoy() });
        setErrorPago('');
        setShowPagoModal(true);
    };

    const registrarPago = async (e) => {
        e.preventDefault();
        if (!pagoForm.cuenta_id) { setErrorPago('Seleccione la cuenta de dinero'); return; }
        setGuardandoPago(true); setErrorPago('');
        try {
            const r = await fin.post('/operaciones/egreso', {
                cuenta_id: pagoForm.cuenta_id, fecha: pagoForm.fecha, valor: pagando.total_a_pagar, categoria: 'nomina',
                concepto: `Nómina ${pagando.numero_liquidacion} · ${pagando.nombre_personal}`, tercero_nombre: pagando.nombre_personal,
                origen_modulo: 'LiquidacionNomina', origen_id: pagando.id, idempotency_key: nuevaLlave(),
            });
            await LiquidacionNomina.update(pagando.id, { estado: 'pagado', fecha_pago: pagoForm.fecha, fin_operacion_id: r.operacion_id,
                documento_pago: r.documento?.numero });
            setShowPagoModal(false);
            loadData();
        } catch (err) { setErrorPago(err.message); } finally { setGuardandoPago(false); }
    };

    const anularPago = async (item) => {
        if (await anularOperacionFinanciera(item.fin_operacion_id, `el pago de nómina ${item.numero_liquidacion}`)) {
            await LiquidacionNomina.update(item.id, { estado: 'pendiente', fin_operacion_id: null, documento_pago: null });
            loadData();
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
                    {item.estado?.toUpperCase()}{item.documento_pago ? ` · ${item.documento_pago}` : ''}
                </span>
            </td>
            <td>
                <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
                    {item.estado === 'pendiente' && item.total_a_pagar > 0 && (
                        <Button variant="outline" size="sm" onClick={() => abrirPago(item)} title="Pagar"><DollarSign className="w-4 h-4 text-emerald-600" /></Button>
                    )}
                    {item.estado === 'pagado' && item.fin_operacion_id && (
                        <Button variant="ghost" size="sm" onClick={() => anularPago(item)} title="Anular pago"><Ban className="w-4 h-4 text-red-500" /></Button>
                    )}
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6 space-y-6">
            <PageHeader
                title="Liquidación de Mano de Obra"
                description="Gestión de liquidaciones por producción. El pago se registra en Finanzas (Tesorería/Egresos)."
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
                    <DialogHeader><DialogTitle>{currentItem?.id ? 'Editar' : 'Nueva'} Liquidación de Mano de Obra</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div><Label>Número de Liquidación</Label><Input value={currentItem?.numero_liquidacion || ''} readOnly className="bg-gray-100 font-mono font-bold" /></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Código Personal *</Label>
                                <Select value={currentItem?.codigo_personal || ''} onValueChange={v => handlePersonalChange(v)}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {empleados.map(e => <SelectItem key={e.id} value={e.codigo_personal}>{e.codigo_personal}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div><Label>Nombre Personal</Label><Input value={currentItem?.nombre_personal || ''} readOnly className="bg-gray-100" /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Periodo Desde *</Label><Input type="date" value={currentItem?.periodo_desde || ''} onChange={e => setCurrentItem({...currentItem, periodo_desde: e.target.value})} required /></div>
                            <div><Label>Periodo Hasta *</Label><Input type="date" value={currentItem?.periodo_hasta || ''} onChange={e => setCurrentItem({...currentItem, periodo_hasta: e.target.value})} required /></div>
                        </div>
                        <div><Label>Total Producción Devengada</Label><Input type="number" value={currentItem?.total_produccion_devengada ?? ''} onChange={e => {
                            const dev = parseFloat(e.target.value) || 0;
                            setCurrentItem({...currentItem, total_produccion_devengada: dev, total_a_pagar: dev - (currentItem?.anticipos || 0)});
                        }} className="font-bold" /></div>
                        <div><Label>Anticipos (si existen)</Label><Input type="number" value={currentItem?.anticipos ?? ''} onChange={e => {
                            const ant = parseFloat(e.target.value) || 0;
                            setCurrentItem({...currentItem, anticipos: ant, total_a_pagar: (currentItem?.total_produccion_devengada || 0) - ant});
                        }} /></div>
                        <div><Label>Total a Pagar</Label><Input type="number" value={currentItem?.total_a_pagar ?? ''} readOnly className="bg-green-50 font-bold text-lg" /></div>
                        <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>
                        {currentItem?.estado === 'pagado' && (
                            <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded p-2">
                                Ya pagada ({currentItem.documento_pago}, {currentItem.fecha_pago}). Para corregir, anule el pago desde la lista.
                            </p>
                        )}
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={showPagoModal} onOpenChange={setShowPagoModal}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Pagar {pagando?.numero_liquidacion}</DialogTitle></DialogHeader>
                    {pagando && (
                        <form onSubmit={registrarPago} className="space-y-3 text-sm">
                            <p>{pagando.nombre_personal} · <strong>{formatCurrency(pagando.total_a_pagar)}</strong></p>
                            <div>
                                <Label>Cuenta de dinero *</Label>
                                <Select value={pagoForm.cuenta_id || ''} onValueChange={v => setPagoForm(p => ({...p, cuenta_id: v}))}>
                                    <SelectTrigger><SelectValue placeholder="Caja, banco u otro medio" /></SelectTrigger>
                                    <SelectContent>{cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre} ({formatCurrency(c.saldo)})</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div><Label>Fecha *</Label><Input type="date" value={pagoForm.fecha || ''} onChange={e => setPagoForm(p => ({...p, fecha: e.target.value}))} /></div>
                            {errorPago && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{errorPago}</p>}
                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <Button type="button" variant="outline" onClick={() => setShowPagoModal(false)}>Cancelar</Button>
                                <Button type="submit" disabled={guardandoPago}>{guardandoPago ? 'Guardando…' : 'Pagar'}</Button>
                            </div>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
