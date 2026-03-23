"use client";

import { useStore } from '@/store/useStore';
import { FLOOR_MATERIALS, PAINT_COLORS } from '@/config/finishPresets';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import TextureSwatchGrid from './TextureSwatchGrid';
import SwatchRow from './SwatchRow';
import { useApplyFinish } from './useApplyFinish';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}

export default function FlooringTab({ containerId, voxelIndex, indices, face }: Props) {
  const currentFinish = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const applyFinish = useApplyFinish(containerId, indices, face);

  return (
    <div style={{ padding: '8px 12px' }}>
      <TextureSwatchGrid
        label="Flooring Material"
        items={FLOOR_MATERIALS}
        activeId={currentFinish?.material}
        onSelect={(id, label) => {
          applyFinish({ material: id });
          addRecentItem({ type: 'finish', value: `floor:${id}`, label });
        }}
      />
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
