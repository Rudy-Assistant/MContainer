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

describe('Deploy All Extensions', () => {
  let containerId: string;

  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
    containerId = useStore.getState().addContainer(ContainerSize.HighCube40);
  });

  it('setAllExtensions("all_deck") activates all 20 extension voxels on L0', () => {
    const s = useStore.getState();
    s.setAllExtensions(containerId, 'all_deck');
    const grid = useStore.getState().containers[containerId].voxelGrid!;
    const extIndices = [0,1,2,3,4,5,6,7, 8, 15, 16, 23, 24,25,26,27,28,29,30,31];
    for (const i of extIndices) {
      expect(grid[i].active).toBe(true);
    }
  });

  it('setAllExtensions("none") deactivates all extension voxels', () => {
    const s = useStore.getState();
    s.setAllExtensions(containerId, 'all_deck');
    s.setAllExtensions(containerId, 'none');
    const grid = useStore.getState().containers[containerId].voxelGrid!;
    const extIndices = [0,1,2,3,4,5,6,7, 8, 15, 16, 23, 24,25,26,27,28,29,30,31];
    for (const i of extIndices) {
      expect(grid[i].active).toBe(false);
    }
  });
});
