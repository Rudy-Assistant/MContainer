/**
 * U8: Destructive-action toast state contract.
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md (R8, AE6)
 *
 * When the user performs a destructive action (delete container, clear voxel,
 * etc.), `lastDestructiveAction` is set with a description string. The
 * DestructiveToast UI subscribes to this and renders for ~2 seconds.
 *
 * This file tests the store contract; the toast UI itself is visually
 * verified separately.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('U8: lastDestructiveAction state (R8, AE6)', () => {
  beforeEach(() => resetStore());

  it('defaults to null', () => {
    expect(useStore.getState().lastDestructiveAction).toBeNull();
  });

  it('setLastDestructiveAction records a description', () => {
    useStore.getState().setLastDestructiveAction({ description: 'Deleted L1 NW' });
    const lda = useStore.getState().lastDestructiveAction;
    expect(lda?.description).toBe('Deleted L1 NW');
    expect(typeof lda?.at).toBe('number');
  });

  it('setLastDestructiveAction(null) clears', () => {
    useStore.getState().setLastDestructiveAction({ description: 'Deleted X' });
    useStore.getState().setLastDestructiveAction(null);
    expect(useStore.getState().lastDestructiveAction).toBeNull();
  });

  it('removeContainer triggers a destructive-action toast with the container name', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const c = useStore.getState().containers[id];
    expect(c).toBeDefined();
    useStore.getState().removeContainer(id);
    const lda = useStore.getState().lastDestructiveAction;
    expect(lda, 'removeContainer should set lastDestructiveAction').not.toBeNull();
    expect(lda?.description).toMatch(/Deleted/i);
  });
});
