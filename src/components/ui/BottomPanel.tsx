'use client';

/**
 * BottomPanel.tsx — Thin form picker strip (64px, bottom of canvas).
 *
 * Category pills + horizontal card row. Click a card → enter placement mode.
 * No style filters, no edit tab — skin editing lives in the Sidebar Inspector.
 */

import { useState, useMemo, useCallback, CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { formRegistry, getByCategory } from '@/config/formRegistry';
import type { FormCategory, FormDefinition } from '@/types/sceneObject';

// ── Constants ─────────────────────────────────────────────────

const CATEGORIES: { id: FormCategory; label: string }[] = [
  { id: 'door', label: 'Doors' },
  { id: 'window', label: 'Windows' },
  { id: 'light', label: 'Lights' },
  { id: 'electrical', label: 'Elec' },
];

const COST_DOT = '\u25CF';

function costDots(cost: number): number {
  return Math.min(5, Math.ceil(cost / 500));
}

// ── Styles ────────────────────────────────────────────────────

const barStyle: CSSProperties = {
  position: 'fixed',
  bottom: 48,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 100,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 56,
  maxWidth: '90vw',
  background: 'rgba(0, 0, 0, 0.85)',
  borderRadius: 12,
  padding: '0 10px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.08)',
  userSelect: 'none',
  backdropFilter: 'blur(12px)',
};

const pillStyle = (active: boolean): CSSProperties => ({
  padding: '3px 8px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  fontSize: 10,
  fontWeight: 600,
  fontFamily: 'system-ui, sans-serif',
  letterSpacing: '0.03em',
  color: active ? '#93c5fd' : 'rgba(255,255,255,0.5)',
  background: active ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
  transition: 'all 100ms ease',
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

const dividerLineStyle: CSSProperties = {
  width: 1,
  height: 32,
  background: 'rgba(255,255,255,0.12)',
  flexShrink: 0,
};

const cardRowStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  flex: 1,
  minWidth: 0,
};

const cardStyle = (active: boolean): CSSProperties => ({
  minWidth: 68,
  height: 40,
  flexShrink: 0,
  borderRadius: 6,
  border: active ? '1.5px solid #60a5fa' : '1.5px solid rgba(255,255,255,0.08)',
  background: active ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.04)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  padding: '2px 6px',
  transition: 'all 100ms ease',
});

const cardNameStyle: CSSProperties = {
  fontSize: 9,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.75)',
  textAlign: 'center',
  lineHeight: 1.1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  fontFamily: 'system-ui, sans-serif',
};

const cardCostStyle: CSSProperties = {
  fontSize: 8,
  color: 'rgba(255, 200, 50, 0.5)',
  letterSpacing: '0.05em',
};

const placingBadgeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 10,
  fontWeight: 600,
  fontFamily: 'system-ui, sans-serif',
  color: '#fbbf24',
  background: 'rgba(251, 191, 36, 0.12)',
  borderRadius: 6,
  padding: '3px 8px',
  flexShrink: 0,
  whiteSpace: 'nowrap',
};

const cancelBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#fbbf24',
  fontSize: 12,
  cursor: 'pointer',
  padding: '0 1px',
  lineHeight: 1,
};

// ── Component ─────────────────────────────────────────────────

export default function BottomPanel() {
  const [category, setCategory] = useState<FormCategory>('door');
  const activePlacementFormId = useStore((s) => s.activePlacementFormId);

  const forms = useMemo(() => getByCategory(category), [category]);

  const handleCardClick = useCallback((formId: string) => {
    const { activePlacementFormId: current, setPlacementMode } = useStore.getState();
    setPlacementMode(current === formId ? null : formId);
  }, []);

  return (
    <div style={barStyle}>
      {/* Category pills */}
      {CATEGORIES.map((cat) => (
        <button
          key={cat.id}
          style={pillStyle(category === cat.id)}
          onClick={() => setCategory(cat.id)}
        >
          {cat.label}
        </button>
      ))}

      <div style={dividerLineStyle} />

      {/* Form cards */}
      <div style={cardRowStyle}>
        {forms.map((f) => {
          const active = activePlacementFormId === f.id;
          const dots = costDots(f.costEstimate);
          return (
            <button
              key={f.id}
              style={cardStyle(active)}
              onClick={() => handleCardClick(f.id)}
              title={`${f.name} — $${f.costEstimate}`}
            >
              <span style={{ ...cardNameStyle, color: active ? '#93c5fd' : undefined }}>
                {f.name}
              </span>
              <span style={{ ...cardCostStyle, color: active ? '#fbbf24' : undefined }}>
                {COST_DOT.repeat(dots)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Placing badge */}
      {activePlacementFormId && (
        <>
          <div style={dividerLineStyle} />
          <div style={placingBadgeStyle}>
            {formRegistry.get(activePlacementFormId)?.name ?? 'Placing'}
            <button
              onClick={() => useStore.getState().setPlacementMode(null)}
              style={cancelBtnStyle}
            >
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}
