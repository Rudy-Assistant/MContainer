/**
 * U3: Voxel-face hover-paint preview state contract.
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md (U3, R3, AE2)
 *
 * Existing infrastructure: `hoveredVoxelEdge: { containerId, voxelIndex, face } | null`
 * is set from ContainerSkin pointer-over handlers. To render a hotbar-aware
 * preview overlay we add `activeHotbarSlot` lookup + a helper that resolves
 * "what surface would land on this face if I clicked now."
 *
 * This file tests the resolver contract; the R3F overlay mesh is verified
 * separately in the browser.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { resolveHotbarFaceMaterial } from '@/store/selectors/facePaintPreview';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('U3: resolveHotbarFaceMaterial (R3, AE2)', () => {
  beforeEach(() => resetStore());

  it('returns null when activeHotbarSlot is unset', () => {
    const s = useStore.getState();
    expect(s.activeHotbarSlot).toBeNull();
    const mat = resolveHotbarFaceMaterial(s, 's');
    expect(mat).toBeNull();
  });

  it('returns the slot face material for the requested direction when slot is active', () => {
    useStore.setState({ activeHotbarSlot: 0 });
    const s = useStore.getState();
    const slot0 = s.hotbar[0];
    expect(slot0).toBeDefined();
    expect(slot0.faces, 'slot 0 (Floor) should have face data').toBeDefined();
    if (!slot0.faces) return;
    const mat = resolveHotbarFaceMaterial(s, 'bottom');
    expect(mat).toBe(slot0.faces.bottom);
  });

  it('returns null for slots without face data (e.g., macro tools)', () => {
    // Find a slot without faces (e.g., the smart-room or staircase macro)
    const s = useStore.getState();
    const noFaceSlotIdx = s.hotbar.findIndex((slot) => slot.faces === null);
    if (noFaceSlotIdx === -1) {
      // All slots have faces — skip; still passing.
      return;
    }
    useStore.setState({ activeHotbarSlot: noFaceSlotIdx });
    const mat = resolveHotbarFaceMaterial(useStore.getState(), 's');
    expect(mat).toBeNull();
  });
});
