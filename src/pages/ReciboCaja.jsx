import React, { useState, useEffect } from 'react';
import { CuentaContable, Cliente, OrdenVenta, MovimientoLibroDiario } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, Eye, FileSearch } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function ReciboCaja() {
  const [recibos, setRecibos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingDocs, setPendingDocs] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cuentasData, clientesData] = await Promise.all([
        CuentaContable.filter({ tipo_cuenta: 'otros_ingresos' }),
        Cliente.list()
      ]);
      setRecibos(cuentasData);
      setClientes(clientesData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    // Generar consecutivo simple si es nuevo (en producción idealmente buscar el último)
    const nextNum = Math.floor(Math.random() * 10000); 
    
    setCurrentItem(item || {
      fecha: new Date().toISOString().split('T')[0],
      tipo_cuenta: 'otros_ingresos',
      empresa: 'MARROQUINERIA ARTECUEROS SAS',
      prefijo: `RC-${String(nextNum).padStart(4, '0')}`,
      cc_nit: '',
      concepto: '',
      valor: 0,
      proveedor_cliente_id: '', // Recibido De
      referencia: '', // Campo obsoleto pero mantenido en estructura
      observaciones: ''
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await CuentaContable.update(currentItem.id, currentItem);
      } else {
        const nuevoRecibo = await CuentaContable.create(currentItem);
        
        // Registro en Libro Diario
        try {
            await MovimientoLibroDiario.create({
                 fecha: currentItem.fecha,
                 tipo_movimiento: 'ingreso',
                 tipo_tercero: 'cliente',
                 tipo_documento_soporte: 'recibo_caja',
                 numero_documento: currentItem.prefijo, // Using prefijo as number
                 tercero_id: currentItem.proveedor_cliente_id,
                 tercero_nombre: clientes.find(c => c.id === currentItem.proveedor_cliente_id)?.nombre || '',
                 cuenta_afectada: 'Caja Principal',
                 descripcion: currentItem.concepto,
                 valor_ingreso: currentItem.valor,
                 valor_egreso: 0,
                 medio_pago: 'efectivo',
                 origen_modulo: 'tesoreria_recibo',
                 referencia_origen_id: nuevoRecibo.id
            });
        } catch(e) { console.error("Error diario", e); }
      }
      setShowModal(false);
      loadData();
      alert("Recibo de caja guardado con éxito.");
    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar el recibo de caja.");
    }
  };

  const loadPendingDocs = async () => {
      try {
          // Buscar ventas con saldo pendiente > 0
          const ventas = await OrdenVenta.filter({ saldo_pendiente: { $gt: 0 } }); // Nota: $gt depende del soporte de filtro, si no, filtrar en cliente
          const filtered = ventas.filter(v => v.saldo_pendiente > 0);
          setPendingDocs(filtered);
          setShowPendingModal(true);
      } catch (e) {
          console.error(e);
      }
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Está seguro de que desea eliminar este recibo de caja?")) {
      try {
        await CuentaContable.delete(id);
        loadData();
        alert("Recibo eliminado con éxito.");
      } catch (error) {
        alert("Error al eliminar el recibo.");
      }
    }
  };

  const handleExport = () => {
    let csvContent = "Fecha,Referencia,Concepto,Cliente,Valor\n";
    csvContent += recibos.map(r =>
      `"${formatDate(r.fecha)}","${r.referencia}","${r.concepto}","${getClienteNombre(r.proveedor_cliente_id)}","${r.valor}"`
    ).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `recibos_caja_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  const getClienteNombre = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nombre : clienteId || 'N/A';
  };

  const headers = ["Fecha", "Referencia", "Concepto", "Cliente", "Valor", "Acciones"];
  const renderRow = (recibo) => (
    <tr key={recibo.id}>
      <td>{formatDate(recibo.fecha)}</td>
      <td>{recibo.referencia}</td>
      <td>{recibo.concepto}</td>
      <td>{getClienteNombre(recibo.proveedor_cliente_id)}</td>
      <td className="text-right font-medium text-green-600">{formatCurrency(recibo.valor)}</td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedItem(recibo); setShowDetailModal(true); }}><Eye className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(recibo)}><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(recibo.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-6">
      <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
      <PageHeader
        title="Recibo de Caja"
        description="Gestiona los recibos de caja de la empresa."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Recibo
          </Button>
        }
      />

      <div id="tabla-imprimible">
        <Card>
          <CardHeader><CardTitle>Listado de Recibos de Caja</CardTitle></CardHeader>
          <CardContent>
            <DataTable headers={headers} data={recibos} renderRow={renderRow} loading={loading} />
            <div className="mt-6 pt-4 border-t">
              <div className="flex justify-end">
                <div className="bg-green-50 px-6 py-3 rounded-lg">
                  <span className="text-lg font-bold text-green-800">
                    Total: {formatCurrency(recibos.reduce((sum, r) => sum + (r.valor || 0), 0))}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Recibo de Caja</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Empresa</Label>
                <Select value={currentItem?.empresa || 'MARROQUINERIA ARTECUEROS SAS'} onValueChange={v => setCurrentItem({ ...currentItem, empresa: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="MARROQUINERIA ARTECUEROS SAS">MARROQUINERIA ARTECUEROS SAS</SelectItem>
                        <SelectItem value="ARTECUEROS">ARTECUEROS</SelectItem>
                    </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prefijo</Label>
                <Input value={currentItem?.prefijo || ''} readOnly className="bg-gray-100" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                 <div>
                    <Label>Fecha *</Label>
                    <Input type="date" value={currentItem?.fecha || ''} onChange={e => setCurrentItem({ ...currentItem, fecha: e.target.value })} required />
                 </div>
                 <div>
                    <Label>CC/NIT</Label>
                    <Input value={currentItem?.cc_nit || ''} onChange={e => setCurrentItem({ ...currentItem, cc_nit: e.target.value })} />
                 </div>
            </div>
            <div>
              <Label>Recibido De (Cliente)</Label>
              <Select value={currentItem?.proveedor_cliente_id || ''} onValueChange={v => {
                  const cliente = clientes.find(c => c.id === v);
                  setCurrentItem({ 
                      ...currentItem, 
                      proveedor_cliente_id: v,
                      cc_nit: cliente ? (cliente.numero_identificacion || cliente.nit) : currentItem?.cc_nit
                  });
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sin cliente</SelectItem>
                  {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Concepto *</Label>
              <Input value={currentItem?.concepto || ''} onChange={e => setCurrentItem({ ...currentItem, concepto: e.target.value })} required placeholder="Ej: Pago por venta de productos" />
            </div>
            <div>
              <Label>Valor *</Label>
              <div className="flex gap-2 items-center">
                  <Button type="button" variant="outline" size="icon" title="Ver Estado de Cuenta (Pendientes)" onClick={loadPendingDocs}>
                      <FileSearch className="w-5 h-5 text-blue-600" />
                  </Button>
                  <Input type="number" value={currentItem?.valor || ''} onChange={e => setCurrentItem({ ...currentItem, valor: parseFloat(e.target.value) || 0 })} required />
              </div>
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({ ...currentItem, observaciones: e.target.value })} rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showPendingModal} onOpenChange={setShowPendingModal}>
        <DialogContent className="max-w-3xl">
            <DialogHeader><DialogTitle>Estado de Cuenta (Cuentas por Cobrar)</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm border">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2">Documento</th>
                            <th className="p-2">Fecha</th>
                            <th className="p-2">Cliente</th>
                            <th className="p-2 text-right">Saldo Pendiente</th>
                            <th className="p-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingDocs.map(doc => (
                            <tr key={doc.id} className="border-t">
                                <td className="p-2">{doc.prefijo_documento}-{doc.numero_documento}</td>
                                <td className="p-2">{new Date(doc.fecha_orden).toLocaleDateString()}</td>
                                <td className="p-2">{clientes.find(c => c.id === doc.cliente_id)?.nombre || 'N/A'}</td>
                                <td className="p-2 text-right font-bold text-red-600">{formatCurrency(doc.saldo_pendiente)}</td>
                                <td className="p-2">
                                    <Button size="sm" onClick={() => {
                                        setCurrentItem(prev => ({
                                            ...prev,
                                            valor: doc.saldo_pendiente,
                                            observaciones: `Pago de ${doc.prefijo_documento}-${doc.numero_documento}. ${prev.observaciones}`,
                                            proveedor_cliente_id: doc.cliente_id,
                                            cc_nit: doc.cc_nit_cliente
                                        }));
                                        setShowPendingModal(false);
                                    }}>Seleccionar</Button>
                                </td>
                            </tr>
                        ))}
                        {pendingDocs.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-500">No hay documentos pendientes de cobro.</td></tr>}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-end"><Button onClick={() => setShowPendingModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del Recibo de Caja</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Fecha:</span> {formatDate(selectedItem.fecha)}</p>
              <p><span className="font-semibold">Referencia:</span> {selectedItem.referencia}</p>
              <p><span className="font-semibold">Cliente:</span> {getClienteNombre(selectedItem.proveedor_cliente_id)}</p>
              <p><span className="font-semibold">Concepto:</span> {selectedItem.concepto}</p>
              <p><span className="font-semibold">Valor:</span> <span className="text-green-600 font-bold text-lg">{formatCurrency(selectedItem.valor)}</span></p>
              {selectedItem.observaciones && <p><span className="font-semibold">Observaciones:</span> {selectedItem.observaciones}</p>}
            </div>
          )}
          <div className="flex justify-end">
            <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}