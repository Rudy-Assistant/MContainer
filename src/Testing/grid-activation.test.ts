import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

describe('Grid cell activation', () => {
  let containerId: string;

  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
    containerId = useStore.getState().addContainer(ContainerSize.HighCube40);
  });

  it('setVoxelActive activates an inactive extension voxel', () => {
    const grid = useStore.getState().containers[containerId].voxelGrid!;
    expect(grid[0].active).toBe(false);
    useStore.getState().setVoxelActive(containerId, 0, true);
    const updated = useStore.getState().containers[containerId].voxelGrid!;
    expect(updated[0].active).toBe(true);
  });

  it('setVoxelActive deactivates an active body voxel', () => {
    const grid = useStore.getState().containers[containerId].voxelGrid!;
    expect(grid[9].active).toBe(true);
    useStore.getState().setVoxelActive(containerId, 9, false);
    const updated = useStore.getState().containers[containerId].voxelGrid!;
    expect(updated[9].active).toBe(false);
  });
});
