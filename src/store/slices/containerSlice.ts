/**
 * containerSlice.ts — Container CRUD, Furniture, Zones, Stacking, Adjacency, Pricing,
 * Bay Module Editing, Debug, and remaining store actions.
 *
 * Extracted from useStore.ts. State fields here include both persisted (containers, zones,
 * pricing, furnitureIndex) and undo-tracked (containers, zones, furnitureIndex) fields.
 * Consumer selectors unchanged — state merges into StoreState.
 */

import { v4 as uuid } from "uuid";
import {
  type Container,
  type ContainerPosition,
  ContainerSize,
  CONTAINER_DIMENSIONS,
  type FurnitureItem,
  FurnitureType,
  FURNITURE_CATALOG,
  GlassVariant,
  MAX_STACK_LEVEL,
  type PricingConfig,
  type PricingEstimate,
  type FloorMaterialType,
  type WallModule,
  WallSide,
  type Zone,
  ModuleType,
  type SurfaceType,
  type VoxelFaces,
  type Voxel,
  type ModuleOrientation,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  VOXEL_COUNT,
  LONG_WALL_BAYS,
  SHORT_WALL_BAYS,
} from "@/types/container";
import {
  createContainer,
  createPanelSolid,
  createPanelGlass,
  createHingedWall,
  createOpenVoid,
  createDefaultVoxelGrid,
  createPoolVoxelGrid,
} from "@/types/factories";
import { findAdjacentPairs, computeGlobalCulling, wallSideToBoundary, checkOverlap, getFootprintAt, getFullFootprint } from "@/store/spatialEngine";
import defaultPricing from "@/config/pricing_config.json";
import { getContainerRole, CONTAINER_ROLES } from "@/config/containerRoles";
import type { ExtensionConfig } from "@/types/container";
import { type HotbarSlot, BLOCK_PRESETS, autoStairDir, autoStairAscending } from "../useStore";

// Use a lazy StoreState reference to avoid circular imports.
// The slice function receives set/get typed to the full store.
type SetFn = (partial: Record<string, unknown> | ((s: any) => Record<string, unknown>)) => void;
type GetFn = () => any;

/** Callback to access the temporal API (pause/resume). Set by useStore.ts after creation. */
let _getTemporalApi: (() => { pause: () => void; resume: () => void; pastStates: unknown[]; futureStates: unknown[]; undo: () => void; redo: () => void }) | null = null;

/** Called by useStore.ts to inject the temporal API reference (avoids circular import). */
export function setContainerTemporalAccessor(fn: () => { pause: () => void; resume: () => void; pastStates: unknown[]; futureStates: unknown[]; undo: () => void; redo: () => void }) {
  _getTemporalApi = fn;
}

function getTemporalApi() {
  if (!_getTemporalApi) throw new Error('containerSlice: temporal API not injected');
  return _getTemporalApi();
}

// ── Structural Configuration Templates ──────────────────────
function _brushToTemplate(brush: SurfaceType): VoxelFaces {
  switch (brush) {
    case 'Open':
      return { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' };
    case 'Deck_Wood':
      return { top: 'Open', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' };
    case 'Railing_Cable':
    case 'Railing_Glass':
      return { top: 'Solid_Steel', bottom: 'Deck_Wood', n: brush, s: brush, e: brush, w: brush };
    case 'Glass_Pane':
      return { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' };
    case 'Solid_Steel':
      return { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' };
    case 'Concrete':
      return { top: 'Concrete', bottom: 'Concrete', n: 'Concrete', s: 'Concrete', e: 'Concrete', w: 'Concrete' };
    case 'Half_Fold':
      return { top: 'Open', bottom: 'Deck_Wood', n: 'Half_Fold', s: 'Half_Fold', e: 'Solid_Steel', w: 'Solid_Steel' };
    case 'Gull_Wing':
      return { top: 'Open', bottom: 'Deck_Wood', n: 'Gull_Wing', s: 'Gull_Wing', e: 'Solid_Steel', w: 'Solid_Steel' };
    default:
      return { top: 'Solid_Steel', bottom: 'Deck_Wood', n: brush, s: brush, e: brush, w: brush };
  }
}

export interface ContainerSlice {
  // ── State Fields ──────────────────────────────────────────
  containers: Record<string, Container>;
  zones: Record<string, Zone>;
  furnitureIndex: Record<string, FurnitureItem>;
  pricing: PricingConfig;
  lockedVoxels: Record<string, boolean>;
  globalCullSet: Set<string>;
  tapeActive: boolean;
  tapePoints: { x: number; y: number; z: number }[];
  savedWalkthroughPos: { position: [number, number, number]; yaw: number } | null;

  // ── Container CRUD ────────────────────────────────────────
  addContainer: (size?: ContainerSize, position?: ContainerPosition, level?: number, skipSmartPlacement?: boolean) => string;
  applyContainerRole: (containerId: string, roleId: string, skipOverlapCheck?: boolean) => void;
  setAllExtensions: (containerId: string, config: ExtensionConfig, skipOverlapCheck?: boolean) => void;
  removeContainer: (id: string) => void;
  updateContainerPosition: (id: string, position: ContainerPosition) => void;
  updateContainerRotation: (id: string, rotation: number) => void;
  renameContainer: (id: string, name: string) => void;
  resizeContainer: (id: string, newSize: ContainerSize) => void;
  toggleRoof: (id: string) => void;
  toggleFloor: (id: string) => void;
  _applyExtensionDoors: (containerId: string, config: ExtensionConfig) => void;
  _restoreExtensionDoors: (containerId: string) => void;

  // ── Vertical Stacking ─────────────────────────────────────
  stackContainer: (topId: string, bottomId: string) => boolean;
  unstackContainer: (id: string) => void;

  // ── Furniture ─────────────────────────────────────────────
  addFurniture: (containerId: string, type: FurnitureType, position?: { x: number; y: number; z: number }, rotation?: number) => string | null;
  removeFurniture: (furnitureId: string) => void;
  moveFurniture: (furnitureId: string, position: { x: number; y: number; z: number }) => void;

  // ── Bay Module Editing ────────────────────────────────────
  setBayModule: (containerId: string, wall: WallSide, bayIndex: number, module: WallModule) => void;
  toggleBayOpen: (containerId: string, wall: WallSide, bayIndex: number) => void;
  cycleBayModule: (containerId: string, wall: WallSide, bayIndex: number) => void;
  toggleBayLock: (containerId: string, wall: WallSide, bayIndex: number) => void;
  setAllOuterWalls: (preset: 'solid' | 'glass' | 'fold_down' | 'fold_up' | 'gull' | 'open') => void;
  setOuterWallType: (containerId: string, wall: WallSide, bayIndex: number, outerWall: 'railing' | 'glass' | 'solid' | 'closet' | 'none') => void;
  setSideWallType: (containerId: string, wall: WallSide, bayIndex: number, sideWall: 'railing' | 'glass' | 'solid' | 'closet' | 'none' | undefined) => void;
  setBayColor: (containerId: string, wall: WallSide, bayIndex: number, color: string | undefined) => void;

  // ── Adjacency ─────────────────────────────────────────────
  refreshAdjacency: () => void;

  // ── Zones ─────────────────────────────────────────────────
  createZone: (name: string, containerIds: string[]) => string;
  removeZone: (id: string) => void;
  renameZone: (id: string, name: string) => void;
  addContainerToZone: (zoneId: string, containerId: string) => void;
  removeContainerFromZone: (zoneId: string, containerId: string) => void;

  // ── Pricing ───────────────────────────────────────────────
  updatePricing: (config: Partial<PricingConfig>) => void;
  getEstimate: () => PricingEstimate;

  // ── View Level / Build Mode ───────────────────────────────
  viewLevel: number | null;
  setViewLevel: (level: number | null) => void;
  bpvLevel: 0 | 1;
  setBpvLevel: (level: 0 | 1) => void;
  buildMode: boolean;
  toggleBuildMode: () => void;

  // ── Undo / Redo ───────────────────────────────────────────
  undo: () => void;
  redo: () => void;

  // ── Structure & Floor Detail Editor Modals ────────────────
  structureEditorTarget: string | null;
  openStructureEditor: (containerId: string) => void;
  closeStructureEditor: () => void;
  toggleStructuralElement: (containerId: string, elementKey: string) => void;
  floorDetailTarget: string | null;
  openFloorDetail: (containerId: string) => void;
  closeFloorDetail: () => void;
  setCornerConfig: (containerId: string, cornerName: string, config: Partial<import("@/types/container").CornerConfig>) => void;

  // ── Camera ────────────────────────────────────────────────
  saveWalkthroughPos: (position: [number, number, number], yaw: number) => void;

  // ── Stamp / Brush ─────────────────────────────────────────
  getStampFaces: () => VoxelFaces | null;
  rotateStampFaces: () => void;
  getStampFootprint: () => [number, number];
  beginBrushDrag: () => void;
  brushStampVoxel: (containerId: string, voxelIndex: number) => void;
  cycleBlockPreset: (containerId: string, voxelIndex: number, dir?: 1 | -1) => void;
  applyStyleToFace: (containerId: string, voxelIndex: number, face: keyof VoxelFaces) => void;
  toggleOpenFace: (containerId: string, voxelIndex: number, face: keyof VoxelFaces) => void;
  stampFromCustomHotbar: (containerId: string, voxelIndex: number) => void;

  // ── Preview Mode ──────────────────────────────────────────
  isPreviewMode: boolean;
  togglePreviewMode: () => void;

  // ── Tape Measure ──────────────────────────────────────────
  toggleTape: () => void;
  addTapePoint: (point: { x: number; y: number; z: number }) => void;
  clearTapePoints: () => void;

  // ── Interior Finish ──────────────────────────────────────
  setInteriorFinish: (containerId: string, finish: 'raw' | 'plywood' | 'drywall' | 'painted') => void;

  // ── Rooftop Deck ────────────────────────────────────────
  generateRooftopDeck: (containerId: string) => void;

  // ── Shared Design Import ────────────────────────────────
  importSharedDesign: (design: any) => void;

  // ── Debug ─────────────────────────────────────────────────
  __debugTwoStoryStack: () => void;
  createGreatRoomDemo: () => void;
}

export const createContainerSlice = (set: SetFn, get: GetFn): ContainerSlice => ({
  // ── Initial State ───────────────────────────────────────
  containers: {},
  zones: {},
  pricing: defaultPricing as unknown as PricingConfig,
  furnitureIndex: {},
  savedWalkthroughPos: null,
  lockedVoxels: {},
  globalCullSet: new Set<string>(),
  tapeActive: false,
  tapePoints: [],

  // ── Container CRUD ──────────────────────────────────────

  addContainer: (size, position, level = 0, skipSmartPlacement) => {

    const c = createContainer(size, position, undefined, level);
    const containers = get().containers;
    const dims = CONTAINER_DIMENSIONS[c.size];
    const foot = getFootprintAt(c.position.x, c.position.z, c.size, c.rotation ?? 0);

    // Smart Placement: auto-offset if position overlaps existing container
    if (!skipSmartPlacement && checkOverlap(containers, null, foot)) {
      // Offset must clear body + potential extensions (haloExt = container height)
      const haloExt = dims.height;
      const offsets = [
        { x: dims.length + haloExt + 0.05, z: 0 },
        { x: -(dims.length + haloExt + 0.05), z: 0 },
        { x: 0, z: dims.width + haloExt + 0.05 },
        { x: 0, z: -(dims.width + haloExt + 0.05) },
      ];
      let placed = false;
      for (const off of offsets) {
        const newX = c.position.x + off.x;
        const newZ = c.position.z + off.z;
        const newFoot = getFootprintAt(newX, newZ, c.size, c.rotation ?? 0);
        if (!checkOverlap(containers, null, newFoot)) {
          c.position = { ...c.position, x: newX, z: newZ };
          placed = true;
          break;
        }
      }
      // If all 4 directions blocked, stack vertically
      if (!placed) {
        const maxY = (Object.values(containers) as Container[]).reduce((max: number, ct: Container) => {
          const ctDims = CONTAINER_DIMENSIONS[ct.size];
          return Math.max(max, ct.position.y + ctDims.height);
        }, 0);
        c.position = { ...c.position, y: maxY };
      }
    }

    set((s) => ({
      containers: { ...s.containers, [c.id]: c },
    }));
    // Refresh adjacency after adding
    requestAnimationFrame(() => get().refreshAdjacency());
    return c.id;
  },

  // applyContainerPreset — moved to voxelSlice
  // addContainerWithPreset — moved to voxelSlice

  applyContainerRole: (containerId, roleId, skipOverlapCheck) => {
    const role = getContainerRole(roleId);
    if (!role) return;
    const c = get().containers[containerId];
    if (!c) return;

    const t = getTemporalApi();
    t.pause();

    // Reset to default grid first
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
            appliedRole: roleId,
            appliedPreset: undefined,
          },
        },
        furnitureIndex: Object.fromEntries(
          Object.entries(s.furnitureIndex).filter(([, f]: [string, any]) => f.containerId !== containerId)
        ),
      };
    });

    // Apply body module to all body voxels (rows 1-2, cols 1-6, both levels)
    const orientation = role.bodyOrientation === 'auto' ? 'n' : role.bodyOrientation;
    for (let level = 0; level < VOXEL_LEVELS; level++) {
      for (let row = 1; row <= 2; row++) {
        for (let col = 1; col <= 6; col++) {
          const idx = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
          get().applyModule(containerId, idx, role.bodyModuleId, orientation);
        }
      }
    }

    // Apply extension config
    if (role.extensionConfig !== 'none') {
      get().setAllExtensions(containerId, role.extensionConfig, skipOverlapCheck);
    }

    // Apply wall overrides to exterior-facing body voxel faces
    if (role.wallOverrides) {
      set((s) => {
        const container = s.containers[containerId];
        if (!container?.voxelGrid) return {};
        const grid = [...container.voxelGrid];
        for (let level = 0; level < VOXEL_LEVELS; level++) {
          for (let row = 1; row <= 2; row++) {
            for (let col = 1; col <= 6; col++) {
              const idx = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
              const voxel = grid[idx];
              if (!voxel) continue;
              const faces = { ...voxel.faces };
              // Apply wall overrides to exterior-facing directions
              if (role.wallOverrides!.n && row === 1) faces.n = role.wallOverrides!.n;
              if (role.wallOverrides!.s && row === 2) faces.s = role.wallOverrides!.s;
              if (role.wallOverrides!.e && col === 6) faces.e = role.wallOverrides!.e;
              if (role.wallOverrides!.w && col === 1) faces.w = role.wallOverrides!.w;
              grid[idx] = { ...voxel, faces };
            }
          }
        }
        return {
          containers: {
            ...s.containers,
            [containerId]: { ...container, voxelGrid: grid },
          },
        };
      });
    }

    t.resume();
  },

  /**
   * Apply auto-doors on body voxel faces that border active extensions.
   * Follows same pattern as _preMergeWalls: only modifies Solid_Steel faces,
   * preserves user-painted faces, saves originals for restoration.
   */
  _applyExtensionDoors: (containerId: string, config: ExtensionConfig) => {
    set((s) => {
      const container = s.containers[containerId];
      if (!container?.voxelGrid) return {};
      const grid = [...container.voxelGrid];
      const saved: Record<string, SurfaceType> = {};
      const isDeck = config !== 'all_interior';
      const doorFace: SurfaceType = isDeck ? 'Door' : 'Open';

      // Map: extension zone → body row/col + face direction
      const boundaries: Array<{ row: number; col: number; face: keyof VoxelFaces; extRow: number; extCol: number }> = [];

      if (config === 'all_deck' || config === 'all_interior' || config === 'north_deck') {
        // Row 0 ext → Row 1 body, north face
        for (let col = 1; col <= 6; col++) {
          boundaries.push({ row: 1, col, face: 'n', extRow: 0, extCol: col });
        }
      }
      if (config === 'all_deck' || config === 'all_interior' || config === 'south_deck') {
        // Row 3 ext → Row 2 body, south face
        for (let col = 1; col <= 6; col++) {
          boundaries.push({ row: 2, col, face: 's', extRow: 3, extCol: col });
        }
      }
      if (config === 'all_deck' || config === 'all_interior' || config === 'west_deck') {
        // Col 0 ext → Col 1 body, west face
        for (let row = 1; row <= 2; row++) {
          boundaries.push({ row, col: 1, face: 'w', extRow: row, extCol: 0 });
        }
      }
      if (config === 'all_deck' || config === 'all_interior' || config === 'east_deck') {
        // Col 7 ext → Col 6 body, east face
        for (let row = 1; row <= 2; row++) {
          boundaries.push({ row, col: 6, face: 'e', extRow: row, extCol: 7 });
        }
      }

      let changed = false;
      for (let level = 0; level < VOXEL_LEVELS; level++) {
        for (const b of boundaries) {
          const bodyIdx = level * (VOXEL_ROWS * VOXEL_COLS) + b.row * VOXEL_COLS + b.col;
          const extIdx = level * (VOXEL_ROWS * VOXEL_COLS) + b.extRow * VOXEL_COLS + b.extCol;
          const extVoxel = grid[extIdx];
          if (!extVoxel?.active) continue; // Extension not active at this position

          const bodyVoxel = grid[bodyIdx];
          if (!bodyVoxel?.active) continue;
          const currentFace = bodyVoxel.faces[b.face];

          // Only modify default Solid_Steel faces (preserve user-painted faces)
          if (currentFace !== 'Solid_Steel') continue;

          const key = `${bodyIdx}:${b.face}`;
          saved[key] = currentFace;
          grid[bodyIdx] = {
            ...bodyVoxel,
            faces: { ...bodyVoxel.faces, [b.face]: doorFace },
          };
          changed = true;
        }
      }

      if (!changed) return {};
      return {
        containers: {
          ...s.containers,
          [containerId]: { ...container, voxelGrid: grid, _preExtensionDoors: saved },
        },
      };
    });
  },

  /**
   * Restore body voxel faces that were auto-doored by extension activation.
   */
  _restoreExtensionDoors: (containerId: string) => {
    set((s) => {
      const container = s.containers[containerId];
      if (!container?._preExtensionDoors || !container.voxelGrid) return {};
      const grid = [...container.voxelGrid];
      for (const [key, originalFace] of Object.entries(container._preExtensionDoors)) {
        const [idxStr, face] = key.split(':');
        const idx = parseInt(idxStr, 10);
        if (grid[idx]) {
          grid[idx] = {
            ...grid[idx],
            faces: { ...grid[idx].faces, [face]: originalFace },
          };
        }
      }
      return {
        containers: {
          ...s.containers,
          [containerId]: { ...container, voxelGrid: grid, _preExtensionDoors: undefined },
        },
      };
    });
  },

  setAllExtensions: (containerId, config, skipOverlapCheck) => {
    const c = get().containers[containerId] as Container | undefined;
    if (!c?.voxelGrid) return;

    // Pre-check: simulate the expanded footprint and reject if it would overlap
    if (config !== 'none' && !skipOverlapCheck) {
      const dims = CONTAINER_DIMENSIONS[c.size];
      const haloExt = dims.height;
      const body = getFullFootprint(c); // current full footprint
      // Compute what the footprint WOULD be after activation
      const cosA = Math.abs(Math.cos(c.rotation));
      const sinA = Math.abs(Math.sin(c.rotation));
      let simFoot = { ...body };
      const expandDir = (dir: 'north' | 'south' | 'east' | 'west') => {
        if (dir === 'east')  { simFoot.maxX += haloExt * cosA; simFoot.maxZ += haloExt * sinA; }
        if (dir === 'west')  { simFoot.minX -= haloExt * cosA; simFoot.minZ -= haloExt * sinA; }
        if (dir === 'north') { simFoot.minZ -= haloExt * cosA; simFoot.minX -= haloExt * sinA; }
        if (dir === 'south') { simFoot.maxZ += haloExt * cosA; simFoot.maxX += haloExt * sinA; }
      };
      if (config === 'all_deck' || config === 'all_interior') {
        expandDir('north'); expandDir('south'); expandDir('east'); expandDir('west');
      } else if (config === 'north_deck') { expandDir('north'); }
      else if (config === 'south_deck') { expandDir('south'); }
      else if (config === 'east_deck') { expandDir('east'); }
      else if (config === 'west_deck') { expandDir('west'); }

      if (checkOverlap(get().containers, containerId, simFoot)) {
        console.warn(`Extension '${config}' on ${containerId} blocked: would overlap adjacent container`);
        return; // Block the extension activation
      }
    }

    const t = getTemporalApi();
    t.pause();

    // Restore any previous auto-doors before re-applying
    get()._restoreExtensionDoors(containerId);

    // Determine which extension indices to affect
    const isExtension = (row: number, col: number) =>
      row === 0 || row === 3 || col === 0 || col === 7;

    const shouldAffect = (row: number, col: number): boolean => {
      if (!isExtension(row, col)) return false;
      switch (config) {
        case 'none': case 'all_deck': case 'all_interior': return true;
        case 'north_deck': return row === 0;
        case 'south_deck': return row === 3;
        case 'east_deck': return col === 7;
        case 'west_deck': return col === 0;
        default: return false;
      }
    };

    if (config === 'none') {
      // Reset all extensions to inactive default
      set((s) => {
        const container = s.containers[containerId];
        if (!container?.voxelGrid) return {};
        const grid = [...container.voxelGrid];
        for (let level = 0; level < VOXEL_LEVELS; level++) {
          for (let row = 0; row < VOXEL_ROWS; row++) {
            for (let col = 0; col < VOXEL_COLS; col++) {
              if (!isExtension(row, col)) continue;
              const idx = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
              grid[idx] = {
                ...grid[idx],
                active: false,
                moduleId: undefined,
                moduleOrientation: undefined,
                faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
              };
            }
          }
        }
        // Remove furniture from affected voxels
        return {
          containers: {
            ...s.containers,
            [containerId]: { ...container, voxelGrid: grid },
          },
        };
      });
    } else if (config === 'all_deck' || config === 'north_deck' || config === 'south_deck' || config === 'east_deck' || config === 'west_deck') {
      // Apply deck_open module to affected extension voxels
      for (let level = 0; level < VOXEL_LEVELS; level++) {
        for (let row = 0; row < VOXEL_ROWS; row++) {
          for (let col = 0; col < VOXEL_COLS; col++) {
            if (!shouldAffect(row, col)) continue;
            const idx = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
            // Activate the voxel first
            set((s) => {
              const container = s.containers[containerId];
              if (!container?.voxelGrid) return {};
              const grid = [...container.voxelGrid];
              grid[idx] = { ...grid[idx], active: true };
              return { containers: { ...s.containers, [containerId]: { ...container, voxelGrid: grid } } };
            });
            get().applyModule(containerId, idx, 'deck_open', 'n');
          }
        }
      }
    } else if (config === 'all_interior') {
      // Expand floor area: activate extensions with interior-matching faces
      set((s) => {
        const container = s.containers[containerId];
        if (!container?.voxelGrid) return {};
        const grid = [...container.voxelGrid];
        for (let level = 0; level < VOXEL_LEVELS; level++) {
          for (let row = 0; row < VOXEL_ROWS; row++) {
            for (let col = 0; col < VOXEL_COLS; col++) {
              if (!isExtension(row, col)) continue;
              const idx = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
              // Interior expansion: wood floor, open inward walls, steel outward walls
              const faces: VoxelFaces = {
                top: 'Solid_Steel',
                bottom: 'Deck_Wood',
                n: row === 0 ? 'Solid_Steel' : 'Open',
                s: row === 3 ? 'Solid_Steel' : 'Open',
                e: col === 7 ? 'Solid_Steel' : 'Open',
                w: col === 0 ? 'Solid_Steel' : 'Open',
              };
              grid[idx] = { ...grid[idx], active: true, faces, moduleId: undefined, moduleOrientation: undefined };
            }
          }
        }
        return {
          containers: {
            ...s.containers,
            [containerId]: { ...container, voxelGrid: grid },
          },
        };
      });
    }

    // Apply auto-doors on body-extension boundaries (non-'none' configs)
    if (config !== 'none') {
      get()._applyExtensionDoors(containerId, config);
    }

    t.resume();
  },

  removeContainer: (id) => {

    set((s) => {
      const removed = s.containers[id];
      if (!removed) return { ...s };
      const { [id]: _, ...rest } = s.containers;

      // Clean up stacking references AND mergedWalls referencing removed container
      const containers = { ...rest };
      for (const c of Object.values(containers) as Container[]) {
        let updated = containers[c.id] ?? c;
        if (c.stackedOn === id) {
          updated = { ...updated, stackedOn: null, level: 0 };
        }
        if (c.supporting.includes(id)) {
          updated = { ...updated, supporting: c.supporting.filter((sid: string) => sid !== id) };
        }
        // Remove mergedWalls entries that reference the deleted container
        if (c.mergedWalls.some((mw: string) => mw.startsWith(`${id}:`))) {
          updated = { ...updated, mergedWalls: c.mergedWalls.filter((mw: string) => !mw.startsWith(`${id}:`)) };
        }
        if (updated !== (containers[c.id] ?? c)) {
          containers[c.id] = updated;
        }
      }

      // Clean up furniture index for removed container
      const furnitureIndex = { ...s.furnitureIndex };
      for (const f of removed.furniture) {
        delete furnitureIndex[f.id];
      }

      // Also remove from any zones
      const zones = { ...s.zones };
      for (const z of Object.values(zones) as Zone[]) {
        z.containerIds = z.containerIds.filter((cid: string) => cid !== id);
        z.mergedWalls = z.mergedWalls.filter(
          (mw: any) => mw.containerA !== id && mw.containerB !== id
        );
      }
      return {
        containers,
        zones,
        furnitureIndex,
        selection: s.selection.filter((sid: string) => sid !== id),
        };
    });
    // Refresh adjacency after removal so remaining containers recalculate shared walls
    requestAnimationFrame(() => get().refreshAdjacency());
  },

  updateContainerPosition: (id, position) => {

    set((s) => ({
      containers: {
        ...s.containers,
        [id]: { ...s.containers[id], position },
      },
    }));
    requestAnimationFrame(() => get().refreshAdjacency());
  },

  updateContainerRotation: (id, rotation) => {

    set((s) => ({
      containers: {
        ...s.containers,
        [id]: { ...s.containers[id], rotation },
      },
    }));
    requestAnimationFrame(() => get().refreshAdjacency());
  },

  renameContainer: (id, name) =>
    set((s) => ({
      containers: {
        ...s.containers,
        [id]: { ...s.containers[id], name },
      },
    })),

  resizeContainer: (id, newSize) => {
    set((s) => {
      const old = s.containers[id];
      if (!old) return s;
      const fresh = createContainer(newSize, old.position, old.name, old.level);
      fresh.id = old.id;
      fresh.rotation = old.rotation;
      fresh.stackedOn = old.stackedOn;
      fresh.supporting = [...old.supporting];
      fresh.groupId = old.groupId;
      fresh.mergedWalls = [...old.mergedWalls];
      fresh.roofRemoved = old.roofRemoved;
      fresh.furniture = [...old.furniture];
      return {
        containers: { ...s.containers, [id]: fresh },
      };
    });
    requestAnimationFrame(() => get().refreshAdjacency());
  },

  toggleRoof: (id) => {

    set((s) => ({
      containers: {
        ...s.containers,
        [id]: {
          ...s.containers[id],
          roofRemoved: !s.containers[id].roofRemoved,
        },
      },
    }));
  },

  toggleFloor: (id) => {

    set((s) => ({
      containers: {
        ...s.containers,
        [id]: {
          ...s.containers[id],
          floorRemoved: !s.containers[id].floorRemoved,
        },
      },
    }));
  },

  // setFloorMaterial — moved to voxelSlice
  // setCeilingMaterial — moved to voxelSlice

  // ── Furniture ──────────────────────────────────────────

  addFurniture: (containerId, type, position, rotation) => {
    const container = get().containers[containerId];
    if (!container) return null;


    const catalog = FURNITURE_CATALOG.find((c) => c.type === type);
    if (!catalog) return null;

    // Default position: center of container floor
    const pos = position ?? { x: 0, y: 0.06, z: 0 };

    const item: FurnitureItem = {
      id: uuid(),
      type,
      position: pos,
      rotation: rotation ?? 0,
      containerId,
    };

    set((s) => ({
      containers: {
        ...s.containers,
        [containerId]: {
          ...s.containers[containerId],
          furniture: [...s.containers[containerId].furniture, item],
          // Auto-remove roof when stairs are placed (enables vertical connectivity)
          ...(type === FurnitureType.Stairs ? { roofRemoved: true } : {}),
        },
      },
      furnitureIndex: { ...s.furnitureIndex, [item.id]: item },
    }));

    return item.id;
  },

  removeFurniture: (furnitureId) =>
    set((s) => {
      const item = s.furnitureIndex[furnitureId];
      if (!item) return s;
      const container = s.containers[item.containerId];
      if (!container) return s;

      const { [furnitureId]: _, ...restIndex } = s.furnitureIndex;
      return {
        containers: {
          ...s.containers,
          [item.containerId]: {
            ...container,
            furniture: container.furniture.filter((f: any) => f.id !== furnitureId),
          },
        },
        furnitureIndex: restIndex,
      };
    }),

  moveFurniture: (furnitureId, position) =>
    set((s) => {
      const item = s.furnitureIndex[furnitureId];
      if (!item) return s;
      const container = s.containers[item.containerId];
      if (!container) return s;

      const updated = { ...item, position };
      return {
        containers: {
          ...s.containers,
          [item.containerId]: {
            ...container,
            furniture: container.furniture.map((f: any) =>
              f.id === furnitureId ? updated : f
            ),
          },
        },
        furnitureIndex: { ...s.furnitureIndex, [furnitureId]: updated },
      };
    }),


  // ── Bay Module Editing ──────────────────────────────────

  setBayModule: (containerId, wall, bayIndex, module) => {

    return set((s) => {
      const container = s.containers[containerId];
      if (!container) return s;
      const wallConfig = { ...container.walls[wall] };
      const bays = [...wallConfig.bays];
      bays[bayIndex] = { ...bays[bayIndex], module };
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...container,
            walls: { ...container.walls, [wall]: { ...wallConfig, bays } },
          },
        },
        };
    });
  },

  toggleBayOpen: (containerId, wall, bayIndex) => {

    set((s) => {
      const container = s.containers[containerId];
      if (!container) return s;
      const wallConfig = { ...container.walls[wall] };
      const bays = [...wallConfig.bays];
      const bay = bays[bayIndex];
      if (bay.module.type !== ModuleType.HingedWall) return s;
      const mod = bay.module;
      const newOpen = mod.openAmount > 0 ? 0 : 1;
      bays[bayIndex] = {
        ...bay,
        module: { ...mod, openAmount: newOpen },
      };
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...container,
            walls: { ...container.walls, [wall]: { ...wallConfig, bays } },
          },
        },
        };
    });
  },

  cycleBayModule: (containerId, wall, bayIndex) => {

    set((s) => {
      const container = s.containers[containerId];
      if (!container) return s;
      const wallConfig = { ...container.walls[wall] };
      const bays = [...wallConfig.bays];
      const bay = bays[bayIndex];
      const mod = bay.module;

      // Cycle: solid → glass → fold_down → fold_up → gull(half) → gull_full → open → solid
      // Preserve outerWall/sideWall when cycling between hinged types
      const prevOuter = mod.type === ModuleType.HingedWall ? mod.outerWall : undefined;
      const prevSide = mod.type === ModuleType.HingedWall ? mod.sideWall : undefined;

      let newModule;
      if (mod.type === ModuleType.PanelSolid) {
        newModule = createPanelGlass(GlassVariant.FixedWindow);
      } else if (mod.type === ModuleType.PanelGlass) {
        newModule = createHingedWall(true, false, true, false, prevOuter, prevSide); // fold down (deck)
      } else if (mod.type === ModuleType.HingedWall) {
        if (mod.foldsDown && !mod.foldsUp) {
          newModule = createHingedWall(false, true, true, false, prevOuter, prevSide); // fold up (awning)
        } else if (!mod.foldsDown && mod.foldsUp) {
          newModule = createHingedWall(true, true, true, false, prevOuter, prevSide); // gull wing half
        } else if (mod.foldsDown && mod.foldsUp && !mod.gullFull) {
          newModule = createHingedWall(true, true, true, true, prevOuter, prevSide); // gull wing full
        } else {
          newModule = createOpenVoid(); // from gull_full → open
        }
      } else {
        newModule = createPanelSolid(); // from open → solid
      }

      bays[bayIndex] = { ...bay, module: newModule };
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...container,
            walls: { ...container.walls, [wall]: { ...wallConfig, bays } },
          },
        },
        };
    });
  },

  toggleBayLock: (containerId, wall, bayIndex) => {
    set((s) => {
      const container = s.containers[containerId];
      if (!container) return s;
      const wallConfig = { ...container.walls[wall] };
      const bays = [...wallConfig.bays];
      const bay = bays[bayIndex];
      bays[bayIndex] = { ...bay, locked: !bay.locked };
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...container,
            walls: { ...container.walls, [wall]: { ...wallConfig, bays } },
          },
        },
      };
    });
  },

  setAllOuterWalls: (preset) => {

    set((s) => {
      const targetIds = s.selection.length > 0 ? s.selection : Object.keys(s.containers);
      const containers = { ...s.containers };

      for (const id of targetIds) {
        const c = containers[id];
        if (!c) continue;

        const walls = { ...c.walls };
        for (const side of [WallSide.Left, WallSide.Right, WallSide.Front, WallSide.Back] as const) {
          // Skip merged walls (inner walls between adjacent containers)
          if (c.mergedWalls.some((mw: string) => mw.endsWith(`:${side}`))) continue;

          const wallConfig = { ...walls[side] };
          wallConfig.bays = wallConfig.bays.map((bay: any) => {
            let newModule;
            switch (preset) {
              case 'solid': newModule = createPanelSolid(); break;
              case 'glass': newModule = createPanelGlass(GlassVariant.FixedWindow); break;
              case 'fold_down': newModule = createHingedWall(true, false, true); break;
              case 'fold_up': newModule = createHingedWall(false, true, true); break;
              case 'gull': newModule = createHingedWall(true, true, true, false); break;
              case 'open': newModule = createOpenVoid(); break;
            }
            return { ...bay, module: newModule };
          });
          walls[side] = wallConfig;
        }

        containers[id] = { ...c, walls };
      }

      return { containers };
    });
  },

  // ── Zones ───────────────────────────────────────────────

  createZone: (name, containerIds) => {
    const id = uuid();
    set((s) => ({
      zones: {
        ...s.zones,
        [id]: { id, name, containerIds, mergedWalls: [] },
      },
    }));
    return id;
  },

  removeZone: (id) =>
    set((s) => {
      const { [id]: _, ...rest } = s.zones;
      return { zones: rest };
    }),

  renameZone: (id, name) =>
    set((s) => ({
      zones: { ...s.zones, [id]: { ...s.zones[id], name } },
    })),

  addContainerToZone: (zoneId, containerId) =>
    set((s) => {
      const zone = s.zones[zoneId];
      if (!zone || zone.containerIds.includes(containerId)) return s;
      return {
        zones: {
          ...s.zones,
          [zoneId]: {
            ...zone,
            containerIds: [...zone.containerIds, containerId],
          },
        },
      };
    }),

  removeContainerFromZone: (zoneId, containerId) =>
    set((s) => {
      const zone = s.zones[zoneId];
      if (!zone) return s;
      return {
        zones: {
          ...s.zones,
          [zoneId]: {
            ...zone,
            containerIds: zone.containerIds.filter((id: string) => id !== containerId),
            mergedWalls: zone.mergedWalls.filter(
              (mw: any) =>
                mw.containerA !== containerId && mw.containerB !== containerId
            ),
          },
        },
      };
    }),

  // ── Pricing ─────────────────────────────────────────────

  updatePricing: (config) =>
    set((s) => ({
      pricing: { ...s.pricing, ...config } as PricingConfig,
    })),

  getEstimate: (): PricingEstimate => {
    const { containers, pricing } = get();
    let containersCost = 0;
    let modulesCost = 0;
    let cutsCost = 0;

    for (const c of Object.values(containers) as Container[]) {
      // Base container cost
      containersCost += pricing.containerBase[c.size] ?? 0;

      // Walk every bay on every wall
      const allWalls = [c.walls.front, c.walls.back, c.walls.left, c.walls.right];
      for (const wall of allWalls) {
        for (const bay of wall.bays) {
          const mod = bay.module;
          if (mod.type !== ModuleType.PanelSolid) {
            // Structural cut required
            cutsCost += pricing.cutFee;
            // Module cost
            modulesCost += pricing.moduleCosts[mod.type] ?? 0;
            if (mod.type === ModuleType.PanelGlass) {
              modulesCost += pricing.glassSurcharge;
            }
            if (mod.type === ModuleType.HingedWall) {
              modulesCost += pricing.hingeMechanism;
            }
          }
        }
      }

      // ── Stair voxel cost ──────────────────────────────────
      // Count once per staircase: only 'lower' or 'single' parts (not 'upper').
      // Cost matches FURNITURE_CATALOG Stairs entry ($4500).
      if (c.voxelGrid) {
        for (const voxel of c.voxelGrid) {
          if (voxel?.voxelType === 'stairs' && voxel.stairPart !== 'upper') {
            modulesCost += 4500;
          }
        }
      }
    }

    const total = containersCost + modulesCost + cutsCost;
    return {
      low: Math.round(total * 0.85),
      high: Math.round(total * 1.15),
      breakdown: {
        containers: containersCost,
        modules: modulesCost,
        cuts: cutsCost,
        total,
      },
    };
  },

  // ── Vertical Stacking ──────────────────────────────────────

  /**
   * stackContainer — Places topId container on top of bottomId container.
   *
   * @remarks
   * Sets top.position.y = bottom.position.y + CONTAINER_DIMENSIONS[bottom.size].height.
   * Also snaps top.position.x/z to match bottom (flush alignment).
   * Records stacking relationship: top.stackedOn = bottomId, bottom.supporting.push(topId).
   * Auto-generates rooftop deck on the newly stacked container.
   *
   * Called by commitContainerDrag (dragSlice) when stackTargetId is set.
   * Must be called SYNCHRONOUSLY after clearing dragMovingId — do NOT use requestAnimationFrame
   * between clearing drag state and calling this (causes one frame of wrong Y).
   *
   * @returns false if validation fails (max level exceeded, already stacked)
   * @see dragSlice.ts commitContainerDrag for the drag-to-stack flow
   * @see spatialEngine.ts findStackTarget for stack target detection
   */
  stackContainer: (topId, bottomId) => {
    const s = get();
    const top = s.containers[topId] as Container | undefined;
    const bottom = s.containers[bottomId] as Container | undefined;
    if (!top || !bottom) return false;

    // Validate: bottom must not already be at max level
    const newLevel = bottom.level + 1;
    if (newLevel > MAX_STACK_LEVEL) {
      console.warn(`Stack rejected: Level ${newLevel} exceeds MAX_STACK_LEVEL (${MAX_STACK_LEVEL})`);
      return false;
    }

    // Validate: top must not already be stacked somewhere
    if (top.stackedOn !== null) {
      console.warn(`Stack rejected: Container ${topId} is already stacked on ${top.stackedOn}`);
      return false;
    }

    // Calculate Y position: bottom position + bottom height
    const bottomDims = CONTAINER_DIMENSIONS[bottom.size];
    const newY = bottom.position.y + bottomDims.height;

    set((state) => ({
      containers: {
        ...state.containers,
        [topId]: {
          ...state.containers[topId],
          level: newLevel,
          stackedOn: bottomId,
          position: {
            x: bottom.position.x,
            y: newY,
            z: bottom.position.z,
          },
        },
        [bottomId]: {
          ...state.containers[bottomId],
          supporting: [...state.containers[bottomId].supporting, topId],
        },
      },
    }));
    console.log(
      `Stacked: "${top.name}" (L${newLevel}) on "${bottom.name}" (L${bottom.level}) at Y=${newY.toFixed(2)}m`
    );
    // Auto-generate rooftop deck on the newly stacked top container
    get().generateRooftopDeck(topId);
    requestAnimationFrame(() => get().refreshAdjacency());
    return true;
  },

  unstackContainer: (id) => {
    set((s) => {
      const container = s.containers[id];
      if (!container || container.stackedOn === null) return s;

      const bottomId = container.stackedOn;
      const bottom = s.containers[bottomId];

      const containers = { ...s.containers };

      // Reset the unstacked container to ground
      containers[id] = {
        ...container,
        level: 0,
        stackedOn: null,
        position: { ...container.position, y: 0 },
      };

      // Remove from bottom's supporting list
      if (bottom) {
        containers[bottomId] = {
          ...bottom,
          supporting: bottom.supporting.filter((sid: string) => sid !== id),
        };
      }

      return { containers };
    });
    requestAnimationFrame(() => get().refreshAdjacency());
  },

  // ── Adjacency Detection ───────────────────────────────────

  /**
   * refreshAdjacency — Detects flush container pairs and merges shared walls.
   *
   * @remarks
   * Uses findAdjacentPairs (spatialEngine) to detect containers sharing a wall face.
   * Merges shared walls by setting the inner-facing voxel faces to 'Open' on both containers.
   * Tracks original wall states in mergedWalls for restoration when containers are separated.
   *
   * Called after: moveContainer, addContainer, removeContainer, stackContainer, commitContainerDrag.
   * Always wrapped in requestAnimationFrame to batch multiple position changes.
   *
   * @see spatialEngine.ts findAdjacentPairs for the AABB-based adjacency detection
   */
  refreshAdjacency: () => {
    const { containers } = get();
    const pairs = findAdjacentPairs(containers);

    // Build a map of container ID → set of adjacent bay IDs
    const mergedMap: Record<string, string[]> = {};
    for (const pair of pairs) {
      if (!mergedMap[pair.containerA]) mergedMap[pair.containerA] = [];
      if (!mergedMap[pair.containerB]) mergedMap[pair.containerB] = [];
      mergedMap[pair.containerA].push(`${pair.containerB}:${pair.sideA}`);
      mergedMap[pair.containerB].push(`${pair.containerA}:${pair.sideB}`);
    }

    // Update containers: mergedWalls + voxel face mutations
    set((s) => {
      const updated = { ...s.containers };
      let changed = false;

      // ── Step 1: Restore previously merged faces from _preMergeWalls ──
      for (const c of Object.values(updated) as Container[]) {
        const saved = c._preMergeWalls;
        if (saved && Object.keys(saved).length > 0 && c.voxelGrid) {
          const newGrid = [...c.voxelGrid];
          for (const [key, originalMat] of Object.entries(saved)) {
            const [idxStr, face] = key.split(':');
            const idx = Number(idxStr);
            if (newGrid[idx]) {
              newGrid[idx] = {
                ...newGrid[idx],
                faces: { ...newGrid[idx].faces, [face]: originalMat },
              };
            }
          }
          updated[c.id] = { ...c, voxelGrid: newGrid, _preMergeWalls: {} };
          changed = true;
        }
      }

      // ── Step 2: Update mergedWalls metadata ──
      for (const c of Object.values(updated) as Container[]) {
        const newMerged = mergedMap[c.id] ?? [];
        const oldMerged = c.mergedWalls;
        if (
          newMerged.length !== oldMerged.length ||
          newMerged.some((m: string, i: number) => m !== oldMerged[i])
        ) {
          updated[c.id] = { ...updated[c.id], mergedWalls: newMerged };
          changed = true;
        }
      }

      // ── Step 3: Mutate Solid_Steel boundary faces → Open for new adjacencies ──
      for (const pair of pairs) {
        const a = updated[pair.containerA];
        const b = updated[pair.containerB];
        if (!a?.voxelGrid || !b?.voxelGrid) continue;

        const aBound = wallSideToBoundary(pair.sideA);
        const bBound = wallSideToBoundary(pair.sideB);

        // Ensure mutable copies
        let aGrid = a.voxelGrid;
        let bGrid = b.voxelGrid;
        let aPreMerge = { ...(a._preMergeWalls ?? {}) };
        let bPreMerge = { ...(b._preMergeWalls ?? {}) };
        let aCopied = false;
        let bCopied = false;

        for (let level = 0; level < VOXEL_LEVELS; level++) {
          const lvlOff = level * VOXEL_ROWS * VOXEL_COLS;

          const iterateRange = !aBound.isRowBoundary
            ? Array.from({ length: VOXEL_ROWS }, (_, i) => i)
            : Array.from({ length: VOXEL_COLS }, (_, i) => i);

          for (const iter of iterateRange) {
            const aIdx = !aBound.isRowBoundary
              ? lvlOff + iter * VOXEL_COLS + aBound.index
              : lvlOff + aBound.index * VOXEL_COLS + iter;
            const bIdx = !bBound.isRowBoundary
              ? lvlOff + iter * VOXEL_COLS + bBound.index
              : lvlOff + bBound.index * VOXEL_COLS + iter;

            const aVox = aGrid[aIdx];
            const bVox = bGrid[bIdx];
            if (!aVox?.active || !bVox?.active) continue;

            const aFace = aVox.faces[aBound.face];
            const bFace = bVox.faces[bBound.face];

            // Only auto-merge Solid_Steel faces
            if (aFace === 'Solid_Steel') {
              if (!aCopied) { aGrid = [...aGrid]; aCopied = true; }
              const key = `${aIdx}:${aBound.face}`;
              aPreMerge[key] = 'Solid_Steel';
              aGrid[aIdx] = {
                ...aGrid[aIdx],
                faces: { ...aGrid[aIdx].faces, [aBound.face]: 'Open' },
              };
            }

            if (bFace === 'Solid_Steel') {
              if (!bCopied) { bGrid = [...bGrid]; bCopied = true; }
              const key = `${bIdx}:${bBound.face}`;
              bPreMerge[key] = 'Solid_Steel';
              bGrid[bIdx] = {
                ...bGrid[bIdx],
                faces: { ...bGrid[bIdx].faces, [bBound.face]: 'Open' },
              };
            }
          }
        }

        if (aCopied) {
          updated[pair.containerA] = { ...updated[pair.containerA], voxelGrid: aGrid, _preMergeWalls: aPreMerge };
          changed = true;
        }
        if (bCopied) {
          updated[pair.containerB] = { ...updated[pair.containerB], voxelGrid: bGrid, _preMergeWalls: bPreMerge };
          changed = true;
        }
      }

      // ★ Compute global voxel-level culling for cross-container adjacency
      const newCullSet = computeGlobalCulling(changed ? updated : s.containers, pairs);

      if (!changed && newCullSet.size === s.globalCullSet.size) {
        let sameSet = true;
        for (const key of newCullSet) {
          if (!s.globalCullSet.has(key)) { sameSet = false; break; }
        }
        if (sameSet) return s;
      }

      if (pairs.length > 0) {
        console.log(`Adjacency: ${pairs.length} shared wall(s) detected, ${newCullSet.size} faces culled`, pairs);
      }
      return { containers: changed ? updated : s.containers, globalCullSet: newCullSet };
    });
  },

  // ── Interior Finish ──────────────────────────────────────

  setInteriorFinish: (containerId, finish) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c) return {};
      return {
        containers: { ...s.containers, [containerId]: { ...c, interiorFinish: finish } },
      };
    });
  },

  // ── Rooftop Deck ────────────────────────────────────────

  generateRooftopDeck: (containerId) => {
    const s = get();
    const c = s.containers[containerId] as Container | undefined;
    if (!c?.voxelGrid) return;

    // Check container is topmost (nothing stacked on it)
    const isTopmost = !Object.values(s.containers).some(
      (other: any) => other.stackedOn === containerId
    );
    if (!isTopmost) return;

    // Set body voxel top faces to Deck_Wood, perimeter walls to Railing_Cable
    set((state) => {
      const container = state.containers[containerId];
      if (!container?.voxelGrid) return {};
      const grid = [...container.voxelGrid];

      for (let row = 0; row < VOXEL_ROWS; row++) {
        for (let col = 0; col < VOXEL_COLS; col++) {
          const idx = row * VOXEL_COLS + col;
          const isBody = row >= 1 && row <= 2 && col >= 1 && col <= 6;
          if (!isBody) continue;

          const voxel = grid[idx];
          if (!voxel) continue;

          const newFaces = { ...voxel.faces, top: 'Deck_Wood' as SurfaceType };

          // Perimeter body voxels get railing on outward wall faces
          if (row === 1) newFaces.n = 'Railing_Cable' as SurfaceType;
          if (row === 2) newFaces.s = 'Railing_Cable' as SurfaceType;
          if (col === 1) newFaces.w = 'Railing_Cable' as SurfaceType;
          if (col === 6) newFaces.e = 'Railing_Cable' as SurfaceType;

          grid[idx] = { ...voxel, faces: newFaces };
        }
      }

      return {
        containers: { ...state.containers, [containerId]: { ...container, voxelGrid: grid } },
      };
    });

    // Expand extensions as deck
    get().setAllExtensions(containerId, 'all_deck', true);
  },

  // ── Shared Design Import ────────────────────────────────

  importSharedDesign: (design) => {
    if (!design || !design.containers) return;

    // Clear existing containers
    set({ containers: {} });

    // Recreate containers from design
    for (const cd of design.containers) {
      const id = get().addContainer(cd.size, cd.position, cd.level ?? 0, true);
      if (cd.rotation) {
        get().updateContainerRotation(id, cd.rotation);
      }
      if (cd.voxelGrid) {
        set((s) => ({
          containers: {
            ...s.containers,
            [id]: { ...s.containers[id], voxelGrid: cd.voxelGrid },
          },
        }));
      }
      if (cd.interiorFinish) {
        get().setInteriorFinish(id, cd.interiorFinish);
      }
    }

    // Apply stacking relationships
    if (design.stacking) {
      const containerIds = Object.keys(get().containers);
      for (const stack of design.stacking) {
        const topId = containerIds[stack.topIndex];
        const bottomId = containerIds[stack.bottomIndex];
        if (topId && bottomId) {
          get().stackContainer(topId, bottomId);
        }
      }
    }

    requestAnimationFrame(() => get().refreshAdjacency());
  },

  // ── Debug — Temporary Verification ────────────────────────

  __debugTwoStoryStack: () => {
    const store = get();

    // Create ground floor container
    const groundId = store.addContainer(
      ContainerSize.HighCube40,
      { x: 0, y: 0, z: 0 }
    );

    // Create second floor container
    const upperId = store.addContainer(
      ContainerSize.HighCube40,
      { x: 0, y: 0, z: 0 } // Y will be corrected by stackContainer
    );

    // Stack upper on ground
    const success = get().stackContainer(upperId, groundId);

    // Log the result
    const state = get();
    const ground = state.containers[groundId];
    const upper = state.containers[upperId];

    console.log("═══ 2-STORY STACK VERIFICATION ═══");
    console.log("Stack result:", success ? "SUCCESS" : "FAILED");
    console.log("Ground Floor:", {
      id: ground.id,
      name: ground.name,
      level: ground.level,
      position: ground.position,
      stackedOn: ground.stackedOn,
      supporting: ground.supporting,
    });
    console.log("Second Floor:", {
      id: upper.id,
      name: upper.name,
      level: upper.level,
      position: upper.position,
      stackedOn: upper.stackedOn,
      supporting: upper.supporting,
    });
    console.log("Y offset:", upper.position.y, "m (expected:", CONTAINER_DIMENSIONS[ContainerSize.HighCube40].height, "m)");
    console.log("═══════════════════════════════════");
  },

  // ── Outer Wall Type ─────────────────────────────────────────

  setOuterWallType: (containerId, wall, bayIndex, outerWall) => {

    set((s) => {
      const container = s.containers[containerId];
      if (!container) return s;
      const wallConfig = { ...container.walls[wall] };
      const bays = [...wallConfig.bays];
      const bay = bays[bayIndex];
      if (bay.module.type !== ModuleType.HingedWall) return s;
      bays[bayIndex] = { ...bay, module: { ...bay.module, outerWall } };
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...container,
            walls: { ...container.walls, [wall]: { ...wallConfig, bays } },
          },
        },
        };
    });
  },

  setSideWallType: (containerId, wall, bayIndex, sideWall) => {

    set((s) => {
      const container = s.containers[containerId];
      if (!container) return s;
      const wallConfig = { ...container.walls[wall] };
      const bays = [...wallConfig.bays];
      const bay = bays[bayIndex];
      if (bay.module.type !== ModuleType.HingedWall) return s;
      bays[bayIndex] = { ...bay, module: { ...bay.module, sideWall } };
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...container,
            walls: { ...container.walls, [wall]: { ...wallConfig, bays } },
          },
        },
        };
    });
  },

  setBayColor: (containerId, wall, bayIndex, color) => {

    set((s) => {
      const container = s.containers[containerId];
      if (!container) return s;
      const wallConfig = { ...container.walls[wall] };
      const bays = [...wallConfig.bays];
      const bay = bays[bayIndex];
      const m = { ...bay.module, color } as typeof bay.module;
      bays[bayIndex] = { ...bay, module: m };
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...container,
            walls: { ...container.walls, [wall]: { ...wallConfig, bays } },
          },
        },
        };
    });
  },

  // ── Great Room Demo ────────────────────────────────────────

  createGreatRoomDemo: () => {
    // Clear existing state
    set({
      containers: {},
      zones: {},
      selection: [],
      furnitureIndex: {},
    });

    const store = get();
    const HC = ContainerSize.HighCube40;
    const h = CONTAINER_DIMENSIONS[HC].height; // 2.90m
    const cLen = CONTAINER_DIMENSIONS[HC].length; // 12.19m
    const half_l = cLen / 2;
    const half_w = CONTAINER_DIMENSIONS[HC].width / 2; // 1.22m

    // 2x2 grid: 2 end-to-end in X, 2 side-by-side in Z
    const gridPos = [
      { x: -half_l, z: -half_w }, // [0] back-left
      { x: half_l, z: -half_w },  // [1] front-left
      { x: -half_l, z: half_w },  // [2] back-right
      { x: half_l, z: half_w },   // [3] front-right
    ];

    // --- Level 0 (Ground) ---
    const L0: string[] = [];
    for (const pos of gridPos) {
      const id = store.addContainer(HC, { x: pos.x, y: 0, z: pos.z });
      L0.push(id);
    }

    // --- Level 1 (2nd floor) ---
    const L1: string[] = [];
    for (let i = 0; i < gridPos.length; i++) {
      const id = store.addContainer(HC, { x: gridPos[i].x, y: h, z: gridPos[i].z });
      store.stackContainer(id, L0[i]);
      L1.push(id);
    }

    // --- Level 2 (3rd floor / rooftop) ---
    const L2: string[] = [];
    for (let i = 0; i < gridPos.length; i++) {
      const id = store.addContainer(HC, { x: gridPos[i].x, y: h * 2, z: gridPos[i].z });
      store.stackContainer(id, L1[i]);
      L2.push(id);
    }

    // Remove roofs on levels 0 and 1 for vertical connectivity
    for (const id of [...L0, ...L1]) {
      store.toggleRoof(id);
    }

    // Remove floors on L1 for double-height Great Room atrium
    // (L0 keeps floor since it's ground level, L2 keeps floor for upper living)
    for (const id of L1) {
      store.toggleFloor(id);
    }

    // Staircase placement on extension decks:
    // Bay width for 8-bay wall = 12.19/8 ≈ 1.524m
    // Bay 1 center: x ≈ -3.81 (local), Bay 2 center: x ≈ -2.29
    // Extension center Z (Left wall): -(half_w + h/2) = -(1.22 + 1.45) = -2.67
    const extZ = -(half_w + h / 2); // center of extension deck in local coords

    // L0→L1 stairs: on Left wall extension of container[0], running along X axis (switchback)
    store.addFurniture(L0[0], FurnitureType.Stairs, { x: -3.8, y: 0.06, z: extZ }, Math.PI / 2);
    // L1→L2 stairs: on Left wall extension of container[0], bay 6 area — switchback far end
    store.addFurniture(L1[0], FurnitureType.Stairs, { x: 3.8, y: 0.06, z: extZ }, -Math.PI / 2);

    // Refresh adjacency to detect shared walls
    store.refreshAdjacency();

    // Configure outer walls after adjacency detection
    setTimeout(() => {
      store.refreshAdjacency();

      // All levels get fold-down deck extensions on outer walls
      // L0+L1: glass-enclosed extensions (outerWall='glass')
      // L2: open rooftop deck (outerWall='railing')
      for (const level of [L0, L1, L2]) {
        const outerWall: 'glass' | 'railing' = level === L2 ? 'railing' : 'glass';
        const latestContainers = get().containers;
        for (const id of level) {
          const c = latestContainers[id];
          if (!c) continue;
          for (const side of [WallSide.Left, WallSide.Right, WallSide.Front, WallSide.Back] as const) {
            if (c.mergedWalls.some((mw: string) => mw.endsWith(`:${side}`))) continue;
            const wallConfig = c.walls[side];
            for (let i = 0; i < wallConfig.bays.length; i++) {
              const sideWall = level === L2 ? undefined : 'railing' as const;
              store.setBayModule(id, side, i, createHingedWall(true, false, true, false, outerWall, sideWall));
            }
          }
        }
      }

      // Open void bays above stairs for staircase passage:
      // L1[0] Left wall bay 1 → OpenVoid (L0 stairs pass through here)
      store.setBayModule(L1[0], WallSide.Left, 1, createOpenVoid());
      // L2[0] Left wall bay 6 → OpenVoid (L1 stairs pass through here — switchback far end)
      store.setBayModule(L2[0], WallSide.Left, 6, createOpenVoid());

      // Name the containers
      for (let li = 0; li < 3; li++) {
        const level = [L0, L1, L2][li];
        const names = ["Back-Left", "Front-Left", "Back-Right", "Front-Right"];
        for (let i = 0; i < level.length; i++) {
          store.renameContainer(level[i], `L${li} ${names[i]}`);
        }
      }

      // Group all containers into "Great Room" zone
      const allIds = [...L0, ...L1, ...L2];
      store.createZone("Great Room", allIds);
    }, 250);
  },

  // ── Structure & Floor Detail Editor Modals ────────────────

  structureEditorTarget: null,
  openStructureEditor: (containerId) => set({
    structureEditorTarget: containerId,
    // Mutual exclusivity: close siblings
    floorDetailTarget: null,
    bayContextMenu: null,
    containerContextMenu: null,
  }),
  closeStructureEditor: () => set({ structureEditorTarget: null }),

  toggleStructuralElement: (containerId, elementKey) => {

    set((s) => {
      const c = s.containers[containerId];
      if (!c) return s;
      const config = c.structureConfig ?? { hiddenElements: [] };
      const idx = config.hiddenElements.indexOf(elementKey);
      const next = idx >= 0
        ? config.hiddenElements.filter((k: string) => k !== elementKey)
        : [...config.hiddenElements, elementKey];
      return {
        containers: {
          ...s.containers,
          [containerId]: { ...c, structureConfig: { hiddenElements: next } },
        },
        };
    });
  },

  floorDetailTarget: null,
  openFloorDetail: (containerId) => set({
    floorDetailTarget: containerId,
    // Mutual exclusivity: close siblings
    structureEditorTarget: null,
    bayContextMenu: null,
    containerContextMenu: null,
  }),
  closeFloorDetail: () => set({ floorDetailTarget: null }),

  setCornerConfig: (containerId, cornerName, config) => {

    set((s) => {
      const c = s.containers[containerId];
      if (!c) return s;
      const existing = c.cornerConfig?.[cornerName] ?? { postType: 'solid' as const };
      const updated = { ...existing, ...config };
      return {
        containers: {
          ...s.containers,
          [containerId]: {
            ...c,
            cornerConfig: { ...c.cornerConfig, [cornerName]: updated },
          },
        },
        };
    });
  },

  viewLevel: null,
  setViewLevel: (level) => set({ viewLevel: level }),

  bpvLevel: 0,
  setBpvLevel: (level) => set({ bpvLevel: level }),

  buildMode: false,
  toggleBuildMode: () => set((s) => ({ buildMode: !s.buildMode })),

  // ── Undo / Redo (powered by zundo temporal middleware) ───

  undo: () => {
    const t = getTemporalApi();
    if (!t.pastStates.length) return;
    t.pause();
    t.undo();
    set({ selection: [] });
    get().refreshAdjacency();
    t.resume();
  },

  redo: () => {
    const t = getTemporalApi();
    if (!t.futureStates.length) return;
    t.pause();
    t.redo();
    set({ selection: [] });
    get().refreshAdjacency();
    t.resume();
  },

  // ── Voxel Skin Actions ──────────────────────────────────

  // ── Camera Sync (main scene → IsoEditor) ───────────────
  saveWalkthroughPos: (position, yaw) => set({ savedWalkthroughPos: { position, yaw } }),

  // applyModule — moved to voxelSlice

  // stampFromHotbar — moved to voxelSlice

  getStampFaces: () => {
    const { hotbar, activeHotbarSlot, customHotbar, activeCustomSlot, activeBrush, clipboardVoxel } = get();
    // Priority: primary hotbar > custom hotbar > activeBrush template > clipboard
    if (activeHotbarSlot !== null) {
      const slot = hotbar[activeHotbarSlot];
      if (slot?.faces) return slot.faces;
    }
    if (activeCustomSlot !== null) {
      const cSlot = customHotbar[activeCustomSlot];
      if (cSlot?.faces) return cSlot.faces;
    }
    if (activeBrush) return _brushToTemplate(activeBrush);
    return clipboardVoxel;
  },

  // ── Continuous Brush Drag (Phase 1 Atomic) ──────────────
  beginBrushDrag: () => {

  },

  brushStampVoxel: (containerId, voxelIndex) => {
    const faces = get().getStampFaces();
    if (!faces) return;
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      grid[voxelIndex] = { ...voxel, active: true, faces: { ...faces } };
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
        };
    });
  },


  // ── Preview Mode ────────────────────────────────────────
  isPreviewMode: false,
  togglePreviewMode: () => set((s) => ({ isPreviewMode: !s.isPreviewMode })),

  // ── Macro Block Presets ────────────────────────────────
  cycleBlockPreset: (containerId, voxelIndex, dir = 1) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      // Match current state to find position in BLOCK_PRESETS cycle
      const curIdx = BLOCK_PRESETS.findIndex((p) =>
        p.active === voxel.active &&
        p.faces.top === voxel.faces.top && p.faces.bottom === voxel.faces.bottom &&
        p.faces.n === voxel.faces.n && p.faces.s === voxel.faces.s &&
        p.faces.e === voxel.faces.e && p.faces.w === voxel.faces.w
      );
      const nextIdx = ((curIdx + dir) % BLOCK_PRESETS.length + BLOCK_PRESETS.length) % BLOCK_PRESETS.length;
      const next = BLOCK_PRESETS[nextIdx];
      grid[voxelIndex] = {
        ...voxel,
        active: next.active,
        faces: { ...next.faces },
        voxelType: next.voxelType ?? 'standard',
        stairDir: next.voxelType === 'stairs'
          ? autoStairDir(grid, voxelIndex)
          : (next.stairDir ?? 'ns'),
        stairAscending: next.voxelType === 'stairs'
          ? autoStairAscending(grid, voxelIndex)
          : undefined,
      };
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
        };
    });
  },

  // stampArea — moved to voxelSlice

  // stampAreaSmart — moved to voxelSlice

  rotateStampFaces: () => {
    const { hotbar, activeHotbarSlot, clipboardVoxel } = get();
    // Rotate hotbar slot faces (priority) or clipboard
    if (activeHotbarSlot !== null) {
      const slot = hotbar[activeHotbarSlot];
      if (slot?.faces) {
        const f = slot.faces;
        const rotated: VoxelFaces = {
          top: f.top, bottom: f.bottom,
          n: f.w, e: f.n, s: f.e, w: f.s,
        };
        const newHotbar = [...hotbar];
        newHotbar[activeHotbarSlot] = { ...slot, faces: rotated };
        set({ hotbar: newHotbar });
        return;
      }
    }
    if (clipboardVoxel) {
      const f = clipboardVoxel;
      set({
        clipboardVoxel: {
          top: f.top, bottom: f.bottom,
          n: f.w, e: f.n, s: f.e, w: f.s,
        },
      });
    }
  },

  getStampFootprint: () => {
    const { hotbar, activeHotbarSlot } = get();
    if (activeHotbarSlot !== null) {
      const slot = hotbar[activeHotbarSlot];
      if (slot?.footprint) return slot.footprint;
    }
    return [1, 1];
  },

  // isStaircaseMacro — moved to voxelSlice
  // stampStaircase — moved to voxelSlice

  // toggleVoxelLock — moved to voxelSlice
  // isVoxelLocked — moved to voxelSlice


  applyStyleToFace: (containerId, voxelIndex, face) => {
    const { styleBrush } = get();
    if (!styleBrush) return;
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;

    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      grid[voxelIndex] = {
        ...voxel,
        faces: { ...voxel.faces, [face]: styleBrush[face] },
      };
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
        };
    });
  },

  // paintFace — moved to voxelSlice

  // ── Dollhouse + Tape Measure (Phase 9) ──────────────────
  toggleTape: () => set((s) => ({ tapeActive: !s.tapeActive, tapePoints: [] })),
  addTapePoint: (point) => set((s) => {
    const pts = [...s.tapePoints, point];
    // Keep only 2 points max (A → B), then reset on third click
    return { tapePoints: pts.length > 2 ? [point] : pts };
  }),
  clearTapePoints: () => set({ tapePoints: [] }),

  // toggleOpenFace — kept here (not in extraction list)
  toggleOpenFace: (containerId, voxelIndex, face) => {
    set((s) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      const currentOpen = voxel.openFaces?.[face] ?? false;
      grid[voxelIndex] = {
        ...voxel,
        openFaces: { ...voxel.openFaces, [face]: !currentOpen },
      };
      return { containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } } };
    });
  },

  // stampFromCustomHotbar — not in extraction list, kept here
  stampFromCustomHotbar: (containerId, voxelIndex) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
    const { customHotbar, activeCustomSlot } = get();
    if (activeCustomSlot === null) return;
    const slot = customHotbar[activeCustomSlot];
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
        selectedVoxel: { containerId, index: voxelIndex },
        };
    });
  },
});
