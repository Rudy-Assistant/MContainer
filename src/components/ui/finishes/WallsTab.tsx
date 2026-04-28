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
import TemplatePicker from './TemplatePicker';
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

      {/* Picker dispatch: surface-gated for Door + Window (the underlying
          SurfaceType drives geometry); category-gated for Shelf, Cabinet,
          Fixture, Decor (overlays — wall surface stays intact behind). */}
      {(surface === 'Door' || surface === 'Glass_Shoji') && (
        <PickerSection mode="door" containerId={containerId} voxelIndex={voxelIndex} face={face} />
      )}
      {surface && surface.startsWith?.('Window_') && (
        <PickerSection mode="window" containerId={containerId} voxelIndex={voxelIndex} face={face} />
      )}
      {(surface === 'Half_Fold' || surface === 'Gull_Wing') && (
        <HingedToggle containerId={containerId} voxelIndex={voxelIndex} indices={indices} face={face} />
      )}
      {selectedWallCategory === 'shelf' && (
        <PickerSection mode="shelf" containerId={containerId} voxelIndex={voxelIndex} face={face} />
      )}
      {selectedWallCategory === 'cabinet' && (
        <PickerSection mode="cabinet" containerId={containerId} voxelIndex={voxelIndex} face={face} />
      )}
      {selectedWallCategory === 'fixture' && (
        <PickerSection mode="fixture" containerId={containerId} voxelIndex={voxelIndex} face={face} />
      )}
      {selectedWallCategory === 'decor' && (
        <PickerSection mode="decor" containerId={containerId} voxelIndex={voxelIndex} face={face} />
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

const pickerWrapperStyle: React.CSSProperties = {
  marginTop: 4,
  marginBottom: 14,
  marginLeft: -12,
  marginRight: -12,
  borderTop: '1px solid var(--border, #e2e8f0)',
  borderBottom: '1px solid var(--border, #e2e8f0)',
  background: 'var(--surface-alt, #f8fafc)',
};

/** Bordered wrapper around <TemplatePicker> — hoisted to a single
 *  component so the 6 pickers (door/window/shelf/cabinet/fixture/decor)
 *  share one source of truth for the wrapper styling. */
function PickerSection({
  mode, containerId, voxelIndex, face,
}: {
  mode: 'door' | 'window' | 'shelf' | 'cabinet' | 'fixture' | 'decor';
  containerId: string;
  voxelIndex: number;
  face: FaceKey;
}) {
  return (
    <div style={pickerWrapperStyle}>
      <TemplatePicker
        containerId={containerId}
        voxelIndex={voxelIndex}
        face={face as 'n' | 's' | 'e' | 'w'}
        mode={mode}
      />
    </div>
  );
}

/** Open/closed toggle for Half_Fold + Gull_Wing surfaces. Writes to the
 *  voxel's hingedConfig — the renderer animates the panel rotations from
 *  closed (0) to open (1). When multiple voxels are selected (e.g. a bay
 *  range), the toggle applies to every voxel in `indices` so a row of fold
 *  walls opens together. */
function HingedToggle({
  containerId, voxelIndex, indices, face,
}: {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
}) {
  const setHingedConfig = useStore((s) => s.setHingedConfig);
  const openAmount = useStore(
    (s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]?.hingedConfig?.[face]?.openAmount ?? 0
  );
  const isOpen = openAmount > 0.5;
  const targets = indices.length > 0 ? indices : [voxelIndex];

  const toggle = () => {
    const next = isOpen ? 0 : 1;
    for (const idx of targets) {
      setHingedConfig(containerId, idx, face as 'n' | 's' | 'e' | 'w', { openAmount: next });
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-main)', letterSpacing: '0.02em' }}>
          Hinged panel
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>
          {isOpen
            ? 'Folded outward — drops down as a deck or rises as an awning.'
            : 'Closed — sealed wall panel.'}
        </div>
      </div>
      <button
        data-testid="hinged-toggle"
        onClick={toggle}
        aria-pressed={isOpen}
        style={{
          fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
          color: isOpen ? '#fff' : 'var(--accent)',
          background: isOpen ? 'var(--accent)' : 'transparent',
          border: '1.5px solid var(--accent)',
          borderRadius: 6, padding: '5px 12px',
          cursor: 'pointer', letterSpacing: '0.02em',
          transition: 'all 120ms ease-out', whiteSpace: 'nowrap',
        }}
      >
        {isOpen ? 'Open ●' : 'Closed ○'}
      </button>
    </div>
  );
}
