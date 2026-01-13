import React, { useState, useEffect, useCallback, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, X, Save, Upload } from 'lucide-react';
import { UploadFile } from "@/integrations/Core";
import ProductCreationModal from './ProductCreationModal';
import { ProductoCatalogo, OrdenCompra, MovimientoInventario, Insumo, ProductoTerminado, MovimientoLibroDiario } from '@/entities/all';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function DocumentoComercialForm({ open, onOpenChange, onSubmit, documento, terceros, itemsCatalogo, tipoDocumento, tipoItem, terceroLabel, documentoTitulo }) {
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
          const [cajasData, bancosData] = await Promise.all([
              Caja.list(),
              CuentaBancaria.list()
          ]);
          setCajas(cajasData);
          setCuentasBancarias(bancosData);
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
        tipo_documento: "factura_electronica",
        prefijo_documento: tipoDocumento === 'compra' ? 'FC' : 'FV',
        numero_documento: '',
        [`${tipoItem === 'insumo' || tipoItem === 'piel' || tipoItem === 'hoja' || tipoItem === 'otra' ? 'proveedor' : 'cliente'}_id`]: '',
        tercero_personalizado: '',
        cc_nit_proveedor: '',
        cc_nit_cliente: '',
        direccion_cliente: '',
        telefono_cliente: '',
        fecha_orden: new Date().toISOString().split('T')[0],
        fecha_vencimiento: new Date().toISOString().split('T')[0],
        forma_pago: 'contado',
        medio_pago: 'efectivo',
        cuenta_destino_id: '',
        cuenta_destino_nombre: '',
        observaciones: "",
        soportes: [],
        items: [],
        tipo_compra: tipoDocumento === 'compra' ? (tipoItem || 'insumos') : undefined,
        tipo_venta: tipoDocumento === 'venta' ? tipoItem : undefined,
        codigo_lote_piel: '',
        codigo_lote_inventario: '',
        afecta_inventario: true,
        monto_efectivo: 0,
        monto_credito: 0,
        saldo_pendiente: 0,
        empresa: 'ARTECUEROS',
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

  const handleInputChange = (field, value) => {
      if (field === 'proveedor_id' || field === 'cliente_id') {
          const selectedTercero = terceros.find(t => t.id === value);
          const nitField = tipoDocumento === 'compra' ? 'cc_nit_proveedor' : 'cc_nit_cliente';
          const dirField = 'direccion_cliente';
          const telField = 'telefono_cliente';
          
          setFormData(prev => ({
              ...prev,
              [field]: value,
              [nitField]: selectedTercero ? selectedTercero.nit : '',
              ...(tipoDocumento === 'venta' && {
                  [dirField]: selectedTercero ? selectedTercero.direccion : '',
                  [telField]: selectedTercero ? selectedTercero.telefono : ''
              })
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

  // Recalcular créditos y saldos cuando cambie forma de pago o el total
  useEffect(() => {
    if (formData) {
        const { totalNeto } = calculateTotals();
        
        if (formData.forma_pago === 'contado') {
            // Contado: todo se paga
            setFormData(prev => ({
                ...prev,
                monto_efectivo: totalNeto,
                monto_credito: 0,
                saldo_pendiente: 0
            }));
        } else if (formData.forma_pago === 'credito') {
            // Crédito: queda saldo pendiente
            const efectivo = parseFloat(formData.monto_efectivo) || 0;
            const credito = totalNeto - efectivo;
            if (formData.monto_credito !== credito || formData.saldo_pendiente !== credito) {
                setFormData(prev => ({
                    ...prev,
                    monto_credito: credito > 0 ? credito : 0,
                    saldo_pendiente: credito > 0 ? credito : 0
                }));
            }
        }
    }
  }, [formData?.forma_pago, formData?.items]);

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

    // Lógica de consecutivo automático para Compras por Prefijo
    if (tipoDocumento === 'compra' && !documento && !finalData.numero_documento) {
        try {
             const lastOrders = await OrdenCompra.filter({ prefijo_documento: finalData.prefijo_documento }, '-created_date', 1); // Ordenar por fecha de creación descendente
             let nextNum = 1;
             if (lastOrders && lastOrders.length > 0) {
                 // Intentar parsear el último número
                 const lastNumInt = parseInt(lastOrders[0].numero_documento, 10);
                 if (!isNaN(lastNumInt)) {
                     nextNum = lastNumInt + 1;
                 }
             }
             finalData.numero_documento = String(nextNum).padStart(3, '0');
        } catch (e) {
            console.error("Error generando consecutivo", e);
            finalData.numero_documento = String(Date.now()).slice(-4); // Fallback
        }
    }

    // Generar código de lote si no existe (solo para compras de materia prima)
    if (tipoDocumento === 'compra' && finalData.afecta_inventario && !finalData.codigo_lote_inventario) {
        // Auto-generar código de lote LOTE-XXXXXX (timestamp)
        finalData.codigo_lote_inventario = `LOTE-${Date.now()}`;
    }

    // Lógica de actualización de Inventario y Costo Promedio - PRIMERO GUARDAR LA ORDEN
    await onSubmit(finalData);

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
                     // Obtener Stock Actual desde movimientos
                     const movimientos = await MovimientoInventario.filter({ insumo_id: currentItemData.id });
                     const stockActual = movimientos.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
                     const costoPromedioActual = parseFloat(currentItemData.costo_promedio) || 0;
                     
                     const cantidadCompra = parseFloat(item.cantidad) || 0;
                     const costoUnitarioCompra = parseFloat(item.precio_unitario) || 0;
                     
                     const nuevoStock = stockActual + cantidadCompra;
                     let nuevoCostoPromedio = costoUnitarioCompra; // Default
                     
                     if (nuevoStock > 0) {
                         const valorTotalAnterior = stockActual * costoPromedioActual;
                         const valorTotalCompra = cantidadCompra * costoUnitarioCompra;
                         nuevoCostoPromedio = (valorTotalAnterior + valorTotalCompra) / nuevoStock;
                     }

                     // Actualizar Costo Promedio en la Entidad
                     await entityType.update(currentItemData.id, {
                         costo_promedio: nuevoCostoPromedio,
                         stock_actual: nuevoStock
                     });
                     
                     // Crear Movimiento de Entrada
                     await MovimientoInventario.create({
                         tipo_movimiento: 'entrada',
                         insumo_id: currentItemData.id,
                         cantidad: cantidadCompra,
                         costo_unitario: nuevoCostoPromedio,
                         fecha_movimiento: finalData.fecha_orden,
                         referencia: `${finalData.prefijo_documento}-${finalData.numero_documento}`,
                         observaciones: `Compra ${finalData.prefijo_documento}-${finalData.numero_documento}`,
                         usuario_id: 'system'
                     });
                     
                     console.log(`✅ Inventario actualizado para ${item.codigo}: Stock=${nuevoStock}, Costo Promedio=${nuevoCostoPromedio}`);
                 } else {
                     console.warn(`⚠️ No se encontró producto en inventario para código: ${item.codigo}`);
                 }
             } catch (err) {
                 console.error("❌ Error actualizando inventario para item", item.codigo, err);
             }
        }
    }

    // Registro en Libro Diario
    try {
        const tipoMov = tipoDocumento === 'venta' ? 'ingreso' : 'egreso';
        
        if (finalData.monto_efectivo > 0) {
             await MovimientoLibroDiario.create({
                 fecha: finalData.fecha_orden,
                 tipo_movimiento: tipoMov,
                 tipo_tercero: tipoDocumento === 'venta' ? 'cliente' : 'proveedor',
                 tipo_documento_soporte: 'factura',
                 numero_documento: finalData.numero_documento,
                 tercero_id: finalData.cliente_id || finalData.proveedor_id,
                 tercero_nombre: terceroPersonalizado ? finalData.tercero_personalizado : (terceros.find(t => t.id === (finalData.cliente_id || finalData.proveedor_id))?.nombre || ''),
                 cuenta_afectada: 'Caja Principal',
                 descripcion: `${tipoMov === 'ingreso' ? 'Venta' : 'Compra'} ${finalData.prefijo_documento}-${finalData.numero_documento}`,
                 valor_ingreso: tipoMov === 'ingreso' ? finalData.monto_efectivo : 0,
                 valor_egreso: tipoMov === 'egreso' ? finalData.monto_efectivo : 0,
                 medio_pago: 'efectivo',
                 origen_modulo: tipoDocumento === 'venta' ? 'ventas' : 'compras',
                 saldo_anterior: 0,
                 saldo_final: 0
             });
        }
    } catch (e) { console.error("Error libro diario", e); }

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div><Label>Tipo DCTO</Label>
                    <Select value={formData.tipo_documento} onValueChange={(v) => handleInputChange('tipo_documento', v)}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="factura_electronica">Factura Electrónica</SelectItem>
                            <SelectItem value="cuenta_cobro">Cuenta de Cobro</SelectItem>
                            <SelectItem value="remision">Remisión</SelectItem>
                            {tipoDocumento === 'compra' && <SelectItem value="otras_compras">Otras Compras</SelectItem>}
                            {tipoDocumento === 'venta' && <SelectItem value="otras_ventas">Otras Ventas</SelectItem>}
                        </SelectContent>
                    </Select>
                </div>
                
                {tipoDocumento === 'compra' ? (
                    <div><Label>Prefijo</Label>
                        <Select value={formData.prefijo_documento} onValueChange={v => handleInputChange('prefijo_documento', v)}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CI">CI - Compra Insumos</SelectItem>
                                <SelectItem value="CH">CH - Compra Hojas</SelectItem>
                                <SelectItem value="CSP">CSP - Servicios Públicos</SelectItem>
                                <SelectItem value="CGG">CGG - Gastos Generales</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                ) : (
                    <div><Label>Prefijo</Label><Input value={formData.prefijo_documento} onChange={e => handleInputChange('prefijo_documento', e.target.value)} /></div>
                )}
                
                <div><Label>No. Documento</Label><Input value={formData.numero_documento} onChange={e => handleInputChange('numero_documento', e.target.value)} placeholder="Auto si vacío (compras)" /></div>
                <div><Label>{terceroLabel}</Label>
                    {!terceroPersonalizado ? (
                    <Select value={formData[terceroIdField]} onValueChange={v => v === 'personalizado' ? setTerceroPersonalizado(true) : handleInputChange(terceroIdField, v)}>
                        <SelectTrigger><SelectValue placeholder={`Seleccionar ${terceroLabel}`} /></SelectTrigger>
                        <SelectContent>{terceros.map(t => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}<SelectItem value="personalizado">🖊️ Personalizado</SelectItem></SelectContent>
                    </Select>
                    ) : (<div className="flex gap-2"><Input placeholder={`Escriba nombre de ${terceroLabel}`} value={formData.tercero_personalizado} onChange={e => handleInputChange('tercero_personalizado', e.target.value)}/><Button type="button" variant="outline" size="sm" onClick={() => setTerceroPersonalizado(false)}>Cancelar</Button></div>)}
                </div>
                <div><Label>CC/NIT</Label><Input value={formData[nitField]} onChange={e => handleInputChange(nitField, e.target.value)} /></div>
                {tipoDocumento === 'compra' && tipoItem === 'pieles' && (
                  <div><Label>Código Lote de Piel</Label><Input value={formData.codigo_lote_piel || ''} onChange={e => handleInputChange('codigo_lote_piel', e.target.value)} placeholder="Ej: LOTE-001" /></div>
                )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div><Label>Fecha</Label><Input type="date" value={formData.fecha_orden} onChange={e => handleInputChange('fecha_orden', e.target.value)} required /></div>
                
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
                                <th className="p-2 text-left font-semibold">Código</th>
                                <th className="p-2 text-left font-semibold">Descripción</th>
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
                                                {productosCatalogo.map(p => (
                                                    <option key={p.id} value={p.codigo}>{p.descripcion}</option>
                                                ))}
                                            </datalist>
                                        </div>
                                    </td>
                                    <td className="p-1 min-w-[180px]"><Input value={item.descripcion} onChange={e => handleItemChange(index, 'descripcion', e.target.value)} placeholder="Descripción" className="h-8 text-xs"/></td>
                                    <td className="p-1 min-w-[120px]"><Input value={item.categoria} onChange={e => handleItemChange(index, 'categoria', e.target.value)} placeholder="Cat." className="h-8 text-xs" readOnly title="Auto-fill"/></td>
                                    {tipoDocumento === 'compra' && <td className="p-1 min-w-[100px]"><Input value={item.unidad_medida} onChange={e => handleItemChange(index, 'unidad_medida', e.target.value)} placeholder="U.M." className="h-8 text-xs"/></td>}
                                    <td className="p-1 w-24"><Input type="number" value={item.cantidad} onChange={e => handleItemChange(index, 'cantidad', e.target.value)} placeholder="0" className="text-right"/></td>
                                    <td className="p-1 w-32"><Input type="number" value={item.precio_unitario} onChange={e => handleItemChange(index, 'precio_unitario', e.target.value)} placeholder="0" className="text-right"/></td>
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

            {/* Afecta Inventario y Código de Lote para Compras */}
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
                        <Label>Código de Lote (Opcional)</Label>
                        <Input 
                            value={formData.codigo_lote_inventario || ''} 
                            onChange={e => handleInputChange('codigo_lote_inventario', e.target.value)}
                            placeholder="Auto-generado si vacío"
                        />
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
                                <Label className="font-bold">Tipo de {tipoDocumento === 'venta' ? 'Venta' : 'Compra'} *</Label>
                                <Select value={formData.forma_pago} onValueChange={v => handleInputChange('forma_pago', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="contado">Contado (se paga ahora)</SelectItem>
                                        <SelectItem value="credito">Crédito (saldo pendiente)</SelectItem>
                                    </SelectContent>
                                </Select>
                             </div>
                             
                             {formData.forma_pago === 'contado' && (
                                 <div>
                                    <Label className="font-bold">Medio de Pago *</Label>
                                    <Select value={formData.medio_pago} onValueChange={v => handleInputChange('medio_pago', v)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="efectivo">Efectivo</SelectItem>
                                            <SelectItem value="nequi">Nequi</SelectItem>
                                            <SelectItem value="transferencia">Transferencia Bancaria</SelectItem>
                                            <SelectItem value="tarjeta">Tarjeta/PSE</SelectItem>
                                        </SelectContent>
                                    </Select>
                                 </div>
                             )}
                         </div>

                         {/* Campos condicionales según medio de pago */}
                         {formData.forma_pago === 'contado' && (
                             <div>
                                 {formData.medio_pago === 'efectivo' ? (
                                     <div>
                                         <Label className="font-bold">Caja *</Label>
                                         <Select value={formData.cuenta_destino_id} onValueChange={v => {
                                             const caja = cajas.find(c => c.id === v);
                                             handleInputChange('cuenta_destino_id', v);
                                             handleInputChange('cuenta_destino_nombre', caja?.nombre || '');
                                         }}>
                                             <SelectTrigger><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
                                             <SelectContent>
                                                 {cajas.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                                             </SelectContent>
                                         </Select>
                                     </div>
                                 ) : (
                                     <div>
                                         <Label className="font-bold">Cuenta Destino *</Label>
                                         <Select value={formData.cuenta_destino_id} onValueChange={v => {
                                             const cuenta = cuentasBancarias.find(c => c.id === v);
                                             handleInputChange('cuenta_destino_id', v);
                                             handleInputChange('cuenta_destino_nombre', cuenta ? `${cuenta.banco} - ${cuenta.numero_cuenta}` : '');
                                         }}>
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
                                 )}
                             </div>
                         )}

                         <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                             <div>
                                <Label className="font-bold text-emerald-700">Valor {formData.forma_pago === 'contado' ? 'a Pagar' : 'Efectivo'}</Label>
                                <Input 
                                    type="number" 
                                    value={formData.monto_efectivo} 
                                    onChange={e => handleInputChange('monto_efectivo', parseFloat(e.target.value) || 0)}
                                    className="font-bold"
                                    readOnly={formData.forma_pago === 'contado'}
                                />
                             </div>
                             <div>
                                <Label className="font-bold text-blue-700">Crédito</Label>
                                <Input 
                                    type="number" 
                                    value={formData.monto_credito} 
                                    readOnly 
                                    className="bg-blue-50 font-bold"
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