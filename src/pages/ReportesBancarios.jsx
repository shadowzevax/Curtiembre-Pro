import React, { useState, useEffect } from 'react';
import { MovimientoBancario, CuentaBancaria } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function ReportesBancarios() {
    const [movimientos, setMovimientos] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [filteredMovs, setFilteredMovs] = useState([]);
    const [filters, setFilters] = useState({
        fechaDesde: '',
        fechaHasta: '',
        cuentaId: '',
        banco: '',
        tipo: '',
        concepto: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [movsData, cuentasData] = await Promise.all([
                MovimientoBancario.list(),
                CuentaBancaria.list()
            ]);
            setMovimientos(movsData);
            setCuentas(cuentasData);
            setFilteredMovs(movsData);
        } catch (e) {
            console.error(e);
        }
    };

    const applyFilters = () => {
        let filtered = [...movimientos];
        
        if (filters.fechaDesde) filtered = filtered.filter(m => m.fecha >= filters.fechaDesde);
        if (filters.fechaHasta) filtered = filtered.filter(m => m.fecha <= filters.fechaHasta);
        if (filters.cuentaId) filtered = filtered.filter(m => m.cuenta_id === filters.cuentaId);
        if (filters.tipo) filtered = filtered.filter(m => m.tipo_movimiento === filters.tipo);
        if (filters.concepto) filtered = filtered.filter(m => m.concepto?.toLowerCase().includes(filters.concepto.toLowerCase()));
        
        setFilteredMovs(filtered);
    };

    useEffect(() => {
        applyFilters();
    }, [filters]);

    const totalEntradas = filteredMovs.reduce((sum, m) => sum + (m.valor_entrada || 0), 0);
    const totalSalidas = filteredMovs.reduce((sum, m) => sum + (m.valor_salida || 0), 0);
    const saldoFinal = filteredMovs.length > 0 ? filteredMovs[filteredMovs.length - 1].saldo : 0;

    const handleExport = () => {
        const csv = [
            ['Fecha', 'Cuenta', 'Banco', 'Tipo', 'Concepto', 'Referencia', 'Entrada', 'Salida', 'Saldo'],
            ...filteredMovs.map(m => {
                const cuenta = cuentas.find(c => c.id === m.cuenta_id);
                return [
                    new Date(m.fecha).toLocaleDateString(),
                    cuenta?.numero_cuenta || '',
                    cuenta?.banco || '',
                    m.tipo_movimiento,
                    m.concepto,
                    m.referencia,
                    m.valor_entrada,
                    m.valor_salida,
                    m.saldo
                ];
            })
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reporte_bancario.csv';
        a.click();
    };

    return (
        <div className="p-6">
            <PageHeader 
                title="Reportes Bancarios"
                description="Consulta de movimientos bancarios y saldos."
                onExportExcel={handleExport}
                onPrint={() => window.print()}
            />
            
            <Tabs defaultValue="movimientos" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="movimientos">Movimientos Bancarios</TabsTrigger>
                    <TabsTrigger value="saldos">Saldos por Cuenta</TabsTrigger>
                    <TabsTrigger value="conciliacion">Historial Conciliación</TabsTrigger>
                </TabsList>
                
                <TabsContent value="movimientos">
                    <Card className="mb-4">
                        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-4 gap-4">
                                <div><Label>Desde</Label><Input type="date" value={filters.fechaDesde} onChange={e => setFilters({...filters, fechaDesde: e.target.value})} /></div>
                                <div><Label>Hasta</Label><Input type="date" value={filters.fechaHasta} onChange={e => setFilters({...filters, fechaHasta: e.target.value})} /></div>
                                <div>
                                    <Label>Cuenta</Label>
                                    <Select value={filters.cuentaId} onValueChange={v => setFilters({...filters, cuentaId: v})}>
                                        <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={null}>Todas</SelectItem>
                                            {cuentas.map(c => <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numero_cuenta}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Tipo</Label>
                                    <Select value={filters.tipo} onValueChange={v => setFilters({...filters, tipo: v})}>
                                        <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={null}>Todos</SelectItem>
                                            <SelectItem value="ingreso">INGRESO</SelectItem>
                                            <SelectItem value="egreso">EGRESO</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card id="tabla-imprimible">
                        <CardContent className="pt-6">
                            <table className="w-full text-sm border">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border p-2">Fecha</th>
                                        <th className="border p-2">Cuenta</th>
                                        <th className="border p-2">Banco</th>
                                        <th className="border p-2">Tipo</th>
                                        <th className="border p-2">Concepto</th>
                                        <th className="border p-2">Referencia</th>
                                        <th className="border p-2 text-right">Entrada</th>
                                        <th className="border p-2 text-right">Salida</th>
                                        <th className="border p-2 text-right">Saldo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMovs.map(m => {
                                        const cuenta = cuentas.find(c => c.id === m.cuenta_id);
                                        return (
                                            <tr key={m.id}>
                                                <td className="border p-2">{new Date(m.fecha).toLocaleDateString()}</td>
                                                <td className="border p-2 font-mono">{cuenta?.numero_cuenta}</td>
                                                <td className="border p-2">{cuenta?.banco}</td>
                                                <td className={`border p-2 font-bold ${m.tipo_movimiento === 'ingreso' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo_movimiento?.toUpperCase()}</td>
                                                <td className="border p-2">{m.concepto}</td>
                                                <td className="border p-2 text-xs">{m.referencia}</td>
                                                <td className="border p-2 text-right text-green-600 font-bold">{formatCurrency(m.valor_entrada)}</td>
                                                <td className="border p-2 text-right text-red-600 font-bold">{formatCurrency(m.valor_salida)}</td>
                                                <td className="border p-2 text-right font-bold">{formatCurrency(m.saldo)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-blue-50 font-bold">
                                    <tr>
                                        <td colSpan="6" className="border p-3 text-right">TOTALES:</td>
                                        <td className="border p-3 text-right text-green-700 text-lg">{formatCurrency(totalEntradas)}</td>
                                        <td className="border p-3 text-right text-red-700 text-lg">{formatCurrency(totalSalidas)}</td>
                                        <td className="border p-3 text-right text-lg">{formatCurrency(saldoFinal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="saldos">
                    <Card>
                        <CardHeader><CardTitle>Saldos por Cuenta Bancaria</CardTitle></CardHeader>
                        <CardContent>
                            <table className="w-full text-sm border">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="border p-2">Código</th>
                                        <th className="border p-2">Banco</th>
                                        <th className="border p-2">Número Cuenta</th>
                                        <th className="border p-2">Tipo</th>
                                        <th className="border p-2 text-right">Saldo Actual</th>
                                        <th className="border p-2">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cuentas.map(c => (
                                        <tr key={c.id}>
                                            <td className="border p-2 font-mono">{c.codigo_cuenta}</td>
                                            <td className="border p-2">{c.banco}</td>
                                            <td className="border p-2 font-mono">{c.numero_cuenta}</td>
                                            <td className="border p-2 capitalize">{c.tipo_cuenta?.replace('_', ' ')}</td>
                                            <td className="border p-2 text-right font-bold text-blue-700">{formatCurrency(c.saldo_actual)}</td>
                                            <td className="border p-2"><span className={`px-2 py-1 rounded text-xs ${c.estado === 'activa' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{c.estado}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="conciliacion">
                    <Card>
                        <CardContent className="p-6 text-center text-gray-500">
                            Funcionalidad de historial de conciliación en desarrollo.
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}