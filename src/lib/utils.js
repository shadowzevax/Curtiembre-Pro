import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Fuerza mayúsculas en un input controlado de texto, preservando la posición
// del cursor. Uso: onChange={e => setForm({ ...form, campo: toUpperCase(e) })}
export function toUpperCase(e) {
  return (e?.target?.value || '').toUpperCase();
}
