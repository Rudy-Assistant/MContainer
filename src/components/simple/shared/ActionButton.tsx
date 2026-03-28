'use client';
import React from 'react';

interface ActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'medium' | 'large';
  disabled?: boolean;
}

const VARIANT_STYLES = {
  primary: { bg: 'var(--accent, #2563eb)', color: '#fff', border: 'none' },
  secondary: { bg: 'transparent', color: 'var(--text-main, #0f172a)', border: '2px solid var(--border, #e2e8f0)' },
  danger: { bg: '#ef4444', color: '#fff', border: 'none' },
};

export default function ActionButton({ icon, label, onClick, variant = 'secondary', size = 'medium', disabled }: ActionButtonProps) {
  const s = VARIANT_STYLES[variant];
  const height = size === 'large' ? 56 : 44;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height,
        minHeight: height,
        padding: '0 16px',
        borderRadius: 12,
        background: s.bg,
        color: s.color,
        border: s.border,
        fontWeight: 600,
        fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  );
}
