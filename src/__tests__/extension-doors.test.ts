/**
 * Extension Auto-Door Tests
 *
 * Tests for smart extension-door auto-placement (Sprint 16, Stream 0).
 * When extensions are activated, body voxels facing extensions should
 * automatically get Door (deck) or Open (interior) faces on Solid_Steel walls.
 *
 * Note: Only level 0 body voxels have Solid_Steel wall faces by default.
 * Level 1 body voxels have Open walls (only top/bottom are steel).
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
import { ContainerSize, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

function getIdx(level: number, row: number, col: number) {
  return level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
}

describe('Extension Auto-Door System', () => {
  beforeEach(() => resetStore());

  it('DOOR-AUTO-1: Activate south deck extension → body row 2 south faces become Door', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'south_deck');
    const grid = useStore.getState().containers[id].voxelGrid!;

    // Level 0 body row 2, cols 1-6: south face should become Door
    for (let col = 1; col <= 6; col++) {
      const idx = getIdx(0, 2, col);
      expect(grid[idx].faces.s).toBe('Door');
    }

    // Level 1 body row 2 walls are Open by default — auto-door doesn't touch them
    for (let col = 1; col <= 6; col++) {
      const idx = getIdx(1, 2, col);
      expect(grid[idx].faces.s).toBe('Open');
    }
  });

  it('DOOR-AUTO-2: Deactivate extension → faces revert to Solid_Steel', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    // Activate south deck
    useStore.getState().setAllExtensions(id, 'south_deck');
    let grid = useStore.getState().containers[id].voxelGrid!;
    expect(grid[getIdx(0, 2, 3)].faces.s).toBe('Door');

    // Deactivate
    useStore.getState().setAllExtensions(id, 'none');
    grid = useStore.getState().containers[id].voxelGrid!;

    // Level 0 faces should revert to Solid_Steel
    for (let col = 1; col <= 6; col++) {
      const idx = getIdx(0, 2, col);
      expect(grid[idx].faces.s).toBe('Solid_Steel');
    }
  });

  it('DOOR-AUTO-3: User-painted Glass face preserved when extension activates', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    // Paint body row 2, col 3 south face to Glass_Pane before extension activation
    const paintIdx = getIdx(0, 2, 3);
    useStore.getState().setVoxelFace(id, paintIdx, 's', 'Glass_Pane');

    // Activate south deck
    useStore.getState().setAllExtensions(id, 'south_deck');
    const grid = useStore.getState().containers[id].voxelGrid!;

    // Glass_Pane should be preserved (not overwritten to Door)
    expect(grid[paintIdx].faces.s).toBe('Glass_Pane');

    // Adjacent unpainted body voxel should still get Door
    expect(grid[getIdx(0, 2, 4)].faces.s).toBe('Door');
  });

  it('DOOR-AUTO-4: Activate all_interior → body-extension boundaries become Open (not Door)', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_interior');
    const grid = useStore.getState().containers[id].voxelGrid!;

    // Level 0: Body row 1 north faces (facing row 0 extensions) → Open
    for (let col = 1; col <= 6; col++) {
      expect(grid[getIdx(0, 1, col)].faces.n).toBe('Open');
    }
    // Level 0: Body row 2 south faces (facing row 3 extensions) → Open
    for (let col = 1; col <= 6; col++) {
      expect(grid[getIdx(0, 2, col)].faces.s).toBe('Open');
    }
    // Level 0: Body col 1 west faces (facing col 0 extensions) → Open
    for (let row = 1; row <= 2; row++) {
      expect(grid[getIdx(0, row, 1)].faces.w).toBe('Open');
    }
    // Level 0: Body col 6 east faces (facing col 7 extensions) → Open
    for (let row = 1; row <= 2; row++) {
      expect(grid[getIdx(0, row, 6)].faces.e).toBe('Open');
    }
  });

  it('DOOR-AUTO-5: _restoreExtensionDoors reverts auto-doors correctly', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    // Activate south deck → auto-door on body row 2
    useStore.getState().setAllExtensions(id, 'south_deck');
    let grid = useStore.getState().containers[id].voxelGrid!;
    expect(grid[getIdx(0, 2, 3)].faces.s).toBe('Door');

    // _preExtensionDoors should be populated
    const container = useStore.getState().containers[id];
    expect(container._preExtensionDoors).toBeDefined();
    expect(Object.keys(container._preExtensionDoors!).length).toBeGreaterThan(0);

    // Manually call restore (same as what 'none' calls internally)
    useStore.getState()._restoreExtensionDoors(id);
    grid = useStore.getState().containers[id].voxelGrid!;

    // Level 0 body faces should revert to Solid_Steel
    expect(grid[getIdx(0, 2, 3)].faces.s).toBe('Solid_Steel');
    expect(grid[getIdx(0, 2, 1)].faces.s).toBe('Solid_Steel');
    expect(grid[getIdx(0, 2, 6)].faces.s).toBe('Solid_Steel');
  });
});
