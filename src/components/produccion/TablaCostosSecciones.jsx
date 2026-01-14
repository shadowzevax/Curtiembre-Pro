import React from 'react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatNumber = (num) => parseFloat(num || 0).toFixed(2);

export function SeccionProductosQuimicos({ titulo, items, peso }) {
  const calcularSubtotal = () => {
    return items.reduce((sum, item) => {
      if (item.insumos_utilizados && Array.isArray(item.insumos_utilizados)) {
        return sum + item.insumos_utilizados.reduce((s, ins) => s + (ins.valor_total || 0), 0);
      }
      return sum;
    }, 0);
  };

  const todosInsumos = items.flatMap(item => item.insumos_utilizados || []);
  const subtotal = calcularSubtotal();

  if (todosInsumos.length === 0) return null;

  return (
    <div className="border rounded">
      <div className="bg-gray-700 text-white px-3 py-2 font-bold text-center">{titulo}</div>
      <table className="w-full text-xs">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-1 text-left">CÓDIGO</th>
            <th className="border p-1 text-left">PRODUCTO</th>
            <th className="border p-1 text-right">CANT(KG)</th>
            <th className="border p-1 text-right">COSTO UNIT($/KG)</th>
            <th className="border p-1 text-right">IVA</th>
            <th className="border p-1 text-right">COSTO + IVA</th>
            <th className="border p-1 text-right">VALOR TOTAL</th>
            <th className="border p-1 text-right">% DOSIFICACIÓN</th>
          </tr>
        </thead>
        <tbody>
          {todosInsumos.map((insumo, idx) => {
            const costoConIva = (insumo.precio_unitario || 0) * (1 + (insumo.iva || 0));
            const dosificacion = peso > 0 ? ((insumo.cantidad || 0) / peso) * 100 : 0;
            
            return (
              <tr key={idx}>
                <td className="border p-1">{insumo.codigo}</td>
                <td className="border p-1">{insumo.producto}</td>
                <td className="border p-1 text-right">{formatNumber(insumo.cantidad)}</td>
                <td className="border p-1 text-right">{formatCurrency(insumo.precio_unitario)}</td>
                <td className="border p-1 text-right">{formatCurrency((insumo.precio_unitario || 0) * (insumo.iva || 0))}</td>
                <td className="border p-1 text-right">{formatCurrency(costoConIva)}</td>
                <td className="border p-1 text-right font-semibold">{formatCurrency(insumo.valor_total)}</td>
                <td className="border p-1 text-right">{formatNumber(dosificacion)}</td>
              </tr>
            );
          })}
          <tr className="bg-yellow-200 font-bold">
            <td colSpan="6" className="border p-2 text-right">SUBTOTAL {titulo.toUpperCase()}</td>
            <td className="border p-2 text-right">{formatCurrency(subtotal)}</td>
            <td className="border p-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function SeccionRecurtidoPorColor({ color, items, peso }) {
  const calcularSubtotal = () => {
    return items.reduce((sum, item) => {
      if (item.insumos_utilizados && Array.isArray(item.insumos_utilizados)) {
        return sum + item.insumos_utilizados.reduce((s, ins) => s + (ins.valor_total || 0), 0);
      }
      return sum;
    }, 0);
  };

  const todosInsumos = items.flatMap(item => item.insumos_utilizados || []);
  const subtotal = calcularSubtotal();

  return (
    <div className="border rounded mt-2">
      <div className="bg-purple-700 text-white px-3 py-2 font-bold">RECURTIDO - COLOR {color}</div>
      <table className="w-full text-xs">
        <thead className="bg-gray-200">
          <tr>
            <th className="border p-1 text-left">CÓDIGO</th>
            <th className="border p-1 text-left">PRODUCTO</th>
            <th className="border p-1 text-right">CANT(KG)</th>
            <th className="border p-1 text-right">COSTO UNIT($/KG)</th>
            <th className="border p-1 text-right">IVA</th>
            <th className="border p-1 text-right">COSTO + IVA</th>
            <th className="border p-1 text-right">VALOR TOTAL</th>
            <th className="border p-1 text-right">% DOSIFICACIÓN</th>
          </tr>
        </thead>
        <tbody>
          {todosInsumos.map((insumo, idx) => {
            const costoConIva = (insumo.precio_unitario || 0) * (1 + (insumo.iva || 0));
            const dosificacion = peso > 0 ? ((insumo.cantidad || 0) / peso) * 100 : 0;
            
            return (
              <tr key={idx}>
                <td className="border p-1">{insumo.codigo}</td>
                <td className="border p-1">{insumo.producto}</td>
                <td className="border p-1 text-right">{formatNumber(insumo.cantidad)}</td>
                <td className="border p-1 text-right">{formatCurrency(insumo.precio_unitario)}</td>
                <td className="border p-1 text-right">{formatCurrency((insumo.precio_unitario || 0) * (insumo.iva || 0))}</td>
                <td className="border p-1 text-right">{formatCurrency(costoConIva)}</td>
                <td className="border p-1 text-right font-semibold">{formatCurrency(insumo.valor_total)}</td>
                <td className="border p-1 text-right">{formatNumber(dosificacion)}</td>
              </tr>
            );
          })}
          <tr className="bg-yellow-200 font-bold">
            <td colSpan="6" className="border p-2 text-right">SUBTOTAL RECURTIDO COLOR {color}</td>
            <td className="border p-2 text-right">{formatCurrency(subtotal)}</td>
            <td className="border p-2"></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}