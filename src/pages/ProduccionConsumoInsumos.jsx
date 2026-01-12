import React, { useState, useEffect } from 'react';
import { MovimientoInventario, Insumo, ProcesoProduccion } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function ProduccionConsumoInsumos() {
  const [movimientos, setMovimientos] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [movimientosData, insumosData, procesosData] = await Promise.all([
        MovimientoInventario.filter({ tipo_movimiento: 'salida' }),
        Insumo.list(),
        ProcesoProduccion.list()
      ]);
      setMovimientos(movimientosData);
      setInsumos(insumosData);
      setProcesos(procesosData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    setCurrentItem(item || {
      tipo_movimiento: 'salida',
      insumo_id: '',
      cantidad: 0,
      fecha_movimiento: new Date().toISOString().split('T')[0],
      referencia: '',
      observaciones: ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (currentItem.id) {
        await MovimientoInventario.update(currentItem.id, currentItem);
      } else {
        await MovimientoInventario.create(currentItem);
        // Actualizar stock del insumo
        const insumo = insumos.find(i => i.id === currentItem.insumo_id);
        if (insumo) {
          await Insumo.update(insumo.id, {
            stock_actual: (insumo.stock_actual || 0) - (currentItem.cantidad || 0)
          });
        }
      }
      setShowModal(false);
      loadData();
      alert("Consumo registrado con éxito.");
    } catch (error) {
      console.error("Error:", error);
      alert("Error al registrar el consumo.");
    }
  };

  const handleDelete = async (id, insumoId, cantidad) => {
    if (window.confirm("¿Está seguro de que desea eliminar este registro?")) {
      try {
        await MovimientoInventario.delete(id);
        // Restaurar stock
        const insumo = insumos.find(i => i.id === insumoId);
        if (insumo) {
          await Insumo.update(insumo.id, {
            stock_actual: (insumo.stock_actual || 0) + (cantidad || 0)
          });
        }
        loadData();
        alert("Registro eliminado con éxito.");
      } catch (error) {
        alert("Error al eliminar el registro.");
      }
    }
  };

  const handleExport = () => {
    let csvContent = "Fecha,Insumo,Cantidad,Referencia\n";
    csvContent += movimientos.map(m =>
      `"${formatDate(m.fecha_movimiento)}","${getInsumoNombre(m.insumo_id)}","${m.cantidad}","${m.referencia}"`
    ).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `consumo_insumos_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  const getInsumoNombre = (insumoId) => {
    const insumo = insumos.find(i => i.id === insumoId);
    return insumo ? insumo.nombre : insumoId;
  };

  const headers = ["Fecha", "Insumo", "Cantidad", "Referencia", "Observaciones", "Acciones"];
  const renderRow = (mov) => (
    <tr key={mov.id}>
      <td>{formatDate(mov.fecha_movimiento)}</td>
      <td>{getInsumoNombre(mov.insumo_id)}</td>
      <td className="text-right font-medium">{mov.cantidad}</td>
      <td>{mov.referencia || '-'}</td>
      <td>{mov.observaciones || '-'}</td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(mov)}><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(mov.id, mov.insumo_id, mov.cantidad)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-6">
      <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
      <PageHeader
        title="Consumo de Insumos"
        description="Registra el consumo de insumos en los procesos de producción."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Registrar Consumo
          </Button>
        }
      />

      <div id="tabla-imprimible">
        <Card>
          <CardHeader><CardTitle>Registro de Consumos</CardTitle></CardHeader>
          <CardContent>
            <DataTable headers={headers} data={movimientos} renderRow={renderRow} loading={loading} />
          </CardContent>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentItem?.id ? 'Editar' : 'Registrar'} Consumo de Insumo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Fecha *</Label>
              <Input type="date" value={currentItem?.fecha_movimiento || ''} onChange={e => setCurrentItem({ ...currentItem, fecha_movimiento: e.target.value })} required />
            </div>
            <div>
              <Label>Insumo *</Label>
              <Select value={currentItem?.insumo_id || ''} onValueChange={v => setCurrentItem({ ...currentItem, insumo_id: v })} disabled={!!currentItem?.id}>
                <SelectTrigger><SelectValue placeholder="Seleccionar insumo" /></SelectTrigger>
                <SelectContent>
                  {insumos.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nombre} (Stock: {i.stock_actual})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cantidad *</Label>
              <Input type="number" step="0.01" value={currentItem?.cantidad || ''} onChange={e => setCurrentItem({ ...currentItem, cantidad: parseFloat(e.target.value) })} required />
            </div>
            <div>
              <Label>Referencia (Proceso/Lote)</Label>
              <Input value={currentItem?.referencia || ''} onChange={e => setCurrentItem({ ...currentItem, referencia: e.target.value })} placeholder="Ej: Proceso Curtido - Lote 123" />
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
    </div>
  );
}