import React, { useState, useEffect, useCallback, useRef } from "react";
import { ProcesoProduccion, Insumo, ProductoTerminado, MovimientoInventario, InventarioEnProceso, ProductoCatalogo } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Table, CheckCircle2, Lock, AlertCircle, Search, X, Edit2, Ban, History, ChevronDown } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';
import RecurtidoFichaIntegral from '../components/produccion/RecurtidoFichaIntegral';
import { deriveCodigoProducto, calcularRemanentePadre } from '@/lib/inventarioProceso';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(v || 0);
const fmt2 = (v) => (parseFloat(v) || 0).toFixed(2);
const fmtDate = (d) => { if (!d) return '—'; try { return new Date(d).toLocaleDateString('es-CO'); } catch { return d; } };

const calcInsumoTotales = (insumo) => {
  const cant = parseFloat(insumo.cantidad) || 0;
  const cu   = parseFloat(insumo.costo_unitario) || 0;
  const iva  = parseFloat(insumo.iva) || 0;
  const sub  = cant * cu;
  return { ...insumo, valor_total: sub + sub * iva };
};

const calcSubtotalInsumos = (insumos) =>
  (insumos || []).reduce((s, i) => s + (parseFloat(i.valor_total) || 0), 0);

const genCodigoSublote = (lotePadre, consecutivo) => {
  return `${lotePadre}-PR-${String(consecutivo).padStart(3, '0')}`;
};

const ESTADO_COLORS = {
  pendiente:   'bg-yellow-100 text-yellow-800 border-yellow-300',
  en_proceso:  'bg-blue-100 text-blue-800 border-blue-300',
  completado:  'bg-green-100 text-green-800 border-green-300',
  finalizado:  'bg-green-100 text-green-800 border-green-300',
  anulado:     'bg-red-100 text-red-800 border-red-300',
  borrador:    'bg-gray-100 text-gray-700 border-gray-300',
};

const ESTADO_LABELS = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  completado: 'Finalizada',
  anulado: 'Anulada',
  borrador: 'Borrador',
};

export default function ProcesoRecurtido() {
  const [procesos, setProcesos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [allInvProceso, setAllInvProceso] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [invSeleccionado, setInvSeleccionado] = useState(null);
  const [searchEnProceso, setSearchEnProceso] = useState('');

  const [sublotesForm, setSublotesForm] = useState([]);
  const [subloteActivoIdx, setSubloteActivoIdx] = useState(0);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [loteConsolidado, setLoteConsolidado] = useState(null);
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [itemToAnular, setItemToAnular] = useState(null);

  // Filtros
  const [filtros, setFiltros] = useState({ lotePadre: '', codigoPartida: '', codigoProducto: '', descripcion: '', color: '', estado: '', fechaIni: '', fechaFin: '' });
  const [lotePadreControl, setLotePadreControl] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, productosData, invEnProceso] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'recurtido' }),
        Insumo.list(),
        ProductoTerminado.list(),
        InventarioEnProceso.list(),
      ]);
      setProcesos(Array.isArray(procesosData) ? procesosData : []);
      setInsumos(Array.isArray(insumosData) ? insumosData : []);
      setProductos(Array.isArray(productosData) ? productosData : []);
      const allInv = Array.isArray(invEnProceso) ? invEnProceso : [];
      setAllInvProceso(allInv);
      // Un lote padre ya distribuido al 100% nunca debe volver a aparecer como
      // existencia disponible (evita la duplicidad lote padre + partidas).
      const filtrados = allInv.filter(i => {
        if (i.estado_actual !== 'EN_PROCESO' || i.etapa_actual !== 'curtido') return false;
        const { remanente } = calcularRemanentePadre(i, allInv);
        return remanente > 0;
      });
      setInventarioEnProceso(filtrados);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── HELPERS ──────────────────────────────────────────────────────────────
  const getSublotesLote = useCallback((lote) =>
    procesos.filter(p => p.codigo_lote === lote)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date)),
  [procesos]);

  const lotesPadreUnicos = [...new Set(procesos.map(p => p.codigo_lote).filter(Boolean))].sort();

  const isRecurtidoGeneralFinalizado = (lote) =>
    getSublotesLote(lote).some(p => p.finalizar_recurtido_general === true);

  // ─── VERIFICAR USO EN PROCESOS POSTERIORES ────────────────────────────────
  const verificarUsoEnProcesosPosteriores = async (proc) => {
    const codigo = proc.numero_proceso || proc.codigo_lote;
    const [pinturas, invProceso] = await Promise.all([
      ProcesoProduccion.filter({ tipo_proceso: 'pintura' }),
      InventarioEnProceso.list(),
    ]);
    const usadaEnPintura = pinturas.some(p =>
      p.codigo_sublote === codigo || p.inv_proceso_id === proc.inv_proceso_id ||
      (p.sublotes_pintura || []).some(s => s.codigo_sublote === codigo)
    );
    const usadaEnInv = invProceso.some(i => i.proceso_origen_id === proc.id || i.codigo_lote === codigo);
    return { usadaEnPintura, usadaEnInv, tieneUso: usadaEnPintura || usadaEnInv };
  };

  // ─── SUBLOTE ACTIVO ────────────────────────────────────────────────────────
  const subloteActivo = sublotesForm[subloteActivoIdx] || null;
  const setSubloteActivo = (changes) => {
    setSublotesForm(prev => prev.map((s, i) => i === subloteActivoIdx ? { ...s, ...changes } : s));
  };

  // ─── ABRIR MODAL NUEVO ────────────────────────────────────────────────────
  const handleOpenModal = () => {
    setIsEditing(false);
    setInvSeleccionado(null);
    setSearchEnProceso('');
    setSublotesForm([]);
    setSubloteActivoIdx(0);
    setShowModal(true);
  };

  // ─── EDITAR PARTIDA ────────────────────────────────────────────────────────
  const handleEditSublote = async (proc) => {
    const { tieneUso } = await verificarUsoEnProcesosPosteriores(proc);
    if (tieneUso) {
      alert('La Partida de Recurtido no puede ser modificada porque ya registra movimientos en procesos posteriores.');
      return;
    }
    setIsEditing(true);
    const inv = allInvProceso.find(i => i.codigo_lote === proc.codigo_lote) ||
      inventarioEnProceso.find(i => i.codigo_lote === proc.codigo_lote) || null;
    setInvSeleccionado(inv);
    setSublotesForm([{
      id_db: proc.id,
      id_temp: 'edit-0',
      codigo_sublote: proc.numero_proceso || proc.codigo_lote,
      color_base: proc.nombre_color || '',
      codigo_color: proc.codigo_color || '',
      cantidad_hojas: proc.cantidad_pieles || 0,
      peso_asignado: proc.peso_actual || 0,
      peso_promedio: proc.peso_promedio || 0,
      calibre: proc.calibre || '',
      recurtido_finalizado: proc.recurtido_finalizado || '',
      codigo_producto_proceso: proc.codigo_producto_proceso || '',
      descripcion_producto_proceso: proc.descripcion_producto_proceso || '',
      observaciones: proc.observaciones || '',
      insumos_utilizados: proc.insumos_utilizados || [],
      estado: proc.estado || 'pendiente',
      fecha_inicio: proc.fecha_inicio || new Date().toISOString().split('T')[0],
      fecha_fin: proc.fecha_fin || '',
      numero_sublote_recurtido: proc.numero_sublote_recurtido || 1,
      inv_proceso_id: proc.inv_proceso_id || '',
      finalizar_recurtido: proc.finalizar_recurtido || false,
    }]);
    setSubloteActivoIdx(0);
    setShowModal(true);
  };

  // ─── ANULAR PARTIDA ────────────────────────────────────────────────────────
  const handleAnularPartida = async (proc) => {
    const { tieneUso } = await verificarUsoEnProcesosPosteriores(proc);
    if (tieneUso) {
      alert('La Partida de Recurtido no puede anularse porque ya tiene movimientos en procesos posteriores. Para conservar la trazabilidad de la información, esta operación no está permitida.');
      return;
    }
    setItemToAnular(proc);
    setShowAnularModal(true);
  };

  const confirmarAnular = async () => {
    if (!itemToAnular) return;
    try {
      // Revertir movimientos de insumos
      for (const ins of (itemToAnular.insumos_utilizados || [])) {
        if (ins.insumo_id && (parseFloat(ins.cantidad) || 0) > 0) {
          const movs = await MovimientoInventario.filter({
            referencia: `RECURTIDO-${itemToAnular.codigo_lote}-${itemToAnular.nombre_color}`
          });
          for (const m of movs) await MovimientoInventario.delete(m.id);
          const allMovs = await MovimientoInventario.filter({ insumo_id: ins.insumo_id });
          const nuevoStock = allMovs.reduce((s, m) => s + (parseFloat(m.cantidad) || 0), 0);
          await Insumo.update(ins.insumo_id, { stock_actual: nuevoStock });
        }
      }
      // Eliminar registro de InventarioEnProceso si existe
      const invRecs = await InventarioEnProceso.filter({ proceso_origen_id: itemToAnular.id });
      for (const r of invRecs) await InventarioEnProceso.delete(r.id);
      // Marcar como anulado
      await ProcesoProduccion.update(itemToAnular.id, { estado: 'anulado', observaciones: (itemToAnular.observaciones || '') + ' [ANULADO]' });
      await recalcularLotePadre(itemToAnular.codigo_lote);
      setShowAnularModal(false);
      setItemToAnular(null);
      await loadData();
      alert('✅ Partida de Recurtido anulada y movimientos revertidos correctamente.');
    } catch (err) {
      alert('Error al anular: ' + err.message);
    }
  };

  // ─── SELECCIONAR LOTE EN PROCESO ──────────────────────────────────────────
  const handleSelectInvProceso = (id) => {
    const inv = inventarioEnProceso.find(i => i.id === id);
    if (!inv) return;
    setInvSeleccionado(inv);
    setSearchEnProceso('');
    setSublotesForm([]);
    setSubloteActivoIdx(0);
  };

  // ─── AGREGAR PARTIDA RECURTIDO ────────────────────────────────────────────
  const handleAgregarSublote = () => {
    if (!invSeleccionado) { alert('Seleccione primero un lote en proceso.'); return; }
    const lotePadre = invSeleccionado.codigo_lote;
    const existentesDB = getSublotesLote(lotePadre);
    const consecutivo = existentesDB.length + sublotesForm.length + 1;
    const newIdx = sublotesForm.length;
    setSublotesForm(prev => [...prev, {
      id_temp: `new-${Date.now()}-${prev.length}`,
      codigo_sublote: genCodigoSublote(lotePadre, consecutivo),
      color_base: '',
      codigo_color: '',
      cantidad_hojas: 0,
      peso_asignado: 0,
      peso_promedio: 0,
      calibre: '',
      recurtido_finalizado: '',
      codigo_producto_proceso: '',
      descripcion_producto_proceso: '',
      observaciones: '',
      insumos_utilizados: [],
      estado: 'pendiente',
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '',
      finalizar_recurtido: false,
    }]);
    setSubloteActivoIdx(newIdx);
  };

  const handleEliminarSubloteForm = (idx) => {
    setSublotesForm(prev => prev.filter((_, i) => i !== idx));
    setSubloteActivoIdx(Math.max(0, subloteActivoIdx - 1));
  };

  // ─── CAMBIOS EN CAMPOS ────────────────────────────────────────────────────
  const handleSubloteFieldChange = (field, value) => {
    setSublotesForm(prev => prev.map((s, i) => {
      if (i !== subloteActivoIdx) return s;
      let updated = { ...s, [field]: value };
      if (field === 'peso_asignado' || field === 'cantidad_hojas') {
        const peso  = field === 'peso_asignado'  ? parseFloat(value) || 0 : parseFloat(s.peso_asignado)  || 0;
        const hojas = field === 'cantidad_hojas' ? parseFloat(value) || 0 : parseFloat(s.cantidad_hojas) || 0;
        updated.peso_promedio = hojas > 0 ? peso / hojas : 0;
      }
      if (field === 'peso_asignado') {
        const newPeso = parseFloat(value) || 0;
        updated.insumos_utilizados = (s.insumos_utilizados || []).map(ins => {
          const dos = parseFloat(ins.dosificacion) || 0;
          return calcInsumoTotales({ ...ins, cantidad: (newPeso * dos) / 100 });
        });
      }
      // El Código Producto en Proceso NUNCA se digita: se deriva automáticamente
      // del Color Base seleccionado, reutilizando el mismo código si ese color
      // ya se ha usado antes (uniformidad en todos los procesos).
      if (field === 'color_base') {
        const { codigo, descripcion } = deriveCodigoProducto(value, allInvProceso);
        updated.codigo_producto_proceso = codigo;
        updated.descripcion_producto_proceso = descripcion;
      }
      return updated;
    }));
  };

  const calcPesoProporcional = (idx) => {
    if (!invSeleccionado) return 0;
    const totalHojas = parseFloat(invSeleccionado.cantidad_hojas) || 1;
    const pesoTotal  = parseFloat(invSeleccionado.peso_actual) || 0;
    const s = sublotesForm[idx];
    const hojas = parseFloat(s?.cantidad_hojas) || 0;
    return hojas > 0 ? (hojas / totalHojas) * pesoTotal : 0;
  };

  // ─── INSUMOS ──────────────────────────────────────────────────────────────
  const handleAddInsumo = () => {
    setSubloteActivo({ insumos_utilizados: [...(subloteActivo?.insumos_utilizados || []), { insumo_id: '', codigo: '', producto: '', dosificacion: 0, cantidad: 0, costo_unitario: 0, iva: 0.19, valor_total: 0 }] });
  };
  const handleRemoveInsumo = (insIdx) => {
    setSubloteActivo({ insumos_utilizados: (subloteActivo?.insumos_utilizados || []).filter((_, i) => i !== insIdx) });
  };
  const handleInsumoChange = (insIdx, field, value) => {
    const ins = [...(subloteActivo?.insumos_utilizados || [])];
    ins[insIdx] = { ...ins[insIdx], [field]: value };
    if (field === 'insumo_id') {
      const found = [...insumos, ...productos].find(i => i.id === value);
      if (found) { ins[insIdx].codigo = found.codigo || ''; ins[insIdx].producto = found.nombre || found.descripcion || ''; ins[insIdx].costo_unitario = found.costo_promedio || 0; }
    }
    if (field === 'dosificacion') {
      ins[insIdx].cantidad = ((parseFloat(subloteActivo?.peso_asignado) || 0) * (parseFloat(value) || 0)) / 100;
    }
    ins[insIdx] = calcInsumoTotales(ins[insIdx]);
    setSubloteActivo({ insumos_utilizados: ins });
  };

  // ─── VALIDACIONES DISTRIBUCIÓN ────────────────────────────────────────────
  const totalHojasLote   = parseFloat(invSeleccionado?.cantidad_hojas) || 0;
  const totalPesoLote    = parseFloat(invSeleccionado?.peso_actual) || 0;
  const hojasYaUsadas    = invSeleccionado && !isEditing
    ? getSublotesLote(invSeleccionado.codigo_lote).filter(p => p.estado !== 'anulado').reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0)
    : 0;
  const hojasDisponibles = Math.max(0, totalHojasLote - hojasYaUsadas);
  const hojasAsignadas   = sublotesForm.reduce((s, sub) => s + (parseFloat(sub.cantidad_hojas) || 0), 0);
  const pesoAsignado     = sublotesForm.reduce((s, sub) => s + (parseFloat(sub.peso_asignado) || 0), 0);
  const hojasRestantes   = hojasDisponibles - hojasAsignadas;
  const pesoRestante     = totalPesoLote - pesoAsignado;

  // ─── SINCRONIZAR INVENTARIO EN PROCESO ───────────────────────────────────
  const sincronizarInventarioEnProceso = async (proc, dataToSave, isNew) => {
    const codigo = dataToSave.numero_proceso;
    const codigoLote = dataToSave.codigo_lote;
    const invPadre = allInvProceso.find(i => i.codigo_lote === codigoLote);
    const totalHojasPadre = parseFloat(invPadre?.cantidad_hojas) || 0;
    const costoPadreLote  = parseFloat(invPadre?.costo_acumulado) || 0;
    const hojasSub = parseFloat(dataToSave.cantidad_pieles) || 0;
    const costoHeredado = totalHojasPadre > 0 ? (hojasSub / totalHojasPadre) * costoPadreLote : 0;
    const costoProductos = parseFloat(dataToSave.subtotal_recurtido) || 0;
    const costoTotal = costoHeredado + costoProductos;
    const costoPorHoja = hojasSub > 0 ? costoTotal / hojasSub : 0;

    const RF_LABELS = { en_pelo: 'EN PELO', crosta: 'CROSTA' };
    const rfLabel = RF_LABELS[dataToSave.recurtido_finalizado] || '';
    const colorLabel = dataToSave.nombre_color || '';
    const descripcion = dataToSave.descripcion_producto_proceso ||
      (rfLabel ? `${rfLabel}-BASE ${colorLabel}`.trim() : `Hojas en proceso - Base ${colorLabel}`.trim());

    const payloadInv = {
      codigo: codigo,
      descripcion,
      categoria: 'hojas_procesadas',
      unidad_medida: 'HOJA',
      codigo_lote: codigo,
      codigo_lote_padre: codigoLote,
      tipo: 'SUBLOTE',
      origen_modulo: 'recurtido',
      etapa_actual: 'recurtido',
      estado_actual: 'EN_PROCESO',
      estado_proceso: 'piel_recurtida',
      cantidad_hojas: hojasSub,
      peso_actual: parseFloat(dataToSave.peso_actual) || 0,
      costo_acumulado: costoTotal,
      costo_promedio: costoPorHoja,
      color_base: colorLabel,
      codigo_color: dataToSave.codigo_color || '',
      calibre: dataToSave.calibre || '',
      recurtido_finalizado: dataToSave.recurtido_finalizado || '',
      codigo_producto_proceso: dataToSave.codigo_producto_proceso || '',
      descripcion_producto_proceso: dataToSave.descripcion_producto_proceso || '',
      destino_sublote: 'disponible_pintura',
      observaciones: dataToSave.observaciones || '',
      fecha_ingreso_proceso: new Date().toISOString().split('T')[0],
      proceso_origen_id: proc.id,
    };

    // Buscar si ya existe un registro en InventarioEnProceso para esta partida
    const existentes = await InventarioEnProceso.filter({ proceso_origen_id: proc.id });
    if (existentes.length > 0) {
      await InventarioEnProceso.update(existentes[0].id, payloadInv);
    } else if (isNew) {
      await InventarioEnProceso.create(payloadInv);
    }
  };

  // ─── RECALCULAR LOTE PADRE (evita duplicidad de inventario) ──────────────
  // Ejecuta el movimiento de inventario descrito en el requerimiento: al
  // guardar o anular una Partida, el lote padre se actualiza para reflejar
  // únicamente lo que NO ha sido distribuido. Si la distribución llega al
  // 100%, el padre queda en 0 y se marca CONSUMIDO/No Disponible: deja de
  // existir como stock disponible y solo permanece como trazabilidad histórica.
  const recalcularLotePadre = async (codigoLote) => {
    try {
      const freshInv = await InventarioEnProceso.list();
      const padre = freshInv.find(i => i.codigo_lote === codigoLote && !i.codigo_lote_padre);
      if (!padre) return;
      const { totalOriginal, remanente } = calcularRemanentePadre(padre, freshInv);
      if (remanente <= 0) {
        await InventarioEnProceso.update(padre.id, {
          cantidad_hojas_original: totalOriginal,
          cantidad_hojas: 0,
          estado_actual: 'CONSUMIDO',
          destino_sublote: 'no_disponible',
        });
      } else {
        await InventarioEnProceso.update(padre.id, {
          cantidad_hojas_original: totalOriginal,
          cantidad_hojas: remanente,
          estado_actual: 'EN_PROCESO',
        });
      }
    } catch (err) {
      console.error('No se pudo recalcular el lote padre:', err);
    }
  };

  // ─── GUARDAR ──────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (!invSeleccionado && !isEditing) { alert('⚠️ Seleccione un código en proceso.'); return; }
    if (sublotesForm.length === 0) { alert('⚠️ Agregue al menos una Partida Recurtido.'); return; }

    const codigoLote = invSeleccionado?.codigo_lote || sublotesForm[0]?.codigo_sublote?.split('-PR-')[0];

    if (!isEditing && isRecurtidoGeneralFinalizado(codigoLote)) {
      alert('❌ El Recurtido General de este lote ya fue finalizado.'); return;
    }
    if (!isEditing && hojasAsignadas > hojasDisponibles) {
      alert(`❌ Las hojas asignadas (${hojasAsignadas}) superan las disponibles (${hojasDisponibles}).`); return;
    }

    setIsSaving(true);
    try {
      const sublotesExistentes = getSublotesLote(codigoLote);

      for (const sub of sublotesForm) {
        if (!isEditing && sublotesExistentes.some(p => p.numero_proceso === sub.codigo_sublote && p.estado !== 'anulado')) {
          alert(`❌ El Código "${sub.codigo_sublote}" ya se encuentra registrado.`);
          setIsSaving(false);
          return;
        }
      }

      for (let i = 0; i < sublotesForm.length; i++) {
        const sub = sublotesForm[i];
        const numSublote = isEditing ? (sub.numero_sublote_recurtido || 1) : sublotesExistentes.filter(p => p.estado !== 'anulado').length + i + 1;

        const dataToSave = {
          tipo_proceso: 'recurtido',
          numero_proceso: sub.codigo_sublote || genCodigoSublote(codigoLote, numSublote),
          numero_sublote_recurtido: numSublote,
          codigo_lote: codigoLote,
          inv_proceso_id: invSeleccionado?.id || sub.inv_proceso_id || '',
          codigo_color: sub.codigo_color || '',
          nombre_color: sub.color_base || '',
          cantidad_pieles: parseFloat(sub.cantidad_hojas) || 0,
          peso_actual: parseFloat(sub.peso_asignado) || 0,
          peso_promedio: parseFloat(sub.peso_promedio) || 0,
          calibre: sub.calibre || '',
          recurtido_finalizado: sub.recurtido_finalizado || '',
          codigo_producto_proceso: sub.codigo_producto_proceso || '',
          descripcion_producto_proceso: sub.descripcion_producto_proceso || '',
          fecha_inicio: sub.fecha_inicio || new Date().toISOString().split('T')[0],
          fecha_fin: sub.fecha_fin || '',
          observaciones: sub.observaciones || '',
          insumos_utilizados: sub.insumos_utilizados || [],
          subtotal_recurtido: calcSubtotalInsumos(sub.insumos_utilizados),
          subtotal_humectacion: 0,
          subtotal_recromado: 0,
          estado: sub.estado || 'pendiente',
          finalizar_recurtido: sub.finalizar_recurtido || false,
          finalizar_recurtido_general: false,
        };

        let savedProc;
        if (isEditing && sub.id_db) {
          await ProcesoProduccion.update(sub.id_db, dataToSave);
          savedProc = { id: sub.id_db };
        } else {
          savedProc = await ProcesoProduccion.create(dataToSave);
        }

        // Sincronizar inventario en proceso de inmediato
        await sincronizarInventarioEnProceso(savedProc, dataToSave, !isEditing);

        // Descontar insumos del inventario (solo creación)
        if (!isEditing) {
          for (const insumo of (sub.insumos_utilizados || [])) {
            if (insumo.insumo_id && (parseFloat(insumo.cantidad) || 0) > 0) {
              const insumoData = insumos.find(x => x.id === insumo.insumo_id);
              if (insumoData) {
                await MovimientoInventario.create({
                  tipo_movimiento: 'salida', insumo_id: insumo.insumo_id,
                  cantidad: -(parseFloat(insumo.cantidad)),
                  costo_unitario: insumoData.costo_promedio || 0,
                  fecha_movimiento: dataToSave.fecha_inicio,
                  referencia: `RECURTIDO-${codigoLote}-${sub.color_base || i + 1}`,
                  observaciones: `Consumo recurtido - Lote ${codigoLote} Sublote ${sub.codigo_sublote}`,
                  usuario_id: 'system'
                });
                const movimientos = await MovimientoInventario.filter({ insumo_id: insumo.insumo_id });
                const nuevoStock = movimientos.reduce((s, m) => s + (parseFloat(m.cantidad) || 0), 0);
                await Insumo.update(insumo.insumo_id, { stock_actual: nuevoStock });
              }
            }
          }
        }
      }

      await recalcularLotePadre(codigoLote);
      setShowModal(false);
      await loadData();
      alert(`✅ ${sublotesForm.length} Partida(s) Recurtido guardada(s) y Inventario en Proceso actualizado.`);
    } catch (err) {
      console.error(err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── FINALIZAR SUBLOTE ────────────────────────────────────────────────────
  const handleFinalizarSublote = async (proc) => {
    if (!window.confirm(`¿Finalizar Partida Recurtido "${proc.nombre_color || proc.numero_proceso}"?`)) return;
    try {
      const dataUpd = { estado: 'completado', finalizar_recurtido: true, fecha_fin: new Date().toISOString().split('T')[0] };
      await ProcesoProduccion.update(proc.id, dataUpd);
      // Actualizar inventario
      const existentes = await InventarioEnProceso.filter({ proceso_origen_id: proc.id });
      for (const r of existentes) await InventarioEnProceso.update(r.id, { estado_proceso: 'piel_recurtida', estado_actual: 'EN_PROCESO' });
      await loadData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ─── FINALIZAR RECURTIDO GENERAL ─────────────────────────────────────────
  const handleFinalizarRecurtidoGeneral = async (codigoLote) => {
    const sublotes = getSublotesLote(codigoLote).filter(p => p.estado !== 'anulado');
    const inv = allInvProceso.find(i => i.codigo_lote === codigoLote);
    const totalHojas = inv?.cantidad_hojas || 0;
    const totalRecurtido = sublotes.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
    const pendientes = sublotes.filter(p => p.estado !== 'completado');

    if (pendientes.length > 0) {
      alert(`❌ Existen ${pendientes.length} Partida(s) Recurtido pendientes. Finalice todas antes de cerrar.`); return;
    }
    if (totalHojas > 0 && totalRecurtido < totalHojas) {
      alert(`❌ Faltan ${totalHojas - totalRecurtido} hojas por registrar.`); return;
    }
    if (!window.confirm(`¿Finalizar el Recurtido General del lote ${codigoLote}?`)) return;

    try {
      for (const p of sublotes) {
        await ProcesoProduccion.update(p.id, { finalizar_recurtido_general: true });
      }
      if (inv) {
        await InventarioEnProceso.update(inv.id, { estado_actual: 'DIVIDIDO', cantidad_hojas: 0 });
      }
      await loadData();
      alert(`✅ Recurtido General del lote ${codigoLote} finalizado.`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  // ─── INDICADORES GLOBALES ─────────────────────────────────────────────────
  const totalPartidas = procesos.filter(p => p.estado !== 'anulado').length;
  const partidasPendientes = procesos.filter(p => p.estado === 'pendiente' || p.estado === 'en_proceso').length;
  const partidasFinalizadas = procesos.filter(p => p.estado === 'completado').length;
  const totalHojasGlobal = procesos.filter(p => p.estado !== 'anulado').reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
  const totalHojasPendientesGlobal = (() => {
    const totalInv = allInvProceso.reduce((s, i) => s + (parseFloat(i.cantidad_hojas) || 0), 0);
    return Math.max(0, totalInv - totalHojasGlobal);
  })();

  // ─── DATOS TABLA FILTRADA ─────────────────────────────────────────────────
  const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const procesosFiltrados = (() => {
    let resultado = procesos.filter(p => p.estado !== 'anulado');
    if (filtros.lotePadre) resultado = resultado.filter(p => p.codigo_lote === filtros.lotePadre);
    if (filtros.codigoPartida) resultado = resultado.filter(p => normalize(p.numero_proceso).includes(normalize(filtros.codigoPartida)));
    if (filtros.codigoProducto) resultado = resultado.filter(p => normalize(p.codigo_producto_proceso).includes(normalize(filtros.codigoProducto)));
    if (filtros.descripcion) resultado = resultado.filter(p => normalize(p.descripcion_producto_proceso).includes(normalize(filtros.descripcion)));
    if (filtros.color) resultado = resultado.filter(p => normalize(p.nombre_color).includes(normalize(filtros.color)));
    if (filtros.estado) resultado = resultado.filter(p => p.estado === filtros.estado);
    if (filtros.fechaIni) resultado = resultado.filter(p => p.fecha_inicio >= filtros.fechaIni);
    if (filtros.fechaFin) resultado = resultado.filter(p => p.fecha_inicio <= filtros.fechaFin);
    return resultado.sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0));
  })();

  // Lote padre seleccionado para resumen
  const sublotesPadreSeleccionado = lotePadreControl ? procesos.filter(p => p.codigo_lote === lotePadreControl && p.estado !== 'anulado') : [];
  const invPadreSeleccionado = allInvProceso.find(i => i.codigo_lote === lotePadreControl);
  const totalHojasPadre = parseFloat(invPadreSeleccionado?.cantidad_hojas) || 0;
  const hojasProcesadas = sublotesPadreSeleccionado.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
  const hojasPendientes = Math.max(0, totalHojasPadre - hojasProcesadas);
  const pctAvance = totalHojasPadre > 0 ? Math.min(100, (hojasProcesadas / totalHojasPadre) * 100) : 0;
  const generalFinalizado = sublotesPadreSeleccionado.some(p => p.finalizar_recurtido_general);
  const todosFinalizados  = sublotesPadreSeleccionado.length > 0 && sublotesPadreSeleccionado.every(p => p.estado === 'completado');
  const puedeFinalizarGeneral = todosFinalizados && hojasPendientes === 0 && !generalFinalizado && sublotesPadreSeleccionado.length > 0;

  const invFiltrados = inventarioEnProceso.filter(inv => {
    if (!searchEnProceso) return true;
    const s = searchEnProceso.toLowerCase();
    return (inv.codigo_lote || '').toLowerCase().includes(s) || (inv.descripcion || '').toLowerCase().includes(s);
  });

  const todosLosItems = [...insumos, ...productos];

  const getCostosControl = (proc) => {
    const invP = allInvProceso.find(i => i.codigo_lote === proc.codigo_lote);
    const totalH = parseFloat(invP?.cantidad_hojas) || 0;
    const costoL = parseFloat(invP?.costo_acumulado) || 0;
    const h = parseFloat(proc.cantidad_pieles) || 0;
    const costoHeredado = totalH > 0 ? (h / totalH) * costoL : 0;
    const costoProds = (parseFloat(proc.subtotal_recurtido) || 0) + (parseFloat(proc.subtotal_humectacion) || 0) + (parseFloat(proc.subtotal_recromado) || 0);
    return { costoHeredado, costoProds, costoTotal: costoHeredado + costoProds };
  };

  const estadoBadge = (estado) => (
    <Badge className={`text-xs ${ESTADO_COLORS[estado] || 'bg-gray-100 text-gray-700'}`}>
      {ESTADO_LABELS[estado] || estado}
    </Badge>
  );

  // ─── COSTOS FORM ─────────────────────────────────────────────────────────
  const getCostosSublotr = (sub) => {
    const inv = invSeleccionado;
    const totalHojasLoteInv = parseFloat(inv?.cantidad_hojas) || 0;
    const costoAcumLote = parseFloat(inv?.costo_acumulado) || 0;
    const hojasSubl = parseFloat(sub?.cantidad_hojas) || 0;
    const pesoSubl = parseFloat(sub?.peso_asignado) || 0;
    const costoHeredado = totalHojasLoteInv > 0 ? (hojasSubl / totalHojasLoteInv) * costoAcumLote : 0;
    const costoProductos = calcSubtotalInsumos(sub?.insumos_utilizados);
    const costoTotal = costoHeredado + costoProductos;
    return {
      costoHeredado, costoPromedioHeredadoHoja: parseFloat(inv?.costo_promedio) || 0,
      pctParticipacion: totalHojasLoteInv > 0 ? (hojasSubl / totalHojasLoteInv) * 100 : 0,
      costoProductos, costoTotal,
      costoPorHoja: hojasSubl > 0 ? costoTotal / hojasSubl : 0,
      costoPorKg: pesoSubl > 0 ? costoTotal / pesoSubl : 0,
      hojasSubl, pesoSubl
    };
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Proceso de Recurtido"
        description="División de partidas por color/base con trazabilidad financiera y sincronización automática de inventario."
        onPrint={() => window.print()}
        actionButton={
          <Button onClick={handleOpenModal} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />Nueva Partida Recurtido
          </Button>
        }
      />

      {/* ══════════ PANEL INDICADORES ══════════ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500">Total Partidas</p>
          <p className="text-3xl font-extrabold text-blue-700">{totalPartidas}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500">Pendientes</p>
          <p className="text-3xl font-extrabold text-amber-700">{partidasPendientes}</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500">Finalizadas</p>
          <p className="text-3xl font-extrabold text-green-700">{partidasFinalizadas}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500">Total Hojas Procesadas</p>
          <p className="text-3xl font-extrabold text-purple-700">{totalHojasGlobal}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
          <p className="text-xs text-slate-500">Hojas Pendientes</p>
          <p className="text-3xl font-extrabold text-rose-700">{totalHojasPendientesGlobal}</p>
        </div>
      </div>

      {/* ══════════ PANEL FILTROS ══════════ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Search className="w-4 h-4 text-emerald-600" />Filtros de Búsqueda</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
            <div>
              <Label className="text-xs">Lote Padre</Label>
              <Select value={filtros.lotePadre} onValueChange={v => setFiltros(f => ({ ...f, lotePadre: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Todos —</SelectItem>
                  {lotesPadreUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Código Partida</Label>
              <Input className="h-8 text-xs" value={filtros.codigoPartida} onChange={e => setFiltros(f => ({ ...f, codigoPartida: e.target.value }))} placeholder="Buscar..." />
            </div>
            <div>
              <Label className="text-xs">Código Producto</Label>
              <Input className="h-8 text-xs" value={filtros.codigoProducto} onChange={e => setFiltros(f => ({ ...f, codigoProducto: e.target.value }))} placeholder="Buscar..." />
            </div>
            <div>
              <Label className="text-xs">Descripción</Label>
              <Input className="h-8 text-xs" value={filtros.descripcion} onChange={e => setFiltros(f => ({ ...f, descripcion: e.target.value }))} placeholder="Buscar..." />
            </div>
            <div>
              <Label className="text-xs">Base / Color</Label>
              <Input className="h-8 text-xs" value={filtros.color} onChange={e => setFiltros(f => ({ ...f, color: e.target.value }))} placeholder="Buscar..." />
            </div>
            <div>
              <Label className="text-xs">Estado</Label>
              <Select value={filtros.estado} onValueChange={v => setFiltros(f => ({ ...f, estado: v }))}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Todos..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Todos —</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_proceso">En proceso</SelectItem>
                  <SelectItem value="completado">Finalizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Fecha Inicial</Label>
              <Input type="date" className="h-8 text-xs" value={filtros.fechaIni} onChange={e => setFiltros(f => ({ ...f, fechaIni: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Fecha Final</Label>
              <Input type="date" className="h-8 text-xs" value={filtros.fechaFin} onChange={e => setFiltros(f => ({ ...f, fechaFin: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs" onClick={() => {}}>
              <Search className="w-3 h-3 mr-1" />Buscar
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setFiltros({ lotePadre: '', codigoPartida: '', codigoProducto: '', descripcion: '', color: '', estado: '', fechaIni: '', fechaFin: '' })}>
              <X className="w-3 h-3 mr-1" />Limpiar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ══════════ SEGUIMIENTO DE PRODUCCIÓN POR PARTIDAS ══════════ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">📊 Seguimiento de Producción por Partidas de Recurtido</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500 whitespace-nowrap">Lote Padre:</Label>
              <Select value={lotePadreControl} onValueChange={setLotePadreControl}>
                <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Seleccionar lote..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>— Todos los lotes —</SelectItem>
                  {lotesPadreUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              {lotePadreControl && (
                <Button variant="outline" size="sm" onClick={() => { setLoteConsolidado(lotePadreControl); setShowConsolidadoModal(true); }}>
                  <Table className="w-3 h-3 mr-1" />Consolidado
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Panel resumen del lote padre seleccionado */}
          {lotePadreControl && (
            <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-purple-800 text-sm">📦 Resumen del Lote Padre: <span className="font-mono">{lotePadreControl}</span></h3>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${generalFinalizado ? 'bg-green-100 text-green-700' : hojasPendientes === 0 && hojasProcesadas > 0 ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {generalFinalizado ? '🟢 Lote Completado' : hojasPendientes === 0 && hojasProcesadas > 0 ? '🟡 Listo para Finalizar' : hojasProcesadas > 0 ? '🟡 En Proceso' : '🔴 Pendiente'}
                </span>
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-3">
                <div className="bg-white rounded-lg p-2 text-center border border-purple-100">
                  <p className="text-xs text-slate-500">Total Hojas</p>
                  <p className="text-xl font-bold text-blue-700">{totalHojasPadre}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-purple-100">
                  <p className="text-xs text-slate-500">Partidas</p>
                  <p className="text-xl font-bold text-purple-700">{sublotesPadreSeleccionado.length}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-purple-100">
                  <p className="text-xs text-slate-500">Finalizadas</p>
                  <p className="text-xl font-bold text-green-700">{sublotesPadreSeleccionado.filter(p => p.estado === 'completado').length}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-emerald-100">
                  <p className="text-xs text-slate-500">Hojas Procesadas</p>
                  <p className="text-xl font-bold text-emerald-700">{hojasProcesadas}</p>
                </div>
                <div className={`bg-white rounded-lg p-2 text-center border ${hojasPendientes > 0 ? 'border-amber-200' : 'border-green-200'}`}>
                  <p className="text-xs text-slate-500">Pendientes</p>
                  <p className={`text-xl font-bold ${hojasPendientes > 0 ? 'text-amber-700' : 'text-green-700'}`}>{hojasPendientes}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center border border-purple-100">
                  <p className="text-xs text-slate-500">Última Partida</p>
                  <p className="text-xs font-bold text-slate-700 truncate">{sublotesPadreSeleccionado[sublotesPadreSeleccionado.length - 1]?.numero_proceso || '—'}</p>
                </div>
              </div>
              {/* Barra de avance */}
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Avance de producción</span>
                  <span className="font-bold text-purple-700">{pctAvance.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-4 rounded-full transition-all duration-500 ${pctAvance >= 100 ? 'bg-green-500' : pctAvance > 50 ? 'bg-blue-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.min(100, pctAvance)}%` }}
                  />
                </div>
                {hojasPendientes === 0 && hojasProcesadas > 0 && !generalFinalizado && (
                  <p className="text-xs text-green-700 font-bold mt-1">✔ Distribución completa — listo para finalizar Recurtido General</p>
                )}
                {generalFinalizado && (
                  <p className="text-xs text-green-700 font-bold mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Recurtido General FINALIZADO</p>
                )}
              </div>
            </div>
          )}

          {/* Tabla principal */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-2 text-left">Código Partida Recurtido</th>
                  <th className="p-2 text-center">Estado</th>
                  <th className="p-2 text-left">Base / Color</th>
                  <th className="p-2 text-left">Cód. Producto</th>
                  <th className="p-2 text-left max-w-[120px]">Descripción</th>
                  <th className="p-2 text-right">Hojas</th>
                  <th className="p-2 text-right">Peso (kg)</th>
                  <th className="p-2 text-right">Costo</th>
                  <th className="p-2 text-center">Fecha Reg.</th>
                  <th className="p-2 text-center">Proceso Actual</th>
                  <th className="p-2 text-center min-w-[90px]">% Avance</th>
                  <th className="p-2 text-left min-w-[130px]">Estado Lote Padre</th>
                  <th className="p-2 text-left">Alertas</th>
                  <th className="p-2 text-center">Último Mov.</th>
                  <th className="p-2 text-left">Observaciones</th>
                  <th className="p-2 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={16} className="p-4 text-center text-slate-400">Cargando...</td></tr>
                ) : procesosFiltrados.length === 0 ? (
                  <tr><td colSpan={16} className="p-4 text-center text-slate-400">No hay Partidas Recurtido. Use "Nueva Partida Recurtido".</td></tr>
                ) : procesosFiltrados.map(proc => {
                  const finalizado = proc.estado === 'completado';
                  const { costoTotal } = getCostosControl(proc);
                  const bloqueado = finalizado || proc.finalizar_recurtido_general;
                  // Proceso actual
                  const invRec = allInvProceso.find(i => i.proceso_origen_id === proc.id);
                  let procesoActual = '🔄 Recurtido';
                  if (invRec) {
                    if (invRec.etapa_actual === 'pintura') procesoActual = '🎨 Pintura';
                    else if (invRec.destino_sublote === 'producto_terminado') procesoActual = '✅ Terminado';
                  }
                  // % Avance del lote padre
                  const siblingsPadre = procesos.filter(p => p.codigo_lote === proc.codigo_lote && p.estado !== 'anulado');
                  const invPadre = allInvProceso.find(i => i.codigo_lote === proc.codigo_lote);
                  const totalHPadre = parseFloat(invPadre?.cantidad_hojas) || 0;
                  const hojasUsadasPadre = siblingsPadre.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
                  const hojasPendPadre = Math.max(0, totalHPadre - hojasUsadasPadre);
                  const pctPadre = totalHPadre > 0 ? Math.min(100, (hojasUsadasPadre / totalHPadre) * 100) : 0;
                  // % Avance de la propia partida (completado = 100%)
                  const pctPartida = proc.estado === 'completado' ? 100 : proc.estado === 'anulado' ? 0 : 50;
                  // Alertas
                  const diasSinMov = proc.updated_date
                    ? Math.floor((Date.now() - new Date(proc.updated_date).getTime()) / (1000*60*60*24)) : 0;
                  const alertas = [];
                  if (proc.estado === 'pendiente') alertas.push('⏳ Pendiente de Finalización');
                  if (diasSinMov > 7) alertas.push(`⚠️ Sin mov. ${diasSinMov}d`);
                  if (!invRec) alertas.push('📦 Pendiente de Inventario');
                  if (invRec?.etapa_actual === 'recurtido' && proc.estado === 'completado') alertas.push('🎨 Pendiente de Pintura');
                  const ultimoMov = proc.updated_date || proc.created_date;
                  return (
                    <tr key={proc.id}
                      className={`border-t cursor-pointer ${finalizado ? 'bg-green-50' : proc.estado === 'anulado' ? 'bg-red-50' : 'bg-white'} hover:bg-purple-50`}
                      onDoubleClick={() => { setSelectedItem(proc); setShowDetailModal(true); }}
                      title="Doble clic para ver Ficha Integral">
                      <td className="p-2 font-mono font-bold text-purple-800">{proc.numero_proceso || proc.codigo_lote}</td>
                      <td className="p-2 text-center">{estadoBadge(proc.estado)}</td>
                      <td className="p-2 font-semibold">{proc.nombre_color || '—'}</td>
                      <td className="p-2 font-mono text-cyan-700 font-bold text-xs">{proc.codigo_producto_proceso || '—'}</td>
                      <td className="p-2 text-slate-600 max-w-[120px] truncate" title={proc.descripcion_producto_proceso || ''}>{proc.descripcion_producto_proceso || '—'}</td>
                      <td className="p-2 text-right font-bold">{proc.cantidad_pieles || 0}</td>
                      <td className="p-2 text-right text-slate-600">{proc.peso_actual || 0} kg</td>
                      <td className="p-2 text-right font-semibold text-emerald-700">{formatCurrency(costoTotal)}</td>
                      <td className="p-2 text-center text-slate-500">{fmtDate(proc.fecha_inicio)}</td>
                      <td className="p-2 text-center text-xs">{procesoActual}</td>
                      {/* % Avance Partida */}
                      <td className="p-2">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                              <div className={`h-2 rounded-full ${pctPartida >= 100 ? 'bg-green-500' : 'bg-amber-400'}`} style={{ width: `${pctPartida}%` }} />
                            </div>
                            <span className="text-xs font-bold text-slate-600">{pctPartida}%</span>
                          </div>
                        </div>
                      </td>
                      {/* Estado Lote Padre */}
                      <td className="p-2 text-xs">
                        <div className="text-slate-500 leading-tight">
                          <p className="font-mono font-bold text-purple-700 text-xs">{proc.codigo_lote}</p>
                          <p>{hojasUsadasPadre} de {totalHPadre} hojas</p>
                          <p className="text-amber-600">Pend: {hojasPendPadre}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div className={`h-1.5 rounded-full ${pctPadre >= 100 ? 'bg-green-500' : 'bg-purple-400'}`} style={{ width: `${pctPadre}%` }} />
                            </div>
                            <span className="font-bold text-purple-700">{pctPadre.toFixed(1)}%</span>
                          </div>
                        </div>
                      </td>
                      {/* Alertas */}
                      <td className="p-2 text-xs">
                        {alertas.length === 0
                          ? <span className="text-green-600">✔ OK</span>
                          : <div className="space-y-0.5">{alertas.map((a, i) => <p key={i} className="text-amber-700 leading-tight">{a}</p>)}</div>}
                      </td>
                      {/* Último movimiento */}
                      <td className="p-2 text-center text-xs text-slate-500">
                        {ultimoMov ? (
                          <div>
                            <p>{fmtDate(ultimoMov)}</p>
                            <p className="text-slate-400">{diasSinMov}d</p>
                          </div>
                        ) : '—'}
                      </td>
                      <td className="p-2 text-slate-500 max-w-[100px] truncate" title={proc.observaciones || ''}>{proc.observaciones || '—'}</td>
                      <td className="p-2">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedItem(proc); setShowDetailModal(true); }} className="h-7 w-7 p-0" title="Ver Ficha Integral">
                            <Eye className="w-3 h-3" />
                          </Button>
                          {!bloqueado && (
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditSublote(proc); }} className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700" title="Modificar">
                              <Edit2 className="w-3 h-3" />
                            </Button>
                          )}
                          {!bloqueado && (
                            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 px-1.5" onClick={(e) => { e.stopPropagation(); handleFinalizarSublote(proc); }} title="Finalizar">
                              <CheckCircle2 className="w-3 h-3" />
                            </Button>
                          )}
                          {!bloqueado && (
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleAnularPartida(proc); }} className="h-7 w-7 p-0 text-red-500 hover:text-red-700" title="Anular">
                              <Ban className="w-3 h-3" />
                            </Button>
                          )}
                          {bloqueado && (
                            <span className="flex items-center gap-1 text-xs text-slate-400 px-1"><Lock className="w-3 h-3" />Bloqueado</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Botón finalizar general */}
          {lotePadreControl && sublotesPadreSeleccionado.length > 0 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <div className="text-xs text-slate-500">
                {!generalFinalizado && !puedeFinalizarGeneral && (
                  <span className="flex items-center gap-1 text-amber-700">
                    <AlertCircle className="w-4 h-4" />
                    {hojasPendientes > 0 ? `Faltan ${hojasPendientes} hojas` : `Hay ${sublotesPadreSeleccionado.filter(p => p.estado !== 'completado').length} Partida(s) pendiente(s)`}
                  </span>
                )}
              </div>
              <Button disabled={!puedeFinalizarGeneral}
                onClick={() => handleFinalizarRecurtidoGeneral(lotePadreControl)}
                className="bg-purple-700 hover:bg-purple-800 disabled:opacity-40">
                <CheckCircle2 className="w-4 h-4 mr-2" />Finalizar Recurtido General
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ══════════ MODAL FORMULARIO ══════════ */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Modificar' : 'Nueva'} Partida de Recurtido</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-5">
            {/* Selector lote */}
            {!isEditing && (
              <div className="p-4 bg-indigo-50 border-2 border-indigo-300 rounded-xl">
                <h3 className="font-bold text-indigo-800 text-sm mb-3">① SELECCIÓN DEL LOTE EN PROCESO</h3>
                <Input placeholder="Buscar por código lote o descripción..." value={searchEnProceso}
                  onChange={e => setSearchEnProceso(e.target.value)} className="h-8 text-xs mb-2" />
                <Select value={invSeleccionado?.id || ''} onValueChange={handleSelectInvProceso}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar lote curtido en proceso..." /></SelectTrigger>
                  <SelectContent>
                    {invFiltrados.length === 0 && <SelectItem value="__e__" disabled>No hay lotes disponibles</SelectItem>}
                    {invFiltrados.map(inv => (
                      <SelectItem key={inv.id} value={inv.id}>
                        {inv.codigo_lote} — {inv.descripcion} ({inv.cantidad_hojas || 0} hojas | {inv.peso_actual || 0} kg)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {invSeleccionado && (
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs bg-white border border-indigo-200 rounded p-3">
                    <div><span className="font-semibold text-indigo-700">Lote Padre:</span> <span className="font-mono font-bold">{invSeleccionado.codigo_lote}</span></div>
                    <div><span className="font-semibold text-indigo-700">Total Hojas:</span> {invSeleccionado.cantidad_hojas}</div>
                    <div><span className="font-semibold text-indigo-700">Disponibles:</span> <strong className={hojasDisponibles === 0 ? 'text-red-600' : 'text-green-700'}>{hojasDisponibles} hojas</strong></div>
                    <div><span className="font-semibold text-indigo-700">Costo Acumulado:</span> {formatCurrency(invSeleccionado.costo_acumulado)}</div>
                  </div>
                )}
              </div>
            )}
            {isEditing && (
              <div className="p-2 bg-slate-50 border rounded text-sm">
                <span className="font-semibold">Lote:</span> <span className="font-mono">{invSeleccionado?.codigo_lote || subloteActivo?.codigo_sublote || '—'}</span>
                <span className="ml-4 font-semibold">Modo:</span> Modificación de Partida existente
              </div>
            )}

            {/* División de sublotes */}
            {(invSeleccionado || isEditing) && (
              <div className="border-2 border-orange-400 rounded-xl overflow-hidden">
                <div className="bg-orange-600 text-white px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base">② PARTIDAS DE RECURTIDO</h3>
                    <p className="text-xs text-orange-200 mt-0.5">El Inventario en Proceso se actualizará automáticamente al guardar</p>
                  </div>
                  {!isEditing && (
                    <Button type="button" onClick={handleAgregarSublote} className="bg-white text-orange-700 hover:bg-orange-50 text-xs h-8">
                      <Plus className="w-3 h-3 mr-1" />Agregar Partida Recurtido
                    </Button>
                  )}
                </div>

                {!isEditing && invSeleccionado && (
                  <div className={`px-5 py-2 text-xs flex items-center gap-4 border-b ${hojasRestantes < 0 ? 'bg-red-50 border-red-200' : hojasRestantes === 0 && sublotesForm.length > 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                    <span>Total lote: <strong>{totalHojasLote}</strong> hojas</span>|
                    <span>Asignadas: <strong className={hojasRestantes < 0 ? 'text-red-700' : 'text-orange-800'}>{hojasAsignadas}</strong></span>|
                    <span>Restantes: <strong className={hojasRestantes < 0 ? 'text-red-700' : hojasRestantes === 0 ? 'text-green-700' : 'text-orange-700'}>{hojasRestantes}</strong></span>
                    {hojasRestantes < 0 && <span className="text-red-700 font-bold">✖ Excede el total</span>}
                    {hojasRestantes === 0 && sublotesForm.length > 0 && <span className="text-green-700 font-bold">✔ Distribución completa</span>}
                  </div>
                )}

                {sublotesForm.length === 0 ? (
                  <div className="px-5 py-6 text-center text-slate-400 bg-white">
                    <p className="text-sm">Sin Partidas agregadas. Haga clic en "Agregar Partida Recurtido".</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-1 px-4 pt-3 bg-white border-b overflow-x-auto">
                      {sublotesForm.map((sub, idx) => (
                        <button key={sub.id_temp} type="button"
                          onClick={() => setSubloteActivoIdx(idx)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 whitespace-nowrap ${subloteActivoIdx === idx ? 'bg-orange-100 border-orange-500 text-orange-800' : 'bg-gray-50 border-transparent text-slate-500 hover:bg-orange-50'}`}>
                          {sub.color_base ? sub.color_base.toUpperCase() : `Partida ${idx + 1}`}
                          {!isEditing && (
                            <span onClick={e => { e.stopPropagation(); handleEliminarSubloteForm(idx); }} className="ml-1 text-red-400 hover:text-red-600 font-bold">×</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {subloteActivo && (
                      <div className="bg-white px-5 py-4 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Código Partida Recurtido</Label>
                            <Input value={subloteActivo.codigo_sublote || ''} readOnly className="bg-amber-50 font-mono text-xs font-bold cursor-not-allowed" />
                            <p className="text-xs text-orange-500 mt-0.5">Automático</p>
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Base / Color Base *</Label>
                            <Select value={subloteActivo.color_base || ''} onValueChange={v => handleSubloteFieldChange('color_base', v)}>
                              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Seleccionar color..." /></SelectTrigger>
                              <SelectContent>
                                {['NEGRO','CAFÉ','AZUL','MIEL','BLANCO','QUEBRACHO','ROJO','VERDE'].map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Cantidad Hojas *</Label>
                            <Input type="number" min="0"
                              value={subloteActivo.cantidad_hojas || ''}
                              onChange={e => handleSubloteFieldChange('cantidad_hojas', parseFloat(e.target.value) || 0)}
                              className={`text-xs ${hojasRestantes < 0 ? 'border-red-400 bg-red-50' : ''}`} />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Calibre *</Label>
                            <Select value={subloteActivo.calibre || ''} onValueChange={v => handleSubloteFieldChange('calibre', v)}>
                              <SelectTrigger className="text-xs h-9"><SelectValue placeholder="Calibre..." /></SelectTrigger>
                              <SelectContent>
                                {['0.8 - 1.0 mm', '1.0 - 1.2 mm', '1.2 - 1.4 mm'].map(c => (
                                  <SelectItem key={c} value={c}>{c}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Código Producto en Proceso</Label>
                            <Input value={subloteActivo.codigo_producto_proceso || ''} readOnly
                              className="bg-cyan-50 font-mono text-xs font-bold text-cyan-800 cursor-not-allowed" />
                            <p className="text-xs text-cyan-600 mt-0.5">Automático según Color Base</p>
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Descripción</Label>
                            <Input value={subloteActivo.descripcion_producto_proceso || ''} readOnly className="bg-blue-50 text-xs font-bold text-blue-800 cursor-not-allowed" />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Peso Asignado (kg)</Label>
                            <div className="flex gap-1">
                              <Input type="number" min="0" step="0.01"
                                value={subloteActivo.peso_asignado || ''}
                                onChange={e => handleSubloteFieldChange('peso_asignado', parseFloat(e.target.value) || 0)}
                                className="text-xs" />
                              {!isEditing && invSeleccionado && (
                                <Button type="button" size="sm" variant="outline" className="h-9 text-xs px-2"
                                  onClick={() => handleSubloteFieldChange('peso_asignado', parseFloat(calcPesoProporcional(subloteActivoIdx).toFixed(2)))}
                                  title="Proporcional">↗</Button>
                              )}
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Estado</Label>
                            <Select value={subloteActivo.estado || 'pendiente'} onValueChange={v => handleSubloteFieldChange('estado', v)}>
                              <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pendiente">Pendiente</SelectItem>
                                <SelectItem value="en_proceso">En Proceso</SelectItem>
                                <SelectItem value="completado">Finalizada</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Fecha Inicio</Label>
                            <Input type="date" value={subloteActivo.fecha_inicio || ''} onChange={e => handleSubloteFieldChange('fecha_inicio', e.target.value)} className="text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Fecha Fin</Label>
                            <Input type="date" value={subloteActivo.fecha_fin || ''} onChange={e => handleSubloteFieldChange('fecha_fin', e.target.value)} className="text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Peso Promedio / Hoja</Label>
                            <Input readOnly value={`${fmt2(subloteActivo.peso_promedio)} kg`} className="bg-blue-50 text-xs font-bold text-blue-800 cursor-not-allowed" />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-orange-800">Observaciones</Label>
                          <Textarea value={subloteActivo.observaciones || ''}
                            onChange={e => handleSubloteFieldChange('observaciones', e.target.value)}
                            rows={2} className="text-xs" placeholder="Observaciones de esta Partida Recurtido..." />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Ítems / Insumos */}
            {subloteActivo && (
              <div className="border-2 border-blue-400 rounded-xl overflow-hidden">
                <div className="bg-blue-700 text-white px-5 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-base">③ ÍTEMS / PRODUCTOS — Partida: <span className="text-blue-200 font-mono">{subloteActivo.color_base || `Partida ${subloteActivoIdx + 1}`}</span></h3>
                  <Button type="button" onClick={handleAddInsumo} size="sm" className="bg-white text-blue-700 hover:bg-blue-50 text-xs h-8">
                    <Plus className="w-3 h-3 mr-1" />Agregar Ítem
                  </Button>
                </div>
                <div className="overflow-x-auto bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="p-2 text-left text-xs">Código / Producto</th>
                        <th className="p-2 text-right text-xs">% Dosif.</th>
                        <th className="p-2 text-right text-xs">Cantidad (kg)</th>
                        <th className="p-2 text-right text-xs">Costo Unit.</th>
                        <th className="p-2 text-right text-xs">IVA</th>
                        <th className="p-2 text-right text-xs">Valor Total</th>
                        <th className="p-2 text-xs"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(subloteActivo.insumos_utilizados || []).map((ins, insIdx) => (
                        <tr key={insIdx} className="border-t hover:bg-blue-50/30">
                          <td className="p-2">
                            <Select value={ins.insumo_id || ''} onValueChange={v => handleInsumoChange(insIdx, 'insumo_id', v)}>
                              <SelectTrigger className="w-full text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                              <SelectContent>
                                {todosLosItems.map(i => <SelectItem key={i.id} value={i.id}>{i.codigo || i.referencia} — {i.nombre || i.descripcion}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {ins.producto && <p className="text-xs text-slate-500 mt-0.5 pl-1">{ins.producto}</p>}
                          </td>
                          <td className="p-2"><Input type="number" step="0.01" value={ins.dosificacion} onChange={e => handleInsumoChange(insIdx, 'dosificacion', e.target.value)} className="text-right text-xs h-8 w-20" /></td>
                          <td className="p-2"><Input value={(parseFloat(ins.cantidad) || 0).toFixed(3)} readOnly className="text-right text-xs h-8 bg-blue-50 font-medium w-24" /></td>
                          <td className="p-2"><Input type="number" step="0.01" value={ins.costo_unitario} onChange={e => handleInsumoChange(insIdx, 'costo_unitario', e.target.value)} className="text-right text-xs h-8 w-28" /></td>
                          <td className="p-2">
                            <Select value={String(ins.iva)} onValueChange={v => handleInsumoChange(insIdx, 'iva', parseFloat(v))}>
                              <SelectTrigger className="text-xs h-8 w-20"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0.19">19%</SelectItem>
                                <SelectItem value="0.05">5%</SelectItem>
                                <SelectItem value="0">0%</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 text-right font-bold text-emerald-700 text-xs">{formatCurrency(ins.valor_total)}</td>
                          <td className="p-2">
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveInsumo(insIdx)} className="h-7 w-7">
                              <X className="w-3 h-3 text-red-500" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {(subloteActivo.insumos_utilizados || []).length === 0 && (
                        <tr><td colSpan={7} className="p-4 text-center text-slate-400 text-xs">Sin ítems. Haga clic en "Agregar Ítem".</td></tr>
                      )}
                    </tbody>
                    {(subloteActivo.insumos_utilizados || []).length > 0 && (
                      <tfoot>
                        <tr className="bg-blue-100 font-bold border-t-2 border-blue-300">
                          <td colSpan={5} className="p-2 text-right text-xs text-blue-800">TOTAL:</td>
                          <td className="p-2 text-right text-emerald-800">{formatCurrency(calcSubtotalInsumos(subloteActivo.insumos_utilizados))}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* Control de costos */}
            {subloteActivo && invSeleccionado && (() => {
              const c = getCostosSublotr(subloteActivo);
              return (
                <div className="border-2 border-violet-500 rounded-xl overflow-hidden">
                  <div className="bg-violet-700 text-white px-5 py-3">
                    <p className="font-bold text-base">④ CONTROL DE COSTOS — Partida: <span className="font-mono text-violet-200">{subloteActivo.color_base || `Partida ${subloteActivoIdx + 1}`}</span></p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-violet-50">
                    <div className="bg-white rounded border border-amber-200 p-2 text-center">
                      <p className="text-xs text-amber-600 font-semibold">Costo Heredado</p>
                      <p className="text-base font-extrabold text-amber-800">{formatCurrency(c.costoHeredado)}</p>
                    </div>
                    <div className="bg-white rounded border border-blue-200 p-2 text-center">
                      <p className="text-xs text-blue-600 font-semibold">Costo Recurtido</p>
                      <p className="text-base font-bold text-blue-700">{formatCurrency(c.costoProductos)}</p>
                    </div>
                    <div className="bg-white rounded border border-violet-200 p-2 text-center">
                      <p className="text-xs text-violet-600 font-semibold">Costo Total</p>
                      <p className="text-base font-extrabold text-violet-800">{formatCurrency(c.costoTotal)}</p>
                    </div>
                    <div className="bg-white rounded border border-emerald-200 p-2 text-center">
                      <p className="text-xs text-emerald-600 font-semibold">Costo / Hoja</p>
                      <p className="text-base font-bold text-emerald-700">{c.hojasSubl > 0 ? formatCurrency(c.costoPorHoja) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" className="bg-violet-700 hover:bg-violet-800" disabled={sublotesForm.length === 0 || isSaving}>
                {isSaving ? 'Guardando...' : isEditing ? 'Guardar Modificación' : `Guardar ${sublotesForm.length} Partida(s)`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <RecurtidoFichaIntegral
        open={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        selectedItem={selectedItem}
        allInvProceso={allInvProceso}
        procesos={procesos}
        getCostosControl={getCostosControl}
      />

      {/* ══════════ MODAL ANULAR ══════════ */}
      <Dialog open={showAnularModal} onOpenChange={setShowAnularModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-red-700">⚠️ Confirmar Anulación</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>¿Está seguro de que desea anular la Partida de Recurtido <strong className="font-mono text-purple-800">{itemToAnular?.numero_proceso}</strong>?</p>
            <div className="p-3 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              <strong>Esta acción:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5">
                <li>Marcará la partida como ANULADA</li>
                <li>Revertirá automáticamente los movimientos de inventario de insumos</li>
                <li>Eliminará el registro correspondiente en el Inventario en Proceso</li>
              </ul>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => { setShowAnularModal(false); setItemToAnular(null); }}>Cancelar</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={confirmarAnular}>Confirmar Anulación</Button>
          </div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && (
        <LoteDetalleConsolidado open={showConsolidadoModal} onOpenChange={setShowConsolidadoModal} codigoLote={loteConsolidado} />
      )}
    </div>
  );
}