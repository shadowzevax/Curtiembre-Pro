import React, { useState, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export default function SuccessToast({ message, description, onClose, duration = 3000 }) {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), duration - 500);
    const closeTimer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => { clearTimeout(fadeTimer); clearTimeout(closeTimer); };
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 99999,
        transition: 'opacity 0.5s ease',
        opacity: fading ? 0 : 1,
      }}
      className="flex items-start gap-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-5 py-4 rounded-xl shadow-2xl shadow-emerald-500/40 min-w-[280px] max-w-[380px]"
    >
      <CheckCircle2 className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div className="flex-1">
        <p className="font-semibold text-sm">{message}</p>
        {description && <p className="text-xs text-emerald-100 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => { setFading(true); setTimeout(() => { setVisible(false); onClose?.(); }, 400); }}
        className="text-white/70 hover:text-white transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}