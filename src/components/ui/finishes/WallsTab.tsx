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
import { PresetCard } from './PresetCard';
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
        <HingedToggle
          containerId={containerId}
          voxelIndex={voxelIndex}
          indices={indices}
          face={face}
          surface={surface as 'Half_Fold' | 'Gull_Wing'}
        />
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

/** Tiny SVG diagram of a hinged-wall surface in either Closed (vertical
 *  panels) or Open (panels folded outward) state. Used as the thumbnail in
 *  the HingedToggle picker so the user previews the rendered effect.
 *
 *  - Half_Fold: top half steel + bottom half wood (closed) → top stays,
 *    bottom rotates 90° outward into a horizontal deck plank.
 *  - Gull_Wing: top + bottom steel (closed) → top rotates up into an
 *    awning, bottom rotates down into a deck.
 *
 *  The SVG is purely indicative — colors and proportions match the 3D
 *  surface but the pose is a side elevation, not the isometric used in
 *  Block / Container thumbnails. */
function HingedPreviewSVG({
  surface, state,
}: {
  surface: 'Half_Fold' | 'Gull_Wing';
  state: 'closed' | 'open';
}) {
  const STEEL = '#64748b';
  const WOOD = '#8B6914';
  const HINGE = '#1f2937';
  const open = state === 'open';

  if (surface === 'Half_Fold') {
    // Side view: x=horizontal, y=vertical. Wall plane at x=24 (centerline);
    // panels fold outward toward x>24. Hinge at center y.
    return (
      <svg viewBox="0 0 48 48" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
        {/* Floor */}
        <line x1="6" y1="42" x2="42" y2="42" stroke="#94a3b8" strokeWidth={0.6} strokeDasharray="2 2" />
        {/* Top half steel — always vertical */}
        <rect x="22" y="10" width="4" height="14" fill={STEEL} stroke="#475569" strokeWidth={0.4} />
        {/* Bottom half wood — vertical (closed) or horizontal extending right (open) */}
        {open ? (
          <rect x="24" y="22" width="14" height="4" fill={WOOD} stroke="#5a4209" strokeWidth={0.4} />
        ) : (
          <rect x="22" y="24" width="4" height="14" fill={WOOD} stroke="#5a4209" strokeWidth={0.4} />
        )}
        {/* Hinge line at mid-height */}
        <line x1="22" y1="24" x2="26" y2="24" stroke={HINGE} strokeWidth={1.2} />
      </svg>
    );
  }
  // Gull_Wing
  return (
    <svg viewBox="0 0 48 48" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
      <line x1="6" y1="42" x2="42" y2="42" stroke="#94a3b8" strokeWidth={0.6} strokeDasharray="2 2" />
      {/* Top panel — vertical (closed) or horizontal up-right (open awning) */}
      {open ? (
        <rect x="24" y="20" width="14" height="4" fill={STEEL} stroke="#475569" strokeWidth={0.4} />
      ) : (
        <rect x="22" y="10" width="4" height="14" fill={STEEL} stroke="#475569" strokeWidth={0.4} />
      )}
      {/* Bottom panel — vertical (closed) or horizontal down-right (open deck) */}
      {open ? (
        <rect x="24" y="24" width="14" height="4" fill={STEEL} stroke="#475569" strokeWidth={0.4} />
      ) : (
        <rect x="22" y="24" width="4" height="14" fill={STEEL} stroke="#475569" strokeWidth={0.4} />
      )}
      {/* Hinge line + awning support hint */}
      <line x1="22" y1="24" x2="26" y2="24" stroke={HINGE} strokeWidth={1.2} />
      {open && <line x1="26" y1="22" x2="34" y2="22" stroke={HINGE} strokeWidth={0.4} strokeDasharray="1 1" />}
    </svg>
  );
}

/** Open/closed picker for Half_Fold + Gull_Wing surfaces. Two PresetCards
 *  side-by-side (Closed | Open) with thumbnail SVGs of the panel pose.
 *  Clicking a card writes openAmount 0 or 1 to the voxel's hingedConfig —
 *  the renderer lerps the panel rotations smoothly. When multiple voxels
 *  are selected (e.g. a bay range), the click applies to every voxel in
 *  `indices` so a row of fold walls opens together.
 *
 *  Mirrors the picker style used by DoorFace + WindowFace template grids
 *  so the affordance is visually consistent across the WallsTab. */
function HingedToggle({
  containerId, voxelIndex, indices, face, surface,
}: {
  containerId: string;
  voxelIndex: number;
  indices: number[];
  face: FaceKey;
  surface: 'Half_Fold' | 'Gull_Wing';
}) {
  const setHingedConfig = useStore((s) => s.setHingedConfig);
  const openAmount = useStore(
    (s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]?.hingedConfig?.[face]?.openAmount ?? 0
  );
  const isOpen = openAmount > 0.5;
  const targets = indices.length > 0 ? indices : [voxelIndex];

  const setState = (next: 0 | 1) => {
    if ((next === 1) === isOpen) return; // already in target state
    for (const idx of targets) {
      setHingedConfig(containerId, idx, face as 'n' | 's' | 'e' | 'w', { openAmount: next });
    }
  };

  const friendlySurface = surface === 'Half_Fold' ? 'fold-down' : 'gull-wing';

  return (
    <div style={{ padding: '10px 0', borderTop: '1px solid var(--border)', marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Hinged panel
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {friendlySurface}
        </div>
      </div>
      <div
        data-testid="hinged-toggle"
        aria-pressed={isOpen}
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}
      >
        <PresetCard
          content={<HingedPreviewSVG surface={surface} state="closed" />}
          label="Closed"
          title="Sealed wall panel"
          active={!isOpen}
          onClick={() => setState(0)}
        />
        <PresetCard
          content={<HingedPreviewSVG surface={surface} state="open" />}
          label="Open"
          title={surface === 'Half_Fold' ? 'Bottom half folds down as a deck' : 'Top awns up, bottom decks down'}
          active={isOpen}
          onClick={() => setState(1)}
        />
      </div>
    </div>
  );
}
