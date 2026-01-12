import React, { useState, useEffect } from 'react';
import { OrdenCompra, OrdenVenta, CuentaContable } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function ReportesFinancieros() {
    const [loading, setLoading] = useState(true);
    const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
    const [datos, setDatos] = useState({
        ingresos: 0,
        gastos: 0,
        compras: 0,
        ventas: 0,
        otrosIngresos: 0,
        utilidad: 0,
        margen: 0
    });

    useEffect(() => {
        loadData();
    }, [fechaInicio, fechaFin]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [compras, ventas, cuentas] = await Promise.all([
                OrdenCompra.list(),
                OrdenVenta.list(),
                CuentaContable.list()
            ]);

            const filtrarPorFecha = (items) => items.filter(item => {
                const fecha = new Date(item.fecha_orden || item.fecha);
                return fecha >= new Date(fechaInicio) && fecha <= new Date(fechaFin);
            });

            const comprasFiltradas = filtrarPorFecha(compras);
            const ventasFiltradas = filtrarPorFecha(ventas);
            const cuentasFiltradas = filtrarPorFecha(cuentas);

            const totalCompras = comprasFiltradas.reduce((sum, c) => sum + (c.total || 0), 0);
            const totalVentas = ventasFiltradas.reduce((sum, v) => sum + (v.total || 0), 0);
            const totalGastos = cuentasFiltradas.filter(c => c.tipo_cuenta === 'gastos').reduce((sum, c) => sum + (c.valor || 0), 0);
            const totalOtrosIngresos = cuentasFiltradas.filter(c => c.tipo_cuenta === 'otros_ingresos').reduce((sum, c) => sum + (c.valor || 0), 0);

            const totalIngresos = totalVentas + totalOtrosIngresos;
            const totalCostos = totalCompras + totalGastos;
            const utilidad = totalIngresos - totalCostos;
            const margen = totalIngresos > 0 ? (utilidad / totalIngresos) * 100 : 0;

            setDatos({
                ingresos: totalIngresos,
                gastos: totalCostos,
                compras: totalCompras,
                ventas: totalVentas,
                otrosIngresos: totalOtrosIngresos,
                utilidad,
                margen
            });
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const csvContent = `Concepto,Valor\n` +
            `Ventas,${datos.ventas}\n` +
            `Otros Ingresos,${datos.otrosIngresos}\n` +
            `Total Ingresos,${datos.ingresos}\n` +
            `Compras,${datos.compras}\n` +
            `Gastos,${datos.gastos}\n` +
            `Total Costos,${datos.gastos}\n` +
            `Utilidad Neta,${datos.utilidad}\n` +
            `Margen,${datos.margen.toFixed(2)}%\n`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_financiero_${fechaInicio}_${fechaFin}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Reportes Financieros"
                description="Estado de resultados y análisis financiero de la empresa."
                onExportExcel={handleExport}
                onPrint={handlePrint}
            />

            <Card className="no-print">
                <CardHeader><CardTitle>Período del Reporte</CardTitle></CardHeader>
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

            <div id="tabla-imprimible">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-center text-2xl">Estado de Resultados</CardTitle>
                        <p className="text-center text-slate-600">
                            Del {new Date(fechaInicio).toLocaleDateString('es-CO')} al {new Date(fechaFin).toLocaleDateString('es-CO')}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <h3 className="font-bold text-lg text-emerald-700 border-b pb-2">INGRESOS</h3>
                            <div className="flex justify-between pl-4">
                                <span>Ventas</span>
                                <span className="font-medium">{formatCurrency(datos.ventas)}</span>
                            </div>
                            <div className="flex justify-between pl-4">
                                <span>Otros Ingresos</span>
                                <span className="font-medium">{formatCurrency(datos.otrosIngresos)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg bg-emerald-50 p-2 rounded">
                                <span>Total Ingresos</span>
                                <span className="text-emerald-700">{formatCurrency(datos.ingresos)}</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="font-bold text-lg text-red-700 border-b pb-2">COSTOS Y GASTOS</h3>
                            <div className="flex justify-between pl-4">
                                <span>Compras</span>
                                <span className="font-medium">{formatCurrency(datos.compras)}</span>
                            </div>
                            <div className="flex justify-between pl-4">
                                <span>Gastos Operacionales</span>
                                <span className="font-medium">{formatCurrency(datos.gastos)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-lg bg-red-50 p-2 rounded">
                                <span>Total Costos</span>
                                <span className="text-red-700">{formatCurrency(datos.gastos)}</span>
                            </div>
                        </div>

                        <div className="space-y-3 border-t-2 pt-4">
                            <div className={`flex justify-between font-bold text-2xl p-4 rounded-lg ${datos.utilidad >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                                <span>UTILIDAD NETA</span>
                                <span className={datos.utilidad >= 0 ? 'text-green-700' : 'text-red-700'}>
                                    {formatCurrency(datos.utilidad)}
                                </span>
                            </div>
                            <div className="flex justify-between font-semibold text-lg">
                                <span>Margen de Utilidad</span>
                                <span className={datos.margen >= 0 ? 'text-green-700' : 'text-red-700'}>
                                    {datos.margen.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-600">Ingresos Totales</p>
                                    <p className="text-xl font-bold text-emerald-600">{formatCurrency(datos.ingresos)}</p>
                                </div>
                                <TrendingUp className="w-8 h-8 text-emerald-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-600">Costos Totales</p>
                                    <p className="text-xl font-bold text-red-600">{formatCurrency(datos.gastos)}</p>
                                </div>
                                <TrendingDown className="w-8 h-8 text-red-500" />
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-slate-600">Utilidad</p>
                                    <p className={`text-xl font-bold ${datos.utilidad >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {formatCurrency(datos.utilidad)}
                                    </p>
                                </div>
                                <DollarSign className={`w-8 h-8 ${datos.utilidad >= 0 ? 'text-green-500' : 'text-red-500'}`} />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}