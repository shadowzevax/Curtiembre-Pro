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
import { Eye, Printer, Download, ChevronDown, ChevronUp, CheckSquare, Square, Edit, Trash2 } from 'lucide-react';
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
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPedido, setEditingPedido] = useState(null);
  
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
    
    // Extraer todas las placas disponibles en el pedido
    const placasSet = new Set();
    pedido.items?.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'color' && key !== 'total') {
          placasSet.add(key);
        }
      });
    });
    const placas = Array.from(placasSet).sort();
    
    // Generar HTML de la tabla
    const tablaHTML = `
      <table style="width:100%; border-collapse:collapse; font-size:10px; margin-top:20px;">
        <thead>
          <tr style="background-color:#e5e7eb;">
            <th style="border:1px solid #333; padding:6px; text-align:left;">COLOR</th>
            ${placas.map(p => `<th style="border:1px solid #333; padding:6px; text-align:center;">${p.toUpperCase()}</th>`).join('')}
            <th style="border:1px solid #333; padding:6px; text-align:center; background-color:#fef3c7;">TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${pedido.items.map((item, idx) => `
            <tr style="background-color:${idx % 2 === 0 ? 'white' : '#f9fafb'};">
              <td style="border:1px solid #333; padding:6px; font-weight:bold;">${item.color}</td>
              ${placas.map(placa => `<td style="border:1px solid #333; padding:6px; text-align:center;">${item[placa] || 0}</td>`).join('')}
              <td style="border:1px solid #333; padding:6px; text-align:center; font-weight:bold; background-color:#fef9e7;">${item.total}</td>
            </tr>
          `).join('')}
          <tr style="background-color:#d1fae5; font-weight:bold;">
            <td style="border:1px solid #333; padding:6px;">TOTALES</td>
            ${placas.map(placa => {
              const total = pedido.items.reduce((sum, item) => sum + (item[placa] || 0), 0);
              return `<td style="border:1px solid #333; padding:6px; text-align:center;">${total}</td>`;
            }).join('')}
            <td style="border:1px solid #333; padding:6px; text-align:center; background-color:#fde68a;">${pedido.total_hojas}</td>
          </tr>
        </tbody>
      </table>
    `;
    
    printWindow.document.write(`
      <html>
      <head>
        <title>Pedido ${pedido.numero_pedido}</title>
        <style>
          @page { size: letter; margin: 1cm; }
          body { font-family: Arial, sans-serif; }
          @media print {
            body { margin: 0; padding: 10px; }
          }
        </style>
      </head>
      <body>
        <h2>Pedido Individual - ${pedido.numero_pedido}</h2>
        <p><strong>Marroquinero:</strong> ${pedido.nombre_marroquinero}</p>
        <p><strong>Fecha Solicitud:</strong> ${formatDate(pedido.fecha_solicitud)}</p>
        <p><strong>Estado:</strong> ${pedido.estado.toUpperCase()}</p>
        ${tablaHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleEdit = (pedido) => {
    setEditingPedido({...pedido, items: pedido.items || []});
    setShowEditModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Está seguro de eliminar este pedido?')) return;
    try {
      await PedidoMarroquinero.delete(id);
      alert('Pedido eliminado correctamente.');
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar el pedido: ' + error.message);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingPedido) return;
    try {
      // Recalcular total_hojas
      const totalHojas = editingPedido.items.reduce((sum, item) => sum + (item.total || 0), 0);
      await PedidoMarroquinero.update(editingPedido.id, { ...editingPedido, total_hojas: totalHojas });
      alert('Pedido actualizado correctamente.');
      setShowEditModal(false);
      setEditingPedido(null);
      loadData();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar: ' + error.message);
    }
  };

  const placasOrdenadas = ['can', 'point', 'eti', 'ilusion', 'talype', 'cobra', 'damasco', 'boa', 'babilla', 'piedra', 'puntos', 'mandala', 'poro_fino', 'opaco', 'opaco_mate', 'envejecido'];

  const handleExport = (pedido) => {
    // Extraer todas las placas
    const placasSet = new Set();
    pedido.items?.forEach(item => {
      Object.keys(item).forEach(key => {
        if (key !== 'color' && key !== 'total') {
          placasSet.add(key);
        }
      });
    });
    const placas = placasOrdenadas.filter(p => placasSet.has(p));
    
    // Encabezados CSV
    const headers = ['Color', ...placas.map(p => p.toUpperCase()), 'TOTAL'];
    const csvRows = [headers.join(',')];
    
    // Filas de datos
    pedido.items?.forEach(item => {
      const row = [
        item.color,
        ...placas.map(placa => item[placa] || 0),
        item.total
      ];
      csvRows.push(row.join(','));
    });
    
    // Fila de totales
    const totales = [
      'TOTALES',
      ...placas.map(placa => pedido.items.reduce((sum, item) => sum + (item[placa] || 0), 0)),
      pedido.total_hojas
    ];
    csvRows.push(totales.join(','));
    
    const csv = csvRows.join('\n');
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
            <Button variant="outline" size="sm" onClick={() => { setSelectedPedido(pedido); setShowDetailModal(true); }} title="Ver">
              <Eye className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleEdit(pedido)} title="Editar">
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="destructive" size="sm" onClick={() => handleDelete(pedido.id)} title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handlePrint(pedido)} title="Imprimir">
              <Printer className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport(pedido)} title="Exportar">
              <Download className="w-4 h-4" />
            </Button>
            {pedido.estado === 'pendiente' && (
              <Button variant="outline" size="sm" onClick={() => toggleSelection(pedido.id)} title="Consolidar">
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
              <Button onClick={() => {
                const selectedIds = selectedForConsolidation.join(',');
                window.location.href = `/ConsolidarPedidos?selected=${selectedIds}`;
              }}>
                Ir a Consolidar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalle del Pedido</DialogTitle></DialogHeader>
          {selectedPedido && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg grid grid-cols-3 gap-3 text-sm border border-blue-200">
                <p><strong>No. ID:</strong> <span className="font-mono">{selectedPedido.numero_pedido}</span></p>
                <p><strong>Fecha Solicitud:</strong> {formatDate(selectedPedido.fecha_solicitud)}</p>
                <p><strong>Marroquinero:</strong> {selectedPedido.nombre_marroquinero}</p>
              </div>

              {selectedPedido.items && selectedPedido.items.length > 0 && (
                <div>
                  <h4 className="font-bold mb-3 text-lg">Detalle del Pedido</h4>
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100">
                       <tr>
                         <th className="border p-2 text-left sticky left-0 bg-gray-100 z-10">CÓDIGO COLOR</th>
                         <th className="border p-2 text-left">COLOR</th>
                         {placasOrdenadas.map(placa => (
                           <th key={placa} className="border p-2 text-center">{placa.replace('_', ' ').toUpperCase()}</th>
                         ))}
                         <th className="border p-2 text-center bg-yellow-100 font-bold">TOTAL HOJAS</th>
                       </tr>
                      </thead>
                      <tbody>
                       {selectedPedido.items.map((item, idx) => (
                         <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                           <td className="border p-2 font-mono font-bold sticky left-0 bg-white z-10">{item.codigo_color || 'N/A'}</td>
                           <td className="border p-2 font-medium">{item.color}</td>
                           {placasOrdenadas.map(placa => (
                             <td key={placa} className="border p-2 text-center">
                               {item[placa] || 0}
                             </td>
                           ))}
                           <td className="border p-2 text-center font-bold bg-yellow-50">{item.total}</td>
                         </tr>
                       ))}
                        <tr className="bg-green-100 font-bold">
                          <td className="border p-2 sticky left-0 bg-green-100 z-10" colSpan="2">TOTALES</td>
                          {placasOrdenadas.map(placa => {
                            const total = selectedPedido.items.reduce((sum, item) => sum + (item[placa] || 0), 0);
                            return <td key={placa} className="border p-2 text-center">{total}</td>;
                          })}
                          <td className="border p-2 text-center bg-yellow-200">{selectedPedido.total_hojas}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end pt-4">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Pedido</DialogTitle></DialogHeader>
          {editingPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>No. Pedido</Label>
                  <Input value={editingPedido.numero_pedido} readOnly className="bg-gray-100" />
                </div>
                <div>
                  <Label>Fecha Solicitud</Label>
                  <Input type="date" value={editingPedido.fecha_solicitud} onChange={e => setEditingPedido({...editingPedido, fecha_solicitud: e.target.value})} />
                </div>
                <div>
                  <Label>Marroquinero</Label>
                  <Input value={editingPedido.nombre_marroquinero} onChange={e => setEditingPedido({...editingPedido, nombre_marroquinero: e.target.value})} />
                </div>
              </div>

              <div>
                <h4 className="font-bold mb-2">Ítems del Pedido</h4>
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border p-2">Color</th>
                        {placasOrdenadas.map(placa => (
                          <th key={placa} className="border p-2">{placa.replace('_', ' ').toUpperCase()}</th>
                        ))}
                        <th className="border p-2 bg-yellow-100">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editingPedido.items.map((item, idx) => {
                        const rowTotal = placasOrdenadas.reduce((sum, placa) => sum + (item[placa] || 0), 0);
                        return (
                          <tr key={idx}>
                            <td className="border p-2">
                              <Input value={item.color} onChange={e => {
                                const updated = [...editingPedido.items];
                                updated[idx].color = e.target.value;
                                setEditingPedido({...editingPedido, items: updated});
                              }} className="w-full" />
                            </td>
                            {placasOrdenadas.map(placa => (
                              <td key={placa} className="border p-2">
                                <Input type="number" value={item[placa] || 0} onChange={e => {
                                  const updated = [...editingPedido.items];
                                  updated[idx][placa] = parseInt(e.target.value) || 0;
                                  updated[idx].total = placasOrdenadas.reduce((sum, p) => sum + (updated[idx][p] || 0), 0);
                                  setEditingPedido({...editingPedido, items: updated});
                                }} className="w-16 text-center" />
                              </td>
                            ))}
                            <td className="border p-2 text-center font-bold bg-yellow-50">{rowTotal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit}>Guardar Cambios</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}