import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { fin } from '@/api/finanzas';
import { FORMA_PAGO_LABEL } from '../components/finanzas/DocumentoFinancieroDialog';
import { formatCOP, formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

// "Ingresos por forma de pago" y "Egresos por forma de pago" (Reportes → Finanzas y Tesorería):
// agrupa los Recibos de Caja / Comprobantes de Egreso ya emitidos. Solo consulta, no crea nada.
export default function ReporteFormaPago() {
  const [params] = useSearchParams();
  const egresos = params.get('flujo') === 'egresos';
  const [desde, setDesde] = useState(hoy().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const docs = await fin.get('/documentos-financieros', { tipos: egresos ? 'CE' : 'RC,CIN', desde, hasta, estado: 'emitido' });
      const grupos = new Map();
      for (const d of docs) {
        const clave = `${d.forma_pago || 'sin_dato'}|${d.cuenta_nombre || ''}`;
        const g = grupos.get(clave) || { id: clave, forma_pago: FORMA_PAGO_LABEL[d.forma_pago] || 'Sin dato', cuenta: d.cuenta_nombre || '—', documentos: 0, valor: 0 };
        g.documentos += 1; g.valor += d.valor;
        grupos.set(clave, g);
      }
      const filas = [...grupos.values()].sort((a, b) => b.valor - a.valor);
      const columnas = [
        { key: 'forma_pago', label: 'Forma de pago', ancho: 2 },
        { key: 'cuenta', label: 'Cuenta', ancho: 2 },
        { key: 'documentos', label: 'Documentos', align: 'right' },
        { key: 'valor', label: egresos ? 'Valor pagado' : 'Valor recibido', align: 'right', render: formatCOP },
      ];
      setResultado({ columnas, filas, totales: { documentos: filas.reduce((s, f) => s + f.documentos, 0), valor: filas.reduce((s, f) => s + f.valor, 0) } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [egresos, desde, hasta]);

  return (
    <ReporteBase
      titulo={egresos ? 'Egresos por Forma de Pago' : 'Ingresos por Forma de Pago'}
      descripcion={egresos ? 'Comprobantes de Egreso del período, agrupados por forma de pago y cuenta.' : 'Recibos de Caja e ingresos del período, agrupados por forma de pago y cuenta.'}
      filtrosTexto={`Del ${formatFecha(desde)} al ${formatFecha(hasta)} · sin anulados`}
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
