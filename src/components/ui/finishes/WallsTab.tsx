"use client";

import { useEffect } from 'react';
import { useStore } from '@/store/useStore';
import {
  EXTERIOR_MATERIALS, GLASS_TINTS, FRAME_COLORS, DOOR_STYLES, PAINT_COLORS,
  getFinishOptionsForFace,
} from '@/config/finishPresets';
import { WALL_CATEGORIES, getCategoryForSurface } from '@/config/surfaceCategories';
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

export default function WallsTab({ containerId, voxelIndex, indices, face }: Props) {
  const surface = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faces[face] as SurfaceType | undefined
  );
  const currentFinish = useStore((s) =>
    s.containers[containerId]?.voxelGrid?.[voxelIndex]?.faceFinishes?.[face]
  );
  const selectedWallCategory = useStore((s) => s.selectedWallCategory);
  const setSelectedWallCategory = useStore((s) => s.setSelectedWallCategory);
  const addRecentItem = useStore((s) => s.addRecentItem);
  const applyFinish = useApplyFinish(containerId, indices, face);

  // Auto-detect category when surface changes and no category is selected
  useEffect(() => {
    if (surface && selectedWallCategory === null) {
      const detected = getCategoryForSurface(surface, 'wall');
      if (detected) setSelectedWallCategory(detected);
    }
  }, [surface, selectedWallCategory, setSelectedWallCategory]);

  const selectedCategory = WALL_CATEGORIES.find((c) => c.id === selectedWallCategory) ?? null;

  const opts = surface ? getFinishOptionsForFace(surface, face) : null;

  return (
    <div style={{ padding: '8px 12px' }}>
      {/* Category picker — always visible */}
      <div style={{ marginBottom: 14 }}>
        <CategoryRow
          categories={WALL_CATEGORIES}
          selected={selectedWallCategory}
          onSelect={setSelectedWallCategory}
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
            ghostSource="walls"
          />
        </div>
      )}

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
