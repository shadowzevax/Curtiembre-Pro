import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Search, Printer, FileDown, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { exportarPDF, exportarExcel } from '@/lib/reportes/exportar';

// Motor de reportes (B7): toda pantalla de reporte se arma con esta misma envoltura —
// filtros arriba, tabla en pantalla/impresión, y los mismos tres botones de salida
// (Imprimir, PDF, Excel) leyendo siempre {columnas, filas, totales} del reporte concreto.
// Un reporte nuevo solo aporta sus filtros y su función de consulta; nunca reimplementa esto.
export default function ReporteBase({ titulo, descripcion, filtros, onConsultar, cargando, resultado, filtrosTexto, vacioTexto }) {
  const { user } = useAuth();

  const imprimir = () => window.print();
  const pdf = () => resultado && exportarPDF({ titulo, filtrosTexto, columnas: resultado.columnas, filas: resultado.filas, totales: resultado.totales, usuario: user?.email });
  const excel = () => resultado && exportarExcel({ titulo, filtrosTexto, columnas: resultado.columnas, filas: resultado.filas, totales: resultado.totales });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <style>{`@media print {#reporte-imprimible { position: absolute; left: 0; top: 0; width: 100%; } .no-print { display: none !important; } body * { visibility: hidden; } #reporte-imprimible, #reporte-imprimible * { visibility: visible; }}`}</style>
      <div className="no-print">
        <h1 className="text-2xl font-bold text-slate-800">{titulo}</h1>
        {descripcion && <p className="text-sm text-slate-500 mt-1">{descripcion}</p>}
      </div>

      <Card className="no-print">
        <CardHeader><CardTitle className="text-sm">Filtros</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            {filtros}
            <Button size="sm" onClick={onConsultar} disabled={cargando}><Search className="w-4 h-4 mr-1" />{cargando ? 'Consultando…' : 'Consultar'}</Button>
            {resultado && (
              <>
                <Button size="sm" variant="outline" onClick={imprimir}><Printer className="w-4 h-4 mr-1" />Imprimir</Button>
                <Button size="sm" variant="outline" onClick={pdf}><FileDown className="w-4 h-4 mr-1" />PDF</Button>
                <Button size="sm" variant="outline" onClick={excel}><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div id="reporte-imprimible">
        <div className="hidden print:block mb-3">
          <p className="text-center font-bold">ArteCueros Mejía</p>
          <p className="text-center font-semibold">{titulo}</p>
          {filtrosTexto && <p className="text-center text-xs text-slate-500">{filtrosTexto}</p>}
          <p className="text-center text-xs text-slate-400">Generado: {new Date().toLocaleString('es-CO')} · Usuario: {user?.email || '—'}</p>
        </div>
        <Card>
          <CardContent className="pt-4">
            {!resultado ? (
              <p className="text-sm text-slate-400 text-center py-8">{vacioTexto || 'Aplique filtros y presione Consultar.'}</p>
            ) : resultado.filas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Sin resultados para los filtros aplicados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    {resultado.columnas.map((c) => <th key={c.key} className={`p-2 ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {resultado.filas.map((fila, i) => (
                    <tr key={fila.id ?? i} className="border-b last:border-0">
                      {resultado.columnas.map((c) => (
                        <td key={c.key} className={`p-2 ${c.align === 'right' ? 'text-right' : ''}`}>{c.render ? c.render(fila[c.key], fila) : (fila[c.key] ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {resultado.totales && (
                  <tfoot>
                    <tr className="border-t font-semibold bg-slate-50">
                      {resultado.columnas.map((c, i) => (
                        <td key={c.key} className={`p-2 ${c.align === 'right' ? 'text-right' : ''}`}>
                          {resultado.totales[c.key] !== undefined ? (c.render ? c.render(resultado.totales[c.key]) : resultado.totales[c.key]) : (i === 0 ? 'TOTAL' : '')}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
