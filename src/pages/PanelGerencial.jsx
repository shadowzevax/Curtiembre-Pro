import React, { useEffect, useState, useCallback } from 'react';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Send, RefreshCw } from 'lucide-react';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError } from '../components/finanzas/utils';

const SEVERIDAD_BADGE = { alta: 'bg-red-100 text-red-700 border-red-200', media: 'bg-amber-100 text-amber-700 border-amber-200' };

// Panel "Indicadores y Resumen Gerencial" (C2): un vistazo consolidado de la posición
// financiera, sus alertas y el flujo de caja que ya se sabe que viene, todo sobre datos
// que ya generan Finanzas y Tesorería (requerimiento 6.22, no se duplica información).
export default function PanelGerencial() {
  const [resumen, setResumen] = useState(null);
  const [flujo, setFlujo] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [mensajeEnvio, setMensajeEnvio] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [r, f] = await Promise.all([fin.get('/gerencial/resumen'), fin.get('/gerencial/flujo-caja', { semanas: 8 })]);
      setResumen(r); setFlujo(f);
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const enviarTelegram = async () => {
    if (!resumen) return;
    setEnviando(true); setMensajeEnvio('');
    try {
      const lineas = [`📊 <b>Resumen Gerencial · ${formatFecha(resumen.fecha)}</b>`, '',
        `💰 Disponible: ${formatCOP(resumen.disponible)}`,
        `📥 Por cobrar: ${formatCOP(resumen.cartera.total)} (vencido: ${formatCOP(resumen.cartera.vencida)})`,
        `📤 Por pagar: ${formatCOP(resumen.obligaciones.total)} (vencido: ${formatCOP(resumen.obligaciones.vencida)})`,
        `⚖️ Posición neta: ${formatCOP(resumen.posicion_neta)}`];
      if (resumen.alertas.length) { lineas.push('', '⚠️ <b>Alertas:</b>'); resumen.alertas.forEach((a) => lineas.push(`• ${a.mensaje}`)); }
      await fin.post('/gerencial/notificar', { texto: lineas.join('\n') });
      setMensajeEnvio('Enviado por Telegram.');
    } catch (e) { setMensajeEnvio(mensajeError(e)); } finally { setEnviando(false); }
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader title="Panel Gerencial" description="Posición financiera, alertas y flujo de caja proyectado, en un solo vistazo." />
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</p>}
      {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : resumen && (
        <>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" onClick={cargar}><RefreshCw className="w-4 h-4 mr-1" />Actualizar</Button>
            <Button size="sm" onClick={enviarTelegram} disabled={enviando}><Send className="w-4 h-4 mr-1" />{enviando ? 'Enviando…' : 'Enviar por Telegram'}</Button>
          </div>
          {mensajeEnvio && <p className="text-xs text-slate-500 text-right">{mensajeEnvio}</p>}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="border rounded-lg p-4 bg-emerald-50"><p className="text-xs text-emerald-700">Disponible</p><p className="text-2xl font-bold text-emerald-800">{formatCOP(resumen.disponible)}</p></div>
            <div className="border rounded-lg p-4 bg-blue-50"><p className="text-xs text-blue-700">Por cobrar</p><p className="text-2xl font-bold text-blue-800">{formatCOP(resumen.cartera.total)}</p><p className="text-xs text-slate-500 mt-1">Vencido: {formatCOP(resumen.cartera.vencida)}</p></div>
            <div className="border rounded-lg p-4 bg-amber-50"><p className="text-xs text-amber-700">Por pagar</p><p className="text-2xl font-bold text-amber-800">{formatCOP(resumen.obligaciones.total)}</p><p className="text-xs text-slate-500 mt-1">Vencido: {formatCOP(resumen.obligaciones.vencida)}</p></div>
            <div className="border rounded-lg p-4 bg-slate-50"><p className="text-xs text-slate-600">Posición neta</p><p className={`text-2xl font-bold ${resumen.posicion_neta >= 0 ? 'text-slate-800' : 'text-red-700'}`}>{formatCOP(resumen.posicion_neta)}</p></div>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Alertas</CardTitle></CardHeader>
            <CardContent>
              {resumen.alertas.length === 0 ? <p className="text-sm text-slate-400">Sin alertas por el momento.</p> : (
                <div className="space-y-2">
                  {resumen.alertas.map((a, i) => (
                    <div key={i} className={`text-sm border rounded-lg p-2 ${SEVERIDAD_BADGE[a.severidad]}`}>{a.mensaje}</div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {flujo && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Flujo de Caja Proyectado (compromisos ya registrados, por semana)</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-slate-500 border-b"><th className="p-2">Semana</th><th className="p-2 text-right">Entran</th><th className="p-2 text-right">Salen</th><th className="p-2 text-right">Saldo proyectado</th></tr></thead>
                  <tbody>
                    {flujo.semanas.map((s, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2">{formatFecha(s.desde)} — {formatFecha(s.hasta)}</td>
                        <td className="p-2 text-right text-emerald-700">{s.entran ? `+${formatCOP(s.entran)}` : '—'}</td>
                        <td className="p-2 text-right text-red-700">{s.salen ? `−${formatCOP(s.salen)}` : '—'}</td>
                        <td className={`p-2 text-right font-semibold ${s.saldo_proyectado < 0 ? 'text-red-700' : ''}`}>{formatCOP(s.saldo_proyectado)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(flujo.sin_fecha_vencimiento.cxc > 0 || flujo.sin_fecha_vencimiento.cxp > 0) && (
                  <p className="text-xs text-slate-400 mt-2">
                    {flujo.sin_fecha_vencimiento.cxc} cuenta(s) por cobrar y {flujo.sin_fecha_vencimiento.cxp} por pagar no tienen fecha de vencimiento y no aparecen en esta proyección.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
