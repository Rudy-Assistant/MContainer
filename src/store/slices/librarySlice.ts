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
  ViewMode,
} from '@/types/container';
import { createDefaultVoxelGrid } from '@/types/factories';
import defaultPricing from '@/config/pricing_config.json';
import { getModelHome } from '@/config/modelHomes';
import { DEFAULT_EXTENSION_CONFIG, type ExtensionConfig } from '@/types/container';
import { scheduleAdjacency } from '@/store/slices/containerSlice';
import type { HotbarSlot } from '../useStore';

// Use a lazy StoreState reference to avoid circular imports.
// The slice function receives set/get typed to the full store.
type Set = (partial: Record<string, unknown> | ((s: any) => Record<string, unknown>)) => void;
type Get = () => any;

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
let _getTemporalApi: (() => any) | null = null;

/** Inject the temporal API accessor (called from useStore.ts after store creation) */
export function setLibraryTemporalAccessor(accessor: () => any) {
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
    set((s: any) => ({ palettes: [...s.palettes, entry] }));
    return id;
  },

  updatePalette: (id, fields) => {
    set((s: any) => ({
      palettes: s.palettes.map((p: MaterialPalette) =>
        p.id === id && !p.isBuiltIn ? { ...p, ...fields } : p
      ),
    }));
  },

  deletePalette: (id) => {
    const p = get().palettes.find((p: MaterialPalette) => p.id === id);
    if (p?.isBuiltIn) return; // Cannot delete built-ins
    set((s: any) => ({ palettes: s.palettes.filter((p: MaterialPalette) => p.id !== id) }));
  },

  setActivePalette: (id) => set({ activePaletteId: id }),

  saveBlockToLibrary: (label, faces) => {
    const id = uuid();
    const block: LibraryBlock = { id, label, faces: { ...faces }, category: 'user', createdAt: Date.now() };
    set((s: any) => ({ libraryBlocks: [...s.libraryBlocks, block] }));
    return id;
  },

  saveContainerToLibrary: (containerId, label) => {
    const c = get().containers[containerId];
    if (!c) return null;
    const id = uuid();
    const grid = c.voxelGrid ? structuredClone(c.voxelGrid) : createDefaultVoxelGrid();
    const entry: LibraryContainer = { id, label, size: c.size, voxelGrid: grid, category: 'user', createdAt: Date.now() };
    set((s: any) => ({ libraryContainers: [...s.libraryContainers, entry] }));
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
    set((s: any) => ({ libraryHomeDesigns: [...s.libraryHomeDesigns, design] }));
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
      set((s: any) => {
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
    set((s: any) => ({
      libraryBlocks: s.libraryBlocks.filter((b: LibraryBlock) => b.id !== id),
      libraryContainers: s.libraryContainers.filter((c: LibraryContainer) => c.id !== id),
      libraryHomeDesigns: s.libraryHomeDesigns.filter((d: LibraryHomeDesign) => d.id !== id),
    }));
  },

  renameLibraryItem: (id, label) => {
    set((s: any) => ({
      libraryBlocks: s.libraryBlocks.map((b: LibraryBlock) => b.id === id ? { ...b, label } : b),
      libraryContainers: s.libraryContainers.map((c: LibraryContainer) => c.id === id ? { ...c, label } : c),
      libraryHomeDesigns: s.libraryHomeDesigns.map((d: LibraryHomeDesign) => d.id === id ? { ...d, label } : d),
    }));
  },

  setCustomHotbarSlot: (index, slot) => {
    set((s: any) => {
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
      const parsed = JSON.parse(json) as any;

      // Migrate old containers that lack new stacking/grouping/furniture fields
      const containers: Record<string, Container> = {};
      const furnitureIndex: Record<string, FurnitureItem> = {};
      for (const [id, c] of Object.entries(parsed.containers ?? {}) as [string, any][]) {
        const furniture = (c as Container).furniture ?? [];
        containers[id] = {
          ...c,
          level: c.level ?? 0,
          stackedOn: c.stackedOn ?? null,
          supporting: c.supporting ?? [],
          groupId: c.groupId ?? null,
          mergedWalls: c.mergedWalls ?? [],
          floorRemoved: c.floorRemoved ?? false,
          furniture,
        };
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
        libraryBlocks: (parsed as Record<string, unknown>).libraryBlocks as LibraryBlock[] ?? [],
        libraryContainers: (parsed as Record<string, unknown>).libraryContainers as LibraryContainer[] ?? [],
        libraryHomeDesigns: (parsed as Record<string, unknown>).libraryHomeDesigns as LibraryHomeDesign[] ?? [],
        customHotbar: (parsed as Record<string, unknown>).customHotbar as (HotbarSlot | null)[] ?? Array(10).fill(null),
        palettes: (parsed as Record<string, unknown>).palettes as MaterialPalette[] ?? BUILT_IN_PALETTES,
        activePaletteId: (parsed as Record<string, unknown>).activePaletteId as string ?? 'industrial',
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

    const containerIds: string[] = [];

    // Place each container
    for (const mc of model.containers) {
      const pos: ContainerPosition = {
        x: origin[0] + mc.relativePosition[0],
        y: origin[1] + mc.relativePosition[1],
        z: origin[2] + mc.relativePosition[2],
      };
      const id = get().addContainer(mc.size, pos, Math.round(pos.y / 2.9), true);
      t?.pause();
      containerIds.push(id);

      if (mc.role) {
        get().applyContainerRole(id, mc.role, true);
        t?.pause();
      }

      if (mc.extensionConfig && mc.extensionConfig !== 'none') {
        get().setAllExtensions(id, mc.extensionConfig, true);
        t?.pause();
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
          get().applyStairsFromFace(bottomId, conn.stairsVoxelIndex, 'n');
          t?.pause();
        }
      }
    }

    // Auto-expand extensions on containers that don't have explicit extensionConfig
    for (const [i, mc] of model.containers.entries()) {
      if (!mc.extensionConfig || mc.extensionConfig === 'none') {
        get().setAllExtensions(containerIds[i], DEFAULT_EXTENSION_CONFIG, false);
        t?.pause();
      }
    }

    // Generate rooftop deck on topmost container
    const topmost = containerIds.find((id) => {
      return !Object.values(get().containers).some((other: any) => other.stackedOn === id);
    });
    if (topmost) {
      get().generateRooftopDeck(topmost);
      t?.pause();
    }

    t?.resume();
    scheduleAdjacency(get);
    return containerIds;
  },
});
