import React from 'react';
import { Input } from '@/components/ui/input';

/**
 * NumericInput - Input numérico que trata el 0 como placeholder visual
 * Al hacer clic o comenzar a escribir, el 0 desaparece automáticamente
 */
export default function NumericInput({ value, onChange, className, ...props }) {
  const handleFocus = (e) => {
    // Si el valor es 0, seleccionar todo para que se reemplace al escribir
    if (parseFloat(e.target.value) === 0) {
      e.target.select();
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value;
    
    // Si está vacío, establecer como 0
    if (newValue === '' || newValue === null) {
      onChange(0);
      return;
    }
    
    // Parsear el valor
    const parsed = parseFloat(newValue);
    onChange(isNaN(parsed) ? 0 : parsed);
  };

  return (
    <Input
      type="number"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={handleChange}
      onFocus={handleFocus}
      className={className}
      {...props}
    />
  );
}