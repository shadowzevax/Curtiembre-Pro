import React, { useState, useEffect } from 'react';
import { PedidoMarroquinero } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Download } from 'lucide-react';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function VerConsolidadoDetalle() {
  const [consolidado, setConsolidado] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) loadData(id);
  }, []);

  const loadData = async (consolidadoId) => {
    setLoading(true);
    try {
      const pedidos = await PedidoMarroquinero.list();
      const pedidosConsolidado = pedidos.filter(p => p.pedido_consolidado === consolidadoId);

      const detalleAgrupado = {};
      let totalHojasGeneral = 0;

      pedidosConsolidado.forEach(pedido => {
        totalHojasGeneral += pedido.total_hojas || 0;
        pedido.items?.forEach(item => {
          if (!detalleAgrupado[item.color]) {
            detalleAgrupado[item.color] = { color: item.color, placas: {}, total: 0 };
          }
          Object.keys(item).forEach(key => {
            if (key !== 'color' && key !== 'total' && typeof item[key] === 'number') {
              if (!detalleAgrupado[item.color].placas[key]) {
                detalleAgrupado[item.color].placas[key] = 0;
              }
              detalleAgrupado[item.color].placas[key] += item[key];
              detalleAgrupado[item.color].total += item[key];
            }
          });
        });
      });

      setConsolidado({
        numero_consolidado: consolidadoId,
        fecha_solicitud: pedidosConsolidado[0]?.fecha_solicitud,
        total_hojas: totalHojasGeneral,
        pedidos: pedidosConsolidado,
        detalle_agrupado: Object.values(detalleAgrupado)
      });
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();
  
  const handleExport = () => {
    if (!consolidado) return;
    const csv = [
      ['Consolidado', consolidado.numero_consolidado],
      ['Total Hojas', consolidado.total_hojas],
      [],
      ['Color', 'Placas', 'Total Hojas'],
      ...consolidado.detalle_agrupado.map(d => [d.color, Object.keys(d.placas).join(', '), d.total])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consolidado_detalle_${consolidado.numero_consolidado}.csv`;
    a.click();
  };

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!consolidado) return <div className="p-6">No se encontró el consolidado</div>;

  return (
    <div className="p-6">
      <PageHeader
        title="Ver Consolidado (Detalle)"
        description="Análisis completo del consolidado"
        actionButton={
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir
            </Button>
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Exportar Excel
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader><CardTitle>Encabezado</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div><strong>No. Pedido Consolidado:</strong> {consolidado.numero_consolidado}</div>
            <div><strong>Fecha Solicitud:</strong> {formatDate(consolidado.fecha_solicitud)}</div>
            <div><strong>Total Hojas:</strong> {consolidado.total_hojas}</div>
            <div><strong>No. de IDs:</strong> {consolidado.pedidos.length}</div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader><CardTitle>Detalle Consolidado Agrupado</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-blue-100">
                <tr>
                  <th className="border p-2">COLOR</th>
                  <th className="border p-2">PLACAS</th>
                  <th className="border p-2">TOTAL HOJAS</th>
                </tr>
              </thead>
              <tbody>
                {consolidado.detalle_agrupado.map((item, idx) => (
                  <tr key={idx}>
                    <td className="border p-2 font-semibold">{item.color}</td>
                    <td className="border p-2">{Object.keys(item.placas).join(', ')}</td>
                    <td className="border p-2 text-center font-bold">{item.total}</td>
                  </tr>
                ))}
                <tr className="bg-green-100 font-bold">
                  <td colSpan="2" className="border p-2 text-right">TOTAL</td>
                  <td className="border p-2 text-center">{consolidado.total_hojas}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pedidos Incluidos</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">No. ID</th>
                  <th className="border p-2">Nombre del Marroquinero</th>
                  <th className="border p-2">Total Hojas</th>
                </tr>
              </thead>
              <tbody>
                {consolidado.pedidos.map((pedido) => (
                  <tr key={pedido.id}>
                    <td className="border p-2 font-mono">{pedido.numero_pedido}</td>
                    <td className="border p-2">{pedido.nombre_marroquinero}</td>
                    <td className="border p-2 text-center font-bold">{pedido.total_hojas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}