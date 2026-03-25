'use client';

/**
 * BottomPanel.tsx — Form picker strip (bottom of canvas, sidebar-aware).
 *
 * Icon tab row above scrollable card strip with SVG thumbnails.
 * Auto-syncs active category when a SceneObject is selected in 3D.
 */

import { useState, useMemo, useCallback, useEffect, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

// ── Styles ────────────────────────────────────────────────────

const wrapperStyle: CSSProperties = {
  position: 'fixed',
  bottom: 8,
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
  maxWidth: '100%',
  background: 'rgba(0, 0, 0, 0.6)',
  borderRadius: 12,
  padding: '6px 10px',
  boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
  border: '1px solid rgba(255,255,255,0.06)',
  backdropFilter: 'blur(16px)',
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
  minWidth: 100,
  height: 80,
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
    : 'rgba(0,0,0,0.35)',
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
  fontSize: 12,
  fontWeight: 800,
  color: '#ffffff',
  textAlign: 'center',
  lineHeight: 1.15,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  fontFamily: 'system-ui, sans-serif',
  textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.4)',
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
  const ITEMS_PER_PAGE = 6;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(forms.length / ITEMS_PER_PAGE);
  const visibleForms = forms.slice(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE);
  // Reset page when category changes
  useEffect(() => setPage(0), [category]);

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

  // Position bar within the canvas area (right of sidebar), constrained to not overlap
  const panelPositionStyle = useMemo<CSSProperties>(() => ({
    ...wrapperStyle,
    left: `calc(${sidebarWidth}px + (100vw - ${sidebarWidth}px) / 2)`,
    maxWidth: `calc(100vw - ${sidebarWidth}px - 24px)`,
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

      {/* Card bar with pagination */}
      <div style={cardBarStyle}>
        {/* Prev page arrow */}
        {totalPages > 1 && (
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{
              background: 'none', border: 'none', cursor: page === 0 ? 'default' : 'pointer',
              color: page === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
              padding: 2, flexShrink: 0, display: 'flex', alignItems: 'center',
            }}
            title="Previous"
          >
            <ChevronLeft size={18} />
          </button>
        )}

        <div style={{ ...cardScrollStyle, overflowX: 'hidden' }}>
          {visibleForms.map((f) => {
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
                <div style={{ color: isPlacing ? '#93c5fd' : isSelected ? HIGHLIGHT_COLOR_SELECT : 'rgba(255,255,255,0.6)' }}>
                  <FormThumbnail formId={f.id} size={32} />
                </div>
                <span style={{ ...cardNameStyle, color: isPlacing ? '#93c5fd' : isSelected ? HIGHLIGHT_COLOR_SELECT : undefined }}>
                  {f.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Next page arrow */}
        {totalPages > 1 && (
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{
              background: 'none', border: 'none', cursor: page >= totalPages - 1 ? 'default' : 'pointer',
              color: page >= totalPages - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
              padding: 2, flexShrink: 0, display: 'flex', alignItems: 'center',
            }}
            title="Next"
          >
            <ChevronRight size={18} />
          </button>
        )}

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
