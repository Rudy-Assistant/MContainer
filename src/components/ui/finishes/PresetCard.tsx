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

/**
 * Shared preset card: square image area with highlight on image only.
 * Text label sits below, outside the highlight border.
 * Uses native <button> for accessibility (focus, Enter/Space, ARIA).
 */
export function PresetCard({
  content, label, active, onClick, onMouseEnter, onMouseLeave,
}: PresetCardProps) {
  return (
    <button
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        cursor: 'pointer',
        minWidth: 0,
        border: 'none',
        background: 'none',
        padding: 0,
      }}
    >
      {/* Image area — highlight border here only */}
      <div style={{
        aspectRatio: '1',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        borderRadius: 6,
        background: 'var(--surface)',
        overflow: 'hidden',
        transition: 'border-color 100ms',
      }}>
        {content}
      </div>

      {/* Label — outside highlight, no border */}
      <span style={{
        fontSize: 10,
        color: active ? 'var(--text-main)' : 'var(--text-muted)',
        fontWeight: active ? 600 : 400,
        lineHeight: 1.2,
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: '100%',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>
    </button>
  );
}
