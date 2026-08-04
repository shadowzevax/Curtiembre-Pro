import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { Receipt, FileText, ArrowLeftRight, Scale, BookOpen } from 'lucide-react';

export default function FinanzasBancos() {
  return (
    <HubGrid
      title="Bancos"
      description="Finanzas y Tesorería — Bancos"
      items={[
        { title: 'Recibos de Consignación', description: 'Ingresos consignados a cuentas bancarias', proximamente: true, icon: Receipt },
        { title: 'Comprobantes de Egreso Bancario', description: 'Salidas de dinero desde bancos', proximamente: true, icon: FileText },
        { title: 'Transferencias Bancarias', description: 'Movimientos entre cuentas propias', page: 'TransferenciasBancarias', icon: ArrowLeftRight },
        { title: 'Conciliación Bancaria', description: 'Cruce entre libros y extractos bancarios', page: 'ConciliacionBancaria', icon: Scale },
        { title: 'Libro Auxiliar de Bancos', description: 'Detalle cronológico de movimientos bancarios', page: 'MovimientosBancarios', icon: BookOpen },
      ]}
    />
  );
}
