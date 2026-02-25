import React, { useState, useEffect, useCallback } from 'react';
import { MovimientoBancario, CuentaBancaria } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, TrendingUp, TrendingDown, DollarSign, ExternalLink, Filter } from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : '-';

const TIPOS_ORIGEN = ['ReciboCaja', 'ComprobanteEgreso', 'TransferenciaInterna', 'InteresesBancarios', 'ComisionBancaria', 'AjusteBancario', 'Manual'];

const TIPOS_MANUALES = ['InteresesBancarios', 'ComisionBancaria', 'AjusteBancario'];

export default function MovimientosBancarios() {
    const [movimientos, setMovimientos] = useState([]);
    const [movFiltrados, setMovFiltrados] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    // Filtros
    const [filtros, setFiltros] = useState({
        cuenta_id: '',
        fecha_desde: '',
        fecha_hasta: new Date().toISOString().split('T')[0],
        tipo_movimiento: '',
        documento_origen_tipo: ''
    });

    // Resumen
    const [resumen, setResumen] = useState({ saldo_inicial: 0, total_entradas: 0, total_salidas: 0, saldo_final: 0 });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [movsData, cuentasData] = await Promise.all([
                MovimientoBancario.list('-fecha', 200),
                CuentaBancaria.list()
            ]);
            setMovimientos(movsData);
            setCuentas(cuentasData.filter(c => c.estado === 'activa'));
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        let filtered = [...movimientos];

        if (filtros.cuenta_id) filtered = filtered.filter(m => m.cuenta_id === filtros.cuenta_id);
        if (filtros.fecha_desde) filtered = filtered.filter(m => m.fecha >= filtros.fecha_desde);
        if (filtros.fecha_hasta) filtered = filtered.filter(m => m.fecha <= filtros.fecha_hasta);
        if (filtros.tipo_movimiento) filtered = filtered.filter(m => m.tipo_movimiento === filtros.tipo_movimiento);
        if (filtros.documento_origen_tipo) filtered = filtered.filter(m => m.documento_origen_tipo === filtros.documento_origen_tipo);

        filtered = filtered.sort((a, b) => a.fecha > b.fecha ? 1 : -1);
        setMovFiltrados(filtered);

        // Calcular resumen
        const cuenta = cuentas.find(c => c.id === filtros.cuenta_id);
        const totalEntradas = filtered.reduce((s, m) => s + (m.valor_entrada || 0), 0);
        const totalSalidas = filtered.reduce((s, m) => s + (m.valor_salida || 0), 0);
        const saldoFinal = (cuenta?.saldo_actual || 0);
        const saldoInicial = saldoFinal - totalEntradas + totalSalidas;

        setResumen({ saldo_inicial: saldoInicial, total_entradas: totalEntradas, total_salidas: totalSalidas, saldo_final: saldoFinal });
    }, [movimientos, filtros, cuentas]);

    const handleOpenModal = () => {
        const cuenta = cuentas.find(c => c.id === filtros.cuenta_id);
        setCurrentItem({
            cuenta_id: filtros.cuenta_id || '',
            fecha: new Date().toISOString().split('T')[0],
            tipo_movimiento: 'ingreso',
            concepto: '',
            referencia: '',
            documento_origen_tipo: 'AjusteBancario',
            documento_origen_id: '',
            valor_entrada: 0,
            valor_salida: 0,
            saldo_anterior: cuenta?.saldo_actual || 0,
            saldo: cuenta?.saldo_actual || 0,
            es_automatico: false,
            observaciones: ''
        });
        setShowModal(true);
    };

    const handleFieldChange = (field, value) => {
        setCurrentItem(prev => {
            const updated = { ...prev, [field]: value };

            if (field === 'cuenta_id') {
                const c = cuentas.find(c => c.id === value);
                updated.saldo_anterior = c?.saldo_actual || 0;
            }

            if (field === 'tipo_movimiento') {
                if (value === 'ingreso') { updated.valor_salida = 0; }
                else { updated.valor_entrada = 0; }
            }

            // Calcular saldo resultante
            if (['valor_entrada', 'valor_salida', 'cuenta_id'].includes(field)) {
                const c = cuentas.find(c => c.id === updated.cuenta_id);
                const base = c?.saldo_actual || 0;
                updated.saldo_anterior = base;
                updated.saldo = base + (parseFloat(updated.valor_entrada) || 0) - (parseFloat(updated.valor_salida) || 0);
            }

            return updated;
        });
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!currentItem.cuenta_id) { alert('Seleccione una cuenta bancaria.'); return; }
        const valor = (parseFloat(currentItem.valor_entrada) || 0) + (parseFloat(currentItem.valor_salida) || 0);
        if (valor <= 0) { alert('El valor debe ser mayor a cero.'); return; }
        if (!TIPOS_MANUALES.includes(currentItem.documento_origen_tipo)) {
            alert('Solo puede registrar manualmente: Intereses Bancarios, Comisión Bancaria o Ajuste Bancario.');
            return;
        }
        try {
            await MovimientoBancario.create({ ...currentItem, es_automatico: false });
            // Actualizar saldo de cuenta
            await CuentaBancaria.update(currentItem.cuenta_id, { saldo_actual: currentItem.saldo });
            setShowModal(false);
            loadData();
            alert('Movimiento registrado.');
        } catch (e) {
            console.error(e);
            alert('Error al guardar.');
        }
    };

    const handleExport = () => {
        const rows = movFiltrados.map(m => {
            const cta = cuentas.find(c => c.id === m.cuenta_id);
            return `"${formatDate(m.fecha)}","${cta?.banco || ''}","${m.tipo_movimiento}","${m.concepto}","${m.documento_origen_tipo || ''}","${m.documento_origen_id || ''}","${m.valor_entrada || 0}","${m.valor_salida || 0}","${m.saldo || 0}"`;
        }).join('\n');
        const csv = `Fecha,Banco,Tipo,Concepto,Origen Tipo,Origen ID,Entrada,Salida,Saldo\n${rows}`;
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `movimientos_bancarios_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
    };

    const getOrigenLabel = (tipo) => {
        const labels = {
            'ReciboCaja': 'Recibo de Caja',
            'ComprobanteEgreso': 'Comprobante Egreso',
            'TransferenciaInterna': 'Transferencia Interna',
            'InteresesBancarios': 'Intereses Bancarios',
            'ComisionBancaria': 'Comisión Bancaria',
            'AjusteBancario': 'Ajuste Bancario',
            'Manual': 'Manual'
        };
        return labels[tipo] || tipo || '-';
    };

    const getTipoColor = (tipo) => tipo === 'ingreso' ? 'bg-green-100 text-green-700' : tipo === 'egreso' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700';

    return (
        <div className="p-4 md:p-6 space-y-4 max-w-full overflow-x-hidden">
            <PageHeader
                title="Movimientos Bancarios"
                description="Diario contable de cuentas bancarias. Los movimientos se generan automáticamente desde Recibo de Caja, Comprobante de Egreso y Transferencias."
                onExportExcel={handleExport}
                actionButton={
                    <Button onClick={handleOpenModal} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Registro Manual
                    </Button>
                }
            />

            {/* Filtros */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-sm"><Filter className="w-4 h-4" /> Filtros</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        <div>
                            <Label className="text-xs">Cuenta Bancaria</Label>
                            <Select value={filtros.cuenta_id} onValueChange={v => setFiltros({ ...filtros, cuenta_id: v === '__all__' ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">Todas las cuentas</SelectItem>
                                    {cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numero_cuenta}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Fecha Desde</Label>
                            <Input type="date" className="h-8 text-xs" value={filtros.fecha_desde} onChange={e => setFiltros({ ...filtros, fecha_desde: e.target.value })} />
                        </div>
                        <div>
                            <Label className="text-xs">Fecha Hasta</Label>
                            <Input type="date" className="h-8 text-xs" value={filtros.fecha_hasta} onChange={e => setFiltros({ ...filtros, fecha_hasta: e.target.value })} />
                        </div>
                        <div>
                            <Label className="text-xs">Tipo</Label>
                            <Select value={filtros.tipo_movimiento} onValueChange={v => setFiltros({ ...filtros, tipo_movimiento: v === '__all__' ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">Todos</SelectItem>
                                    <SelectItem value="ingreso">Ingreso</SelectItem>
                                    <SelectItem value="egreso">Egreso</SelectItem>
                                    <SelectItem value="transferencia">Transferencia</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label className="text-xs">Origen</Label>
                            <Select value={filtros.documento_origen_tipo} onValueChange={v => setFiltros({ ...filtros, documento_origen_tipo: v === '__all__' ? '' : v })}>
                                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="__all__">Todos</SelectItem>
                                    {TIPOS_ORIGEN.map(t => <SelectItem key={t} value={t}>{getOrigenLabel(t)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Resumen */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="p-4">
                        <p className="text-xs text-gray-500">Saldo Inicial (Est.)</p>
                        <p className="text-lg font-bold text-slate-700">{formatCurrency(resumen.saldo_inicial)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-green-600" />
                            <p className="text-xs text-gray-500">Total Entradas</p>
                        </div>
                        <p className="text-lg font-bold text-green-600">{formatCurrency(resumen.total_entradas)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <TrendingDown className="w-4 h-4 text-red-600" />
                            <p className="text-xs text-gray-500">Total Salidas</p>
                        </div>
                        <p className="text-lg font-bold text-red-600">{formatCurrency(resumen.total_salidas)}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-blue-600" />
                            <p className="text-xs text-gray-500">Saldo Actual</p>
                        </div>
                        <p className="text-lg font-bold text-blue-700">{formatCurrency(resumen.saldo_final)}</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabla */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Movimientos ({movFiltrados.length})</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <p className="text-center py-8 text-gray-500">Cargando...</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="p-3 text-left font-medium text-gray-600">Fecha</th>
                                        <th className="p-3 text-left font-medium text-gray-600">Cuenta</th>
                                        <th className="p-3 text-left font-medium text-gray-600">Tipo</th>
                                        <th className="p-3 text-left font-medium text-gray-600">Concepto</th>
                                        <th className="p-3 text-left font-medium text-gray-600">Origen</th>
                                        <th className="p-3 text-right font-medium text-gray-600">Entrada</th>
                                        <th className="p-3 text-right font-medium text-gray-600">Salida</th>
                                        <th className="p-3 text-right font-medium text-gray-600">Saldo</th>
                                        <th className="p-3 text-center font-medium text-gray-600">Auto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movFiltrados.length === 0 && (
                                        <tr><td colSpan="9" className="p-8 text-center text-gray-500">No hay movimientos con los filtros seleccionados.</td></tr>
                                    )}
                                    {movFiltrados.map(m => {
                                        const cta = cuentas.find(c => c.id === m.cuenta_id);
                                        return (
                                            <tr key={m.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3 whitespace-nowrap">{formatDate(m.fecha)}</td>
                                                <td className="p-3">
                                                    <div className="font-medium text-xs">{cta?.banco || 'N/A'}</div>
                                                    <div className="text-gray-400 text-xs font-mono">{cta?.numero_cuenta}</div>
                                                </td>
                                                <td className="p-3">
                                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${getTipoColor(m.tipo_movimiento)}`}>
                                                        {m.tipo_movimiento?.toUpperCase()}
                                                    </span>
                                                </td>
                                                <td className="p-3 max-w-[200px]">
                                                    <div className="truncate">{m.concepto}</div>
                                                    {m.referencia && <div className="text-gray-400 text-xs">Ref: {m.referencia}</div>}
                                                </td>
                                                <td className="p-3">
                                                    <div className="text-xs font-medium">{getOrigenLabel(m.documento_origen_tipo)}</div>
                                                    {m.documento_origen_id && (
                                                        <div className="flex items-center gap-1 text-xs text-blue-600">
                                                            <ExternalLink className="w-3 h-3" />
                                                            <span className="font-mono truncate max-w-[80px]">{m.documento_origen_id.slice(-8)}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right font-medium text-green-600">
                                                    {(m.valor_entrada || 0) > 0 ? formatCurrency(m.valor_entrada) : '-'}
                                                </td>
                                                <td className="p-3 text-right font-medium text-red-600">
                                                    {(m.valor_salida || 0) > 0 ? formatCurrency(m.valor_salida) : '-'}
                                                </td>
                                                <td className="p-3 text-right font-bold">{formatCurrency(m.saldo)}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`text-xs px-1.5 py-0.5 rounded ${m.es_automatico ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {m.es_automatico ? 'Auto' : 'Manual'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {movFiltrados.length > 0 && (
                                    <tfoot className="bg-gray-100 font-bold">
                                        <tr>
                                            <td colSpan="5" className="p-3 text-right">TOTALES:</td>
                                            <td className="p-3 text-right text-green-700">{formatCurrency(movFiltrados.reduce((s, m) => s + (m.valor_entrada || 0), 0))}</td>
                                            <td className="p-3 text-right text-red-700">{formatCurrency(movFiltrados.reduce((s, m) => s + (m.valor_salida || 0), 0))}</td>
                                            <td colSpan="2"></td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Modal registro manual */}
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Registro Manual de Movimiento Bancario</DialogTitle>
                    </DialogHeader>
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                        ⚠ El registro manual está restringido a: Intereses Bancarios, Comisión Bancaria o Ajuste Bancario. Los demás movimientos se generan automáticamente desde los módulos operativos.
                    </p>
                    <form onSubmit={handleSave} className="space-y-3">
                        <div>
                            <Label>Cuenta Bancaria *</Label>
                            <Select value={currentItem?.cuenta_id} onValueChange={v => handleFieldChange('cuenta_id', v)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                                <SelectContent>
                                    {cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numero_cuenta} (Saldo: {formatCurrency(c.saldo_actual)})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Fecha *</Label>
                                <Input type="date" value={currentItem?.fecha} onChange={e => handleFieldChange('fecha', e.target.value)} required />
                            </div>
                            <div>
                                <Label>Tipo *</Label>
                                <Select value={currentItem?.tipo_movimiento} onValueChange={v => handleFieldChange('tipo_movimiento', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ingreso">ENTRADA</SelectItem>
                                        <SelectItem value="egreso">SALIDA</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div>
                            <Label>Tipo de Registro *</Label>
                            <Select value={currentItem?.documento_origen_tipo} onValueChange={v => handleFieldChange('documento_origen_tipo', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TIPOS_MANUALES.map(t => <SelectItem key={t} value={t}>{getOrigenLabel(t)}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Concepto *</Label>
                            <Input value={currentItem?.concepto} onChange={e => handleFieldChange('concepto', e.target.value)} required placeholder="Descripción del movimiento" />
                        </div>
                        <div>
                            <Label>Referencia</Label>
                            <Input value={currentItem?.referencia} onChange={e => handleFieldChange('referencia', e.target.value)} placeholder="No. transacción (opcional)" />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Valor Entrada</Label>
                                <Input type="number" min="0" value={currentItem?.valor_entrada}
                                    onChange={e => handleFieldChange('valor_entrada', parseFloat(e.target.value) || 0)}
                                    disabled={currentItem?.tipo_movimiento === 'egreso'} className={currentItem?.tipo_movimiento === 'egreso' ? 'bg-gray-100' : ''} />
                            </div>
                            <div>
                                <Label>Valor Salida</Label>
                                <Input type="number" min="0" value={currentItem?.valor_salida}
                                    onChange={e => handleFieldChange('valor_salida', parseFloat(e.target.value) || 0)}
                                    disabled={currentItem?.tipo_movimiento === 'ingreso'} className={currentItem?.tipo_movimiento === 'ingreso' ? 'bg-gray-100' : ''} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Saldo Anterior</Label>
                                <Input value={formatCurrency(currentItem?.saldo_anterior)} readOnly className="bg-gray-50 text-sm" />
                            </div>
                            <div>
                                <Label>Saldo Resultante</Label>
                                <Input value={formatCurrency(currentItem?.saldo)} readOnly className="bg-blue-50 font-bold text-sm" />
                            </div>
                        </div>
                        <div>
                            <Label>Observaciones</Label>
                            <Textarea value={currentItem?.observaciones} onChange={e => handleFieldChange('observaciones', e.target.value)} rows={2} />
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}