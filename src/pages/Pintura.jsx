import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, InventarioEnProceso, ProductoTerminado, MovimientoInventario, ColorPintura, ProductoCatalogo } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Search, X, CheckCircle2, AlertTriangle, FolderOpen, FileText } from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const formatDate = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('es-CO') : 'N/A';
const fmt2 = (v) => (parseFloat(v) || 0).toFixed(2);

const TIPOS_ACABADO = [
  { value: 'NAPA', label: 'NAPA' },
  { value: 'NAPA_MATE', label: 'NAPA MATE' },
  { value: 'OPACO', label: 'OPACO' },
  { value: 'ENVEJECIDO', label: 'ENVEJECIDO' },
  { value: 'OTROS', label: 'OTROS' },
];
const COLORES_BASE = ['NEGRO', 'CAFÉ', 'AZUL', 'MIEL', 'BLANCO', 'QUEBRACHO', 'ROJO', 'VERDE'];

const newSublote = (idx, idPedido) => ({
  id_temp: `sub-${Date.now()}-${idx}`,
  codigo_sublote: idPedido ? `${idPedido}-S${String(idx + 1).padStart(2, '0')}` : `SUB-${String(idx + 1).padStart(2, '0')}`,
  producto_terminado_id: '', producto_terminado_codigo: '', producto_terminado_nombre: '',
  tipo_acabado: '', color_final: '', cantidad_hojas: 0, pct_participacion: 0,
  observaciones: '', estado: 'pendiente', insumos: [], mano_obra: [],
  hojas_iniciales: 0, hojas_buenas: 0, hojas_defectuosas: 0, hojas_rechazadas: 0, obs_calidad: '',
});

// ── Estado badge helper ────────────────────────────────────────────────────
const estadoBadge = (estado) => {
  const map = {
    terminado: 'bg-green-100 text-green-800 border-green-300',
    parcial: 'bg-blue-100 text-blue-800 border-blue-300',
    pendiente: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    borrador: 'bg-gray-100 text-gray-700 border-gray-300',
    en_proceso: 'bg-purple-100 text-purple-800 border-purple-300',
    anulado: 'bg-red-100 text-red-700 border-red-300',
  };
  const label = {
    terminado: 'Finalizado', parcial: 'En Proceso',
    pendiente: 'Borrador', borrador: 'Borrador',
    en_proceso: 'En Proceso', anulado: 'Anulado',
  };
  const cls = map[estado] || 'bg-gray-100 text-gray-700 border-gray-300';
  return <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${cls}`}>{label[estado] || (estado || 'Borrador').toUpperCase()}</span>;
};

export default function Pintura() {
  const [procesos, setProcesos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [insumosQuimicos, setInsumosQuimicos] = useState([]);
  const [productosTerminados, setProductosTerminados] = useState([]);
  const [coloresCatalogo, setColoresCatalogo] = useState([]);
  const [catalogoProductos, setCatalogoProductos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  const [searchCuero, setSearchCuero] = useState('');
  const [filtroCueroColor, setFiltroCueroColor] = useState('');
  const [filtroCueroEtapa, setFiltroCueroEtapa] = useState('');
  const [cueroSeleccionado, setCueroSeleccionado] = useState(null);
  const [hojasAConsumir, setHojasAConsumir] = useState(0);
  const [sublotes, setSublotes] = useState([]);
  const [subloteActivoIdx, setSubloteActivoIdx] = useState(0);

  const subloteActivo = sublotes[subloteActivoIdx] || null;
  const setSubloteActivo = (changes) => setSublotes(prev => prev.map((s, i) => i === subloteActivoIdx ? { ...s, ...changes } : s));

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, inventarioData, productosTermData, coloresData, catalogoData] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'pintura' }),
        Insumo.list(), InventarioEnProceso.list(), ProductoTerminado.list(), ColorPintura.list(), ProductoCatalogo.list()
      ]);
      setProcesos(Array.isArray(procesosData) ? procesosData : []);
      setInsumosQuimicos(Array.isArray(insumosData) ? insumosData : []);
      setInventarioEnProceso(Array.isArray(inventarioData) ? inventarioData : []);
      setProductosTerminados(Array.isArray(productosTermData) ? productosTermData : []);
      setColoresCatalogo(Array.isArray(coloresData) ? coloresData.filter(c => c.estado === 'activo') : []);
      setCatalogoProductos(Array.isArray(catalogoData) ? catalogoData.filter(p => p.estado === 'activo') : []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Al editar un borrador, las hojas comprometidas por ESE documento se suman de vuelta
  // para que el cuero aparezca como "disponible" y el usuario pueda seguir trabajando.
  // Usamos hojasAConsumir (estado local) que refleja lo que ya estaba guardado al cargar.
  const esBorradorEdicion = isEditing && currentItem?.estado_pedido_pintura !== 'terminado';
  const hojasComprometidasEdicion = esBorradorEdicion ? hojasAConsumir : 0;

  const cueroDisponible = inventarioEnProceso.filter(i => {
    const etapaOk = i.etapa_actual === 'recurtido' || i.etapa_actual === 'curtido' || i.etapa_actual === 'limpieza' || i.etapa_actual === 'pintura';
    if (!etapaOk) return false;
    // Incluir el cuero seleccionado actual aunque tenga 0 hojas (ya comprometidas en este borrador)
    if (cueroSeleccionado?.id === i.id) return true;
    return (i.cantidad_hojas || 0) > 0;
  });
  const cueroFiltrado = cueroDisponible.filter(i => {
    const matchSearch = !searchCuero || (i.codigo_lote || '').toLowerCase().includes(searchCuero.toLowerCase()) || (i.descripcion || '').toLowerCase().includes(searchCuero.toLowerCase()) || (i.color_base || '').toLowerCase().includes(searchCuero.toLowerCase());
    const matchColor = !filtroCueroColor || (i.color_base || '').toUpperCase() === filtroCueroColor;
    const matchEtapa = !filtroCueroEtapa || i.etapa_actual === filtroCueroEtapa;
    return matchSearch && matchColor && matchEtapa;
  });

  // Hojas reales disponibles del cuero seleccionado (sumando las comprometidas por este doc en edición)
  const hojasRealesDisponibles = cueroSeleccionado
    ? (cueroSeleccionado.cantidad_hojas || 0) + hojasComprometidasEdicion
    : 0;

  const handleOpenModal = (item = null) => {
    if (item) {
      // Para edición siempre usar cargarPedidoCompleto (se llama después del fetch por ID)
      // Esta rama solo se llama directamente para nuevo pedido
      cargarPedidoCompleto(item);
      return;
    }
    // Nuevo pedido
    setIsEditing(false);
    const year = new Date().getFullYear();
    const consecutivos = procesos.map(p => { const m = p.id_consecutivo?.match(/PINT-(\d+)-\d{4}/); return m ? parseInt(m[1]) : 0; });
    const next = consecutivos.length > 0 ? Math.max(...consecutivos) + 1 : 1;
    const idConsecutivo = `PINT-${String(next).padStart(4, '0')}-${year}`;
    setCurrentItem({
      tipo_proceso: 'pintura', numero_proceso: idConsecutivo, id_consecutivo: idConsecutivo,
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_entrega_pintor: new Date().toISOString().split('T')[0],
      fecha_inicio_pintura: new Date().toISOString().split('T')[0],
      pintor_responsable: '', estado_pedido_pintura: 'pendiente', observaciones: '', finalizar_pintura: false,
    });
    setCueroSeleccionado(null); setHojasAConsumir(0); setSublotes([]); setSubloteActivoIdx(0);
    setSearchCuero(''); setFiltroCueroColor(''); setFiltroCueroEtapa('');
    setMostrarSelectorContinuar(false); setContinuarBusqueda('');
    setBusquedaProducto(''); setBusquedaNombre('');
    setMostrarListaProducto(false); setMostrarListaNombre(false);
    setShowModal(true);
  };

  const handleSeleccionarCuero = (id) => {
    const inv = inventarioEnProceso.find(i => i.id === id);
    if (!inv) return;
    setCueroSeleccionado(inv); setHojasAConsumir(0); setSublotes([]); setSubloteActivoIdx(0);
    setCurrentItem(prev => ({ ...prev, inv_proceso_id: inv.id, codigo_lote: inv.codigo_lote }));
  };

  const totalHojasAsignadas = sublotes.reduce((s, sub) => s + (parseFloat(sub.cantidad_hojas) || 0), 0);
  const hojasRestantesDistribucion = hojasAConsumir - totalHojasAsignadas;

  const recalcPct = (subs, total) => subs.map(s => ({
    ...s,
    pct_participacion: total > 0 ? ((parseFloat(s.cantidad_hojas) || 0) / total * 100) : 0,
    hojas_iniciales: parseFloat(s.cantidad_hojas) || 0,
  }));

  const handleAgregarSublote = () => {
    const idx = sublotes.length;
    setSublotes(prev => [...prev, newSublote(idx, currentItem?.id_consecutivo || '')]);
    setSubloteActivoIdx(idx);
  };
  const handleEliminarSublote = (idx) => {
    setSublotes(prev => prev.filter((_, i) => i !== idx));
    setSubloteActivoIdx(Math.max(0, subloteActivoIdx - 1));
    setBusquedaProducto(''); setBusquedaNombre('');
    setMostrarListaProducto(false); setMostrarListaNombre(false);
  };
  const handleSubloteFieldChange = (field, value) => setSubloteActivo({ [field]: value });
  // Al cambiar de sublote activo limpiar buscadores
  const handleCambiarSubloteActivo = (idx) => {
    setSubloteActivoIdx(idx);
    setBusquedaProducto(''); setBusquedaNombre('');
    setMostrarListaProducto(false); setMostrarListaNombre(false);
  };

  // Seleccionar producto terminado del inventario de productos terminados para el sublote
  const handleSeleccionarProductoTerminado = (productoId) => {
    const prod = productosTerminados.find(p => p.id === productoId);
    if (!prod) return;
    setSubloteActivo({
      producto_terminado_id: prod.id,
      producto_terminado_codigo: prod.codigo,
      producto_terminado_nombre: prod.descripcion || '',
      tipo_acabado: prod.acabado || subloteActivo?.tipo_acabado || '',
    });
    setBusquedaProducto('');
    setBusquedaNombre('');
    setMostrarListaProducto(false);
    setMostrarListaNombre(false);
  };
  // Alias para compatibilidad con onMouseDown existente
  const handleSeleccionarProductoCatalogo = handleSeleccionarProductoTerminado;
  const handleHojasSubloChange = (value) => {
    setSublotes(prev => { const u = prev.map((s, i) => i === subloteActivoIdx ? { ...s, cantidad_hojas: parseFloat(value) || 0 } : s); return recalcPct(u, hojasAConsumir); });
  };

  const todosLosItems = [
    ...insumosQuimicos.map(i => ({ id: i.id, codigo: i.codigo || '', descripcion: i.nombre || i.descripcion || '', costo_promedio: i.costo_promedio || 0 })),
    ...productosTerminados.map(p => ({ id: p.id, codigo: p.codigo || '', descripcion: p.descripcion || '', costo_promedio: p.costo_promedio || 0 }))
  ].filter(i => i.codigo);

  const handleAddInsumo = () => setSubloteActivo({ insumos: [...(subloteActivo?.insumos || []), { item_id: '', codigo: '', producto: '', cantidad: 0, costo_unitario: 0, iva: 0.19, valor_total: 0 }] });
  const handleRemoveInsumo = (idx) => setSubloteActivo({ insumos: (subloteActivo?.insumos || []).filter((_, i) => i !== idx) });
  const handleInsumoChange = (insIdx, field, value) => {
    const ins = [...(subloteActivo?.insumos || [])];
    ins[insIdx] = { ...ins[insIdx], [field]: value };
    if (field === 'item_id') { const f = todosLosItems.find(i => i.id === value); if (f) { ins[insIdx].codigo = f.codigo; ins[insIdx].producto = f.descripcion; ins[insIdx].costo_unitario = f.costo_promedio; } }
    const cant = parseFloat(field === 'cantidad' ? value : ins[insIdx].cantidad) || 0;
    const cu = parseFloat(field === 'costo_unitario' ? value : ins[insIdx].costo_unitario) || 0;
    const iva = parseFloat(ins[insIdx].iva) || 0;
    const sub = cant * cu;
    ins[insIdx].valor_total = sub + sub * iva;
    setSubloteActivo({ insumos: ins });
  };

  const handleAddManoObra = () => setSubloteActivo({ mano_obra: [...(subloteActivo?.mano_obra || []), { detalle: '', cantidad_hojas: 0, valor_por_hoja: 0, total: 0, observacion: '' }] });
  const handleRemoveManoObra = (idx) => setSubloteActivo({ mano_obra: (subloteActivo?.mano_obra || []).filter((_, i) => i !== idx) });
  const handleManoObraChange = (idx, field, value) => {
    const mo = [...(subloteActivo?.mano_obra || [])];
    mo[idx] = { ...mo[idx], [field]: value };
    if (field === 'cantidad_hojas' || field === 'valor_por_hoja') {
      mo[idx].total = (parseFloat(field === 'cantidad_hojas' ? value : mo[idx].cantidad_hojas) || 0) * (parseFloat(field === 'valor_por_hoja' ? value : mo[idx].valor_por_hoja) || 0);
    }
    setSubloteActivo({ mano_obra: mo });
  };

  const getCostosSublote = (sub) => {
    const totalHojasLote = parseFloat(cueroSeleccionado?.cantidad_hojas) || 1;
    const costoAcumLote = parseFloat(cueroSeleccionado?.costo_acumulado) || 0;
    const hojasSubl = parseFloat(sub?.cantidad_hojas) || 0;
    const costoHeredado = totalHojasLote > 0 ? (hojasSubl / totalHojasLote) * costoAcumLote : 0;
    const costoInsumos = (sub?.insumos || []).reduce((s, i) => s + (parseFloat(i.valor_total) || 0), 0);
    const costoManoObra = (sub?.mano_obra || []).reduce((s, m) => s + (parseFloat(m.total) || 0), 0);
    const costoTotal = costoHeredado + costoInsumos + costoManoObra;
    const hojasBuenas = parseFloat(sub?.hojas_buenas) || hojasSubl;
    return { costoHeredado, costoInsumos, costoManoObra, costoTotal, costoPorHoja: hojasBuenas > 0 ? costoTotal / hojasBuenas : 0, hojasSubl, hojasBuenas };
  };

  const getResumen = () => {
    const costoHeredadoTotal = sublotes.reduce((s, sub) => s + getCostosSublote(sub).costoHeredado, 0);
    const costoInsumosTotal = sublotes.reduce((s, sub) => s + getCostosSublote(sub).costoInsumos, 0);
    const costoMOTotal = sublotes.reduce((s, sub) => s + getCostosSublote(sub).costoManoObra, 0);
    const costoTotal = costoHeredadoTotal + costoInsumosTotal + costoMOTotal;
    const hojasBuenasTotal = sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_buenas) || 0), 0);
    const hojasDef = sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_defectuosas) || 0), 0);
    const hojasRech = sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_rechazadas) || 0), 0);
    const costoPorHoja = hojasBuenasTotal > 0 ? costoTotal / hojasBuenasTotal : 0;
    return { costoHeredadoTotal, costoInsumosTotal, costoMOTotal, costoTotal, hojasBuenasTotal, hojasDef, hojasRech, costoPorHoja };
  };

  // ── Validación consolidada para "Finalizar" ────────────────────────────────
  const validarParaFinalizar = () => {
    const errores = [];
    if (sublotes.length === 0) { errores.push('No existen sublotes registrados.'); return errores; }
    for (const sub of sublotes) {
      const ini = parseFloat(sub.cantidad_hojas) || 0;
      if (!sub.tipo_acabado) errores.push(`Sublote ${sub.codigo_sublote}: falta el Tipo de Acabado.`);
      if (!sub.color_final) errores.push(`Sublote ${sub.codigo_sublote}: falta el Color Final.`);
      if (ini === 0) errores.push(`Sublote ${sub.codigo_sublote}: Cantidad de Hojas es 0.`);
      const buenas = parseFloat(sub.hojas_buenas) || 0;
      const def = parseFloat(sub.hojas_defectuosas) || 0;
      const rech = parseFloat(sub.hojas_rechazadas) || 0;
      const suma = buenas + def + rech;
      if (ini > 0 && suma !== ini) errores.push(`Sublote ${sub.codigo_sublote} (${sub.color_final}): ${buenas}+${def}+${rech}=${suma} ≠ ${ini} hojas iniciales.`);
    }
    const totalBuenasConsolidado = sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_buenas) || 0) + (parseFloat(sub.hojas_defectuosas) || 0) + (parseFloat(sub.hojas_rechazadas) || 0), 0);
    if (Math.abs(totalBuenasConsolidado - hojasAConsumir) > 0.01) {
      errores.push(`El consolidado (${totalBuenasConsolidado} hojas) no coincide con las hojas consumidas en la orden (${hojasAConsumir}).`);
    }
    return errores;
  };

  const todosSublotesValidados = sublotes.length > 0 && sublotes.every(sub => {
    const ini = parseFloat(sub.cantidad_hojas) || 0;
    if (ini === 0) return false;
    const suma = (parseFloat(sub.hojas_buenas) || 0) + (parseFloat(sub.hojas_defectuosas) || 0) + (parseFloat(sub.hojas_rechazadas) || 0);
    return suma === ini;
  }) && Math.abs(sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_buenas) || 0) + (parseFloat(sub.hojas_defectuosas) || 0) + (parseFloat(sub.hojas_rechazadas) || 0), 0) - hojasAConsumir) < 0.01;

  // Estado para modal de ver detalle de sublote
  const [showSubloteDetalle, setShowSubloteDetalle] = useState(false);
  const [subloteDetalleIdx, setSubloteDetalleIdx] = useState(null);

  // Estado para modal de sublotes en listado principal
  const [showSubletesModal, setShowSubletesModal] = useState(false);
  const [subletesModalItem, setSubletesModalItem] = useState(null);

  // Estado para modal "Continuar Pedido"
  const [showContinuarModal, setShowContinuarModal] = useState(false);
  const [pedidoPendienteSeleccionado, setPedidoPendienteSeleccionado] = useState('');
  const [pedidoPreviewCompleto, setPedidoPreviewCompleto] = useState(null);

  // Estado para selector inline dentro del modal
  const [mostrarSelectorContinuar, setMostrarSelectorContinuar] = useState(false);
  const [continuarBusqueda, setContinuarBusqueda] = useState('');

  // Estado para buscadores de producto terminado en sublote (por código y por nombre)
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [mostrarListaProducto, setMostrarListaProducto] = useState(false);
  const [busquedaNombre, setBusquedaNombre] = useState('');
  const [mostrarListaNombre, setMostrarListaNombre] = useState(false);

  // Pedidos en estado BORRADOR o EN PROCESO (pendientes)
  const pedidosPendientes = procesos.filter(p =>
    p.estado_pedido_pintura === 'borrador' ||
    p.estado_pedido_pintura === 'pendiente' ||
    p.estado_pedido_pintura === 'en_proceso' ||
    p.estado_pedido_pintura === 'parcial'
  );

  // Solo borradores para el selector inline del modal
  const pedidosBorrador = procesos.filter(p =>
    p.estado_pedido_pintura === 'borrador' ||
    p.estado_pedido_pintura === 'pendiente'
  );

  const pedidosBorradorFiltrados = pedidosBorrador.filter(p => {
    if (!continuarBusqueda) return true;
    const q = continuarBusqueda.toLowerCase();
    return (
      (p.id_consecutivo || '').toLowerCase().includes(q) ||
      (p.numero_proceso || '').toLowerCase().includes(q) ||
      (p.codigo_lote || '').toLowerCase().includes(q) ||
      (p.pintor_responsable || '').toLowerCase().includes(q)
    );
  });

  const handleAbrirContinuarModal = () => {
    setPedidoPendienteSeleccionado('');
    setPedidoPreviewCompleto(null);
    setShowContinuarModal(true);
  };

  // Función auxiliar: carga todos los estados locales desde un objeto pedido completo
  const cargarPedidoCompleto = useCallback((data) => {
    if (!data) return;
    setCurrentItem({ ...data, finalizar_pintura: false });
    setIsEditing(true);
    const inv = data.inv_proceso_id
      ? inventarioEnProceso.find(i => i.id === data.inv_proceso_id) || null
      : null;
    setCueroSeleccionado(inv || null);
    setHojasAConsumir(data.hojas_a_consumir || 0);
    const subs = Array.isArray(data.sublotes_pintura) ? data.sublotes_pintura : [];
    if (!Array.isArray(data.sublotes_pintura)) {
      console.warn('[Pintura] sublotes_pintura llegó vacío o no es array:', data.sublotes_pintura);
    }
    setSublotes(subs);
    setSubloteActivoIdx(0);
    setBusquedaProducto(''); setBusquedaNombre('');
    setMostrarListaProducto(false); setMostrarListaNombre(false);
    setSearchCuero(''); setFiltroCueroColor(''); setFiltroCueroEtapa('');
    setMostrarSelectorContinuar(false); setContinuarBusqueda('');
    setShowModal(true);
  }, [inventarioEnProceso]);

  const handleContinuarPedido = async () => {
    if (!pedidoPendienteSeleccionado) return;
    setShowContinuarModal(false);
    // Si ya tenemos el fetch completo del preview, lo reutilizamos directamente
    if (pedidoPreviewCompleto && pedidoPreviewCompleto.id === pedidoPendienteSeleccionado) {
      cargarPedidoCompleto(pedidoPreviewCompleto);
      return;
    }
    try {
      const pedidoCompleto = await ProcesoProduccion.get(pedidoPendienteSeleccionado);
      cargarPedidoCompleto(pedidoCompleto);
    } catch (e) {
      console.error('Error fetching pedido:', e);
      const pedido = procesos.find(p => p.id === pedidoPendienteSeleccionado);
      if (pedido) cargarPedidoCompleto(pedido);
    }
  };

  const handleVerSublote = (idx) => { setSubloteDetalleIdx(idx); setShowSubloteDetalle(true); };

  const handleSaveBorrador = async () => {
    if (!cueroSeleccionado && !currentItem?.inv_proceso_id) { alert('⚠️ Seleccione un producto en proceso.'); return; }
    if (hojasAConsumir <= 0) { alert('⚠️ Ingrese la cantidad de hojas a consumir.'); return; }
    if (totalHojasAsignadas > hojasAConsumir) {
      alert(`❌ No se puede guardar: las hojas asignadas en sublotes (${totalHojasAsignadas}) superan las hojas a consumir (${hojasAConsumir}).\n\nReduzca la cantidad de hojas en alguno de los sublotes antes de continuar.`);
      return;
    }
    try {
      const res = getResumen();
      const dataToSave = {
        ...currentItem,
        inv_proceso_id: cueroSeleccionado?.id || currentItem.inv_proceso_id || '',
        codigo_lote: cueroSeleccionado?.codigo_lote || currentItem.codigo_lote || '',
        hojas_a_consumir: hojasAConsumir,
        total_hojas_enviadas_pintura: hojasAConsumir,
        sublotes_pintura: sublotes,
        costo_total_proceso_pintura: res.costoTotal,
        costo_promedio_por_hoja: res.costoPorHoja,
        hojas_buenas_finales: res.hojasBuenasTotal,
        num_sublotes_generados: sublotes.length,
        colores_registrados: [...new Set(sublotes.map(s => s.color_final).filter(Boolean))].join(', '),
        tipos_acabado_registrados: [...new Set(sublotes.map(s => s.tipo_acabado).filter(Boolean))].join(', '),
        pct_merma_total: hojasAConsumir > 0 ? ((1 - res.hojasBuenasTotal / hojasAConsumir) * 100).toFixed(1) : 0,
        estado_pedido_pintura: 'borrador',
        finalizar_pintura: false,
      };
      if (isEditing && currentItem.id) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        const created = await ProcesoProduccion.create({ ...dataToSave, tipo_proceso: 'pintura' });
        // Actualizar estado sincrónicamente para evitar duplicados en guardados consecutivos
        setCurrentItem(prev => ({ ...prev, id: created.id, tipo_proceso: 'pintura' }));
        setIsEditing(true);
      }
      await loadData();
      alert('✅ Borrador guardado. Puede continuar agregando sublotes.');
    } catch (error) {
      console.error('Error saving borrador:', error);
      alert('Error al guardar el borrador: ' + error.message);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!cueroSeleccionado && !currentItem?.inv_proceso_id) { alert('⚠️ Seleccione un producto en proceso.'); return; }
    if (hojasAConsumir <= 0) { alert('⚠️ Ingrese la cantidad de hojas a consumir.'); return; }
    if (sublotes.length === 0) { alert('⚠️ Agregue al menos un sublote de pintura.'); return; }
    if (totalHojasAsignadas > hojasAConsumir) {
      alert(`❌ No se puede finalizar: las hojas asignadas en sublotes (${totalHojasAsignadas}) superan las hojas a consumir (${hojasAConsumir}).\n\nReduzca la cantidad de hojas en alguno de los sublotes antes de continuar.`);
      return;
    }
    if (hojasRestantesDistribucion !== 0) {
      alert(`❌ No es posible finalizar: quedan ${hojasRestantesDistribucion} hojas pendientes por distribuir en sublotes.`);
      return;
    }
    const errores = validarParaFinalizar();
    if (errores.length > 0) {
      alert('❌ No es posible finalizar el proceso:\n\n' + errores.map(e => '• ' + e).join('\n'));
      return;
    }

    try {
      const res = getResumen();
      const dataToSave = {
        ...currentItem,
        inv_proceso_id: cueroSeleccionado?.id || currentItem.inv_proceso_id || '',
        codigo_lote: cueroSeleccionado?.codigo_lote || currentItem.codigo_lote || '',
        hojas_a_consumir: hojasAConsumir,
        total_hojas_enviadas_pintura: hojasAConsumir,
        sublotes_pintura: sublotes,
        costo_total_proceso_pintura: res.costoTotal,
        costo_promedio_por_hoja: res.costoPorHoja,
        hojas_buenas_finales: res.hojasBuenasTotal,
        num_sublotes_generados: sublotes.length,
        colores_registrados: [...new Set(sublotes.map(s => s.color_final).filter(Boolean))].join(', '),
        tipos_acabado_registrados: [...new Set(sublotes.map(s => s.tipo_acabado).filter(Boolean))].join(', '),
        pct_merma_total: hojasAConsumir > 0 ? ((1 - res.hojasBuenasTotal / hojasAConsumir) * 100).toFixed(1) : 0,
        estado_pedido_pintura: 'terminado',
        finalizar_pintura: true,
      };

      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        await ProcesoProduccion.create(dataToSave);
      }

      const fechaHoy = new Date().toISOString().split('T')[0];
      if (cueroSeleccionado) {
        const hojasActualesInventario = cueroSeleccionado.cantidad_hojas || 0;
        const nuevaCantidad = Math.max(0, hojasActualesInventario - hojasAConsumir);
        await InventarioEnProceso.update(cueroSeleccionado.id, { cantidad_hojas: nuevaCantidad, estado_actual: nuevaCantidad <= 0 ? 'FINALIZADO' : 'EN_PROCESO' });
      }
      for (const sub of sublotes) {
        for (const ins of (sub.insumos || [])) {
          const insumo = insumosQuimicos.find(i => i.id === ins.item_id);
          if (insumo && (parseFloat(ins.cantidad) || 0) > 0) {
            await MovimientoInventario.create({ tipo_movimiento: 'salida', insumo_id: insumo.id, cantidad: -(parseFloat(ins.cantidad)), costo_unitario: parseFloat(ins.costo_unitario) || 0, fecha_movimiento: fechaHoy, referencia: currentItem.id_consecutivo, observaciones: `Pintura ${currentItem.id_consecutivo} - Sublote ${sub.codigo_sublote}` });
            await Insumo.update(insumo.id, { stock_actual: Math.max(0, (insumo.stock_actual || 0) - parseFloat(ins.cantidad)) });
          }
        }
        const hojasBuenas = parseFloat(sub.hojas_buenas) || 0;
        if (hojasBuenas > 0) {
          const costoSub = getCostosSublote(sub);
          if (sub.producto_terminado_id && sub.producto_terminado_codigo) {
            const existentes = productosTerminados.filter(pt => pt.codigo === sub.producto_terminado_codigo);
            if (existentes.length > 0) {
              const pt = existentes[0];
              const nuevoStock = (pt.stock_actual || 0) + hojasBuenas;
              const nuevoCostoProm = ((pt.stock_actual || 0) * (pt.costo_promedio || 0) + hojasBuenas * costoSub.costoPorHoja) / nuevoStock;
              await ProductoTerminado.update(pt.id, { stock_actual: nuevoStock, costo_promedio: nuevoCostoProm, fecha_ultima_produccion: fechaHoy });
            } else {
              await ProductoTerminado.create({ codigo: sub.producto_terminado_codigo, descripcion: sub.producto_terminado_nombre || sub.producto_terminado_codigo, tipo_acabado: sub.tipo_acabado, color_final: sub.color_final, categoria: 'hojas_procesadas', unidad_medida: 'HOJA', stock_actual: hojasBuenas, costo_promedio: costoSub.costoPorHoja, stock_minimo: 0, proceso_origen_id: currentItem.id_consecutivo, lote_origen: cueroSeleccionado?.codigo_lote || '', sublote_pintura: sub.codigo_sublote || '', fecha_ingreso: fechaHoy, fecha_ultima_produccion: fechaHoy, costo_total_acumulado: costoSub.costoTotal });
            }
          } else {
            const tipoAcabado = sub.tipo_acabado || ''; const colorFinal = sub.color_final || '';
            const existentes = productosTerminados.filter(pt => pt.tipo_acabado === tipoAcabado && pt.color_final === colorFinal);
            if (existentes.length > 0) {
              await ProductoTerminado.update(existentes[0].id, { stock_actual: (existentes[0].stock_actual || 0) + hojasBuenas, costo_promedio: costoSub.costoPorHoja, fecha_ultima_produccion: fechaHoy });
            } else {
              const codigoAuto = `PT-${tipoAcabado.substring(0, 3)}-${colorFinal.substring(0, 5)}-${Date.now()}`.toUpperCase();
              await ProductoTerminado.create({ codigo: codigoAuto, descripcion: `${tipoAcabado} - ${colorFinal}`.toUpperCase(), tipo_acabado: tipoAcabado, color_final: colorFinal, categoria: 'hojas_procesadas', unidad_medida: 'HOJA', stock_actual: hojasBuenas, costo_promedio: costoSub.costoPorHoja, stock_minimo: 0, proceso_origen_id: currentItem.id_consecutivo, lote_origen: cueroSeleccionado?.codigo_lote || '', sublote_pintura: sub.codigo_sublote || '', fecha_ingreso: fechaHoy, fecha_ultima_produccion: fechaHoy });
            }
          }
        }
      }
      alert(`✅ Proceso de pintura finalizado correctamente. Se generaron los movimientos de inventario y se actualizaron los costos de los sublotes.`);
      setShowModal(false);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar el proceso: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proceso de pintura?')) return;
    try { await ProcesoProduccion.delete(id); loadData(); } catch (e) { console.error(e); }
  };

  const esFinalizado = currentItem?.estado_pedido_pintura === 'terminado';

  // ── LISTADO PRINCIPAL ──────────────────────────────────────────────────────
  const renderListado = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-slate-100 border-b-2 border-slate-300">
          <tr>
            <th className="p-2 text-left font-semibold">N° de Pedido</th>
            <th className="p-2 text-center font-semibold">N° Sublotes</th>
            <th className="p-2 text-left font-semibold">Fecha Reg.</th>
            <th className="p-2 text-left font-semibold">Producto en Proceso</th>
            <th className="p-2 text-center font-semibold">Hojas Cons.</th>
            <th className="p-2 text-center font-semibold">Hojas Buenas</th>
            <th className="p-2 text-right font-semibold">Costo/Hoja</th>
            <th className="p-2 text-center font-semibold">% Merma</th>
            <th className="p-2 text-left font-semibold">Estado</th>
            <th className="p-2 text-left font-semibold">Últ. Modif.</th>
            <th className="p-2 text-center font-semibold">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {procesos.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-slate-400">Sin procesos registrados.</td></tr>}
          {procesos.map(item => {
            const numSublotes = item.num_sublotes_generados || (item.sublotes_pintura?.length) || 0;
            return (
            <tr key={item.id} className="border-b hover:bg-slate-50">
              <td className="p-2 font-mono font-bold text-indigo-700">{item.id_consecutivo || item.numero_proceso || 'N/A'}</td>
              <td className="p-2 text-center">
                <button
                  className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-bold hover:bg-indigo-200 cursor-pointer underline-offset-1"
                  onClick={() => { setSubletesModalItem(item); setShowSubletesModal(true); }}
                  title="Ver sublotes"
                >{numSublotes}</button>
              </td>
              <td className="p-2">{formatDate(item.fecha_entrega_pintor || item.fecha_inicio)}</td>
              <td className="p-2 font-mono text-xs">{item.codigo_lote || '—'}</td>
              <td className="p-2 text-center font-bold">{item.hojas_a_consumir || 0}</td>
              <td className="p-2 text-center font-bold text-green-700">{item.hojas_buenas_finales || 0}</td>
              <td className="p-2 text-right font-semibold text-emerald-700">{formatCurrency(item.costo_promedio_por_hoja)}</td>
              <td className="p-2 text-center">
                {item.pct_merma_total != null ? <span className={`font-bold ${parseFloat(item.pct_merma_total) > 10 ? 'text-red-600' : 'text-slate-700'}`}>{item.pct_merma_total}%</span> : '—'}
              </td>
              <td className="p-2">{estadoBadge(item.estado_pedido_pintura)}</td>
              <td className="p-2 text-xs text-slate-400">{item.updated_date ? new Date(item.updated_date).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
              <td className="p-2">
                <div className="flex gap-1 justify-center flex-wrap">
                  <Button variant="outline" size="sm" title="Ver Detalle" onClick={() => { setSelectedItem(item); setShowDetailModal(true); }}><Search className="w-3.5 h-3.5" /></Button>
                  <Button variant="outline" size="sm" title="Editar" onClick={async () => { try { const full = await ProcesoProduccion.get(item.id); handleOpenModal(full || item); } catch { handleOpenModal(item); } }}><Edit className="w-3.5 h-3.5" /></Button>
                  {(item.estado_pedido_pintura === 'parcial' || item.estado_pedido_pintura === 'pendiente' || item.estado_pedido_pintura === 'borrador') && (
                    <Button size="sm" title="Finalizar Pintura" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2"
                      onClick={async () => { try { const full = await ProcesoProduccion.get(item.id); handleOpenModal(full || item); } catch { handleOpenModal(item); } }}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />Finalizar
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" title="Eliminar" onClick={() => handleDelete(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </td>
            </tr>
          );})}
          
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="p-6">
      <PageHeader title="Pintura" description="Control de pintura con trazabilidad desde inventario de cueros en proceso hasta productos terminados."
        onPrint={() => window.print()}
        actionButton={
          <div className="flex gap-2">
            <Button onClick={handleAbrirContinuarModal}
              disabled={pedidosPendientes.length === 0}
              variant="outline"
              className="border-amber-500 text-amber-700 hover:bg-amber-50 disabled:opacity-40"
              title={pedidosPendientes.length === 0 ? 'No hay pedidos pendientes' : `${pedidosPendientes.length} pedido(s) pendiente(s)`}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Continuar Pedido
              {pedidosPendientes.length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{pedidosPendientes.length}</span>
              )}
            </Button>
            <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />Nueva Pintura
            </Button>
          </div>
        }
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Procesos de Pintura</CardTitle></CardHeader>
        <CardContent>{loading ? <p>Cargando...</p> : renderListado()}</CardContent>
      </Card>

      {/* ══════════════ MODAL PRINCIPAL ══════════════ */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing
                ? <><FolderOpen className="w-5 h-5 text-amber-600" /><span className="text-amber-700">FLUJO 2: CONTINUAR PEDIDO</span></>
                : <><FileText className="w-5 h-5 text-emerald-600" /><span className="text-emerald-700">FLUJO 1: NUEVO PEDIDO DE PINTURA</span></>
              }
              {currentItem?.id_consecutivo && (
                <span className="ml-2 font-mono text-base font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                  {currentItem.id_consecutivo}
                </span>
              )}
              {esFinalizado && <span className="text-red-500 text-sm ml-2 font-normal">(FINALIZADO — Solo lectura)</span>}
              {esBorradorEdicion && <span className="text-amber-600 text-sm ml-2 font-semibold">📝 BORRADOR</span>}
            </DialogTitle>
          </DialogHeader>
          {currentItem && (
            <form onSubmit={handleSave} className="space-y-5">

              {/* ═══ ENCABEZADO — SELECTOR DE FLUJO ═══ */}
              <div className="border-2 border-slate-300 rounded-xl overflow-hidden">
                {/* Selector de modo */}
                <div className="bg-slate-700 text-white px-5 py-3">
                  <h3 className="font-bold text-base mb-2">ENCABEZADO DEL PEDIDO DE PINTURA</h3>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (isEditing) {
                          if (!window.confirm('¿Cambiar a Nuevo Pedido? Se perderán los datos actuales del pedido cargado.')) return;
                          handleOpenModal(null);
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!isEditing ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}
                    >
                      <FileText className="w-4 h-4" />
                      1. Nuevo Pedido
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!isEditing) {
                          if (pedidosBorrador.length === 0) {
                            alert('No hay pedidos en estado Borrador disponibles para continuar.');
                            return;
                          }
                          // Limpiar y activar modo continuar
                          setContinuarBusqueda('');
                          setMostrarSelectorContinuar(true);
                        }
                      }}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isEditing ? 'bg-amber-500 text-white shadow-md' : 'bg-slate-600 text-slate-300 hover:bg-slate-500'}`}
                    >
                      <FolderOpen className="w-4 h-4" />
                      2. Continuar Pedido Existente
                      {pedidosBorrador.length > 0 && !isEditing && (
                        <span className="bg-amber-400 text-white text-xs rounded-full px-1.5 py-0.5 font-bold">{pedidosBorrador.length}</span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Panel continuar pedido: selector búsqueda */}
                {mostrarSelectorContinuar && !isEditing && (
                  <div className="bg-amber-50 border-b-2 border-amber-300 px-5 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <FolderOpen className="w-5 h-5 text-amber-600" />
                      <p className="font-bold text-amber-800 text-sm">Buscar y seleccionar pedido en estado BORRADOR</p>
                      <button type="button" onClick={() => setMostrarSelectorContinuar(false)} className="ml-auto p-1 rounded hover:bg-amber-200 text-amber-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <Label className="text-xs font-bold text-amber-700">Buscar por Consecutivo / Lote / Pintor</Label>
                        <Input
                          value={continuarBusqueda}
                          onChange={e => setContinuarBusqueda(e.target.value)}
                          placeholder="Escriba el consecutivo, lote o nombre del pintor..."
                          className="mt-1 text-sm border-amber-400 focus:border-amber-600"
                          autoFocus
                        />
                      </div>
                    </div>
                    {/* Lista de resultados */}
                    <div className="mt-3 max-h-56 overflow-y-auto border border-amber-200 rounded-lg bg-white divide-y divide-amber-100">
                      {pedidosBorradorFiltrados.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">
                          {continuarBusqueda ? 'Sin resultados para la búsqueda.' : 'No hay pedidos en estado Borrador.'}
                        </div>
                      ) : (
                        pedidosBorradorFiltrados.map(p => {
                          const hojasDist = (p.sublotes_pintura || []).reduce((s, sub) => s + (parseFloat(sub.cantidad_hojas) || 0), 0);
                          const hojasRest = (p.hojas_a_consumir || 0) - hojasDist;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={async () => {
                                try {
                                  const pedidoCompleto = await ProcesoProduccion.get(p.id);
                                  cargarPedidoCompleto(pedidoCompleto);
                                } catch (e) {
                                  cargarPedidoCompleto(p);
                                }
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors group"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-mono font-bold text-amber-800 text-sm">{p.id_consecutivo || p.numero_proceso}</span>
                                  <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">BORRADOR</span>
                                </div>
                                <span className="text-xs text-slate-400 group-hover:text-amber-600 font-semibold">→ Abrir y continuar</span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500 flex flex-wrap gap-3">
                                {p.codigo_lote && <span>Lote: <strong>{p.codigo_lote}</strong></span>}
                                {p.pintor_responsable && <span>Pintor: <strong>{p.pintor_responsable}</strong></span>}
                                <span>Hojas: <strong>{p.hojas_a_consumir || 0}</strong></span>
                                <span>Sublotes: <strong>{p.sublotes_pintura?.length || 0}</strong></span>
                                {hojasRest > 0 && <span className="text-amber-600 font-semibold">⏳ {hojasRest} hojas pendientes</span>}
                                <span>Últ. guardado: {p.updated_date ? new Date(p.updated_date).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Campos del encabezado */}
                <div className="bg-white px-5 py-4">
                  {isEditing && (
                    <div className={`mb-3 p-2 rounded-lg flex items-center gap-2 text-xs ${sublotes.length > 0 || hojasAConsumir > 0 ? 'bg-amber-50 border border-amber-200 text-amber-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                      <FolderOpen className="w-4 h-4 flex-shrink-0" />
                      {sublotes.length > 0 || hojasAConsumir > 0
                        ? <span>Pedido recuperado. <strong>{sublotes.length} sublote(s)</strong> · <strong>{hojasAConsumir} hojas</strong> a consumir · Producto: <strong>{cueroSeleccionado?.codigo_lote || currentItem?.codigo_lote || '—'}</strong></span>
                        : <span>Pedido abierto en modo edición. Complete los datos del formulario y guarde el borrador.</span>
                      }
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs font-bold text-slate-600">ID / No. de Pedido</Label>
                      <Input value={currentItem.id_consecutivo || ''} readOnly className="bg-gray-100 font-mono font-bold text-indigo-700 mt-1" />
                      <p className="text-xs mt-0.5 text-slate-400">{isEditing ? 'Pedido recuperado' : 'Generado automáticamente'}</p>
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-600">Fecha Entrega al Pintor *</Label>
                      <Input type="date" value={currentItem.fecha_entrega_pintor || ''} disabled={esFinalizado} onChange={e => setCurrentItem({ ...currentItem, fecha_entrega_pintor: e.target.value })} required className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-600">Fecha Inicio de Pintura *</Label>
                      <Input type="date" value={currentItem.fecha_inicio_pintura || ''} disabled={esFinalizado} onChange={e => setCurrentItem({ ...currentItem, fecha_inicio_pintura: e.target.value })} required className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-slate-600">Pintor / Responsable</Label>
                      <Input value={currentItem.pintor_responsable || ''} disabled={esFinalizado} onChange={e => setCurrentItem({ ...currentItem, pintor_responsable: e.target.value })} className="mt-1" />
                    </div>
                  </div>
                </div>
              </div>

              {/* ═══ BLOQUE 1: SELECCIÓN CUEROS EN PROCESO ═══ */}
              <div className="border-2 border-indigo-400 rounded-xl overflow-hidden">
                <div className="bg-indigo-700 text-white px-5 py-3">
                  <h3 className="font-bold text-base">① SELECCIÓN DE PRODUCTOS EN PROCESO</h3>
                  <p className="text-xs text-indigo-200 mt-0.5">Busque y seleccione hojas disponibles desde el inventario de productos en proceso</p>
                </div>
                <div className="bg-indigo-50 border-b border-indigo-200 px-5 py-3 grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs text-indigo-700 font-semibold">Buscar (código, lote, color)</Label>
                    <Input value={searchCuero} onChange={e => setSearchCuero(e.target.value)} placeholder="Buscar..." className="h-8 text-xs mt-1" disabled={esFinalizado} />
                  </div>
                  <div>
                    <Label className="text-xs text-indigo-700 font-semibold">Filtrar por Color Base</Label>
                    <Select value={filtroCueroColor} onValueChange={setFiltroCueroColor}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Todos..." /></SelectTrigger>
                      <SelectContent><SelectItem value={null}>— Todos —</SelectItem>{COLORES_BASE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-indigo-700 font-semibold">Filtrar por Etapa</Label>
                    <Select value={filtroCueroEtapa} onValueChange={setFiltroCueroEtapa}>
                      <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Todos..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={null}>— Todas —</SelectItem>
                        <SelectItem value="recurtido">Recurtido</SelectItem>
                        <SelectItem value="curtido">Curtido</SelectItem>
                        <SelectItem value="limpieza">Limpieza</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="bg-white px-5 py-3">
                  <Label className="text-xs font-bold text-indigo-700">Productos en Proceso *</Label>
                  <Select value={cueroSeleccionado?.id || ''} onValueChange={handleSeleccionarCuero} disabled={esFinalizado}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar producto en proceso..." /></SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">
                      {/* Si hay un cuero seleccionado (ej. recuperado de borrador) y no está en la lista filtrada, mostrarlo igual */}
                      {cueroSeleccionado && !cueroFiltrado.find(i => i.id === cueroSeleccionado.id) && (
                        <SelectItem key={cueroSeleccionado.id} value={cueroSeleccionado.id}>
                          ★ {cueroSeleccionado.codigo_lote} — {cueroSeleccionado.descripcion || cueroSeleccionado.color_base} (Recuperado del borrador)
                        </SelectItem>
                      )}
                      {cueroFiltrado.length === 0 && !cueroSeleccionado && <SelectItem value="__e__" disabled>Sin productos en proceso disponibles</SelectItem>}
                      {cueroFiltrado.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.codigo_lote} — {inv.descripcion || inv.color_base} ({inv.cantidad_hojas} hojas | {inv.peso_actual} kg) [{(inv.etapa_actual || '').toUpperCase()}]
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {cueroSeleccionado && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs bg-indigo-50 border border-indigo-200 rounded p-3">
                      <div><span className="font-semibold text-indigo-700">Cód. Inventario en Proceso:</span> <span className="font-mono font-bold text-indigo-900">{cueroSeleccionado.codigo_lote}</span></div>
                      <div><span className="font-semibold text-indigo-700">Descripción/Nombre:</span> {cueroSeleccionado.descripcion || cueroSeleccionado.color_base || '—'}</div>
                      <div><span className="font-semibold text-indigo-700">Color Base:</span> <strong>{cueroSeleccionado.color_base || '—'}</strong></div>
                      <div><span className="font-semibold text-indigo-700">Cód. Lote Padre (trazabilidad):</span> <span className="font-mono">{cueroSeleccionado.codigo_lote_padre || '—'}</span></div>
                      <div><span className="font-semibold text-indigo-700">Hojas Disponibles:</span> <strong className="text-green-700 text-base">{hojasRealesDisponibles}</strong>{hojasComprometidasEdicion > 0 && <span className="text-xs text-amber-600 ml-1">(incl. {hojasComprometidasEdicion} comprometidas)</span>}</div>
                      <div><span className="font-semibold text-indigo-700">Área Disponible (m²):</span> {cueroSeleccionado.peso_actual ? `${cueroSeleccionado.peso_actual} kg` : '—'}</div>
                      <div><span className="font-semibold text-indigo-700">Costo Promedio Unit.:</span> <strong className="text-amber-700">{formatCurrency(cueroSeleccionado.costo_promedio)}</strong></div>
                      <div><span className="font-semibold text-indigo-700">Etapa Actual:</span> <span className="uppercase font-bold text-blue-700">{cueroSeleccionado.etapa_actual}</span></div>
                    </div>
                  )}
                  {cueroSeleccionado && (
                    <div className="mt-3 flex items-end gap-4">
                      <div className="w-56">
                        <Label className="text-xs font-bold text-indigo-700">Hojas a Consumir *</Label>
                        <Input type="number" min="1" max={hojasRealesDisponibles} value={hojasAConsumir || ''} disabled={esFinalizado}
                          onChange={e => { const val = parseFloat(e.target.value) || 0; setHojasAConsumir(val); setSublotes(prev => recalcPct(prev, val)); }}
                          className={`mt-1 text-xs ${hojasAConsumir > hojasRealesDisponibles ? 'border-red-500 bg-red-50' : ''}`} />
                        <p className="text-xs text-slate-400 mt-0.5">Máx: <strong>{hojasRealesDisponibles}</strong></p>
                      </div>
                      <div className={`flex-1 p-3 rounded border text-xs font-medium ${hojasAConsumir > hojasRealesDisponibles ? 'bg-red-50 border-red-300 text-red-700' : hojasAConsumir > 0 ? 'bg-green-50 border-green-300 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                        {hojasAConsumir > hojasRealesDisponibles ? `❌ Excede el disponible en ${hojasAConsumir - hojasRealesDisponibles} hojas` : hojasAConsumir > 0 ? `✔ Consumirá ${hojasAConsumir} de ${hojasRealesDisponibles} hojas disponibles. Quedarán ${hojasRealesDisponibles - hojasAConsumir} en inventario.` : 'Ingrese la cantidad de hojas a consumir'}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ══ BLOQUE 2: RESUMEN Y CONTROL DE DISTRIBUCIÓN — siempre visible ══ */}
              <div className="border-2 border-teal-500 rounded-xl overflow-hidden">
                <div className="bg-teal-700 text-white px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base">② RESUMEN Y CONTROL DE DISTRIBUCIÓN</h3>
                    <p className="text-xs text-teal-200 mt-0.5">Estado en tiempo real de la distribución de hojas en sublotes</p>
                  </div>
                  {!esFinalizado && (
                    <Button type="button" onClick={handleAgregarSublote}
                      disabled={hojasRestantesDistribucion <= 0 && sublotes.length > 0}
                      title={hojasRestantesDistribucion <= 0 && sublotes.length > 0 ? 'Todas las hojas ya están distribuidas' : 'Agregar nuevo sublote'}
                      className="bg-white text-teal-700 hover:bg-teal-50 text-xs h-8 disabled:opacity-40 disabled:cursor-not-allowed">
                      <Plus className="w-3 h-3 mr-1" />Agregar Sublote
                    </Button>
                  )}
                </div>
                <div className="bg-teal-50 border-b border-teal-200 px-5 py-3">
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                    <div className="bg-white border border-teal-200 rounded-lg p-2 text-center"><p className="text-teal-600 font-semibold">Hojas Disponibles</p><p className="font-extrabold text-teal-900 text-lg">{hojasRealesDisponibles}</p></div>
                    <div className="bg-white border border-indigo-200 rounded-lg p-2 text-center"><p className="text-indigo-600 font-semibold">Hojas a Consumir</p><p className="font-extrabold text-indigo-900 text-lg">{hojasAConsumir}</p></div>
                    <div className="bg-white border border-blue-200 rounded-lg p-2 text-center"><p className="text-blue-600 font-semibold">Hojas Distribuidas</p><p className={`font-extrabold text-lg ${totalHojasAsignadas > hojasAConsumir ? 'text-red-700' : 'text-blue-800'}`}>{totalHojasAsignadas}</p></div>
                    <div className={`border rounded-lg p-2 text-center ${hojasRestantesDistribucion < 0 ? 'bg-red-50 border-red-300' : hojasRestantesDistribucion === 0 ? 'bg-green-50 border-green-300' : 'bg-amber-50 border-amber-300'}`}><p className={`font-semibold ${hojasRestantesDistribucion < 0 ? 'text-red-600' : hojasRestantesDistribucion === 0 ? 'text-green-600' : 'text-amber-700'}`}>Hojas Pendientes</p><p className={`font-extrabold text-lg ${hojasRestantesDistribucion < 0 ? 'text-red-700' : hojasRestantesDistribucion === 0 ? 'text-green-700' : 'text-amber-800'}`}>{hojasRestantesDistribucion}</p></div>
                    <div className="bg-white border border-purple-200 rounded-lg p-2 text-center"><p className="text-purple-600 font-semibold">Sublotes Creados</p><p className="font-extrabold text-purple-900 text-lg">{sublotes.length}</p></div>
                    <div className={`border rounded-lg p-2 text-center ${hojasRestantesDistribucion === 0 && sublotes.length > 0 ? 'bg-green-100 border-green-400' : hojasRestantesDistribucion < 0 ? 'bg-red-100 border-red-400' : 'bg-amber-100 border-amber-400'}`}><p className="font-semibold text-slate-600">Estado</p><p className={`font-extrabold text-sm ${hojasRestantesDistribucion === 0 && sublotes.length > 0 ? 'text-green-700' : hojasRestantesDistribucion < 0 ? 'text-red-700' : 'text-amber-800'}`}>{hojasRestantesDistribucion === 0 && sublotes.length > 0 ? '✅ Distribución Completa' : hojasRestantesDistribucion < 0 ? '❌ Excede Total' : sublotes.length === 0 ? '⏳ Sin Sublotes' : '⏳ Distribución Parcial'}</p></div>
                  </div>
                  {hojasRestantesDistribucion < 0 && (<div className="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800 font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" />No se puede guardar ni finalizar: las hojas asignadas ({totalHojasAsignadas}) superan las hojas a consumir ({hojasAConsumir}). Corrija las cantidades en los sublotes.</div>)}
                </div>
                {sublotes.length > 0 && (
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-xs">
                      <thead className="bg-teal-100 border-b border-teal-300"><tr><th className="p-2 text-left font-semibold">Código Sublote</th><th className="p-2 text-left font-semibold">Nombre Producto Terminado</th><th className="p-2 text-left font-semibold">Tipo Acabado</th><th className="p-2 text-left font-semibold">Color Final</th><th className="p-2 text-center font-semibold">Cant. Hojas</th><th className="p-2 text-center font-semibold">Estado</th><th className="p-2 text-center font-semibold">Acciones</th></tr></thead>
                      <tbody>
                        {sublotes.map((sub, idx) => (
                          <tr key={idx} className={`border-t ${subloteActivoIdx === idx ? 'bg-teal-50 ring-1 ring-inset ring-teal-400' : 'hover:bg-teal-50'}`}>
                            <td className="p-2 font-mono font-bold text-teal-800">{sub.codigo_sublote}</td>
                            <td className="p-2 font-semibold text-slate-700">{sub.producto_terminado_nombre || <span className="text-slate-400 italic">Sin asignar</span>}</td>
                            <td className="p-2">{sub.tipo_acabado || <span className="text-slate-400">—</span>}</td>
                            <td className="p-2 font-semibold">{sub.color_final || <span className="text-slate-400">—</span>}</td>
                            <td className="p-2 text-center font-bold">{sub.cantidad_hojas || 0}</td>
                            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${sub.estado === 'completado' ? 'bg-green-100 text-green-700' : sub.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{sub.estado === 'completado' ? 'Completo' : sub.estado === 'en_proceso' ? 'En Proceso' : 'Pendiente'}</span></td>
                            <td className="p-2 text-center"><div className="flex gap-1 justify-center"><button type="button" onClick={() => handleVerSublote(idx)} className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold">Ver</button>{!esFinalizado && (<button type="button" onClick={() => handleCambiarSubloteActivo(idx)} className={`px-2 py-0.5 rounded text-xs font-semibold ${subloteActivoIdx === idx ? 'bg-teal-500 text-white' : 'bg-teal-100 hover:bg-teal-200 text-teal-700'}`}>Editar</button>)}{!esFinalizado && (<button type="button" onClick={() => handleEliminarSublote(idx)} className="px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold">Eliminar</button>)}</div></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {sublotes.length === 0 && (<div className="bg-white px-5 py-5 text-center text-slate-400 text-sm">Sin sublotes. Haga clic en "Agregar Sublote" para comenzar la distribución.</div>)}
              </div>

              {/* ═══ BLOQUE 3: DISTRIBUCIÓN Y CREACIÓN DE SUBLOTES ═══ */}
              <div className="border-2 border-orange-400 rounded-xl overflow-hidden">
                  <div className="bg-orange-600 text-white px-5 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base">③ DISTRIBUCIÓN Y CREACIÓN DE SUBLOTES DE PINTURA</h3>
                      <p className="text-xs text-orange-200 mt-0.5">Detalle del sublote activo — cada sublote es independiente</p>
                    </div>
                    {!esFinalizado && (
                      <Button type="button" onClick={handleAgregarSublote}
                        disabled={hojasRestantesDistribucion <= 0 && sublotes.length > 0}
                        className="bg-white text-orange-700 hover:bg-orange-50 text-xs h-8 disabled:opacity-40 disabled:cursor-not-allowed">
                        <Plus className="w-3 h-3 mr-1" />Agregar Sublote
                      </Button>
                    )}
                  </div>

                  {/* Tabs — identificados por código único del sublote */}
                  {sublotes.length > 0 && (
                    <div className="flex items-center gap-1 px-4 pt-3 bg-white border-b overflow-x-auto">
                      {sublotes.map((sub, idx) => (
                        <button key={idx} type="button" onClick={() => handleCambiarSubloteActivo(idx)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 whitespace-nowrap ${subloteActivoIdx === idx ? 'bg-orange-100 border-orange-500 text-orange-800' : 'bg-gray-50 border-transparent text-slate-500 hover:bg-orange-50'}`}>
                          {sub.codigo_sublote || `Sublote ${idx + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {sublotes.length === 0 ? (
                    <div className="bg-white px-5 py-6 text-center text-slate-400 text-sm">Sin sublotes. Haga clic en "Agregar Sublote" en el bloque de Resumen o aquí arriba.</div>
                  ) : subloteActivo ? (
                    <div className="bg-white px-5 py-4">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><Label className="text-xs font-bold text-orange-800">Código Sublote</Label><Input value={subloteActivo.codigo_sublote || ''} readOnly className="bg-amber-50 font-mono text-xs font-bold cursor-not-allowed" /></div>
                        <div>
                          <Label className="text-xs font-bold text-orange-800">Código Producto Terminado</Label>
                          <div className="relative mt-1">
                            <Input
                              value={busquedaProducto || (subloteActivo.producto_terminado_id ? (productosTerminados.find(p => p.id === subloteActivo.producto_terminado_id)?.codigo || '') : '')}
                              onChange={e => { setBusquedaProducto(e.target.value); setMostrarListaProducto(true); if (!e.target.value) { setSubloteActivo({ producto_terminado_id: '', producto_terminado_codigo: '', producto_terminado_nombre: '' }); } }}
                              onFocus={() => { setBusquedaProducto(''); setMostrarListaProducto(true); }}
                              placeholder="Buscar o seleccionar producto..."
                              className="text-xs h-9 pr-7"
                              disabled={esFinalizado}
                            />
                            {subloteActivo.producto_terminado_id && !busquedaProducto && (
                              <button type="button" onClick={() => { setBusquedaProducto(''); setMostrarListaProducto(false); setSubloteActivo({ producto_terminado_id: '', producto_terminado_codigo: '', producto_terminado_nombre: '' }); }} className="absolute right-2 top-2 text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                            )}
                            {mostrarListaProducto && !esFinalizado && (
                              <div className="absolute z-50 w-full bg-white border border-orange-300 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-0.5">
                                {productosTerminados
                                  .filter(p => !busquedaProducto || `${p.codigo} ${p.descripcion || ''}`.toLowerCase().includes(busquedaProducto.toLowerCase()))
                                  .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
                                  .map(p => (
                                    <button key={p.id} type="button"
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 border-b border-orange-100 last:border-0"
                                      onMouseDown={() => { handleSeleccionarProductoCatalogo(p.id); setBusquedaProducto(''); setMostrarListaProducto(false); }}>
                                      <span className="font-mono font-bold text-orange-800">{p.codigo}</span>
                                      <span className="ml-2 text-slate-600">{p.descripcion}</span>
                                    </button>
                                  ))}
                                {productosTerminados.filter(p => !busquedaProducto || `${p.codigo} ${p.descripcion || ''}`.toLowerCase().includes(busquedaProducto.toLowerCase())).length === 0 && (
                                  <div className="px-3 py-2 text-xs text-slate-400">Sin resultados.</div>
                                )}
                              </div>
                            )}
                          </div>
                          {mostrarListaProducto && <div className="fixed inset-0 z-40" onClick={() => setMostrarListaProducto(false)} />}
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs font-bold text-orange-800">Nombre / Descripción Producto Terminado</Label>
                          <div className="relative mt-1">
                            <Input
                              value={busquedaNombre || (subloteActivo.producto_terminado_id ? (productosTerminados.find(p => p.id === subloteActivo.producto_terminado_id)?.descripcion || '') : '')}
                              onChange={e => { setBusquedaNombre(e.target.value); setMostrarListaNombre(true); if (!e.target.value) { setSubloteActivo({ producto_terminado_id: '', producto_terminado_codigo: '', producto_terminado_nombre: '' }); } }}
                              onFocus={() => { setBusquedaNombre(''); setMostrarListaNombre(true); }}
                              placeholder="Buscar por nombre/descripción..."
                              className="text-xs h-9 pr-7"
                              disabled={esFinalizado}
                            />
                            {subloteActivo.producto_terminado_id && !busquedaNombre && (
                              <button type="button" onClick={() => { setBusquedaNombre(''); setMostrarListaNombre(false); setSubloteActivo({ producto_terminado_id: '', producto_terminado_codigo: '', producto_terminado_nombre: '' }); }} className="absolute right-2 top-2 text-slate-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                            )}
                            {mostrarListaNombre && !esFinalizado && (
                              <div className="absolute z-50 w-full bg-white border border-orange-300 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-0.5">
                                {productosTerminados
                                  .filter(p => !busquedaNombre || (p.descripcion || '').toLowerCase().includes(busquedaNombre.toLowerCase()))
                                  .sort((a, b) => (a.descripcion || '').localeCompare(b.descripcion || ''))
                                  .map(p => (
                                    <button key={p.id} type="button"
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-orange-50 border-b border-orange-100 last:border-0"
                                      onMouseDown={() => { handleSeleccionarProductoTerminado(p.id); }}>
                                      <span className="text-slate-700 font-semibold">{p.descripcion}</span>
                                      <span className="ml-2 font-mono text-orange-700 text-xs">({p.codigo})</span>
                                    </button>
                                  ))}
                                {productosTerminados.filter(p => !busquedaNombre || (p.descripcion || '').toLowerCase().includes(busquedaNombre.toLowerCase())).length === 0 && (
                                  <div className="px-3 py-2 text-xs text-slate-400">Sin resultados.</div>
                                )}
                              </div>
                            )}
                          </div>
                          {mostrarListaNombre && <div className="fixed inset-0 z-40" onClick={() => setMostrarListaNombre(false)} />}
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-orange-800">Tipo de Acabado *</Label>
                          <Select value={subloteActivo.tipo_acabado || ''} onValueChange={v => handleSubloteFieldChange('tipo_acabado', v)} disabled={esFinalizado}>
                            <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>{TIPOS_ACABADO.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-orange-800">Color Final *</Label>
                          <Select value={subloteActivo.color_final || ''} onValueChange={v => handleSubloteFieldChange('color_final', v)} disabled={esFinalizado}>
                            <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent className="max-h-48 overflow-y-auto">
                              {coloresCatalogo.map(c => <SelectItem key={c.id} value={c.nombre_color}>{c.codigo_color} - {c.nombre_color}</SelectItem>)}
                              {coloresCatalogo.length === 0 && COLORES_BASE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-orange-800">Estado</Label>
                          <Select value={subloteActivo.estado || 'pendiente'} onValueChange={v => handleSubloteFieldChange('estado', v)} disabled={esFinalizado}>
                            <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendiente">Pendiente</SelectItem>
                              <SelectItem value="en_proceso">En Proceso</SelectItem>
                              <SelectItem value="completado">Completado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-orange-800">Cantidad Hojas *</Label>
                          <Input type="number" min="0" value={subloteActivo.cantidad_hojas || ''} disabled={esFinalizado}
                            onChange={e => handleHojasSubloChange(e.target.value)}
                            className={`text-xs ${hojasRestantesDistribucion < 0 ? 'border-red-400 bg-red-50' : ''}`} />
                          {hojasRestantesDistribucion < 0 && (
                            <p className="text-xs text-red-600 mt-0.5 font-semibold">⚠ Excede en {Math.abs(hojasRestantesDistribucion)} hojas</p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-orange-800">% Participación</Label>
                          <Input readOnly value={`${(subloteActivo.pct_participacion || 0).toFixed(1)}%`} className="bg-blue-50 text-xs text-center font-bold text-blue-800 cursor-not-allowed" />
                        </div>
                        <div className="col-span-2">
                          <Label className="text-xs font-bold text-orange-800">Observaciones</Label>
                          <Input value={subloteActivo.observaciones || ''} disabled={esFinalizado} onChange={e => handleSubloteFieldChange('observaciones', e.target.value)} className="text-xs" placeholder="Obs. del sublote..." />
                        </div>
                      </div>
                    </div>
                  ) : null}
              </div>

              {/* ═══ BLOQUE 4: ÍTEMS / PRODUCTOS ═══ */}
              {subloteActivo ? (
                <div className="border-2 border-blue-400 rounded-xl overflow-hidden">
                  <div className="bg-blue-700 text-white px-5 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base">④ ÍTEMS / PRODUCTOS — <span className="text-blue-200 font-mono">{subloteActivo.color_final || subloteActivo.tipo_acabado || `Sublote ${subloteActivoIdx + 1}`}</span></h3>
                      <p className="text-xs text-blue-200 mt-0.5">Insumos y químicos exclusivos de este sublote</p>
                    </div>
                    {!esFinalizado && <Button type="button" onClick={handleAddInsumo} size="sm" className="bg-white text-blue-700 hover:bg-blue-50 text-xs h-8"><Plus className="w-3 h-3 mr-1" />Agregar Ítem</Button>}
                  </div>
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full text-xs table-fixed">
                      <colgroup><col className="w-[35%]" /><col className="w-[12%]" /><col className="w-[13%]" /><col className="w-[9%]" /><col className="w-[12%]" /><col className="w-[13%]" /><col className="w-[6%]" /></colgroup>
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="p-2 text-left">Código / Producto</th>
                          <th className="p-2 text-right">Cantidad</th>
                          <th className="p-2 text-right">Costo Unit.</th>
                          <th className="p-2 text-center">% IVA</th>
                          <th className="p-2 text-right">IVA ($)</th>
                          <th className="p-2 text-right">Valor Total</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(subloteActivo.insumos || []).map((ins, insIdx) => {
                          const cant = parseFloat(ins.cantidad) || 0; const cu = parseFloat(ins.costo_unitario) || 0; const ivaPct = parseFloat(ins.iva) || 0;
                          return (
                            <tr key={insIdx} className="border-t align-top">
                              <td className="p-2">
                                <Select value={ins.item_id || ''} onValueChange={v => handleInsumoChange(insIdx, 'item_id', v)} disabled={esFinalizado}>
                                  <SelectTrigger className="text-xs h-8 w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                  <SelectContent className="max-h-48 overflow-y-auto">{todosLosItems.map(i => <SelectItem key={i.id} value={i.id}>{i.codigo} — {i.descripcion}</SelectItem>)}</SelectContent>
                                </Select>
                                {ins.producto && <p className="text-xs text-slate-400 mt-0.5 pl-1 truncate">{ins.producto}</p>}
                              </td>
                              <td className="p-2"><Input type="number" step="0.01" value={ins.cantidad} disabled={esFinalizado} onChange={e => handleInsumoChange(insIdx, 'cantidad', parseFloat(e.target.value) || 0)} className="text-right text-xs h-8 w-full" /></td>
                              <td className="p-2"><Input type="number" step="0.01" value={ins.costo_unitario} disabled={esFinalizado} onChange={e => handleInsumoChange(insIdx, 'costo_unitario', parseFloat(e.target.value) || 0)} className="text-right text-xs h-8 w-full" /></td>
                              <td className="p-2">
                                <Select value={String(ins.iva)} onValueChange={v => handleInsumoChange(insIdx, 'iva', parseFloat(v))} disabled={esFinalizado}>
                                  <SelectTrigger className="text-xs h-8 w-full"><SelectValue /></SelectTrigger>
                                  <SelectContent><SelectItem value="0.19">19%</SelectItem><SelectItem value="0.05">5%</SelectItem><SelectItem value="0">0%</SelectItem></SelectContent>
                                </Select>
                              </td>
                              <td className="p-2"><Input readOnly value={formatCurrency(cant * cu * ivaPct)} className="text-right text-xs h-8 w-full bg-yellow-50 font-medium text-yellow-800" /></td>
                              <td className="p-2"><Input readOnly value={formatCurrency(ins.valor_total)} className="text-right text-xs h-8 w-full bg-emerald-50 font-bold text-emerald-700" /></td>
                              <td className="p-2">{!esFinalizado && <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveInsumo(insIdx)} className="h-7 w-7"><X className="w-3 h-3 text-red-500" /></Button>}</td>
                            </tr>
                          );
                        })}
                        {(subloteActivo.insumos || []).length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">Sin ítems. Haga clic en "Agregar Ítem".</td></tr>}
                      </tbody>
                      {(subloteActivo.insumos || []).length > 0 && (
                        <tfoot>
                          <tr className="bg-blue-100 font-bold border-t-2">
                            <td colSpan={4} className="p-2 text-right text-xs">TOTAL INSUMOS:</td>
                            <td className="p-2 text-right text-yellow-800">{formatCurrency((subloteActivo.insumos || []).reduce((s, i) => { const c = parseFloat(i.cantidad) || 0; const cu = parseFloat(i.costo_unitario) || 0; const iv = parseFloat(i.iva) || 0; return s + c * cu * iv; }, 0))}</td>
                            <td className="p-2 text-right text-emerald-800">{formatCurrency((subloteActivo.insumos || []).reduce((s, i) => s + (parseFloat(i.valor_total) || 0), 0))}</td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {/* Mano de obra */}
                  <div className="border-t border-blue-200 bg-white px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm text-blue-800">Mano de Obra — {subloteActivo.color_final || `Sublote ${subloteActivoIdx + 1}`}</h4>
                      {!esFinalizado && <Button type="button" onClick={handleAddManoObra} size="sm" variant="outline" className="text-xs h-7"><Plus className="w-3 h-3 mr-1" />Agregar</Button>}
                    </div>
                    <table className="w-full text-xs table-fixed">
                      <colgroup><col className="w-[30%]" /><col className="w-[15%]" /><col className="w-[15%]" /><col className="w-[18%]" /><col className="w-[16%]" /><col className="w-[6%]" /></colgroup>
                      <thead className="bg-green-50">
                        <tr>
                          <th className="p-2 text-left border-b border-green-200">Detalle</th>
                          <th className="p-2 text-right border-b border-green-200">Cant. Hojas</th>
                          <th className="p-2 text-right border-b border-green-200">Valor/Hoja</th>
                          <th className="p-2 text-right border-b border-green-200">Valor Total</th>
                          <th className="p-2 text-left border-b border-green-200">Obs.</th>
                          <th className="p-2 border-b border-green-200"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {(subloteActivo.mano_obra || []).map((mo, moIdx) => (
                          <tr key={moIdx} className="border-t">
                            <td className="p-2"><Input value={mo.detalle} disabled={esFinalizado} onChange={e => handleManoObraChange(moIdx, 'detalle', e.target.value)} className="h-8 text-xs w-full" /></td>
                            <td className="p-2"><Input type="number" value={mo.cantidad_hojas} disabled={esFinalizado} onChange={e => handleManoObraChange(moIdx, 'cantidad_hojas', e.target.value)} className="h-8 text-xs text-right w-full" /></td>
                            <td className="p-2"><Input type="number" value={mo.valor_por_hoja} disabled={esFinalizado} onChange={e => handleManoObraChange(moIdx, 'valor_por_hoja', e.target.value)} className="h-8 text-xs text-right w-full" /></td>
                            <td className="p-2"><Input value={formatCurrency(mo.total)} readOnly className="h-8 text-xs text-right bg-green-50 font-bold w-full" /></td>
                            <td className="p-2"><Input value={mo.observacion || ''} disabled={esFinalizado} onChange={e => handleManoObraChange(moIdx, 'observacion', e.target.value)} className="h-8 text-xs w-full" /></td>
                            <td className="p-2 text-center">{!esFinalizado && <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveManoObra(moIdx)} className="h-7 w-7"><X className="w-3 h-3 text-red-500" /></Button>}</td>
                          </tr>
                        ))}
                        {(subloteActivo.mano_obra || []).length === 0 && <tr><td colSpan={6} className="p-2 text-center text-slate-400">Sin mano de obra.</td></tr>}
                      </tbody>
                      {(subloteActivo.mano_obra || []).length > 0 && (
                        <tfoot>
                          <tr className="bg-green-100 font-bold border-t-2">
                            <td colSpan={3} className="p-2 text-right text-xs">TOTAL MANO DE OBRA:</td>
                            <td className="p-2 text-right text-green-800">{formatCurrency((subloteActivo.mano_obra || []).reduce((s, m) => s + (parseFloat(m.total) || 0), 0))}</td>
                            <td colSpan={2}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              ) : <div className="border-2 border-blue-200 rounded-xl p-4 text-center text-slate-400 text-sm">Agregue un sublote para gestionar ítems y mano de obra.</div>}

              {/* ═══ BLOQUE 5: CONTROL DE COSTOS ═══ */}
              {subloteActivo && cueroSeleccionado ? (() => {
                const c = getCostosSublote(subloteActivo);
                return (
                  <div className="border-2 border-violet-500 rounded-xl overflow-hidden shadow-md">
                    <div className="bg-violet-700 text-white px-5 py-3">
                      <p className="font-bold text-base">⑤ CONTROL DE COSTOS — PINTURA</p>
                      <p className="text-xs text-violet-200 mt-0.5">Sublote activo: <strong className="font-mono">{subloteActivo.color_final || `Sublote ${subloteActivoIdx + 1}`}</strong></p>
                    </div>
                    <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 grid grid-cols-3 gap-3">
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">Costo Heredado</p>
                        <p className="text-lg font-extrabold text-amber-800">{formatCurrency(c.costoHeredado)}</p>
                        <p className="text-xs text-slate-400">= ({c.hojasSubl} ÷ {cueroSeleccionado.cantidad_hojas}) × {formatCurrency(cueroSeleccionado.costo_acumulado)}</p>
                      </div>
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">Costo Insumos</p>
                        <p className="text-base font-bold text-blue-700">{formatCurrency(c.costoInsumos)}</p>
                      </div>
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">Costo Mano de Obra</p>
                        <p className="text-base font-bold text-green-700">{formatCurrency(c.costoManoObra)}</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-violet-800 text-white">
                          <tr>
                            <th className="p-2 text-right whitespace-nowrap">COSTO HEREDADO</th>
                            <th className="p-2 text-right whitespace-nowrap">+ INSUMOS</th>
                            <th className="p-2 text-right whitespace-nowrap">+ MANO OBRA</th>
                            <th className="p-2 text-right whitespace-nowrap font-extrabold">= COSTO TOTAL</th>
                            <th className="p-2 text-center whitespace-nowrap">HOJAS BUENAS</th>
                            <th className="p-2 text-right whitespace-nowrap">COSTO / HOJA</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-white hover:bg-violet-50">
                            <td className="p-2 text-right font-semibold text-amber-700">{formatCurrency(c.costoHeredado)}</td>
                            <td className="p-2 text-right font-semibold text-blue-700">{formatCurrency(c.costoInsumos)}</td>
                            <td className="p-2 text-right font-semibold text-green-700">{formatCurrency(c.costoManoObra)}</td>
                            <td className="p-2 text-right font-extrabold text-violet-800 text-sm">{formatCurrency(c.costoTotal)}</td>
                            <td className="p-2 text-center font-bold">{c.hojasBuenas || '—'}</td>
                            <td className="p-2 text-right font-bold text-emerald-700">{c.hojasBuenas > 0 ? formatCurrency(c.costoPorHoja) : '—'}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })() : <div className="border-2 border-violet-200 rounded-xl p-4 text-center text-slate-400 text-sm">Seleccione un cuero en proceso y agregue un sublote para ver el control de costos.</div>}

              {/* ═══ BLOQUE 6: CONTROL PRODUCCIÓN FINAL — siempre visible cuando hay sublotes ═══ */}
              {subloteActivo ? (
                <div className="border-2 border-red-400 rounded-xl overflow-hidden">
                  <div className="bg-red-700 text-white px-5 py-3">
                    <h3 className="font-bold text-base">⑥ CONTROL DE PRODUCCIÓN FINAL</h3>
                    <p className="text-xs text-red-200 mt-0.5">Distribución completa ✅ — Registre la producción final por sublote. Sublote activo: <strong className="font-mono">{subloteActivo.codigo_sublote || `Sublote ${subloteActivoIdx + 1}`}</strong></p>
                  </div>

                  {/* Selector de sublotes — igual que en bloque ③ */}
                  {sublotes.length > 0 && (
                    <div className="flex items-center gap-1 px-4 pt-3 bg-white border-b overflow-x-auto">
                      {sublotes.map((sub, idx) => (
                        <button key={idx} type="button" onClick={() => handleCambiarSubloteActivo(idx)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 whitespace-nowrap ${subloteActivoIdx === idx ? 'bg-red-100 border-red-500 text-red-800' : 'bg-gray-50 border-transparent text-slate-500 hover:bg-red-50'}`}>
                          {sub.codigo_sublote || `Sublote ${idx + 1}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Formulario sublote activo */}
                  <div className="bg-white px-5 py-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs font-bold text-red-800">Hojas Iniciales</Label>
                        <Input readOnly value={subloteActivo.cantidad_hojas || 0} className="bg-slate-50 text-xs font-bold cursor-not-allowed" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-red-800">Hojas Buenas Finales *</Label>
                        <Input type="number" min="0" value={subloteActivo.hojas_buenas || ''} disabled={esFinalizado} onChange={e => handleSubloteFieldChange('hojas_buenas', parseFloat(e.target.value) || 0)} className="text-xs border-green-400" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-red-800">Hojas Defectuosas</Label>
                        <Input type="number" min="0" value={subloteActivo.hojas_defectuosas || ''} disabled={esFinalizado} onChange={e => handleSubloteFieldChange('hojas_defectuosas', parseFloat(e.target.value) || 0)} className="text-xs border-orange-400" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-red-800">Hojas Rechazadas</Label>
                        <Input type="number" min="0" value={subloteActivo.hojas_rechazadas || ''} disabled={esFinalizado} onChange={e => handleSubloteFieldChange('hojas_rechazadas', parseFloat(e.target.value) || 0)} className="text-xs border-red-400" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold text-red-800">% Merma</Label>
                        <Input readOnly value={(() => { const ini = parseFloat(subloteActivo.cantidad_hojas) || 0; const buenas = parseFloat(subloteActivo.hojas_buenas) || 0; return ini > 0 ? `${((1 - buenas / ini) * 100).toFixed(1)}%` : '—'; })()} className="bg-orange-50 text-xs font-bold text-orange-800 cursor-not-allowed" />
                      </div>
                      <div className="col-span-3">
                        <Label className="text-xs font-bold text-red-800">Obs. de Calidad</Label>
                        <Input value={subloteActivo.obs_calidad || ''} disabled={esFinalizado} onChange={e => handleSubloteFieldChange('obs_calidad', e.target.value)} className="text-xs" placeholder="Observaciones de calidad..." />
                      </div>
                    </div>
                    {(() => {
                      const ini = parseFloat(subloteActivo.cantidad_hojas) || 0;
                      const buenas = parseFloat(subloteActivo.hojas_buenas) || 0; const def = parseFloat(subloteActivo.hojas_defectuosas) || 0; const rech = parseFloat(subloteActivo.hojas_rechazadas) || 0;
                      const suma = buenas + def + rech; const ok = ini === 0 || suma === ini;
                      if (ini > 0) return <div className={`mt-3 p-2 rounded text-xs font-semibold ${ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>{ok ? `✔ Hojas cuadran: ${buenas}+${def}+${rech}=${suma}/${ini}` : `⚠️ No cuadran: ${buenas}+${def}+${rech}=${suma} ≠ ${ini}`}</div>;
                      return null;
                    })()}
                  </div>

                  {/* Tabla validación consolidada de todos los sublotes */}
                  {sublotes.length > 0 && (
                    <div className="border-t border-red-200 bg-red-50 px-5 py-3">
                      <h4 className="font-bold text-sm text-red-800 mb-2">Tabla de Validación Consolidada — Todos los Sublotes</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead className="bg-red-700 text-white">
                            <tr>
                              <th className="p-2 text-left">Sublote</th>
                              <th className="p-2 text-left">Acabado</th>
                              <th className="p-2 text-left">Color</th>
                              <th className="p-2 text-center">Iniciales</th>
                              <th className="p-2 text-center">Buenas</th>
                              <th className="p-2 text-center">Defectuosas</th>
                              <th className="p-2 text-center">Rechazadas</th>
                              <th className="p-2 text-center">% Merma</th>
                              <th className="p-2 text-center">Validación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sublotes.map((sub, idx) => {
                              const ini = parseFloat(sub.cantidad_hojas) || 0;
                              const buenas = parseFloat(sub.hojas_buenas) || 0; const def = parseFloat(sub.hojas_defectuosas) || 0; const rech = parseFloat(sub.hojas_rechazadas) || 0;
                              const suma = buenas + def + rech; const ok = ini > 0 && suma === ini;
                              const merma = ini > 0 ? ((1 - buenas / ini) * 100).toFixed(1) : '—';
                              return (
                                <tr key={idx} className={`border-t ${subloteActivoIdx === idx ? 'bg-red-100' : 'bg-white hover:bg-red-50'} cursor-pointer`} onClick={() => setSubloteActivoIdx(idx)}>
                                  <td className="p-2 font-mono font-bold text-red-800">{sub.codigo_sublote}</td>
                                  <td className="p-2">{sub.tipo_acabado || '—'}</td>
                                  <td className="p-2 font-semibold">{sub.color_final || '—'}</td>
                                  <td className="p-2 text-center font-bold">{ini}</td>
                                  <td className="p-2 text-center text-green-700 font-bold">{buenas}</td>
                                  <td className="p-2 text-center text-orange-600 font-bold">{def}</td>
                                  <td className="p-2 text-center text-red-600 font-bold">{rech}</td>
                                  <td className="p-2 text-center font-semibold">{merma}{merma !== '—' ? '%' : ''}</td>
                                  <td className="p-2 text-center">
                                    {ini === 0 ? <span className="text-slate-400 text-xs">Sin hojas</span> :
                                      ok ? <span className="text-green-700 font-bold text-sm">✅ Correcto</span> :
                                        <span className="text-red-600 font-bold text-xs">⚠️ Dif. {suma - ini > 0 ? '+' : ''}{suma - ini}</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="bg-red-700 text-white font-bold border-t-2">
                              <td colSpan={3} className="p-2 text-right text-xs">TOTALES CONSOLIDADOS:</td>
                              <td className="p-2 text-center">{sublotes.reduce((s, sub) => s + (parseFloat(sub.cantidad_hojas) || 0), 0)}</td>
                              <td className="p-2 text-center">{sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_buenas) || 0), 0)}</td>
                              <td className="p-2 text-center">{sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_defectuosas) || 0), 0)}</td>
                              <td className="p-2 text-center">{sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_rechazadas) || 0), 0)}</td>
                              <td className="p-2 text-center">{hojasAConsumir > 0 ? `${((1 - sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_buenas) || 0), 0) / hojasAConsumir) * 100).toFixed(1)}%` : '—'}</td>
                              <td className="p-2 text-center">{todosSublotesValidados ? '✅ OK' : <span className="text-yellow-300">⚠️ Pend.</span>}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      {!todosSublotesValidados && !esFinalizado && (
                        <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-xs text-amber-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                          <span>Hay sublotes con validaciones pendientes. El botón "Finalizar Proceso" solo estará habilitado cuando todos los sublotes estén validados correctamente.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : <div className="border-2 border-red-200 rounded-xl p-4 text-center text-slate-400 text-sm">Agregue un sublote para registrar el control de producción final.</div>}

              {/* ═══ BLOQUE 7: RESUMEN CONSOLIDADO — siempre visible ═══ */}
              {sublotes.length > 0 ? (() => {
                const res = getResumen();
                return (
                  <div className="border-2 border-emerald-500 rounded-xl overflow-hidden">
                    <div className="bg-emerald-700 text-white px-5 py-3">
                      <h3 className="font-bold text-base">⑦ RESUMEN GENERAL CONSOLIDADO</h3>
                    </div>
                    <div className="bg-emerald-50 p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
                      {[
                        { label: 'Total Sublotes', value: sublotes.length, cls: 'text-3xl text-emerald-800' },
                        { label: 'Hojas Buenas', value: res.hojasBuenasTotal, cls: 'text-3xl text-green-700' },
                        { label: 'Hojas Defect.', value: res.hojasDef, cls: 'text-2xl text-orange-600' },
                        { label: 'Hojas Rechaz.', value: res.hojasRech, cls: 'text-2xl text-red-600' },
                        { label: 'Costo Total', value: formatCurrency(res.costoTotal), cls: 'text-xl text-emerald-800' },
                        { label: 'Costo/Hoja', value: formatCurrency(res.costoPorHoja), cls: 'text-xl text-emerald-700' },
                        { label: 'Heredado', value: formatCurrency(res.costoHeredadoTotal), cls: 'text-base text-amber-700' },
                        { label: 'Insumos', value: formatCurrency(res.costoInsumosTotal), cls: 'text-base text-blue-700' },
                        { label: 'Mano de Obra', value: formatCurrency(res.costoMOTotal), cls: 'text-base text-green-700' },
                        { label: '% Merma Total', value: hojasAConsumir > 0 ? `${((1 - res.hojasBuenasTotal / hojasAConsumir) * 100).toFixed(1)}%` : '—', cls: 'text-xl text-red-700' },
                      ].map((item, i) => (
                        <div key={i} className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                          <p className="text-xs text-emerald-700 font-semibold">{item.label}</p>
                          <p className={`font-extrabold ${item.cls}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })() : <div className="border-2 border-emerald-200 rounded-xl p-4 text-center text-slate-400 text-sm">⑦ RESUMEN GENERAL CONSOLIDADO — Disponible cuando haya sublotes creados.</div>}

              <div>
                <Label>Observaciones Generales</Label>
                <Textarea value={currentItem.observaciones || ''} disabled={esFinalizado} onChange={e => setCurrentItem({ ...currentItem, observaciones: e.target.value })} rows={2} />
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cerrar</Button>
                {!esFinalizado && (
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-50"
                      onClick={handleSaveBorrador}
                      disabled={hojasRestantesDistribucion < 0}>
                      💾 Guardar Borrador
                    </Button>
                    <Button type="submit"
                      disabled={!todosSublotesValidados || hojasRestantesDistribucion !== 0}
                      title={!todosSublotesValidados ? 'Valide todos los sublotes antes de finalizar' : hojasRestantesDistribucion !== 0 ? `Quedan ${hojasRestantesDistribucion} hojas pendientes` : ''}
                      className={`${todosSublotesValidados && hojasRestantesDistribucion === 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-300 text-slate-500 cursor-not-allowed'}`}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />Finalizar Proceso
                    </Button>
                  </div>
                )}
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ MODAL VER DETALLE DE SUBLOTE ══ */}
      <Dialog open={showSubloteDetalle} onOpenChange={setShowSubloteDetalle}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🔍 Detalle del Sublote</DialogTitle></DialogHeader>
          {subloteDetalleIdx !== null && sublotes[subloteDetalleIdx] && (() => {
            const s = sublotes[subloteDetalleIdx];
            const costoIns = (s.insumos || []).reduce((acc, i) => acc + (parseFloat(i.valor_total) || 0), 0);
            const costoMO = (s.mano_obra || []).reduce((acc, m) => acc + (parseFloat(m.total) || 0), 0);
            return (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[['Código Sublote', s.codigo_sublote], ['Nombre Producto', s.producto_terminado_nombre || '—'], ['Tipo Acabado', s.tipo_acabado || '—'], ['Color Final', s.color_final || '—'], ['Cant. Hojas', s.cantidad_hojas || 0], ['Estado', s.estado || 'pendiente'], ['Hojas Buenas', s.hojas_buenas || 0], ['Hojas Defect.', s.hojas_defectuosas || 0], ['Hojas Rechaz.', s.hojas_rechazadas || 0], ['% Participación', `${(s.pct_participacion || 0).toFixed(1)}%`], ['Costo Insumos', formatCurrency(costoIns)], ['Costo M.O.', formatCurrency(costoMO)]].map(([label, val]) => (
                    <div key={label} className="bg-slate-50 rounded p-2"><p className="text-slate-500 font-semibold text-xs">{label}</p><p className="font-bold text-slate-800">{val}</p></div>
                  ))}
                </div>
                {(s.insumos || []).length > 0 && (
                  <div><p className="font-bold text-blue-700 mb-1">Insumos ({s.insumos.length})</p>
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-blue-50"><tr><th className="p-1.5 text-left">Código</th><th className="p-1.5 text-left">Producto</th><th className="p-1.5 text-right">Cant.</th><th className="p-1.5 text-right">Valor Total</th></tr></thead>
                      <tbody>{s.insumos.map((ins, i) => <tr key={i} className="border-t"><td className="p-1.5">{ins.codigo}</td><td className="p-1.5">{ins.producto}</td><td className="p-1.5 text-right">{ins.cantidad}</td><td className="p-1.5 text-right font-semibold text-emerald-700">{formatCurrency(ins.valor_total)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
                {(s.mano_obra || []).length > 0 && (
                  <div><p className="font-bold text-green-700 mb-1">Mano de Obra ({s.mano_obra.length})</p>
                    <table className="w-full text-xs border-collapse">
                      <thead className="bg-green-50"><tr><th className="p-1.5 text-left">Detalle</th><th className="p-1.5 text-right">Cant. Hojas</th><th className="p-1.5 text-right">Valor/Hoja</th><th className="p-1.5 text-right">Total</th></tr></thead>
                      <tbody>{s.mano_obra.map((mo, i) => <tr key={i} className="border-t"><td className="p-1.5">{mo.detalle}</td><td className="p-1.5 text-right">{mo.cantidad_hojas}</td><td className="p-1.5 text-right">{formatCurrency(mo.valor_por_hoja)}</td><td className="p-1.5 text-right font-semibold text-green-700">{formatCurrency(mo.total)}</td></tr>)}</tbody>
                    </table>
                  </div>
                )}
                {s.obs_calidad && <div className="bg-slate-50 rounded p-2 text-xs"><span className="font-semibold">Obs. Calidad:</span> {s.obs_calidad}</div>}
              </div>
            );
          })()}
          <div className="flex justify-end pt-3"><Button onClick={() => setShowSubloteDetalle(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {/* ══ MODAL CONTINUAR PEDIDO ══ */}
      <Dialog open={showContinuarModal} onOpenChange={setShowContinuarModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-amber-600" />
              Continuar Pedido — Pedidos Pendientes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">📋 FLUJO 2: CONTINUAR PEDIDO</p>
              <p>Seleccione un pedido en estado <strong>BORRADOR</strong> o <strong>EN PROCESO</strong> para continuar registrando sublotes y completar la distribución de hojas.</p>
            </div>

            {pedidosPendientes.length === 0 ? (
              <div className="text-center py-6 text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="font-semibold">No hay pedidos pendientes</p>
                <p className="text-xs mt-1">Todos los pedidos están finalizados o no existen registros.</p>
              </div>
            ) : (
              <>
                <div>
                  <Label className="text-sm font-bold text-slate-700">Seleccionar Pedido Pendiente *</Label>
                  <Select value={pedidoPendienteSeleccionado} onValueChange={async (id) => { setPedidoPendienteSeleccionado(id); setPedidoPreviewCompleto(null); try { const full = await ProcesoProduccion.get(id); setPedidoPreviewCompleto(full); } catch { setPedidoPreviewCompleto(procesos.find(p => p.id === id) || null); } }}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="— Seleccionar pedido —" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64 overflow-y-auto">
                      {pedidosPendientes.map(p => {
                        const hojasDist = (p.sublotes_pintura || []).reduce((s, sub) => s + (parseFloat(sub.cantidad_hojas) || 0), 0);
                        const hojasRestantes = (p.hojas_a_consumir || 0) - hojasDist;
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex flex-col">
                              <span className="font-mono font-bold">{p.id_consecutivo || p.numero_proceso}</span>
                              <span className="text-xs text-slate-500">
                                {p.codigo_lote ? `Lote: ${p.codigo_lote} | ` : ''}{p.hojas_a_consumir || 0} hojas | {(p.sublotes_pintura?.length || 0)} sublotes | Pendientes: {hojasRestantes > 0 ? hojasRestantes : 0} hojas
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {pedidoPendienteSeleccionado && (() => {
                  const p = pedidoPreviewCompleto || procesos.find(x => x.id === pedidoPendienteSeleccionado);
                  if (!p) return <div className="text-center text-xs text-slate-400 py-2">Cargando detalles...</div>;
                  const hojasDist = (p.sublotes_pintura || []).reduce((s, sub) => s + (parseFloat(sub.cantidad_hojas) || 0), 0);
                  const hojasRestantes = (p.hojas_a_consumir || 0) - hojasDist;
                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1.5">
                      <p className="font-bold text-slate-700 text-sm mb-2">Resumen del Pedido Seleccionado</p>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          ['N° Pedido', p.id_consecutivo || p.numero_proceso],
                          ['Fecha', formatDate(p.fecha_entrega_pintor || p.fecha_inicio)],
                          ['Pintor', p.pintor_responsable || '—'],
                          ['Lote Origen', p.codigo_lote || '—'],
                          ['Hojas a Consumir', p.hojas_a_consumir || 0],
                          ['Sublotes Creados', p.sublotes_pintura?.length || 0],
                          ['Hojas Distribuidas', hojasDist],
                          ['Hojas Pendientes', hojasRestantes > 0 ? hojasRestantes : 0],
                          ['Colores Reg.', p.colores_registrados || '—'],
                          ['Estado', (p.estado_pedido_pintura || '').toUpperCase()],
                        ].map(([label, val]) => (
                          <div key={label} className="bg-white rounded p-1.5 border border-slate-100">
                            <p className="text-slate-400 text-xs">{label}</p>
                            <p className="font-bold text-slate-800">{val}</p>
                          </div>
                        ))}
                      </div>
                      {hojasRestantes > 0 && (
                        <div className="mt-2 p-2 bg-amber-100 border border-amber-300 rounded text-amber-800 font-semibold text-xs flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                          Quedan <strong>{hojasRestantes} hojas</strong> por distribuir. El botón "Agregar Sublote" estará habilitado al abrir el pedido.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          <div className="flex justify-between pt-2 border-t">
            <Button variant="outline" onClick={() => setShowContinuarModal(false)}>Cancelar</Button>
            <Button
              onClick={handleContinuarPedido}
              disabled={!pedidoPendienteSeleccionado}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40">
              <FolderOpen className="w-4 h-4 mr-2" />
              Abrir y Continuar Pedido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ══ MODAL SUBLOTES LISTADO PRINCIPAL ══ */}
      <Dialog open={showSubletesModal} onOpenChange={setShowSubletesModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>N° Sublotes — {subletesModalItem?.id_consecutivo || subletesModalItem?.numero_proceso || 'N/A'}</DialogTitle>
          </DialogHeader>
          {subletesModalItem && (() => {
            const subs = subletesModalItem.sublotes_pintura || [];
            return subs.length === 0 ? (
              <div className="py-8 text-center text-slate-400">Sin sublotes registrados para este pedido.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-indigo-700 text-white">
                    <tr>
                      <th className="p-2 text-left">Código Sublote</th>
                      <th className="p-2 text-center">Hojas Asignadas</th>
                      <th className="p-2 text-left">Color Final</th>
                      <th className="p-2 text-left">Tipo Acabado</th>
                      <th className="p-2 text-center">Estado</th>
                      <th className="p-2 text-left">Fecha Creación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((s, i) => (
                      <tr key={i} className="border-t hover:bg-indigo-50">
                        <td className="p-2 font-mono font-bold text-indigo-800">{s.codigo_sublote || '—'}</td>
                        <td className="p-2 text-center font-bold">{s.cantidad_hojas || 0}</td>
                        <td className="p-2 font-semibold">{s.color_final || '—'}</td>
                        <td className="p-2">{s.tipo_acabado || '—'}</td>
                        <td className="p-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${s.estado === 'completado' ? 'bg-green-100 text-green-700' : s.estado === 'en_proceso' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {s.estado === 'completado' ? 'Completo' : s.estado === 'en_proceso' ? 'En Proceso' : 'Pendiente'}
                          </span>
                        </td>
                        <td className="p-2 text-slate-500">{subletesModalItem.fecha_entrega_pintor ? formatDate(subletesModalItem.fecha_entrega_pintor) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
          <div className="flex justify-end pt-3"><Button onClick={() => setShowSubletesModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {/* ══ MODAL DETALLE (SOLO LECTURA) ══ */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🔍 Detalle Completo del Proceso de Pintura</DialogTitle></DialogHeader>
          {selectedItem && (() => {
            const subs = selectedItem.sublotes_pintura || [];
            const totalBuenas = subs.reduce((s, sub) => s + (parseFloat(sub.hojas_buenas) || 0), 0);
            const totalDef = subs.reduce((s, sub) => s + (parseFloat(sub.hojas_defectuosas) || 0), 0);
            const totalRech = subs.reduce((s, sub) => s + (parseFloat(sub.hojas_rechazadas) || 0), 0);
            const hojasCons = selectedItem.hojas_a_consumir || 0;
            return (
              <div className="space-y-5 text-sm">
                {/* Datos generales */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-700 text-white px-4 py-2 font-bold text-sm">DATOS GENERALES DEL PROCESO</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 text-xs">
                    {[['N° Proceso', selectedItem.id_consecutivo || 'N/A'], ['Fecha Entrega Pintor', formatDate(selectedItem.fecha_entrega_pintor)], ['Fecha Inicio Pintura', formatDate(selectedItem.fecha_inicio_pintura)], ['Pintor', selectedItem.pintor_responsable || '—'], ['Lote Origen', selectedItem.codigo_lote || '—'], ['Hojas Consumidas', selectedItem.hojas_a_consumir || 0], ['Sublotes Generados', subs.length], ['Estado', (selectedItem.estado_pedido_pintura || '').toUpperCase()], ['Costo Total', formatCurrency(selectedItem.costo_total_proceso_pintura)], ['Costo/Hoja', formatCurrency(selectedItem.costo_promedio_por_hoja)], ['Colores', selectedItem.colores_registrados || '—'], ['% Merma', selectedItem.pct_merma_total != null ? `${selectedItem.pct_merma_total}%` : '—']].map(([label, val]) => (
                      <div key={label} className="bg-slate-50 rounded p-2"><p className="text-slate-500 font-semibold">{label}</p><p className="font-bold text-slate-800">{val}</p></div>
                    ))}
                  </div>
                </div>

                {/* Resumen sublotes */}
                {subs.length > 0 && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-orange-600 text-white px-4 py-2 font-bold text-sm">RESUMEN DE SUBLOTES ({subs.length})</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-orange-50">
                          <tr>
                            <th className="p-2 text-left">Código</th><th className="p-2">Acabado</th><th className="p-2">Color</th>
                            <th className="p-2 text-center">Hojas Asig.</th><th className="p-2 text-center">Buenas</th><th className="p-2 text-center">Defect.</th>
                            <th className="p-2 text-center">Rechaz.</th><th className="p-2 text-center">% Merma</th><th className="p-2 text-center">Validación</th>
                            <th className="p-2 text-right">Costo Insumos</th><th className="p-2 text-right">Costo MO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {subs.map((s, i) => {
                            const ini = parseFloat(s.cantidad_hojas) || 0; const buenas = parseFloat(s.hojas_buenas) || 0;
                            const def = parseFloat(s.hojas_defectuosas) || 0; const rech = parseFloat(s.hojas_rechazadas) || 0;
                            const suma = buenas + def + rech; const ok = ini > 0 && suma === ini;
                            const costoIns = (s.insumos || []).reduce((acc, ins) => acc + (parseFloat(ins.valor_total) || 0), 0);
                            const costoMO = (s.mano_obra || []).reduce((acc, mo) => acc + (parseFloat(mo.total) || 0), 0);
                            return (
                              <tr key={i} className="border-t hover:bg-orange-50">
                                <td className="p-2 font-mono font-bold text-orange-800">{s.codigo_sublote}</td>
                                <td className="p-2 text-center">{s.tipo_acabado || '—'}</td><td className="p-2 text-center font-semibold">{s.color_final || '—'}</td>
                                <td className="p-2 text-center font-bold">{ini}</td><td className="p-2 text-center text-green-700 font-bold">{buenas}</td>
                                <td className="p-2 text-center text-orange-600">{def}</td><td className="p-2 text-center text-red-600">{rech}</td>
                                <td className="p-2 text-center">{ini > 0 ? `${((1 - buenas / ini) * 100).toFixed(1)}%` : '—'}</td>
                                <td className="p-2 text-center">{ini === 0 ? '—' : ok ? '✅' : '⚠️'}</td>
                                <td className="p-2 text-right">{formatCurrency(costoIns)}</td><td className="p-2 text-right">{formatCurrency(costoMO)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-orange-700 text-white font-bold border-t-2">
                            <td colSpan={3} className="p-2 text-right text-xs">TOTALES:</td>
                            <td className="p-2 text-center">{hojasCons}</td><td className="p-2 text-center">{totalBuenas}</td>
                            <td className="p-2 text-center">{totalDef}</td><td className="p-2 text-center">{totalRech}</td>
                            <td className="p-2 text-center">{hojasCons > 0 ? `${((1 - totalBuenas / hojasCons) * 100).toFixed(1)}%` : '—'}</td>
                            <td colSpan={3}></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Resumen insumos consolidado */}
                {subs.some(s => (s.insumos || []).length > 0) && (
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-blue-600 text-white px-4 py-2 font-bold text-sm">RESUMEN DE INSUMOS Y PRODUCTOS</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-blue-50"><tr><th className="p-2 text-left">Sublote</th><th className="p-2 text-left">Código</th><th className="p-2 text-left">Descripción</th><th className="p-2 text-right">Cantidad</th><th className="p-2 text-right">Costo Unit.</th><th className="p-2 text-right">Valor Total</th></tr></thead>
                        <tbody>
                          {subs.flatMap(s => (s.insumos || []).map((ins, i) => (
                            <tr key={`${s.codigo_sublote}-${i}`} className="border-t hover:bg-blue-50">
                              <td className="p-2 font-mono text-blue-700">{s.codigo_sublote}</td>
                              <td className="p-2">{ins.codigo}</td><td className="p-2">{ins.producto}</td>
                              <td className="p-2 text-right">{ins.cantidad}</td><td className="p-2 text-right">{formatCurrency(ins.costo_unitario)}</td>
                              <td className="p-2 text-right font-semibold text-emerald-700">{formatCurrency(ins.valor_total)}</td>
                            </tr>
                          )))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Resumen costos */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-violet-600 text-white px-4 py-2 font-bold text-sm">RESUMEN DE COSTOS</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 text-xs">
                    {[['Costo Total Acumulado', formatCurrency(selectedItem.costo_total_proceso_pintura)], ['Costo Promedio / Hoja', formatCurrency(selectedItem.costo_promedio_por_hoja)], ['Total Hojas Buenas', totalBuenas], ['% Merma General', hojasCons > 0 ? `${((1 - totalBuenas / hojasCons) * 100).toFixed(1)}%` : '—']].map(([label, val]) => (
                      <div key={label} className="bg-violet-50 rounded p-2 text-center"><p className="text-violet-600 font-semibold">{label}</p><p className="font-bold text-violet-900 text-base">{val}</p></div>
                    ))}
                  </div>
                </div>
                {selectedItem.observaciones && <div className="border rounded p-3 bg-slate-50"><p className="font-semibold text-slate-700">Observaciones:</p><p className="text-slate-600 mt-1">{selectedItem.observaciones}</p></div>}
              </div>
            );
          })()}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}