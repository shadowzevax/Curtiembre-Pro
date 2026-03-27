import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, InventarioEnProceso, PedidoMarroquinero, ProductoTerminado, MovimientoInventario, ProductoCatalogo } from '@/entities/all';
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

// Combina todos los inventarios en un único catálogo unificado para los selectores
function buildCatalogoCombinado(inventarioEnProceso, insumosQuimicos, productosTerminados) {
  const items = [];
  productosTerminados.forEach(p => {
    items.push({ id: p.id, codigo: p.codigo || '', descripcion: p.descripcion || p.nombre || '', unidad_medida: p.unidad_medida || '', costo_promedio: p.costo_promedio || 0, stock_actual: p.stock_actual || 0, stock_minimo: p.stock_minimo || 0, origen: 'terminado', entityId: p.id });
  });
  insumosQuimicos.forEach(i => {
    if (!items.some(x => x.codigo === i.codigo)) {
      items.push({ id: i.id, codigo: i.codigo || '', descripcion: i.nombre || i.descripcion || '', unidad_medida: i.unidad_medida || '', costo_promedio: i.costo_promedio || 0, stock_actual: i.stock_actual || 0, stock_minimo: i.stock_minimo || 0, origen: 'insumo', entityId: i.id });
    }
  });
  inventarioEnProceso.forEach(p => {
    if (!items.some(x => x.codigo === p.codigo)) {
      items.push({ id: p.id, codigo: p.codigo || '', descripcion: p.descripcion || '', unidad_medida: 'HOJA', costo_promedio: 0, stock_actual: p.cantidad_hojas || 0, stock_minimo: 0, origen: 'en_proceso', entityId: p.id });
    }
  });
  return items.filter(i => i.codigo).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : 'N/A';

export default function Pintura() {
  const [procesos, setProcesos] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [insumosQuimicos, setInsumosQuimicos] = useState([]);
  const [productosTerminados, setProductosTerminados] = useState([]);
  const [catalogoCombinado, setCatalogoCombinado] = useState([]);
  const [catalogoProductos, setCatalogoProductos] = useState([]); // ProductoCatalogo para líneas de producción
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEntregasModal, setShowEntregasModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [entregasParciales, setEntregasParciales] = useState([]);

  // Sub-tablas del formulario
  const [lineasProduccion, setLineasProduccion] = useState([]); // DETALLE DE PRODUCCION EN PINTURA
  const [consumosItems, setConsumosItems] = useState([]);
  const [manoObraItems, setManoObraItems] = useState([]);
  const [productosProduccion, setProductosProduccion] = useState([]);
  const [origenHojas, setOrigenHojas] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, pedidosData, inventarioData, productosTermData, catalogoData] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'pintura' }),
        Insumo.list(),
        PedidoMarroquinero.list(),
        InventarioEnProceso.list(),
        ProductoTerminado.list(),
        ProductoCatalogo.list()
      ]);
      setProcesos(procesosData);
      setInsumosQuimicos(insumosData);
      setPedidos(pedidosData);
      setInventarioEnProceso(inventarioData);
      setProductosTerminados(productosTermData);
      setCatalogoCombinado(buildCatalogoCombinado(inventarioData, insumosData, productosTermData));
      setCatalogoProductos(catalogoData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── TOTAL HOJAS: suma automática desde líneas de producción ──────────────
  const totalHojasDeLineas = lineasProduccion.reduce((sum, l) => sum + (parseFloat(l.cantidad_hojas) || 0), 0);

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
        numero_proceso: idConsecutivo,
        id_consecutivo: idConsecutivo,
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_inicio_pintura: new Date().toISOString().split('T')[0],
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
      setLineasProduccion([]);
      setConsumosItems([]);
      setManoObraItems([]);
      setProductosProduccion([]);
      setOrigenHojas([]);
    } else {
      setCurrentItem(item);
      setLineasProduccion(item.lineas_produccion || []);
      setConsumosItems(item.consumos || []);
      setManoObraItems(item.mano_obra_pintura || []);
      setProductosProduccion(item.productos_produccion || []);
      setOrigenHojas(item.origen_hojas || []);
    }
    setShowModal(true);
  };

  const esFinalizado = currentItem?.estado_pedido_pintura === 'terminado' || currentItem?.finalizar_pintura;

  // ── LÍNEAS DE PRODUCCIÓN ─────────────────────────────────────────────────
  const agregarLineaProduccion = () => {
    if (esFinalizado) return;
    setLineasProduccion([...lineasProduccion, { linea_id: '', nombre_linea: '', color: '', cantidad_hojas: 0 }]);
  };

  const handleLineaChange = (index, field, value) => {
    if (esFinalizado) return;
    const updated = [...lineasProduccion];
    if (field === 'linea_id') {
      const prod = catalogoProductos.find(p => p.id === value);
      updated[index].linea_id = value;
      updated[index].nombre_linea = prod ? (prod.nombre_comercial || prod.descripcion || prod.codigo) : '';
    } else {
      updated[index][field] = field === 'cantidad_hojas' ? (parseFloat(value) || 0) : value;
    }
    setLineasProduccion(updated);
    // Actualizar total_hojas_enviadas_pintura automáticamente
    const nuevoTotal = updated.reduce((sum, l) => sum + (parseFloat(l.cantidad_hojas) || 0), 0);
    setCurrentItem(prev => ({ ...prev, total_hojas_enviadas_pintura: nuevoTotal, hojas_pendientes_pintar: nuevoTotal - (prev.hojas_pintadas_recibidas || 0) }));
  };

  const eliminarLineaProduccion = (index) => {
    if (esFinalizado) return;
    const updated = lineasProduccion.filter((_, i) => i !== index);
    setLineasProduccion(updated);
    const nuevoTotal = updated.reduce((sum, l) => sum + (parseFloat(l.cantidad_hojas) || 0), 0);
    setCurrentItem(prev => ({ ...prev, total_hojas_enviadas_pintura: nuevoTotal, hojas_pendientes_pintar: nuevoTotal - (prev.hojas_pintadas_recibidas || 0) }));
  };

  // ── CONSUMOS ─────────────────────────────────────────────────────────────
  const agregarConsumo = () => {
    setConsumosItems([...consumosItems, { insumo_id: '', item_id: '', origen_inventario: '', codigo_pcto: '', nombre_producto: '', unidad_medida: '', cantidad_consumida: 0, costo_unitario: 0, costo_total: 0, linea_produccion_idx: '', observacion: '' }]);
  };

  const handleConsumoChange = (index, field, value) => {
    const updated = [...consumosItems];
    updated[index][field] = value;
    if (field === 'item_id') {
      const catalogoItem = catalogoCombinado.find(i => i.id === value);
      if (catalogoItem) {
        updated[index].insumo_id = catalogoItem.origen === 'insumo' ? catalogoItem.entityId : '';
        updated[index].origen_inventario = catalogoItem.origen;
        updated[index].codigo_pcto = catalogoItem.codigo;
        updated[index].nombre_producto = catalogoItem.descripcion;
        updated[index].unidad_medida = catalogoItem.unidad_medida;
        updated[index].costo_unitario = catalogoItem.costo_promedio || 0;
        updated[index].costo_total = (parseFloat(updated[index].cantidad_consumida) || 0) * (catalogoItem.costo_promedio || 0);
      }
    }
    if (field === 'cantidad_consumida' || field === 'costo_unitario') {
      const cantidad = parseFloat(field === 'cantidad_consumida' ? value : updated[index].cantidad_consumida) || 0;
      const costo = parseFloat(field === 'costo_unitario' ? value : updated[index].costo_unitario) || 0;
      updated[index].costo_total = cantidad * costo;
    }
    setConsumosItems(updated);
  };

  const eliminarConsumo = (index) => setConsumosItems(consumosItems.filter((_, i) => i !== index));

  // ── MANO DE OBRA ─────────────────────────────────────────────────────────
  const agregarManoObra = () => {
    setManoObraItems([...manoObraItems, { linea_produccion_idx: '', tipo_terminado: '', detalle: '', cantidad_hojas: 0, valor_por_hoja: 0, total: 0, observacion: '' }]);
  };

  const handleManoObraChange = (index, field, value) => {
    const updated = [...manoObraItems];
    updated[index][field] = value;
    if (field === 'cantidad_hojas' || field === 'valor_por_hoja') {
      const cantidad = parseFloat(field === 'cantidad_hojas' ? value : updated[index].cantidad_hojas) || 0;
      const valor = parseFloat(field === 'valor_por_hoja' ? value : updated[index].valor_por_hoja) || 0;
      updated[index].total = cantidad * valor;
    }
    setManoObraItems(updated);
  };

  const eliminarManoObra = (index) => setManoObraItems(manoObraItems.filter((_, i) => i !== index));

  // ── PRODUCTOS DE PRODUCCIÓN ───────────────────────────────────────────────
  const agregarProductoProduccion = () => {
    setProductosProduccion([...productosProduccion, { item_id: '', linea_produccion_idx: '', inv_proceso_id: '', codigo: '', descripcion: '', codigo_lote: '', cantidad_hojas: 0, cantidad_disponible: 0 }]);
  };

  const eliminarProductoProduccion = (index) => setProductosProduccion(productosProduccion.filter((_, i) => i !== index));

  const handleProductoProduccionChange = (index, field, value) => {
    const updated = [...productosProduccion];
    if (field === 'item_id') {
      const catalogoItem = catalogoCombinado.find(i => i.id === value);
      if (catalogoItem) {
        updated[index].item_id = catalogoItem.id;
        updated[index].codigo = catalogoItem.codigo;
        updated[index].descripcion = catalogoItem.descripcion;
        updated[index].origen_inventario = catalogoItem.origen;
        updated[index].inv_proceso_id = catalogoItem.origen === 'en_proceso' ? catalogoItem.entityId : '';
        updated[index].cantidad_disponible = catalogoItem.stock_actual || 0;
        updated[index].cantidad_hojas = catalogoItem.stock_actual || 0;
        if (catalogoItem.origen === 'en_proceso') {
          const invItem = inventarioEnProceso.find(i => i.id === catalogoItem.entityId);
          updated[index].codigo_lote = invItem?.codigo_lote || '';
        }
      }
    } else {
      updated[index][field] = field === 'cantidad_hojas' ? (parseFloat(value) || 0) : value;
    }
    setProductosProduccion(updated);
  };

  // ── CÁLCULO DE COSTOS POR LÍNEA ───────────────────────────────────────────
  const calcularCostosPorLinea = () => {
    return lineasProduccion.map((linea, idx) => {
      const costoProductos = consumosItems.filter(c => String(c.linea_produccion_idx) === String(idx)).reduce((sum, c) => sum + (c.costo_total || 0), 0);
      const costoManoObra = manoObraItems.filter(m => String(m.linea_produccion_idx) === String(idx)).reduce((sum, m) => sum + (m.total || 0), 0);
      const costoTotal = costoProductos + costoManoObra;
      const cantHojas = parseFloat(linea.cantidad_hojas) || 0;
      const costoPorHoja = cantHojas > 0 ? costoTotal / cantHojas : 0;
      const hojasbuenas = parseFloat(linea.hojas_buenas) || Math.max(0, cantHojas - (parseFloat(linea.hojas_danadas) || 0));
      const hojasDanadas = parseFloat(linea.hojas_danadas) || 0;
      const rendimiento = cantHojas > 0 ? (hojasbuenas / cantHojas) * 100 : 0;
      return { ...linea, idx, costoProductos, costoManoObra, costoTotal, costoPorHoja, hojas_buenas: hojasbuenas, hojas_danadas: hojasDanadas, rendimiento };
    });
  };

  // ── GUARDAR ───────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();

    // Validar líneas de producción
    for (const linea of lineasProduccion) {
      if (!linea.linea_id) { alert('Error: Todas las líneas de producción deben tener un producto seleccionado.'); return; }
      if (!linea.cantidad_hojas || linea.cantidad_hojas <= 0) { alert('Error: La cantidad de hojas en cada línea debe ser mayor a cero.'); return; }
    }

    // Validar consumos
    for (const consumo of consumosItems) {
      if (!consumo.item_id) { alert('Error: Todos los consumos deben tener un producto seleccionado.'); return; }
      if (consumo.cantidad_consumida <= 0) { alert('Error: La cantidad consumida debe ser mayor a cero.'); return; }
      if (consumo.linea_produccion_idx === '' || consumo.linea_produccion_idx === undefined) { alert('Error: Cada consumo debe estar asociado a una Línea de Producción.'); return; }
      if (consumo.insumo_id) {
        const insumo = insumosQuimicos.find(i => i.id === consumo.insumo_id);
        if (insumo && consumo.cantidad_consumida > (insumo.stock_actual || 0)) {
          alert(`⚠️ Stock insuficiente para "${consumo.nombre_producto}".\nDisponible: ${insumo.stock_actual}\nSolicitado: ${consumo.cantidad_consumida}`);
          return;
        }
      }
    }

    // Validar mano de obra
    for (const mano of manoObraItems) {
      if (mano.linea_produccion_idx === '' || mano.linea_produccion_idx === undefined) { alert('Error: Cada mano de obra debe estar asociada a una Línea de Producción.'); return; }
    }

    // Validar rendimiento por línea
    for (const linea of lineasProduccion) {
      const cantHojas = parseFloat(linea.cantidad_hojas) || 0;
      const buenas = parseFloat(linea.hojas_buenas) || 0;
      const danadas = parseFloat(linea.hojas_danadas) || 0;
      if (buenas + danadas > cantHojas) {
        alert(`⚠️ En la línea "${linea.nombre_linea || linea.linea_id}": Hojas buenas + dañadas no puede superar la cantidad de hojas (${cantHojas}).`);
        return;
      }
    }

    // Validar productos de producción
    for (const prod of productosProduccion) {
      if (prod.inv_proceso_id && prod.cantidad_hojas > 0) {
        const invItem = inventarioEnProceso.find(i => i.id === prod.inv_proceso_id);
        if (invItem && prod.cantidad_hojas > (invItem.cantidad_hojas || 0)) {
          alert(`⚠️ Cantidad (${prod.cantidad_hojas}) supera disponible (${invItem.cantidad_hojas}) para "${prod.codigo}".`);
          return;
        }
      }
    }

    try {
      const costosPorLinea = calcularCostosPorLinea();
      const totalConsumo = consumosItems.reduce((sum, c) => sum + (c.costo_total || 0), 0);
      const totalManoObra = manoObraItems.reduce((sum, m) => sum + (m.total || 0), 0);
      const costoTotalProceso = totalConsumo + totalManoObra;
      const totalHojas = parseFloat(currentItem.total_hojas_enviadas_pintura) || 0;
      const costoPromedioPorHoja = totalHojas > 0 ? costoTotalProceso / totalHojas : 0;

      const lineasConRendimiento = lineasProduccion.map(l => ({
        ...l,
        hojas_buenas: parseFloat(l.hojas_buenas) || Math.max(0, (parseFloat(l.cantidad_hojas) || 0) - (parseFloat(l.hojas_danadas) || 0)),
        hojas_danadas: parseFloat(l.hojas_danadas) || 0
      }));

      const dataToSave = {
        ...currentItem,
        numero_proceso: currentItem.numero_proceso || currentItem.id_consecutivo,
        fecha_inicio: currentItem.fecha_inicio || new Date().toISOString().split('T')[0],
        hojas_pendientes_pintar: (currentItem.total_hojas_enviadas_pintura || 0) - (currentItem.hojas_pintadas_recibidas || 0),
        lineas_produccion: lineasConRendimiento,
        consumos: consumosItems,
        mano_obra_pintura: manoObraItems,
        productos_produccion: productosProduccion,
        origen_hojas: origenHojas,
        costos_por_linea: costosPorLinea,
        total_consumo_productos: totalConsumo,
        total_mano_obra: totalManoObra,
        costo_total_proceso_pintura: costoTotalProceso,
        costo_promedio_por_hoja: costoPromedioPorHoja
      };

      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        await ProcesoProduccion.create(dataToSave);

        const fechaHoy = new Date().toISOString().split('T')[0];

        // Descontar insumos de consumos
        for (const consumo of consumosItems) {
          const insumo = insumosQuimicos.find(i => i.id === consumo.insumo_id);
          if (insumo) {
            await Insumo.update(insumo.id, { stock_actual: (insumo.stock_actual || 0) - consumo.cantidad_consumida });
            await MovimientoInventario.create({
              tipo_movimiento: 'salida', insumo_id: insumo.id, cantidad: -consumo.cantidad_consumida,
              costo_unitario: consumo.costo_unitario || 0, fecha_movimiento: fechaHoy,
              referencia: currentItem.id_consecutivo || 'PINTURA',
              observaciones: `Pintura ${currentItem.id_consecutivo}. Producto: ${consumo.nombre_producto}`
            });
          }
        }

        // Descontar productos de producción
        for (const prod of productosProduccion) {
          const cantidadUsada = parseFloat(prod.cantidad_hojas) || 0;
          if (!cantidadUsada || !prod.item_id) continue;
          const origen = prod.origen_inventario;

          if (origen === 'en_proceso' && prod.inv_proceso_id) {
            const invItem = inventarioEnProceso.find(i => i.id === prod.inv_proceso_id);
            if (invItem) {
              const nuevaCantidad = (invItem.cantidad_hojas || 0) - cantidadUsada;
              await InventarioEnProceso.update(invItem.id, { cantidad_hojas: Math.max(0, nuevaCantidad), estado_actual: nuevaCantidad <= 0 ? 'TERMINADO' : 'EN_PROCESO' });
            }
          } else if (origen === 'terminado') {
            const ptItem = productosTerminados.find(i => i.id === prod.item_id);
            if (ptItem) {
              const movsProd = await MovimientoInventario.filter({ insumo_id: ptItem.id });
              const stockReal = movsProd.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
              await MovimientoInventario.create({
                tipo_movimiento: 'salida', insumo_id: ptItem.id, cantidad: -cantidadUsada,
                costo_unitario: ptItem.costo_promedio || 0, fecha_movimiento: fechaHoy,
                referencia: currentItem.id_consecutivo || 'PINTURA',
                observaciones: `Pintura ${currentItem.id_consecutivo}. Producto: ${prod.descripcion || prod.codigo}`
              });
              await ProductoTerminado.update(ptItem.id, { stock_actual: Math.max(0, stockReal - cantidadUsada) });
            }
          } else if (origen === 'insumo') {
            const insumoItem = insumosQuimicos.find(i => i.id === prod.item_id);
            if (insumoItem) {
              await Insumo.update(insumoItem.id, { stock_actual: Math.max(0, (insumoItem.stock_actual || 0) - cantidadUsada) });
              await MovimientoInventario.create({
                tipo_movimiento: 'salida', insumo_id: insumoItem.id, cantidad: -cantidadUsada,
                costo_unitario: insumoItem.costo_promedio || 0, fecha_movimiento: fechaHoy,
                referencia: currentItem.id_consecutivo || 'PINTURA',
                observaciones: `Pintura ${currentItem.id_consecutivo}. Producto: ${prod.descripcion || prod.codigo}`
              });
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

  // ── ENTREGAS ──────────────────────────────────────────────────────────────
  const handleOpenEntregas = (item) => { setSelectedItem(item); setEntregasParciales(item.entregas_parciales || []); setShowEntregasModal(true); };
  const agregarEntrega = () => setEntregasParciales([...entregasParciales, { fecha_entrega: new Date().toISOString().split('T')[0], cantidad_hojas_pintadas: 0, observaciones: '', confirmado: false }]);
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
    if (entrega.cantidad_hojas_pintadas > pendiente) { alert(`Error: No puede registrar más de ${pendiente} hojas pendientes.`); return; }
    const updated = [...entregasParciales];
    updated[index].confirmado = true;
    const nuevasRecibidas = totalRecibido + entrega.cantidad_hojas_pintadas;
    const nuevasPendientes = totalEnviado - nuevasRecibidas;
    const nuevoEstado = nuevasPendientes === 0 ? 'terminado' : (nuevasRecibidas > 0 ? 'parcial' : 'pendiente');
    try {
      await ProcesoProduccion.update(selectedItem.id, { entregas_parciales: updated, hojas_pintadas_recibidas: nuevasRecibidas, hojas_pendientes_pintar: nuevasPendientes, estado_pedido_pintura: nuevoEstado });
      await ProductoTerminado.create({ codigo: `PT-${selectedItem.numero_pedido}-${Date.now()}`, descripcion: `Cuero pintado - Pedido ${selectedItem.numero_pedido}`, cantidad: entrega.cantidad_hojas_pintadas, unidad_medida: 'HOJA', pedido_id: selectedItem.pedido_id, proceso_origen_id: selectedItem.id, fecha_ingreso: entrega.fecha_entrega, estado: 'disponible' });
      alert('Entrega confirmada y registrada en inventario.');
      setShowEntregasModal(false);
      loadData();
    } catch (error) { console.error('Error:', error); alert('Error al confirmar entrega.'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proceso de pintura?')) return;
    try { await ProcesoProduccion.delete(id); loadData(); alert('Proceso eliminado.'); } catch (error) { console.error('Error deleting:', error); }
  };

  const costosPorLineaCalc = currentItem ? calcularCostosPorLinea() : [];

  // ── TABLA PRINCIPAL ───────────────────────────────────────────────────────
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
        <span className={`px-2 py-1 rounded text-xs font-medium ${item.estado_pedido_pintura === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : item.estado_pedido_pintura === 'parcial' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
          {item.estado_pedido_pintura?.toUpperCase() || 'PENDIENTE'}
        </span>
      </td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenEntregas(item)} title="Entregas Parciales"><TableIcon className="w-4 h-4 text-purple-600" /></Button>
          <Button variant="outline" size="sm" onClick={() => { setSelectedItem(item); setShowDetailModal(true); }} title="Ver Detalle"><Eye className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)} title="Editar"><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader title="Pintura" description="Gestiona los procesos de pintura del cuero." onPrint={() => window.print()}
        actionButton={<Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" />Nueva Pintura</Button>}
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Procesos de Pintura</CardTitle></CardHeader>
        <CardContent>{loading ? <p>Cargando...</p> : <DataTable headers={headers} data={procesos} renderRow={renderRow} />}</CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL PRINCIPAL: NUEVA / EDITAR PINTURA
      ══════════════════════════════════════════════════════════════════════ */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Pintura {esFinalizado && <span className="text-red-500 text-sm ml-2">(FINALIZADO - Solo lectura)</span>}</DialogTitle>
          </DialogHeader>
          {currentItem && (
          <form onSubmit={handleSave} className="space-y-5">

            {/* ── Encabezado básico ─────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ID/Consecutivo</Label>
                <Input value={currentItem.id_consecutivo || ''} readOnly className="bg-gray-100 font-mono font-bold" />
              </div>
              <div>
                <Label>Fecha de Entrega al Pintor *</Label>
                <Input type="date" value={currentItem.fecha_entrega_pintor || ''} disabled={esFinalizado} onChange={e => setCurrentItem({...currentItem, fecha_entrega_pintor: e.target.value})} required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha de Inicio Pintura *</Label>
                <Input type="date" value={currentItem.fecha_inicio_pintura || ''} disabled={esFinalizado} onChange={e => setCurrentItem({...currentItem, fecha_inicio_pintura: e.target.value})} required />
              </div>
              <div>
                <Label>Pintor/Responsable</Label>
                <Input value={currentItem?.pintor_responsable || ''} disabled={esFinalizado} onChange={e => setCurrentItem({...currentItem, pintor_responsable: e.target.value})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>No. ID del Pedido</Label>
                <Select value={currentItem?.pedido_id || ''} disabled={esFinalizado} onValueChange={v => {
                  const pedido = pedidos.find(p => p.id === v);
                  setCurrentItem({...currentItem, pedido_id: v, numero_pedido: pedido?.numero_pedido || ''});
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar pedido" /></SelectTrigger>
                  <SelectContent>{pedidos.map(p => <SelectItem key={p.id} value={p.id}>{p.numero_pedido} - {p.nombre_marroquinero}</SelectItem>)}</SelectContent>
                </Select>
              </div>
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
            </div>

            {/* ── DETALLE DE PRODUCCIÓN EN PINTURA ──────────────────────── */}
            <div className="border rounded-lg p-4 bg-indigo-50 border-indigo-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-indigo-800 uppercase">Detalle de Producción en Pintura</h3>
                {!esFinalizado && (
                  <Button type="button" size="sm" variant="outline" onClick={agregarLineaProduccion}>
                    <Plus className="w-3 h-3 mr-1" /> Agregar Línea
                  </Button>
                )}
              </div>
              {lineasProduccion.length === 0 && <p className="text-xs text-indigo-500 italic">Agregue líneas de producción para calcular los totales automáticamente.</p>}
              {lineasProduccion.length > 0 && (
                <table className="w-full text-xs mb-2">
                  <thead>
                    <tr className="bg-indigo-100">
                      <th className="border p-2 text-left">LÍNEA DE PRODUCCIÓN *</th>
                      <th className="border p-2 text-left">COLOR</th>
                      <th className="border p-2 text-right">CANTIDAD HOJAS *</th>
                      <th className="border p-2 text-right">HOJAS DAÑADAS</th>
                      <th className="border p-2 text-right">HOJAS BUENAS</th>
                      <th className="border p-2 text-right">% RENDIM.</th>
                      <th className="border p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineasProduccion.map((linea, idx) => {
                      const cantHojas = parseFloat(linea.cantidad_hojas) || 0;
                      const danadas = parseFloat(linea.hojas_danadas) || 0;
                      const buenas = Math.max(0, cantHojas - danadas);
                      const rendimiento = cantHojas > 0 ? ((buenas / cantHojas) * 100).toFixed(1) : '0.0';
                      return (
                        <tr key={idx} className="border-t">
                          <td className="border p-1 min-w-[200px]">
                            <Select value={linea.linea_id || ''} disabled={esFinalizado} onValueChange={v => handleLineaChange(idx, 'linea_id', v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                              <SelectContent>
                                {catalogoProductos.map(p => (
                                  <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nombre_comercial || p.descripcion}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {linea.nombre_linea && <div className="text-xs text-indigo-500 mt-0.5 truncate">{linea.nombre_linea}</div>}
                          </td>
                          <td className="border p-1">
                            <Input value={linea.color || ''} disabled={esFinalizado} onChange={e => handleLineaChange(idx, 'color', e.target.value)} className="h-7 text-xs" placeholder="Ej: Negro" />
                          </td>
                          <td className="border p-1">
                            <Input type="number" value={linea.cantidad_hojas} min="0" step="1" disabled={esFinalizado} onChange={e => handleLineaChange(idx, 'cantidad_hojas', e.target.value)} className="h-7 text-xs text-right" />
                          </td>
                          <td className="border p-1">
                            <Input type="number" value={linea.hojas_danadas || 0} min="0" max={cantHojas} step="1" disabled={esFinalizado}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val > cantHojas) { alert('Hojas dañadas no puede superar cantidad de hojas.'); return; }
                                const updated = [...lineasProduccion]; updated[idx].hojas_danadas = val; updated[idx].hojas_buenas = Math.max(0, cantHojas - val);
                                setLineasProduccion(updated);
                              }}
                              className="h-7 text-xs text-right bg-red-50"
                            />
                          </td>
                          <td className="border p-1">
                            <Input type="number" value={buenas} readOnly className="h-7 text-xs text-right bg-green-50 font-bold text-green-700" />
                          </td>
                          <td className="border p-1">
                            <div className="flex items-center gap-1">
                              <Input value={rendimiento} readOnly className="h-7 text-xs text-right bg-blue-50 font-bold text-blue-700" />
                              <span className="text-xs text-blue-600 font-bold">%</span>
                            </div>
                          </td>
                          <td className="border p-1 text-center">
                            {!esFinalizado && (
                              <Button type="button" variant="ghost" size="sm" onClick={() => eliminarLineaProduccion(idx)}>
                                <X className="w-3 h-3 text-red-500" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-indigo-100 font-bold text-xs">
                      <td colSpan={2} className="border p-2 text-right">TOTAL HOJAS (Auto):</td>
                      <td className="border p-2 text-right text-indigo-800">{totalHojasDeLineas}</td>
                      <td colSpan={4} className="border p-2"></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            {/* ── TOTAL HOJAS (auto-calculado, después de líneas) ─────────── */}
            <div className="grid grid-cols-3 gap-4 bg-blue-50 p-3 rounded border border-blue-200">
              <div>
                <Label className="text-blue-700 font-bold">Total Hojas Enviadas a Pintura</Label>
                <Input type="number" value={currentItem.total_hojas_enviadas_pintura || 0} readOnly className="bg-white font-bold text-blue-800 border-blue-300" />
                <p className="text-xs text-blue-500 mt-1">Se calcula automáticamente desde las líneas de producción</p>
              </div>
              <div>
                <Label>Hojas Pintadas Recibidas</Label>
                <Input type="number" value={currentItem.hojas_pintadas_recibidas || 0} disabled={esFinalizado} onChange={e => {
                  const recibidas = parseFloat(e.target.value) || 0;
                  setCurrentItem({...currentItem, hojas_pintadas_recibidas: recibidas, hojas_pendientes_pintar: (currentItem.total_hojas_enviadas_pintura || 0) - recibidas});
                }} className="bg-white font-bold" />
              </div>
              <div>
                <Label>Hojas Pendientes por Pintar</Label>
                <Input type="number" value={currentItem.hojas_pendientes_pintar || 0} readOnly className="bg-orange-50 font-bold text-orange-700" />
              </div>
            </div>

            {/* ── ORIGEN DE HOJAS ────────────────────────────────────────── */}
            <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-sm text-amber-800">ORIGEN DE HOJAS</h3>
                {!esFinalizado && (
                  <Button type="button" size="sm" variant="outline" onClick={() => setOrigenHojas([...origenHojas, { bodega: '', cantidad_hojas: 0 }])}>
                    <Plus className="w-3 h-3 mr-1" /> Agregar Bodega
                  </Button>
                )}
              </div>
              {origenHojas.length === 0 && <p className="text-xs text-amber-600 italic">Registre el origen de las hojas por bodega.</p>}
              {origenHojas.length > 0 && (
                <table className="w-full text-xs mb-2">
                  <thead><tr className="bg-amber-100"><th className="border p-2 text-left">BODEGA</th><th className="border p-2 text-right">CANTIDAD DE HOJAS</th><th className="border p-2 w-10"></th></tr></thead>
                  <tbody>
                    {origenHojas.map((origen, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="border p-1">
                          <Select value={origen.bodega} disabled={esFinalizado} onValueChange={v => { const updated = [...origenHojas]; updated[idx].bodega = v; setOrigenHojas(updated); }}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Seleccionar bodega..." /></SelectTrigger>
                            <SelectContent><SelectItem value="BODEGA 1">BODEGA 1</SelectItem><SelectItem value="BODEGA 2">BODEGA 2</SelectItem></SelectContent>
                          </Select>
                        </td>
                        <td className="border p-1">
                          <Input type="number" value={origen.cantidad_hojas} min="0" step="1" disabled={esFinalizado}
                            onChange={e => { const updated = [...origenHojas]; updated[idx].cantidad_hojas = parseFloat(e.target.value) || 0; setOrigenHojas(updated); }}
                            className="h-7 text-xs text-right"
                          />
                        </td>
                        <td className="border p-1 text-center">
                          {!esFinalizado && <Button type="button" variant="ghost" size="sm" onClick={() => setOrigenHojas(origenHojas.filter((_, i) => i !== idx))}><X className="w-3 h-3 text-red-500" /></Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── ÍTEM DE PRODUCTOS DE PRODUCCIÓN ───────────────────────── */}
            <div className="border-t pt-4 mt-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Ítem de Productos de Producción</h3>
                {!esFinalizado && <Button type="button" onClick={agregarProductoProduccion} size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" />Agregar</Button>}
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-purple-50">
                    <tr>
                      <th className="border p-2">LÍNEA DE PRODUCCIÓN *</th>
                      <th className="border p-2">CÓDIGO</th>
                      <th className="border p-2">DESCRIPCIÓN</th>
                      <th className="border p-2 text-right">CANTIDAD HOJAS</th>
                      <th className="border p-2 w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {productosProduccion.length === 0 && <tr><td colSpan={5} className="p-3 text-center text-gray-400 text-sm">No hay productos agregados.</td></tr>}
                    {productosProduccion.map((prod, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="border p-2 min-w-[180px]">
                          <Select value={String(prod.linea_produccion_idx ?? '')} disabled={esFinalizado} onValueChange={v => handleProductoProduccionChange(idx, 'linea_produccion_idx', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar línea *" /></SelectTrigger>
                            <SelectContent>
                              {lineasProduccion.map((l, li) => (
                                <SelectItem key={li} value={String(li)}>{l.nombre_linea || `Línea ${li + 1}`}{l.color ? ` - ${l.color}` : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border p-2 min-w-[180px]">
                          <Select value={prod.item_id || ''} disabled={esFinalizado} onValueChange={v => handleProductoProduccionChange(idx, 'item_id', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar código..." /></SelectTrigger>
                            <SelectContent>{catalogoCombinado.map(item => <SelectItem key={item.id} value={item.id}>{item.codigo} - {item.descripcion}</SelectItem>)}</SelectContent>
                          </Select>
                          {prod.codigo && <div className="text-xs text-gray-400 mt-0.5">{prod.codigo}</div>}
                        </td>
                        <td className="border p-2"><Input value={prod.descripcion || ''} readOnly className="bg-gray-50 h-8 text-xs" /></td>
                        <td className="border p-2">
                          <Input type="number" value={prod.cantidad_hojas} min="0" max={prod.cantidad_disponible} disabled={esFinalizado}
                            onChange={e => handleProductoProduccionChange(idx, 'cantidad_hojas', e.target.value)} className="h-8 text-xs text-right" />
                          {prod.cantidad_disponible > 0 && <div className="text-gray-400 text-xs mt-1 text-right">Disp: {prod.cantidad_disponible}</div>}
                        </td>
                        <td className="border p-2 text-center">
                          {!esFinalizado && <Button type="button" variant="ghost" size="sm" onClick={() => eliminarProductoProduccion(idx)}><X className="w-4 h-4 text-red-500" /></Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── ITEMS DE CONSUMO ───────────────────────────────────────── */}
            <div className="border-t pt-4 mt-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Items de Consumo de Productos</h3>
                {!esFinalizado && <Button type="button" onClick={agregarConsumo} size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" />Agregar Producto</Button>}
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2">LÍNEA DE PROD. *</th>
                      <th className="border p-2">CÓDIGO PRODUCTO</th>
                      <th className="border p-2">DESCRIPCIÓN</th>
                      <th className="border p-2">U.M.</th>
                      <th className="border p-2">CANT.</th>
                      <th className="border p-2 min-w-[110px]">COSTO UNIT.</th>
                      <th className="border p-2 min-w-[110px]">COSTO TOTAL</th>
                      <th className="border p-2">OBS.</th>
                      <th className="border p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumosItems.length === 0 && <tr><td colSpan={9} className="p-3 text-center text-gray-400 text-sm">No hay consumos agregados.</td></tr>}
                    {consumosItems.map((consumo, idx) => {
                      const catalogoRef = catalogoCombinado.find(i => i.id === consumo.item_id);
                      const stockBajo = catalogoRef && (catalogoRef.stock_actual || 0) <= (catalogoRef.stock_minimo || 0);
                      return (
                        <tr key={idx} className="border-t">
                          <td className="border p-1 min-w-[160px]">
                            <Select value={String(consumo.linea_produccion_idx ?? '')} disabled={esFinalizado} onValueChange={v => handleConsumoChange(idx, 'linea_produccion_idx', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Línea *" /></SelectTrigger>
                              <SelectContent>
                                {lineasProduccion.map((l, li) => (
                                  <SelectItem key={li} value={String(li)}>{l.nombre_linea || `Línea ${li + 1}`}{l.color ? ` - ${l.color}` : ''}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="border p-1 min-w-[180px]">
                            <Select value={consumo.item_id || ''} disabled={esFinalizado} onValueChange={v => handleConsumoChange(idx, 'item_id', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                              <SelectContent>{catalogoCombinado.map(i => <SelectItem key={i.id} value={i.id}>{i.codigo} - {i.descripcion}</SelectItem>)}</SelectContent>
                            </Select>
                            {consumo.item_id && <div className={`text-xs mt-0.5 ${stockBajo ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>Stock: {catalogoRef?.stock_actual || 0}{stockBajo && ' ⚠️'}</div>}
                          </td>
                          <td className="border p-1 min-w-[140px]"><Input value={consumo.nombre_producto || ''} readOnly className="bg-gray-50 h-8 text-xs" /></td>
                          <td className="border p-1"><Input value={consumo.unidad_medida || ''} readOnly className="bg-gray-50 h-8 text-xs" /></td>
                          <td className="border p-1 w-20"><Input type="number" value={consumo.cantidad_consumida} min="0.01" step="0.01" disabled={esFinalizado} onChange={e => handleConsumoChange(idx, 'cantidad_consumida', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" /></td>
                          <td className="border p-1 min-w-[110px]"><Input type="number" value={consumo.costo_unitario || 0} min="0" step="1" disabled={esFinalizado} onChange={e => handleConsumoChange(idx, 'costo_unitario', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" /></td>
                          <td className="border p-1 min-w-[110px]"><Input type="number" value={consumo.costo_total || 0} readOnly className="h-8 text-xs text-right bg-blue-50 font-bold" /></td>
                          <td className="border p-1 min-w-[100px]"><Input value={consumo.observacion || ''} disabled={esFinalizado} onChange={e => handleConsumoChange(idx, 'observacion', e.target.value)} className="h-8 text-xs" placeholder="Opcional" /></td>
                          <td className="border p-1 text-center">{!esFinalizado && <Button type="button" variant="ghost" size="sm" onClick={() => eliminarConsumo(idx)}><X className="w-4 h-4 text-red-500" /></Button>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 p-2 bg-blue-50 rounded flex justify-end">
                <span className="text-sm font-semibold mr-2">TOTAL CONSUMO:</span>
                <span className="text-sm font-bold text-blue-700">{formatCurrency(consumosItems.reduce((sum, c) => sum + (c.costo_total || 0), 0))}</span>
              </div>
            </div>

            {/* ── MANO DE OBRA ───────────────────────────────────────────── */}
            <div className="border-t pt-4 mt-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Mano de Obra de Pintura</h3>
                {!esFinalizado && <Button type="button" onClick={agregarManoObra} size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" />Agregar</Button>}
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2">LÍNEA DE PROD. *</th>
                      <th className="border p-2">TIPO TERMINADO</th>
                      <th className="border p-2">DETALLE</th>
                      <th className="border p-2">CANT. HOJAS</th>
                      <th className="border p-2">VALOR/HOJA</th>
                      <th className="border p-2">TOTAL</th>
                      <th className="border p-2">OBS.</th>
                      <th className="border p-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manoObraItems.length === 0 && <tr><td colSpan={8} className="p-3 text-center text-gray-400 text-sm">No hay mano de obra agregada.</td></tr>}
                    {manoObraItems.map((mano, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="border p-1 min-w-[160px]">
                          <Select value={String(mano.linea_produccion_idx ?? '')} disabled={esFinalizado} onValueChange={v => handleManoObraChange(idx, 'linea_produccion_idx', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Línea *" /></SelectTrigger>
                            <SelectContent>
                              {lineasProduccion.map((l, li) => (
                                <SelectItem key={li} value={String(li)}>{l.nombre_linea || `Línea ${li + 1}`}{l.color ? ` - ${l.color}` : ''}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border p-1">
                          <Select value={mano.tipo_terminado} disabled={esFinalizado} onValueChange={v => handleManoObraChange(idx, 'tipo_terminado', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo *" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="napa">Napa</SelectItem><SelectItem value="napa_mate">Napa Mate</SelectItem>
                              <SelectItem value="opaco">Opaco</SelectItem><SelectItem value="envejecido">Envejecido</SelectItem>
                              <SelectItem value="grabado">Grabado</SelectItem><SelectItem value="liso">Liso</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border p-1"><Input value={mano.detalle} disabled={esFinalizado} onChange={e => handleManoObraChange(idx, 'detalle', e.target.value)} className="h-8 text-xs" placeholder="Detalle" /></td>
                        <td className="border p-1 w-20"><Input type="number" value={mano.cantidad_hojas} min="0" step="1" disabled={esFinalizado} onChange={e => handleManoObraChange(idx, 'cantidad_hojas', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" /></td>
                        <td className="border p-1 w-24"><Input type="number" value={mano.valor_por_hoja} min="0" step="100" disabled={esFinalizado} onChange={e => handleManoObraChange(idx, 'valor_por_hoja', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" /></td>
                        <td className="border p-1 w-24"><Input type="number" value={mano.total} readOnly className="h-8 text-xs text-right bg-blue-50 font-bold" /></td>
                        <td className="border p-1 min-w-[100px]"><Input value={mano.observacion} disabled={esFinalizado} onChange={e => handleManoObraChange(idx, 'observacion', e.target.value)} className="h-8 text-xs" /></td>
                        <td className="border p-1 text-center">{!esFinalizado && <Button type="button" variant="ghost" size="sm" onClick={() => eliminarManoObra(idx)}><X className="w-4 h-4 text-red-500" /></Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 p-2 bg-green-50 rounded flex justify-end">
                <span className="text-sm font-semibold mr-2">TOTAL MANO DE OBRA:</span>
                <span className="text-sm font-bold text-green-700">{formatCurrency(manoObraItems.reduce((sum, m) => sum + (m.total || 0), 0))}</span>
              </div>
            </div>

            {/* ── RESUMEN AUTOMÁTICO POR LÍNEA ───────────────────────────── */}
            {lineasProduccion.length > 0 && (
              <div className="border-t pt-4 mt-2">
                <h3 className="font-bold text-lg mb-3">Resumen por Línea de Producción</h3>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="border p-2">LÍNEA / TIPO CUERO</th>
                        <th className="border p-2">COLOR</th>
                        <th className="border p-2 text-right">CANT. HOJAS</th>
                        <th className="border p-2 text-right">COSTO PRODUCTOS</th>
                        <th className="border p-2 text-right">COSTO MANO OBRA</th>
                        <th className="border p-2 text-right">COSTO TOTAL</th>
                        <th className="border p-2 text-right">COSTO/HOJA</th>
                        <th className="border p-2 text-right">HOJAS BUENAS</th>
                        <th className="border p-2 text-right">HOJAS DAÑADAS</th>
                        <th className="border p-2 text-right">% RENDIM.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costosPorLineaCalc.map((linea, idx) => (
                        <tr key={idx} className={`border-t ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                          <td className="border p-2 font-semibold">{linea.nombre_linea || `Línea ${idx + 1}`}</td>
                          <td className="border p-2">{linea.color || '-'}</td>
                          <td className="border p-2 text-right font-bold">{linea.cantidad_hojas}</td>
                          <td className="border p-2 text-right text-blue-700">{formatCurrency(linea.costoProductos)}</td>
                          <td className="border p-2 text-right text-green-700">{formatCurrency(linea.costoManoObra)}</td>
                          <td className="border p-2 text-right font-bold text-purple-700">{formatCurrency(linea.costoTotal)}</td>
                          <td className="border p-2 text-right text-orange-700">{formatCurrency(linea.costoPorHoja)}</td>
                          <td className="border p-2 text-right text-green-700 font-bold">{linea.hojas_buenas}</td>
                          <td className="border p-2 text-right text-red-600">{linea.hojas_danadas}</td>
                          <td className="border p-2 text-right font-bold">
                            <span className={`px-2 py-0.5 rounded ${linea.rendimiento >= 90 ? 'bg-green-100 text-green-700' : linea.rendimiento >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                              {linea.rendimiento.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-200 font-bold text-xs">
                      <tr>
                        <td className="border p-2" colSpan={2}>TOTALES</td>
                        <td className="border p-2 text-right">{costosPorLineaCalc.reduce((s, l) => s + (parseFloat(l.cantidad_hojas) || 0), 0)}</td>
                        <td className="border p-2 text-right text-blue-700">{formatCurrency(costosPorLineaCalc.reduce((s, l) => s + l.costoProductos, 0))}</td>
                        <td className="border p-2 text-right text-green-700">{formatCurrency(costosPorLineaCalc.reduce((s, l) => s + l.costoManoObra, 0))}</td>
                        <td className="border p-2 text-right text-purple-700">{formatCurrency(costosPorLineaCalc.reduce((s, l) => s + l.costoTotal, 0))}</td>
                        <td className="border p-2"></td>
                        <td className="border p-2 text-right text-green-700">{costosPorLineaCalc.reduce((s, l) => s + l.hojas_buenas, 0)}</td>
                        <td className="border p-2 text-right text-red-600">{costosPorLineaCalc.reduce((s, l) => s + l.hojas_danadas, 0)}</td>
                        <td className="border p-2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* ── OBSERVACIONES ──────────────────────────────────────────── */}
            <div>
              <Label>Observaciones</Label>
              <Textarea value={currentItem.observaciones || ''} disabled={esFinalizado} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={3} />
            </div>

            {/* ── FINALIZAR ─────────────────────────────────────────────── */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <input type="checkbox" id="finalizar_pintura" checked={currentItem?.finalizar_pintura || false}
                  onChange={e => setCurrentItem({...currentItem, finalizar_pintura: e.target.checked})}
                  className="w-5 h-5 accent-emerald-600 cursor-pointer"
                />
                <label htmlFor="finalizar_pintura" className="font-semibold text-emerald-800 cursor-pointer">Finalizar Pintura</label>
                <span className="text-sm text-emerald-600">(Al finalizar no se podrá editar)</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              {!esFinalizado && <Button type="submit">Guardar</Button>}
            </div>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL ENTREGAS PARCIALES ───────────────────────────────────────── */}
      <Dialog open={showEntregasModal} onOpenChange={setShowEntregasModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Control de Entregas Parciales{selectedItem?.id_consecutivo ? ` - ${selectedItem.id_consecutivo}` : ''}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded grid grid-cols-3 gap-4 text-sm">
              <div><span className="font-semibold">Total Enviadas:</span> {selectedItem?.total_hojas_enviadas_pintura || 0} hojas</div>
              <div><span className="font-semibold text-green-600">Recibidas:</span> {selectedItem?.hojas_pintadas_recibidas || 0} hojas</div>
              <div><span className="font-semibold text-orange-600">Pendientes:</span> {selectedItem?.hojas_pendientes_pintar || 0} hojas</div>
            </div>
            <div className="flex justify-end"><Button onClick={agregarEntrega} size="sm"><Plus className="w-4 h-4 mr-2" />Agregar Entrega</Button></div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr><th className="p-2 text-left">Fecha Entrega</th><th className="p-2 text-right">Hojas Pintadas</th><th className="p-2 text-left">Observaciones</th><th className="p-2 text-center">Estado</th><th className="p-2"></th></tr>
                </thead>
                <tbody>
                  {entregasParciales.map((entrega, idx) => (
                    <tr key={idx} className={`border-t ${entrega.confirmado ? 'bg-green-50' : ''}`}>
                      <td className="p-2"><Input type="date" value={entrega.fecha_entrega} onChange={e => handleEntregaChange(idx, 'fecha_entrega', e.target.value)} disabled={entrega.confirmado} className="h-8 text-sm" /></td>
                      <td className="p-2"><Input type="number" value={entrega.cantidad_hojas_pintadas} onChange={e => handleEntregaChange(idx, 'cantidad_hojas_pintadas', e.target.value)} disabled={entrega.confirmado} className="h-8 text-sm text-right" /></td>
                      <td className="p-2"><Input value={entrega.observaciones} onChange={e => handleEntregaChange(idx, 'observaciones', e.target.value)} disabled={entrega.confirmado} className="h-8 text-sm" /></td>
                      <td className="p-2 text-center">{entrega.confirmado ? <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">CONFIRMADO</span> : <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs">PENDIENTE</span>}</td>
                      <td className="p-2 text-center">{!entrega.confirmado && <div className="flex gap-1 justify-center"><Button size="sm" onClick={() => confirmarEntrega(idx)}>Confirmar</Button><Button size="sm" variant="ghost" onClick={() => setEntregasParciales(entregasParciales.filter((_, i) => i !== idx))}><X className="w-3 h-3 text-red-500" /></Button></div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t"><Button variant="outline" onClick={() => setShowEntregasModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DETALLE ──────────────────────────────────────────────────── */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalle de Pintura</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">ID:</span> <span className="font-mono">{selectedItem.id_consecutivo || 'N/A'}</span></p>
              <p><span className="font-semibold">Fecha Entrega Pintor:</span> {formatDate(selectedItem.fecha_entrega_pintor)}</p>
              <p><span className="font-semibold">Fecha Inicio Pintura:</span> {formatDate(selectedItem.fecha_inicio_pintura)}</p>
              <p><span className="font-semibold">Pintor:</span> {selectedItem.pintor_responsable || 'N/A'}</p>
              <p><span className="font-semibold">Pedido:</span> <span className="font-mono">{selectedItem.numero_pedido || 'N/A'}</span></p>
              <p><span className="font-semibold">Total Enviadas:</span> {selectedItem.total_hojas_enviadas_pintura} hojas</p>
              <p><span className="font-semibold">Hojas Pintadas:</span> {selectedItem.hojas_pintadas_recibidas} hojas</p>
              <p><span className="font-semibold">Pendientes:</span> {selectedItem.hojas_pendientes_pintar} hojas</p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize font-bold">{selectedItem.estado_pedido_pintura}</span></p>
              {selectedItem.lineas_produccion?.length > 0 && (
                <div>
                  <p className="font-semibold mb-1">Líneas de Producción:</p>
                  <table className="w-full text-xs border">
                    <thead className="bg-gray-100"><tr><th className="border p-1">Línea</th><th className="border p-1">Color</th><th className="border p-1 text-right">Hojas</th></tr></thead>
                    <tbody>
                      {selectedItem.lineas_produccion.map((l, i) => <tr key={i} className="border-t"><td className="border p-1">{l.nombre_linea || `Línea ${i+1}`}</td><td className="border p-1">{l.color || '-'}</td><td className="border p-1 text-right">{l.cantidad_hojas}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}