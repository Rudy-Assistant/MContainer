/**
 * voxelSlice.ts — Voxel mutation actions (no dedicated state)
 *
 * Extracted from useStore.ts. All actions here mutate container voxel data
 * via get()/set(). Consumer selectors unchanged — actions merge into StoreState.
 */

import {
  type Container,
  type BaySlot,
  ContainerSize,
  CONTAINER_DIMENSIONS,
  type FloorMaterialType,
  type SurfaceType,
  type VoxelFaces,
  type Voxel,
  type ModuleOrientation,
  type DoorConfig,
  type FaceFinish,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  LONG_WALL_BAYS,
  SHORT_WALL_BAYS,
  WallSide,
  isVoxelFaceProtected,
} from '@/types/container';
import {
  createDefaultVoxelGrid,
  createPoolVoxelGrid,
  createOpenVoid,
} from '@/types/factories';
import { getCycleForFace } from '@/config/surfaceCycles';
import { BLOCK_PRESETS, type BlockPresetId } from '@/config/blockPresets';
import { getModulePreset, resolveModuleFaces, ORIENT_ROTATION } from '@/config/moduleCatalog';
import { getContainerPreset } from '@/config/containerPresets';
import { getRoomPreset as _getRoomPreset } from '@/config/roomPresets';
import { v4 as uuid } from 'uuid';
import type { FurnitureItem } from '@/types/container';
import type { HotbarSlot } from '../useStore';
import type { SliceGet, SliceSet } from './types';

// Use a lazy StoreState reference to avoid circular imports.
// The slice function receives set/get typed to the full store.
type VoxelRuntimeState = VoxelSlice & {
  containers: Record<string, Container>;
  furnitureIndex: Record<string, FurnitureItem>;
  lockedVoxels: Record<string, boolean>;
  designMode: 'smart' | 'manual';
  hotbar: HotbarSlot[];
  activeHotbarSlot: number | null;
  customHotbar: (HotbarSlot | null)[];
  activeCustomSlot: number | null;
  moduleOrientation: ModuleOrientation;
  addContainer: (size: ContainerSize, position: { x: number; y: number; z: number }) => string;
  applyContainerPreset: (containerId: string, presetId: string) => void;
  applyModule: (containerId: string, voxelIndex: number, moduleId: string, orientation: ModuleOrientation) => void;
  applyStairsFromFace: VoxelSlice['applyStairsFromFace'];
  applyDoorModule: VoxelSlice['applyDoorModule'];
  applySmartRailing: VoxelSlice['applySmartRailing'];
};
type Set = SliceSet<VoxelRuntimeState>;
type Get = SliceGet<VoxelRuntimeState>;
type RailingContainer = Pick<Container, '_smartRailingChanges'>;
type HoleGuardContainer = Pick<Container, '_smartHoleGuardChanges'>;
type VoxelStoreRef = {
  getState: () => VoxelRuntimeState;
  temporal: { getState: () => { pause: () => void; resume: () => void } };
};

export interface VoxelSlice {
  setVoxelFace: (containerId: string, voxelIndex: number, face: keyof VoxelFaces, mat: SurfaceType) => void;
  setVoxelFacePreset: (containerId: string, voxelIndex: number, face: keyof VoxelFaces, mat: SurfaceType) => void;
  /** U6 (R6): set or clear `userOptOut[face]` on a voxel. Called by the
   *  SmartRuleToast "Don't auto-fix this face again" button. Smart-rule
   *  cascade respects opt-outs via `isVoxelFaceProtected`. */
  setUserOptOut: (containerId: string, voxelIndex: number, face: keyof VoxelFaces, value: boolean) => void;
  /** Apply many preset face overrides to one container in a single store update.
   *  Sets presetProtectedFaces on each touched face, skips locked voxels, and
   *  never writes lastStamp. Intended for preset-authored geometry such as
   *  Resort House's atrium-face override list. */
  setVoxelFacesPresetBatch: (
    containerId: string,
    overrides: Array<{ voxelIndex: number; face: keyof VoxelFaces; material: SurfaceType }>,
  ) => void;
  setVoxelAllFaces: (containerId: string, voxelIndex: number, mat: SurfaceType) => void;
  setVoxelActive: (containerId: string, voxelIndex: number, active: boolean) => void;
  paintFace: (containerId: string, voxelIndex: number, face: keyof VoxelFaces, surface: SurfaceType) => void;
  cycleVoxelFace: (containerId: string, voxelIndex: number, face: keyof VoxelFaces) => void;
  stampFromHotbar: (containerId: string, voxelIndex: number) => void;
  stampAreaSmart: (containerId: string, voxelIndices: number[], faces: VoxelFaces) => void;
  stampArea: (containerId: string, voxelIndices: number[], faces: VoxelFaces) => void;
  stampStaircase: (containerId: string, voxelIndex: number) => void;
  applyStairsFromFace: (containerId: string, voxelIndex: number, face: 'n' | 's' | 'e' | 'w' | 'top') => void;
  applyVerticalStairs: (containerId: string, voxelIndex: number, facing: 'n' | 's' | 'e' | 'w') => void;
  applySmartRailing: (containerId: string, voxelIndex: number) => void;
  removeStairs: (containerId: string, voxelIndex: number) => void;
  /** Complete stair exit animation — does the actual stair data cleanup.
   *  Called by StairTelescope onComplete when isExiting animation finishes. */
  clearStairExit: (containerId: string, voxelIndex: number) => void;
  convertToPool: (containerId: string) => void;
  resetVoxelGrid: (containerId: string) => void;
  toggleVoxelLock: (containerId: string, voxelIndex: number) => void;
  isVoxelLocked: (containerId: string, voxelIndex: number) => boolean;
  toggleDoorState: (containerId: string, voxelIndex: number, face: keyof VoxelFaces) => void;
  setFloorMaterial: (id: string, material: FloorMaterialType | undefined) => void;
  setCeilingMaterial: (id: string, material: FloorMaterialType | undefined) => void;
  cycleVoxelTemplate: (containerId: string, voxelIndex: number) => void;
  applyContainerPreset: (containerId: string, presetId: string) => void;
  addContainerWithPreset: (size: ContainerSize, position: { x: number; y: number; z: number }, presetId: string) => string;
  applyModule: (containerId: string, voxelIndex: number, moduleId: string, orientation: ModuleOrientation) => void;
  isStaircaseMacro: () => boolean;
  setVoxelRoomTag: (containerId: string, voxelIndex: number, tag: string | undefined) => void;
  setDoorConfig: (containerId: string, voxelIndex: number, face: keyof VoxelFaces, config: Partial<DoorConfig>) => void;
  setWindowConfig: (
    containerId: string,
    voxelIndex: number,
    face: keyof VoxelFaces,
    config: Partial<import('@/types/container').WindowConfig>,
  ) => void;
  /** Set or update the hinged-wall animation state on a face. Drives
   *  Half_Fold + Gull_Wing animations (0 = closed, 1 = open). Only meaningful
   *  when the face's SurfaceType is Half_Fold or Gull_Wing. Pass `null` to
   *  clear the entry (resets to closed). */
  setHingedConfig: (
    containerId: string,
    voxelIndex: number,
    face: keyof VoxelFaces,
    config: Partial<import('@/types/container').HingedConfig> | null,
  ) => void;
  /** Set or update a shelf overlay on a face. Pass `null` to remove the
   *  shelf from that face. Partial updates merge with existing config. */
  setShelfConfig: (
    containerId: string,
    voxelIndex: number,
    face: keyof VoxelFaces,
    config: Partial<import('@/types/container').ShelfConfig> | null,
  ) => void;
  /** Set or update a cabinet overlay on a face. Pass `null` to remove the
   *  cabinet from that face. Partial updates merge with existing config. */
  setCabinetConfig: (
    containerId: string,
    voxelIndex: number,
    face: keyof VoxelFaces,
    config: Partial<import('@/types/container').CabinetConfig> | null,
  ) => void;
  /** Set or update a fixture overlay (appliance or bathroom fixture) on a
   *  face. Pass `null` to remove. */
  setFixtureConfig: (
    containerId: string,
    voxelIndex: number,
    face: keyof VoxelFaces,
    config: Partial<import('@/types/container').FixtureConfig> | null,
  ) => void;
  /** Apply a celebrated-design room preset (Frankfurt galley, Susanka master,
   *  5×8 wet-wall bath, etc.) starting at the given anchor voxel. Walks the
   *  preset's footprint (cols × rows in BODY voxel space, 0-indexed from
   *  rows 1-2 cols 1-6), placing furniture + overlays + finishes. Returns
   *  null on success, or an error string if the preset doesn't fit. */
  applyRoomPreset: (
    containerId: string,
    anchorBodyCol: number,
    anchorBodyRow: number,
    presetId: import('@/config/roomPresets').RoomPresetId,
    level?: 0 | 1,
  ) => string | null;

  /** Set or update a decor overlay (picture, mirror, TV) on a face. Pass
   *  `null` to remove. */
  setDecorConfig: (
    containerId: string,
    voxelIndex: number,
    face: keyof VoxelFaces,
    config: Partial<import('@/types/container').DecorConfig> | null,
  ) => void;
  /** Set or remove a floor overlay (rug, runner) on a voxel face — only
   *  meaningful on `'bottom'` (floor surface). Pass null to remove. */
  setFloorOverlay: (
    containerId: string,
    voxelIndex: number,
    face: keyof VoxelFaces,
    config: Partial<import('@/types/container').FloorOverlayConfig> | null,
  ) => void;
  /** Set or remove a ceiling overlay (fan, pendant, recessed grid, beams).
   *  Only meaningful on `'top'`. */
  setCeilingOverlay: (
    containerId: string,
    voxelIndex: number,
    face: keyof VoxelFaces,
    config: Partial<import('@/types/container').CeilingOverlayConfig> | null,
  ) => void;
  applyDoorModule: (containerId: string, voxelIndex: number, orientation: ModuleOrientation) => void;
  getDoorConstraints: (containerId: string, voxelIndex: number, face: keyof VoxelFaces) => DoorConstraints;
  setFaceFinish: (containerId: string, voxelIndex: number, face: keyof VoxelFaces, finish: Partial<FaceFinish>) => void;
  clearFaceFinish: (containerId: string, voxelIndex: number, face: keyof VoxelFaces) => void;
  applyBlockConfig: (containerId: string, indices: number[], presetId: import('@/config/blockPresets').BlockPresetId) => void;
  /** Set all six faces of a single voxel — convenience wrapper used by Container tab presets. */
  setVoxelFaces: (containerId: string, voxelIndex: number, faces: VoxelFaces) => void;
}

export interface DoorConstraints {
  canSwing: boolean;
  canSlide: boolean;
  swingBlockReason?: string;
  slideBlockReason?: string;
  recommendedType: 'swing' | 'slide';
}

// Reference to useStore — injected after store creation to avoid circular import.
let _useStoreRef: VoxelStoreRef | null = null;
export function setVoxelStoreRef(ref: VoxelStoreRef) { _useStoreRef = ref; }

// ── Shared staircase constants ──────────────────────────────
// STAIR SYSTEM DESIGN (unified):
// - applyStairsFromFace is the SINGLE SOURCE OF TRUTH for stair placement.
// - All entry points (setVoxelFace('Stairs'), applyModule('stairs'), stampStaircase)
//   delegate to applyStairsFromFace.
// - stairAscending ('n'|'s'|'e'|'w') is the canonical direction field.
// - stairPart ('lower'|'upper'|'single') identifies entry vs ascent voxel in 2-voxel pairs.
//   BOM counts only 'lower'/'single' to avoid double-counting.
// - Rule consequences (SR-01/05/06/09) are now PURE helpers in stairEnforcement.ts;
//   re-exported here so existing imports keep compiling.
export { STAIR_FLIP, ASCEND_DELTA, buildStairFaces } from '@/utils/stairEnforcement';
import {
  STAIR_FLIP,
  ASCEND_DELTA,
  buildStairFaces,
  computeFloorVoid,
  computeEntryWallClear,
  computeLateralRailings,
  computeCrossContainerVoid,
} from '@/utils/stairEnforcement';

/** If voxelIndex is an upper stair voxel, return the lower voxel's index. Otherwise return voxelIndex unchanged.
 *  Returns null if the redirect is invalid (out of bounds, no matching stair). */
function resolveToLowerStair(grid: Voxel[], voxelIndex: number): number | null {
  const voxel = grid[voxelIndex];
  if (!voxel || voxel.voxelType !== 'stairs') return null;
  if (voxel.stairPart !== 'upper' || !voxel.stairAscending) return voxelIndex;
  const { dr, dc } = ASCEND_DELTA[voxel.stairAscending];
  const col = voxelIndex % VOXEL_COLS;
  const row = Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
  const lowerRow = row - dr;
  const lowerCol = col - dc;
  if (lowerRow < 0 || lowerRow >= VOXEL_ROWS || lowerCol < 0 || lowerCol >= VOXEL_COLS) return null;
  const level = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS));
  const lowerIdx = level * (VOXEL_ROWS * VOXEL_COLS) + lowerRow * VOXEL_COLS + lowerCol;
  if (grid[lowerIdx]?.voxelType !== 'stairs') return null;
  return lowerIdx;
}

// buildStairFaces moved to stairEnforcement.ts — imported + re-exported above.

/** Compute smart door config — hinge on side away from obstacles (stairs). */
function _computeSmartDoorConfig(
  grid: Voxel[],
  voxelIndex: number,
  face: 'n' | 's' | 'e' | 'w',
): DoorConfig {
  // For N/S faces: left = -1 col, right = +1 col
  // For E/W faces: left = -VOXEL_COLS row, right = +VOXEL_COLS row
  const leftIdx  = (face === 'n' || face === 's') ? voxelIndex - 1 : voxelIndex - VOXEL_COLS;
  const rightIdx = (face === 'n' || face === 's') ? voxelIndex + 1 : voxelIndex + VOXEL_COLS;

  const leftVoxel  = grid[leftIdx];
  const rightVoxel = grid[rightIdx];

  const leftHasObstacle  = leftVoxel?.voxelType === 'stairs';
  const rightHasObstacle = rightVoxel?.voxelType === 'stairs';

  const hingeEdge: 'left' | 'right' =
    leftHasObstacle  ? 'right' :
    rightHasObstacle ? 'left'  :
    'right'; // default convention

  // Smart slide direction: slide toward an active neighbor, not into void
  const leftActive  = leftVoxel?.active ?? false;
  const rightActive = rightVoxel?.active ?? false;
  const slideDirection: 'positive' | 'negative' =
    !rightActive && leftActive ? 'negative' :
    !leftActive && rightActive ? 'positive' :
    'positive'; // default

  return {
    state: 'closed',
    hingeEdge,
    swingDirection: 'in',
    slideDirection,
    type: 'swing',
  };
}

/**
 * Compute door constraints: can this door swing/slide given neighbors?
 * - Swing blocked if neighbor in swing direction has stairs
 * - Slide blocked if neighbor in slide direction is inactive (empty void)
 */
function _getDoorConstraints(
  grid: Voxel[],
  voxelIndex: number,
  face: keyof VoxelFaces,
): DoorConstraints {
  if (face === 'top' || face === 'bottom') {
    return { canSwing: true, canSlide: true, recommendedType: 'swing' };
  }
  const wallFace = face as 'n' | 's' | 'e' | 'w';

  // For N/S faces: left/right neighbors are cols. For E/W: left/right are rows.
  const leftIdx  = (wallFace === 'n' || wallFace === 's') ? voxelIndex - 1 : voxelIndex - VOXEL_COLS;
  const rightIdx = (wallFace === 'n' || wallFace === 's') ? voxelIndex + 1 : voxelIndex + VOXEL_COLS;

  const leftVoxel  = grid[leftIdx];
  const rightVoxel = grid[rightIdx];

  // The voxel the door swings INTO is across the face (inward by default)
  // For 'in' swing: the voxel at voxelIndex itself. For 'out': the neighbor across the face.
  // We check the voxel ACROSS the face for outward swing obstacles
  const ACROSS: Record<'n' | 's' | 'e' | 'w', number> = {
    n: -VOXEL_COLS, s: VOXEL_COLS, e: 1, w: -1,
  };
  const acrossIdx = voxelIndex + ACROSS[wallFace];
  const acrossVoxel = grid[acrossIdx];

  // Swing constraints: blocked if the voxel the door swings into has stairs
  const selfHasStairs = grid[voxelIndex]?.voxelType === 'stairs';
  const acrossHasStairs = acrossVoxel?.voxelType === 'stairs';
  // Door swings inward by default — blocked if self voxel has stairs
  // Door can swing outward — blocked if across voxel has stairs
  const canSwingIn = !selfHasStairs;
  const canSwingOut = !acrossHasStairs;
  const canSwing = canSwingIn || canSwingOut;

  // Slide constraints: needs an active neighbor to slide into
  const leftActive  = leftVoxel?.active ?? false;
  const rightActive = rightVoxel?.active ?? false;
  const canSlide = leftActive || rightActive;

  let swingBlockReason: string | undefined;
  if (!canSwing) swingBlockReason = 'Stairs block door swing on both sides';
  else if (!canSwingIn && canSwingOut) swingBlockReason = undefined; // can still swing out

  let slideBlockReason: string | undefined;
  if (!canSlide) slideBlockReason = 'No adjacent wall to slide into';

  const recommendedType: 'swing' | 'slide' =
    !canSwing && canSlide ? 'slide' :
    !canSlide && canSwing ? 'swing' :
    'swing'; // default

  return { canSwing, canSlide, swingBlockReason, slideBlockReason, recommendedType };
}

// ── Smart Auto-Railing ─────────────────────────────────────────
// Scans a container's voxel grid for fall-hazard faces and auto-places
// Railing_Cable on exposed edges of open-air voxels. Tracks originals
// in container._smartRailingChanges for reversal.
// Skips stair voxels (owned by stair system) and protected faces.

const WALL_FACES = ['n', 's', 'e', 'w'] as const;
const FACE_NEIGHBOR_DELTA: Record<string, { dr: number; dc: number }> = {
  n: { dr: -1, dc: 0 }, s: { dr: 1, dc: 0 },
  e: { dr: 0, dc: -1 }, w: { dr: 0, dc: 1 },
};
const HOLE_FACE_DELTA: Record<string, { dr: number; dc: number }> = {
  n: { dr: -1, dc: 0 }, s: { dr: 1, dc: 0 },
  e: { dr: 0, dc: 1 }, w: { dr: 0, dc: -1 },
};

/**
 * Recompute smart auto-railings for a container's voxel grid.
 * Mutates grid and container._smartRailingChanges in place (call inside Immer draft or spread).
 * Exported for hydration rebuild in useStore.ts.
 */
export function recomputeSmartRailings(
  grid: Voxel[],
  container: RailingContainer, // Container draft (Immer or spread)
): void {
  const tracking: Record<string, SurfaceType> = container._smartRailingChanges ?? {};
  const newTracking: Record<string, SurfaceType> = {};

  // Pass 1: Determine which faces SHOULD have auto-railing
  const shouldHaveRailing = new Set<string>();
  for (let row = 0; row < VOXEL_ROWS; row++) {
    for (let col = 0; col < VOXEL_COLS; col++) {
      const idx = row * VOXEL_COLS + col;
      const v = grid[idx];
      if (!v?.active) continue;
      if (v.faces.top !== 'Open') continue;       // must be open-air
      if (v.voxelType === 'stairs') continue;       // owned by stair system

      for (const face of WALL_FACES) {
        if (isVoxelFaceProtected(v, face)) continue;   // user or preset override
        // Intentional architectural envelope surfaces — fold panels (act as
        // enclosures), framed windows, glazed walls, doors, shoji, washi.
        // None of these should be silently rewritten to railings just
        // because the cell above is open. Without this guard the
        // framed_glass_box / framed_glass_atrium arrangements lose every
        // perimeter Window_Standard the moment the topmost level promotes
        // its roof to a deck.
        const currentSurface = v.faces[face as keyof VoxelFaces];
        if (
          currentSurface === 'Gull_Wing' || currentSurface === 'Half_Fold' ||
          currentSurface === 'Glass_Pane' || currentSurface === 'Door' ||
          currentSurface === 'Window_Standard' || currentSurface === 'Window_Sill' ||
          currentSurface === 'Window_Clerestory' || currentSurface === 'Window_Half' ||
          currentSurface === 'Glass_Shoji' || currentSurface === 'Wall_Washi'
        ) continue;
        const delta = FACE_NEIGHBOR_DELTA[face];
        const nr = row + delta.dr;
        const nc = col + delta.dc;
        // Fall hazard: neighbor out-of-bounds or inactive
        const neighborInBounds = nr >= 0 && nr < VOXEL_ROWS && nc >= 0 && nc < VOXEL_COLS;
        const neighborActive = neighborInBounds && (grid[nr * VOXEL_COLS + nc]?.active ?? false);
        if (!neighborActive) {
          shouldHaveRailing.add(`${idx}:${face}`);
        }
      }
    }
  }

  // Pass 2: Add new auto-railings
  for (const key of shouldHaveRailing) {
    const [idxStr, face] = key.split(':');
    const idx = parseInt(idxStr, 10);
    const v = grid[idx];
    if (v.faces[face as keyof VoxelFaces] !== 'Railing_Cable') {
      // Record original before changing
      const original = tracking[key] ?? v.faces[face as keyof VoxelFaces];
      newTracking[key] = original;
      grid[idx] = {
        ...v,
        faces: { ...v.faces, [face]: 'Railing_Cable' },
      };
    } else {
      // Already has railing — keep tracking if it was auto-set
      if (tracking[key] !== undefined) {
        newTracking[key] = tracking[key];
      }
    }
  }

  // Pass 3: Remove stale auto-railings (tracked but no longer needed)
  for (const [key, originalSurface] of Object.entries(tracking)) {
    if (shouldHaveRailing.has(key)) continue; // still needed
    const [idxStr, face] = key.split(':');
    const idx = parseInt(idxStr, 10);
    const v = grid[idx];
    if (!v) continue;
    // Check if user/preset has claimed this face since (don't revert intentional changes)
    if (isVoxelFaceProtected(v, face as keyof VoxelFaces)) continue;
    // Restore original
    grid[idx] = {
      ...v,
      faces: { ...v.faces, [face]: originalSurface },
    };
    // Don't add to newTracking (removed)
  }

  container._smartRailingChanges = Object.keys(newTracking).length > 0 ? newTracking : undefined;
}

function trackSmartFaceChange(
  changedFaces: Record<string, SurfaceType>,
  voxelIndex: number,
  face: keyof VoxelFaces,
  original: SurfaceType,
): void {
  const key = `${voxelIndex}:${face}`;
  if (changedFaces[key] === undefined) {
    changedFaces[key] = original;
  }
}

function isSameLevelHoleVoxel(grid: Voxel[], idx: number): boolean {
  const voxel = grid[idx];
  return !!voxel?.active && voxel.voxelType !== 'stairs' && voxel.faces.bottom === 'Open';
}

function holeHasWalkableContinuation(
  grid: Voxel[],
  levelBase: number,
  row: number,
  col: number,
  face: 'n' | 's' | 'e' | 'w',
): boolean {
  const delta = HOLE_FACE_DELTA[face];
  const nr = row + delta.dr;
  const nc = col + delta.dc;
  if (nr < 0 || nr >= VOXEL_ROWS || nc < 0 || nc >= VOXEL_COLS) {
    return false;
  }

  const neighborIdx = levelBase + nr * VOXEL_COLS + nc;
  if (isSameLevelHoleVoxel(grid, neighborIdx)) {
    return false;
  }

  const neighbor = grid[neighborIdx];
  if (!neighbor?.active) {
    return false;
  }

  const oppositeFace = STAIR_FLIP[face] as keyof VoxelFaces;
  return neighbor.voxelType === 'stairs' || (
    neighbor.faces[oppositeFace] === 'Open' &&
    isVoxelFaceProtected(neighbor, oppositeFace)
  );
}

function stairExitFacesForHole(
  grid: Voxel[],
  voxelIndex: number,
  row: number,
  col: number,
): globalThis.Set<'n' | 's' | 'e' | 'w'> {
  const exitFaces = new globalThis.Set<'n' | 's' | 'e' | 'w'>();
  const level = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS));
  const levelBase = level * VOXEL_ROWS * VOXEL_COLS;
  if (level > 0) {
    const belowIdx = voxelIndex - VOXEL_ROWS * VOXEL_COLS;
    const belowVoxel = grid[belowIdx];
    if (
      belowVoxel?.voxelType === 'stairs' &&
      (belowVoxel.stairPart === 'lower' || belowVoxel.stairPart === 'single') &&
      belowVoxel.stairAscending
    ) {
      exitFaces.add(belowVoxel.stairAscending);
    }
  }

  for (const face of WALL_FACES) {
    if (holeHasWalkableContinuation(grid, levelBase, row, col, face)) {
      exitFaces.add(face);
    }
  }

  return exitFaces;
}

export function recomputeSmartHoleGuards(
  grid: Voxel[],
  container: HoleGuardContainer,
): void {
  const tracking: Record<string, SurfaceType> = container._smartHoleGuardChanges ?? {};
  const newTracking: Record<string, SurfaceType> = {};
  const desiredFaces = new Map<string, SurfaceType>();

  for (let level = 1; level < VOXEL_LEVELS; level++) {
    const base = level * VOXEL_ROWS * VOXEL_COLS;
    for (let row = 0; row < VOXEL_ROWS; row++) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        const idx = base + row * VOXEL_COLS + col;
        const voxel = grid[idx];
        if (!isSameLevelHoleVoxel(grid, idx)) continue;

        const stairExitFaces = stairExitFacesForHole(grid, idx, row, col);
        for (const face of WALL_FACES) {
          if (isVoxelFaceProtected(voxel, face)) continue;

          const delta = HOLE_FACE_DELTA[face];
          const nr = row + delta.dr;
          const nc = col + delta.dc;
          const neighborInBounds = nr >= 0 && nr < VOXEL_ROWS && nc >= 0 && nc < VOXEL_COLS;
          const neighborIdx = neighborInBounds ? base + nr * VOXEL_COLS + nc : -1;
          const desired: SurfaceType =
            neighborInBounds && isSameLevelHoleVoxel(grid, neighborIdx)
              ? 'Open'
              : stairExitFaces.has(face)
                ? 'Open'
                : 'Railing_Cable';
          desiredFaces.set(`${idx}:${face}`, desired);
        }
      }
    }
  }

  for (const [key, desired] of desiredFaces.entries()) {
    const [idxStr, face] = key.split(':');
    const idx = parseInt(idxStr, 10);
    const voxel = grid[idx];
    const typedFace = face as keyof VoxelFaces;
    if (!voxel) continue;

    if (voxel.faces[typedFace] !== desired) {
      const original = tracking[key] ?? voxel.faces[typedFace];
      newTracking[key] = original;
      grid[idx] = {
        ...voxel,
        faces: { ...voxel.faces, [typedFace]: desired },
      };
    } else if (tracking[key] !== undefined) {
      newTracking[key] = tracking[key];
    }
  }

  for (const [key, originalSurface] of Object.entries(tracking)) {
    if (desiredFaces.has(key)) continue;
    const [idxStr, face] = key.split(':');
    const idx = parseInt(idxStr, 10);
    const voxel = grid[idx];
    const typedFace = face as keyof VoxelFaces;
    if (!voxel) continue;
    if (isVoxelFaceProtected(voxel, typedFace)) continue;
    if (voxel.faces[typedFace] !== originalSurface) {
      grid[idx] = {
        ...voxel,
        faces: { ...voxel.faces, [typedFace]: originalSurface },
      };
    }
  }

  container._smartHoleGuardChanges = Object.keys(newTracking).length > 0 ? newTracking : undefined;
}

// applyUpperHoleConsequences superseded by computeFloorVoid (SR-01) in stairEnforcement.ts.
// Local alias retained for call sites in this file that still reference the old name.
const applyUpperHoleConsequences = computeFloorVoid;

type VoxelFaceMutationSource = 'user' | 'preset';

function applyVoxelFaceMaterial(
  set: Set,
  get: Get,
  containerId: string,
  voxelIndex: number,
  face: keyof VoxelFaces,
  mat: SurfaceType,
  source: VoxelFaceMutationSource,
): void {
  if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

  set((s) => {
    const c = s.containers[containerId];
    if (!c) return {};
    const grid = c.voxelGrid ? [...c.voxelGrid] : createDefaultVoxelGrid();
    if (voxelIndex < 0 || voxelIndex >= grid.length) return {};
    const voxel = grid[voxelIndex];
    const updatedVoxel: Voxel = {
      ...voxel,
      faces: { ...voxel.faces, [face]: mat },
    };

    if (source === 'user') {
      updatedVoxel.userPaintedFaces = { ...voxel.userPaintedFaces, [face]: true };
    } else {
      updatedVoxel.presetProtectedFaces = { ...voxel.presetProtectedFaces, [face]: true };
    }

    // Auto-create doorConfig when painting Door face.
    if (mat === 'Door' && (face === 'n' || face === 's' || face === 'e' || face === 'w')) {
      const existing = updatedVoxel.doorConfig?.[face];
      if (!existing) {
        updatedVoxel.doorConfig = {
          ...updatedVoxel.doorConfig,
          [face]: _computeSmartDoorConfig(grid, voxelIndex, face),
        };
      }
    }

    grid[voxelIndex] = updatedVoxel;
    const updatedContainer = { ...c, voxelGrid: grid };
    if (get().designMode !== 'manual') {
      recomputeSmartRailings(grid, updatedContainer);
    }

    return {
      containers: { ...s.containers, [containerId]: updatedContainer },
      ...(source === 'user' ? { lastStamp: { containerId, voxelIndex, face, surfaceType: mat } } : {}),
    };
  });
}

/**
 * createVoxelSlice — Voxel-level operations: face painting, stair placement, templates.
 *
 * @remarks
 * All voxel mutations operate on Container.voxelGrid (32-element array for 4x8 grid).
 * Body voxels: rows 1-2, cols 1-6. Extensions: rows 0,3 and cols 0,7.
 * Face painting: setFace/setFaces/fillFaces modify individual VoxelFaces (n/s/e/w/top/bottom).
 * Stair placement: applyStairsFromFace creates 2-voxel stair with floor void above.
 *
 * @see types/container.ts for VoxelFaces, SurfaceType, and coordinate system
 */

/** Shared per-face overlay config setter used by setShelfConfig +
 *  setCabinetConfig. Handles the merge-or-remove pattern uniformly so the two
 *  actions stay in lockstep. Pass `config: null` to remove the overlay from
 *  the face; pass a partial to merge with existing.
 *
 *  TKey is the field name on Voxel ('shelfConfig' | 'cabinetConfig'); TVal
 *  is the config interface stored under that field.
 */
function _setOverlayConfig<
  TKey extends 'shelfConfig' | 'cabinetConfig' | 'fixtureConfig' | 'decorConfig' | 'floorOverlay' | 'ceilingOverlay',
  TVal extends object,
>(
  set: Set,
  containerId: string,
  voxelIndex: number,
  face: keyof VoxelFaces,
  key: TKey,
  config: Partial<TVal> | null,
  buildMerged: (existing: TVal | undefined, c: Partial<TVal>) => TVal,
): void {
  set((s) => {
    const c = s.containers[containerId];
    if (!c?.voxelGrid) return {};
    const grid = [...c.voxelGrid];
    const voxel = grid[voxelIndex];
    if (!voxel) return {};
    const existingMap = (voxel[key] ?? {}) as Partial<Record<keyof VoxelFaces, TVal>>;
    let nextMap: Partial<Record<keyof VoxelFaces, TVal>>;
    if (config === null) {
      nextMap = { ...existingMap };
      delete nextMap[face];
    } else {
      nextMap = { ...existingMap, [face]: buildMerged(existingMap[face], config) };
    }
    grid[voxelIndex] = { ...voxel, [key]: nextMap };
    return {
      containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
    };
  });
}

export const createVoxelSlice = (set: Set, get: Get): VoxelSlice => ({

  setFloorMaterial: (id, material) => {

    set((s) => ({
      containers: {
        ...s.containers,
        [id]: { ...s.containers[id], floorMaterial: material },
      },
    }));
  },

  setCeilingMaterial: (id, material) => {

    set((s) => ({
      containers: {
        ...s.containers,
        [id]: { ...s.containers[id], ceilingMaterial: material },
      },
    }));
  },

  applyContainerPreset: (containerId, presetId) => {
    const preset = getContainerPreset(presetId);
    if (!preset) return;
    const c = get().containers[containerId];
    if (!c) return;

    // Atomic undo: pause temporal, apply all modules, then resume
    const t = _useStoreRef?.temporal.getState();
    if (!t) return;
    t.pause();

    // Reset container to default first (clear previous modules + furniture)
    set((s) => {
      const container = s.containers[containerId];
      if (!container) return {};
      const defaultGrid = createDefaultVoxelGrid();
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...container,
            voxelGrid: defaultGrid,
            furniture: [],
            appliedPreset: presetId,
          },
        },
        furnitureIndex: Object.fromEntries(
          Object.entries(s.furnitureIndex).filter(([, f]) => f.containerId !== containerId)
        ),
      };
    });

    // Apply each module voxel
    for (const v of preset.voxels) {
      get().applyModule(containerId, v.voxelIndex, v.moduleId, v.orientation);
    }

    t.resume();
  },

  addContainerWithPreset: (size, position, presetId) => {
    const t = _useStoreRef?.temporal.getState();
    if (!t) return '';
    t.pause();
    const id = get().addContainer(size, position);
    get().applyContainerPreset(id, presetId);
    t.resume();
    return id;
  },

  applyModule: (containerId, voxelIndex, moduleId, orientation) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

    // Stairs module delegates to applyStairsFromFace
    if (moduleId === 'stairs') {
      // Map orientation to face: inward direction = the face stairs ascend from
      get().applyStairsFromFace(containerId, voxelIndex, orientation);
      return;
    }

    // Entry door: paint Door on outward face with auto-config
    if (moduleId === 'entry_door') {
      get().applyDoorModule(containerId, voxelIndex, orientation);
      return;
    }

    const preset = getModulePreset(moduleId);
    if (!preset) return;

    const faces = resolveModuleFaces(preset, orientation);

    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};

      // Stamp faces + module metadata
      grid[voxelIndex] = {
        ...voxel,
        active: true,
        faces: { ...faces },
        moduleId,
        moduleOrientation: orientation,
      };

      // If preset has furniture, inline it into the same set() for atomic undo
      let furniture = c.furniture;
      let furnitureIndex = s.furnitureIndex;
      if (preset.furnitureType) {
        const dims = CONTAINER_DIMENSIONS[c.size as ContainerSize];
        const col = voxelIndex % VOXEL_COLS;
        const row = Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
        const coreW = dims.length / 6;
        const coreD = dims.width / 2;
        const haloExt = dims.height;
        let px: number;
        if (col === 0) px = dims.length / 2 + haloExt / 2;
        else if (col === VOXEL_COLS - 1) px = -(dims.length / 2 + haloExt / 2);
        else px = -(col - 3.5) * coreW;
        let pz: number;
        if (row === 0) pz = -(dims.width / 2 + haloExt / 2);
        else if (row === VOXEL_ROWS - 1) pz = dims.width / 2 + haloExt / 2;
        else pz = (row - 1.5) * coreD;

        const item: FurnitureItem = {
          id: uuid(),
          type: preset.furnitureType,
          position: { x: px, y: 0.06, z: pz },
          rotation: ORIENT_ROTATION[orientation],
          containerId,
        };
        furniture = [...furniture, item];
        furnitureIndex = { ...furnitureIndex, [item.id]: item };
      }

      return {
        containers: {
          ...s.containers,
          [containerId]: { ...c, voxelGrid: grid, furniture },
        },
        furnitureIndex,
        selectedElements: { type: 'voxel' as const, items: [{ containerId, id: String(voxelIndex) }] },
      };
    });
  },

  stampFromHotbar: (containerId, voxelIndex) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
    const { hotbar, activeHotbarSlot } = get();
    if (activeHotbarSlot === null) return;
    const slot = hotbar[activeHotbarSlot];
    if (!slot?.faces) return;

    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      grid[voxelIndex] = { ...voxel, active: true, faces: { ...slot.faces! } };
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
        selectedElements: { type: 'voxel' as const, items: [{ containerId, id: String(voxelIndex) }] },
        };
    });
  },

  stampArea: (containerId, voxelIndices, faces) => {
    if (voxelIndices.length === 0) return;
    const locked = get().lockedVoxels;

    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      for (const idx of voxelIndices) {
        if (locked[`${containerId}_${idx}`]) continue; // skip locked voxels
        const voxel = grid[idx];
        if (!voxel) continue;
        grid[idx] = { ...voxel, active: true, faces: { ...faces } };
      }
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
        };
    });
  },

  stampAreaSmart: (containerId, voxelIndices, faces) => {
    if (voxelIndices.length === 0) return;
    const locked = get().lockedVoxels;

    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const newGrid = [...c.voxelGrid];

      // isExteriorFace: true when neighbor in given direction is inactive or out-of-bounds.
      // E/W inverted: E(+X)→col-1, W(-X)→col+1 (negated-X axis).
      const isExteriorFace = (
        col: number, row: number,
        face: 'n' | 's' | 'e' | 'w' | 'top' | 'bottom'
      ): boolean => {
        if (face === 'top' || face === 'bottom') return true;
        const dc = face === 'e' ? -1 : face === 'w' ? 1 : 0;
        const dr = face === 'n' ? -1 : face === 's' ? 1 : 0;
        const nc = col + dc, nr = row + dr;
        if (nr < 0 || nr >= VOXEL_ROWS || nc < 0 || nc >= VOXEL_COLS) return true;
        return !newGrid[nr * VOXEL_COLS + nc]?.active;
      };

      for (const idx of voxelIndices) {
        if (locked[`${containerId}_${idx}`]) continue;
        const voxel = newGrid[idx];
        if (!voxel?.active) continue;
        const col = idx % VOXEL_COLS;
        const row = Math.floor(idx / VOXEL_COLS);
        const newFaces = { ...voxel.faces };
        for (const f of ['n', 's', 'e', 'w', 'top', 'bottom'] as const) {
          if (isExteriorFace(col, row, f)) {
            newFaces[f] = faces[f];
          }
          // Interior faces: leave as 'Open' (no wall between adjacent active voxels)
        }
        newGrid[idx] = { ...voxel, faces: newFaces };
      }
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: newGrid } },
        };
    });
  },

  stampStaircase: (containerId, voxelIndex) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
    const { hotbar, activeHotbarSlot, containers } = get();
    if (activeHotbarSlot === null) return;
    const slot = hotbar[activeHotbarSlot];
    if (!slot?.faces || slot.macro !== 'staircase') return;

    // Infer ascending direction from active neighbors, then delegate to applyStairsFromFace
    const c = containers[containerId];
    if (!c?.voxelGrid) return;
    const grid = c.voxelGrid;
    const col = voxelIndex % VOXEL_COLS;
    const rowLocal = Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
    const level = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS));
    const base = level * VOXEL_COLS * VOXEL_ROWS;

    let ascending: 'n' | 's' | 'e' | 'w' = 'n';
    if (rowLocal > 0 && grid[base + (rowLocal - 1) * VOXEL_COLS + col]?.active) ascending = 'n';
    else if (rowLocal < VOXEL_ROWS - 1 && grid[base + (rowLocal + 1) * VOXEL_COLS + col]?.active) ascending = 's';
    else if (col > 0 && grid[base + rowLocal * VOXEL_COLS + (col - 1)]?.active) ascending = 'e';
    else if (col < VOXEL_COLS - 1 && grid[base + rowLocal * VOXEL_COLS + (col + 1)]?.active) ascending = 'w';

    // Entry face = opposite of ascending direction
    const entryFace = STAIR_FLIP[ascending] as 'n' | 's' | 'e' | 'w';
    get().applyStairsFromFace(containerId, voxelIndex, entryFace);
  },

  applyStairsFromFace: (containerId, voxelIndex, face) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
    // Vertical stairs: clicking the top face of a level-0 voxel creates stairs between levels
    if (face === 'top') {
      const level = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS));
      if (level === 0) {
        get().applyVerticalStairs(containerId, voxelIndex, 's'); // default facing south
      }
      return;
    }
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};

      // Entry face = bottom of ascent. Ascending direction = opposite of clicked face.
      const ascending = STAIR_FLIP[face] as 'n' | 's' | 'e' | 'w';
      const isNS = ascending === 'n' || ascending === 's';

      const { dr, dc } = ASCEND_DELTA[ascending];
      const col = voxelIndex % VOXEL_COLS;
      const row = Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
      const upperRow = row + dr;
      const upperCol = col + dc;
      const upperIdx = upperRow * VOXEL_COLS + upperCol;
      const upperInBounds = upperRow >= 0 && upperRow < VOXEL_ROWS && upperCol >= 0 && upperCol < VOXEL_COLS;

      // ── Smart change tracking: record all auto-modifications for reversal ──
      const changedFaces: Record<string, SurfaceType> = {};
      const externalChanges: Array<{ containerId: string; changedFaces: Record<string, SurfaceType> }> = [];

      // Lower voxel (entry side — bottom half of stair run)
      const lowerPart = upperInBounds ? 'lower' : 'single';
      // Save original faces of lower voxel for reversal
      for (const f of ['top', 'bottom', 'n', 's', 'e', 'w'] as const) {
        changedFaces[`${voxelIndex}:${f}`] = voxel.faces[f];
      }
      grid[voxelIndex] = {
        ...voxel,
        active: true,
        voxelType: 'stairs',
        stairPart: lowerPart,
        stairAscending: ascending,
        faces: buildStairFaces(isNS, lowerPart),
      };

      // Upper voxel (ascent side — top half geometry + solid landing)
      let actualUpperIdx: number | undefined;
      if (upperInBounds) {
        actualUpperIdx = upperIdx;
        const upperVoxel = grid[upperIdx] ?? createDefaultVoxelGrid()[upperIdx];
        // Save original faces of upper stair voxel
        for (const f of ['top', 'bottom', 'n', 's', 'e', 'w'] as const) {
          changedFaces[`${upperIdx}:${f}`] = upperVoxel.faces[f];
        }
        grid[upperIdx] = {
          ...upperVoxel,
          active: true,
          voxelType: 'stairs',
          stairPart: 'upper',
          stairAscending: ascending,
          faces: buildStairFaces(isNS, 'upper'),
        };
      }

      // Auto-punch: open the floor of the voxel directly above (same col/row, level+1)
      const level = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS));
      const localIdx = voxelIndex % (VOXEL_ROWS * VOXEL_COLS);
      const aboveIdx = (level + 1) * (VOXEL_ROWS * VOXEL_COLS) + localIdx;
      if (aboveIdx < grid.length && grid[aboveIdx]?.active) {
        applyUpperHoleConsequences(grid, aboveIdx, ascending, changedFaces);
      }

      // ── Smart Consequence: Clear entry wall on neighbor voxel ──
      const entryFace = face as 'n' | 's' | 'e' | 'w';
      const entryDelta = ASCEND_DELTA[entryFace];
      if (entryDelta) {
        const entryRow = row + entryDelta.dr;
        const entryCol = col + entryDelta.dc;
        if (entryRow >= 0 && entryRow < VOXEL_ROWS && entryCol >= 0 && entryCol < VOXEL_COLS) {
          const entryNeighborIdx = level * (VOXEL_ROWS * VOXEL_COLS) + entryRow * VOXEL_COLS + entryCol;
          const entryNeighbor = grid[entryNeighborIdx];
          if (entryNeighbor?.active) {
            const neighborFace = STAIR_FLIP[entryFace] as keyof VoxelFaces;
            if (!isVoxelFaceProtected(entryNeighbor, neighborFace)) {
              changedFaces[`${entryNeighborIdx}:${neighborFace}`] = entryNeighbor.faces[neighborFace];
              grid[entryNeighborIdx] = {
                ...entryNeighbor,
                faces: { ...entryNeighbor.faces, [neighborFace]: 'Open' },
              };
            }
          }
        }
      }

      // ── Smart lateral railings on exposed stair sides ──
      // Check the two faces perpendicular to ascending direction.
      // If the lateral neighbor is inactive or out-of-bounds → fall hazard → add railing.
      const lateralFaces: ('n' | 's' | 'e' | 'w')[] =
        (ascending === 'n' || ascending === 's') ? ['e', 'w'] : ['n', 's'];
      const stairVoxelIndices = [voxelIndex];
      if (actualUpperIdx !== undefined) stairVoxelIndices.push(actualUpperIdx);
      for (const stairIdx of stairVoxelIndices) {
        const stairVoxel = grid[stairIdx];
        if (!stairVoxel) continue;
        const sRow = Math.floor((stairIdx % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
        const sCol = stairIdx % VOXEL_COLS;
        for (const latFace of lateralFaces) {
          if (isVoxelFaceProtected(stairVoxel, latFace)) continue;
          const delta = ASCEND_DELTA[latFace];
          if (!delta) continue;
          const nRow = sRow + delta.dr;
          const nCol = sCol + delta.dc;
          const inBounds = nRow >= 0 && nRow < VOXEL_ROWS && nCol >= 0 && nCol < VOXEL_COLS;
          const nIdx = level * (VOXEL_ROWS * VOXEL_COLS) + nRow * VOXEL_COLS + nCol;
          const neighborActive = inBounds && (grid[nIdx]?.active ?? false);
          if (!neighborActive) {
            // Exposed lateral → add railing
            changedFaces[`${stairIdx}:${latFace}`] = stairVoxel.faces[latFace];
            grid[stairIdx] = {
              ...grid[stairIdx],
              faces: { ...grid[stairIdx].faces, [latFace]: 'Railing_Cable' },
            };
          }
        }
      }

      // Store smart changes on the lower stair voxel for removal reversal
      grid[voxelIndex] = {
        ...grid[voxelIndex],
        _smartStairChanges: {
          changedFaces,
          upperVoxelIdx: actualUpperIdx,
          ascending,
          externalChanges: externalChanges.length > 0 ? externalChanges : undefined,
        },
      };

      // Recompute smart railings (stair placement may affect neighboring open-air voxels)
      const railingContainer: RailingContainer = { _smartRailingChanges: c._smartRailingChanges };
      const holeGuardContainer: HoleGuardContainer = { _smartHoleGuardChanges: c._smartHoleGuardChanges };
      if (get().designMode !== 'manual') {
        recomputeSmartRailings(grid, railingContainer);
        recomputeSmartHoleGuards(grid, holeGuardContainer);
      }

      // Cross-container void: if stairs reach the top level, void floor of container above.
      const reachesTopLevel = level === VOXEL_LEVELS - 1 ||
        (aboveIdx < grid.length && Math.floor(aboveIdx / (VOXEL_ROWS * VOXEL_COLS)) === VOXEL_LEVELS - 1);
      if (reachesTopLevel && c.supporting.length > 0) {
        let updatedContainers = {
          ...s.containers,
          [containerId]: {
            ...c,
            voxelGrid: grid,
            _smartRailingChanges: railingContainer._smartRailingChanges,
            _smartHoleGuardChanges: holeGuardContainer._smartHoleGuardChanges,
          },
        };
        for (const aboveId of c.supporting) {
          const above = s.containers[aboveId];
          if (!above?.voxelGrid) continue;
          const aboveVoxel = above.voxelGrid[localIdx];
          if (aboveVoxel?.active) {
            const aboveGrid = [...above.voxelGrid];
            const externalChangedFaces: Record<string, SurfaceType> = {};
            if (applyUpperHoleConsequences(aboveGrid, localIdx, ascending, externalChangedFaces)) {
              externalChanges.push({ containerId: aboveId, changedFaces: externalChangedFaces });
            }
            const aboveHoleGuardContainer: HoleGuardContainer = {
              _smartHoleGuardChanges: above._smartHoleGuardChanges,
            };
            if (get().designMode !== 'manual') {
              recomputeSmartHoleGuards(aboveGrid, aboveHoleGuardContainer);
            }
            updatedContainers = {
              ...updatedContainers,
              [aboveId]: {
                ...above,
                voxelGrid: aboveGrid,
                _smartHoleGuardChanges: aboveHoleGuardContainer._smartHoleGuardChanges,
              },
            };
          }
        }
        grid[voxelIndex] = {
          ...grid[voxelIndex],
          _smartStairChanges: {
            ...grid[voxelIndex]._smartStairChanges!,
            externalChanges: externalChanges.length > 0 ? externalChanges : undefined,
          },
        };
        updatedContainers = {
          ...updatedContainers,
          [containerId]: {
            ...c,
            voxelGrid: grid,
            _smartRailingChanges: railingContainer._smartRailingChanges,
            _smartHoleGuardChanges: holeGuardContainer._smartHoleGuardChanges,
          },
        };
        return { containers: updatedContainers };
      }

      // Reverse: if stairs at floor level (level 0), void ceiling of container below
      if (level === 0 && c.stackedOn) {
        const below = s.containers[c.stackedOn];
        if (below?.voxelGrid) {
          const belowIdx = (VOXEL_LEVELS - 1) * (VOXEL_ROWS * VOXEL_COLS) + localIdx;
          const belowVoxel = below.voxelGrid[belowIdx];
          if (belowVoxel?.active) {
            const belowGrid = [...below.voxelGrid];
            const externalChangedFaces: Record<string, SurfaceType> = {};
            trackSmartFaceChange(externalChangedFaces, belowIdx, 'top', belowVoxel.faces.top);
            belowGrid[belowIdx] = {
              ...belowVoxel,
              faces: { ...belowVoxel.faces, top: 'Open' },
            };
            externalChanges.push({ containerId: c.stackedOn, changedFaces: externalChangedFaces });
            grid[voxelIndex] = {
              ...grid[voxelIndex],
              _smartStairChanges: {
                ...grid[voxelIndex]._smartStairChanges!,
                externalChanges: externalChanges.length > 0 ? externalChanges : undefined,
              },
            };
            return {
              containers: {
                ...s.containers,
                [containerId]: {
                  ...c,
                  voxelGrid: grid,
                  _smartRailingChanges: railingContainer._smartRailingChanges,
                  _smartHoleGuardChanges: holeGuardContainer._smartHoleGuardChanges,
                },
                [c.stackedOn]: { ...below, voxelGrid: belowGrid },
              },
            };
          }
        }
      }

      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...c,
            voxelGrid: grid,
            _smartRailingChanges: railingContainer._smartRailingChanges,
            _smartHoleGuardChanges: holeGuardContainer._smartHoleGuardChanges,
          },
        },
      };
    });
  },

  applyVerticalStairs: (containerId, voxelIndex, facing) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];

      const level = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS));
      if (level !== 0) return {}; // vertical stairs must start at level 0

      const localIdx = voxelIndex % (VOXEL_ROWS * VOXEL_COLS);
      const upperIdx = (1) * (VOXEL_ROWS * VOXEL_COLS) + localIdx;
      if (upperIdx >= grid.length) return {};

      const isNS = facing === 'n' || facing === 's';
      const lowerVoxel = grid[voxelIndex];
      const upperVoxel = grid[upperIdx] ?? createDefaultVoxelGrid()[upperIdx];

      // Lower voxel (level 0): bottom half of vertical staircase
      grid[voxelIndex] = {
        ...lowerVoxel,
        active: true,
        voxelType: 'stairs',
        stairPart: 'lower',
        stairAscending: facing,
        faces: { ...buildStairFaces(isNS, 'lower'), top: 'Open' },
      };

      // Upper voxel (level 1): top half of vertical staircase
      grid[upperIdx] = {
        ...upperVoxel,
        active: true,
        voxelType: 'stairs',
        stairPart: 'upper',
        stairAscending: facing,
        faces: { ...buildStairFaces(isNS, 'upper'), bottom: 'Open' },
      };

      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });

    // Auto-railing: apply smart railing to adjacent deck voxels
    const afterGrid = get().containers[containerId]?.voxelGrid;
    if (afterGrid) {
      const row = Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
      const col = voxelIndex % VOXEL_COLS;
      const neighbors = [
        { r: row - 1, c: col },     // north
        { r: row + 1, c: col },     // south
        { r: row, c: col - 1 },     // west
        { r: row, c: col + 1 },     // east
      ];
      for (const nb of neighbors) {
        if (nb.r < 0 || nb.r >= VOXEL_ROWS || nb.c < 0 || nb.c >= VOXEL_COLS) continue;
        const nbIdx = nb.r * VOXEL_COLS + nb.c;
        const nbVoxel = afterGrid[nbIdx];
        if (nbVoxel?.active && nbVoxel.faces.top === 'Deck_Wood') {
          get().applySmartRailing(containerId, nbIdx);
        }
      }
    }
  },

  applySmartRailing: (containerId, voxelIndex) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel || !voxel.active) return {};

      const col      = voxelIndex % VOXEL_COLS;
      const rowLocal = Math.floor((voxelIndex % (VOXEL_COLS * VOXEL_ROWS)) / VOXEL_COLS);
      const level    = Math.floor(voxelIndex / (VOXEL_COLS * VOXEL_ROWS));
      const base     = level * VOXEL_COLS * VOXEL_ROWS;
      const dims     = CONTAINER_DIMENSIONS[c.size as ContainerSize];

      const WALKABLE: SurfaceType[] = ['Deck_Wood', 'Concrete'];
      const newFaces = { ...voxel.faces };

      const checkFace = (face: 'n' | 's' | 'e' | 'w') => {
        // E/W inverted: E(+X)→col-1, W(-X)→col+1 (negated-X axis)
        const dc = face === 'e' ? -1 : face === 'w' ? 1 : 0;
        const dr = face === 's' ? 1  : face === 'n' ? -1 : 0;
        const nc = col + dc, nr = rowLocal + dr;

        // 1) Same-level neighbor in this grid
        if (nc >= 0 && nc < VOXEL_COLS && nr >= 0 && nr < VOXEL_ROWS) {
          const neighbor = grid[base + nr * VOXEL_COLS + nc];
          // Stair voxels are drop-offs — always need railing even if technically "active"
          if (neighbor?.active && neighbor.voxelType !== 'stairs' && WALKABLE.includes(neighbor.faces.bottom)) {
            newFaces[face] = 'Open';
            return;
          }
        }

        // 2) Y-stacked container probe
        const thisTop = c.position.y + dims.height;
        const colPitch = dims.length / 6;
        const rowPitch = dims.width / 2;
        const localX = -(col - 3.5) * colPitch;
        const localZ = (rowLocal - 1.5) * rowPitch;
        const cosR = Math.cos(c.rotation), sinR = Math.sin(c.rotation);
        const worldX = c.position.x + localX * cosR - localZ * sinR;
        const worldZ = c.position.z + localX * sinR + localZ * cosR;

        for (const other of Object.values(s.containers) as Container[]) {
          if (other.id === containerId || !other.voxelGrid) continue;
          const otherDims = CONTAINER_DIMENSIONS[other.size as ContainerSize];
          if (Math.abs(thisTop - other.position.y) < 0.1) {
            const dx = worldX - other.position.x;
            const dz = worldZ - other.position.z;
            const oCos = Math.cos(-other.rotation), oSin = Math.sin(-other.rotation);
            const lx = dx * oCos - dz * oSin;
            const lz = dx * oSin + dz * oCos;
            const oColPitch = otherDims.length / 6;
            const oRowPitch = otherDims.width / 2;
            const oCol = Math.round(-lx / oColPitch + 3.5);
            const oRow = Math.round(lz / oRowPitch + 1.5);
            if (oCol >= 0 && oCol < VOXEL_COLS && oRow >= 0 && oRow < VOXEL_ROWS) {
              const oVox = other.voxelGrid[oRow * VOXEL_COLS + oCol];
              if (oVox?.active && WALKABLE.includes(oVox.faces.top)) {
                newFaces[face] = 'Open';
                return;
              }
            }
          }
        }

        // 3) Default: railing
        newFaces[face] = 'Railing_Cable';
      };

      checkFace('n'); checkFace('s'); checkFace('e'); checkFace('w');
      grid[voxelIndex] = { ...voxel, faces: newFaces };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  removeStairs: (containerId, voxelIndex) => {
    // Phase 1: Set _stairExiting flag to trigger exit animation.
    // Stair data stays intact for rendering during animation.
    // clearStairExit does the actual cleanup after animation completes.
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];

      // Resolve upper voxel to lower (which owns _smartStairChanges)
      const resolved = resolveToLowerStair(grid, voxelIndex);
      if (resolved === null) return {};
      voxelIndex = resolved;

      // Mark lower and upper stair voxels as exiting
      grid[voxelIndex] = { ...grid[voxelIndex], _stairExiting: true };
      const smartChanges = grid[voxelIndex]._smartStairChanges;
      if (smartChanges?.upperVoxelIdx !== undefined) {
        const uIdx = smartChanges.upperVoxelIdx;
        if (uIdx >= 0 && uIdx < grid.length && grid[uIdx]?.voxelType === 'stairs') {
          grid[uIdx] = { ...grid[uIdx], _stairExiting: true };
        }
      }

      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  clearStairExit: (containerId, voxelIndex) => {
    // Phase 2: Actual stair data cleanup (called after exit animation completes).
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      let updatedContainers = { ...s.containers };

      // Resolve upper voxel to lower (which owns _smartStairChanges)
      const resolved = resolveToLowerStair(grid, voxelIndex);
      if (resolved === null) return {};
      voxelIndex = resolved;

      const smartChanges = grid[voxelIndex]._smartStairChanges;
      if (!smartChanges) {
        // No smart tracking — just revert stair voxels to default
        const defaults = createDefaultVoxelGrid();
        grid[voxelIndex] = { ...defaults[voxelIndex] };
        const rc: RailingContainer = { _smartRailingChanges: c._smartRailingChanges };
        const hc: HoleGuardContainer = { _smartHoleGuardChanges: c._smartHoleGuardChanges };
        if (get().designMode !== 'manual') {
          recomputeSmartRailings(grid, rc);
          recomputeSmartHoleGuards(grid, hc);
        }
        return {
          containers: {
            ...s.containers,
            [containerId]: {
              ...c,
              voxelGrid: grid,
              _smartRailingChanges: rc._smartRailingChanges,
              _smartHoleGuardChanges: hc._smartHoleGuardChanges,
            },
          },
        };
      }

      // Restore all tracked face changes
      for (const [key, originalFace] of Object.entries(smartChanges.changedFaces)) {
        const [idxStr, faceKey] = key.split(':');
        const idx = parseInt(idxStr, 10);
        if (idx >= 0 && idx < grid.length && grid[idx]) {
          grid[idx] = {
            ...grid[idx],
            faces: { ...grid[idx].faces, [faceKey]: originalFace },
          };
        }
      }

      for (const externalChange of smartChanges.externalChanges ?? []) {
        const target = updatedContainers[externalChange.containerId];
        if (!target?.voxelGrid) continue;
        const targetGrid = [...target.voxelGrid];
        for (const [key, originalFace] of Object.entries(externalChange.changedFaces)) {
          const [idxStr, faceKey] = key.split(':');
          const idx = parseInt(idxStr, 10);
          if (idx >= 0 && idx < targetGrid.length && targetGrid[idx]) {
            targetGrid[idx] = {
              ...targetGrid[idx],
              faces: { ...targetGrid[idx].faces, [faceKey]: originalFace },
            };
          }
        }
        updatedContainers = {
          ...updatedContainers,
          [externalChange.containerId]: { ...target, voxelGrid: targetGrid },
        };
      }

      for (const externalChange of smartChanges.externalChanges ?? []) {
        const target = updatedContainers[externalChange.containerId];
        if (!target?.voxelGrid) continue;
        const targetGrid = [...target.voxelGrid];
        const targetHoleGuardContainer: HoleGuardContainer = {
          _smartHoleGuardChanges: target._smartHoleGuardChanges,
        };
        if (get().designMode !== 'manual') {
          recomputeSmartHoleGuards(targetGrid, targetHoleGuardContainer);
        }
        updatedContainers = {
          ...updatedContainers,
          [externalChange.containerId]: {
            ...target,
            voxelGrid: targetGrid,
            _smartHoleGuardChanges: targetHoleGuardContainer._smartHoleGuardChanges,
          },
        };
      }

      // Revert lower stair voxel to standard
      const defaults = createDefaultVoxelGrid();
      grid[voxelIndex] = {
        ...defaults[voxelIndex],
        active: grid[voxelIndex].active,
      };
      delete grid[voxelIndex]._smartStairChanges;
      delete grid[voxelIndex].voxelType;
      delete grid[voxelIndex].stairAscending;
      delete grid[voxelIndex].stairPart;
      delete grid[voxelIndex]._stairExiting;

      // Revert upper stair voxel if it exists
      if (smartChanges.upperVoxelIdx !== undefined) {
        const uIdx = smartChanges.upperVoxelIdx;
        if (uIdx >= 0 && uIdx < grid.length) {
          grid[uIdx] = {
            ...defaults[uIdx],
            active: grid[uIdx].active,
          };
          delete grid[uIdx].voxelType;
          delete grid[uIdx].stairAscending;
          delete grid[uIdx].stairPart;
          delete grid[uIdx]._stairExiting;
        }
      }

      // Recompute smart railings after stair removal
      const railingContainer: RailingContainer = { _smartRailingChanges: c._smartRailingChanges };
      const holeGuardContainer: HoleGuardContainer = { _smartHoleGuardChanges: c._smartHoleGuardChanges };
      if (get().designMode !== 'manual') {
        recomputeSmartRailings(grid, railingContainer);
        recomputeSmartHoleGuards(grid, holeGuardContainer);
      }
      updatedContainers = {
        ...updatedContainers,
        [containerId]: {
          ...c,
          voxelGrid: grid,
          _smartRailingChanges: railingContainer._smartRailingChanges,
          _smartHoleGuardChanges: holeGuardContainer._smartHoleGuardChanges,
        },
      };

      return { containers: updatedContainers };
    });
  },

  convertToPool: (containerId) => {

    set((s) => {
      const c = s.containers[containerId];
      if (!c) return {};
      return {
        containers: {
          ...s.containers,
          [containerId]: { ...c, voxelGrid: createPoolVoxelGrid(), roofRemoved: true },
        },
        };
    });
  },

  resetVoxelGrid: (containerId) => {

    set((s) => {
      const c = s.containers[containerId];
      if (!c) return {};
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: createDefaultVoxelGrid(), _smartRailingChanges: undefined } } };
    });
  },

  toggleVoxelLock: (containerId, voxelIndex) => {
    const key = `${containerId}_${voxelIndex}`;
    set((s) => ({
      lockedVoxels: { ...s.lockedVoxels, [key]: !s.lockedVoxels[key] },
    }));
  },

  isVoxelLocked: (containerId, voxelIndex) => {
    return !!get().lockedVoxels[`${containerId}_${voxelIndex}`];
  },

  toggleDoorState: (containerId, voxelIndex, face) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      const surface = voxel.faces[face];
      // Only Door and Glass_Shoji support door states
      if (surface !== 'Door' && surface !== 'Glass_Shoji') return {};
      const current = voxel.doorStates?.[face] ?? 'closed';
      let next: 'closed' | 'open_swing' | 'open_slide';
      if (surface === 'Glass_Shoji') {
        // Shoji: closed → open_slide → closed
        next = current === 'closed' ? 'open_slide' : 'closed';
      } else {
        // Door: closed → open_swing → open_slide → closed
        next = current === 'closed' ? 'open_swing' : current === 'open_swing' ? 'open_slide' : 'closed';
      }
      const isOpen = next !== 'closed';
      grid[voxelIndex] = {
        ...voxel,
        doorStates: { ...voxel.doorStates, [face]: next },
        openFaces: { ...voxel.openFaces, [face]: isOpen },
      };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  cycleVoxelFace: (containerId, voxelIndex, face) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
    const cycle = getCycleForFace(face);

    set((s) => {
      const c = s.containers[containerId];
      if (!c || !c.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      const current = voxel.faces[face];
      const i = cycle.indexOf(current as SurfaceType);
      const nextIdx = i < 0 ? 0 : (i + 1) % cycle.length;
      grid[voxelIndex] = {
        ...voxel,
        faces: { ...voxel.faces, [face]: cycle[nextIdx] },
        userPaintedFaces: { ...voxel.userPaintedFaces, [face]: true },
      };
      return {
        containers: {
          ...s.containers,
          [containerId]: { ...c, voxelGrid: grid },
        },
        };
    });
  },

  cycleVoxelTemplate: (containerId, voxelIndex) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

    // ★ Structural State Machine — E-key cycles through physical configurations
    const STRUCT_CONFIGS: { faces: VoxelFaces; active: boolean }[] = [
      // 1. None (Void) — completely empty
      { faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' }, active: false },
      // 2. Floor Only — wood plank floor
      { faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' }, active: true },
      // 3. Ceiling Only — steel roof
      { faces: { top: 'Solid_Steel', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' }, active: true },
      // 4. Floor + Ceiling — enclosed slab
      { faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' }, active: true },
      // 5. Floor + Ceiling + Railing — guarded platform
      { faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' }, active: true },
      // 6. Floor + Ceiling + Window — glass-enclosed room
      { faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' }, active: true },
    ];
    set((s) => {
      const c = s.containers[containerId];
      if (!c || !c.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      // Match current state to find position in cycle
      const curIdx = STRUCT_CONFIGS.findIndex((cfg) =>
        cfg.active === voxel.active &&
        cfg.faces.top === voxel.faces.top && cfg.faces.bottom === voxel.faces.bottom &&
        cfg.faces.n === voxel.faces.n && cfg.faces.s === voxel.faces.s &&
        cfg.faces.e === voxel.faces.e && cfg.faces.w === voxel.faces.w
      );
      const nextIdx = (curIdx + 1) % STRUCT_CONFIGS.length;
      const next = STRUCT_CONFIGS[nextIdx];
      grid[voxelIndex] = { ...voxel, active: next.active, faces: { ...next.faces } };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  setVoxelActive: (containerId, voxelIndex, active) => {

    set((s) => {
      const c = s.containers[containerId];
      if (!c) return {};
      const grid = c.voxelGrid ? [...c.voxelGrid] : createDefaultVoxelGrid();
      if (voxelIndex < 0 || voxelIndex >= grid.length) return {};
      const voxel = grid[voxelIndex];
      let updatedWalls = c.walls;
      if (active && voxel.type === 'deck') {
        // When activating a deck voxel, default Open side faces to Railing_Cable
        // (only in smart mode — manual mode leaves faces as-is)
        const faces = { ...voxel.faces };
        if (get().designMode !== 'manual') {
          if (faces.n === 'Open') faces.n = 'Railing_Cable';
          if (faces.s === 'Open') faces.s = 'Railing_Cable';
          if (faces.e === 'Open') faces.e = 'Railing_Cable';
          if (faces.w === 'Open') faces.w = 'Railing_Cable';
        }

        // ── Smart Wall: auto-open the shared face between halo and adjacent core ──
        // Halo cols: 0 (West end) and VOXEL_COLS-1 (East end)
        // Halo rows: 0 (Left deck) and VOXEL_ROWS-1 (Right deck)
        const levelOffset = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS)) * (VOXEL_ROWS * VOXEL_COLS);
        const localIdx    = voxelIndex % (VOXEL_ROWS * VOXEL_COLS);
        const col = localIdx % VOXEL_COLS;
        const row = Math.floor(localIdx / VOXEL_COLS);

        if (col === 0) {
          // West halo → open E face (toward core col 1)
          faces.e = 'Open';
          const adjIdx = levelOffset + row * VOXEL_COLS + 1;
          if (adjIdx < grid.length) {
            grid[adjIdx] = { ...grid[adjIdx], faces: { ...grid[adjIdx].faces, w: 'Open' } };
          }
        }
        if (col === VOXEL_COLS - 1) {
          // East halo → open W face (toward core col VOXEL_COLS-2)
          faces.w = 'Open';
          const adjIdx = levelOffset + row * VOXEL_COLS + (VOXEL_COLS - 2);
          if (adjIdx >= 0 && adjIdx < grid.length) {
            grid[adjIdx] = { ...grid[adjIdx], faces: { ...grid[adjIdx].faces, e: 'Open' } };
          }
        }
        if (row === 0) {
          // North halo → open S face (toward core row 1)
          faces.s = 'Open';
          const adjIdx = levelOffset + 1 * VOXEL_COLS + col;
          if (adjIdx < grid.length) {
            grid[adjIdx] = { ...grid[adjIdx], faces: { ...grid[adjIdx].faces, n: 'Open' } };
          }
        }
        if (row === VOXEL_ROWS - 1) {
          // South halo → open N face (toward core row VOXEL_ROWS-2)
          faces.n = 'Open';
          const adjIdx = levelOffset + (VOXEL_ROWS - 2) * VOXEL_COLS + col;
          if (adjIdx >= 0 && adjIdx < grid.length) {
            grid[adjIdx] = { ...grid[adjIdx], faces: { ...grid[adjIdx].faces, s: 'Open' } };
          }
        }

        grid[voxelIndex] = { ...voxel, active, faces };

        // ── Dual-layer: open the matching ContainerMesh bay module ──
        // When a halo voxel is activated, the adjacent ContainerMesh wall
        // panel at the same position must also become OpenVoid so the steel
        // bay doesn't remain visible behind the voxel skin.
        {
          const dims       = CONTAINER_DIMENSIONS[c.size as ContainerSize];
          const { length: len, width } = dims;
          const longBayCount  = LONG_WALL_BAYS[c.size as ContainerSize];
          const bayWidth      = len / longBayCount;
          const shortBayCount = SHORT_WALL_BAYS;
          const shortBayWidth = width / shortBayCount;
          const cpitch        = len / 6;
          const rpitch        = width / 2;
          const px            = -(col - 3.5) * cpitch;
          const pz            = (row - 1.5) * rpitch;

          const openBay = (ws: WallSide, rawIdx: number) => {
            const wall = updatedWalls[ws];
            if (!wall) return;
            const cnt = (ws === WallSide.Left || ws === WallSide.Right) ? longBayCount : shortBayCount;
            const bi  = Math.max(0, Math.min(cnt - 1, rawIdx));
            const newBays = wall.bays.map((slot: BaySlot) =>
              slot.index === bi ? { ...slot, module: createOpenVoid() } : slot
            );
            updatedWalls = { ...updatedWalls, [ws]: { ...wall, bays: newBays } };
          };

          if (row === 0)               openBay(WallSide.Left,  Math.round((px + len / 2 - bayWidth / 2) / bayWidth));
          if (row === VOXEL_ROWS - 1)  openBay(WallSide.Right, Math.round((len / 2 - bayWidth / 2 - px) / bayWidth));
          if (col === 0)               openBay(WallSide.Front, Math.round((pz + width / 2 - shortBayWidth / 2) / shortBayWidth));
          if (col === VOXEL_COLS - 1)  openBay(WallSide.Back,  Math.round((width / 2 - shortBayWidth / 2 - pz) / shortBayWidth));
        }

      } else {
        grid[voxelIndex] = { ...voxel, active };
      }
      const updatedContainer = { ...c, voxelGrid: grid, walls: updatedWalls };
      if (get().designMode !== 'manual') {
        recomputeSmartRailings(grid, updatedContainer);
      }
      return { containers: { ...s.containers, [containerId]: updatedContainer } };
    });
  },

  setVoxelFace: (containerId, voxelIndex, face, mat) => {
    // Redirect stairs surface to dedicated stair setter
    if (mat === 'Stairs' && (face === 'n' || face === 's' || face === 'e' || face === 'w')) {
      get().applyStairsFromFace(containerId, voxelIndex, face as 'n' | 's' | 'e' | 'w');
      return;
    }
    // Stairs_Down: same geometry but treads descend FROM the clicked face — flip the ascending direction
    if (mat === 'Stairs_Down' && (face === 'n' || face === 's' || face === 'e' || face === 'w')) {
      const flip: Record<string, 'n' | 's' | 'e' | 'w'> = { n: 's', s: 'n', e: 'w', w: 'e' };
      get().applyStairsFromFace(containerId, voxelIndex, flip[face]);
      return;
    }
    applyVoxelFaceMaterial(set, get, containerId, voxelIndex, face, mat, 'user');
  },

  setUserOptOut: (containerId, voxelIndex, face, value) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c) return {};
      const grid = c.voxelGrid ? [...c.voxelGrid] : null;
      if (!grid || voxelIndex < 0 || voxelIndex >= grid.length) return {};
      const v = grid[voxelIndex];
      const nextOptOut = { ...v.userOptOut, [face]: value };
      // Drop the key entirely when value is false to keep the object tidy
      if (!value) delete nextOptOut[face];
      grid[voxelIndex] = { ...v, userOptOut: nextOptOut };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  setVoxelFacePreset: (containerId, voxelIndex, face, mat) => {
    if (mat === 'Stairs' && (face === 'n' || face === 's' || face === 'e' || face === 'w')) {
      get().applyStairsFromFace(containerId, voxelIndex, face as 'n' | 's' | 'e' | 'w');
      return;
    }
    if (mat === 'Stairs_Down' && (face === 'n' || face === 's' || face === 'e' || face === 'w')) {
      const flip: Record<string, 'n' | 's' | 'e' | 'w'> = { n: 's', s: 'n', e: 'w', w: 'e' };
      get().applyStairsFromFace(containerId, voxelIndex, flip[face]);
      return;
    }
    applyVoxelFaceMaterial(set, get, containerId, voxelIndex, face, mat, 'preset');
  },

  setVoxelFacesPresetBatch: (containerId, overrides) => {
    if (overrides.length === 0) return;
    const lockedSet = get().lockedVoxels;
    set((s) => {
      const c = s.containers[containerId];
      if (!c) return {};
      const grid = c.voxelGrid ? [...c.voxelGrid] : createDefaultVoxelGrid();
      const cloned = new Set<number>();
      for (const o of overrides) {
        if (lockedSet[`${containerId}_${o.voxelIndex}`]) continue;
        if (o.voxelIndex < 0 || o.voxelIndex >= grid.length) continue;
        const original = grid[o.voxelIndex];
        const target: Voxel = cloned.has(o.voxelIndex)
          ? grid[o.voxelIndex]
          : {
              ...original,
              faces: { ...original.faces },
              presetProtectedFaces: { ...original.presetProtectedFaces },
            };
        target.faces[o.face] = o.material;
        target.presetProtectedFaces = { ...target.presetProtectedFaces, [o.face]: true };
        // Auto-create doorConfig for Door faces (mirror setVoxelFace).
        if (o.material === 'Door' && (o.face === 'n' || o.face === 's' || o.face === 'e' || o.face === 'w')) {
          const existing = target.doorConfig?.[o.face];
          if (!existing) {
            target.doorConfig = {
              ...target.doorConfig,
              [o.face]: _computeSmartDoorConfig(grid, o.voxelIndex, o.face),
            };
          }
        }
        grid[o.voxelIndex] = target;
        cloned.add(o.voxelIndex);
      }
      const updatedContainer = { ...c, voxelGrid: grid };
      if (get().designMode !== 'manual') {
        recomputeSmartRailings(grid, updatedContainer);
      }
      return { containers: { ...s.containers, [containerId]: updatedContainer } };
    });
  },

  setVoxelAllFaces: (containerId, voxelIndex, mat) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

    set((s) => {
      const c = s.containers[containerId];
      if (!c) return {};
      const grid = c.voxelGrid ? [...c.voxelGrid] : createDefaultVoxelGrid();
      if (voxelIndex < 0 || voxelIndex >= grid.length) return {};
      grid[voxelIndex] = {
        ...grid[voxelIndex],
        faces: { top: mat, bottom: mat, n: mat, s: mat, e: mat, w: mat },
      };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  isStaircaseMacro: () => {
    const { hotbar, activeHotbarSlot } = get();
    if (activeHotbarSlot === null) return false;
    return hotbar[activeHotbarSlot]?.macro === 'staircase';
  },

  setVoxelRoomTag: (containerId, voxelIndex, tag) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      grid[voxelIndex] = { ...voxel, roomTag: tag };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  setDoorConfig: (containerId, voxelIndex, face, config) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      const existing = voxel.doorConfig?.[face] ?? {
        state: 'closed' as const, hingeEdge: 'right' as const,
        swingDirection: 'in' as const, slideDirection: 'positive' as const, type: 'swing' as const,
      };
      const merged = { ...existing, ...config };

      // Enforce collision constraints
      const constraints = _getDoorConstraints(grid, voxelIndex, face);
      if (merged.type === 'swing' && !constraints.canSwing && constraints.canSlide) {
        merged.type = 'slide'; // auto-correct: can't swing, fall back to slide
      } else if (merged.type === 'slide' && !constraints.canSlide && constraints.canSwing) {
        merged.type = 'swing'; // auto-correct: can't slide, fall back to swing
      }

      // For swing doors, ensure swingDirection avoids stairs
      if (merged.type === 'swing' && face !== 'top' && face !== 'bottom') {
        const wallFace = face as 'n' | 's' | 'e' | 'w';
        const ACROSS: Record<'n' | 's' | 'e' | 'w', number> = {
          n: -VOXEL_COLS, s: VOXEL_COLS, e: 1, w: -1,
        };
        const selfHasStairs = grid[voxelIndex]?.voxelType === 'stairs';
        const acrossVoxel = grid[voxelIndex + ACROSS[wallFace]];
        const acrossHasStairs = acrossVoxel?.voxelType === 'stairs';
        if (merged.swingDirection === 'in' && selfHasStairs && !acrossHasStairs) {
          merged.swingDirection = 'out';
        } else if (merged.swingDirection === 'out' && acrossHasStairs && !selfHasStairs) {
          merged.swingDirection = 'in';
        }
      }

      // Smart slide direction: when switching to slide, validate direction
      if (merged.type === 'slide' && face !== 'top' && face !== 'bottom') {
        const smart = _computeSmartDoorConfig(grid, voxelIndex, face as 'n' | 's' | 'e' | 'w');
        // Only override if the caller didn't explicitly set slideDirection
        if (!config.slideDirection) {
          merged.slideDirection = smart.slideDirection;
        }
      }

      grid[voxelIndex] = {
        ...voxel,
        doorConfig: { ...voxel.doorConfig, [face]: merged },
      };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  applyDoorModule: (containerId, voxelIndex, orientation) => {
    // orientation maps to the outward face where the door is placed
    // In ORIENT_MAP: outward is the opposite of orientation
    const OUTWARD: Record<ModuleOrientation, 'n' | 's' | 'e' | 'w'> = {
      n: 's', s: 'n', e: 'w', w: 'e',
    };
    const doorFace = OUTWARD[orientation];

    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};

      const smartConfig = _computeSmartDoorConfig(grid, voxelIndex, doorFace);
      // Check constraints to pick best default type
      const constraints = _getDoorConstraints(grid, voxelIndex, doorFace);
      if (!constraints.canSwing && constraints.canSlide) {
        smartConfig.type = 'slide';
      }

      grid[voxelIndex] = {
        ...voxel,
        active: true,
        faces: { ...voxel.faces, [doorFace]: 'Door' as SurfaceType },
        doorConfig: { ...voxel.doorConfig, [doorFace]: smartConfig },
        moduleId: 'entry_door',
        moduleOrientation: orientation,
      };

      // Smart: sync opposite face on adjacent voxel — a door occupies both sides
      const oppFace = STAIR_FLIP[doorFace];
      const level = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS));
      const col = voxelIndex % VOXEL_COLS;
      const row = Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
      const { dr, dc } = FACE_NEIGHBOR_DELTA[doorFace];
      const nr = row + dr, nc = col + dc;
      if (nr >= 0 && nr < VOXEL_ROWS && nc >= 0 && nc < VOXEL_COLS) {
        const neighborIdx = level * (VOXEL_ROWS * VOXEL_COLS) + nr * VOXEL_COLS + nc;
        const neighbor = grid[neighborIdx];
        if (neighbor?.active) {
          grid[neighborIdx] = {
            ...neighbor,
            faces: { ...neighbor.faces, [oppFace]: 'Door' as SurfaceType },
            doorConfig: { ...neighbor.doorConfig, [oppFace]: smartConfig },
          };
        }
      }

      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  getDoorConstraints: (containerId, voxelIndex, face) => {
    const c = get().containers[containerId] as Container | undefined;
    if (!c?.voxelGrid) return { canSwing: true, canSlide: true, recommendedType: 'swing' };
    return _getDoorConstraints(c.voxelGrid, voxelIndex, face);
  },

  paintFace: (containerId, voxelIndex, face, surface) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel || !voxel.active) return {};
      grid[voxelIndex] = {
        ...voxel,
        faces: { ...voxel.faces, [face]: surface },
        userPaintedFaces: { ...voxel.userPaintedFaces, [face]: true },
      };
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
        };
    });
  },

  setWindowConfig: (containerId, voxelIndex, face, config) => {
    // Per-voxel-face window template/skin selection. Merges with any
    // existing config for that face so partial updates (just the skin, just
    // the template) work without erasing other fields.
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      const existing = voxel.windowConfig?.[face];
      const merged: import('@/types/container').WindowConfig = {
        template: config.template ?? existing?.template ?? 'fixed_picture',
        skin: config.skin ?? existing?.skin ?? 'aluminum_black',
        openAmount: config.openAmount ?? existing?.openAmount,
      };
      const nextWindowConfig = { ...(voxel.windowConfig ?? {}), [face]: merged };
      grid[voxelIndex] = { ...voxel, windowConfig: nextWindowConfig };
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
      };
    });
  },

  setHingedConfig: (containerId, voxelIndex, face, config) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      // Null clears the entry, resetting that face to closed (0) implicitly.
      if (config === null) {
        if (!voxel.hingedConfig?.[face]) return {};
        const next = { ...(voxel.hingedConfig ?? {}) };
        delete next[face];
        grid[voxelIndex] = { ...voxel, hingedConfig: next };
        return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
      }
      const existing = voxel.hingedConfig?.[face];
      const rawAmount = config.openAmount ?? existing?.openAmount ?? 0;
      // Clamp to [0,1] so out-of-range inputs can't flip the panel inside-out.
      const clamped = rawAmount < 0 ? 0 : rawAmount > 1 ? 1 : rawAmount;
      const merged: import('@/types/container').HingedConfig = { openAmount: clamped };
      const nextHingedConfig = { ...(voxel.hingedConfig ?? {}), [face]: merged };
      grid[voxelIndex] = { ...voxel, hingedConfig: nextHingedConfig };
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
      };
    });
  },

  setShelfConfig: (containerId, voxelIndex, face, config) =>
    _setOverlayConfig<'shelfConfig', import('@/types/container').ShelfConfig>(
      set, containerId, voxelIndex, face, 'shelfConfig', config,
      (existing, c) => ({
        template: c.template ?? existing?.template ?? 'wall_unit_3',
        skin: c.skin ?? existing?.skin ?? 'oak_natural',
        verticalAnchor: c.verticalAnchor ?? existing?.verticalAnchor,
      }),
    ),

  setCabinetConfig: (containerId, voxelIndex, face, config) =>
    _setOverlayConfig<'cabinetConfig', import('@/types/container').CabinetConfig>(
      set, containerId, voxelIndex, face, 'cabinetConfig', config,
      (existing, c) => ({
        template: c.template ?? existing?.template ?? 'wall_2door',
        skin: c.skin ?? existing?.skin ?? 'shaker_white',
        verticalAnchor: c.verticalAnchor ?? existing?.verticalAnchor,
        openAmount: c.openAmount ?? existing?.openAmount,
        counterTop: c.counterTop ?? existing?.counterTop,
        underCabinetLight: c.underCabinetLight ?? existing?.underCabinetLight,
        underCabinetLightColor: c.underCabinetLightColor ?? existing?.underCabinetLightColor,
      }),
    ),

  setFixtureConfig: (containerId, voxelIndex, face, config) =>
    _setOverlayConfig<'fixtureConfig', import('@/types/container').FixtureConfig>(
      set, containerId, voxelIndex, face, 'fixtureConfig', config,
      (existing, c) => ({
        template: c.template ?? existing?.template ?? 'sink_kitchen_double',
        verticalAnchor: c.verticalAnchor ?? existing?.verticalAnchor,
        openAmount: c.openAmount ?? existing?.openAmount,
      }),
    ),

  setDecorConfig: (containerId, voxelIndex, face, config) =>
    _setOverlayConfig<'decorConfig', import('@/types/container').DecorConfig>(
      set, containerId, voxelIndex, face, 'decorConfig', config,
      (existing, c) => ({
        template: c.template ?? existing?.template ?? 'framed_picture_landscape',
        palette: c.palette ?? existing?.palette ?? 'frame_black',
        verticalAnchor: c.verticalAnchor ?? existing?.verticalAnchor,
        pictureLight: c.pictureLight ?? existing?.pictureLight,
      }),
    ),

  setFloorOverlay: (containerId, voxelIndex, face, config) =>
    _setOverlayConfig<'floorOverlay', import('@/types/container').FloorOverlayConfig>(
      set, containerId, voxelIndex, face, 'floorOverlay', config,
      (existing, c) => ({
        template: c.template ?? existing?.template ?? 'rug_wool_grey',
      }),
    ),

  setCeilingOverlay: (containerId, voxelIndex, face, config) =>
    _setOverlayConfig<'ceilingOverlay', import('@/types/container').CeilingOverlayConfig>(
      set, containerId, voxelIndex, face, 'ceilingOverlay', config,
      (existing, c) => ({
        template: c.template ?? existing?.template ?? 'pendant_single',
      }),
    ),

  applyRoomPreset: (containerId, anchorBodyCol, anchorBodyRow, presetId, level) => {
    const preset = _getRoomPreset(presetId);
    if (!preset) return `Unknown preset: ${presetId}`;
    // Resolve target level: explicit arg > preset default > 0
    const targetLevel: 0 | 1 = level ?? preset.defaultLevel ?? 0;
    if (
      anchorBodyCol < 0 ||
      anchorBodyRow < 0 ||
      anchorBodyCol + preset.cols > 6 ||
      anchorBodyRow + preset.rows > 2
    ) {
      return `Preset "${preset.label}" (${preset.cols}×${preset.rows}) does not fit at body anchor (${anchorBodyCol}, ${anchorBodyRow}).`;
    }

    const s = get();
    const c = s.containers[containerId];
    if (!c?.voxelGrid) return `Container ${containerId} has no voxel grid.`;
    const colP = CONTAINER_DIMENSIONS[c.size].length / 6;
    const rowP = CONTAINER_DIMENSIONS[c.size].width / 2;
    const levelHeight = CONTAINER_DIMENSIONS[c.size].height;
    // Voxel grid is laid out [level0_voxels, level1_voxels]; offset by level
    // to address the upper floor.
    const levelOffset = targetLevel * VOXEL_ROWS * VOXEL_COLS;

    const toVoxelIndex = (localCol: number, localRow: number): number => {
      const containerCol = anchorBodyCol + 1 + localCol;
      const containerRow = anchorBodyRow + 1 + localRow;
      return levelOffset + containerRow * VOXEL_COLS + containerCol;
    };

    // Furniture Y is the floor of the target level so multi-story stacks correctly.
    const toLocalMeters = (localCol: number, localRow: number, dx = 0, dz = 0): { x: number; y: number; z: number } => {
      const containerCol = anchorBodyCol + 1 + localCol;
      const containerRow = anchorBodyRow + 1 + localRow;
      const x = -(containerCol - 3.5) * colP + dx;
      const y = targetLevel * levelHeight;
      const z = (containerRow - 1.5) * rowP + dz;
      return { x, y, z };
    };

    // 1) Furniture
    const newFurniture = preset.furniture.map((f) => {
      const { x, y, z } = toLocalMeters(f.localCol, f.localRow, f.dx, f.dz);
      return {
        id: `${presetId}_${f.type}_${Math.random().toString(36).slice(2, 9)}`,
        type: f.type,
        position: { x, y, z },
        rotation: f.rotation ?? 0,
        containerId,
      } as import('@/types/container').FurnitureItem;
    });

    // 2) Overlays — applied via the existing per-overlay setters so all
    //    invariants (merge semantics, defaults) are enforced.
    set((state) => {
      const cont = state.containers[containerId];
      if (!cont?.voxelGrid) return {};
      const grid = [...cont.voxelGrid];
      for (const ov of preset.overlays) {
        const idx = toVoxelIndex(ov.localCol, ov.localRow);
        const voxel = grid[idx];
        if (!voxel) continue;
        // Build the right config shape per kind
        // PresetOverlay is a discriminated union on `kind`, so each branch
        // gets the correctly-narrowed template + skin types automatically.
        if (ov.kind === 'cabinet') {
          grid[idx] = {
            ...voxel,
            cabinetConfig: {
              ...(voxel.cabinetConfig ?? {}),
              [ov.face]: {
                template: ov.template,
                skin: ov.skin,
                verticalAnchor: ov.verticalAnchor,
                counterTop: ov.counterTop,
                underCabinetLight: ov.underCabinetLight,
              },
            },
          };
        } else if (ov.kind === 'shelf') {
          grid[idx] = {
            ...voxel,
            shelfConfig: {
              ...(voxel.shelfConfig ?? {}),
              [ov.face]: {
                template: ov.template,
                skin: ov.skin,
                verticalAnchor: ov.verticalAnchor,
              },
            },
          };
        } else if (ov.kind === 'fixture') {
          grid[idx] = {
            ...voxel,
            fixtureConfig: {
              ...(voxel.fixtureConfig ?? {}),
              [ov.face]: {
                template: ov.template,
                verticalAnchor: ov.verticalAnchor,
              },
            },
          };
        } else if (ov.kind === 'decor') {
          grid[idx] = {
            ...voxel,
            decorConfig: {
              ...(voxel.decorConfig ?? {}),
              [ov.face]: {
                template: ov.template,
                palette: ov.skin,
                verticalAnchor: ov.verticalAnchor,
                pictureLight: ov.pictureLight,
              },
            },
          };
        }
      }
      // Append furniture
      const updated = {
        ...cont,
        voxelGrid: grid,
        furniture: [...(cont.furniture ?? []), ...newFurniture],
      };
      return {
        containers: { ...state.containers, [containerId]: updated },
      };
    });

    return null;
  },

  setFaceFinish: (containerId, voxelIndex, face, finish) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      const prevFinishes = voxel.faceFinishes ?? {};
      grid[voxelIndex] = {
        ...voxel,
        faceFinishes: {
          ...prevFinishes,
          [face]: { ...prevFinishes[face as keyof typeof prevFinishes], ...finish },
        },
      };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  clearFaceFinish: (containerId, voxelIndex, face) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel?.faceFinishes) return {};
      const newFinishes = { ...voxel.faceFinishes };
      delete newFinishes[face as keyof typeof newFinishes];
      grid[voxelIndex] = {
        ...voxel,
        faceFinishes: Object.keys(newFinishes).length === 0 ? undefined : newFinishes,
      };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  applyBlockConfig: (containerId, indices, presetId) => {
    const state = get();
    const c = state.containers[containerId];
    if (!c?.voxelGrid) return;

    const preset = BLOCK_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const grid = [...c.voxelGrid];
    const lockedVoxels = state.lockedVoxels ?? {};

    // Compute bay boundary (min/max row/col)
    const rowsCols = indices.map(i => ({
      row: Math.floor(i / VOXEL_COLS),
      col: i % VOXEL_COLS,
    }));
    const minRow = Math.min(...rowsCols.map(rc => rc.row));
    const maxRow = Math.max(...rowsCols.map(rc => rc.row));
    const minCol = Math.min(...rowsCols.map(rc => rc.col));
    const maxCol = Math.max(...rowsCols.map(rc => rc.col));

    for (const idx of indices) {
      if (lockedVoxels[`${containerId}_${idx}`]) continue;
      const voxel = grid[idx];
      if (!voxel) continue;

      const row = Math.floor(idx / VOXEL_COLS);
      const col = idx % VOXEL_COLS;
      const isSingle = indices.length === 1;

      const faces = { ...preset.faces };

      // For multi-voxel bays: boundary walls get preset face, internal walls get Open
      // Row axis = north/south (row 0=north, row max=south)
      // Col axis = east/west (col 0=west, col max=east)
      if (!isSingle) {
        faces.n = row === minRow ? preset.faces.n : 'Open';
        faces.s = row === maxRow ? preset.faces.s : 'Open';
        faces.w = col === minCol ? preset.faces.w : 'Open';
        faces.e = col === maxCol ? preset.faces.e : 'Open';
      }

      grid[idx] = { ...voxel, active: preset.active, faces };
    }

    const updatedContainer = {
      ...c,
      voxelGrid: grid,
    };

    // Smart system: recompute auto-railings for newly-Open interior faces
    if (get().designMode !== 'manual') {
      recomputeSmartRailings(grid, updatedContainer);
      recomputeSmartHoleGuards(grid, updatedContainer);
    }

    set({
      containers: { ...state.containers, [containerId]: updatedContainer },
    });
  },

  setVoxelFaces: (containerId, voxelIndex, faces) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      grid[voxelIndex] = { ...voxel, faces: { ...faces } };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },
});
