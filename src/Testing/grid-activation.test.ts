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

  it('setAllExtensions("none") sets reverse phase, then deactivates after clearUnpackPhase', () => {
    const s = useStore.getState();
    s.setAllExtensions(containerId, 'all_deck');
    s.setAllExtensions(containerId, 'none');
    const extIndices = [0,1,2,3,4,5,6,7, 8, 15, 16, 23, 24,25,26,27,28,29,30,31];
    // Voxels stay active during reverse animation
    const grid1 = useStore.getState().containers[containerId].voxelGrid!;
    for (const i of extIndices) {
      if (grid1[i].unpackPhase === 'reverse') expect(grid1[i].active).toBe(true);
    }
    // Simulate animation completion
    for (const i of extIndices) {
      useStore.getState().clearUnpackPhase(containerId, i);
    }
    const grid2 = useStore.getState().containers[containerId].voxelGrid!;
    for (const i of extIndices) {
      expect(grid2[i].active).toBe(false);
    }
  });
});

describe('Grid context menu actions', () => {
  let containerId: string;

  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
    containerId = useStore.getState().addContainer(ContainerSize.HighCube40);
  });

  it('setVoxelAllFaces paints all 6 faces of a voxel', () => {
    const s = useStore.getState();
    s.setVoxelActive(containerId, 0, true);
    s.setVoxelAllFaces(containerId, 0, 'Glass_Pane');
    const v = useStore.getState().containers[containerId]!.voxelGrid![0]!;
    expect(v.faces.n).toBe('Glass_Pane');
    expect(v.faces.s).toBe('Glass_Pane');
    expect(v.faces.e).toBe('Glass_Pane');
    expect(v.faces.w).toBe('Glass_Pane');
    expect(v.faces.top).toBe('Glass_Pane');
    expect(v.faces.bottom).toBe('Glass_Pane');
  });

  it('copyVoxel + pasteVoxel applies source faces to target', () => {
    const s = useStore.getState();
    s.setVoxelFace(containerId, 9, 'n', 'Glass_Pane');
    s.copyVoxel(containerId, 9);
    s.pasteVoxel(containerId, 10);
    const target = useStore.getState().containers[containerId]!.voxelGrid![10]!;
    expect(target.faces.n).toBe('Glass_Pane');
  });
});
