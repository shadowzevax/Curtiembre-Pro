import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { Palette, PackageCheck, ClipboardList } from 'lucide-react';

// Sin modificar el módulo de Planificación y Control de Producción de Pintura: los reportes
// de esta área se agregan en el bloque C, por prioridad, sobre el motor de reportes ya construido.
export default function ReportesAreaPintura() {
  return (
    <HubGrid
      title="Reportes — Pedidos y Producción de Pintura"
      description="Pedidos, consolidados y cumplimiento de Planificación y Control de Producción de Pintura"
      items={[
        { title: 'Pedidos y Cumplimiento', href: '/ReportePedidosPintura', icon: ClipboardList },
        { title: 'Producción por Color y Placa (por orden)', page: 'PlanificacionProduccion', icon: Palette },
        { title: 'Entregas por Período', proximamente: true, icon: PackageCheck },
      ]}
    />
  );
}
