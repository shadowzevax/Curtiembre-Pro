import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { ProcesoProduccion, Insumo, ProductoTerminado, Proveedor, OrdenCompra, MovimientoInventario, InventarioEnProceso } from '@/entities/all';
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
  const [ordenesCompra, setOrdenesCompra] = useState([]);

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
      
      // VALIDACIÓN CRÍTICA: Asegurar que todos los datos son arrays válidos
      const recepcionesValidas = Array.isArray(recepcionesData) ? recepcionesData : [];
      const insumosValidos = Array.isArray(insumosData) ? insumosData : [];
      const productosValidos = Array.isArray(productosData) ? productosData : [];
      const proveedoresValidos = Array.isArray(proveedoresData) ? proveedoresData : [];
      const comprasValidas = Array.isArray(comprasData) ? comprasData : [];
      
      setRecepciones(recepcionesValidas);
      setInsumos(insumosValidos);
      setProductos(productosValidos);
      setProveedores(proveedoresValidos);
      setOrdenesCompra(comprasValidas);
      
      // Extraer códigos de lote únicos de compras
      const lotes = comprasValidas
        .filter(c => c && c.codigo_lote_inventario)
        .map(c => c.codigo_lote_inventario);
      setLotesCompras([...new Set(lotes)]);
      
      // Calcular el siguiente número de lote
      if (recepcionesValidas.length > 0) {
        const lotes = recepcionesValidas.map(r => {
          const match = r?.codigo_lote?.match(/L(\d+)/);
          return match ? parseInt(match[1]) : 0;
        });
        const maxLote = Math.max(...lotes, 0);
        setNextLoteNumber(maxLote + 1);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      // Inicializar con arrays vacíos en caso de error
      setRecepciones([]);
      setInsumos([]);
      setProductos([]);
      setProveedores([]);
      setOrdenesCompra([]);
      setLotesCompras([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    if (!item) {
      // Generar código automático L-AAAA-XXX
      const year = new Date().getFullYear();
      const recepcionesSeguras = Array.isArray(recepciones) ? recepciones : [];
      const recepcionesDelAnio = recepcionesSeguras.filter(r => r && r.codigo_lote?.startsWith(`L-${year}`));
      const consecutivos = recepcionesDelAnio.map(r => {
        const match = r?.codigo_lote?.match(/L-\d{4}-(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      const nextConsecutivo = consecutivos.length > 0 ? Math.max(...consecutivos) + 1 : 1;
      const codigoLote = `L-${year}-${String(nextConsecutivo).padStart(3, '0')}`;
      
      setCurrentItem({
        tipo_proceso: 'recepcion',
        codigo_lote: codigoLote,
        fecha_inicio: new Date().toISOString().split('T')[0],
        id_orden_compra_origen: '',
        proveedor_id: '',
        no_documento: '',
        codigo_producto: '',
        descripcion_producto: '',
        cantidad_total_lote_hojas: 0,
        cantidad_total_lote_pieles: 0,
        peso_total: 0,
        peso_promedio_estandar_por_piel: 0,
        dividir_lote: false,
        num_sublotes: 0,
        sublotes: [],
        insumos_utilizados: [],
        servicios_maquinaria: [],
        servicios_mano_obra: [],
        otros_costos: [],
        otros_conceptos: [],
        observaciones: '',
        nombre_curtidor: '',
        estado: 'pendiente'
      });
    } else {
      setCurrentItem({
        ...item,
        sublotes: Array.isArray(item.sublotes) ? item.sublotes : [],
        insumos_utilizados: Array.isArray(item.insumos_utilizados) ? item.insumos_utilizados : [],
        servicios_maquinaria: Array.isArray(item.servicios_maquinaria) ? item.servicios_maquinaria : [],
        servicios_mano_obra: Array.isArray(item.servicios_mano_obra) ? item.servicios_mano_obra : [],
        otros_costos: Array.isArray(item.otros_costos) ? item.otros_costos : [],
        otros_conceptos: Array.isArray(item.otros_conceptos) ? item.otros_conceptos : []
      });
    }
    setSublotes(Array.isArray(item?.sublotes) ? item.sublotes : []);
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
        // VALIDACIÓN CRÍTICA: Asegurar que recepciones es un array antes de usar some
        const recepcionesSeguras = Array.isArray(recepciones) ? recepciones : [];
        const exists = recepcionesSeguras.some(r => r && r.codigo_lote === currentItem.codigo_lote);
        if (exists) {
            alert('El CÓDIGO DE LOTE YA EXISTE. POR FAVOR, VERIFIQUE.');
            return;
        }
    }

    try {
      // Asegurar que TODOS los arrays estén inicializados para evitar errores en producción
      const dataToSave = {
        ...currentItem,
        sublotes: (currentItem.dividir_lote && Array.isArray(sublotes)) ? sublotes : [],
        insumos_utilizados: Array.isArray(currentItem.insumos_utilizados) ? currentItem.insumos_utilizados : [],
        servicios_maquinaria: Array.isArray(currentItem.servicios_maquinaria) ? currentItem.servicios_maquinaria : [],
        servicios_mano_obra: Array.isArray(currentItem.servicios_mano_obra) ? currentItem.servicios_mano_obra : [],
        otros_costos: Array.isArray(currentItem.otros_costos) ? currentItem.otros_costos : [],
        otros_conceptos: Array.isArray(currentItem.otros_conceptos) ? currentItem.otros_conceptos : [],
        numero_proceso: currentItem.codigo_lote
      };
      
      // Guardar el proceso de recepción
      let procesoId;
      if (isEditing) {
        await ProcesoProduccion.update(currentItem.id, dataToSave);
        procesoId = currentItem.id;
      } else {
        const created = await ProcesoProduccion.create(dataToSave);
        procesoId = created.id;
      }
      
      // AFECTAR INVENTARIO DE MATERIA PRIMA (restar cantidad de hojas)
      if (!isEditing && currentItem.cantidad_total_lote_hojas > 0 && currentItem.codigo_producto) {
        // Buscar el producto en materia prima por código
        const productosMP = await ProductoTerminado.filter({ 
          codigo: currentItem.codigo_producto, 
          categoria: 'pieles' 
        });
        
        // VALIDACIÓN CRÍTICA: Verificar que productosMP es un array válido
        const productosMPValidos = Array.isArray(productosMP) ? productosMP : [];
        
        if (productosMPValidos.length > 0) {
          const producto = productosMPValidos[0];
          
          // Crear movimiento de salida (negativo)
          await base44.entities.MovimientoInventario.create({
            tipo_movimiento: 'salida',
            insumo_id: producto.id,
            cantidad: -(currentItem.cantidad_total_lote_hojas),
            costo_unitario: producto.costo_promedio || 0,
            fecha_movimiento: currentItem.fecha_inicio,
            referencia: `RECEPCION-${currentItem.codigo_lote}`,
            observaciones: `Salida por recepción de lote ${currentItem.codigo_lote}`,
            usuario_id: 'system'
          });
          
          // Actualizar stock en ProductoTerminado
          const movimientos = await MovimientoInventario.filter({ insumo_id: producto.id });
          // VALIDACIÓN CRÍTICA: Asegurar que movimientos es un array antes de usar reduce
          const movimientosValidos = Array.isArray(movimientos) ? movimientos : [];
          const nuevoStock = movimientosValidos.reduce((sum, m) => sum + (parseFloat(m?.cantidad) || 0), 0) - currentItem.cantidad_total_lote_hojas;
          
          await ProductoTerminado.update(producto.id, {
            stock_actual: nuevoStock
          });
          
          console.log(`✅ Inventario actualizado: -${currentItem.cantidad_total_lote_hojas} hojas de ${currentItem.codigo_producto}`);
          
          // CREAR REGISTRO EN INVENTARIO EN PROCESO
          if (currentItem.dividir_lote && sublotes.length > 0) {
            // Si se dividió el lote, crear un registro por cada sublote
            for (const sublote of sublotes) {
              await base44.entities.InventarioEnProceso.create({
                codigo: currentItem.codigo_producto,
                descripcion: currentItem.descripcion_producto,
                codigo_lote: sublote.codigo,
                origen_modulo: 'recepcion',
                etapa_actual: 'recepcion',
                estado_proceso: 'listo_para_limpieza',
                cantidad_hojas: sublote.cantidad,
                fecha_ingreso_proceso: currentItem.fecha_inicio,
                proceso_origen_id: procesoId
              });
            }
          } else {
            // Si no se dividió, crear un solo registro con el lote original
            await base44.entities.InventarioEnProceso.create({
              codigo: currentItem.codigo_producto,
              descripcion: currentItem.descripcion_producto,
              codigo_lote: currentItem.codigo_lote,
              origen_modulo: 'recepcion',
              etapa_actual: 'recepcion',
              estado_proceso: 'listo_para_limpieza',
              cantidad_hojas: currentItem.cantidad_total_lote_hojas,
              fecha_ingreso_proceso: currentItem.fecha_inicio,
              proceso_origen_id: procesoId
            });
          }
          
          console.log(`✅ Inventario En Proceso creado para lote ${currentItem.codigo_lote}`);
        }
      }
      
      // Cerrar modal y mostrar mensaje de éxito
      setShowModal(false);
      setCurrentItem(null);
      
      // Recargar datos inmediatamente y luego mostrar mensaje
      await loadData();
      alert('Recepción guardada con éxito.');
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar la recepción: ' + error.message);
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
        
        // VALIDACIÓN CRÍTICA: Asegurar que allProcesos es un array antes de usar filter
        const procesosValidos = Array.isArray(allProcesos) ? allProcesos : [];
        
        // Agrupar por etapa
        const history = {
            recepcion: procesosValidos.filter(p => p && p.tipo_proceso === 'recepcion'),
            remojo: procesosValidos.filter(p => p && p.tipo_proceso === 'limpieza' && p.seccion === 'remojo'),
            pelambre: procesosValidos.filter(p => p && p.tipo_proceso === 'limpieza' && p.seccion === 'pelambre'),
            curtido: procesosValidos.filter(p => p && p.tipo_proceso === 'curtido'),
            recurtido: procesosValidos.filter(p => p && p.tipo_proceso === 'recurtido'),
            acabado: procesosValidos.filter(p => p && p.tipo_proceso === 'acabado'),
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

  const headers = ['Código Lote', 'Fecha', 'Proveedor', 'Código', 'Descripción', 'Cant. Hojas', 'Cant. Pieles', 'Peso Total', 'Estado', 'Acciones'];
  const renderRow = (item) => {
    const proveedor = proveedores.find(p => p.id === item.proveedor_id);
    return (
    <tr key={item.id}>
      <td>{item.codigo_lote}</td>
      <td>{new Date(item.fecha_inicio).toLocaleDateString()}</td>
      <td>{proveedor?.nombre || 'N/A'}</td>
      <td>{item.codigo_producto || 'N/A'}</td>
      <td>{item.descripcion_producto || item.nombre_inventario || 'N/A'}</td>
      <td>{item.cantidad_total_lote_hojas || item.cantidad_total_lote || 0}</td>
      <td>{item.cantidad_total_lote_pieles || item.cantidad_pieles || 0}</td>
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
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nueva'} Recepción</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>ID Orden de Compra Origen</Label>
                <Select value={currentItem?.id_orden_compra_origen || ''} onValueChange={v => {
                  const ordenCompra = ordenesCompra.find(oc => oc.id === v);
                  setCurrentItem({
                    ...currentItem, 
                    id_orden_compra_origen: v,
                    no_documento: ordenCompra?.numero_documento || currentItem?.no_documento || '',
                    proveedor_id: ordenCompra?.proveedor_id || currentItem?.proveedor_id || ''
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar orden" /></SelectTrigger>
                  <SelectContent>
                    {ordenesCompra
                      .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                      .map(oc => (
                        <SelectItem key={oc.id} value={oc.id}>
                          {oc.numero_id || `${oc.prefijo_documento}-${oc.numero_documento}`} | {proveedores.find(p => p.id === oc.proveedor_id)?.nombre || 'N/A'} | {formatCurrency(oc.total)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Código de Lote (automático) *</Label>
                <Input 
                  value={currentItem?.codigo_lote || ''} 
                  readOnly
                  required 
                  placeholder="Autogenerado L-AAAA-XXX"
                  className="bg-gray-100 font-mono font-bold text-blue-700"
                />
                <p className="text-xs text-slate-500 mt-1">Código único generado automáticamente por el sistema</p>
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código PCTO. *</Label>
                <Select value={currentItem?.codigo_producto || ''} onValueChange={v => {
                  const catalogoProd = productos.find(p => p.codigo === v);
                  setCurrentItem({
                    ...currentItem, 
                    codigo_producto: v,
                    descripcion_producto: catalogoProd ? catalogoProd.descripcion : ''
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar código" /></SelectTrigger>
                  <SelectContent>
                    {productos
                      .filter(prod => prod.codigo)
                      .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }))
                      .map(prod => (
                        <SelectItem key={prod.id} value={prod.codigo}>
                          {prod.codigo}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nombre del Producto *</Label>
                <Select value={currentItem?.descripcion_producto || ''} onValueChange={v => {
                  const catalogoProd = productos.find(p => p.descripcion === v);
                  setCurrentItem({
                    ...currentItem, 
                    codigo_producto: catalogoProd ? catalogoProd.codigo : currentItem.codigo_producto,
                    descripcion_producto: v
                  });
                }}>
                  <SelectTrigger><SelectValue placeholder="Buscar por nombre" /></SelectTrigger>
                  <SelectContent>
                    {productos
                      .sort((a, b) => (a.descripcion || '').localeCompare(b.descripcion || ''))
                      .map(prod => (
                        <SelectItem key={prod.id} value={prod.descripcion}>
                          {prod.descripcion}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              <div><Label>Cantidad Total Lote en Hojas</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={currentItem?.cantidad_total_lote_hojas || ''} onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setCurrentItem({...currentItem, cantidad_total_lote_hojas: parseInt(val) || 0});
              }} /></div>
              <div><Label>Cantidad Total Lote en Pieles</Label><Input type="text" inputMode="numeric" pattern="[0-9]*" value={currentItem?.cantidad_total_lote_pieles || ''} onChange={e => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setCurrentItem({...currentItem, cantidad_total_lote_pieles: parseInt(val) || 0});
              }} /></div>
              <div><Label>Peso Total Hojas (kg)</Label><Input type="text" inputMode="decimal" value={currentItem?.peso_total || ''} onChange={e => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                const peso = parseFloat(val) || 0;
                const hojas = parseFloat(currentItem?.cantidad_total_lote_hojas) || 1;
                setCurrentItem({...currentItem, peso_total: peso, peso_promedio_estandar_por_piel: peso / hojas});
              }} /></div>
              <div><Label>Peso Promedio Estándar por Hoja (kg)</Label><Input type="text" value={currentItem?.peso_promedio_estandar_por_piel?.toFixed(2) || ''} readOnly className="bg-blue-50" title="Auto-calculado: Peso Total / Cantidad Hojas" /></div>
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
             <p><span className="font-semibold">Código:</span> {selectedItem.codigo_producto || 'N/A'}</p>
             <p><span className="font-semibold">Descripción:</span> {selectedItem.descripcion_producto || selectedItem.nombre_inventario || 'N/A'}</p>
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