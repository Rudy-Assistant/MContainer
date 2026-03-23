'use client';

/**
 * BottomPanel.tsx — Form picker strip (bottom of canvas, sidebar-aware).
 *
 * Icon tab row above scrollable card strip with SVG thumbnails.
 * Auto-syncs active category when a SceneObject is selected in 3D.
 */

import { useState, useMemo, useCallback, useEffect, CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { formRegistry, getByCategory } from '@/config/formRegistry';
import type { FormCategory } from '@/types/sceneObject';
import FormThumbnail from '@/components/ui/FormThumbnails';
import { DoorOpen, AppWindow, Lightbulb, Plug } from 'lucide-react';
import { HIGHLIGHT_COLOR_SELECT } from '@/config/highlightColors';

// ── Constants ─────────────────────────────────────────────────

const CATEGORIES: { id: FormCategory; label: string; Icon: React.ComponentType<{ size?: number }> }[] = [
  { id: 'door', label: 'Doors', Icon: DoorOpen },
  { id: 'window', label: 'Windows', Icon: AppWindow },
  { id: 'light', label: 'Lights', Icon: Lightbulb },
  { id: 'electrical', label: 'Electrical', Icon: Plug },
];

const SIDEBAR_WIDTH_EXPANDED = 384;
const SIDEBAR_WIDTH_COLLAPSED = 48;

const COST_DOT = '\u25CF';
function costDots(cost: number): number {
  return Math.min(5, Math.ceil(cost / 500));
}

// ── Styles ────────────────────────────────────────────────────

const wrapperStyle: CSSProperties = {
  position: 'fixed',
  bottom: 48,
  // `left` is set dynamically via inline style override
  transform: 'translateX(-50%)',
  zIndex: 100,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  userSelect: 'none',
};

const tabRowStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  justifyContent: 'center',
};

const tabBtnStyle = (active: boolean): CSSProperties => ({
  width: 28,
  height: 28,
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: active ? 'rgba(59, 130, 246, 0.25)' : 'transparent',
  color: active ? '#93c5fd' : 'rgba(255,255,255,0.4)',
  transition: 'all 100ms ease',
});

const cardBarStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  maxWidth: '80vw',
  background: 'rgba(0, 0, 0, 0.85)',
  borderRadius: 12,
  padding: '6px 10px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  border: '1px solid rgba(255,255,255,0.08)',
  backdropFilter: 'blur(12px)',
};

const cardScrollStyle: CSSProperties = {
  display: 'flex',
  gap: 4,
  overflowX: 'auto',
  scrollbarWidth: 'none',
  flex: 1,
  minWidth: 0,
};

const cardStyle = (active: boolean, isSelected: boolean): CSSProperties => ({
  minWidth: 80,
  height: 64,
  flexShrink: 0,
  borderRadius: 6,
  border: isSelected
    ? `1.5px solid ${HIGHLIGHT_COLOR_SELECT}`
    : active
    ? '1.5px solid #60a5fa'
    : '1.5px solid rgba(255,255,255,0.08)',
  background: isSelected
    ? 'rgba(0, 188, 212, 0.15)'
    : active
    ? 'rgba(59, 130, 246, 0.2)'
    : 'rgba(255,255,255,0.04)',
  cursor: 'pointer',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  padding: '4px 6px',
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

const dividerStyle: CSSProperties = {
  width: 1,
  height: 40,
  background: 'rgba(255,255,255,0.12)',
  flexShrink: 0,
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

const selectedBadgeStyle: CSSProperties = {
  ...placingBadgeStyle,
  color: HIGHLIGHT_COLOR_SELECT,
  background: 'rgba(0, 188, 212, 0.12)',
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
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const selectedFormId = useStore((s) =>
    s.selectedObjectId ? s.sceneObjects[s.selectedObjectId]?.formId ?? null : null
  );

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;
  const forms = useMemo(() => getByCategory(category), [category]);

  // Auto-sync category when a SceneObject is selected
  useEffect(() => {
    if (selectedFormId) {
      const form = formRegistry.get(selectedFormId);
      if (form) setCategory(form.category);
    }
  }, [selectedFormId]);

  const handleCardClick = useCallback((formId: string) => {
    const { activePlacementFormId: current, setPlacementMode, setHoveredFormId } = useStore.getState();
    setHoveredFormId(null);
    setPlacementMode(current === formId ? null : formId);
  }, []);

  // CSS calc centers the bar over the canvas area (viewport minus sidebar)
  const panelPositionStyle = useMemo<CSSProperties>(() => ({
    ...wrapperStyle,
    left: `calc(${sidebarWidth}px + (100vw - ${sidebarWidth}px) / 2)`,
  }), [sidebarWidth]);

  // Badge logic: placing takes priority over selection
  const placingForm = activePlacementFormId ? formRegistry.get(activePlacementFormId) : null;
  const selectedForm = selectedFormId ? formRegistry.get(selectedFormId) : null;

  return (
    <div style={panelPositionStyle}>
      {/* Icon tab row */}
      <div style={tabRowStyle}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            style={tabBtnStyle(category === cat.id)}
            onClick={() => setCategory(cat.id)}
            title={cat.label}
          >
            <cat.Icon size={16} />
          </button>
        ))}
      </div>

      {/* Card bar */}
      <div style={cardBarStyle}>
        <div style={cardScrollStyle}>
          {forms.map((f) => {
            const isPlacing = activePlacementFormId === f.id;
            const isSelected = !isPlacing && selectedFormId === f.id;
            return (
              <button
                key={f.id}
                style={cardStyle(isPlacing, isSelected)}
                onClick={() => handleCardClick(f.id)}
                onMouseEnter={() => {
                  if (!useStore.getState().activePlacementFormId) {
                    useStore.getState().setHoveredFormId(f.id);
                  }
                }}
                onMouseLeave={() => {
                  useStore.getState().setHoveredFormId(null);
                }}
                title={`${f.name} — $${f.costEstimate}`}
              >
                <div style={{ color: isPlacing ? '#93c5fd' : isSelected ? HIGHLIGHT_COLOR_SELECT : 'rgba(255,255,255,0.5)' }}>
                  <FormThumbnail formId={f.id} size={28} />
                </div>
                <span style={{ ...cardNameStyle, color: isPlacing ? '#93c5fd' : isSelected ? HIGHLIGHT_COLOR_SELECT : undefined }}>
                  {f.name}
                </span>
                <span style={{ ...cardCostStyle, color: isPlacing ? '#fbbf24' : undefined }}>
                  {COST_DOT.repeat(costDots(f.costEstimate))}
                </span>
              </button>
            );
          })}
        </div>

        {/* Badge area: placing or selected */}
        {(placingForm || (selectedForm && !activePlacementFormId)) && (
          <>
            <div style={dividerStyle} />
            {placingForm ? (
              <div style={placingBadgeStyle}>
                {placingForm.name}
                <button
                  onClick={() => useStore.getState().setPlacementMode(null)}
                  style={cancelBtnStyle}
                >
                  ✕
                </button>
              </div>
            ) : selectedForm ? (
              <div style={selectedBadgeStyle}>
                ● {selectedForm.name}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
