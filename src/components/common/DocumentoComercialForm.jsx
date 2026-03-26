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
import NumericInput from './NumericInput';
import { ProductoCatalogo, OrdenCompra, MovimientoInventario, Insumo, ProductoTerminado, MovimientoLibroDiario, Caja, CuentaBancaria } from '@/entities/all';
import { useToast } from "@/components/ui/use-toast";

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function DocumentoComercialForm({ open, onOpenChange, onSubmit, documento, terceros, itemsCatalogo, tipoDocumento, tipoItem, terceroLabel, documentoTitulo }) {
  const { toast } = useToast();
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
  const [cajas, setCajas] = useState([]);
  const [cuentasBancarias, setCuentasBancarias] = useState([]);
  const [showLotePopup, setShowLotePopup] = useState(false);
  const [loteData, setLoteData] = useState({ codigo_lote: '', estado_cuero: 'CRU' });
  const [lotesDisponibles, setLotesDisponibles] = useState([]);

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
          const [cajasData, bancosData, comprasData] = await Promise.all([
              Caja.filter({ estado: 'activa' }),
              CuentaBancaria.list(),
              OrdenCompra.list()
          ]);
          setCajas(cajasData);
          setCuentasBancarias(bancosData);
          
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
          newItems[pendingItemIndex].producto_id = newProduct.id; // Si se usa ID
          newItems[pendingItemIndex].codigo = newProduct.codigo;
          newItems[pendingItemIndex].descripcion = newProduct.descripcion;
          newItems[pendingItemIndex].precio_unitario = newProduct.costo_estandar || 0;
          setFormData({ ...formData, items: newItems });
          setPendingItemIndex(null);
      }
  };

  useEffect(() => {
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
        fecha_orden: new Date().toISOString().split('T')[0],
        fecha_vencimiento: new Date().toISOString().split('T')[0],
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
          setFormData(prev => ({
              ...prev,
              proveedor_id: value,
              codigo_proveedor: selectedTercero ? selectedTercero.codigo : '',
              cc_nit_proveedor: selectedTercero ? (selectedTercero.numero_identificacion || selectedTercero.nit) : ''
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
         // Buscar en catálogo por código
         const catalogItem = productosCatalogo.find(p => p.codigo === value);
         if (catalogItem) {
             newItems[index][itemIdField] = catalogItem.id;
             newItems[index].descripcion = catalogItem.descripcion;
             newItems[index].categoria = catalogItem.categoria; // Auto-fill category
             newItems[index].precio_unitario = tipoDocumento === 'compra' ? (catalogItem.costo_estandar || 0) : 0; 
             newItems[index].unidad_medida = catalogItem.unidad_medida || '';
         } else {
             // Si el código no está vacío y no existe en catalogo, preguntar si crear
             if (value && !catalogItem) {
                 if (confirm(`El producto con código "${value}" no existe en el catálogo. ¿Desea crearlo?`)) {
                     setNewProductCode(value);
                     setNewProductDesc("");
                     setPendingItemIndex(index);
                     setShowProductModal(true);
                 }
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
    const totals = calculateTotals();
    const terceroIdField = tipoDocumento === 'compra' ? 'proveedor_id' : 'cliente_id';
    const itemIdField = tipoItem === 'producto' ? 'producto_id' : (tipoItem === 'servicio' ? 'servicio_id' : 'insumo_id');

    const finalData = {
      ...formData,
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

    // Generar número_id único basado en PREFIJO-AAAA-0001 para compras
    if (tipoDocumento === 'compra' && !documento && finalData.prefijo) {
        try {
             const year = new Date().getFullYear();
             const allCompras = await OrdenCompra.list();
             const comprasConPrefijo = allCompras.filter(c => c.numero_id?.startsWith(`${finalData.prefijo}-${year}`));
             const consecutivos = comprasConPrefijo.map(c => {
               const match = c.numero_id?.match(/-\d{4}-(\d+)/);
               return match ? parseInt(match[1]) : 0;
             });
             const nextConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) + 1 : 1;
             finalData.numero_id = `${finalData.prefijo}-${year}-${String(nextConsecutivo).padStart(4, '0')}`;
        } catch (e) {
            console.error("Error generando numero_id", e);
            const year = new Date().getFullYear();
            finalData.numero_id = `${finalData.prefijo}-${year}-0001`;
        }
    }

    // Generar número_id único para ventas
    if (tipoDocumento === 'venta' && !documento && finalData.prefijo) {
        try {
             const year = new Date().getFullYear();
             const allVentas = await OrdenVenta.list();
             const ventasConPrefijo = allVentas.filter(v => v.numero_id?.startsWith(`${finalData.prefijo}-${year}`));
             const consecutivos = ventasConPrefijo.map(v => {
               const match = v.numero_id?.match(/-\d{4}-(\d+)/);
               return match ? parseInt(match[1]) : 0;
             });
             const nextConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) + 1 : 1;
             finalData.numero_id = `${finalData.prefijo}-${year}-${String(nextConsecutivo).padStart(4, '0')}`;
        } catch (e) {
            console.error("Error generando numero_id ventas", e);
            const year = new Date().getFullYear();
            finalData.numero_id = `${finalData.prefijo}-${year}-0001`;
        }
    }
    
    // Generar código de lote si no existe (solo para compras de materia prima)
    if (tipoDocumento === 'compra' && finalData.afecta_inventario && !finalData.codigo_lote_inventario && finalData.prefijo === 'CH') {
        // Auto-generar código de lote solo para compras de hojas/materia prima
        finalData.codigo_lote_inventario = `LOTE-${Date.now()}`;
    }

    // Validación eliminada - permitir cualquier fecha

    // ─── VALIDACIONES PARA VENTAS ───────────────────────────────────────────
    if (tipoDocumento === 'venta' && !documento) {
        const totalNeto = totals.totalNeto;

        if (totalNeto <= 0) {
            alert('⚠️ El Total Neto debe ser mayor a cero para guardar la venta.');
            setLoading(false);
            return;
        }

        if (finalData.condicion_pago === 'contado') {
            if (finalData.forma_pago === 'efectivo' && !finalData.cuenta_destino_id) {
                alert('⚠️ CONTADO con pago en EFECTIVO requiere seleccionar una Caja.');
                setLoading(false);
                return;
            }
        }

        if (finalData.condicion_pago === 'credito') {
            if (!finalData.fecha_vencimiento) {
                alert('⚠️ CRÉDITO requiere una Fecha de Vencimiento obligatoria.');
                setLoading(false);
                return;
            }
            finalData.valor_pagado = 0;
            finalData.saldo_pendiente = totalNeto;
        }

        if (finalData.condicion_pago === 'mixto') {
            const pagado = parseFloat(finalData.valor_pagado) || 0;
            if (pagado <= 0) {
                alert('⚠️ MIXTO requiere un Valor Pagado mayor a cero.');
                setLoading(false);
                return;
            }
            if (pagado > totalNeto) {
                alert('⚠️ El Valor Pagado no puede ser mayor al Total Neto.');
                setLoading(false);
                return;
            }
            if (finalData.forma_pago === 'efectivo' && !finalData.cuenta_destino_id) {
                alert('⚠️ MIXTO con pago en EFECTIVO requiere seleccionar una Caja.');
                setLoading(false);
                return;
            }
            finalData.saldo_pendiente = totalNeto - pagado;
        }
    }
    // ────────────────────────────────────────────────────────────────────────

    // Guardar la orden primero
    try {
        const savedOrder = await onSubmit(finalData);
        const orderId = savedOrder?.id || finalData.id;
        
        // Mensaje de éxito
        toast({
          title: "✅ Documento guardado",
          description: `${finalData.numero_id || finalData.numero_documento} registrado correctamente.`,
          duration: 4000,
          className: "border-0 bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-2xl shadow-emerald-500/30 rounded-xl",
        });

    // REVERTIR MOVIMIENTOS ANTIGUOS SI ES EDICIÓN
    if (documento && tipoDocumento === 'compra' && finalData.afecta_inventario) {
        try {
            // Buscar y eliminar movimientos antiguos de esta compra
            const movimientosAntiguos = await MovimientoInventario.filter({ 
                referencia: `${documento.prefijo_documento}-${documento.numero_documento}` 
            });
            
            for (const mov of movimientosAntiguos) {
                // Revertir el stock del producto ANTES de eliminar
                if (mov.insumo_id) {
                    try {
                        // Buscar directamente por ID en cada entidad
                        let entityType = null;
                        let currentItemData = null;
                        
                        // Intentar en ProductoTerminado (pieles)
                        const itemsPT = await ProductoTerminado.filter({ id: mov.insumo_id });
                        if (itemsPT.length > 0) {
                            currentItemData = itemsPT[0];
                            entityType = ProductoTerminado;
                        }
                        
                        // Si no, intentar en Insumo (insumos químicos)
                        if (!currentItemData) {
                            const itemsInsumo = await Insumo.filter({ id: mov.insumo_id });
                            if (itemsInsumo.length > 0) {
                                currentItemData = itemsInsumo[0];
                                entityType = Insumo;
                            }
                        }
                        
                        if (entityType && currentItemData) {
                            // Recalcular stock desde movimientos EXCLUYENDO este que vamos a borrar
                            const todosMovimientos = await MovimientoInventario.filter({ insumo_id: mov.insumo_id });
                            const stockSinEsteMovimiento = todosMovimientos
                                .filter(m => m.id !== mov.id)
                                .reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
                            
                            await entityType.update(currentItemData.id, {
                                stock_actual: stockSinEsteMovimiento
                            });
                            
                            console.log(`✅ Stock revertido para ${currentItemData.codigo}: ${stockSinEsteMovimiento}`);
                        }
                    } catch (err) {
                        console.error('Error revirtiendo stock:', err);
                    }
                }
                
                // Ahora sí eliminar el movimiento
                await MovimientoInventario.delete(mov.id);
            }
            console.log('✅ Movimientos antiguos eliminados');
        } catch (e) {
            console.error('Error revirtiendo movimientos:', e);
        }
    }

    if (documento && tipoDocumento === 'venta') {
        try {
            // Buscar y eliminar movimientos antiguos de esta venta
            const movimientosAntiguos = await MovimientoInventario.filter({ 
                referencia: `${documento.prefijo_documento}-${documento.numero_documento}` 
            });
            
            for (const mov of movimientosAntiguos) {
                await MovimientoInventario.delete(mov.id);
                
                // Revertir el stock (sumar porque era salida negativa)
                if (mov.insumo_id) {
                    const catalogoItem = await ProductoCatalogo.filter({ codigo: mov.insumo_id });
                    if (catalogoItem.length > 0) {
                        const cat = catalogoItem[0].categoria;
                        let entityType = null;
                        let currentItemData = null;
                        
                        if (cat === 'materia_prima') {
                            const items = await ProductoTerminado.filter({ id: mov.insumo_id });
                            if (items.length > 0) { currentItemData = items[0]; entityType = ProductoTerminado; }
                        } else if (cat === 'insumos_quimicos') {
                            const items = await Insumo.filter({ id: mov.insumo_id });
                            if (items.length > 0) { currentItemData = items[0]; entityType = Insumo; }
                        } else if (cat === 'productos_terminados') {
                            const items = await ProductoTerminado.filter({ id: mov.insumo_id });
                            if (items.length > 0) { currentItemData = items[0]; entityType = ProductoTerminado; }
                        }
                        
                        if (entityType && currentItemData) {
                            const stockActual = currentItemData.stock_actual || 0;
                            await entityType.update(currentItemData.id, {
                                stock_actual: stockActual - (mov.cantidad || 0) // Revertir: si era -10, sumamos 10
                            });
                        }
                    }
                }
            }
            console.log('✅ Movimientos de venta antiguos revertidos');
        } catch (e) {
            console.error('Error revirtiendo movimientos de venta:', e);
        }
    }

    // DESPUÉS actualizar inventario (solo si la orden se guardó exitosamente)
    if (tipoDocumento === 'compra' && finalData.afecta_inventario) {
        for (const item of finalData.items) {
             let currentItemData = null;
             let entityType = null;

             try {
                 // BUSCAR PRODUCTO PRIMERO POR CÓDIGO (más confiable)
                 if (item.codigo) {
                     // Intentar primero en ProductoCatalogo para obtener categoría correcta
                     const catalogoItem = await ProductoCatalogo.filter({ codigo: item.codigo });
                     if (catalogoItem.length > 0) {
                         const cat = catalogoItem[0].categoria;
                         
                         // Buscar en la entidad correcta según categoría del catálogo
                         if (cat === 'materia_prima') {
                             const items = await ProductoTerminado.filter({ codigo: item.codigo, categoria: 'pieles' });
                             if (items.length > 0) {
                                 currentItemData = items[0];
                                 entityType = ProductoTerminado;
                             }
                         } else if (cat === 'insumos_quimicos') {
                             const items = await Insumo.filter({ codigo: item.codigo });
                             if (items.length > 0) {
                                 currentItemData = items[0];
                                 entityType = Insumo;
                             }
                         } else if (cat === 'productos_terminados') {
                             const items = await ProductoTerminado.filter({ codigo: item.codigo, categoria: 'producto_terminado' });
                             if (items.length > 0) {
                                 currentItemData = items[0];
                                 entityType = ProductoTerminado;
                             }
                         }
                     }
                 }

                 if (entityType && currentItemData) {
                     // Obtener todos los movimientos actuales (ya sin los viejos si estamos editando)
                     const movimientos = await MovimientoInventario.filter({ insumo_id: currentItemData.id });
                     const stockActual = movimientos.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);

                     const cantidadCompra = parseFloat(item.cantidad) || 0;
                     const costoUnitarioCompra = parseFloat(item.precio_unitario) || 0;

                     const nuevoStock = stockActual + cantidadCompra;

                     // Calcular nuevo costo promedio ponderado correctamente
                     let nuevoCostoPromedio = costoUnitarioCompra;

                     if (nuevoStock > 0) {
                         // Calcular valor total de todos los movimientos de entrada existentes
                         const movimientosEntrada = movimientos.filter(m => m.tipo_movimiento === 'entrada');
                         const valorTotalExistente = movimientosEntrada.reduce((sum, m) => {
                             return sum + (parseFloat(m.cantidad) || 0) * (parseFloat(m.costo_unitario) || 0);
                         }, 0);

                         const valorTotalCompra = cantidadCompra * costoUnitarioCompra;
                         nuevoCostoPromedio = (valorTotalExistente + valorTotalCompra) / nuevoStock;
                     }

                     // Crear Movimiento de Entrada PRIMERO (con el costo unitario de la compra)
                     await MovimientoInventario.create({
                         tipo_movimiento: 'entrada',
                         insumo_id: currentItemData.id,
                         cantidad: cantidadCompra,
                         costo_unitario: costoUnitarioCompra,
                         fecha_movimiento: finalData.fecha_orden,
                         referencia: `${finalData.prefijo_documento}-${finalData.numero_documento}`,
                         observaciones: `Compra ${finalData.prefijo_documento}-${finalData.numero_documento}`,
                         usuario_id: 'system'
                     });

                     // Actualizar entidad con nuevo costo promedio y stock
                     await entityType.update(currentItemData.id, {
                         costo_promedio: nuevoCostoPromedio,
                         stock_actual: nuevoStock
                     });

                     console.log(`✅ Inventario actualizado para ${item.codigo}: Stock=${nuevoStock}, Costo Promedio=${nuevoCostoPromedio}`);

                     // ─── SINCRONIZACIÓN AUTOMÁTICA POR CATEGORÍA DEL CATÁLOGO ───
                     // Según la categoría del producto en CatálogoProductos, guardar en el inventario correspondiente
                     if (!documento) {
                         try {
                             const catalogoData = catalogoItem[0];
                             const cat = catalogoData.categoria;
                             const refDoc = finalData.numero_id || `${finalData.prefijo_documento}-${finalData.numero_documento}`;

                             if (cat === 'insumos_quimicos') {
                                 // Ya está en Insumo (entityType = Insumo) — no hacer nada extra
                                 console.log(`✅ Insumo Químico actualizado en Inventario de Insumos y Químicos`);

                             } else if (cat === 'productos_en_proceso') {
                                 // Guardar en InventarioEnProceso
                                 const { InventarioEnProceso } = await import('@/entities/all');
                                 await InventarioEnProceso.create({
                                     codigo: item.codigo,
                                     descripcion: item.descripcion || catalogoData.descripcion || '',
                                     codigo_lote: finalData.codigo_lote_inventario || refDoc,
                                     origen_modulo: 'compras',
                                     etapa_actual: 'recepcion',
                                     estado_proceso: 'piel_recibida',
                                     estado_actual: 'disponible',
                                     cantidad_hojas: cantidadCompra,
                                     fecha_ingreso_proceso: finalData.fecha_emision_documento || finalData.fecha_orden,
                                     submodulo_origen: finalData.prefijo || 'compras',
                                 });
                                 console.log(`✅ Guardado en Inventario Productos en Proceso`);

                             } else if (cat === 'materia_prima') {
                                 // Ya está en ProductoTerminado con categoria 'pieles' — no hacer nada extra
                                 console.log(`✅ Materia Prima actualizada en Inventario de Materias Primas`);

                             } else if (cat === 'productos_terminados') {
                                 // Ya está en ProductoTerminado con categoria 'producto_terminado' — no hacer nada extra
                                 console.log(`✅ Producto Terminado actualizado en Inventario de Productos Terminados`);
                             }
                         } catch (err) {
                             console.error('Error en sincronización de inventario por categoría:', err);
                         }
                     }
                     // ────────────────────────────────────────────────────────────

                 } else {
                      console.warn(`⚠️ No se encontró producto en inventario para código: ${item.codigo}`);
                 }
             } catch (err) {
                 console.error("❌ Error actualizando inventario para item", item.codigo, err);
             }
        }
    }

    // Actualizar estado del documento según condición de pago en compras
    if (tipoDocumento === 'compra') {
        if (finalData.condicion_pago === 'contado' && finalData.valor_pagado === finalData.total) {
            finalData.estado_documento = 'pagado';
        } else if (finalData.condicion_pago === 'credito') {
            finalData.estado_documento = 'pendiente';
        } else if (finalData.condicion_pago === 'mixto' && finalData.valor_pagado > 0) {
            finalData.estado_documento = 'parcial';
        }
    }

    // ─── VALIDACIONES PARA COMPRAS ───────────────────────────────────────────
    if (tipoDocumento === 'compra' && !documento) {
        const totalNeto = totals.totalNeto;

        if (totalNeto <= 0) {
            alert('⚠️ El Total Neto debe ser mayor a cero para guardar la compra.');
            return;
        }

        if (finalData.condicion_pago === 'contado' || finalData.condicion_pago === 'mixto') {
            if (finalData.forma_pago === 'efectivo' && !finalData.cuenta_destino_id) {
                alert('⚠️ Pago en EFECTIVO requiere seleccionar una Caja.');
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

    // AUTOMATIZACIÓN: Generar Recibo de Caja o Comprobante de Egreso si es contado
    if ((finalData.condicion_pago === 'contado' || finalData.condicion_pago === 'mixto') && finalData.valor_pagado > 0) {
        try {
            if (tipoDocumento === 'venta') {
                const clienteNombre = terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === finalData.cliente_id)?.nombre || '');
                const noIdDoc = finalData.numero_id || `${finalData.prefijo_documento}-${finalData.numero_documento}`;

                // Generar MovimientoCaja si pago en efectivo
                if (finalData.forma_pago === 'efectivo' && finalData.cuenta_destino_id) {
                    const { MovimientoCaja } = await import('@/entities/all');
                    // Verificar duplicado por documento_origen_id
                    const existentes = await MovimientoCaja.filter({ documento_origen_id: orderId, documento_origen_tipo: 'OrdenVenta' });
                    if (existentes.length === 0) {
                        // Calcular saldo resultante sumando todos los movimientos anteriores de esa caja
                        const movsPrevios = await MovimientoCaja.filter({ caja_id: finalData.cuenta_destino_id });
                        const saldoPrevio = movsPrevios.reduce((acc, m) => {
                            return acc + (m.tipo_movimiento === 'entrada' ? (parseFloat(m.valor) || 0) : -(parseFloat(m.valor) || 0));
                        }, 0);
                        const saldoResultante = saldoPrevio + (parseFloat(finalData.valor_pagado) || 0);

                        await MovimientoCaja.create({
                            caja_id: finalData.cuenta_destino_id,
                            nombre_caja: finalData.cuenta_destino_nombre || '',
                            fecha: finalData.fecha_emision_documento || finalData.fecha_orden,
                            tipo_movimiento: 'entrada',
                            concepto: `Venta ${noIdDoc} - ${clienteNombre}`,
                            documento_origen_tipo: 'OrdenVenta',
                            documento_origen_id: orderId,
                            responsable: clienteNombre,
                            valor: parseFloat(finalData.valor_pagado) || 0,
                            saldo_resultante: saldoResultante,
                            observacion: `Ingreso por venta ${noIdDoc}`,
                            usuario_creacion: 'sistema'
                        });
                        console.log('✅ MovimientoCaja ENTRADA generado para venta');
                    }
                } else if (finalData.forma_pago !== 'efectivo' && finalData.cuenta_destino_id) {
                    // Pago bancario → MovimientoBancario
                    const { MovimientoBancario, CuentaBancaria: CB } = await import('@/entities/all');
                    const cuentasData = await CB.filter({ id: finalData.cuenta_destino_id });
                    if (cuentasData.length > 0) {
                        const cuenta = cuentasData[0];
                        const nuevoSaldo = (cuenta.saldo_actual || 0) + (parseFloat(finalData.valor_pagado) || 0);
                        await CB.update(cuenta.id, { saldo_actual: nuevoSaldo });
                        await MovimientoBancario.create({
                            cuenta_id: cuenta.id,
                            fecha: finalData.fecha_emision_documento || finalData.fecha_orden,
                            tipo_movimiento: 'ingreso',
                            concepto: `Venta ${noIdDoc} - ${clienteNombre}`,
                            tercero_nombre: clienteNombre,
                            valor: parseFloat(finalData.valor_pagado) || 0,
                            saldo_posterior: nuevoSaldo,
                            documento_origen_tipo: 'OrdenVenta',
                            documento_origen_id: orderId,
                            es_automatico: true
                        });
                    }
                }

                // Generar Cuenta por Cobrar para mixto (saldo pendiente)
                if (finalData.condicion_pago === 'mixto' && finalData.saldo_pendiente > 0) {
                    const { CuentaPorCobrar } = await import('@/entities/all');
                    const existentesCpc = await CuentaPorCobrar.filter({ documento_origen_id: orderId });
                    if (existentesCpc.length === 0) {
                        await CuentaPorCobrar.create({
                            id_cuenta: `CPC-${Date.now()}`,
                            cliente_id: finalData.cliente_id,
                            cliente_nombre: clienteNombre,
                            cliente_nit: finalData.cc_nit_cliente || '',
                            tipo_documento: finalData.tipo_documento_venta || finalData.tipo_documento,
                            numero_documento: noIdDoc,
                            documento_origen_id: orderId,
                            modulo_origen: 'ventas',
                            fecha_documento: finalData.fecha_emision_documento || finalData.fecha_orden,
                            fecha_vencimiento: finalData.fecha_vencimiento,
                            valor_total: finalData.saldo_pendiente,
                            valor_cobrado: 0,
                            saldo_pendiente: finalData.saldo_pendiente,
                            estado: 'pendiente',
                            historial_cobros: []
                        });
                        console.log('✅ CuentaPorCobrar (saldo mixto) generada automáticamente');
                    }
                }

                console.log('✅ Automatización de venta contado/mixto completada');
            } else {
                // Generar Comprobante de Egreso automáticamente
                const { ComprobanteEgreso } = await import('@/entities/all');
                const lastComprobantes = await ComprobanteEgreso.list('-created_date', 1);
                const nextNum = lastComprobantes.length > 0 ? parseInt(lastComprobantes[0].numero_comprobante || '0') + 1 : 1;

                await ComprobanteEgreso.create({
                    numero_comprobante: String(nextNum).padStart(6, '0'),
                    fecha: finalData.fecha_orden,
                    tipo_egreso: 'compra',
                    tercero_id: finalData.proveedor_id || '',
                    tercero_nombre: terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === finalData.proveedor_id)?.nombre || ''),
                    concepto: `Compra ${finalData.prefijo_documento}-${finalData.numero_documento}`,
                    valor: finalData.valor_pagado,
                    medio_pago: finalData.forma_pago || 'efectivo',
                    cuenta_origen_id: finalData.cuenta_destino_id || '',
                    cuenta_origen_nombre: finalData.cuenta_destino_nombre || 'CAJA GENERAL',
                    compra_id: orderId,
                    generado_automaticamente: true,
                    observaciones: `Generado automáticamente por compra ${finalData.condicion_pago}`
                });

                // Actualizar saldo de caja o cuenta bancaria (restar)
                if (finalData.forma_pago === 'efectivo' && finalData.cuenta_destino_id) {
                    const { Caja, MovimientoCaja } = await import('@/entities/all');
                    const cajasData = await Caja.filter({ id: finalData.cuenta_destino_id });
                    if (cajasData && cajasData.length > 0) {
                        const caja = cajasData[0];
                        const noIdDoc = finalData.numero_id || `${finalData.prefijo_documento}-${finalData.numero_documento}`;
                        const proveedorNombre = terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === finalData.proveedor_id)?.nombre || '');
                        // Verificar duplicado
                        const existentesMovCaja = await MovimientoCaja.filter({ documento_origen_id: orderId, documento_origen_tipo: 'OrdenCompra' });
                        if (existentesMovCaja.length === 0) {
                            const movsPrevios = await MovimientoCaja.filter({ caja_id: caja.id });
                            const saldoPrevio = movsPrevios.reduce((acc, m) => {
                                return acc + (m.tipo_movimiento === 'entrada' ? (parseFloat(m.valor) || 0) : -(parseFloat(m.valor) || 0));
                            }, caja.saldo_inicial || 0);
                            const nuevoSaldo = saldoPrevio - (parseFloat(finalData.valor_pagado) || 0);
                            await Caja.update(caja.id, { saldo_actual: nuevoSaldo });
                            await MovimientoCaja.create({
                                caja_id: caja.id,
                                nombre_caja: caja.nombre,
                                fecha: finalData.fecha_emision_documento || finalData.fecha_orden,
                                tipo_movimiento: 'salida',
                                concepto: `Compra ${noIdDoc} - ${proveedorNombre}`,
                                documento_origen_tipo: 'OrdenCompra',
                                documento_origen_id: orderId,
                                responsable: proveedorNombre,
                                valor: parseFloat(finalData.valor_pagado) || 0,
                                saldo_resultante: nuevoSaldo,
                                observacion: `Egreso por compra ${noIdDoc}`,
                                usuario_creacion: 'sistema'
                            });
                            console.log('✅ MovimientoCaja SALIDA generado para compra');
                        }
                    }
                } else if (finalData.forma_pago === 'banco' && finalData.cuenta_destino_id) {
                    const { CuentaBancaria, MovimientoBancario } = await import('@/entities/all');
                    const cuentasData = await CuentaBancaria.filter({ id: finalData.cuenta_destino_id });
                    if (cuentasData && cuentasData.length > 0) {
                        const cuenta = cuentasData[0];
                        const nuevoSaldo = (cuenta.saldo_actual || 0) - finalData.valor_pagado;
                        await CuentaBancaria.update(cuenta.id, { saldo_actual: nuevoSaldo });
                        await MovimientoBancario.create({
                            cuenta_id: cuenta.id,
                            fecha: finalData.fecha_orden,
                            tipo_movimiento: 'egreso',
                            concepto: `Compra ${finalData.prefijo_documento}-${finalData.numero_documento}`,
                            tercero_nombre: terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === finalData.proveedor_id)?.nombre || ''),
                            valor: finalData.valor_pagado,
                            saldo_posterior: nuevoSaldo
                        });
                    }
                }

                console.log('✅ Comprobante de Egreso generado automáticamente');
            }
        } catch (e) {
            console.error('Error generando documento automático:', e);
        }
    }

    // GENERAR CUENTA POR COBRAR si es venta a crédito (puro)
    if (tipoDocumento === 'venta' && !documento && finalData.condicion_pago === 'credito' && finalData.saldo_pendiente > 0) {
        try {
            const { CuentaPorCobrar } = await import('@/entities/all');
            const existentesCpc = await CuentaPorCobrar.filter({ documento_origen_id: orderId });
            if (existentesCpc.length === 0) {
                const clienteNombre = terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === finalData.cliente_id)?.nombre || '');
                const noIdDoc = finalData.numero_id || `${finalData.prefijo_documento}-${finalData.numero_documento}`;
                await CuentaPorCobrar.create({
                    id_cuenta: `CPC-${Date.now()}`,
                    cliente_id: finalData.cliente_id,
                    cliente_nombre: clienteNombre,
                    cliente_nit: finalData.cc_nit_cliente || '',
                    tipo_documento: finalData.tipo_documento_venta || finalData.tipo_documento,
                    numero_documento: noIdDoc,
                    documento_origen_id: orderId,
                    modulo_origen: 'ventas',
                    fecha_documento: finalData.fecha_emision_documento || finalData.fecha_orden,
                    fecha_vencimiento: finalData.fecha_vencimiento,
                    valor_total: finalData.saldo_pendiente,
                    valor_cobrado: 0,
                    saldo_pendiente: finalData.saldo_pendiente,
                    estado: 'pendiente',
                    historial_cobros: []
                });
                console.log('✅ CuentaPorCobrar CRÉDITO generada automáticamente');
            }
        } catch (e) {
            console.error('Error generando cuenta por cobrar:', e);
        }
    }

    // GENERAR CUENTA POR PAGAR si es compra a crédito o mixto
    if (tipoDocumento === 'compra' && !documento && (finalData.condicion_pago === 'credito' || finalData.condicion_pago === 'mixto') && finalData.saldo_pendiente > 0) {
        try {
            const { CuentaPorPagar } = await import('@/entities/all');
            // Verificar duplicado por documento_origen_id
            const existentesCpp = await CuentaPorPagar.filter({ documento_origen_id: orderId });
            if (existentesCpp.length === 0) {
                const proveedor = terceros.find(p => p.id === finalData.proveedor_id);
                const noIdDoc = finalData.numero_id || `${finalData.prefijo_documento}-${finalData.numero_documento}`;
                await CuentaPorPagar.create({
                    id_cuenta: `CPP-${Date.now()}`,
                    proveedor_id: finalData.proveedor_id,
                    proveedor_nombre: terceroPersonalizado ? finalData.tercero_personalizado : (proveedor?.nombre || ''),
                    proveedor_nit: proveedor?.numero_identificacion || proveedor?.nit || '',
                    tipo_documento: finalData.tipo_documento_proveedor,
                    numero_documento: noIdDoc,
                    documento_origen_id: orderId,
                    modulo_origen: 'compras',
                    condicion_pago: finalData.condicion_pago,
                    fecha_documento: finalData.fecha_emision_documento || finalData.fecha_orden,
                    fecha_vencimiento: finalData.fecha_vencimiento,
                    valor_total: finalData.total,
                    valor_pagado: finalData.condicion_pago === 'mixto' ? (parseFloat(finalData.valor_pagado) || 0) : 0,
                    saldo_pendiente: finalData.saldo_pendiente,
                    estado: 'pendiente',
                    historial_pagos: []
                });
                console.log('✅ Cuenta por Pagar generada automáticamente para compra ' + finalData.condicion_pago);
            }
        } catch (e) {
            console.error('Error generando cuenta por pagar:', e);
        }
    }

    // Generar Asiento Contable Automático
    try {
        const { AsientoContable } = await import('@/entities/all');
        const lastAsientos = await AsientoContable.list('-created_date', 1);
        const nextNum = lastAsientos.length > 0 ? parseInt(lastAsientos[0].numero_asiento || '0') + 1 : 1;

        const detalle = [];
        
        if (tipoDocumento === 'venta') {
            // Débito: Caja o Cuentas por Cobrar
            detalle.push({
                cuenta_codigo: finalData.condicion_pago === 'contado' ? '1105' : '1305',
                cuenta_nombre: finalData.condicion_pago === 'contado' ? 'Caja' : 'Cuentas por Cobrar',
                debe: finalData.total,
                haber: 0,
                tercero_id: finalData.cliente_id || '',
                tercero_nombre: terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === finalData.cliente_id)?.nombre || '')
            });
            // Crédito: Ingresos por Ventas
            detalle.push({
                cuenta_codigo: '4135',
                cuenta_nombre: 'Ingresos por Ventas',
                debe: 0,
                haber: finalData.total,
                tercero_id: finalData.cliente_id || '',
                tercero_nombre: terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === finalData.cliente_id)?.nombre || '')
            });
        } else {
            // Débito: Inventario o Gastos
            detalle.push({
                cuenta_codigo: finalData.afecta_inventario ? '1435' : '5135',
                cuenta_nombre: finalData.afecta_inventario ? 'Inventarios' : 'Gastos',
                debe: finalData.total,
                haber: 0,
                tercero_id: finalData.proveedor_id || '',
                tercero_nombre: terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === finalData.proveedor_id)?.nombre || '')
            });
            // Crédito: Caja o Cuentas por Pagar
            detalle.push({
                cuenta_codigo: finalData.condicion_pago === 'contado' ? '1105' : '2205',
                cuenta_nombre: finalData.condicion_pago === 'contado' ? 'Caja' : 'Cuentas por Pagar',
                debe: 0,
                haber: finalData.total,
                tercero_id: finalData.proveedor_id || '',
                tercero_nombre: terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === finalData.proveedor_id)?.nombre || '')
            });
        }

        await AsientoContable.create({
            numero_asiento: String(nextNum).padStart(6, '0'),
            fecha: finalData.fecha_orden,
            tipo_asiento: 'movimiento',
            descripcion: `${tipoDocumento === 'venta' ? 'Venta' : 'Compra'} ${finalData.prefijo_documento}-${finalData.numero_documento}`,
            origen_modulo: tipoDocumento === 'venta' ? 'ventas' : 'compras',
            referencia_origen_id: orderId,
            detalle,
            total_debe: finalData.total,
            total_haber: finalData.total,
            estado: 'contabilizado',
            observaciones: 'Generado automáticamente'
        });

        console.log('✅ Asiento contable generado automáticamente');
        } catch (e) {
        console.error('Error generando asiento contable:', e);
        }

        } catch (error) {
        console.error('Error al guardar:', error);
        alert(`Error al guardar: ${error.message}`);
        return;
        }

    // Lógica de actualización de Inventario para VENTAS (Salidas)
    if (tipoDocumento === 'venta') {
        for (const item of finalData.items) {
             try {
                 let currentItemData = null;
                 let entityType = null;

                 // BUSCAR POR CÓDIGO (más confiable)
                 if (item.codigo) {
                     const catalogoItem = await ProductoCatalogo.filter({ codigo: item.codigo });
                     if (catalogoItem.length > 0) {
                         const cat = catalogoItem[0].categoria;
                         
                         if (cat === 'materia_prima') {
                             const items = await ProductoTerminado.filter({ codigo: item.codigo, categoria: 'pieles' });
                             if (items.length > 0) {
                                 currentItemData = items[0];
                                 entityType = ProductoTerminado;
                             }
                         } else if (cat === 'insumos_quimicos') {
                             const items = await Insumo.filter({ codigo: item.codigo });
                             if (items.length > 0) {
                                 currentItemData = items[0];
                                 entityType = Insumo;
                             }
                         } else if (cat === 'productos_terminados') {
                             const items = await ProductoTerminado.filter({ codigo: item.codigo, categoria: 'producto_terminado' });
                             if (items.length > 0) {
                                 currentItemData = items[0];
                                 entityType = ProductoTerminado;
                             }
                         }
                     }
                 }

                 if (entityType && currentItemData) {
                     // Obtener Stock Actual desde movimientos
                     const movimientos = await MovimientoInventario.filter({ insumo_id: currentItemData.id }); 
                     const stockActual = movimientos.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
                     const cantidadVenta = parseFloat(item.cantidad) || 0;
                     const costoPromedioMovimiento = parseFloat(currentItemData.costo_promedio) || 0;

                     // Registrar Movimiento de Salida (NEGATIVO)
                     await MovimientoInventario.create({
                         tipo_movimiento: 'salida',
                         insumo_id: currentItemData.id,
                         cantidad: -cantidadVenta,
                         costo_unitario: costoPromedioMovimiento, 
                         fecha_movimiento: finalData.fecha_orden,
                         referencia: `${finalData.prefijo_documento}-${finalData.numero_documento}`,
                         observaciones: `Venta ${finalData.prefijo_documento}-${finalData.numero_documento}`,
                         usuario_id: 'system'
                     });
                     
                     // Actualizar stock
                     await entityType.update(currentItemData.id, {
                         stock_actual: stockActual - cantidadVenta
                     });
                     
                     console.log(`✅ Venta registrada para ${item.codigo}: Stock=${stockActual - cantidadVenta}`);
                 }
             } catch (err) {
                 console.error("❌ Error actualizando inventario para item (venta)", item.codigo, err);
             }
        }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl h-[95vh]">
        <DialogHeader>
          <DialogTitle>{documento ? "Editar" : "Nuevo"} {documentoTitulo}</DialogTitle>
          <DialogDescription>
            Complete la información para registrar el documento.
          </DialogDescription>
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
                  <div>
                    <Label>Código Proveedor</Label>
                    <Input value={formData.codigo_proveedor || ''} readOnly className="bg-gray-100" />
                  </div>
                )}
                {tipoDocumento === 'venta' && (
                  <div>
                    <Label>Código Cliente</Label>
                    <Input value={formData.codigo_cliente || ''} readOnly className="bg-gray-100" />
                  </div>
                )}
                <div><Label>{terceroLabel}</Label>
                    {!terceroPersonalizado ? (
                    <Select value={formData[terceroIdField]} onValueChange={v => v === 'personalizado' ? setTerceroPersonalizado(true) : handleInputChange(terceroIdField, v)}>
                        <SelectTrigger><SelectValue placeholder={`Seleccionar ${terceroLabel}`} /></SelectTrigger>
                        <SelectContent>{terceros.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}<SelectItem value="personalizado">🖊️ Personalizado</SelectItem></SelectContent>
                    </Select>
                    ) : (<div className="flex gap-2"><Input placeholder={`Escriba nombre de ${terceroLabel}`} value={formData.tercero_personalizado} onChange={e => handleInputChange('tercero_personalizado', e.target.value)}/><Button type="button" variant="outline" size="sm" onClick={() => setTerceroPersonalizado(false)}>Cancelar</Button></div>)}
                </div>
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
                            required
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Label className="font-bold">Motivo *</Label>
                        <Input 
                            value={formData.motivo_nota || ''} 
                            onChange={e => handleInputChange('motivo_nota', e.target.value)} 
                            placeholder="Describe el motivo de la nota"
                            required
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
                <div><Label>Fecha Emisión Documento *</Label><Input type="date" value={formData.fecha_emision_documento || formData.fecha_orden} onChange={e => handleInputChange('fecha_emision_documento', e.target.value)} required /></div>
                {tipoDocumento === 'compra' && (
                  <div><Label>Fecha de Recepción Conforme</Label><Input type="date" value={formData.fecha_recepcion_conforme || ''} onChange={e => handleInputChange('fecha_recepcion_conforme', e.target.value)} /></div>
                )}
                
                {tipoDocumento === 'compra' && (
                    <>
                         <div><Label>Tipo de Compra</Label>
                            <Select value={formData.tipo_compra} onValueChange={v => handleInputChange('tipo_compra', v)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar"/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="insumos">Insumos</SelectItem>
                                    <SelectItem value="hojas">Hojas</SelectItem>
                                    <SelectItem value="servicios_publicos">Servicios Públicos</SelectItem>
                                    <SelectItem value="gastos_generales">Gastos Generales</SelectItem>
                                    <SelectItem value="otras_compras">Otras Compras</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                )}

                <div><Label>Fecha Vencimiento</Label><Input type="date" value={formData.fecha_vencimiento} onChange={e => handleInputChange('fecha_vencimiento', e.target.value)} /></div>
                
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
                                    <td className="p-1 min-w-[150px]">
                                        <div className="space-y-1">
                                            <Input 
                                                placeholder="Código" 
                                                value={item.codigo || ""} 
                                                onChange={(e) => handleItemChange(index, 'codigo', e.target.value)}
                                                list={`datalist-catalogo-${index}`}
                                                className="h-8 text-xs"
                                            />
                                            <datalist id={`datalist-catalogo-${index}`}>
                                                {productosCatalogo
                                                    .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }))
                                                    .filter(p => {
                                                        const searchTerm = (item.codigo || '').toLowerCase();
                                                        return !searchTerm || 
                                                               (p.codigo || '').toLowerCase().includes(searchTerm) ||
                                                               (p.descripcion || '').toLowerCase().includes(searchTerm);
                                                    })
                                                    .map(p => (
                                                        <option key={p.id} value={p.codigo}>{p.descripcion}</option>
                                                    ))}
                                            </datalist>
                                        </div>
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
                                    <Select value={formData.forma_pago} onValueChange={v => handleInputChange('forma_pago', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="efectivo">EFECTIVO</SelectItem>
                                            <SelectItem value="banco">BANCO</SelectItem>
                                        </SelectContent>
                                    </Select>
                                 </div>
                             )}
                         </div>

                         {/* Campos condicionales según forma de pago */}
                         {(formData.condicion_pago === 'contado' || formData.condicion_pago === 'mixto') && (
                             <div>
                                 {formData.forma_pago === 'efectivo' ? (
                                     <div>
                                         <Label className="font-bold">Caja * (Obligatorio para Efectivo)</Label>
                                         <Select value={formData.cuenta_destino_id} onValueChange={v => {
                                             const caja = cajas.find(c => c.id === v);
                                             handleInputChange('cuenta_destino_id', v);
                                             handleInputChange('cuenta_destino_nombre', caja ? caja.nombre : '');
                                         }} required>
                                             <SelectTrigger><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
                                             <SelectContent>
                                                 {cajas.map(c => (
                                                     <SelectItem key={c.id} value={c.id}>{c.caja_id ? `${c.caja_id} - ` : ''}{c.nombre}</SelectItem>
                                                 ))}
                                             </SelectContent>
                                         </Select>
                                     </div>
                                 ) : formData.forma_pago === 'banco' ? (
                                     <div>
                                         <Label className="font-bold">Cuenta Bancaria *</Label>
                                         <Select value={formData.cuenta_destino_id} onValueChange={v => {
                                             const cuenta = cuentasBancarias.find(c => c.id === v);
                                             handleInputChange('cuenta_destino_id', v);
                                             handleInputChange('cuenta_destino_nombre', cuenta ? `${cuenta.banco} - ${cuenta.numero_cuenta}` : '');
                                         }} required>
                                             <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                                             <SelectContent>
                                                 {cuentasBancarias.map(c => (
                                                     <SelectItem key={c.id} value={c.id}>
                                                         {c.banco} - {c.numero_cuenta}
                                                     </SelectItem>
                                                 ))}
                                             </SelectContent>
                                         </Select>
                                     </div>
                                 ) : null}
                             </div>
                         )}

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
                         <Label className="font-bold">Estado del Documento *</Label>
                         <Select value={formData.estado_documento || 'pendiente'} onValueChange={v => handleInputChange('estado_documento', v)}>
                           <SelectTrigger><SelectValue /></SelectTrigger>
                           <SelectContent>
                             <SelectItem value="pendiente">PENDIENTE</SelectItem>
                             <SelectItem value="pagado">PAGADO</SelectItem>
                             <SelectItem value="parcial">PARCIAL</SelectItem>
                             <SelectItem value="anulado">ANULADO</SelectItem>
                           </SelectContent>
                         </Select>
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
            <Button type="submit"><Save className="w-4 h-4 mr-2" />Guardar</Button>
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
  );
}