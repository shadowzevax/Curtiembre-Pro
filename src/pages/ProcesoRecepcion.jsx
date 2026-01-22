import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion, Insumo, ProductoTerminado, Proveedor, OrdenCompra } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Edit, Trash2, Eye, FileText, Table } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function ProcesoRecepcion() {
  const [recepciones, setRecepciones] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSublotesModal, setShowSublotesModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyData, setHistoryData] = useState({});
  const [sublotes, setSublotes] = useState([]);
  const [nextLoteNumber, setNextLoteNumber] = useState(1);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [loteConsolidado, setLoteConsolidado] = useState(null);
  const [lotesCompras, setLotesCompras] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recepcionesData, insumosData, productosData, proveedoresData, comprasData] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'recepcion' }),
        Insumo.list(),
        ProductoTerminado.list(),
        Proveedor.list(),
        OrdenCompra.list()
      ]);
      setRecepciones(recepcionesData);
      setInsumos(insumosData);
      setProductos(productosData);
      setProveedores(proveedoresData);
      
      // Extraer códigos de lote únicos de compras
      const lotes = comprasData
        .filter(c => c.codigo_lote_inventario)
        .map(c => c.codigo_lote_inventario);
      setLotesCompras([...new Set(lotes)]);
      
      // Calcular el siguiente número de lote
      if (recepcionesData.length > 0) {
        const lotes = recepcionesData.map(r => {
          const match = r.codigo_lote?.match(/L(\d+)/);
          return match ? parseInt(match[1]) : 0;
        });
        const maxLote = Math.max(...lotes, 0);
        setNextLoteNumber(maxLote + 1);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    if (!item) {
      const codigoLote = `L${String(nextLoteNumber).padStart(4, '0')}`;
      setCurrentItem({
        tipo_proceso: 'recepcion',
        codigo_lote: codigoLote,
        fecha_inicio: new Date().toISOString().split('T')[0],
        proveedor_id: '',
        no_documento: '',
        nombre_inventario: '',
        cantidad_total_lote_hojas: 0,
        cantidad_total_lote_pieles: 0,
        peso_total: 0,
        peso_promedio_estandar_por_piel: 0,
        dividir_lote: false,
        num_sublotes: 0,
        sublotes: [],
        observaciones: '',
        nombre_curtidor: '',
        estado: 'pendiente'
      });
    } else {
      setCurrentItem(item);
    }
    setSublotes(item?.sublotes || []);
    setShowModal(true);
  };

  const handleGenerateSublotes = () => {
    const num = parseInt(currentItem.num_sublotes) || 0;
    if (num > 0) {
      const newSublotes = Array.from({ length: num }, (_, i) => ({
        codigo: `${currentItem.codigo_lote}-SUB${i + 1}`,
        cantidad: 0
      }));
      setSublotes(newSublotes);
    }
  };

  const handleSubloteChange = (index, field, value) => {
    const updated = [...sublotes];
    updated[index][field] = value;
    setSublotes(updated);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    // Validar duplicado de código lote
    if (!isEditing) {
        const exists = recepciones.some(r => r.codigo_lote === currentItem.codigo_lote);
        if (exists) {
            alert('El CÓDIGO DE LOTE YA EXISTE. POR FAVOR, VERIFIQUE.');
            return;
        }
    }

    try {
      const dataToSave = {
        ...currentItem,
        sublotes: currentItem.dividir_lote ? sublotes : [],
        numero_proceso: currentItem.codigo_lote
      };
      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
      } else {
        await ProcesoProduccion.create(dataToSave);
      }
      setShowModal(false);
      loadData();
      alert('Recepción guardada con éxito.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar la recepción.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta recepción?')) return;
    try {
      await ProcesoProduccion.delete(id);
      loadData();
      alert('Recepción eliminada.');
    } catch (error) {
      console.error('Error deleting:', error);
      alert('Error al eliminar.');
    }
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleViewHistory = async (item) => {
    setLoading(true);
    try {
        // Buscar todos los procesos relacionados con este lote
        const allProcesos = await ProcesoProduccion.filter({ codigo_lote: item.codigo_lote });
        
        // Agrupar por etapa
        const history = {
            recepcion: allProcesos.filter(p => p.tipo_proceso === 'recepcion'),
            remojo: allProcesos.filter(p => p.tipo_proceso === 'limpieza' && p.seccion === 'remojo'),
            pelambre: allProcesos.filter(p => p.tipo_proceso === 'limpieza' && p.seccion === 'pelambre'),
            curtido: allProcesos.filter(p => p.tipo_proceso === 'curtido'),
            recurtido: allProcesos.filter(p => p.tipo_proceso === 'recurtido'),
            acabado: allProcesos.filter(p => p.tipo_proceso === 'acabado'),
        };
        
        setHistoryData(history);
        setSelectedItem(item);
        setShowHistoryModal(true);
    } catch (e) {
        console.error(e);
        alert("Error cargando historial");
    } finally {
        setLoading(false);
    }
  };

  const handleExport = () => alert('Función de exportar en desarrollo.');
  const handlePrint = () => window.print();

  // Combinar insumos y productos para el selector
  const todosLosItems = [
    ...insumos.map(i => ({ ...i, tipo: 'insumo', displayName: i.nombre || i.descripcion })),
    ...productos.map(p => ({ ...p, tipo: 'producto', displayName: p.descripcion || p.nombre }))
  ];

  const headers = ['Código Lote', 'Fecha', 'Proveedor', 'Nombre Inventario', 'Cant. Hojas', 'Cant. Pieles', 'Peso Total', 'Estado', 'Acciones'];
  const renderRow = (item) => {
    const proveedor = proveedores.find(p => p.id === item.proveedor_id);
    return (
    <tr key={item.id}>
      <td>{item.codigo_lote}</td>
      <td>{new Date(item.fecha_inicio).toLocaleDateString()}</td>
      <td>{proveedor?.nombre || 'N/A'}</td>
      <td>{item.nombre_inventario || 'N/A'}</td>
      <td>{item.cantidad_total_lote_hojas || item.cantidad_total_lote || 0}</td>
      <td>{item.cantidad_total_lote_pieles || 0}</td>
      <td>{item.peso_total} kg</td>
      <td><span className="capitalize">{item.estado}</span></td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => { setLoteConsolidado(item.codigo_lote); setShowConsolidadoModal(true); }} title="Ver Consolidado Costos"><Table className="w-4 h-4 text-emerald-600" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} title="Ver Detalle"><Eye className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleViewHistory(item)} title="Ver Seguimiento"><FileText className="w-4 h-4 text-blue-600" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)} title="Editar"><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  )};
  

  return (
    <div className="p-6">
      <PageHeader
        title="Recepción de Materia Prima"
        description="Gestiona el ingreso de pieles y otros materiales."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Recepción
          </Button>
        }
      />
      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Listado de Recepciones</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={recepciones} renderRow={renderRow} />}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Recepción</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Código Lote *</Label>
                <Input 
                  value={currentItem?.codigo_lote || ''} 
                  onChange={e => setCurrentItem({...currentItem, codigo_lote: e.target.value})} 
                  list="lotes-compras"
                  required 
                />
                <datalist id="lotes-compras">
                  {lotesCompras.map((lote, idx) => (
                    <option key={idx} value={lote} />
                  ))}
                </datalist>
              </div>
              <div><Label>Fecha de Recepción</Label><Input type="date" value={currentItem?.fecha_inicio || ''} onChange={e => setCurrentItem({...currentItem, fecha_inicio: e.target.value})} /></div>
              <div>
                <Label>Proveedor</Label>
                <Select value={currentItem?.proveedor_id || ''} onValueChange={v => setCurrentItem({...currentItem, proveedor_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                  <SelectContent>
                    {proveedores.map(prov => (
                      <SelectItem key={prov.id} value={prov.id}>
                        {prov.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>No. de Documento</Label><Input value={currentItem?.no_documento || ''} onChange={e => setCurrentItem({...currentItem, no_documento: e.target.value})} placeholder="Número de factura o documento" /></div>
            <div>
              <Label>Nombre de Inventario *</Label>
              <Select value={currentItem?.nombre_inventario || ''} onValueChange={v => setCurrentItem({...currentItem, nombre_inventario: v})}>
                <SelectTrigger><SelectValue placeholder="Seleccionar item del inventario" /></SelectTrigger>
                <SelectContent>
                  {todosLosItems.map(item => (
                    <SelectItem key={item.id} value={item.displayName || 'sin-nombre'}>
                      {item.displayName} ({item.tipo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Cantidad Total Lote en Hojas</Label><Input type="number" value={currentItem?.cantidad_total_lote_hojas || ''} onChange={e => setCurrentItem({...currentItem, cantidad_total_lote_hojas: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Cantidad Total Lote en Pieles</Label><Input type="number" value={currentItem?.cantidad_total_lote_pieles || ''} onChange={e => setCurrentItem({...currentItem, cantidad_total_lote_pieles: parseFloat(e.target.value) || 0})} /></div>
              <div><Label>Peso Total Hojas (kg)</Label><Input type="number" step="0.01" value={currentItem?.peso_total || ''} onChange={e => {
                const peso = parseFloat(e.target.value) || 0;
                const hojas = parseFloat(currentItem?.cantidad_total_lote_hojas) || 1;
                setCurrentItem({...currentItem, peso_total: peso, peso_promedio_estandar_por_piel: peso / hojas});
              }} /></div>
              <div><Label>Peso Promedio Estándar por Hoja (kg)</Label><Input type="number" step="0.01" value={currentItem?.peso_promedio_estandar_por_piel || ''} readOnly className="bg-blue-50" title="Auto-calculado: Peso Total / Cantidad Hojas" /></div>
            </div>
            <div><Label>Nombre Curtidor</Label><Input value={currentItem?.nombre_curtidor || ''} onChange={e => setCurrentItem({...currentItem, nombre_curtidor: e.target.value})} placeholder="Nombre del curtidor responsable" /></div>
            <div><Label>Observaciones</Label><Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} rows={3} /></div>
            <div className="flex items-center space-x-2">
              <Checkbox checked={currentItem?.dividir_lote || false} onCheckedChange={v => setCurrentItem({...currentItem, dividir_lote: v})} id="dividir" />
              <Label htmlFor="dividir">Dividir Lote</Label>
            </div>
            {currentItem?.dividir_lote && (
              <div className="space-y-2">
                <div className="flex gap-2 items-end">
                  <div className="flex-grow"><Label>¿Cuántos sublotes?</Label><Input type="number" value={currentItem?.num_sublotes || ''} onChange={e => setCurrentItem({...currentItem, num_sublotes: parseInt(e.target.value) || 0})} /></div>
                  <Button type="button" onClick={handleGenerateSublotes}>Generar Sublotes</Button>
                  {sublotes.length > 0 && <Button type="button" variant="outline" onClick={() => setShowSublotesModal(true)}>Ver Sublotes ({sublotes.length})</Button>}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showSublotesModal} onOpenChange={setShowSublotesModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Configurar Sublotes</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {sublotes.map((sub, index) => (
              <div key={index} className="grid grid-cols-2 gap-2 p-2 border rounded">
                <div><Label>Código</Label><Input value={sub.codigo} onChange={e => handleSubloteChange(index, 'codigo', e.target.value)} /></div>
                <div><Label>Cantidad</Label><Input type="number" value={sub.cantidad} onChange={e => handleSubloteChange(index, 'cantidad', parseFloat(e.target.value) || 0)} /></div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowSublotesModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>Detalle de Recepción</DialogTitle></DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Código Lote:</span> {selectedItem.codigo_lote}</p>
              <p><span className="font-semibold">Fecha:</span> {new Date(selectedItem.fecha_inicio).toLocaleDateString()}</p>
              <p><span className="font-semibold">Nombre Inventario:</span> {selectedItem.nombre_inventario || 'N/A'}</p>
              <p><span className="font-semibold">Cantidad:</span> {selectedItem.cantidad_total_lote}</p>
              <p><span className="font-semibold">Peso Total:</span> {selectedItem.peso_total} kg</p>
              <p><span className="font-semibold">Estado:</span> {selectedItem.estado}</p>
              {selectedItem.sublotes && selectedItem.sublotes.length > 0 && (
                <div>
                  <p className="font-semibold">Sublotes:</p>
                  <ul className="list-disc pl-5">
                    {selectedItem.sublotes.map((sub, idx) => (
                      <li key={idx}>{sub.codigo} - Cantidad: {sub.cantidad}</li>
                    ))}
                  </ul>
                </div>
              )}
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Seguimiento de Lote: {selectedItem?.codigo_lote}</DialogTitle></DialogHeader>
            <div className="space-y-6">
                
                {/* Sección Recepción */}
                <div>
                    <h3 className="font-bold text-lg border-b pb-1 mb-2 bg-gray-100 p-1">Recepción</h3>
                    <table className="w-full text-sm border">
                        <thead><tr className="bg-gray-50"><th>Fecha</th><th>Cantidad</th><th>Peso</th><th>Estado</th></tr></thead>
                        <tbody>
                            {historyData.recepcion?.map(p => (
                                <tr key={p.id} className="border-t">
                                    <td className="p-2 text-center">{new Date(p.fecha_inicio).toLocaleDateString()}</td>
                                    <td className="p-2 text-center">{p.cantidad_total_lote}</td>
                                    <td className="p-2 text-center">{p.peso_total} kg</td>
                                    <td className="p-2 text-center">{p.estado}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Sección Remojo */}
                <div>
                    <h3 className="font-bold text-lg border-b pb-1 mb-2 bg-blue-50 p-1">Remojo</h3>
                    {historyData.remojo?.length > 0 ? (
                    <table className="w-full text-sm border">
                        <thead><tr className="bg-blue-50"><th>Fecha</th><th>Sublote</th><th>Peso Actual</th><th>Costo</th><th>Estado</th></tr></thead>
                        <tbody>
                            {historyData.remojo?.map(p => (
                                <tr key={p.id} className="border-t">
                                    <td className="p-2 text-center">{new Date(p.fecha_inicio).toLocaleDateString()}</td>
                                    <td className="p-2 text-center">{p.codigo_sublote || 'Lote Completo'}</td>
                                    <td className="p-2 text-center">{p.peso_actual} kg</td>
                                    <td className="p-2 text-center">${p.costo_remojo?.toLocaleString()}</td>
                                    <td className="p-2 text-center">{p.estado}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    ) : <p className="text-gray-500 italic text-sm">No hay registros de remojo.</p>}
                </div>

                {/* Sección Pelambre */}
                <div>
                    <h3 className="font-bold text-lg border-b pb-1 mb-2 bg-yellow-50 p-1">Pelambre</h3>
                    {historyData.pelambre?.length > 0 ? (
                    <table className="w-full text-sm border">
                        <thead><tr className="bg-yellow-50"><th>Fecha</th><th>Sublote</th><th>Peso Actual</th><th>Costo</th><th>Estado</th></tr></thead>
                        <tbody>
                            {historyData.pelambre?.map(p => (
                                <tr key={p.id} className="border-t">
                                    <td className="p-2 text-center">{new Date(p.fecha_inicio).toLocaleDateString()}</td>
                                    <td className="p-2 text-center">{p.codigo_sublote || 'Lote Completo'}</td>
                                    <td className="p-2 text-center">{p.peso_actual} kg</td>
                                    <td className="p-2 text-center">${p.costo_pelambre?.toLocaleString()}</td>
                                    <td className="p-2 text-center">{p.estado}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    ) : <p className="text-gray-500 italic text-sm">No hay registros de pelambre.</p>}
                </div>

                {/* Sección Curtido */}
                <div>
                    <h3 className="font-bold text-lg border-b pb-1 mb-2 bg-emerald-50 p-1">Curtido</h3>
                    {historyData.curtido?.length > 0 ? (
                    <table className="w-full text-sm border">
                        <thead><tr className="bg-emerald-50"><th>Fecha</th><th>Sublote</th><th>Peso</th><th>Costo Total</th><th>Estado</th></tr></thead>
                        <tbody>
                            {historyData.curtido?.map(p => (
                                <tr key={p.id} className="border-t">
                                    <td className="p-2 text-center">{new Date(p.fecha_inicio).toLocaleDateString()}</td>
                                    <td className="p-2 text-center">{p.codigo_sublote || 'Lote Completo'}</td>
                                    <td className="p-2 text-center">{p.peso_actual} kg</td>
                                    <td className="p-2 text-center">${p.costo_total_curtido?.toLocaleString()}</td>
                                    <td className="p-2 text-center">{p.estado}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    ) : <p className="text-gray-500 italic text-sm">No hay registros de curtido.</p>}
                </div>

                {/* Sección Recurtido */}
                <div>
                    <h3 className="font-bold text-lg border-b pb-1 mb-2 bg-purple-50 p-1">Recurtido</h3>
                    {historyData.recurtido?.length > 0 ? (
                    <table className="w-full text-sm border">
                        <thead><tr className="bg-purple-50"><th>Fecha</th><th>Color</th><th>Actividad</th><th>Subtotal</th><th>Estado</th></tr></thead>
                        <tbody>
                            {historyData.recurtido?.map(p => (
                                <tr key={p.id} className="border-t">
                                    <td className="p-2 text-center">{new Date(p.fecha_inicio).toLocaleDateString()}</td>
                                    <td className="p-2 text-center">{p.nombre_color}</td>
                                    <td className="p-2 text-center capitalize">{p.actividad}</td>
                                    <td className="p-2 text-center">
                                        ${( (p.subtotal_humectacion||0) + (p.subtotal_recromado||0) + (p.subtotal_recurtido||0) ).toLocaleString()}
                                    </td>
                                    <td className="p-2 text-center">{p.estado}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    ) : <p className="text-gray-500 italic text-sm">No hay registros de recurtido.</p>}
                </div>

            </div>
            <div className="flex justify-end pt-4">
                <Button onClick={() => setShowHistoryModal(false)}>Cerrar</Button>
            </div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && (
          <LoteDetalleConsolidado 
              open={showConsolidadoModal}
              onOpenChange={setShowConsolidadoModal}
              codigoLote={loteConsolidado}
          />
      )}
    </div>
  );
}