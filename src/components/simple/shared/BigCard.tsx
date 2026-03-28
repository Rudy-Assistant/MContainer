'use client';
import React from 'react';

interface BigCardProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  locked?: boolean;
  lockMessage?: string;
  active?: boolean;
  size?: 'medium' | 'large';
}

export default function BigCard({ icon, label, description, action, locked, lockMessage, active, size = 'medium' }: BigCardProps) {
  const width = size === 'large' ? 140 : 100;

  return (
    <div
      style={{
        width,
        minWidth: width,
        padding: 16,
        borderRadius: 16,
        background: 'var(--surface, #ffffff)',
        border: active ? '3px solid var(--accent, #2563eb)' : '1px solid var(--border, #e2e8f0)',
        opacity: locked ? 0.4 : 1,
        cursor: locked ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        position: 'relative',
        userSelect: 'none',
      }}
      title={locked ? lockMessage : undefined}
    >
      {locked && (
        <div style={{ position: 'absolute', top: 8, right: 8, fontSize: 14 }}>🔒</div>
      )}
      <div style={{ fontSize: size === 'large' ? 48 : 36, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main, #0f172a)', textAlign: 'center' }}>{label}</div>
      {description && (
        <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', textAlign: 'center' }}>{description}</div>
      )}
      {action && !locked && (
        <button
          onClick={(e) => { e.stopPropagation(); action.onClick(); }}
          style={{
            marginTop: 4,
            padding: '6px 16px',
            borderRadius: 8,
            border: 'none',
            background: 'var(--accent, #2563eb)',
            color: '#fff',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
