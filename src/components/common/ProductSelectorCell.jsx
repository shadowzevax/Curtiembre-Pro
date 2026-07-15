import React, { useState, useRef, useEffect } from "react";

export default function ProductSelectorCell({ index, item, productosCatalogo, normalize, onSelect }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const btnRef = useRef(null);
    const [dropdownStyle, setDropdownStyle] = useState({});

    const openDropdown = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setDropdownStyle({
                position: 'fixed',
                top: rect.bottom + 4,
                left: rect.left,
                width: Math.max(rect.width, 320),
                zIndex: 9999,
            });
        }
        setSearch('');
        setOpen(true);
    };

    const filtered = productosCatalogo
        .filter(p => {
            const term = normalize(search);
            if (!term) return true;
            return normalize(p.codigo).includes(term) || normalize(p.descripcion).includes(term);
        })
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }))
        .slice(0, 50);

    return (
        <div className="relative">
            <button
                ref={btnRef}
                type="button"
                onClick={openDropdown}
                className="w-full h-8 px-2 text-xs text-left border border-gray-300 rounded-md bg-white hover:bg-emerald-50 hover:border-emerald-400 flex items-center justify-between gap-1 transition-colors"
            >
                <span className={item.codigo ? 'font-mono font-bold text-emerald-700 truncate' : 'text-gray-400'}>
                    {item.codigo || 'Seleccionar producto...'}
                </span>
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div
                    style={dropdownStyle}
                    className="bg-white border border-gray-200 rounded-md shadow-2xl"
                >
                    <div className="p-2 border-b">
                        <input
                            autoFocus
                            type="text"
                            placeholder="Buscar por código o nombre..."
                            className="w-full h-7 px-2 text-xs border border-gray-300 rounded focus:outline-none focus:border-emerald-400"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onBlur={() => setTimeout(() => setOpen(false), 200)}
                        />
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        {filtered.map(p => (
                            <div
                                key={p.id}
                                className="px-3 py-1.5 text-xs cursor-pointer hover:bg-emerald-50 border-b last:border-0"
                                onMouseDown={() => {
                                    onSelect(p.codigo);
                                    setOpen(false);
                                }}
                            >
                                <span className="font-mono font-bold text-emerald-700">{p.codigo}</span>
                                <span className="text-gray-600"> – {p.descripcion}</span>
                            </div>
                        ))}
                        {filtered.length === 0 && search && (
                            <div className="px-3 py-2 text-xs text-red-500 italic">Sin resultados en el Catálogo Maestro.</div>
                        )}
                        {filtered.length === 0 && !search && (
                            <div className="px-3 py-2 text-xs text-gray-400 italic">Cargando catálogo...</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}