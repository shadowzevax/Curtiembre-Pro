import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MovimientoInventario, AjusteInventario, OrdenCompra, OrdenVenta } from '@/entities/all';
import { Package, Calendar, DollarSign, TrendingUp, FileText } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function InventarioItemDetail({ open, onOpenChange, item }) {
  const [movimientos, setMovimientos] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && item) {
      loadMovimientos();
    }
  }, [open, item]);

  const loadMovimientos = async () => {
    setLoading(true);
    try {
      // Obtener todos los movimientos de inventario de este producto
      const movs = await MovimientoInventario.filter({ insumo_id: item.id });
      
      // Enriquecer con información adicional
      const enrichedMovs = await Promise.all(movs.map(async (mov) => {
        let moduloOrigen = 'Movimiento Inventario';
        let tipoDocumento = mov.tipo_movimiento || 'N/A';
        let numeroDocumento = mov.referencia || 'N/A';
        
        // Intentar obtener más detalles según la referencia
        if (mov.referencia) {
          if (mov.referencia.includes('CI-') || mov.referencia.includes('CH-') || 
              mov.referencia.includes('CSP-') || mov.referencia.includes('CGG-')) {
            moduloOrigen = 'Compras';
            try {
              const compras = await OrdenCompra.filter({ 
                numero_documento: mov.referencia.split('-')[1] 
              });
              if (compras.length > 0) {
                tipoDocumento = compras[0].tipo_documento || 'Factura';
              }
            } catch (e) { /* Ignorar */ }
          } else if (mov.referencia.includes('FV-')) {
            moduloOrigen = 'Ventas';
            try {
              const ventas = await OrdenVenta.filter({ 
                numero_documento: mov.referencia.split('-')[1] 
              });
              if (ventas.length > 0) {
                tipoDocumento = ventas[0].tipo_documento || 'Factura Venta';
              }
            } catch (e) { /* Ignorar */ }
          } else if (mov.referencia.includes('AJU-')) {
            moduloOrigen = 'Ajuste Inventario';
            tipoDocumento = 'Ajuste';
          }
        }
        
        return {
          ...mov,
          moduloOrigen,
          tipoDocumento,
          numeroDocumento
        };
      }));
      
      // Ordenar por fecha descendente
      enrichedMovs.sort((a, b) => new Date(b.fecha_movimiento) - new Date(a.fecha_movimiento));
      
      setMovimientos(enrichedMovs);
    } catch (error) {
      console.error('Error loading movimientos:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Detalle del Producto</DialogTitle>
        </DialogHeader>
        
        {/* Información básica en formato horizontal */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-xs text-slate-600">Código</p>
              <p className="font-semibold">{item.codigo}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-green-600" />
            <div>
              <p className="text-xs text-slate-600">Descripción</p>
              <p className="font-semibold text-sm">{item.descripcion || item.nombre}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <div>
              <p className="text-xs text-slate-600">Stock Actual</p>
              <p className="font-bold text-lg text-purple-600">{item.stock_actual || 0}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-600" />
            <div>
              <p className="text-xs text-slate-600">Costo Promedio</p>
              <p className="font-semibold">{formatCurrency(item.costo_promedio)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            <div>
              <p className="text-xs text-slate-600">Unidad Medida</p>
              <p className="font-semibold">{item.unidad_medida || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-red-600" />
            <div>
              <p className="text-xs text-slate-600">Stock Mínimo</p>
              <p className="font-semibold">{item.stock_minimo || 0}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 col-span-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-xs text-slate-600">Valor Total Inventario</p>
              <p className="font-bold text-lg text-blue-600">
                {formatCurrency((item.stock_actual || 0) * (item.costo_promedio || 0))}
              </p>
            </div>
          </div>
        </div>

        {/* Tabla de historial de movimientos */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Historial de Movimientos
          </h3>
          
          {loading ? (
            <div className="text-center py-8 text-slate-500">Cargando movimientos...</div>
          ) : movimientos.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No hay movimientos registrados</div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left font-semibold">Fecha</th>
                    <th className="p-3 text-left font-semibold">Módulo Origen</th>
                    <th className="p-3 text-left font-semibold">Tipo Documento</th>
                    <th className="p-3 text-left font-semibold">No. Documento</th>
                    <th className="p-3 text-right font-semibold">Cantidad</th>
                    <th className="p-3 text-right font-semibold">Costo Unitario</th>
                    <th className="p-3 text-right font-semibold">Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov, index) => (
                    <tr key={mov.id || index} className="border-t hover:bg-slate-50">
                      <td className="p-3">{formatDate(mov.fecha_movimiento)}</td>
                      <td className="p-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                          mov.moduloOrigen === 'Compras' ? 'bg-blue-100 text-blue-700' :
                          mov.moduloOrigen === 'Ventas' ? 'bg-green-100 text-green-700' :
                          mov.moduloOrigen === 'Ajuste Inventario' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {mov.moduloOrigen}
                        </span>
                      </td>
                      <td className="p-3 capitalize">{mov.tipoDocumento}</td>
                      <td className="p-3 font-mono text-xs">{mov.numeroDocumento}</td>
                      <td className={`p-3 text-right font-semibold ${
                        (mov.cantidad || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {mov.cantidad > 0 ? '+' : ''}{mov.cantidad || 0}
                      </td>
                      <td className="p-3 text-right">{formatCurrency(mov.costo_unitario)}</td>
                      <td className="p-3 text-right font-semibold">
                        {formatCurrency((mov.cantidad || 0) * (mov.costo_unitario || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex justify-end mt-4">
          <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}