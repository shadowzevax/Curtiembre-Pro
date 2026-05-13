import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ProcesoProduccion, Insumo, ProductoTerminado, Proveedor, OrdenCompra, MovimientoInventario, InventarioEnProceso } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Eye, FileText, Table } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function ProcesoRecepcion() {
  const [recepciones, setRecepciones] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSublotesModal, setShowSublotesModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState({});
  const [sublotes, setSublotes] = useState([]);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [loteConsolidado, setLoteConsolidado] = useState(null);
  const [ordenesCompra, setOrdenesCompra] = useState([]);
  const [costoPromedioProducto, setCostoPromedioProducto] = useState(0);
  const [stockDisponible, setStockDisponible] = useState(null);
  const [stockUnidad, setStockUnidad] = useState('');
  const [ordenCompraSearch, setOrdenCompraSearch] = useState('');
  const [productoSearch, setProductoSearch] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recepcionesData, insumosData, productosData, proveedoresData, comprasData, movimientosData] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'recepcion' }),
        Insumo.list(),
        ProductoTerminado.filter({ categoria: 'pieles' }),
        Proveedor.list(),
        OrdenCompra.list(),
        MovimientoInventario.list()
      ]);
      setRecepciones(Array.isArray(recepcionesData) ? recepcionesData : []);
      setInsumos(Array.isArray(insumosData) ? insumosData : []);
      // Calcular stock real desde MovimientoInventario para cada producto
      const productosConStock = (Array.isArray(productosData) ? productosData : []).map(prod => {
        const movsProd = (Array.isArray(movimientosData) ? movimientosData : []).filter(m => m.insumo_id === prod.id);
        const stockActual = movsProd.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
        return { ...prod, stock_actual: stockActual };
      });
      setProductos(productosConStock);
      setProveedores(Array.isArray(proveedoresData) ? proveedoresData : []);
      setOrdenesCompra(Array.isArray(comprasData) ? comprasData : []);
    } catch (error) {
      console.error('Error loading data:', error);
      setRecepciones([]); setInsumos([]); setProductos([]); setProveedores([]); setOrdenesCompra([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    if (!item) {
      const year = new Date().getFullYear();
      const recepcionesSeguras = Array.isArray(recepciones) ? recepciones : [];
      const recepcionesDelAnio = recepcionesSeguras.filter(r => r && r.codigo_lote?.startsWith(`L-${year}`));
      const consecutivos = recepcionesDelAnio.map(r => {
        const match = r?.codigo_lote?.match(/L-\d{4}-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) + 1 : 1;
      const codigoLote = `L-${year}-${String(nextConsecutivo).padStart(3, '0')}`;
      setCurrentItem({
        tipo_proceso: 'recepcion',
        codigo_lote: codigoLote,
        fecha_inicio: new Date().toISOString().split('T')[0],
        id_orden_compra_origen: '',
        proveedor_id: '',
        no_documento: '',
        codigo_producto: '',
        descripcion_producto: '',
        cantidad_total_lote_hojas: 0,
        cantidad_total_lote_pieles: 0,
        peso_total: 0,
        peso_promedio_estandar_por_piel: 0,
        dividir_lote: false,
        num_sublotes: 0,
        sublotes: [],
        observaciones: '',
        nombre_curtidor: '',
        estado: 'pendiente'
      });
    } else {
      setCurrentItem({ ...item, sublotes: Array.isArray(item.sublotes) ? item.sublotes : [] });
    }
    setSublotes(Array.isArray(item?.sublotes) ? item.sublotes : []);
    setStockDisponible(null); setStockUnidad('');
    setOrdenCompraSearch(''); setProductoSearch('');
    setShowModal(true);
  };

  const handleGenerateSublotes = () => {
    const num = parseInt(currentItem.num_sublotes) || 0;
    if (num > 0) {
      const newSublotes = Array.from({ length: num }, (_, i) => ({
        codigo: `${currentItem.codigo_lote}-SUB${i + 1}`,
        cantidad: 0
      }));
      setSublotes(newSublotes);
    }
  };

  const handleSubloteChange = (index, field, value) => {
    const updated = [...sublotes];
    updated[index][field] = value;
    setSublotes(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();

    // Validar que si el lote está dividido, los sublotes tengan cantidades
    if (currentItem.dividir_lote && sublotes.length > 0) {
      const totalSublotes = sublotes.reduce((s, sub) => s + (parseFloat(sub.cantidad) || 0), 0);
      if (totalSublotes === 0) {
        alert('⚠️ Debe asignar cantidades a los sublotes antes de guardar.');
        return;
      }
    }

    if (!isEditing) {
      const recepcionesSeguras = Array.isArray(recepciones) ? recepciones : [];
      const exists = recepcionesSeguras.some(r => r && r.codigo_lote === currentItem.codigo_lote);
      if (exists) { alert('El CÓDIGO DE LOTE YA EXISTE.'); return; }
    }

    if (!isEditing && currentItem.codigo_producto) {
      if (stockDisponible !== null && stockDisponible <= 0) {
        alert('🚫 No existen hojas disponibles en inventario para el código seleccionado. No es posible registrar la recepción.');
        return;
      }
      if (stockDisponible !== null && currentItem.cantidad_total_lote_hojas > stockDisponible) {
        alert(`⚠️ La cantidad ingresada (${currentItem.cantidad_total_lote_hojas}) supera el stock disponible en Inventario de Materias Primas (${stockDisponible} ${stockUnidad}). Por favor ajuste la cantidad.`);
        return;
      }
    }

    try {
      const dataToSave = {
        ...currentItem,
        sublotes: (currentItem.dividir_lote && Array.isArray(sublotes)) ? sublotes : [],
        numero_proceso: currentItem.codigo_lote,
        // Estado del lote: DIVIDIDO si tiene sublotes, EN_PROCESO si no
        estado: currentItem.dividir_lote && sublotes.length > 0 ? 'dividido' : 'pendiente',
        etapa_actual: 'recepcion'
      };

      let procesoId;
      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
        procesoId = currentItem.id;
      } else {
        const created = await ProcesoProduccion.create(dataToSave);
        procesoId = created.id;
      }

      // AFECTAR INVENTARIO DE MATERIA PRIMA (restar cantidad de hojas)
      if (!isEditing && currentItem.cantidad_total_lote_hojas > 0 && currentItem.codigo_producto) {
        const productosMP = await ProductoTerminado.filter({ codigo: currentItem.codigo_producto, categoria: 'pieles' });
        const productosMPValidos = Array.isArray(productosMP) ? productosMP : [];
        if (productosMPValidos.length > 0) {
          const producto = productosMPValidos[0];
          await base44.entities.MovimientoInventario.create({
            tipo_movimiento: 'salida',
            insumo_id: producto.id,
            cantidad: -(currentItem.cantidad_total_lote_hojas),
            costo_unitario: producto.costo_promedio || 0,
            fecha_movimiento: currentItem.fecha_inicio,
            referencia: `RECEPCION-${currentItem.codigo_lote}`,
            observaciones: `Salida por recepción de lote ${currentItem.codigo_lote}`,
            usuario_id: 'system'
          });
          const movimientos = await MovimientoInventario.filter({ insumo_id: producto.id });
          const nuevoStock = (Array.isArray(movimientos) ? movimientos : []).reduce((sum, m) => sum + (parseFloat(m?.cantidad) || 0), 0);
          await ProductoTerminado.update(producto.id, { stock_actual: nuevoStock });
        }

        // CREAR REGISTROS EN INVENTARIO EN PROCESO (tabla central)
        if (currentItem.dividir_lote && sublotes.length > 0) {
          // Un registro por cada sublote — Estado: EN_PROCESO, Etapa: RECEPCION
          for (const sublote of sublotes) {
            await InventarioEnProceso.create({
              codigo: currentItem.codigo_lote,
              descripcion: `${currentItem.descripcion_producto} — ${sublote.codigo}`,
              codigo_lote: sublote.codigo,
              codigo_lote_padre: currentItem.codigo_lote,
              tipo: 'SUBLOTE',
              origen_modulo: 'recepcion',
              etapa_actual: 'recepcion',
              estado_proceso: 'piel_recibida',
              estado_actual: 'EN_PROCESO',
              cantidad_hojas: parseFloat(sublote.cantidad) || 0,
              cantidad_pieles: parseFloat(sublote.cantidad) || 0,
              peso_actual: ((parseFloat(currentItem.peso_total) || 0) / (sublotes.length || 1)),
              costo_acumulado: ((parseFloat(currentItem.costo_total) || 0) / (sublotes.length || 1)),
              fecha_ingreso_proceso: currentItem.fecha_inicio,
              proceso_origen_id: procesoId
            });
          }
        } else {
          // Lote sin división — Estado: EN_PROCESO, Etapa: RECEPCION
          await InventarioEnProceso.create({
            codigo: currentItem.codigo_lote,
            descripcion: currentItem.descripcion_producto || '',
            codigo_lote: currentItem.codigo_lote,
            tipo: 'LOTE',
            origen_modulo: 'recepcion',
            etapa_actual: 'recepcion',
            estado_proceso: 'piel_recibida',
            estado_actual: 'EN_PROCESO',
            cantidad_hojas: currentItem.cantidad_total_lote_hojas || 0,
            cantidad_pieles: currentItem.cantidad_total_lote_pieles || 0,
            peso_actual: parseFloat(currentItem.peso_total) || 0,
            costo_acumulado: parseFloat(currentItem.costo_total) || 0,
            fecha_ingreso_proceso: currentItem.fecha_inicio,
            proceso_origen_id: procesoId
          });
        }
        console.log(`✅ Tabla central (InventarioEnProceso) actualizada para lote ${currentItem.codigo_lote}`);
      }

      setShowModal(false);
      setCurrentItem(null);
      await loadData();
      alert('Recepción guardada con éxito.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar la recepción: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta recepción?')) return;
    try {
      await ProcesoProduccion.delete(id);
      loadData();
      alert('Recepción eliminada.');
    } catch (error) { console.error('Error deleting:', error); }
  };

  const handleViewDetails = (item) => { setSelectedItem(item); setShowDetailModal(true); };

  const handleViewHistory = async (item) => {
    setLoading(true);
    try {
      const [allProcesos, invEnProceso] = await Promise.all([
        ProcesoProduccion.filter({ codigo_lote: item.codigo_lote }),
        InventarioEnProceso.list()
      ]);
      const procesosValidos = Array.isArray(allProcesos) ? allProcesos : [];
      const history = {
        recepcion: procesosValidos.filter(p => p && p.tipo_proceso === 'recepcion'),
        remojo: procesosValidos.filter(p => p && p.tipo_proceso === 'limpieza' && p.seccion === 'remojo'),
        pelambre: procesosValidos.filter(p => p && p.tipo_proceso === 'limpieza' && p.seccion === 'pelambre'),
        curtido: procesosValidos.filter(p => p && p.tipo_proceso === 'curtido'),
        recurtido: procesosValidos.filter(p => p && p.tipo_proceso === 'recurtido'),
      };
      // Estado actual en tabla central
      const registrosCentral = (Array.isArray(invEnProceso) ? invEnProceso : [])
        .filter(i => i.codigo_lote === item.codigo_lote || i.codigo_lote_padre === item.codigo_lote);
      history.tabla_central = registrosCentral;
      setHistoryData(history);
      setSelectedItem(item);
      setShowHistoryModal(true);
    } catch (e) {
      console.error(e);
      alert("Error cargando historial");
    } finally { setLoading(false); }
  };

  const headers = ['Código Lote', 'Fecha', 'Proveedor', 'Código', 'Descripción', 'Cant. Hojas', 'Cant. Pieles', 'Peso Total', 'Estado', 'Acciones'];
  const renderRow = (item) => {
    const proveedor = proveedores.find(p => p.id === item.proveedor_id);
    return (
      <tr key={item.id}>
        <td className="font-mono font-bold">{item.codigo_lote}</td>
        <td>{new Date(item.fecha_inicio).toLocaleDateString()}</td>
        <td>{proveedor?.nombre || 'N/A'}</td>
        <td>{item.codigo_producto || 'N/A'}</td>
        <td>{item.descripcion_producto || item.nombre_inventario || 'N/A'}</td>
        <td>{item.cantidad_total_lote_hojas || item.cantidad_total_lote || 0}</td>
        <td>{item.cantidad_total_lote_pieles || item.cantidad_pieles || 0}</td>
        <td>{item.peso_total} kg</td>
        <td>
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            item.estado === 'dividido' ? 'bg-orange-100 text-orange-700' :
            item.estado === 'completado' ? 'bg-green-100 text-green-700' :
            'bg-blue-100 text-blue-700'
          }`}>{item.dividir_lote ? 'DIVIDIDO' : (item.estado || 'pendiente').toUpperCase()}</span>
        </td>
        <td>
          <div className="flex space-x-1">
            <Button variant="outline" size="sm" onClick={() => { setLoteConsolidado(item.codigo_lote); setShowConsolidadoModal(true); }} title="Ver Consolidado Costos"><Table className="w-4 h-4 text-emerald-600" /></Button>
            <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} title="Ver Detalle"><Eye className="w-4 h-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => handleViewHistory(item)} title="Ver Seguimiento"><FileText className="w-4 h-4 text-blue-600" /></Button>
            <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)} title="Editar"><Edit className="w-4 h-4" /></Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Recepción de Materia Prima"
        description="Gestiona el ingreso de pieles. Los lotes registrados aquí alimentan la tabla central de producción."
        onPrint={() => window.print()}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />Nueva Recepción
          </Button>
        }
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Recepciones</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={recepciones} renderRow={renderRow} />}
        </CardContent>
      </Card>

      {/* MODAL CREAR/EDITAR */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Recepción</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>ID Orden de Compra <span className="text-xs text-slate-400">(opcional)</span></Label>
                <div className="space-y-1">
                  <Input placeholder="Buscar orden..." value={ordenCompraSearch} onChange={e => setOrdenCompraSearch(e.target.value)} className="h-8 text-xs" />
                  <Select value={currentItem?.id_orden_compra_origen || ''} onValueChange={v => {
                    if (v === '__clear__') { setCurrentItem({ ...currentItem, id_orden_compra_origen: '', proveedor_id: '', no_documento: '' }); setOrdenCompraSearch(''); return; }
                    const oc = ordenesCompra.find(o => o.id === v);
                    // Buscar proveedor: primero por proveedor_id, si no por codigo_proveedor
                    const proveedorEncontrado = proveedores.find(p => p.id === oc?.proveedor_id) || proveedores.find(p => p.codigo === oc?.codigo_proveedor);
                    setCurrentItem({
                      ...currentItem,
                      id_orden_compra_origen: v,
                      no_documento: oc?.numero_documento || oc?.numero_id || '',
                      proveedor_id: proveedorEncontrado?.id || oc?.proveedor_id || ''
                    });
                    setOrdenCompraSearch('');
                  }}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar (opcional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__clear__">— Sin orden —</SelectItem>
                      {ordenesCompra.filter(oc => oc.id).filter(oc => {
                        if (!ordenCompraSearch) return true;
                        const s = ordenCompraSearch.toLowerCase();
                        const prov = proveedores.find(p => p.id === oc.proveedor_id);
                        return (oc.numero_id || '').toLowerCase().includes(s) || (prov?.nombre || '').toLowerCase().includes(s);
                      }).map(oc => {
                        const prov = proveedores.find(p => p.id === oc.proveedor_id);
                        return <SelectItem key={oc.id} value={oc.id}>{oc.numero_id || oc.numero_documento} | {prov?.nombre || 'N/A'}</SelectItem>;
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Código de Lote (automático) *</Label>
                <Input value={currentItem?.codigo_lote || ''} readOnly className="bg-gray-100 font-mono font-bold text-blue-700" />
                <p className="text-xs text-slate-500 mt-1">Código único autogenerado</p>
              </div>
              <div><Label>Fecha de Recepción</Label><Input type="date" value={currentItem?.fecha_inicio || ''} onChange={e => setCurrentItem({...currentItem, fecha_inicio: e.target.value})} /></div>
              <div>
                <Label>Proveedor</Label>
                <Select value={currentItem?.proveedor_id || ''} onValueChange={v => setCurrentItem({...currentItem, proveedor_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                  <SelectContent>
                    {proveedores.filter(p => p.id).map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>No. de Documento</Label><Input value={currentItem?.no_documento || ''} onChange={e => setCurrentItem({...currentItem, no_documento: e.target.value})} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código PCTO. * <span className="text-xs text-slate-400">(Inventario Materias Primas)</span></Label>
                <Input placeholder="Buscar por código o descripción..." value={productoSearch} onChange={e => setProductoSearch(e.target.value)} className="h-8 text-xs mb-1" />
                <Select value={currentItem?.codigo_producto || ''} onValueChange={v => {
                  const p = productos.find(pr => pr.codigo === v);
                  const stockReal = p?.stock_actual ?? 0;
                  setCostoPromedioProducto(p?.costo_promedio || 0);
                  setStockDisponible(stockReal);
                  setStockUnidad(p?.unidad_medida || 'hojas');
                  setProductoSearch('');
                  const hojas = parseFloat(currentItem?.cantidad_total_lote_hojas) || 0;
                  setCurrentItem({ ...currentItem, codigo_producto: v, descripcion_producto: p?.descripcion || '', costo_promedio: p?.costo_promedio || 0, costo_total: hojas * (p?.costo_promedio || 0) });
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar código de materia prima" /></SelectTrigger>
                  <SelectContent>
                    {productos.filter(p => p.codigo).filter(p => !productoSearch || (p.codigo || '').toLowerCase().includes(productoSearch.toLowerCase()) || (p.descripcion || '').toLowerCase().includes(productoSearch.toLowerCase()))
                      .map(p => (
                        <SelectItem key={p.id} value={p.codigo}>
                          {p.codigo} — {p.descripcion} {p.stock_actual > 0 ? `(Stock: ${p.stock_actual})` : '⚠️ Sin stock'}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {stockDisponible !== null && (
                  <div className={`text-xs px-2 py-1 rounded mt-1 font-medium flex items-center gap-1 ${stockDisponible > 0 ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {stockDisponible > 0 ? '📦' : '🚫'}
                    {stockDisponible > 0
                      ? <span>Disponible en inventario: <strong>{stockDisponible} {stockUnidad}</strong></span>
                      : <span><strong>No existen hojas disponibles en inventario para el código seleccionado.</strong></span>
                    }
                  </div>
                )}
              </div>
              <div>
                <Label>Nombre del Producto *</Label>
                <Select value={currentItem?.descripcion_producto || ''} onValueChange={v => {
                  const p = productos.find(pr => pr.descripcion === v);
                  if (p) { setStockDisponible(p.stock_actual ?? null); setStockUnidad(p.unidad_medida || ''); setCostoPromedioProducto(p.costo_promedio || 0); }
                  setCurrentItem({ ...currentItem, codigo_producto: p ? p.codigo : currentItem.codigo_producto, descripcion_producto: v });
                }}>
                  <SelectTrigger><SelectValue placeholder="Buscar por nombre" /></SelectTrigger>
                  <SelectContent>
                    {productos.filter(p => p.descripcion).sort((a, b) => (a.descripcion || '').localeCompare(b.descripcion || '')).map(p => <SelectItem key={p.id} value={p.descripcion}>{p.descripcion}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div><Label>Cantidad Hojas</Label><Input type="text" inputMode="numeric" value={currentItem?.cantidad_total_lote_hojas || ''} onChange={e => {
                const val = parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0;
                const costo = parseFloat(currentItem?.costo_promedio) || 0;
                setCurrentItem({...currentItem, cantidad_total_lote_hojas: val, costo_total: val * costo});
              }} /></div>
              <div>
                <Label>Costo Unitario</Label>
                <Input type="number" min="0" step="0.01"
                  value={currentItem?.costo_promedio || ''}
                  onChange={e => {
                    const costo = parseFloat(e.target.value) || 0;
                    const hojas = parseFloat(currentItem?.cantidad_total_lote_hojas) || 0;
                    setCurrentItem({...currentItem, costo_promedio: costo, costo_total: hojas * costo});
                  }}
                  className="font-bold"
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Costo Total <span className="text-xs text-slate-400">(calculado)</span></Label>
                <Input type="number" value={currentItem?.costo_total || 0} readOnly className="bg-green-50 font-bold text-green-700" />
                <p className="text-xs text-slate-400 mt-0.5">Hojas × Costo Unitario</p>
              </div>
              <div><Label>Cantidad Pieles</Label><Input type="text" inputMode="numeric" value={currentItem?.cantidad_total_lote_pieles || ''} onChange={e => setCurrentItem({...currentItem, cantidad_total_lote_pieles: parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0})} /></div>
              <div><Label>Peso Total Hojas (kg)</Label><Input type="text" inputMode="decimal" value={currentItem?.peso_total || ''} onChange={e => {
                const val = parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0;
                const hojas = parseFloat(currentItem?.cantidad_total_lote_hojas) || 1;
                setCurrentItem({...currentItem, peso_total: val, peso_promedio_estandar_por_piel: val / hojas});
              }} /></div>
              <div><Label>Peso Promedio/Hoja (kg)</Label><Input value={(currentItem?.peso_promedio_estandar_por_piel || 0).toFixed(2)} readOnly className="bg-blue-50" /></div>
            </div>

            <div><Label>Nombre Curtidor</Label><Input value={currentItem?.nombre_curtidor || ''} onChange={e => setCurrentItem({...currentItem, nombre_curtidor: e.target.value})} /></div>
            <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} /></div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox checked={currentItem?.dividir_lote || false} onCheckedChange={v => setCurrentItem({...currentItem, dividir_lote: v})} id="dividir" />
                <Label htmlFor="dividir" className="font-semibold cursor-pointer">Dividir Lote <span className="text-xs text-slate-400">(opcional)</span></Label>
              </div>
              {currentItem?.dividir_lote && (
                <div className="space-y-2">
                  <div className="flex gap-2 items-end">
                    <div className="flex-grow"><Label>¿Cuántos sublotes?</Label><Input type="number" value={currentItem?.num_sublotes || ''} onChange={e => setCurrentItem({...currentItem, num_sublotes: parseInt(e.target.value) || 0})} /></div>
                    <Button type="button" onClick={handleGenerateSublotes}>Generar Sublotes</Button>
                    {sublotes.length > 0 && <Button type="button" variant="outline" onClick={() => setShowSublotesModal(true)}>Editar Sublotes ({sublotes.length})</Button>}
                  </div>
                  {sublotes.length > 0 && (
                    <div className="border rounded overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-amber-100"><tr><th className="border p-1">Código</th><th className="border p-1">Cantidad</th><th className="border p-1">Costo Total</th></tr></thead>
                        <tbody>
                          {sublotes.map((sub, idx) => {
                            const costoP = parseFloat(currentItem?.costo_promedio) || costoPromedioProducto;
                            return (
                              <tr key={idx} className="border-t">
                                <td className="border p-1 font-mono font-bold">{sub.codigo}</td>
                                <td className="border p-1 text-right">{sub.cantidad}</td>
                                <td className="border p-1 text-right">{formatCurrency((parseFloat(sub.cantidad) || 0) * costoP)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="text-xs text-amber-700 font-medium">⚠️ Al guardar con sublotes, SOLO los sublotes podrán usarse en los procesos siguientes.</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL SUBLOTES */}
      <Dialog open={showSublotesModal} onOpenChange={setShowSublotesModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Configurar Sublotes</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sublotes.map((sub, index) => {
              const costoP = parseFloat(currentItem?.costo_promedio) || costoPromedioProducto;
              const cantidad = parseFloat(sub.cantidad) || 0;
              return (
                <div key={index} className="grid grid-cols-4 gap-2 p-2 border rounded">
                  <div><Label>Código</Label><Input value={sub.codigo} onChange={e => handleSubloteChange(index, 'codigo', e.target.value)} /></div>
                  <div><Label>Cantidad</Label><Input type="number" value={sub.cantidad} onChange={e => {
                    const updated = [...sublotes];
                    updated[index].cantidad = parseFloat(e.target.value) || 0;
                    setSublotes(updated);
                  }} /></div>
                  <div><Label>Costo Unit.</Label><Input value={formatCurrency(costoP)} readOnly className="bg-blue-50 text-xs" /></div>
                  <div><Label>Costo Total</Label><Input value={formatCurrency(cantidad * costoP)} readOnly className="bg-green-50 text-xs" /></div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end pt-4"><Button onClick={() => setShowSublotesModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {/* MODAL DETALLE */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de Recepción</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Código Lote:</span> <span className="font-mono font-bold">{selectedItem.codigo_lote}</span></p>
              <p><span className="font-semibold">Fecha:</span> {new Date(selectedItem.fecha_inicio).toLocaleDateString()}</p>
              <p><span className="font-semibold">Producto:</span> {selectedItem.descripcion_producto || 'N/A'}</p>
              <p><span className="font-semibold">Cant. Hojas:</span> {selectedItem.cantidad_total_lote_hojas}</p>
              <p><span className="font-semibold">Peso Total:</span> {selectedItem.peso_total} kg</p>
              <p><span className="font-semibold">Estado:</span> {selectedItem.dividir_lote ? 'DIVIDIDO' : selectedItem.estado}</p>
              {selectedItem.sublotes?.length > 0 && (
                <div>
                  <p className="font-semibold">Sublotes ({selectedItem.sublotes.length}):</p>
                  <ul className="list-disc pl-5 text-xs">
                    {selectedItem.sublotes.map((sub, idx) => <li key={idx}>{sub.codigo} — Cant: {sub.cantidad}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {/* MODAL HISTORIAL */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Seguimiento de Lote: {selectedItem?.codigo_lote}</DialogTitle></DialogHeader>
          <div className="space-y-5">
            {/* TABLA CENTRAL */}
            <div>
              <h3 className="font-bold text-base border-b pb-1 mb-2 bg-indigo-50 p-2">📋 Tabla Central (InventarioEnProceso)</h3>
              {historyData.tabla_central?.length > 0 ? (
                <table className="w-full text-xs border">
                  <thead><tr className="bg-indigo-50"><th className="p-1 border">Código Lote</th><th className="p-1 border">Tipo</th><th className="p-1 border">Etapa</th><th className="p-1 border">Estado</th><th className="p-1 border">Cant. Hojas</th><th className="p-1 border">Peso</th></tr></thead>
                  <tbody>
                    {historyData.tabla_central.map(r => (
                      <tr key={r.id} className="border-t">
                        <td className="p-1 border font-mono font-bold">{r.codigo_lote}</td>
                        <td className="p-1 border">{r.tipo || 'LOTE'}</td>
                        <td className="p-1 border font-semibold text-blue-700">{(r.etapa_actual || '').toUpperCase()}</td>
                        <td className="p-1 border"><span className={`px-1 rounded text-xs ${r.estado_actual === 'FINALIZADO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{r.estado_actual || r.estado_proceso}</span></td>
                        <td className="p-1 border text-right">{r.cantidad_hojas}</td>
                        <td className="p-1 border text-right">{r.peso_actual} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="text-gray-400 text-xs italic">Sin registros en tabla central.</p>}
            </div>

            {[
              { key: 'recepcion', label: 'Recepción', color: 'bg-gray-50' },
              { key: 'remojo', label: 'Remojo', color: 'bg-blue-50' },
              { key: 'pelambre', label: 'Pelambre', color: 'bg-yellow-50' },
              { key: 'curtido', label: 'Curtido', color: 'bg-emerald-50' },
              { key: 'recurtido', label: 'Recurtido', color: 'bg-purple-50' },
            ].map(({ key, label, color }) => (
              <div key={key}>
                <h3 className={`font-bold text-base border-b pb-1 mb-2 ${color} p-2`}>{label}</h3>
                {historyData[key]?.length > 0 ? (
                  <table className="w-full text-xs border">
                    <thead><tr className={color}><th className="p-1 border">Fecha</th><th className="p-1 border">Estado</th><th className="p-1 border">Info</th></tr></thead>
                    <tbody>
                      {historyData[key].map(p => (
                        <tr key={p.id} className="border-t">
                          <td className="p-1 border">{new Date(p.fecha_inicio).toLocaleDateString()}</td>
                          <td className="p-1 border">{p.estado}</td>
                          <td className="p-1 border text-xs">{p.seccion ? `Sección: ${p.seccion}` : ''} {p.nombre_color ? `Color: ${p.nombre_color}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="text-gray-400 text-xs italic">Sin registros.</p>}
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4"><Button onClick={() => setShowHistoryModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && (
        <LoteDetalleConsolidado open={showConsolidadoModal} onOpenChange={setShowConsolidadoModal} codigoLote={loteConsolidado} />
      )}
    </div>
  );
}