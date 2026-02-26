import React, { useState, useEffect } from 'react';
import { CuentaContable, Proveedor, OrdenCompra, MovimientoLibroDiario, CuentaPorPagar, Caja, MovimientoCaja, CuentaBancaria, MovimientoBancario } from '@/entities/all';
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
  const [cuentasPorPagar, setCuentasPorPagar] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [cuentasBancarias, setCuentasBancarias] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showPendingModal, setShowPendingModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cuentasData, proveedoresData, cuentasPagarData, cajasData, bancosData] = await Promise.all([
        CuentaContable.filter({ tipo_cuenta: 'gastos' }),
        Proveedor.list(),
        CuentaPorPagar.list(),
        Caja.list(),
        CuentaBancaria.list()
      ]);
      setEgresos(cuentasData);
      setProveedores(proveedoresData);
      setCuentasPorPagar(cuentasPagarData);
      setCajas(cajasData);
      setCuentasBancarias(bancosData);
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
      proveedor_cliente_id: '',
      referencia: '',
      observaciones: '',
      medio_pago: 'caja',
      cuenta_destino_id: '',
      cuenta_destino_nombre: '',
      cuenta_por_pagar_id: ''
    });
    setShowModal(true);
  };

  const loadPendingDocs = async () => {
      try {
          const filtered = cuentasPorPagar.filter(c => c.saldo_pendiente > 0);
          setShowPendingModal(true);
      } catch (e) {
          console.error(e);
      }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const valorPago = parseFloat(currentItem.valor) || 0;

      if (isEditing) {
        await CuentaContable.update(currentItem.id, currentItem);
      } else {
        const nuevoEgreso = await CuentaContable.create(currentItem);

        // Afectar Caja o Bancos
        if (currentItem.medio_pago === 'caja' && currentItem.cuenta_destino_id) {
          const caja = cajas.find(c => c.id === currentItem.cuenta_destino_id);
          if (caja) {
            const cajaData = caja;
            const nuevoSaldo = (cajaData.saldo_actual || 0) - valorPago;
            await Caja.update(cajaData.id, { saldo_actual: nuevoSaldo });
            await MovimientoCaja.create({
              caja_id: cajaData.id,
              nombre_caja: cajaData.nombre,
              fecha: currentItem.fecha,
              tipo_movimiento: 'salida',
              concepto: `Comprobante de Egreso: ${currentItem.concepto}`,
              responsable: currentItem.proveedor_cliente_id ? proveedores.find(p => p.id === currentItem.proveedor_cliente_id)?.nombre || '' : '',
              valor: valorPago,
              saldo_resultante: nuevoSaldo,
              documento_origen_tipo: 'ComprobanteEgreso',
              documento_origen_id: nuevoEgreso.id,
              documento_soporte: currentItem.prefijo
            });
          }
        } else if (currentItem.medio_pago === 'banco' && currentItem.cuenta_destino_id) {
          const cuentasAll = await CuentaBancaria.list();
          const cuentaData = cuentasAll.find(c => c.id === currentItem.cuenta_destino_id);
          if (cuentaData) {
            const saldoAnterior = cuentaData.saldo_actual || 0;
            const nuevoSaldo = saldoAnterior - valorPago;
            await CuentaBancaria.update(cuentaData.id, { saldo_actual: nuevoSaldo });
            await MovimientoBancario.create({
              cuenta_id: cuentaData.id,
              fecha: currentItem.fecha,
              tipo_movimiento: 'egreso',
              concepto: `Comprobante de Egreso: ${currentItem.concepto}`,
              referencia: currentItem.prefijo,
              tercero_id: currentItem.proveedor_cliente_id,
              tercero_nombre: currentItem.proveedor_cliente_id ? proveedores.find(p => p.id === currentItem.proveedor_cliente_id)?.nombre || '' : '',
              valor: valorPago,
              saldo_posterior: nuevoSaldo,
              estado: 'confirmado',
              documento_origen_tipo: 'ComprobanteEgreso',
              documento_origen_id: nuevoEgreso.id,
              es_automatico: true,
              observaciones: currentItem.observaciones || ''
            });
          }
        }

        // Actualizar cuenta por pagar
        if (currentItem.cuenta_por_pagar_id) {
          const cuenta = await CuentaPorPagar.filter({ id: currentItem.cuenta_por_pagar_id });
          if (cuenta && cuenta.length > 0) {
            const cta = cuenta[0];
            const nuevoValorPagado = (cta.valor_pagado || 0) + valorPago;
            const nuevoSaldoPendiente = (cta.valor_total || 0) - nuevoValorPagado;
            const nuevoEstado = nuevoSaldoPendiente === 0 ? 'pagada' : (nuevoValorPagado > 0 ? 'parcial' : 'pendiente');
            
            const historial = cta.historial_pagos || [];
            historial.push({
              fecha_pago: currentItem.fecha,
              valor_pago: valorPago,
              forma_pago: currentItem.medio_pago,
              referencia: currentItem.prefijo,
              comprobante_egreso_id: nuevoEgreso.id
            });

            await CuentaPorPagar.update(cta.id, {
              valor_pagado: nuevoValorPagado,
              saldo_pendiente: nuevoSaldoPendiente,
              estado: nuevoEstado,
              historial_pagos: historial
            });
          }
        }

        // Registro en Libro Diario
        try {
            await MovimientoLibroDiario.create({
                 fecha: currentItem.fecha,
                 tipo_movimiento: 'egreso',
                 tipo_tercero: 'proveedor',
                 tipo_documento_soporte: 'comprobante_interno',
                 numero_documento: currentItem.prefijo,
                 tercero_id: currentItem.proveedor_cliente_id,
                 tercero_nombre: proveedores.find(p => p.id === currentItem.proveedor_cliente_id)?.nombre || '',
                 cuenta_afectada: currentItem.medio_pago === 'caja' ? 'Caja' : 'Banco',
                 descripcion: currentItem.concepto,
                 valor_ingreso: 0,
                 valor_egreso: currentItem.valor,
                 medio_pago: currentItem.medio_pago,
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
    <div className="p-4 md:p-6 space-y-4 max-w-full overflow-x-hidden">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                      cc_nit: prov ? (prov.numero_identificacion || prov.nit) : currentItem?.cc_nit
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
              <Label>Estado de Cuenta (Seleccionar para Pagar)</Label>
              <div className="flex gap-2">
                <Select value={currentItem?.cuenta_por_pagar_id || ''} onValueChange={v => {
                  const cta = cuentasPorPagar.find(c => c.id === v);
                  if (cta) {
                    setCurrentItem({
                      ...currentItem,
                      cuenta_por_pagar_id: v,
                      valor: cta.saldo_pendiente,
                      proveedor_cliente_id: cta.proveedor_id,
                      concepto: `Pago ${cta.tipo_documento} ${cta.numero_documento}`
                    });
                  } else {
                    setCurrentItem({...currentItem, cuenta_por_pagar_id: ''});
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Ninguna</SelectItem>
                    {cuentasPorPagar.filter(c => c.saldo_pendiente > 0).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.tipo_documento} {c.numero_documento} - {c.proveedor_nombre} - Saldo: {formatCurrency(c.saldo_pendiente)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Por Valor De *</Label>
              <Input type="number" step="0.01" value={currentItem?.valor || ''} onChange={e => setCurrentItem({ ...currentItem, valor: parseFloat(e.target.value) || 0 })} required />
            </div>

            <div>
              <Label>Medio de Pago *</Label>
              <Select value={currentItem?.medio_pago || 'caja'} onValueChange={v => setCurrentItem({ ...currentItem, medio_pago: v, cuenta_destino_id: '', cuenta_destino_nombre: '' })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="caja">CAJA</SelectItem>
                  <SelectItem value="banco">BANCO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {currentItem?.medio_pago === 'caja' && (
              <div>
                <Label>Seleccionar Caja Activa *</Label>
                <Select value={currentItem?.cuenta_destino_id || ''} onValueChange={v => {
                  const caja = cajas.find(c => c.id === v);
                  setCurrentItem({...currentItem, cuenta_destino_id: v, cuenta_destino_nombre: caja?.nombre || ''});
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar caja" /></SelectTrigger>
                  <SelectContent>
                    {cajas.filter(c => c.estado === 'activa').map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.codigo_caja} - {c.nombre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {currentItem?.medio_pago === 'banco' && (
              <div>
                <Label>Cuenta Bancaria *</Label>
                <Select value={currentItem?.cuenta_destino_id || ''} onValueChange={v => {
                  const cuenta = cuentasBancarias.find(c => c.id === v);
                  setCurrentItem({...currentItem, cuenta_destino_id: v, cuenta_destino_nombre: cuenta ? `${cuenta.banco} - ${cuenta.numero_cuenta}` : ''});
                }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar cuenta" /></SelectTrigger>
                  <SelectContent>
                    {cuentasBancarias.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.banco} - {c.numero_cuenta}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Concepto *</Label>
              <Input value={currentItem?.concepto || ''} onChange={e => setCurrentItem({ ...currentItem, concepto: e.target.value })} required placeholder="Ej: Pago de servicios públicos" />
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