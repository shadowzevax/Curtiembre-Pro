import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { FileText, AlertTriangle, History } from 'lucide-react';

export default function ReportesAreaCuentasPagar() {
  return (
    <HubGrid
      title="Reportes — Área de Cuentas por Pagar"
      description="Informes de obligaciones con proveedores"
      items={[
        { title: 'Estado de Proveedores', proximamente: true, icon: FileText },
        { title: 'Obligaciones Pendientes', page: 'CuentasPorPagar', icon: AlertTriangle },
        { title: 'Historial de Pagos', proximamente: true, icon: History },
      ]}
    />
  );
}
