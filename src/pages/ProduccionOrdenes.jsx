import React, { useState, useEffect } from 'react';
import { ProcesoProduccion, ProductoTerminado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Eye, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function ProduccionOrdenes() {
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [procesosData, productosData] = await Promise.all([
        ProcesoProduccion.list(),
        ProductoTerminado.list()
      ]);
      setOrdenes(procesosData);
      setProductos(productosData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    setCurrentItem(item || {
      numero_proceso: `OP-${Date.now()}`,
      tipo_proceso: 'recepcion',
      codigo_lote: '',
      fecha_inicio: new Date().toISOString().split('T')[0],
      fecha_fin: '',
      estado: 'pendiente',
      cantidad_pieles: 0,
      observaciones: ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (currentItem.id) {
        await ProcesoProduccion.update(currentItem.id, currentItem);
      } else {
        await ProcesoProduccion.create(currentItem);
      }
      setShowModal(false);
      loadData();
      alert("Orden de producción guardada con éxito.");
    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar la orden de producción.");
    }
  };

  const handleComplete = async (orden) => {
    if (window.confirm("¿Está seguro de que desea marcar esta orden como completada?")) {
      try {
        await ProcesoProduccion.update(orden.id, { estado: 'completado' });
        loadData();
        alert("Orden completada con éxito.");
      } catch (error) {
        alert("Error al completar la orden.");
      }
    }
  };

  const handleExport = () => {
    let csvContent = "Número,Tipo,Lote,Fecha Inicio,Estado,Cantidad\n";
    csvContent += ordenes.map(o =>
      `"${o.numero_proceso}","${o.tipo_proceso}","${o.codigo_lote}","${formatDate(o.fecha_inicio)}","${o.estado}","${o.cantidad_pieles || o.cantidad_total_lote}"`
    ).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `ordenes_produccion_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  const headers = ["Número", "Tipo Proceso", "Lote", "Fecha Inicio", "Cantidad", "Estado", "Acciones"];
  const renderRow = (orden) => (
    <tr key={orden.id}>
      <td>{orden.numero_proceso}</td>
      <td className="capitalize">{orden.tipo_proceso}</td>
      <td>{orden.codigo_lote}</td>
      <td>{formatDate(orden.fecha_inicio)}</td>
      <td>{orden.cantidad_pieles || orden.cantidad_total_lote}</td>
      <td>
        <Badge className={
          orden.estado === 'completado' ? 'bg-green-500' :
          orden.estado === 'en_proceso' ? 'bg-blue-500' :
          'bg-yellow-500'
        }>
          {orden.estado}
        </Badge>
      </td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedItem(orden); setShowDetailModal(true); }}><Eye className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(orden)}><Edit className="w-4 h-4" /></Button>
          {orden.estado !== 'completado' && (
            <Button variant="outline" size="sm" onClick={() => handleComplete(orden)} className="text-green-600"><CheckCircle className="w-4 h-4" /></Button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-6">
      <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
      <PageHeader
        title="Órdenes de Producción"
        description="Gestiona y supervisa las órdenes de producción."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nueva Orden
          </Button>
        }
      />

      <div id="tabla-imprimible">
        <Card>
          <CardHeader><CardTitle>Listado de Órdenes de Producción</CardTitle></CardHeader>
          <CardContent>
            <DataTable headers={headers} data={ordenes} renderRow={renderRow} loading={loading} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentItem?.id ? 'Editar' : 'Nueva'} Orden de Producción</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Número *</Label>
                <Input value={currentItem?.numero_proceso || ''} onChange={e => setCurrentItem({ ...currentItem, numero_proceso: e.target.value })} required />
              </div>
              <div>
                <Label>Tipo Proceso *</Label>
                <Select value={currentItem?.tipo_proceso || ''} onValueChange={v => setCurrentItem({ ...currentItem, tipo_proceso: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recepcion">Recepción</SelectItem>
                    <SelectItem value="limpieza">Limpieza</SelectItem>
                    <SelectItem value="curtido">Curtido</SelectItem>
                    <SelectItem value="acabado">Acabado</SelectItem>
                    <SelectItem value="recurtido">Recurtido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Código Lote *</Label>
              <Input value={currentItem?.codigo_lote || ''} onChange={e => setCurrentItem({ ...currentItem, codigo_lote: e.target.value })} required />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Fecha Inicio *</Label>
                <Input type="date" value={currentItem?.fecha_inicio || ''} onChange={e => setCurrentItem({ ...currentItem, fecha_inicio: e.target.value })} required />
              </div>
              <div>
                <Label>Fecha Fin</Label>
                <Input type="date" value={currentItem?.fecha_fin || ''} onChange={e => setCurrentItem({ ...currentItem, fecha_fin: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input type="number" value={currentItem?.cantidad_pieles || ''} onChange={e => setCurrentItem({ ...currentItem, cantidad_pieles: parseFloat(e.target.value) })} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={currentItem?.estado || 'pendiente'} onValueChange={v => setCurrentItem({ ...currentItem, estado: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({ ...currentItem, observaciones: e.target.value })} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de la Orden</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Número:</span> {selectedItem.numero_proceso}</p>
              <p><span className="font-semibold">Tipo:</span> <span className="capitalize">{selectedItem.tipo_proceso}</span></p>
              <p><span className="font-semibold">Lote:</span> {selectedItem.codigo_lote}</p>
              <p><span className="font-semibold">Fecha Inicio:</span> {formatDate(selectedItem.fecha_inicio)}</p>
              {selectedItem.fecha_fin && <p><span className="font-semibold">Fecha Fin:</span> {formatDate(selectedItem.fecha_fin)}</p>}
              <p><span className="font-semibold">Cantidad:</span> {selectedItem.cantidad_pieles || selectedItem.cantidad_total_lote}</p>
              <p><span className="font-semibold">Estado:</span> <Badge>{selectedItem.estado}</Badge></p>
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}