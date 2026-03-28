'use client';
import { useState, useEffect } from 'react';

interface UnlockToastProps {
  message: string;
  visible: boolean;
  onDone: () => void;
}

export default function UnlockToast({ message, visible, onDone }: UnlockToastProps) {
  useEffect(() => {
    if (visible) {
      const t = setTimeout(onDone, 3000);
      return () => clearTimeout(t);
    }
  }, [visible, onDone]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        background: 'var(--accent, #2563eb)',
        color: '#fff',
        padding: '10px 24px',
        borderRadius: 12,
        fontWeight: 600,
        fontSize: 14,
        boxShadow: '0 4px 20px rgba(37, 99, 235, 0.4)',
        animation: 'slideUp 0.3s ease-out',
        pointerEvents: 'none',
      }}
    >
      {message}
    </div>
  );
}
