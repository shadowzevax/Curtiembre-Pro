import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AjusteInventario, Insumo, ProductoTerminado } from '@/entities/all';

export default function AjusteInventarioModal({ open, onOpenChange, onSuccess, tipoInventario }) {
  const [formData, setFormData] = useState({
    consecutivo: '',
    fecha: new Date().toISOString().split('T')[0],
    quien_elaboro: '',
    producto_id: '',
    producto_codigo: '',
    producto_nombre: '',
    stock_actual: 0,
    cantidad_fisica: 0,
    diferencia: 0,
    tipo_inventario: tipoInventario,
    observaciones: ''
  });
  const [todosLosProductos, setTodosLosProductos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    try {
      // Cargar productos según el tipo de inventario
      let items = [];
      if (tipoInventario === 'materia_prima' || tipoInventario === 'producto_terminado') {
        items = await ProductoTerminado.list();
      } else if (tipoInventario === 'insumo') {
        items = await Insumo.list();
      }
      setTodosLosProductos(items);

      // Generar consecutivo automático
      const ajustes = await AjusteInventario.list();
      const maxNum = ajustes.reduce((max, a) => {
        const match = a.consecutivo?.match(/AJ(\d+)/);
        return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      const nuevoConsecutivo = `AJ${String(maxNum + 1).padStart(3, '0')}`;
      
      setFormData(prev => ({ ...prev, consecutivo: nuevoConsecutivo }));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleProductoChange = (productoId) => {
    const producto = todosLosProductos.find(p => p.id === productoId);
    if (producto) {
      setFormData(prev => ({
        ...prev,
        producto_id: productoId,
        producto_codigo: producto.codigo || producto.referencia || '',
        producto_nombre: producto.nombre || producto.descripcion || '',
        stock_actual: producto.stock_actual || 0,
        cantidad_fisica: 0,
        diferencia: 0
      }));
    }
  };

  const handleCantidadFisicaChange = (value) => {
    const cantidadFisica = parseFloat(value) || 0;
    const diferencia = cantidadFisica - formData.stock_actual;
    setFormData(prev => ({ ...prev, cantidad_fisica: cantidadFisica, diferencia }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await AjusteInventario.create(formData);
      
      // Actualizar el stock del producto
      if (formData.tipo_inventario === 'materia_prima' || formData.tipo_inventario === 'producto_terminado') {
        await ProductoTerminado.update(formData.producto_id, { stock_actual: formData.cantidad_fisica });
      } else if (formData.tipo_inventario === 'insumo') {
        await Insumo.update(formData.producto_id, { stock_actual: formData.cantidad_fisica });
      }
      
      alert('Ajuste de inventario guardado exitosamente.');
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving:', error);
      alert('Error al guardar el ajuste.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Ajuste de Inventario</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Consecutivo</Label>
              <Input value={formData.consecutivo} readOnly className="bg-blue-50 font-bold" />
            </div>
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={formData.fecha} onChange={e => setFormData(prev => ({ ...prev, fecha: e.target.value }))} required />
            </div>
          </div>
          <div>
            <Label>Quién Elaboró</Label>
            <Input value={formData.quien_elaboro} onChange={e => setFormData(prev => ({ ...prev, quien_elaboro: e.target.value }))} placeholder="Nombre de quien realiza el ajuste" />
          </div>
          <div>
            <Label>Producto *</Label>
            <Select value={formData.producto_id} onValueChange={handleProductoChange}>
              <SelectTrigger><SelectValue placeholder="Seleccionar producto" /></SelectTrigger>
              <SelectContent>
                {todosLosProductos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo || p.referencia} - {p.nombre || p.descripcion}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <Label>Stock Actual (Sistema)</Label>
              <Input type="number" value={formData.stock_actual} readOnly className="bg-white font-bold text-blue-600" />
            </div>
            <div>
              <Label>Cantidad Física (Conteo) *</Label>
              <Input type="number" step="0.01" value={formData.cantidad_fisica} onChange={e => handleCantidadFisicaChange(e.target.value)} required className="font-medium" />
            </div>
            <div>
              <Label>Diferencia</Label>
              <Input 
                type="number" 
                value={formData.diferencia} 
                readOnly 
                className={`font-bold ${formData.diferencia > 0 ? 'text-green-600 bg-green-50' : formData.diferencia < 0 ? 'text-red-600 bg-red-50' : 'bg-white'}`} 
              />
            </div>
          </div>
          <div>
            <Label>Observaciones</Label>
            <Input value={formData.observaciones} onChange={e => setFormData(prev => ({ ...prev, observaciones: e.target.value }))} placeholder="Motivo del ajuste..." />
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}