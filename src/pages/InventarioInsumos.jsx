import React, { useState, useEffect, useCallback } from 'react';
import { Insumo, MovimientoInventario, ProductoCatalogo } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Eye, Edit, Trash2, ClipboardList, Calculator } from 'lucide-react';
import InventarioItemForm from '../components/inventario/InventarioItemForm';
import AjusteInventarioModal from '../components/inventario/AjusteInventarioModal';
import InventarioItemDetail from '../components/inventario/InventarioItemDetail';
import StockAlert from '../components/inventario/StockAlert';

export default function InventarioInsumos() {
    const [insumos, setInsumos] = useState([]);
    const [filteredInsumos, setFilteredInsumos] = useState([]);
    const [searchCodigo, setSearchCodigo] = useState('');
    const [searchDescripcion, setSearchDescripcion] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showAjusteModal, setShowAjusteModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showCalculoModal, setShowCalculoModal] = useState(false);
    const [calculoDetalle, setCalculoDetalle] = useState(null);

    const loadData = useCallback(async () => {
        try {
            const [data, movimientos, productosCatalogo] = await Promise.all([
                Insumo.list(),
                MovimientoInventario.list(),
                ProductoCatalogo.list()
            ]);
            
            // Calcular stock_actual desde movimientos y mezclar con catalogo
            const insumosConStock = data.map(ins => {
                const movsIns = movimientos.filter(m => m.insumo_id === ins.id);
                const stockActual = movsIns.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
                
                // Buscar info en catalogo si existe
                const catalogoItem = productosCatalogo.find(p => p.codigo === ins.codigo);
                
                return { 
                    ...ins, 
                    stock_actual: stockActual,
                    // Priorizar info de catalogo si existe para visualizacion
                    descripcion: catalogoItem ? catalogoItem.descripcion : (ins.descripcion || ins.nombre),
                    categoria: catalogoItem ? catalogoItem.categoria : ins.categoria
                };
            });
            
            setInsumos(insumosConStock);
            setFilteredInsumos(insumosConStock);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        loadData();
        
        // Recargar en background sin mostrar loading
        const interval = setInterval(() => {
            (async () => {
                try {
                    const [data, movimientos, productosCatalogo] = await Promise.all([
                        Insumo.list(),
                        MovimientoInventario.list(),
                        ProductoCatalogo.list()
                    ]);
                    
                    const insumosConStock = data.map(ins => {
                        const movsIns = movimientos.filter(m => m.insumo_id === ins.id);
                        const stockActual = movsIns.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
                        const catalogoItem = productosCatalogo.find(p => p.codigo === ins.codigo);
                        
                        return { 
                            ...ins, 
                            stock_actual: stockActual,
                            descripcion: catalogoItem ? catalogoItem.descripcion : (ins.descripcion || ins.nombre),
                            categoria: catalogoItem ? catalogoItem.categoria : ins.categoria
                        };
                    });
                    
                    setInsumos(insumosConStock);
                    setFilteredInsumos(prev => {
                        const prevIds = new Set(prev.map(p => p.id));
                        return insumosConStock.filter(p => prevIds.has(p.id) || prev.length === 0);
                    });
                } catch (error) { console.error(error); }
            })();
        }, 3000);
        
        return () => clearInterval(interval);
    }, [loadData]);

    // Filtrado por código y descripción
    useEffect(() => {
        let filtered = insumos;
        if (searchCodigo) {
            filtered = filtered.filter(i => i.codigo?.toLowerCase().includes(searchCodigo.toLowerCase()));
        }
        if (searchDescripcion) {
            filtered = filtered.filter(i => 
                (i.nombre && i.nombre.toLowerCase().includes(searchDescripcion.toLowerCase())) ||
                (i.descripcion && i.descripcion.toLowerCase().includes(searchDescripcion.toLowerCase()))
            );
        }
        setFilteredInsumos(filtered);
    }, [searchCodigo, searchDescripcion, insumos]);

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item);
        setShowModal(true);
    };

    const handleViewDetails = (item) => {
        setSelectedItem(item);
        setShowDetailModal(true);
    };

    const handleVerCalculo = async (insumo) => {
        try {
            const movimientos = await MovimientoInventario.filter({ insumo_id: insumo.id });
            
            // Filtrar solo entradas (cantidad positiva)
            const entradas = movimientos.filter(m => parseFloat(m.cantidad) > 0);
            
            // Calcular costo promedio ponderado
            let costoTotalAcumulado = 0;
            let cantidadTotalAcumulada = 0;
            const detalleMovimientos = [];
            
            entradas.forEach(mov => {
                const cantidad = parseFloat(mov.cantidad) || 0;
                const costoUnitario = parseFloat(mov.costo_unitario) || 0;
                const costoTotal = cantidad * costoUnitario;
                
                cantidadTotalAcumulada += cantidad;
                costoTotalAcumulado += costoTotal;
                
                detalleMovimientos.push({
                    fecha: mov.fecha,
                    documento: mov.numero_documento || 'N/A',
                    cantidad,
                    costoUnitario,
                    costoTotal,
                    costoPromedioAcumulado: cantidadTotalAcumulada > 0 ? costoTotalAcumulado / cantidadTotalAcumulada : 0
                });
            });
            
            const costoPromedio = cantidadTotalAcumulada > 0 ? costoTotalAcumulado / cantidadTotalAcumulada : 0;
            const stockActual = insumo.stock_actual || 0;
            const valorTotal = stockActual * costoPromedio;
            
            setCalculoDetalle({
                insumo: insumo.descripcion || insumo.nombre,
                codigo: insumo.codigo,
                movimientos: detalleMovimientos,
                cantidadTotalEntradas: cantidadTotalAcumulada,
                costoTotalAcumulado,
                costoPromedio,
                stockActual,
                valorTotal
            });
            setShowCalculoModal(true);
        } catch (error) {
            console.error('Error:', error);
            alert('Error al calcular el detalle');
        }
    };

    const handleSave = async (formData) => {
        try {
            if (isEditing) {
                await Insumo.update(currentItem.id, formData);
            } else {
                await Insumo.create(formData);
            }
            setShowModal(false);
            loadData();
            alert("Insumo guardado exitosamente.");
        } catch(e) {
            alert(`Error guardando insumo: ${e.message}`);
        }
    };

    const handleDelete = async (id) => {
        if (confirm("¿Está seguro de que desea eliminar este insumo?")) {
            try {
                await Insumo.delete(id);
                alert("Insumo eliminado exitosamente.");
                loadData();
            } catch (error) {
                alert("Error al eliminar el insumo.");
            }
        }
    };
    
    const handleExport = () => {
        const headers = ["Código", "Descripción", "Categoría", "Stock Actual", "Stock Mínimo", "U. Medida", "Costo Promedio"];
        let csvContent = headers.join(",") + "\n";
        filteredInsumos.forEach(item => {
            const row = [`"${item.codigo}"`, `"${item.descripcion || item.nombre}"`, `"${item.categoria}"`, item.stock_actual, item.stock_minimo, `"${item.unidad_medida}"`, item.costo_promedio || 0].join(",");
            csvContent += row + "\n";
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "inventario_insumos_quimicos.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handlePrint = () => window.print();

    const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

    const headers = ["Código", "Descripción", "Categoría", "Stock Actual", "Stock Mínimo", "Estado Stock", "U. Medida", "Costo Promedio", "Valor Total", "Acciones"];
    const renderRow = (insumo) => {
        const valorTotalInventario = (insumo.stock_actual || 0) * (insumo.costo_promedio || 0);
        return (
        <tr key={insumo.id}>
            <td>{insumo.codigo}</td>
            <td>{insumo.descripcion || insumo.nombre}</td>
            <td>{insumo.categoria}</td>
            <td className={insumo.stock_actual <= insumo.stock_minimo ? "text-red-500 font-bold" : ""}>
                {insumo.stock_actual}
            </td>
            <td>{insumo.stock_minimo}</td>
            <td><StockAlert stockActual={insumo.stock_actual} stockMinimo={insumo.stock_minimo} /></td>
            <td>{insumo.unidad_medida}</td>
            <td>{formatCurrency(insumo.costo_promedio)}</td>
            <td className="text-right font-bold text-emerald-700">{formatCurrency(valorTotalInventario)}</td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleVerCalculo(insumo)} title="Ver Cálculo de Costo Promedio"><Calculator className="w-4 h-4 text-blue-600" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(insumo)}><Eye className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(insumo)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(insumo.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
            </td>
        </tr>
    );};

    return (
        <div className="p-6">
            <style>{`
                @media print {
                  body * { visibility: hidden; }
                  #tabla-imprimible, #tabla-imprimible * { visibility: visible; }
                  #tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; }
                  #page-header { display: none; }
                }
            `}</style>
            <PageHeader 
                title="Inventario de Insumos y Químicos" 
                description="Consulta el stock actual de insumos y químicos."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <div className="flex gap-2">
                        <Button onClick={() => setShowAjusteModal(true)} variant="outline" className="bg-amber-50 border-amber-600 text-amber-700 hover:bg-amber-100">
                            <ClipboardList className="w-4 h-4 mr-2" /> Ajustes
                        </Button>
                        <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="w-4 h-4 mr-2" />
                            Nuevo Insumo
                        </Button>
                    </div>
                }
            />
            
            <Card className="mb-6">
                <CardHeader><CardTitle>Filtro de Búsqueda</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Código</Label>
                            <Input placeholder="Buscar por código..." value={searchCodigo} onChange={e => setSearchCodigo(e.target.value)} />
                        </div>
                        <div>
                            <Label>Descripción</Label>
                            <Input placeholder="Buscar por descripción..." value={searchDescripcion} onChange={e => setSearchDescripcion(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card id="tabla-imprimible">
                <CardHeader>
                    <CardTitle>Stock de Insumos y Químicos</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredInsumos} renderRow={renderRow} />}
                </CardContent>
            </Card>
            
            {showModal && (
                <InventarioItemForm
                    open={showModal}
                    onOpenChange={setShowModal}
                    onSubmit={handleSave}
                    item={currentItem}
                    isEditing={isEditing}
                    tipoInventario="insumo"
                />
            )}

            {showAjusteModal && (
                <AjusteInventarioModal
                    open={showAjusteModal}
                    onOpenChange={setShowAjusteModal}
                    onSuccess={loadData}
                    tipoInventario="insumo"
                />
            )}

            <InventarioItemDetail 
                open={showDetailModal}
                onOpenChange={setShowDetailModal}
                item={selectedItem}
            />

            <Dialog open={showCalculoModal} onOpenChange={setShowCalculoModal}>
                <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Detalle del Cálculo de Costo Promedio y Valor Total</DialogTitle>
                    </DialogHeader>
                    {calculoDetalle && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-lg">
                                <h3 className="font-bold text-lg mb-2">{calculoDetalle.codigo} - {calculoDetalle.insumo}</h3>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <p><strong>Stock Actual:</strong> {calculoDetalle.stockActual}</p>
                                    <p><strong>Costo Promedio:</strong> {formatCurrency(calculoDetalle.costoPromedio)}</p>
                                    <p className="col-span-2 text-lg"><strong>Valor Total en Inventario:</strong> <span className="text-emerald-700">{formatCurrency(calculoDetalle.valorTotal)}</span></p>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-md mb-3">Fórmula del Costo Promedio Ponderado:</h4>
                                <div className="bg-gray-100 p-4 rounded border-l-4 border-blue-500">
                                    <p className="font-mono text-sm mb-2">Costo Promedio = Σ(Cantidad × Costo Unitario) / Σ(Cantidad)</p>
                                    <p className="text-xs text-gray-600">Donde Σ representa la suma de todas las entradas de inventario</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-md mb-2">Detalle de Movimientos (Entradas):</h4>
                                <div className="overflow-x-auto border rounded">
                                    <table className="w-full text-xs">
                                        <thead className="bg-gray-200">
                                            <tr>
                                                <th className="border p-2">Fecha</th>
                                                <th className="border p-2">Documento</th>
                                                <th className="border p-2">Cantidad</th>
                                                <th className="border p-2">Costo Unitario</th>
                                                <th className="border p-2">Costo Total Movimiento</th>
                                                <th className="border p-2">Costo Promedio Acumulado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {calculoDetalle.movimientos.map((mov, idx) => (
                                                <tr key={idx} className="hover:bg-gray-50">
                                                    <td className="border p-2">{new Date(mov.fecha).toLocaleDateString('es-CO')}</td>
                                                    <td className="border p-2">{mov.documento}</td>
                                                    <td className="border p-2 text-center">{mov.cantidad}</td>
                                                    <td className="border p-2 text-right">{formatCurrency(mov.costoUnitario)}</td>
                                                    <td className="border p-2 text-right">{formatCurrency(mov.costoTotal)}</td>
                                                    <td className="border p-2 text-right font-semibold bg-blue-50">{formatCurrency(mov.costoPromedioAcumulado)}</td>
                                                </tr>
                                            ))}
                                            <tr className="bg-green-100 font-bold">
                                                <td colSpan="2" className="border p-2 text-right">TOTALES:</td>
                                                <td className="border p-2 text-center">{calculoDetalle.cantidadTotalEntradas}</td>
                                                <td className="border p-2"></td>
                                                <td className="border p-2 text-right">{formatCurrency(calculoDetalle.costoTotalAcumulado)}</td>
                                                <td className="border p-2 text-right bg-green-200">{formatCurrency(calculoDetalle.costoPromedio)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-yellow-50 p-4 rounded border-l-4 border-yellow-500">
                                <h4 className="font-bold mb-2">Cálculo del Valor Total en Inventario:</h4>
                                <div className="space-y-1 text-sm">
                                    <p><strong>Fórmula:</strong> Valor Total = Stock Actual × Costo Promedio</p>
                                    <p><strong>Sustitución:</strong> Valor Total = {calculoDetalle.stockActual} × {formatCurrency(calculoDetalle.costoPromedio)}</p>
                                    <p className="text-lg"><strong>Resultado:</strong> <span className="text-emerald-700">{formatCurrency(calculoDetalle.valorTotal)}</span></p>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-4 rounded text-xs text-gray-600">
                                <p><strong>Nota:</strong> El costo promedio se calcula utilizando el método de promedio ponderado, que considera todas las entradas de inventario con sus respectivos costos y cantidades. Las salidas de inventario no afectan el costo promedio, solo reducen el stock disponible.</p>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setShowCalculoModal(false)}>Cerrar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}