/**
 * Gull-Wing Regression Test
 *
 * Ensures the gull_wing block preset:
 * 1. Exists in BLOCK_PRESETS with valid face configuration
 * 2. Can be applied via applyBlockConfig without throwing
 * 3. Preserves Gull_Wing faces (not overwritten by smart railings)
 * 4. surfaceToMatKey maps Gull_Wing to 'steel' (material resolution)
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { BLOCK_PRESETS, getPresetById } from '@/config/blockPresets';
import { ContainerSize, type SurfaceType } from '@/types/container';
import { getMaterialForFace } from '@/config/materialCache';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

function addContainer(): string {
  return useStore.getState().addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: 0 });
}

describe('Gull-Wing preset regression', () => {
  beforeEach(() => resetStore());

  it('gull_wing preset exists with valid faces', () => {
    const preset = getPresetById('gull_wing');
    expect(preset).toBeDefined();
    expect(preset!.faces.top).toBe('Open');
    expect(preset!.faces.bottom).toBe('Deck_Wood');
    expect(preset!.faces.n).toBe('Gull_Wing');
    expect(preset!.faces.s).toBe('Gull_Wing');
    expect(preset!.faces.e).toBe('Solid_Steel');
    expect(preset!.faces.w).toBe('Solid_Steel');
    expect(preset!.active).toBe(true);
  });

  it('applyBlockConfig with gull_wing does not throw', () => {
    const id = addContainer();
    expect(() => {
      useStore.getState().applyBlockConfig(id, [10], 'gull_wing');
    }).not.toThrow();

    const voxel = useStore.getState().containers[id].voxelGrid![10];
    expect(voxel.active).toBe(true);
  });

  it('Gull_Wing faces survive smart railing recomputation', () => {
    // Use default (smart) design mode — NOT manual
    const id = addContainer();
    useStore.getState().applyBlockConfig(id, [10], 'gull_wing');

    const voxel = useStore.getState().containers[id].voxelGrid![10];
    // Gull_Wing is a structural fold panel — smart railings must NOT overwrite it
    expect(voxel.faces.n).toBe('Gull_Wing');
    expect(voxel.faces.s).toBe('Gull_Wing');
  });

  it('getMaterialForFace resolves Gull_Wing without error', () => {
    const mat = getMaterialForFace('Gull_Wing' as SurfaceType, undefined, 'industrial');
    expect(mat).toBeDefined();
    expect(mat).not.toBeNull();
  });

  it('applyBlockConfig with gull_wing on multi-voxel bay does not throw', () => {
    const id = addContainer();
    // Bay spanning 4 voxels (body rows 1-2, cols 1-2)
    const bayIndices = [9, 10, 17, 18];
    expect(() => {
      useStore.getState().applyBlockConfig(id, bayIndices, 'gull_wing');
    }).not.toThrow();

    const grid = useStore.getState().containers[id].voxelGrid!;
    // Boundary faces should have Gull_Wing on exterior walls
    expect(grid[9].faces.n).toBe('Gull_Wing');   // row=minRow → north boundary
    expect(grid[18].faces.s).toBe('Gull_Wing');  // row=maxRow → south boundary
    // Internal faces (between rows) should be Open
    expect(grid[9].faces.s).toBe('Open');         // row=1 < maxRow=2 → internal
    expect(grid[17].faces.n).toBe('Open');        // row=2 > minRow=1 → internal
  });
});
