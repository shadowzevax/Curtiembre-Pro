import React, { useState, useEffect } from 'react';
import { CuentaContable, OrdenCompra, OrdenVenta } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function InformeCaja() {
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
    const [filteredMovimientos, setFilteredMovimientos] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [movimientos, fechaInicio, fechaFin]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [cuentas, compras, ventas] = await Promise.all([
                CuentaContable.list(),
                OrdenCompra.list(),
                OrdenVenta.list()
            ]);

            const movs = [
                ...cuentas.map(c => ({
                    fecha: c.fecha,
                    tipo: c.tipo_cuenta === 'gastos' || c.tipo_cuenta === 'cuentas_pagar' ? 'egreso' : 'ingreso',
                    concepto: c.concepto,
                    valor: c.valor,
                    observaciones: c.observaciones
                })),
                ...compras.map(c => ({
                    fecha: c.fecha_orden,
                    tipo: 'egreso',
                    concepto: `Compra ${c.tipo_compra} #${c.numero_documento}`,
                    valor: c.total,
                    observaciones: c.observaciones
                })),
                ...ventas.map(v => ({
                    fecha: v.fecha_orden,
                    tipo: 'ingreso',
                    concepto: `Venta ${v.tipo_venta} #${v.numero_documento}`,
                    valor: v.total,
                    observaciones: v.observaciones
                }))
            ];

            movs.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
            setMovimientos(movs);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = movimientos.filter(m => {
            const fecha = new Date(m.fecha);
            return fecha >= new Date(fechaInicio) && fecha <= new Date(fechaFin);
        });
        setFilteredMovimientos(filtered);
    };

    const stats = {
        totalIngresos: filteredMovimientos.filter(m => m.tipo === 'ingreso').reduce((sum, m) => sum + (m.valor || 0), 0),
        totalEgresos: filteredMovimientos.filter(m => m.tipo === 'egreso').reduce((sum, m) => sum + (m.valor || 0), 0)
    };
    stats.saldo = stats.totalIngresos - stats.totalEgresos;

    const handleExport = () => {
        let csvContent = "Fecha,Tipo,Concepto,Valor\n";
        csvContent += filteredMovimientos.map(m =>
            `"${formatDate(m.fecha)}","${m.tipo}","${m.concepto}","${m.valor}"`
        ).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `informe_caja_${fechaInicio}_${fechaFin}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const headers = ["Fecha", "Tipo", "Concepto", "Ingresos", "Egresos"];
    const renderRow = (mov) => (
        <tr key={Math.random()}>
            <td>{formatDate(mov.fecha)}</td>
            <td>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${mov.tipo === 'ingreso' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {mov.tipo}
                </span>
            </td>
            <td>{mov.concepto}</td>
            <td className="text-right text-green-600 font-medium">{mov.tipo === 'ingreso' ? formatCurrency(mov.valor) : '-'}</td>
            <td className="text-right text-red-600 font-medium">{mov.tipo === 'egreso' ? formatCurrency(mov.valor) : '-'}</td>
        </tr>
    );

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Informe de Caja"
                description="Movimientos de caja y flujo de efectivo de la empresa."
                onExportExcel={handleExport}
                onPrint={handlePrint}
            />

            <Card className="no-print">
                <CardHeader><CardTitle>Período del Informe</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Fecha Inicio</Label>
                            <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                        </div>
                        <div>
                            <Label>Fecha Fin</Label>
                            <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 no-print">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Total Ingresos</p>
                                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalIngresos)}</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Total Egresos</p>
                                <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalEgresos)}</p>
                            </div>
                            <TrendingDown className="w-8 h-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Saldo</p>
                                <p className={`text-2xl font-bold ${stats.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                    {formatCurrency(stats.saldo)}
                                </p>
                            </div>
                            <Wallet className="w-8 h-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div id="tabla-imprimible">
                <Card>
                    <CardHeader><CardTitle>Movimientos de Caja</CardTitle></CardHeader>
                    <CardContent>
                        <DataTable headers={headers} data={filteredMovimientos} renderRow={renderRow} loading={loading} />
                        <div className="mt-6 pt-4 border-t space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium">Total Ingresos:</span>
                                <span className="text-green-600 font-bold">{formatCurrency(stats.totalIngresos)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="font-medium">Total Egresos:</span>
                                <span className="text-red-600 font-bold">{formatCurrency(stats.totalEgresos)}</span>
                            </div>
                            <div className="flex justify-between text-lg font-bold pt-2 border-t">
                                <span>Saldo Final:</span>
                                <span className={stats.saldo >= 0 ? 'text-blue-600' : 'text-red-600'}>
                                    {formatCurrency(stats.saldo)}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}