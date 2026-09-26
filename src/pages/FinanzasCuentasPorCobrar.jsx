import React from 'react';
import CarteraModulo from '../components/finanzas/CarteraModulo';

export default function FinanzasCuentasPorCobrar() {
  return <CarteraModulo naturaleza="por_cobrar" titulo="Cuentas por Cobrar" descripcion="Cartera de clientes: cobros, anticipos y notas" etiquetaTercero="Cliente" />;
}
