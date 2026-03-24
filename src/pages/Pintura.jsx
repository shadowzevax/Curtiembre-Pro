import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, InventarioEnProceso, PedidoMarroquinero, ProductoTerminado, ProductoCatalogo } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Eye, Table as TableIcon, X } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('es-CO') : 'N/A';

export default function Pintura() {
  const [procesos, setProcesos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [inventarioInsumos, setInventarioInsumos] = useState([]);
  const [unidadesMedida, setUnidadesMedida] = useState([]);
  const [productosCatalogo, setProductosCatalogo] = useState([]);
  const [lotesRecepcion, setLotesRecepcion] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEntregasModal, setShowEntregasModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [entregasParciales, setEntregasParciales] = useState([]);
  const [consumosItems, setConsumosItems] = useState([]);
  const [manoObraItems, setManoObraItems] = useState([]);
  const [productosProduccion, setProductosProduccion] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, pedidosData, inventarioData, UnidadMedidaModule, InventarioModule, prodCatalogo, procesosRecepcion] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'pintura' }),
        Insumo.list(),
        PedidoMarroquinero.list(),
        InventarioEnProceso.list(),
        import('@/entities/all').then(m => m.UnidadMedida),
        import('@/entities/all').then(m => m.DocumentoInventario),
        ProductoCatalogo.list(),
        ProcesoProduccion.filter({ tipo_proceso: 'recepcion' })
      ]);
      const [unidadesData, inventarioInsumosData] = await Promise.all([
        UnidadMedidaModule.list(),
        InventarioModule.filter({ categoria: 'insumos_quimicos' })
      ]);
      setProcesos(procesosData);
      setInsumos(insumosData);
      setPedidos(pedidosData);
      setInventarioEnProceso(inventarioData);
      setUnidadesMedida(unidadesData);
      setInventarioInsumos(inventarioInsumosData);
      setProductosCatalogo(prodCatalogo);
      setLotesRecepcion(procesosRecepcion);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenModal = async (item = null) => {
    setIsEditing(!!item);
    
    if (!item) {
      const year = new Date().getFullYear();
      const procesosDelAnio = procesos.filter(p => p.id_consecutivo?.includes(`-${year}`));
      const consecutivos = procesosDelAnio.map(p => {
        const match = p.id_consecutivo?.match(/PINT-(\d+)-\d{4}/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) + 1 : 1;
      const idConsecutivo = `PINT-${String(nextConsecutivo).padStart(4, '0')}-${year}`;
      
      setCurrentItem({
        tipo_proceso: 'pintura',
        id_consecutivo: idConsecutivo,
        fecha_entrega_pintor: new Date().toISOString().split('T')[0],
        pintor_responsable: '',
        pedido_id: '',
        numero_pedido: '',
        estado_pedido_pintura: 'pendiente',
        total_hojas_enviadas_pintura: 0,
        hojas_pintadas_recibidas: 0,
        hojas_pendientes_pintar: 0,
        codigo_lote: '',
        observaciones: '',
        entregas_parciales: [],
        consumos: [],
        mano_obra_pintura: [],
        finalizar_pintura: false,
        productos_produccion: []
      });
      setConsumosItems([]);
      setManoObraItems([]);
      setProductosProduccion([]);
    } else {
      setCurrentItem(item);
      setConsumosItems(item.consumos || []);
      setManoObraItems(item.mano_obra_pintura || []);
      setProductosProduccion(item.productos_produccion || []);
    }
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleOpenEntregas = (item) => {
    setSelectedItem(item);
    setEntregasParciales(item.entregas_parciales || []);
    setShowEntregasModal(true);
  };

  const agregarEntrega = () => {
    setEntregasParciales([...entregasParciales, {
      fecha_entrega: new Date().toISOString().split('T')[0],
      cantidad_hojas_pintadas: 0,
      observaciones: '',
      confirmado: false
    }]);
  };

  const handleEntregaChange = (index, field, value) => {
    const updated = [...entregasParciales];
    updated[index][field] = field === 'cantidad_hojas_pintadas' ? (parseFloat(value) || 0) : value;
    setEntregasParciales(updated);
  };

  const confirmarEntrega = async (index) => {
    const entrega = entregasParciales[index];
    const totalRecibido = selectedItem.hojas_pintadas_recibidas || 0;
    const totalEnviado = selectedItem.total_hojas_enviadas_pintura || 0;
    const pendiente = totalEnviado - totalRecibido;

    if (entrega.cantidad_hojas_pintadas > pendiente) {
      alert(`Error: No puede registrar más de ${pendiente} hojas pendientes.`);
      return;
    }

    const updated = [...entregasParciales];
    updated[index].confirmado = true;
    
    const nuevasRecibidas = totalRecibido + entrega.cantidad_hojas_pintadas;
    const nuevasPendientes = totalEnviado - nuevasRecibidas;
    const nuevoEstado = nuevasPendientes === 0 ? 'terminado' : (nuevasRecibidas > 0 ? 'parcial' : 'pendiente');

    try {
      await ProcesoProduccion.update(selectedItem.id, {
        entregas_parciales: updated,
        hojas_pintadas_recibidas: nuevasRecibidas,
        hojas_pendientes_pintar: nuevasPendientes,
        estado_pedido_pintura: nuevoEstado
      });

      // Crear entrada en inventario de productos terminados
      await ProductoTerminado.create({
        codigo: `PT-${selectedItem.numero_pedido}-${Date.now()}`,
        descripcion: `Cuero pintado - Pedido ${selectedItem.numero_pedido}`,
        cantidad: entrega.cantidad_hojas_pintadas,
        unidad_medida: 'HOJA',
        pedido_id: selectedItem.pedido_id,
        proceso_origen_id: selectedItem.id,
        fecha_ingreso: entrega.fecha_entrega,
        estado: 'disponible'
      });

      alert('Entrega confirmada y registrada en inventario.');
      setShowEntregasModal(false);
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al confirmar entrega.');
    }
  };

  const agregarConsumo = () => {
    setConsumosItems([...consumosItems, {
      producto_id: '',
      codigo_pcto: '',
      nombre_producto: '',
      unidad_medida: '',
      cantidad_consumida: 0,
      costo_unitario: 0,
      costo_total: 0,
      lote_producto: '',
      observacion: ''
    }]);
  };

  const agregarManoObra = () => {
    setManoObraItems([...manoObraItems, {
      tipo_terminado: '',
      detalle: '',
      cantidad_hojas: 0,
      valor_por_hoja: 0,
      total: 0,
      observacion: ''
    }]);
  };

  const handleManoObraChange = (index, field, value) => {
    const updated = [...manoObraItems];
    updated[index][field] = value;
    
    // Calcular total automáticamente
    if (field === 'cantidad_hojas' || field === 'valor_por_hoja') {
      const cantidad = parseFloat(updated[index].cantidad_hojas) || 0;
      const valor = parseFloat(updated[index].valor_por_hoja) || 0;
      updated[index].total = cantidad * valor;
    }
    
    setManoObraItems(updated);
  };

  const eliminarManoObra = (index) => {
    setManoObraItems(manoObraItems.filter((_, i) => i !== index));
  };

  const handleConsumoChange = async (index, field, value) => {
    const updated = [...consumosItems];
    updated[index][field] = value;

    if (field === 'producto_id') {
      const producto = productosCatalogo.find(p => p.id === value);
      if (producto) {
        updated[index].codigo_pcto = producto.codigo || '';
        updated[index].nombre_producto = producto.descripcion || '';
        updated[index].unidad_medida = producto.unidad_medida || '';
        
        // Obtener costo unitario del inventario
        try {
          const DocumentoInventario = (await import('@/entities/all')).DocumentoInventario;
          const inventario = await DocumentoInventario.filter({ codigo: producto.codigo });
          if (inventario && inventario.length > 0) {
            updated[index].costo_unitario = inventario[0].costo_unitario || 0;
          }
        } catch (e) {
          console.error('Error obteniendo costo:', e);
          updated[index].costo_unitario = 0;
        }
      }
    }

    // Calcular costo total automáticamente
    if (field === 'cantidad_consumida' || field === 'costo_unitario') {
      const cantidad = parseFloat(updated[index].cantidad_consumida) || 0;
      const costo = parseFloat(updated[index].costo_unitario) || 0;
      updated[index].costo_total = cantidad * costo;
    }

    setConsumosItems(updated);
  };

  const eliminarConsumo = (index) => {
    setConsumosItems(consumosItems.filter((_, i) => i !== index));
  };

  // ── Productos de Producción (desde InventarioEnProceso) ──────────────────
  const agregarProductoProduccion = () => {
    setProductosProduccion([...productosProduccion, {
      inv_proceso_id: '',
      codigo: '',
      descripcion: '',
      codigo_lote: '',
      cantidad_hojas: 0,
      cantidad_disponible: 0
    }]);
  };

  const eliminarProductoProduccion = (index) => {
    setProductosProduccion(productosProduccion.filter((_, i) => i !== index));
  };

  const handleProductoProduccionChange = (index, field, value) => {
    const updated = [...productosProduccion];
    updated[index][field] = value;

    if (field === 'inv_proceso_id') {
      const invItem = inventarioEnProceso.find(i => i.id === value);
      if (invItem) {
        updated[index].codigo = invItem.codigo || '';
        updated[index].descripcion = invItem.descripcion || '';
        updated[index].codigo_lote = invItem.codigo_lote || '';
        updated[index].cantidad_disponible = invItem.cantidad_hojas || 0;
        updated[index].cantidad_hojas = invItem.cantidad_hojas || 0;
      }
    }

    setProductosProduccion(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validar consumos
    for (const consumo of consumosItems) {
      if (!consumo.producto_id || !consumo.nombre_producto) {
        alert('Error: Todos los productos deben ser seleccionados. No se permiten items vacíos.');
        return;
      }
      
      if (consumo.cantidad_consumida <= 0) {
        alert('Error: La cantidad consumida debe ser mayor a cero.');
        return;
      }

      if (!consumo.lote_producto) {
        alert('Error: Debe seleccionar un lote para cada producto.');
        return;
      }

      // Validar stock disponible (solo si hay código y lote)
      if (consumo.codigo_pcto && consumo.lote_producto) {
        const inventario = inventarioInsumos.find(inv => 
          inv.codigo === consumo.codigo_pcto && inv.lote === consumo.lote_producto
        );
        
        if (!inventario || inventario.cantidad < consumo.cantidad_consumida) {
          alert(`Stock insuficiente para el producto: ${consumo.nombre_producto}. Stock disponible: ${inventario?.cantidad || 0}`);
          return;
        }
      }

      // Validar duplicados
      const duplicados = consumosItems.filter(c => c.producto_id === consumo.producto_id && c.lote_producto === consumo.lote_producto);
      if (duplicados.length > 1) {
        if (!confirm(`El producto "${consumo.nombre_producto}" con lote "${consumo.lote_producto}" ya fue registrado. ¿Desea sumar las cantidades automáticamente?`)) {
          return;
        }
        // Consolidar duplicados
        const indexPrimero = consumosItems.findIndex(c => c.producto_id === consumo.producto_id && c.lote_producto === consumo.lote_producto);
        const cantidadTotal = duplicados.reduce((sum, d) => sum + d.cantidad_consumida, 0);
        const consolidados = consumosItems.filter(c => !(c.producto_id === consumo.producto_id && c.lote_producto === consumo.lote_producto));
        consolidados.splice(indexPrimero, 0, {...duplicados[0], cantidad_consumida: cantidadTotal});
        setConsumosItems(consolidados);
        return;
      }
    }

    try {
      const totalConsumo = consumosItems.reduce((sum, c) => sum + (c.costo_total || 0), 0);
      const totalManoObra = manoObraItems.reduce((sum, m) => sum + (m.total || 0), 0);
      const costoTotalProceso = totalConsumo + totalManoObra;
      const costoPromedioPorHoja = (currentItem.total_hojas_enviadas_pintura || 0) > 0 
        ? costoTotalProceso / currentItem.total_hojas_enviadas_pintura 
        : 0;

      const dataToSave = {
        ...currentItem,
        numero_proceso: currentItem.id_consecutivo,
        hojas_pendientes_pintar: currentItem.total_hojas_enviadas_pintura - (currentItem.hojas_pintadas_recibidas || 0),
        consumos: consumosItems,
        mano_obra_pintura: manoObraItems,
        productos_produccion: productosProduccion,
        total_consumo_productos: totalConsumo,
        total_mano_obra: totalManoObra,
        costo_total_proceso_pintura: costoTotalProceso,
        costo_promedio_por_hoja: costoPromedioPorHoja
      };
      
      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        const created = await ProcesoProduccion.create(dataToSave);
        
        // Descontar inventario de insumos químicos
        for (const consumo of consumosItems) {
          const inventario = inventarioInsumos.find(inv => 
            inv.codigo === consumo.codigo_pcto && inv.lote === consumo.lote_producto
          );
          if (inventario) {
            const DocumentoInventario = (await import('@/entities/all')).DocumentoInventario;
            await DocumentoInventario.update(inventario.id, {
              cantidad: inventario.cantidad - consumo.cantidad_consumida
            });
          }
        }

        // Actualizar InventarioEnProceso: descontar cantidad usada de cada producto de producción
        for (const prod of productosProduccion) {
          if (prod.inv_proceso_id && prod.cantidad_hojas > 0) {
            const invItem = inventarioEnProceso.find(i => i.id === prod.inv_proceso_id);
            if (invItem) {
              const cantidadUsada = parseFloat(prod.cantidad_hojas) || 0;
              if (cantidadUsada > (invItem.cantidad_hojas || 0)) {
                alert(`⚠️ La cantidad de hojas (${cantidadUsada}) para "${prod.codigo}" supera la disponible (${invItem.cantidad_hojas}).`);
                return;
              }
              const nuevaCantidad = (invItem.cantidad_hojas || 0) - cantidadUsada;
              const nuevoEstado = nuevaCantidad === 0 ? 'TERMINADO' : 'EN_PROCESO';
              await InventarioEnProceso.update(invItem.id, {
                cantidad_hojas: nuevaCantidad,
                estado_actual: nuevoEstado
              });
              console.log(`✅ InventarioEnProceso actualizado: ${prod.codigo} → ${nuevaCantidad} hojas (${nuevoEstado})`);
            }
          }
        }
      }
      
      setShowModal(false);
      loadData();
      alert('Proceso de pintura guardado con éxito.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar el proceso.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proceso de pintura?')) return;
    try {
      await ProcesoProduccion.delete(id);
      loadData();
      alert('Proceso eliminado.');
    } catch (error) {
      console.error('Error deleting:', error);
    }
  };

  const handleExport = () => alert('Función de exportar en desarrollo.');

  const headers = ['ID', 'Fecha Entrega', 'Pintor', 'No. Pedido', 'Total Enviadas', 'Hojas Pintadas', 'Pendientes', 'Estado', 'Acciones'];
  
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono font-bold">{item?.id_consecutivo || item?.numero_proceso || 'N/A'}</td>
      <td>{formatDate(item.fecha_entrega_pintor)}</td>
      <td>{item.pintor_responsable || 'N/A'}</td>
      <td className="font-mono">{item.numero_pedido || 'N/A'}</td>
      <td className="text-center font-bold">{item.total_hojas_enviadas_pintura || 0}</td>
      <td className="text-center font-bold text-green-600">{item.hojas_pintadas_recibidas || 0}</td>
      <td className="text-center font-bold text-orange-600">{item.hojas_pendientes_pintar || 0}</td>
      <td>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          item.estado_pedido_pintura === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
          item.estado_pedido_pintura === 'parcial' ? 'bg-blue-100 text-blue-700' :
          'bg-green-100 text-green-700'
        }`}>
          {item.estado_pedido_pintura?.toUpperCase() || 'PENDIENTE'}
        </span>
      </td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenEntregas(item)} title="Entregas Parciales">
            <TableIcon className="w-4 h-4 text-purple-600" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} title="Ver Detalle">
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)} title="Editar">
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} title="Eliminar">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Pintura"
        description="Gestiona los procesos de pintura del cuero."
        onExportExcel={handleExport}
        onPrint={() => window.print()}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Pintura
          </Button>
        }
      />
      
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Procesos de Pintura</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={procesos} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Pintura</DialogTitle>
          </DialogHeader>
          {currentItem && (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ID/Consecutivo</Label>
                <Input value={currentItem.id_consecutivo || ''} readOnly className="bg-gray-100 font-mono font-bold" />
              </div>
              <div>
                <Label>Fecha de Entrega al Pintor *</Label>
                <Input type="date" value={currentItem.fecha_entrega_pintor || ''} onChange={e => setCurrentItem({...currentItem, fecha_entrega_pintor: e.target.value})} required />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pintor/Responsable</Label>
                <Input value={currentItem?.pintor_responsable || ''} onChange={e => setCurrentItem({...currentItem, pintor_responsable: e.target.value})} />
              </div>
              <div>
                <Label>No. ID del Pedido</Label>
                <Select value={currentItem?.pedido_id || ''} onValueChange={v => {
                  const pedido = pedidos.find(p => p.id === v);
                  setCurrentItem({...currentItem, pedido_id: v, numero_pedido: pedido?.numero_pedido || ''});
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar pedido" /></SelectTrigger>
                  <SelectContent>
                    {pedidos.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.numero_pedido} - {p.nombre_marroquinero}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Estado del Pedido en Pintura *</Label>
                <Select value={currentItem.estado_pedido_pintura || 'pendiente'} onValueChange={v => setCurrentItem({...currentItem, estado_pedido_pintura: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">PENDIENTE</SelectItem>
                    <SelectItem value="parcial">PARCIAL</SelectItem>
                    <SelectItem value="terminado">TERMINADO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Total Hojas Enviadas a Pintura *</Label>
                <Input type="number" value={currentItem.total_hojas_enviadas_pintura || 0} onChange={e => {
                  const total = parseFloat(e.target.value) || 0;
                  const recibidas = currentItem.hojas_pintadas_recibidas || 0;
                  setCurrentItem({...currentItem, total_hojas_enviadas_pintura: total, hojas_pendientes_pintar: total - recibidas});
                }} required />
              </div>
              <div>
                <Label>Código Lote Crosta (opcional)</Label>
                <Select value={currentItem.codigo_lote || ''} onValueChange={v => {
                  setCurrentItem({...currentItem, codigo_lote: v});
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lote" /></SelectTrigger>
                  <SelectContent>
                    {inventarioEnProceso.filter(inv => inv.codigo_lote).map(inv => (
                      <SelectItem key={inv.id} value={inv.codigo_lote}>
                        {inv.codigo_lote} - {inv.cantidad_hojas} hojas
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 bg-blue-50 p-3 rounded">
              <div><Label>Hojas Pintadas Recibidas</Label><Input type="number" value={currentItem.hojas_pintadas_recibidas || 0} onChange={e => {
                const recibidas = parseFloat(e.target.value) || 0;
                const total = currentItem.total_hojas_enviadas_pintura || 0;
                setCurrentItem({...currentItem, hojas_pintadas_recibidas: recibidas, hojas_pendientes_pintar: total - recibidas});
              }} className="bg-white font-bold" /></div>
              <div><Label>Hojas Pendientes por Pintar</Label><Input type="number" value={currentItem.hojas_pendientes_pintar || 0} readOnly className="bg-orange-50 font-bold text-orange-700" /></div>
            </div>
            
            <div>
              <Label>Observaciones</Label>
              <Textarea value={currentItem.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={3} />
            </div>

            {/* BLOQUE: ÍTEM DE PRODUCTOS DE PRODUCCIÓN */}
            <div className="border-t pt-4 mt-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Ítem de productos de producción</h3>
                <Button type="button" onClick={agregarProductoProduccion} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar productos
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-purple-50">
                    <tr>
                      <th className="border p-2">CÓDIGO</th>
                      <th className="border p-2">DESCRIPCIÓN</th>
                      <th className="border p-2">CÓDIGO LOTE</th>
                      <th className="border p-2 text-right">CANTIDAD HOJAS</th>
                      <th className="border p-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosProduccion.length === 0 && (
                      <tr><td colSpan={5} className="p-3 text-center text-gray-400 text-sm">No hay productos agregados. Haga clic en "Agregar productos".</td></tr>
                    )}
                    {productosProduccion.map((prod, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="border p-2">
                          <Select value={prod.inv_proceso_id} onValueChange={v => handleProductoProduccionChange(idx, 'inv_proceso_id', v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                            <SelectContent>
                              {inventarioEnProceso.filter(inv => inv.id).map(inv => (
                                <SelectItem key={inv.id} value={inv.id}>
                                  {inv.codigo || '—'} - {inv.codigo_lote || '—'} ({inv.cantidad_hojas || 0} hojas)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border p-2">
                          <Input value={prod.descripcion || ''} readOnly className="bg-gray-50 h-8 text-xs" />
                        </td>
                        <td className="border p-2">
                          <Input value={prod.codigo_lote || ''} readOnly className="bg-gray-50 h-8 text-xs font-mono" />
                        </td>
                        <td className="border p-2">
                          <Input
                            type="number"
                            value={prod.cantidad_hojas}
                            onChange={e => handleProductoProduccionChange(idx, 'cantidad_hojas', parseFloat(e.target.value) || 0)}
                            className="h-8 text-xs text-right"
                            min="0"
                            max={prod.cantidad_disponible}
                          />
                          {prod.cantidad_disponible > 0 && (
                            <div className="text-gray-400 text-xs mt-1 text-right">Disp: {prod.cantidad_disponible}</div>
                          )}
                        </td>
                        <td className="border p-2 text-center">
                          <Button type="button" variant="ghost" size="sm" onClick={() => eliminarProductoProduccion(idx)}>
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* TABLA DE ITEMS DE CONSUMO */}
            <div className="border-t pt-4 mt-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Items de Consumo de Productos</h3>
                <Button type="button" onClick={agregarConsumo} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Producto
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2">CÓDIGO PCTO.</th>
                      <th className="border p-2">NOMBRE DEL PRODUCTO</th>
                      <th className="border p-2">UNIDAD DE MEDIDA</th>
                      <th className="border p-2">CANTIDAD CONSUMIDA</th>
                      <th className="border p-2">COSTO UNITARIO</th>
                      <th className="border p-2">COSTO TOTAL</th>
                      <th className="border p-2">LOTE DEL PRODUCTO</th>
                      <th className="border p-2">OBSERVACIÓN</th>
                      <th className="border p-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumosItems.map((consumo, idx) => {
                      return (
                        <tr key={idx} className="border-t">
                          <td className="border p-2">
                            <Select value={consumo.producto_id} onValueChange={v => handleConsumoChange(idx, 'producto_id', v)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Buscar código..." />
                              </SelectTrigger>
                              <SelectContent>
                                {productosCatalogo.map(prod => (
                                  <SelectItem key={prod.id} value={prod.id}>{prod.codigo}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="border p-2">
                            <Input value={consumo.nombre_producto || ''} readOnly className="bg-gray-50 h-8 text-xs font-medium" />
                          </td>
                          <td className="border p-2">
                            <Input value={consumo.unidad_medida || ''} readOnly className="bg-gray-50 h-8 text-xs" />
                          </td>
                          <td className="border p-2">
                            <Input 
                              type="number" 
                              value={consumo.cantidad_consumida} 
                              onChange={e => handleConsumoChange(idx, 'cantidad_consumida', parseFloat(e.target.value) || 0)} 
                              className="h-8 text-xs text-right" 
                              min="0.01"
                              step="0.01"
                            />
                          </td>
                          <td className="border p-2">
                            <Input 
                              type="number" 
                              value={consumo.costo_unitario || 0} 
                              readOnly 
                              className="h-8 text-xs text-right bg-gray-50 font-medium" 
                            />
                          </td>
                          <td className="border p-2">
                            <Input 
                              type="number" 
                              value={consumo.costo_total || 0} 
                              readOnly 
                              className="h-8 text-xs text-right bg-blue-50 font-bold" 
                            />
                          </td>
                          <td className="border p-2">
                            <Select value={consumo.lote_producto} onValueChange={v => handleConsumoChange(idx, 'lote_producto', v)}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Lote *" />
                              </SelectTrigger>
                              <SelectContent>
                                {lotesRecepcion.map(lote => (
                                  <SelectItem key={lote.id} value={lote.codigo_lote}>
                                    {lote.codigo_lote} - {lote.descripcion_producto || 'N/A'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="border p-2">
                            <Input value={consumo.observacion} onChange={e => handleConsumoChange(idx, 'observacion', e.target.value)} className="h-8 text-xs" />
                          </td>
                          <td className="border p-2 text-center">
                            <Button type="button" variant="ghost" size="sm" onClick={() => eliminarConsumo(idx)}>
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex justify-end">
                  <div className="text-right">
                    <span className="text-sm font-semibold mr-3">TOTAL CONSUMO DE PRODUCTOS:</span>
                    <span className="text-lg font-bold text-blue-700">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(
                        consumosItems.reduce((sum, c) => sum + (c.costo_total || 0), 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* TABLA DE MANO DE OBRA DE PINTURA */}
            <div className="border-t pt-4 mt-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Mano de Obra de Pintura</h3>
                <Button type="button" onClick={agregarManoObra} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Mano de Obra
                </Button>
              </div>
              
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2">TIPO DE TERMINADO</th>
                      <th className="border p-2">DETALLE</th>
                      <th className="border p-2">CANTIDAD HOJAS</th>
                      <th className="border p-2">VALOR POR HOJA</th>
                      <th className="border p-2">TOTAL</th>
                      <th className="border p-2">OBSERVACIÓN</th>
                      <th className="border p-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manoObraItems.map((mano, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="border p-2">
                          <Select value={mano.tipo_terminado} onValueChange={v => handleManoObraChange(idx, 'tipo_terminado', v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccionar *" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="napa">Napa</SelectItem>
                              <SelectItem value="napa_mate">Napa Mate</SelectItem>
                              <SelectItem value="opaco">Opaco</SelectItem>
                              <SelectItem value="envejecido">Envejecido</SelectItem>
                              <SelectItem value="grabado">Grabado</SelectItem>
                              <SelectItem value="liso">Liso</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border p-2">
                          <Input 
                            value={mano.detalle} 
                            onChange={e => handleManoObraChange(idx, 'detalle', e.target.value)} 
                            className="h-8 text-xs" 
                            placeholder="Detalle del trabajo"
                          />
                        </td>
                        <td className="border p-2">
                          <Input 
                            type="number" 
                            value={mano.cantidad_hojas} 
                            onChange={e => handleManoObraChange(idx, 'cantidad_hojas', parseFloat(e.target.value) || 0)} 
                            className="h-8 text-xs text-right" 
                            min="0"
                            step="1"
                          />
                        </td>
                        <td className="border p-2">
                          <Input 
                            type="number" 
                            value={mano.valor_por_hoja} 
                            onChange={e => handleManoObraChange(idx, 'valor_por_hoja', parseFloat(e.target.value) || 0)} 
                            className="h-8 text-xs text-right" 
                            min="0"
                            step="100"
                          />
                        </td>
                        <td className="border p-2">
                          <Input 
                            type="number" 
                            value={mano.total} 
                            readOnly 
                            className="h-8 text-xs text-right bg-blue-50 font-bold" 
                          />
                        </td>
                        <td className="border p-2">
                          <Input 
                            value={mano.observacion} 
                            onChange={e => handleManoObraChange(idx, 'observacion', e.target.value)} 
                            className="h-8 text-xs" 
                            placeholder="Observaciones"
                          />
                        </td>
                        <td className="border p-2 text-center">
                          <Button type="button" variant="ghost" size="sm" onClick={() => eliminarManoObra(idx)}>
                            <X className="w-4 h-4 text-red-500" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex justify-end">
                  <div className="text-right">
                    <span className="text-sm font-semibold mr-3">TOTAL MANO DE OBRA:</span>
                    <span className="text-lg font-bold text-green-700">
                      {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(
                        manoObraItems.reduce((sum, m) => sum + (m.total || 0), 0)
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* RESUMEN FINAL DEL PROCESO */}
            <div className="border-t pt-4 mt-6 bg-slate-50 p-4 rounded-lg">
              <h3 className="font-bold text-lg mb-3">Resumen de Costos del Proceso</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Total Consumo de Productos:</span>
                  <span className="font-bold text-blue-700">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(
                      consumosItems.reduce((sum, c) => sum + (c.costo_total || 0), 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Mano de Obra:</span>
                  <span className="font-bold text-green-700">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(
                      manoObraItems.reduce((sum, m) => sum + (m.total || 0), 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-slate-300">
                  <span className="font-bold">COSTO TOTAL DEL PROCESO DE PINTURA:</span>
                  <span className="font-bold text-xl text-purple-700">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(
                      consumosItems.reduce((sum, c) => sum + (c.costo_total || 0), 0) +
                      manoObraItems.reduce((sum, m) => sum + (m.total || 0), 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-base pt-2 border-t border-slate-300">
                  <span className="font-bold">COSTO PROMEDIO POR HOJA:</span>
                  <span className="font-bold text-xl text-orange-700">
                    {(() => {
                      const totalHojas = parseFloat(currentItem.total_hojas_enviadas_pintura) || 0;
                      if (totalHojas <= 0) return '$0';
                      const totalCosto = consumosItems.reduce((sum, c) => sum + (parseFloat(c.costo_total) || 0), 0) + 
                                        manoObraItems.reduce((sum, m) => sum + (parseFloat(m.total) || 0), 0);
                      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(totalCosto / totalHojas);
                    })()}
                  </span>
                </div>
              </div>
            </div>

            {/* Finalizar Pintura */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg mt-4">
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  id="finalizar_pintura"
                  checked={currentItem?.finalizar_pintura || false}
                  onChange={e => setCurrentItem({...currentItem, finalizar_pintura: e.target.checked})}
                  className="w-5 h-5 accent-emerald-600 cursor-pointer"
                />
                <label htmlFor="finalizar_pintura" className="font-semibold text-emerald-800 cursor-pointer">
                  Finalizar Pintura
                </label>
                <span className="text-sm text-emerald-600">(Marcar cuando el proceso de pintura haya sido completado)</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showEntregasModal} onOpenChange={setShowEntregasModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Control de Entregas Parciales{selectedItem?.id_consecutivo ? ` - ${selectedItem.id_consecutivo}` : ''}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded grid grid-cols-3 gap-4 text-sm">
              <div><span className="font-semibold">Total Enviadas:</span> {selectedItem?.total_hojas_enviadas_pintura || 0} hojas</div>
              <div><span className="font-semibold text-green-600">Recibidas:</span> {selectedItem?.hojas_pintadas_recibidas || 0} hojas</div>
              <div><span className="font-semibold text-orange-600">Pendientes:</span> {selectedItem?.hojas_pendientes_pintar || 0} hojas</div>
            </div>

            <div className="flex justify-end">
              <Button onClick={agregarEntrega} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar Entrega
              </Button>
            </div>
            
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Fecha Entrega</th>
                    <th className="p-2 text-right">Cantidad Hojas Pintadas</th>
                    <th className="p-2 text-left">Observaciones</th>
                    <th className="p-2 text-center">Estado</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {entregasParciales.map((entrega, idx) => (
                    <tr key={idx} className={`border-t ${entrega.confirmado ? 'bg-green-50' : ''}`}>
                      <td className="p-2">
                        <Input type="date" value={entrega.fecha_entrega} onChange={e => handleEntregaChange(idx, 'fecha_entrega', e.target.value)} disabled={entrega.confirmado} className="h-8 text-sm" />
                      </td>
                      <td className="p-2">
                        <Input type="number" value={entrega.cantidad_hojas_pintadas} onChange={e => handleEntregaChange(idx, 'cantidad_hojas_pintadas', e.target.value)} disabled={entrega.confirmado} className="h-8 text-sm text-right" />
                      </td>
                      <td className="p-2">
                        <Input value={entrega.observaciones} onChange={e => handleEntregaChange(idx, 'observaciones', e.target.value)} disabled={entrega.confirmado} className="h-8 text-sm" />
                      </td>
                      <td className="p-2 text-center">
                        {entrega.confirmado ? (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">CONFIRMADO</span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">PENDIENTE</span>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        {!entrega.confirmado && (
                          <div className="flex gap-1 justify-center">
                            <Button size="sm" onClick={() => confirmarEntrega(idx)}>Confirmar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEntregasParciales(entregasParciales.filter((_, i) => i !== idx))}>
                              <X className="w-3 h-3 text-red-500" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowEntregasModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de Pintura</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">ID Consecutivo:</span> <span className="font-mono">{selectedItem.id_consecutivo || 'N/A'}</span></p>
              <p><span className="font-semibold">Fecha Entrega Pintor:</span> {formatDate(selectedItem.fecha_entrega_pintor)}</p>
              <p><span className="font-semibold">Pintor/Responsable:</span> {selectedItem.pintor_responsable || 'N/A'}</p>
              <p><span className="font-semibold">Pedido:</span> <span className="font-mono">{selectedItem.numero_pedido || 'N/A'}</span></p>
              <p><span className="font-semibold">Total Enviadas:</span> {selectedItem.total_hojas_enviadas_pintura} hojas</p>
              <p><span className="font-semibold">Hojas Pintadas:</span> {selectedItem.hojas_pintadas_recibidas} hojas</p>
              <p><span className="font-semibold">Pendientes:</span> {selectedItem.hojas_pendientes_pintar} hojas</p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize font-bold">{selectedItem.estado_pedido_pintura}</span></p>
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}
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