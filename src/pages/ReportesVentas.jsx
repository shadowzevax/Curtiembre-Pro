import React, { useState, useEffect } from 'react';
import { OrdenVenta, Cliente } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TrendingUp, DollarSign, ShoppingBag, Users } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('es-CO');
};

export default function ReportesVentas() {
    const [ventas, setVentas] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
    const [filteredVentas, setFilteredVentas] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [ventas, fechaInicio, fechaFin]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [ventasData, clientesData] = await Promise.all([
                OrdenVenta.list(),
                Cliente.list()
            ]);
            setVentas(ventasData);
            setClientes(clientesData);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = ventas.filter(v => {
            const fecha = new Date(v.fecha_orden);
            return fecha >= new Date(fechaInicio) && fecha <= new Date(fechaFin);
        });
        setFilteredVentas(filtered);
    };

    const getClienteNombre = (clienteId) => {
        const cliente = clientes.find(c => c.id === clienteId);
        return cliente ? cliente.nombre : clienteId;
    };

    const stats = {
        totalVentas: filteredVentas.length,
        totalIngresos: filteredVentas.reduce((sum, v) => sum + (v.total || 0), 0),
        ventasProductos: filteredVentas.filter(v => v.tipo_venta === 'productos').length,
        ventasServicios: filteredVentas.filter(v => v.tipo_venta === 'servicios').length,
        clientesUnicos: new Set(filteredVentas.map(v => v.cliente_id)).size
    };

    const handleExport = () => {
        let csvContent = "Fecha,Tipo,Cliente,Documento,Total\n";
        csvContent += filteredVentas.map(v =>
            `"${formatDate(v.fecha_orden)}","${v.tipo_venta}","${getClienteNombre(v.cliente_id)}","${v.numero_documento}","${v.total}"`
        ).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_ventas_${fechaInicio}_${fechaFin}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const headers = ["Fecha", "Tipo", "Cliente", "Documento #", "Total"];
    const renderRow = (venta) => (
        <tr key={venta.id}>
            <td>{formatDate(venta.fecha_orden)}</td>
            <td><span className="capitalize">{venta.tipo_venta}</span></td>
            <td>{getClienteNombre(venta.cliente_id)}</td>
            <td>{venta.prefijo_documento}-{venta.numero_documento}</td>
            <td className="text-right font-medium">{formatCurrency(venta.total)}</td>
        </tr>
    );

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Reportes de Ventas"
                description="Análisis detallado de las ventas de la empresa."
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
                                <p className="text-sm text-slate-600">Total Ventas</p>
                                <p className="text-2xl font-bold">{stats.totalVentas}</p>
                            </div>
                            <ShoppingBag className="w-8 h-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Ingresos</p>
                                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalIngresos)}</p>
                            </div>
                            <DollarSign className="w-8 h-8 text-emerald-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Productos</p>
                                <p className="text-2xl font-bold">{stats.ventasProductos}</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-purple-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Clientes</p>
                                <p className="text-2xl font-bold">{stats.clientesUnicos}</p>
                            </div>
                            <Users className="w-8 h-8 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div id="tabla-imprimible">
                <Card>
                    <CardHeader><CardTitle>Detalle de Ventas</CardTitle></CardHeader>
                    <CardContent>
                        <DataTable headers={headers} data={filteredVentas} renderRow={renderRow} loading={loading} />
                        <div className="mt-6 pt-4 border-t">
                            <div className="flex justify-end">
                                <div className="bg-emerald-50 px-6 py-3 rounded-lg">
                                    <span className="text-lg font-bold text-emerald-800">Total: {formatCurrency(stats.totalIngresos)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}