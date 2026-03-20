'use client';
import { useStore } from '@/store/useStore';
import { POLE_MATERIALS, POLE_SHAPES, RAIL_MATERIALS, RAIL_SHAPES, DEFAULT_FRAME_CONFIG } from '@/config/frameMaterials';

/** Frame element detail view + container-level defaults */
export function FrameInspector({ containerId }: { containerId: string }) {
  const container = useStore((s) => s.containers[containerId]);
  const selectedFrameElement = useStore((s) => s.selectedFrameElement);
  const setFrameDefaults = useStore((s) => s.setFrameDefaults);
  const setFrameElementOverride = useStore((s) => s.setFrameElementOverride);
  const clearFrameElementOverride = useStore((s) => s.clearFrameElementOverride);

  if (!container) return null;

  const defaults = container.frameDefaults ?? {};
  const sel = selectedFrameElement?.containerId === containerId ? selectedFrameElement : null;

  const override = sel
    ? sel.type === 'pole'
      ? container.poleOverrides?.[sel.key]
      : container.railOverrides?.[sel.key]
    : null;

  const materials = sel?.type === 'pole' ? POLE_MATERIALS : RAIL_MATERIALS;
  const shapes = sel?.type === 'pole' ? POLE_SHAPES : RAIL_SHAPES;

  const currentMaterial = override?.material
    ?? (sel?.type === 'pole' ? defaults.poleMaterial : defaults.railMaterial)
    ?? (sel?.type === 'pole' ? DEFAULT_FRAME_CONFIG.poleMaterial : DEFAULT_FRAME_CONFIG.railMaterial);

  const currentShape = override?.shape
    ?? (sel?.type === 'pole' ? defaults.poleShape : defaults.railShape)
    ?? (sel?.type === 'pole' ? DEFAULT_FRAME_CONFIG.poleShape : DEFAULT_FRAME_CONFIG.railShape);

  const isVisible = override?.visible !== false;

  const label = sel
    ? sel.type === 'pole'
      ? `Pole at ${sel.key.replace(/^l\d+/, '').replace(/r(\d+)c(\d+)_(\w+)/, 'R$1 C$2 ($3)')}`
      : `Rail ${sel.key.replace(/r(\d+)c(\d+)_(\w)/, 'R$1 C$2 ($3)')}`
    : null;

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
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

          {/* Material dropdown */}
          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Material</label>
            <select
              value={currentMaterial}
              onChange={(e) => setFrameElementOverride(containerId, sel.key, { ...override, material: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {materials.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Shape dropdown */}
          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Shape</label>
            <select
              value={currentShape}
              onChange={(e) => setFrameElementOverride(containerId, sel.key, { ...override, shape: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {shapes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

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

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Pole Material</label>
            <select
              value={defaults.poleMaterial ?? DEFAULT_FRAME_CONFIG.poleMaterial}
              onChange={(e) => setFrameDefaults(containerId, { poleMaterial: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {POLE_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Pole Shape</label>
            <select
              value={defaults.poleShape ?? DEFAULT_FRAME_CONFIG.poleShape}
              onChange={(e) => setFrameDefaults(containerId, { poleShape: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {POLE_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Rail Material</label>
            <select
              value={defaults.railMaterial ?? DEFAULT_FRAME_CONFIG.railMaterial}
              onChange={(e) => setFrameDefaults(containerId, { railMaterial: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {RAIL_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 6 }}>
            <label style={{ display: 'block', marginBottom: 2, color: 'var(--text-muted)' }}>Rail Shape</label>
            <select
              value={defaults.railShape ?? DEFAULT_FRAME_CONFIG.railShape}
              onChange={(e) => setFrameDefaults(containerId, { railShape: e.target.value })}
              style={{ width: '100%', padding: 4 }}
            >
              {RAIL_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </>
      )}
    </div>
  );
}
