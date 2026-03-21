"use client";

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { useSelectionTarget, type FaceKey } from '@/hooks/useSelectionTarget';
import {
  EXTERIOR_MATERIALS, PAINT_COLORS, GLASS_TINTS,
  FRAME_COLORS, DOOR_STYLES, LIGHT_FIXTURES, LIGHT_COLORS,
  ELECTRICAL_TYPES, FLOOR_MATERIALS, CEILING_MATERIALS,
  getFinishOptionsForFace,
  type MaterialPreset, type ColorPreset,
} from '@/config/finishPresets';
import type { FaceFinish, SurfaceType } from '@/types/container';
import ColorPicker from './ColorPicker';

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
  color: 'var(--text-dim, #64748b)', letterSpacing: '0.05em', marginBottom: 6,
};

const SECTION_STYLE: React.CSSProperties = { marginBottom: 12 };

export default function FinishesPanel() {
  const target = useSelectionTarget();
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const clearFaceFinish = useStore((s) => s.clearFaceFinish);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const [colorPickerField, setColorPickerField] = useState<string | null>(null);

  let containerId = '';
  let voxelIndex = 0;
  let face: FaceKey | null = null;
  let indices: number[] = [];

  if (target.type === 'face') {
    containerId = target.containerId;
    voxelIndex = target.index;
    face = target.face;
    indices = [voxelIndex];
  } else if (target.type === 'bay-face') {
    containerId = target.containerId;
    voxelIndex = target.indices[0];
    face = target.face;
    indices = target.indices;
  }

  if (!face || !containerId) return null;

  // Reactive selectors for surface and finish data
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const surface = useStore((s) => {
    const v = s.containers[containerId]?.voxelGrid?.[voxelIndex];
    return v?.faces[face!] as SurfaceType | undefined;
  });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const currentFinish = useStore((s) => {
    const v = s.containers[containerId]?.voxelGrid?.[voxelIndex];
    return v?.faceFinishes?.[face!];
  });

  if (!surface) return null;
  const opts = getFinishOptionsForFace(surface, face);

  const applyFinish = (patch: Partial<FaceFinish>) => {
    for (const idx of indices) {
      setFaceFinish(containerId, idx, face!, patch);
    }
  };

  const clearAll = () => {
    for (const idx of indices) {
      clearFaceFinish(containerId, idx, face!);
    }
  };

  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ ...LABEL_STYLE, fontSize: 11, marginBottom: 10 }}>
        {face.toUpperCase()} Face — {surface.replace(/_/g, ' ')}
      </div>

      {opts.exteriorMaterial && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Exterior Material</div>
          <MaterialGrid
            items={EXTERIOR_MATERIALS}
            activeId={currentFinish?.material}
            onSelect={(id, label) => {
              applyFinish({ material: id });
              addRecentItem({ type: 'finish', value: `material:${id}`, label });
            }}
          />
        </div>
      )}

      {opts.interiorPaint && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Interior Paint</div>
          <SwatchRow
            colors={PAINT_COLORS}
            activeHex={currentFinish?.paint}
            onSelect={(hex, label) => {
              applyFinish({ paint: hex });
              addRecentItem({ type: 'finish', value: `paint:${hex}`, label });
            }}
            onCustom={() => setColorPickerField('paint')}
          />
          {colorPickerField === 'paint' && (
            <ColorPicker
              color={currentFinish?.paint || '#FFFFFF'}
              onChange={(hex) => applyFinish({ paint: hex })}
              onClose={() => setColorPickerField(null)}
            />
          )}
        </div>
      )}

      {opts.glassTint && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Glass Tint</div>
          <SwatchRow
            colors={GLASS_TINTS}
            activeHex={currentFinish?.tint}
            onSelect={(hex, label) => {
              applyFinish({ tint: hex });
              addRecentItem({ type: 'finish', value: `tint:${hex}`, label });
            }}
          />
        </div>
      )}

      {opts.frameColor && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Frame Color</div>
          <SwatchRow
            colors={FRAME_COLORS}
            activeHex={currentFinish?.frameColor}
            onSelect={(hex, label) => {
              applyFinish({ frameColor: hex });
              addRecentItem({ type: 'finish', value: `frame:${hex}`, label });
            }}
            onCustom={() => setColorPickerField('frameColor')}
          />
          {colorPickerField === 'frameColor' && (
            <ColorPicker
              color={currentFinish?.frameColor || '#1A1A1A'}
              onChange={(hex) => applyFinish({ frameColor: hex })}
              onClose={() => setColorPickerField(null)}
            />
          )}
        </div>
      )}

      {opts.doorStyle && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Door Style</div>
          <MaterialGrid
            items={DOOR_STYLES}
            activeId={currentFinish?.doorStyle}
            onSelect={(id, label) => {
              applyFinish({ doorStyle: id });
              addRecentItem({ type: 'finish', value: `door:${id}`, label });
            }}
          />
        </div>
      )}

      {opts.floorMaterial && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Flooring Material</div>
          <MaterialGrid
            items={FLOOR_MATERIALS}
            activeId={currentFinish?.material}
            onSelect={(id, label) => {
              applyFinish({ material: id });
              addRecentItem({ type: 'finish', value: `floor:${id}`, label });
            }}
          />
        </div>
      )}

      {opts.ceilingMaterial && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Ceiling Material</div>
          <MaterialGrid
            items={CEILING_MATERIALS}
            activeId={currentFinish?.material}
            onSelect={(id, label) => {
              applyFinish({ material: id });
              addRecentItem({ type: 'finish', value: `ceil:${id}`, label });
            }}
          />
        </div>
      )}

      {opts.lightFixture && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Lighting</div>
          <MaterialGrid
            items={LIGHT_FIXTURES}
            activeId={currentFinish?.light || 'none'}
            onSelect={(id, label) => {
              applyFinish({ light: id });
              addRecentItem({ type: 'finish', value: `light:${id}`, label });
            }}
          />
        </div>
      )}

      {opts.lightColor && currentFinish?.light && currentFinish.light !== 'none' && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Light Color</div>
          <MaterialGrid
            items={LIGHT_COLORS}
            activeId={currentFinish?.lightColor || 'warm'}
            onSelect={(id) => applyFinish({ lightColor: id })}
          />
        </div>
      )}

      {opts.electrical && (
        <div style={SECTION_STYLE}>
          <div style={LABEL_STYLE}>Electrical</div>
          <MaterialGrid
            items={ELECTRICAL_TYPES}
            activeId={currentFinish?.electrical || 'none'}
            onSelect={(id, label) => {
              applyFinish({ electrical: id });
              addRecentItem({ type: 'finish', value: `elec:${id}`, label });
            }}
          />
        </div>
      )}

      {currentFinish && (
        <button
          onClick={clearAll}
          style={{
            width: '100%', padding: '6px', borderRadius: 6, fontSize: 10, fontWeight: 600,
            border: '1px solid var(--border, #e2e8f0)', background: 'none',
            color: 'var(--text-dim, #64748b)', cursor: 'pointer', marginTop: 4,
          }}
        >
          Reset to Theme Default
        </button>
      )}
    </div>
  );
}

function MaterialGrid({ items, activeId, onSelect }: {
  items: MaterialPreset[];
  activeId?: string;
  onSelect: (id: string, label: string) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id, item.label)}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '6px 4px', borderRadius: 6, cursor: 'pointer', fontSize: 9,
            border: `2px solid ${activeId === item.id ? 'var(--accent, #3b82f6)' : 'var(--border, #e2e8f0)'}`,
            background: activeId === item.id ? 'var(--accent-bg, rgba(59,130,246,0.08))' : 'var(--card-bg, #f1f5f9)',
            color: 'var(--text-main, #374151)', transition: 'border-color 100ms',
          }}
        >
          <div style={{ width: 24, height: 24, borderRadius: 4, background: item.color, border: '1px solid rgba(0,0,0,0.1)' }} />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function SwatchRow({ colors, activeHex, onSelect, onCustom }: {
  colors: ColorPreset[];
  activeHex?: string;
  onSelect: (hex: string, label: string) => void;
  onCustom?: () => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
      {colors.map((c) => (
        <button
          key={c.hex}
          onClick={() => onSelect(c.hex, c.label)}
          title={c.label}
          style={{
            width: 24, height: 24, borderRadius: 4, cursor: 'pointer', background: c.hex,
            border: `2px solid ${activeHex === c.hex ? 'var(--accent, #3b82f6)' : 'rgba(0,0,0,0.15)'}`,
            padding: 0,
          }}
        />
      ))}
      {onCustom && (
        <button
          onClick={onCustom}
          title="Custom color"
          style={{
            width: 24, height: 24, borderRadius: 4, cursor: 'pointer',
            background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)',
            border: '2px solid var(--border, #e2e8f0)', padding: 0,
            fontSize: 12, color: '#fff', fontWeight: 700, textShadow: '0 0 2px rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          +
        </button>
      )}
    </div>
  );
}
