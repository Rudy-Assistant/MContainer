import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { computeGlobalCulling } from '@/store/spatialEngine';
import {
  ContainerSize,
  VOXEL_COLS,
  VOXEL_ROWS,
  WallSide,
  isVoxelFaceProtected,
} from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  useStore.temporal.getState().clear();
}

function addContainer(): string {
  return useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
}

function idx(level: number, row: number, col: number) {
  return level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
}

describe('Voxel preset-protected faces', () => {
  beforeEach(() => resetStore());

  it('setVoxelFacePreset protects a face without marking user paint or lastStamp', () => {
    const id = addContainer();
    useStore.getState().setVoxelFace(id, 9, 'n', 'Glass_Pane');
    const savedLastStamp = useStore.getState().lastStamp;

    useStore.getState().setVoxelFacePreset(id, 10, 's', 'Open');

    const voxel = useStore.getState().containers[id].voxelGrid![10];
    expect(voxel.faces.s).toBe('Open');
    expect(voxel.userPaintedFaces?.s).toBeFalsy();
    expect(voxel.presetProtectedFaces?.s).toBe(true);
    expect(isVoxelFaceProtected(voxel, 's')).toBe(true);
    expect(useStore.getState().lastStamp).toEqual(savedLastStamp);
  });

  it('setVoxelFacePreset still creates smart door config for preset doors', () => {
    const id = addContainer();

    useStore.getState().setVoxelFacePreset(id, 9, 'n', 'Door');

    const voxel = useStore.getState().containers[id].voxelGrid![9];
    expect(voxel.faces.n).toBe('Door');
    expect(voxel.doorConfig?.n).toBeDefined();
    expect(voxel.userPaintedFaces?.n).toBeFalsy();
    expect(voxel.presetProtectedFaces?.n).toBe(true);
    expect(useStore.getState().lastStamp).toBeNull();
  });

  it('smart railing preserves preset-protected fall-hazard faces', () => {
    const id = addContainer();

    useStore.getState().setVoxelFacePreset(id, 9, 'e', 'Glass_Pane');
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');

    const voxel = useStore.getState().containers[id].voxelGrid![9];
    expect(voxel.faces.e).toBe('Glass_Pane');
    expect(voxel.presetProtectedFaces?.e).toBe(true);
  });

  it('extension auto-doors preserve preset-protected solid faces', () => {
    const id = addContainer();
    const protectedIdx = idx(0, 2, 3);

    useStore.getState().setVoxelFacePreset(id, protectedIdx, 's', 'Solid_Steel');
    useStore.getState().setAllExtensions(id, 'south_deck');

    const grid = useStore.getState().containers[id].voxelGrid!;
    expect(grid[protectedIdx].faces.s).toBe('Solid_Steel');
    expect(grid[protectedIdx].presetProtectedFaces?.s).toBe(true);
    expect(grid[idx(0, 2, 4)].faces.s).toBe('Door');
  });

  it('global adjacency culling preserves preset-protected shared faces', () => {
    const idA = addContainer();
    const idB = addContainer();
    const protectedIdx = idx(0, 1, 1);
    const neighborIdx = idx(0, 2, 1);

    useStore.getState().setVoxelFacePreset(idA, protectedIdx, 'n', 'Solid_Steel');

    const cullSet = computeGlobalCulling(useStore.getState().containers, [
      { containerA: idA, containerB: idB, sideA: WallSide.Left, sideB: WallSide.Right },
    ]);

    expect(cullSet.has(`${idA}:${protectedIdx}:n`)).toBe(false);
    expect(cullSet.has(`${idB}:${neighborIdx}:s`)).toBe(true);
  });
});
