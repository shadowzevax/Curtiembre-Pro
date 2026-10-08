import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, FileDown, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { exportarPDF, exportarExcel, imprimirRelacion } from '@/lib/reportes/exportar';

// Excel / Imprimir / PDF de la relación que se ve en pantalla. Recibe exactamente las filas ya
// filtradas y el texto de los filtros, así las tres salidas coinciden con lo que muestra la tabla.
// Solo consulta: no crea ni modifica registros.
export default function BarraExportar({ titulo, filtrosTexto, columnas, filas, totales, className = '' }) {
  const { user } = useAuth();
  const datos = () => ({ titulo, filtrosTexto, columnas, filas: filas || [], totales, usuario: user?.full_name || user?.email });
  const deshabilitado = !columnas?.length;
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <Button size="sm" variant="outline" disabled={deshabilitado} onClick={() => exportarExcel(datos())}><FileSpreadsheet className="w-4 h-4 mr-1 text-emerald-700" />Exportar a Excel</Button>
      <Button size="sm" variant="outline" disabled={deshabilitado} onClick={() => imprimirRelacion(datos())}><Printer className="w-4 h-4 mr-1" />Imprimir</Button>
      <Button size="sm" variant="outline" disabled={deshabilitado} onClick={() => exportarPDF(datos())}><FileDown className="w-4 h-4 mr-1 text-red-700" />Descargar PDF</Button>
    </div>
  );
}

// Arma el texto de filtros: solo los que tienen valor ("Desde: …", "Cliente: …").
export const textoFiltros = (pares) => pares.filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'Sin filtros (toda la información)';
