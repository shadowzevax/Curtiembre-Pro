import { apiFetch } from './client';

// Llave de idempotencia: se genera una por intento de operación (al abrir un formulario).
// Si el mismo envío llega dos veces (doble clic, reintento, corte de red), el servidor lo
// reconoce y no registra nada dos veces.
export function nuevaLlave() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export const fin = {
  get: (ruta, params) => apiFetch(`/fin${ruta}`, { params }),
  post: (ruta, body) => apiFetch(`/fin${ruta}`, { method: 'POST', body }),
  put: (ruta, body) => apiFetch(`/fin${ruta}`, { method: 'PUT', body }),
  del: (ruta, params) => apiFetch(`/fin${ruta}`, { method: 'DELETE', params }),
};

export const TIPO_CUENTA_POR_FORMA_PAGO = { efectivo: 'caja', banco: 'banco', otro_medio: 'otro_medio' };

// Anula una venta o compra (solo administrador). Pide el motivo y devuelve true si se anuló.
export async function anularDocumentoComercial(tipo, orden) {
  const nombre = orden.numero_id || `${orden.prefijo_documento || ''}-${orden.numero_documento || ''}`;
  const motivo = window.prompt(
    `Anular ${tipo === 'venta' ? 'la venta' : 'la compra'} ${nombre}.\n\n` +
    'El documento NO se borra: queda marcado ANULADO y se reversan su inventario, su dinero y su cuenta por cobrar/pagar.\n\n' +
    'Escriba el motivo de la anulación:'
  );
  if (motivo === null) return false;
  if (motivo.trim().length < 5) { alert('El motivo debe tener al menos 5 caracteres.'); return false; }
  try {
    const r = await fin.post(`/comercial/${tipo}/${orden.id}/anular`, { motivo: motivo.trim(), idempotency_key: nuevaLlave() });
    alert(`✅ ${nombre} anulado.\n${r.financiero === 'reversado' ? 'Se reversó su efecto financiero.' : 'Documento anterior al módulo financiero: sin cambios financieros.'}\nMovimientos de inventario revertidos: ${r.movimientos_inventario_revertidos ?? 0}`);
    return true;
  } catch (e) {
    alert(`No se pudo anular:\n\n${e.message}`);
    return false;
  }
}
