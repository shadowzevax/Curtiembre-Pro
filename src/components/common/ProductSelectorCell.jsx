import React, { useState, useRef, useEffect } from "react";
import ReactDOM from "react-dom";

export default function ProductSelectorCell({ item, productosCatalogo, normalize, onSelect }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 300 });
    const btnRef = useRef(null);

    const updatePos = () => {
        if (btnRef.current) {
            const rect = btnRef.current.getBoundingClientRect();
            setDropdownPos({
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
                width: Math.max(rect.width, 300),
            });
        }
    };

    const handleOpen = () => {
        updatePos();
        setSearch('');
        setOpen(true);
    };

    // Recalcular posición al hacer scroll (dentro del modal)
    useEffect(() => {
        if (!open) return;
        const onScroll = () => {
            if (btnRef.current) {
                const rect = btnRef.current.getBoundingClientRect();
                setDropdownPos({
                    top: rect.bottom + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: Math.max(rect.width, 300),
                });
            }
        };
        // Escuchar scroll en todos los ancestros
        document.addEventListener('scroll', onScroll, true);
        return () => document.removeEventListener('scroll', onScroll, true);
    }, [open]);

    const filtered = productosCatalogo
        .filter(p => {
            const term = normalize(search);
            if (!term) return true;
            return normalize(p.codigo).includes(term) || normalize(p.descripcion).includes(term);
        })
        .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' }))
        .slice(0, 80);

    const dropdown = open ? ReactDOM.createPortal(
        <>
            {/* Capa de cierre */}
            <div
                style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
                onClick={() => setOpen(false)}
            />
            {/* Dropdown */}
            <div
                style={{
                    position: 'absolute',
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    width: dropdownPos.width,
                    zIndex: 9999,
                }}
                className="bg-white border border-gray-300 rounded-md shadow-xl"
                onMouseDown={e => e.stopPropagation()}
            >
                <div className="p-1.5 border-b border-gray-200">
                    <input
                        autoFocus
                        type="text"
                        placeholder="Buscar..."
                        className="w-full h-7 px-2 text-xs border border-gray-300 rounded focus:outline-none focus:border-emerald-400"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <div className="max-h-52 overflow-y-auto">
                    {filtered.map(p => (
                        <div
                            key={p.id}
                            className="px-3 py-1.5 text-xs cursor-pointer hover:bg-emerald-50 border-b last:border-0"
                            onClick={() => {
                                onSelect(p.codigo);
                                setOpen(false);
                                setSearch('');
                            }}
                        >
                            <span className="font-mono font-bold text-emerald-700">{p.codigo}</span>
                            <span className="text-gray-600"> – {p.descripcion}</span>
                        </div>
                    ))}
                    {filtered.length === 0 && (
                        <div className="px-3 py-2 text-xs text-gray-400 italic">Sin resultados.</div>
                    )}
                </div>
            </div>
        </>,
        document.body
    ) : null;

    return (
        <div style={{ position: 'relative' }}>
            <button
                ref={btnRef}
                type="button"
                onClick={handleOpen}
                className="w-full h-8 px-2 text-xs text-left border border-gray-300 rounded-md bg-white hover:bg-emerald-50 hover:border-emerald-400 flex items-center justify-between gap-1 transition-colors"
            >
                <span className={item.codigo ? 'font-mono font-bold text-emerald-700 truncate' : 'text-gray-400'}>
                    {item.codigo || 'Seleccionar producto...'}
                </span>
                <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            {dropdown}
        </div>
    );
}