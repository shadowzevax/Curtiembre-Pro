// Costo promedio ponderado: cálculo correcto y consistente para todos los
// inventarios (insumos, materias primas, productos terminados y en proceso).
//
// Regla: el costo promedio de una compra nueva SIEMPRE debe partir del stock
// y costo promedio VIGENTES, nunca de la suma histórica de todas las compras
// (esa suma queda inflada una vez que parte del stock ya se consumió/vendió).
//
//   CostoPromedioNuevo = (StockExistente × CostoPromedioVigente + CantidadComprada × PrecioUnitario)
//                        ÷ (StockExistente + CantidadComprada)
//
// Los valores se guardan sin redondear (el redondeo es solo de presentación).

export function calcularCostoPromedioCompra(stockExistente, costoPromedioVigente, cantidadComprada, precioUnitario) {
  const stock = parseFloat(stockExistente) || 0;
  const costo = parseFloat(costoPromedioVigente) || 0;
  const cantidad = parseFloat(cantidadComprada) || 0;
  const precio = parseFloat(precioUnitario) || 0;
  const nuevoStock = stock + cantidad;
  if (nuevoStock <= 0) return precio;
  const valorTotal = stock * costo + cantidad * precio;
  return valorTotal / nuevoStock;
}

/**
 * Recalcula stock y costo promedio reproduciendo cronológicamente TODOS los
 * movimientos de un ítem (útil tras editar, eliminar o anular una compra,
 * para que el costo promedio quede exactamente como si esa compra nunca
 * hubiera existido, sin arrastrar el error de sumar valores históricos).
 * Las salidas reducen el stock pero nunca alteran el costo promedio vigente.
 */
export function recalcularDesdeMovimientos(movimientos) {
  const ordenados = [...(movimientos || [])].sort(
    (a, b) => new Date(a.fecha_movimiento || a.created_date || 0) - new Date(b.fecha_movimiento || b.created_date || 0)
  );
  let stock = 0;
  let costoPromedio = 0;
  for (const mov of ordenados) {
    const cantidad = parseFloat(mov.cantidad) || 0;
    if (mov.tipo_movimiento === 'entrada' && cantidad > 0) {
      costoPromedio = calcularCostoPromedioCompra(stock, costoPromedio, cantidad, parseFloat(mov.costo_unitario) || 0);
      stock += cantidad;
    } else {
      stock += cantidad; // salidas/ajustes negativos no modifican el costo promedio
    }
  }
  return { stock, costoPromedio };
}
