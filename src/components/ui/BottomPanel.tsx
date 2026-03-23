'use client';

/**
 * BottomPanel.tsx — Unified bottom drawer combining FormCatalog (Browse)
 * and SkinEditor (Edit) in a Sims 4-style layout.
 *
 * Browse mode: category tabs, style filter pills, horizontal card carousel.
 * Edit mode: skin slot dropdowns, quick skins, form-specific controls, actions.
 *
 * Auto-switches to Edit when a SceneObject is selected; tab strip allows manual switching.
 */

import { useState, useMemo, useCallback, CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { formRegistry, getByCategory, getByCategoryAndStyle } from '@/config/formRegistry';
import { styleRegistry, getStyle, getQuickSkins } from '@/config/styleRegistry';
import { materialRegistry } from '@/config/materialRegistry';
import type { FormCategory, FormDefinition, StyleId, QuickSkinPreset } from '@/types/sceneObject';

// ── Types ─────────────────────────────────────────────────────

type PanelTab = 'browse' | 'edit';

// ── Constants ─────────────────────────────────────────────────

const CATEGORIES: { id: FormCategory; label: string }[] = [
  { id: 'door', label: 'Doors' },
  { id: 'window', label: 'Windows' },
  { id: 'light', label: 'Lights' },
  { id: 'electrical', label: 'Electrical' },
];

const COST_DOT_FILLED = '\u25CF';
const COST_DOT_EMPTY = '\u25CB';

/** Cost dots: 1 dot per $500 increment, capped at 5. */
function costDots(cost: number): number {
  return Math.min(5, Math.ceil(cost / 500));
}

/** Get a readable color swatch from a material ID. */
function matColor(matId: string): string {
  return materialRegistry.get(matId)?.color ?? '#555';
}

// ── Shared Styles ──────────────────────────────────────────────

const FONT_SYSTEM: CSSProperties = {
  fontFamily: 'system-ui, sans-serif',
};

const panelContainerStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  zIndex: 100,
  flexShrink: 0,
};

const panelStyle: CSSProperties = {
  background: 'rgba(0, 0, 0, 0.88)',
  borderTop: '1px solid rgba(255,255,255,0.1)',
  height: 220,
  display: 'flex',
  flexDirection: 'column',
  color: '#e2e8f0',
  fontSize: 13,
  userSelect: 'none',
};

const collapseToggleStyle: CSSProperties = {
  position: 'absolute',
  top: -18,
  right: 20,
  width: 60,
  height: 18,
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
  fontWeight: 600,
  ...FONT_SYSTEM,
  padding: 0,
  letterSpacing: '0.03em',
};

const tabStripStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '6px 16px',
  borderBottom: '1px solid rgba(255,255,255,0.08)',
  flexShrink: 0,
};

const contentAreaStyle: CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  padding: '8px 16px',
  scrollbarWidth: 'thin',
};

// ── Shared PillButton ────────────────────────────────────────
// Replaces both TabButton and CategoryTab (they were near-identical).

function PillButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    padding: '4px 12px',
    borderRadius: 6,
    border: 'none',
    cursor: disabled ? 'default' : 'pointer',
    fontSize: 11,
    fontWeight: 600,
    ...FONT_SYSTEM,
    letterSpacing: '0.03em',
    color: disabled ? 'rgba(255,255,255,0.2)' : active ? '#93c5fd' : 'rgba(255,255,255,0.5)',
    background: active ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
    borderBottom: active ? '2px solid #60a5fa' : '2px solid transparent',
    transition: 'all 120ms ease',
    opacity: disabled ? 0.4 : 1,
  };
  return (
    <button style={style} onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ── Placing Badge ─────────────────────────────────────────────

const placingBadgeStyle: CSSProperties = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontWeight: 600,
  ...FONT_SYSTEM,
  color: '#fbbf24',
  background: 'rgba(251, 191, 36, 0.12)',
  borderRadius: 6,
  padding: '3px 10px',
};

const cancelBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#fbbf24',
  fontSize: 14,
  cursor: 'pointer',
  padding: '0 2px',
  lineHeight: 1,
};

// ══════════════════════════════════════════════════════════════
// ── Browse Content (FormCatalog) ─────────────────────────────
// ══════════════════════════════════════════════════════════════

const scrollRowStyle: CSSProperties = {
  display: 'flex',
  overflowX: 'auto',
  scrollbarWidth: 'none',
};

const browseTabRowStyle: CSSProperties = {
  ...scrollRowStyle,
  gap: 2,
  paddingBottom: 6,
};

const browseStyleRowStyle: CSSProperties = {
  ...scrollRowStyle,
  gap: 6,
  paddingBottom: 6,
};

const browseCardRowStyle: CSSProperties = {
  ...scrollRowStyle,
  gap: 8,
  paddingBottom: 4,
};

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
    ...FONT_SYSTEM,
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

// ── FormCard styles (hoisted to avoid per-render allocation) ──

const cardNameStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textAlign: 'center',
  lineHeight: 1.2,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
  ...FONT_SYSTEM,
};

const cardCostStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: '0.1em',
};

const cardPriceStyle: CSSProperties = {
  fontSize: 9,
  color: 'rgba(255,255,255,0.35)',
  fontFamily: 'monospace',
};

const emptyStateStyle: CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.35)',
  padding: '12px 0',
  ...FONT_SYSTEM,
};

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
      <span style={{ ...cardNameStyle, color: isActive ? '#93c5fd' : 'rgba(255,255,255,0.75)' }}>
        {form.name}
      </span>
      <span style={{ ...cardCostStyle, color: isActive ? '#fbbf24' : 'rgba(255, 200, 50, 0.5)' }}>
        {COST_DOT_FILLED.repeat(dots)}{COST_DOT_EMPTY.repeat(5 - dots)}
      </span>
      <span style={cardPriceStyle}>
        ${form.costEstimate}
      </span>
    </button>
  );
}

function BrowseContent() {
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
    const { activePlacementFormId: current, setPlacementMode } = useStore.getState();
    setPlacementMode(current === formId ? null : formId);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {/* Category Tabs */}
      <div style={browseTabRowStyle}>
        {CATEGORIES.map((cat) => (
          <PillButton
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
        <div style={browseStyleRowStyle}>
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
      <div style={browseCardRowStyle}>
        {forms.length === 0 ? (
          <span style={emptyStateStyle}>
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
  );
}

// ══════════════════════════════════════════════════════════════
// ── Edit Content (SkinEditor) ────────────────────────────────
// ══════════════════════════════════════════════════════════════

const sectionLabelStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  padding: '4px 0 2px',
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: 'rgba(255,255,255,0.1)',
  flexShrink: 0,
};

const slotRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
};

const selectStyle: CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 6,
  color: '#e2e8f0',
  fontSize: 12,
  padding: '4px 6px',
  cursor: 'pointer',
};

const quickSkinRowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
};

const quickBtnStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 8,
  border: '2px solid rgba(255,255,255,0.15)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 600,
  color: '#e2e8f0',
  transition: 'border-color 0.15s',
};

const controlRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
};

const actionBtnStyle: CSSProperties = {
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(255,255,255,0.06)',
  color: '#e2e8f0',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'center',
};

const removeBtnStyle: CSSProperties = {
  ...actionBtnStyle,
  borderColor: 'rgba(239,68,68,0.4)',
  color: '#fca5a5',
};

const editEmptyStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  color: 'rgba(255,255,255,0.3)',
  fontSize: 12,
};

const editColumnsStyle: CSSProperties = {
  display: 'flex',
  gap: 16,
  height: '100%',
};

const editLeftColStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflowY: 'auto',
  scrollbarWidth: 'thin',
};

const editRightColStyle: CSSProperties = {
  width: 200,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  flexShrink: 0,
  borderLeft: '1px solid rgba(255,255,255,0.08)',
  paddingLeft: 16,
};

const editHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const colorSwatchStyle: CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: 4,
  border: '1px solid rgba(255,255,255,0.2)',
  flexShrink: 0,
};

const actionRowStyle: CSSProperties = {
  marginTop: 'auto',
  display: 'flex',
  gap: 8,
  paddingTop: 8,
};

const noControlsStyle: CSSProperties = {
  fontSize: 11,
  color: 'rgba(255,255,255,0.3)',
  paddingTop: 4,
};

function EditContent() {
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const obj = useStore((s) => selectedObjectId ? s.sceneObjects[selectedObjectId] : null);
  const activeStyle = useStore((s) => s.activeStyle);

  const form: FormDefinition | undefined = obj ? formRegistry.get(obj.formId) : undefined;
  const styleDef = getStyle(activeStyle);
  const quickSkins = useMemo(() => getQuickSkins(activeStyle), [activeStyle]);

  // Actions read from getState() in callbacks — no need to subscribe to stable function refs
  const handleSkinChange = useCallback(
    (slotId: string, materialId: string) => {
      if (selectedObjectId) useStore.getState().updateSkin(selectedObjectId, slotId, materialId);
    },
    [selectedObjectId],
  );

  const handleQuickSkin = useCallback(
    (preset: QuickSkinPreset) => {
      if (selectedObjectId) useStore.getState().applyQuickSkin(selectedObjectId, preset.slots);
    },
    [selectedObjectId],
  );

  const handleStateChange = useCallback(
    (key: string, value: unknown) => {
      if (selectedObjectId) useStore.getState().updateObjectState(selectedObjectId, key, value);
    },
    [selectedObjectId],
  );

  const handleDuplicate = useCallback(() => {
    if (!obj || !form) return;
    const newAnchor = {
      ...obj.anchor,
      slot: (obj.anchor.slot ?? 0) + (form.slotWidth ?? 1),
    };
    useStore.getState().duplicateObject(obj.id, newAnchor);
  }, [obj, form]);

  const handleRemove = useCallback(() => {
    if (!selectedObjectId) return;
    const store = useStore.getState();
    store.removeObject(selectedObjectId);
    store.selectObject(null);
  }, [selectedObjectId]);

  if (!obj || !form) {
    return (
      <div style={editEmptyStyle}>
        Select an object to edit its properties.
      </div>
    );
  }

  const currentSkin = obj.skin;
  const objState = obj.state ?? {};

  return (
    <div style={editColumnsStyle}>
      {/* Left column: header + materials */}
      <div style={editLeftColStyle}>
        {/* Header */}
        <div style={editHeaderStyle}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{form.name}</div>
            {styleDef && (
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
                {styleDef.label}
              </div>
            )}
          </div>
        </div>

        {/* Skin Slots */}
        <div style={sectionLabelStyle}>Materials</div>
        {form.skinSlots.map((slot) => {
          const currentMat = currentSkin[slot.id] ?? form.defaultSkin[slot.id] ?? '';
          return (
            <div key={slot.id} style={slotRowStyle}>
              <span style={{ fontSize: 12, minWidth: 55 }}>{slot.label}</span>
              <div style={{ ...colorSwatchStyle, background: matColor(currentMat) }} />
              <select
                style={selectStyle}
                value={currentMat}
                onChange={(e) => handleSkinChange(slot.id, e.target.value)}
              >
                {slot.materialOptions.map((matId) => {
                  const mat = materialRegistry.get(matId);
                  return (
                    <option key={matId} value={matId}>
                      {mat?.label ?? matId}
                    </option>
                  );
                })}
              </select>
            </div>
          );
        })}

        {/* Quick Skins */}
        {quickSkins.length > 0 && (
          <>
            <div style={sectionLabelStyle}>Quick Skins</div>
            <div style={quickSkinRowStyle}>
              {quickSkins.slice(0, 5).map((preset) => {
                const colors = Object.values(preset.slots).map(matColor);
                const bg =
                  colors.length > 1
                    ? `linear-gradient(135deg, ${colors.join(', ')})`
                    : colors[0] ?? '#555';
                return (
                  <button
                    key={preset.id}
                    style={{ ...quickBtnStyle, background: bg }}
                    title={preset.label}
                    onClick={() => handleQuickSkin(preset)}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Right column: form controls + actions */}
      <div style={editRightColStyle}>
        {/* Form-specific controls via switch for exhaustiveness */}
        {(() => {
          switch (form.category) {
            case 'door':
              return (
                <>
                  <div style={sectionLabelStyle}>Door Controls</div>
                  <div style={controlRowStyle}>
                    <span style={{ fontSize: 12 }}>State</span>
                    <select
                      style={selectStyle}
                      value={(objState.doorState as string) ?? 'closed'}
                      onChange={(e) => handleStateChange('doorState', e.target.value)}
                    >
                      <option value="closed">Closed</option>
                      <option value="open">Open</option>
                    </select>
                  </div>
                  <div style={controlRowStyle}>
                    <span style={{ fontSize: 12 }}>Flip</span>
                    <input
                      type="checkbox"
                      checked={!!objState.flip}
                      onChange={(e) => handleStateChange('flip', e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                  </div>
                </>
              );
            case 'light':
              return (
                <>
                  <div style={sectionLabelStyle}>Light Controls</div>
                  <div style={controlRowStyle}>
                    <span style={{ fontSize: 12, minWidth: 65 }}>Brightness</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={(objState.brightness as number) ?? 80}
                      onChange={(e) => handleStateChange('brightness', Number(e.target.value))}
                      style={{ flex: 1, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 28, textAlign: 'right' }}>
                      {(objState.brightness as number) ?? 80}%
                    </span>
                  </div>
                  <div style={controlRowStyle}>
                    <span style={{ fontSize: 12, minWidth: 65 }}>Color Temp</span>
                    <input
                      type="range"
                      min={2700}
                      max={6500}
                      step={100}
                      value={(objState.colorTemp as number) ?? 4000}
                      onChange={(e) => handleStateChange('colorTemp', Number(e.target.value))}
                      style={{ flex: 1, cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 40, textAlign: 'right' }}>
                      {(objState.colorTemp as number) ?? 4000}K
                    </span>
                  </div>
                </>
              );
            case 'window':
            case 'electrical':
            default:
              return (
                <div style={noControlsStyle}>
                  No additional controls for {form.category}.
                </div>
              );
          }
        })()}

        {/* Actions — pushed to bottom */}
        <div style={actionRowStyle}>
          <button style={actionBtnStyle} onClick={handleDuplicate}>
            Duplicate
          </button>
          <button style={removeBtnStyle} onClick={handleRemove}>
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── Main BottomPanel Component ───────────────────────────────
// ══════════════════════════════════════════════════════════════

export default function BottomPanel() {
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const activePlacementFormId = useStore((s) => s.activePlacementFormId);
  const [collapsed, setCollapsed] = useState(false);

  // Auto-switch to edit tab when object selected
  const [manualTab, setManualTab] = useState<PanelTab>('browse');
  const activeTab: PanelTab = selectedObjectId ? 'edit' : manualTab;

  return (
    <div style={panelContainerStyle}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={collapseToggleStyle}
        title={collapsed ? 'Expand panel' : 'Collapse panel'}
      >
        {collapsed ? '\u25B2 Objects' : '\u25BC'}
      </button>

      {!collapsed && (
        <div style={panelStyle}>
          {/* Tab strip */}
          <div style={tabStripStyle}>
            <PillButton
              label="Browse"
              active={activeTab === 'browse'}
              onClick={() => {
                setManualTab('browse');
                if (selectedObjectId) useStore.getState().selectObject(null);
              }}
            />
            <PillButton
              label="Edit"
              active={activeTab === 'edit'}
              disabled={!selectedObjectId}
              onClick={() => setManualTab('edit')}
            />
            {activePlacementFormId && (
              <div style={placingBadgeStyle}>
                Placing: {formRegistry.get(activePlacementFormId)?.name ?? activePlacementFormId}
                <button
                  onClick={() => useStore.getState().setPlacementMode(null)}
                  style={cancelBtnStyle}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Content area */}
          <div style={contentAreaStyle}>
            {activeTab === 'browse' ? <BrowseContent /> : <EditContent />}
          </div>
        </div>
      )}
    </div>
  );
}
