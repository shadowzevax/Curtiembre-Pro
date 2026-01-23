import React, { useState, useEffect } from 'react';
import { PedidoMarroquinero } from '@/entities/all';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, Printer, Download } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function ConsolidadosGenerales() {
  const [consolidados, setConsolidados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedConsolidado, setSelectedConsolidado] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const pedidos = await PedidoMarroquinero.list();
      const grouped = {};

      pedidos.forEach(p => {
        if (p.pedido_consolidado) {
          if (!grouped[p.pedido_consolidado]) {
            grouped[p.pedido_consolidado] = {
              numero_consolidado: p.pedido_consolidado,
              fecha_solicitud: p.fecha_solicitud,
              pedidos: [],
              total_hojas: 0,
              estado: p.estado
            };
          }
          grouped[p.pedido_consolidado].pedidos.push(p);
          grouped[p.pedido_consolidado].total_hojas += p.total_hojas || 0;
        }
      });

      setConsolidados(Object.values(grouped));
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = (consolidado) => {
    window.print();
  };

  const handleExport = (consolidado) => {
    const csv = [
      ['No. Consolidado', 'Fecha', 'Cantidad Pedidos', 'Total Hojas'],
      [consolidado.numero_consolidado, formatDate(consolidado.fecha_solicitud), consolidado.pedidos.length, consolidado.total_hojas]
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consolidado_${consolidado.numero_consolidado}.csv`;
    a.click();
  };

  const headers = ['No. ID', 'Fecha Solicitud', 'Cantidad de Pedidos', 'Total Hojas', 'Estado', 'Acciones'];

  const renderRow = (consolidado) => (
    <TableRow key={consolidado.numero_consolidado}>
      <TableCell className="font-mono font-bold">{consolidado.numero_consolidado}</TableCell>
      <TableCell>{formatDate(consolidado.fecha_solicitud)}</TableCell>
      <TableCell className="text-center">{consolidado.pedidos.length}</TableCell>
      <TableCell className="text-center font-bold">{consolidado.total_hojas}</TableCell>
      <TableCell>
        <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-700">
          {consolidado.estado.toUpperCase()}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedConsolidado(consolidado); setShowDetailModal(true); }}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handlePrint(consolidado)}>
            <Printer className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport(consolidado)}>
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Consolidados Generales"
        description="Ver, imprimir y exportar consolidados"
      />

      <Card>
        <CardHeader><CardTitle>Listado de Consolidados</CardTitle></CardHeader>
        <CardContent>
          <DataTable 
            headers={headers} 
            data={consolidados} 
            renderRow={renderRow} 
            loading={loading}
          />
        </CardContent>
      </Card>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalle del Consolidado</DialogTitle></DialogHeader>
          {selectedConsolidado && (
            <div className="space-y-4">
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <p><strong>No. ID Consolidado:</strong> <span className="font-mono">{selectedConsolidado.numero_consolidado}</span></p>
                  <p><strong>Fecha:</strong> {formatDate(selectedConsolidado.fecha_solicitud)}</p>
                  <p><strong>Cantidad de Pedidos:</strong> {selectedConsolidado.pedidos.length}</p>
                  <p><strong>Total Hojas:</strong> <span className="font-bold">{selectedConsolidado.total_hojas}</span></p>
                </div>
              </div>

              {(() => {
                // Consolidar todos los items por color y placa
                const consolidado = {};
                const allPlacas = new Set();

                selectedConsolidado.pedidos.forEach(pedido => {
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

                const placasArray = Array.from(allPlacas);

                return (
                  <div>
                    <h4 className="font-bold mb-3 text-lg">Tabla Consolidada</h4>
                    <div className="border rounded-lg overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="border p-2 text-left sticky left-0 bg-gray-100 z-10">COLOR</th>
                            {placasArray.map(placa => (
                              <th key={placa} className="border p-2 text-center">{placa.toUpperCase()}</th>
                            ))}
                            <th className="border p-2 text-center bg-yellow-100 font-bold">TOTAL HOJAS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(consolidado).map((color, idx) => (
                            <tr key={color} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="border p-2 font-medium sticky left-0 bg-white">{color}</td>
                              {placasArray.map(placa => (
                                <td key={placa} className="border p-2 text-center">
                                  {consolidado[color][placa] || 0}
                                </td>
                              ))}
                              <td className="border p-2 text-center font-bold bg-yellow-50">
                                {consolidado[color].total}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-green-100 font-bold">
                            <td className="border p-2 sticky left-0 bg-green-100">TOTALES</td>
                            {placasArray.map(placa => {
                              const total = Object.keys(consolidado).reduce(
                                (sum, color) => sum + (consolidado[color][placa] || 0),
                                0
                              );
                              return (
                                <td key={placa} className="border p-2 text-center">{total}</td>
                              );
                            })}
                            <td className="border p-2 text-center bg-yellow-200">
                              {Object.keys(consolidado).reduce(
                                (sum, color) => sum + consolidado[color].total,
                                0
                              )}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}