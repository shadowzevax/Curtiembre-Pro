import React, { useState, useEffect, useCallback } from 'react';
import { InventarioEnProceso, ProductoCatalogo } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, Info, Plus, Edit, Trash2, ClipboardList } from 'lucide-react';
import InventarioItemForm from '../components/inventario/InventarioItemForm';
import AjusteInventarioModal from '../components/inventario/AjusteInventarioModal';
import InventarioItemDetail from '../components/inventario/InventarioItemDetail';
import StockAlert from '../components/inventario/StockAlert';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

const estadoProcesoBadgeColor = (estado) => {
  const colors = {
    'piel_recibida': 'bg-blue-100 text-blue-700',
    'piel_limpia': 'bg-green-100 text-green-700',
    'piel_curtida': 'bg-purple-100 text-purple-700',
    'piel_recurtida': 'bg-orange-100 text-orange-700',
    'crosta': 'bg-yellow-100 text-yellow-700',
    'en_proceso_pintura': 'bg-pink-100 text-pink-700'
  };
  return colors[estado] || 'bg-gray-100 text-gray-700';
};

const estadoProcesoLabel = (estado) => {
  const labels = {
    'piel_recibida': 'Piel Recibida',
    'piel_limpia': 'Piel Limpia',
    'piel_curtida': 'Piel Curtida',
    'piel_recurtida': 'Piel Recurtida',
    'crosta': 'Crosta',
    'en_proceso_pintura': 'En Proceso de Pintura'
  };
  return labels[estado] || estado;
};

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function InventarioEnProcesoPage() {
  const [inventarios, setInventarios] = useState([]);
  const [filteredInventarios, setFilteredInventarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showControlModal, setShowControlModal] = useState(false);
  const [controlItem, setControlItem] = useState(null);
  const [catalogoProductos, setCatalogoProductos] = useState([]);

  // Nuevos estados para formulario y ajuste
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState(false);
  const [itemDetailSelected, setItemDetailSelected] = useState(null);

  // Filtros
  const [searchCodigo, setSearchCodigo] = useState('');
  const [searchDescripcion, setSearchDescripcion] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, catalogo] = await Promise.all([
        InventarioEnProceso.list(),
        ProductoCatalogo.list()
      ]);
      setInventarios(data);
      setFilteredInventarios(data);
      setCatalogoProductos(catalogo);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtrado
  useEffect(() => {
    let filtered = inventarios;
    if (searchCodigo) filtered = filtered.filter(i => (i.codigo || '').toLowerCase().includes(searchCodigo.toLowerCase()) || (i.codigo_lote || '').toLowerCase().includes(searchCodigo.toLowerCase()));
    if (searchDescripcion) filtered = filtered.filter(i => (i.descripcion || '').toLowerCase().includes(searchDescripcion.toLowerCase()));
    setFilteredInventarios(filtered);
  }, [searchCodigo, searchDescripcion, inventarios]);

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    setCurrentItem(item);
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleViewControl = (item) => {
    setControlItem(item);
    setShowControlModal(true);
  };

  const handleViewItemDetail = (item) => {
    setItemDetailSelected(item);
    setShowItemDetail(true);
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
    const hdrs = ['Código', 'Descripción', 'Código Lote', 'Origen', 'Estado Proceso', 'Cantidad Hojas', 'Costo Promedio', 'Color Base'];
    let csvContent = hdrs.join(',') + '\n';
    filteredInventarios.forEach(item => {
      const row = [
        `"${item.codigo || ''}"`,
        `"${item.descripcion || ''}"`,
        `"${item.codigo_lote || ''}"`,
        `"${item.origen_modulo || ''}"`,
        `"${estadoProcesoLabel(item.estado_proceso)}"`,
        item.cantidad_hojas || 0,
        item.costo_promedio || 0,
        `"${item.color_base || ''}"`
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

  const headers = ['Código', 'Descripción', 'Código Lote', 'Origen', 'Estado Proceso', 'Stock Actual (Hojas)', 'Estado Stock', 'Costo Unitario', 'Color Base', 'Acciones'];

  const renderRow = (item) => {
    const catalogoProd = catalogoProductos.find(p => p.codigo === item.codigo);
    const unidadMedida = catalogoProd?.unidad_medida || 'hoja';
    const stockMinimo = item.stock_minimo || 0;
    return (
      <tr key={item.id}>
        <td className="font-mono">{item.codigo}</td>
        <td>{item.descripcion}</td>
        <td className="font-mono">{item.codigo_lote}</td>
        <td className="capitalize">{item.origen_modulo}</td>
        <td>
          <span className={`px-2 py-1 rounded text-xs font-medium ${estadoProcesoBadgeColor(item.estado_proceso)}`}>
            {estadoProcesoLabel(item.estado_proceso)}
          </span>
        </td>
        <td className={`text-center font-bold ${(item.cantidad_hojas || 0) <= stockMinimo ? 'text-red-500' : ''}`}>{item.cantidad_hojas || 0}</td>
        <td><StockAlert stockActual={item.cantidad_hojas || 0} stockMinimo={stockMinimo} /></td>
        <td className="text-right font-bold text-blue-700">{item.costo_promedio ? formatCurrency(item.costo_promedio) : 'N/A'}</td>
        <td>{item.color_base || 'N/A'}</td>
        <td>
          <div className="flex space-x-1">
            <Button variant="outline" size="sm" onClick={() => handleViewControl(item)} title="Ver Control">
              <Info className="w-4 h-4 text-blue-600" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} title="Ver Detalle">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)} title="Editar">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)} title="Eliminar">
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
        title="Inventarios en Proceso"
        description="Control de cuero en etapas productivas entre materia prima y producto terminado"
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <div className="flex gap-2">
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Código / Lote</Label>
              <Input placeholder="Buscar por código o lote..." value={searchCodigo} onChange={e => setSearchCodigo(e.target.value)} />
            </div>
            <div>
              <Label>Descripción</Label>
              <Input placeholder="Buscar por descripción..." value={searchDescripcion} onChange={e => setSearchDescripcion(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="tabla-imprimible">
        <CardHeader>
          <CardTitle>Listado de Inventarios en Proceso</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredInventarios} renderRow={renderRow} />}
        </CardContent>
      </Card>

      {/* Modal Nuevo/Editar - usa InventarioItemForm con tipo inventario_en_proceso */}
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

      {/* Modal Ajuste */}
      {showAjusteModal && (
        <AjusteInventarioModal
          open={showAjusteModal}
          onOpenChange={setShowAjusteModal}
          onSuccess={loadData}
          tipoInventario="inventario_en_proceso"
        />
      )}

      {/* Modal Detalle */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de Inventario en Proceso</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Código:</span> {selectedItem.codigo}</p>
              <p><span className="font-semibold">Descripción:</span> {selectedItem.descripcion}</p>
              <p><span className="font-semibold">Código Lote:</span> {selectedItem.codigo_lote}</p>
              <p><span className="font-semibold">Origen:</span> <span className="capitalize">{selectedItem.origen_modulo}</span></p>
              <p><span className="font-semibold">Estado Proceso:</span> <span className={`px-2 py-1 rounded text-xs font-medium ${estadoProcesoBadgeColor(selectedItem.estado_proceso)}`}>{estadoProcesoLabel(selectedItem.estado_proceso)}</span></p>
              <p><span className="font-semibold">Cantidad Hojas (Stock Actual):</span> <strong>{selectedItem.cantidad_hojas || 0}</strong></p>
              <p><span className="font-semibold">Color Base:</span> {selectedItem.color_base || 'N/A'}</p>
              <p><span className="font-semibold">Fecha Ingreso:</span> {formatDate(selectedItem.fecha_ingreso_proceso)}</p>
              <p><span className="font-semibold">Submódulo Origen:</span> {selectedItem.submodulo_origen || 'N/A'}</p>
              <p><span className="font-semibold">Estado Actual:</span> {selectedItem.estado_actual || 'N/A'}</p>
              <p><span className="font-semibold">Costo Promedio:</span> {formatCurrency(selectedItem.costo_promedio)}</p>
              <p><span className="font-semibold">Costo Acumulado:</span> {formatCurrency(selectedItem.costo_acumulado)}</p>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Control */}
      <Dialog open={showControlModal} onOpenChange={setShowControlModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Control del Proceso</DialogTitle>
          </DialogHeader>
          {controlItem && (
            <div className="space-y-4">
              <div>
                <Label>Fecha de Ingreso al Proceso</Label>
                <Input type="date" value={controlItem.fecha_ingreso_proceso || ''} readOnly className="bg-gray-50" />
              </div>
              <div>
                <Label>Submódulo de Origen</Label>
                <Input value={controlItem.submodulo_origen || 'N/A'} readOnly className="bg-gray-50" />
              </div>
              <div>
                <Label>Estado Actual</Label>
                <Input value={controlItem.estado_actual || 'N/A'} readOnly className="bg-gray-50" />
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <p className="text-sm font-semibold mb-2">Trazabilidad:</p>
                <p className="text-xs">Origen: <span className="capitalize font-medium">{controlItem.origen_modulo}</span></p>
                <p className="text-xs">Lote: <span className="font-mono font-medium">{controlItem.codigo_lote}</span></p>
                <p className="text-xs">Estado: <span className="font-medium">{estadoProcesoLabel(controlItem.estado_proceso)}</span></p>
                <p className="text-xs">Stock Actual (Hojas): <span className="font-bold text-blue-700">{controlItem.cantidad_hojas || 0}</span></p>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowControlModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}