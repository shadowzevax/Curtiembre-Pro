import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { CalendarDays, LineChart, ShoppingBag, Factory } from 'lucide-react';

export default function ReportesAreaGenerales() {
  return (
    <HubGrid
      title="Reportes Generales"
      description="Vistazos de gestión que combinan varios módulos del ERP"
      items={[
        { title: 'Resumen Diario', href: '/ReporteResumenDiario', icon: CalendarDays },
        { title: 'Resumen Financiero', proximamente: true, icon: LineChart },
        { title: 'Resumen Comercial', proximamente: true, icon: ShoppingBag },
        { title: 'Resumen Operativo', proximamente: true, icon: Factory },
      ]}
    />
  );
}
