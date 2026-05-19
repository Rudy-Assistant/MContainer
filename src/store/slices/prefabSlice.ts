/**
 * prefabSlice.ts — Component-snap prefab modules.
 *
 * Brainstorm "Deferred for later" item #1 (now in-scope): Figma-style
 * prefab modules. Users select N containers, save as a named prefab,
 * then spawn fresh copies anywhere on the canvas with relative-position
 * preservation.
 *
 * Differs from `libraryHomeDesigns` (full-project save/load) and from
 * `groupSlice` (live grouping of existing containers) — this is for
 * REUSABLE assemblies that get re-spawned as new container instances.
 *
 * Spawn flow re-uses the existing addContainer + setVoxelFacesPresetBatch
 * path so smart-rule cleanup and adjacency fire normally.
 */

import { v4 as uuid } from 'uuid';
import {
  type ContainerSize,
  type Voxel,
  type VoxelFaces,
  type SurfaceType,
} from '@/types/container';
import type { SliceGet, SliceSet } from './types';

export interface PrefabContainerSpec {
  size: ContainerSize;
  /** Offset from the prefab's local origin (the first selected container
   *  on save). Spawning adds this to the drop origin per container. */
  relativePosition: { x: number; y: number; z: number };
  rotation: number;
  /** Deep-copied voxel grid from the source container at save time. */
  voxelGrid: Voxel[];
}

export interface PrefabModule {
  id: string;
  label: string;
  containers: PrefabContainerSpec[];
}

export interface PrefabSlice {
  prefabModules: Record<string, PrefabModule>;
  /** Saves the current selection as a named prefab. Returns the new
   *  prefab id, or null when selection is empty. */
  savePrefabFromSelection: (label: string) => string | null;
  /** Spawns fresh containers at `origin + relativePosition` for each spec
   *  in the prefab. Returns the new container ids in spec order. */
  spawnPrefab: (prefabId: string, origin?: [number, number, number]) => string[];
  removePrefab: (prefabId: string) => void;
  renamePrefab: (prefabId: string, label: string) => void;
}

type PrefabRuntimeState = PrefabSlice & {
  selection: string[];
  containers: Record<string, { size: ContainerSize; position: { x: number; y: number; z: number }; rotation: number; voxelGrid?: Voxel[] }>;
  addContainer: (
    size: ContainerSize,
    position: { x: number; y: number; z: number },
    level: number,
    skipSmartPlacement?: boolean,
  ) => string;
  updateContainerRotation: (id: string, rotation: number) => void;
  setVoxelFacesPresetBatch?: (
    containerId: string,
    overrides: Array<{ voxelIndex: number; face: keyof VoxelFaces; material: SurfaceType }>,
  ) => void;
  setLastDestructiveAction?: (a: { description: string } | null) => void;
};

type Set = SliceSet<PrefabRuntimeState>;
type Get = SliceGet<PrefabRuntimeState>;

const FACES: Array<keyof VoxelFaces> = ['n', 's', 'e', 'w', 'top', 'bottom'];

export const createPrefabSlice = (set: Set, get: Get): PrefabSlice => ({
  prefabModules: {},

  savePrefabFromSelection: (label) => {
    const s = get();
    const selection = s.selection;
    if (!selection || selection.length === 0) return null;

    const first = s.containers[selection[0]];
    if (!first) return null;
    const origin = first.position;

    const specs: PrefabContainerSpec[] = [];
    for (const id of selection) {
      const c = s.containers[id];
      if (!c) continue;
      specs.push({
        size: c.size,
        relativePosition: {
          x: c.position.x - origin.x,
          y: c.position.y - origin.y,
          z: c.position.z - origin.z,
        },
        rotation: c.rotation ?? 0,
        voxelGrid: c.voxelGrid ? c.voxelGrid.map((v) => ({ ...v, faces: { ...v.faces } })) : [],
      });
    }
    if (specs.length === 0) return null;

    const prefabId = uuid();
    set((state) => ({
      prefabModules: {
        ...state.prefabModules,
        [prefabId]: { id: prefabId, label, containers: specs },
      },
    }));
    return prefabId;
  },

  spawnPrefab: (prefabId, origin = [0, 0, 0]) => {
    const s = get();
    const prefab = s.prefabModules[prefabId];
    if (!prefab) return [];

    const spawned: string[] = [];
    for (const spec of prefab.containers) {
      const newId = s.addContainer(
        spec.size,
        { x: origin[0] + spec.relativePosition.x, y: origin[1] + spec.relativePosition.y, z: origin[2] + spec.relativePosition.z },
        Math.round((origin[1] + spec.relativePosition.y) / 2.9),
        true,
      );
      spawned.push(newId);
      if (spec.rotation !== 0) s.updateContainerRotation(newId, spec.rotation);
      // Batch-apply the saved voxel-face material set so the new container
      // matches the prefab's painted finish without per-cell set() churn.
      if (spec.voxelGrid && spec.voxelGrid.length > 0 && s.setVoxelFacesPresetBatch) {
        const overrides: Array<{ voxelIndex: number; face: keyof VoxelFaces; material: SurfaceType }> = [];
        for (let i = 0; i < spec.voxelGrid.length; i++) {
          const v = spec.voxelGrid[i];
          if (!v?.faces) continue;
          for (const face of FACES) {
            const mat = v.faces[face];
            if (mat && mat !== 'Open') {
              overrides.push({ voxelIndex: i, face, material: mat });
            }
          }
        }
        if (overrides.length > 0) s.setVoxelFacesPresetBatch(newId, overrides);
      }
    }

    if (s.setLastDestructiveAction) {
      s.setLastDestructiveAction({ description: `Spawned prefab "${prefab.label}" (${spawned.length} containers)` });
    }
    return spawned;
  },

  removePrefab: (prefabId) => {
    set((state) => {
      if (!state.prefabModules[prefabId]) return {};
      const next = { ...state.prefabModules };
      delete next[prefabId];
      return { prefabModules: next };
    });
  },

  renamePrefab: (prefabId, label) => {
    set((state) => {
      const p = state.prefabModules[prefabId];
      if (!p) return {};
      return { prefabModules: { ...state.prefabModules, [prefabId]: { ...p, label } } };
    });
  },
});
