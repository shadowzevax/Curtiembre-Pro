import React, { useState, useEffect } from 'react';
import { MovimientoCaja, Caja, TransferenciaCaja } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Printer } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function ReportesMovimientosCaja() {
    const [movimientos, setMovimientos] = useState([]);
    const [cajas, setCajas] = useState([]);
    const [filteredMovs, setFilteredMovs] = useState([]);
    const [filters, setFilters] = useState({
        fechaDesde: '',
        fechaHasta: '',
        cajaId: '',
        tipo: '',
        concepto: '',
        responsable: ''
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [movsData, cajasData, transData] = await Promise.all([
                MovimientoCaja.list(),
                Caja.list(),
                TransferenciaCaja.list()
            ]);
            setMovimientos(movsData);
            setCajas(cajasData);
            applyFilters(movsData);
        } catch (e) {
            console.error(e);
        }
    };

    const applyFilters = (data = movimientos) => {
        let filtered = [...data];
        
        if (filters.fechaDesde) {
            filtered = filtered.filter(m => m.fecha >= filters.fechaDesde);
        }
        if (filters.fechaHasta) {
            filtered = filtered.filter(m => m.fecha <= filters.fechaHasta);
        }
        if (filters.cajaId) {
            filtered = filtered.filter(m => m.caja_id === filters.cajaId);
        }
        if (filters.tipo) {
            filtered = filtered.filter(m => m.tipo === filters.tipo);
        }
        if (filters.concepto) {
            filtered = filtered.filter(m => m.concepto?.toLowerCase().includes(filters.concepto.toLowerCase()));
        }
        if (filters.responsable) {
            filtered = filtered.filter(m => m.responsable?.toLowerCase().includes(filters.responsable.toLowerCase()));
        }
        
        setFilteredMovs(filtered);
    };

    useEffect(() => {
        applyFilters();
    }, [filters]);

    const totalEntradas = filteredMovs.reduce((sum, m) => sum + (m.valor_entrada || 0), 0);
    const totalSalidas = filteredMovs.reduce((sum, m) => sum + (m.valor_salida || 0), 0);
    const saldoInicial = filteredMovs.length > 0 ? (filteredMovs[0].saldo - (filteredMovs[0].valor_entrada || 0) + (filteredMovs[0].valor_salida || 0)) : 0;
    const saldoFinal = filteredMovs.length > 0 ? filteredMovs[filteredMovs.length - 1].saldo : 0;

    const handleExport = () => {
        const csv = [
            ['Fecha', 'Caja', 'Tipo', 'Concepto', 'Responsable', 'Entrada', 'Salida', 'Saldo'],
            ...filteredMovs.map(m => [
                new Date(m.fecha).toLocaleDateString(),
                m.nombre_caja,
                m.tipo,
                m.concepto,
                m.responsable,
                m.valor_entrada,
                m.valor_salida,
                m.saldo
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'reporte_movimientos_caja.csv';
        a.click();
    };

    return (
        <div className="p-6">
            <PageHeader 
                title="Reportes de Movimientos de Caja"
                description="Consulta y control de movimientos de caja."
                onExportExcel={handleExport}
                onPrint={() => window.print()}
            />
            
            <Card className="mb-4">
                <CardHeader><CardTitle>Filtros de Búsqueda</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-4 gap-4">
                        <div><Label>Desde</Label><Input type="date" value={filters.fechaDesde} onChange={e => setFilters({...filters, fechaDesde: e.target.value})} /></div>
                        <div><Label>Hasta</Label><Input type="date" value={filters.fechaHasta} onChange={e => setFilters({...filters, fechaHasta: e.target.value})} /></div>
                        <div>
                            <Label>Caja</Label>
                            <Select value={filters.cajaId} onValueChange={v => setFilters({...filters, cajaId: v})}>
                                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>Todas</SelectItem>
                                    {cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Tipo</Label>
                            <Select value={filters.tipo} onValueChange={v => setFilters({...filters, tipo: v})}>
                                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>Todos</SelectItem>
                                    <SelectItem value="entrada">ENTRADA</SelectItem>
                                    <SelectItem value="salida">SALIDA</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card id="tabla-imprimible">
                <CardHeader><CardTitle>Movimientos de Caja</CardTitle></CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="border p-2">Fecha</th>
                                    <th className="border p-2">Caja</th>
                                    <th className="border p-2">Tipo</th>
                                    <th className="border p-2">Concepto</th>
                                    <th className="border p-2">Observaciones</th>
                                    <th className="border p-2 text-right">Entrada</th>
                                    <th className="border p-2 text-right">Salida</th>
                                    <th className="border p-2 text-right">Saldo</th>
                                    <th className="border p-2">Responsable</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMovs.map(m => (
                                    <tr key={m.id}>
                                        <td className="border p-2">{new Date(m.fecha).toLocaleDateString()}</td>
                                        <td className="border p-2">{m.nombre_caja}</td>
                                        <td className={`border p-2 font-bold ${m.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>{m.tipo?.toUpperCase()}</td>
                                        <td className="border p-2">{m.concepto}</td>
                                        <td className="border p-2 text-xs">{m.observaciones}</td>
                                        <td className="border p-2 text-right text-green-600 font-bold">{formatCurrency(m.valor_entrada)}</td>
                                        <td className="border p-2 text-right text-red-600 font-bold">{formatCurrency(m.valor_salida)}</td>
                                        <td className="border p-2 text-right font-bold">{formatCurrency(m.saldo)}</td>
                                        <td className="border p-2">{m.responsable}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-blue-50 font-bold">
                                <tr>
                                    <td colSpan="5" className="border p-3 text-right">TOTALES DEL PERIODO:</td>
                                    <td className="border p-3 text-right text-green-700 text-lg">{formatCurrency(totalEntradas)}</td>
                                    <td className="border p-3 text-right text-red-700 text-lg">{formatCurrency(totalSalidas)}</td>
                                    <td className="border p-3 text-right text-lg">{formatCurrency(saldoFinal)}</td>
                                    <td className="border p-3"></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}