import React from 'react';
import CarteraModulo from '../components/finanzas/CarteraModulo';

export default function FinanzasCuentasPorPagar() {
  return <CarteraModulo naturaleza="por_pagar" titulo="Cuentas por Pagar" descripcion="Obligaciones con proveedores: pagos, anticipos y notas" etiquetaTercero="Proveedor" />;
}
