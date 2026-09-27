import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { OrdenVenta, ProductoTerminado } from '@/entities/all';
import { formatCOP, formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

// "Ventas por producto" (requerimiento 6.15): agrega las líneas de cada venta del período por
// producto, sin duplicar el catálogo ni las órdenes (ambos ya existen en Ventas e Inventarios).
export default function ReporteVentasPorProducto() {
  const [desde, setDesde] = useState(hoy().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [ordenes, productos] = await Promise.all([OrdenVenta.list(), ProductoTerminado.list()]);
      const nombreDe = (id) => productos.find((p) => p.id === id)?.nombre;
      const filtradas = ordenes
        .filter((o) => !(o.anulado || o.estado_documento === 'anulado'))
        .filter((o) => o.fecha_orden >= desde && o.fecha_orden <= hasta);
      const acumulado = new Map();
      for (const o of filtradas) {
        for (const item of o.items || []) {
          const clave = item.producto_id || item.descripcion || 'Sin descripción';
          const nombre = nombreDe(item.producto_id) || item.descripcion || 'Sin descripción';
          const actual = acumulado.get(clave) || { id: clave, producto: nombre, cantidad: 0, valor: 0, documentos: 0 };
          actual.cantidad += Number(item.cantidad) || 0;
          actual.valor += Number(item.subtotal) || 0;
          actual.documentos += 1;
          acumulado.set(clave, actual);
        }
      }
      const filas = [...acumulado.values()].sort((a, b) => b.valor - a.valor);
      const columnas = [
        { key: 'producto', label: 'Producto', ancho: 3 },
        { key: 'documentos', label: 'Ventas', align: 'right' },
        { key: 'cantidad', label: 'Cantidad', align: 'right' },
        { key: 'valor', label: 'Valor', align: 'right', render: formatCOP },
      ];
      setResultado({ columnas, filas, totales: { cantidad: filas.reduce((s, f) => s + f.cantidad, 0), valor: filas.reduce((s, f) => s + f.valor, 0) } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [desde, hasta]);

  return (
    <ReporteBase
      titulo="Ventas por Producto"
      descripcion="Total vendido por producto en el período, sumando las líneas de cada venta."
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
