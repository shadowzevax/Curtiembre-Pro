export const formatCOP = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(v || 0);
export const formatFecha = (f) => (f ? new Date(`${f}T00:00:00`).toLocaleDateString('es-CO') : '—');
export const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

export const ESTADO_OBLIGACION = {
  pendiente: { label: 'Pendiente', clase: 'bg-slate-100 text-slate-700' },
  parcial: { label: 'Parcial', clase: 'bg-blue-100 text-blue-700' },
  vencida: { label: 'Vencida', clase: 'bg-red-100 text-red-700' },
  pagada: { label: 'Pagada', clase: 'bg-emerald-100 text-emerald-700' },
  anulada: { label: 'Anulada', clase: 'bg-slate-200 text-slate-500' },
};

export const TIPO_CUENTA_LABEL = { caja: 'Caja', banco: 'Cuenta bancaria', otro_medio: 'Medio de pago' };
export const TIPO_CUENTA_LABEL_PLURAL = { caja: 'cajas configuradas', banco: 'cuentas bancarias configuradas', otro_medio: 'medios de pago configurados' };

export const CATEGORIAS_INGRESO = [
  { value: 'otros_ingresos', label: 'Otros ingresos' },
  { value: 'financiero', label: 'Ingreso financiero (intereses, rendimientos)' },
  { value: 'reintegro', label: 'Reintegro' },
];
export const CATEGORIAS_EGRESO = [
  { value: 'gasto_general', label: 'Gasto general' },
  { value: 'costo_indirecto', label: 'Costo indirecto' },
  { value: 'nomina', label: 'Nómina' },
  { value: 'impuestos', label: 'Impuestos' },
  { value: 'otros', label: 'Otros egresos' },
];

export function mensajeError(e) {
  return e?.message || 'Ocurrió un error inesperado';
}
