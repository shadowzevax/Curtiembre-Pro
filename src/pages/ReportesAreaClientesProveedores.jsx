import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { Users, Truck } from 'lucide-react';

export default function ReportesAreaClientesProveedores() {
  return (
    <HubGrid
      title="Reportes — Clientes y Proveedores"
      description="Historial y comportamiento de terceros"
      items={[
        { title: 'Estado de Cuenta por Cliente', href: '/ReporteEstadoCuentaTercero?naturaleza=por_cobrar', icon: Users },
        { title: 'Estado de Cuenta por Proveedor', href: '/ReporteEstadoCuentaTercero?naturaleza=por_pagar', icon: Truck },
      ]}
    />
  );
}
