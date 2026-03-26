/**
 * voxelSlice.ts — Voxel mutation actions (no dedicated state)
 *
 * Extracted from useStore.ts. All actions here mutate container voxel data
 * via get()/set(). Consumer selectors unchanged — actions merge into StoreState.
 */

import {
  type Container,
  ContainerSize,
  CONTAINER_DIMENSIONS,
  type FloorMaterialType,
  type SurfaceType,
  type VoxelFaces,
  type Voxel,
  type SmartStairChanges,
  type ModuleOrientation,
  type DoorConfig,
  type FaceFinish,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  LONG_WALL_BAYS,
  SHORT_WALL_BAYS,
  WallSide,
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
import { v4 as uuid } from 'uuid';
import type { FurnitureItem } from '@/types/container';
import { FurnitureType, FURNITURE_CATALOG } from '@/types/container';

// Use a lazy StoreState reference to avoid circular imports.
// The slice function receives set/get typed to the full store.
type Set = (partial: Record<string, unknown> | ((s: any) => Record<string, unknown>)) => void;
type Get = () => any;

export interface VoxelSlice {
  setVoxelFace: (containerId: string, voxelIndex: number, face: keyof VoxelFaces, mat: SurfaceType) => void;
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
let _useStoreRef: any = null;
export function setVoxelStoreRef(ref: any) { _useStoreRef = ref; }

// ── Shared staircase constants ──────────────────────────────
// STAIR SYSTEM DESIGN (unified):
// - applyStairsFromFace is the SINGLE SOURCE OF TRUTH for stair placement.
// - All entry points (setVoxelFace('Stairs'), applyModule('stairs'), stampStaircase)
//   delegate to applyStairsFromFace.
// - stairAscending ('n'|'s'|'e'|'w') is the canonical direction field.
// - stairDir ('ns'|'ew') is DEPRECATED — derived from stairAscending for backward
//   compat with persisted data. Will be removed in a future migration sprint.
// - stairPart ('lower'|'upper'|'single') identifies entry vs ascent voxel in 2-voxel pairs.
//   BOM counts only 'lower'/'single' to avoid double-counting.
export const STAIR_FLIP: Record<string, 'n' | 's' | 'e' | 'w'> = { n: 's', s: 'n', e: 'w', w: 'e' };
export const ASCEND_DELTA: Record<string, { dr: number; dc: number }> = {
  n: { dr: -1, dc: 0 }, s: { dr: 1, dc: 0 },
  e: { dc: -1, dr: 0 }, w: { dc: 1, dr: 0 },
};

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

function buildStairFaces(isNS: boolean, part: 'lower' | 'upper' | 'single'): VoxelFaces {
  const isUpper = part === 'upper';
  return {
    top: isUpper ? 'Deck_Wood' : 'Open',
    bottom: isUpper ? 'Open' : 'Deck_Wood',
    n: isNS ? 'Open' : 'Solid_Steel',
    s: isNS ? 'Open' : 'Solid_Steel',
    e: isNS ? 'Solid_Steel' : 'Open',
    w: isNS ? 'Solid_Steel' : 'Open',
  };
}

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
// Skips stair voxels (owned by stair system) and user-painted faces.

const WALL_FACES = ['n', 's', 'e', 'w'] as const;
const FACE_NEIGHBOR_DELTA: Record<string, { dr: number; dc: number }> = {
  n: { dr: -1, dc: 0 }, s: { dr: 1, dc: 0 },
  e: { dr: 0, dc: -1 }, w: { dr: 0, dc: 1 },
};

/**
 * Recompute smart auto-railings for a container's voxel grid.
 * Mutates grid and container._smartRailingChanges in place (call inside Immer draft or spread).
 * Exported for hydration rebuild in useStore.ts.
 */
export function recomputeSmartRailings(
  grid: Voxel[],
  container: any, // Container draft (Immer or spread)
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
        if (v.userPaintedFaces?.[face]) continue;   // user override
        // Structural fold surfaces (Gull_Wing, Half_Fold) act as enclosures — skip auto-railing
        const currentSurface = v.faces[face as keyof VoxelFaces];
        if (currentSurface === 'Gull_Wing' || currentSurface === 'Half_Fold') continue;
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
    // Check if user has painted this face since (don't revert user changes)
    if (v.userPaintedFaces?.[face as keyof VoxelFaces]) continue;
    // Restore original
    grid[idx] = {
      ...v,
      faces: { ...v.faces, [face]: originalSurface },
    };
    // Don't add to newTracking (removed)
  }

  container._smartRailingChanges = Object.keys(newTracking).length > 0 ? newTracking : undefined;
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
export const createVoxelSlice = (set: Set, get: Get): VoxelSlice => ({

  setFloorMaterial: (id, material) => {

    set((s: any) => ({
      containers: {
        ...s.containers,
        [id]: { ...s.containers[id], floorMaterial: material },
      },
    }));
  },

  setCeilingMaterial: (id, material) => {

    set((s: any) => ({
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
    const t = _useStoreRef.temporal.getState();
    t.pause();

    // Reset container to default first (clear previous modules + furniture)
    set((s: any) => {
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
          Object.entries(s.furnitureIndex).filter(([, f]: [string, any]) => f.containerId !== containerId)
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
    const t = _useStoreRef.temporal.getState();
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

    set((s: any) => {
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
        const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
        const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
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

    set((s: any) => {
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

    set((s: any) => {
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

    set((s: any) => {
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
    set((s: any) => {
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
        stairDir: isNS ? 'ns' : 'ew',
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
          stairDir: isNS ? 'ns' : 'ew',
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
        const aboveVoxel = grid[aboveIdx];
        const aboveFaces = { ...aboveVoxel.faces };

        // Track original bottom face
        changedFaces[`${aboveIdx}:bottom`] = aboveVoxel.faces.bottom;
        aboveFaces.bottom = 'Open';

        // ── Smart Consequence: Railing around upper hole ──
        const exitFace = ascending;
        for (const wallFace of ['n', 's', 'e', 'w'] as const) {
          if (!aboveVoxel.userPaintedFaces?.[wallFace]) {
            changedFaces[`${aboveIdx}:${wallFace}`] = aboveVoxel.faces[wallFace];
            aboveFaces[wallFace] = wallFace === exitFace ? 'Open' : 'Railing_Cable';
          }
        }

        grid[aboveIdx] = { ...aboveVoxel, faces: aboveFaces };
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
            if (!entryNeighbor.userPaintedFaces?.[neighborFace]) {
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
          if (stairVoxel.userPaintedFaces?.[latFace]) continue;
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
        },
      };

      // Recompute smart railings (stair placement may affect neighboring open-air voxels)
      const railingContainer: any = { ...c, _smartRailingChanges: c._smartRailingChanges };
      if (get().designMode !== 'manual') {
        recomputeSmartRailings(grid, railingContainer);
      }

      // Cross-container void: if stairs reach the top level, void floor of container above.
      const reachesTopLevel = level === VOXEL_LEVELS - 1 ||
        (aboveIdx < grid.length && Math.floor(aboveIdx / (VOXEL_ROWS * VOXEL_COLS)) === VOXEL_LEVELS - 1);
      if (reachesTopLevel && c.supporting.length > 0) {
        let updatedContainers = { ...s.containers, [containerId]: { ...c, voxelGrid: grid, _smartRailingChanges: railingContainer._smartRailingChanges } };
        for (const aboveId of c.supporting) {
          const above = s.containers[aboveId];
          if (!above?.voxelGrid) continue;
          const aboveVoxel = above.voxelGrid[localIdx];
          if (aboveVoxel?.active) {
            const aboveGrid = [...above.voxelGrid];
            aboveGrid[localIdx] = {
              ...aboveVoxel,
              faces: { ...aboveVoxel.faces, bottom: 'Open' },
            };
            updatedContainers = { ...updatedContainers, [aboveId]: { ...above, voxelGrid: aboveGrid } };
          }
        }
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
            belowGrid[belowIdx] = {
              ...belowVoxel,
              faces: { ...belowVoxel.faces, top: 'Open' },
            };
            return {
              containers: {
                ...s.containers,
                [containerId]: { ...c, voxelGrid: grid, _smartRailingChanges: railingContainer._smartRailingChanges },
                [c.stackedOn]: { ...below, voxelGrid: belowGrid },
              },
            };
          }
        }
      }

      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid, _smartRailingChanges: railingContainer._smartRailingChanges } } };
    });
  },

  applyVerticalStairs: (containerId, voxelIndex, facing) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
    set((s: any) => {
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
        stairDir: isNS ? 'ns' : 'ew',
        stairPart: 'lower',
        stairAscending: facing,
        faces: { ...buildStairFaces(isNS, 'lower'), top: 'Open' },
      };

      // Upper voxel (level 1): top half of vertical staircase
      grid[upperIdx] = {
        ...upperVoxel,
        active: true,
        voxelType: 'stairs',
        stairDir: isNS ? 'ns' : 'ew',
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

    set((s: any) => {
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
    set((s: any) => {
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
    set((s: any) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];

      // Resolve upper voxel to lower (which owns _smartStairChanges)
      const resolved = resolveToLowerStair(grid, voxelIndex);
      if (resolved === null) return {};
      voxelIndex = resolved;

      const smartChanges = grid[voxelIndex]._smartStairChanges;
      if (!smartChanges) {
        // No smart tracking — just revert stair voxels to default
        const defaults = createDefaultVoxelGrid();
        grid[voxelIndex] = { ...defaults[voxelIndex] };
        const rc: any = { ...c, _smartRailingChanges: c._smartRailingChanges };
        if (get().designMode !== 'manual') {
          recomputeSmartRailings(grid, rc);
        }
        return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid, _smartRailingChanges: rc._smartRailingChanges } } };
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

      // Revert lower stair voxel to standard
      const defaults = createDefaultVoxelGrid();
      grid[voxelIndex] = {
        ...defaults[voxelIndex],
        active: grid[voxelIndex].active,
      };
      delete grid[voxelIndex]._smartStairChanges;
      delete grid[voxelIndex].voxelType;
      delete grid[voxelIndex].stairDir;
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
          delete grid[uIdx].stairDir;
          delete grid[uIdx].stairAscending;
          delete grid[uIdx].stairPart;
          delete grid[uIdx]._stairExiting;
        }
      }

      // Recompute smart railings after stair removal
      const railingContainer: any = { ...c, _smartRailingChanges: c._smartRailingChanges };
      if (get().designMode !== 'manual') {
        recomputeSmartRailings(grid, railingContainer);
      }

      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid, _smartRailingChanges: railingContainer._smartRailingChanges } } };
    });
  },

  convertToPool: (containerId) => {

    set((s: any) => {
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

    set((s: any) => {
      const c = s.containers[containerId];
      if (!c) return {};
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: createDefaultVoxelGrid(), _smartRailingChanges: undefined } } };
    });
  },

  toggleVoxelLock: (containerId, voxelIndex) => {
    const key = `${containerId}_${voxelIndex}`;
    set((s: any) => ({
      lockedVoxels: { ...s.lockedVoxels, [key]: !s.lockedVoxels[key] },
    }));
  },

  isVoxelLocked: (containerId, voxelIndex) => {
    return !!get().lockedVoxels[`${containerId}_${voxelIndex}`];
  },

  toggleDoorState: (containerId, voxelIndex, face) => {
    set((s: any) => {
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

    set((s: any) => {
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
    set((s: any) => {
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

    set((s: any) => {
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
            const newBays = wall.bays.map((slot: any) =>
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
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

    set((s: any) => {
      const c = s.containers[containerId];
      if (!c) return {};
      const grid = c.voxelGrid ? [...c.voxelGrid] : createDefaultVoxelGrid();
      if (voxelIndex < 0 || voxelIndex >= grid.length) return {};
      const updatedVoxel = {
        ...grid[voxelIndex],
        faces: { ...grid[voxelIndex].faces, [face]: mat },
        userPaintedFaces: { ...grid[voxelIndex].userPaintedFaces, [face]: true },
      };
      // Auto-create doorConfig when painting Door face
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
        lastStamp: { containerId, voxelIndex, face, surfaceType: mat },
      };
    });
  },

  setVoxelAllFaces: (containerId, voxelIndex, mat) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

    set((s: any) => {
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
    set((s: any) => {
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
    set((s: any) => {
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

    set((s: any) => {
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

    set((s: any) => {
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

  setFaceFinish: (containerId, voxelIndex, face, finish) => {
    set((s: any) => {
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
    set((s: any) => {
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

    const updatedContainer = { ...c, voxelGrid: grid };

    // Smart system: recompute auto-railings for newly-Open interior faces
    if (get().designMode !== 'manual') {
      recomputeSmartRailings(grid, updatedContainer);
    }

    set({
      containers: { ...state.containers, [containerId]: updatedContainer },
    });
  },

  setVoxelFaces: (containerId, voxelIndex, faces) => {
    set((s: any) => {
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
