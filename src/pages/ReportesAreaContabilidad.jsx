import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { BookText, Scale, Landmark, Percent } from 'lucide-react';

export default function ReportesAreaContabilidad() {
  return (
    <HubGrid
      title="Reportes — Contabilidad"
      description="Movimientos contables, saldos y balances"
      items={[
        { title: 'Movimientos Contables (detalle)', proximamente: true, icon: BookText },
        { title: 'Saldos y Balances', page: 'ContabilidadSaldosBalances', icon: Scale },
        { title: 'Impuestos y Retenciones', page: 'ContabilidadImpuestosRetenciones', icon: Percent },
        { title: 'Registro de Gastos (histórico, anterior al motor)', page: 'ContabilidadGastos', icon: Landmark },
        { title: 'Registro de Otros Ingresos (histórico, anterior al motor)', page: 'ContabilidadIngresos', icon: Landmark },
      ]}
    />
  );
}
