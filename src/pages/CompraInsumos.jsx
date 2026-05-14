import React, { useState, useEffect, useCallback } from "react";
import { OrdenCompra, Insumo, Tercero } from "@/entities/all";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Eye, Paperclip, RotateCcw } from "lucide-react";
import DataTable from "../components/common/DataTable";
import PageHeader from "../components/common/PageHeader";
import DocumentoComercialForm from "../components/common/DocumentoComercialForm";
import SoporteViewer from "../components/common/SoporteViewer";
import OrdenDetalle from "../components/compras/OrdenDetalle";
import SuccessToast from "../components/common/SuccessToast";

// Formatear fecha a dd/mm/yyyy
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('es-CO');
};

// Formatear moneda
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0
  }).format(amount || 0);
};

const initialFilters = {
  fechaDesde: "",
  fechaHasta: "",
  nit: "",
  insumo: ""
};

export default function CompraInsumos() {
  const [ordenes, setOrdenes] = useState([]);
  const [filteredOrdenes, setFilteredOrdenes] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showSoporteViewer, setShowSoporteViewer] = useState(false);
  const [soportesToShow, setSoportesToShow] = useState([]);
  const [noProveedoresMsg] = useState("⚠️ No hay proveedores disponibles. Debe registrar un tercero como proveedor en Administración > Terceros.");
  
  const [filters, setFilters] = useState(initialFilters);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState(null);

  const getProveedorNombre = useCallback((proveedorId) => {
    const proveedor = proveedores.find(p => p.id === proveedorId);
    return proveedor ? proveedor.nombre : proveedorId;
  }, [proveedores]);

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
        filtered = filtered.filter(orden => orden.cc_nit_proveedor?.toLowerCase().includes(filters.nit.toLowerCase()));
    }
    if (filters.insumo) {
        const searchLower = filters.insumo.toLowerCase();
        filtered = filtered.filter(orden =>
            orden.items.some(item =>
                (item.insumo_id && insumos.find(i => i.id === item.insumo_id)?.nombre.toLowerCase().includes(searchLower)) ||
                (item.descripcion?.toLowerCase().includes(searchLower))
            )
        );
    }
    if (searchTerm) {
      filtered = filtered.filter(orden =>
        getProveedorNombre(orden.proveedor_id).toLowerCase().includes(searchTerm.toLowerCase()) ||
        orden.numero_documento?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    setFilteredOrdenes(filtered);
  }, [ordenes, filters, searchTerm, getProveedorNombre, insumos]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleClearFilters = () => {
    setFilters(initialFilters);
    setSearchTerm("");
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // Cargar solo Terceros con es_proveedor === true (booleano real)
      const [ordenesData, terceroData, insumosData] = await Promise.all([
        OrdenCompra.list(),
        Tercero.list(),
        Insumo.list()
      ]);
      setOrdenes(ordenesData);
      // Filtrar solo los que tienen es_proveedor = true (booleano)
      const soloProveedores = terceroData.filter(t => t.es_proveedor === true);
      setProveedores(soloProveedores);
      setInsumos(insumosData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (orden = null) => {
    setEditingOrder(orden);
    setShowForm(true);
  };

  const handleSubmit = async (orderData) => {
    setLoading(true);
    let savedOrder = null;
    try {
      const isDuplicate = ordenes.some(orden => 
        orden.numero_id === orderData.numero_id &&
        (!editingOrder || orden.id !== editingOrder.id)
      );
      
      if (isDuplicate) {
        alert("⚠️ REVISE DOCUMENTO YA EXISTE\n\nYa existe un documento con el mismo No. ID.");
        setLoading(false);
        return null;
      }
      
      if (editingOrder) {
        await OrdenCompra.update(editingOrder.id, orderData);
        savedOrder = { id: editingOrder.id };
      } else {
        const nuevaCompra = await OrdenCompra.create(orderData);
        savedOrder = nuevaCompra;
        
        // Si es CONTADO y valor pagado = total, generar movimiento automático
        if (orderData.condicion_pago === 'contado' && orderData.valor_pagado === orderData.total) {
          if (orderData.forma_pago === 'efectivo' && orderData.cuenta_destino_id) {
            const Caja = (await import('@/entities/all')).Caja;
            const MovimientoCaja = (await import('@/entities/all')).MovimientoCaja;
            const caja = await Caja.filter({ id: orderData.cuenta_destino_id });
            if (caja && caja.length > 0) {
              const cajaData = caja[0];
              const nuevoSaldo = (cajaData.saldo_actual || 0) - orderData.total;
              await Caja.update(cajaData.id, { saldo_actual: nuevoSaldo });
              await MovimientoCaja.create({
                caja_id: cajaData.id,
                nombre_caja: cajaData.nombre,
                fecha: orderData.fecha_emision_documento || orderData.fecha_orden,
                tipo_movimiento: 'salida',
                concepto: `Compra - ${orderData.tipo_documento_proveedor} ${orderData.numero_documento}`,
                responsable: '',
                valor: orderData.total,
                saldo_resultante: nuevoSaldo
              });
            }
          } else if (orderData.forma_pago === 'banco') {
            const MovimientoBancario = (await import('@/entities/all')).MovimientoBancario;
            const CuentaBancaria = (await import('@/entities/all')).CuentaBancaria;
            if (orderData.cuenta_destino_id) {
              const cuenta = await CuentaBancaria.filter({ id: orderData.cuenta_destino_id });
              if (cuenta && cuenta.length > 0) {
                const cuentaData = cuenta[0];
                const nuevoSaldo = (cuentaData.saldo_actual || 0) - orderData.total;
                await CuentaBancaria.update(cuentaData.id, { saldo_actual: nuevoSaldo });
                await MovimientoBancario.create({
                  cuenta_id: cuentaData.id,
                  fecha: orderData.fecha_emision_documento || orderData.fecha_orden,
                  tipo_movimiento: 'egreso',
                  concepto: `Compra - ${orderData.tipo_documento_proveedor} ${orderData.numero_documento}`,
                  valor: orderData.total,
                  saldo_posterior: nuevoSaldo
                });
              }
            }
          }
        }
        
        // Si es CRÉDITO, generar cuenta por pagar
        if (orderData.condicion_pago === 'credito') {
          const CuentaPorPagar = (await import('@/entities/all')).CuentaPorPagar;
          const proveedor = proveedores.find(p => p.id === orderData.proveedor_id);
          await CuentaPorPagar.create({
            id_cuenta: `CPP-${Date.now()}`,
            proveedor_id: orderData.proveedor_id,
            proveedor_nombre: proveedor?.nombre || '',
            proveedor_nit: proveedor?.numero_identificacion || '',
            tipo_documento: orderData.tipo_documento_proveedor,
            numero_documento: orderData.numero_documento,
            documento_origen_id: savedOrder.id,
            modulo_origen: 'compras',
            fecha_documento: orderData.fecha_emision_documento || orderData.fecha_orden,
            fecha_vencimiento: orderData.fecha_vencimiento,
            valor_total: orderData.total,
            valor_pagado: orderData.valor_pagado || 0,
            saldo_pendiente: orderData.total - (orderData.valor_pagado || 0),
            estado: (orderData.valor_pagado || 0) >= orderData.total ? 'pagada' :
                    (orderData.valor_pagado || 0) > 0 ? 'parcial' :
                    'pendiente',
            historial_pagos: []
          });
        }
      }

      // Retornar savedOrder — DocumentoComercialForm cierra el modal y luego onSuccess recarga
      setEditingOrder(null);
      return savedOrder;
    } catch (error) {
      console.error("Error saving order:", error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (ordenId) => {
    if (!window.confirm("¿Está seguro de que desea eliminar esta orden de compra?")) return;
    try {
      const orden = ordenes.find(o => o.id === ordenId);
      if (!orden) return;

      // IMPORTANTE: Eliminar movimientos de inventario asociados ANTES de eliminar la compra
      if (orden.afecta_inventario) {
        const MovimientoInventario = (await import('@/entities/all')).MovimientoInventario;
        const ProductoCatalogo = (await import('@/entities/all')).ProductoCatalogo;
        const Insumo = (await import('@/entities/all')).Insumo;
        const ProductoTerminado = (await import('@/entities/all')).ProductoTerminado;
        
        const movimientosAEliminar = await MovimientoInventario.filter({ 
          referencia: `${orden.prefijo_documento}-${orden.numero_documento}` 
        });
        
        console.log(`🔍 Encontrados ${movimientosAEliminar.length} movimientos a eliminar`);
        
        for (const mov of movimientosAEliminar) {
          if (mov.insumo_id) {
            try {
              // Buscar el producto en las entidades correctas
              let entityType = null;
              let currentItemData = null;
              
              const itemsPT = await ProductoTerminado.filter({ id: mov.insumo_id });
              if (itemsPT && itemsPT.length > 0) {
                currentItemData = itemsPT[0];
                entityType = ProductoTerminado;
              }
              
              if (!currentItemData) {
                const itemsInsumo = await Insumo.filter({ id: mov.insumo_id });
                if (itemsInsumo && itemsInsumo.length > 0) {
                  currentItemData = itemsInsumo[0];
                  entityType = Insumo;
                }
              }
              
              if (entityType && currentItemData) {
                // Recalcular stock SIN este movimiento
                const todosMovimientos = await MovimientoInventario.filter({ insumo_id: mov.insumo_id });
                const stockSinEsteMovimiento = todosMovimientos
                  .filter(m => m.id !== mov.id)
                  .reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
                
                // Recalcular costo promedio sin este movimiento
                let nuevoCostoPromedio = 0;
                if (stockSinEsteMovimiento > 0) {
                  const movimientosRestantes = todosMovimientos.filter(m => m.id !== mov.id && m.tipo_movimiento === 'entrada');
                  if (movimientosRestantes.length > 0) {
                    const valorTotal = movimientosRestantes.reduce((sum, m) => {
                      return sum + (parseFloat(m.cantidad) || 0) * (parseFloat(m.costo_unitario) || 0);
                    }, 0);
                    nuevoCostoPromedio = valorTotal / stockSinEsteMovimiento;
                  }
                }
                
                await entityType.update(currentItemData.id, {
                  stock_actual: stockSinEsteMovimiento,
                  costo_promedio: nuevoCostoPromedio
                });
                
                console.log(`✅ Stock actualizado para ${currentItemData.codigo}: Stock=${stockSinEsteMovimiento}, Costo=${nuevoCostoPromedio}`);
              }
            } catch (err) {
              console.error('Error actualizando stock:', err);
            }
          }
          
          // Eliminar el movimiento
          await MovimientoInventario.delete(mov.id);
          console.log(`✅ Movimiento ${mov.id} eliminado`);
        }
      }

      // Ahora sí eliminar la orden de compra
      await OrdenCompra.delete(ordenId);
      loadData();
      alert("Orden de compra eliminada con éxito.");
    } catch (error) {
      console.error("Error deleting order:", error);
      alert("Error al eliminar la orden de compra: " + error.message);
    }
  };

  const handleShowDetails = (orden) => {
    setSelectedOrder(orden);
    setShowDetailModal(true);
  };

  const handleShowSoportes = (orden) => {
    setSelectedOrder(orden);
    setSoportesToShow(orden.soportes || []);
    setShowSoporteViewer(true);
  };

  const handleExportCSV = () => {
    const headers = ["No. ID", "Prefijo", "Tipo Item", "No. Doc. Proveedor", "Fecha", "Proveedor", "Total", "Estado"];
    const csvRows = [headers.join(",")];

    filteredOrdenes.forEach(orden => {
      const row = [
        `"${orden.numero_id || 'N/A'}"`,
        `"${orden.prefijo}"`,
        `"${orden.tipo_item}"`,
        `"${orden.tipo_documento_proveedor} ${orden.numero_documento}"`,
        `"${formatDate(orden.fecha_emision_documento || orden.fecha_orden)}"`,
        `"${getProveedorNombre(orden.proveedor_id)}"`,
        orden.total || 0,
        `"${orden.estado}"`
      ];
      csvRows.push(row.join(","));
    });

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "compras_insumos.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  const getTotalGeneral = () => {
    return filteredOrdenes.reduce((sum, orden) => sum + (orden.total || 0), 0);
  };

  const tableHeaders = [
    "No. ID", "Prefijo", "Tipo Item", "No. Doc. Proveedor", "Fecha Emisión", "Proveedor", "Valor", "Estado", "Soportes", "Acciones"
  ];

  const renderRow = (orden) => (
    <tr key={orden.id} className="hover:bg-gray-50">
      <td className="px-4 py-2 text-sm font-mono font-bold text-emerald-700">{orden.numero_id || 'N/A'}</td>
      <td className="px-4 py-2 text-sm font-semibold">{orden.prefijo}</td>
      <td className="px-4 py-2 text-sm capitalize">{orden.tipo_item?.replace(/_/g, ' ')}</td>
      <td className="px-4 py-2 text-sm">{orden.tipo_documento_proveedor} {orden.numero_documento}</td>
      <td className="px-4 py-2 text-sm">{formatDate(orden.fecha_emision_documento || orden.fecha_orden)}</td>
      <td className="px-4 py-2 text-sm">{getProveedorNombre(orden.proveedor_id)}</td>
      <td className="px-4 py-2 text-sm font-medium">{formatCurrency(orden.total)}</td>
      <td className="px-4 py-2 text-sm"><Badge>{orden.estado}</Badge></td>
      <td className="px-4 py-2 text-sm">{orden.soportes && orden.soportes.length > 0 ? <span className="text-emerald-600 font-medium">{orden.soportes.length} archivo(s)</span> : <span className="text-gray-400">Sin soportes</span>}</td>
      <td className="px-4 py-2 text-sm">
        <div className="flex space-x-1">
          <Button variant="ghost" size="icon" onClick={() => handleShowDetails(orden)} title="Ver detalle"><Eye className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleShowSoportes(orden)} title="Ver Soportes" disabled={!orden.soportes || orden.soportes.length === 0}><Paperclip className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleOpenModal(orden)} title="Editar"><Edit className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(orden.id)} title="Eliminar"><Trash2 className="w-4 h-4 text-red-500" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-6">
       <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
      <PageHeader
        title="Compras"
        description="Gestiona las órdenes de compra"
        onExportExcel={handleExportCSV}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Compra
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
            <div><Label>Proveedor / Documento #</Label><Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div>
            <div><Label>Insumo</Label><Input placeholder="Buscar por nombre de insumo..." value={filters.insumo} onChange={(e) => setFilters(prev => ({...prev, insumo: e.target.value}))}/></div>
            <div className="flex items-end col-span-full space-x-2">
              <Button onClick={applyFilters} className="w-full bg-blue-600 hover:bg-blue-700"><Search className="w-4 h-4 mr-2" />Consultar</Button>
              <Button onClick={handleClearFilters} variant="outline" className="w-full"><RotateCcw className="w-4 h-4 mr-2" />Limpiar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div id="tabla-imprimible">
        <Card>
          <CardHeader><CardTitle>Órdenes de Compra</CardTitle></CardHeader>
          <CardContent>
            <DataTable headers={tableHeaders} data={filteredOrdenes} renderRow={renderRow} loading={loading}/>
            <div className="mt-6 pt-4 border-t"><div className="flex justify-end"><div className="bg-emerald-50 px-4 py-2 rounded-lg"><span className="text-lg font-bold text-emerald-800">Total: {formatCurrency(getTotalGeneral())}</span></div></div></div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <DocumentoComercialForm
          open={showForm}
          onOpenChange={(open) => { setShowForm(open); }}
          onSubmit={handleSubmit}
          onSuccess={(toast) => {
            setSuccessToast(toast);
            loadData();
          }}
          documento={editingOrder}
          terceros={proveedores}
          itemsCatalogo={insumos}
          tipoDocumento="compra"
          tipoItem="insumos"
          terceroLabel="Proveedor"
          documentoTitulo="Documento de Compra"
        />
      )}

      {selectedOrder && (
        <OrdenDetalle 
          orden={selectedOrder}
          proveedorNombre={selectedOrder ? getProveedorNombre(selectedOrder.proveedor_id) : ""}
          open={showDetailModal}
          onOpenChange={setShowDetailModal}
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

      {successToast && (
        <SuccessToast
          message={successToast.message}
          description={successToast.description}
          duration={4000}
          onClose={() => setSuccessToast(null)}
        />
      )}
    </div>
  );
}