import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { ListTree, Package, Gem, ArrowLeftRight, Layers, Truck } from 'lucide-react';

export default function ReportesAreaInventarios() {
  return (
    <HubGrid
      title="Reportes — Inventarios"
      description="Informes de existencias y movimientos de inventario"
      items={[
        { title: 'Kardex', proximamente: true, icon: ListTree },
        { title: 'Existencias', page: 'ReportesInventario', icon: Package },
        { title: 'Existencias en Proceso (cuero crosta)', href: '/ReporteExistenciasEnProceso', icon: Layers },
        { title: 'Inventario Valorizado', href: '/ReporteInventarioValorizado', icon: Gem },
        { title: 'Movimientos de Inventario', proximamente: true, icon: ArrowLeftRight },
        { title: 'Procesos Externos (estado actual)', page: 'InventarioProcesosExternos', icon: Truck },
      ]}
    />
  );
}
