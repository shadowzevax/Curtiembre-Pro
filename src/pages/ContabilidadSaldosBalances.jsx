import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError } from '../components/finanzas/utils';

// Saldos y Balances: balance de comprobación por cuenta conceptual (cuenta_rol), mientras no
// exista un plan de cuentas real. Consulta fin_mov_contables, que ya genera cada operación.
export default function ContabilidadSaldosBalances() {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const saldos = await fin.get('/saldos-cuenta-rol', { desde, hasta });
      const columnas = [
        { key: 'cuenta_rol', label: 'Cuenta conceptual' },
        { key: 'debitos', label: 'Débitos', align: 'right', render: formatCOP },
        { key: 'creditos', label: 'Créditos', align: 'right', render: formatCOP },
        { key: 'saldo', label: 'Saldo', align: 'right', render: formatCOP },
      ];
      const filas = saldos.map((s) => ({ ...s, id: s.cuenta_rol }));
      setResultado({ columnas, filas, totales: {
        debitos: filas.reduce((s, f) => s + f.debitos, 0),
        creditos: filas.reduce((s, f) => s + f.creditos, 0),
        saldo: filas.reduce((s, f) => s + f.saldo, 0),
      } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [desde, hasta]);

  return (
    <ReporteBase
      titulo="Saldos y Balances"
      descripcion="Balance de comprobación por cuenta conceptual, sobre los movimientos contables que ya genera cada operación (débito = crédito siempre)."
      filtrosTexto={desde || hasta ? `Del ${desde ? formatFecha(desde) : 'inicio'} al ${hasta ? formatFecha(hasta) : 'hoy'}` : 'Histórico completo'}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      vacioTexto="Aplique filtros (o déjelos vacíos para el histórico completo) y presione Consultar."
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
      </>}
    />
  );
}
