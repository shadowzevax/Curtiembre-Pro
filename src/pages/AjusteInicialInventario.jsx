import React, { useState, useEffect } from 'react';
import { AjusteInicialInventario, ProductoCatalogo, MovimientoInventario, Insumo, ProductoTerminado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Date(date.getTime() + date.getTimezoneOffset() * 60000).toLocaleDateString('es-CO');
};

export default function AjusteInicialInventarioPage() {
    const [ajustes, setAjustes] = useState([]);
    const [productos, setProductos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [ajustesData, prodData] = await Promise.all([
                AjusteInicialInventario.list(),
                ProductoCatalogo.list()
            ]);
            setAjustes(ajustesData);
            setProductos(prodData);
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
            descripcion: '',
            producto_id: '',
            cantidad_real: 0,
            costo_unitario_estimado: 0,
            fecha: new Date().toISOString().split('T')[0],
            categoria: '',
            unidad_medida: '',
            observaciones: ''
        });
        setShowModal(true);
    };

    const handleProductoChange = (productoId) => {
        const producto = productos.find(p => p.id === productoId);
        if (producto) {
            setCurrentItem(prev => ({
                ...prev,
                producto_id: productoId,
                codigo: producto.codigo,
                descripcion: producto.descripcion,
                categoria: producto.categoria,
                unidad_medida: producto.unidad_medida
            }));
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        
        try {
            let savedItem;
            if (isEditing) {
                await AjusteInicialInventario.update(currentItem.id, currentItem);
                savedItem = currentItem;
            } else {
                savedItem = await AjusteInicialInventario.create(currentItem);
            }
            
            // Generar movimiento de inventario si no se ha generado antes
            if (!isEditing || !currentItem.movimiento_generado) {
                await generarMovimientoInventario(savedItem);
                
                // Marcar como generado
                await AjusteInicialInventario.update(savedItem.id, { movimiento_generado: true });
            }
            
            setShowModal(false);
            loadData();
            alert('✅ Ajuste Inicial guardado exitosamente y registrado en inventario.');
        } catch (error) {
            console.error("Error saving:", error);
            alert("Error al guardar el ajuste inicial.");
        }
    };

    const generarMovimientoInventario = async (ajuste) => {
        try {
            // Determinar la entidad de inventario según categoría
            let entityType = null;
            let inventarioItems = [];

            if (ajuste.categoria === 'materia_prima') {
                inventarioItems = await ProductoTerminado.filter({ codigo: ajuste.codigo, categoria: 'pieles' });
                if (inventarioItems.length > 0) entityType = ProductoTerminado;
            } else if (ajuste.categoria === 'insumos_quimicos') {
                inventarioItems = await Insumo.filter({ codigo: ajuste.codigo });
                if (inventarioItems.length > 0) entityType = Insumo;
            } else if (ajuste.categoria === 'productos_terminados') {
                inventarioItems = await ProductoTerminado.filter({ codigo: ajuste.codigo, categoria: 'producto_terminado' });
                if (inventarioItems.length > 0) entityType = ProductoTerminado;
            } else if (ajuste.categoria === 'productos_en_proceso') {
                inventarioItems = await ProductoTerminado.filter({ codigo: ajuste.codigo, categoria: 'en_proceso' });
                if (inventarioItems.length > 0) entityType = ProductoTerminado;
            }

            if (entityType && inventarioItems.length > 0) {
                const itemInventario = inventarioItems[0];
                
                // Crear movimiento tipo "SALDO INICIAL"
                await MovimientoInventario.create({
                    tipo_movimiento: 'saldo_inicial',
                    insumo_id: itemInventario.id,
                    cantidad: ajuste.cantidad_real,
                    costo_unitario: ajuste.costo_unitario_estimado,
                    fecha_movimiento: ajuste.fecha,
                    referencia: 'SALDO INICIAL',
                    observaciones: `Saldo inicial del sistema - ${ajuste.observaciones || ''}`,
                    usuario_id: 'system'
                });

                // Actualizar stock y costo promedio
                await entityType.update(itemInventario.id, {
                    stock_actual: ajuste.cantidad_real,
                    costo_promedio: ajuste.costo_unitario_estimado
                });

                console.log(`✅ Saldo inicial registrado para ${ajuste.codigo}`);
            } else {
                console.warn(`⚠️ No se encontró producto en inventario para código: ${ajuste.codigo}`);
            }
        } catch (error) {
            console.error("Error generando movimiento de inventario:", error);
            throw error;
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('¿Está seguro de eliminar este ajuste inicial?')) return;
        try {
            await AjusteInicialInventario.delete(id);
            loadData();
            alert('Ajuste eliminado.');
        } catch (error) {
            console.error("Error deleting:", error);
        }
    };

    const headers = ["Código", "Descripción", "Cantidad Real", "Costo Unitario", "Fecha", "Movimiento Generado", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td className="font-mono font-bold">{item.codigo}</td>
            <td>{item.descripcion}</td>
            <td className="text-right">{item.cantidad_real}</td>
            <td className="text-right">{formatCurrency(item.costo_unitario_estimado)}</td>
            <td>{formatDate(item.fecha)}</td>
            <td><span className={`px-2 py-1 rounded text-xs ${item.movimiento_generado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{item.movimiento_generado ? 'Sí' : 'Pendiente'}</span></td>
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
                title="Ajuste Inicial de Inventario" 
                description="Registra el saldo físico real con el que inicia el sistema, sin depender de compras o producciones previas."
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Ajuste Inicial
                    </Button>
                }
            />

            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                    <p className="font-semibold mb-1">Importante:</p>
                    <p>Este módulo debe usarse ÚNICAMENTE para cargar el saldo inicial del sistema. Genera movimientos tipo "SALDO INICIAL" en el kardex que se diferencian de compras, producción o ajustes posteriores. Asegúrese de que los productos ya estén creados en el Catálogo de Productos.</p>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle>Listado de Ajustes Iniciales</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={ajustes} renderRow={renderRow} />}
                </CardContent>
            </Card>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Ajuste Inicial</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Producto *</Label>
                                <Select value={currentItem?.producto_id || ''} onValueChange={handleProductoChange} disabled={isEditing}>
                                    <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
                                    <SelectContent>
                                        {productos.map(p => (
                                            <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.descripcion}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Código</Label>
                                <Input value={currentItem?.codigo || ''} readOnly className="bg-gray-100 font-mono" />
                            </div>
                        </div>
                        <div>
                            <Label>Descripción</Label>
                            <Input value={currentItem?.descripcion || ''} readOnly className="bg-gray-100" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <Label>Cantidad Real *</Label>
                                <Input type="number" step="0.01" value={currentItem?.cantidad_real || ''} onChange={(e) => setCurrentItem({ ...currentItem, cantidad_real: parseFloat(e.target.value) || 0 })} required />
                            </div>
                            <div>
                                <Label>Costo Unitario Estimado *</Label>
                                <Input type="number" step="0.01" value={currentItem?.costo_unitario_estimado || ''} onChange={(e) => setCurrentItem({ ...currentItem, costo_unitario_estimado: parseFloat(e.target.value) || 0 })} required />
                            </div>
                            <div>
                                <Label>Fecha *</Label>
                                <Input type="date" value={currentItem?.fecha || ''} onChange={(e) => setCurrentItem({ ...currentItem, fecha: e.target.value })} required />
                            </div>
                        </div>
                        <div>
                            <Label>Observaciones</Label>
                            <Textarea value={currentItem?.observaciones || ''} onChange={(e) => setCurrentItem({ ...currentItem, observaciones: e.target.value })} rows={3} />
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