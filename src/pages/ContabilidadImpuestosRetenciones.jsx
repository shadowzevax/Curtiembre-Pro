import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError } from '../components/finanzas/utils';

const ROLES = [{ value: '__todos', label: 'Todas' }, { value: 'practicada', label: 'Practicada (a un tercero)' }, { value: 'recibida', label: 'Recibida (nos la practicaron)' }];
const TIPOS = [{ value: '__todos', label: 'Todos' }, { value: 'retefuente', label: 'Retefuente' }, { value: 'reteiva', label: 'ReteIVA' }, { value: 'reteica', label: 'ReteICA' }, { value: 'otra', label: 'Otra' }];

// Impuestos y Retenciones (control contable, requerimiento 5): no duplica Compras/Ventas —
// consulta las retenciones que ya practica o recibe el motor en cobros y pagos.
export default function ContabilidadImpuestosRetenciones() {
  const [rol, setRol] = useState('__todos');
  const [tipo, setTipo] = useState('__todos');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const retenciones = await fin.get('/retenciones', {
        rol: rol === '__todos' ? undefined : rol, tipo: tipo === '__todos' ? undefined : tipo, desde, hasta,
      });
      const columnas = [
        { key: 'fecha', label: 'Fecha', render: formatFecha },
        { key: 'tipo', label: 'Tipo' },
        { key: 'rol', label: 'Rol', render: (v) => (v === 'practicada' ? 'Practicada' : 'Recibida') },
        { key: 'tercero_nombre', label: 'Tercero', ancho: 2 },
        { key: 'base', label: 'Base', align: 'right', render: (v) => (v != null ? formatCOP(v) : '—') },
        { key: 'valor', label: 'Valor', align: 'right', render: formatCOP },
        { key: 'anulada', label: 'Estado', render: (v) => (v ? 'Anulada' : 'Vigente') },
      ];
      const vigentes = retenciones.filter((r) => !r.anulada);
      setResultado({ columnas, filas: retenciones, totales: { valor: vigentes.reduce((s, r) => s + r.valor, 0) } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [rol, tipo, desde, hasta]);

  return (
    <ReporteBase
      titulo="Impuestos y Retenciones"
      descripcion="Control de las retenciones que ya practica o recibe el motor en cobros y pagos (no duplica lo que existe en Compras y Ventas)."
      filtrosTexto={`Rol: ${ROLES.find((r) => r.value === rol)?.label} · Tipo: ${TIPOS.find((t) => t.value === tipo)?.label}`}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Rol</Label>
          <Select value={rol} onValueChange={setRol}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Desde</Label><Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><Label>Hasta</Label><Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
      </>}
    />
  );
}
