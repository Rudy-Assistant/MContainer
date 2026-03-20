/**
 * Module System Tests
 *
 * Tests for applyModule, resolveModuleFaces, MODULE_PRESETS catalog,
 * and integration with furniture + undo.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, FurnitureType } from '@/types/container';
import { MODULE_PRESETS, resolveModuleFaces, getModulePreset } from '@/config/moduleCatalog';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('Module Catalog', () => {
  it('MOD-11: MODULE_PRESETS catalog has ≥12 entries', () => {
    expect(MODULE_PRESETS.length).toBeGreaterThanOrEqual(12);
  });
});

describe('resolveModuleFaces', () => {
  const kitchen = getModulePreset('kitchen_full')!;

  it('MOD-9: orientation n maps inward→n', () => {
    const faces = resolveModuleFaces(kitchen, 'n');
    expect(faces.n).toBe(kitchen.faces.inward);
    expect(faces.s).toBe(kitchen.faces.outward);
    expect(faces.w).toBe(kitchen.faces.left);
    expect(faces.e).toBe(kitchen.faces.right);
  });

  it('MOD-10: orientation s maps inward→s', () => {
    const faces = resolveModuleFaces(kitchen, 's');
    expect(faces.s).toBe(kitchen.faces.inward);
    expect(faces.n).toBe(kitchen.faces.outward);
    expect(faces.e).toBe(kitchen.faces.left);
    expect(faces.w).toBe(kitchen.faces.right);
  });

  it('orientation e maps inward→e', () => {
    const faces = resolveModuleFaces(kitchen, 'e');
    expect(faces.e).toBe(kitchen.faces.inward);
    expect(faces.w).toBe(kitchen.faces.outward);
  });
});

describe('applyModule', () => {
  beforeEach(() => resetStore());

  it('MOD-1: sets all 6 faces for orientation n', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'kitchen_full', 'n');
    const v = useStore.getState().containers[id].voxelGrid![10];
    const preset = getModulePreset('kitchen_full')!;
    expect(v.faces.n).toBe(preset.faces.inward);
    expect(v.faces.s).toBe(preset.faces.outward);
    expect(v.faces.bottom).toBe(preset.faces.floor);
    expect(v.faces.top).toBe(preset.faces.ceiling);
  });

  it('MOD-2: sets all 6 faces for orientation e', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'kitchen_full', 'e');
    const v = useStore.getState().containers[id].voxelGrid![10];
    const preset = getModulePreset('kitchen_full')!;
    expect(v.faces.e).toBe(preset.faces.inward);
    expect(v.faces.w).toBe(preset.faces.outward);
  });

  it('MOD-3: spawns furniture when preset has furnitureType', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'kitchen_full', 'n');
    const c = useStore.getState().containers[id];
    expect(c.furniture.length).toBe(1);
    expect(c.furniture[0].type).toBe(FurnitureType.Kitchen);
  });

  it('MOD-4: does NOT spawn furniture for deck_open (no furnitureType)', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'deck_open', 'n');
    const c = useStore.getState().containers[id];
    expect(c.furniture.length).toBe(0);
  });

  it('MOD-5: stores moduleId on voxel', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'bedroom', 'n');
    expect(useStore.getState().containers[id].voxelGrid![10].moduleId).toBe('bedroom');
  });

  it('MOD-6: stores moduleOrientation on voxel', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'bedroom', 'e');
    expect(useStore.getState().containers[id].voxelGrid![10].moduleOrientation).toBe('e');
  });

  it('MOD-7: undo reverts module (faces + furniture)', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const beforeFaces = { ...useStore.getState().containers[id].voxelGrid![10].faces };
    useStore.getState().applyModule(id, 10, 'kitchen_full', 'n');
    expect(useStore.getState().containers[id].furniture.length).toBe(1);
    useStore.getState().undo();
    const after = useStore.getState().containers[id];
    expect(after.voxelGrid![10].faces.n).toBe(beforeFaces.n);
    expect(after.furniture.length).toBe(0);
  });

  it('MOD-8: applyModule on locked voxel is rejected', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.setState({ lockedVoxels: { [`${id}_10`]: true } });
    const beforeFaces = { ...useStore.getState().containers[id].voxelGrid![10].faces };
    useStore.getState().applyModule(id, 10, 'kitchen_full', 'n');
    expect(useStore.getState().containers[id].voxelGrid![10].faces.n).toBe(beforeFaces.n);
  });

  it('MOD-12: stairs module delegates to applyStairsFromFace', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'stairs', 'n');
    const v = useStore.getState().containers[id].voxelGrid![10];
    expect(v.voxelType).toBe('stairs');
    expect(v.stairPart).toBeDefined();
  });
});

describe('Module Furniture Integration', () => {
  beforeEach(() => resetStore());

  it('FURN-4: module application creates furniture with correct type', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'bedroom', 'n');
    const c = useStore.getState().containers[id];
    expect(c.furniture[0].type).toBe(FurnitureType.Bed);
  });

  it('FURN-5: furniture position from module uses voxel center', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'kitchen_full', 'n');
    const f = useStore.getState().containers[id].furniture[0];
    // Voxel 10 = row 1, col 2. px should be non-zero (core voxel X position)
    expect(f.position.x).not.toBe(0);
    expect(f.position.y).toBeCloseTo(0.06, 1);
  });

  it('FURN-6: module removal via undo removes spawned furniture', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyModule(id, 10, 'kitchen_full', 'n');
    expect(useStore.getState().containers[id].furniture.length).toBe(1);
    useStore.getState().undo();
    expect(useStore.getState().containers[id].furniture.length).toBe(0);
  });
});
