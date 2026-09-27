import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { Factory, ListChecks, Coins } from 'lucide-react';

export default function ReportesAreaProduccion() {
  return (
    <HubGrid
      title="Reportes — Producción"
      description="Se conservan todos los reportes de producción ya definidos"
      items={[
        { title: 'Reportes de Producción', page: 'ReportesProduccion', icon: Factory },
        { title: 'Estado de Lotes (etapa actual)', href: '/ReporteEstadoLotes', icon: ListChecks },
        { title: 'Costo Real por Lote (incluye Acabado y Costos Indirectos)', href: '/ReporteCostoLotes', icon: Coins },
        { title: 'Informe de Costos', page: 'InformeCostos', icon: Factory },
      ]}
    />
  );
}
