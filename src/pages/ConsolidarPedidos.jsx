import React, { useState, useEffect } from 'react';
import { PedidoMarroquinero } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square, Eye, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function ConsolidarPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [selectedForConsolidation, setSelectedForConsolidation] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Cargar IDs seleccionados desde URL
    const urlParams = new URLSearchParams(window.location.search);
    const selectedIds = urlParams.get('selected');
    if (selectedIds) {
      setSelectedForConsolidation(selectedIds.split(','));
    }
  }, []);

  const loadData = async () => {
    try {
      const data = await PedidoMarroquinero.list();
      setPedidos(data.filter(p => p.estado === 'pendiente'));
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const toggleSelection = (id) => {
    setSelectedForConsolidation(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handlePrevisualizar = () => {
    if (selectedForConsolidation.length === 0) {
      alert('Debe seleccionar al menos un pedido');
      return;
    }

    const pedidosSeleccionados = pedidos.filter(p => selectedForConsolidation.includes(p.id));
    
    // Consolidar todos los items por color y placa
    const consolidado = {};
    const allPlacas = new Set();

    pedidosSeleccionados.forEach(pedido => {
      pedido.items?.forEach(item => {
        const color = item.color;
        if (!consolidado[color]) {
          consolidado[color] = {};
        }
        
        Object.keys(item).forEach(key => {
          if (key !== 'color' && key !== 'total') {
            allPlacas.add(key);
            consolidado[color][key] = (consolidado[color][key] || 0) + (item[key] || 0);
          }
        });
      });
    });

    // Calcular totales por fila
    Object.keys(consolidado).forEach(color => {
      consolidado[color].total = Object.keys(consolidado[color]).reduce(
        (sum, placa) => sum + (consolidado[color][placa] || 0), 
        0
      );
    });

    setPreviewData({
      colores: consolidado,
      placas: Array.from(allPlacas),
      cantidadPedidos: pedidosSeleccionados.length
    });
    setShowPreview(true);
  };

  const handleConfirmarConsolidacion = async () => {
    try {
      const year = new Date().getFullYear();
      const pedidosConsolidados = await PedidoMarroquinero.list();
      const existentes = pedidosConsolidados.filter(p => p.pedido_consolidado?.startsWith(`PED-${year}`));
      const nextNum = existentes.length > 0 
        ? Math.max(...existentes.map(p => parseInt(p.pedido_consolidado.split('-')[2]) || 0)) + 1
        : 1;
      const numeroPedidoConsolidado = `PED-${year}-${String(nextNum).padStart(4, '0')}`;

      for (const pedidoId of selectedForConsolidation) {
        await PedidoMarroquinero.update(pedidoId, {
          pedido_consolidado: numeroPedidoConsolidado,
          estado: 'consolidado'
        });
      }

      alert(`Pedidos consolidados exitosamente: ${numeroPedidoConsolidado}`);
      setSelectedForConsolidation([]);
      setShowPreview(false);
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al consolidar pedidos');
    }
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Consolidar Pedidos"
        description="Seleccione pedidos pendientes para consolidar"
      />

      <Card>
        <CardHeader><CardTitle>Pedidos Pendientes</CardTitle></CardHeader>
        <CardContent>
          {pedidos.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No hay pedidos pendientes</p>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="p-2 text-left">
                        <input 
                          type="checkbox" 
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedForConsolidation(pedidos.map(p => p.id));
                            } else {
                              setSelectedForConsolidation([]);
                            }
                          }}
                          checked={selectedForConsolidation.length === pedidos.length && pedidos.length > 0}
                        />
                      </th>
                      <th className="p-2 text-left">No. ID</th>
                      <th className="p-2 text-left">Marroquinero</th>
                      <th className="p-2 text-left">Fecha Solicitud</th>
                      <th className="p-2 text-center">Estado</th>
                      <th className="p-2 text-right">Total Hojas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedidos.map(pedido => (
                      <tr key={pedido.id} className="border-t hover:bg-gray-50">
                        <td className="p-2">
                          <Button variant="ghost" size="sm" onClick={() => toggleSelection(pedido.id)}>
                            {selectedForConsolidation.includes(pedido.id) ? 
                              <CheckSquare className="w-5 h-5 text-green-600" /> : 
                              <Square className="w-5 h-5" />
                            }
                          </Button>
                        </td>
                        <td className="p-2 font-mono font-semibold">{pedido.numero_pedido}</td>
                        <td className="p-2">{pedido.nombre_marroquinero}</td>
                        <td className="p-2">{formatDate(pedido.fecha_solicitud)}</td>
                        <td className="p-2 text-center">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                            {pedido.estado.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-2 text-right font-bold">{pedido.total_hojas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3">
                <Button 
                  onClick={handlePrevisualizar}
                  disabled={selectedForConsolidation.length === 0}
                  variant="outline"
                  className="border-blue-600 text-blue-700 hover:bg-blue-50"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Previsualizar Consolidado ({selectedForConsolidation.length})
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Previsualización del Consolidado</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded border border-blue-200">
                <p className="font-semibold">Cantidad de pedidos: {previewData.cantidadPedidos}</p>
              </div>

              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2 text-left sticky left-0 bg-gray-100 z-10">COLOR</th>
                      {previewData.placas.map(placa => (
                        <th key={placa} className="border p-2 text-center">{placa.toUpperCase()}</th>
                      ))}
                      <th className="border p-2 text-center bg-yellow-100 font-bold">TOTAL HOJAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(previewData.colores).map((color, idx) => (
                      <tr key={color} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border p-2 font-medium sticky left-0 bg-white">{color}</td>
                        {previewData.placas.map(placa => (
                          <td key={placa} className="border p-2 text-center">
                            {previewData.colores[color][placa] || 0}
                          </td>
                        ))}
                        <td className="border p-2 text-center font-bold bg-yellow-50">
                          {previewData.colores[color].total}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-green-100 font-bold">
                      <td className="border p-2 sticky left-0 bg-green-100">TOTALES</td>
                      {previewData.placas.map(placa => {
                        const total = Object.keys(previewData.colores).reduce(
                          (sum, color) => sum + (previewData.colores[color][placa] || 0),
                          0
                        );
                        return (
                          <td key={placa} className="border p-2 text-center">{total}</td>
                        );
                      })}
                      <td className="border p-2 text-center bg-yellow-200">
                        {Object.keys(previewData.colores).reduce(
                          (sum, color) => sum + previewData.colores[color].total,
                          0
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => setShowPreview(false)}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConfirmarConsolidacion}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckSquare className="w-4 h-4 mr-2" />
                  Confirmar Consolidación
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}