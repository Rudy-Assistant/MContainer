/**
 * Sprint C — precision controls (C4 + helpers used by C2/C3).
 *
 * C4: duplicateContainer creates a new container at offset, preserves
 *     size + rotation + voxel-grid, announces via destructive toast.
 * C2/C3: pure parseFloat + axis-lock math is already trivial; we
 *     test the duplicate action as the substantive store-level change.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize, CONTAINER_DIMENSIONS } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('duplicateContainer (Sprint C4)', () => {
  beforeEach(() => resetStore());

  it('returns null for unknown id', () => {
    expect(useStore.getState().duplicateContainer('nonexistent')).toBeNull();
  });

  it('places duplicate at +length-along-X by default', () => {
    const a = useStore.getState().addContainer(
      ContainerSize.HighCube40,
      { x: 0, y: 0, z: 0 },
      0,
      true,
    );
    const beforeCount = Object.keys(useStore.getState().containers).length;
    const b = useStore.getState().duplicateContainer(a);
    expect(b).not.toBeNull();
    expect(b).not.toBe(a);
    expect(Object.keys(useStore.getState().containers).length).toBe(beforeCount + 1);
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    const dup = useStore.getState().containers[b!];
    // Default offset is dims.length + 0.1 but smart-snap may pull it
    // flush to the source; assert it landed in the +X half-space at
    // roughly one container-length away.
    expect(dup.position.x).toBeGreaterThan(dims.length - 0.5);
    expect(dup.position.x).toBeLessThan(dims.length + 0.5);
    expect(dup.position.z).toBeCloseTo(0, 1);
  });

  it('respects custom offset', () => {
    const a = useStore.getState().addContainer(
      ContainerSize.HighCube40,
      { x: 0, y: 0, z: 0 },
      0,
      true,
    );
    const b = useStore.getState().duplicateContainer(a, { x: 50, z: 50 });
    const dup = useStore.getState().containers[b!];
    expect(dup.position.x).toBeCloseTo(50, 1);
    expect(dup.position.z).toBeCloseTo(50, 1);
  });

  it('announces via destructive-toast layer', () => {
    const a = useStore.getState().addContainer(
      ContainerSize.HighCube40,
      { x: 0, y: 0, z: 0 },
      0,
      true,
    );
    useStore.getState().duplicateContainer(a);
    const lda = useStore.getState().lastDestructiveAction;
    expect(lda?.description).toMatch(/Duplicated/);
  });

  it('preserves size and rotation', () => {
    const a = useStore.getState().addContainer(
      ContainerSize.Standard20,
      { x: 0, y: 0, z: 0 },
      0,
      true,
    );
    useStore.getState().updateContainerRotation(a, Math.PI / 2);
    const b = useStore.getState().duplicateContainer(a);
    const dup = useStore.getState().containers[b!];
    expect(dup.size).toBe(ContainerSize.Standard20);
    expect(dup.rotation).toBeCloseTo(Math.PI / 2, 4);
  });
});
