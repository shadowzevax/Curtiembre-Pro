import React, { useState, useEffect } from 'react';
import { Insumo, ProductoTerminado, OrdenCompra, OrdenVenta } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (date) => new Date(date).toLocaleDateString('es-CO');

export default function ReportesInventario() {
    const [insumos, setInsumos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('insumos');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [insumosData, productosData, comprasData, ventasData] = await Promise.all([
                Insumo.list(),
                ProductoTerminado.list(),
                OrdenCompra.list(),
                OrdenVenta.list()
            ]);
            setInsumos(insumosData);
            setProductos(productosData);
            
            // Crear movimientos desde compras
            const movimientosCompras = comprasData.flatMap(compra => 
                (compra.items || []).map(item => ({
                    fecha: compra.fecha_orden,
                    tipo_documento: compra.tipo_documento,
                    numero_documento: compra.numero_documento,
                    modulo: 'Compras',
                    codigo_producto: item.insumo_id,
                    cantidad: item.cantidad,
                    unidad_medida: item.unidad_medida,
                    costo_promedio: item.precio_unitario
                }))
            );
            
            // Crear movimientos desde ventas
            const movimientosVentas = ventasData.flatMap(venta => 
                (venta.items || []).map(item => ({
                    fecha: venta.fecha_orden,
                    tipo_documento: venta.tipo_documento,
                    numero_documento: venta.numero_documento,
                    modulo: 'Ventas',
                    codigo_producto: item.producto_id,
                    cantidad: item.cantidad,
                    unidad_medida: '',
                    costo_promedio: item.precio_unitario
                }))
            );
            
            setMovimientos([...movimientosCompras, ...movimientosVentas].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)));
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const statsInsumos = {
        total: insumos.length,
        valorTotal: insumos.reduce((sum, i) => sum + ((i.stock_actual || 0) * (i.costo_promedio || 0)), 0),
        bajoStock: insumos.filter(i => i.stock_actual <= i.stock_minimo).length,
        sinStock: insumos.filter(i => i.stock_actual === 0).length
    };

    const statsProductos = {
        total: productos.length,
        valorTotal: productos.reduce((sum, p) => sum + ((p.stock_actual || 0) * (p.costo_promedio || 0)), 0),
        bajoStock: productos.filter(p => p.stock_actual <= p.stock_minimo).length,
        sinStock: productos.filter(p => p.stock_actual === 0).length
    };

    const handleExport = () => {
        const data = activeTab === 'insumos' ? insumos : productos;
        let csvContent = "Código,Nombre,Categoría,Stock Actual,Stock Mínimo,Costo Promedio,Valor Total\n";
        csvContent += data.map(item =>
            `"${item.codigo}","${item.nombre || item.descripcion}","${item.categoria}","${item.stock_actual}","${item.stock_minimo}","${item.costo_promedio}","${(item.stock_actual || 0) * (item.costo_promedio || 0)}"`
        ).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_inventario_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const headersInsumos = ["Código", "Nombre", "Categoría", "Stock Actual", "Stock Mínimo", "Costo Prom.", "Valor Total", "Estado"];
    const renderInsumoRow = (item) => {
        const valorTotal = (item.stock_actual || 0) * (item.costo_promedio || 0);
        const estado = item.stock_actual === 0 ? 'Sin Stock' : (item.stock_actual <= item.stock_minimo ? 'Bajo Stock' : 'Normal');
        const estadoColor = item.stock_actual === 0 ? 'text-red-600' : (item.stock_actual <= item.stock_minimo ? 'text-orange-600' : 'text-green-600');
        
        return (
            <tr key={item.id}>
                <td>{item.codigo}</td>
                <td>{item.nombre}</td>
                <td className="capitalize">{item.categoria}</td>
                <td className="text-right">{item.stock_actual}</td>
                <td className="text-right">{item.stock_minimo}</td>
                <td className="text-right">{formatCurrency(item.costo_promedio)}</td>
                <td className="text-right font-medium">{formatCurrency(valorTotal)}</td>
                <td className={`font-semibold ${estadoColor}`}>{estado}</td>
            </tr>
        );
    };

    const headersProductos = ["Código", "Descripción", "Categoría", "Stock Actual", "Stock Mínimo", "Costo Prom.", "Valor Total", "Estado"];
    const renderProductoRow = (item) => {
        const valorTotal = (item.stock_actual || 0) * (item.costo_promedio || 0);
        const estado = item.stock_actual === 0 ? 'Sin Stock' : (item.stock_actual <= item.stock_minimo ? 'Bajo Stock' : 'Normal');
        const estadoColor = item.stock_actual === 0 ? 'text-red-600' : (item.stock_actual <= item.stock_minimo ? 'text-orange-600' : 'text-green-600');
        
        return (
            <tr key={item.id}>
                <td>{item.codigo}</td>
                <td>{item.descripcion}</td>
                <td className="capitalize">{item.categoria}</td>
                <td className="text-right">{item.stock_actual}</td>
                <td className="text-right">{item.stock_minimo}</td>
                <td className="text-right">{formatCurrency(item.costo_promedio)}</td>
                <td className="text-right font-medium">{formatCurrency(valorTotal)}</td>
                <td className={`font-semibold ${estadoColor}`}>{estado}</td>
            </tr>
        );
    };

    const headersMovimientos = ["Fecha", "Tipo DCTO", "Nº Documento", "Módulo", "Cantidad", "U. Medida", "Costo Promedio"];
    const renderMovimientoRow = (m) => (
        <tr key={`${m.numero_documento}-${m.codigo_producto}`}>
            <td>{formatDate(m.fecha)}</td>
            <td className="capitalize">{m.tipo_documento?.replace(/_/g, ' ')}</td>
            <td>{m.numero_documento}</td>
            <td><span className={`px-2 py-1 rounded text-xs ${m.modulo === 'Compras' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{m.modulo}</span></td>
            <td className="text-right">{m.cantidad}</td>
            <td>{m.unidad_medida || 'N/A'}</td>
            <td className="text-right">{formatCurrency(m.costo_promedio)}</td>
        </tr>
    );

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Reportes de Inventario"
                description="Estado actual del inventario de insumos y productos terminados."
                onExportExcel={handleExport}
                onPrint={handlePrint}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Total Items</p>
                                <p className="text-2xl font-bold">{activeTab === 'insumos' ? statsInsumos.total : statsProductos.total}</p>
                            </div>
                            <Package className="w-8 h-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Valor Total</p>
                                <p className="text-xl font-bold text-emerald-600">{formatCurrency(activeTab === 'insumos' ? statsInsumos.valorTotal : statsProductos.valorTotal)}</p>
                            </div>
                            <TrendingUp className="w-8 h-8 text-emerald-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Bajo Stock</p>
                                <p className="text-2xl font-bold text-orange-600">{activeTab === 'insumos' ? statsInsumos.bajoStock : statsProductos.bajoStock}</p>
                            </div>
                            <TrendingDown className="w-8 h-8 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Sin Stock</p>
                                <p className="text-2xl font-bold text-red-600">{activeTab === 'insumos' ? statsInsumos.sinStock : statsProductos.sinStock}</p>
                            </div>
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="insumos">Insumos</TabsTrigger>
                    <TabsTrigger value="productos">Productos Terminados</TabsTrigger>
                    <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
                </TabsList>
                <TabsContent value="insumos">
                    <div id="tabla-imprimible">
                        <Card>
                            <CardHeader><CardTitle>Inventario de Insumos</CardTitle></CardHeader>
                            <CardContent>
                                <DataTable headers={headersInsumos} data={insumos} renderRow={renderInsumoRow} loading={loading} />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                <TabsContent value="productos">
                    <div id="tabla-imprimible">
                        <Card>
                            <CardHeader><CardTitle>Inventario de Productos Terminados</CardTitle></CardHeader>
                            <CardContent>
                                <DataTable headers={headersProductos} data={productos} renderRow={renderProductoRow} loading={loading} />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                <TabsContent value="movimientos">
                    <div id="tabla-imprimible">
                        <Card>
                            <CardHeader><CardTitle>Movimientos de Inventario</CardTitle></CardHeader>
                            <CardContent>
                                <DataTable headers={headersMovimientos} data={movimientos} renderRow={renderMovimientoRow} loading={loading} />
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}