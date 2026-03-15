import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { temporal } from "zundo";
import { enableMapSet } from "immer";

enableMapSet();
import { idbStorage } from "./idbStorage";
import { persistedStateSchema } from "./persistSchema";
import {
  type AppState,
  type Container,
  type VoxelFaces,
  type Voxel,
  VOXEL_COLS,
  VOXEL_ROWS,
} from "@/types/container";
import { createEnvironmentSlice, type EnvironmentSlice } from "./slices/environmentSlice";
import { createUiSlice, type UiSlice } from "./slices/uiSlice";
import { createSelectionSlice, type SelectionSlice } from "./slices/selectionSlice";
import { createDragSlice, type DragSlice, setTemporalApiAccessor } from "./slices/dragSlice";
import { createLibrarySlice, type LibrarySlice, setLibraryTemporalAccessor } from "./slices/librarySlice";
import { createVoxelSlice, type VoxelSlice, setVoxelStoreRef } from "./slices/voxelSlice";
import { createContainerSlice, type ContainerSlice, setContainerTemporalAccessor } from "./slices/containerSlice";

// ── Voxel Target Union ─────────────────────────────────────
/** Standard voxel reference (maps to a real grid index). */
export type VoxelRef = { containerId: string; index: number; isExtension?: undefined };
/** Synthetic extension payload for empty grid tiles — NO index (prevents grid lookups). */
export type VoxelExtRef = { containerId: string; isExtension: true; col: number; row: number };
/** Discriminated union: real voxel OR synthetic extension tile.
 *  Always check `if (v.isExtension)` before accessing `.index`. */
export type VoxelPayload = VoxelRef | VoxelExtRef;

// ── Hotbar Types ────────────────────────────────────────────

/** Rarity categories — Grey=Basic, Blue=Standard, Purple=Complex, Gold=Prefab */
export type HotbarCategory = 'basic' | 'standard' | 'complex' | 'prefab';

export interface HotbarSlot {
  key: number;               // 1-9, 0 (display label; array index = key === 0 ? 9 : key - 1)
  category: HotbarCategory;
  label: string;
  color: string;             // accent color for the slot
  icon: string;              // SVG path(s) for the mini-icon (fallback for non-tile items)
  faces: VoxelFaces | null;  // tile data (null for non-tile items)
  footprint?: [number, number]; // [cols, rows] — defaults to [1,1]. Multi-tile prefabs use e.g. [2,2]
  /** ★ Phase 4: Special macro behaviour triggered on stamp. */
  macro?: 'staircase' | 'smart_room';
  /** Face context filter — omit to show in all contexts */
  contexts?: Array<'wall' | 'floor' | 'roof'>;
}

/** Structural Configuration hotbar — Rarity-coded (Grey/Blue/Purple/Gold). */
export const DEFAULT_HOTBAR: HotbarSlot[] = [
  // ── Grey: Basic Structural ──
  // 1 — Floor Only: wood plank floor, open above and sides
  { key: 1, category: 'basic', label: 'Floor', color: '#78909c',
    icon: 'M3 18h18 M6 18v-2h12v2',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
    contexts: ['floor'] },
  // 2 — Ceiling Only: steel roof, open below and sides
  { key: 2, category: 'basic', label: 'Ceiling', color: '#90a4ae',
    icon: 'M3 6h18 M6 6v2h12V6',
    faces: { top: 'Solid_Steel', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
    contexts: ['floor'] },
  // 3 — Floor + Ceiling + Railing: enclosed platform
  { key: 3, category: 'basic', label: 'Railing', color: '#607d8b',
    icon: 'M3 6h18 M3 18h18 M5 6v12 M19 6v12 M5 10h14 M5 14h14',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' },
    contexts: ['wall'] },
  // ── Blue: Standard Openings ──
  // 4 — Floor + Ceiling + Window: glass walls
  { key: 4, category: 'standard', label: 'Window', color: '#42a5f5',
    icon: 'M3 3h18v18H3z M5 5h14v14H5z M12 5v14 M5 12h14',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' },
    contexts: ['wall'] },
  // 5 — Hallway: steel walls N/S, open passages E/W
  { key: 5, category: 'standard', label: 'Hall', color: '#1e88e5',
    icon: 'M3 3v18 M21 3v18 M3 3h18 M3 21h18 M8 3v18 M16 3v18',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Open', w: 'Open' },
    contexts: ['wall'] },
  // ── Purple: Complex Mechanicals ──
  // 6 — Half-Fold: half-height fold extensions
  { key: 6, category: 'complex', label: '½ Fold', color: '#ab47bc',
    icon: 'M3 3h18v18H3z M3 12h18 M6 12l-3 6 M18 12l3 6',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Half_Fold', s: 'Half_Fold', e: 'Solid_Steel', w: 'Solid_Steel' },
    contexts: ['wall'] },
  // 7 — Gull-Wing: split awning+deck mechanicals
  { key: 7, category: 'complex', label: 'Gull', color: '#7e57c2',
    icon: 'M12 3v18 M3 12h18 M3 12l3-9 M21 12l-3-9 M3 12l3 9 M21 12l-3 9',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Gull_Wing', s: 'Gull_Wing', e: 'Solid_Steel', w: 'Solid_Steel' },
    contexts: ['wall'] },
  // ── Gold: Spatial Macro-Shapes ──
  // 8 — Wraparound Porch: open-air deck with railing barrier
  { key: 8, category: 'prefab', label: 'Porch', color: '#ffa726',
    icon: 'M3 18h18 M3 6h18 M5 6v12 M19 6v12 M5 10h14',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' },
    contexts: ['wall'] },
  // 9 — Covered Deck: sheltered outdoor space with railing walls
  { key: 9, category: 'prefab', label: 'Covered', color: '#ff9800',
    icon: 'M3 4h18 M3 18h18 M5 4v14 M19 4v14 M5 8h14 M5 12h14',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' },
    contexts: ['wall'] },
  // 0 — ★ Phase 4: Staircase Macro — forces ceiling Open + upper container floor Open
  { key: 0, category: 'prefab', label: 'Stairs', color: '#ef4444',
    icon: 'M3 21h4v-4h4v-4h4v-4h4v-4h2',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Open', w: 'Open' },
    macro: 'staircase', contexts: ['floor'] },
];

// ── Macro Block Presets (shared across UI) ────────────────────
/** Macro presets used by center-click cycling and QuickApplyStrip. */
export interface BlockPreset {
  label: string;
  faces: VoxelFaces;
  active: boolean;
  voxelType?: 'standard' | 'stairs';
  stairDir?: 'ns' | 'ew';
  stairAscending?: 'n' | 's' | 'e' | 'w';
}

export const BLOCK_PRESETS: BlockPreset[] = [
  { label: "Floor Only",       active: true,  faces: { top: "Open",        bottom: "Deck_Wood", n: "Open",         s: "Open",         e: "Open",         w: "Open"         } },
  { label: "Floor + Ceiling",  active: true,  faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Open",         s: "Open",         e: "Open",         w: "Open"         } },
  { label: "Floor+Ceil+Rail",  active: true,  faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Railing_Cable",s: "Railing_Cable",e: "Railing_Cable", w: "Railing_Cable" } },
  { label: "Floor+Ceil+Glass", active: true,  faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Glass_Pane",   s: "Glass_Pane",   e: "Glass_Pane",   w: "Glass_Pane"   } },
  { label: "Empty",            active: false, faces: { top: "Open",        bottom: "Open",      n: "Open",         s: "Open",         e: "Open",         w: "Open"         } },
  { label: "Default (Steel)",  active: true,  faces: { top: "Solid_Steel", bottom: "Deck_Wood", n: "Solid_Steel",  s: "Solid_Steel",  e: "Solid_Steel",  w: "Solid_Steel"  } },
  { label: "Stairs",           active: true,  faces: { top: "Open",        bottom: "Deck_Wood", n: "Solid_Steel",  s: "Solid_Steel",  e: "Open",         w: "Open"         }, voxelType: 'stairs', stairDir: 'ns' },
  { label: "Pool Basin",       active: true,  faces: { top: "Open",        bottom: "Concrete",  n: "Concrete",     s: "Concrete",     e: "Concrete",     w: "Concrete"     } },
];

// ── Auto Stair Direction ─────────────────────────────────────
/**
 * Infers optimal stair direction from active neighbors.
 * N/S neighbor → 'ns'; E/W neighbor → 'ew'; defaults to 'ns'.
 * Note: E/W deltas are inverted because col→X mapping is negated (per MEMORY.md).
 */
export function autoStairDir(grid: Voxel[], voxelIndex: number): 'ns' | 'ew' {
  const col      = voxelIndex % VOXEL_COLS;
  const rowLocal = Math.floor((voxelIndex % (VOXEL_COLS * VOXEL_ROWS)) / VOXEL_COLS);
  const level    = Math.floor(voxelIndex / (VOXEL_COLS * VOXEL_ROWS));
  const base     = level * VOXEL_COLS * VOXEL_ROWS;

  const nIdx = base + (rowLocal - 1) * VOXEL_COLS + col;
  const sIdx = base + (rowLocal + 1) * VOXEL_COLS + col;
  // E(+X)→col-1, W(-X)→col+1 (negated-X axis)
  const eIdx = base + rowLocal * VOXEL_COLS + (col - 1);
  const wIdx = base + rowLocal * VOXEL_COLS + (col + 1);

  const nActive = rowLocal > 0           && grid[nIdx]?.active;
  const sActive = rowLocal < VOXEL_ROWS - 1 && grid[sIdx]?.active;
  const eActive = col > 0               && grid[eIdx]?.active;
  const wActive = col < VOXEL_COLS - 1  && grid[wIdx]?.active;

  if (nActive || sActive) return 'ns';
  if (eActive || wActive) return 'ew';
  return 'ns';
}

/**
 * Returns the direction treads should ascend toward (toward the active neighbor).
 * More precise than autoStairDir — returns exact cardinal direction, not just axis.
 */
export function autoStairAscending(
  grid: Voxel[], voxelIndex: number
): 'n' | 's' | 'e' | 'w' {
  const col      = voxelIndex % VOXEL_COLS;
  const rowLocal = Math.floor((voxelIndex % (VOXEL_COLS * VOXEL_ROWS)) / VOXEL_COLS);
  const level    = Math.floor(voxelIndex / (VOXEL_COLS * VOXEL_ROWS));
  const base     = level * VOXEL_COLS * VOXEL_ROWS;

  if (rowLocal > 0             && grid[base + (rowLocal - 1) * VOXEL_COLS + col]?.active) return 'n';
  if (rowLocal < VOXEL_ROWS - 1 && grid[base + (rowLocal + 1) * VOXEL_COLS + col]?.active) return 's';
  // E(+X)→col-1, W(-X)→col+1 per negated-X axis
  if (col > 0                  && grid[base + rowLocal * VOXEL_COLS + (col - 1)]?.active) return 'e';
  if (col < VOXEL_COLS - 1     && grid[base + rowLocal * VOXEL_COLS + (col + 1)]?.active) return 'w';
  return 'n'; // fallback
}

// ── Store ───────────────────────────────────────────────────

export type StoreState = AppState & EnvironmentSlice & UiSlice & SelectionSlice & DragSlice & LibrarySlice & VoxelSlice & ContainerSlice & { _hasHydrated: boolean };

export const useStore = create<StoreState>()(persist(temporal(immer((set, get) => ({
  // ── Slices ─────────────────────────────────────────────
  ...createEnvironmentSlice(set as any, get as any),
  ...createUiSlice(set as any, get as any),
  ...createSelectionSlice(set as any, get as any),
  ...createDragSlice(set as any, get as any),
  ...createLibrarySlice(set as any, get as any, DEFAULT_HOTBAR),
  ...createVoxelSlice(set as any, get as any),
  ...createContainerSlice(set as any, get as any),

  // ── Initial State ───────────────────────────────────────
  _hasHydrated: false,

})), {
  limit: 50,
  partialize: (state) => {
    const { containers, zones, furnitureIndex } = state;
    return { containers, zones, furnitureIndex } as StoreState;
  },
  equality: (pastState, currentState) =>
    (pastState as any).containers === (currentState as any).containers &&
    (pastState as any).zones === (currentState as any).zones &&
    (pastState as any).furnitureIndex === (currentState as any).furnitureIndex,
}), {
  name: 'moduhome-project',
  storage: createJSONStorage(() => idbStorage),
  partialize: (state) => {
    const { containers, zones, environment, viewMode, pricing, furnitureIndex,
            libraryBlocks, libraryContainers, libraryHomeDesigns, customHotbar,
            palettes, activePaletteId } = state;
    // Strip ephemeral _preMergeWalls and _preExtensionDoors from persisted containers
    const cleanContainers: Record<string, Container> = {};
    for (const [id, c] of Object.entries(containers)) {
      const { _preMergeWalls, _preExtensionDoors, ...rest } = c;
      cleanContainers[id] = rest;
    }
    return { containers: cleanContainers, zones, environment, viewMode, pricing, furnitureIndex,
             libraryBlocks, libraryContainers, libraryHomeDesigns, customHotbar,
             palettes, activePaletteId } as StoreState;
  },
  onRehydrateStorage: () => (state, error) => {
    if (error) {
      console.error('ModuHome: Hydration error:', error);
      useStore.setState({ _hasHydrated: true });
      return;
    }
    if (state) {
      const result = persistedStateSchema.safeParse(state);
      if (!result.success) {
        console.warn('ModuHome: Invalid persisted state, using defaults:', result.error);
      }
      // Back-fill defaults for fields added after initial persist
      if (state.environment && !state.environment.groundPreset) {
        useStore.setState({
          environment: { ...state.environment, groundPreset: 'grass' },
        });
      }
    }
    useStore.setState({ _hasHydrated: true });
  },
}));

// Inject temporal API accessor for dragSlice, librarySlice, voxelSlice, and containerSlice (avoids circular import)
setTemporalApiAccessor(() => useStore.temporal.getState());
setLibraryTemporalAccessor(() => useStore.temporal.getState());
setVoxelStoreRef(useStore);
setContainerTemporalAccessor(() => useStore.temporal.getState());

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__store = useStore;
}
