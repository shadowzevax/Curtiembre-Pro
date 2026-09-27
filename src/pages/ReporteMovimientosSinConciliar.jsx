import React, { useState, useEffect, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError } from '../components/finanzas/utils';

// "Movimientos pendientes de conciliación" (requerimiento 6.13): lo que ya usa la pantalla
// de Conciliación Bancaria para sugerir coincidencias, aquí como reporte de consulta.
export default function ReporteMovimientosSinConciliar() {
  const [cuentas, setCuentas] = useState([]);
  const [cuentaId, setCuentaId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fin.get('/cuentas', { tipo: 'banco' }).then((c) => { setCuentas(c); setCuentaId(c[0]?.id || ''); }).catch((e) => setError(mensajeError(e)));
  }, []);

  const consultar = useCallback(async () => {
    if (!cuentaId) { setError('No hay cuentas bancarias configuradas'); return; }
    setCargando(true); setError('');
    try {
      const movimientos = await fin.get('/movimientos-sin-conciliar', { cuenta_id: cuentaId, desde, hasta });
      const columnas = [
        { key: 'fecha', label: 'Fecha', render: formatFecha },
        { key: 'clase', label: 'Clase' },
        { key: 'concepto', label: 'Concepto', ancho: 2 },
        { key: 'tercero_nombre', label: 'Tercero', render: (v) => v || '—' },
        { key: 'entrada', label: 'Entrada', align: 'right', render: (v) => (v ? formatCOP(v) : '—') },
        { key: 'salida', label: 'Salida', align: 'right', render: (v) => (v ? formatCOP(v) : '—') },
      ];
      const filas = movimientos.map((m) => ({ ...m, entrada: m.naturaleza === 'entrada' ? m.valor : 0, salida: m.naturaleza === 'salida' ? m.valor : 0 }));
      setResultado({ columnas, filas, totales: { entrada: filas.reduce((s, m) => s + m.entrada, 0), salida: filas.reduce((s, m) => s + m.salida, 0) } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [cuentaId, desde, hasta]);

  const cuenta = cuentas.find((c) => c.id === cuentaId);

  return (
    <ReporteBase
      titulo="Movimientos Pendientes de Conciliación"
      descripcion="Movimientos bancarios que todavía no quedaron emparejados con ninguna línea de extracto."
      filtrosTexto={cuenta ? cuenta.nombre : ''}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Cuenta bancaria</Label>
          <Select value={cuentaId} onValueChange={setCuentaId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>{cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
      </>}
    />
  );
}
