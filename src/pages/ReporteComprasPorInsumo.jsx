import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { OrdenCompra, Insumo } from '@/entities/all';
import { formatCOP, formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

// "Compras por producto/insumo" (requerimiento 6.14): agrega las líneas de cada compra del
// período por insumo, sin duplicar el catálogo ni las órdenes de Compras/Inventarios.
export default function ReporteComprasPorInsumo() {
  const [desde, setDesde] = useState(hoy().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [ordenes, insumos] = await Promise.all([OrdenCompra.list(), Insumo.list()]);
      const nombreDe = (id) => insumos.find((i) => i.id === id)?.nombre;
      const fechaDe = (o) => o.fecha_emision_documento || o.fecha_orden;
      const filtradas = ordenes
        .filter((o) => !(o.anulado || o.estado_documento === 'anulado'))
        .filter((o) => fechaDe(o) >= desde && fechaDe(o) <= hasta);
      const acumulado = new Map();
      for (const o of filtradas) {
        for (const item of o.items || []) {
          const clave = item.insumo_id || item.descripcion || 'Sin descripción';
          const nombre = nombreDe(item.insumo_id) || item.descripcion || 'Sin descripción';
          const actual = acumulado.get(clave) || { id: clave, insumo: nombre, cantidad: 0, valor: 0, documentos: 0 };
          actual.cantidad += Number(item.cantidad) || 0;
          actual.valor += Number(item.subtotal) || 0;
          actual.documentos += 1;
          acumulado.set(clave, actual);
        }
      }
      const filas = [...acumulado.values()].sort((a, b) => b.valor - a.valor);
      const columnas = [
        { key: 'insumo', label: 'Insumo / Materia prima', ancho: 3 },
        { key: 'documentos', label: 'Compras', align: 'right' },
        { key: 'cantidad', label: 'Cantidad', align: 'right' },
        { key: 'valor', label: 'Valor', align: 'right', render: formatCOP },
      ];
      setResultado({ columnas, filas, totales: { cantidad: filas.reduce((s, f) => s + f.cantidad, 0), valor: filas.reduce((s, f) => s + f.valor, 0) } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [desde, hasta]);

  return (
    <ReporteBase
      titulo="Compras por Insumo"
      descripcion="Total comprado por insumo o materia prima en el período, sumando las líneas de cada compra."
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
