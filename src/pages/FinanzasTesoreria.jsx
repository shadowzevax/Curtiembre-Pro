import React, { useEffect, useState, useCallback } from 'react';
import PageHeader from '../components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError } from '../components/finanzas/utils';
import { IngresoEgresoDialog, TransferenciaDialog } from '../components/finanzas/MovimientoDialogs';
import IntegracionesPanel from '../components/finanzas/IntegracionesPanel';

// Tesorería: centro de control de la posición financiera. No duplica movimientos: solo
// consulta y consolida lo que ya generan Caja, Bancos, Otros medios, CxC y CxP.
export default function FinanzasTesoreria() {
  const [cuentas, setCuentas] = useState([]);
  const [cxc, setCxc] = useState([]);
  const [cxp, setCxp] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [dialogo, setDialogo] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [ctas, obligacionesCxc, obligacionesCxp] = await Promise.all([
        fin.get('/cuentas'), fin.get('/obligaciones', { naturaleza: 'por_cobrar' }), fin.get('/obligaciones', { naturaleza: 'por_pagar' }),
      ]);
      setCuentas(ctas); setCxc(obligacionesCxc); setCxp(obligacionesCxp);
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const porTipo = (tipo) => cuentas.filter((c) => c.tipo === tipo).reduce((s, c) => s + c.saldo, 0);
  const disponibleTotal = cuentas.reduce((s, c) => s + c.saldo, 0);
  const pendientesCxc = cxc.filter((o) => !['pagada', 'anulada'].includes(o.estado));
  const pendientesCxp = cxp.filter((o) => !['pagada', 'anulada'].includes(o.estado));
  const totalCxc = pendientesCxc.reduce((s, o) => s + o.saldo, 0);
  const totalCxp = pendientesCxp.reduce((s, o) => s + o.saldo, 0);
  const en7dias = new Date(); en7dias.setDate(en7dias.getDate() + 7);
  const proximos = [...pendientesCxc.map((o) => ({ ...o, tipo: 'Cobro' })), ...pendientesCxp.map((o) => ({ ...o, tipo: 'Pago' }))]
    .filter((o) => o.fecha_vencimiento && o.fecha_vencimiento <= en7dias.toISOString().slice(0, 10))
    .sort((a, b) => (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || ''));

  return (
    <div className="p-6">
      <PageHeader title="Tesorería" description="Dinero disponible, por cobrar, por pagar y próximos movimientos" />
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">{error}</p>}
      {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            <div className="border rounded-lg p-4 bg-emerald-50"><p className="text-xs text-emerald-700">Disponible total</p><p className="text-2xl font-bold text-emerald-800">{formatCOP(disponibleTotal)}</p>
              <p className="text-xs text-slate-500 mt-1">Caja {formatCOP(porTipo('caja'))} · Bancos {formatCOP(porTipo('banco'))} · Otros {formatCOP(porTipo('otro_medio'))}</p></div>
            <div className="border rounded-lg p-4 bg-blue-50"><p className="text-xs text-blue-700">Por cobrar</p><p className="text-2xl font-bold text-blue-800">{formatCOP(totalCxc)}</p>
              <p className="text-xs text-slate-500 mt-1">{pendientesCxc.length} documentos</p></div>
            <div className="border rounded-lg p-4 bg-amber-50"><p className="text-xs text-amber-700">Por pagar</p><p className="text-2xl font-bold text-amber-800">{formatCOP(totalCxp)}</p>
              <p className="text-xs text-slate-500 mt-1">{pendientesCxp.length} documentos</p></div>
            <div className="border rounded-lg p-4 bg-slate-50"><p className="text-xs text-slate-600">Posición neta</p><p className={`text-2xl font-bold ${disponibleTotal + totalCxc - totalCxp >= 0 ? 'text-slate-800' : 'text-red-700'}`}>{formatCOP(disponibleTotal + totalCxc - totalCxp)}</p>
              <p className="text-xs text-slate-500 mt-1">Disponible + por cobrar − por pagar</p></div>
          </div>

          <div className="flex gap-2 mb-4">
            <Button size="sm" onClick={() => setDialogo('ingreso')}>+ Ingreso</Button>
            <Button size="sm" variant="outline" onClick={() => setDialogo('egreso')}>− Egreso</Button>
            <Button size="sm" variant="outline" onClick={() => setDialogo('transferencia')}>Transferencia entre cuentas</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 p-2 font-semibold text-sm">Cuentas de dinero</div>
              <table className="w-full text-sm">
                <tbody>
                  {cuentas.map((c) => (
                    <tr key={c.id} className="border-t"><td className="p-2">{c.nombre}</td><td className="p-2 text-xs text-slate-400 capitalize">{c.tipo.replace('_', ' ')}</td><td className="p-2 text-right font-semibold">{formatCOP(c.saldo)}</td></tr>
                  ))}
                  {cuentas.length === 0 && <tr><td className="p-3 text-center text-slate-400">Sin cuentas configuradas.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 p-2 font-semibold text-sm">Próximos 7 días (cobros y pagos)</div>
              <table className="w-full text-xs">
                <tbody>
                  {proximos.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="p-2">{formatFecha(o.fecha_vencimiento)}</td>
                      <td className="p-2"><span className={o.tipo === 'Cobro' ? 'text-blue-700' : 'text-amber-700'}>{o.tipo}</span></td>
                      <td className="p-2">{o.tercero_nombre}</td>
                      <td className="p-2 text-right font-semibold">{formatCOP(o.saldo)}</td>
                    </tr>
                  ))}
                  {proximos.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-slate-400">Nada programado en los próximos 7 días.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
          <IntegracionesPanel cuentas={cuentas} />
        </>
      )}
      <IngresoEgresoDialog open={dialogo === 'ingreso'} onClose={() => setDialogo(null)} tipo="ingreso" cuentas={cuentas} onGuardado={cargar} />
      <IngresoEgresoDialog open={dialogo === 'egreso'} onClose={() => setDialogo(null)} tipo="egreso" cuentas={cuentas} onGuardado={cargar} />
      <TransferenciaDialog open={dialogo === 'transferencia'} onClose={() => setDialogo(null)} cuentas={cuentas} onGuardado={cargar} />
    </div>
  );
}
