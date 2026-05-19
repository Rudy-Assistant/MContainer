/**
 * U3: face-paint-preview selector.
 *
 * Resolves "what surface would be painted on a hovered face if I clicked
 * the current hotbar slot now?" Returns null when no hotbar slot is
 * active or the active slot has no per-face data (e.g., macro tools
 * like staircase).
 *
 * Used by FacePaintPreview.tsx (R3F overlay) to render a translucent
 * preview of the would-be material BEFORE click.
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md (U3)
 */

import type { VoxelFaces, SurfaceType } from '@/types/container';
import type { AppState } from '@/types/container';

/** Subset of the store state this selector needs. Keeping the contract
 *  small means the selector can be reused outside the live store (e.g.,
 *  tests with custom slot configs). */
type Pickable = {
  activeHotbarSlot: number | null;
  hotbar: Array<{ faces: VoxelFaces | null }>;
};

export function resolveHotbarFaceMaterial(
  state: Pickable | AppState,
  face: keyof VoxelFaces,
): SurfaceType | null {
  const slotIdx = (state as Pickable).activeHotbarSlot;
  if (slotIdx === null || slotIdx === undefined) return null;
  const slot = (state as Pickable).hotbar?.[slotIdx];
  if (!slot || !slot.faces) return null;
  return slot.faces[face];
}
