'use client';

import type { ReactNode } from 'react';

interface PresetCardProps {
  content: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export function PresetCard({
  content, label, active, onClick, onMouseEnter, onMouseLeave,
}: PresetCardProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        aspectRatio: '1',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        border: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        borderRadius: 6,
        background: 'var(--surface)',
        cursor: 'pointer',
        padding: 4,
        transition: 'border-color 100ms',
        width: '100%',
      }}
    >
      <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {content}
      </span>
      <span style={{
        fontSize: 10,
        color: active ? 'var(--text-main)' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
        lineHeight: 1.3,
        textAlign: 'center',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
      }}>
        {label}
      </span>
    </button>
  );
}
