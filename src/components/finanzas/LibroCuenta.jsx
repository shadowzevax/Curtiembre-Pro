import React, { useEffect, useState, useCallback } from 'react';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError } from './utils';

// Libro tipo "Fecha · Documento · Concepto · Entrada · Salida · Saldo" de una cuenta de dinero.
export default function LibroCuenta({ cuentaId, recargarSenal }) {
  const [libro, setLibro] = useState(null);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    if (!cuentaId) return;
    setCargando(true); setError('');
    try { setLibro(await fin.get(`/cuentas/${cuentaId}/libro`, { desde: desde || undefined, hasta: hasta || undefined })); }
    catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, [cuentaId, desde, hasta]);

  useEffect(() => { cargar(); }, [cargar, recargarSenal]);

  if (!cuentaId) return <p className="text-sm text-slate-400 p-4">Seleccione una cuenta para ver su libro.</p>;

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-3 text-sm">
        <div><label className="block text-xs text-slate-500 mb-1">Desde</label><input type="date" className="border rounded px-2 py-1.5 text-sm" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><label className="block text-xs text-slate-500 mb-1">Hasta</label><input type="date" className="border rounded px-2 py-1.5 text-sm" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        {(desde || hasta) && <button type="button" className="text-xs text-blue-600 underline" onClick={() => { setDesde(''); setHasta(''); }}>Limpiar filtro</button>}
      </div>
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      {cargando && !libro ? <p className="text-sm text-slate-400">Cargando…</p> : libro && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs text-slate-500">Saldo anterior</p><p className="text-lg font-bold">{formatCOP(libro.saldo_anterior)}</p></div>
            <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs text-slate-500">Movimientos</p><p className="text-lg font-bold">{libro.movimientos.length}</p></div>
            <div className="border rounded-lg p-3 bg-emerald-50"><p className="text-xs text-slate-600">Saldo final</p><p className="text-lg font-bold text-emerald-700">{formatCOP(libro.saldo_final)}</p></div>
          </div>
          <div className="border rounded-lg overflow-x-auto max-h-[26rem] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-800 text-white sticky top-0">
                <tr><th className="p-2 text-left">Fecha</th><th className="p-2 text-left">Documento</th><th className="p-2 text-left">Concepto</th>
                  <th className="p-2 text-right">Entrada</th><th className="p-2 text-right">Salida</th><th className="p-2 text-right">Saldo</th>
                  <th className="p-2 text-center">Estado</th></tr>
              </thead>
              <tbody>
                {libro.movimientos.map((m) => (
                  <tr key={m.id} className={`border-t ${m.estado === 'anulado' ? 'opacity-40 line-through' : ''}`}>
                    <td className="p-1.5">{formatFecha(m.fecha)}</td>
                    <td className="p-1.5 font-mono">{m.documento_numero || '—'}</td>
                    <td className="p-1.5">{m.concepto}{m.tercero_nombre ? ` · ${m.tercero_nombre}` : ''}</td>
                    <td className="p-1.5 text-right text-emerald-700">{m.entrada ? formatCOP(m.entrada) : ''}</td>
                    <td className="p-1.5 text-right text-red-700">{m.salida ? formatCOP(m.salida) : ''}</td>
                    <td className="p-1.5 text-right font-semibold">{formatCOP(m.saldo)}</td>
                    <td className="p-1.5 text-center">{m.conciliado ? '✔️' : ''}{m.estado === 'anulado' ? '❌' : ''}{m.estado === 'reversa' ? '↩️' : ''}</td>
                  </tr>
                ))}
                {libro.movimientos.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">Sin movimientos en el período.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
