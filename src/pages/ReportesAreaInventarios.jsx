import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { ListTree, Package, Gem, ArrowLeftRight } from 'lucide-react';

export default function ReportesAreaInventarios() {
  return (
    <HubGrid
      title="Reportes — Área de Inventarios"
      description="Informes de existencias y movimientos de inventario"
      items={[
        { title: 'Kardex', proximamente: true, icon: ListTree },
        { title: 'Existencias', page: 'ReportesInventario', icon: Package },
        { title: 'Inventario Valorizado', proximamente: true, icon: Gem },
        { title: 'Movimientos de Inventario', proximamente: true, icon: ArrowLeftRight },
      ]}
    />
  );
}
