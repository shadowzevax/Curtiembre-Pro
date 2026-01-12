import React, { useState, useEffect } from 'react';
import { DocumentoInventario, ProductoCatalogo, UnidadMedida, MovimientoInventario, Insumo, ProductoTerminado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Eye } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function AjusteInventario() {
    const [activeTab, setActiveTab] = useState('inventario_inicial');
    const [documentos, setDocumentos] = useState([]);
    const [productos, setProductos] = useState([]);
    const [unidades, setUnidades] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [currentDoc, setCurrentDoc] = useState(null);
    const [showDetail, setShowDetail] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [docs, prods, units] = await Promise.all([
                DocumentoInventario.list(),
                ProductoCatalogo.list(),
                UnidadMedida.list()
            ]);
            setDocumentos(docs);
            setProductos(prods);
            setUnidades(units);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getNextSequence = (type) => {
        const prefix = type === 'inventario_inicial' ? 'INI' : (type === 'ajuste_entrada' ? 'AJE' : 'AJS');
        const typeDocs = documentos.filter(d => d.tipo_documento === type);
        const count = typeDocs.length + 1;
        return `${prefix}-${String(count).padStart(3, '0')}`;
    };

    const handleOpenModal = () => {
        const nextSeq = getNextSequence(activeTab);
        setCurrentDoc({
            tipo_documento: activeTab,
            numero_documento: nextSeq,
            fecha: new Date().toISOString().split('T')[0],
            responsable: '',
            observaciones: '',
            motivo_ajuste: '',
            items: []
        });
        setShowModal(true);
    };

    const addItem = () => {
        setCurrentDoc(prev => ({
            ...prev,
            items: [...prev.items, {
                codigo_producto: '',
                descripcion: '',
                unidad_medida: '',
                existencia_actual: 0,
                cantidad: 0,
                nueva_existencia: 0,
                costo_unitario: 0,
                costo_total: 0,
                nuevo_costo_promedio: 0
            }]
        }));
    };

    const updateItem = (index, field, value) => {
        const newItems = [...currentDoc.items];
        newItems[index][field] = value;

        if (field === 'codigo_producto') {
            const prod = productos.find(p => p.codigo === value);
            if (prod) {
                newItems[index].descripcion = prod.descripcion;
                newItems[index].unidad_medida = prod.unidad_medida;
                newItems[index].costo_unitario = prod.costo_estandar || 0;
                // Assuming existence is 0 for now as we don't have live stock calculation in this component yet
                // In a real scenario, we should fetch current stock from an inventory service
                newItems[index].existencia_actual = 0; 
            }
        }

        if (field === 'cantidad' || field === 'costo_unitario') {
            const cant = parseFloat(field === 'cantidad' ? value : newItems[index].cantidad) || 0;
            const cost = parseFloat(field === 'costo_unitario' ? value : newItems[index].costo_unitario) || 0;
            newItems[index].costo_total = cant * cost;
            
            const existencia = parseFloat(newItems[index].existencia_actual) || 0;
            if (activeTab === 'ajuste_entrada') {
                newItems[index].nueva_existencia = existencia + cant;
            } else if (activeTab === 'ajuste_salida') {
                newItems[index].nueva_existencia = existencia - cant;
            } else {
                // Inventario Inicial
                newItems[index].nueva_existencia = cant;
            }
        }

        setCurrentDoc(prev => ({ ...prev, items: newItems }));
    };

    const removeItem = (index) => {
        const newItems = currentDoc.items.filter((_, i) => i !== index);
        setCurrentDoc(prev => ({ ...prev, items: newItems }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            await DocumentoInventario.create(currentDoc);
            
            // Generar Movimientos de Inventario para cada ítem del ajuste
            for (const item of currentDoc.items) {
                if (item.codigo_producto) {
                    // Identificar si es Insumo o Producto Terminado para obtener ID y Costo Promedio
                    let entityId = null;
                    let costoPromedio = 0;
                    let entityType = null;

                    // Buscar en Catálogo para referencia básica (aunque movimientos linkean a Insumo/ProductoTerminado físico)
                    // Intentar buscar en Insumos primero
                    const insumos = await Insumo.filter({ codigo: item.codigo_producto });
                    if (insumos.length > 0) {
                        entityId = insumos[0].id;
                        costoPromedio = insumos[0].costo_promedio || 0;
                        entityType = Insumo;
                    } else {
                        const productos = await ProductoTerminado.filter({ codigo: item.codigo_producto });
                        if (productos.length > 0) {
                            entityId = productos[0].id;
                            costoPromedio = productos[0].costo_promedio || 0;
                            entityType = ProductoTerminado;
                        }
                    }

                    if (entityId) {
                        // Determinar cantidad (positiva o negativa) según el tipo de ajuste
                        let cantidadMovimiento = parseFloat(item.cantidad) || 0;
                        let tipoMovimiento = 'ajuste';
                        
                        if (currentDoc.tipo_documento === 'ajuste_salida') {
                            cantidadMovimiento = -Math.abs(cantidadMovimiento);
                            tipoMovimiento = 'salida';
                        } else if (currentDoc.tipo_documento === 'ajuste_entrada' || currentDoc.tipo_documento === 'inventario_inicial') {
                            cantidadMovimiento = Math.abs(cantidadMovimiento);
                            tipoMovimiento = 'entrada';
                        }

                        // "EL COSTO PROMEDIO DEBE TOMAR EL ULTIMO COSTO PROMEDIO QUE APAREZCA EN LA SECCIÓN MOVIMIENTOS"
                        // Usamos el costo promedio actual almacenado en el producto.
                        
                        await MovimientoInventario.create({
                            tipo_movimiento: tipoMovimiento,
                            insumo_id: entityId, // Campo FK genérico
                            cantidad: cantidadMovimiento,
                            costo_unitario: costoPromedio, // Usar costo promedio histórico
                            fecha_movimiento: currentDoc.fecha,
                            referencia: `${currentDoc.numero_documento} (${currentDoc.tipo_documento})`,
                            observaciones: currentDoc.motivo_ajuste || currentDoc.observaciones,
                            usuario_id: 'system'
                        });

                        // Opcional: Actualizar stock en la entidad producto para reflejar el ajuste inmediatamente en cache
                        if (entityType) {
                             // Recalcular stock total leyendo movimientos podría ser más seguro, pero un update simple funciona si asumimos integridad
                             const movs = await MovimientoInventario.filter({ insumo_id: entityId });
                             const stockTotal = movs.reduce((acc, m) => acc + m.cantidad, 0);
                             await entityType.update(entityId, { stock_actual: stockTotal });
                        }
                    }
                }
            }

            setShowModal(false);
            loadData();
            alert('Documento guardado con éxito y movimientos generados.');
        } catch (error) {
            console.error("Error saving:", error);
            alert("Error al guardar el documento.");
        }
    };

    const handleView = (doc) => {
        setSelectedDoc(doc);
        setShowDetail(true);
    };

    const filteredDocs = documentos.filter(d => d.tipo_documento === activeTab);
    const headers = ["Número", "Fecha", "Motivo", "Responsable", "Items", "Observaciones", "Acciones"];
    
    const renderRow = (doc) => (
        <tr key={doc.id}>
            <td>{doc.numero_documento}</td>
            <td>{new Date(doc.fecha).toLocaleDateString()}</td>
            <td>{doc.motivo_ajuste || 'N/A'}</td>
            <td>{doc.responsable}</td>
            <td>{doc.items?.length || 0}</td>
            <td>{doc.observaciones}</td>
            <td>
                <Button variant="outline" size="sm" onClick={() => handleView(doc)}><Eye className="w-4 h-4" /></Button>
            </td>
        </tr>
    );

    const motivosEntrada = [
        "Sobrante de inventario",
        "Error de digitación anterior",
        "Recuperación de material",
        "Reconteo de inventario"
    ];

    const motivosSalida = [
        "Faltante en inventario",
        "Producto dañado o vencido",
        "Pérdida o merma",
        "Error de digitación anterior"
    ];

    return (
        <div className="p-6">
            <PageHeader 
                title="Ajuste de Inventario" 
                description="Gestión de ajustes manuales de inventario."
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="inventario_inicial">Inventario Inicial</TabsTrigger>
                    <TabsTrigger value="ajuste_entrada">Ajuste por Entrada</TabsTrigger>
                    <TabsTrigger value="ajuste_salida">Ajuste por Salida</TabsTrigger>
                </TabsList>

                <div className="mb-4 flex justify-end">
                    <Button onClick={handleOpenModal} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo {activeTab.replace('_', ' ')}
                    </Button>
                </div>

                <Card>
                    <CardContent className="pt-6">
                        {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredDocs} renderRow={renderRow} />}
                    </CardContent>
                </Card>
            </Tabs>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Nuevo {activeTab.replace('_', ' ')}</DialogTitle></DialogHeader>
                    <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }}>
                        <div className="grid grid-cols-4 gap-4 mb-4">
                            <div><Label>Número Documento</Label><Input value={currentDoc?.numero_documento} readOnly className="bg-gray-100"/></div>
                            <div><Label>Fecha del Ajuste</Label><Input type="date" value={currentDoc?.fecha} onChange={e => setCurrentDoc({...currentDoc, fecha: e.target.value})} required/></div>
                            
                            {activeTab !== 'inventario_inicial' && (
                                <div>
                                    <Label>Motivo del Ajuste</Label>
                                    <Select value={currentDoc?.motivo_ajuste} onValueChange={v => setCurrentDoc({...currentDoc, motivo_ajuste: v})}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                        <SelectContent>
                                            {(activeTab === 'ajuste_entrada' ? motivosEntrada : motivosSalida).map(m => (
                                                <SelectItem key={m} value={m}>{m}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                            
                            <div><Label>Responsable</Label><Input value={currentDoc?.responsable} onChange={e => setCurrentDoc({...currentDoc, responsable: e.target.value})} required/></div>
                        </div>
                        <div><Label>Observaciones</Label><Textarea value={currentDoc?.observaciones} onChange={e => setCurrentDoc({...currentDoc, observaciones: e.target.value})} rows={2}/></div>
                        
                        <div className="mt-6">
                            <div className="flex justify-between mb-2">
                                <h3 className="font-semibold">Items</h3>
                                <Button type="button" onClick={addItem} size="sm"><Plus className="w-4 h-4 mr-2"/> Agregar Item</Button>
                            </div>
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="p-2 text-left min-w-[150px]">Código del Producto</th>
                                            <th className="p-2 text-left min-w-[150px]">Descripción</th>
                                            <th className="p-2 text-left w-24">U. Medida</th>
                                            {activeTab !== 'inventario_inicial' && <th className="p-2 text-right w-24">Exist. Actual</th>}
                                            <th className="p-2 text-right w-24">Cant. Ajuste</th>
                                            {activeTab !== 'inventario_inicial' && <th className="p-2 text-right w-24">Nueva Exist.</th>}
                                            <th className="p-2 text-right w-32">Costo Unit.</th>
                                            <th className="p-2 text-right w-32">Costo Total</th>
                                            {activeTab === 'ajuste_entrada' && <th className="p-2 text-right w-32">Nuevo Prom.</th>}
                                            <th className="p-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {currentDoc?.items.map((item, idx) => (
                                            <tr key={idx} className="border-t">
                                                <td className="p-2">
                                                    <Select value={item.codigo_producto} onValueChange={v => updateItem(idx, 'codigo_producto', v)}>
                                                        <SelectTrigger><SelectValue placeholder="Buscar..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {productos.map(p => (
                                                                <SelectItem key={p.id} value={p.codigo}>{p.codigo} - {p.descripcion}</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                                <td className="p-2"><Input value={item.descripcion} readOnly className="bg-gray-50"/></td>
                                                <td className="p-2"><Input value={item.unidad_medida} readOnly className="bg-gray-50"/></td>
                                                
                                                {activeTab !== 'inventario_inicial' && (
                                                    <td className="p-2"><Input value={item.existencia_actual} readOnly className="text-right bg-gray-50"/></td>
                                                )}
                                                
                                                <td className="p-2"><Input type="number" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)} className="text-right"/></td>
                                                
                                                {activeTab !== 'inventario_inicial' && (
                                                    <td className="p-2"><Input value={item.nueva_existencia} readOnly className="text-right bg-blue-50 font-medium"/></td>
                                                )}
                                                
                                                <td className="p-2"><Input type="number" value={item.costo_unitario} onChange={e => updateItem(idx, 'costo_unitario', e.target.value)} className="text-right"/></td>
                                                <td className="p-2 text-right font-medium">{formatCurrency(item.costo_total)}</td>
                                                
                                                {activeTab === 'ajuste_entrada' && (
                                                    <td className="p-2"><Input type="number" value={item.nuevo_costo_promedio} onChange={e => updateItem(idx, 'nuevo_costo_promedio', e.target.value)} className="text-right" placeholder="Calc."/></td>
                                                )}
                                                
                                                <td className="p-2"><Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="w-4 h-4 text-red-500"/></Button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-6">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={showDetail} onOpenChange={setShowDetail}>
                <DialogContent className="max-w-6xl">
                    <DialogHeader><DialogTitle>Detalle Documento {selectedDoc?.numero_documento}</DialogTitle></DialogHeader>
                    {selectedDoc && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-4 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                                <div><span className="font-semibold">Fecha:</span> {new Date(selectedDoc.fecha).toLocaleDateString()}</div>
                                <div><span className="font-semibold">Responsable:</span> {selectedDoc.responsable}</div>
                                <div><span className="font-semibold">Tipo:</span> {selectedDoc.tipo_documento.replace('_', ' ')}</div>
                                {selectedDoc.motivo_ajuste && <div><span className="font-semibold">Motivo:</span> {selectedDoc.motivo_ajuste}</div>}
                            </div>
                            {selectedDoc.observaciones && <div className="text-sm"><strong>Observaciones:</strong> {selectedDoc.observaciones}</div>}
                            
                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-2 text-left">Producto</th>
                                            <th className="p-2 text-left">Descripción</th>
                                            <th className="p-2 text-right">Cant.</th>
                                            {selectedDoc.tipo_documento !== 'inventario_inicial' && <th className="p-2 text-right">Nueva Ex.</th>}
                                            <th className="p-2 text-right">Costo Unit.</th>
                                            <th className="p-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedDoc.items.map((item, idx) => (
                                            <tr key={idx} className="border-t">
                                                <td className="p-2">{item.codigo_producto}</td>
                                                <td className="p-2">{item.descripcion}</td>
                                                <td className="p-2 text-right">{item.cantidad} {item.unidad_medida}</td>
                                                {selectedDoc.tipo_documento !== 'inventario_inicial' && <td className="p-2 text-right">{item.nueva_existencia}</td>}
                                                <td className="p-2 text-right">{formatCurrency(item.costo_unitario)}</td>
                                                <td className="p-2 text-right">{formatCurrency(item.costo_total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setShowDetail(false)}>Cerrar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}