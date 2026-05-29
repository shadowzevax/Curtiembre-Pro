import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, ProductoTerminado, MovimientoInventario, InventarioEnProceso } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, Trash2, Table, CheckCircle2, Lock, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';

const formatCurrency = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(v || 0);
const fmt2 = (v) => (parseFloat(v) || 0).toFixed(2);

// ─── UTILS ──────────────────────────────────────────────────────────────────
const calcInsumoTotales = (insumo) => {
  const cant = parseFloat(insumo.cantidad) || 0;
  const cu   = parseFloat(insumo.costo_unitario) || 0;
  const iva  = parseFloat(insumo.iva) || 0;
  const sub  = cant * cu;
  return { ...insumo, valor_total: sub + sub * iva };
};

const calcSubtotalInsumos = (insumos) =>
  (insumos || []).reduce((s, i) => s + (parseFloat(i.valor_total) || 0), 0);

// Genera código sublote: LOTE-PADRE-COLOR o LOTE-PADRE-01
const genCodigoSublote = (lotePadre, colorBase, idx) => {
  const ref = colorBase
    ? colorBase.toUpperCase().replace(/\s+/g, '-').slice(0, 10)
    : String(idx + 1).padStart(2, '0');
  return `${lotePadre}-${ref}`;
};

export default function ProcesoRecurtido() {
  // ─── DATA ────────────────────────────────────────────────────────────────
  const [procesos, setProcesos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [inventarioEnProceso, setInventarioEnProceso] = useState([]);
  const [loading, setLoading] = useState(true);

  // ─── MODAL PRINCIPAL ─────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Lote padre seleccionado desde InventarioEnProceso
  const [invSeleccionado, setInvSeleccionado] = useState(null);
  const [searchEnProceso, setSearchEnProceso] = useState('');

  // ── SUBLOTES del formulario actual (array de sublotes a crear/editar) ──
  // Cada sublote: { id_temp, codigo_sublote, color_base, cantidad_hojas, peso_asignado, observaciones, insumos_utilizados, estado }
  const [sublotesForm, setSublotesForm] = useState([]);
  const [subloteActivoIdx, setSubloteActivoIdx] = useState(0);

  // ─── MODALES SECUNDARIOS ─────────────────────────────────────────────────
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [loteConsolidado, setLoteConsolidado] = useState(null);

  // ─── TABLA DE CONTROL ────────────────────────────────────────────────────
  const [lotePadreControl, setLotePadreControl] = useState('');
  const [subloteControl, setSubloteControl] = useState('');

  // ─── CARGA DE DATOS ───────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, insumosData, productosData, invEnProceso] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'recurtido' }),
        Insumo.list(),
        ProductoTerminado.list(),
        InventarioEnProceso.list()
      ]);
      setProcesos(Array.isArray(procesosData) ? procesosData : []);
      setInsumos(Array.isArray(insumosData) ? insumosData : []);
      setProductos(Array.isArray(productosData) ? productosData : []);
      const filtrados = (Array.isArray(invEnProceso) ? invEnProceso : [])
        .filter(i => i.estado_actual === 'EN_PROCESO' && i.etapa_actual === 'curtido');
      setInventarioEnProceso(filtrados);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── HELPERS LOTES ────────────────────────────────────────────────────────
  const getLotePadre = (codigo) => {
    const m = (codigo || '').match(/^(.*?)-SUB\d+$/);
    return m ? m[1] : codigo;
  };
  const lotesCodigos = [...new Set(procesos.map(p => p.codigo_lote).filter(Boolean))];
  const lotesPadreUnicos = [...new Set(lotesCodigos.map(getLotePadre))];
  const getSublotesLote = (lote) =>
    procesos.filter(p => p.codigo_lote === lote || getLotePadre(p.codigo_lote) === lote)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  const isRecurtidoGeneralFinalizado = (lote) =>
    getSublotesLote(lote).some(p => p.finalizar_recurtido_general === true);

  // ─── SUBLOTE ACTIVO DEL FORMULARIO ────────────────────────────────────────
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

  // ─── ABRIR MODAL EDITAR (un sublote existente) ────────────────────────────
  const handleEditSublote = (proc) => {
    setIsEditing(true);
    const inv = inventarioEnProceso.find(i => i.codigo_lote === proc.codigo_lote) || null;
    setInvSeleccionado(inv);
    // Reconstruir forma de sublote único para edición
    setSublotesForm([{
      id_db: proc.id,
      id_temp: 'edit-0',
      codigo_sublote: proc.numero_proceso || proc.codigo_lote,
      color_base: proc.nombre_color || '',
      codigo_color: proc.codigo_color || '',
      cantidad_hojas: proc.cantidad_pieles || 0,
      peso_asignado: proc.peso_actual || 0,
      peso_promedio: proc.peso_promedio || 0,
      observaciones: proc.observaciones || '',
      insumos_utilizados: proc.insumos_utilizados || [],
      estado: proc.estado || 'pendiente',
      fecha_inicio: proc.fecha_inicio || new Date().toISOString().split('T')[0],
      fecha_fin: proc.fecha_fin || '',
      numero_sublote_recurtido: proc.numero_sublote_recurtido || 1,
      inv_proceso_id: proc.inv_proceso_id || '',
      finalizar_recurtido: proc.finalizar_recurtido || false,
      finalizar_recurtido_general: proc.finalizar_recurtido_general || false,
    }]);
    setSubloteActivoIdx(0);
    setShowModal(true);
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

  // ─── AGREGAR SUBLOTE AL FORMULARIO ────────────────────────────────────────
  const handleAgregarSublote = () => {
    if (!invSeleccionado) { alert('Seleccione primero un lote en proceso.'); return; }
    const idx = sublotesForm.length;
    const lotePadre = invSeleccionado.codigo_lote;
    setSublotesForm(prev => [...prev, {
      id_temp: `new-${Date.now()}-${idx}`,
      codigo_sublote: genCodigoSublote(lotePadre, '', idx),
      color_base: '',
      codigo_color: '',
      cantidad_hojas: 0,
      peso_asignado: 0,
      peso_promedio: 0,
      observaciones: '',
      insumos_utilizados: [],
      estado: 'pendiente',
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '',
      finalizar_recurtido: false,
    }]);
    setSubloteActivoIdx(idx);
  };

  const handleEliminarSubloteForm = (idx) => {
    setSublotesForm(prev => prev.filter((_, i) => i !== idx));
    setSubloteActivoIdx(Math.max(0, subloteActivoIdx - 1));
  };

  // ─── CAMBIOS EN CAMPOS DE SUBLOTE ─────────────────────────────────────────
  const handleSubloteFieldChange = (field, value) => {
    setSublotesForm(prev => prev.map((s, i) => {
      if (i !== subloteActivoIdx) return s;
      let updated = { ...s, [field]: value };

      // Auto-actualizar código sublote cuando cambia color_base
      if (field === 'color_base' && invSeleccionado) {
        updated.codigo_sublote = genCodigoSublote(invSeleccionado.codigo_lote, value, i);
      }

      // Recalcular peso_promedio cuando cambia peso o cantidad hojas
      if (field === 'peso_asignado' || field === 'cantidad_hojas') {
        const peso = field === 'peso_asignado' ? parseFloat(value) || 0 : parseFloat(s.peso_asignado) || 0;
        const hojas = field === 'cantidad_hojas' ? parseFloat(value) || 0 : parseFloat(s.cantidad_hojas) || 0;
        updated.peso_promedio = hojas > 0 ? peso / hojas : 0;
      }

      // Recalcular insumos con nuevo peso si cambia peso_asignado
      if (field === 'peso_asignado') {
        const newPeso = parseFloat(value) || 0;
        updated.insumos_utilizados = (s.insumos_utilizados || []).map(ins => {
          const dos = parseFloat(ins.dosificacion) || 0;
          const cant = (newPeso * dos) / 100;
          return calcInsumoTotales({ ...ins, cantidad: cant });
        });
      }

      return updated;
    }));
  };

  // Peso proporcional automático
  const calcPesoProporcional = (idx) => {
    if (!invSeleccionado) return 0;
    const totalHojas = parseFloat(invSeleccionado.cantidad_hojas) || 1;
    const pesoTotal  = parseFloat(invSeleccionado.peso_actual) || 0;
    const s = sublotesForm[idx];
    const hojas = parseFloat(s?.cantidad_hojas) || 0;
    return hojas > 0 ? (hojas / totalHojas) * pesoTotal : 0;
  };

  // ─── INSUMOS POR SUBLOTE ──────────────────────────────────────────────────
  const handleAddInsumo = () => {
    const newIns = { insumo_id: '', codigo: '', producto: '', dosificacion: 0, cantidad: 0, costo_unitario: 0, iva: 0.19, valor_total: 0 };
    setSubloteActivo({ insumos_utilizados: [...(subloteActivo?.insumos_utilizados || []), newIns] });
  };

  const handleRemoveInsumo = (insIdx) => {
    const updated = (subloteActivo?.insumos_utilizados || []).filter((_, i) => i !== insIdx);
    setSubloteActivo({ insumos_utilizados: updated });
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

  // ─── VALIDACIONES ──────────────────────────────────────────────────────────
  const getTotalHojasForm = () => sublotesForm.reduce((s, sub) => s + (parseFloat(sub.cantidad_hojas) || 0), 0);
  const getTotalPesoForm  = () => sublotesForm.reduce((s, sub) => s + (parseFloat(sub.peso_asignado) || 0), 0);

  const totalHojasLote   = parseFloat(invSeleccionado?.cantidad_hojas) || 0;
  const totalPesoLote    = parseFloat(invSeleccionado?.peso_actual) || 0;
  const hojasYaUsadas    = invSeleccionado
    ? getSublotesLote(invSeleccionado.codigo_lote)
        .filter(p => !isEditing)
        .reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0)
    : 0;
  const hojasDisponibles = Math.max(0, totalHojasLote - hojasYaUsadas);
  const hojasAsignadas   = getTotalHojasForm();
  const pesoAsignado     = getTotalPesoForm();
  const hojasRestantes   = hojasDisponibles - hojasAsignadas;
  const pesoRestante     = totalPesoLote - pesoAsignado;

  // ─── GUARDAR ──────────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();

    if (!invSeleccionado && !isEditing) { alert('⚠️ Seleccione un código en proceso.'); return; }
    if (sublotesForm.length === 0) { alert('⚠️ Agregue al menos un sublote.'); return; }

    const codigoLote = invSeleccionado?.codigo_lote || sublotesForm[0]?.codigo_sublote?.split('-').slice(0, -1).join('-');

    if (!isEditing && isRecurtidoGeneralFinalizado(codigoLote)) {
      alert('❌ El Recurtido General de este lote ya fue finalizado.'); return;
    }

    // Validar hojas totales
    if (!isEditing && hojasAsignadas > hojasDisponibles) {
      alert(`❌ Las hojas asignadas (${hojasAsignadas}) superan las disponibles (${hojasDisponibles}).`); return;
    }
    if (!isEditing && pesoAsignado > totalPesoLote && totalPesoLote > 0) {
      alert(`❌ El peso asignado (${pesoAsignado} kg) supera el peso disponible (${totalPesoLote} kg).`); return;
    }

    try {
      const sublotesExistentes = getSublotesLote(codigoLote);

      for (let idx = 0; idx < sublotesForm.length; idx++) {
        const sub = sublotesForm[idx];
        const numSublote = isEditing
          ? (sub.numero_sublote_recurtido || 1)
          : sublotesExistentes.length + idx + 1;

        const dataToSave = {
          tipo_proceso: 'recurtido',
          numero_proceso: sub.codigo_sublote || `${codigoLote}-RCT-${String(numSublote).padStart(2, '0')}`,
          numero_sublote_recurtido: numSublote,
          codigo_lote: codigoLote,
          inv_proceso_id: invSeleccionado?.id || sub.inv_proceso_id || '',
          codigo_color: sub.codigo_color || '',
          nombre_color: sub.color_base || '',
          cantidad_pieles: parseFloat(sub.cantidad_hojas) || 0,
          peso_actual: parseFloat(sub.peso_asignado) || 0,
          peso_promedio: parseFloat(sub.peso_promedio) || 0,
          fecha_inicio: sub.fecha_inicio || new Date().toISOString().split('T')[0],
          fecha_fin: sub.fecha_fin || '',
          observaciones: sub.observaciones || '',
          insumos_utilizados: sub.insumos_utilizados || [],
          subtotal_recurtido: calcSubtotalInsumos(sub.insumos_utilizados),
          subtotal_humectacion: 0,
          subtotal_recromado: 0,
          estado: sub.finalizar_recurtido ? 'completado' : 'pendiente',
          finalizar_recurtido: sub.finalizar_recurtido || false,
          finalizar_recurtido_general: false,
        };

        if (isEditing && sub.id_db) {
          await ProcesoProduccion.update(sub.id_db, dataToSave);
        } else {
          await ProcesoProduccion.create(dataToSave);
        }

        // Descontar insumos del inventario (solo en creación)
        if (!isEditing) {
          for (const insumo of (sub.insumos_utilizados || [])) {
            if (insumo.insumo_id && (parseFloat(insumo.cantidad) || 0) > 0) {
              const insumoData = insumos.find(i => i.id === insumo.insumo_id);
              if (insumoData) {
                await MovimientoInventario.create({
                  tipo_movimiento: 'salida', insumo_id: insumo.insumo_id,
                  cantidad: -(parseFloat(insumo.cantidad)),
                  costo_unitario: insumoData.costo_promedio || 0,
                  fecha_movimiento: dataToSave.fecha_inicio,
                  referencia: `RECURTIDO-${codigoLote}-${sub.color_base || idx + 1}`,
                  observaciones: `Consumo recurtido - Lote ${codigoLote} Sublote ${sub.codigo_sublote}`,
                  usuario_id: 'system'
                });
                const movimientos = await MovimientoInventario.filter({ insumo_id: insumo.insumo_id });
                const nuevoStock = (Array.isArray(movimientos) ? movimientos : []).reduce((s, m) => s + (parseFloat(m.cantidad) || 0), 0);
                await Insumo.update(insumo.insumo_id, { stock_actual: nuevoStock });
              }
            }
          }
        }
      }

      setShowModal(false);
      await loadData();
      alert(`✅ ${sublotesForm.length} sublote(s) de recurtido guardado(s) correctamente.`);
    } catch (err) {
      console.error(err);
      alert('Error al guardar: ' + err.message);
    }
  };

  // ─── FINALIZAR SUBLOTE ───────────────────────────────────────────────────
  const handleFinalizarSublote = async (proc) => {
    if (!window.confirm(`¿Finalizar sublote "${proc.nombre_color || proc.numero_proceso}"?`)) return;
    try {
      await ProcesoProduccion.update(proc.id, { estado: 'completado', finalizar_recurtido: true, fecha_fin: new Date().toISOString().split('T')[0] });
      await loadData();
    } catch (err) { alert('Error: ' + err.message); }
  };

  // ─── FINALIZAR RECURTIDO GENERAL ─────────────────────────────────────────
  const handleFinalizarRecurtidoGeneral = async (codigoLote) => {
    const sublotes = getSublotesLote(codigoLote);
    const inv = inventarioEnProceso.find(i => i.codigo_lote === codigoLote);
    const totalHojas = inv?.cantidad_hojas || 0;
    const totalRecurtido = sublotes.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
    const pendientes = sublotes.filter(p => p.estado !== 'completado');

    if (pendientes.length > 0) {
      alert(`❌ Existen ${pendientes.length} sublote(s) pendientes. Finalice todos antes de cerrar.`); return;
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
        const costoProductos = sublotes.reduce((s, p) => s + (parseFloat(p.subtotal_recurtido) || 0) + (parseFloat(p.subtotal_humectacion) || 0) + (parseFloat(p.subtotal_recromado) || 0), 0);
        const costoHeredado = parseFloat(inv.costo_acumulado) || 0;
        const nuevoCostoAcumulado = costoHeredado + costoProductos;
        const cantHojasFinales = totalRecurtido || (inv.cantidad_hojas || 0);
        const pesoFinal = sublotes.reduce((mx, p) => Math.max(mx, parseFloat(p.peso_actual) || 0), parseFloat(inv.peso_actual) || 0);
        const nuevoCostoPorHoja = cantHojasFinales > 0 ? nuevoCostoAcumulado / cantHojasFinales : 0;
        const nuevoCostoPorKg   = pesoFinal > 0 ? nuevoCostoAcumulado / pesoFinal : 0;
        const subloteConColor = sublotes.find(p => p.nombre_color);

        await InventarioEnProceso.update(inv.id, {
          etapa_actual: 'recurtido',
          estado_actual: 'FINALIZADO',
          estado_proceso: 'piel_recurtida',
          peso_actual: pesoFinal,
          costo_acumulado: nuevoCostoAcumulado,
          costo_promedio: nuevoCostoPorHoja,
          cantidad_hojas: cantHojasFinales,
          codigo_color: subloteConColor?.codigo_color || inv.codigo_color || '',
          color_base: subloteConColor?.nombre_color || inv.color_base || '',
        });
      }
      await loadData();
      alert(`✅ Recurtido General del lote ${codigoLote} finalizado.`);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este sublote?')) return;
    try { await ProcesoProduccion.delete(id); loadData(); } catch (err) { console.error(err); }
  };

  // ─── DATOS TABLA CONTROL ─────────────────────────────────────────────────
  const todosLosItems = [...insumos.map(i => ({ ...i })), ...productos.map(p => ({ ...p }))];

  const sublotesDelPadreControl = lotePadreControl
    ? lotesCodigos.filter(c => getLotePadre(c) === lotePadreControl && c !== lotePadreControl)
    : [];
  const loteControlActual = subloteControl || lotePadreControl || lotesCodigos[0] || '';

  const sublotesControl = (() => {
    if (lotePadreControl && !subloteControl && sublotesDelPadreControl.length > 0) {
      return procesos.filter(p => getLotePadre(p.codigo_lote) === lotePadreControl)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    }
    return getSublotesLote(loteControlActual);
  })();

  const totalHojasControl = (() => {
    const inv = inventarioEnProceso.find(i => i.codigo_lote === loteControlActual);
    return inv?.cantidad_hojas || sublotesControl.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
  })();
  const totalRecurtidoControl = sublotesControl.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0);
  const faltanHojas = Math.max(0, totalHojasControl - totalRecurtidoControl);
  const generalFinalizado = sublotesControl.some(p => p.finalizar_recurtido_general === true);
  const todosFinalizados  = sublotesControl.length > 0 && sublotesControl.every(p => p.estado === 'completado');
  const puedeFinalizarGeneral = todosFinalizados && faltanHojas === 0 && !generalFinalizado && sublotesControl.length > 0;

  // ─── COSTOS CONTROL DE COSTOS (por sublote en formulario) ─────────────────
  const getCostosSublotr = (sub) => {
    const inv    = invSeleccionado;
    const totalHojasLoteInv = parseFloat(inv?.cantidad_hojas) || 0;
    const costoAcumLote     = parseFloat(inv?.costo_acumulado) || 0;
    const hojasSubl         = parseFloat(sub?.cantidad_hojas) || 0;
    const pesoSubl          = parseFloat(sub?.peso_asignado) || 0;

    // Costo heredado proporcional
    const costoHeredado     = totalHojasLoteInv > 0 ? (hojasSubl / totalHojasLoteInv) * costoAcumLote : 0;
    const costoPromedioHeredadoHoja = parseFloat(inv?.costo_promedio) || 0;
    const costoPromedioHeredadoKg   = pesoSubl > 0 ? costoHeredado / pesoSubl : 0;
    const pctParticipacion  = totalHojasLoteInv > 0 ? (hojasSubl / totalHojasLoteInv) * 100 : 0;

    // Costo productos
    const costoProductos    = calcSubtotalInsumos(sub?.insumos_utilizados);

    // Totales
    const costoTotal        = costoHeredado + costoProductos;
    const costoPorHoja      = hojasSubl > 0 ? costoTotal / hojasSubl : 0;
    const costoPorKg        = pesoSubl > 0 ? costoTotal / pesoSubl : 0;

    return { costoHeredado, costoPromedioHeredadoHoja, costoPromedioHeredadoKg, pctParticipacion, costoProductos, costoTotal, costoPorHoja, costoPorKg, hojasSubl, pesoSubl };
  };

  // ─── RESUMEN CONSOLIDADO DEL FORMULARIO ──────────────────────────────────
  const getResumenConsolidado = () => {
    const totalSublotes = sublotesForm.length;
    const totalHojas    = sublotesForm.reduce((s, sub) => s + (parseFloat(sub.cantidad_hojas) || 0), 0);
    const totalPeso     = sublotesForm.reduce((s, sub) => s + (parseFloat(sub.peso_asignado) || 0), 0);
    const totalCostoProd= sublotesForm.reduce((s, sub) => s + calcSubtotalInsumos(sub.insumos_utilizados), 0);
    const costoHeredadoTotal = sublotesForm.reduce((s, sub) => {
      const { costoHeredado } = getCostosSublotr(sub);
      return s + costoHeredado;
    }, 0);
    const costoTotalAcumulado = costoHeredadoTotal + totalCostoProd;
    const costoPorHoja = totalHojas > 0 ? costoTotalAcumulado / totalHojas : 0;
    const costoPorKg   = totalPeso  > 0 ? costoTotalAcumulado / totalPeso  : 0;
    return { totalSublotes, totalHojas, totalPeso, totalCostoProd, costoHeredadoTotal, costoTotalAcumulado, costoPorHoja, costoPorKg };
  };

  // ─── UI HELPERS ───────────────────────────────────────────────────────────
  const invFiltrados = inventarioEnProceso.filter(inv => {
    if (!searchEnProceso) return true;
    const s = searchEnProceso.toLowerCase();
    return (inv.codigo_lote || '').toLowerCase().includes(s) || (inv.descripcion || '').toLowerCase().includes(s);
  });

  const estadoCostoColor = (estado) => ({
    'Pendiente':    'bg-yellow-100 text-yellow-800 border-yellow-300',
    'En proceso':   'bg-blue-100 text-blue-800 border-blue-300',
    'Calculado':    'bg-emerald-100 text-emerald-800 border-emerald-300',
    'Actualizado':  'bg-purple-100 text-purple-800 border-purple-300',
    'Recalculado':  'bg-orange-100 text-orange-800 border-orange-300',
  }[estado] || 'bg-gray-100 text-gray-700 border-gray-300');

  const getEstadoCosto = (sub) => {
    if (!sub) return 'Pendiente';
    if (sub.finalizar_recurtido) return 'Actualizado';
    if ((sub.insumos_utilizados || []).length === 0) return 'Pendiente';
    if ((parseFloat(sub.peso_asignado) || 0) === 0) return 'En proceso';
    return 'Calculado';
  };

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Proceso de Recurtido"
        description="División de sublotes por color/base con trazabilidad financiera independiente."
        onPrint={() => window.print()}
        actionButton={
          <Button onClick={handleOpenModal} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />Nuevo Registro Recurtido
          </Button>
        }
      />

      {/* ══════════════════ TABLA DE CONTROL ══════════════════ */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3 flex-wrap gap-2">
          <CardTitle className="text-base">Control de Recurtido por Sublote</CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Label className="text-xs text-slate-500 whitespace-nowrap">Lote:</Label>
              <Select value={lotePadreControl} onValueChange={v => { setLotePadreControl(v); setSubloteControl(''); }}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Seleccionar lote..." />
                </SelectTrigger>
                <SelectContent>
                  {lotesPadreUnicos.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  {lotesPadreUnicos.length === 0 && <SelectItem value="__none__" disabled>Sin lotes</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {lotePadreControl && sublotesDelPadreControl.length > 0 && (
              <div className="flex items-center gap-1">
                <Label className="text-xs text-slate-500 whitespace-nowrap">Sublote:</Label>
                <Select value={subloteControl} onValueChange={setSubloteControl}>
                  <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Todos..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>— Ver todos —</SelectItem>
                    {sublotesDelPadreControl.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {loteControlActual && (
              <Button variant="outline" size="sm" onClick={() => { setLoteConsolidado(lotePadreControl || loteControlActual); setShowConsolidadoModal(true); }}>
                <Table className="w-3 h-3 mr-1" />Consolidado
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loteControlActual ? (
            <>
              {/* Métricas generales */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Total Hojas del Lote</p>
                  <p className="text-2xl font-bold text-blue-700">{totalHojasControl}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500">Hojas Recurtidas</p>
                  <p className="text-2xl font-bold text-emerald-700">{totalRecurtidoControl}</p>
                </div>
                <div className={`border rounded-lg p-3 text-center ${faltanHojas > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                  <p className="text-xs text-slate-500">Hojas por Recurtir</p>
                  <p className={`text-2xl font-bold ${faltanHojas > 0 ? 'text-amber-700' : 'text-green-700'}`}>{faltanHojas}</p>
                </div>
              </div>

              {/* Tabla sublotes */}
              <div className="overflow-x-auto border rounded-lg mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="p-2 text-left">Código Sublote</th>
                      <th className="p-2 text-left">Base / Color</th>
                      <th className="p-2 text-center">Sublote #</th>
                      <th className="p-2 text-right">Cant. Hojas</th>
                      <th className="p-2 text-right">Peso (kg)</th>
                      <th className="p-2 text-right">Costo Productos</th>
                      <th className="p-2 text-center">Estado</th>
                      <th className="p-2 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sublotesControl.length === 0 ? (
                      <tr><td colSpan={8} className="p-4 text-center text-slate-400">No hay sublotes. Use "Nuevo Registro Recurtido".</td></tr>
                    ) : sublotesControl.map(proc => {
                      const finalizado = proc.estado === 'completado';
                      const costoProductos = (parseFloat(proc.subtotal_recurtido) || 0) + (parseFloat(proc.subtotal_humectacion) || 0) + (parseFloat(proc.subtotal_recromado) || 0);
                      return (
                        <tr key={proc.id} className={`border-t ${finalizado ? 'bg-green-50' : 'bg-white'}`}>
                          <td className="p-2 font-mono font-bold text-xs text-purple-800">{proc.numero_proceso || proc.codigo_lote}</td>
                          <td className="p-2 font-semibold">{proc.nombre_color || '—'}</td>
                          <td className="p-2 text-center">
                            <span className="bg-slate-100 text-slate-700 rounded px-2 py-0.5 text-xs font-bold">#{proc.numero_sublote_recurtido || '?'}</span>
                          </td>
                          <td className="p-2 text-right font-bold">{proc.cantidad_pieles}</td>
                          <td className="p-2 text-right text-slate-600">{proc.peso_actual} kg</td>
                          <td className="p-2 text-right font-semibold text-emerald-700">{formatCurrency(costoProductos)}</td>
                          <td className="p-2 text-center">
                            {finalizado
                              ? <Badge className="bg-green-100 text-green-700 border-green-300">Finalizado</Badge>
                              : <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300">Pendiente</Badge>}
                          </td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {finalizado || generalFinalizado ? (
                                <span className="flex items-center gap-1 text-xs text-slate-400"><Lock className="w-3 h-3" />Bloqueado</span>
                              ) : (
                                <>
                                  <Button size="sm" variant="outline" onClick={() => handleEditSublote(proc)} className="h-7 text-xs">Editar</Button>
                                  <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => handleFinalizarSublote(proc)}>
                                    <CheckCircle2 className="w-3 h-3 mr-1" />Finalizar
                                  </Button>
                                </>
                              )}
                              <Button variant="ghost" size="sm" onClick={() => { setSelectedItem(proc); setShowDetailModal(true); }} className="h-7"><Eye className="w-3 h-3" /></Button>
                              {!finalizado && !generalFinalizado && (
                                <Button variant="ghost" size="sm" onClick={() => handleDelete(proc.id)} className="h-7 text-red-500"><Trash2 className="w-3 h-3" /></Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {sublotesControl.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-100 font-bold border-t-2">
                        <td colSpan={3} className="p-2 text-right text-xs">TOTAL:</td>
                        <td className="p-2 text-right">{totalRecurtidoControl}</td>
                        <td className="p-2 text-right">{sublotesControl.reduce((s, p) => s + (parseFloat(p.peso_actual) || 0), 0).toFixed(2)} kg</td>
                        <td className="p-2 text-right text-emerald-700">
                          {formatCurrency(sublotesControl.reduce((s, p) => s + (parseFloat(p.subtotal_recurtido) || 0) + (parseFloat(p.subtotal_humectacion) || 0) + (parseFloat(p.subtotal_recromado) || 0), 0))}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Resumen general tabla control */}
              {sublotesControl.length > 0 && (() => {
                const porPartida = {};
                sublotesControl.forEach(p => {
                  const k = p.nombre_color || p.codigo_color || 'Sin Partida';
                  if (!porPartida[k]) porPartida[k] = { hojas: 0, costo: 0 };
                  porPartida[k].hojas += parseFloat(p.cantidad_pieles) || 0;
                  porPartida[k].costo += (parseFloat(p.subtotal_recurtido) || 0) + (parseFloat(p.subtotal_humectacion) || 0) + (parseFloat(p.subtotal_recromado) || 0);
                });
                return (
                  <div className="border rounded-lg overflow-hidden mb-4">
                    <div className="bg-purple-800 text-white px-4 py-2 font-bold text-sm">📊 Resumen General de Recurtido</div>
                    <table className="w-full text-sm">
                      <thead className="bg-purple-50">
                        <tr>
                          <th className="p-2 text-left">Partida Base / Color</th>
                          <th className="p-2 text-right">Hojas</th>
                          <th className="p-2 text-right">Costo / Hoja</th>
                          <th className="p-2 text-right">Costo Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(porPartida).map(([p, v]) => (
                          <tr key={p} className="border-t">
                            <td className="p-2 font-semibold text-purple-900">{p}</td>
                            <td className="p-2 text-right font-bold">{v.hojas}</td>
                            <td className="p-2 text-right">{formatCurrency(v.hojas > 0 ? v.costo / v.hojas : 0)}</td>
                            <td className="p-2 text-right font-bold text-emerald-700">{formatCurrency(v.costo)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-purple-100 font-bold border-t-2 border-purple-300">
                          <td className="p-2">TOTAL</td>
                          <td className="p-2 text-right">{sublotesControl.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0)}</td>
                          <td className="p-2 text-right">{(() => { const h = sublotesControl.reduce((s, p) => s + (parseFloat(p.cantidad_pieles) || 0), 0); const c = sublotesControl.reduce((s, p) => s + (parseFloat(p.subtotal_recurtido) || 0) + (parseFloat(p.subtotal_humectacion) || 0), 0); return formatCurrency(h > 0 ? c / h : 0); })()}</td>
                          <td className="p-2 text-right text-emerald-800 text-base">{formatCurrency(sublotesControl.reduce((s, p) => s + (parseFloat(p.subtotal_recurtido) || 0) + (parseFloat(p.subtotal_humectacion) || 0) + (parseFloat(p.subtotal_recromado) || 0), 0))}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()}

              {/* Botón finalizar general */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500">
                  {generalFinalizado && <span className="flex items-center gap-1 text-green-700 font-medium"><CheckCircle2 className="w-4 h-4" />Recurtido General FINALIZADO</span>}
                  {!generalFinalizado && !puedeFinalizarGeneral && sublotesControl.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-700"><AlertCircle className="w-4 h-4" />
                      {faltanHojas > 0 ? `Faltan ${faltanHojas} hojas` : `Hay ${sublotesControl.filter(p => p.estado !== 'completado').length} sublote(s) pendiente(s)`}
                    </span>
                  )}
                </div>
                <Button disabled={!puedeFinalizarGeneral}
                  onClick={() => handleFinalizarRecurtidoGeneral(loteControlActual)}
                  className="bg-purple-700 hover:bg-purple-800 disabled:opacity-40">
                  <CheckCircle2 className="w-4 h-4 mr-2" />Finalizar Recurtido General
                </Button>
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-center py-8 text-sm">
              {procesos.length === 0 ? 'Sin sublotes registrados. Use "Nuevo Registro Recurtido".' : 'Seleccione un lote.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ══════════════════ MODAL FORMULARIO ══════════════════ */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Registro de Recurtido</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-5">

            {/* ═══ BLOQUE 1: SELECTOR CÓDIGO EN PROCESO ═══ */}
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
                    <div><span className="font-semibold text-indigo-700">Peso Total:</span> {invSeleccionado.peso_actual} kg</div>
                    <div><span className="font-semibold text-indigo-700">Costo Acumulado:</span> {formatCurrency(invSeleccionado.costo_acumulado)}</div>
                    <div><span className="font-semibold text-indigo-700">Costo/Hoja:</span> {formatCurrency(invSeleccionado.costo_promedio)}</div>
                    <div><span className="font-semibold text-indigo-700">Disponibles:</span> <strong className={hojasDisponibles === 0 ? 'text-red-600' : 'text-green-700'}>{hojasDisponibles} hojas</strong></div>
                  </div>
                )}
              </div>
            )}
            {isEditing && (
              <div className="p-2 bg-slate-50 border rounded text-sm">
                <span className="font-semibold">Lote:</span> <span className="font-mono">{invSeleccionado?.codigo_lote || '—'}</span>
                <span className="ml-4 font-semibold">Modo:</span> Edición de sublote existente
              </div>
            )}

            {/* ═══ BLOQUE 2: DIVISIÓN DE SUBLOTES ═══ */}
            {(invSeleccionado || isEditing) && (
              <div className="border-2 border-orange-400 rounded-xl overflow-hidden">
                {/* Header */}
                <div className="bg-orange-600 text-white px-5 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base tracking-wide">② DIVISIÓN DE SUBLOTES</h3>
                    <p className="text-xs text-orange-200 mt-0.5">Cada sublote es una unidad de producción independiente con trazabilidad propia</p>
                  </div>
                  {!isEditing && (
                    <Button type="button" onClick={handleAgregarSublote}
                      className="bg-white text-orange-700 hover:bg-orange-50 text-xs h-8">
                      <Plus className="w-3 h-3 mr-1" />Agregar Sublote
                    </Button>
                  )}
                </div>

                {/* Indicador distribución */}
                {!isEditing && invSeleccionado && (
                  <div className={`px-5 py-2 text-xs flex items-center gap-4 border-b ${hojasRestantes < 0 ? 'bg-red-50 border-red-200' : hojasRestantes === 0 && sublotesForm.length > 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
                    <span>Total lote: <strong>{totalHojasLote}</strong> hojas</span>
                    <span>|</span>
                    <span>Asignadas: <strong className={hojasRestantes < 0 ? 'text-red-700' : 'text-orange-800'}>{hojasAsignadas}</strong></span>
                    <span>|</span>
                    <span>Restantes: <strong className={hojasRestantes < 0 ? 'text-red-700' : hojasRestantes === 0 ? 'text-green-700' : 'text-orange-700'}>{hojasRestantes}</strong></span>
                    <span>|</span>
                    <span>Peso total: <strong>{totalPesoLote}</strong> kg | Asignado: <strong>{fmt2(pesoAsignado)}</strong> kg | Restante: <strong className={pesoRestante < 0 ? 'text-red-700' : 'text-orange-700'}>{fmt2(pesoRestante)}</strong> kg</span>
                    {hojasRestantes === 0 && sublotesForm.length > 0 && <span className="text-green-700 font-bold">✔ Distribución completa</span>}
                    {hojasRestantes < 0 && <span className="text-red-700 font-bold">✖ Excede el total</span>}
                  </div>
                )}

                {sublotesForm.length === 0 ? (
                  <div className="px-5 py-6 text-center text-slate-400 bg-white">
                    <p className="text-sm">Sin sublotes agregados. Haga clic en "Agregar Sublote" para comenzar.</p>
                  </div>
                ) : (
                  <>
                    {/* Tabs de sublotes */}
                    <div className="flex items-center gap-1 px-4 pt-3 bg-white border-b overflow-x-auto">
                      {sublotesForm.map((sub, idx) => (
                        <button key={sub.id_temp} type="button"
                          onClick={() => setSubloteActivoIdx(idx)}
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-t-lg text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${subloteActivoIdx === idx ? 'bg-orange-100 border-orange-500 text-orange-800' : 'bg-gray-50 border-transparent text-slate-500 hover:bg-orange-50'}`}>
                          {sub.color_base ? sub.color_base.toUpperCase() : `Sublote ${idx + 1}`}
                          {!isEditing && (
                            <span onClick={e => { e.stopPropagation(); handleEliminarSubloteForm(idx); }}
                              className="ml-1 text-red-400 hover:text-red-600 font-bold leading-none">×</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Formulario sublote activo */}
                    {subloteActivo && (
                      <div className="bg-white px-5 py-4 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Lote Padre</Label>
                            <Input value={invSeleccionado?.codigo_lote || '—'} readOnly className="bg-amber-50 font-mono text-xs font-bold cursor-not-allowed" />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Código Sublote</Label>
                            <Input value={subloteActivo.codigo_sublote || ''} readOnly className="bg-amber-50 font-mono text-xs font-bold cursor-not-allowed" />
                            <p className="text-xs text-orange-500 mt-0.5">Automático</p>
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Base / Color Base *</Label>
                            <Input value={subloteActivo.color_base || ''}
                              onChange={e => handleSubloteFieldChange('color_base', e.target.value)}
                              placeholder="ej: NEGRO, CAFÉ, MIEL..."
                              className="text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Cantidad Hojas *</Label>
                            <Input type="number" min="0"
                              value={subloteActivo.cantidad_hojas || ''}
                              onChange={e => handleSubloteFieldChange('cantidad_hojas', parseFloat(e.target.value) || 0)}
                              className={`text-xs ${hojasRestantes < 0 ? 'border-red-400 bg-red-50' : ''}`} />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Peso Asignado (kg)</Label>
                            <div className="flex gap-1">
                              <Input type="number" min="0" step="0.01"
                                value={subloteActivo.peso_asignado || ''}
                                onChange={e => handleSubloteFieldChange('peso_asignado', parseFloat(e.target.value) || 0)}
                                className="text-xs" />
                              {!isEditing && invSeleccionado && (
                                <Button type="button" size="sm" variant="outline" className="h-9 text-xs px-2 whitespace-nowrap"
                                  onClick={() => {
                                    const pesoProp = calcPesoProporcional(subloteActivoIdx);
                                    handleSubloteFieldChange('peso_asignado', parseFloat(pesoProp.toFixed(2)));
                                  }}
                                  title="Calcular peso proporcional">↗</Button>
                              )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">↗ = proporcional</p>
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">% Participación</Label>
                            <Input readOnly
                              value={invSeleccionado && totalHojasLote > 0
                                ? `${(((parseFloat(subloteActivo.cantidad_hojas) || 0) / totalHojasLote) * 100).toFixed(1)}%`
                                : '—'}
                              className="bg-blue-50 text-xs text-center font-bold text-blue-800 cursor-not-allowed" />
                            <p className="text-xs text-slate-400 mt-0.5">= Hojas / Total × 100</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Fecha Inicio</Label>
                            <Input type="date" value={subloteActivo.fecha_inicio || ''}
                              onChange={e => handleSubloteFieldChange('fecha_inicio', e.target.value)} className="text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Fecha Fin</Label>
                            <Input type="date" value={subloteActivo.fecha_fin || ''}
                              onChange={e => handleSubloteFieldChange('fecha_fin', e.target.value)} className="text-xs" />
                          </div>
                          <div>
                            <Label className="text-xs font-bold text-orange-800">Peso Promedio / Hoja</Label>
                            <Input readOnly
                              value={`${fmt2(subloteActivo.peso_promedio)} kg`}
                              className="bg-blue-50 text-xs font-bold text-blue-800 cursor-not-allowed" />
                            <p className="text-xs text-slate-400 mt-0.5">= Peso ÷ Hojas</p>
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-orange-800">Estado</Label>
                          <Select value={subloteActivo.estado || 'pendiente'}
                            onValueChange={v => handleSubloteFieldChange('estado', v)}>
                            <SelectTrigger className="text-xs h-8 w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendiente">Pendiente</SelectItem>
                              <SelectItem value="en_proceso">En Proceso</SelectItem>
                              <SelectItem value="completado">Completado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-orange-800">Observaciones del Sublote</Label>
                          <Textarea value={subloteActivo.observaciones || ''}
                            onChange={e => handleSubloteFieldChange('observaciones', e.target.value)}
                            rows={2} className="text-xs" placeholder="Observaciones específicas de este sublote..." />
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
                    <h3 className="font-bold text-base tracking-wide">
                      ③ ÍTEMS / PRODUCTOS — Sublote: <span className="text-blue-200 font-mono">{subloteActivo.color_base || `Sublote ${subloteActivoIdx + 1}`}</span>
                    </h3>
                    <p className="text-xs text-blue-200 mt-0.5">
                      Productos químicos registrados exclusivamente para este sublote · Peso: {subloteActivo.peso_asignado} kg
                    </p>
                  </div>
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
                          <td className="p-2">
                            <Input type="number" step="0.01" value={ins.dosificacion}
                              onChange={e => handleInsumoChange(insIdx, 'dosificacion', e.target.value)}
                              className="text-right text-xs h-8 w-20" />
                          </td>
                          <td className="p-2">
                            <Input value={fmt2(ins.cantidad)} readOnly className="text-right text-xs h-8 bg-blue-50 font-medium w-24" />
                          </td>
                          <td className="p-2">
                            <Input type="number" step="0.01" value={ins.costo_unitario}
                              onChange={e => handleInsumoChange(insIdx, 'costo_unitario', e.target.value)}
                              className="text-right text-xs h-8 w-28" />
                          </td>
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
                              <Trash2 className="w-3 h-3 text-red-500" />
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
                          <td colSpan={5} className="p-2 text-right text-xs text-blue-800">TOTAL PRODUCTOS QUÍMICOS — {subloteActivo.color_base || `Sublote ${subloteActivoIdx + 1}`}:</td>
                          <td className="p-2 text-right text-emerald-800 text-sm">{formatCurrency(calcSubtotalInsumos(subloteActivo.insumos_utilizados))}</td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            )}

            {/* ═══ BLOQUE 4: CONTROL DE COSTOS DEL PROCESO (por sublote activo) ═══ */}
            {subloteActivo && invSeleccionado && (() => {
              const c = getCostosSublotr(subloteActivo);
              const estadoCosto = getEstadoCosto(subloteActivo);
              return (
                <div className="border-2 border-violet-500 rounded-xl overflow-hidden shadow-md">
                  <div className="bg-violet-700 text-white px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-base tracking-wide">④ CONTROL DE COSTOS DEL PROCESO — RECURTIDO</p>
                      <p className="text-xs text-violet-200 mt-0.5">
                        Sublote activo: <strong className="text-violet-100 font-mono">{subloteActivo.color_base || `Sublote ${subloteActivoIdx + 1}`}</strong>
                        &nbsp;· Trazabilidad financiera independiente por sublote
                      </p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full border font-bold ${estadoCostoColor(estadoCosto)}`}>{estadoCosto}</span>
                  </div>

                  {/* Costos heredados (proporcional) */}
                  <div className="bg-amber-50 border-b border-amber-200 px-5 py-3">
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2">📥 Costos Heredados desde Curtido (proporcional al sublote)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">Costo Heredado Sublote</p>
                        <p className="text-base font-extrabold text-amber-800">{formatCurrency(c.costoHeredado)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">= ({c.hojasSubl} ÷ {totalHojasLote}) × {formatCurrency(invSeleccionado.costo_acumulado)}</p>
                      </div>
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">Costo Promedio Heredado/Hoja</p>
                        <p className="text-base font-bold text-amber-700">{formatCurrency(c.costoPromedioHeredadoHoja)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">🔒 Desde Curtido</p>
                      </div>
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">Costo Promedio Heredado/Kg</p>
                        <p className="text-base font-bold text-amber-700">{formatCurrency(c.costoPromedioHeredadoKg)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">= Costo Heredado ÷ Peso Sublote</p>
                      </div>
                      <div className="bg-white rounded border border-amber-200 p-2 text-center">
                        <p className="text-xs text-amber-600 font-semibold">% Participación</p>
                        <p className="text-xl font-extrabold text-amber-800">{c.pctParticipacion.toFixed(1)}%</p>
                        <p className="text-xs text-slate-400 mt-0.5">= {c.hojasSubl} ÷ {totalHojasLote} × 100</p>
                      </div>
                    </div>
                  </div>

                  {/* Tabla de control */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-violet-800 text-white">
                        <tr>
                          <th className="p-2 text-right whitespace-nowrap">COSTO HEREDADO<br/>PROCESO ANTERIOR</th>
                          <th className="p-2 text-right whitespace-nowrap">COSTO AGREGADO<br/>RECURTIDO</th>
                          <th className="p-2 text-right whitespace-nowrap font-extrabold">COSTO TOTAL<br/>ACUMULADO</th>
                          <th className="p-2 text-center whitespace-nowrap">CANTIDAD<br/>HOJAS</th>
                          <th className="p-2 text-center whitespace-nowrap">PESO ACTUAL<br/>KG</th>
                          <th className="p-2 text-right whitespace-nowrap">COSTO PROM.<br/>POR HOJA</th>
                          <th className="p-2 text-right whitespace-nowrap">COSTO PROM.<br/>POR KG</th>
                          <th className="p-2 text-center whitespace-nowrap">ESTADO</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white border-b hover:bg-violet-50">
                          <td className="p-2 text-right font-semibold text-amber-700">{formatCurrency(c.costoHeredado)}</td>
                          <td className="p-2 text-right font-semibold text-blue-700">{formatCurrency(c.costoProductos)}</td>
                          <td className="p-2 text-right font-extrabold text-violet-800 text-sm">{formatCurrency(c.costoTotal)}</td>
                          <td className="p-2 text-center font-bold">{c.hojasSubl || <span className="text-gray-400">—</span>}</td>
                          <td className="p-2 text-center font-bold">{c.pesoSubl > 0 ? `${c.pesoSubl} kg` : <span className="text-gray-400">—</span>}</td>
                          <td className="p-2 text-right font-bold text-emerald-700">{c.hojasSubl > 0 ? formatCurrency(c.costoPorHoja) : <span className="text-gray-400">N/A</span>}</td>
                          <td className="p-2 text-right font-bold text-emerald-700">{c.pesoSubl > 0 ? formatCurrency(c.costoPorKg) : <span className="text-gray-400">N/A</span>}</td>
                          <td className="p-2 text-center"><span className={`text-xs px-2 py-0.5 rounded-full border font-bold ${estadoCostoColor(estadoCosto)}`}>{estadoCosto}</span></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Fórmulas y trazabilidad */}
                  <div className="bg-violet-50 border-t border-violet-200 px-5 py-3 grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-violet-600 font-semibold">Costo Total Acumulado</p>
                      <p className="text-xs text-slate-600 mt-0.5">{formatCurrency(c.costoHeredado)} + {formatCurrency(c.costoProductos)} = <strong className="text-violet-800">{formatCurrency(c.costoTotal)}</strong></p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-violet-600 font-semibold">Costo Promedio / Hoja</p>
                      <p className="text-xs text-slate-600 mt-0.5">{formatCurrency(c.costoTotal)} ÷ {c.hojasSubl || 0} = <strong className="text-emerald-700">{c.hojasSubl > 0 ? formatCurrency(c.costoPorHoja) : 'N/A'}</strong></p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-violet-600 font-semibold">Costo Promedio / Kg</p>
                      <p className="text-xs text-slate-600 mt-0.5">{formatCurrency(c.costoTotal)} ÷ {c.pesoSubl} kg = <strong className="text-emerald-700">{c.pesoSubl > 0 ? formatCurrency(c.costoPorKg) : 'N/A'}</strong></p>
                    </div>
                  </div>
                  <div className="bg-slate-50 border-t border-slate-200 px-5 py-2 text-xs text-slate-500">
                    🔗 <strong>Trazabilidad:</strong> Al finalizar el Recurtido General, el Costo Total Acumulado y Costo Promedio/Hoja de cada sublote se enviarán automáticamente a <strong>Pintura</strong>.
                  </div>
                </div>
              );
            })()}

            {/* ═══ BLOQUE 5: RESUMEN CONSOLIDADO DEL PROCESO ═══ */}
            {sublotesForm.length > 1 && invSeleccionado && (() => {
              const res = getResumenConsolidado();
              return (
                <div className="border-2 border-emerald-500 rounded-xl overflow-hidden">
                  <div className="bg-emerald-700 text-white px-5 py-3">
                    <h3 className="font-bold text-base tracking-wide">⑤ RESUMEN GENERAL CONSOLIDADO DEL PROCESO</h3>
                    <p className="text-xs text-emerald-200 mt-0.5">Totales del proceso de Recurtido — todos los sublotes combinados</p>
                  </div>
                  <div className="bg-emerald-50 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Total Sublotes</p>
                      <p className="text-3xl font-extrabold text-emerald-800">{res.totalSublotes}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Total Hojas Procesadas</p>
                      <p className="text-3xl font-extrabold text-blue-700">{res.totalHojas}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Total Peso Procesado</p>
                      <p className="text-2xl font-extrabold text-blue-700">{fmt2(res.totalPeso)} <span className="text-sm font-normal">kg</span></p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Total Costo Productos Recurtido</p>
                      <p className="text-lg font-extrabold text-amber-700">{formatCurrency(res.totalCostoProd)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-200 p-3 text-center">
                      <p className="text-xs text-emerald-700 font-semibold">Costo Heredado Total</p>
                      <p className="text-lg font-extrabold text-amber-700">{formatCurrency(res.costoHeredadoTotal)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-300 p-3 text-center ring-1 ring-emerald-400">
                      <p className="text-xs text-emerald-700 font-semibold">Costo Total Acumulado Proceso</p>
                      <p className="text-xl font-extrabold text-emerald-800">{formatCurrency(res.costoTotalAcumulado)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-300 p-3 text-center ring-1 ring-emerald-400">
                      <p className="text-xs text-emerald-700 font-semibold">Costo Promedio General / Hoja</p>
                      <p className="text-xl font-extrabold text-emerald-800">{formatCurrency(res.costoPorHoja)}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-emerald-300 p-3 text-center ring-1 ring-emerald-400">
                      <p className="text-xs text-emerald-700 font-semibold">Costo Promedio General / Kg</p>
                      <p className="text-xl font-extrabold text-emerald-800">{formatCurrency(res.costoPorKg)}</p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit" className="bg-violet-700 hover:bg-violet-800" disabled={sublotesForm.length === 0}>
                {isEditing ? 'Guardar Cambios' : `Guardar ${sublotesForm.length} Sublote(s)`}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ══════════════════ MODAL DETALLE ══════════════════ */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalle del Sublote de Recurtido</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded border">
                <div><span className="font-semibold">Código Sublote:</span> <span className="font-mono font-bold text-purple-800">{selectedItem.numero_proceso || selectedItem.codigo_lote}</span></div>
                <div><span className="font-semibold">Lote Padre:</span> <span className="font-mono">{selectedItem.codigo_lote}</span></div>
                <div><span className="font-semibold">Base/Color:</span> {selectedItem.codigo_color} — {selectedItem.nombre_color}</div>
                <div><span className="font-semibold">Sublote #:</span> {selectedItem.numero_sublote_recurtido}</div>
                <div><span className="font-semibold">Cantidad Hojas:</span> {selectedItem.cantidad_pieles}</div>
                <div><span className="font-semibold">Peso:</span> {selectedItem.peso_actual} kg</div>
                <div><span className="font-semibold">Fecha Inicio:</span> {new Date(selectedItem.fecha_inicio).toLocaleDateString()}</div>
                {selectedItem.fecha_fin && <div><span className="font-semibold">Fecha Fin:</span> {new Date(selectedItem.fecha_fin).toLocaleDateString()}</div>}
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-amber-50 rounded border border-amber-200 text-center text-xs">
                  <p className="font-semibold text-amber-700">Costo Productos</p>
                  <p className="font-bold text-amber-800">{formatCurrency((parseFloat(selectedItem.subtotal_recurtido) || 0) + (parseFloat(selectedItem.subtotal_humectacion) || 0) + (parseFloat(selectedItem.subtotal_recromado) || 0))}</p>
                </div>
                <div className="p-2 bg-slate-800 rounded text-center text-xs">
                  <p className="font-semibold text-slate-300">Estado</p>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${selectedItem.estado === 'completado' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{selectedItem.estado}</span>
                </div>
                <div className="p-2 bg-emerald-50 rounded border border-emerald-200 text-center text-xs">
                  <p className="font-semibold text-emerald-700">Observaciones</p>
                  <p className="text-slate-600">{selectedItem.observaciones || '—'}</p>
                </div>
              </div>

              {(selectedItem.insumos_utilizados || []).length > 0 && (
                <div className="border rounded overflow-hidden">
                  <div className="bg-blue-700 text-white px-3 py-1.5 text-xs font-bold">Productos Químicos Utilizados</div>
                  <table className="w-full text-xs">
                    <thead className="bg-blue-50">
                      <tr><th className="p-1 text-left">Código</th><th className="p-1 text-left">Producto</th><th className="p-1 text-right">Cant.</th><th className="p-1 text-right">Costo Unit.</th><th className="p-1 text-right font-bold">Total</th></tr>
                    </thead>
                    <tbody>
                      {selectedItem.insumos_utilizados.map((ins, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-1 font-mono">{ins.codigo}</td>
                          <td className="p-1">{ins.producto}</td>
                          <td className="p-1 text-right">{fmt2(ins.cantidad)}</td>
                          <td className="p-1 text-right">{formatCurrency(ins.costo_unitario)}</td>
                          <td className="p-1 text-right font-bold text-emerald-700">{formatCurrency(ins.valor_total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && (
        <LoteDetalleConsolidado open={showConsolidadoModal} onOpenChange={setShowConsolidadoModal} codigoLote={loteConsolidado} />
      )}
    </div>
  );
}