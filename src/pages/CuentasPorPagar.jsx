import React, { useState, useEffect } from 'react';
import { CuentaPorPagar } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, RotateCcw, Search } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + offset).toLocaleDateString('es-CO');
};

const initialFiltros = { proveedor: '', tipoDocumento: '', numeroDocumento: '', estado: 'todos', soloVencidas: false };

export default function CuentasPorPagar() {
  const [cuentas, setCuentas] = useState([]);
  const [filtradas, setFiltradas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtros, setFiltros] = useState(initialFiltros);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { aplicarFiltros(); }, [cuentas, filtros]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await CuentaPorPagar.list('-created_date');
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
    if (filtros.tipoDocumento) {
      filtered = filtered.filter(c => c.tipo_documento?.toLowerCase().includes(filtros.tipoDocumento.toLowerCase()));
    }
    if (filtros.numeroDocumento) {
      filtered = filtered.filter(c => c.numero_documento?.toLowerCase().includes(filtros.numeroDocumento.toLowerCase()));
    }
    if (filtros.estado !== 'todos') {
      filtered = filtered.filter(c => c.estado === filtros.estado);
    }
    if (filtros.soloVencidas) {
      const hoy = new Date();
      filtered = filtered.filter(c => c.fecha_vencimiento && new Date(c.fecha_vencimiento) < hoy && c.estado !== 'pagada');
    }
    setFiltradas(filtered);
  };

  const esVencida = (cuenta) => {
    if (!cuenta.fecha_vencimiento || cuenta.estado === 'pagada') return false;
    return new Date(cuenta.fecha_vencimiento) < new Date();
  };

  const totalPendiente = filtradas.reduce((sum, c) => sum + (c.saldo_pendiente || 0), 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Cuentas por Pagar"
        description="Control de cuentas por pagar a proveedores."
      />

      {/* Filtros */}
      <Card>
        <CardHeader><CardTitle className="text-base">Filtros de Búsqueda</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <div>
              <Label>Proveedor</Label>
              <Input placeholder="Buscar proveedor..." value={filtros.proveedor} onChange={e => setFiltros(f => ({ ...f, proveedor: e.target.value }))} />
            </div>
            <div>
              <Label>Tipo Documento</Label>
              <Input placeholder="Ej: FE, CC..." value={filtros.tipoDocumento} onChange={e => setFiltros(f => ({ ...f, tipoDocumento: e.target.value }))} />
            </div>
            <div>
              <Label>No. Documento</Label>
              <Input placeholder="Buscar No. ID..." value={filtros.numeroDocumento} onChange={e => setFiltros(f => ({ ...f, numeroDocumento: e.target.value }))} />
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={filtros.estado} onValueChange={v => setFiltros(f => ({ ...f, estado: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendiente">Pendiente</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="pagada">Pagada</SelectItem>
                  <SelectItem value="anulada">Anulada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col justify-end gap-2">
              <Button
                variant={filtros.soloVencidas ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => setFiltros(f => ({ ...f, soloVencidas: !f.soloVencidas }))}
                className="w-full"
              >
                <AlertCircle className="w-4 h-4 mr-1" />
                {filtros.soloVencidas ? 'Mostrando Vencidas' : 'Solo Vencidas'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setFiltros(initialFiltros)} className="w-full">
                <RotateCcw className="w-4 h-4 mr-1" /> Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Listado de Cuentas</CardTitle>
            <div className="bg-red-50 border border-red-200 px-4 py-2 rounded-lg">
              <span className="font-bold text-red-700">Saldo Total Pendiente: {formatCurrency(totalPendiente)}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">No. ID</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Tipo Doc. Proveedor</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">No. Documento Proveedor</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Proveedor</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Fecha Emisión Documento</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Fecha Vencimiento</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Valor Total</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Saldo Pendiente</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-700">Estado</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-400">Cargando datos...</td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-slate-400">No hay registros para mostrar.</td></tr>
                ) : filtradas.map(cuenta => (
                  <tr key={cuenta.id} className={`border-t hover:bg-gray-50 ${esVencida(cuenta) ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-2 font-mono font-bold text-emerald-700">{cuenta.id_cuenta || cuenta.numero_documento || 'N/A'}</td>
                    <td className="px-4 py-2">{cuenta.tipo_documento || '—'}</td>
                    <td className="px-4 py-2">{cuenta.numero_documento || '—'}</td>
                    <td className="px-4 py-2 font-medium">
                      {cuenta.proveedor_nombre || '—'}
                      {esVencida(cuenta) && <AlertCircle className="w-4 h-4 inline text-red-500 ml-1" title="Vencida" />}
                    </td>
                    <td className="px-4 py-2">{formatDate(cuenta.fecha_documento)}</td>
                    <td className={`px-4 py-2 ${esVencida(cuenta) ? 'text-red-600 font-semibold' : ''}`}>{formatDate(cuenta.fecha_vencimiento)}</td>
                    <td className="px-4 py-2 text-right font-medium">{formatCurrency(cuenta.valor_total)}</td>
                    <td className="px-4 py-2 text-right font-bold text-red-600">{formatCurrency(cuenta.saldo_pendiente)}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        cuenta.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' :
                        cuenta.estado === 'parcial' ? 'bg-blue-100 text-blue-700' :
                        cuenta.estado === 'pagada' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {(cuenta.estado || '').toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-sm text-slate-500">Total de registros: {filtradas.length}</div>
        </CardContent>
      </Card>
    </div>
  );
}