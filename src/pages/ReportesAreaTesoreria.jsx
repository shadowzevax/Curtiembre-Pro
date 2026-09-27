import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { CalendarClock, Landmark, FileText, AlertTriangle, Calculator, TrendingUp, BookOpen, LineChart,
  ArrowUpCircle, ArrowDownCircle, ArrowLeftRight, Users, Truck, RefreshCw } from 'lucide-react';

// Reportes de Finanzas y Tesorería: agrupa Caja, Bancos, Cuentas por Cobrar y Cuentas por
// Pagar (requerimiento 6.13), todos sobre el motor financiero (`fin_*`).
export default function ReportesAreaTesoreria() {
  return (
    <HubGrid
      title="Reportes — Finanzas y Tesorería"
      description="Caja, Bancos, Cuentas por Cobrar y Cuentas por Pagar"
      items={[
        { title: 'Movimiento Diario de Caja', href: '/ReporteMovimientoCuentas?tipo=caja', icon: CalendarClock },
        { title: 'Movimiento Diario de Bancos', href: '/ReporteMovimientoCuentas?tipo=banco', icon: Landmark },
        { title: 'Arqueo de Caja (ajustes y diferencias)', href: '/ReporteDocumentosPorTipo?tipo=AJ', icon: Calculator },
        { title: 'Transferencias entre Cuentas', href: '/ReporteDocumentosPorTipo?tipo=TR', icon: ArrowLeftRight },
        { title: 'Movimientos Pendientes de Conciliación', href: '/ReporteMovimientosSinConciliar', icon: RefreshCw },
        { title: 'Flujo de Caja Proyectado', proximamente: true, icon: TrendingUp },
        { title: 'Cartera Pendiente (Cuentas por Cobrar)', href: '/ReporteCartera?naturaleza=por_cobrar', icon: FileText },
        { title: 'Estado de Cuenta por Cliente', href: '/ReporteEstadoCuentaTercero?naturaleza=por_cobrar', icon: Users },
        { title: 'Cobros por Período (Recibos de Caja)', href: '/ReporteDocumentosPorTipo?tipo=RC', icon: ArrowUpCircle },
        { title: 'Obligaciones Pendientes (Cuentas por Pagar)', href: '/ReporteCartera?naturaleza=por_pagar', icon: AlertTriangle },
        { title: 'Estado de Cuenta por Proveedor', href: '/ReporteEstadoCuentaTercero?naturaleza=por_pagar', icon: Truck },
        { title: 'Pagos por Período (Comprobantes de Egreso)', href: '/ReporteDocumentosPorTipo?tipo=CE', icon: ArrowDownCircle },
        { title: 'Informe de Caja (histórico, anterior al motor)', page: 'InformeCaja', icon: BookOpen },
        { title: 'Reportes Financieros (histórico, anterior al motor)', page: 'ReportesFinancieros', icon: LineChart },
        { title: 'Reportes Bancarios (histórico, anterior al motor)', page: 'ReportesBancarios', icon: Landmark },
      ]}
    />
  );
}
