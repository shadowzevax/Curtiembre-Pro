import React, { useState, useEffect, useCallback } from "react";
import { OrdenVenta, Cliente, ProductoTerminado } from "@/entities/all";
import PageHeader from "../components/common/PageHeader";
import DataTable from "../components/common/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Paperclip, FileText, Eye, Search, RotateCcw } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import DocumentoComercialForm from "../components/common/DocumentoComercialForm";
import SoporteViewer from "../components/common/SoporteViewer";
import CuentaCobroView from "../components/ventas/CuentaCobroView";
import RemisionView from "../components/ventas/RemisionView";

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('es-CO');
};

const initialFilters = {
  fechaDesde: "",
  fechaHasta: "",
  nit: "",
  producto: ""
};

export default function VentaProductos() {
    const [ordenes, setOrdenes] = useState([]);
    const [filteredOrdenes, setFilteredOrdenes] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [productos, setProductos] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showSoporteViewer, setShowSoporteViewer] = useState(false);
    const [soportesToShow, setSoportesToShow] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [viewMode, setViewMode] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [filters, setFilters] = useState(initialFilters);
    const [searchTerm, setSearchTerm] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [ordenesData, clientesData, productosData] = await Promise.all([
                OrdenVenta.filter({ tipo_venta: "productos" }),
                Cliente.list(),
                ProductoTerminado.list()
            ]);
            setOrdenes(ordenesData);
            setClientes(clientesData);
            setProductos(productosData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    
    const getClienteNombre = useCallback((clienteId) => {
        const cliente = clientes.find(p => p.id === clienteId);
        return cliente ? cliente.nombre : clienteId;
    }, [clientes]);

    const applyFilters = useCallback(() => {
        let filtered = [...ordenes];
        if (filters.fechaDesde) {
            const desde = new Date(filters.fechaDesde + "T00:00:00");
            filtered = filtered.filter(orden => new Date(orden.fecha_orden) >= desde);
        }
        if (filters.fechaHasta) {
            const hasta = new Date(filters.fechaHasta + "T00:00:00");
            hasta.setHours(23, 59, 59, 999);
            filtered = filtered.filter(orden => new Date(orden.fecha_orden) <= hasta);
        }
        if (filters.nit) {
            filtered = filtered.filter(orden => orden.cc_nit_cliente?.toLowerCase().includes(filters.nit.toLowerCase()));
        }
        if (filters.producto) {
            const searchLower = filters.producto.toLowerCase();
            filtered = filtered.filter(orden =>
                orden.items.some(item =>
                    (item.producto_id && productos.find(i => i.id === item.producto_id)?.nombre?.toLowerCase().includes(searchLower)) ||
                    (item.descripcion?.toLowerCase().includes(searchLower))
                )
            );
        }
        if (searchTerm) {
            filtered = filtered.filter(orden =>
                getClienteNombre(orden.cliente_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
                orden.numero_documento?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        setFilteredOrdenes(filtered);
    }, [ordenes, filters, searchTerm, getClienteNombre, productos]);

    useEffect(() => {
        applyFilters();
    }, [applyFilters]);

    const handleClearFilters = () => {
        setFilters(initialFilters);
        setSearchTerm("");
    };

    const handleOpenModal = (orden = null) => {
        setEditingOrder(orden);
        setShowForm(true);
    };
    
    const handleSubmit = async (orderData) => {
        setLoading(true);
        try {
            const savedOrder = await onSubmit(orderData);
            const orderId = savedOrder?.id || editingOrder?.id;
            
            // Si es CRÉDITO, generar cuenta por cobrar
            if (!editingOrder && orderData.condicion_pago === 'credito' && orderData.saldo_pendiente > 0) {
                const { CuentaPorCobrar } = await import('@/entities/all');
                const cliente = clientes.find(c => c.id === orderData.cliente_id);
                await CuentaPorCobrar.create({
                    id_cuenta: `CPC-${Date.now()}`,
                    cliente_id: orderData.cliente_id,
                    cliente_nombre: cliente?.nombre || '',
                    cliente_nit: cliente?.numero_identificacion || '',
                    tipo_documento: orderData.tipo_documento_venta || orderData.tipo_documento,
                    numero_documento: orderData.numero_documento,
                    documento_origen_id: orderId,
                    modulo_origen: 'ventas',
                    fecha_documento: orderData.fecha_orden,
                    fecha_vencimiento: orderData.fecha_vencimiento,
                    valor_total: orderData.total,
                    valor_cobrado: 0,
                    saldo_pendiente: orderData.total,
                    estado: 'pendiente',
                    historial_cobros: []
                });
            }
            
            alert('✅ GUARDADO EXITOSAMENTE');
            setShowForm(false);
            setEditingOrder(null);
            loadData();
        } catch (error) {
            console.error("Error saving order:", error);
            alert("Error al guardar la orden: " + error.message);
        } finally {
            setLoading(false);
        }
    };
    
    const handleDelete = async (ordenId) => {
        if (window.confirm("¿Está seguro de que desea eliminar esta venta?")) {
            await OrdenVenta.delete(ordenId);
            loadData();
        }
    };

    const handleShowSoportes = (orden) => {
        setSelectedOrder(orden);
        setSoportesToShow(orden.soportes || []);
        setShowSoporteViewer(true);
    };

    const handleShowDetails = (orden) => {
        setSelectedOrder(orden);
        setShowDetailModal(true);
    };
    
    const handleShowPrintableView = (orden) => {
        setSelectedOrder(orden);
        setViewMode(orden.tipo_documento);
    };

    const handleExport = () => { alert("Función de exportar en desarrollo."); };
    const handlePrint = () => window.print();
    const getTotalGeneral = () => filteredOrdenes.reduce((sum, orden) => sum + (orden.total || 0), 0);

    const tableHeaders = ["Documento #", "Fecha", "Cliente", "Valor Total", "Estado", "Soportes", "Acciones"];
    const renderRow = (orden) => (
        <tr key={orden.id}>
            <td>{orden.prefijo_documento}-{orden.numero_documento}</td>
            <td>{formatDate(orden.fecha_orden)}</td>
            <td>{getClienteNombre(orden.cliente_id)}</td>
            <td>{formatCurrency(orden.total)}</td>
            <td><Badge>{orden.estado}</Badge></td>
            <td>{orden.soportes && orden.soportes.length > 0 ? <span className="text-emerald-600 font-medium">{orden.soportes.length} archivo(s)</span> : <span className="text-gray-400">Sin soportes</span>}</td>
            <td>
                <div className="flex space-x-1">
                    {(orden.tipo_documento === 'cuenta_cobro' || orden.tipo_documento === 'remision') &&
                        <Button variant="ghost" size="icon" onClick={() => handleShowPrintableView(orden)} title="Ver Documento">
                            <FileText className="w-4 h-4" />
                        </Button>
                    }
                    <Button variant="ghost" size="icon" onClick={() => handleShowDetails(orden)} title="Ver detalle"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleShowSoportes(orden)} title="Ver Soportes" disabled={!orden.soportes || orden.soportes.length === 0}><Paperclip className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(orden)}><Edit className="w-4 h-4"/></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(orden.id)}><Trash2 className="w-4 h-4"/></Button>
                </div>
            </td>
        </tr>
    );

    const renderPrintView = () => {
        if (!selectedOrder) return null;
        const cliente = clientes.find(c => c.id === selectedOrder.cliente_id);
        if (viewMode === 'cuenta_cobro') {
            return <CuentaCobroView orden={selectedOrder} cliente={cliente} />;
        }
        if (viewMode === 'remision') {
            return <RemisionView orden={selectedOrder} cliente={cliente} />;
        }
        return null;
    }

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader
                title="Ventas de Productos"
                description="Gestión de órdenes de venta de productos terminados."
                onPrint={handlePrint}
                onExportExcel={handleExport}
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Venta
                    </Button>
                }
            />

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Filtros de Búsqueda</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div><Label>Desde</Label><Input type="date" value={filters.fechaDesde} onChange={(e) => setFilters(prev => ({ ...prev, fechaDesde: e.target.value }))}/></div>
                        <div><Label>Hasta</Label><Input type="date" value={filters.fechaHasta} onChange={(e) => setFilters(prev => ({ ...prev, fechaHasta: e.target.value }))}/></div>
                        <div><Label>NIT</Label><Input placeholder="Buscar por NIT..." value={filters.nit} onChange={(e) => setFilters(prev => ({ ...prev, nit: e.target.value }))}/></div>
                        <div><Label>Cliente / Documento #</Label><Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div>
                        <div><Label>Producto</Label><Input placeholder="Buscar por producto..." value={filters.producto} onChange={(e) => setFilters(prev => ({...prev, producto: e.target.value}))}/></div>
                        <div className="flex items-end col-span-full space-x-2">
                            <Button onClick={applyFilters} className="w-full bg-blue-600 hover:bg-blue-700"><Search className="w-4 h-4 mr-2" />Consultar</Button>
                            <Button onClick={handleClearFilters} variant="outline" className="w-full"><RotateCcw className="w-4 h-4 mr-2" />Limpiar</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
            
            <div id="tabla-imprimible">
                <Card>
                    <CardHeader>
                        <CardTitle>Listado de Ventas</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable headers={tableHeaders} data={filteredOrdenes} renderRow={renderRow} loading={loading} />
                        <div className="mt-6 pt-4 border-t"><div className="flex justify-end"><div className="bg-emerald-50 px-4 py-2 rounded-lg"><span className="text-lg font-bold text-emerald-800">Total: {formatCurrency(getTotalGeneral())}</span></div></div></div>
                    </CardContent>
                </Card>
            </div>
            
            {showForm && (
                <DocumentoComercialForm
                    open={showForm}
                    onOpenChange={setShowForm}
                    onSubmit={async (orderData) => {
                        if (editingOrder) {
                            await OrdenVenta.update(editingOrder.id, orderData);
                            return { id: editingOrder.id };
                        } else {
                            return await OrdenVenta.create(orderData);
                        }
                    }}
                    documento={editingOrder}
                    terceros={clientes}
                    itemsCatalogo={productos}
                    tipoDocumento="venta"
                    tipoItem="productos"
                    terceroLabel="Cliente"
                    documentoTitulo="Documento de Venta de Productos"
                />
            )}
             {showSoporteViewer && (
                <SoporteViewer 
                    open={showSoporteViewer}
                    onOpenChange={setShowSoporteViewer}
                    soportes={soportesToShow}
                    orden={selectedOrder}
                />
            )}
            <Dialog open={!!viewMode} onOpenChange={() => setViewMode(null)}>
                <DialogContent className="max-w-4xl p-0">
                    {renderPrintView()}
                </DialogContent>
            </Dialog>
        </div>
    );
}