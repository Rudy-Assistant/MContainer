import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { findAdjacentPairs, voxelExtentsOverlap } from '@/store/spatialEngine';
import { ContainerSize, CONTAINER_DIMENSIONS, type Container } from '@/types/container';
import { createContainer } from '@/types/factories';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

/** Build a minimal containers record with two HC40s at specified positions. */
function twoContainersAt(x1: number, x2: number): Record<string, Container> {
  const a = createContainer(ContainerSize.HighCube40, { x: x1, y: 0, z: 0 });
  const b = createContainer(ContainerSize.HighCube40, { x: x2, y: 0, z: 0 });
  return { [a.id]: a, [b.id]: b };
}

describe('ADJACENCY_TOLERANCE', () => {
  beforeEach(() => resetStore());

  it('ADJ-1: detects adjacency at 0.02m gap', () => {
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    const containers = twoContainersAt(0, dims.length + 0.02);
    const pairs = findAdjacentPairs(containers);
    expect(pairs.length).toBeGreaterThanOrEqual(1);
  });

  it('ADJ-2: does NOT detect adjacency at 0.05m gap', () => {
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    const containers = twoContainersAt(0, dims.length + 0.05);
    const pairs = findAdjacentPairs(containers);
    expect(pairs.length).toBe(0);
  });
});

describe('voxelExtentsOverlap', () => {
  it('ADJ-3: returns true when voxel fully inside container extent', () => {
    expect(voxelExtentsOverlap(0, 1.2, -2, 2)).toBe(true);
  });

  it('ADJ-4: returns true when voxel overlaps >50% of its width', () => {
    expect(voxelExtentsOverlap(1.5, 1.2, 0, 2)).toBe(true);
  });

  it('ADJ-5: returns false when voxel overlaps <50% of its width', () => {
    expect(voxelExtentsOverlap(2.5, 1.2, 0, 2)).toBe(false);
  });

  it('ADJ-6: returns false when voxel completely outside extent', () => {
    expect(voxelExtentsOverlap(5, 1.2, 0, 2)).toBe(false);
  });
});
