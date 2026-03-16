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
  type ModuleOrientation,
  type DoorConfig,
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
  applyStairsFromFace: (containerId: string, voxelIndex: number, face: 'n' | 's' | 'e' | 'w') => void;
  applySmartRailing: (containerId: string, voxelIndex: number) => void;
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
}

// Reference to useStore — injected after store creation to avoid circular import.
let _useStoreRef: any = null;
export function setVoxelStoreRef(ref: any) { _useStoreRef = ref; }

// ── Shared staircase constants ──────────────────────────────
const STAIR_FLIP: Record<string, 'n' | 's' | 'e' | 'w'> = { n: 's', s: 'n', e: 'w', w: 'e' };
const ASCEND_DELTA: Record<string, { dr: number; dc: number }> = {
  n: { dr: -1, dc: 0 }, s: { dr: 1, dc: 0 },
  e: { dc: -1, dr: 0 }, w: { dc: 1, dr: 0 },
};

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

  return {
    state: 'closed',
    hingeEdge,
    swingDirection: 'in',
    slideDirection: 'positive',
    type: 'swing',
  };
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
        selectedVoxel: { containerId, index: voxelIndex },
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
        selectedVoxel: { containerId, index: voxelIndex },
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

    set((s: any) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};

      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};

      // 1. Compute stair ascending direction from active neighbors
      const col = voxelIndex % VOXEL_COLS;
      const rowLocal = Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
      const level = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS));
      const base = level * VOXEL_COLS * VOXEL_ROWS;
      let ascending: 'n' | 's' | 'e' | 'w' = 'n';
      if (rowLocal > 0 && grid[base + (rowLocal - 1) * VOXEL_COLS + col]?.active) ascending = 'n';
      else if (rowLocal < VOXEL_ROWS - 1 && grid[base + (rowLocal + 1) * VOXEL_COLS + col]?.active) ascending = 's';
      else if (col > 0 && grid[base + rowLocal * VOXEL_COLS + (col - 1)]?.active) ascending = 'e';
      else if (col < VOXEL_COLS - 1 && grid[base + rowLocal * VOXEL_COLS + (col + 1)]?.active) ascending = 'w';

      const isNS = ascending === 'n' || ascending === 's';
      const stairDir: 'ns' | 'ew' = isNS ? 'ns' : 'ew';
      const stairPart: 'lower' | 'single' = (() => {
        const { dr, dc } = ASCEND_DELTA[ascending];
        const ur = rowLocal + dr, uc = col + dc;
        return ur >= 0 && ur < VOXEL_ROWS && uc >= 0 && uc < VOXEL_COLS ? 'lower' : 'single';
      })();

      // Apply staircase with proper stair metadata
      grid[voxelIndex] = {
        ...voxel,
        active: true,
        voxelType: 'stairs',
        stairDir,
        stairAscending: ascending,
        stairPart,
        faces: buildStairFaces(isNS, stairPart),
      };

      // Set upper voxel as stair upper half if in bounds
      if (stairPart === 'lower') {
        const { dr, dc } = ASCEND_DELTA[ascending];
        const upperIdx = base + (rowLocal + dr) * VOXEL_COLS + (col + dc);
        const upperVoxel = grid[upperIdx] ?? createDefaultVoxelGrid()[upperIdx];
        grid[upperIdx] = {
          ...upperVoxel,
          active: true,
          voxelType: 'stairs',
          stairDir,
          stairAscending: ascending,
          stairPart: 'upper',
          faces: buildStairFaces(isNS, 'upper'),
        };
      }

      // 2. Auto-punch: open the floor of the voxel directly above (same col/row, level+1)
      const localIdx = voxelIndex % (VOXEL_ROWS * VOXEL_COLS);
      const aboveLevelIdx = (level + 1) * (VOXEL_ROWS * VOXEL_COLS) + localIdx;
      if (aboveLevelIdx < grid.length && grid[aboveLevelIdx]?.active) {
        grid[aboveLevelIdx] = {
          ...grid[aboveLevelIdx],
          faces: { ...grid[aboveLevelIdx].faces, bottom: 'Open' },
        };
      }

      // 3. Cross-container void: force floor of container above to Open
      let updatedContainers = { ...s.containers, [containerId]: { ...c, voxelGrid: grid } };

      for (const supId of c.supporting) {
        const supC = updatedContainers[supId];
        if (!supC || supC.level !== c.level + 1) continue;
        if (!supC.voxelGrid) continue;

        const upperContainerIdx = rowLocal * VOXEL_COLS + col;
        const upperGrid = [...supC.voxelGrid];
        const targetVoxel = upperGrid[upperContainerIdx];
        if (targetVoxel) {
          upperGrid[upperContainerIdx] = {
            ...targetVoxel,
            active: true,
            faces: { ...targetVoxel.faces, bottom: 'Open' },
          };
          updatedContainers = {
            ...updatedContainers,
            [supId]: { ...supC, voxelGrid: upperGrid },
          };
        }
      }

      return {
        containers: updatedContainers,
        selectedVoxel: { containerId, index: voxelIndex },
      };
    });
  },

  applyStairsFromFace: (containerId, voxelIndex, face) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
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

      // Lower voxel (entry side — bottom half of stair run)
      const lowerPart = upperInBounds ? 'lower' : 'single';
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
      if (upperInBounds) {
        const upperVoxel = grid[upperIdx] ?? createDefaultVoxelGrid()[upperIdx];
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
        grid[aboveIdx] = { ...grid[aboveIdx], faces: { ...grid[aboveIdx].faces, bottom: 'Open' } };
      }

      // Cross-container void: if stairs reach the top level, void floor of container above.
      // This triggers when stairs are placed AT the top level, OR when auto-punch reaches the top level.
      const reachesTopLevel = level === VOXEL_LEVELS - 1 ||
        (aboveIdx < grid.length && Math.floor(aboveIdx / (VOXEL_ROWS * VOXEL_COLS)) === VOXEL_LEVELS - 1);
      if (reachesTopLevel && c.supporting.length > 0) {
        let updatedContainers = { ...s.containers, [containerId]: { ...c, voxelGrid: grid } };
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
                [containerId]: { ...c, voxelGrid: grid },
                [c.stackedOn]: { ...below, voxelGrid: belowGrid },
              },
            };
          }
        }
      }

      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
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
          if (neighbor?.active && WALKABLE.includes(neighbor.faces.bottom)) {
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
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: createDefaultVoxelGrid() } } };
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
        const faces = { ...voxel.faces };
        if (faces.n === 'Open') faces.n = 'Railing_Cable';
        if (faces.s === 'Open') faces.s = 'Railing_Cable';
        if (faces.e === 'Open') faces.e = 'Railing_Cable';
        if (faces.w === 'Open') faces.w = 'Railing_Cable';

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
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid, walls: updatedWalls } } };
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
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
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
      grid[voxelIndex] = {
        ...voxel,
        doorConfig: { ...voxel.doorConfig, [face]: { ...existing, ...config } },
      };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
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
      };
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
        };
    });
  },
});
