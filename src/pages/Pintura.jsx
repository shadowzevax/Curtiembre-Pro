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
import { Plus, Edit, Trash2, Eye, Table as TableIcon, X, CheckCircle2 } from 'lucide-react';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-CO') : 'N/A';
const fmt2 = (v) => (parseFloat(v) || 0).toFixed(2);

const TIPOS_ACABADO = [
  { value: 'NAPA', label: 'NAPA' },
  { value: 'NAPA_MATE', label: 'NAPA MATE' },
  { value: 'OPACO', label: 'OPACO' },
  { value: 'ENVEJECIDO', label: 'ENVEJECIDO' },
  { value: 'OTROS', label: 'OTROS' },
];

const TIPOS_CUERO = [
  { value: 'PELO', label: 'PELO' },
  { value: 'CROSTA', label: 'CROSTA' },
  { value: 'LIJADO', label: 'LIJADO' },
];

const COLORES_BASE = ['NEGRO', 'CAFÉ', 'AZUL', 'MIEL', 'BLANCO', 'QUEBRACHO', 'ROJO', 'VERDE'];

// ── Sublote vacío ──────────────────────────────────────────────────────────
const newSublote = (idx, codigoBase) => ({
  id_temp: `sub-${Date.now()}-${idx}`,
  codigo_sublote: codigoBase ? `${codigoBase}-PIN-${String(idx + 1).padStart(2, '0')}` : `SUB-${String(idx + 1).padStart(2, '0')}`,
  tipo_acabado: '',
  color_final: '',
  cantidad_hojas: 0,
  peso_asignado: 0,
  pct_participacion: 0,
  observaciones: '',
  estado: 'pendiente',
  insumos: [],
  mano_obra: [],
  // control producción final
  hojas_iniciales: 0,
  hojas_buenas: 0,
  hojas_defectuosas: 0,
  hojas_rechazadas: 0,
  peso_final: 0,
  obs_calidad: '',
});

export default function Pintura() {
  // ── DATA ───────────────────────────────────────────────────────────────────
  const [procesos, setProcesos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [insumosQuimicos, setInsumosQuimicos] = useState([]);
  const [productosTerminados, setProductosTerminados] = useState([]);
  const [coloresCatalogo, setColoresCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── MODAL ──────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // ── SELECCIÓN CUERO EN PROCESO ─────────────────────────────────────────────
  const [searchCuero, setSearchCuero] = useState('');
  const [filtroCueroColor, setFiltroCueroColor] = useState('');
  const [filtroCueroEtapa, setFiltroCueroEtapa] = useState('');
  const [cueroSeleccionado, setCueroSeleccionado] = useState(null); // registro de InventarioEnProceso
  const [hojasAConsumir, setHojasAConsumir] = useState(0);

  // ── SUBLOTES DE PINTURA ────────────────────────────────────────────────────
  const [sublotes, setSublotes] = useState([]);
  const [subloteActivoIdx, setSubloteActivoIdx] = useState(0);

  const subloteActivo = sublotes[subloteActivoIdx] || null;
  const setSubloteActivo = (changes) => setSublotes(prev => prev.map((s, i) => i === subloteActivoIdx ? { ...s, ...changes } : s));

  // ── CARGAR DATOS ───────────────────────────────────────────────────────────
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
      setProcesos(Array.isArray(procesosData) ? procesosData : []);
      setInsumosQuimicos(Array.isArray(insumosData) ? insumosData : []);
      setInventarioEnProceso(Array.isArray(inventarioData) ? inventarioData : []);
      setProductosTerminados(Array.isArray(productosTermData) ? productosTermData : []);
      setColoresCatalogo(Array.isArray(coloresData) ? coloresData.filter(c => c.estado === 'activo') : []);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── CUEROS EN PROCESO DISPONIBLES ─────────────────────────────────────────
  // Incluye etapas: recurtido (FINALIZADO) y curtido (EN_PROCESO) que tienen hojas disponibles
  const cueroDisponible = inventarioEnProceso.filter(i =>
    (i.cantidad_hojas || 0) > 0 &&
    (i.etapa_actual === 'recurtido' || i.etapa_actual === 'curtido' || i.etapa_actual === 'limpieza')
  );

  const cueroFiltrado = cueroDisponible.filter(i => {
    const matchSearch = !searchCuero || (i.codigo_lote || '').toLowerCase().includes(searchCuero.toLowerCase()) || (i.descripcion || '').toLowerCase().includes(searchCuero.toLowerCase()) || (i.color_base || '').toLowerCase().includes(searchCuero.toLowerCase());
    const matchColor = !filtroCueroColor || (i.color_base || '').toUpperCase() === filtroCueroColor;
    const matchEtapa = !filtroCueroEtapa || i.etapa_actual === filtroCueroEtapa;
    return matchSearch && matchColor && matchEtapa;
  });

  // ── ABRIR MODAL ────────────────────────────────────────────────────────────
  const handleOpenModal = (item = null) => {
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
        fecha_entrega_pintor: new Date().toISOString().split('T')[0],
        fecha_inicio_pintura: new Date().toISOString().split('T')[0],
        pintor_responsable: '',
        estado_pedido_pintura: 'pendiente',
        observaciones: '',
        finalizar_pintura: false,
      });
      setCueroSeleccionado(null);
      setHojasAConsumir(0);
      setSublotes([]);
      setSubloteActivoIdx(0);
    } else {
      setCurrentItem(item);
      // Restaurar cuero seleccionado si existe
      const inv = item.inv_proceso_id ? inventarioEnProceso.find(i => i.id === item.inv_proceso_id) : null;
      setCueroSeleccionado(inv || null);
      setHojasAConsumir(item.hojas_a_consumir || 0);
      setSublotes(item.sublotes_pintura || []);
      setSubloteActivoIdx(0);
    }
    setSearchCuero('');
    setFiltroCueroColor('');
    setFiltroCueroEtapa('');
    setShowModal(true);
  };

  // ── SELECCIONAR CUERO EN PROCESO ───────────────────────────────────────────
  const handleSeleccionarCuero = (id) => {
    const inv = inventarioEnProceso.find(i => i.id === id);
    if (!inv) return;
    setCueroSeleccionado(inv);
    setHojasAConsumir(0);
    setSublotes([]);
    setSubloteActivoIdx(0);
    setCurrentItem(prev => ({ ...prev, inv_proceso_id: inv.id, codigo_lote: inv.codigo_lote }));
  };

  // ── SUBLOTES DE PINTURA ────────────────────────────────────────────────────
  const handleAgregarSublote = () => {
    const idx = sublotes.length;
    const codigoBase = cueroSeleccionado?.codigo_lote || '';
    setSublotes(prev => [...prev, newSublote(idx, codigoBase)]);
    setSubloteActivoIdx(idx);
  };

  const handleEliminarSublote = (idx) => {
    setSublotes(prev => prev.filter((_, i) => i !== idx));
    setSubloteActivoIdx(Math.max(0, subloteActivoIdx - 1));
  };

  const handleSubloteFieldChange = (field, value) => {
    setSubloteActivo({ [field]: value });
  };

  // ── DISTRIBUCIÓN HOJAS ─────────────────────────────────────────────────────
  const totalHojasAsignadas = sublotes.reduce((s, sub) => s + (parseFloat(sub.cantidad_hojas) || 0), 0);
  const hojasRestantesDistribucion = hojasAConsumir - totalHojasAsignadas;

  const recalcPctParticipacion = (subs, hojasTotales) =>
    subs.map(s => ({
      ...s,
      pct_participacion: hojasTotales > 0 ? ((parseFloat(s.cantidad_hojas) || 0) / hojasTotales * 100) : 0,
      hojas_iniciales: parseFloat(s.cantidad_hojas) || 0,
    }));

  const handleHojasSubloChange = (field, value) => {
    setSublotes(prev => {
      const updated = prev.map((s, i) => i === subloteActivoIdx ? { ...s, [field]: parseFloat(value) || 0 } : s);
      return recalcPctParticipacion(updated, hojasAConsumir);
    });
  };

  // ── INSUMOS POR SUBLOTE ────────────────────────────────────────────────────
  const todosLosItems = [
    ...insumosQuimicos.map(i => ({ id: i.id, codigo: i.codigo || '', descripcion: i.nombre || i.descripcion || '', costo_promedio: i.costo_promedio || 0 })),
    ...productosTerminados.map(p => ({ id: p.id, codigo: p.codigo || '', descripcion: p.descripcion || '', costo_promedio: p.costo_promedio || 0 }))
  ].filter(i => i.codigo);

  const handleAddInsumo = () => {
    setSubloteActivo({
      insumos: [...(subloteActivo?.insumos || []), {
        item_id: '', codigo: '', producto: '', cantidad: 0, costo_unitario: 0, iva: 0.19, valor_total: 0
      }]
    });
  };

  const handleRemoveInsumo = (insIdx) => {
    setSubloteActivo({ insumos: (subloteActivo?.insumos || []).filter((_, i) => i !== insIdx) });
  };

  const handleInsumoChange = (insIdx, field, value) => {
    const ins = [...(subloteActivo?.insumos || [])];
    ins[insIdx] = { ...ins[insIdx], [field]: value };
    if (field === 'item_id') {
      const found = todosLosItems.find(i => i.id === value);
      if (found) { ins[insIdx].codigo = found.codigo; ins[insIdx].producto = found.descripcion; ins[insIdx].costo_unitario = found.costo_promedio; }
    }
    const cant = parseFloat(field === 'cantidad' ? value : ins[insIdx].cantidad) || 0;
    const cu = parseFloat(field === 'costo_unitario' ? value : ins[insIdx].costo_unitario) || 0;
    const iva = parseFloat(ins[insIdx].iva) || 0;
    const sub = cant * cu;
    ins[insIdx].valor_total = sub + sub * iva;
    setSubloteActivo({ insumos: ins });
  };

  // ── MANO DE OBRA POR SUBLOTE ───────────────────────────────────────────────
  const handleAddManoObra = () => {
    setSubloteActivo({
      mano_obra: [...(subloteActivo?.mano_obra || []), { detalle: '', cantidad_hojas: 0, valor_por_hoja: 0, total: 0, observacion: '' }]
    });
  };

  const handleRemoveManoObra = (idx) => {
    setSubloteActivo({ mano_obra: (subloteActivo?.mano_obra || []).filter((_, i) => i !== idx) });
  };

  const handleManoObraChange = (idx, field, value) => {
    const mo = [...(subloteActivo?.mano_obra || [])];
    mo[idx] = { ...mo[idx], [field]: value };
    if (field === 'cantidad_hojas' || field === 'valor_por_hoja') {
      const cant = parseFloat(field === 'cantidad_hojas' ? value : mo[idx].cantidad_hojas) || 0;
      const val  = parseFloat(field === 'valor_por_hoja' ? value : mo[idx].valor_por_hoja) || 0;
      mo[idx].total = cant * val;
    }
    setSubloteActivo({ mano_obra: mo });
  };

  // ── COSTOS POR SUBLOTE ─────────────────────────────────────────────────────
  const getCostosSublote = (sub) => {
    const totalHojasLote = parseFloat(cueroSeleccionado?.cantidad_hojas) || 1;
    const costoAcumLote  = parseFloat(cueroSeleccionado?.costo_acumulado) || 0;
    const hojasSubl = parseFloat(sub?.cantidad_hojas) || 0;
    const pesoSubl  = parseFloat(sub?.peso_asignado) || 0;

    const costoHeredado   = totalHojasLote > 0 ? (hojasSubl / totalHojasLote) * costoAcumLote : 0;
    const costoInsumos    = (sub?.insumos || []).reduce((s, i) => s + (parseFloat(i.valor_total) || 0), 0);
    const costoManoObra   = (sub?.mano_obra || []).reduce((s, m) => s + (parseFloat(m.total) || 0), 0);
    const costoTotal      = costoHeredado + costoInsumos + costoManoObra;
    const hojasBuenas     = parseFloat(sub?.hojas_buenas) || hojasSubl;
    const costoPorHoja    = hojasBuenas > 0 ? costoTotal / hojasBuenas : 0;
    const costoPorKg      = pesoSubl > 0 ? costoTotal / pesoSubl : 0;
    return { costoHeredado, costoInsumos, costoManoObra, costoTotal, costoPorHoja, costoPorKg, hojasSubl, pesoSubl, hojasBuenas };
  };

  // ── RESUMEN CONSOLIDADO ────────────────────────────────────────────────────
  const getResumen = () => {
    const costoHeredadoTotal = sublotes.reduce((s, sub) => s + getCostosSublote(sub).costoHeredado, 0);
    const costoInsumosTotal  = sublotes.reduce((s, sub) => s + getCostosSublote(sub).costoInsumos, 0);
    const costoMOTotal       = sublotes.reduce((s, sub) => s + getCostosSublote(sub).costoManoObra, 0);
    const costoTotal         = costoHeredadoTotal + costoInsumosTotal + costoMOTotal;
    const hojasBuenasTotal   = sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_buenas) || parseFloat(sub.cantidad_hojas) || 0), 0);
    const pesoTotal          = sublotes.reduce((s, sub) => s + (parseFloat(sub.peso_final) || parseFloat(sub.peso_asignado) || 0), 0);
    const hojasDef           = sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_defectuosas) || 0), 0);
    const hojasRech          = sublotes.reduce((s, sub) => s + (parseFloat(sub.hojas_rechazadas) || 0), 0);
    const costoPorHoja       = hojasBuenasTotal > 0 ? costoTotal / hojasBuenasTotal : 0;
    const costoPorKg         = pesoTotal > 0 ? costoTotal / pesoTotal : 0;
    return { costoHeredadoTotal, costoInsumosTotal, costoMOTotal, costoTotal, hojasBuenasTotal, pesoTotal, hojasDef, hojasRech, costoPorHoja, costoPorKg };
  };

  // ── GUARDAR ────────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (!cueroSeleccionado && !isEditing) { alert('⚠️ Seleccione un cuero en proceso.'); return; }
    if (hojasAConsumir <= 0) { alert('⚠️ Ingrese la cantidad de hojas a consumir.'); return; }
    if (sublotes.length === 0) { alert('⚠️ Agregue al menos un sublote de pintura.'); return; }
    if (totalHojasAsignadas > hojasAConsumir) { alert(`❌ Hojas asignadas (${totalHojasAsignadas}) superan las disponibles (${hojasAConsumir}).`); return; }

    try {
      const res = getResumen();
      const esFinalizacion = currentItem.finalizar_pintura;
      const estadoAuto = esFinalizacion ? 'terminado' : sublotes.length > 0 ? 'parcial' : 'pendiente';

      const dataToSave = {
        ...currentItem,
        inv_proceso_id: cueroSeleccionado?.id || currentItem.inv_proceso_id || '',
        codigo_lote: cueroSeleccionado?.codigo_lote || currentItem.codigo_lote || '',
        hojas_a_consumir: hojasAConsumir,
        total_hojas_enviadas_pintura: hojasAConsumir,
        sublotes_pintura: sublotes,
        costo_total_proceso_pintura: res.costoTotal,
        costo_promedio_por_hoja: res.costoPorHoja,
        costo_promedio_por_kg: res.costoPorKg,
        hojas_buenas_finales: res.hojasBuenasTotal,
        peso_final_total: res.pesoTotal,
        estado_pedido_pintura: estadoAuto,
      };

      let procesoId;
      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
        procesoId = currentItem.id;
      } else {
        const created = await ProcesoProduccion.create(dataToSave);
        procesoId = created.id;
      }

      // Descontar hojas del inventario en proceso
      if (!isEditing && cueroSeleccionado) {
        const nuevaCantidad = Math.max(0, (cueroSeleccionado.cantidad_hojas || 0) - hojasAConsumir);
        await InventarioEnProceso.update(cueroSeleccionado.id, {
          cantidad_hojas: nuevaCantidad,
          estado_actual: nuevaCantidad <= 0 ? 'FINALIZADO' : 'EN_PROCESO',
        });
      }

      // Si finaliza: descontar insumos + enviar hojas buenas a ProductoTerminado
      if (esFinalizacion && !isEditing) {
        const fechaHoy = new Date().toISOString().split('T')[0];

        for (const sub of sublotes) {
          // Descontar insumos del sublote
          for (const ins of (sub.insumos || [])) {
            const insumo = insumosQuimicos.find(i => i.id === ins.item_id);
            if (insumo && (parseFloat(ins.cantidad) || 0) > 0) {
              await MovimientoInventario.create({
                tipo_movimiento: 'salida', insumo_id: insumo.id,
                cantidad: -(parseFloat(ins.cantidad)),
                costo_unitario: parseFloat(ins.costo_unitario) || 0,
                fecha_movimiento: fechaHoy,
                referencia: currentItem.id_consecutivo,
                observaciones: `Pintura ${currentItem.id_consecutivo} - Sublote ${sub.codigo_sublote}`,
              });
              await Insumo.update(insumo.id, { stock_actual: Math.max(0, (insumo.stock_actual || 0) - parseFloat(ins.cantidad)) });
            }
          }

          // Enviar hojas buenas a ProductoTerminado
          const hojasBuenas = parseFloat(sub.hojas_buenas) || parseFloat(sub.cantidad_hojas) || 0;
          if (hojasBuenas > 0) {
            const costoSub = getCostosSublote(sub);
            const tipoCuero = cueroSeleccionado?.tipo_cuero || 'PELO';
            const tipoAcabado = sub.tipo_acabado || '';
            const colorFinal = sub.color_final || '';
            const descripcionAuto = `${tipoCuero} - ${tipoAcabado} - ${colorFinal}`.toUpperCase();

            const existentes = productosTerminados.filter(pt =>
              pt.tipo_cuero === tipoCuero && pt.tipo_acabado === tipoAcabado && pt.color_final === colorFinal
            );

            if (existentes.length > 0) {
              const pt = existentes[0];
              await ProductoTerminado.update(pt.id, {
                stock_actual: (pt.stock_actual || 0) + hojasBuenas,
                costo_promedio: costoSub.costoPorHoja,
              });
            } else {
              const codigoAuto = `PT-${tipoCuero.substring(0,2)}-${tipoAcabado.substring(0,3)}-${colorFinal.substring(0,5)}-${Date.now()}`.toUpperCase();
              await ProductoTerminado.create({
                codigo: codigoAuto,
                descripcion: descripcionAuto,
                tipo_cuero: tipoCuero,
                tipo_acabado: tipoAcabado,
                color_final: colorFinal,
                categoria: 'hojas_procesadas',
                unidad_medida: 'HOJA',
                stock_actual: hojasBuenas,
                costo_promedio: costoSub.costoPorHoja,
                stock_minimo: 0,
                proceso_origen_id: currentItem.id_consecutivo,
                lote_origen: cueroSeleccionado?.codigo_lote || '',
                sublote_pintura: sub.codigo_sublote || '',
                fecha_ingreso: fechaHoy,
                peso_actual: parseFloat(sub.peso_final) || parseFloat(sub.peso_asignado) || 0,
                costo_total_acumulado: costoSub.costoTotal,
                costo_promedio_kg: costoSub.costoPorKg,
              });
            }
          }
        }
      }

      setShowModal(false);
      loadData();
      alert(`✅ Proceso de pintura ${esFinalizacion ? 'finalizado' : 'guardado'} con éxito.`);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar el proceso: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proceso de pintura?')) return;
    try { await ProcesoProduccion.delete(id); loadData(); } catch (error) { console.error(error); }
  };

  const esFinalizado = currentItem?.estado_pedido_pintura === 'terminado' || currentItem?.finalizar_pintura;

  // ── TABLA PRINCIPAL ────────────────────────────────────────────────────────
  const headers = ['ID', 'Lote Origen', 'Fecha', 'Pintor', 'Hojas Consumidas', 'Hojas Buenas', 'Costo Total', 'Estado', 'Acciones'];
  const renderRow = (item) => (
    <tr key={item.id}>
      <td className="font-mono font-bold text-xs">{item.id_consecutivo || item.numero_proceso || 'N/A'}</td>
      <td className="font-mono text-xs">{item.codigo_lote || '—'}</td>
      <td className="text-xs">{formatDate(item.fecha_entrega_pintor)}</td>
      <td className="text-xs">{item.pintor_responsable || 'N/A'}</td>
      <td className="text-center font-bold text-xs">{item.hojas_a_consumir || item.total_hojas_enviadas_pintura || 0}</td>
      <td className="text-center font-bold text-green-600 text-xs">{item.hojas_buenas_finales || 0}</td>
      <td className="text-right text-xs font-semibold text-emerald-700">{formatCurrency(item.costo_total_proceso_pintura)}</td>
      <td>
        <span className={`px-2 py-1 rounded text-xs font-medium ${item.estado_pedido_pintura === 'terminado' ? 'bg-green-100 text-green-700' : item.estado_pedido_pintura === 'parcial' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
          {(item.estado_pedido_pintura || 'PENDIENTE').toUpperCase()}
        </span>
      </td>
      <td>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => { setSelectedItem(item); setShowDetailModal(true); }}><Eye className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader title="Pintura" description="Control de pintura con trazabilidad desde inventario de cueros en proceso hasta productos terminados."
        onPrint={() => window.print()}
        actionButton={<Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" />Nueva Pintura</Button>}
      />

      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Procesos de Pintura</CardTitle></CardHeader>
        <CardContent>{loading ? <p>Cargando...</p> : <DataTable headers={headers} data={procesos} renderRow={renderRow} />}</CardContent>
      </Card>

      {/* ══════════════════ MODAL PRINCIPAL ══════════════════════════════════ */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Editar' : 'Nueva'} Pintura
              {esFinalizado && <span className="text-red-500 text-sm ml-2">(FINALIZADO - Solo lectura)</span>}
            </DialogTitle>
          </DialogHeader>

          {currentItem && (
          <form onSubmit={handleSave} className="space-y-5">

            {/* ═══ ENCABEZADO ═══ */}
            <div className="grid grid-cols-4 gap-4">
              <div>
                <Label>ID/Consecutivo</Label>
                <Input value={currentItem.id_consecutivo || ''} readOnly className="bg-gray-100 font-mono font-bold" />
              </div>
              <div>
                <Label>Fecha Entrega al Pintor *</Label>
                <Input type="date" value={currentItem.fecha_entrega_pintor || ''} disabled={esFinalizado}
                  onChange={e => setCurrentItem({...currentItem, fecha_entrega_pintor: e.target.value})} required />
              </div>
              <div>
                <Label>Fecha Inicio de Pintura *</Label>
                <Input type="date" value={currentItem.fecha_inicio_pintura || ''} disabled={esFinalizado}
                  onChange={e => setCurrentItem({...currentItem, fecha_inicio_pintura: e.target.value})} required />
              </div>
              <div>
                <Label>Pintor / Responsable</Label>
                <Input value={currentItem.pintor_responsable || ''} disabled={esFinalizado}
                  onChange={e => setCurrentItem({...currentItem, pintor_responsable: e.target.value})} />
              </div>
            </div>

            {/* ═══ BLOQUE 1: SELECCIÓN DE CUEROS EN PROCESO ═══ */}
            <div className="border-2 border-indigo-400 rounded-xl overflow-hidden">
              <div className="bg-indigo-700 text-white px-5 py-3">
                <h3 className="font-bold text-base">① SELECCIÓN DE CUEROS EN PROCESO</h3>
                <p className="text-xs text-indigo-200 mt-0.5">Busque y seleccione hojas disponibles desde el inventario de cueros en proceso</p>
              </div>

              {/* Filtros */}
              <div className="bg-indigo-50 border-b border-indigo-200 px-5 py-3 grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-indigo-700 font-semibold">Buscar (código, lote, color)</Label>
                  <Input value={searchCuero} onChange={e => setSearchCuero(e.target.value)}
                    placeholder="Buscar..." className="h-8 text-xs mt-1" disabled={esFinalizado} />
                </div>
                <div>
                  <Label className="text-xs text-indigo-700 font-semibold">Filtrar por Color Base</Label>
                  <Select value={filtroCueroColor} onValueChange={setFiltroCueroColor}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Todos..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>— Todos los colores —</SelectItem>
                      {COLORES_BASE.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-indigo-700 font-semibold">Filtrar por Etapa</Label>
                  <Select value={filtroCueroEtapa} onValueChange={setFiltroCueroEtapa}>
                    <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Todos..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>— Todas las etapas —</SelectItem>
                      <SelectItem value="recurtido">Recurtido</SelectItem>
                      <SelectItem value="curtido">Curtido</SelectItem>
                      <SelectItem value="limpieza">Limpieza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Selector cuero */}
              <div className="bg-white px-5 py-3">
                <Label className="text-xs font-bold text-indigo-700">Seleccionar Cuero en Proceso *</Label>
                <Select value={cueroSeleccionado?.id || ''} onValueChange={handleSeleccionarCuero} disabled={esFinalizado}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar cuero..." /></SelectTrigger>
                  <SelectContent>
                    {cueroFiltrado.length === 0 && <SelectItem value="__e__" disabled>Sin cueros disponibles</SelectItem>}
                    {cueroFiltrado.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.codigo_lote} — {inv.descripcion || inv.color_base} ({inv.cantidad_hojas} hojas | {inv.peso_actual} kg) [{(inv.etapa_actual || '').toUpperCase()}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Info heredada */}
                {cueroSeleccionado && (
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs bg-indigo-50 border border-indigo-200 rounded p-3">
                    <div><span className="font-semibold text-indigo-700">Código en Proceso:</span> <span className="font-mono font-bold">{cueroSeleccionado.codigo_lote}</span></div>
                    <div><span className="font-semibold text-indigo-700">Lote Origen:</span> {cueroSeleccionado.codigo_lote_padre || cueroSeleccionado.codigo_lote}</div>
                    <div><span className="font-semibold text-indigo-700">Color Base:</span> <strong>{cueroSeleccionado.color_base || '—'}</strong></div>
                    <div><span className="font-semibold text-indigo-700">Partida Base:</span> {cueroSeleccionado.codigo_color || '—'}</div>
                    <div><span className="font-semibold text-indigo-700">Hojas Disponibles:</span> <strong className="text-green-700">{cueroSeleccionado.cantidad_hojas}</strong></div>
                    <div><span className="font-semibold text-indigo-700">Peso Actual:</span> {cueroSeleccionado.peso_actual} kg</div>
                    <div><span className="font-semibold text-indigo-700">Costo Acumulado:</span> <strong className="text-amber-700">{formatCurrency(cueroSeleccionado.costo_acumulado)}</strong></div>
                    <div><span className="font-semibold text-indigo-700">Costo/Hoja:</span> {formatCurrency(cueroSeleccionado.costo_promedio)}</div>
                    <div><span className="font-semibold text-indigo-700">Etapa:</span> <span className="uppercase font-bold text-blue-700">{cueroSeleccionado.etapa_actual}</span></div>
                    <div><span className="font-semibold text-indigo-700">Fecha Ingreso:</span> {formatDate(cueroSeleccionado.fecha_ingreso_proceso)}</div>
                  </div>
                )}

                {/* Hojas a consumir */}
                {cueroSeleccionado && (
                  <div className="mt-3 flex items-end gap-4">
                    <div className="w-56">
                      <Label className="text-xs font-bold text-indigo-700">Hojas a Consumir en este Proceso *</Label>
                      <Input type="number" min="1" max={cueroSeleccionado.cantidad_hojas}
                        value={hojasAConsumir || ''}
                        disabled={esFinalizado}
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          setHojasAConsumir(val);
                          setSublotes(prev => recalcPctParticipacion(prev, val));
                        }}
                        className={`mt-1 text-xs ${hojasAConsumir > (cueroSeleccionado.cantidad_hojas || 0) ? 'border-red-500 bg-red-50' : ''}`} />
                      <p className="text-xs text-slate-400 mt-0.5">Máx. disponible: <strong>{cueroSeleccionado.cantidad_hojas}</strong> hojas</p>
                    </div>
                    <div className={`flex-1 p-3 rounded border text-xs font-medium ${hojasAConsumir > (cueroSeleccionado.cantidad_hojas || 0) ? 'bg-red-50 border-red-300 text-red-700' : hojasAConsumir > 0 ? 'bg-green-50 border-green-300 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                      {hojasAConsumir > (cueroSeleccionado.cantidad_hojas || 0)
                        ? `❌ Excede el disponible en ${hojasAConsumir - cueroSeleccionado.cantidad_hojas} hojas`
                        : hojasAConsumir > 0
                          ? `✔ Consumirá ${hojasAConsumir} de ${cueroSeleccionado.cantidad_hojas} hojas disponibles. Quedarán ${cueroSeleccionado.cantidad_hojas - hojasAConsumir} hojas en inventario.`
                          : 'Ingrese la cantidad de hojas a consumir'}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ BLOQUE 2: DISTRIBUCIÓN Y CREACIÓN DE SUBLOTES ═══ */}
            {(cueroSeleccionado || isEditing) && (
              <div className="border-2 border-orange-400 rounded-xl overflow-hidden">
                <div className="bg-orange-600 text-white px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base">② DISTRIBUCIÓN Y CREACIÓN DE SUBLOTES DE PINTURA</h3>
                    <p className="text-xs text-orange-200 mt-0.5">Divida las hojas seleccionadas en sublotes independientes por acabado/color</p>
                  </div>
                  {!esFinalizado && (
                    <Button type="button" onClick={handleAgregarSublote}
                      className="bg-white text-orange-700 hover:bg-orange-50 text-xs h-8">
                      <Plus className="w-3 h-3 mr-1" />Agregar Sublote
                    </Button>
                  )}
                </div>

                {/* Indicador distribución */}
                {hojasAConsumir > 0 && (
                  <div className={`px-5 py-2 text-xs flex items-center gap-4 border-b ${hojasRestantesDistribucion < 0 ? 'bg-red-50 border-red-200' : hojasRestantesDistribucion === 0 && sublotes.length > 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                    <span>Total a distribuir: <strong>{hojasAConsumir}</strong> hojas</span>|
                    <span>Asignadas: <strong className={hojasRestantesDistribucion < 0 ? 'text-red-700' : 'text-orange-800'}>{totalHojasAsignadas}</strong></span>|
                    <span>Restantes: <strong className={hojasRestantesDistribucion < 0 ? 'text-red-700' : hojasRestantesDistribucion === 0 ? 'text-green-700' : 'text-orange-700'}>{hojasRestantesDistribucion}</strong></span>
                    {hojasRestantesDistribucion === 0 && sublotes.length > 0 && <span className="text-green-700 font-bold">✔ Distribución completa</span>}
                    {hojasRestantesDistribucion < 0 && <span className="text-red-700 font-bold">✖ Excede el total</span>}
                  </div>
                )}

                {sublotes.length === 0 ? (
                  <div className="bg-white px-5 py-6 text-center text-slate-400 text-sm">Sin sublotes. Haga clic en "Agregar Sublote".</div>
                ) : (
                  <>
                    {/* Tabs sublotes */}
                    <div className="flex items-center gap-1 px-4 pt-3 bg-white border-b overflow-x-auto">
                      {sublotes.map((sub, idx) => (
                        <button key={sub.id_temp || idx} type="button"
                          onClick={() => setSubloteActivoIdx(idx)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 whitespace-nowrap ${subloteActivoIdx === idx ? 'bg-orange-100 border-orange-500 text-orange-800' : 'bg-gray-50 border-transparent text-slate-500 hover:bg-orange-50'}`}>
                          {sub.color_final || sub.tipo_acabado || `Sublote ${idx + 1}`}
                          {!esFinalizado && (
                            <span onClick={e => { e.stopPropagation(); handleEliminarSublote(idx); }}
                              className="ml-1 text-red-400 hover:text-red-600 font-bold">×</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Form sublote activo */}
                    {subloteActivo && (
                      <div className="bg-white px-5 py-4 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Código Sublote</Label>
                            <Input value={subloteActivo.codigo_sublote || ''} readOnly className="bg-amber-50 font-mono text-xs font-bold cursor-not-allowed" />
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
                              <SelectContent>
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
                            <Input type="number" min="0" value={subloteActivo.cantidad_hojas || ''}
                              disabled={esFinalizado}
                              onChange={e => handleHojasSubloChange('cantidad_hojas', e.target.value)}
                              className={`text-xs ${hojasRestantesDistribucion < 0 ? 'border-red-400 bg-red-50' : ''}`} />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">% Participación</Label>
                            <Input readOnly value={`${(subloteActivo.pct_participacion || 0).toFixed(1)}%`}
                              className="bg-blue-50 text-xs text-center font-bold text-blue-800 cursor-not-allowed" />
                            <p className="text-xs text-slate-400 mt-0.5">= Hojas Sublote ÷ Hojas a Consumir × 100</p>
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Observaciones</Label>
                            <Input value={subloteActivo.observaciones || ''} disabled={esFinalizado}
                              onChange={e => handleSubloteFieldChange('observaciones', e.target.value)}
                              className="text-xs" placeholder="Obs. del sublote..." />
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══ BLOQUE 3: ÍTEMS / PRODUCTOS (por sublote activo) ═══ */}
            {subloteActivo && (
              <div className="border-2 border-blue-400 rounded-xl overflow-hidden">
                <div className="bg-blue-700 text-white px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base">
                      ③ ÍTEMS / PRODUCTOS — Sublote: <span className="text-blue-200 font-mono">{subloteActivo.color_final || subloteActivo.tipo_acabado || `Sublote ${subloteActivoIdx + 1}`}</span>
                    </h3>
                    <p className="text-xs text-blue-200 mt-0.5">Insumos y químicos exclusivos de este sublote</p>
                  </div>
                  {!esFinalizado && (
                    <Button type="button" onClick={handleAddInsumo} size="sm" className="bg-white text-blue-700 hover:bg-blue-50 text-xs h-8">
                      <Plus className="w-3 h-3 mr-1" />Agregar Ítem
                    </Button>
                  )}
                </div>
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-xs table-fixed">
                    <colgroup>
                      <col className="w-[35%]" />
                      <col className="w-[12%]" />
                      <col className="w-[13%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[12%]" />
                      <col className="w-[6%]" />
                    </colgroup>
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
                        const cant = parseFloat(ins.cantidad) || 0;
                        const cu = parseFloat(ins.costo_unitario) || 0;
                        const ivaPct = parseFloat(ins.iva) || 0;
                        const valorIva = cant * cu * ivaPct;
                        return (
                          <tr key={insIdx} className="border-t align-top">
                            <td className="p-2">
                              <Select value={ins.item_id || ''} onValueChange={v => handleInsumoChange(insIdx, 'item_id', v)} disabled={esFinalizado}>
                                <SelectTrigger className="text-xs h-8 w-full"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>{todosLosItems.map(i => <SelectItem key={i.id} value={i.id}>{i.codigo} — {i.descripcion}</SelectItem>)}</SelectContent>
                              </Select>
                              {ins.producto && <p className="text-xs text-slate-400 mt-0.5 pl-1 truncate">{ins.producto}</p>}
                            </td>
                            <td className="p-2">
                              <Input type="number" step="0.01" value={ins.cantidad} disabled={esFinalizado}
                                onChange={e => handleInsumoChange(insIdx, 'cantidad', parseFloat(e.target.value) || 0)}
                                className="text-right text-xs h-8 w-full" />
                            </td>
                            <td className="p-2">
                              <Input type="number" step="0.01" value={ins.costo_unitario} disabled={esFinalizado}
                                onChange={e => handleInsumoChange(insIdx, 'costo_unitario', parseFloat(e.target.value) || 0)}
                                className="text-right text-xs h-8 w-full" />
                            </td>
                            <td className="p-2">
                              <Select value={String(ins.iva)} onValueChange={v => handleInsumoChange(insIdx, 'iva', parseFloat(v))} disabled={esFinalizado}>
                                <SelectTrigger className="text-xs h-8 w-full"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0.19">19%</SelectItem>
                                  <SelectItem value="0.05">5%</SelectItem>
                                  <SelectItem value="0">0%</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-2">
                              <Input readOnly value={formatCurrency(valorIva)} className="text-right text-xs h-8 w-full bg-yellow-50 font-medium text-yellow-800" />
                            </td>
                            <td className="p-2">
                              <Input readOnly value={formatCurrency(ins.valor_total)} className="text-right text-xs h-8 w-full bg-emerald-50 font-bold text-emerald-700" />
                            </td>
                            <td className="p-2">
                              {!esFinalizado && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveInsumo(insIdx)} className="h-7 w-7">
                                  <X className="w-3 h-3 text-red-500" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {(subloteActivo.insumos || []).length === 0 && (
                        <tr><td colSpan={7} className="p-4 text-center text-slate-400">Sin ítems. Haga clic en "Agregar Ítem".</td></tr>
                      )}
                    </tbody>
                    {(subloteActivo.insumos || []).length > 0 && (
                      <tfoot>
                        <tr className="bg-blue-100 font-bold border-t-2">
                          <td colSpan={4} className="p-2 text-right text-xs">TOTAL INSUMOS:</td>
                          <td className="p-2 text-right text-yellow-800">{formatCurrency((subloteActivo.insumos || []).reduce((s, i) => { const c = parseFloat(i.cantidad)||0; const cu = parseFloat(i.costo_unitario)||0; const iv = parseFloat(i.iva)||0; return s + c*cu*iv; }, 0))}</td>
                          <td className="p-2 text-right text-emerald-800">{formatCurrency((subloteActivo.insumos || []).reduce((s, i) => s + (parseFloat(i.valor_total) || 0), 0))}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Mano de obra por sublote */}
                <div className="border-t border-blue-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-sm text-blue-800">Mano de Obra — {subloteActivo.color_final || `Sublote ${subloteActivoIdx + 1}`}</h4>
                    {!esFinalizado && (
                      <Button type="button" onClick={handleAddManoObra} size="sm" variant="outline" className="text-xs h-7">
                        <Plus className="w-3 h-3 mr-1" />Agregar
                      </Button>
                    )}
                  </div>
                  <table className="w-full text-xs table-fixed">
                    <colgroup>
                      <col className="w-[30%]" />
                      <col className="w-[15%]" />
                      <col className="w-[15%]" />
                      <col className="w-[18%]" />
                      <col className="w-[16%]" />
                      <col className="w-[6%]" />
                    </colgroup>
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
            )}

            {/* ═══ BLOQUE 4: CONTROL DE COSTOS DEL PROCESO ═══ */}
            {subloteActivo && cueroSeleccionado && (() => {
              const c = getCostosSublote(subloteActivo);
              return (
                <div className="border-2 border-violet-500 rounded-xl overflow-hidden shadow-md">
                  <div className="bg-violet-700 text-white px-5 py-3">
                    <p className="font-bold text-base">④ CONTROL DE COSTOS DEL PROCESO — PINTURA</p>
                    <p className="text-xs text-violet-200 mt-0.5">Sublote activo: <strong className="font-mono">{subloteActivo.color_final || `Sublote ${subloteActivoIdx + 1}`}</strong> · Trazabilidad financiera independiente</p>
                  </div>

                  {/* Costos heredados */}
                  <div className="bg-amber-50 border-b border-amber-200 px-5 py-3">
                    <p className="text-xs font-bold text-amber-700 uppercase mb-2">📥 Costo Heredado del Proceso Anterior (proporcional al sublote)</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">Costo Heredado Sublote</p>
                        <p className="text-lg font-extrabold text-amber-800">{formatCurrency(c.costoHeredado)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">= ({c.hojasSubl} ÷ {cueroSeleccionado.cantidad_hojas}) × {formatCurrency(cueroSeleccionado.costo_acumulado)}</p>
                      </div>
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">Costo Insumos Sublote</p>
                        <p className="text-base font-bold text-blue-700">{formatCurrency(c.costoInsumos)}</p>
                      </div>
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">Costo Mano de Obra Sublote</p>
                        <p className="text-base font-bold text-green-700">{formatCurrency(c.costoManoObra)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tabla resumen */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-violet-800 text-white">
                        <tr>
                          <th className="p-2 text-right whitespace-nowrap">COSTO HEREDADO</th>
                          <th className="p-2 text-right whitespace-nowrap">+ INSUMOS</th>
                          <th className="p-2 text-right whitespace-nowrap">+ MANO OBRA</th>
                          <th className="p-2 text-right whitespace-nowrap font-extrabold">= COSTO TOTAL ACUMULADO</th>
                          <th className="p-2 text-center whitespace-nowrap">HOJAS BUENAS</th>
                          <th className="p-2 text-right whitespace-nowrap">COSTO / HOJA</th>
                          <th className="p-2 text-right whitespace-nowrap">COSTO / KG</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white hover:bg-violet-50">
                          <td className="p-2 text-right font-semibold text-amber-700">{formatCurrency(c.costoHeredado)}</td>
                          <td className="p-2 text-right font-semibold text-blue-700">{formatCurrency(c.costoInsumos)}</td>
                          <td className="p-2 text-right font-semibold text-green-700">{formatCurrency(c.costoManoObra)}</td>
                          <td className="p-2 text-right font-extrabold text-violet-800 text-sm">{formatCurrency(c.costoTotal)}</td>
                          <td className="p-2 text-center font-bold">{c.hojasBuenas || <span className="text-gray-400">—</span>}</td>
                          <td className="p-2 text-right font-bold text-emerald-700">{c.hojasBuenas > 0 ? formatCurrency(c.costoPorHoja) : '—'}</td>
                          <td className="p-2 text-right font-bold text-emerald-700">{c.pesoSubl > 0 ? formatCurrency(c.costoPorKg) : '—'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-slate-50 border-t px-5 py-2 text-xs text-slate-500">
                    🔗 Fórmulas: <strong>Costo Total</strong> = Heredado + Insumos + MO &nbsp;|&nbsp;
                    <strong>Costo/Hoja</strong> = Total ÷ Hojas Buenas &nbsp;|&nbsp;
                    <strong>Costo/Kg</strong> = Total ÷ Peso Final
                  </div>
                </div>
              );
            })()}

            {/* ═══ BLOQUE 5: CONTROL DE PRODUCCIÓN FINAL (por sublote) ═══ */}
            {subloteActivo && (
              <div className="border-2 border-red-400 rounded-xl overflow-hidden">
                <div className="bg-red-700 text-white px-5 py-3">
                  <h3 className="font-bold text-base">⑤ CONTROL DE PRODUCCIÓN FINAL — Sublote: <span className="font-mono text-red-200">{subloteActivo.color_final || `Sublote ${subloteActivoIdx + 1}`}</span></h3>
                  <p className="text-xs text-red-200 mt-0.5">Obligatorio antes de finalizar el proceso</p>
                </div>
                <div className="bg-white px-5 py-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs font-bold text-red-800">Hojas Iniciales</Label>
                      <Input readOnly value={subloteActivo.cantidad_hojas || 0} className="bg-slate-50 text-xs font-bold cursor-not-allowed" />
                      <p className="text-xs text-slate-400 mt-0.5">= Hojas asignadas al sublote</p>
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-red-800">Hojas Buenas Finales *</Label>
                      <Input type="number" min="0" value={subloteActivo.hojas_buenas || ''}
                        disabled={esFinalizado}
                        onChange={e => handleSubloteFieldChange('hojas_buenas', parseFloat(e.target.value) || 0)}
                        className="text-xs border-green-400" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-red-800">Hojas Defectuosas</Label>
                      <Input type="number" min="0" value={subloteActivo.hojas_defectuosas || ''}
                        disabled={esFinalizado}
                        onChange={e => handleSubloteFieldChange('hojas_defectuosas', parseFloat(e.target.value) || 0)}
                        className="text-xs border-orange-400" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-red-800">Hojas Rechazadas</Label>
                      <Input type="number" min="0" value={subloteActivo.hojas_rechazadas || ''}
                        disabled={esFinalizado}
                        onChange={e => handleSubloteFieldChange('hojas_rechazadas', parseFloat(e.target.value) || 0)}
                        className="text-xs border-red-400" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-red-800">% Merma</Label>
                      <Input readOnly
                        value={(() => {
                          const ini = parseFloat(subloteActivo.cantidad_hojas) || 0;
                          const buenas = parseFloat(subloteActivo.hojas_buenas) || 0;
                          return ini > 0 ? `${((1 - buenas / ini) * 100).toFixed(1)}%` : '—';
                        })()}
                        className="bg-orange-50 text-xs font-bold text-orange-800 cursor-not-allowed" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold text-red-800">Obs. de Calidad</Label>
                      <Input value={subloteActivo.obs_calidad || ''} disabled={esFinalizado}
                        onChange={e => handleSubloteFieldChange('obs_calidad', e.target.value)}
                        className="text-xs" placeholder="Observaciones de calidad..." />
                    </div>
                  </div>

                  {/* Validación hojas */}
                  {(() => {
                    const ini = parseFloat(subloteActivo.cantidad_hojas) || 0;
                    const buenas = parseFloat(subloteActivo.hojas_buenas) || 0;
                    const def = parseFloat(subloteActivo.hojas_defectuosas) || 0;
                    const rech = parseFloat(subloteActivo.hojas_rechazadas) || 0;
                    const suma = buenas + def + rech;
                    const ok = ini === 0 || suma === ini;
                    if (ini > 0) return (
                      <div className={`mt-3 p-2 rounded text-xs font-semibold ${ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                        {ok ? `✔ Hojas cuadran: ${buenas} buenas + ${def} defectuosas + ${rech} rechazadas = ${suma} / ${ini}` : `⚠️ No cuadran: ${buenas} + ${def} + ${rech} = ${suma} ≠ ${ini} hojas iniciales`}
                      </div>
                    );
                    return null;
                  })()}
                </div>
              </div>
            )}

            {/* ═══ BLOQUE 6: RESUMEN CONSOLIDADO ═══ */}
            {sublotes.length > 0 && (() => {
              const res = getResumen();
              return (
                <div className="border-2 border-emerald-500 rounded-xl overflow-hidden">
                  <div className="bg-emerald-700 text-white px-5 py-3">
                    <h3 className="font-bold text-base">⑥ RESUMEN GENERAL CONSOLIDADO DEL PROCESO DE PINTURA</h3>
                  </div>
                  <div className="bg-emerald-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Total Sublotes</p>
                      <p className="text-3xl font-extrabold text-emerald-800">{sublotes.length}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Hojas Buenas Finales</p>
                      <p className="text-3xl font-extrabold text-green-700">{res.hojasBuenasTotal}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Hojas Defectuosas</p>
                      <p className="text-2xl font-extrabold text-orange-600">{res.hojasDef}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Peso Final Total</p>
                      <p className="text-2xl font-extrabold text-blue-700">{fmt2(res.pesoTotal)} kg</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Costo Heredado Total</p>
                      <p className="text-lg font-extrabold text-amber-700">{formatCurrency(res.costoHeredadoTotal)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Total Insumos</p>
                      <p className="text-lg font-extrabold text-blue-700">{formatCurrency(res.costoInsumosTotal)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Total Mano de Obra</p>
                      <p className="text-lg font-extrabold text-green-700">{formatCurrency(res.costoMOTotal)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-300 p-3 text-center ring-2 ring-emerald-400">
                      <p className="text-xs text-emerald-700 font-semibold">Costo Total Acumulado</p>
                      <p className="text-xl font-extrabold text-emerald-800">{formatCurrency(res.costoTotal)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-300 p-3 text-center ring-1 ring-emerald-400">
                      <p className="text-xs text-emerald-700 font-semibold">Costo Promedio / Hoja Buena</p>
                      <p className="text-xl font-extrabold text-emerald-800">{formatCurrency(res.costoPorHoja)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-300 p-3 text-center ring-1 ring-emerald-400">
                      <p className="text-xs text-emerald-700 font-semibold">Costo Promedio / Kg</p>
                      <p className="text-xl font-extrabold text-emerald-800">{formatCurrency(res.costoPorKg)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div>
              <Label>Observaciones Generales</Label>
              <Textarea value={currentItem.observaciones || ''} disabled={esFinalizado}
                onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={2} />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              {!esFinalizado && (
                <>
                  <Button type="submit" variant="outline" className="border-blue-500 text-blue-700 hover:bg-blue-50"
                    onClick={() => setCurrentItem(prev => ({ ...prev, finalizar_pintura: false }))}>
                    💾 Guardar Borrador
                  </Button>
                  <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setCurrentItem(prev => ({ ...prev, finalizar_pintura: true }))}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />Finalizar Proceso
                  </Button>
                </>
              )}
            </div>
          </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ MODAL DETALLE ══════════════════════════════════════════════════════ */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalle de Pintura</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">ID:</span> <span className="font-mono">{selectedItem.id_consecutivo || 'N/A'}</span></p>
              <p><span className="font-semibold">Lote Origen:</span> {selectedItem.codigo_lote || '—'}</p>
              <p><span className="font-semibold">Pintor:</span> {selectedItem.pintor_responsable || 'N/A'}</p>
              <p><span className="font-semibold">Hojas Consumidas:</span> {selectedItem.hojas_a_consumir || selectedItem.total_hojas_enviadas_pintura || 0}</p>
              <p><span className="font-semibold">Hojas Buenas:</span> <span className="text-green-700 font-bold">{selectedItem.hojas_buenas_finales || 0}</span></p>
              <p><span className="font-semibold">Costo Total:</span> <span className="text-emerald-700 font-bold text-lg">{formatCurrency(selectedItem.costo_total_proceso_pintura)}</span></p>
              <p><span className="font-semibold">Costo/Hoja:</span> {formatCurrency(selectedItem.costo_promedio_por_hoja)}</p>
              <p><span className="font-semibold">Estado:</span> <span className="capitalize font-bold">{selectedItem.estado_pedido_pintura}</span></p>
              {selectedItem.sublotes_pintura?.length > 0 && (
                <div className="border rounded p-2">
                  <p className="font-semibold text-xs mb-2">Sublotes ({selectedItem.sublotes_pintura.length}):</p>
                  {selectedItem.sublotes_pintura.map((s, i) => (
                    <div key={i} className="text-xs border-t py-1 flex justify-between">
                      <span className="font-mono font-bold">{s.codigo_sublote}</span>
                      <span>{s.color_final} | {s.tipo_acabado}</span>
                      <span>{s.cantidad_hojas} hojas → <strong className="text-green-700">{s.hojas_buenas || s.cantidad_hojas} buenas</strong></span>
                    </div>
                  ))}
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