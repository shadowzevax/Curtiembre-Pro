import React, { useState, useEffect } from 'react';
import { CuentaContable, Proveedor, OrdenCompra, MovimientoLibroDiario } from '@/entities/all';
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

export default function ComprobanteEgreso() {
  const [egresos, setEgresos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
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
      const [cuentasData, proveedoresData] = await Promise.all([
        CuentaContable.filter({ tipo_cuenta: 'gastos' }),
        Proveedor.list()
      ]);
      setEgresos(cuentasData);
      setProveedores(proveedoresData);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    const nextNum = Math.floor(Math.random() * 10000);
    setCurrentItem(item || {
      fecha: new Date().toISOString().split('T')[0],
      tipo_cuenta: 'gastos',
      empresa: 'MARROQUINERIA ARTECUEROS SAS',
      prefijo: `CE-${String(nextNum).padStart(4, '0')}`,
      cc_nit: '',
      concepto: '',
      valor: 0,
      proveedor_cliente_id: '', // Pagado A
      referencia: '',
      observaciones: ''
    });
    setShowModal(true);
  };

  const loadPendingDocs = async () => {
      try {
          const compras = await OrdenCompra.filter({ saldo_pendiente: { $gt: 0 } });
          const filtered = compras.filter(c => c.saldo_pendiente > 0);
          setPendingDocs(filtered);
          setShowPendingModal(true);
      } catch (e) {
          console.error(e);
      }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await CuentaContable.update(currentItem.id, currentItem);
      } else {
        const nuevoEgreso = await CuentaContable.create(currentItem);

        // Registro en Libro Diario
        try {
            await MovimientoLibroDiario.create({
                 fecha: currentItem.fecha,
                 tipo_movimiento: 'egreso',
                 tipo_tercero: 'proveedor',
                 tipo_documento_soporte: 'comprobante_interno', // Egreso
                 numero_documento: currentItem.prefijo,
                 tercero_id: currentItem.proveedor_cliente_id,
                 tercero_nombre: proveedores.find(p => p.id === currentItem.proveedor_cliente_id)?.nombre || '',
                 cuenta_afectada: 'Caja Principal',
                 descripcion: currentItem.concepto,
                 valor_ingreso: 0,
                 valor_egreso: currentItem.valor,
                 medio_pago: 'efectivo',
                 origen_modulo: 'tesoreria_egreso',
                 referencia_origen_id: nuevoEgreso.id
            });
        } catch(e) { console.error("Error diario", e); }
      }
      setShowModal(false);
      loadData();
      alert("Comprobante de egreso guardado con éxito.");
    } catch (error) {
      console.error("Error:", error);
      alert("Error al guardar el comprobante de egreso.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("¿Está seguro de que desea eliminar este comprobante de egreso?")) {
      try {
        await CuentaContable.delete(id);
        loadData();
        alert("Comprobante eliminado con éxito.");
      } catch (error) {
        alert("Error al eliminar el comprobante.");
      }
    }
  };

  const handleExport = () => {
    let csvContent = "Fecha,Referencia,Concepto,Proveedor,Valor\n";
    csvContent += egresos.map(e =>
      `"${formatDate(e.fecha)}","${e.referencia}","${e.concepto}","${getProveedorNombre(e.proveedor_cliente_id)}","${e.valor}"`
    ).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `comprobantes_egreso_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  const getProveedorNombre = (proveedorId) => {
    const proveedor = proveedores.find(p => p.id === proveedorId);
    return proveedor ? proveedor.nombre : proveedorId || 'N/A';
  };

  const headers = ["Fecha", "Referencia", "Concepto", "Proveedor", "Valor", "Acciones"];
  const renderRow = (egreso) => (
    <tr key={egreso.id}>
      <td>{formatDate(egreso.fecha)}</td>
      <td>{egreso.referencia}</td>
      <td>{egreso.concepto}</td>
      <td>{getProveedorNombre(egreso.proveedor_cliente_id)}</td>
      <td className="text-right font-medium text-red-600">{formatCurrency(egreso.valor)}</td>
      <td>
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={() => { setSelectedItem(egreso); setShowDetailModal(true); }}><Eye className="w-4 h-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => handleOpenModal(egreso)}><Edit className="w-4 h-4" /></Button>
          <Button variant="destructive" size="sm" onClick={() => handleDelete(egreso.id)}><Trash2 className="w-4 h-4" /></Button>
        </div>
      </td>
    </tr>
  );

  return (
    <div className="p-6 space-y-6">
      <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
      <PageHeader
        title="Comprobante de Egreso"
        description="Gestiona los comprobantes de egreso de la empresa."
        onExportExcel={handleExport}
        onPrint={handlePrint}
        actionButton={
          <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Comprobante
          </Button>
        }
      />

      <div id="tabla-imprimible">
        <Card>
          <CardHeader><CardTitle>Listado de Comprobantes de Egreso</CardTitle></CardHeader>
          <CardContent>
            <DataTable headers={headers} data={egresos} renderRow={renderRow} loading={loading} />
            <div className="mt-6 pt-4 border-t">
              <div className="flex justify-end">
                <div className="bg-red-50 px-6 py-3 rounded-lg">
                  <span className="text-lg font-bold text-red-800">
                    Total: {formatCurrency(egresos.reduce((sum, e) => sum + (e.valor || 0), 0))}
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
            <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Comprobante de Egreso</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prefijo</Label>
                <Input value={currentItem?.prefijo || ''} readOnly className="bg-gray-100" />
              </div>
              <div>
                <Label>Fecha *</Label>
                <Input type="date" value={currentItem?.fecha || ''} onChange={e => setCurrentItem({ ...currentItem, fecha: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Proveedor/Beneficiario</Label>
              <Select value={currentItem?.proveedor_cliente_id || ''} onValueChange={v => {
                  const prov = proveedores.find(p => p.id === v);
                  setCurrentItem({ 
                      ...currentItem, 
                      proveedor_cliente_id: v,
                      cc_nit: prov ? (prov.numero_identificacion || prov.nit) : currentItem?.cc_nit,
                      codigo_proveedor: prov ? prov.codigo : ''
                  });
              }}>
                <SelectTrigger><SelectValue placeholder="Seleccionar proveedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sin proveedor</SelectItem>
                  {proveedores.map(p => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nombre}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Por Valor De *</Label>
              <Input type="number" value={currentItem?.por_valor_de || ''} onChange={e => setCurrentItem({ ...currentItem, por_valor_de: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Medio de Pago *</Label>
              <Select value={currentItem?.medio_pago || 'caja'} onValueChange={v => setCurrentItem({ ...currentItem, medio_pago: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="caja">CAJA</SelectItem>
                  <SelectItem value="banco">BANCO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Concepto *</Label>
              <Input value={currentItem?.concepto || ''} onChange={e => setCurrentItem({ ...currentItem, concepto: e.target.value })} required placeholder="Ej: Pago de servicios públicos" />
            </div>
            <div>
              <Label>Estado de Cuenta</Label>
              <div className="flex gap-2 items-center">
                  <Button type="button" variant="outline" size="icon" title="Ver Estado de Cuenta (Pendientes)" onClick={loadPendingDocs}>
                      <FileSearch className="w-5 h-5 text-red-600" />
                  </Button>
                  <Input type="number" value={currentItem?.valor || ''} onChange={e => setCurrentItem({ ...currentItem, valor: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div>
              <Label>Soporte</Label>
              <Input type="file" onChange={async (e) => {
                const file = e.target.files[0];
                if (file) {
                  alert('Funcionalidad de carga de archivos en desarrollo');
                }
              }} />
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
            <DialogHeader><DialogTitle>Estado de Cuenta (Cuentas por Pagar)</DialogTitle></DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm border">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-2">Documento</th>
                            <th className="p-2">Fecha</th>
                            <th className="p-2">Proveedor</th>
                            <th className="p-2 text-right">Saldo Pendiente</th>
                            <th className="p-2"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {pendingDocs.map(doc => (
                            <tr key={doc.id} className="border-t">
                                <td className="p-2">{doc.prefijo_documento}-{doc.numero_documento}</td>
                                <td className="p-2">{new Date(doc.fecha_orden).toLocaleDateString()}</td>
                                <td className="p-2">{proveedores.find(p => p.id === doc.proveedor_id)?.nombre || 'N/A'}</td>
                                <td className="p-2 text-right font-bold text-red-600">{formatCurrency(doc.saldo_pendiente)}</td>
                                <td className="p-2">
                                    <Button size="sm" onClick={() => {
                                        setCurrentItem(prev => ({
                                            ...prev,
                                            valor: doc.saldo_pendiente,
                                            observaciones: `Pago de ${doc.prefijo_documento}-${doc.numero_documento}. ${prev.observaciones}`,
                                            proveedor_cliente_id: doc.proveedor_id,
                                            cc_nit: doc.cc_nit_proveedor
                                        }));
                                        setShowPendingModal(false);
                                    }}>Seleccionar</Button>
                                </td>
                            </tr>
                        ))}
                        {pendingDocs.length === 0 && <tr><td colSpan="5" className="p-4 text-center text-gray-500">No hay documentos pendientes de pago.</td></tr>}
                    </tbody>
                </table>
            </div>
            <div className="flex justify-end"><Button onClick={() => setShowPendingModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle del Comprobante de Egreso</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold">Fecha:</span> {formatDate(selectedItem.fecha)}</p>
              <p><span className="font-semibold">Referencia:</span> {selectedItem.referencia}</p>
              <p><span className="font-semibold">Proveedor:</span> {getProveedorNombre(selectedItem.proveedor_cliente_id)}</p>
              <p><span className="font-semibold">Concepto:</span> {selectedItem.concepto}</p>
              <p><span className="font-semibold">Valor:</span> <span className="text-red-600 font-bold text-lg">{formatCurrency(selectedItem.valor)}</span></p>
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