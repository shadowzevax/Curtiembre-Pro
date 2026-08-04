import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { Factory, ListChecks } from 'lucide-react';

export default function ReportesAreaProduccion() {
  return (
    <HubGrid
      title="Reportes — Área de Producción"
      description="Se conservan todos los reportes de producción ya definidos"
      items={[
        { title: 'Reportes de Producción', page: 'ReportesProduccion', icon: Factory },
        { title: 'Reportes de Procesos', page: 'ReportesProcesos', icon: ListChecks },
        { title: 'Informe de Costos', page: 'InformeCostos', icon: Factory },
      ]}
    />
  );
}
