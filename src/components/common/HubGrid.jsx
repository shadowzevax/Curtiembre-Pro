import React from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PageHeader from './PageHeader';

/**
 * Pantalla principal de un submódulo: en vez de un listado largo de procesos
 * en el menú lateral, el usuario entra a esta pantalla y ve los procesos como
 * tarjetas/botones. Mantiene el menú lateral limpio en todo el ERP.
 *
 * items: [{ title, description?, page? (nombre de página para createPageUrl),
 *           href? (url externa/absoluta), icon?: componente lucide, proximamente?: bool }]
 */
export default function HubGrid({ title, description, items }) {
  const navigate = useNavigate();

  return (
    <div className="p-6">
      <PageHeader title={title} description={description} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          const disabled = !!item.proximamente;
          const goTo = () => {
            if (disabled) return;
            if (item.href) { navigate(item.href); return; }
            if (item.page) { navigate(createPageUrl(item.page)); }
          };
          return (
            <button
              key={item.title}
              type="button"
              onClick={goTo}
              disabled={disabled}
              className={`text-left border rounded-xl p-4 transition-all bg-white ${
                disabled
                  ? 'border-slate-200 opacity-60 cursor-not-allowed'
                  : 'border-slate-200 hover:border-emerald-400 hover:shadow-md cursor-pointer'
              }`}
            >
              <div className="flex items-start gap-3">
                {Icon && (
                  <div className={`p-2 rounded-lg ${disabled ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-700'}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
                  {disabled && <p className="text-xs text-amber-600 font-semibold mt-1">Próximamente</p>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
