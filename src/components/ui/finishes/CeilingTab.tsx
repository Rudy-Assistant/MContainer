"use client";

import { useStore } from '@/store/useStore';
import { CEILING_MATERIALS, LIGHT_FIXTURES, LIGHT_COLORS, PAINT_COLORS } from '@/config/finishPresets';
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

export default function CeilingTab({ containerId, voxelIndex, indices, face }: Props) {
  const currentFinish = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const applyFinish = useApplyFinish(containerId, indices, face);

  return (
    <div style={{ padding: '8px 12px' }}>
      <TextureSwatchGrid
        label="Ceiling Material"
        items={CEILING_MATERIALS}
        activeId={currentFinish?.material}
        onSelect={(id, label) => {
          applyFinish({ material: id });
          addRecentItem({ type: 'finish', value: `ceil:${id}`, label });
        }}
      />
      <OptionCardGrid
        label="Lighting"
        items={LIGHT_FIXTURES}
        activeId={currentFinish?.light || 'none'}
        onSelect={(id, label) => {
          applyFinish({ light: id });
          addRecentItem({ type: 'finish', value: `light:${id}`, label });
        }}
      />
      {currentFinish?.light && currentFinish.light !== 'none' && (
        <OptionCardGrid
          label="Light Color"
          items={LIGHT_COLORS}
          activeId={currentFinish?.lightColor || 'warm'}
          onSelect={(id) => applyFinish({ lightColor: id })}
        />
      )}
      <SwatchRow
        label="Color"
        colors={PAINT_COLORS}
        activeHex={currentFinish?.color}
        onSelect={(hex, label) => {
          applyFinish({ color: hex });
          addRecentItem({ type: 'finish', value: `color:${hex}`, label });
        }}
      />
    </div>
  );
}
