import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { InventarioEnProceso } from '@/entities/all';
import { agruparPorCodigoProducto } from '@/lib/inventarioProceso';
import { formatCOP, mensajeError } from '../components/finanzas/utils';

// "Existencias en proceso" (requerimiento 6.16): cuero crosta entre materia prima y producto
// terminado. Reutiliza `agruparPorCodigoProducto`, la misma lógica de consolidación por lote
// padre/partidas que ya usa la pantalla de Inventario en Proceso (evita duplicar o contar dos
// veces el stock de un lote padre ya repartido en partidas).
export default function ReporteExistenciasEnProceso() {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const items = await InventarioEnProceso.list();
      const consolidado = agruparPorCodigoProducto(items).filter((f) => f.stock_total > 0);
      const columnas = [
        { key: 'codigo_producto_proceso', label: 'Código' },
        { key: 'descripcion', label: 'Descripción', ancho: 2 },
        { key: 'color_base', label: 'Color base' },
        { key: 'stock_total', label: 'Existencia', align: 'right' },
        { key: 'reservado_total', label: 'Reservado', align: 'right' },
        { key: 'disponible_total', label: 'Disponible', align: 'right' },
        { key: 'costo_promedio', label: 'Costo promedio', align: 'right', render: formatCOP },
        { key: 'valor_total', label: 'Valor total', align: 'right', render: formatCOP },
        { key: 'cantidad_partidas', label: 'Partidas', align: 'right' },
      ];
      setResultado({ columnas, filas: consolidado.map((f) => ({ ...f, id: f.codigo_producto_proceso })), totales: {
        stock_total: consolidado.reduce((s, f) => s + f.stock_total, 0),
        reservado_total: consolidado.reduce((s, f) => s + f.reservado_total, 0),
        disponible_total: consolidado.reduce((s, f) => s + f.disponible_total, 0),
        valor_total: consolidado.reduce((s, f) => s + f.valor_total, 0),
      } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, []);

  return (
    <ReporteBase
      titulo="Existencias en Proceso"
      descripcion="Cuero crosta en proceso, consolidado por Código Producto (sin duplicar lote padre y partidas)."
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={error ? <p className="text-xs text-red-600 w-full">{error}</p> : null}
    />
  );
}
