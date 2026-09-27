import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { fin } from '@/api/finanzas';
import { formatCOP, mensajeError } from '../components/finanzas/utils';

// "Rentabilidad por cliente" (requerimiento 6.19/C2): indicadores comerciales confiables
// (facturado, cobrado, cartera, vencido, ticket promedio) sobre Cuentas por Cobrar.
// No se muestra un margen de utilidad: hoy no existe un vínculo confiable entre el costo del
// lote y el costo por unidad del producto vendido (ver ARQUITECTURA-FINANZAS.md 14.7/14.8);
// mostrar un margen inventado sería peor que no mostrarlo.
export default function ReporteRentabilidadClientes() {
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const clientes = await fin.get('/gerencial/rentabilidad-clientes');
      const columnas = [
        { key: 'tercero_nombre', label: 'Cliente', ancho: 2 },
        { key: 'documentos', label: 'Documentos', align: 'right' },
        { key: 'facturado', label: 'Facturado', align: 'right', render: formatCOP },
        { key: 'cobrado', label: 'Cobrado', align: 'right', render: formatCOP },
        { key: 'pendiente', label: 'Cartera pendiente', align: 'right', render: formatCOP },
        { key: 'vencido', label: 'Cartera vencida', align: 'right', render: formatCOP },
        { key: 'ticket_promedio', label: 'Ticket promedio', align: 'right', render: formatCOP },
      ];
      setResultado({ columnas, filas: clientes.map((c) => ({ ...c, id: c.tercero_id })), totales: {
        facturado: clientes.reduce((s, c) => s + c.facturado, 0), cobrado: clientes.reduce((s, c) => s + c.cobrado, 0),
        pendiente: clientes.reduce((s, c) => s + c.pendiente, 0), vencido: clientes.reduce((s, c) => s + c.vencido, 0),
      } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, []);

  return (
    <ReporteBase
      titulo="Rentabilidad de Clientes"
      descripcion="Facturado, cobrado y cartera por cliente (histórico completo). No incluye margen de utilidad: falta el vínculo confiable entre costo de producción y costo de venta — ver nota en Arquitectura."
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={error ? <p className="text-xs text-red-600 w-full">{error}</p> : null}
    />
  );
}
