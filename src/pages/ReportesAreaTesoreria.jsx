import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { BookOpen, Landmark, CalendarClock, Calculator, TrendingUp, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

export default function ReportesAreaTesoreria() {
  return (
    <HubGrid
      title="Reportes — Área de Tesorería"
      description="Informes de caja y bancos"
      items={[
        { title: 'Libro Auxiliar de Caja', page: 'CajaMovimientos', icon: BookOpen },
        { title: 'Libro Auxiliar de Bancos', page: 'MovimientosBancarios', icon: Landmark },
        { title: 'Movimiento Diario de Caja', page: 'ReportesMovimientosCaja', icon: CalendarClock },
        { title: 'Arqueo de Caja', proximamente: true, icon: Calculator },
        { title: 'Flujo de Caja', proximamente: true, icon: TrendingUp },
        { title: 'Relación de Ingresos', proximamente: true, icon: ArrowUpCircle },
        { title: 'Relación de Egresos', proximamente: true, icon: ArrowDownCircle },
        { title: 'Informe de Caja (histórico)', page: 'InformeCaja', icon: BookOpen },
      ]}
    />
  );
}
