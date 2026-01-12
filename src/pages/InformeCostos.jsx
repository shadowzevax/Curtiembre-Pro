import React, { useState, useEffect } from 'react';
import { ProcesoProduccion, OrdenCompra } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Package, DollarSign, TrendingUp, PieChart } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function InformeCostos() {
    const [loading, setLoading] = useState(true);
    const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
    const [costos, setCostos] = useState({
        materiasPrimas: 0,
        insumos: 0,
        manoObra: 0,
        procesosProduccion: 0,
        total: 0
    });

    useEffect(() => {
        loadData();
    }, [fechaInicio, fechaFin]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [procesos, compras] = await Promise.all([
                ProcesoProduccion.list(),
                OrdenCompra.list()
            ]);

            const filtrarPorFecha = (items, campo) => items.filter(item => {
                const fecha = new Date(item[campo]);
                return fecha >= new Date(fechaInicio) && fecha <= new Date(fechaFin);
            });

            const procesosFiltrados = filtrarPorFecha(procesos, 'fecha_inicio');
            const comprasFiltradas = filtrarPorFecha(compras, 'fecha_orden');

            const costoMateriasPrimas = comprasFiltradas
                .filter(c => c.tipo_compra === 'pieles' || c.tipo_compra === 'hojas')
                .reduce((sum, c) => sum + (c.total || 0), 0);

            const costoInsumos = comprasFiltradas
                .filter(c => c.tipo_compra === 'insumos')
                .reduce((sum, c) => sum + (c.total || 0), 0);

            const costoManoObra = procesosFiltrados.reduce((sum, p) => sum + (p.costo_mano_obra || 0), 0);

            const costoProcesos = procesosFiltrados.reduce((sum, p) => {
                return sum + 
                    (p.costo_total_limpieza || 0) + 
                    (p.costo_total_curtido || 0) + 
                    (p.subtotal_humectacion || 0) + 
                    (p.subtotal_recromado || 0) + 
                    (p.subtotal_recurtido || 0);
            }, 0);

            const costoTotal = costoMateriasPrimas + costoInsumos + costoManoObra + costoProcesos;

            setCostos({
                materiasPrimas: costoMateriasPrimas,
                insumos: costoInsumos,
                manoObra: costoManoObra,
                procesosProduccion: costoProcesos,
                total: costoTotal
            });
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        const csvContent = `Concepto,Valor,Porcentaje\n` +
            `Materias Primas,${costos.materiasPrimas},${((costos.materiasPrimas / costos.total) * 100).toFixed(2)}%\n` +
            `Insumos,${costos.insumos},${((costos.insumos / costos.total) * 100).toFixed(2)}%\n` +
            `Mano de Obra,${costos.manoObra},${((costos.manoObra / costos.total) * 100).toFixed(2)}%\n` +
            `Procesos de Producción,${costos.procesosProduccion},${((costos.procesosProduccion / costos.total) * 100).toFixed(2)}%\n` +
            `TOTAL,${costos.total},100%\n`;

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `informe_costos_${fechaInicio}_${fechaFin}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const calcularPorcentaje = (valor) => {
        return costos.total > 0 ? ((valor / costos.total) * 100).toFixed(1) : 0;
    };

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Informe de Costos"
                description="Análisis detallado de los costos de producción."
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

            <div id="tabla-imprimible">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-center text-2xl">Estructura de Costos</CardTitle>
                        <p className="text-center text-slate-600">
                            Del {new Date(fechaInicio).toLocaleDateString('es-CO')} al {new Date(fechaFin).toLocaleDateString('es-CO')}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Package className="w-8 h-8 text-blue-600" />
                                    <div>
                                        <p className="font-semibold text-slate-800">Materias Primas (Pieles y Hojas)</p>
                                        <p className="text-sm text-slate-600">{calcularPorcentaje(costos.materiasPrimas)}% del total</p>
                                    </div>
                                </div>
                                <span className="text-2xl font-bold text-blue-600">{formatCurrency(costos.materiasPrimas)}</span>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Package className="w-8 h-8 text-purple-600" />
                                    <div>
                                        <p className="font-semibold text-slate-800">Insumos y Químicos</p>
                                        <p className="text-sm text-slate-600">{calcularPorcentaje(costos.insumos)}% del total</p>
                                    </div>
                                </div>
                                <span className="text-2xl font-bold text-purple-600">{formatCurrency(costos.insumos)}</span>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <DollarSign className="w-8 h-8 text-orange-600" />
                                    <div>
                                        <p className="font-semibold text-slate-800">Mano de Obra</p>
                                        <p className="text-sm text-slate-600">{calcularPorcentaje(costos.manoObra)}% del total</p>
                                    </div>
                                </div>
                                <span className="text-2xl font-bold text-orange-600">{formatCurrency(costos.manoObra)}</span>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <TrendingUp className="w-8 h-8 text-emerald-600" />
                                    <div>
                                        <p className="font-semibold text-slate-800">Procesos de Producción</p>
                                        <p className="text-sm text-slate-600">{calcularPorcentaje(costos.procesosProduccion)}% del total</p>
                                    </div>
                                </div>
                                <span className="text-2xl font-bold text-emerald-600">{formatCurrency(costos.procesosProduccion)}</span>
                            </div>
                        </div>

                        <div className="border-t-2 pt-4">
                            <div className="flex items-center justify-between p-6 bg-slate-100 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <PieChart className="w-10 h-10 text-slate-700" />
                                    <p className="text-2xl font-bold text-slate-800">COSTO TOTAL</p>
                                </div>
                                <span className="text-3xl font-bold text-slate-800">{formatCurrency(costos.total)}</span>
                            </div>
                        </div>

                        <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-500">
                            <p className="text-sm text-slate-700">
                                <strong>Nota:</strong> Este informe muestra la distribución de costos según las compras y procesos registrados en el período seleccionado.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}