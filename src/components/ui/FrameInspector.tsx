'use client';
import { useStore } from '@/store/useStore';
import {
  POLE_MATERIALS, POLE_SHAPES, RAIL_MATERIALS, RAIL_SHAPES,
  resolveFrameProperty,
} from '@/config/frameMaterials';

/** Labeled select dropdown — shared across element and defaults views */
function FieldRow({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[];
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: 4 }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

/** Frame element detail view + container-level defaults */
export function FrameInspector({ containerId }: { containerId: string }) {
  const container = useStore((s) => s.containers[containerId]);
  const selectedFrameElement = useStore((s) => s.selectedFrameElement);
  const setFrameDefaults = useStore((s) => s.setFrameDefaults);
  const setFrameElementOverride = useStore((s) => s.setFrameElementOverride);
  const clearFrameElementOverride = useStore((s) => s.clearFrameElementOverride);
  const setFrameMode = useStore((s) => s.setFrameMode);

  if (!container) return null;

  const defaults = container.frameDefaults;
  const sel = selectedFrameElement?.containerId === containerId ? selectedFrameElement : null;

  const override = sel
    ? sel.type === 'pole'
      ? container.poleOverrides?.[sel.key]
      : container.railOverrides?.[sel.key]
    : null;

  const materials = sel?.type === 'pole' ? POLE_MATERIALS : RAIL_MATERIALS;
  const shapes = sel?.type === 'pole' ? POLE_SHAPES : RAIL_SHAPES;

  const currentMaterial = sel ? resolveFrameProperty(override ?? undefined, defaults, sel.type, 'material') : '';
  const currentShape = sel ? resolveFrameProperty(override ?? undefined, defaults, sel.type, 'shape') : '';

  const isVisible = override?.visible !== false;

  const label = sel
    ? sel.type === 'pole'
      ? `Pole at ${sel.key.replace(/^l\d+/, '').replace(/r(\d+)c(\d+)_(\w+)/, 'R$1 C$2 ($3)')}`
      : `Rail ${sel.key.replace(/r(\d+)c(\d+)_(\w)/, 'R$1 C$2 ($3)')}`
    : null;

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      {/* Exit frame mode */}
      <button
        onClick={() => setFrameMode(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4, width: '100%',
          padding: '6px 8px', marginBottom: 8, borderRadius: 6,
          border: '1px solid var(--border, #e2e8f0)', background: 'var(--btn-bg, #f8fafc)',
          cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-muted, #64748b)',
        }}
      >
        ← Exit Frame Mode
      </button>
      {sel && label ? (
        <>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{label}</div>

          {/* Visibility toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setFrameElementOverride(containerId, sel.key, { ...override, visible: e.target.checked })}
            />
            Visible
          </label>

          <FieldRow label="Material" value={currentMaterial} options={materials}
            onChange={(v) => setFrameElementOverride(containerId, sel.key, { ...override, material: v })} />
          <FieldRow label="Shape" value={currentShape} options={shapes}
            onChange={(v) => setFrameElementOverride(containerId, sel.key, { ...override, shape: v })} />

          {/* Reset button */}
          <button
            onClick={() => clearFrameElementOverride(containerId, sel.key)}
            style={{ fontSize: 11, padding: '4px 8px', cursor: 'pointer' }}
          >
            Reset to Default
          </button>
        </>
      ) : (
        <>
          {/* Container-level frame defaults */}
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Frame Defaults</div>

          <FieldRow label="Pole Material"
            value={resolveFrameProperty(undefined, defaults, 'pole', 'material')}
            options={POLE_MATERIALS}
            onChange={(v) => setFrameDefaults(containerId, { poleMaterial: v })} />
          <FieldRow label="Pole Shape"
            value={resolveFrameProperty(undefined, defaults, 'pole', 'shape')}
            options={POLE_SHAPES}
            onChange={(v) => setFrameDefaults(containerId, { poleShape: v })} />
          <FieldRow label="Rail Material"
            value={resolveFrameProperty(undefined, defaults, 'rail', 'material')}
            options={RAIL_MATERIALS}
            onChange={(v) => setFrameDefaults(containerId, { railMaterial: v })} />
          <FieldRow label="Rail Shape"
            value={resolveFrameProperty(undefined, defaults, 'rail', 'shape')}
            options={RAIL_SHAPES}
            onChange={(v) => setFrameDefaults(containerId, { railShape: v })} />
        </>
      )}
    </div>
  );
}
