import React, { useState, useEffect } from 'react';
import { MovimientoLibroDiario, Cliente, Proveedor, Empleado, Caja } from '@/entities/all';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function LibroDiarioNuevoRegistro({ open, onOpenChange, onSuccess }) {
    const [formData, setFormData] = useState(null);
    const [clientes, setClientes] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [cajas, setCajas] = useState([]);
    const [nextConsecutivo, setNextConsecutivo] = useState('001');

    useEffect(() => {
        if (open) {
            loadInitialData();
        }
    }, [open]);

    const loadInitialData = async () => {
        try {
            const [clientesData, proveedoresData, empleadosData, cajasData, movimientos] = await Promise.all([
                Cliente.list(),
                Proveedor.list(),
                Empleado.list(),
                Caja.list(),
                MovimientoLibroDiario.list()
            ]);
            
            setClientes(clientesData);
            setProveedores(proveedoresData);
            setEmpleados(empleadosData);
            setCajas(cajasData);
            
            // Calcular siguiente consecutivo
            const lastMov = movimientos.sort((a, b) => {
                const numA = parseInt(a.consecutivo) || 0;
                const numB = parseInt(b.consecutivo) || 0;
                return numB - numA;
            })[0];
            
            const nextNum = lastMov ? (parseInt(lastMov.consecutivo) || 0) + 1 : 1;
            const consec = String(nextNum).padStart(3, '0');
            setNextConsecutivo(consec);
            
            // Calcular saldo anterior (último saldo final)
            const saldoAnterior = lastMov?.saldo_final || 0;
            
            setFormData({
                consecutivo: consec,
                fecha: new Date().toISOString().split('T')[0],
                tipo_movimiento: 'ingreso',
                tipo_tercero: 'cliente',
                tipo_documento_soporte: 'recibo_caja',
                numero_documento: '',
                tercero_id: '',
                tercero_nombre: '',
                cuenta_afectada: 'Caja Principal',
                descripcion: '',
                valor_ingreso: 0,
                valor_egreso: 0,
                medio_pago: 'efectivo',
                saldo_anterior: saldoAnterior,
                saldo_final: saldoAnterior,
                origen_modulo: 'manual'
            });
        } catch (e) {
            console.error(e);
        }
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            
            // Auto-calcular saldo final
            if (field === 'valor_ingreso' || field === 'valor_egreso' || field === 'tipo_movimiento') {
                const ingreso = parseFloat(field === 'valor_ingreso' ? value : updated.valor_ingreso) || 0;
                const egreso = parseFloat(field === 'valor_egreso' ? value : updated.valor_egreso) || 0;
                const saldoAnterior = parseFloat(updated.saldo_anterior) || 0;
                
                if (updated.tipo_movimiento === 'ingreso') {
                    updated.saldo_final = saldoAnterior + ingreso;
                } else {
                    updated.saldo_final = saldoAnterior - egreso;
                }
            }
            
            // Auto-llenar tercero_nombre
            if (field === 'tercero_id') {
                let tercero = null;
                if (updated.tipo_tercero === 'cliente') {
                    tercero = clientes.find(c => c.id === value);
                } else if (updated.tipo_tercero === 'proveedor') {
                    tercero = proveedores.find(p => p.id === value);
                } else if (updated.tipo_tercero === 'empleado') {
                    tercero = empleados.find(e => e.id === value);
                }
                updated.tercero_nombre = tercero ? tercero.nombre : '';
            }
            
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await MovimientoLibroDiario.create(formData);
            alert('Movimiento registrado con éxito.');
            onSuccess();
            onOpenChange(false);
        } catch (e) {
            console.error(e);
            alert('Error al guardar el movimiento.');
        }
    };

    if (!formData) return null;

    const getTercerosList = () => {
        if (formData.tipo_tercero === 'cliente') return clientes;
        if (formData.tipo_tercero === 'proveedor') return proveedores;
        if (formData.tipo_tercero === 'empleado') return empleados;
        return [];
    };

    const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Nuevo Registro - Libro Diario</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div><Label>ID Movimiento</Label><Input value={formData.consecutivo} readOnly className="bg-gray-100 font-bold" /></div>
                        <div><Label>Fecha *</Label><Input type="date" value={formData.fecha} onChange={e => handleInputChange('fecha', e.target.value)} required /></div>
                        <div>
                            <Label>Tipo de Movimiento *</Label>
                            <Select value={formData.tipo_movimiento} onValueChange={v => handleInputChange('tipo_movimiento', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ingreso">INGRESO</SelectItem>
                                    <SelectItem value="egreso">EGRESO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Tipo Tercero *</Label>
                            <Select value={formData.tipo_tercero} onValueChange={v => handleInputChange('tipo_tercero', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="cliente">CLIENTE</SelectItem>
                                    <SelectItem value="proveedor">PROVEEDOR</SelectItem>
                                    <SelectItem value="empleado">EMPLEADO</SelectItem>
                                    <SelectItem value="otro">OTRO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Tercero *</Label>
                            <Select value={formData.tercero_id} onValueChange={v => handleInputChange('tercero_id', v)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar tercero" /></SelectTrigger>
                                <SelectContent>
                                    {getTercerosList().map(t => (
                                        <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Documento Soporte *</Label>
                            <Select value={formData.tipo_documento_soporte} onValueChange={v => handleInputChange('tipo_documento_soporte', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="recibo_caja">RECIBO DE CAJA</SelectItem>
                                    <SelectItem value="factura">FACTURA</SelectItem>
                                    <SelectItem value="cuenta_cobro">CUENTA DE COBRO</SelectItem>
                                    <SelectItem value="nota_contable">NOTA CONTABLE</SelectItem>
                                    <SelectItem value="comprobante_interno">COMPROBANTE INTERNO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div><Label>Número de Documento *</Label><Input value={formData.numero_documento} onChange={e => handleInputChange('numero_documento', e.target.value)} required /></div>
                        <div>
                            <Label>Cuenta Afectada *</Label>
                            <Select value={formData.cuenta_afectada} onValueChange={v => handleInputChange('cuenta_afectada', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {cajas.map(c => (
                                        <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div><Label>Descripción del Movimiento *</Label><Textarea value={formData.descripcion} onChange={e => handleInputChange('descripcion', e.target.value)} required /></div>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <Label>Valor del Ingreso</Label>
                            <Input 
                                type="number" 
                                value={formData.valor_ingreso} 
                                onChange={e => handleInputChange('valor_ingreso', parseFloat(e.target.value) || 0)}
                                disabled={formData.tipo_movimiento === 'egreso'}
                                className={formData.tipo_movimiento === 'ingreso' ? 'bg-green-50 font-bold text-green-700' : 'bg-gray-100'}
                            />
                        </div>
                        <div>
                            <Label>Valor del Egreso</Label>
                            <Input 
                                type="number" 
                                value={formData.valor_egreso} 
                                onChange={e => handleInputChange('valor_egreso', parseFloat(e.target.value) || 0)}
                                disabled={formData.tipo_movimiento === 'ingreso'}
                                className={formData.tipo_movimiento === 'egreso' ? 'bg-red-50 font-bold text-red-700' : 'bg-gray-100'}
                            />
                        </div>
                        <div>
                            <Label>Medio de Pago</Label>
                            <Select value={formData.medio_pago} onValueChange={v => handleInputChange('medio_pago', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="efectivo">EFECTIVO</SelectItem>
                                    <SelectItem value="transferencia">TRANSFERENCIA</SelectItem>
                                    <SelectItem value="cheque">CHEQUE</SelectItem>
                                    <SelectItem value="otro">OTRO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-blue-50 p-4 rounded-lg">
                        <div><Label>Saldo Anterior</Label><Input type="number" value={formData.saldo_anterior} readOnly className="bg-gray-100 font-bold" /></div>
                        <div><Label>Movimiento</Label><Input type="number" value={formData.tipo_movimiento === 'ingreso' ? formData.valor_ingreso : -formData.valor_egreso} readOnly className="bg-gray-100 font-bold" /></div>
                        <div><Label>Saldo Final</Label><Input type="number" value={formData.saldo_final} readOnly className="bg-emerald-100 font-bold text-emerald-700" /></div>
                    </div>

                    <div><Label>Origen del Movimiento</Label><Input value={formData.origen_modulo} readOnly className="bg-gray-100" /></div>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit">Guardar Movimiento</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}