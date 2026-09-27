import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';
import { formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

const ESTADO_LABEL = { pendiente: 'Pendiente', en_produccion: 'En producción', finalizada: 'Finalizada', entregada: 'Entregada', cancelada: 'Cancelada' };

// "Pedidos y cumplimiento" (requerimiento 6.18): lista plana de órdenes de Pedidos y
// Producción de Pintura, sin recalcular la matriz Color x Placa que ya construye ese módulo
// (evita repetir su lógica de filtrado y arriesgar un número distinto al real).
export default function ReportePedidosPintura() {
  const [desde, setDesde] = useState(hoy().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const ordenes = await base44.entities.OrdenProduccionPCP.list('-created_date');
      const fechaDe = (o) => (o.created_date || '').slice(0, 10);
      const filtradas = ordenes.filter((o) => fechaDe(o) >= desde && fechaDe(o) <= hasta);
      const columnas = [
        { key: 'numero_orden', label: 'Orden' },
        { key: 'fecha', label: 'Fecha', render: formatFecha },
        { key: 'nombre_color', label: 'Color', ancho: 2 },
        { key: 'estado', label: 'Estado', render: (v) => ESTADO_LABEL[v] || v },
        { key: 'cantidad_total_hojas', label: 'Hojas pedidas', align: 'right' },
        { key: 'hojas_producidas', label: 'Hojas producidas', align: 'right', render: (v) => v ?? 0 },
      ];
      const filas = filtradas.map((o) => ({ ...o, id: o.id, fecha: fechaDe(o) }));
      setResultado({ columnas, filas, totales: {
        cantidad_total_hojas: filas.reduce((s, o) => s + (o.cantidad_total_hojas || 0), 0),
        hojas_producidas: filas.reduce((s, o) => s + (o.hojas_producidas || 0), 0),
      } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [desde, hasta]);

  return (
    <ReporteBase
      titulo="Pedidos y Cumplimiento"
      descripcion="Órdenes de producción de pintura del período, tal como las genera Planificación y Control de Producción de Pintura."
      filtrosTexto={`Del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
      </>}
    />
  );
}
