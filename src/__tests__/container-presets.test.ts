/**
 * Container Preset Tests
 *
 * Tests for applyContainerPreset, addContainerWithPreset,
 * and CONTAINER_PRESETS catalog.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import { CONTAINER_PRESETS, getContainerPreset } from '@/config/containerPresets';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('Container Presets Catalog', () => {
  it('CPRE-7: CONTAINER_PRESETS has ≥8 entries', () => {
    expect(CONTAINER_PRESETS.length).toBeGreaterThanOrEqual(8);
  });
});

describe('applyContainerPreset', () => {
  beforeEach(() => resetStore());

  it('CPRE-1: applies all module voxels', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerPreset(id, 'studio_apartment');
    const c = useStore.getState().containers[id];
    const preset = getContainerPreset('studio_apartment')!;
    // Check each voxel has the moduleId set
    for (const v of preset.voxels) {
      expect(c.voxelGrid![v.voxelIndex].moduleId).toBe(v.moduleId);
    }
  });

  it('CPRE-2: applyContainerPreset is atomic — undo reverts all modules at once', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    // Apply preset — sets multiple voxel modules + furniture
    useStore.getState().applyContainerPreset(id, 'studio_apartment');
    expect(useStore.getState().containers[id].voxelGrid![9].moduleId).toBe('kitchen_full');
    expect(useStore.getState().containers[id].voxelGrid![13].moduleId).toBe('bathroom_full');
    expect(useStore.getState().containers[id].furniture.length).toBeGreaterThan(0);

    // Single undo should revert ALL module assignments atomically (not one at a time)
    useStore.getState().undo();

    // After undo, either the preset is fully reverted or the container is gone
    // (temporal batching may merge with addContainer). Either way, no partial state.
    const after = useStore.getState().containers[id];
    if (after) {
      // If container still exists, ALL modules should be cleared (not just some)
      expect(after.voxelGrid![9].moduleId).toBeUndefined();
      expect(after.voxelGrid![13].moduleId).toBeUndefined();
      expect(after.furniture.length).toBe(0);
    }
    // If container is undefined, the entire addContainer+preset was one undo step — also valid
  });

  it('CPRE-3: stores presetId on container', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerPreset(id, 'studio_apartment');
    expect(useStore.getState().containers[id].appliedPreset).toBe('studio_apartment');
  });

  it('CPRE-5: invalid presetId is rejected gracefully', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const before = { ...useStore.getState().containers[id].voxelGrid![9].faces };
    useStore.getState().applyContainerPreset(id, 'nonexistent_preset');
    // Should not crash, faces unchanged
    expect(useStore.getState().containers[id].voxelGrid![9].faces.n).toBe(before.n);
  });

  it('CPRE-6: container size mismatch handled (no crash)', () => {
    // Add a 20ft container and try to apply a 40ft preset — should not crash
    const id = useStore.getState().addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: 0 });
    expect(() => {
      useStore.getState().applyContainerPreset(id, 'studio_apartment');
    }).not.toThrow();
  });

  it('CPRE-8: studio_apartment preset configures expected voxels', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerPreset(id, 'studio_apartment');
    const grid = useStore.getState().containers[id].voxelGrid!;
    // Voxel 9 should be kitchen
    expect(grid[9].moduleId).toBe('kitchen_full');
    // Voxel 13 should be bathroom
    expect(grid[13].moduleId).toBe('bathroom_full');
    // Voxel 12 should be bedroom
    expect(grid[12].moduleId).toBe('bedroom');
  });

  it('CPRE-9: deck_house preset configures extension voxels', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerPreset(id, 'deck_house');
    const grid = useStore.getState().containers[id].voxelGrid!;
    // Extension row 0: voxels 1-6 should be deck_open
    expect(grid[1].moduleId).toBe('deck_open');
    expect(grid[6].moduleId).toBe('deck_open');
    // Extension row 3: voxels 25-30 should be balcony
    expect(grid[25].moduleId).toBe('balcony');
    expect(grid[30].moduleId).toBe('balcony');
  });

  it('CPRE-10: empty_steel preset leaves default faces', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    // First apply a preset
    useStore.getState().applyContainerPreset(id, 'studio_apartment');
    // Then apply empty_steel to reset
    useStore.getState().applyContainerPreset(id, 'empty_steel');
    const grid = useStore.getState().containers[id].voxelGrid!;
    // Body voxel 9 should be default (Solid_Steel walls)
    expect(grid[9].faces.n).toBe('Solid_Steel');
    expect(grid[9].moduleId).toBeUndefined();
    expect(useStore.getState().containers[id].furniture.length).toBe(0);
  });
});

describe('addContainerWithPreset', () => {
  beforeEach(() => resetStore());

  it('CPRE-4: creates container + applies preset', () => {
    const id = useStore.getState().addContainerWithPreset(
      ContainerSize.HighCube40,
      { x: 0, y: 0, z: 0 },
      'one_bedroom'
    );
    const c = useStore.getState().containers[id];
    expect(c).toBeDefined();
    expect(c.appliedPreset).toBe('one_bedroom');
    // Should have modules applied
    expect(c.voxelGrid![9].moduleId).toBe('bedroom');
    // Should have furniture
    expect(c.furniture.length).toBeGreaterThan(0);
  });
});

describe('UI Integration — Module/Hotbar Mutual Exclusion', () => {
  beforeEach(() => resetStore());

  it('UI-1: activeModulePreset and activeHotbarSlot are mutually exclusive', () => {
    useStore.getState().setActiveHotbarSlot(0);
    expect(useStore.getState().activeHotbarSlot).toBe(0);
    useStore.getState().setActiveModulePreset('kitchen_full');
    expect(useStore.getState().activeModulePreset).toBe('kitchen_full');
    expect(useStore.getState().activeHotbarSlot).toBeNull();
  });

  it('UI-2: rotateModuleOrientation cycles n→e→s→w→n', () => {
    expect(useStore.getState().moduleOrientation).toBe('n');
    useStore.getState().rotateModuleOrientation();
    expect(useStore.getState().moduleOrientation).toBe('e');
    useStore.getState().rotateModuleOrientation();
    expect(useStore.getState().moduleOrientation).toBe('s');
    useStore.getState().rotateModuleOrientation();
    expect(useStore.getState().moduleOrientation).toBe('w');
    useStore.getState().rotateModuleOrientation();
    expect(useStore.getState().moduleOrientation).toBe('n');
  });

  it('UI-3: selecting module clears hotbar slot', () => {
    useStore.getState().setActiveHotbarSlot(3);
    useStore.getState().setActiveModulePreset('bedroom');
    expect(useStore.getState().activeHotbarSlot).toBeNull();
    expect(useStore.getState().activeModulePreset).toBe('bedroom');
  });

  it('UI-4: selecting hotbar slot clears module preset', () => {
    useStore.getState().setActiveModulePreset('kitchen_full');
    useStore.getState().setActiveHotbarSlot(2);
    expect(useStore.getState().activeModulePreset).toBeNull();
    expect(useStore.getState().activeHotbarSlot).toBe(2);
  });

  it('UI-5: moduleOrientation defaults to n', () => {
    expect(useStore.getState().moduleOrientation).toBe('n');
  });
});
