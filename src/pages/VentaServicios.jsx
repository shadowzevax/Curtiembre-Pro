import React, { useState, useEffect, useCallback } from "react";
import { OrdenVenta, Cliente, Servicio } from "@/entities/all";
import PageHeader from "../components/common/PageHeader";
import DataTable from "../components/common/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Paperclip, FileText, Eye, Search, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  servicio: ""
};

export default function VentaServicios() {
    const [ventas, setVentas] = useState([]);
    const [filteredVentas, setFilteredVentas] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [servicios, setServicios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
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
            const [data, cliData, servData] = await Promise.all([
                OrdenVenta.filter({ tipo_venta: "servicios" }),
                Cliente.list(),
                Servicio.list()
            ]);
            setVentas(data);
            setClientes(cliData);
            setServicios(servData);
        } catch (error) { 
            console.error("Error loading data:", error);
        } 
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const getClienteNombre = useCallback((clienteId) => {
        const cliente = clientes.find(p => p.id === clienteId);
        return cliente ? cliente.nombre : clienteId;
    }, [clientes]);

    const applyFilters = useCallback(() => {
        let filtered = [...ventas];
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
        if (filters.servicio) {
            const searchLower = filters.servicio.toLowerCase();
            filtered = filtered.filter(orden =>
                orden.items.some(item =>
                    (item.servicio_id && servicios.find(i => i.id === item.servicio_id)?.nombre?.toLowerCase().includes(searchLower)) ||
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
        setFilteredVentas(filtered);
    }, [ventas, filters, searchTerm, getClienteNombre, servicios]);

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
        if (editingOrder) {
            await OrdenVenta.update(editingOrder.id, orderData);
            return { id: editingOrder.id };
        } else {
            return await OrdenVenta.create(orderData);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("¿Eliminar esta venta de servicio?")) {
            try {
                await OrdenVenta.delete(id);
                alert("Venta eliminada.");
                loadData();
            } catch (error) { alert("Error al eliminar."); }
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
    const getTotalGeneral = () => filteredVentas.reduce((sum, orden) => sum + (orden.total || 0), 0);

    const headers = ["Documento #", "Fecha", "Cliente", "Valor", "Estado", "Soportes", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{item.prefijo_documento}-{item.numero_documento}</td>
            <td>{formatDate(item.fecha_orden)}</td>
            <td>{getClienteNombre(item.cliente_id)}</td>
            <td>{formatCurrency(item.total)}</td>
            <td><Badge>{item.estado}</Badge></td>
            <td>{item.soportes && item.soportes.length > 0 ? <span className="text-emerald-600 font-medium">{item.soportes.length} archivo(s)</span> : <span className="text-gray-400">Sin soportes</span>}</td>
            <td>
                <div className="flex space-x-1">
                     {(item.tipo_documento === 'cuenta_cobro' || item.tipo_documento === 'remision') &&
                        <Button variant="ghost" size="icon" onClick={() => handleShowPrintableView(item)} title="Ver Documento">
                            <FileText className="w-4 h-4" />
                        </Button>
                    }
                    <Button variant="ghost" size="icon" onClick={() => handleShowDetails(item)} title="Ver detalle"><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleShowSoportes(item)} title="Ver Soportes" disabled={!item.soportes || item.soportes.length === 0}><Paperclip className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
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
                title="Ventas de Servicios"
                description="Gestión de órdenes de venta de servicios."
                onPrint={handlePrint}
                onExportExcel={handleExport}
                actionButton={<Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="mr-2 h-4 w-4" />Nueva Venta</Button>}
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
                        <div><Label>Servicio</Label><Input placeholder="Buscar por servicio..." value={filters.servicio} onChange={(e) => setFilters(prev => ({...prev, servicio: e.target.value}))}/></div>
                        <div className="flex items-end col-span-full space-x-2">
                            <Button onClick={applyFilters} className="w-full bg-blue-600 hover:bg-blue-700"><Search className="w-4 h-4 mr-2" />Consultar</Button>
                            <Button onClick={handleClearFilters} variant="outline" className="w-full"><RotateCcw className="w-4 h-4 mr-2" />Limpiar</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div id="tabla-imprimible">
                <Card>
                    <CardHeader><CardTitle>Historial de Servicios</CardTitle></CardHeader>
                    <CardContent>
                        {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredVentas} renderRow={renderRow} />}
                        <div className="mt-6 pt-4 border-t"><div className="flex justify-end"><div className="bg-emerald-50 px-4 py-2 rounded-lg"><span className="text-lg font-bold text-emerald-800">Total: {formatCurrency(getTotalGeneral())}</span></div></div></div>
                    </CardContent>
                </Card>
            </div>
            
            {showForm && (
                <DocumentoComercialForm
                    open={showForm}
                    onOpenChange={(open) => {
                        setShowForm(open);
                        if (!open) { setEditingOrder(null); loadData(); }
                    }}
                    onSubmit={handleSubmit}
                    documento={editingOrder}
                    terceros={clientes}
                    itemsCatalogo={servicios}
                    tipoDocumento="venta"
                    tipoItem="servicios"
                    terceroLabel="Cliente"
                    documentoTitulo="Documento de Venta de Servicios"
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
            
            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Detalle de Venta de Servicio</DialogTitle>
                    </DialogHeader>
                    {selectedOrder && (
                        <div className="space-y-3">
                            <p><span className="font-semibold">No. Documento:</span> {selectedOrder.prefijo_documento}-{selectedOrder.numero_documento}</p>
                            <p><span className="font-semibold">Cliente:</span> {getClienteNombre(selectedOrder.cliente_id)}</p>
                            <p><span className="font-semibold">Fecha:</span> {formatDate(selectedOrder.fecha_orden)}</p>
                            <p><span className="font-semibold">Total:</span> {formatCurrency(selectedOrder.total)}</p>
                            <p><span className="font-semibold">Estado:</span> {selectedOrder.estado}</p>
                            {selectedOrder.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedOrder.observaciones}</p>}
                            <div className="border-t pt-3 mt-3">
                                <h4 className="font-semibold mb-2">Items:</h4>
                                {selectedOrder.items?.map((item, idx) => (
                                    <div key={idx} className="text-sm border-b pb-2 mb-2">
                                        <p>• {item.descripcion} - Cantidad: {item.cantidad} - {formatCurrency(item.subtotal)}</p>
                                    </div>
                                ))}
                            </div>
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