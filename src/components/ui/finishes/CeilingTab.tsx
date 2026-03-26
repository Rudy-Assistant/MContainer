"use client";

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { CEILING_MATERIALS, LIGHT_FIXTURES, LIGHT_COLORS, PAINT_COLORS } from '@/config/finishPresets';
import { CEILING_CATEGORIES, getCategoryForSurface } from '@/config/surfaceCategories';
import type { SurfaceType } from '@/types/container';
import type { FaceKey } from '@/hooks/useSelectionTarget';
import TextureSwatchGrid from './TextureSwatchGrid';
import OptionCardGrid from './OptionCardGrid';
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

export default function CeilingTab({ containerId, voxelIndex, indices, face }: Props) {
  const surface = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faces[face] as SurfaceType | undefined
  );
  const currentFinish = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]
  );
  const selectedCeilingCategory = useStore((s) => s.selectedCeilingCategory);
  const setSelectedCeilingCategory = useStore((s) => s.setSelectedCeilingCategory);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const applyFinish = useApplyFinish(containerId, indices, face);

  // Auto-detect category when surface changes and no category is selected
  useEffect(() => {
    if (surface && selectedCeilingCategory === null) {
      const detected = getCategoryForSurface(surface, 'ceiling');
      if (detected) setSelectedCeilingCategory(detected);
    }
  }, [surface, selectedCeilingCategory, setSelectedCeilingCategory]);

  const selectedCategory = CEILING_CATEGORIES.find((c) => c.id === selectedCeilingCategory) ?? null;

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Category picker — always visible */}
      <div style={{ marginBottom: 14 }}>
        <CategoryRow
          categories={CEILING_CATEGORIES}
          selected={selectedCeilingCategory}
          onSelect={setSelectedCeilingCategory}
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

      {/* Ceiling material texture */}
      <TextureSwatchGrid
        label="Ceiling Material"
        items={CEILING_MATERIALS}
        activeId={currentFinish?.material}
        onSelect={(id, label) => {
          applyFinish({ material: id });
          addRecentItem({ type: 'finish', value: `ceil:${id}`, label });
        }}
      />

      {/* Light fixture controls */}
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
