import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { Gauge, TrendingUp } from 'lucide-react';

// Panel gerencial (bloque C2): indicadores, alertas y flujo de caja sobre el motor financiero.
export default function ReportesAreaIndicadores() {
  return (
    <HubGrid
      title="Reportes — Indicadores y Resumen Gerencial"
      description="Panorama general de la curtiembre"
      items={[
        { title: 'Panel Gerencial (resumen, alertas, flujo de caja)', href: '/PanelGerencial', icon: Gauge },
        { title: 'Rentabilidad de Clientes', href: '/ReporteRentabilidadClientes', icon: TrendingUp },
      ]}
    />
  );
}
