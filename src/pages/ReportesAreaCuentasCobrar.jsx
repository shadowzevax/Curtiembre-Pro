import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { FileText, AlertTriangle, History } from 'lucide-react';

export default function ReportesAreaCuentasCobrar() {
  return (
    <HubGrid
      title="Reportes — Área de Cuentas por Cobrar"
      description="Informes de cartera de clientes"
      items={[
        { title: 'Estado de Cartera', page: 'CuentasPorCobrar', icon: FileText },
        { title: 'Cartera Vencida', proximamente: true, icon: AlertTriangle },
        { title: 'Historial de Recaudos', proximamente: true, icon: History },
      ]}
    />
  );
}
