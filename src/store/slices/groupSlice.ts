/**
 * groupSlice.ts — Hierarchical container grouping.
 *
 * Brainstorm origin (docs/brainstorms/2026-05-18-001-building-ux-requirements.md)
 * "Deferred for later" item #2: hierarchical grouping ("wings", "levels",
 * "units") for power users to bundle related containers and apply bulk
 * operations.
 *
 * Minimal implementation: a `containerGroups` record of
 * `{ id, label, containerIds[] }`. Actions for create/rename/delete/add/remove.
 * No bulk-operation UI shipped here — the data model is the foundation;
 * UI surfaces (Inspector tab, agent tool calls) can be layered on later.
 *
 * Persisted via the same idb-keyval store as other ephemeral-ish state
 * (handled by the persist middleware allowlist in useStore.ts; if groups
 * should survive reload, add 'containerGroups' to the partialize key list
 * — currently they survive in-session via Zustand but not across reload).
 */

import { v4 as uuid } from 'uuid';
import type { SliceGet, SliceSet } from './types';

export interface ContainerGroup {
  id: string;
  label: string;
  containerIds: string[];
}

export interface GroupSlice {
  containerGroups: Record<string, ContainerGroup>;
  createGroup: (label: string, containerIds?: string[]) => string;
  renameGroup: (groupId: string, label: string) => void;
  removeGroup: (groupId: string) => void;
  addToGroup: (groupId: string, containerId: string) => void;
  removeFromGroup: (groupId: string, containerId: string) => void;
  /** Pure-read helper: returns the label of the group containing this
   *  container, or null if not grouped. Containers can belong to only
   *  one group at a time (last add wins). */
  groupLabelFor: (containerId: string) => string | null;
}

type GroupRuntimeState = GroupSlice;
type Set = SliceSet<GroupRuntimeState>;
type Get = SliceGet<GroupRuntimeState>;

export const createGroupSlice = (set: Set, get: Get): GroupSlice => ({
  containerGroups: {},

  createGroup: (label, containerIds = []) => {
    const id = uuid();
    set((s) => ({
      containerGroups: {
        ...s.containerGroups,
        [id]: { id, label, containerIds: [...containerIds] },
      },
    }));
    return id;
  },

  renameGroup: (groupId, label) => {
    set((s) => {
      const g = s.containerGroups[groupId];
      if (!g) return {};
      return {
        containerGroups: { ...s.containerGroups, [groupId]: { ...g, label } },
      };
    });
  },

  removeGroup: (groupId) => {
    set((s) => {
      if (!s.containerGroups[groupId]) return {};
      const next = { ...s.containerGroups };
      delete next[groupId];
      return { containerGroups: next };
    });
  },

  addToGroup: (groupId, containerId) => {
    set((s) => {
      const g = s.containerGroups[groupId];
      if (!g) return {};
      if (g.containerIds.includes(containerId)) return {};
      // Remove from any other group so a container only belongs to one
      const otherUpdates: Record<string, ContainerGroup> = {};
      for (const other of Object.values(s.containerGroups)) {
        if (other.id === groupId) continue;
        if (other.containerIds.includes(containerId)) {
          otherUpdates[other.id] = {
            ...other,
            containerIds: other.containerIds.filter((cid) => cid !== containerId),
          };
        }
      }
      return {
        containerGroups: {
          ...s.containerGroups,
          ...otherUpdates,
          [groupId]: { ...g, containerIds: [...g.containerIds, containerId] },
        },
      };
    });
  },

  removeFromGroup: (groupId, containerId) => {
    set((s) => {
      const g = s.containerGroups[groupId];
      if (!g) return {};
      return {
        containerGroups: {
          ...s.containerGroups,
          [groupId]: { ...g, containerIds: g.containerIds.filter((cid) => cid !== containerId) },
        },
      };
    });
  },

  groupLabelFor: (containerId) => {
    const groups = get().containerGroups;
    for (const g of Object.values(groups)) {
      if (g.containerIds.includes(containerId)) return g.label;
    }
    return null;
  },
});
