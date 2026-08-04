import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { FileText, HandCoins, UserCheck, PiggyBank } from 'lucide-react';

export default function FinanzasCuentasCobrar() {
  return (
    <HubGrid
      title="Cuentas por Cobrar"
      description="Finanzas y Tesorería — Cuentas por Cobrar"
      items={[
        { title: 'Facturas Pendientes', description: 'Cartera pendiente de cobro por cliente', page: 'CuentasPorCobrar', icon: FileText },
        { title: 'Abonos', description: 'Registro de abonos recibidos de clientes', proximamente: true, icon: HandCoins },
        { title: 'Estado de Cuenta por Cliente', description: 'Historial completo de un cliente', proximamente: true, icon: UserCheck },
        { title: 'Anticipos de Clientes', description: 'Dinero recibido por adelantado', proximamente: true, icon: PiggyBank },
      ]}
    />
  );
}
