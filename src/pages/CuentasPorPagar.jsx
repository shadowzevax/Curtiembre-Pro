import React, { useState, useEffect } from 'react';
import { CuentaPorPagar } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, AlertCircle } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('es-CO') : 'N/A';

export default function CuentasPorPagar() {
  const [cuentas, setCuentas] = useState([]);
  const [filtradas, setFiltradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedCuenta, setSelectedCuenta] = useState(null);
  const [filtros, setFiltros] = useState({ proveedor: '', estado: 'todos', vencimiento: '' });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    aplicarFiltros();
  }, [cuentas, filtros]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await CuentaPorPagar.list();
      setCuentas(data);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const aplicarFiltros = () => {
    let filtered = [...cuentas];
    if (filtros.proveedor) {
      filtered = filtered.filter(c => c.proveedor_nombre?.toLowerCase().includes(filtros.proveedor.toLowerCase()));
    }
    if (filtros.estado !== 'todos') {
      filtered = filtered.filter(c => c.estado === filtros.estado);
    }
    if (filtros.vencimiento) {
      const hoy = new Date();
      filtered = filtered.filter(c => {
        const fechaVenc = new Date(c.fecha_vencimiento);
        return fechaVenc < hoy;
      });
    }
    setFiltradas(filtered);
  };

  const handleVerDetalle = (cuenta) => {
    setSelectedCuenta(cuenta);
    setShowDetailModal(true);
  };

  const esVencida = (fechaVencimiento) => {
    const hoy = new Date();
    const venc = new Date(fechaVencimiento);
    return venc < hoy;
  };

  const headers = ['Proveedor', 'Tipo y No. Doc.', 'Fecha Doc.', 'Fecha Venc.', 'Valor Total', 'Valor Pagado', 'Saldo Pendiente', 'Estado', 'Acciones'];
  
  const renderRow = (cuenta) => (
    <tr key={cuenta.id} className={esVencida(cuenta.fecha_vencimiento) && cuenta.estado !== 'pagada' ? 'bg-red-50' : ''}>
      <td>{cuenta.proveedor_nombre} {esVencida(cuenta.fecha_vencimiento) && cuenta.estado !== 'pagada' && <AlertCircle className="w-4 h-4 inline text-red-600 ml-1" />}</td>
      <td>{cuenta.tipo_documento} {cuenta.numero_documento}</td>
      <td>{formatDate(cuenta.fecha_documento)}</td>
      <td>{formatDate(cuenta.fecha_vencimiento)}</td>
      <td className="text-right font-bold">{formatCurrency(cuenta.valor_total)}</td>
      <td className="text-right text-green-600">{formatCurrency(cuenta.valor_pagado)}</td>
      <td className="text-right font-bold text-red-600">{formatCurrency(cuenta.saldo_pendiente)}</td>
      <td>
        <span className={`px-2 py-1 rounded text-xs font-medium ${
          cuenta.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
          cuenta.estado === 'parcial' ? 'bg-blue-100 text-blue-700' :
          cuenta.estado === 'pagada' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          {cuenta.estado.toUpperCase()}
        </span>
      </td>
      <td>
        <Button variant="outline" size="sm" onClick={() => handleVerDetalle(cuenta)}><Eye className="w-4 h-4" /></Button>
      </td>
    </tr>
  );

  const totalPendiente = filtradas.reduce((sum, c) => sum + (c.saldo_pendiente || 0), 0);

  return (
    <div className="p-6">
      <PageHeader 
        title="Cuentas por Pagar"
        description="Control de cuentas por pagar a proveedores."
      />

      <Card className="mb-6">
        <CardHeader><CardTitle>Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div><Label>Proveedor</Label><Input placeholder="Buscar..." value={filtros.proveedor} onChange={e => setFiltros({...filtros, proveedor: e.target.value})} /></div>
            <div>
              <Label>Estado</Label>
              <Select value={filtros.estado} onValueChange={v => setFiltros({...filtros, estado: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="pagada">Pagada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={() => setFiltros({...filtros, vencimiento: !filtros.vencimiento})} variant={filtros.vencimiento ? 'default' : 'outline'} className="w-full">
                {filtros.vencimiento ? 'Mostrando Vencidas' : 'Filtrar Vencidas'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Listado de Cuentas</CardTitle>
            <div className="bg-red-50 px-4 py-2 rounded"><span className="font-bold text-red-700">Saldo Total: {formatCurrency(totalPendiente)}</span></div>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable headers={headers} data={filtradas} renderRow={renderRow} loading={loading} />
        </CardContent>
      </Card>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Detalle de Cuenta por Pagar</DialogTitle></DialogHeader>
          {selectedCuenta && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded">
                <p><strong>Proveedor:</strong> {selectedCuenta.proveedor_nombre} (NIT: {selectedCuenta.proveedor_nit})</p>
                <p><strong>Documento:</strong> {selectedCuenta.tipo_documento} {selectedCuenta.numero_documento}</p>
                <p><strong>Módulo Origen:</strong> {selectedCuenta.modulo_origen?.toUpperCase()}</p>
                <p><strong>Condición de Pago:</strong> {selectedCuenta.condicion_pago?.toUpperCase()}</p>
                <p><strong>Fecha Documento:</strong> {formatDate(selectedCuenta.fecha_documento)}</p>
                <p><strong>Fecha Vencimiento:</strong> {formatDate(selectedCuenta.fecha_vencimiento)}</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 p-4 border rounded">
                <div><Label>Valor Total</Label><p className="text-lg font-bold">{formatCurrency(selectedCuenta.valor_total)}</p></div>
                <div><Label>Valor Pagado</Label><p className="text-lg font-bold text-green-600">{formatCurrency(selectedCuenta.valor_pagado)}</p></div>
                <div><Label>Saldo Pendiente</Label><p className="text-lg font-bold text-red-600">{formatCurrency(selectedCuenta.saldo_pendiente)}</p></div>
              </div>

              <div>
                <h4 className="font-bold mb-2">Historial de Pagos</h4>
                {selectedCuenta.historial_pagos && selectedCuenta.historial_pagos.length > 0 ? (
                  <table className="w-full text-sm border">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="border p-2">Fecha</th>
                        <th className="border p-2">Valor</th>
                        <th className="border p-2">Forma Pago</th>
                        <th className="border p-2">Referencia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCuenta.historial_pagos.map((pago, idx) => (
                        <tr key={idx}>
                          <td className="border p-2">{formatDate(pago.fecha_pago)}</td>
                          <td className="border p-2 text-right font-bold">{formatCurrency(pago.valor_pago)}</td>
                          <td className="border p-2">{pago.forma_pago}</td>
                          <td className="border p-2">{pago.referencia}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500">Sin pagos registrados</p>
                )}
              </div>

              {selectedCuenta.observaciones && (
                <div><Label>Observaciones</Label><p className="p-3 bg-gray-50 rounded">{selectedCuenta.observaciones}</p></div>
              )}

              <div className="flex justify-end pt-4">
                <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}