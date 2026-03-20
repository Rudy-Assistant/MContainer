// src/__tests__/railing-merge.test.ts
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

function addContainer(): string {
  return useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
}

function getVoxel(containerId: string, index: number) {
  return useStore.getState().containers[containerId].voxelGrid![index];
}

describe('Adjacent Railing Merge Verification', () => {
  beforeEach(() => resetStore());

  it('MERGE-1: Two adjacent open-air voxels both get auto-railing on exterior faces', () => {
    const id = addContainer();
    // Make voxels 9 and 10 (row 1, cols 1-2) open-air
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 10, 'top', 'Open');
    const v9 = getVoxel(id, 9);
    const v10 = getVoxel(id, 10);
    // v9 face 'n' → row 0 (inactive extension) → railing
    expect(v9.faces.n).toBe('Railing_Cable');
    // v10 face 'n' → row 0 (inactive extension) → railing
    expect(v10.faces.n).toBe('Railing_Cable');
  });

  it('MERGE-2: Shared face between two adjacent open-air voxels does NOT get railing', () => {
    const id = addContainer();
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 10, 'top', 'Open');
    // Voxel 9 (col 1) and voxel 10 (col 2) are adjacent
    // e: dc=-1 means face 'e' checks col-1 (for voxel 10 that's voxel 9, active)
    // w: dc=+1 means face 'w' checks col+1 (for voxel 9 that's voxel 10, active)
    // Shared faces should NOT have railing
    const v9 = getVoxel(id, 9);
    const v10 = getVoxel(id, 10);
    expect(v9.faces.w).not.toMatch(/^Railing_/);
    expect(v10.faces.e).not.toMatch(/^Railing_/);
  });

  it('MERGE-3: Mixed railing types preserve separate identity', () => {
    const id = addContainer();
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 10, 'top', 'Open');
    // Manually paint voxel 10's north face to Glass railing
    useStore.getState().setVoxelFace(id, 10, 'n', 'Railing_Glass');
    expect(getVoxel(id, 9).faces.n).toBe('Railing_Cable');
    expect(getVoxel(id, 10).faces.n).toBe('Railing_Glass');
  });

  it('MERGE-4: Auto-railing respects bay group boundaries', () => {
    const id = addContainer();
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 10, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 11, 'top', 'Open');
    for (const idx of [9, 10, 11]) {
      const v = getVoxel(id, idx);
      expect(v.faces.n).toBe('Railing_Cable');
    }
  });
});
