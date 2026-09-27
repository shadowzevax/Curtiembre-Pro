import React, { useState, useEffect, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { OrdenVenta, Tercero } from '@/entities/all';
import { formatCOP, formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

const ESTADOS = [{ value: '__todos', label: 'Todos' }, { value: 'pendiente', label: 'Pendientes de cobro' }, { value: 'parcial', label: 'Con abonos' }, { value: 'pagada', label: 'Cobradas' }];

// "Ventas por período" (requerimiento 6.15): consulta directa de Ventas, sin duplicar datos.
// Los filtros de cliente y estado cubren "por cliente", "pendientes de cobro" y "cobradas"
// sobre la misma consulta, sin construir una pantalla nueva por cada variante.
export default function ReporteVentasPeriodo() {
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState('__todos');
  const [estado, setEstado] = useState('__todos');
  const [desde, setDesde] = useState(hoy().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { Tercero.list().then((t) => setClientes(t.filter((c) => c.es_cliente))).catch((e) => setError(mensajeError(e))); }, []);

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const ordenes = await OrdenVenta.list();
      const nombreDe = (id) => clientes.find((t) => t.id === id)?.nombre || id;
      const filtradas = ordenes
        .filter((o) => !(o.anulado || o.estado_documento === 'anulado'))
        .filter((o) => o.fecha_orden >= desde && o.fecha_orden <= hasta)
        .filter((o) => clienteId === '__todos' || o.cliente_id === clienteId)
        .filter((o) => estado === '__todos' || (o.estado_documento || o.estado) === estado)
        .sort((a, b) => (a.fecha_orden || '').localeCompare(b.fecha_orden || ''));
      const columnas = [
        { key: 'numero_documento_completo', label: 'Documento' },
        { key: 'fecha_orden', label: 'Fecha', render: formatFecha },
        { key: 'cliente_nombre', label: 'Cliente', ancho: 2 },
        { key: 'tipo_venta', label: 'Tipo' },
        { key: 'estado', label: 'Estado' },
        { key: 'total', label: 'Valor', align: 'right', render: formatCOP },
      ];
      const filas = filtradas.map((o) => ({ ...o, id: o.id,
        numero_documento_completo: `${o.prefijo_documento || ''}-${o.numero_documento || ''}`,
        cliente_nombre: nombreDe(o.cliente_id),
        estado: ((o.estado_documento || o.estado || '') + '').toUpperCase() || '—' }));
      setResultado({ columnas, filas, totales: { total: filas.reduce((s, o) => s + (o.total || 0), 0) } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [desde, hasta, clienteId, estado, clientes]);

  return (
    <ReporteBase
      titulo="Ventas por Período"
      descripcion="Consulta directa del módulo de Ventas (Productos y Servicios), sin duplicar la información."
      filtrosTexto={`Del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div><Label>Cliente</Label>
          <Select value={clienteId} onValueChange={setClienteId}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="__todos">Todos</SelectItem>{clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
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
