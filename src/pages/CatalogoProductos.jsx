import React, { useState, useEffect } from 'react';
import { ProductoCatalogo, UnidadMedida, Insumo, ProductoTerminado, Proveedor } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

export default function CatalogoProductos() {
    const [productos, setProductos] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

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
        
        // Validate duplicate code
        if (!isEditing) {
            const exists = productos.some(p => p.codigo === currentItem.codigo);
            if (exists) {
                alert('Error: Ya existe un producto con este código.');
                return;
            }
        }

        try {
            if (isEditing) {
                await ProductoCatalogo.update(currentItem.id, currentItem);
            } else {
                const newProduct = await ProductoCatalogo.create(currentItem);
                
                // Auto-create in inventory based on category
                if (newProduct.maneja_inventario && newProduct.categoria) {
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
                            // Crear SOLO en Inventario de Materias Primas (ProductoTerminado con categoría específica)
                            await ProductoTerminado.create({...baseInventoryData, categoria: 'pieles'});
                            console.log('✅ Producto creado en Inventario de Materias Primas');
                        } else if (newProduct.categoria === 'insumos_quimicos') {
                            // Crear SOLO en Inventario de Insumos (Insumo)
                            await Insumo.create({...baseInventoryData, categoria: 'quimicos'});
                            console.log('✅ Producto creado en Inventario de Insumos y Químicos');
                        } else if (newProduct.categoria === 'productos_terminados') {
                            // Crear SOLO en Inventario de Productos Terminados (ProductoTerminado con categoría diferente)
                            await ProductoTerminado.create({...baseInventoryData, categoria: 'producto_terminado'});
                            console.log('✅ Producto creado SOLO en Inventario de Productos Terminados');
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
                description="Gestión maestra de productos y servicios."
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
                    </Button>
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
                            <div><Label>Descripción</Label><Input value={currentItem?.nombre_comercial || ''} onChange={e => setCurrentItem({...currentItem, nombre_comercial: e.target.value})}/></div>
                            <div>
                                <Label>Tipo de Producto</Label>
                                <Select value={currentItem?.tipo_producto || ''} onValueChange={v => setCurrentItem({...currentItem, tipo_producto: v})}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="hojas_crudas_en_pelo">Hojas Crudas en Pelo</SelectItem>
                                        <SelectItem value="hojas_saladas">Hojas Saladas</SelectItem>
                                        <SelectItem value="retazos">Retazos</SelectItem>
                                        <SelectItem value="anilinas">Anilinas</SelectItem>
                                        <SelectItem value="colorantes">Colorantes</SelectItem>
                                        <SelectItem value="selladores">Selladores</SelectItem>
                                        <SelectItem value="pigmentos">Pigmentos</SelectItem>
                                        <SelectItem value="taninos">Taninos</SelectItem>
                                        <SelectItem value="sales_cloruros">Sales y Cloruros</SelectItem>
                                        <SelectItem value="solventes">Solventes</SelectItem>
                                        <SelectItem value="aceites_grasas">Aceites y Grasas</SelectItem>
                                        <SelectItem value="aditivos_especiales">Aditivos Especiales (Anticoagulantes, Plastificantes, Suavizantes)</SelectItem>
                                        <SelectItem value="adhesivos">Adhesivos</SelectItem>
                                        <SelectItem value="catalizadores">Catalizadores</SelectItem>
                                        <SelectItem value="detergentes_auxiliares">Detergentes y Auxiliares de Limpieza</SelectItem>
                                        <SelectItem value="acidos_bases">Ácidos y Bases (pH Ajustadores)</SelectItem>
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