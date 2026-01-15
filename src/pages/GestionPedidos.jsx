import React, { useState, useEffect } from 'react';
import { PedidoMarroquinero, Cliente } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Eye, FileText } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('es-CO');
};

const COLORES_PREDEFINIDOS = [
  'AZUL', 'BRONCE', 'CAFE', 'CHAMPAÑA', 'FUSIL', 'MIEL', 'MIEL CLARO',
  'NEGRO', 'NUDE', 'OSTRA', 'ORO ROSA', 'ROJO', 'ROJO VIVO', 'VERDE'
];

const ACABADOS = [
  { key: 'can', label: 'CAN' },
  { key: 'talype', label: 'TALYPE' },
  { key: 'babilla', label: 'BABILLA' },
  { key: 'poro_fino', label: 'PORO FINO' },
  { key: 'opaco', label: 'OPACO' },
  { key: 'opaco_mate', label: 'OPACO MATE' },
  { key: 'envejecido', label: 'ENVEJECIDO' }
];

export default function GestionPedidos() {
  const [pedidos, setPedidos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentPedido, setCurrentPedido] = useState(null);
  const [selectedPedido, setSelectedPedido] = useState(null);
  const [filtroNumeroPedido, setFiltroNumeroPedido] = useState('');
  const [filteredPedidos, setFilteredPedidos] = useState([]);
  const [selectedForConsolidation, setSelectedForConsolidation] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const filtered = pedidos.filter(p => 
      p.numero_pedido?.toLowerCase().includes(filtroNumeroPedido.toLowerCase()) ||
      p.nombre_marroquinero?.toLowerCase().includes(filtroNumeroPedido.toLowerCase())
    );
    setFilteredPedidos(filtered);
  }, [filtroNumeroPedido, pedidos]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pedidosData, clientesData] = await Promise.all([
        PedidoMarroquinero.list(),
        Cliente.list()
      ]);
      setPedidos(pedidosData);
      setClientes(clientesData);
      setFilteredPedidos(pedidosData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = async (pedido = null) => {
    setIsEditing(!!pedido);
    if (!pedido) {
      // Generar número ID automático formato 2026-0001
      const year = new Date().getFullYear();
      const pedidosDelAnio = pedidos.filter(p => p.numero_pedido?.startsWith(String(year)));
      const nextNum = pedidosDelAnio.length + 1;
      
      setCurrentPedido({
        numero_pedido: `${year}-${String(nextNum).padStart(4, '0')}`,
        pedido_consolidado: '',
        fecha_solicitud: new Date().toISOString().split('T')[0],
        nombre_marroquinero: '',
        cliente_id: '',
        estado: 'pendiente',
        observaciones: '',
        items: [],
        total_hojas: 0
      });
    } else {
      setCurrentPedido(pedido);
    }
    setShowModal(true);
  };

  const agregarColor = () => {
    const newItem = {
      color: '',
      can: 0,
      talype: 0,
      babilla: 0,
      poro_fino: 0,
      opaco: 0,
      opaco_mate: 0,
      envejecido: 0,
      total: 0
    };
    setCurrentPedido({
      ...currentPedido,
      items: [...currentPedido.items, newItem]
    });
  };

  const actualizarItem = (index, field, value) => {
    const items = [...currentPedido.items];
    items[index][field] = field === 'color' ? value : (parseFloat(value) || 0);
    
    // Calcular total del item
    if (field !== 'color') {
      items[index].total = ACABADOS.reduce((sum, acabado) => sum + (items[index][acabado.key] || 0), 0);
    }
    
    // Calcular total general
    const totalGeneral = items.reduce((sum, item) => sum + (item.total || 0), 0);
    
    setCurrentPedido({
      ...currentPedido,
      items,
      total_hojas: totalGeneral
    });
  };

  const eliminarItem = (index) => {
    const items = currentPedido.items.filter((_, i) => i !== index);
    const totalGeneral = items.reduce((sum, item) => sum + (item.total || 0), 0);
    setCurrentPedido({
      ...currentPedido,
      items,
      total_hojas: totalGeneral
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await PedidoMarroquinero.update(currentPedido.id, currentPedido);
      } else {
        await PedidoMarroquinero.create(currentPedido);
      }
      setShowModal(false);
      loadData();
      alert('Pedido guardado exitosamente');
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar el pedido');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('¿Eliminar este pedido?')) {
      try {
        await PedidoMarroquinero.delete(id);
        loadData();
        alert('Pedido eliminado');
      } catch (error) {
        alert('Error al eliminar');
      }
    }
  };

  const calcularConsolidado = (pedidosFiltrados) => {
    const consolidado = {};
    
    pedidosFiltrados.forEach(pedido => {
      pedido.items?.forEach(item => {
        if (!consolidado[item.color]) {
          consolidado[item.color] = {
            color: item.color,
            can: 0,
            talype: 0,
            babilla: 0,
            poro_fino: 0,
            opaco: 0,
            opaco_mate: 0,
            envejecido: 0,
            total: 0
          };
        }
        ACABADOS.forEach(acabado => {
          consolidado[item.color][acabado.key] += (item[acabado.key] || 0);
        });
        consolidado[item.color].total += (item.total || 0);
      });
    });

    return Object.values(consolidado).sort((a, b) => a.color.localeCompare(b.color));
  };

  const headers = ['No. ID', 'Pedido Consolidado', 'Fecha Solicitud', 'Marroquinero', 'Total Hojas', 'Estado', 'Acciones'];
  const renderRow = (pedido) => (
    <tr key={pedido.id}>
      <td className="font-mono font-bold">{pedido.numero_pedido}</td>
      <td className="font-mono text-sm">{pedido.pedido_consolidado || '-'}</td>
      <td>{formatDate(pedido.fecha_solicitud)}</td>
      <td>{pedido.nombre_marroquinero}</td>
      <td className="font-bold text-center">{pedido.total_hojas}</td>
      <td>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          pedido.estado === 'entregado' ? 'bg-green-100 text-green-700' :
          pedido.estado === 'en_produccion' ? 'bg-blue-100 text-blue-700' :
          pedido.estado === 'consolidado' ? 'bg-purple-100 text-purple-700' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {pedido.estado}
        </span>
      </td>
      <td>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedPedido(pedido); setShowDetailModal(true); }}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(pedido)}>
            <Edit className="w-4 h-4" />
          </Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(pedido.id)}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Gestión de Pedidos"
        description="Registro y consolidación de pedidos de marroquineros"
        actionButton={
          <div className="flex gap-2">
            <Button onClick={() => setShowConsolidadoModal(true)} variant="outline" className="bg-blue-50">
              <FileText className="w-4 h-4 mr-2" />
              Ver Consolidado General
            </Button>
            <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Pedido
            </Button>
          </div>
        }
      />

      <Card className="mb-6">
        <CardHeader><CardTitle>Buscar</CardTitle></CardHeader>
        <CardContent>
          <Input
            placeholder="Buscar por número de pedido o marroquinero..."
            value={filtroNumeroPedido}
            onChange={(e) => setFiltroNumeroPedido(e.target.value)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Listado de Pedidos</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredPedidos} renderRow={renderRow} />}
        </CardContent>
      </Card>

      {/* Modal Nuevo/Editar Pedido */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Pedido</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div><Label>No. ID</Label><Input value={currentPedido?.numero_pedido || ''} readOnly className="bg-gray-100" /></div>
              <div><Label>Pedido Consolidado</Label><Input value={currentPedido?.pedido_consolidado || ''} readOnly className="bg-gray-50" placeholder="Se asigna al consolidar" /></div>
              <div><Label>Fecha Solicitud *</Label><Input type="date" value={currentPedido?.fecha_solicitud || ''} onChange={e => setCurrentPedido({...currentPedido, fecha_solicitud: e.target.value})} required /></div>
              <div>
                <Label>Estado</Label>
                <Select value={currentPedido?.estado || 'pendiente'} onValueChange={v => setCurrentPedido({...currentPedido, estado: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendiente">Pendiente</SelectItem>
                    <SelectItem value="consolidado">Consolidado</SelectItem>
                    <SelectItem value="en_produccion">En Producción</SelectItem>
                    <SelectItem value="entregado">Entregado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Marroquinero *</Label><Input value={currentPedido?.nombre_marroquinero || ''} onChange={e => setCurrentPedido({...currentPedido, nombre_marroquinero: e.target.value})} required /></div>
            <div><Label>Observaciones</Label><Textarea value={currentPedido?.observaciones || ''} onChange={e => setCurrentPedido({...currentPedido, observaciones: e.target.value})} /></div>

            <div className="border-t pt-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Detalle del Pedido</h3>
                <Button type="button" onClick={agregarColor} variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-1" /> Agregar Color
                </Button>
              </div>

              {currentPedido?.items && currentPedido.items.length > 0 && (
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border p-2">COLOR</th>
                        <th className="border p-2">CAN</th>
                        <th className="border p-2">TALYPE</th>
                        <th className="border p-2">BABILLA</th>
                        <th className="border p-2">PORO FINO</th>
                        <th className="border p-2">OPACO</th>
                        <th className="border p-2">OPACO MATE</th>
                        <th className="border p-2">ENVEJECIDO</th>
                        <th className="border p-2 bg-yellow-100">TOTAL</th>
                        <th className="border p-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentPedido.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="border p-1">
                            <Select value={item.color} onValueChange={v => actualizarItem(idx, 'color', v)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                              <SelectContent>
                                {COLORES_PREDEFINIDOS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                          {ACABADOS.map(acabado => (
                            <td key={acabado.key} className="border p-1">
                              <Input type="number" className="h-8 text-center" value={item[acabado.key]} onChange={e => actualizarItem(idx, acabado.key, e.target.value)} />
                            </td>
                          ))}
                          <td className="border p-1 text-center font-bold bg-yellow-50">{item.total}</td>
                          <td className="border p-1 text-center">
                            <Button type="button" variant="destructive" size="sm" onClick={() => eliminarItem(idx)}>
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-green-100 font-bold">
                        <td className="border p-2">TOTAL</td>
                        {ACABADOS.map(acabado => (
                          <td key={acabado.key} className="border p-2 text-center">
                            {currentPedido.items.reduce((sum, item) => sum + (item[acabado.key] || 0), 0)}
                          </td>
                        ))}
                        <td className="border p-2 text-center bg-yellow-200">{currentPedido.total_hojas}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar Pedido</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Detalle */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Detalle del Pedido</DialogTitle></DialogHeader>
          {selectedPedido && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p><strong>No. ID:</strong> {selectedPedido.numero_pedido}</p>
                <p><strong>Pedido Consolidado:</strong> {selectedPedido.pedido_consolidado || 'Sin consolidar'}</p>
                <p><strong>Marroquinero:</strong> {selectedPedido.nombre_marroquinero}</p>
                <p><strong>Fecha Solicitud:</strong> {formatDate(selectedPedido.fecha_solicitud)}</p>
                <p><strong>Estado:</strong> {selectedPedido.estado}</p>
                <p><strong>Total Hojas:</strong> {selectedPedido.total_hojas}</p>
              </div>
              {selectedPedido.items && selectedPedido.items.length > 0 && (
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border p-2">COLOR</th>
                        {ACABADOS.map(a => <th key={a.key} className="border p-2">{a.label}</th>)}
                        <th className="border p-2 bg-yellow-100">TOTAL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPedido.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="border p-2 font-semibold">{item.color}</td>
                          {ACABADOS.map(a => <td key={a.key} className="border p-2 text-center">{item[a.key] || 0}</td>)}
                          <td className="border p-2 text-center font-bold bg-yellow-50">{item.total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Consolidado General */}
      <Dialog open={showConsolidadoModal} onOpenChange={setShowConsolidadoModal}>
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-bold text-center">CONSOLIDADO GENERAL DE PEDIDOS</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Tabs defaultValue="pendientes">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pendientes">Pendientes de Consolidar</TabsTrigger>
                <TabsTrigger value="general">Consolidado General</TabsTrigger>
                <TabsTrigger value="por_pedido">Por Número de Pedido</TabsTrigger>
              </TabsList>
              <TabsContent value="pendientes" className="space-y-3">
                <div className="mb-4">
                  <h3 className="text-lg font-bold mb-2">Lista de Pedidos Pendientes de Consolidar</h3>
                  <p className="text-sm text-gray-600 mb-4">Seleccione los pedidos que desea consolidar</p>
                  
                  {pedidos.filter(p => p.estado === 'pendiente').length === 0 ? (
                    <p className="text-center text-gray-500 py-8">No hay pedidos pendientes de consolidar</p>
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
                                      setSelectedForConsolidation(pedidos.filter(p => p.estado === 'pendiente').map(p => p.id));
                                    } else {
                                      setSelectedForConsolidation([]);
                                    }
                                  }}
                                  checked={selectedForConsolidation.length === pedidos.filter(p => p.estado === 'pendiente').length && pedidos.filter(p => p.estado === 'pendiente').length > 0}
                                />
                              </th>
                              <th className="p-2 text-left">No. ID</th>
                              <th className="p-2 text-left">Marroquinero</th>
                              <th className="p-2 text-left">Fecha Solicitud</th>
                              <th className="p-2 text-right">Total Hojas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pedidos.filter(p => p.estado === 'pendiente').map(pedido => (
                              <tr key={pedido.id} className="border-t hover:bg-gray-50">
                                <td className="p-2">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedForConsolidation.includes(pedido.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedForConsolidation([...selectedForConsolidation, pedido.id]);
                                      } else {
                                        setSelectedForConsolidation(selectedForConsolidation.filter(id => id !== pedido.id));
                                      }
                                    }}
                                  />
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
                          onClick={async () => {
                            if (selectedForConsolidation.length === 0) {
                              alert('Debe seleccionar al menos un pedido para consolidar');
                              return;
                            }
                            
                            try {
                              // Generar número de pedido consolidado PED-2026-0001
                              const year = new Date().getFullYear();
                              const pedidosConsolidados = pedidos.filter(p => p.pedido_consolidado?.startsWith(`PED-${year}`));
                              const nextNum = pedidosConsolidados.length > 0 
                                ? Math.max(...pedidosConsolidados.map(p => parseInt(p.pedido_consolidado.split('-')[2]) || 0)) + 1
                                : 1;
                              const numeroPedidoConsolidado = `PED-${year}-${String(nextNum).padStart(4, '0')}`;
                              
                              // Actualizar todos los pedidos seleccionados
                              for (const pedidoId of selectedForConsolidation) {
                                await PedidoMarroquinero.update(pedidoId, {
                                  pedido_consolidado: numeroPedidoConsolidado,
                                  estado: 'consolidado'
                                });
                              }
                              
                              alert(`Pedidos consolidados exitosamente con número: ${numeroPedidoConsolidado}`);
                              setSelectedForConsolidation([]);
                              loadData();
                            } catch (error) {
                              console.error('Error consolidando pedidos:', error);
                              alert('Error al consolidar pedidos');
                            }
                          }}
                          disabled={selectedForConsolidation.length === 0}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          Consolidar Seleccionados ({selectedForConsolidation.length})
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="general" className="space-y-3">
                {(() => {
                  const consolidado = calcularConsolidado(pedidos);
                  const totales = ACABADOS.reduce((acc, acabado) => {
                    acc[acabado.key] = consolidado.reduce((sum, item) => sum + (item[acabado.key] || 0), 0);
                    return acc;
                  }, {});
                  const totalGeneral = consolidado.reduce((sum, item) => sum + (item.total || 0), 0);

                  return (
                    <div className="overflow-x-auto border rounded">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-100">
                          <tr>
                            <th className="border p-2">ITEM</th>
                            <th className="border p-2">COLOR</th>
                            {ACABADOS.map(a => <th key={a.key} className="border p-2">{a.label}</th>)}
                            <th className="border p-2 bg-yellow-200">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {consolidado.map((item, idx) => (
                            <tr key={idx}>
                              <td className="border p-2 text-center">{idx + 1}</td>
                              <td className="border p-2 font-semibold">{item.color}</td>
                              {ACABADOS.map(a => (
                                <td key={a.key} className={`border p-2 text-center ${item[a.key] > 0 ? 'bg-yellow-100 font-semibold' : ''}`}>
                                  {item[a.key] || 0}
                                </td>
                              ))}
                              <td className="border p-2 text-center font-bold bg-yellow-100">{item.total}</td>
                            </tr>
                          ))}
                          <tr className="bg-green-200 font-bold text-base">
                            <td colSpan="2" className="border p-3 text-right">TOTAL</td>
                            {ACABADOS.map(a => <td key={a.key} className="border p-3 text-center">{totales[a.key]}</td>)}
                            <td className="border p-3 text-center bg-yellow-300">{totalGeneral}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </TabsContent>
              <TabsContent value="por_pedido">
                <div className="space-y-4">
                  {pedidos.map(pedido => (
                    <div key={pedido.id} className="border rounded p-4">
                      <h3 className="font-bold mb-2">Pedido {pedido.numero_pedido} - {pedido.nombre_marroquinero}</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {pedido.pedido_consolidado && <span className="font-semibold">Consolidado: {pedido.pedido_consolidado} | </span>}
                        Solicitud: {formatDate(pedido.fecha_solicitud)}
                      </p>
                      {pedido.items && pedido.items.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border p-1">COLOR</th>
                                {ACABADOS.map(a => <th key={a.key} className="border p-1">{a.label}</th>)}
                                <th className="border p-1">TOTAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pedido.items.map((item, idx) => (
                                <tr key={idx}>
                                  <td className="border p-1">{item.color}</td>
                                  {ACABADOS.map(a => <td key={a.key} className="border p-1 text-center">{item[a.key] || 0}</td>)}
                                  <td className="border p-1 text-center font-semibold">{item.total}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setShowConsolidadoModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}