"use client";

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { FLOOR_MATERIALS, PAINT_COLORS } from '@/config/finishPresets';
import { FLOOR_CATEGORIES, getCategoryForSurface } from '@/config/surfaceCategories';
import type { SurfaceType } from '@/types/container';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import TextureSwatchGrid from './TextureSwatchGrid';
import SwatchRow from './SwatchRow';
import CategoryRow from './CategoryRow';
import VariantGrid from './VariantGrid';
import { useApplyFinish } from './useApplyFinish';

interface Props {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}

export default function FlooringTab({ containerId, voxelIndex, indices, face }: Props) {
  const surface = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faces[face] as SurfaceType | undefined
  );
  const currentFinish = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]
  );
  const selectedFloorCategory = useStore((s) => s.selectedFloorCategory);
  const setSelectedFloorCategory = useStore((s) => s.setSelectedFloorCategory);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const applyFinish = useApplyFinish(containerId, indices, face);

  // Auto-detect category when surface changes and no category is selected
  useEffect(() => {
    if (surface && selectedFloorCategory === null) {
      const detected = getCategoryForSurface(surface, 'floor');
      if (detected) setSelectedFloorCategory(detected);
    }
  }, [surface, selectedFloorCategory, setSelectedFloorCategory]);

  const selectedCategory = FLOOR_CATEGORIES.find((c) => c.id === selectedFloorCategory) ?? null;

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Category picker — always visible */}
      <div style={{ marginBottom: 14 }}>
        <CategoryRow
          categories={FLOOR_CATEGORIES}
          selected={selectedFloorCategory}
          onSelect={setSelectedFloorCategory}
        />
      </div>

      {/* Variant grid — visible when a category is selected */}
      {selectedCategory && (
        <div style={{ marginBottom: 14 }}>
          <VariantGrid
            category={selectedCategory}
            currentSurface={(surface as SurfaceType) ?? null}
            currentFinish={(currentFinish as Record<string, string> | null) ?? null}
            containerId={containerId}
            indices={indices}
            face={face}
          />
        </div>
      )}

      {/* Flooring material texture */}
      <TextureSwatchGrid
        label="Flooring Material"
        items={FLOOR_MATERIALS}
        activeId={currentFinish?.material}
        onSelect={(id, label) => {
          applyFinish({ material: id });
          addRecentItem({ type: 'finish', value: `floor:${id}`, label });
        }}
      />

      {/* Color */}
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
