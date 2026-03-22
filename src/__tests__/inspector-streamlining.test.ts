import { describe, it, expect, beforeEach } from 'vitest';
import { isFrameTranslucent } from '@/components/three/ContainerMesh';
import { useStore } from '@/store/useStore';
import { createDefaultVoxelGrid } from '@/types/factories';
import type { SurfaceType } from '@/types/container';
import { resolvedFaceMaterial } from '@/components/ui/FaceStrip';

const resetStore = () => useStore.setState(useStore.getInitialState(), true);

describe('isFrameTranslucent', () => {
  it('full mode → opaque', () => {
    expect(isFrameTranslucent('full', 1.0)).toBe(false);
  });

  it('half mode → translucent', () => {
    expect(isFrameTranslucent('half', 1.0)).toBe(true);
  });

  it('down mode → translucent', () => {
    expect(isFrameTranslucent('down', 1.0)).toBe(true);
  });

  it('custom with wallCutHeight=1.0 → opaque', () => {
    expect(isFrameTranslucent('custom', 1.0)).toBe(false);
  });

  it('custom with wallCutHeight=0.5 → translucent', () => {
    expect(isFrameTranslucent('custom', 0.5)).toBe(true);
  });
});

describe('Global hideRoof / hideSkin store', () => {
  beforeEach(resetStore);

  it('hideRoof defaults to false', () => {
    expect(useStore.getState().hideRoof).toBe(false);
  });

  it('hideSkin defaults to false', () => {
    expect(useStore.getState().hideSkin).toBe(false);
  });

  it('toggleHideRoof flips the value', () => {
    useStore.getState().toggleHideRoof();
    expect(useStore.getState().hideRoof).toBe(true);
    useStore.getState().toggleHideRoof();
    expect(useStore.getState().hideRoof).toBe(false);
  });

  it('toggleHideSkin flips the value', () => {
    useStore.getState().toggleHideSkin();
    expect(useStore.getState().hideSkin).toBe(true);
    useStore.getState().toggleHideSkin();
    expect(useStore.getState().hideSkin).toBe(false);
  });
});

describe('FaceStrip logic: resolvedFaceMaterial', () => {
  // Voxel grid layout: 4 rows × 8 cols per level.
  // Core (active) cells: row 1-2, col 1-6. Index = level*32 + row*8 + col.
  // Index 9  = level 0, row 1, col 1 → active core, Deck_Wood bottom
  // Index 10 = level 0, row 1, col 2 → active core, Deck_Wood bottom
  // Index 11 = level 0, row 1, col 3 → active core, Deck_Wood bottom

  it('single active voxel returns exact material', () => {
    const grid = createDefaultVoxelGrid();
    const mat = resolvedFaceMaterial(grid, [9], 'bottom');
    expect(mat).toBe('Deck_Wood');
  });

  it('multiple voxels with same face return that material', () => {
    const grid = createDefaultVoxelGrid();
    const mat = resolvedFaceMaterial(grid, [9, 10, 11], 'bottom');
    expect(mat).toBe('Deck_Wood');
  });

  it('multiple voxels with different faces return null (Mix)', () => {
    const grid = createDefaultVoxelGrid();
    grid[9] = { ...grid[9], faces: { ...grid[9].faces, bottom: 'Concrete' as SurfaceType } };
    const mat = resolvedFaceMaterial(grid, [9, 10], 'bottom');
    expect(mat).toBeNull();
  });

  it('inactive voxels are skipped', () => {
    const grid = createDefaultVoxelGrid();
    grid[9] = { ...grid[9], active: false };
    const mat = resolvedFaceMaterial(grid, [9], 'bottom');
    expect(mat).toBeNull();
  });

  it('empty indices returns null', () => {
    const grid = createDefaultVoxelGrid();
    const mat = resolvedFaceMaterial(grid, [], 'bottom');
    expect(mat).toBeNull();
  });
});
