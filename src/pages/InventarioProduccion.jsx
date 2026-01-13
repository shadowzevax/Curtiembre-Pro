import React, { useState, useEffect, useCallback } from "react";
import { ProductoTerminado, MovimientoInventario } from "@/entities/all";
import PageHeader from "../components/common/PageHeader";
import DataTable from "../components/common/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, Plus, Edit, Trash2, Eye, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import InventarioItemForm from '../components/inventario/InventarioItemForm';
import AjusteInventarioModal from '../components/inventario/AjusteInventarioModal';
import InventarioItemDetail from '../components/inventario/InventarioItemDetail';
import StockAlert from '../components/inventario/StockAlert';

export default function InventarioProduccion() {
    const [productos, setProductos] = useState([]);
    const [filteredProductos, setFilteredProductos] = useState([]);
    const [searchCodigo, setSearchCodigo] = useState('');
    const [searchDescripcion, setSearchDescripcion] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showAjusteModal, setShowAjusteModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Filtrar SOLO productos de materia prima (categoría 'pieles')
            const data = await ProductoTerminado.filter({ categoria: 'pieles' });
            const movimientos = await MovimientoInventario.list();
            
            // Calcular stock_actual desde movimientos
            const productosConStock = data.map(prod => {
                const movsProd = movimientos.filter(m => m.insumo_id === prod.id); 
                const stockActual = movsProd.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
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
        } catch (error) { 
            console.error("Error saving product:", error);
            alert(`Error al guardar el producto: ${error.message}`); 
        }
    };

    const handleDelete = async (id) => {
        if (confirm("¿Está seguro de que desea eliminar este producto?")) {
            try {
                await ProductoTerminado.delete(id);
                alert("Producto eliminado exitosamente.");
                loadData();
            } catch (error) { 
                console.error("Error deleting product:", error);
                alert("Error al eliminar el producto."); 
            }
        }
    };

    const handleExportExcel = () => {
        const headers = ["Código", "Descripción", "Categoría", "Stock Actual", "Stock Mínimo", "U. Medida", "Costo Promedio"];
        let csvContent = headers.join(",") + "\n";
        filteredProductos.forEach(item => {
            const row = [`"${item.codigo}"`, `"${item.descripcion}"`, `"${item.categoria || ''}"`, item.stock_actual, item.stock_minimo, `"${item.unidad_medida || ''}"`, item.costo_promedio || 0].join(",");
            csvContent += row + "\n";
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "inventario_materias_primas.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

    const headers = ["Código", "Descripción", "Categoría", "Stock Actual", "Stock Mínimo", "Estado Stock", "U. Medida", "Costo Promedio", "Valor Total", "Acciones"];
    const renderRow = (prod) => {
        const valorTotalInventario = (prod.stock_actual || 0) * (prod.costo_promedio || 0);
        return (
         <tr key={prod.id}>
            <td>{prod.codigo}</td>
            <td>{prod.descripcion}</td>
            <td>{prod.categoria || 'N/A'}</td>
            <td className={prod.stock_actual <= prod.stock_minimo ? "text-red-500 font-bold" : ""}>{prod.stock_actual}</td>
            <td>{prod.stock_minimo}</td>
            <td><StockAlert stockActual={prod.stock_actual} stockMinimo={prod.stock_minimo} /></td>
            <td>{prod.unidad_medida || 'N/A'}</td>
            <td>{formatCurrency(prod.costo_promedio)}</td>
            <td className="text-right font-bold text-emerald-700">{formatCurrency(valorTotalInventario)}</td>
            <td>
                 <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleViewDetails(prod)}><Eye className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(prod)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(prod.id)}><Trash2 className="w-4 h-4" /></Button>
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
                title="Inventario de Materias Primas" 
                description="Consulta y gestiona el stock de materias primas." 
                onExportExcel={handleExportExcel} 
                onPrint={handlePrint} 
                actionButton={
                    <div className="flex gap-2">
                        <Button onClick={() => setShowAjusteModal(true)} variant="outline" className="bg-amber-50 border-amber-600 text-amber-700 hover:bg-amber-100">
                            <ClipboardList className="w-4 h-4 mr-2" /> Ajustes
                        </Button>
                        <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="w-4 h-4 mr-2" /> Nueva Materia Prima
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
                <CardHeader><CardTitle className="flex items-center gap-2"><Package/> Stock de Materias Primas</CardTitle></CardHeader>
                <CardContent>{loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredProductos} renderRow={renderRow} />}</CardContent>
            </Card>
            
            {showModal && (
                <InventarioItemForm
                    open={showModal}
                    onOpenChange={setShowModal}
                    onSubmit={handleSave}
                    item={currentItem}
                    isEditing={isEditing}
                    tipoInventario="materia_prima"
                />
            )}

            {showAjusteModal && (
                <AjusteInventarioModal
                    open={showAjusteModal}
                    onOpenChange={setShowAjusteModal}
                    onSuccess={loadData}
                    tipoInventario="materia_prima"
                />
            )}

            <InventarioItemDetail 
                open={showDetailModal}
                onOpenChange={setShowDetailModal}
                item={selectedItem}
            />
        </div>
    );
}