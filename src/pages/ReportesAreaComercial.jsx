import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { TrendingUp, ShoppingCart, LineChart, Landmark } from 'lucide-react';

// Área adicional (no listada explícitamente en el requerimiento, que menciona
// las áreas "por ejemplo") para no perder del menú los reportes de Ventas,
// Compras, Financieros y Bancarios que ya existían en el ERP.
export default function ReportesAreaComercial() {
  return (
    <HubGrid
      title="Reportes — Área Comercial y Financiera"
      description="Ventas, compras y financieros generales"
      items={[
        { title: 'Reportes de Ventas', page: 'ReportesVentas', icon: TrendingUp },
        { title: 'Reportes de Compras', page: 'ReportesCompras', icon: ShoppingCart },
        { title: 'Reportes Financieros', page: 'ReportesFinancieros', icon: LineChart },
        { title: 'Reportes Bancarios', page: 'ReportesBancarios', icon: Landmark },
        { title: 'Registro de Gastos', page: 'ContabilidadGastos', icon: TrendingUp },
        { title: 'Registro de Otros Ingresos', page: 'ContabilidadIngresos', icon: TrendingUp },
      ]}
    />
  );
}
