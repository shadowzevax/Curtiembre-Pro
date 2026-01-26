import React, { useState, useEffect, useCallback } from 'react';
import { InventarioEnProceso } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, Info } from 'lucide-react';

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

export default function InventarioEnProcesoPage() {
  const [inventarios, setInventarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showControlModal, setShowControlModal] = useState(false);
  const [controlItem, setControlItem] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await InventarioEnProceso.list();
      setInventarios(data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleViewControl = (item) => {
    setControlItem(item);
    setShowControlModal(true);
  };

  const handleExport = () => {
    alert('Función de exportar en desarrollo.');
  };

  const handlePrint = () => window.print();

  const headers = ['Código', 'Descripción', 'Código Lote', 'Origen', 'Estado Proceso', 'Cantidad Hojas', 'Color Base', 'Acciones'];
  
  const renderRow = (item) => (
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
      <td className="text-center font-bold">{item.cantidad_hojas}</td>
      <td>{item.color_base || 'N/A'}</td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleViewControl(item)} title="Ver Control">
            <Info className="w-4 h-4 text-blue-600" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)} title="Ver Detalle">
            <Eye className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Inventarios en Proceso"
        description="Control de cuero en etapas productivas entre materia prima y producto terminado"
        onExportExcel={handleExport}
        onPrint={handlePrint}
      />
      
      <Card id="tabla-imprimible">
        <CardHeader>
          <CardTitle>Listado de Inventarios en Proceso</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={inventarios} renderRow={renderRow} />}
        </CardContent>
      </Card>

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
              <p><span className="font-semibold">Cantidad Hojas:</span> {selectedItem.cantidad_hojas}</p>
              <p><span className="font-semibold">Color Base:</span> {selectedItem.color_base || 'N/A'}</p>
              <p><span className="font-semibold">Fecha Ingreso:</span> {formatDate(selectedItem.fecha_ingreso_proceso)}</p>
              <p><span className="font-semibold">Submódulo Origen:</span> {selectedItem.submodulo_origen || 'N/A'}</p>
              <p><span className="font-semibold">Estado Actual:</span> {selectedItem.estado_actual || 'N/A'}</p>
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

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