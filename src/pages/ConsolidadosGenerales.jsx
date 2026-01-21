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

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function ConsolidadosGenerales() {
  const [consolidados, setConsolidados] = useState([]);
  const [loading, setLoading] = useState(true);
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
          <Button variant="outline" size="sm" onClick={() => navigate(createPageUrl(`VerConsolidadoDetalle?id=${consolidado.numero_consolidado}`))}>
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
    </div>
  );
}