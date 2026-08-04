import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { FileText, HandCoins, UserCheck, PiggyBank } from 'lucide-react';

export default function FinanzasCuentasPagar() {
  return (
    <HubGrid
      title="Cuentas por Pagar"
      description="Finanzas y Tesorería — Cuentas por Pagar"
      items={[
        { title: 'Facturas de Proveedores', description: 'Obligaciones pendientes por proveedor', page: 'CuentasPorPagar', icon: FileText },
        { title: 'Abonos', description: 'Registro de abonos realizados a proveedores', proximamente: true, icon: HandCoins },
        { title: 'Estado de Cuenta por Proveedor', description: 'Historial completo de un proveedor', proximamente: true, icon: UserCheck },
        { title: 'Anticipos a Proveedores', description: 'Dinero entregado por adelantado', proximamente: true, icon: PiggyBank },
      ]}
    />
  );
}
