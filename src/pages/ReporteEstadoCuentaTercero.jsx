import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin } from '@/api/finanzas';
import { Tercero } from '@/entities/all';
import { formatCOP, formatFecha, mensajeError, ESTADO_OBLIGACION } from '../components/finanzas/utils';

// "Estado de cuenta por cliente/proveedor" (requerimiento 6.13): historial completo de
// obligaciones de un tercero, con su saldo actual — misma consulta de Cuentas por Cobrar/Pagar
// del motor, filtrada por tercero y sin excluir las ya pagadas (para ver el historial).
export default function ReporteEstadoCuentaTercero() {
  const [params] = useSearchParams();
  const naturaleza = params.get('naturaleza') === 'por_pagar' ? 'por_pagar' : 'por_cobrar';
  const [terceros, setTerceros] = useState([]);
  const [terceroId, setTerceroId] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Tercero.list().then((lista) => {
      const filtrados = lista.filter((t) => (naturaleza === 'por_cobrar' ? t.es_cliente : t.es_proveedor));
      setTerceros(filtrados); setTerceroId(filtrados[0]?.id || '');
    }).catch((e) => setError(mensajeError(e)));
  }, [naturaleza]);

  const consultar = useCallback(async () => {
    if (!terceroId) { setError(`No hay ${naturaleza === 'por_cobrar' ? 'clientes' : 'proveedores'} registrados`); return; }
    setCargando(true); setError('');
    try {
      const obligaciones = await fin.get('/obligaciones', { naturaleza, tercero_id: terceroId, incluir_anuladas: '1' });
      const columnas = [
        { key: 'documento_numero', label: 'Documento' },
        { key: 'fecha', label: 'Fecha', render: formatFecha },
        { key: 'concepto', label: 'Concepto', ancho: 2 },
        { key: 'valor_original', label: 'Valor original', align: 'right', render: formatCOP },
        { key: 'saldo', label: 'Saldo', align: 'right', render: formatCOP },
        { key: 'estado', label: 'Estado', render: (v) => ESTADO_OBLIGACION[v]?.label || v },
      ];
      const ordenadas = [...obligaciones].sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
      const pendientes = ordenadas.filter((o) => !['pagada', 'anulada'].includes(o.estado));
      setResultado({ columnas, filas: ordenadas, totales: {
        valor_original: ordenadas.filter((o) => !o.anulada).reduce((s, o) => s + o.valor_original, 0),
        saldo: pendientes.reduce((s, o) => s + o.saldo, 0),
      } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [naturaleza, terceroId]);

  const tercero = terceros.find((t) => t.id === terceroId);

  return (
    <ReporteBase
      titulo={`Estado de Cuenta · ${naturaleza === 'por_cobrar' ? 'Cliente' : 'Proveedor'}`}
      descripcion="Historial completo de documentos y saldo actual de un tercero, sobre las Cuentas por Cobrar/Pagar del motor."
      filtrosTexto={tercero ? tercero.nombre : ''}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>{naturaleza === 'por_cobrar' ? 'Cliente' : 'Proveedor'}</Label>
          <Select value={terceroId} onValueChange={setTerceroId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
            <SelectContent>{terceros.map((t) => <SelectItem key={t.id} value={t.id}>{t.nombre}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </>}
    />
  );
}
