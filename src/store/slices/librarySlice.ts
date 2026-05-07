/**
 * librarySlice.ts — Library, Custom Hotbar, Module Presets, and Import/Export state
 *
 * Extracted from useStore.ts. Consumer selectors unchanged — state merges into StoreState.
 */

import { v4 as uuid } from 'uuid';
import {
  type ContainerPosition,
  type VoxelFaces,
  type ModuleOrientation,
  type LibraryBlock,
  type LibraryContainer,
  type LibraryHomeDesign,
  type PricingConfig,
  type FurnitureItem,
  type Container,
  type ExtensionConfig,
  type Zone,
  ViewMode,
  CONTAINER_DIMENSIONS,
  DEFAULT_EXTENSION_CONFIG,
} from '@/types/container';
import { createDefaultVoxelGrid, createPoolVoxelGrid } from '@/types/factories';
import defaultPricing from '@/config/pricing_config.json';
import { getModelHome } from '@/config/modelHomes';
import { scheduleAdjacency } from '@/store/slices/containerSlice';
import type { HotbarSlot } from '../useStore';
import type { SliceGet, SliceSet } from './types';

// Use a lazy StoreState reference to avoid circular imports.
// The slice function receives set/get typed to the full store.
type LibraryRuntimeState = LibrarySlice & {
  activeHotbarSlot: number | null;
  containers: Record<string, Container>;
  zones: Record<string, Zone>;
  environment: Record<string, unknown>;
  viewMode: ViewMode;
  pricing: PricingConfig;
  furnitureIndex: Record<string, FurnitureItem>;
  selection: unknown[];
  addContainer: (size: Container['size'], position: ContainerPosition, level: number, skipSmartPlacement?: boolean) => string;
  applyContainerRole: (containerId: string, roleId: string, skipOverlapCheck?: boolean) => void;
  applyContainerArrangement: (containerId: string, arrangementId: import('@/types/container').ContainerArrangementId) => void;
  updateContainerRotation: (containerId: string, rotation: number) => void;
  designMode: 'smart' | 'manual';
  setDesignMode: (mode: 'smart' | 'manual') => void;
  setAllExtensions: (containerId: string, config: ExtensionConfig, skipOverlapCheck?: boolean) => void;
  stackContainer: (topId: string, bottomId: string) => boolean;
  applyStairsFromFace: (containerId: string, voxelIndex: number, face: 'n' | 's' | 'e' | 'w' | 'top') => void;
  generateRooftopDeck: (containerId: string) => void;
  refreshAdjacency: () => void;
  setVoxelFace: (
    containerId: string,
    voxelIndex: number,
    face: 'n' | 's' | 'e' | 'w' | 'top' | 'bottom',
    surface: import('@/types/container').SurfaceType,
  ) => void;
  addFurniture: (
    containerId: string,
    type: import('@/types/container').FurnitureType,
    position?: { x: number; y: number; z: number },
    rotation?: number,
  ) => string | null;
};
type Set = SliceSet<LibraryRuntimeState>;
type Get = SliceGet<LibraryRuntimeState>;
type TemporalApi = { pause: () => void; resume: () => void };
type ImportedContainer = Partial<Container> & Pick<Container, 'size' | 'position' | 'rotation' | 'walls'>;
type ImportedProjectState = Partial<LibraryRuntimeState> & {
  containers?: Record<string, ImportedContainer>;
};

export interface MaterialPalette {
  id: string;
  name: string;
  isBuiltIn: boolean;
  steelColor: number;
  steelMetalness: number;
  steelRoughness: number;
  frameColor: number;
  frameMetalness: number;
  glassTransmission: number;
  woodColor: number;
  groundPreset: string;
}

export interface LibrarySlice {
  // Library collections (persisted)
  libraryBlocks: LibraryBlock[];
  libraryContainers: LibraryContainer[];
  libraryHomeDesigns: LibraryHomeDesign[];
  customHotbar: (HotbarSlot | null)[];

  // Smart Hotbar (persisted via DEFAULT_HOTBAR)
  hotbar: HotbarSlot[];
  setHotbar: (slots: HotbarSlot[]) => void;

  // Module presets (ephemeral)
  activeModulePreset: string | null;
  moduleOrientation: ModuleOrientation;
  setActiveModulePreset: (id: string | null) => void;
  setModuleOrientation: (o: ModuleOrientation) => void;
  rotateModuleOrientation: () => void;

  // Library CRUD
  saveBlockToLibrary: (label: string, faces: VoxelFaces) => string;
  saveContainerToLibrary: (containerId: string, label: string) => string | null;
  saveHomeDesign: (label: string, description?: string) => string;
  loadHomeDesign: (designId: string, origin?: [number, number, number]) => string[];
  removeLibraryItem: (id: string) => void;
  renameLibraryItem: (id: string, label: string) => void;
  setCustomHotbarSlot: (index: number, slot: HotbarSlot | null) => void;

  // Palettes
  palettes: MaterialPalette[];
  activePaletteId: string;
  savePalette: (palette: Omit<MaterialPalette, 'id'>) => string;
  updatePalette: (id: string, fields: Partial<Omit<MaterialPalette, 'id' | 'isBuiltIn'>>) => void;
  deletePalette: (id: string) => void;
  setActivePalette: (id: string) => void;

  // Serialization
  exportState: () => string;
  importState: (json: string) => void;

  // Model Homes
  placeModelHome: (modelId: string, origin?: [number, number, number]) => string[];
}

// We need access to useStore for temporal — import lazily to avoid circular deps.
// The `get()` accessor already returns the full store at runtime.
let _getTemporalApi: (() => TemporalApi) | null = null;

/** Inject the temporal API accessor (called from useStore.ts after store creation) */
export function setLibraryTemporalAccessor(accessor: () => TemporalApi) {
  _getTemporalApi = accessor;
}

import { THEMES, type ThemeId } from '@/config/themes';

function themeToBuiltInPalette(id: ThemeId, groundPreset: string): MaterialPalette {
  const m = THEMES[id].materials;
  return {
    id, name: THEMES[id].label, isBuiltIn: true,
    steelColor: m.steel.color, steelMetalness: m.steel.metalness, steelRoughness: m.steel.roughness,
    frameColor: m.frame.color, frameMetalness: m.frame.metalness,
    glassTransmission: m.glass.transmission, woodColor: m.wood.color, groundPreset,
  };
}

const BUILT_IN_PALETTES: MaterialPalette[] = [
  themeToBuiltInPalette('industrial', 'grass'),
  themeToBuiltInPalette('japanese', 'grass'),
  themeToBuiltInPalette('desert', 'gravel'),
];

export const createLibrarySlice = (set: Set, get: Get, DEFAULT_HOTBAR: HotbarSlot[]): LibrarySlice => ({
  // ── Initial State ──────────────────────────────────────
  libraryBlocks: [],
  libraryContainers: [],
  libraryHomeDesigns: [],
  customHotbar: Array(10).fill(null) as (HotbarSlot | null)[],
  hotbar: DEFAULT_HOTBAR,
  activeModulePreset: null,
  moduleOrientation: 'n' as ModuleOrientation,
  palettes: BUILT_IN_PALETTES,
  activePaletteId: 'industrial',

  // ── Actions ────────────────────────────────────────────

  setHotbar: (slots) => set({ hotbar: slots }),

  setActiveModulePreset: (id) => set({ activeModulePreset: id, activeHotbarSlot: null }),
  setModuleOrientation: (o) => set({ moduleOrientation: o }),
  rotateModuleOrientation: () => {
    const cycle: ModuleOrientation[] = ['n', 'e', 's', 'w'];
    const cur = get().moduleOrientation;
    const next = cycle[(cycle.indexOf(cur) + 1) % 4];
    set({ moduleOrientation: next });
  },

  savePalette: (palette) => {
    const id = uuid();
    const entry: MaterialPalette = { ...palette, id };
    set((s) => ({ palettes: [...s.palettes, entry] }));
    return id;
  },

  updatePalette: (id, fields) => {
    set((s) => ({
      palettes: s.palettes.map((p: MaterialPalette) =>
        p.id === id && !p.isBuiltIn ? { ...p, ...fields } : p
      ),
    }));
  },

  deletePalette: (id) => {
    const p = get().palettes.find((p: MaterialPalette) => p.id === id);
    if (p?.isBuiltIn) return; // Cannot delete built-ins
    set((s) => ({ palettes: s.palettes.filter((p: MaterialPalette) => p.id !== id) }));
  },

  setActivePalette: (id) => set({ activePaletteId: id }),

  saveBlockToLibrary: (label, faces) => {
    const id = uuid();
    const block: LibraryBlock = { id, label, faces: { ...faces }, category: 'user', createdAt: Date.now() };
    set((s) => ({ libraryBlocks: [...s.libraryBlocks, block] }));
    return id;
  },

  saveContainerToLibrary: (containerId, label) => {
    const c = get().containers[containerId];
    if (!c) return null;
    const id = uuid();
    const grid = c.voxelGrid ? structuredClone(c.voxelGrid) : createDefaultVoxelGrid();
    const entry: LibraryContainer = { id, label, size: c.size, voxelGrid: grid, category: 'user', createdAt: Date.now() };
    set((s) => ({ libraryContainers: [...s.libraryContainers, entry] }));
    return id;
  },

  saveHomeDesign: (label, description) => {
    const containers = get().containers;
    const allContainers = Object.values(containers) as Container[];
    if (allContainers.length === 0) return '';

    // Use first container's position as origin
    const origin = allContainers[0].position;
    const designContainers = allContainers.map((c: Container) => ({
      size: c.size,
      relativePosition: [
        c.position.x - origin.x,
        c.position.y - origin.y,
        c.position.z - origin.z,
      ] as [number, number, number],
      voxelGrid: c.voxelGrid ? structuredClone(c.voxelGrid) : createDefaultVoxelGrid(),
      role: c.appliedRole,
    }));

    const id = uuid();
    const design: LibraryHomeDesign = {
      id, label, description, icon: '🏠',
      containers: designContainers,
      category: 'user',
      createdAt: Date.now(),
    };
    set((s) => ({ libraryHomeDesigns: [...s.libraryHomeDesigns, design] }));
    return id;
  },

  loadHomeDesign: (designId, origin = [0, 0, 0]) => {
    const design = get().libraryHomeDesigns.find((d: LibraryHomeDesign) => d.id === designId);
    if (!design) return [];

    const t = _getTemporalApi?.();
    t?.pause();

    const containerIds: string[] = [];
    for (const dc of design.containers) {
      const pos: ContainerPosition = {
        x: origin[0] + dc.relativePosition[0],
        y: origin[1] + dc.relativePosition[1],
        z: origin[2] + dc.relativePosition[2],
      };
      const id = get().addContainer(dc.size, pos, Math.round(pos.y / 2.9), true);
      t?.pause();
      containerIds.push(id);

      // Apply saved voxel grid
      set((s) => {
        const c = s.containers[id];
        if (!c) return {};
        return {
          containers: {
            ...s.containers,
            [id]: { ...c, voxelGrid: structuredClone(dc.voxelGrid), appliedRole: dc.role },
          },
        };
      });
      t?.pause();
    }

    t?.resume();
    scheduleAdjacency(get);
    return containerIds;
  },

  removeLibraryItem: (id) => {
    set((s) => ({
      libraryBlocks: s.libraryBlocks.filter((b: LibraryBlock) => b.id !== id),
      libraryContainers: s.libraryContainers.filter((c: LibraryContainer) => c.id !== id),
      libraryHomeDesigns: s.libraryHomeDesigns.filter((d: LibraryHomeDesign) => d.id !== id),
    }));
  },

  renameLibraryItem: (id, label) => {
    set((s) => ({
      libraryBlocks: s.libraryBlocks.map((b: LibraryBlock) => b.id === id ? { ...b, label } : b),
      libraryContainers: s.libraryContainers.map((c: LibraryContainer) => c.id === id ? { ...c, label } : c),
      libraryHomeDesigns: s.libraryHomeDesigns.map((d: LibraryHomeDesign) => d.id === id ? { ...d, label } : d),
    }));
  },

  setCustomHotbarSlot: (index, slot) => {
    set((s) => {
      const next = [...s.customHotbar];
      next[index] = slot;
      return { customHotbar: next };
    });
  },

  exportState: () => {
    const { containers, zones, environment, viewMode, pricing, libraryBlocks, libraryContainers, libraryHomeDesigns, customHotbar, palettes, activePaletteId } = get();
    return JSON.stringify(
      { containers, zones, environment, viewMode, pricing, libraryBlocks, libraryContainers, libraryHomeDesigns, customHotbar, palettes, activePaletteId },
      null,
      2
    );
  },

  importState: (json) => {
    try {
      const parsed = JSON.parse(json) as ImportedProjectState;

      // Migrate old containers that lack new stacking/grouping/furniture fields
      const containers: Record<string, Container> = {};
      const furnitureIndex: Record<string, FurnitureItem> = {};
      for (const [id, c] of Object.entries(parsed.containers ?? {})) {
        const furniture = c.furniture ?? [];
        containers[id] = {
          ...c,
          level: c.level ?? 0,
          stackedOn: c.stackedOn ?? null,
          supporting: c.supporting ?? [],
          groupId: c.groupId ?? null,
          mergedWalls: c.mergedWalls ?? [],
          floorRemoved: c.floorRemoved ?? false,
          furniture,
        } as Container;
        // Migrate HingedWall modules that lack outerWall field
        for (const wall of Object.values(containers[id].walls)) {
          for (const bay of (wall as unknown as { bays: Array<{ module: Record<string, unknown> }> }).bays) {
            if (bay.module.type === "hinged_wall" && !bay.module.outerWall) {
              bay.module.outerWall = "railing";
            }
          }
        }
        for (const f of furniture) {
          furnitureIndex[f.id] = f;
        }
      }

      set({
        containers,
        zones: parsed.zones ?? {},
        environment: { timeOfDay: 15, northOffset: 0, groundPreset: 'grass', ...parsed.environment },
        viewMode: parsed.viewMode ?? ViewMode.Realistic3D,
        pricing: parsed.pricing ?? (defaultPricing as unknown as PricingConfig),
        selection: [],
        furnitureIndex,
        libraryBlocks: parsed.libraryBlocks ?? [],
        libraryContainers: parsed.libraryContainers ?? [],
        libraryHomeDesigns: parsed.libraryHomeDesigns ?? [],
        customHotbar: parsed.customHotbar ?? Array(10).fill(null),
        palettes: parsed.palettes ?? BUILT_IN_PALETTES,
        activePaletteId: parsed.activePaletteId ?? 'industrial',
      });
    } catch (e) {
      console.error("Failed to import state:", e);
    }
  },

  placeModelHome: (modelId, origin = [0, 0, 0]) => {
    const model = getModelHome(modelId);
    if (!model) return [];

    const t = _getTemporalApi?.();
    t?.pause();

    // Bruce 2026-05-06 round 4 final: Smart-mode `recomputeSmartRailings`
    // and `recomputeSmartHoleGuards` (containerSlice.applyContainerArrangement
    // ~line 952) deactivate extension halo voxels when neighboring containers
    // overlap their projected halo footprints. For tightly-packed model homes
    // (resort_house's 3x2 grid, 2x2 showcases, etc.) this consistently wipes
    // the perimeter walls that central_atrium just installed -- the
    // user-visible "flat roof on stilts, no walls" failure mode. Verified
    // via Playwright inspection: smart mode produces v0.active=false,
    // northSteel=0; manual mode produces v0.active=true, northSteel=7
    // (1119 tests still pass; behavior is identical except for the smart
    // recompute step). Switch to manual for the placement, then restore.
    // The smart-rule cascade still runs at the end via cleanupDesign() if
    // the caller chooses to invoke it.
    const savedDesignMode = get().designMode;
    if (savedDesignMode === 'smart') {
      get().setDesignMode('manual');
      t?.pause();
    }

    const containerIds: string[] = [];

    // Place each container
    for (const mc of model.containers) {
      const pos: ContainerPosition = {
        x: origin[0] + mc.relativePosition[0],
        y: origin[1] + mc.relativePosition[1],
        z: origin[2] + mc.relativePosition[2],
      };

      // Pool slots are placed differently: subterranean basin with concrete
      // walls + open top water surface. Mirrors addPoolContainer() exactly,
      // but at the slot's relativePosition rather than [0,0,0].
      if (mc.pool) {
        const dims = CONTAINER_DIMENSIONS[mc.size];
        const poolPos: ContainerPosition = { x: pos.x, y: -dims.height, z: pos.z };
        const id = get().addContainer(mc.size, poolPos, 0, true);
        t?.pause();
        set((s) => {
          const c = s.containers[id];
          if (!c) return {};
          return {
            containers: {
              ...s.containers,
              [id]: { ...c, subterranean: true, voxelGrid: createPoolVoxelGrid(), name: 'Pool' },
            },
          };
        });
        containerIds.push(id);
        continue; // skip role/extension/arrangement/door/furniture for pool slots
      }

      const id = get().addContainer(mc.size, pos, Math.round(pos.y / 2.9), true);
      t?.pause();
      containerIds.push(id);

      // Apply container rotation (Y-axis radians) BEFORE arrangement so
      // rendered geometry + adjacency engine see the final orientation.
      // The voxel grid stays in LOCAL coords (rotation is render-only),
      // so arrangement voids/walls remain in correct local positions.
      if (mc.rotation !== undefined && mc.rotation !== 0) {
        get().updateContainerRotation(id, mc.rotation);
        t?.pause();
      }

      if (mc.role) {
        get().applyContainerRole(id, mc.role, true);
        t?.pause();
      }

      if (mc.extensionConfig && mc.extensionConfig !== 'none') {
        get().setAllExtensions(id, mc.extensionConfig as ExtensionConfig, true);
        t?.pause();
      }

      if (mc.arrangementId) {
        get().applyContainerArrangement(id, mc.arrangementId);
        t?.pause();
      }

      // Install an entry door if the preset requested one. Walkthrough-ready
      // presets use this so the spawn pose lands the user at a working door.
      if (mc.entryDoor) {
        get().setVoxelFace(id, mc.entryDoor.voxelIndex, mc.entryDoor.face, 'Door');
        t?.pause();
      }

      // Drop preset furniture into the placed container. Positions are local
      // to the container origin; addFurniture re-anchors to world space.
      if (mc.furniture?.length) {
        const c = get().containers[id];
        const baseY = c?.position.y ?? 0;
        for (const f of mc.furniture) {
          const worldPos = {
            x: c!.position.x + f.position.x,
            y: baseY + f.position.y,
            z: c!.position.z + f.position.z,
          };
          get().addFurniture(id, f.type, worldPos, f.rotation ?? 0);
          t?.pause();
        }
      }
    }

    // Process connections
    for (const conn of model.connections) {
      const topId = containerIds[conn.toIndex];
      const bottomId = containerIds[conn.fromIndex];
      if (!topId || !bottomId) continue;

      if (conn.type === 'stacked') {
        get().stackContainer(topId, bottomId);
        t?.pause();
        if (conn.stairsVoxelIndex !== undefined) {
          get().applyStairsFromFace(bottomId, conn.stairsVoxelIndex, conn.stairsFace ?? 'n');
          t?.pause();
        }
      }
    }

    // Process extra stairs (not tied to a stacking event) — used for
    // rooftop-deck access stairs that ascend off the topmost container.
    if (model.extraStairs) {
      for (const s of model.extraStairs) {
        const targetId = containerIds[s.containerIndex];
        if (!targetId) continue;
        get().applyStairsFromFace(targetId, s.voxelIndex, s.face);
        t?.pause();
      }
    }

    // Force a rooftop deck onto specific containers — needed when the
    // topmost row carries an arrangement (framed_glass_atrium etc.) that
    // makes `stackContainer`'s auto-rooftop path skip itself. See
    // `ModelHome.extraRooftopDecks` for the rationale. `generateRooftopDeck`
    // is idempotent and re-checks the topmost invariant per call.
    if (model.extraRooftopDecks) {
      for (const idx of model.extraRooftopDecks) {
        const targetId = containerIds[idx];
        if (!targetId) continue;
        get().generateRooftopDeck(targetId);
        t?.pause();
      }
    }

    // Auto-expand extensions only when the model home leaves extension behavior unspecified.
    for (const [i, mc] of model.containers.entries()) {
      if (!mc.extensionConfig && !mc.arrangementId) {
        get().setAllExtensions(containerIds[i], DEFAULT_EXTENSION_CONFIG, false);
        t?.pause();
      }
    }

    // Only stacked compositions auto-promote their roof into a deck.
    // Single-level model homes should preserve the arrangement they requested.
    if (model.connections.some((conn) => conn.type === 'stacked')) {
      const topmost = containerIds.find((id) => {
        return !Object.values(get().containers).some((other) => other.stackedOn === id);
      });
      if (topmost) {
        get().generateRooftopDeck(topmost);
        t?.pause();
      }
    }

    t?.resume();
    scheduleAdjacency(get);

    // Bruce 2026-05-06 round 4 final: do NOT restore designMode to 'smart'.
    // The smart-mode auto-merge cascade in `refreshAdjacency` (and downstream
    // smart-rule recomputes triggered by selection / view-mode toggles)
    // progressively deactivates extension halo voxels for tightly-packed
    // model homes (resort_house's 3x2 grid, 2x2 showcases). Once the user
    // sees the building rendered, walls visibly degrade as adjacency
    // recomputes fire. The d7d2008 manual-build-script-v2 commit
    // demonstrated that walls survive ONLY when designMode stays 'manual'.
    // A proper fix requires patching the recompute chain to preserve halo
    // activation, but that fix was not landed within the round-4 budget.
    // The user-facing impact of staying in manual mode is minor: the
    // smart-rule warnings panel still surfaces issues, but auto-merge of
    // shared walls is suppressed (visible interior cross-walls instead of
    // dissolved seams). Acceptable trade-off vs. an empty pavilion.
    //
    // Discarded `savedDesignMode` is intentional -- referencing it ensures
    // TypeScript doesn't flag it unused while preserving the restore-decision
    // log for future maintainers reading the diff.
    void savedDesignMode;

    return containerIds;
  },
});
