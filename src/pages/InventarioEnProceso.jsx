import React, { useState, useEffect, useCallback } from 'react';
import { InventarioEnProceso, MovimientoInventario } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Eye, ClipboardList, Workflow, Layers, ListTree } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import InventarioItemForm from '../components/inventario/InventarioItemForm';
import AjusteInventarioModal from '../components/inventario/AjusteInventarioModal';
import InventarioItemDetail from '../components/inventario/InventarioItemDetail';
import StockAlert from '../components/inventario/StockAlert';
import SeguimientoProduccionModal from '../components/inventario/SeguimientoProduccionModal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { agruparPorCodigoProducto } from '@/lib/inventarioProceso';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

const CATEGORIA_LABELS = {
  pieles: 'Pieles',
  quimicos: 'Químicos',
  colorantes: 'Colorantes',
  grasas: 'Grasas',
  hojas_materia_prima: 'Hojas Mat. Prima',
  hojas_procesadas: 'Hojas Procesadas',
};

export default function InventarioEnProcesoPage() {
  const [productos, setProductos] = useState([]);
  const [filteredProductos, setFilteredProductos] = useState([]);
  const [searchCodigo, setSearchCodigo] = useState('');
  const [searchDescripcion, setSearchDescripcion] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showSeguimientoModal, setShowSeguimientoModal] = useState(false);
  const [seguimientoItem, setSeguimientoItem] = useState(null);
  const [searchCodigoProducto, setSearchCodigoProducto] = useState('');
  const [searchColorBase, setSearchColorBase] = useState('');
  const [filterEstadoLote, setFilterEstadoLote] = useState('');
  const [filterEstadoSublote, setFilterEstadoSublote] = useState('');
  const [showZeroExistencia, setShowZeroExistencia] = useState(false);
  const [vistaConsolidada, setVistaConsolidada] = useState(true);
  const [detalleExistencias, setDetalleExistencias] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const data = await InventarioEnProceso.list();
      const movimientos = await MovimientoInventario.list();

      const productosConStock = data.map(prod => {
        const movsProd = movimientos.filter(m => m.insumo_id === prod.id);
        const stockCalc = movsProd.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
        // Usar stock_actual del registro si existe y es > 0, o el calculado de movimientos
        const stockActual = (prod.cantidad_hojas != null && prod.cantidad_hojas >= 0)
          ? prod.cantidad_hojas
          : stockCalc;
        return { ...prod, stock_actual: stockActual };
      });

      setProductos(productosConStock);
      setFilteredProductos(productosConStock);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Actualización en background sin parpadeo
    const interval = setInterval(() => {
      (async () => {
        try {
          const data = await InventarioEnProceso.list();
          const movimientos = await MovimientoInventario.list();

          const productosConStock = data.map(prod => {
            const movsProd = movimientos.filter(m => m.insumo_id === prod.id);
            const stockCalc = movsProd.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
            const stockActual = (prod.cantidad_hojas != null && prod.cantidad_hojas >= 0)
              ? prod.cantidad_hojas
              : stockCalc;
            return { ...prod, stock_actual: stockActual };
          });

          setProductos(productosConStock);
          setFilteredProductos(prev => {
            const prevIds = new Set(prev.map(p => p.id));
            return productosConStock.filter(p => prevIds.has(p.id) || prev.length === 0);
          });
        } catch (error) { console.error(error); }
      })();
    }, 3000);

    return () => clearInterval(interval);
  }, [loadData]);

  const DESTINO_LABELS = {
    disponible_pintura: 'Disponible Pintura',
    en_proceso_pintura: 'En Pintura',
    producto_terminado: 'Producto Terminado',
    vendido_crosta: 'Vendido Crosta',
    agotado: 'Agotado',
    cancelado: 'Cancelado',
    merma: 'Merma',
  };

  // Filtrado por código, descripción, producto, color base, estados y existencia
  useEffect(() => {
    let filtered = productos;
    if (searchCodigo) {
      filtered = filtered.filter(p =>
        (p.codigo || '').toLowerCase().includes(searchCodigo.toLowerCase()) ||
        (p.codigo_lote || '').toLowerCase().includes(searchCodigo.toLowerCase())
      );
    }
    if (searchDescripcion) {
      filtered = filtered.filter(p =>
        (p.descripcion || '').toLowerCase().includes(searchDescripcion.toLowerCase())
      );
    }
    if (searchCodigoProducto) {
      filtered = filtered.filter(p =>
        (p.codigo_producto_proceso || '').toLowerCase().includes(searchCodigoProducto.toLowerCase())
      );
    }
    if (searchColorBase) {
      filtered = filtered.filter(p =>
        (p.color_base || '').toLowerCase().includes(searchColorBase.toLowerCase())
      );
    }
    if (filterEstadoLote) {
      filtered = filtered.filter(p => (p.estado_actual || '') === filterEstadoLote);
    }
    if (filterEstadoSublote) {
      filtered = filtered.filter(p => (p.destino_sublote || 'disponible_pintura') === filterEstadoSublote);
    }
    if (!showZeroExistencia) {
      filtered = filtered.filter(p => (p.cantidad_hojas || p.stock_actual || 0) > 0);
    }
    setFilteredProductos(filtered);
  }, [searchCodigo, searchDescripcion, searchCodigoProducto, searchColorBase, filterEstadoLote, filterEstadoSublote, showZeroExistencia, productos]);

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    setCurrentItem(item);
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleVerSeguimiento = (item) => {
    setSeguimientoItem(item);
    setShowSeguimientoModal(true);
  };

  const handleSave = async (formData) => {
    try {
      if (isEditing) {
        await InventarioEnProceso.update(currentItem.id, formData);
      } else {
        await InventarioEnProceso.create(formData);
      }
      setShowModal(false);
      loadData();
      alert('Registro guardado exitosamente.');
    } catch (e) {
      alert(`Error guardando registro: ${e.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este registro de inventario en proceso?')) {
      try {
        await InventarioEnProceso.delete(id);
        alert('Registro eliminado exitosamente.');
        loadData();
      } catch (error) {
        alert('Error al eliminar el registro.');
      }
    }
  };

  const handleExport = () => {
    const hdrs = ['Código Producto', 'Descripción Producto', 'Código Lote ó Partida Recurtido', 'Calibre', 'Destino', 'Stock Actual', 'Stock Mínimo', 'U. Medida', 'Costo Promedio', 'Valor Total'];
    let csvContent = hdrs.join(',') + '\n';
    filteredProductos.forEach(item => {
      const stockActual = item.cantidad_hojas || item.stock_actual || 0;
      const valorTotal = stockActual * (item.costo_promedio || 0);
      const row = [
        `"${item.codigo_producto_proceso || ''}"`,
        `"${item.descripcion_producto_proceso || ''}"`,
        `"${item.codigo_lote || ''}"`,
        `"${item.calibre || ''}"`,
        `"${DESTINO_LABELS[item.destino_sublote || 'disponible_pintura']}"`,
        stockActual,
        item.stock_minimo || 0,
        `"${item.unidad_medida || ''}"`,
        item.costo_promedio || 0,
        valorTotal,
      ].join(',');
      csvContent += row + '\n';
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', 'inventario_en_proceso.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  const RF_LABELS = { en_pelo: 'En Pelo', crosta: 'Crosta' };
  const filasConsolidadas = agruparPorCodigoProducto(showZeroExistencia ? productos : productos.filter(p => (p.cantidad_hojas || 0) > 0 || (p.stock_actual || 0) > 0));

  const tableHeaders = [
    'Código Producto', 'Descripción Producto', 'Código Lote ó Partida Recurtido', 'Calibre',
    'Stock Actual', 'Stock Mínimo', 'Estado Stock', 'Destino',
    'Unidad de Medida', 'Costo Promedio', 'Valor Total', 'Acciones'
  ];

  const renderRow = (item) => {
    const stockActual = item.cantidad_hojas || item.stock_actual || 0;
    const valorTotal = stockActual * (item.costo_promedio || 0);
    return (
      <tr key={item.id}>
        <td className="font-mono text-xs font-bold text-cyan-700">{item.codigo_producto_proceso || '—'}</td>
        <td className="text-xs max-w-[180px] truncate" title={item.descripcion_producto_proceso || ''}>{item.descripcion_producto_proceso || '—'}</td>
        <td className="font-mono text-xs">{item.codigo_lote || '—'}</td>
        <td>{item.calibre || '—'}</td>
        <td className={stockActual <= (item.stock_minimo || 0) ? 'text-red-500 font-bold' : ''}>
          {stockActual}
        </td>
        <td>{item.stock_minimo || 0}</td>
        <td><StockAlert stockActual={stockActual} stockMinimo={item.stock_minimo || 0} /></td>
        <td className="text-xs"><span className={`px-1.5 py-0.5 rounded border ${item.destino_sublote === 'vendido_crosta' ? 'bg-amber-100 text-amber-700 border-amber-300' : item.destino_sublote === 'producto_terminado' ? 'bg-purple-100 text-purple-700 border-purple-300' : item.destino_sublote === 'en_proceso_pintura' ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-green-100 text-green-700 border-green-300'}`}>{DESTINO_LABELS[item.destino_sublote || 'disponible_pintura']}</span></td>
        <td>{item.unidad_medida || 'N/A'}</td>
        <td>{formatCurrency(item.costo_promedio)}</td>
        <td className="text-right font-bold text-emerald-700">{formatCurrency(valorTotal)}</td>
        <td>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" title="Seguimiento de Producción" className="border-cyan-500 text-cyan-700 hover:bg-cyan-50" onClick={() => handleVerSeguimiento(item)}>
              <Workflow className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}>
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #tabla-imprimible, #tabla-imprimible * { visibility: visible; }
          #tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; }
          #page-header { display: none; }
        }
      `}</style>

      <PageHeader
        title="Inventario de Productos en Proceso"
        description="Control de existencias de cuero en etapas productivas entre materia prima y producto terminado."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <div className="flex gap-2">
            <Button
              onClick={() => setVistaConsolidada(v => !v)}
              variant="outline"
              title={vistaConsolidada ? 'Ver todas las partidas por separado' : 'Ver consolidado por Código Producto'}
              className={vistaConsolidada ? 'bg-cyan-50 border-cyan-600 text-cyan-700 hover:bg-cyan-100' : ''}
            >
              {vistaConsolidada ? <Layers className="w-4 h-4 mr-2" /> : <ListTree className="w-4 h-4 mr-2" />}
              {vistaConsolidada ? 'Vista: Por Código Producto' : 'Vista: Todas las Partidas'}
            </Button>
            <Button onClick={() => setShowAjusteModal(true)} variant="outline" className="bg-amber-50 border-amber-600 text-amber-700 hover:bg-amber-100">
              <ClipboardList className="w-4 h-4 mr-2" /> Ajustes
            </Button>
            <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> Nuevo Producto
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader><CardTitle>Filtro de Búsqueda</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="searchCodigo">Código / Lote</Label>
              <Input id="searchCodigo" placeholder="Buscar por código o lote..." value={searchCodigo} onChange={e => setSearchCodigo(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="searchDescripcion">Descripción</Label>
              <Input id="searchDescripcion" placeholder="Buscar por descripción..." value={searchDescripcion} onChange={e => setSearchDescripcion(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="searchCodigoProducto">Código Producto en Proceso</Label>
              <Input id="searchCodigoProducto" placeholder="Buscar por código producto..." value={searchCodigoProducto} onChange={e => setSearchCodigoProducto(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="searchColorBase">Color Base</Label>
              <Input id="searchColorBase" placeholder="Buscar por color base..." value={searchColorBase} onChange={e => setSearchColorBase(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="filterEstadoLote">Estado del Lote</Label>
              <select id="filterEstadoLote" className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterEstadoLote} onChange={e => setFilterEstadoLote(e.target.value)}>
                <option value="">Todos</option>
                <option value="EN_PROCESO">En Proceso</option>
                <option value="FINALIZADO">Finalizado</option>
                <option value="DIVIDIDO">Dividido</option>
                <option value="CONSOLIDADO">Consolidado</option>
                <option value="CERRADO">Cerrado</option>
              </select>
            </div>
            <div>
              <Label htmlFor="filterEstadoSublote">Estado del Sublote (Destino)</Label>
              <select id="filterEstadoSublote" className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={filterEstadoSublote} onChange={e => setFilterEstadoSublote(e.target.value)}>
                <option value="">Todos</option>
                <option value="disponible_pintura">Disponible para Pintura</option>
                <option value="en_proceso_pintura">En proceso de Pintura</option>
                <option value="producto_terminado">Producto Terminado</option>
                <option value="vendido_crosta">Vendido como Crosta</option>
                <option value="agotado">Agotado</option>
                <option value="cancelado">Cancelado</option>
                <option value="merma">Merma</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Checkbox id="showZero" checked={showZeroExistencia} onCheckedChange={v => setShowZeroExistencia(!!v)} />
            <Label htmlFor="showZero" className="text-sm cursor-pointer">Mostrar registros sin existencia</Label>
          </div>
        </CardContent>
      </Card>

      {vistaConsolidada ? (
        <Card id="tabla-imprimible">
          <CardHeader>
            <CardTitle>Stock Consolidado por Código Producto</CardTitle>
            <p className="text-xs text-slate-500">
              Cada Código Producto agrupa automáticamente todas sus partidas de recurtido, sin duplicar el stock del lote padre.
            </p>
          </CardHeader>
          <CardContent>
            <DataTable
              headers={['Código Producto', 'Descripción', 'Color Base', 'Calibre', 'Stock Total', 'Stock Mínimo', 'Estado Stock', 'U. Medida', 'Costo Promedio', 'Valor Total', 'N° Partidas', 'Acciones']}
              data={filasConsolidadas}
              loading={loading}
              renderRow={(fila) => (
                <tr key={fila.codigo_producto_proceso}>
                  <td className="font-mono text-xs font-bold text-cyan-700">{fila.codigo_producto_proceso}</td>
                  <td className="text-xs max-w-[200px] truncate" title={fila.descripcion}>{fila.descripcion || '—'}</td>
                  <td className="text-xs">{fila.color_base || '—'}</td>
                  <td className="text-xs">{fila.calibre || '—'}</td>
                  <td className={fila.stock_total <= fila.stock_minimo ? 'text-red-500 font-bold' : 'font-semibold'}>{fila.stock_total}</td>
                  <td>{fila.stock_minimo}</td>
                  <td><StockAlert stockActual={fila.stock_total} stockMinimo={fila.stock_minimo} /></td>
                  <td>{fila.unidad_medida}</td>
                  <td>{formatCurrency(fila.costo_promedio)}</td>
                  <td className="text-right font-bold text-emerald-700">{formatCurrency(fila.valor_total)}</td>
                  <td className="text-center">{fila.cantidad_partidas}</td>
                  <td>
                    <Button variant="outline" size="sm" onClick={() => setDetalleExistencias(fila)} title="Detalle de Existencias (trazabilidad de partidas)">
                      <Eye className="w-4 h-4 mr-1" /> Detalle
                    </Button>
                  </td>
                </tr>
              )}
            />
          </CardContent>
        </Card>
      ) : (
        <Card id="tabla-imprimible">
          <CardHeader><CardTitle>Stock de Productos en Proceso (todas las partidas)</CardTitle></CardHeader>
          <CardContent>
            <DataTable headers={tableHeaders} data={filteredProductos} renderRow={renderRow} loading={loading} />
          </CardContent>
        </Card>
      )}

      {/* Detalle de Existencias: trazabilidad de las partidas que conforman un Código Producto */}
      <Dialog open={!!detalleExistencias} onOpenChange={(v) => !v && setDetalleExistencias(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              Detalle de Existencias — <span className="font-mono text-cyan-700">{detalleExistencias?.codigo_producto_proceso}</span>
            </DialogTitle>
            <p className="text-xs text-slate-500">{detalleExistencias?.descripcion}</p>
          </DialogHeader>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-2 text-left">Código Partida</th>
                  <th className="p-2 text-left">Lote Padre</th>
                  <th className="p-2 text-center">Fecha</th>
                  <th className="p-2 text-right">Cantidad Inicial</th>
                  <th className="p-2 text-right">Stock Disponible</th>
                  <th className="p-2 text-right">Costo Promedio</th>
                  <th className="p-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody>
                {(detalleExistencias?.partidas || []).map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-2 font-mono font-bold text-purple-800">{p.codigo_partida}</td>
                    <td className="p-2 font-mono">{p.lote_padre}</td>
                    <td className="p-2 text-center">{p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO') : '—'}</td>
                    <td className="p-2 text-right">{p.cantidad_inicial}</td>
                    <td className="p-2 text-right font-semibold">{p.stock_disponible}</td>
                    <td className="p-2 text-right">{formatCurrency(p.costo_promedio)}</td>
                    <td className="p-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded border text-xs ${p.estado === 'Disponible' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-gray-100 text-gray-500 border-gray-300'}`}>
                        {p.estado}
                      </span>
                    </td>
                  </tr>
                ))}
                {(detalleExistencias?.partidas || []).length === 0 && (
                  <tr><td colSpan={7} className="p-4 text-center text-slate-400">Sin partidas registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>

      {showModal && (
        <InventarioItemForm
          open={showModal}
          onOpenChange={setShowModal}
          onSubmit={handleSave}
          item={currentItem}
          isEditing={isEditing}
          tipoInventario="inventario_en_proceso"
        />
      )}

      {showAjusteModal && (
        <AjusteInventarioModal
          open={showAjusteModal}
          onOpenChange={setShowAjusteModal}
          onSuccess={loadData}
          tipoInventario="inventario_en_proceso"
        />
      )}

      <InventarioItemDetail
        open={showDetailModal}
        onOpenChange={setShowDetailModal}
        item={selectedItem}
      />

      <SeguimientoProduccionModal
        open={showSeguimientoModal}
        onOpenChange={setShowSeguimientoModal}
        item={seguimientoItem}
      />
    </div>
  );
}