// Utilidades compartidas para el Inventario de Productos en Proceso.
// Centraliza: derivación automática del Código Producto en Proceso a partir
// del Color Base, consolidación de existencias por Código Producto (evitando
// duplicidad lote padre + partidas) y consumo FIFO (primero en entrar, primero
// en salir) entre las partidas de un mismo Código Producto.

const PREFIJO_CODIGO = 'CCROS';

/** Normaliza un color para usarlo como clave de agrupación estable. */
export const normalizarColor = (color) => (color || '').trim().toUpperCase();

/**
 * Dado un color base y la lista completa de InventarioEnProceso, devuelve el
 * Código Producto en Proceso correspondiente: reutiliza el código ya usado
 * por ese color si existe, o genera el siguiente consecutivo disponible.
 * El usuario NUNCA digita este código: solo elige el Color Base.
 */
export function deriveCodigoProducto(colorBase, allInvProceso = []) {
  const color = normalizarColor(colorBase);
  if (!color) return { codigo: '', descripcion: '' };

  const existente = allInvProceso.find(
    (i) => normalizarColor(i.color_base) === color && i.codigo_producto_proceso
  );
  if (existente) {
    return {
      codigo: existente.codigo_producto_proceso,
      descripcion: existente.descripcion_producto_proceso || `CUERO CROSTA ${color}`,
    };
  }

  const usados = new Set(
    allInvProceso
      .map((i) => i.codigo_producto_proceso)
      .filter((c) => c && c.startsWith(`${PREFIJO_CODIGO}-`))
      .map((c) => parseInt(c.split('-')[1], 10))
      .filter((n) => !Number.isNaN(n))
  );
  let n = 1;
  while (usados.has(n)) n += 1;
  const codigo = `${PREFIJO_CODIGO}-${String(n).padStart(3, '0')}`;
  return { codigo, descripcion: `CUERO CROSTA ${color}` };
}

/** true si el item tiene partidas hijas registradas (es decir, es un "lote padre"). */
const tieneHijos = (item, todos) => todos.some((x) => x.codigo_lote_padre === item.codigo_lote);

/**
 * Recalcula el stock real de un lote padre: total original menos la suma de
 * lo ya distribuido en sus partidas activas. Nunca deja el padre con stock
 * "fantasma" que se sume al de sus partidas (la causa de la duplicidad).
 */
export function calcularRemanentePadre(padre, todos) {
  const original = (padre.cantidad_hojas_original ?? null) !== null
    ? parseFloat(padre.cantidad_hojas_original) || 0
    : null;
  const hijos = todos.filter((x) => x.codigo_lote_padre === padre.codigo_lote);
  const sumaHijos = hijos.reduce((s, h) => s + (parseFloat(h.cantidad_hojas) || 0), 0);

  // Si aún no se ha capturado el total original, se toma el stock del padre
  // tal como está guardado: en datos existentes (aún no corregidos) ese valor
  // sigue siendo el total original real, porque nunca se había descontado
  // automáticamente al crear partidas (la causa de la duplicidad reportada).
  const totalOriginal = original !== null ? original : (parseFloat(padre.cantidad_hojas) || 0);
  const remanente = Math.max(0, totalOriginal - sumaHijos);
  return { totalOriginal, sumaHijos, remanente };
}

/**
 * Consolida el inventario en proceso por Código Producto, sin duplicar el
 * stock del lote padre una vez repartido. Cada fila devuelta representa un
 * único Código Producto con su stock total y el detalle de partidas que lo
 * componen (para el panel "Detalle de Existencias").
 */
export function agruparPorCodigoProducto(items = []) {
  const disponibles = items.filter((it) => {
    if (tieneHijos(it, items)) return false; // es lote padre con particiones: no es existencia disponible
    const stock = parseFloat(it.cantidad_hojas) || 0;
    return true && stock >= 0; // se incluyen aunque estén en 0 para permitir el filtro "mostrar sin existencia"
  });

  const grupos = new Map();
  for (const it of disponibles) {
    const clave = it.codigo_producto_proceso || it.codigo || it.id;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(it);
  }

  const filas = [];
  for (const [codigo, partidas] of grupos) {
    const ordenadas = [...partidas].sort(
      (a, b) => new Date(a.fecha_ingreso_proceso || a.created_date || 0) - new Date(b.fecha_ingreso_proceso || b.created_date || 0)
    );
    const stockTotal = ordenadas.reduce((s, p) => s + (parseFloat(p.cantidad_hojas) || 0), 0);
    const reservadoTotal = ordenadas.reduce((s, p) => s + (parseFloat(p.hojas_reservadas) || 0), 0);
    const valorTotal = ordenadas.reduce((s, p) => s + (parseFloat(p.cantidad_hojas) || 0) * (parseFloat(p.costo_promedio) || 0), 0);
    const costoPromedio = stockTotal > 0 ? valorTotal / stockTotal : 0;
    const base = ordenadas[ordenadas.length - 1] || ordenadas[0];

    filas.push({
      codigo_producto_proceso: codigo,
      descripcion: base?.descripcion_producto_proceso || base?.descripcion || '',
      color_base: base?.color_base || '',
      calibre: base?.calibre || '',
      unidad_medida: base?.unidad_medida || 'HOJA',
      stock_total: stockTotal,
      reservado_total: reservadoTotal,
      disponible_total: Math.max(0, stockTotal - reservadoTotal),
      costo_promedio: costoPromedio,
      valor_total: valorTotal,
      stock_minimo: Math.max(...ordenadas.map((p) => parseFloat(p.stock_minimo) || 0), 0),
      estado: stockTotal > 0 ? 'Disponible' : 'Sin existencia',
      fecha_ingreso: ordenadas[0]?.fecha_ingreso_proceso || ordenadas[0]?.created_date || null,
      ultima_actualizacion: ordenadas.reduce((max, p) => {
        const f = p.updated_date || p.created_date;
        return !max || new Date(f) > new Date(max) ? f : max;
      }, null),
      cantidad_partidas: ordenadas.length,
      partidas: ordenadas.map((p) => ({
        id: p.id,
        codigo_partida: p.codigo_lote,
        lote_padre: p.codigo_lote_padre || '—',
        fecha: p.fecha_ingreso_proceso || p.created_date,
        cantidad_inicial: (p.cantidad_hojas_original ?? null) !== null ? parseFloat(p.cantidad_hojas_original) : parseFloat(p.cantidad_hojas) || 0,
        stock_disponible: parseFloat(p.cantidad_hojas) || 0,
        costo_promedio: parseFloat(p.costo_promedio) || 0,
        estado: (parseFloat(p.cantidad_hojas) || 0) > 0 ? 'Disponible' : 'Consumida',
      })),
    });
  }

  return filas.sort((a, b) => (a.codigo_producto_proceso || '').localeCompare(b.codigo_producto_proceso || ''));
}

/**
 * Calcula (sin persistir) la distribución FIFO necesaria para consumir
 * `cantidadSolicitada` unidades de un Código Producto: siempre toma primero
 * de la partida más antigua con existencia disponible.
 * Devuelve { distribucion: [{ partidaId, codigoPartida, loteP, cantidad, costoUnitario }], faltante }
 */
export function calcularConsumoFIFO(items, codigoProducto, cantidadSolicitada) {
  const partidas = items
    .filter((it) => (it.codigo_producto_proceso || it.codigo) === codigoProducto && !tieneHijos(it, items))
    .filter((it) => (parseFloat(it.cantidad_hojas) || 0) > 0)
    .sort((a, b) => new Date(a.fecha_ingreso_proceso || a.created_date || 0) - new Date(b.fecha_ingreso_proceso || b.created_date || 0));

  let restante = parseFloat(cantidadSolicitada) || 0;
  const distribucion = [];
  for (const p of partidas) {
    if (restante <= 0) break;
    const disponible = parseFloat(p.cantidad_hojas) || 0;
    const tomar = Math.min(disponible, restante);
    if (tomar > 0) {
      distribucion.push({
        partidaId: p.id,
        codigoPartida: p.codigo_lote,
        lotePadre: p.codigo_lote_padre || '—',
        cantidad: tomar,
        costoUnitario: parseFloat(p.costo_promedio) || 0,
      });
      restante -= tomar;
    }
  }
  return { distribucion, faltante: Math.max(0, restante) };
}

// ── Reservas de inventario en proceso ──────────────────────────────────────
// Un pedido de Pintura en Borrador RESERVA hojas (no las descuenta de verdad).
// Así nunca dos pedidos abiertos pueden usar las mismas hojas, pero la
// existencia física no se mueve hasta que el pedido se Finaliza.

/** Hojas realmente disponibles para un NUEVO pedido: físico menos reservado. */
export function disponibleReal(item, reservaPropiaAIncluir = 0) {
  const stock = parseFloat(item?.cantidad_hojas) || 0;
  const reservado = parseFloat(item?.hojas_reservadas) || 0;
  return Math.max(0, stock - reservado + (parseFloat(reservaPropiaAIncluir) || 0));
}

/**
 * Igual que calcularConsumoFIFO pero respetando las reservas de otros
 * pedidos: nunca ofrece hojas que ya están reservadas por otro pedido.
 * `reservasPropias` es un mapa { inventarioEnProcesoId: cantidadYaReservadaPorEstePedido }
 * usado al editar un borrador, para no bloquearse a sí mismo con su propia reserva.
 */
export function calcularConsumoFIFOConReservas(items, codigoProducto, cantidadSolicitada, reservasPropias = {}) {
  const partidas = items
    .filter((it) => (it.codigo_producto_proceso || it.codigo) === codigoProducto && !tieneHijos(it, items))
    .map((it) => ({ ...it, __disponibleReal: disponibleReal(it, reservasPropias[it.id] || 0) }))
    .filter((it) => it.__disponibleReal > 0)
    .sort((a, b) => new Date(a.fecha_ingreso_proceso || a.created_date || 0) - new Date(b.fecha_ingreso_proceso || b.created_date || 0));

  let restante = parseFloat(cantidadSolicitada) || 0;
  const distribucion = [];
  for (const p of partidas) {
    if (restante <= 0) break;
    const tomar = Math.min(p.__disponibleReal, restante);
    if (tomar > 0) {
      distribucion.push({
        partidaId: p.id,
        codigoPartida: p.codigo_lote,
        lotePadre: p.codigo_lote_padre || '—',
        cantidad: tomar,
        costoUnitario: parseFloat(p.costo_promedio) || 0,
      });
      restante -= tomar;
    }
  }
  return { distribucion, faltante: Math.max(0, restante) };
}
