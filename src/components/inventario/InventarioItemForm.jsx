import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MovimientoInventario, AjusteInventario, UnidadMedida, Insumo, ProductoTerminado, ProductoCatalogo } from '@/entities/all';
import ProductCreationModal from '../common/ProductCreationModal';
import DataTable from '../common/DataTable';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

const validateDuplicates = async (codigo, descripcion, itemId, tipoInventario) => {
    let existingItems = [];
    
    if (tipoInventario === 'materia_prima' || tipoInventario === 'producto_terminado') {
        existingItems = await ProductoTerminado.list();
    } else if (tipoInventario === 'insumo') {
        existingItems = await Insumo.list();
    }
    
    const duplicateCodigo = existingItems.find(item => 
        item.codigo === codigo && (!itemId || item.id !== itemId)
    );
    
    const duplicateDescripcion = existingItems.find(item => 
        item.descripcion === descripcion && (!itemId || item.id !== itemId)
    );
    
    return { duplicateCodigo, duplicateDescripcion };
};

export default function InventarioItemForm({ open, onOpenChange, onSubmit, item, isEditing, tipoInventario = 'general' }) {
    const [formData, setFormData] = useState(null);
    const [unidadesMedida, setUnidadesMedida] = useState([]);
    const [movimientos, setMovimientos] = useState([]);
    const [ajustes, setAjustes] = useState([]);
    const [showCatalogModal, setShowCatalogModal] = useState(false);
    const [pendingCode, setPendingCode] = useState("");
    const [productosCatalogo, setProductosCatalogo] = useState([]);

    useEffect(() => {
        if (open) {
            const fetchInitialData = async () => {
                const unidades = await UnidadMedida.list();
                const catalogo = await ProductoCatalogo.list();
                setProductosCatalogo(catalogo);
                setUnidadesMedida(unidades);

                if (item) {
                    // Ordenar movimientos por fecha descendente para mostrar los más recientes primero
                    const itemMovimientos = await MovimientoInventario.filter({ insumo_id: item.id });
                    const itemAjustes = await AjusteInventario.filter({ producto_id: item.id });
                    
                    setMovimientos(itemMovimientos.sort((a, b) => new Date(b.fecha_movimiento) - new Date(a.fecha_movimiento)));
                    setAjustes(itemAjustes);
                    
                    // Calcular existencia desde ajustes
                    const existencia = itemAjustes.reduce((sum, a) => sum + (a.cantidad_fisica || 0), 0);
                    
                    // Calcular stock_actual desde movimientos
                    const stockActual = itemMovimientos.reduce((sum, m) => sum + (m.cantidad || 0), 0);
                    
                    setFormData({ 
                        ...item, 
                        descripcion: item.descripcion || item.nombre || '',
                        existencia,
                        stock_actual: stockActual
                    });
                } else {
                     setFormData({
                        codigo: '',
                        nombre: '',
                        descripcion: '',
                        categoria: 'pieles',
                        unidad_medida: '',
                        stock_actual: 0,
                        stock_minimo: 0,
                        iva: 'grabado_19',
                        costo_promedio: 0,
                        precio_venta_1: 0,
                        precio_venta_2: 0,
                        existencia: 0
                    });
                    setMovimientos([]);
                    setAjustes([]);
                }
            };
            fetchInitialData();
        }
    }, [open, item]);

    const handleInputChange = async (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Auto-fill desde Catálogo
        if (field === 'codigo' && value.length > 2 && !isEditing) { // Trigger con longitud mínima para no molestar
             try {
                 const products = await ProductoCatalogo.filter({ codigo: value });
                 if (products && products.length > 0) {
                     const p = products[0];
                     setFormData(prev => ({
                         ...prev,
                         descripcion: p.descripcion,
                         unidad_medida: p.unidad_medida || prev.unidad_medida,
                         costo_promedio: p.costo_estandar || prev.costo_promedio
                     }));
                 }
             } catch (e) { console.error(e); }
        }
    };
    
    const handleCodeBlur = async () => {
        if (!formData.codigo || isEditing) return;
        
        // Verificar si existe en catálogo
        const products = await ProductoCatalogo.filter({ codigo: formData.codigo });
        if (!products || products.length === 0) {
            if (window.confirm("ESTE PRODUCTO NO ESTA EN EL CATALOGO DESEA CREARLO?")) {
                setPendingCode(formData.codigo);
                setShowCatalogModal(true);
            }
        }
    };
    
    const handleCatalogSuccess = (newProduct) => {
         setFormData(prev => ({
             ...prev,
             codigo: newProduct.codigo,
             descripcion: newProduct.descripcion,
             unidad_medida: newProduct.unidad_medida || prev.unidad_medida,
             costo_promedio: newProduct.costo_estandar || prev.costo_promedio
         }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        // Validar duplicados
        const { duplicateCodigo, duplicateDescripcion } = await validateDuplicates(
            formData.codigo, 
            formData.descripcion, 
            item?.id, 
            tipoInventario
        );
        
        if (duplicateCodigo) {
            alert('Error: Ya existe un producto con el mismo Código.');
            return;
        }
        
        if (duplicateDescripcion) {
            alert('Error: Ya existe un producto con la misma Descripción.');
            return;
        }
        
        const dataToSave = { ...formData };
        // No guardar descripcion si es insumo, solo nombre
        if (!dataToSave.descripcion && dataToSave.nombre) {
            dataToSave.descripcion = dataToSave.nombre;
        }
        delete dataToSave.existencia; // No guardar existencia en el producto, es calculado
        onSubmit(dataToSave);
    };

    if (!formData) return null;

    // Título dinámico según tipo de inventario
    const getTitulo = () => {
        if (isEditing) return 'Editar Ítem de Inventario';
        switch(tipoInventario) {
            case 'materia_prima': return 'Nuevo Ítem Inventario de Materias Primas';
            case 'insumo': return 'Nuevo Ítem Inventario de Insumos y Químicos';
            case 'producto_terminado': return 'Nuevo Ítem Inventario de Productos Terminados';
            default: return 'Nuevo Ítem de Inventario';
        }
    };

    const headersMovimientos = ["Fecha", "Documento", "Cantidad", "U. Medida", "Costo Promedio"];
    const renderMovimientoRow = (m) => (
        <tr key={m.id}>
            <td>{new Date(m.fecha_movimiento).toLocaleDateString()}</td>
            <td>{m.referencia}</td>
            <td className={m.tipo_movimiento === 'entrada' ? 'text-green-600' : 'text-red-600'}>{m.cantidad}</td>
            <td>{formData.unidad_medida}</td>
            <td>{formatCurrency(m.costo_unitario)}</td>
        </tr>
    );

    const headersAjustes = ["Consecutivo", "Fecha", "Quién Elaboró", "Stock Actual", "Cantidad Física", "Diferencia"];
    const renderAjusteRow = (a) => (
        <tr key={a.id}>
            <td>{a.consecutivo}</td>
            <td>{new Date(a.fecha).toLocaleDateString()}</td>
            <td>{a.quien_elaboro || 'N/A'}</td>
            <td>{a.stock_actual}</td>
            <td className="font-bold">{a.cantidad_fisica}</td>
            <td className={a.diferencia > 0 ? 'text-green-600 font-bold' : a.diferencia < 0 ? 'text-red-600 font-bold' : ''}>
                {a.diferencia}
            </td>
        </tr>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{getTitulo()}</DialogTitle>
                    <DialogDescription>Gestiona los detalles del producto o insumo.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">
                    <Tabs defaultValue="general">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="general">Información General</TabsTrigger>
                            <TabsTrigger value="movimientos">Movimientos</TabsTrigger>
                            <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
                        </TabsList>
                        <TabsContent value="general" className="pt-4 space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                              <Label>Código *</Label>
                              <Select value={formData.codigo} onValueChange={v => handleInputChange('codigo', v)} disabled={isEditing}>
                                  <SelectTrigger><SelectValue placeholder="Seleccionar código" /></SelectTrigger>
                                  <SelectContent>
                                      {productosCatalogo.map(p => (
                                          <SelectItem key={p.id} value={p.codigo}>{p.codigo} - {p.descripcion}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                                <div className="col-span-2">
                              <Label>Descripción *</Label>
                              <Select value={formData.descripcion} onValueChange={v => {
                                  const prod = productosCatalogo.find(p => p.descripcion === v);
                                  if (prod) handleInputChange('codigo', prod.codigo);
                                  else setFormData(prev => ({...prev, descripcion: v}));
                              }} disabled={isEditing}>
                                  <SelectTrigger><SelectValue placeholder="Seleccionar descripción" /></SelectTrigger>
                                  <SelectContent>
                                      {productosCatalogo.map(p => (
                                          <SelectItem key={p.id} value={p.descripcion}>{p.descripcion}</SelectItem>
                                      ))}
                                  </SelectContent>
                              </Select>
                          </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Tipo de Producto</Label>
                                    <Select value={formData.categoria} onValueChange={v => handleInputChange('categoria', v)} disabled={isEditing}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pieles">Pieles</SelectItem>
                                            <SelectItem value="quimicos">Químicos</SelectItem>
                                            <SelectItem value="colorantes">Colorantes</SelectItem>
                                            <SelectItem value="grasas">Grasas</SelectItem>
                                            <SelectItem value="hojas_materia_prima">Hojas (Materia Prima)</SelectItem>
                                            <SelectItem value="hojas_procesadas">Hojas (Procesadas)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Unidad de Medida</Label>
                                    <Select value={formData.unidad_medida} onValueChange={v => handleInputChange('unidad_medida', v)} disabled={isEditing}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                        <SelectContent>
                                          {unidadesMedida
                                            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
                                            .map(u => <SelectItem key={u.id} value={u.abreviatura}>{u.nombre} ({u.abreviatura})</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div>
                                    <Label>IVA</Label>
                                    <Select value={formData.iva} onValueChange={v => handleInputChange('iva', v)} disabled={isEditing}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="grabado_19">Grabado (19%)</SelectItem>
                                            <SelectItem value="grabado_5">Grabado (5%)</SelectItem>
                                            <SelectItem value="excluido">Excluido</SelectItem>
                                            <SelectItem value="excento">Excento</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                             <div className="grid grid-cols-4 gap-4">
                                <div><Label>Stock Actual</Label><Input type="number" value={formData.stock_actual} readOnly className="bg-gray-100 font-medium" title="Calculado desde movimientos" /></div>
                                <div><Label>Stock Mínimo</Label><Input type="number" value={formData.stock_minimo} readOnly={isEditing} className={isEditing ? "bg-gray-100" : ""} onChange={e => handleInputChange('stock_minimo', parseFloat(e.target.value) || 0)}/></div>
                                <div><Label>Costo Promedio</Label><Input type="number" value={formData.costo_promedio} readOnly className="bg-gray-100" title="Calculado automáticamente por el sistema" /></div>
                                <div><Label>Existencia</Label><Input type="number" value={formData.existencia} readOnly className="bg-blue-50 font-bold text-blue-600" title="Calculado desde ajustes" /></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div><Label>Precio Venta 1</Label><Input type="number" value={formData.precio_venta_1} onChange={e => handleInputChange('precio_venta_1', parseFloat(e.target.value) || 0)}/></div>
                                <div><Label>Precio Venta 2</Label><Input type="number" value={formData.precio_venta_2} onChange={e => handleInputChange('precio_venta_2', parseFloat(e.target.value) || 0)}/></div>
                            </div>
                        </TabsContent>
                        <TabsContent value="movimientos" className="pt-4">
                            <div className="border rounded-lg overflow-hidden">
                                <DataTable headers={headersMovimientos} data={movimientos} renderRow={renderMovimientoRow} />
                            </div>
                        </TabsContent>
                        <TabsContent value="ajustes" className="pt-4">
                            <div className="border rounded-lg overflow-hidden">
                                {ajustes.length > 0 ? (
                                    <DataTable headers={headersAjustes} data={ajustes} renderRow={renderAjusteRow} />
                                ) : (
                                    <div className="p-8 text-center text-gray-500">
                                        No hay ajustes registrados para este producto.
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                    <div className="flex justify-end pt-4 gap-2 border-t">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit">Guardar</Button>
                    </div>
                </form>
                
                <ProductCreationModal 
                    open={showCatalogModal} 
                    onOpenChange={setShowCatalogModal}
                    onSuccess={handleCatalogSuccess}
                    initialCode={pendingCode}
                    initialDescription={formData?.descripcion}
                />
            </DialogContent>
        </Dialog>
    );
}