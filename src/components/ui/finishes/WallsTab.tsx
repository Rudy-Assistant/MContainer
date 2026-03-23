"use client";

import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import {
  EXTERIOR_MATERIALS, GLASS_TINTS, FRAME_COLORS, DOOR_STYLES, PAINT_COLORS,
  getFinishOptionsForFace,
} from '@/config/finishPresets';
import { getWallTypesForContext } from '@/config/wallTypes';
import type { SurfaceType } from '@/types/container';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import TextureSwatchGrid from './TextureSwatchGrid';
import OptionCardGrid from './OptionCardGrid';
import SwatchRow from './SwatchRow';
import { useApplyFinish } from './useApplyFinish';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}

export default function WallsTab({ containerId, voxelIndex, indices, face }: Props) {
  const surface = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faces[face] as SurfaceType | undefined
  );
  const currentFinish = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]
  );
  const inspectorView = useStore((s) => s.inspectorView);
  const paintFace = useStore((s) => s.paintFace);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const applyFinish = useApplyFinish(containerId, indices, face);

  const wallTypes = useMemo(
    () => getWallTypesForContext(inspectorView, face),
    [inspectorView, face],
  );

  const handleSurfaceChange = (newSurface: SurfaceType) => {
    for (const idx of indices) paintFace(containerId, idx, face, newSurface);
    addRecentItem({ type: 'wallType', value: newSurface, label: newSurface.replace(/_/g, ' ') });
  };

  const opts = surface ? getFinishOptionsForFace(surface, face) : null;

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Surface type picker — always visible */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
          color: 'var(--text-dim)', letterSpacing: '0.05em', marginBottom: 8,
        }}>
          Wall Surface
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {wallTypes.map((entry) => (
            <button
              key={entry.surface + '-' + entry.category}
              onClick={() => handleSurfaceChange(entry.surface)}
              title={entry.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 6,
                padding: '10px 4px', borderRadius: 8, cursor: 'pointer',
                border: `2px solid ${surface === entry.surface ? 'var(--accent)' : 'var(--border)'}`,
                background: surface === entry.surface ? 'var(--border-subtle)' : 'var(--btn-bg)',
                boxShadow: surface === entry.surface ? '0 0 0 1px var(--accent)' : 'none',
                color: 'var(--text-main)', transition: 'border-color 120ms, box-shadow 120ms',
              }}
            >
              <span style={{ fontSize: 18 }}>{entry.icon}</span>
              <span style={{ fontSize: 10, fontWeight: 500, textAlign: 'center', lineHeight: 1.3 }}>{entry.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Surface-dependent finishes — only when surface is not Open */}
      {opts?.exteriorMaterial && (
        <TextureSwatchGrid
          label="Exterior Material"
          items={EXTERIOR_MATERIALS}
          activeId={currentFinish?.material}
          onSelect={(id, label) => {
            applyFinish({ material: id });
            addRecentItem({ type: 'finish', value: `material:${id}`, label });
          }}
        />
      )}

      {opts?.glassTint && (
        <SwatchRow
          label="Glass Tint"
          colors={GLASS_TINTS}
          activeHex={currentFinish?.tint}
          onSelect={(hex, label) => {
            applyFinish({ tint: hex });
            addRecentItem({ type: 'finish', value: `tint:${hex}`, label });
          }}
        />
      )}

      {opts?.frameColor && (
        <SwatchRow
          label="Frame Color"
          colors={FRAME_COLORS}
          activeHex={currentFinish?.frameColor}
          onSelect={(hex, label) => {
            applyFinish({ frameColor: hex });
            addRecentItem({ type: 'finish', value: `frame:${hex}`, label });
          }}
        />
      )}

      {opts?.doorStyle && (
        <OptionCardGrid
          label="Door Style"
          items={DOOR_STYLES}
          activeId={currentFinish?.doorStyle}
          onSelect={(id, label) => {
            applyFinish({ doorStyle: id });
            addRecentItem({ type: 'finish', value: `door:${id}`, label });
          }}
        />
      )}

      {/* Color — universal, shown for any non-Open surface */}
      {surface && surface !== 'Open' && (
        <SwatchRow
          label="Color"
          colors={PAINT_COLORS}
          activeHex={currentFinish?.color}
          onSelect={(hex, label) => {
            applyFinish({ color: hex });
            addRecentItem({ type: 'finish', value: `color:${hex}`, label });
          }}
        />
      )}
    </div>
  );
}
