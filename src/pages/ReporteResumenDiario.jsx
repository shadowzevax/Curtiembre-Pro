import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { OrdenVenta, OrdenCompra } from '@/entities/all';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError, hoy } from '../components/finanzas/utils';

async function sumaLibro(tipo, fecha) {
  const cuentas = await fin.get('/cuentas', { tipo });
  const libros = await Promise.all(cuentas.map((c) => fin.get(`/cuentas/${c.id}/libro`, { desde: fecha, hasta: fecha })));
  return libros.reduce((acc, l) => ({
    entradas: acc.entradas + l.movimientos.reduce((s, m) => s + m.entrada, 0),
    salidas: acc.salidas + l.movimientos.reduce((s, m) => s + m.salida, 0),
  }), { entradas: 0, salidas: 0 });
}

// "Resumen diario" (requerimiento 6.19): un vistazo del día completo, sumando lo que ya
// generan Ventas, Compras, Caja, Bancos y los documentos de cobro/pago del motor. No es una
// tabla más de datos: es la vitrina de "Indicadores y Resumen Gerencial" sobre el mismo motor.
export default function ReporteResumenDiario() {
  const [fecha, setFecha] = useState(hoy());
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [ventas, compras, caja, bancos, cobros, pagos] = await Promise.all([
        OrdenVenta.list(), OrdenCompra.list(), sumaLibro('caja', fecha), sumaLibro('banco', fecha),
        fin.get('/documentos', { tipo: 'RC', desde: fecha, hasta: fecha }),
        fin.get('/documentos', { tipo: 'CE', desde: fecha, hasta: fecha }),
      ]);
      const ventasDia = ventas.filter((o) => o.fecha_orden === fecha && !(o.anulado || o.estado_documento === 'anulado'));
      const comprasDia = compras.filter((o) => (o.fecha_emision_documento || o.fecha_orden) === fecha && !(o.anulado || o.estado_documento === 'anulado'));

      const columnas = [
        { key: 'indicador', label: 'Indicador', ancho: 3 },
        { key: 'cantidad', label: 'Cantidad', align: 'right' },
        { key: 'valor', label: 'Valor', align: 'right', render: (v) => (v == null ? '—' : formatCOP(v)) },
      ];
      const filas = [
        { id: 1, indicador: 'Ventas del día', cantidad: ventasDia.length, valor: ventasDia.reduce((s, o) => s + (o.total || 0), 0) },
        { id: 2, indicador: 'Compras del día', cantidad: comprasDia.length, valor: comprasDia.reduce((s, o) => s + (o.total || 0), 0) },
        { id: 3, indicador: 'Entradas de caja', cantidad: null, valor: caja.entradas },
        { id: 4, indicador: 'Salidas de caja', cantidad: null, valor: caja.salidas },
        { id: 5, indicador: 'Entradas bancarias', cantidad: null, valor: bancos.entradas },
        { id: 6, indicador: 'Salidas bancarias', cantidad: null, valor: bancos.salidas },
        { id: 7, indicador: 'Cobros del día (Recibos de Caja)', cantidad: cobros.length, valor: cobros.reduce((s, d) => s + d.valor, 0) },
        { id: 8, indicador: 'Pagos del día (Comprobantes de Egreso)', cantidad: pagos.length, valor: pagos.reduce((s, d) => s + d.valor, 0) },
      ];
      setResultado({ columnas, filas });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [fecha]);

  return (
    <ReporteBase
      titulo="Resumen Diario"
      descripcion="Ventas, compras, caja, bancos, cobros y pagos de un día, tomados directamente de cada módulo (sin duplicar información)."
      filtrosTexto={`Fecha: ${formatFecha(fecha)}`}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Fecha</Label><Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
      </>}
    />
  );
}
