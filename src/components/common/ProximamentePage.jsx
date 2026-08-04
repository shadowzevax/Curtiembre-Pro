import React from 'react';
import PageHeader from './PageHeader';
import { Clock } from 'lucide-react';

/** Pantalla placeholder para procesos ya definidos en la nueva estructura del
 * ERP pero cuyo desarrollo funcional queda para una etapa posterior. */
export default function ProximamentePage({ title, description }) {
  return (
    <div className="p-6">
      <PageHeader title={title} description={description} />
      <div className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center text-slate-400 flex flex-col items-center gap-2">
        <Clock className="w-10 h-10" />
        <p className="font-semibold text-slate-500">Próximamente</p>
        <p className="text-sm max-w-md">Este proceso ya está contemplado en la nueva estructura del ERP; su desarrollo funcional se implementará en una etapa posterior.</p>
      </div>
    </div>
  );
}
