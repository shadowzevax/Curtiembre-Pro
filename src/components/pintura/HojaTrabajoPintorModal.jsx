import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, FileDown, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { construirHojaTrabajo, avisoDiferencia, exportarHojaExcel, exportarHojaPDF, imprimirHojaTrabajo, EMPRESA_PINTURA, TITULO_HOJA } from './hojaTrabajoPintor';

// Vista previa de la hoja de trabajo para el pintor con Excel / PDF / Imprimir.
// Solo consulta: no modifica la orden, sus solicitudes, estados ni cantidades.
export default function HojaTrabajoPintorModal({ orden, solicitudes, onClose }) {
  const hoja = useMemo(() => construirHojaTrabajo(orden, solicitudes), [orden, solicitudes]);
  const [generando, setGenerando] = useState('');
  const aviso = avisoDiferencia(hoja);

  // Si la matriz no cuadra con el total de la orden se advierte antes de generar; el documento
  // sale marcado "NO VALIDADA".
  const generar = async (tipo) => {
    if (aviso && !window.confirm(`${aviso}\n\nEl documento saldrá marcado como NO VALIDADO. ¿Generarlo de todas formas?`)) return;
    setGenerando(tipo);
    try {
      if (tipo === 'excel') await exportarHojaExcel(orden, hoja);
      else if (tipo === 'pdf') await exportarHojaPDF(orden, hoja);
      else imprimirHojaTrabajo(orden, hoja);
    } catch (e) { alert(`No se pudo generar el documento: ${e.message}`); } finally { setGenerando(''); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Hoja de trabajo para el pintor — {orden.numero_orden}</DialogTitle></DialogHeader>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" disabled={!!generando} onClick={() => generar('excel')}><FileSpreadsheet className="w-4 h-4 mr-1 text-emerald-700" />{generando === 'excel' ? 'Generando…' : 'Descargar Excel (.xlsx)'}</Button>
          <Button variant="outline" size="sm" disabled={!!generando} onClick={() => generar('pdf')}><FileDown className="w-4 h-4 mr-1 text-red-700" />{generando === 'pdf' ? 'Generando…' : 'Descargar PDF'}</Button>
          <Button size="sm" disabled={!!generando} onClick={() => generar('print')} className="bg-slate-800 hover:bg-slate-900"><Printer className="w-4 h-4 mr-1" />Imprimir</Button>
        </div>

        {aviso && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-300 text-red-700 rounded p-3 text-sm font-medium">
            <AlertTriangle className="w-5 h-5 shrink-0" />{aviso} Revise las solicitudes vinculadas antes de entregar la hoja.
          </div>
        )}

        <div className="border rounded-lg p-4 space-y-4 text-sm bg-white">
          <div className="flex items-center gap-3 border-b-2 border-[#4a2c2a] pb-2">
            <img src="/artecueros-logo.png" alt="" className="h-14" />
            <div><div className="text-lg font-bold">{EMPRESA_PINTURA}</div><div className="font-bold text-[#4a2c2a]">{TITULO_HOJA}</div></div>
            <div className="ml-auto font-mono font-bold border-2 border-[#4a2c2a] rounded px-3 py-1">{orden.numero_orden}</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs">
            {hoja.encabezado.map(([k, v]) => <div key={k}><span className="font-semibold">{k}:</span> {v}</div>)}
          </div>

          {hoja.bloques.length === 0 && <p className="text-slate-400">Esta orden no tiene solicitudes vinculadas con líneas de color y placa.</p>}
          {hoja.bloques.map((b) => (
            <div key={b.key}>
              <h3 className="font-bold mb-1">Tipo de acabado: {b.acabado}{b.codigoAcabado ? ` (${b.codigoAcabado})` : ''} · Calibre: {b.calibre || '—'}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead><tr className="bg-[#4a2c2a] text-white">
                    <th className="border border-slate-500 p-2 text-left">COLOR</th>
                    {b.placas.map((p) => <th key={p.key} className="border border-slate-500 p-2" title={p.codigo ? `Código ${p.codigo}` : ''}>{p.label}</th>)}
                    <th className="border border-slate-500 p-2">TOTAL COLOR</th>
                  </tr></thead>
                  <tbody>
                    {b.colores.map((c) => (
                      <tr key={c.key}>
                        <td className="border border-slate-400 p-2 font-semibold">{c.label}</td>
                        {b.placas.map((p) => <td key={p.key} className="border border-slate-400 p-2 text-center">{b.celdas[c.key]?.[p.key] || 0}</td>)}
                        <td className="border border-slate-400 p-2 text-center font-bold bg-slate-100">{b.totColor[c.key]}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-bold">
                      <td className="border border-slate-400 p-2">TOTAL PLACA</td>
                      {b.placas.map((p) => <td key={p.key} className="border border-slate-400 p-2 text-center">{b.totPlaca[p.key]}</td>)}
                      <td className="border border-slate-400 p-2 text-center">{b.total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <p className="font-bold text-base">TOTAL GENERAL DE HOJAS: {hoja.totalMatriz} {hoja.cuadra && <span className="text-emerald-700 text-xs font-medium">✔ coincide con el total de la orden</span>}</p>

          <div>
            <h4 className="font-semibold text-xs mb-1">Solicitudes y clientes que conforman la orden</h4>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-slate-100"><th className="border p-1 text-left">Solicitud</th><th className="border p-1 text-left">Cliente</th><th className="border p-1">Compromiso</th><th className="border p-1">Hojas</th></tr></thead>
              <tbody>{hoja.solicitudes.map((s) => (
                <tr key={s.numero}><td className="border p-1 font-mono">{s.numero}</td><td className="border p-1">{s.cliente}</td>
                  <td className="border p-1 text-center">{s.compromiso ? String(s.compromiso).slice(0, 10).split('-').reverse().join('/') : '—'}</td><td className="border p-1 text-center">{s.hojas}</td></tr>
              ))}</tbody>
            </table>
          </div>
          {hoja.observaciones.length > 0 && (
            <div className="text-xs"><span className="font-semibold">Observaciones de las solicitudes:</span>
              <ul className="list-disc pl-4">{hoja.observaciones.map((o, i) => <li key={i}>{o}</li>)}</ul></div>
          )}
          <div className="text-xs border-t-2 border-slate-800 pt-3 space-y-3">
            <div className="font-semibold">Observaciones del pintor: ____________________________________________________________</div>
            <div className="grid grid-cols-2 gap-6"><div>Firma del responsable: ______________________</div><div>Fecha de ejecución: ______________</div></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
