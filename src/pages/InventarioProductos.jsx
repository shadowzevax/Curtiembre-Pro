import React, { useState, useEffect, useCallback } from 'react';
import { ProductoTerminado, MovimientoInventario } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Eye, ClipboardList } from 'lucide-react';
import InventarioItemForm from '../components/inventario/InventarioItemForm';
import AjusteInventarioModal from '../components/inventario/AjusteInventarioModal';

export default function InventarioProductos() {
    const [productos, setProductos] = useState([]);
    const [filteredProductos, setFilteredProductos] = useState([]);
    const [searchCodigo, setSearchCodigo] = useState('');
    const [searchDescripcion, setSearchDescripcion] = useState('');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showAjusteModal, setShowAjusteModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await ProductoTerminado.list();
            const movimientos = await MovimientoInventario.list(); // Assuming MovimientoInventario can be listed directly

            // Calculate stock_actual from movements
            // Assuming MovimientoInventario items have a 'producto_terminado_id' or 'item_id' and 'tipo_inventario'
            const productosConStock = data.map(prod => {
                // Filter movements relevant to this product
                const movsProd = movimientos.filter(m => 
                    m.item_id === prod.id && m.tipo_inventario === 'producto_terminado'
                );
                // Sum quantities to get current stock
                const stockActual = movsProd.reduce((sum, m) => sum + (m.cantidad || 0), 0);
                return { ...prod, stock_actual: stockActual };
            });

            setProductos(productosConStock);
            setFilteredProductos(productosConStock);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    
    // Filtrado por código y descripción
    useEffect(() => {
        let filtered = productos;
        if (searchCodigo) {
            filtered = filtered.filter(p => p.codigo?.toLowerCase().includes(searchCodigo.toLowerCase()));
        }
        if (searchDescripcion) {
            filtered = filtered.filter(p => p.descripcion?.toLowerCase().includes(searchDescripcion.toLowerCase()));
        }
        setFilteredProductos(filtered);
    }, [searchCodigo, searchDescripcion, productos]);
    
    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item);
        setShowModal(true);
    };

    const handleViewDetails = (item) => {
        setSelectedItem(item);
        setShowDetailModal(true);
    };

    const handleSave = async (formData) => {
        try {
            if (isEditing) {
                await ProductoTerminado.update(currentItem.id, formData);
            } else {
                await ProductoTerminado.create(formData);
            }
            setShowModal(false);
            loadData();
            alert("Producto guardado exitosamente.");
        } catch (e) {
            alert(`Error guardando producto: ${e.message}`);
        }
    };
    
    const handleDelete = async (id) => {
        if (confirm("¿Eliminar este producto?")) {
            try {
                await ProductoTerminado.delete(id);
                alert("Producto eliminado exitosamente.");
                loadData();
            } catch (error) {
                alert("Error al eliminar el producto.");
            }
        }
    };
    
    const handleExport = () => {
        const headers = ["Código", "Descripción", "Categoría", "Stock Actual", "Stock Mínimo", "U. Medida", "Costo Promedio"];
        let csvContent = headers.join(",") + "\n";
        filteredProductos.forEach(item => { // Changed from 'productos' to 'filteredProductos'
            const row = [`"${item.codigo}"`, `"${item.descripcion}"`, `"${item.categoria || ''}"`, item.stock_actual, item.stock_minimo, `"${item.unidad_medida || ''}"`, item.costo_promedio || 0].join(",");
            csvContent += row + "\n";
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "inventario_productos_terminados.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handlePrint = () => window.print();

    const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

    const headers = ["Código", "Descripción", "Categoría", "Stock Actual", "Stock Mínimo", "U. Medida", "Costo Promedio", "Valor Total Inventario", "Acciones"];
    const renderRow = (item) => {
        const valorTotalInventario = (item.stock_actual || 0) * (item.costo_promedio || 0);
        return (
        <tr key={item.id}>
            <td>{item.codigo}</td>
            <td>{item.descripcion}</td>
            <td>{item.categoria || 'N/A'}</td>
            <td className={item.stock_actual <= item.stock_minimo ? "text-red-500 font-bold" : ""}>{item.stock_actual}</td>
            <td>{item.stock_minimo}</td>
            <td>{item.unidad_medida || 'N/A'}</td>
            <td>{formatCurrency(item.costo_promedio)}</td>
            <td className="text-right font-bold text-emerald-700">{formatCurrency(valorTotalInventario)}</td>
            <td>
                 <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)}><Eye className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
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
                title="Inventario de Productos Terminados"
                description="Consulta el inventario de productos terminados."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <div className="flex gap-2">
                        <Button onClick={() => setShowAjusteModal(true)} variant="outline" className="bg-amber-50 border-amber-600 text-amber-700 hover:bg-amber-100">
                            <ClipboardList className="w-4 h-4 mr-2" /> Ajustes
                        </Button>
                        <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
                        </Button>
                    </div>
                }
            />
            
            <Card className="mb-6">
                <CardHeader><CardTitle>Filtro de Búsqueda</CardTitle></CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label htmlFor="searchCodigo">Código</Label>
                            <Input id="searchCodigo" placeholder="Buscar por código..." value={searchCodigo} onChange={e => setSearchCodigo(e.target.value)} />
                        </div>
                        <div>
                            <Label htmlFor="searchDescripcion">Descripción</Label>
                            <Input id="searchDescripcion" placeholder="Buscar por descripción..." value={searchDescripcion} onChange={e => setSearchDescripcion(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <Card id="tabla-imprimible">
                <CardHeader><CardTitle>Stock de Productos Terminados</CardTitle></CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={filteredProductos} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>
             {showModal && (
                <InventarioItemForm
                    open={showModal}
                    onOpenChange={setShowModal}
                    onSubmit={handleSave}
                    item={currentItem}
                    isEditing={isEditing}
                    tipoInventario="producto_terminado"
                />
            )}

            {showAjusteModal && (
                <AjusteInventarioModal
                    open={showAjusteModal}
                    onOpenChange={setShowAjusteModal}
                    onSuccess={loadData}
                    tipoInventario="producto_terminado"
                />
            )}

            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Detalle del Producto Terminado</DialogTitle></DialogHeader>
                    {selectedItem && (
                        <div className="space-y-3 text-sm">
                            <p><span className="font-semibold">Código:</span> {selectedItem.codigo}</p>
                            <p><span className="font-semibold">Descripción:</span> {selectedItem.descripcion}</p>
                            <p><span className="font-semibold">Categoría:</span> {selectedItem.categoria}</p>
                            <p><span className="font-semibold">Stock Actual:</span> {selectedItem.stock_actual}</p>
                            <p><span className="font-semibold">Stock Mínimo:</span> {selectedItem.stock_minimo}</p>
                            <p><span className="font-semibold">Unidad de Medida:</span> {selectedItem.unidad_medida}</p>
                            <p><span className="font-semibold">Ubicación:</span> {selectedItem.ubicacion || 'N/A'}</p>
                            <p><span className="font-semibold">Costo Promedio:</span> {formatCurrency(selectedItem.costo_promedio)}</p>
                            <p><span className="font-semibold">Precio Venta:</span> {formatCurrency(selectedItem.precio_venta_1 || selectedItem.precio_venta)}</p>
                            {selectedItem.tipo_piel && <p><span className="font-semibold">Tipo de Piel:</span> {selectedItem.tipo_piel}</p>}
                            {selectedItem.color && <p><span className="font-semibold">Color:</span> {selectedItem.color}</p>}
                            {selectedItem.acabado && <p><span className="font-semibold">Acabado:</span> {selectedItem.acabado}</p>}
                            {selectedItem.fecha_ultima_produccion && <p><span className="font-semibold">Última Producción:</span> {new Date(selectedItem.fecha_ultima_produccion).toLocaleDateString()}</p>}
                        </div>
                    )}
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}