'use client';

/**
 * FormCatalog.tsx — Bottom bar UI for browsing and selecting placeable forms.
 *
 * Task 13: Floating bottom bar with category tabs, style filter pills,
 * and a horizontal card carousel. Click a card to enter placement mode.
 */

import { useState, useMemo, useCallback, CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { getByCategory, getByCategoryAndStyle } from '@/config/formRegistry';
import { styleRegistry } from '@/config/styleRegistry';
import type { FormCategory, FormDefinition, StyleId } from '@/types/sceneObject';

// ── Constants ────────────────────────────────────────────────

const CATEGORIES: { id: FormCategory; label: string }[] = [
  { id: 'door', label: 'Doors' },
  { id: 'window', label: 'Windows' },
  { id: 'light', label: 'Lights' },
  { id: 'electrical', label: 'Electrical' },
];

/** Cost dots: 1 dot per $500 increment, capped at 5. */
function costDots(cost: number): number {
  return Math.min(5, Math.ceil(cost / 500));
}

// ── Styles ───────────────────────────────────────────────────

const catalogStyle: CSSProperties = {
  position: 'fixed',
  bottom: 80,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 100,
  maxWidth: 600,
  width: '95vw',
  background: 'rgba(0, 0, 0, 0.85)',
  borderRadius: 12,
  padding: '12px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.1)',
  userSelect: 'none',
};

const tabRowStyle: CSSProperties = {
  display: 'flex',
  gap: 2,
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  paddingBottom: 6,
};

const styleRowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  overflowX: 'auto',
  paddingBottom: 4,
  scrollbarWidth: 'none',
};

const cardRowStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
  overflowX: 'auto',
  paddingBottom: 4,
  scrollbarWidth: 'none',
};

const collapseButtonStyle: CSSProperties = {
  position: 'absolute',
  top: -14,
  right: 16,
  width: 28,
  height: 14,
  borderRadius: '6px 6px 0 0',
  background: 'rgba(0, 0, 0, 0.85)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderBottom: 'none',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(255,255,255,0.5)',
  fontSize: 10,
  padding: 0,
};

// ── Sub-Components ───────────────────────────────────────────

function CategoryTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    padding: '4px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
    fontFamily: 'system-ui, sans-serif',
    letterSpacing: '0.03em',
    color: active ? '#93c5fd' : 'rgba(255,255,255,0.5)',
    background: active ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
    borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent',
    transition: 'all 120ms ease',
  };
  return (
    <button style={style} onClick={onClick}>
      {label}
    </button>
  );
}

function StylePill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    padding: '3px 10px',
    borderRadius: 12,
    border: active ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.15)',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 500,
    fontFamily: 'system-ui, sans-serif',
    color: active ? '#93c5fd' : 'rgba(255,255,255,0.5)',
    background: active ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.04)',
    whiteSpace: 'nowrap',
    transition: 'all 120ms ease',
    flexShrink: 0,
  };
  return (
    <button style={style} onClick={onClick}>
      {label}
    </button>
  );
}

function FormCard({
  form,
  isActive,
  onClick,
}: {
  form: FormDefinition;
  isActive: boolean;
  onClick: () => void;
}) {
  const dots = costDots(form.costEstimate);
  const style: CSSProperties = {
    width: 100,
    height: 80,
    flexShrink: 0,
    borderRadius: 8,
    border: isActive ? '2px solid #60a5fa' : '2px solid rgba(255,255,255,0.08)',
    background: isActive ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.04)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 6,
    transition: 'all 120ms ease',
  };
  return (
    <button style={style} onClick={onClick} title={form.description}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: isActive ? '#93c5fd' : 'rgba(255,255,255,0.75)',
          textAlign: 'center',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {form.name}
      </span>
      <span
        style={{
          fontSize: 10,
          color: isActive ? '#fbbf24' : 'rgba(255, 200, 50, 0.5)',
          letterSpacing: '0.1em',
        }}
      >
        {Array.from({ length: dots }, () => '\u25CF').join('')}
        {Array.from({ length: 5 - dots }, () => '\u25CB').join('')}
      </span>
      <span
        style={{
          fontSize: 9,
          color: 'rgba(255,255,255,0.35)',
          fontFamily: 'monospace',
        }}
      >
        ${form.costEstimate}
      </span>
    </button>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function FormCatalog() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FormCategory>('door');
  const [selectedStyles, setSelectedStyles] = useState<Set<StyleId>>(new Set());

  const activeStyle = useStore((s) => s.activeStyle);
  const activePlacementFormId = useStore((s) => s.activePlacementFormId);

  // Collect styles available for the selected category
  const availableStyles = useMemo(() => {
    const forms = getByCategory(selectedCategory);
    const styleIds = new Set<StyleId>();
    for (const f of forms) {
      for (const s of f.styles) styleIds.add(s);
    }
    // Sort: active style first, then alphabetical by label
    return Array.from(styleIds)
      .map((id) => ({ id, label: styleRegistry.get(id)?.label ?? id }))
      .sort((a, b) => {
        if (a.id === activeStyle) return -1;
        if (b.id === activeStyle) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [selectedCategory, activeStyle]);

  // Filter forms by category + selected styles
  const forms = useMemo(() => {
    if (selectedStyles.size === 0) {
      return getByCategory(selectedCategory);
    }
    const results: FormDefinition[] = [];
    const seen = new Set<string>();
    for (const styleId of selectedStyles) {
      for (const f of getByCategoryAndStyle(selectedCategory, styleId)) {
        if (!seen.has(f.id)) {
          seen.add(f.id);
          results.push(f);
        }
      }
    }
    return results;
  }, [selectedCategory, selectedStyles]);

  const toggleStyle = useCallback((styleId: StyleId) => {
    setSelectedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(styleId)) {
        next.delete(styleId);
      } else {
        next.add(styleId);
      }
      return next;
    });
  }, []);

  const handleCardClick = useCallback((formId: string) => {
    const store = useStore.getState();
    // Toggle off if already active
    if (store.activePlacementFormId === formId) {
      store.setPlacementMode(null);
    } else {
      store.setPlacementMode(formId);
    }
  }, []);

  return (
    <div style={{ position: 'relative' }}>
      {/* Collapse/Expand toggle */}
      <button
        style={collapseButtonStyle}
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand catalog' : 'Collapse catalog'}
      >
        {collapsed ? '\u25B2' : '\u25BC'}
      </button>

      {collapsed ? null : (
        <div style={catalogStyle}>
          {/* Category Tabs */}
          <div style={tabRowStyle}>
            {CATEGORIES.map((cat) => (
              <CategoryTab
                key={cat.id}
                label={cat.label}
                active={selectedCategory === cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSelectedStyles(new Set());
                }}
              />
            ))}
          </div>

          {/* Style Filter Row */}
          {availableStyles.length > 0 && (
            <div style={styleRowStyle}>
              {availableStyles.map((s) => (
                <StylePill
                  key={s.id}
                  label={s.label}
                  active={selectedStyles.has(s.id)}
                  onClick={() => toggleStyle(s.id)}
                />
              ))}
            </div>
          )}

          {/* Form Cards */}
          <div style={cardRowStyle}>
            {forms.length === 0 ? (
              <span
                style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.35)',
                  padding: '12px 0',
                  fontFamily: 'system-ui, sans-serif',
                }}
              >
                No forms match the selected filters.
              </span>
            ) : (
              forms.map((f) => (
                <FormCard
                  key={f.id}
                  form={f}
                  isActive={activePlacementFormId === f.id}
                  onClick={() => handleCardClick(f.id)}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
