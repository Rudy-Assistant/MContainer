'use client';

/**
 * SkinEditor.tsx — Context-sensitive left panel for editing SceneObject skins.
 *
 * Task 14: Appears when a SceneObject is selected (selectedObjectId in uiSlice).
 * Shows form name, style label, skin slot dropdowns, quick skin presets,
 * form-specific controls (doors: state/flip, lights: brightness/color temp),
 * and duplicate/remove actions.
 */

import { useMemo, useCallback, CSSProperties } from 'react';
import { useStore } from '@/store/useStore';
import { formRegistry } from '@/config/formRegistry';
import { materialRegistry } from '@/config/materialRegistry';
import { getStyle, getQuickSkins } from '@/config/styleRegistry';
import type { FormDefinition, QuickSkinPreset, StyleId } from '@/types/sceneObject';

// ── Styles ───────────────────────────────────────────────────

const panelStyle: CSSProperties = {
  position: 'fixed',
  top: 60,
  left: 12,
  zIndex: 100,
  width: 280,
  maxHeight: 'calc(100vh - 80px)',
  overflowY: 'auto',
  background: 'rgba(0, 0, 0, 0.85)',
  borderRadius: 12,
  padding: '14px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  border: '1px solid rgba(255,255,255,0.1)',
  userSelect: 'none',
  color: '#e2e8f0',
  fontSize: 13,
  scrollbarWidth: 'thin',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const closeBtnStyle: CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#94a3b8',
  fontSize: 18,
  cursor: 'pointer',
  padding: '2px 6px',
  borderRadius: 4,
  lineHeight: 1,
};

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
  flex: 1,
  padding: '6px 10px',
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

// ── Helpers ──────────────────────────────────────────────────

/** Get a readable color swatch from a material ID. */
function matColor(matId: string): string {
  return materialRegistry.get(matId)?.color ?? '#555';
}

// ── Component ────────────────────────────────────────────────

export default function SkinEditor() {
  const selectedObjectId = useStore((s) => s.selectedObjectId);
  const sceneObjects = useStore((s) => s.sceneObjects);
  const activeStyle = useStore((s) => s.activeStyle);
  const selectObject = useStore((s) => s.selectObject);
  const updateSkin = useStore((s) => s.updateSkin);
  const applyQuickSkin = useStore((s) => s.applyQuickSkin);
  const updateObjectState = useStore((s) => s.updateObjectState);
  const removeObject = useStore((s) => s.removeObject);
  const duplicateObject = useStore((s) => s.duplicateObject);

  // Derive the selected object and its form definition
  const obj = selectedObjectId ? sceneObjects[selectedObjectId] : null;
  const form: FormDefinition | undefined = obj ? formRegistry.get(obj.formId) : undefined;
  const styleDef = getStyle(activeStyle);
  const quickSkins = useMemo(() => getQuickSkins(activeStyle), [activeStyle]);

  // ── Callbacks ────────────────────────────────────────────
  const handleClose = useCallback(() => selectObject(null), [selectObject]);

  const handleSkinChange = useCallback(
    (slotId: string, materialId: string) => {
      if (selectedObjectId) updateSkin(selectedObjectId, slotId, materialId);
    },
    [selectedObjectId, updateSkin],
  );

  const handleQuickSkin = useCallback(
    (preset: QuickSkinPreset) => {
      if (selectedObjectId) applyQuickSkin(selectedObjectId, preset.slots);
    },
    [selectedObjectId, applyQuickSkin],
  );

  const handleStateChange = useCallback(
    (key: string, value: unknown) => {
      if (selectedObjectId) updateObjectState(selectedObjectId, key, value);
    },
    [selectedObjectId, updateObjectState],
  );

  const handleDuplicate = useCallback(() => {
    if (!obj) return;
    // Duplicate to adjacent slot (slot + slotWidth)
    const newAnchor = {
      ...obj.anchor,
      slot: (obj.anchor.slot ?? 0) + (form?.slotWidth ?? 1),
    };
    duplicateObject(obj.id, newAnchor);
  }, [obj, form, duplicateObject]);

  const handleRemove = useCallback(() => {
    if (!selectedObjectId) return;
    removeObject(selectedObjectId);
    selectObject(null);
  }, [selectedObjectId, removeObject, selectObject]);

  // ── Bail if nothing selected ─────────────────────────────
  if (!obj || !form) return null;

  const currentSkin = obj.skin;
  const objState = obj.state ?? {};

  return (
    <div style={panelStyle}>
      {/* Header: form name + close */}
      <div style={headerStyle}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{form.name}</div>
          {styleDef && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {styleDef.label}
            </div>
          )}
        </div>
        <button style={closeBtnStyle} onClick={handleClose} title="Deselect object">
          ✕
        </button>
      </div>

      <div style={dividerStyle} />

      {/* Skin Slots */}
      <div style={sectionLabelStyle}>Materials</div>
      {form.skinSlots.map((slot) => {
        const currentMat = currentSkin[slot.id] ?? form.defaultSkin[slot.id] ?? '';
        return (
          <div key={slot.id} style={slotRowStyle}>
            <span style={{ fontSize: 12, minWidth: 60 }}>{slot.label}</span>
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: matColor(currentMat),
                border: '1px solid rgba(255,255,255,0.2)',
                flexShrink: 0,
              }}
            />
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
          <div style={dividerStyle} />
          <div style={sectionLabelStyle}>Quick Skins</div>
          <div style={quickSkinRowStyle}>
            {quickSkins.slice(0, 5).map((preset) => {
              // Build a gradient swatch from preset slot colors
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

      {/* Form-specific controls */}
      {form.category === 'door' && (
        <>
          <div style={dividerStyle} />
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
      )}

      {form.category === 'light' && (
        <>
          <div style={dividerStyle} />
          <div style={sectionLabelStyle}>Light Controls</div>
          <div style={controlRowStyle}>
            <span style={{ fontSize: 12, minWidth: 70 }}>Brightness</span>
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
            <span style={{ fontSize: 12, minWidth: 70 }}>Color Temp</span>
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
      )}

      {/* Actions */}
      <div style={dividerStyle} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={actionBtnStyle} onClick={handleDuplicate}>
          Duplicate
        </button>
        <button style={removeBtnStyle} onClick={handleRemove}>
          Remove
        </button>
      </div>
    </div>
  );
}
