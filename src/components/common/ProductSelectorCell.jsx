import React from "react";

/**
 * Selector de producto usando <select> nativo.
 * - No se recorta por overflow de contenedores padre.
 * - Scroll nativo del navegador.
 * - Sin dependencias externas.
 */
export default function ProductSelectorCell({ item, productosCatalogo, normalize, onSelect }) {
    const sorted = [...productosCatalogo].sort((a, b) =>
        (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true, sensitivity: 'base' })
    );

    return (
        <select
            value={item.codigo || ''}
            onChange={e => onSelect(e.target.value)}
            className="w-full h-8 px-2 text-xs border border-gray-300 rounded-md bg-white focus:outline-none focus:border-emerald-400 cursor-pointer"
            style={{ minWidth: '140px' }}
        >
            <option value="">Seleccionar producto...</option>
            {sorted.map(p => (
                <option key={p.id} value={p.codigo}>
                    {p.codigo} – {p.descripcion}
                </option>
            ))}
        </select>
    );
}