import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { CalendarRange, TrendingUp, Package } from 'lucide-react';

export default function ReportesAreaVentas() {
  return (
    <HubGrid
      title="Reportes — Ventas"
      description="Ventas de productos y servicios"
      items={[
        { title: 'Ventas por Período (por cliente, por estado)', href: '/ReporteVentasPeriodo', icon: CalendarRange },
        { title: 'Ventas por Producto', href: '/ReporteVentasPorProducto', icon: Package },
        { title: 'Reportes de Ventas (histórico, anterior al motor)', page: 'ReportesVentas', icon: TrendingUp },
      ]}
    />
  );
}
