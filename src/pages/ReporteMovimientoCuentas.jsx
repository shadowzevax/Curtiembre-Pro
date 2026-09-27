import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

// Reporte de prueba del motor (B7): "Movimiento diario de Caja" y "Movimiento diario de
// Bancos" (requerimiento 6.13) son la misma consulta — el libro de una cuenta de dinero,
// que ya existe en el motor financiero (`GET /fin/cuentas/:id/libro`) — parametrizada por tipo.
export default function ReporteMovimientoCuentas() {
  const [params] = useSearchParams();
  const tipo = params.get('tipo') === 'banco' ? 'banco' : 'caja';
  const [cuentas, setCuentas] = useState([]);
  const [cuentaId, setCuentaId] = useState('');
  const [desde, setDesde] = useState(hoy());
  const [hasta, setHasta] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fin.get('/cuentas', { tipo }).then((c) => { setCuentas(c); setCuentaId(c[0]?.id || ''); }).catch((e) => setError(mensajeError(e)));
  }, [tipo]);

  const consultar = useCallback(async () => {
    if (!cuentaId) { setError('No hay cuentas configuradas de este tipo'); return; }
    setCargando(true); setError('');
    try {
      const r = await fin.get(`/cuentas/${cuentaId}/libro`, { desde, hasta });
      const columnas = [
        { key: 'fecha', label: 'Fecha', render: formatFecha },
        { key: 'documento_numero', label: 'Documento' },
        { key: 'concepto', label: 'Concepto', ancho: 3 },
        { key: 'entrada', label: 'Entrada', align: 'right', render: (v) => (v ? formatCOP(v) : '—') },
        { key: 'salida', label: 'Salida', align: 'right', render: (v) => (v ? formatCOP(v) : '—') },
        { key: 'saldo', label: 'Saldo', align: 'right', render: formatCOP },
      ];
      const totalEntradas = r.movimientos.reduce((s, m) => s + m.entrada, 0);
      const totalSalidas = r.movimientos.reduce((s, m) => s + m.salida, 0);
      setResultado({ columnas, filas: r.movimientos, totales: { concepto: `Saldo anterior: ${formatCOP(r.saldo_anterior)}`, entrada: totalEntradas, salida: totalSalidas, saldo: r.saldo_final } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [cuentaId, desde, hasta]);

  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const filtrosTexto = cuenta ? `${cuenta.nombre} · Del ${formatFecha(desde)} al ${formatFecha(hasta)}` : '';

  return (
    <ReporteBase
      titulo={`Movimiento Diario de ${tipo === 'banco' ? 'Bancos' : 'Caja'}`}
      descripcion={`Entradas, salidas y saldo día a día de la cuenta seleccionada (consulta ${tipo === 'banco' ? 'Bancos' : 'Caja'}, no duplica información).`}
      filtrosTexto={filtrosTexto}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Cuenta</Label>
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
