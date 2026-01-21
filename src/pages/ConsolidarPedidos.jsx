import React, { useState, useEffect } from 'react';
import { PedidoMarroquinero } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square } from 'lucide-react';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function ConsolidarPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [selectedForConsolidation, setSelectedForConsolidation] = useState([]);

  useEffect(() => {
    loadData();
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

  const handleConsolidar = async () => {
    if (selectedForConsolidation.length === 0) {
      alert('Debe seleccionar al menos un pedido');
      return;
    }

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
                        <td className="p-2 text-right font-bold">{pedido.total_hojas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={handleConsolidar}
                  disabled={selectedForConsolidation.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Consolidar Seleccionados ({selectedForConsolidation.length})
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}