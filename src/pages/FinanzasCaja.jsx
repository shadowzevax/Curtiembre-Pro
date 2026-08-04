import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { Receipt, FileText, Wallet, ClipboardCheck, Calculator, BookOpen } from 'lucide-react';

export default function FinanzasCaja() {
  return (
    <HubGrid
      title="Caja"
      description="Finanzas y Tesorería — Caja"
      items={[
        { title: 'Recibos de Caja', description: 'Ingresos de efectivo recibidos', page: 'ReciboCaja', icon: Receipt },
        { title: 'Comprobantes de Egreso', description: 'Salidas de efectivo de caja', page: 'ComprobanteEgreso', icon: FileText },
        { title: 'Apertura de Caja', description: 'Saldo inicial y configuración de cajas', page: 'CajaConfig', icon: Wallet },
        { title: 'Cierre Diario de Caja', description: 'Cierre y consolidación del día', proximamente: true, icon: ClipboardCheck },
        { title: 'Arqueo de Caja', description: 'Conteo y verificación del efectivo físico', proximamente: true, icon: Calculator },
        { title: 'Libro Auxiliar de Caja', description: 'Detalle cronológico de movimientos de caja', page: 'CajaMovimientos', icon: BookOpen },
      ]}
    />
  );
}
