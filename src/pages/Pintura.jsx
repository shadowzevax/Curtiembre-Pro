import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, InventarioEnProceso, ProductoTerminado, MovimientoInventario, ColorPintura } from '@/entities/all';
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

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : 'N/A';

const TIPOS_ACABADO = [
  { value: 'NAPA', label: 'NAPA' },
  { value: 'OTROS', label: 'OTROS ACABADOS (NAPA MATE, OPACO-ENVEJECIDO)' }
];

const TIPOS_CUERO = [
  { value: 'PELO', label: 'PELO' },
  { value: 'CROSTA', label: 'CROSTA' },
  { value: 'LIJADO', label: 'LIJADO' }
];

export default function Pintura() {
  const [procesos, setProcesos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [insumosQuimicos, setInsumosQuimicos] = useState([]);
  const [productosTerminados, setProductosTerminados] = useState([]);
  const [coloresCatalogo, setColoresCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEntregasModal, setShowEntregasModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [entregasParciales, setEntregasParciales] = useState([]);
  const [consumoCueroItems, setConsumoCueroItems] = useState([]);
  const [consumosItems, setConsumosItems] = useState([]);
  const [manoObraItems, setManoObraItems] = useState([]);
  const [stockPanelIdx, setStockPanelIdx] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, inventarioData, productosTermData, coloresData] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'pintura' }),
        Insumo.list(),
        InventarioEnProceso.list(),
        ProductoTerminado.list(),
        ColorPintura.list()
      ]);
      setProcesos(procesosData);
      setInsumosQuimicos(insumosData);
      setInventarioEnProceso(inventarioData);
      setProductosTerminados(productosTermData);
      setColoresCatalogo(Array.isArray(coloresData) ? coloresData.filter(c => c.estado === 'activo') : []);
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
        numero_proceso: idConsecutivo,
        id_consecutivo: idConsecutivo,
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_inicio_pintura: new Date().toISOString().split('T')[0],
        fecha_entrega_pintor: new Date().toISOString().split('T')[0],
        pintor_responsable: '',
        estado_pedido_pintura: 'pendiente',
        total_hojas_enviadas_pintura: 0,
        hojas_pintadas_recibidas: 0,
        hojas_pendientes_pintar: 0,
        observaciones: '',
        entregas_parciales: [],
        finalizar_pintura: false
      });
      setConsumoCueroItems([]);
      setConsumosItems([]);
      setManoObraItems([]);
    } else {
      setCurrentItem(item);
      setConsumoCueroItems(item.consumo_cuero_items || []);
      setConsumosItems(item.consumos || []);
      setManoObraItems(item.mano_obra_pintura || []);
    }
    setShowModal(true);
  };

  const esFinalizado = currentItem?.estado_pedido_pintura === 'terminado' || currentItem?.finalizar_pintura;
  const totalHojasDeCuero = consumoCueroItems.reduce((sum, l) => sum + (parseFloat(l.cantidad_hojas) || 0), 0);

  // ── ITEMS CONSUMO DE CUERO ────────────────────────────────────────────────
  const agregarConsumoCuero = () => {
    if (esFinalizado) return;
    const nuevoItem = {
      item_num: consumoCueroItems.length + 1,
      item_id: '', codigo: '', descripcion: '', tipo_cuero: '', tipo_acabado: '', color_final: '',
      cantidad_hojas: 0, merma_produccion: 0, hojas_buenas: 0, costo_promedio: 0, costo_total_cuero: 0,
      origen_proceso: '', estado_item: 'pendiente'
    };
    const updated = [...consumoCueroItems, nuevoItem];
    setConsumoCueroItems(updated);
    const nuevoTotal = updated.reduce((sum, l) => sum + (parseFloat(l.cantidad_hojas) || 0), 0);
    setCurrentItem(prev => ({ ...prev, total_hojas_enviadas_pintura: nuevoTotal, hojas_pendientes_pintar: nuevoTotal - (prev.hojas_pintadas_recibidas || 0) }));
  };

  const eliminarConsumoCuero = (index) => {
    if (esFinalizado) return;
    const updated = consumoCueroItems.filter((_, i) => i !== index).map((it, i) => ({ ...it, item_num: i + 1 }));
    setConsumoCueroItems(updated);
    const nuevoTotal = updated.reduce((sum, l) => sum + (parseFloat(l.cantidad_hojas) || 0), 0);
    setCurrentItem(prev => ({ ...prev, total_hojas_enviadas_pintura: nuevoTotal, hojas_pendientes_pintar: nuevoTotal - (prev.hojas_pintadas_recibidas || 0) }));
  };

  const handleConsumoCueroChange = (index, field, value) => {
    if (esFinalizado) return;
    const updated = [...consumoCueroItems];
    if (field === 'item_id') {
      const invItem = inventarioEnProceso.find(i => i.id === value);
      if (invItem) {
        updated[index].item_id = invItem.id;
        updated[index].inv_proceso_id = invItem.id;
        updated[index].codigo = invItem.codigo;
        updated[index].descripcion = invItem.descripcion;
        updated[index].origen_inventario = 'en_proceso';
        updated[index].cantidad_disponible = invItem.cantidad_hojas || 0;
        updated[index].unidad_medida = invItem.unidad_medida || 'HOJA';
        // Costo unitario desde inventario en proceso (costo_promedio)
        updated[index].costo_promedio = invItem.costo_promedio || 0;
        // Tipo de cuero heredado del inventario en proceso si tiene campo tipo_cuero
        updated[index].tipo_cuero = invItem.tipo_cuero || '';
        const cant = parseFloat(updated[index].cantidad_hojas) || 0;
        updated[index].costo_total_cuero = cant * (invItem.costo_promedio || 0);
      }
    } else {
      updated[index][field] = (field === 'cantidad_hojas' || field === 'merma_produccion') ? (parseFloat(value) || 0) : value;
    }
    if (field === 'cantidad_hojas' || field === 'merma_produccion') {
      const cant = parseFloat(field === 'cantidad_hojas' ? value : updated[index].cantidad_hojas) || 0;
      const merma = parseFloat(field === 'merma_produccion' ? value : updated[index].merma_produccion) || 0;
      updated[index].hojas_buenas = Math.max(0, cant - merma);
      updated[index].costo_total_cuero = cant * (updated[index].costo_promedio || 0);
    }
    setConsumoCueroItems(updated);
    if (field === 'cantidad_hojas') {
      const nuevoTotal = updated.reduce((sum, l) => sum + (parseFloat(l.cantidad_hojas) || 0), 0);
      setCurrentItem(prev => ({ ...prev, total_hojas_enviadas_pintura: nuevoTotal, hojas_pendientes_pintar: nuevoTotal - (prev.hojas_pintadas_recibidas || 0) }));
    }
  };

  // ── ITEMS CONSUMO INSUMOS ─────────────────────────────────────────────────
  const catalogoCombinado = [
    ...productosTerminados.map(p => ({ id: p.id, codigo: p.codigo || '', descripcion: p.descripcion || '', unidad_medida: p.unidad_medida || '', costo_promedio: p.costo_promedio || 0, stock_actual: p.stock_actual || 0, stock_minimo: p.stock_minimo || 0, origen: 'terminado' })),
    ...insumosQuimicos.map(i => ({ id: i.id, codigo: i.codigo || '', descripcion: i.nombre || i.descripcion || '', unidad_medida: i.unidad_medida || '', costo_promedio: i.costo_promedio || 0, stock_actual: i.stock_actual || 0, stock_minimo: i.stock_minimo || 0, origen: 'insumo' }))
  ].filter(i => i.codigo);

  const agregarConsumo = () => {
    setConsumosItems([...consumosItems, {
      item_num: consumosItems.length + 1, insumo_id: '', item_id: '', origen_inventario: '',
      codigo_pcto: '', nombre_producto: '', unidad_medida: '', tipo_acabado: '',
      cantidad_consumida: 0, costo_unitario: 0, costo_total: 0, observacion: ''
    }]);
  };

  const handleConsumoChange = (index, field, value) => {
    const updated = consumosItems.map((item, i) => i === index ? { ...item } : item);
    updated[index][field] = value;
    if (field === 'item_id') {
      const cat = catalogoCombinado.find(i => i.id === value);
      if (cat) {
        updated[index].insumo_id = cat.origen === 'insumo' ? cat.id : '';
        updated[index].origen_inventario = cat.origen;
        updated[index].codigo_pcto = cat.codigo;
        updated[index].nombre_producto = cat.descripcion;
        updated[index].unidad_medida = cat.unidad_medida || '';
        updated[index].costo_unitario = cat.costo_promedio || 0;
        updated[index].costo_total = (parseFloat(updated[index].cantidad_consumida) || 0) * (cat.costo_promedio || 0);
      }
    }
    if (field === 'cantidad_consumida' || field === 'costo_unitario') {
      const cantidad = parseFloat(field === 'cantidad_consumida' ? value : updated[index].cantidad_consumida) || 0;
      const costo = parseFloat(field === 'costo_unitario' ? value : updated[index].costo_unitario) || 0;
      updated[index].costo_total = cantidad * costo;
    }
    setConsumosItems([...updated]);
  };

  const eliminarConsumo = (index) => {
    setConsumosItems(consumosItems.filter((_, i) => i !== index).map((it, i) => ({ ...it, item_num: i + 1 })));
  };

  // ── MANO DE OBRA ─────────────────────────────────────────────────────────
  const agregarManoObra = () => {
    setManoObraItems([...manoObraItems, {
      item_num: manoObraItems.length + 1, tipo_acabado: '', detalle: '', cantidad_hojas: 0, valor_por_hoja: 0, total: 0, observacion: ''
    }]);
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

  const eliminarManoObra = (index) => {
    setManoObraItems(manoObraItems.filter((_, i) => i !== index).map((it, i) => ({ ...it, item_num: i + 1 })));
  };

  // ── RESUMEN POR TIPO ACABADO ──────────────────────────────────────────────
  const calcularResumenAcabado = () => {
    const consumoNapa = consumosItems.filter(c => c.tipo_acabado === 'NAPA').reduce((s, c) => s + (c.costo_total || 0), 0);
    const manoObraNapa = manoObraItems.filter(m => m.tipo_acabado === 'NAPA').reduce((s, m) => s + (m.total || 0), 0);
    const hojasNapa = consumoCueroItems.filter(c => c.tipo_acabado === 'NAPA').reduce((s, c) => s + (parseFloat(c.hojas_buenas) || 0), 0);
    const costoTotalNapa = consumoNapa + manoObraNapa;
    const consumoOtros = consumosItems.filter(c => c.tipo_acabado === 'OTROS').reduce((s, c) => s + (c.costo_total || 0), 0);
    const manoObraOtros = manoObraItems.filter(m => m.tipo_acabado === 'OTROS').reduce((s, m) => s + (m.total || 0), 0);
    const hojasOtros = consumoCueroItems.filter(c => c.tipo_acabado === 'OTROS').reduce((s, c) => s + (parseFloat(c.hojas_buenas) || 0), 0);
    const costoTotalOtros = consumoOtros + manoObraOtros;
    return {
      consumoNapa, manoObraNapa, hojasNapa, costoTotalNapa, costoPorHojaNapa: hojasNapa > 0 ? costoTotalNapa / hojasNapa : 0,
      consumoOtros, manoObraOtros, hojasOtros, costoTotalOtros, costoPorHojaOtros: hojasOtros > 0 ? costoTotalOtros / hojasOtros : 0
    };
  };

  // ── GUARDAR ───────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();

    for (const c of consumoCueroItems) {
      if (!c.item_id) { alert('Error: Todos los ítems de consumo de cuero deben tener un código seleccionado.'); return; }
      if (!c.tipo_acabado) { alert('Error: El campo "Tipo de Acabado" es obligatorio en Items Consumo de Cuero en Hojas.'); return; }
      if (!c.tipo_cuero) { alert('Error: El campo "Tipo de Cuero" es obligatorio en Items Consumo de Cuero en Hojas.'); return; }
      if (!c.color_final) { alert('Error: El campo "Color Final" es obligatorio en Items Consumo de Cuero en Hojas.'); return; }
      if (!c.cantidad_hojas || c.cantidad_hojas <= 0) { alert('Error: La cantidad de hojas debe ser mayor a cero.'); return; }
      const invItem = inventarioEnProceso.find(i => i.id === c.inv_proceso_id);
      if (invItem && c.cantidad_hojas > (invItem.cantidad_hojas || 0)) {
        alert(`⚠️ La cantidad a consumir (${c.cantidad_hojas}) supera el stock disponible (${invItem.cantidad_hojas}) para "${c.codigo}".`);
        return;
      }
    }

    for (const consumo of consumosItems) {
      if (!consumo.item_id) { alert('Error: Todos los consumos deben tener un producto seleccionado.'); return; }
      if (!consumo.tipo_acabado) { alert('Error: El campo "Tipo de acabado" es obligatorio en Items Consumo de Insumos.'); return; }
      if (consumo.cantidad_consumida <= 0) { alert('Error: La cantidad consumida debe ser mayor a cero.'); return; }
    }

    for (const mano of manoObraItems) {
      if (!mano.tipo_acabado) { alert('Error: El campo "Tipo de acabado" es obligatorio en Mano de Obra.'); return; }
    }

    try {
      const totalConsumo = consumosItems.reduce((sum, c) => sum + (c.costo_total || 0), 0);
      const totalManoObra = manoObraItems.reduce((sum, m) => sum + (m.total || 0), 0);
      const costoTotalProceso = totalConsumo + totalManoObra;
      const totalHojas = parseFloat(currentItem.total_hojas_enviadas_pintura) || 0;

      // Estado automático: borrador si vacío, parcial si hay datos, terminado si finalizar_pintura
      const tieneConsumos = consumoCueroItems.length > 0 || consumosItems.length > 0 || manoObraItems.length > 0;
      const esFinalizacion = currentItem.finalizar_pintura;
      const estadoAuto = esFinalizacion ? 'terminado' : tieneConsumos ? 'parcial' : 'pendiente';

      const dataToSave = {
        ...currentItem,
        numero_proceso: currentItem.numero_proceso || currentItem.id_consecutivo,
        fecha_inicio: currentItem.fecha_inicio || new Date().toISOString().split('T')[0],
        hojas_pendientes_pintar: (currentItem.total_hojas_enviadas_pintura || 0) - (currentItem.hojas_pintadas_recibidas || 0),
        consumo_cuero_items: consumoCueroItems,
        consumos: consumosItems,
        mano_obra_pintura: manoObraItems,
        total_consumo_productos: totalConsumo,
        total_mano_obra: totalManoObra,
        costo_total_proceso_pintura: costoTotalProceso,
        costo_promedio_por_hoja: totalHojas > 0 ? costoTotalProceso / totalHojas : 0,
        estado_pedido_pintura: estadoAuto,
      };

      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        await ProcesoProduccion.create(dataToSave);

        const fechaHoy = new Date().toISOString().split('T')[0];

        // Descontar insumos
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

        // Descontar cuero de inventario en proceso + crear/sumar en productos terminados
        for (const prod of consumoCueroItems) {
          const cantidadUsada = parseFloat(prod.cantidad_hojas) || 0;
          if (!cantidadUsada || !prod.item_id) continue;

          // Descontar de inventario en proceso
          if (prod.inv_proceso_id) {
            const invItem = inventarioEnProceso.find(i => i.id === prod.inv_proceso_id);
            if (invItem) {
              const nuevaCantidad = (invItem.cantidad_hojas || 0) - cantidadUsada;
              await InventarioEnProceso.update(invItem.id, {
                cantidad_hojas: Math.max(0, nuevaCantidad),
                estado_actual: nuevaCantidad <= 0 ? 'TERMINADO' : 'EN_PROCESO'
              });
            }
          }

          // Solo si está finalizado: ingresar a ProductoTerminado
          if (currentItem.finalizar_pintura || currentItem.estado_pedido_pintura === 'terminado') {
            const tipoCuero = prod.tipo_cuero || '';
            const tipoAcabado = prod.tipo_acabado || '';
            const colorFinal = prod.color_final || '';
            const hojasBuenas = parseFloat(prod.hojas_buenas) || cantidadUsada;

            // Descripción automática
            const descripcionAuto = `${tipoCuero} - ${tipoAcabado} - ${colorFinal}`.toUpperCase();

            // Buscar si ya existe ese producto terminado
            const existentes = productosTerminados.filter(pt =>
              pt.tipo_cuero === tipoCuero &&
              pt.tipo_acabado === tipoAcabado &&
              pt.color_final === colorFinal
            );

            if (existentes.length > 0) {
              // Sumar cantidades
              const ptExistente = existentes[0];
              await ProductoTerminado.update(ptExistente.id, {
                stock_actual: (ptExistente.stock_actual || 0) + hojasBuenas
              });
            } else {
              // Crear nuevo
              const codigoAuto = `PT-${tipoCuero.substring(0,2)}-${tipoAcabado.substring(0,2)}-${colorFinal.substring(0,4)}-${Date.now()}`.toUpperCase();
              await ProductoTerminado.create({
                codigo: codigoAuto,
                descripcion: descripcionAuto,
                tipo_cuero: tipoCuero,
                tipo_acabado: tipoAcabado,
                color_final: colorFinal,
                categoria: 'hojas_procesadas',
                unidad_medida: 'HOJA',
                stock_actual: hojasBuenas,
                stock_minimo: 0,
                proceso_origen_id: currentItem.id_consecutivo,
                fecha_ingreso: fechaHoy
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
      alert('Entrega confirmada.');
      setShowEntregasModal(false);
      loadData();
    } catch (error) { alert('Error al confirmar entrega.'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proceso de pintura?')) return;
    try { await ProcesoProduccion.delete(id); loadData(); } catch (error) { console.error(error); }
  };

  const resumenAcabado = currentItem ? calcularResumenAcabado() : null;

  const headers = ['ID', 'Fecha Entrega', 'Pintor', 'Total Enviadas', 'Hojas Pintadas', 'Pendientes', 'Estado', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono font-bold">{item?.id_consecutivo || item?.numero_proceso || 'N/A'}</td>
      <td>{formatDate(item.fecha_entrega_pintor)}</td>
      <td>{item.pintor_responsable || 'N/A'}</td>
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

      {/* ══ MODAL PRINCIPAL ════════════════════════════════════════════════════ */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Pintura {esFinalizado && <span className="text-red-500 text-sm ml-2">(FINALIZADO - Solo lectura)</span>}</DialogTitle>
          </DialogHeader>
          {currentItem && (
          <form onSubmit={handleSave} className="space-y-5">

            {/* Encabezado */}
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
            <div className="grid grid-cols-1 gap-4 max-w-xs">
              <div>
                <Label>Estado del Pedido en Pintura</Label>
                <div className={`mt-1 px-3 py-2 rounded border font-bold text-sm ${
                  currentItem.estado_pedido_pintura === 'terminado' ? 'bg-green-100 text-green-800 border-green-300' :
                  currentItem.estado_pedido_pintura === 'parcial' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                  'bg-yellow-100 text-yellow-800 border-yellow-300'
                }`}>
                  {currentItem.estado_pedido_pintura === 'terminado' ? '✅ FINALIZADO' :
                   currentItem.estado_pedido_pintura === 'parcial' ? '🔄 EN PROCESO / PARCIAL' : '🕐 BORRADOR / PENDIENTE'}
                </div>
                <p className="text-xs text-slate-400 mt-1">El estado se controla automáticamente por el sistema.</p>
              </div>
            </div>

            {/* Total Hojas */}
            <div className="grid grid-cols-3 gap-4 bg-blue-50 p-3 rounded border border-blue-200">
              <div>
                <Label className="text-blue-700 font-bold">Total Hojas Enviadas a Pintura</Label>
                <Input type="number" value={currentItem.total_hojas_enviadas_pintura || 0} readOnly className="bg-white font-bold text-blue-800 border-blue-300" />
                <p className="text-xs text-blue-500 mt-1">Suma automática desde Items Consumo de Cuero</p>
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

            {/* ══ ITEMS CONSUMO DE CUERO EN HOJAS ══════════════════════════ */}
            <div className="border-t pt-4 mt-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg text-purple-800">Items Consumo de Cuero en Hojas</h3>
                {!esFinalizado && <Button type="button" onClick={agregarConsumoCuero} size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" />Agregar</Button>}
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-purple-50">
                    <tr>
                      <th className="border p-2 w-10">ITEM</th>
                      <th className="border p-2">ORIGEN DEL PROCESO</th>
                      <th className="border p-2">CÓDIGO (Inv. en Proceso)</th>
                      <th className="border p-2">DESCRIPCIÓN</th>
                      <th className="border p-2">U.M.</th>
                      <th className="border p-2 text-right">CANT. HOJAS *</th>
                      <th className="border p-2">TIPO DE CUERO *</th>
                      <th className="border p-2">TIPO DE ACABADO *</th>
                      <th className="border p-2">COLOR FINAL *</th>
                      <th className="border p-2 text-right">COSTO PROMEDIO</th>
                      <th className="border p-2 text-right">COSTO TOTAL</th>
                      <th className="border p-2 text-right">MERMA (HOJAS)</th>
                      <th className="border p-2 text-right">HOJAS BUENAS</th>
                      <th className="border p-2">ESTADO DEL ITEM</th>
                      <th className="border p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumoCueroItems.length === 0 && <tr><td colSpan={15} className="p-3 text-center text-gray-400">No hay items agregados.</td></tr>}
                    {consumoCueroItems.map((prod, idx) => {
                      const cantConsumir = parseFloat(prod.cantidad_hojas) || 0;
                      const stockDisp = prod.cantidad_disponible || 0;
                      const diferencia = stockDisp - cantConsumir;
                      const stockInsuficiente = cantConsumir > stockDisp && stockDisp > 0;
                      return (
                        <React.Fragment key={idx}>
                        <tr className="border-t">
                          <td className="border p-2 text-center font-bold text-purple-700 bg-purple-50">{prod.item_num}</td>
                          {/* ORIGEN DEL PROCESO */}
                          <td className="border p-2 min-w-[130px]">
                            <Select value={prod.origen_proceso || ''} disabled={esFinalizado} onValueChange={v => handleConsumoCueroChange(idx, 'origen_proceso', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="limpieza">Limpieza</SelectItem>
                                <SelectItem value="curtido">Curtido</SelectItem>
                                <SelectItem value="recurtido">Recurtido</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          {/* CÓDIGO */}
                          <td className="border p-2 min-w-[180px]">
                            <Select value={prod.item_id || ''} disabled={esFinalizado} onValueChange={v => handleConsumoCueroChange(idx, 'item_id', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                              <SelectContent>
                                {inventarioEnProceso.filter(i => i.codigo).map(i => (
                                  <SelectItem key={i.id} value={i.id}>{i.codigo} - {i.descripcion}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {prod.codigo && <div className="text-xs text-indigo-500 mt-0.5">{prod.codigo}</div>}
                          </td>
                          <td className="border p-2 min-w-[130px]"><Input value={prod.descripcion || ''} readOnly className="bg-gray-50 h-8 text-xs" /></td>
                          <td className="border p-2 w-16"><Input value={prod.unidad_medida || 'HOJA'} readOnly className="bg-gray-50 h-8 text-xs text-center" /></td>
                          {/* CANT. HOJAS */}
                          <td className="border p-2 w-24">
                            <Input type="number" value={prod.cantidad_hojas} min="0" step="1" disabled={esFinalizado}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val > stockDisp && stockDisp > 0) alert(`⚠️ La cantidad (${val}) supera el stock disponible (${stockDisp}).`);
                                handleConsumoCueroChange(idx, 'cantidad_hojas', e.target.value);
                                setStockPanelIdx(idx);
                              }}
                              className={`h-8 text-xs text-right ${stockInsuficiente ? 'border-red-400 bg-red-50' : ''}`}
                            />
                            <button type="button" className="text-xs text-indigo-500 underline mt-0.5 block w-full text-right" onClick={() => setStockPanelIdx(stockPanelIdx === idx ? null : idx)}>
                              Disp: {stockDisp}
                            </button>
                          </td>
                          {/* TIPO DE CUERO - automático desde inv en proceso */}
                          <td className="border p-2 min-w-[120px]">
                            <Select value={prod.tipo_cuero || ''} disabled={esFinalizado} onValueChange={v => handleConsumoCueroChange(idx, 'tipo_cuero', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar *" /></SelectTrigger>
                              <SelectContent>{TIPOS_CUERO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          {/* TIPO DE ACABADO */}
                          <td className="border p-2 min-w-[190px]">
                            <Select value={prod.tipo_acabado || ''} disabled={esFinalizado} onValueChange={v => handleConsumoCueroChange(idx, 'tipo_acabado', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar *" /></SelectTrigger>
                              <SelectContent>{TIPOS_ACABADO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          {/* COLOR FINAL - desde catálogo colores */}
                          <td className="border p-2 min-w-[160px]">
                            <Select value={prod.color_final || ''} disabled={esFinalizado} onValueChange={v => handleConsumoCueroChange(idx, 'color_final', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar *" /></SelectTrigger>
                              <SelectContent>
                                {coloresCatalogo.map(c => (
                                  <SelectItem key={c.id} value={c.nombre_color}>{c.codigo_color} - {c.nombre_color}</SelectItem>
                                ))}
                                {coloresCatalogo.length === 0 && <SelectItem value="__none__" disabled>Sin colores en catálogo</SelectItem>}
                              </SelectContent>
                            </Select>
                          </td>
                          {/* COSTO PROMEDIO - solo lectura */}
                          <td className="border p-2 w-28"><Input value={(prod.costo_promedio || 0).toFixed(0)} readOnly className="h-8 text-xs text-right bg-blue-50 font-bold" /></td>
                          {/* COSTO TOTAL - automático */}
                          <td className="border p-2 w-28"><Input value={(prod.costo_total_cuero || 0).toFixed(0)} readOnly className="h-8 text-xs text-right bg-green-50 font-bold text-green-700" /></td>
                          {/* MERMA */}
                          <td className="border p-2 w-24">
                            <Input type="number" value={prod.merma_produccion || 0} min="0" max={prod.cantidad_hojas} step="1" disabled={esFinalizado}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 0;
                                if (val > (prod.cantidad_hojas || 0)) { alert('La merma no puede superar la cantidad de hojas.'); return; }
                                handleConsumoCueroChange(idx, 'merma_produccion', e.target.value);
                              }} className="h-8 text-xs text-right bg-red-50" />
                          </td>
                          {/* HOJAS BUENAS */}
                          <td className="border p-2 w-24"><Input value={prod.hojas_buenas || 0} readOnly className="h-8 text-xs text-right bg-green-50 font-bold text-green-700" /></td>
                          {/* ESTADO DEL ITEM */}
                          <td className="border p-2 min-w-[140px]">
                            <Select value={prod.estado_item || 'pendiente'} disabled={esFinalizado} onValueChange={v => handleConsumoCueroChange(idx, 'estado_item', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendiente">Pendiente</SelectItem>
                                <SelectItem value="en_pintura">En Pintura</SelectItem>
                                <SelectItem value="pintado_parcial">Pintado Parcial</SelectItem>
                                <SelectItem value="finalizado">Finalizado</SelectItem>
                                <SelectItem value="devuelto">Devuelto</SelectItem>
                                <SelectItem value="reproceso">Reproceso</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="border p-2 text-center">
                            {!esFinalizado && <Button type="button" variant="ghost" size="sm" onClick={() => eliminarConsumoCuero(idx)}><X className="w-4 h-4 text-red-500" /></Button>}
                          </td>
                        </tr>
                        {stockPanelIdx === idx && prod.item_id && (
                          <tr className="bg-indigo-50">
                            <td colSpan={15} className="border p-3">
                              <div className="flex flex-wrap gap-4 items-center text-xs">
                                <span className="font-bold text-indigo-700">📦 Stock:</span>
                                <span><b>Disponible:</b> {stockDisp} {prod.unidad_medida || 'HOJA'}</span>
                                <span><b>A consumir:</b> {cantConsumir}</span>
                                <span className={`font-bold ${diferencia < 0 ? 'text-red-600' : 'text-green-600'}`}><b>Diferencia:</b> {diferencia}</span>
                                {diferencia < 0 && <span className="text-red-600 font-bold">⚠️ STOCK INSUFICIENTE</span>}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {consumoCueroItems.length > 0 && (
                    <tfoot className="bg-purple-100 font-bold text-xs">
                      <tr>
                        <td colSpan={5} className="border p-2 text-right">TOTALES:</td>
                        <td className="border p-2 text-right">{totalHojasDeCuero}</td>
                        <td colSpan={3} className="border p-2"></td>
                        <td className="border p-2"></td>
                        <td className="border p-2 text-right text-green-700">{formatCurrency(consumoCueroItems.reduce((s, c) => s + (c.costo_total_cuero || 0), 0))}</td>
                        <td className="border p-2 text-right text-red-700">{consumoCueroItems.reduce((s, c) => s + (parseFloat(c.merma_produccion) || 0), 0)}</td>
                        <td className="border p-2 text-right text-green-700">{consumoCueroItems.reduce((s, c) => s + (parseFloat(c.hojas_buenas) || 0), 0)}</td>
                        <td className="border p-2"></td>
                        <td className="border p-2"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* ══ ITEMS CONSUMO DE INSUMOS Y QUÍMICOS ═════════════════════ */}
            <div className="border-t pt-4 mt-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Items Consumo de Insumos y Químicos</h3>
                {!esFinalizado && <Button type="button" onClick={agregarConsumo} size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" />Agregar Producto</Button>}
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2 w-10">ITEM</th>
                      <th className="border p-2">TIPO DE ACABADO *</th>
                      <th className="border p-2">CÓDIGO PRODUCTO</th>
                      <th className="border p-2">DESCRIPCIÓN</th>
                      <th className="border p-2">U.M.</th>
                      <th className="border p-2">CANT.</th>
                      <th className="border p-2 min-w-[110px]">COSTO UNIT.</th>
                      <th className="border p-2 min-w-[110px]">COSTO TOTAL</th>
                      <th className="border p-2">OBS.</th>
                      <th className="border p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumosItems.length === 0 && <tr><td colSpan={10} className="p-3 text-center text-gray-400">No hay consumos agregados.</td></tr>}
                    {consumosItems.map((consumo, idx) => {
                      const catRef = catalogoCombinado.find(i => i.id === consumo.item_id);
                      const stockBajo = catRef && (catRef.stock_actual || 0) <= (catRef.stock_minimo || 0);
                      return (
                        <tr key={idx} className="border-t">
                          <td className="border p-2 text-center font-bold text-gray-600 bg-gray-50">{consumo.item_num}</td>
                          <td className="border p-1 min-w-[200px]">
                            <Select value={consumo.tipo_acabado || ''} disabled={esFinalizado} onValueChange={v => handleConsumoChange(idx, 'tipo_acabado', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar *" /></SelectTrigger>
                              <SelectContent>{TIPOS_ACABADO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="border p-1 min-w-[180px]">
                            <Select value={consumo.item_id || ''} disabled={esFinalizado} onValueChange={v => handleConsumoChange(idx, 'item_id', v)}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                              <SelectContent>{catalogoCombinado.map(i => <SelectItem key={i.id} value={i.id}>{i.codigo} - {i.descripcion}</SelectItem>)}</SelectContent>
                            </Select>
                            {consumo.item_id && <div className={`text-xs mt-0.5 ${stockBajo ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>Stock: {catRef?.stock_actual || 0}{stockBajo && ' ⚠️'}</div>}
                          </td>
                          <td className="border p-1 min-w-[140px]"><Input value={consumo.nombre_producto || ''} readOnly className="bg-gray-50 h-8 text-xs" /></td>
                          <td className="border p-1"><Input value={consumo.unidad_medida || ''} readOnly className="bg-gray-50 h-8 text-xs text-center font-medium" placeholder="U.M." /></td>
                          <td className="border p-1 w-20"><Input type="number" value={consumo.cantidad_consumida ?? 0} min="0.01" step="0.01" disabled={esFinalizado} onChange={e => handleConsumoChange(idx, 'cantidad_consumida', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" /></td>
                          <td className="border p-1 min-w-[110px]"><Input type="number" value={consumo.costo_unitario || 0} min="0" step="1" disabled={esFinalizado} onChange={e => handleConsumoChange(idx, 'costo_unitario', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" /></td>
                          <td className="border p-1 min-w-[110px]"><Input value={consumo.costo_total || 0} readOnly className="h-8 text-xs text-right bg-blue-50 font-bold" /></td>
                          <td className="border p-1 min-w-[100px]"><Input value={consumo.observacion || ''} disabled={esFinalizado} onChange={e => handleConsumoChange(idx, 'observacion', e.target.value)} className="h-8 text-xs" /></td>
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

            {/* ══ MANO DE OBRA ═════════════════════════════════════════════ */}
            <div className="border-t pt-4 mt-2">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-lg">Mano de Obra de Pintura</h3>
                {!esFinalizado && <Button type="button" onClick={agregarManoObra} size="sm" variant="outline"><Plus className="w-4 h-4 mr-2" />Agregar</Button>}
              </div>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2 w-10">ITEM</th>
                      <th className="border p-2">TIPO DE ACABADO *</th>
                      <th className="border p-2">DETALLE</th>
                      <th className="border p-2">CANT. HOJAS</th>
                      <th className="border p-2">VALOR/HOJA</th>
                      <th className="border p-2">TOTAL</th>
                      <th className="border p-2">OBS.</th>
                      <th className="border p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {manoObraItems.length === 0 && <tr><td colSpan={8} className="p-3 text-center text-gray-400">No hay mano de obra agregada.</td></tr>}
                    {manoObraItems.map((mano, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="border p-2 text-center font-bold text-gray-600 bg-gray-50">{mano.item_num}</td>
                        <td className="border p-1 min-w-[200px]">
                          <Select value={mano.tipo_acabado || ''} disabled={esFinalizado} onValueChange={v => handleManoObraChange(idx, 'tipo_acabado', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar *" /></SelectTrigger>
                            <SelectContent>{TIPOS_ACABADO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="border p-1"><Input value={mano.detalle} disabled={esFinalizado} onChange={e => handleManoObraChange(idx, 'detalle', e.target.value)} className="h-8 text-xs" /></td>
                        <td className="border p-1 w-20"><Input type="number" value={mano.cantidad_hojas} min="0" step="1" disabled={esFinalizado} onChange={e => handleManoObraChange(idx, 'cantidad_hojas', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" /></td>
                        <td className="border p-1 w-24"><Input type="number" value={mano.valor_por_hoja} min="0" step="100" disabled={esFinalizado} onChange={e => handleManoObraChange(idx, 'valor_por_hoja', parseFloat(e.target.value) || 0)} className="h-8 text-xs text-right" /></td>
                        <td className="border p-1 w-24"><Input value={mano.total} readOnly className="h-8 text-xs text-right bg-blue-50 font-bold" /></td>
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

            {/* ══ RESUMEN DE COSTOS POR TIPO DE ACABADO (7 bloques) ════════ */}
            {resumenAcabado && (
              <div className="border-t pt-4 mt-2 space-y-4">
                <h3 className="font-bold text-lg">Resumen de Costos por Tipo de Acabado</h3>

                {/* 1. INFORMACIÓN GENERAL DEL PEDIDO */}
                <div className="bg-slate-50 border rounded-lg p-4">
                  <h4 className="font-bold text-slate-700 mb-3 text-sm uppercase border-b pb-1">1. Información General del Pedido</h4>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><span className="font-semibold text-slate-600">ID Consecutivo:</span> <span className="font-mono font-bold text-emerald-700">{currentItem.id_consecutivo || 'N/A'}</span></div>
                    <div><span className="font-semibold text-slate-600">Fecha Entrega Pintor:</span> {currentItem.fecha_entrega_pintor || 'N/A'}</div>
                    <div><span className="font-semibold text-slate-600">Pintor Responsable:</span> {currentItem.pintor_responsable || 'N/A'}</div>
                    <div><span className="font-semibold text-slate-600">Tipo de Acabado(s):</span> {[...new Set(consumoCueroItems.map(c => c.tipo_acabado).filter(Boolean))].join(', ') || 'N/A'}</div>
                    <div><span className="font-semibold text-slate-600">Tipo de Cuero:</span> {[...new Set(consumoCueroItems.map(c => c.tipo_cuero).filter(Boolean))].join(', ') || 'N/A'}</div>
                    <div><span className="font-semibold text-slate-600">Color Final:</span> {[...new Set(consumoCueroItems.map(c => c.color_final).filter(Boolean))].join(', ') || 'N/A'}</div>
                  </div>
                </div>

                {/* 2. RESUMEN CONSUMO CUERO EN HOJAS */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-bold text-purple-800 mb-3 text-sm uppercase border-b border-purple-200 pb-1">2. Resumen Consumo Cuero en Hojas</h4>
                  {consumoCueroItems.length === 0 ? <p className="text-xs text-slate-400">Sin items de cuero registrados.</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-purple-100">
                          <tr>
                            <th className="p-1 text-left">Código</th><th className="p-1 text-left">Descripción</th><th className="p-1 text-left">U.M.</th>
                            <th className="p-1 text-right">Total Hojas</th><th className="p-1 text-right">Hojas Buenas</th><th className="p-1 text-right">Merma</th>
                            <th className="p-1 text-right">% Merma</th><th className="p-1 text-right">% Aprovech.</th>
                            <th className="p-1 text-right">Costo Prom./Hoja</th><th className="p-1 text-right">Costo Total</th>
                            <th className="p-1 text-right">Costo Merma</th><th className="p-1 text-right">Costo Real Hojas Buenas</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consumoCueroItems.map((c, i) => {
                            const totalH = parseFloat(c.cantidad_hojas) || 0;
                            const merma = parseFloat(c.merma_produccion) || 0;
                            const buenas = parseFloat(c.hojas_buenas) || Math.max(0, totalH - merma);
                            const pctMerma = totalH > 0 ? (merma / totalH * 100).toFixed(1) : 0;
                            const pctAprov = totalH > 0 ? (buenas / totalH * 100).toFixed(1) : 0;
                            const costoMerma = merma * (parseFloat(c.costo_promedio) || 0);
                            const costoRealBuenas = buenas > 0 ? (parseFloat(c.costo_total_cuero) || 0) / buenas : 0;
                            return (
                              <tr key={i} className="border-t">
                                <td className="p-1 font-mono">{c.codigo}</td>
                                <td className="p-1">{c.descripcion}</td>
                                <td className="p-1">{c.unidad_medida || 'HOJA'}</td>
                                <td className="p-1 text-right font-bold">{totalH}</td>
                                <td className="p-1 text-right text-green-700 font-bold">{buenas}</td>
                                <td className="p-1 text-right text-red-600">{merma}</td>
                                <td className="p-1 text-right text-orange-600">{pctMerma}%</td>
                                <td className="p-1 text-right text-green-600">{pctAprov}%</td>
                                <td className="p-1 text-right">{formatCurrency(c.costo_promedio || 0)}</td>
                                <td className="p-1 text-right font-bold text-blue-700">{formatCurrency(c.costo_total_cuero || 0)}</td>
                                <td className="p-1 text-right text-red-600">{formatCurrency(costoMerma)}</td>
                                <td className="p-1 text-right font-bold text-emerald-700">{formatCurrency(costoRealBuenas)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-purple-100 font-bold text-xs">
                          <tr>
                            <td colSpan={3} className="p-1 text-right">TOTALES:</td>
                            <td className="p-1 text-right">{consumoCueroItems.reduce((s,c) => s+(parseFloat(c.cantidad_hojas)||0),0)}</td>
                            <td className="p-1 text-right text-green-700">{consumoCueroItems.reduce((s,c) => s+(parseFloat(c.hojas_buenas)||0),0)}</td>
                            <td className="p-1 text-right text-red-600">{consumoCueroItems.reduce((s,c) => s+(parseFloat(c.merma_produccion)||0),0)}</td>
                            <td colSpan={2} className="p-1"></td>
                            <td className="p-1"></td>
                            <td className="p-1 text-right text-blue-700">{formatCurrency(consumoCueroItems.reduce((s,c) => s+(c.costo_total_cuero||0),0))}</td>
                            <td colSpan={2} className="p-1"></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3. RESUMEN CONSUMO INSUMOS Y QUÍMICOS (independiente del cuero) */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-bold text-blue-800 mb-3 text-sm uppercase border-b border-blue-200 pb-1">3. Resumen Consumo Insumos y Químicos (Total del Lote)</h4>
                  {consumosItems.length === 0 ? <p className="text-xs text-slate-400">Sin consumos de insumos registrados.</p> : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-blue-100">
                          <tr>
                            <th className="p-1 text-left">Producto</th><th className="p-1 text-right">Cantidad</th>
                            <th className="p-1 text-right">U.M.</th><th className="p-1 text-right">Costo Unitario</th><th className="p-1 text-right font-bold">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consumosItems.map((c, i) => (
                            <tr key={i} className="border-t">
                              <td className="p-1">{c.nombre_producto || c.codigo_pcto}</td>
                              <td className="p-1 text-right">{c.cantidad_consumida}</td>
                              <td className="p-1 text-right">{c.unidad_medida}</td>
                              <td className="p-1 text-right">{formatCurrency(c.costo_unitario)}</td>
                              <td className="p-1 text-right font-bold text-blue-700">{formatCurrency(c.costo_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-blue-100 font-bold">
                          <tr><td colSpan={4} className="p-1 text-right">TOTAL GENERAL INSUMOS Y QUÍMICOS:</td>
                            <td className="p-1 text-right text-blue-800">{formatCurrency(consumosItems.reduce((s,c) => s+(c.costo_total||0),0))}</td></tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                {/* 4. RESUMEN MANO DE OBRA */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-bold text-green-800 mb-3 text-sm uppercase border-b border-green-200 pb-1">4. Resumen Mano de Obra</h4>
                  <div className="space-y-1 text-sm">
                    {manoObraItems.map((m, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span>{m.detalle || `Item ${i+1}`} ({m.cantidad_hojas} hojas × {formatCurrency(m.valor_por_hoja)}/hoja)</span>
                        <span className="font-bold text-green-700">{formatCurrency(m.total)}</span>
                      </div>
                    ))}
                    {manoObraItems.length === 0 && <p className="text-xs text-slate-400">Sin mano de obra registrada.</p>}
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>TOTAL GENERAL MANO DE OBRA:</span>
                      <span className="text-green-800">{formatCurrency(manoObraItems.reduce((s,m) => s+(m.total||0), 0))}</span>
                    </div>
                  </div>
                </div>

                {/* 5. COSTO TOTAL GENERAL */}
                {(() => {
                  const totalCuero = consumoCueroItems.reduce((s,c) => s+(c.costo_total_cuero||0), 0);
                  const totalInsumos = consumosItems.reduce((s,c) => s+(c.costo_total||0), 0);
                  const totalMO = manoObraItems.reduce((s,m) => s+(m.total||0), 0);
                  const totalGeneral = totalCuero + totalInsumos + totalMO;
                  return (
                    <div className="bg-slate-800 text-white rounded-lg p-4">
                      <h4 className="font-bold mb-3 text-sm uppercase">5. Costo Total General del Proceso</h4>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div className="text-center"><p className="text-slate-300 text-xs">Total Cuero en Hojas</p><p className="font-bold text-xl text-purple-300">{formatCurrency(totalCuero)}</p></div>
                        <div className="text-center"><p className="text-slate-300 text-xs">Total Insumos y Químicos</p><p className="font-bold text-xl text-blue-300">{formatCurrency(totalInsumos)}</p></div>
                        <div className="text-center"><p className="text-slate-300 text-xs">Total Mano de Obra</p><p className="font-bold text-xl text-green-300">{formatCurrency(totalMO)}</p></div>
                        <div className="text-center border-l border-slate-600"><p className="text-slate-300 text-xs">COSTO TOTAL GENERAL</p><p className="font-bold text-2xl text-yellow-300">{formatCurrency(totalGeneral)}</p></div>
                      </div>
                    </div>
                  );
                })()}

                {/* 6. INDICADORES DE CONTROL Y RENDIMIENTO */}
                {(() => {
                  const totalHojasUsadas = consumoCueroItems.reduce((s,c) => s+(parseFloat(c.cantidad_hojas)||0), 0);
                  const totalHojasBuenas = consumoCueroItems.reduce((s,c) => s+(parseFloat(c.hojas_buenas)||0), 0);
                  const totalMerma = consumoCueroItems.reduce((s,c) => s+(parseFloat(c.merma_produccion)||0), 0);
                  const pctMerma = totalHojasUsadas > 0 ? (totalMerma / totalHojasUsadas * 100).toFixed(1) : 0;
                  const pctAprov = totalHojasUsadas > 0 ? (totalHojasBuenas / totalHojasUsadas * 100).toFixed(1) : 0;
                  const totalCuero = consumoCueroItems.reduce((s,c) => s+(c.costo_total_cuero||0), 0);
                  const totalInsumos = consumosItems.reduce((s,c) => s+(c.costo_total||0), 0);
                  const totalMO = manoObraItems.reduce((s,m) => s+(m.total||0), 0);
                  const totalGeneral = totalCuero + totalInsumos + totalMO;
                  const costoPromHojaBuena = totalHojasBuenas > 0 ? totalGeneral / totalHojasBuenas : 0;
                  return (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h4 className="font-bold text-amber-800 mb-3 text-sm uppercase border-b border-amber-200 pb-1">6. Indicadores de Control y Rendimiento</h4>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div className="text-center p-3 bg-white rounded border"><p className="text-slate-500 text-xs">Cantidad Total Procesada</p><p className="font-bold text-2xl text-slate-800">{totalHojasUsadas}</p><p className="text-xs text-slate-400">hojas</p></div>
                        <div className="text-center p-3 bg-white rounded border"><p className="text-slate-500 text-xs">% Desperdicio</p><p className="font-bold text-2xl text-red-600">{pctMerma}%</p><p className="text-xs text-slate-400">{totalMerma} hojas merma</p></div>
                        <div className="text-center p-3 bg-white rounded border"><p className="text-slate-500 text-xs">% Aprovechamiento</p><p className="font-bold text-2xl text-green-600">{pctAprov}%</p><p className="text-xs text-slate-400">{totalHojasBuenas} hojas buenas</p></div>
                        <div className="text-center p-3 bg-white rounded border"><p className="text-slate-500 text-xs">Costo Prom. Real/Hoja Buena</p><p className="font-bold text-xl text-orange-600">{formatCurrency(costoPromHojaBuena)}</p></div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <p className="font-semibold text-slate-600 mb-2">Costos por Tipo de Acabado:</p>
                          {TIPOS_ACABADO.map(t => {
                            const costo = consumosItems.filter(c => c.tipo_acabado === t.value).reduce((s,c) => s+(c.costo_total||0), 0) + manoObraItems.filter(m => m.tipo_acabado === t.value).reduce((s,m) => s+(m.total||0), 0);
                            return <div key={t.value} className="flex justify-between py-0.5"><span>{t.label}:</span><span className="font-bold">{formatCurrency(costo)}</span></div>;
                          })}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-600 mb-2">Costos por Tipo de Cuero:</p>
                          {TIPOS_CUERO.map(t => {
                            const hojas = consumoCueroItems.filter(c => c.tipo_cuero === t.value).reduce((s,c) => s+(parseFloat(c.cantidad_hojas)||0), 0);
                            const costo = consumoCueroItems.filter(c => c.tipo_cuero === t.value).reduce((s,c) => s+(c.costo_total_cuero||0), 0);
                            return <div key={t.value} className="flex justify-between py-0.5"><span>{t.label} ({hojas} hojas):</span><span className="font-bold">{formatCurrency(costo)}</span></div>;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              </div>
            )}

            <div>
              <Label>Observaciones</Label>
              <Textarea value={currentItem.observaciones || ''} disabled={esFinalizado} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={3} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              {!esFinalizado && (
                <>
                  <Button
                    type="submit"
                    variant="outline"
                    className="border-blue-500 text-blue-700 hover:bg-blue-50"
                    onClick={() => setCurrentItem(prev => ({ ...prev, finalizar_pintura: false, _guardar_modo: 'borrador' }))}
                  >
                    💾 Guardar Borrador
                  </Button>
                  <Button
                    type="submit"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setCurrentItem(prev => ({ ...prev, finalizar_pintura: true, _guardar_modo: 'final' }))}
                  >
                    ✅ Finalizar Proceso
                  </Button>
                </>
              )}
            </div>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── MODAL ENTREGAS PARCIALES ──────────────────────────────────────── */}
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

      {/* ── MODAL DETALLE ─────────────────────────────────────────────────── */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Detalle de Pintura</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">ID:</span> <span className="font-mono">{selectedItem.id_consecutivo || 'N/A'}</span></p>
              <p><span className="font-semibold">Fecha Entrega Pintor:</span> {formatDate(selectedItem.fecha_entrega_pintor)}</p>
              <p><span className="font-semibold">Pintor:</span> {selectedItem.pintor_responsable || 'N/A'}</p>
              <p><span className="font-semibold">Total Enviadas:</span> {selectedItem.total_hojas_enviadas_pintura} hojas</p>
              <p><span className="font-semibold">Hojas Pintadas:</span> {selectedItem.hojas_pintadas_recibidas} hojas</p>
              <p><span className="font-semibold">Pendientes:</span> {selectedItem.hojas_pendientes_pintar} hojas</p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize font-bold">{selectedItem.estado_pedido_pintura}</span></p>
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}