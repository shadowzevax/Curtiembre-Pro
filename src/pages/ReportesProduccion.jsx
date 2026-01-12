import React, { useState, useEffect } from 'react';
import { ProcesoProduccion, Proveedor, CostoIndirecto } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings, CheckCircle, Clock, Package, Table } from 'lucide-react';

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CO');
};

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function ReportesProduccion() {
    const [procesos, setProcesos] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [costosIndirectos, setCostosIndirectos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
    const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
    const [codigoLote, setCodigoLote] = useState('');
    const [filteredProcesos, setFilteredProcesos] = useState([]);
    const [showDetailTable, setShowDetailTable] = useState(false);
    const [selectedLote, setSelectedLote] = useState(null);
    const [detalleCompleto, setDetalleCompleto] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        applyFilters();
    }, [procesos, fechaInicio, fechaFin, codigoLote]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [data, provData, costosData] = await Promise.all([
                ProcesoProduccion.list(),
                Proveedor.list(),
                CostoIndirecto.list()
            ]);
            setProcesos(data);
            setProveedores(provData);
            setCostosIndirectos(costosData);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = () => {
        let filtered = procesos.filter(p => {
            const fecha = new Date(p.fecha_inicio);
            const fechaMatch = fecha >= new Date(fechaInicio) && fecha <= new Date(fechaFin);
            const loteMatch = !codigoLote || p.codigo_lote?.toLowerCase().includes(codigoLote.toLowerCase());
            return fechaMatch && loteMatch;
        });
        setFilteredProcesos(filtered);
    };

    const stats = {
        totalProcesos: filteredProcesos.length,
        completados: filteredProcesos.filter(p => p.estado === 'completado').length,
        enProceso: filteredProcesos.filter(p => p.estado === 'en_proceso').length,
        pendientes: filteredProcesos.filter(p => p.estado === 'pendiente').length,
        costoTotal: filteredProcesos.reduce((sum, p) => sum + (p.costo_total_limpieza || 0) + (p.costo_total_curtido || 0) + (p.subtotal_humectacion || 0) + (p.subtotal_recromado || 0) + (p.subtotal_recurtido || 0), 0)
    };

    const handleExport = () => {
        let csvContent = "Fecha,Tipo,Código Lote,Estado,Cantidad,Costo\n";
        csvContent += filteredProcesos.map(p =>
            `"${formatDate(p.fecha_inicio)}","${p.tipo_proceso}","${p.codigo_lote}","${p.estado}","${p.cantidad_pieles || p.cantidad_total_lote}","${(p.costo_total_limpieza || 0) + (p.costo_total_curtido || 0) + (p.subtotal_humectacion || 0) + (p.subtotal_recromado || 0) + (p.subtotal_recurtido || 0)}"`
        ).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `reporte_produccion_${fechaInicio}_${fechaFin}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const handleShowDetalleCompleto = async (codigoLote) => {
        // Buscar toda la información del lote
        const recepcion = procesos.find(p => p.codigo_lote === codigoLote && p.tipo_proceso === 'recepcion');
        const limpieza = procesos.filter(p => p.codigo_lote === codigoLote && p.tipo_proceso === 'limpieza');
        const curtido = procesos.filter(p => p.codigo_lote === codigoLote && p.tipo_proceso === 'curtido');
        const recurtido = procesos.filter(p => p.codigo_lote === codigoLote && p.tipo_proceso === 'recurtido');
        
        // Buscar costos indirectos del lote
        const serviciosMaquinaria = costosIndirectos.filter(c => c.codigo_lote === codigoLote && c.tipo_costo === 'servicio_maquinaria');
        const serviciosManoObra = costosIndirectos.filter(c => c.codigo_lote === codigoLote && c.tipo_costo === 'mano_obra');
        const otrosCostos = costosIndirectos.filter(c => c.codigo_lote === codigoLote && c.tipo_costo === 'otros_costos');

        const proveedor = proveedores.find(p => p.id === recepcion?.proveedor_id);

        setDetalleCompleto({
            codigoLote,
            recepcion,
            proveedor,
            remojo: limpieza.filter(l => l.seccion === 'remojo'),
            pelambre: limpieza.filter(l => l.seccion === 'pelambre'),
            curtido,
            recurtido,
            serviciosMaquinaria,
            serviciosManoObra,
            otrosCostos
        });
        setShowDetailTable(true);
    };

    const headers = ["Fecha", "Código Lote", "Cant. Total Pieles", "Cant. Total Hojas", "Estado", "Costo Total", "Acciones"];
    const renderRow = (proceso) => {
        const costoTotal = (proceso.costo_total_limpieza || 0) + (proceso.costo_total_curtido || 0) + (proceso.subtotal_humectacion || 0) + (proceso.subtotal_recromado || 0) + (proceso.subtotal_recurtido || 0);
        return (
            <tr key={proceso.id}>
                <td>{formatDate(proceso.fecha_inicio)}</td>
                <td>{proceso.codigo_lote}</td>
                <td>{proceso.cantidad_pieles || proceso.cantidad_total_lote_pieles || 0}</td>
                <td>{proceso.cantidad_total_lote_hojas || 0}</td>
                <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        proceso.estado === 'completado' ? 'bg-green-100 text-green-800' :
                        proceso.estado === 'en_proceso' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                    }`}>
                        {proceso.estado}
                    </span>
                </td>
                <td className="text-right font-medium">{formatCurrency(costoTotal)}</td>
                <td>
                    <Button variant="outline" size="sm" onClick={() => handleShowDetalleCompleto(proceso.codigo_lote)}>
                        <Table className="w-4 h-4" />
                    </Button>
                </td>
            </tr>
        );
    };

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Reportes de Producción"
                description="Análisis de los procesos de producción de la curtiembre."
                onExportExcel={handleExport}
                onPrint={handlePrint}
            />

            <Card className="no-print">
                <CardHeader><CardTitle>Filtros de Búsqueda</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <Label>Fecha Desde</Label>
                            <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
                        </div>
                        <div>
                            <Label>Fecha Final</Label>
                            <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
                        </div>
                        <div>
                            <Label>Código Lote</Label>
                            <Input placeholder="Buscar por código de lote..." value={codigoLote} onChange={(e) => setCodigoLote(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Total Procesos</p>
                                <p className="text-2xl font-bold">{stats.totalProcesos}</p>
                            </div>
                            <Settings className="w-8 h-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Completados</p>
                                <p className="text-2xl font-bold text-green-600">{stats.completados}</p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">En Proceso</p>
                                <p className="text-2xl font-bold text-blue-600">{stats.enProceso}</p>
                            </div>
                            <Clock className="w-8 h-8 text-blue-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Costo Total</p>
                                <p className="text-xl font-bold text-red-600">{formatCurrency(stats.costoTotal)}</p>
                            </div>
                            <Package className="w-8 h-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div id="tabla-imprimible">
                <Card>
                    <CardHeader><CardTitle>Detalle de Procesos</CardTitle></CardHeader>
                    <CardContent>
                        <DataTable headers={headers} data={filteredProcesos} renderRow={renderRow} loading={loading} />
                        <div className="mt-6 pt-4 border-t">
                            <div className="flex justify-end">
                                <div className="bg-red-50 px-6 py-3 rounded-lg">
                                    <span className="text-lg font-bold text-red-800">Costo Total: {formatCurrency(stats.costoTotal)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Dialog open={showDetailTable} onOpenChange={setShowDetailTable}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Reporte Completo de Producción - Lote {detalleCompleto?.codigoLote}</DialogTitle>
                    </DialogHeader>
                    {detalleCompleto && (
                        <div className="space-y-6">
                            {/* Información General de Recepción */}
                            <div className="bg-blue-50 p-4 rounded-lg grid grid-cols-5 gap-4 text-sm">
                                <div><p className="text-gray-600">Código Lote</p><p className="font-bold">{detalleCompleto.recepcion?.codigo_lote || 'N/A'}</p></div>
                                <div><p className="text-gray-600">Proveedor</p><p className="font-bold">{detalleCompleto.proveedor?.nombre || 'N/A'}</p></div>
                                <div><p className="text-gray-600">No. Documento</p><p className="font-bold">{detalleCompleto.recepcion?.no_documento || 'N/A'}</p></div>
                                <div><p className="text-gray-600">Cant. Total Lote en Pieles</p><p className="font-bold">{detalleCompleto.recepcion?.cantidad_total_lote_pieles || 0}</p></div>
                                <div><p className="text-gray-600">Cant. Total Lote en Hojas</p><p className="font-bold">{detalleCompleto.recepcion?.cantidad_total_lote_hojas || 0}</p></div>
                            </div>

                            {/* Sección REMOJO */}
                            {detalleCompleto.remojo && detalleCompleto.remojo.length > 0 && (
                                <div className="border rounded-lg p-4">
                                    <h3 className="font-bold text-lg mb-3 text-blue-700">REMOJO</h3>
                                    {detalleCompleto.remojo.map((rem, idx) => (
                                        <div key={idx} className="mb-4">
                                            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-2 rounded mb-2 text-sm">
                                                <div><span className="text-gray-600">Cantidad Pieles:</span> <span className="font-semibold">{rem.cantidad_pieles || 0}</span></div>
                                                <div><span className="text-gray-600">Peso Actual (kg):</span> <span className="font-semibold">{rem.peso_actual || 0}</span></div>
                                                <div><span className="text-gray-600">Peso Promedio (kg):</span> <span className="font-semibold">{rem.peso_promedio || 0}</span></div>
                                            </div>
                                            <table className="w-full text-xs border rounded">
                                                <thead className="bg-blue-100">
                                                    <tr>
                                                        <th className="p-2 text-left">Código</th>
                                                        <th className="p-2 text-left">Producto</th>
                                                        <th className="p-2 text-right">Cantidad (kg)</th>
                                                        <th className="p-2 text-right">Costo Unit. ($/kg)</th>
                                                        <th className="p-2 text-right">IVA</th>
                                                        <th className="p-2 text-right">% Dosificación</th>
                                                        <th className="p-2 text-right">Valor Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {rem.insumos_utilizados && rem.insumos_utilizados.filter(i => i.seccion === 'remojo').length > 0 ? (
                                                        rem.insumos_utilizados.filter(i => i.seccion === 'remojo').map((ins, i) => (
                                                            <tr key={i} className="border-t">
                                                                <td className="p-2">{ins.codigo}</td>
                                                                <td className="p-2">{ins.producto}</td>
                                                                <td className="p-2 text-right">{ins.cantidad?.toFixed(2)}</td>
                                                                <td className="p-2 text-right">{formatCurrency(ins.costo_unitario)}</td>
                                                                <td className="p-2 text-right">{(ins.iva * 100).toFixed(0)}%</td>
                                                                <td className="p-2 text-right">{ins.dosificacion?.toFixed(2)}%</td>
                                                                <td className="p-2 text-right font-medium">{formatCurrency(ins.valor_total)}</td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="7" className="p-4 text-center text-gray-500 italic">
                                                                No hay insumos registrados para esta sección
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                    <div className="bg-blue-100 p-3 rounded mt-2">
                                        <p className="font-bold">Subtotal Remojo: {formatCurrency(detalleCompleto.remojo.reduce((sum, r) => sum + (r.costo_remojo || 0), 0))}</p>
                                    </div>
                                </div>
                            )}

                            {/* Sección PELAMBRE */}
                            {detalleCompleto.pelambre && detalleCompleto.pelambre.length > 0 && (
                                <div className="border rounded-lg p-4">
                                    <h3 className="font-bold text-lg mb-3 text-purple-700">PELAMBRE</h3>
                                    {detalleCompleto.pelambre.map((pel, idx) => (
                                        <div key={idx} className="mb-4">
                                            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-2 rounded mb-2 text-sm">
                                                <div><span className="text-gray-600">Cantidad Pieles:</span> <span className="font-semibold">{pel.cantidad_pieles || 0}</span></div>
                                                <div><span className="text-gray-600">Peso Actual (kg):</span> <span className="font-semibold">{pel.peso_actual || 0}</span></div>
                                                <div><span className="text-gray-600">Peso Promedio (kg):</span> <span className="font-semibold">{pel.peso_promedio || 0}</span></div>
                                            </div>
                                            <table className="w-full text-xs border rounded">
                                                <thead className="bg-purple-100">
                                                    <tr>
                                                        <th className="p-2 text-left">Código</th>
                                                        <th className="p-2 text-left">Producto</th>
                                                        <th className="p-2 text-right">Cantidad (kg)</th>
                                                        <th className="p-2 text-right">Costo Unit. ($/kg)</th>
                                                        <th className="p-2 text-right">IVA</th>
                                                        <th className="p-2 text-right">% Dosificación</th>
                                                        <th className="p-2 text-right">Valor Total</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {pel.insumos_utilizados && pel.insumos_utilizados.filter(i => i.seccion === 'pelambre').length > 0 ? (
                                                        pel.insumos_utilizados.filter(i => i.seccion === 'pelambre').map((ins, i) => (
                                                            <tr key={i} className="border-t">
                                                                <td className="p-2">{ins.codigo}</td>
                                                                <td className="p-2">{ins.producto}</td>
                                                                <td className="p-2 text-right">{ins.cantidad?.toFixed(2)}</td>
                                                                <td className="p-2 text-right">{formatCurrency(ins.costo_unitario)}</td>
                                                                <td className="p-2 text-right">{(ins.iva * 100).toFixed(0)}%</td>
                                                                <td className="p-2 text-right">{ins.dosificacion?.toFixed(2)}%</td>
                                                                <td className="p-2 text-right font-medium">{formatCurrency(ins.valor_total)}</td>
                                                            </tr>
                                                        ))
                                                    ) : (
                                                        <tr>
                                                            <td colSpan="7" className="p-4 text-center text-gray-500 italic">
                                                                No hay insumos registrados para esta sección
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                    <div className="bg-purple-100 p-3 rounded mt-2">
                                        <p className="font-bold">Subtotal Pelambre: {formatCurrency(detalleCompleto.pelambre.reduce((sum, p) => sum + (p.costo_pelambre || 0), 0))}</p>
                                    </div>
                                </div>
                            )}

                            {/* Sección CURTIDO */}
                            {detalleCompleto.curtido && detalleCompleto.curtido.length > 0 && (
                                <div className="border rounded-lg p-4">
                                    <h3 className="font-bold text-lg mb-3 text-green-700">CURTIDO</h3>
                                    {detalleCompleto.curtido.map((curt, idx) => (
                                        <div key={idx} className="mb-4">
                                            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-2 rounded mb-2 text-sm">
                                                <div><span className="text-gray-600">Cantidad Pieles:</span> <span className="font-semibold">{curt.cantidad_pieles || 0}</span></div>
                                                <div><span className="text-gray-600">Peso Actual (kg):</span> <span className="font-semibold">{curt.peso_actual || 0}</span></div>
                                                <div><span className="text-gray-600">Peso Promedio (kg):</span> <span className="font-semibold">{curt.peso_promedio || 0}</span></div>
                                            </div>
                                            {curt.insumos_utilizados && curt.insumos_utilizados.length > 0 && (
                                                <table className="w-full text-xs border rounded">
                                                    <thead className="bg-green-100">
                                                        <tr>
                                                            <th className="p-2 text-left">Código</th>
                                                            <th className="p-2 text-left">Producto</th>
                                                            <th className="p-2 text-right">Cantidad (kg)</th>
                                                            <th className="p-2 text-right">Costo Unit. ($/kg)</th>
                                                            <th className="p-2 text-right">IVA</th>
                                                            <th className="p-2 text-right">% Dosificación</th>
                                                            <th className="p-2 text-right">Valor Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {curt.insumos_utilizados.map((ins, i) => (
                                                            <tr key={i} className="border-t">
                                                                <td className="p-2">{ins.codigo}</td>
                                                                <td className="p-2">{ins.producto}</td>
                                                                <td className="p-2 text-right">{ins.cantidad?.toFixed(2)}</td>
                                                                <td className="p-2 text-right">{formatCurrency(ins.costo_unitario)}</td>
                                                                <td className="p-2 text-right">{(ins.iva * 100).toFixed(0)}%</td>
                                                                <td className="p-2 text-right">{ins.dosificacion?.toFixed(2)}%</td>
                                                                <td className="p-2 text-right font-medium">{formatCurrency(ins.valor_total)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    ))}
                                    <div className="bg-green-100 p-3 rounded mt-2">
                                        <p className="font-bold">Subtotal Curtido: {formatCurrency(detalleCompleto.curtido.reduce((sum, c) => sum + (c.costo_total_curtido || 0), 0))}</p>
                                    </div>
                                </div>
                            )}

                            {/* Sección RECURTIDO - Por cada código de color */}
                            {detalleCompleto.recurtido && detalleCompleto.recurtido.length > 0 && (
                                <div className="border rounded-lg p-4">
                                    <h3 className="font-bold text-lg mb-3 text-orange-700">RECURTIDO</h3>
                                    {detalleCompleto.recurtido.map((rec, idx) => (
                                        <div key={idx} className="mb-4 border-b pb-4 last:border-b-0">
                                            <div className="bg-orange-50 p-3 rounded mb-2">
                                                <p className="font-semibold text-orange-800">Código Color: {rec.codigo_color || 'N/A'} - {rec.nombre_color || 'N/A'}</p>
                                            </div>
                                            <div className="grid grid-cols-3 gap-4 bg-gray-50 p-2 rounded mb-2 text-sm">
                                                <div><span className="text-gray-600">Cantidad Pieles:</span> <span className="font-semibold">{rec.cantidad_pieles || 0}</span></div>
                                                <div><span className="text-gray-600">Peso Actual (kg):</span> <span className="font-semibold">{rec.peso_actual || 0}</span></div>
                                                <div><span className="text-gray-600">Peso Promedio (kg):</span> <span className="font-semibold">{rec.peso_promedio || 0}</span></div>
                                            </div>
                                            {rec.insumos_utilizados && rec.insumos_utilizados.length > 0 && (
                                                <table className="w-full text-xs border rounded">
                                                    <thead className="bg-orange-100">
                                                        <tr>
                                                            <th className="p-2 text-left">Código</th>
                                                            <th className="p-2 text-left">Producto</th>
                                                            <th className="p-2 text-right">Cantidad (kg)</th>
                                                            <th className="p-2 text-right">Costo Unit. ($/kg)</th>
                                                            <th className="p-2 text-right">IVA</th>
                                                            <th className="p-2 text-right">% Dosificación</th>
                                                            <th className="p-2 text-right">Valor Total</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {rec.insumos_utilizados.map((ins, i) => (
                                                            <tr key={i} className="border-t">
                                                                <td className="p-2">{ins.codigo}</td>
                                                                <td className="p-2">{ins.producto}</td>
                                                                <td className="p-2 text-right">{ins.cantidad?.toFixed(2)}</td>
                                                                <td className="p-2 text-right">{formatCurrency(ins.costo_unitario)}</td>
                                                                <td className="p-2 text-right">{(ins.iva * 100).toFixed(0)}%</td>
                                                                <td className="p-2 text-right">{ins.dosificacion?.toFixed(2)}%</td>
                                                                <td className="p-2 text-right font-medium">{formatCurrency(ins.valor_total)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    ))}
                                    <div className="bg-orange-100 p-3 rounded mt-2">
                                        <p className="font-bold">Subtotal Recurtido: {formatCurrency(detalleCompleto.recurtido.reduce((sum, r) => sum + (r.subtotal_humectacion || 0) + (r.subtotal_recromado || 0) + (r.subtotal_recurtido || 0), 0))}</p>
                                    </div>
                                </div>
                            )}

                            {/* Sección SERVICIO DE MAQUINARIA */}
                            {detalleCompleto.serviciosMaquinaria && detalleCompleto.serviciosMaquinaria.length > 0 && (
                                <div className="border rounded-lg p-4">
                                    <h3 className="font-bold text-lg mb-3 text-indigo-700">SERVICIO DE MAQUINARIA</h3>
                                    <table className="w-full text-xs border rounded">
                                        <thead className="bg-indigo-100">
                                            <tr>
                                                <th className="p-2 text-left">Nombre del Servicio</th>
                                                <th className="p-2 text-right">Cantidad en Pieles</th>
                                                <th className="p-2 text-right">Valor Unitario</th>
                                                <th className="p-2 text-right">Valor Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detalleCompleto.serviciosMaquinaria.map((serv, i) => (
                                                <tr key={i} className="border-t">
                                                    <td className="p-2">{serv.nombre_servicio}</td>
                                                    <td className="p-2 text-right">{serv.cantidad_pieles || 0}</td>
                                                    <td className="p-2 text-right">{formatCurrency(serv.valor_unitario)}</td>
                                                    <td className="p-2 text-right font-medium">{formatCurrency(serv.valor_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="bg-indigo-100 p-3 rounded mt-2">
                                        <p className="font-bold">Subtotal Servicio de Maquinaria: {formatCurrency(detalleCompleto.serviciosMaquinaria.reduce((sum, s) => sum + (s.subtotal || 0), 0))}</p>
                                    </div>
                                </div>
                            )}

                            {/* Sección SERVICIO DE MANO DE OBRA */}
                            {detalleCompleto.serviciosManoObra && detalleCompleto.serviciosManoObra.length > 0 && (
                                <div className="border rounded-lg p-4">
                                    <h3 className="font-bold text-lg mb-3 text-teal-700">SERVICIO DE MANO DE OBRA</h3>
                                    <table className="w-full text-xs border rounded">
                                        <thead className="bg-teal-100">
                                            <tr>
                                                <th className="p-2 text-left">Nombre Mano de Obra</th>
                                                <th className="p-2 text-right">Cantidad en Pieles</th>
                                                <th className="p-2 text-right">Valor Unitario</th>
                                                <th className="p-2 text-right">Valor Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detalleCompleto.serviciosManoObra.map((serv, i) => (
                                                <tr key={i} className="border-t">
                                                    <td className="p-2">{serv.nombre_servicio}</td>
                                                    <td className="p-2 text-right">{serv.cantidad_pieles || 0}</td>
                                                    <td className="p-2 text-right">{formatCurrency(serv.valor_unitario)}</td>
                                                    <td className="p-2 text-right font-medium">{formatCurrency(serv.valor_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="bg-teal-100 p-3 rounded mt-2">
                                        <p className="font-bold">Subtotal Servicio Mano de Obra: {formatCurrency(detalleCompleto.serviciosManoObra.reduce((sum, s) => sum + (s.subtotal || 0), 0))}</p>
                                    </div>
                                </div>
                            )}

                            {/* Sección OTROS COSTOS */}
                            {detalleCompleto.otrosCostos && detalleCompleto.otrosCostos.length > 0 && (
                                <div className="border rounded-lg p-4">
                                    <h3 className="font-bold text-lg mb-3 text-amber-700">OTROS COSTOS</h3>
                                    <table className="w-full text-xs border rounded">
                                        <thead className="bg-amber-100">
                                            <tr>
                                                <th className="p-2 text-left">Nombre Otros Costos</th>
                                                <th className="p-2 text-right">Cantidad en Pieles</th>
                                                <th className="p-2 text-right">Valor Unitario</th>
                                                <th className="p-2 text-right">Valor Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {detalleCompleto.otrosCostos.map((costo, i) => (
                                                <tr key={i} className="border-t">
                                                    <td className="p-2">{costo.nombre_servicio}</td>
                                                    <td className="p-2 text-right">{costo.cantidad_pieles || 0}</td>
                                                    <td className="p-2 text-right">{formatCurrency(costo.valor_unitario)}</td>
                                                    <td className="p-2 text-right font-medium">{formatCurrency(costo.valor_total)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="bg-amber-100 p-3 rounded mt-2">
                                        <p className="font-bold">Subtotal Otros Costos: {formatCurrency(detalleCompleto.otrosCostos.reduce((sum, c) => sum + (c.subtotal || 0), 0))}</p>
                                    </div>
                                </div>
                            )}

                            {/* TOTALES FINALES */}
                            {(() => {
                                const subtotalRemojo = detalleCompleto.remojo?.reduce((sum, r) => sum + (r.costo_remojo || 0), 0) || 0;
                                const subtotalPelambre = detalleCompleto.pelambre?.reduce((sum, p) => sum + (p.costo_pelambre || 0), 0) || 0;
                                const subtotalCurtido = detalleCompleto.curtido?.reduce((sum, c) => sum + (c.costo_total_curtido || 0), 0) || 0;
                                const subtotalRecurtido = detalleCompleto.recurtido?.reduce((sum, r) => sum + (r.subtotal_humectacion || 0) + (r.subtotal_recromado || 0) + (r.subtotal_recurtido || 0), 0) || 0;
                                const subtotalMaquinaria = detalleCompleto.serviciosMaquinaria?.reduce((sum, s) => sum + (s.subtotal || 0), 0) || 0;
                                const subtotalManoObra = detalleCompleto.serviciosManoObra?.reduce((sum, s) => sum + (s.subtotal || 0), 0) || 0;
                                const subtotalOtros = detalleCompleto.otrosCostos?.reduce((sum, c) => sum + (c.subtotal || 0), 0) || 0;
                                
                                const sumasTotales = subtotalRemojo + subtotalPelambre + subtotalCurtido + subtotalRecurtido + subtotalMaquinaria + subtotalManoObra + subtotalOtros;
                                const cantTotalPieles = detalleCompleto.recepcion?.cantidad_total_lote_pieles || 1;
                                const costoPorPielPuestaEnPasto = sumasTotales / cantTotalPieles;
                                const costosNetos = sumasTotales - costoPorPielPuestaEnPasto;
                                const costoCrostaPorHoja = costosNetos / cantTotalPieles;
                                const pesoPromedioEstandar = detalleCompleto.recepcion?.peso_promedio_estandar_por_piel || 0;
                                const costoCrostaPorPie = costoCrostaPorHoja * pesoPromedioEstandar;

                                return (
                                    <div className="bg-gradient-to-r from-slate-100 to-slate-200 p-6 rounded-lg border-2 border-slate-400">
                                        <h3 className="font-bold text-xl mb-4 text-slate-800">TOTALES Y CÁLCULOS FINALES</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-white p-4 rounded-lg shadow">
                                                <p className="text-sm text-gray-600">Sumas Totales</p>
                                                <p className="text-2xl font-bold text-blue-700">{formatCurrency(sumasTotales)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow">
                                                <p className="text-sm text-gray-600">Costo por Piel Puesta en Pasto</p>
                                                <p className="text-2xl font-bold text-green-700">{formatCurrency(costoPorPielPuestaEnPasto)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow">
                                                <p className="text-sm text-gray-600">Costos Netos</p>
                                                <p className="text-2xl font-bold text-purple-700">{formatCurrency(costosNetos)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow">
                                                <p className="text-sm text-gray-600">Costo de Crosta por Hoja</p>
                                                <p className="text-2xl font-bold text-orange-700">{formatCurrency(costoCrostaPorHoja)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow">
                                                <p className="text-sm text-gray-600">Costo de Crosta por Pie</p>
                                                <p className="text-2xl font-bold text-red-700">{formatCurrency(costoCrostaPorPie)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow">
                                                <p className="text-sm text-gray-600">Costo de una Hoja ya Terminada</p>
                                                <p className="text-2xl font-bold text-indigo-700">{formatCurrency(0)}</p>
                                            </div>
                                            <div className="bg-white p-4 rounded-lg shadow col-span-2">
                                                <p className="text-sm text-gray-600">Costo del Pie Terminado</p>
                                                <p className="text-2xl font-bold text-teal-700">{formatCurrency(0)}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                    <div className="flex justify-end pt-4 border-t">
                        <Button onClick={() => setShowDetailTable(false)}>Cerrar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}