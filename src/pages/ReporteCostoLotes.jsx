import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { InventarioEnProceso, ProcesoProduccion, CostoIndirecto } from '@/entities/all';
import { costoTotalDeLote } from '@/lib/inventarioProceso';
import { formatCOP, mensajeError } from '../components/finanzas/utils';

// "Costo real por lote": corrige un hueco real que encontramos en Producción — el costo de
// Acabado y los Costos Indirectos (mano de obra, maquinaria, otros) nunca se sumaban al costo
// acumulado que ya calculan Recepción/Limpieza/Curtido/Recurtido. Este reporte no modifica esas
// pantallas ni sus datos: solo suma, con `costoTotalDeLote` (src/lib/inventarioProceso.js),
// para dar por primera vez el costo real y completo de cada lote.
export default function ReporteCostoLotes() {
  const [codigoLote, setCodigoLote] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [inv, procesos, costos] = await Promise.all([InventarioEnProceso.list(), ProcesoProduccion.list(), CostoIndirecto.list()]);
      const lotesPadre = inv.filter((i) => !i.codigo_lote_padre)
        .filter((i) => !codigoLote || i.codigo_lote?.toLowerCase().includes(codigoLote.toLowerCase()));

      const filas = lotesPadre.map((padre) => {
        const c = costoTotalDeLote(padre.codigo_lote, inv, procesos, costos);
        return { id: padre.id, codigo_lote: padre.codigo_lote, descripcion: padre.descripcion_producto_proceso || padre.descripcion || '',
          costo_base: c.costo_base, costo_acabado: c.costo_acabado, costo_indirecto: c.costo_indirecto, costo_total: c.costo_total, costo_por_hoja: c.costo_por_hoja };
      }).filter((f) => f.costo_total > 0)
        .sort((a, b) => b.costo_total - a.costo_total);

      const columnas = [
        { key: 'codigo_lote', label: 'Lote' },
        { key: 'descripcion', label: 'Descripción', ancho: 2 },
        { key: 'costo_base', label: 'Recep.+Limp.+Curt.+Recurt.', align: 'right', render: formatCOP },
        { key: 'costo_acabado', label: 'Acabado', align: 'right', render: formatCOP },
        { key: 'costo_indirecto', label: 'Costos indirectos', align: 'right', render: formatCOP },
        { key: 'costo_total', label: 'Costo total real', align: 'right', render: formatCOP },
        { key: 'costo_por_hoja', label: 'Por hoja', align: 'right', render: formatCOP },
      ];
      setResultado({ columnas, filas, totales: {
        costo_base: filas.reduce((s, f) => s + f.costo_base, 0),
        costo_acabado: filas.reduce((s, f) => s + f.costo_acabado, 0),
        costo_indirecto: filas.reduce((s, f) => s + f.costo_indirecto, 0),
        costo_total: filas.reduce((s, f) => s + f.costo_total, 0),
      } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [codigoLote]);

  return (
    <ReporteBase
      titulo="Costo Real por Lote"
      descripcion="Costo completo de cada lote: Recepción, Limpieza, Curtido y Recurtido (ya lo calculaba Producción) más Acabado y Costos Indirectos (antes no se sumaban)."
      filtrosTexto={codigoLote ? `Lote: ${codigoLote}` : 'Todos los lotes'}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Código de lote (opcional)</Label><Input value={codigoLote} onChange={(e) => setCodigoLote(e.target.value)} placeholder="Buscar…" /></div>
      </>}
    />
  );
}
