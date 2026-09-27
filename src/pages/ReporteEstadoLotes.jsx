import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ProcesoProduccion } from '@/entities/all';
import { formatFecha, mensajeError } from '../components/finanzas/utils';

const ORDEN_ETAPA = ['recepcion', 'limpieza', 'curtido', 'recurtido', 'acabado'];
const ETAPA_LABEL = { recepcion: 'Recepción', limpieza: 'Limpieza', curtido: 'Curtido', recurtido: 'Recurtido', acabado: 'Acabado' };
const ESTADO_LABEL = { completado: 'Completado', en_proceso: 'En proceso', pendiente: 'Pendiente', anulado: 'Anulado' };

// "Reportes de Procesos" (antes vacío): por cada lote, la etapa más avanzada que ya tiene
// registro y su estado — sin modificar el módulo de Producción, solo leyendo ProcesoProduccion.
export default function ReporteEstadoLotes() {
  const [codigoLote, setCodigoLote] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const procesos = await ProcesoProduccion.list();
      const porLote = new Map();
      for (const p of procesos) {
        if (p.estado === 'anulado') continue;
        if (codigoLote && !p.codigo_lote?.toLowerCase().includes(codigoLote.toLowerCase())) continue;
        const actual = porLote.get(p.codigo_lote);
        const indiceNuevo = ORDEN_ETAPA.indexOf(p.tipo_proceso);
        if (!actual || indiceNuevo > ORDEN_ETAPA.indexOf(actual.tipo_proceso)) porLote.set(p.codigo_lote, p);
      }
      const filas = [...porLote.values()]
        .map((p) => ({ id: p.codigo_lote, codigo_lote: p.codigo_lote, etapa_actual: ETAPA_LABEL[p.tipo_proceso] || p.tipo_proceso,
          estado: ESTADO_LABEL[p.estado] || p.estado, fecha_inicio: p.fecha_inicio, fecha_fin: p.fecha_fin,
          cantidad: p.cantidad_pieles ?? p.cantidad_total_lote ?? p.cantidad_hojas ?? null }))
        .sort((a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''));
      const columnas = [
        { key: 'codigo_lote', label: 'Lote' },
        { key: 'etapa_actual', label: 'Etapa actual' },
        { key: 'estado', label: 'Estado' },
        { key: 'fecha_inicio', label: 'Inicio', render: formatFecha },
        { key: 'fecha_fin', label: 'Fin', render: (v) => (v ? formatFecha(v) : '—') },
        { key: 'cantidad', label: 'Cantidad', align: 'right', render: (v) => (v != null ? v : '—') },
      ];
      setResultado({ columnas, filas });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [codigoLote]);

  return (
    <ReporteBase
      titulo="Estado de Lotes"
      descripcion="Etapa más avanzada de cada lote y su estado, sobre los registros que ya genera Producción."
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
