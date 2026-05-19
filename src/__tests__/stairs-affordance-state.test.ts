/**
 * U4: Auto-stairs affordance state contract.
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md (U4, R4, AE3)
 *
 * After a successful stackContainer mutation, the UI exposes an inline
 * "+ Stairs" affordance on the lower container's roof. The visual
 * affordance subscribes to `lastStackedPair: { topId, bottomId, at } | null`.
 * Click commits stairs via applyStairsFromFace; click-anywhere or 4s TTL
 * clears the state.
 *
 * This file tests the store contract; the visual affordance is
 * verified separately.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('U4: lastStackedPair affordance state (R4, AE3)', () => {
  beforeEach(() => resetStore());

  it('defaults to null', () => {
    expect(useStore.getState().lastStackedPair).toBeNull();
  });

  it('stackContainer sets lastStackedPair with both ids and a timestamp', () => {
    const bottomId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 2.9, z: 0 }, 1, true);
    const ok = useStore.getState().stackContainer(topId, bottomId);
    expect(ok).toBe(true);
    const pair = useStore.getState().lastStackedPair;
    expect(pair?.topId).toBe(topId);
    expect(pair?.bottomId).toBe(bottomId);
    expect(typeof pair?.at).toBe('number');
  });

  it('setLastStackedPair(null) dismisses the affordance', () => {
    const bottomId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 2.9, z: 0 }, 1, true);
    useStore.getState().stackContainer(topId, bottomId);
    useStore.getState().setLastStackedPair(null);
    expect(useStore.getState().lastStackedPair).toBeNull();
  });

  it('failed stack does NOT set lastStackedPair', () => {
    // Stacking a container that doesn't exist should fail without side effects
    const ok = useStore.getState().stackContainer('nonexistent-top', 'nonexistent-bottom');
    expect(ok).toBe(false);
    expect(useStore.getState().lastStackedPair).toBeNull();
  });
});
