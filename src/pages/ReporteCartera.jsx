import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError, ESTADO_OBLIGACION } from '../components/finanzas/utils';

const ESTADOS = [{ value: '__todos', label: 'Todos (pendientes)' }, ...Object.keys(ESTADO_OBLIGACION).filter((e) => e !== 'pagada').map((e) => ({ value: e, label: ESTADO_OBLIGACION[e].label }))];

// "Cartera Pendiente" y "Obligaciones Pendientes" (requerimiento 6.13) son la misma consulta
// de obligaciones del motor (`GET /fin/obligaciones`) parametrizada por naturaleza.
export default function ReporteCartera() {
  const [params] = useSearchParams();
  const naturaleza = params.get('naturaleza') === 'por_pagar' ? 'por_pagar' : 'por_cobrar';
  const [estado, setEstado] = useState('__todos');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const obligaciones = await fin.get('/obligaciones', { naturaleza });
      const filtradas = obligaciones.filter((o) => o.estado !== 'pagada' && o.estado !== 'anulada' && (estado === '__todos' || o.estado === estado));
      const columnas = [
        { key: 'documento_numero', label: 'Documento' },
        { key: 'fecha', label: 'Fecha', render: formatFecha },
        { key: 'tercero_nombre', label: naturaleza === 'por_cobrar' ? 'Cliente' : 'Proveedor', ancho: 2 },
        { key: 'fecha_vencimiento', label: 'Vence', render: formatFecha },
        { key: 'valor_original', label: 'Valor original', align: 'right', render: formatCOP },
        { key: 'saldo', label: 'Saldo', align: 'right', render: formatCOP },
        { key: 'estado', label: 'Estado', render: (v) => ESTADO_OBLIGACION[v]?.label || v },
      ];
      const totalSaldo = filtradas.reduce((s, o) => s + o.saldo, 0);
      setResultado({ columnas, filas: filtradas, totales: { valor_original: filtradas.reduce((s, o) => s + o.valor_original, 0), saldo: totalSaldo } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [naturaleza, estado]);

  return (
    <ReporteBase
      titulo={naturaleza === 'por_cobrar' ? 'Cartera Pendiente (Cuentas por Cobrar)' : 'Obligaciones Pendientes (Cuentas por Pagar)'}
      descripcion="Consulta directa de las obligaciones vivas del motor financiero, con su estado y saldo actual."
      filtrosTexto={`Estado: ${ESTADOS.find((e) => e.value === estado)?.label}`}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Estado</Label>
          <Select value={estado} onValueChange={setEstado}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{ESTADOS.map((e) => <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </>}
    />
  );
}
