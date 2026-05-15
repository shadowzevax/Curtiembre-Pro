import React, { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

export default function SidebarSearch({ menuItems, isCollapsed, onSearchResults, onClear }) {
  const [query, setQuery] = useState("");
  const clearTimerRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-borrar búsqueda 3s después de que el cursor salga del sidebar
  // El padre controla esto via prop onClear — ver Layout
  useEffect(() => {
    return () => { if (clearTimerRef.current) clearTimeout(clearTimerRef.current); };
  }, []);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    if (!val.trim()) {
      onSearchResults(null);
    } else {
      const lower = val.toLowerCase();
      const results = {};
      menuItems.forEach(item => {
        if (!item.subItems) {
          // Item sin submenú (ej: Inicio) — siempre visible o si matchea
          return;
        }
        const matchedSubs = [];
        item.subItems.forEach(sub => {
          if (sub.subItems) {
            // sub de nivel 2
            const matchedSubSubs = sub.subItems.filter(ss =>
              ss.title.toLowerCase().includes(lower)
            );
            if (matchedSubSubs.length > 0 || sub.title.toLowerCase().includes(lower)) {
              matchedSubs.push({ ...sub, _matchedSubSubs: matchedSubSubs.length > 0 ? matchedSubSubs : sub.subItems });
            }
          } else {
            if (sub.title.toLowerCase().includes(lower)) {
              matchedSubs.push(sub);
            }
          }
        });
        if (matchedSubs.length > 0 || item.title.toLowerCase().includes(lower)) {
          results[item.title] = matchedSubs.length > 0 ? matchedSubs : null; // null = mostrar todo
        }
      });
      onSearchResults(results);
    }
  };

  const handleClear = () => {
    setQuery("");
    onSearchResults(null);
  };

  // Exponer función para borrar desde el padre (cuando cursor sale del sidebar)
  useEffect(() => {
    if (onClear) onClear.current = () => {
      setQuery("");
      onSearchResults(null);
    };
  }, [onClear, onSearchResults]);

  if (isCollapsed) return null;

  return (
    <div className="px-2 pb-2 pt-1">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Buscar módulo..."
          className="w-full pl-8 pr-7 py-1.5 text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:border-emerald-400 transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}