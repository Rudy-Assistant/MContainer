"use client";

import { useStore } from '@/store/useStore';
import { ELECTRICAL_TYPES, PAINT_COLORS } from '@/config/finishPresets';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import OptionCardGrid from './OptionCardGrid';
import SwatchRow from './SwatchRow';
import { useApplyFinish } from './useApplyFinish';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}

export default function ElectricalTab({ containerId, voxelIndex, indices, face }: Props) {
  const currentFinish = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const applyFinish = useApplyFinish(containerId, indices, face);

  const isWallFace = face !== 'top' && face !== 'bottom';

  if (!isWallFace) {
    return (
      <div style={{ padding: '16px 12px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          Electrical is available on wall faces. Click a wall in the preview above.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 12px' }}>
      <OptionCardGrid
        label="Electrical"
        items={ELECTRICAL_TYPES}
        activeId={currentFinish?.electrical || 'none'}
        onSelect={(id, label) => {
          applyFinish({ electrical: id });
          addRecentItem({ type: 'finish', value: `elec:${id}`, label });
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
