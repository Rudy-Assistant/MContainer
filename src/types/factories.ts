import { v4 as uuid } from "uuid";
import {
  type BaySlot,
  type Container,
  type ContainerPosition,
  ContainerSize,
  type HingedWall,
  LONG_WALL_BAYS,
  ModuleType,
  type OpenVoid,
  type PanelGlass,
  type PanelSolid,
  SHORT_WALL_BAYS,
  type WallConfig,
  WallSide,
  type GlassVariant,
  type Voxel,
  type VoxelFaces,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  VOXEL_CORE_ROWS,
} from "./container";

// ── Module Factories ────────────────────────────────────────

export function createPanelSolid(): PanelSolid {
  return {
    id: uuid(),
    type: ModuleType.PanelSolid,
    cost_factor: 0,
  };
}

export function createPanelGlass(variant: GlassVariant): PanelGlass {
  return {
    id: uuid(),
    type: ModuleType.PanelGlass,
    variant,
    cost_factor: 1200,
  };
}

export function createHingedWall(
  foldsDown: boolean,
  foldsUp: boolean,
  autoDeploy: boolean = true,
  gullFull: boolean = false,
  outerWall: 'railing' | 'glass' | 'solid' | 'closet' | 'none' = 'railing',
  sideWall?: 'railing' | 'glass' | 'solid' | 'closet' | 'none',
): HingedWall {
  return {
    id: uuid(),
    type: ModuleType.HingedWall,
    foldsDown,
    foldsUp,
    gullFull,
    openAmount: autoDeploy ? 1 : 0,
    outerWall,
    sideWall,
    cost_factor: foldsDown && foldsUp ? 3500 : 2800,
  };
}

/** Creates a completely open void (wall segment removed) */
export function createOpenVoid(): OpenVoid {
  return {
    id: uuid(),
    type: ModuleType.OpenVoid,
    cost_factor: 500,
  };
}

// ── Wall Factory ────────────────────────────────────────────

function createDefaultBays(count: number): BaySlot[] {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    module: createPanelSolid(),
  }));
}

function createWall(side: WallSide, size: ContainerSize): WallConfig {
  const isLong = side === WallSide.Left || side === WallSide.Right;
  const bayCount = isLong ? LONG_WALL_BAYS[size] : SHORT_WALL_BAYS;
  return {
    side,
    bays: createDefaultBays(bayCount),
  };
}

// ── Voxel Grid Factory ──────────────────────────────────────

function makeFaces(top: VoxelFaces['top'], bottom: VoxelFaces['top'], n: VoxelFaces['top'], s: VoxelFaces['top'], e: VoxelFaces['top'], w: VoxelFaces['top']): VoxelFaces {
  return { top, bottom, n, s, e, w };
}

export function createDefaultVoxelGrid(): Voxel[] {
  const grid: Voxel[] = [];
  for (let level = 0; level < VOXEL_LEVELS; level++) {
    for (let row = 0; row < VOXEL_ROWS; row++) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        // ★ Phase 6 FIX: Check BOTH row AND column for core/halo classification.
        // Cols 0 & 7 are front/back halo extensions (beyond the steel frame footprint),
        // just like rows 0 & 3 are left/right deck halos.
        const isHaloCol  = col === 0 || col === VOXEL_COLS - 1;
        const isHaloRow  = row === 0 || row === VOXEL_ROWS - 1;
        const isDeck     = isHaloRow || isHaloCol;
        const isCore     = !isDeck; // Core = interior rows (1-2) AND interior cols (1-6)

        const type: Voxel['type'] = level === 1 ? 'roof' : isDeck ? 'deck' : 'core';
        let faces: VoxelFaces;
        if (level === 0 && isCore) {
          // Level 0, core cells — TRUE SEALED BOX: steel on all 5 exterior faces, wood plank floor only
          faces = makeFaces('Solid_Steel', 'Deck_Wood', 'Solid_Steel', 'Solid_Steel', 'Solid_Steel', 'Solid_Steel');
        } else if (level === 0 && isDeck) {
          // Level 0, halo cells — 100% EMPTY at spawn (inactive, all Open)
          faces = makeFaces('Open', 'Open', 'Open', 'Open', 'Open', 'Open');
        } else if (level === 1 && isCore) {
          // Level 1, core cells — roof slab: steel top + steel bottom (sealed)
          faces = makeFaces('Solid_Steel', 'Solid_Steel', 'Open', 'Open', 'Open', 'Open');
        } else {
          // Level 1, halo cells — empty
          faces = makeFaces('Open', 'Open', 'Open', 'Open', 'Open', 'Open');
        }
        grid.push({ active: isCore, type, faces });
      }
    }
  }
  return grid;
}

/** Creates a voxel grid for subterranean (basement) containers.
 *  Concrete walls on all 5 exterior faces, concrete floor. No extensions. */
export function createBasementVoxelGrid(): Voxel[] {
  const grid: Voxel[] = [];
  for (let level = 0; level < VOXEL_LEVELS; level++) {
    for (let row = 0; row < VOXEL_ROWS; row++) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
        const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
        const isDeck    = isHaloRow || isHaloCol;
        const isCore    = !isDeck;
        const type: Voxel['type'] = level === 1 ? 'roof' : isDeck ? 'deck' : 'core';
        let faces: VoxelFaces;
        if (level === 0 && isCore) {
          // Basement core: concrete on all 5 exterior, concrete floor
          faces = makeFaces('Concrete', 'Concrete', 'Concrete', 'Concrete', 'Concrete', 'Concrete');
        } else if (level === 1 && isCore) {
          // Basement roof: concrete slab top, open below (ground level above)
          faces = makeFaces('Concrete', 'Open', 'Open', 'Open', 'Open', 'Open');
        } else {
          // Halo cells: empty (no extensions underground)
          faces = makeFaces('Open', 'Open', 'Open', 'Open', 'Open', 'Open');
        }
        grid.push({ active: isCore, type, faces });
      }
    }
  }
  return grid;
}

/** Creates a "pool" voxel grid variant — removes top face for open water,
 *  blue tile interior, all concrete exterior. */
export function createPoolVoxelGrid(): Voxel[] {
  const grid: Voxel[] = [];
  for (let level = 0; level < VOXEL_LEVELS; level++) {
    for (let row = 0; row < VOXEL_ROWS; row++) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
        const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
        const isDeck    = isHaloRow || isHaloCol;
        const isCore    = !isDeck;
        const type: Voxel['type'] = level === 1 ? 'roof' : isDeck ? 'deck' : 'core';
        let faces: VoxelFaces;
        if (level === 0 && isCore) {
          // Pool core: open top (water surface), concrete walls + floor
          faces = makeFaces('Open', 'Concrete', 'Concrete', 'Concrete', 'Concrete', 'Concrete');
        } else {
          // All else empty
          faces = makeFaces('Open', 'Open', 'Open', 'Open', 'Open', 'Open');
        }
        grid.push({ active: isCore, type, faces });
      }
    }
  }
  return grid;
}

// ── Container Factory ───────────────────────────────────────

export function createContainer(
  size: ContainerSize = ContainerSize.HighCube40,
  position: ContainerPosition = { x: 0, y: 0, z: 0 },
  name?: string,
  level: number = 0
): Container {
  const sizeLabel =
    size === ContainerSize.Standard20
      ? "20ft"
      : size === ContainerSize.Standard40
        ? "40ft"
        : "40ft HC";

  // Basement containers (level < 0) get concrete walls by default
  const grid = level < 0 ? createBasementVoxelGrid() : createDefaultVoxelGrid();

  return {
    id: uuid(),
    name: name ?? `Container ${sizeLabel}`,
    size,
    position,
    rotation: 0,

    // Vertical stacking
    level,
    stackedOn: null,
    supporting: [],

    walls: {
      [WallSide.Front]: createWall(WallSide.Front, size),
      [WallSide.Back]: createWall(WallSide.Back, size),
      [WallSide.Left]: createWall(WallSide.Left, size),
      [WallSide.Right]: createWall(WallSide.Right, size),
    },
    roofRemoved: false,
    floorRemoved: false,
    // Grouping & adjacency
    groupId: null,
    mergedWalls: [],

    // Interior
    furniture: [],

    // Voxel skin grid
    voxelGrid: grid,
  };
}
