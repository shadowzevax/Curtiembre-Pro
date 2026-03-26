import React, { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export default function SuccessToast({ message, description, onClose, duration = 3000 }) {
  const [opacity, setOpacity] = useState(1);
  const [gone, setGone] = useState(false);

  const dismiss = () => {
    setOpacity(0);
    setTimeout(() => {
      setGone(true);
      onClose?.();
    }, 500);
  };

  useEffect(() => {
    // Empezar a desaparecer 500ms antes del final
    const fadeTimer = setTimeout(() => setOpacity(0), duration - 500);
    // Remover completamente al cumplir la duración
    const removeTimer = setTimeout(() => {
      setGone(true);
      onClose?.();
    }, duration);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [duration, onClose]);

  if (gone) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        opacity,
        transition: 'opacity 0.5s ease',
        pointerEvents: opacity === 0 ? 'none' : 'auto',
      }}
      className="flex items-start gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-4 rounded-xl shadow-2xl shadow-emerald-500/40 min-w-[280px] max-w-[380px]"
    >
      <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-semibold text-sm">{message}</p>
        {description && <p className="text-xs text-emerald-100 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={dismiss}
        className="text-white/70 hover:text-white transition-colors flex-shrink-0 ml-2"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}