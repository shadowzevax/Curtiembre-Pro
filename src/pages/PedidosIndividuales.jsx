import React, { useState, useEffect } from 'react';
import { PedidoMarroquinero } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Printer, Download, ChevronDown, ChevronUp, CheckSquare, Square } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function PedidosIndividuales() {
  const [pedidos, setPedidos] = useState([]);
  const [filteredPedidos, setFilteredPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedForConsolidation, setSelectedForConsolidation] = useState([]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState(null);
  
  const [filtros, setFiltros] = useState({
    marroquinero: '',
    fechaSolicitud: '',
    estado: 'todos'
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filtros, pedidos]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await PedidoMarroquinero.list();
      setPedidos(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...pedidos];
    
    if (filtros.marroquinero) {
      filtered = filtered.filter(p => 
        p.nombre_marroquinero?.toLowerCase().includes(filtros.marroquinero.toLowerCase())
      );
    }
    
    if (filtros.fechaSolicitud) {
      filtered = filtered.filter(p => p.fecha_solicitud === filtros.fechaSolicitud);
    }
    
    if (filtros.estado !== 'todos') {
      filtered = filtered.filter(p => p.estado === filtros.estado);
    }
    
    setFilteredPedidos(filtered);
  };

  const toggleExpand = (id) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelection = (id) => {
    setSelectedForConsolidation(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  const handlePrint = (pedido) => {
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html><head><title>Pedido ${pedido.numero_pedido}</title></head>
      <body><h2>Pedido ${pedido.numero_pedido}</h2>
      <p><strong>Marroquinero:</strong> ${pedido.nombre_marroquinero}</p>
      <p><strong>Fecha:</strong> ${formatDate(pedido.fecha_solicitud)}</p>
      <p><strong>Total Hojas:</strong> ${pedido.total_hojas}</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExport = (pedido) => {
    const csv = [
      ['No. ID', 'Marroquinero', 'Fecha', 'Total Hojas'],
      [pedido.numero_pedido, pedido.nombre_marroquinero, formatDate(pedido.fecha_solicitud), pedido.total_hojas]
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedido_${pedido.numero_pedido}.csv`;
    a.click();
  };

  const headers = ['', 'No. ID', 'Fecha Solicitud', 'Nombre Marroquinero', 'Total Hojas', 'Estado', 'Acciones'];
  
  const renderRow = (pedido) => (
    <>
      <TableRow key={pedido.id}>
        <TableCell>
          <Button variant="ghost" size="sm" onClick={() => toggleExpand(pedido.id)}>
            {expandedRows[pedido.id] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </TableCell>
        <TableCell className="font-mono font-bold">{pedido.numero_pedido}</TableCell>
        <TableCell>{formatDate(pedido.fecha_solicitud)}</TableCell>
        <TableCell>{pedido.nombre_marroquinero}</TableCell>
        <TableCell className="text-center font-bold">{pedido.total_hojas}</TableCell>
        <TableCell>
          <span className={`px-2 py-1 rounded text-xs font-medium ${
            pedido.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
            pedido.estado === 'consolidado' ? 'bg-purple-100 text-purple-700' :
            'bg-green-100 text-green-700'
          }`}>
            {pedido.estado.toUpperCase()}
          </span>
        </TableCell>
        <TableCell>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setSelectedPedido(pedido); setShowDetailModal(true); }}>
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePrint(pedido)}>
              <Printer className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport(pedido)}>
              <Download className="w-4 h-4" />
            </Button>
            {pedido.estado === 'pendiente' && (
              <Button variant="outline" size="sm" onClick={() => toggleSelection(pedido.id)}>
                {selectedForConsolidation.includes(pedido.id) ? 
                  <CheckSquare className="w-4 h-4 text-green-600" /> : 
                  <Square className="w-4 h-4" />
                }
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expandedRows[pedido.id] && (
        <TableRow>
          <TableCell colSpan={7} className="bg-gray-50 p-4">
            <div className="text-sm">
              <h4 className="font-bold mb-2">Detalle del Pedido</h4>
              {pedido.items && pedido.items.length > 0 ? (
                <table className="w-full text-xs border">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="border p-1">Color</th>
                      <th className="border p-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pedido.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border p-1">{item.color}</td>
                        <td className="border p-1 text-center">{item.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p>Sin detalle</p>}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Pedidos Individuales"
        description="Ver, imprimir y exportar pedidos por marroquinero"
      />

      <Card className="mb-6">
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Nombre Marroquinero</Label>
              <Input 
                placeholder="Buscar marroquinero..." 
                value={filtros.marroquinero}
                onChange={e => setFiltros({...filtros, marroquinero: e.target.value})}
              />
            </div>
            <div>
              <Label>Fecha Solicitud</Label>
              <Input 
                type="date" 
                value={filtros.fechaSolicitud}
                onChange={e => setFiltros({...filtros, fechaSolicitud: e.target.value})}
              />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={filtros.estado} onValueChange={v => setFiltros({...filtros, estado: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="consolidado">Consolidado</SelectItem>
                  <SelectItem value="en_produccion">En Producción</SelectItem>
                  <SelectItem value="entregado">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Listado de Pedidos</CardTitle></CardHeader>
        <CardContent>
          <DataTable 
            headers={headers} 
            data={filteredPedidos} 
            renderRow={renderRow} 
            loading={loading}
          />
          
          {selectedForConsolidation.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded flex justify-between items-center">
              <span className="font-semibold">{selectedForConsolidation.length} pedido(s) seleccionado(s) para consolidar</span>
              <Button onClick={() => window.location.href = '/ConsolidarPedidos'}>
                Ir a Consolidar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Detalle del Pedido</DialogTitle></DialogHeader>
          {selectedPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p><strong>No. ID:</strong> {selectedPedido.numero_pedido}</p>
                <p><strong>Marroquinero:</strong> {selectedPedido.nombre_marroquinero}</p>
                <p><strong>Fecha:</strong> {formatDate(selectedPedido.fecha_solicitud)}</p>
                <p><strong>Total Hojas:</strong> {selectedPedido.total_hojas}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}