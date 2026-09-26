import React, { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Save, Upload, CheckCircle2 } from 'lucide-react';
import { UploadFile } from "@/integrations/Core";
import ProductCreationModal from './ProductCreationModal';
import ProductSelectorCell from './ProductSelectorCell';
import NumericInput from './NumericInput';
import { ProductoCatalogo, OrdenCompra } from '@/entities/all';
import { fin, nuevaLlave, TIPO_CUENTA_POR_FORMA_PAGO } from '@/api/finanzas';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

// Fecha actual en zona horaria Colombia (UTC-5)
const getTodayColombia = () => {
  const now = new Date();
  const offset = -5 * 60; // UTC-5 en minutos
  const localTime = new Date(now.getTime() + (offset - now.getTimezoneOffset()) * 60000);
  return localTime.toISOString().split('T')[0];
};

export default function DocumentoComercialForm({ open, onOpenChange, onSubmit, onSuccess, documento, terceros, itemsCatalogo, tipoDocumento, tipoItem, terceroLabel, documentoTitulo }) {
  const [formData, setFormData] = useState(null);
  const [terceroPersonalizado, setTerceroPersonalizado] = useState(false);
  const [itemsPersonalizados, setItemsPersonalizados] = useState({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  
  const [productosCatalogo, setProductosCatalogo] = useState([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [newProductCode, setNewProductCode] = useState("");
  const [newProductDesc, setNewProductDesc] = useState("");
  const [pendingItemIndex, setPendingItemIndex] = useState(null);
  const [productSearchTerms, setProductSearchTerms] = useState({}); // búsqueda por ítem
  const [showProductDropdown, setShowProductDropdown] = useState({}); // dropdown abierto por ítem
  const [proveedorSearch, setProveedorSearch] = useState('');
  const [showProveedorDropdown, setShowProveedorDropdown] = useState(false);
  const proveedorDropdownRef = useRef(null);
  const [cuentasDinero, setCuentasDinero] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const llaveRef = useRef(nuevaLlave());
  const [showLotePopup, setShowLotePopup] = useState(false);
  const [loteData, setLoteData] = useState({ codigo_lote: '', estado_cuero: 'CRU' });
  const [lotesDisponibles, setLotesDisponibles] = useState([]);

  // Normalizar texto para búsqueda (sin tildes, minúsculas)
  const normalize = (str) => (str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  useEffect(() => {
      loadCatalogo();
      loadCuentas();
  }, []);

  const loadCatalogo = async () => {
      try {
          const prods = await ProductoCatalogo.list();
          setProductosCatalogo(prods);
      } catch (error) {
          console.error("Error loading catalog:", error);
      }
  };

  const loadCuentas = async () => {
      try {
          const [cuentasData, comprasData] = await Promise.all([
              fin.get('/cuentas'),
              OrdenCompra.list()
          ]);
          setCuentasDinero(cuentasData);
          
          // Extraer códigos de lote únicos de compras con prefijo CH
          const lotes = comprasData
            .filter(c => c.prefijo_documento === 'CH' && c.codigo_lote_inventario)
            .map(c => ({
              codigo: c.codigo_lote_inventario,
              estado: c.estado_cuero || 'CRU'
            }));
          setLotesDisponibles(lotes);
      } catch (error) {
          console.error("Error loading accounts:", error);
      }
  };

  const handleProductCreated = (newProduct) => {
      setProductosCatalogo(prev => [...prev, newProduct]);
      if (pendingItemIndex !== null && formData) {
          const newItems = [...formData.items];
          newItems[pendingItemIndex].codigo = newProduct.codigo;
          newItems[pendingItemIndex].descripcion = newProduct.descripcion;
          newItems[pendingItemIndex].categoria = newProduct.categoria || '';
          newItems[pendingItemIndex].unidad_medida = newProduct.unidad_medida || '';
          newItems[pendingItemIndex].precio_unitario = newProduct.costo_estandar || 0;
          setFormData({ ...formData, items: newItems });
          setPendingItemIndex(null);
      }
  };

  useEffect(() => {
    // Nueva llave de idempotencia por cada vez que se abre el formulario.
    llaveRef.current = nuevaLlave();
    const initialFormState = {
        prefijo: tipoDocumento === 'compra' ? 'CH' : (tipoDocumento === 'venta' ? 'FV' : ''),
        tipo_item: tipoDocumento === 'compra' ? 'materia_prima' : '',
        tipo_documento_proveedor: tipoDocumento === 'compra' ? 'FE' : '',
        tipo_documento_venta: tipoDocumento === 'venta' ? 'FE' : '',
        tipo_documento: "factura_electronica",
        prefijo_documento: tipoDocumento === 'compra' ? 'FC' : 'FV',
        numero_documento: '',
        numero_id: '',
        codigo_proveedor: '',
        codigo_cliente: '',
        [`${tipoItem === 'insumo' || tipoItem === 'piel' || tipoItem === 'hoja' || tipoItem === 'otra' ? 'proveedor' : 'cliente'}_id`]: '',
        tercero_personalizado: '',
        cc_nit_proveedor: '',
        cc_nit_cliente: '',
        direccion_cliente: '',
        telefono_cliente: '',
        fecha_orden: getTodayColombia(),
        fecha_vencimiento: getTodayColombia(),
        condicion_pago: 'contado',
        forma_pago: 'efectivo',
        cuenta_destino_id: '',
        cuenta_destino_nombre: '',
        documento_origen_id: '',
        documento_origen_numero: '',
        motivo_nota: '',
        afecta_inventario_nota: true,
        afecta_contabilidad_nota: true,
        afecta_impuestos_nota: true,
        afecta_cartera_nota: true,
        usuario_responsable: '',
        observaciones: "",
        soportes: [],
        items: [],
        tipo_compra: tipoDocumento === 'compra' ? (tipoItem || 'insumos') : undefined,
        tipo_venta: tipoDocumento === 'venta' ? tipoItem : undefined,
        codigo_lote_piel: '',
        codigo_lote_inventario: '',
        afecta_inventario: true,
        valor_total_compra: 0,
        valor_total_venta: 0,
        valor_pagado: 0,
        saldo_pendiente: 0,
        empresa: 'ARTECUEROS',
        estado_documento: 'pendiente',
      };

    if (documento) {
      const terceroIdField = tipoDocumento === 'compra' ? 'proveedor_id' : 'cliente_id';
      const isCustom = !terceros.some(t => t.id === documento[terceroIdField]);
      if (isCustom) {
        setTerceroPersonalizado(true);
      }
      
      const newItemsPersonalizados = {};
      const newItems = (documento.items || []).map((item, index) => {
        const itemIdField = tipoItem === 'producto' ? 'producto_id' : (tipoItem === 'servicio' ? 'servicio_id' : 'insumo_id');
        const isItemCustom = !itemsCatalogo.some(i => i.id === item[itemIdField]);
        if (isItemCustom && item[itemIdField]) {
          newItemsPersonalizados[index] = true;
          return { ...item, item_personalizado: item[itemIdField], [itemIdField]: '' };
        }
        return item;
      });

      setItemsPersonalizados(newItemsPersonalizados);
      setFormData({ 
          ...initialFormState, 
          ...documento, 
          tercero_personalizado: isCustom ? documento[terceroIdField] : '',
          [terceroIdField]: isCustom ? '' : documento[terceroIdField],
          items: newItems.map(it => ({
              ...it,
              cantidad: it.cantidad || '',
              precio_unitario: it.precio_unitario || ''
          }))
      });
    } else {
      setFormData(initialFormState);
      setTerceroPersonalizado(false);
      setItemsPersonalizados({});
    }
  }, [documento, open, itemsCatalogo, terceros, tipoDocumento, tipoItem]);

  const handleInputChange = async (field, value) => {
      // NO MOSTRAR POPUP PARA CH - eliminado completamente
      
      if (field === 'condicion_pago') {
          if (value === 'credito') {
              // Cuando es crédito, valor_pagado muestra el total como "Valor Crédito"
              const totalActual = tipoDocumento === 'venta' ? formData.valor_total_venta : formData.valor_total_compra;
              setFormData(prev => ({ ...prev, condicion_pago: value, valor_pagado: totalActual, saldo_pendiente: totalActual }));
              return;
          } else if (value === 'mixto') {
              // En mixto, saldo_pendiente = total - valor_pagado
              setFormData(prev => ({ ...prev, condicion_pago: value }));
              return;
          }
      }
      
      if (field === 'proveedor_id') {
          const selectedTercero = terceros.find(t => t.id === value);
          console.log('[DocumentoComercialForm] Proveedor seleccionado:', { id: value, tercero: selectedTercero });
          setFormData(prev => ({
              ...prev,
              proveedor_id: value,
              codigo_proveedor: selectedTercero ? (selectedTercero.codigo || '') : '',
              cc_nit_proveedor: selectedTercero ? (selectedTercero.numero_identificacion || selectedTercero.nit || '') : ''
          }));
      } else if (field === 'cliente_id') {
          const selectedTercero = terceros.find(t => t.id === value);
          setFormData(prev => ({
              ...prev,
              cliente_id: value,
              codigo_cliente: selectedTercero ? selectedTercero.codigo : '',
              cc_nit_cliente: selectedTercero ? (selectedTercero.numero_identificacion || selectedTercero.nit) : '',
              direccion_cliente: selectedTercero ? selectedTercero.direccion : '',
              telefono_cliente: selectedTercero ? selectedTercero.telefono : ''
          }));
      } else {
          setFormData(prev => ({ ...prev, [field]: value }));
      }
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    const itemIdField = tipoItem === 'producto' ? 'producto_id' : (tipoItem === 'servicio' ? 'servicio_id' : 'insumo_id');

    // Manejo especial para cambio de código manual (input con datalist)
    if (field === 'codigo') {
         const catalogItem = productosCatalogo.find(p => p.codigo === value);
         if (catalogItem) {
             // NO guardar el ID del catálogo en itemIdField — dejarlo vacío/nulo
             // La sincronización de inventario usa item.codigo, no item[itemIdField]
             newItems[index][itemIdField] = '';
             newItems[index].descripcion = catalogItem.descripcion;
             newItems[index].categoria = catalogItem.categoria;
             newItems[index].precio_unitario = tipoDocumento === 'compra' ? (catalogItem.costo_estandar || 0) : 0;
             newItems[index].unidad_medida = catalogItem.unidad_medida || '';
         } else {
             if (value && value.trim().length > 0) {
                 // Solo mostrar mensaje si el código no está siendo escrito aún (el usuario terminó de escribir)
                 // Se valida al perder el foco - aquí solo limpiamos campos si el código no corresponde
                 newItems[index].descripcion = '';
                 newItems[index].categoria = '';
                 newItems[index].unidad_medida = '';
             }
         }
    }

    if (field === itemIdField) {
      if (value === 'personalizado') {
        setItemsPersonalizados(prev => ({ ...prev, [index]: true }));
        newItems[index].item_personalizado = '';
        newItems[index].descripcion = '';
        newItems[index].precio_unitario = '';
        newItems[index].unidad_medida = '';
      } else {
        setItemsPersonalizados(prev => ({ ...prev, [index]: false }));
        // Intentar buscar primero en catalog si itemsCatalogo falla (backup)
        const selected = itemsCatalogo.find(i => i.id === value) || productosCatalogo.find(p => p.id === value);
        if(selected){
            newItems[index].codigo = selected.codigo; // Sincronizar código
            newItems[index].descripcion = selected.nombre || selected.descripcion;
            newItems[index].categoria = selected.categoria || ''; // Auto-fill category if available in object
            newItems[index].precio_unitario = selected.precio_venta_1 || selected.precio_venta || selected.precio_promedio || selected.precio_base || (tipoDocumento === 'compra' ? selected.costo_estandar : 0) || '';
            newItems[index].unidad_medida = selected.unidad_medida || '';
        }
      }
    }

    const cantidad = parseFloat(newItems[index].cantidad) || 0;
    const precio = parseFloat(newItems[index].precio_unitario) || 0;
    newItems[index].subtotal = cantidad * precio;
    
    setFormData(prev => ({ ...prev, items: newItems }));
  };

  const addItem = () => {
    const itemIdField = tipoItem === 'producto' ? 'producto_id' : (tipoItem === 'servicio' ? 'servicio_id' : 'insumo_id');
    const newItem = {
      [itemIdField]: "",
      item_personalizado: "",
      descripcion: "",
      categoria: "", // New field
      unidad_medida: "",
      cantidad: "",
      precio_unitario: "",
      subtotal: 0,
      iva: 0.19,
      retefuente: 0
    };
    setFormData(prev => ({ ...prev, items: [...prev.items, newItem] }));
  };
  
  const removeItem = (index) => setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const calculateTotals = useCallback(() => {
    if (!formData?.items) return { totalBruto: 0, subtotalConIva: 0, ivaTotal: 0, retefuenteTotal: 0, totalNeto: 0 };
    
    let totalBruto = 0, ivaTotal = 0, retefuenteTotal = 0;
    
    formData.items.forEach(item => {
      const itemSubtotal = parseFloat(item.subtotal) || 0;
      const itemIvaRate = parseFloat(item.iva) || 0;
      const itemReteRate = parseFloat(item.retefuente) || 0;
      
      totalBruto += itemSubtotal;
      ivaTotal += itemSubtotal * itemIvaRate;
      retefuenteTotal += itemSubtotal * itemReteRate;
    });

    const subtotalConIva = totalBruto + ivaTotal;
    const totalNeto = subtotalConIva - retefuenteTotal;

    return { totalBruto, subtotalConIva, ivaTotal, retefuenteTotal, totalNeto };
  }, [formData]);

  // Recalcular créditos y saldos cuando cambie condicion de pago o el total
  useEffect(() => {
    if (formData) {
        const { totalNeto } = calculateTotals();
        
        if (formData.condicion_pago === 'contado') {
            // Contado: todo se paga
            setFormData(prev => ({
                ...prev,
                valor_total_compra: totalNeto,
                valor_total_venta: totalNeto,
                valor_pagado: totalNeto,
                saldo_pendiente: 0
            }));
        } else if (formData.condicion_pago === 'credito') {
            // Crédito: valor_pagado muestra el total como "Valor Crédito" y saldo_pendiente = total
            setFormData(prev => ({
                ...prev,
                valor_total_compra: totalNeto,
                valor_total_venta: totalNeto,
                valor_pagado: totalNeto,
                saldo_pendiente: totalNeto
            }));
        } else if (formData.condicion_pago === 'mixto') {
            // Mixto: saldo_pendiente = total - valor_pagado
            const pagado = parseFloat(formData.valor_pagado) || 0;
            const saldo = totalNeto - pagado;
            setFormData(prev => ({
                ...prev,
                valor_total_compra: totalNeto,
                valor_total_venta: totalNeto,
                saldo_pendiente: saldo > 0 ? saldo : 0
            }));
        }
    }
  }, [formData?.condicion_pago, formData?.items, formData?.valor_pagado]);

  const setVencimiento = (dias) => {
    if (!formData.fecha_orden) return;
    const fecha = new Date(formData.fecha_orden + "T00:00:00");
    if (!isNaN(dias)) {
        fecha.setDate(fecha.getDate() + dias);
        handleInputChange('fecha_vencimiento', fecha.toISOString().split('T')[0]);
    }
  };
  
  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setIsUploading(true);
    try {
        const { file_url } = await UploadFile({ file });
        setFormData(prev => ({ ...prev, soportes: [...(prev.soportes || []), file_url] }));
    } catch (error) {
        console.error("Error uploading file:", error);
        alert("Error al cargar el archivo.");
    } finally {
        setIsUploading(false);
    }
  };

  const removeSoporte = (urlToRemove) => {
      setFormData(prev => ({ ...prev, soportes: prev.soportes.filter(url => url !== urlToRemove) }));
  };

  const handleFinalSubmit = async (e) => {
    e.preventDefault();
    
    // ── DEBUG ────────────────────────────────────────────────────────────────
    const hoy = getTodayColombia();
    console.log('🟡 [SUBMIT] handleFinalSubmit ejecutado');
    console.log('🟡 [SUBMIT] Fecha Colombia (hoy):', hoy);
    console.log('🟡 [SUBMIT] fecha_emision_documento en formData:', formData.fecha_emision_documento);
    console.log('🟡 [SUBMIT] fecha_orden en formData:', formData.fecha_orden);
    console.log('🟡 [SUBMIT] fecha_vencimiento en formData:', formData.fecha_vencimiento);
    console.log('🟡 [SUBMIT] condicion_pago:', formData.condicion_pago);
    console.log('🟡 [SUBMIT] forma_pago:', formData.forma_pago);
    console.log('🟡 [SUBMIT] cuenta_destino_id:', formData.cuenta_destino_id);
    console.log('🟡 [SUBMIT] totalNeto calculado:', calculateTotals().totalNeto);
    // ────────────────────────────────────────────────────────────────────────

    const totals = calculateTotals();
    const terceroIdField = tipoDocumento === 'compra' ? 'proveedor_id' : 'cliente_id';
    const itemIdField = tipoItem === 'producto' ? 'producto_id' : (tipoItem === 'servicio' ? 'servicio_id' : 'insumo_id');

    const finalData = {
      ...formData,
      fecha_emision_documento: formData.fecha_emision_documento || formData.fecha_orden || getTodayColombia(),
      fecha_orden: formData.fecha_emision_documento || formData.fecha_orden || getTodayColombia(),
      [terceroIdField]: terceroPersonalizado ? formData.tercero_personalizado : formData[terceroIdField],
      items: formData.items.map((item, index) => {
        const cleanItem = { ...item };
        if (itemsPersonalizados[index]) {
          cleanItem[itemIdField] = item.item_personalizado;
        }
        delete cleanItem.item_personalizado;
        // Asegurarse que los valores numéricos se guardan como números
        cleanItem.cantidad = parseFloat(cleanItem.cantidad) || 0;
        cleanItem.precio_unitario = parseFloat(cleanItem.precio_unitario) || 0;
        return cleanItem;
      }),
      subtotal: totals.totalBruto,
      iva_total: totals.ivaTotal,
      retefuente_total: totals.retefuenteTotal,
      total: totals.totalNeto,
    };

    // El número (PREFIJO-AAAA-NNNN) y el código de lote los asigna el servidor al guardar.

    // Validación eliminada - permitir cualquier fecha

    // ─── VALIDACIONES PARA VENTAS ───────────────────────────────────────────
    if (tipoDocumento === 'venta' && !documento) {
        const totalNeto = totals.totalNeto;

        if (totalNeto <= 0) {
            alert('⚠️ El Total Neto debe ser mayor a cero para guardar la venta.');
            return;
        }

        if (finalData.condicion_pago === 'contado') {
            if (!finalData.cuenta_destino_id) {
                alert('⚠️ Seleccione la caja, cuenta bancaria u otro medio por donde se hace el pago.');
                return;
            }
        }

        if (finalData.condicion_pago === 'credito') {
            if (!finalData.fecha_vencimiento) {
                alert('⚠️ CRÉDITO requiere una Fecha de Vencimiento obligatoria.');
                return;
            }
            finalData.valor_pagado = 0;
            finalData.saldo_pendiente = totalNeto;
        }

        if (finalData.condicion_pago === 'mixto') {
            const pagado = parseFloat(finalData.valor_pagado) || 0;
            if (pagado <= 0) {
                alert('⚠️ MIXTO requiere un Valor Pagado mayor a cero.');
                return;
            }
            if (pagado > totalNeto) {
                alert('⚠️ El Valor Pagado no puede ser mayor al Total Neto.');
                return;
            }
            if (!finalData.cuenta_destino_id) {
                alert('⚠️ Seleccione la caja, cuenta bancaria u otro medio por donde se hace el pago.');
                return;
            }
            finalData.saldo_pendiente = totalNeto - pagado;
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    // ─── VALIDACIONES PARA COMPRAS ───────────────────────────────────────────
    if (tipoDocumento === 'compra' && !documento) {
        const totalNeto = totals.totalNeto;

        if (totalNeto <= 0) {
            alert('⚠️ El Total Neto debe ser mayor a cero para guardar la compra.');
            return;
        }

        if (finalData.condicion_pago === 'contado' || finalData.condicion_pago === 'mixto') {
            if (!finalData.cuenta_destino_id) {
                alert('⚠️ Seleccione la caja, cuenta bancaria u otro medio por donde se hace el pago.');
                return;
            }
        }

        if (finalData.condicion_pago === 'credito' || finalData.condicion_pago === 'mixto') {
            if (!finalData.fecha_vencimiento) {
                alert('⚠️ CRÉDITO / MIXTO requiere una Fecha de Vencimiento obligatoria.');
                return;
            }
        }

        if (finalData.condicion_pago === 'mixto') {
            const pagado = parseFloat(finalData.valor_pagado) || 0;
            if (pagado <= 0) {
                alert('⚠️ MIXTO requiere un Valor Pagado mayor a cero.');
                return;
            }
            if (pagado >= totalNeto) {
                alert('⚠️ El Valor Pagado no puede ser mayor o igual al Total Neto en modo Mixto.');
                return;
            }
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    // ── Guardar en el servidor: documento + inventario + finanzas en UNA transacción ──
    // (antes el navegador cerraba la ventana y seguía guardando por partes en segundo plano)
    if (guardando) return;
    setGuardando(true);
    try {
      const res = documento
        ? await fin.put(`/comercial/${tipoDocumento}/${documento.id}`, { documento: finalData })
        : await fin.post(`/comercial/${tipoDocumento}`, {
            idempotency_key: llaveRef.current,
            documento: finalData,
            cuenta_id: finalData.cuenta_destino_id || undefined,
          });
      const docs = (res.documentos || []).map(d => d.numero).join(', ');
      onOpenChange(false);
      if (onSuccess) onSuccess({
        message: "Documento guardado",
        description: `${res.numero_id || ''} registrado correctamente${docs ? ` · ${docs}` : ''}.`,
      });
      if (res.advertencias?.length) alert('Guardado con advertencias:\n\n• ' + res.advertencias.join('\n• '));
    } catch (error) {
      console.error('Error al guardar:', error);
      alert('No se guardó el documento:\n\n' + error.message);
    } finally {
      setGuardando(false);
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
    }
  };
  
  if (!formData) return null;

  const totals = calculateTotals();
  const terceroIdField = tipoDocumento === 'compra' ? 'proveedor_id' : 'cliente_id';
  const nitField = tipoDocumento === 'compra' ? 'cc_nit_proveedor' : 'cc_nit_cliente';
  const itemIdField = tipoItem === 'producto' ? 'producto_id' : (tipoItem === 'servicio' ? 'servicio_id' : 'insumo_id');

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh]">
        <DialogHeader>
          <DialogTitle>{documento ? "Editar" : "Nuevo"} {documentoTitulo}</DialogTitle>
          <DialogDescription>
            Complete la información para registrar el documento.
          </DialogDescription>
          {documento && (
            <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              {documento.anulado || documento.estado_documento === 'anulado'
                ? 'Este documento está ANULADO: no se puede modificar.'
                : 'Documento ya registrado: solo se pueden modificar observaciones, soportes y datos de referencia. Para cambiar productos, cantidades, precios, pago, tercero o fechas, anúlelo y regístrelo de nuevo (o use una devolución).'}
            </div>
          )}
        </DialogHeader>
        <form onSubmit={handleFinalSubmit} onKeyDown={handleKeyDown} className="flex flex-col h-full overflow-hidden">
          <div className="overflow-y-auto pr-6 space-y-4 flex-grow">
            {/* Encabezado */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div>
                  <Label>No. ID {tipoDocumento === 'venta' ? '(Autogenerado)' : ''}</Label>
                  <Input 
                    value={formData.numero_id || 'Auto-generado'} 
                    readOnly 
                    className="bg-gray-100 font-semibold text-emerald-700"
                    title="ID único autogenerado basado en PREFIJO"
                  />
                </div>
                
                <div>
                  <Label>Prefijo *</Label>
                  {tipoDocumento === 'compra' ? (
                    <Select value={formData.prefijo} onValueChange={v => handleInputChange('prefijo', v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CH">CH - Compra Hojas/Materia Prima</SelectItem>
                        <SelectItem value="CI">CI - Compra Insumos y Químicos</SelectItem>
                        <SelectItem value="CSP">CSP - Compra de Servicios de Producción</SelectItem>
                        <SelectItem value="CGG">CGG - Compra de Gastos Generales</SelectItem>
                        <SelectItem value="CV">CV - Compras Varias</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={formData.prefijo} onValueChange={v => handleInputChange('prefijo', v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FV">FV - Factura de Venta</SelectItem>
                        <SelectItem value="CC">CC - Cuenta de Cobro</SelectItem>
                        <SelectItem value="REM">REM - Remisión</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
                
                {tipoDocumento === 'compra' && (
                  <div>
                    <Label>Tipo Item *</Label>
                    <Select value={formData.tipo_item} onValueChange={v => handleInputChange('tipo_item', v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="materia_prima">Materia Prima</SelectItem>
                        <SelectItem value="insumo_quimico">Insumo Químico</SelectItem>
                        <SelectItem value="servicio">Servicio</SelectItem>
                        <SelectItem value="activo_fijo">Activo Fijo</SelectItem>
                        <SelectItem value="gastos_administrativos">Gastos Administrativos</SelectItem>
                        <SelectItem value="material_en_proceso">Material en Proceso</SelectItem>
                        <SelectItem value="servicios_publicos">Servicios Públicos</SelectItem>
                        <SelectItem value="otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {tipoDocumento === 'compra' && (
                  <div>
                    <Label>Tipo Documento Proveedor *</Label>
                    <Select value={formData.tipo_documento_proveedor} onValueChange={v => handleInputChange('tipo_documento_proveedor', v)}>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CC">CC - Cuenta de Cobro</SelectItem>
                        <SelectItem value="SD">SD - Compra sin Documento</SelectItem>
                        <SelectItem value="FE">FE - Factura Electrónica</SelectItem>
                        <SelectItem value="NC">NC - Nota Crédito Proveedor</SelectItem>
                        <SelectItem value="ND">ND - Nota Débito Proveedor</SelectItem>
                        <SelectItem value="REM">REM - Remisión del Proveedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {tipoDocumento === 'compra' && <div><Label>No. Documento Proveedor</Label><Input value={formData.numero_documento} onChange={e => handleInputChange('numero_documento', e.target.value)} placeholder="Número del proveedor" /></div>}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tipoDocumento === 'compra' && (
                  <div className="space-y-2">
                    <div>
                      <Label>Código del Proveedor *</Label>
                      {terceros.length === 0 ? (
                        <div className="p-3 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800 font-medium">
                          ⚠️ No hay proveedores disponibles. Debe registrar un tercero como proveedor en Administración &gt; Terceros.
                        </div>
                      ) : (
                        <div className="relative" ref={proveedorDropdownRef}>
                          <Input
                            placeholder="Buscar por código o nombre del proveedor..."
                            value={proveedorSearch !== '' ? proveedorSearch : (formData.proveedor_id && terceros.find(t => t.id === formData.proveedor_id)
                              ? (() => { const t = terceros.find(x => x.id === formData.proveedor_id); return `${t.codigo || 'S/C'} – ${t.nombre}`; })()
                              : '')}
                            onChange={e => { setProveedorSearch(e.target.value); setShowProveedorDropdown(true); }}
                            onFocus={() => setShowProveedorDropdown(true)}
                            onBlur={() => setTimeout(() => setShowProveedorDropdown(false), 200)}
                            className="h-9 text-sm"
                          />
                          {showProveedorDropdown && (
                            <div className="absolute z-50 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-lg max-h-52 overflow-y-auto mt-1">
                              {terceros
                                .filter(t => {
                                  const term = normalize(proveedorSearch);
                                  if (!term) return true;
                                  return normalize(t.codigo).includes(term) || normalize(t.nombre).includes(term);
                                })
                                .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''))
                                .map(t => (
                                  <div key={t.id}
                                    className="px-3 py-2 text-sm cursor-pointer hover:bg-emerald-50 border-b last:border-0"
                                    onMouseDown={() => {
                                      handleInputChange('proveedor_id', t.id);
                                      setProveedorSearch('');
                                      setShowProveedorDropdown(false);
                                    }}
                                  >
                                    <span className="font-mono font-bold text-emerald-700">{t.codigo || 'S/C'}</span>
                                    <span className="text-gray-600"> – {t.nombre}</span>
                                    {(t.numero_identificacion || t.nit) && (
                                      <span className="text-gray-400 text-xs ml-1">({t.numero_identificacion || t.nit})</span>
                                    )}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Nombre del Proveedor</Label>
                      <Input
                        readOnly
                        value={formData.proveedor_id && terceros.find(t => t.id === formData.proveedor_id)
                          ? terceros.find(t => t.id === formData.proveedor_id).nombre
                          : ''}
                        className="bg-gray-100 text-gray-700 cursor-not-allowed text-sm"
                        placeholder="Se completa automáticamente al seleccionar el proveedor"
                      />
                    </div>
                  </div>
                )}
                {tipoDocumento === 'venta' && (
                  <div className="md:col-span-3">
                    <Label>Cliente *</Label>
                    {terceros.length === 0 ? (
                      <div className="p-3 bg-yellow-50 border border-yellow-300 rounded text-xs text-yellow-800 font-medium">
                        ⚠️ No hay clientes disponibles. Debe registrar un tercero como cliente en Administración &gt; Terceros.
                      </div>
                    ) : (
                      <Select value={formData.cliente_id || ''} onValueChange={v => handleInputChange('cliente_id', v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar cliente...">
                            {formData.cliente_id && terceros.find(t => t.id === formData.cliente_id)
                              ? (() => { const t = terceros.find(x => x.id === formData.cliente_id); return `${t.codigo || 'S/C'} — ${t.nombre}`; })()
                              : 'Seleccionar cliente...'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {terceros.sort((a,b) => (a.codigo||'').localeCompare(b.codigo||'')).map(t => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="font-mono font-bold text-blue-700">{t.codigo || 'S/C'}</span>
                              {' — '}
                              <span>{t.nombre}</span>
                              {(t.numero_identificacion) && (
                                <span className="text-gray-500 ml-1">({t.numero_identificacion})</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {formData.cliente_id && terceros.find(t => t.id === formData.cliente_id) && (() => {
                      const t = terceros.find(x => x.id === formData.cliente_id);
                      return (
                        <div className="mt-1 text-xs space-y-0.5">
                          <p className="text-blue-600 font-medium">✔ Código: <span className="font-mono">{t.codigo || 'Sin código'}</span></p>
                          <p className="text-gray-500">ID: {t.numero_identificacion || 'N/A'}</p>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {/* Campo cliente personalizado solo para compras - eliminado duplicado, ahora se maneja arriba */}
                <div><Label>CC/NIT</Label><Input value={formData[nitField]} onChange={e => handleInputChange(nitField, e.target.value)} /></div>
                {tipoDocumento === 'venta' && (
                  <div>
                    <Label>Tipo de Documento *</Label>
                    <Select value={formData.tipo_documento_venta || 'FE'} onValueChange={v => handleInputChange('tipo_documento_venta', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FE">FE - Factura Electrónica</SelectItem>
                        <SelectItem value="CC">CC - Cuenta de Cobro</SelectItem>
                        <SelectItem value="VSD">VSD - Venta Sin Documento</SelectItem>
                        <SelectItem value="NC">NC - Nota Crédito</SelectItem>
                        <SelectItem value="ND">ND - Nota Débito</SelectItem>
                        <SelectItem value="REM">REM - Remisión</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {tipoDocumento === 'venta' && (
                  <div>
                    <Label>No. de Documento</Label>
                    <Input value={formData.numero_documento} onChange={e => handleInputChange('numero_documento', e.target.value)} placeholder="Número de documento" />
                  </div>
                )}
                {tipoDocumento === 'compra' && tipoItem === 'pieles' && (
                  <div><Label>Código Lote de Piel</Label><Input value={formData.codigo_lote_piel || ''} onChange={e => handleInputChange('codigo_lote_piel', e.target.value)} placeholder="Ej: LOTE-001" /></div>
                )}
            </div>
            
            {/* Campos para Notas Crédito/Débito */}
            {(formData.tipo_documento === 'nota_credito_proveedor' || formData.tipo_documento === 'nota_credito_cliente' || formData.tipo_documento === 'nota_debito_cliente') && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div>
                        <Label className="font-bold">Documento Origen *</Label>
                        <Input 
                            value={formData.documento_origen_numero || ''} 
                                            onChange={e => handleInputChange('documento_origen_numero', e.target.value)} 
                                            placeholder="Ej: FV-001"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Label className="font-bold">Motivo *</Label>
                        <Input 
                            value={formData.motivo_nota || ''} 
                                            onChange={e => handleInputChange('motivo_nota', e.target.value)} 
                                            placeholder="Describe el motivo de la nota"
                        />
                    </div>
                    <div>
                        <Label className="font-bold">¿Afecta Inventario?</Label>
                        <Select value={formData.afecta_inventario_nota ? 'si' : 'no'} onValueChange={v => handleInputChange('afecta_inventario_nota', v === 'si')}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="si">SÍ</SelectItem>
                                <SelectItem value="no">NO</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    {formData.tipo_documento === 'nota_credito_proveedor' && (
                        <div>
                            <Label className="font-bold">¿Afecta Contabilidad?</Label>
                            <Select value={formData.afecta_contabilidad_nota ? 'si' : 'no'} onValueChange={v => handleInputChange('afecta_contabilidad_nota', v === 'si')}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="si">SÍ</SelectItem>
                                    <SelectItem value="no">NO</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    {formData.tipo_documento === 'nota_debito_cliente' && (
                        <>
                            <div>
                                <Label className="font-bold">¿Afecta Impuestos?</Label>
                                <Select value={formData.afecta_impuestos_nota ? 'si' : 'no'} onValueChange={v => handleInputChange('afecta_impuestos_nota', v === 'si')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="si">SÍ</SelectItem>
                                        <SelectItem value="no">NO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="font-bold">¿Afecta Cartera?</Label>
                                <Select value={formData.afecta_cartera_nota ? 'si' : 'no'} onValueChange={v => handleInputChange('afecta_cartera_nota', v === 'si')}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="si">SÍ</SelectItem>
                                        <SelectItem value="no">NO</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </>
                    )}
                    {(formData.tipo_documento === 'nota_credito_cliente' || formData.tipo_documento === 'nota_debito_cliente') && (
                        <div>
                            <Label className="font-bold">Usuario Responsable</Label>
                            <Input 
                                value={formData.usuario_responsable || ''} 
                                onChange={e => handleInputChange('usuario_responsable', e.target.value)} 
                                placeholder="Nombre del responsable"
                            />
                        </div>
                    )}
                </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <Label>Fecha Emisión Documento *</Label>
                  <Input
                    type="date"
                    value={formData.fecha_emision_documento || formData.fecha_orden}
                    onChange={e => handleInputChange('fecha_emision_documento', e.target.value)}
                  />
                </div>
                {tipoDocumento === 'compra' && (
                  <div>
                    <Label>Fecha de Recepción Conforme</Label>
                    <Input
                      type="date"
                      value={formData.fecha_recepcion_conforme || ''}
                      onChange={e => handleInputChange('fecha_recepcion_conforme', e.target.value)}
                    />
                  </div>
                )}

                <div>
                  <Label>Fecha Vencimiento</Label>
                  <Input
                    type="date"
                    value={formData.fecha_vencimiento}
                    onChange={e => handleInputChange('fecha_vencimiento', e.target.value)}
                  />
                </div>
                
                {tipoDocumento === 'venta' && (
                  <>
                    <div><Label>Dirección</Label><Input value={formData.direccion_cliente} onChange={e => handleInputChange('direccion_cliente', e.target.value)} /></div>
                    <div><Label>Teléfono</Label><Input value={formData.telefono_cliente} onChange={e => handleInputChange('telefono_cliente', e.target.value)} /></div>
                  </>
                )}
            </div>

            {/* Ítems */}
            <div>
                <Label className="text-base font-semibold">Ítems</Label>
                <div className="border rounded-lg overflow-x-auto mt-2">
                    <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-2 text-left font-semibold">Código del Pcto.</th>
                                <th className="p-2 text-left font-semibold">Nombre del Pcto.</th>
                                <th className="p-2 text-left font-semibold">Categoría</th>
                                {tipoDocumento === 'compra' && <th className="p-2 text-left font-semibold">U. Medida</th>}
                                <th className="p-2 text-left font-semibold">Cant.</th>
                                <th className="p-2 text-left font-semibold">Precio Unit.</th>
                                <th className="p-2 text-left font-semibold">Subtotal</th>
                                <th className="p-2 text-left font-semibold">IVA</th>
                                <th className="p-2 text-left font-semibold">Retefuente</th>
                                <th className="p-2 text-left font-semibold"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {formData.items.map((item, index) => (
                                <tr key={index} className="border-t">
                                    <td className="p-1 min-w-[200px]">
                                        <ProductSelectorCell
                                            item={item}
                                            productosCatalogo={productosCatalogo}
                                            normalize={normalize}
                                            onSelect={(codigo) => handleItemChange(index, 'codigo', codigo)}
                                        />
                                    </td>
                                    <td className="p-1 min-w-[180px]"><Input value={item.descripcion} onChange={e => handleItemChange(index, 'descripcion', e.target.value)} placeholder="Descripción" className="h-8 text-xs"/></td>
                                    <td className="p-1 min-w-[120px]"><Input value={item.categoria} onChange={e => handleItemChange(index, 'categoria', e.target.value)} placeholder="Cat." className="h-8 text-xs" readOnly title="Auto-fill"/></td>
                                    {tipoDocumento === 'compra' && <td className="p-1 min-w-[100px]"><Input value={item.unidad_medida} onChange={e => handleItemChange(index, 'unidad_medida', e.target.value)} placeholder="U.M." className="h-8 text-xs"/></td>}
                                    <td className="p-1 w-24"><NumericInput value={item.cantidad || 0} onChange={v => handleItemChange(index, 'cantidad', v)} className="text-right"/></td>
                                    <td className="p-1 w-32"><NumericInput value={item.precio_unitario || 0} onChange={v => handleItemChange(index, 'precio_unitario', v)} className="text-right"/></td>
                                    <td className="p-1 w-32 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                                    <td className="p-1 w-28"><Select value={String(item.iva)} onValueChange={v => handleItemChange(index, 'iva', parseFloat(v))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="0.19">19%</SelectItem><SelectItem value="0.05">5%</SelectItem><SelectItem value="0">0% (Excl/Exen)</SelectItem></SelectContent></Select></td>
                                    <td className="p-1 w-28"><Select value={String(item.retefuente)} onValueChange={v => handleItemChange(index, 'retefuente', parseFloat(v))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="0.01">1%</SelectItem><SelectItem value="0.025">2.5%</SelectItem><SelectItem value="0.04">4%</SelectItem><SelectItem value="0.06">6%</SelectItem><SelectItem value="0.11">11%</SelectItem><SelectItem value="0">No aplica</SelectItem></SelectContent></Select></td>
                                    <td className="p-1"><Button type="button" size="icon" variant="ghost" onClick={() => removeItem(index)}><X className="w-4 h-4 text-red-500"/></Button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <Button type="button" onClick={addItem} variant="outline" size="sm" className="mt-2"><Plus className="w-4 h-4 mr-2" />Agregar Ítem</Button>
            </div>

            {/* Afecta Inventario para Compras */}
            {tipoDocumento === 'compra' && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                        <Label>¿Afecta Inventario?</Label>
                        <Select value={formData.afecta_inventario ? 'si' : 'no'} onValueChange={v => handleInputChange('afecta_inventario', v === 'si')}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="si">SÍ</SelectItem>
                                <SelectItem value="no">NO</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label>Estado de Cuero</Label>
                        <Select value={formData.estado_cuero || 'CRU'} onValueChange={v => handleInputChange('estado_cuero', v)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CRU">CRU - Crudo</SelectItem>
                                <SelectItem value="SAL">SAL - Salado</SelectItem>
                                <SelectItem value="SEM">SEM - Semi Terminado</SelectItem>
                                <SelectItem value="TERM">TERM - Terminado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            )}

            {/* Información de Pago */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
                <div className="md:col-span-2 space-y-4">
                     <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                         <h3 className="font-semibold text-lg">Información de Pago</h3>
                         
                         <div className="grid grid-cols-2 gap-4">
                             <div>
                                <Label className="font-bold">Condición de Pago *</Label>
                                <Select value={formData.condicion_pago} onValueChange={v => handleInputChange('condicion_pago', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="contado">Contado (se paga completo)</SelectItem>
                                        <SelectItem value="credito">Crédito (saldo pendiente)</SelectItem>
                                        <SelectItem value="mixto">Mixto (pago parcial)</SelectItem>
                                    </SelectContent>
                                </Select>
                             </div>

                             {(formData.condicion_pago === 'contado' || formData.condicion_pago === 'mixto') && (
                                 <div>
                                    <Label className="font-bold">Forma de Pago *</Label>
                                    <Select value={formData.forma_pago} onValueChange={v => { handleInputChange('forma_pago', v); handleInputChange('cuenta_destino_id', ''); handleInputChange('cuenta_destino_nombre', ''); }}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="efectivo">EFECTIVO</SelectItem>
                                            <SelectItem value="banco">BANCO</SelectItem>
                                            <SelectItem value="otro_medio">OTRO MEDIO (Nequi…)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                 </div>
                             )}
                         </div>

                         {/* Campos condicionales según forma de pago */}
                         {(formData.condicion_pago === 'contado' || formData.condicion_pago === 'mixto') && (() => {
                             // Cuentas del módulo financiero (cajas, bancos y otros medios como Nequi).
                             const tipoCuenta = TIPO_CUENTA_POR_FORMA_PAGO[formData.forma_pago] || 'caja';
                             const opciones = cuentasDinero.filter(c => c.tipo === tipoCuenta);
                             const etiqueta = { caja: 'Caja', banco: 'Cuenta bancaria', otro_medio: 'Medio de pago (Nequi u otro)' }[tipoCuenta];
                             return (
                                 <div>
                                     <Label className="font-bold">{etiqueta} *</Label>
                                     <Select value={formData.cuenta_destino_id} onValueChange={v => {
                                         const cuenta = opciones.find(c => c.id === v);
                                         handleInputChange('cuenta_destino_id', v);
                                         handleInputChange('cuenta_destino_nombre', cuenta ? cuenta.nombre : '');
                                     }}>
                                         <SelectTrigger><SelectValue placeholder={`Seleccionar ${etiqueta.toLowerCase()}`} /></SelectTrigger>
                                         <SelectContent>
                                             {opciones.map(c => (
                                                 <SelectItem key={c.id} value={c.id}>{c.nombre}{c.numero ? ` · ${c.numero}` : ''}</SelectItem>
                                             ))}
                                             {opciones.length === 0 && <SelectItem value="__sin_cuentas__" disabled>No hay cuentas de este tipo configuradas en Finanzas</SelectItem>}
                                         </SelectContent>
                                     </Select>
                                 </div>
                             );
                         })()}

                         <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                             <div>
                                <Label className="font-bold text-emerald-700">Valor Total de {tipoDocumento === 'venta' ? 'Venta' : 'Compra'}</Label>
                                <Input 
                                    type="number" 
                                    value={tipoDocumento === 'venta' ? formData.valor_total_venta : formData.valor_total_compra} 
                                    readOnly 
                                    className="bg-gray-100 font-bold"
                                />
                             </div>
                             <div>
                                <Label className="font-bold text-blue-700">{formData.condicion_pago === 'credito' ? 'Valor Crédito' : 'Valor Pagado'}</Label>
                                <Input 
                                    type="number" 
                                    value={formData.valor_pagado} 
                                    onChange={e => handleInputChange('valor_pagado', parseFloat(e.target.value) || 0)}
                                    className="font-bold"
                                    readOnly={formData.condicion_pago === 'contado' || formData.condicion_pago === 'credito'}
                                />
                             </div>
                             <div>
                                <Label className="font-bold text-red-700">Saldo Pendiente</Label>
                                <Input 
                                    type="number" 
                                    value={formData.saldo_pendiente} 
                                    readOnly 
                                    className="bg-red-50 font-bold"
                                />
                             </div>
                         </div>
                     </div>

                     <div><Label>Observaciones</Label><Textarea value={formData.observaciones} onChange={e => handleInputChange('observaciones', e.target.value)} rows={4}/></div>
                     
                     {tipoDocumento === 'compra' && (
                       <div>
                         <Label className="font-bold">Estado del Documento</Label>
                         <div className="h-10 px-3 flex items-center rounded-md border bg-gray-100 text-sm font-semibold uppercase">
                           {documento ? (formData.estado_documento || 'pendiente') : 'Se calcula al guardar'}
                         </div>
                         <p className="text-xs text-gray-500 mt-1">Se calcula solo según los pagos (pendiente, parcial o pagado). Para anular use el botón Anular de la lista.</p>
                       </div>
                     )}
                    <div><Label>Soportes</Label>
                        <div className="border p-2 rounded-lg space-y-2">
                            <div className="flex flex-wrap gap-2">
                                {(formData.soportes || []).map(url => (
                                    <div key={url} className="bg-gray-100 p-1 rounded flex items-center gap-2 text-sm">
                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-xs">{url.split('/').pop()}</a>
                                        <Button type="button" size="xs" variant="ghost" onClick={() => removeSoporte(url)}><X className="w-3 h-3 text-red-500"/></Button>
                                    </div>
                                ))}
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden"/>
                            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current.click()} disabled={isUploading}>{isUploading ? "Cargando..." : <><Upload className="w-4 h-4 mr-2"/>Cargar Soporte</>}</Button>
                        </div>
                    </div>
                </div>
                <div className="col-span-1 space-y-2 p-4 bg-slate-50 rounded-lg h-fit">
                    <div className="flex justify-between font-medium"><span className="text-sm">Total Bruto:</span><span>{formatCurrency(totals.totalBruto)}</span></div>
                    <div className="flex justify-between text-sm"><span>IVA:</span><span>{formatCurrency(totals.ivaTotal)}</span></div>
                    <div className="flex justify-between font-medium border-t pt-2"><span className="text-sm">Subtotal:</span><span>{formatCurrency(totals.subtotalConIva)}</span></div>
                    <div className="flex justify-between text-sm text-red-600"><span>Retefuente:</span><span>-{formatCurrency(totals.retefuenteTotal)}</span></div>
                    <div className="flex justify-between border-t pt-2 mt-2 font-bold text-lg"><span>Total Neto:</span><span>{formatCurrency(totals.totalNeto)}</span></div>
                </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={guardando}><Save className="w-4 h-4 mr-2" />{guardando ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
      

      
      <ProductCreationModal 
          open={showProductModal} 
          onOpenChange={setShowProductModal}
          onSuccess={handleProductCreated}
          initialCode={newProductCode}
          initialDescription={newProductDesc}
      />
    </Dialog>

    </>
  );
}