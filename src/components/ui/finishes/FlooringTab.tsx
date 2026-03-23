"use client";

import { useStore } from '@/store/useStore';
import { FLOOR_MATERIALS, PAINT_COLORS } from '@/config/finishPresets';
import type { FaceFinish } from '@/types/container';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import TextureSwatchGrid from './TextureSwatchGrid';
import SwatchRow from './SwatchRow';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}

export default function FlooringTab({ containerId, voxelIndex, indices, face }: Props) {
  const currentFinish = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]);
  const setFaceFinish = useStore((s) => s.setFaceFinish);
  const addRecentItem = useStore((s) => s.addRecentItem);

  const applyFinish = (patch: Partial<FaceFinish>) => {
    for (const idx of indices) setFaceFinish(containerId, idx, face, patch);
  };

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
