import React, { useState, useEffect } from 'react';
import { ProductoCatalogo, UnidadMedida, Insumo, ProductoTerminado, Proveedor, InventarioEnProceso } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Search, RefreshCw } from 'lucide-react';

export default function CatalogoProductos() {
    const [productos, setProductos] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    // Expose productos for other modules
    window.__catalogoProductos = productos;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [prodData, unidadesData, provData] = await Promise.all([
                ProductoCatalogo.list(),
                UnidadMedida.list(),
                Proveedor.list()
            ]);
            setProductos(prodData);
            setUnidades(unidadesData);
            setProveedores(provData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        setCurrentItem(item || {
            codigo: '',
            nombre_comercial: '',
            descripcion: '',
            unidad_medida: '',
            categoria: 'materia_prima',
            tipo_producto: '',
            maneja_inventario: true,
            stock_minimo: 0,
            stock_maximo: 0,
            proveedor_principal_id: '',
            estado: 'activo'
        });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        if (!isEditing) {
            const exists = productos.some(p => p.codigo === currentItem.codigo);
            if (exists) {
                alert('Error: Ya existe un producto con este código.');
                return;
            }
        }

        try {
            if (isEditing) {
                await ProductoCatalogo.update(currentItem.id, { ...currentItem, ultima_modificacion: new Date().toISOString() });
                
                // Sincronizar datos básicos en el inventario espejo al editar
                if (currentItem.maneja_inventario && currentItem.categoria) {
                    try {
                        const updateData = {
                            nombre: currentItem.descripcion,
                            descripcion: currentItem.descripcion,
                            unidad_medida: currentItem.unidad_medida || 'UN',
                            stock_minimo: currentItem.stock_minimo || 0,
                            activo: currentItem.estado === 'activo'
                        };
                        if (currentItem.categoria === 'materia_prima') {
                            const items = await ProductoTerminado.filter({ codigo: currentItem.codigo });
                            if (items.length > 0) await ProductoTerminado.update(items[0].id, updateData);
                        } else if (currentItem.categoria === 'insumos_quimicos') {
                            const items = await Insumo.filter({ codigo: currentItem.codigo });
                            if (items.length > 0) await Insumo.update(items[0].id, updateData);
                        } else if (currentItem.categoria === 'productos_terminados') {
                            const items = await ProductoTerminado.filter({ codigo: currentItem.codigo });
                            if (items.length > 0) await ProductoTerminado.update(items[0].id, updateData);
                        } else if (currentItem.categoria === 'productos_en_proceso') {
                            const items = await InventarioEnProceso.filter({ codigo_producto_proceso: currentItem.codigo });
                            const syncData = {
                                descripcion: currentItem.nombre_comercial || currentItem.descripcion || '',
                                descripcion_producto_proceso: currentItem.nombre_comercial || currentItem.descripcion || '',
                                unidad_medida: currentItem.unidad_medida || 'UN',
                                stock_minimo: currentItem.stock_minimo || 0,
                            };
                            if (items.length > 0) await InventarioEnProceso.update(items[0].id, syncData);
                        }
                    } catch (err) {
                        console.error("Error sincronizando inventario al editar:", err);
                    }
                }
            } else {
                const now = new Date().toISOString();
                const newProduct = await ProductoCatalogo.create({ ...currentItem, fecha_creacion: now, ultima_modificacion: now });
                
                // Auto-crear en el inventario correspondiente según categoría (no aplica para n_a)
                if (newProduct.maneja_inventario && newProduct.categoria && newProduct.categoria !== 'n_a') {
                    try {
                        const baseInventoryData = {
                            codigo: newProduct.codigo,
                            nombre: newProduct.descripcion,
                            descripcion: newProduct.descripcion,
                            unidad_medida: newProduct.unidad_medida || 'UN',
                            stock_actual: 0,
                            stock_minimo: newProduct.stock_minimo || 0,
                            costo_promedio: newProduct.costo_estandar || 0,
                            precio_venta_1: 0,
                            precio_venta_2: 0,
                            iva: 'grabado_19',
                            activo: newProduct.estado === 'activo'
                        };

                        if (newProduct.categoria === 'materia_prima') {
                            await ProductoTerminado.create({...baseInventoryData, categoria: 'pieles'});
                        } else if (newProduct.categoria === 'insumos_quimicos') {
                            await Insumo.create({...baseInventoryData, categoria: 'quimicos'});
                        } else if (newProduct.categoria === 'productos_terminados') {
                            await ProductoTerminado.create({...baseInventoryData, categoria: 'producto_terminado'});
                        } else if (newProduct.categoria === 'productos_en_proceso') {
                            await InventarioEnProceso.create({
                                codigo: newProduct.codigo,
                                descripcion: newProduct.nombre_comercial || newProduct.descripcion || '',
                                codigo_producto_proceso: newProduct.codigo,
                                descripcion_producto_proceso: newProduct.nombre_comercial || newProduct.descripcion || '',
                                unidad_medida: newProduct.unidad_medida || 'UN',
                                stock_minimo: newProduct.stock_minimo || 0,
                                codigo_lote: newProduct.codigo,
                                origen_modulo: 'compras',
                                etapa_actual: 'recurtido',
                                estado_actual: 'EN_PROCESO',
                                destino_sublote: 'disponible_pintura',
                                cantidad_hojas: 0,
                                costo_promedio: 0,
                                costo_acumulado: 0,
                                fecha_ingreso_proceso: new Date().toISOString().split('T')[0],
                            });
                        }
                    } catch (err) {
                        console.error("Error creando en inventario:", err);
                        alert("Producto creado en catálogo, pero hubo un error al agregarlo al inventario. Puede agregarlo manualmente.");
                    }
                }
            }
            setShowModal(false);
            loadData();
            alert('Producto guardado con éxito' + (!isEditing ? ' y agregado al inventario correspondiente.' : '.'));
        } catch (error) {
            console.error("Error saving:", error);
            alert("Error al guardar el producto.");
        }
    };

    const handleSyncAll = async () => {
        if (!confirm('¿Sincronizar todos los productos del catálogo con sus inventarios correspondientes? Solo creará los registros que falten.')) return;
        let creados = 0;
        let errores = 0;
        for (const prod of productos) {
            if (!prod.maneja_inventario || !prod.categoria) continue;
            try {
                const baseData = {
                    codigo: prod.codigo,
                    nombre: prod.descripcion,
                    descripcion: prod.descripcion,
                    unidad_medida: prod.unidad_medida || 'UN',
                    stock_actual: 0,
                    stock_minimo: prod.stock_minimo || 0,
                    costo_promedio: prod.costo_estandar || 0,
                    precio_venta_1: 0,
                    precio_venta_2: 0,
                    iva: 'grabado_19',
                    activo: prod.estado === 'activo'
                };
                if (prod.categoria === 'materia_prima') {
                    const existe = await ProductoTerminado.filter({ codigo: prod.codigo });
                    if (existe.length === 0) { await ProductoTerminado.create({...baseData, categoria: 'pieles'}); creados++; }
                } else if (prod.categoria === 'insumos_quimicos') {
                    const existe = await Insumo.filter({ codigo: prod.codigo });
                    if (existe.length === 0) { await Insumo.create({...baseData, categoria: 'quimicos'}); creados++; }
                } else if (prod.categoria === 'productos_terminados') {
                    const existe = await ProductoTerminado.filter({ codigo: prod.codigo });
                    if (existe.length === 0) { await ProductoTerminado.create({...baseData, categoria: 'producto_terminado'}); creados++; }
                } else if (prod.categoria === 'productos_en_proceso') {
                    const existe = await InventarioEnProceso.filter({ codigo_producto_proceso: prod.codigo });
                    if (existe.length === 0) {
                        await InventarioEnProceso.create({
                            codigo: prod.codigo,
                            descripcion: prod.nombre_comercial || prod.descripcion || '',
                            codigo_producto_proceso: prod.codigo,
                            descripcion_producto_proceso: prod.nombre_comercial || prod.descripcion || '',
                            unidad_medida: prod.unidad_medida || 'UN',
                            stock_minimo: prod.stock_minimo || 0,
                            codigo_lote: prod.codigo,
                            origen_modulo: 'compras',
                            etapa_actual: 'recurtido',
                            estado_actual: 'EN_PROCESO',
                            destino_sublote: 'disponible_pintura',
                            cantidad_hojas: 0,
                            costo_promedio: 0,
                            costo_acumulado: 0,
                            fecha_ingreso_proceso: new Date().toISOString().split('T')[0],
                        });
                        creados++;
                    }
                }
            } catch (err) {
                console.error('Error sincronizando', prod.codigo, err);
                errores++;
            }
        }
        alert(`Sincronización completa.\nRegistros creados: ${creados}\nErrores: ${errores}`);
        loadData();
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar este producto?')) return;
        try {
            await ProductoCatalogo.delete(id);
            loadData();
        } catch (error) {
            console.error("Error deleting:", error);
        }
    };

    const filteredData = productos.filter(p => 
        p.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.descripcion?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const headers = ["Código", "Descripción", "Categoría", "U. Medida", "Estado", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{item.codigo}</td>
            <td>{item.descripcion}</td>
            <td>{item.categoria?.replace(/_/g, ' ')}</td>
            <td>{item.unidad_medida}</td>
            <td><span className={`px-2 py-1 rounded-full text-xs ${item.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.estado}</span></td>
            <td>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <PageHeader 
                title="Catálogo de Productos" 
                description="Catálogo de Productos- Gestión Maestra de Productos."
                actionButton={
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleSyncAll} className="border-blue-500 text-blue-600 hover:bg-blue-50">
                            <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar Inventarios
                        </Button>
                        <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                            <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
                        </Button>
                    </div>
                }
            />

            <Card>
                <CardHeader>
                    <CardTitle>Listado de Productos</CardTitle>
                    <div className="mt-2">
                        <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Buscar..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredData} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Producto</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Código Pcto. *</Label><Input value={currentItem?.codigo} onChange={e => setCurrentItem({...currentItem, codigo: e.target.value})} required disabled={isEditing}/></div>
                            <div><Label>Nombre del Producto *</Label><Input value={currentItem?.descripcion} onChange={e => setCurrentItem({...currentItem, descripcion: e.target.value})} required/></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><Label>Observaciones Técnicas</Label><Input value={currentItem?.nombre_comercial || ''} onChange={e => setCurrentItem({...currentItem, nombre_comercial: e.target.value})}/></div>
                            <div>
                                <Label>Tipo de Producto</Label>
                                <Select value={currentItem?.tipo_producto || ''} onValueChange={v => setCurrentItem({...currentItem, tipo_producto: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cuero">Cuero</SelectItem>
                                        <SelectItem value="pintura">Pintura</SelectItem>
                                        <SelectItem value="pigmento">Pigmento</SelectItem>
                                        <SelectItem value="resina">Resina</SelectItem>
                                        <SelectItem value="sellador">Sellador</SelectItem>
                                        <SelectItem value="laca">Laca</SelectItem>
                                        <SelectItem value="cera">Cera</SelectItem>
                                        <SelectItem value="aceite">Aceite</SelectItem>
                                        <SelectItem value="pegante">Pegante</SelectItem>
                                        <SelectItem value="solvente">Solvente</SelectItem>
                                        <SelectItem value="quimico">Químico</SelectItem>
                                        <SelectItem value="empaque">Empaque</SelectItem>
                                        <SelectItem value="etiqueta">Etiqueta</SelectItem>
                                        <SelectItem value="accesorio">Accesorio</SelectItem>
                                        <SelectItem value="repuesto">Repuesto</SelectItem>
                                        <SelectItem value="herramienta">Herramienta</SelectItem>
                                        <SelectItem value="consumible">Consumible</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Tipo de Acabado</Label>
                                <Select value={currentItem?.tipo_acabado || ''} onValueChange={v => setCurrentItem({...currentItem, tipo_acabado: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NAPA">NAPA</SelectItem>
                                        <SelectItem value="NAPA_MATE">NAPA MATE</SelectItem>
                                        <SelectItem value="OPACO">OPACO</SelectItem>
                                        <SelectItem value="ENVEJECIDO">ENVEJECIDO</SelectItem>
                                        <SelectItem value="N/A">N/A</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Unidad de Medida</Label>
                                <Select value={currentItem?.unidad_medida} onValueChange={v => setCurrentItem({...currentItem, unidad_medida: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {unidades.map(u => <SelectItem key={u.id} value={u.abreviatura}>{u.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Categoría *</Label>
                                <Select value={currentItem?.categoria} onValueChange={v => setCurrentItem({...currentItem, categoria: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="materia_prima">Materia Prima</SelectItem>
                                        <SelectItem value="insumos_quimicos">Insumos y Químicos</SelectItem>
                                        <SelectItem value="productos_en_proceso">Productos en Proceso</SelectItem>
                                        <SelectItem value="productos_terminados">Productos Terminados</SelectItem>
                                        <SelectItem value="n_a">N/A – No Aplica (sin afectar inventarios)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4">
                            <div>
                                <Label>Maneja Inventario</Label>
                                <Select value={currentItem?.maneja_inventario ? 'si' : 'no'} onValueChange={v => setCurrentItem({...currentItem, maneja_inventario: v === 'si'})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="si">Sí</SelectItem><SelectItem value="no">No</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div><Label>Stock Mínimo</Label><Input type="number" value={currentItem?.stock_minimo} onChange={e => setCurrentItem({...currentItem, stock_minimo: parseFloat(e.target.value) || 0})}/></div>
                            <div><Label>Stock Máximo</Label><Input type="number" value={currentItem?.stock_maximo} onChange={e => setCurrentItem({...currentItem, stock_maximo: parseFloat(e.target.value) || 0})}/></div>
                            <div>
                                <Label>Proveedor Principal</Label>
                                <Select value={currentItem?.proveedor_principal_id || ''} onValueChange={v => setCurrentItem({...currentItem, proveedor_principal_id: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        {proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Estado</Label>
                                <Select value={currentItem?.estado} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="activo">Activo</SelectItem>
                                        <SelectItem value="inactivo">Inactivo</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t pt-4 bg-slate-50 -mx-1 px-4 py-3 rounded-lg">
                            <div>
                                <Label className="text-slate-500">Fecha de Creación</Label>
                                <Input
                                    readOnly
                                    value={currentItem?.fecha_creacion ? new Date(currentItem.fecha_creacion).toLocaleString('es-CO') : (isEditing ? '—' : 'Se registrará al guardar')}
                                    className="bg-slate-100 text-slate-500 cursor-not-allowed text-sm font-mono"
                                />
                                <p className="text-xs text-slate-400 mt-0.5">Automático · solo lectura</p>
                            </div>
                            <div>
                                <Label className="text-slate-500">Última Modificación</Label>
                                <Input
                                    readOnly
                                    value={currentItem?.ultima_modificacion ? new Date(currentItem.ultima_modificacion).toLocaleString('es-CO') : (isEditing ? '—' : 'Se registrará al guardar')}
                                    className="bg-slate-100 text-slate-500 cursor-not-allowed text-sm font-mono"
                                />
                                <p className="text-xs text-slate-400 mt-0.5">Automático · solo lectura</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}