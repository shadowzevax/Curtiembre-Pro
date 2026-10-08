import React from 'react';
import CuentaDineroModulo from '../components/finanzas/CuentaDineroModulo';

export default function FinanzasBancos() {
  return <CuentaDineroModulo tipo="banco" titulo="Bancos" descripcion="Cuentas bancarias: configuración, movimientos; el GMF se registra desde Conciliación Bancaria según el extracto" />;
}
