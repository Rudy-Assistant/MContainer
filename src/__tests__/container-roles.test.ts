/**
 * Container Role Tests
 *
 * Tests for applyContainerRole, CONTAINER_ROLES catalog.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); }),
    del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  };
});

import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS, VOXEL_ROWS, VOXEL_LEVELS } from '@/types/container';
import { CONTAINER_ROLES, getContainerRole } from '@/config/containerRoles';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('Container Roles Catalog', () => {
  it('ROLE-8: CONTAINER_ROLES has >= 9 entries', () => {
    expect(CONTAINER_ROLES.length).toBeGreaterThanOrEqual(9);
  });
});

describe('applyContainerRole', () => {
  beforeEach(() => resetStore());

  it('ROLE-1: sets all body voxels to role body module', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerRole(id, 'bedroom');
    const grid = useStore.getState().containers[id].voxelGrid!;
    // Check all body voxels (rows 1-2, cols 1-6) on both levels
    for (let level = 0; level < VOXEL_LEVELS; level++) {
      for (let row = 1; row <= 2; row++) {
        for (let col = 1; col <= 6; col++) {
          const idx = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
          expect(grid[idx].moduleId).toBe('bedroom');
        }
      }
    }
  });

  it('ROLE-2: configures extensions per role (deck_patio = all_deck)', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerRole(id, 'deck_patio');
    const grid = useStore.getState().containers[id].voxelGrid!;
    // Extension voxels should be active with deck_open module
    // Row 0, col 1 (extension)
    const extIdx = 0 * VOXEL_COLS + 1; // row 0, col 1
    expect(grid[extIdx].active).toBe(true);
    expect(grid[extIdx].moduleId).toBe('deck_open');
  });

  it('ROLE-3: applies wall overrides', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerRole(id, 'kitchen');
    const grid = useStore.getState().containers[id].voxelGrid!;
    const role = getContainerRole('kitchen')!;
    // Row 1 (north-facing body row) should have Glass_Pane on north face
    const northBodyIdx = 1 * VOXEL_COLS + 3; // row 1, col 3
    expect(grid[northBodyIdx].faces.n).toBe(role.wallOverrides!.n);
  });

  it('ROLE-4: atomic undo — undo reverts all role changes', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerRole(id, 'kitchen');
    expect(useStore.getState().containers[id].appliedRole).toBe('kitchen');

    useStore.getState().undo();
    const after = useStore.getState().containers[id];
    if (after) {
      // If container exists, role should be cleared
      expect(after.appliedRole).toBeUndefined();
      // Body voxels should not have kitchen module
      const bodyIdx = 1 * VOXEL_COLS + 3;
      expect(after.voxelGrid![bodyIdx].moduleId).toBeUndefined();
    }
    // If container is undefined, entire add+role was one undo step — also valid
  });

  it('ROLE-5: stores roleId on container', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerRole(id, 'living_room');
    expect(useStore.getState().containers[id].appliedRole).toBe('living_room');
  });

  it('ROLE-6: switching role reconfigures everything', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerRole(id, 'bedroom');
    expect(useStore.getState().containers[id].voxelGrid![9].moduleId).toBe('bedroom');

    useStore.getState().applyContainerRole(id, 'kitchen');
    expect(useStore.getState().containers[id].voxelGrid![9].moduleId).toBe('kitchen_full');
    expect(useStore.getState().containers[id].appliedRole).toBe('kitchen');
  });

  it('ROLE-7: hallway role opens long walls', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().applyContainerRole(id, 'hallway');
    const grid = useStore.getState().containers[id].voxelGrid!;
    // Row 1 north face should be Open
    const northBodyIdx = 1 * VOXEL_COLS + 3;
    expect(grid[northBodyIdx].faces.n).toBe('Open');
    // Row 2 south face should be Open
    const southBodyIdx = 2 * VOXEL_COLS + 3;
    expect(grid[southBodyIdx].faces.s).toBe('Open');
  });
});
