import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { CalendarRange, ShoppingCart, Package } from 'lucide-react';

export default function ReportesAreaCompras() {
  return (
    <HubGrid
      title="Reportes — Compras"
      description="Compras de materia prima, insumos y servicios"
      items={[
        { title: 'Compras por Período (por proveedor, por estado)', href: '/ReporteComprasPeriodo', icon: CalendarRange },
        { title: 'Compras por Insumo', href: '/ReporteComprasPorInsumo', icon: Package },
        { title: 'Reportes de Compras (histórico, anterior al motor)', page: 'ReportesCompras', icon: ShoppingCart },
      ]}
    />
  );
}
