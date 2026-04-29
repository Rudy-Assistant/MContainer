/**
 * aiDesigner.ts — Apply an AI-generated DesignPlan to the Zustand store.
 *
 * The plan is produced by `/api/design` (server-side Claude call) and applied
 * client-side via this module. Containers added earlier in a plan are
 * referenced by ordinal `containerIndex` in subsequent actions (e.g.
 * apply_room_preset(containerIndex=0, …)) — the executor resolves indices to
 * runtime container IDs.
 *
 * Schema for the plan is mirrored on the API route (kept in sync by hand —
 * change both files together).
 */

import { ContainerSize } from '@/types/container';
import type { RoofTypeId } from '@/config/roofTypes';
import type { RoomPresetId } from '@/config/roomPresets';
import type { StoreState } from '@/store/useStore';

// ── Plan shape ───────────────────────────────────────────────────────────

export type DesignAction =
  | {
      type: 'add_container';
      size: ContainerSize;
      position: { x: number; y: number; z: number };
      level?: number;
      roofType?: RoofTypeId;
    }
  | {
      type: 'apply_room_preset';
      /** 0-indexed across the `add_container` actions in this plan. */
      containerIndex: number;
      anchorBodyCol: number;
      anchorBodyRow: number;
      presetId: RoomPresetId;
      level?: 0 | 1;
    }
  | {
      type: 'set_site_context';
      enabled: boolean;
    };

export interface DesignPlan {
  /** One-paragraph designer rationale shown back to the user. */
  rationale: string;
  actions: DesignAction[];
}

// ── Apply ────────────────────────────────────────────────────────────────

export interface ApplyResult {
  addedIds: string[];
  warnings: string[];
}

/**
 * Apply a DesignPlan to the live store. Each action is executed sequentially
 * — Zustand batches the React notifications, so the user sees the design
 * appear in one render frame. Failures within a single action (e.g. a
 * room-preset that doesn't fit) are collected into `warnings` rather than
 * aborting the whole plan, so the user gets a partial design + a list of
 * what didn't fit.
 */
export function applyDesignPlan(plan: DesignPlan, store: StoreState): ApplyResult {
  const addedIds: string[] = [];
  const warnings: string[] = [];

  for (const action of plan.actions) {
    switch (action.type) {
      case 'add_container': {
        const id = store.addContainer(action.size, action.position, action.level ?? 0, true);
        addedIds.push(id);
        if (action.roofType && action.roofType !== 'flat') {
          store.setRoofType(id, action.roofType);
        }
        break;
      }
      case 'apply_room_preset': {
        const containerId = addedIds[action.containerIndex];
        if (!containerId) {
          warnings.push(`Room preset references container index ${action.containerIndex}, but only ${addedIds.length} container(s) were added.`);
          break;
        }
        const err = store.applyRoomPreset(
          containerId,
          action.anchorBodyCol,
          action.anchorBodyRow,
          action.presetId,
          action.level,
        );
        if (err) warnings.push(err);
        break;
      }
      case 'set_site_context': {
        store.setSiteContextEnabled(action.enabled);
        break;
      }
    }
  }

  return { addedIds, warnings };
}

// ── Catalogs (re-exported for the API route's system prompt) ─────────────

export const VALID_CONTAINER_SIZES: ContainerSize[] = [
  ContainerSize.Standard20,
  ContainerSize.Standard40,
  ContainerSize.HighCube40,
];

export const VALID_ROOF_TYPES: RoofTypeId[] = [
  'flat', 'parapet', 'gable', 'shed', 'butterfly', 'green',
];
