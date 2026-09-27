import React, { useState, useEffect, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrdenCompra, Tercero } from '@/entities/all';
import { formatCOP, formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

const ESTADOS = [{ value: '__todos', label: 'Todos' }, { value: 'pendiente', label: 'Pendientes de pago' }, { value: 'parcial', label: 'Con abonos' }, { value: 'pagada', label: 'Pagadas' }];

// "Compras por período" (requerimiento 6.14): consulta directa de Compras, sin duplicar datos.
// Los filtros de proveedor, tipo y estado cubren "por proveedor", "materia prima/insumos/
// servicios" y "pendientes de pago/pagadas" sobre la misma consulta.
export default function ReporteComprasPeriodo() {
  const [proveedores, setProveedores] = useState([]);
  const [proveedorId, setProveedorId] = useState('__todos');
  const [estado, setEstado] = useState('__todos');
  const [desde, setDesde] = useState(hoy().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { Tercero.list().then((t) => setProveedores(t.filter((p) => p.es_proveedor))).catch((e) => setError(mensajeError(e))); }, []);

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const ordenes = await OrdenCompra.list();
      const nombreDe = (id) => proveedores.find((t) => t.id === id)?.nombre || id;
      const fechaDe = (o) => o.fecha_emision_documento || o.fecha_orden;
      const filtradas = ordenes
        .filter((o) => !(o.anulado || o.estado_documento === 'anulado'))
        .filter((o) => fechaDe(o) >= desde && fechaDe(o) <= hasta)
        .filter((o) => proveedorId === '__todos' || o.proveedor_id === proveedorId)
        .filter((o) => estado === '__todos' || (o.estado_documento || o.estado) === estado)
        .sort((a, b) => (fechaDe(a) || '').localeCompare(fechaDe(b) || ''));
      const columnas = [
        { key: 'numero_documento_completo', label: 'Documento' },
        { key: 'fecha', label: 'Fecha', render: formatFecha },
        { key: 'proveedor_nombre', label: 'Proveedor', ancho: 2 },
        { key: 'tipo_item', label: 'Tipo' },
        { key: 'estado', label: 'Estado' },
        { key: 'total', label: 'Valor', align: 'right', render: formatCOP },
      ];
      const filas = filtradas.map((o) => ({ ...o, id: o.id,
        numero_documento_completo: o.numero_id || `${o.prefijo || ''}-${o.numero_documento || ''}`,
        fecha: fechaDe(o),
        proveedor_nombre: nombreDe(o.proveedor_id),
        estado: ((o.estado_documento || o.estado || '') + '').toUpperCase() || '—' }));
      setResultado({ columnas, filas, totales: { total: filas.reduce((s, o) => s + (o.total || 0), 0) } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [desde, hasta, proveedorId, estado, proveedores]);

  return (
    <ReporteBase
      titulo="Compras por Período"
      descripcion="Consulta directa del módulo de Compras de Insumos, sin duplicar la información."
      filtrosTexto={`Del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div><Label>Proveedor</Label>
          <Select value={proveedorId} onValueChange={setProveedorId}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__todos">Todos</SelectItem>{proveedores.map((p) => <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </>}
    />
  );
}
