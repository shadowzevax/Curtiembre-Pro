import React from 'react';
import HubGrid from '../components/common/HubGrid';
import { ArrowRightLeft, ArrowLeftRight, Landmark, PiggyBank, HandCoins, Banknote } from 'lucide-react';

export default function FinanzasTesoreria() {
  return (
    <HubGrid
      title="Tesorería"
      description="Finanzas y Tesorería — Tesorería"
      items={[
        { title: 'Traslado Caja → Banco', description: 'Consignación de efectivo de caja a banco', proximamente: true, icon: ArrowRightLeft },
        { title: 'Traslado Banco → Caja', description: 'Retiro de banco hacia caja', proximamente: true, icon: ArrowLeftRight },
        { title: 'Traslado entre Bancos', description: 'Movimiento entre cuentas bancarias propias', proximamente: true, icon: Landmark },
        { title: 'Caja Menor', description: 'Fondo fijo para gastos menores', proximamente: true, icon: Banknote },
        { title: 'Préstamos', description: 'Préstamos otorgados o recibidos', proximamente: true, icon: HandCoins },
        { title: 'Anticipos', description: 'Anticipos generales de tesorería', proximamente: true, icon: PiggyBank },
        { title: 'Traslados de Efectivo (registro general)', description: 'Registro general de traslados mientras se detallan los flujos por dirección', page: 'ContabilidadTraslados', icon: ArrowRightLeft },
      ]}
    />
  );
}
