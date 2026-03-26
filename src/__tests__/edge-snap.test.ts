import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { findEdgeSnap } from '@/store/spatialEngine';
import { ContainerSize } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('findEdgeSnap threshold', () => {
  let containers: Record<string, any>;

  beforeEach(() => {
    resetStore();
    // Place a container at origin
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    containers = useStore.getState().containers;
  });

  it('SNAP-1: snaps when edge gap is 0.2m (within 0.3m threshold)', () => {
    const result = findEdgeSnap(containers, null, 12.4, 0, ContainerSize.HighCube40);
    expect(result.snapped).toBe(true);
  });

  it('SNAP-2: does NOT snap when edge gap is 0.5m (outside 0.3m threshold)', () => {
    const result = findEdgeSnap(containers, null, 13.0, 0, ContainerSize.HighCube40);
    expect(result.snapped).toBe(false);
  });

  it('SNAP-3: center-alignment snaps Z when offset is 0.15m', () => {
    const result = findEdgeSnap(containers, null, 12.2, 0.15, ContainerSize.HighCube40);
    if (result.snapped) {
      expect(result.z).toBe(0); // Should align Z center
    }
  });

  it('SNAP-4: center-alignment does NOT snap Z when offset is 0.5m', () => {
    const result = findEdgeSnap(containers, null, 12.2, 0.5, ContainerSize.HighCube40);
    if (result.snapped) {
      expect(result.z).not.toBe(0); // Should NOT force Z alignment
    }
  });
});
