import React, { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

const TIPOS = {
  RC: 'Recibos de Caja (cobros)',
  CE: 'Comprobantes de Egreso (pagos)',
  CIN: 'Comprobantes de Ingreso',
  TR: 'Transferencias entre cuentas',
  AJ: 'Ajustes de caja (arqueos y diferencias)',
  CR: 'Cruces de anticipo',
  DV: 'Devoluciones',
  NC: 'Notas Crédito',
  ND: 'Notas Débito',
};

// Un solo reporte parametrizado por tipo de documento cubre "Cobros por período",
// "Pagos por período", "Transferencias", "Arqueo y diferencias de caja" y "Notas"
// (requerimiento 6.13): todos son la misma consulta genérica de documentos del motor.
export default function ReporteDocumentosPorTipo() {
  const [params] = useSearchParams();
  const tipoInicial = TIPOS[params.get('tipo')] ? params.get('tipo') : 'RC';
  const [tipo, setTipo] = useState(tipoInicial);
  const [desde, setDesde] = useState(hoy().slice(0, 8) + '01');
  const [hasta, setHasta] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => { setTipo(tipoInicial); }, [tipoInicial]);

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const documentos = await fin.get('/documentos', { tipo, desde, hasta });
      const columnas = [
        { key: 'numero', label: 'Documento' },
        { key: 'fecha', label: 'Fecha', render: formatFecha },
        { key: 'tercero_nombre', label: 'Tercero', ancho: 2, render: (v) => v || '—' },
        { key: 'concepto', label: 'Concepto', ancho: 3 },
        { key: 'valor', label: 'Valor', align: 'right', render: formatCOP },
        { key: 'estado', label: 'Estado', render: (v) => (v === 'anulado' ? 'Anulado' : 'Emitido') },
      ];
      setResultado({ columnas, filas: documentos, totales: { valor: documentos.filter((d) => d.estado !== 'anulado').reduce((s, d) => s + d.valor, 0) } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [tipo, desde, hasta]);

  return (
    <ReporteBase
      titulo={TIPOS[tipo]}
      descripcion="Consulta directa de los documentos que ya genera el motor financiero, sin duplicar información."
      filtrosTexto={`Del ${formatFecha(desde)} al ${formatFecha(hasta)}`}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Tipo de documento</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(TIPOS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
      </>}
    />
  );
}
