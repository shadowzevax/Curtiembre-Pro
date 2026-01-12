import React, { useState, useEffect } from 'react';
import { OrdenCompra, Proveedor } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, DollarSign, Package, Users } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO');
};

export default function ReportesCompras() {
    const [compras, setCompras] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
    const [filteredCompras, setFilteredCompras] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [compras, fechaInicio, fechaFin]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [comprasData, proveedoresData] = await Promise.all([
                OrdenCompra.list(),
                Proveedor.list()
            ]);
            setCompras(comprasData);
            setProveedores(proveedoresData);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = compras.filter(c => {
            const fecha = new Date(c.fecha_orden);
            return fecha >= new Date(fechaInicio) && fecha <= new Date(fechaFin);
        });
        setFilteredCompras(filtered);
    };

    const getProveedorNombre = (proveedorId) => {
        const proveedor = proveedores.find(p => p.id === proveedorId);
        return proveedor ? proveedor.nombre : proveedorId;
    };

    const stats = {
        totalCompras: filteredCompras.length,
        totalGastos: filteredCompras.reduce((sum, c) => sum + (c.total || 0), 0),
        comprasInsumos: filteredCompras.filter(c => c.tipo_compra === 'insumos').length,
        comprasPieles: filteredCompras.filter(c => c.tipo_compra === 'pieles').length,
        comprasHojas: filteredCompras.filter(c => c.tipo_compra === 'hojas').length,
        proveedoresUnicos: new Set(filteredCompras.map(c => c.proveedor_id)).size
    };

    const handleExport = () => {
        let csvContent = "Fecha,Tipo,Proveedor,Documento,Total\n";
        csvContent += filteredCompras.map(c =>
            `"${formatDate(c.fecha_orden)}","${c.tipo_compra}","${getProveedorNombre(c.proveedor_id)}","${c.numero_documento}","${c.total}"`
        ).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_compras_${fechaInicio}_${fechaFin}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const headers = ["Fecha", "Tipo", "Proveedor", "Documento #", "Total"];
    const renderRow = (compra) => (
        <tr key={compra.id}>
            <td>{formatDate(compra.fecha_orden)}</td>
            <td><span className="capitalize">{compra.tipo_compra}</span></td>
            <td>{getProveedorNombre(compra.proveedor_id)}</td>
            <td>{compra.prefijo_documento}-{compra.numero_documento}</td>
            <td className="text-right font-medium">{formatCurrency(compra.total)}</td>
        </tr>
    );

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Reportes de Compras"
                description="Análisis detallado de las compras de la empresa."
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

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Total Compras</p>
                                <p className="text-2xl font-bold">{stats.totalCompras}</p>
                            </div>
                            <ShoppingCart className="w-8 h-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Gastos</p>
                                <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalGastos)}</p>
                            </div>
                            <DollarSign className="w-8 h-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Por Categoría</p>
                                <p className="text-sm">I:{stats.comprasInsumos} P:{stats.comprasPieles} H:{stats.comprasHojas}</p>
                            </div>
                            <Package className="w-8 h-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Proveedores</p>
                                <p className="text-2xl font-bold">{stats.proveedoresUnicos}</p>
                            </div>
                            <Users className="w-8 h-8 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div id="tabla-imprimible">
                <Card>
                    <CardHeader><CardTitle>Detalle de Compras</CardTitle></CardHeader>
                    <CardContent>
                        <DataTable headers={headers} data={filteredCompras} renderRow={renderRow} loading={loading} />
                        <div className="mt-6 pt-4 border-t">
                            <div className="flex justify-end">
                                <div className="bg-red-50 px-6 py-3 rounded-lg">
                                    <span className="text-lg font-bold text-red-800">Total: {formatCurrency(stats.totalGastos)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}