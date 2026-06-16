import React, { useState, useEffect, useCallback } from 'react';
import { InventarioEnProceso, MovimientoInventario } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Edit, Trash2, Eye, ClipboardList } from 'lucide-react';
import InventarioItemForm from '../components/inventario/InventarioItemForm';
import AjusteInventarioModal from '../components/inventario/AjusteInventarioModal';
import InventarioItemDetail from '../components/inventario/InventarioItemDetail';
import StockAlert from '../components/inventario/StockAlert';

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

  // Filtrado por código y descripción
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
    setFilteredProductos(filtered);
  }, [searchCodigo, searchDescripcion, productos]);

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    setCurrentItem(item);
    setShowModal(true);
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
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
    const hdrs = ['Código', 'Descripción', 'Categoría', 'Stock Actual', 'Stock Mínimo', 'U. Medida', 'Costo Promedio', 'Valor Total'];
    let csvContent = hdrs.join(',') + '\n';
    filteredProductos.forEach(item => {
      const valorTotal = (item.stock_actual || 0) * (item.costo_promedio || 0);
      const row = [
        `"${item.codigo || ''}"`,
        `"${item.descripcion || ''}"`,
        `"${CATEGORIA_LABELS[item.categoria] || item.categoria || ''}"`,
        item.stock_actual || 0,
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

  const tableHeaders = [
    'Código', 'Descripción', 'Categoría',
    'Stock Actual', 'Stock Mínimo', 'Estado Stock', 'Unidad de Medida',
    'Costo Promedio', 'Valor Total', 'Acciones'
  ];

  const renderRow = (item) => {
    const valorTotal = (item.stock_actual || 0) * (item.costo_promedio || 0);
    return (
      <tr key={item.id}>
        <td>{item.codigo}</td>
        <td>{item.descripcion}</td>
        <td>{CATEGORIA_LABELS[item.categoria] || item.categoria || 'N/A'}</td>
        <td className={(item.stock_actual || 0) <= (item.stock_minimo || 0) ? 'text-red-500 font-bold' : ''}>
          {item.stock_actual || 0}
        </td>
        <td>{item.stock_minimo || 0}</td>
        <td><StockAlert stockActual={item.stock_actual || 0} stockMinimo={item.stock_minimo || 0} /></td>
        <td>{item.unidad_medida || 'N/A'}</td>
        <td>{formatCurrency(item.costo_promedio)}</td>
        <td className="text-right font-bold text-emerald-700">{formatCurrency(valorTotal)}</td>
        <td>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)}>
              <Eye className="w-4 h-4" />
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
              <Label htmlFor="searchCodigo">Código</Label>
              <Input
                id="searchCodigo"
                placeholder="Buscar por código o lote..."
                value={searchCodigo}
                onChange={e => setSearchCodigo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="searchDescripcion">Descripción</Label>
              <Input
                id="searchDescripcion"
                placeholder="Buscar por descripción..."
                value={searchDescripcion}
                onChange={e => setSearchDescripcion(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card id="tabla-imprimible">
        <CardHeader><CardTitle>Stock de Productos en Proceso</CardTitle></CardHeader>
        <CardContent>
          <DataTable headers={tableHeaders} data={filteredProductos} renderRow={renderRow} loading={loading} />
        </CardContent>
      </Card>

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
    </div>
  );
}