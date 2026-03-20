/**
 * Bulk Extension Tests
 *
 * Tests for setAllExtensions store action.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS, VOXEL_ROWS, VOXEL_LEVELS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

const isExtension = (row: number, col: number) =>
  row === 0 || row === 3 || col === 0 || col === 7;

describe('setAllExtensions', () => {
  beforeEach(() => resetStore());

  it('EXT-1: all_deck configures all extension voxels with deck_open', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_deck');
    const grid = useStore.getState().containers[id].voxelGrid!;

    let deckCount = 0;
    for (let level = 0; level < VOXEL_LEVELS; level++) {
      for (let row = 0; row < VOXEL_ROWS; row++) {
        for (let col = 0; col < VOXEL_COLS; col++) {
          if (!isExtension(row, col)) continue;
          const idx = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
          if (grid[idx].active && grid[idx].moduleId === 'deck_open') deckCount++;
        }
      }
    }
    // Should have multiple deck voxels (at least 20 extension positions × 2 levels)
    expect(deckCount).toBeGreaterThanOrEqual(20);
  });

  it('EXT-2: all_interior expands floor area with matching faces', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_interior');
    const grid = useStore.getState().containers[id].voxelGrid!;

    // Row 0, col 3 (extension) — should be active with interior faces
    const idx = 0 * VOXEL_COLS + 3;
    expect(grid[idx].active).toBe(true);
    expect(grid[idx].faces.bottom).toBe('Deck_Wood');
    expect(grid[idx].faces.n).toBe('Solid_Steel'); // row 0 → north is outward
  });

  it('EXT-3: none resets all extensions to inactive', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    // First activate extensions
    useStore.getState().setAllExtensions(id, 'all_deck');
    // Then reset
    useStore.getState().setAllExtensions(id, 'none');
    const grid = useStore.getState().containers[id].voxelGrid!;

    for (let level = 0; level < VOXEL_LEVELS; level++) {
      for (let row = 0; row < VOXEL_ROWS; row++) {
        for (let col = 0; col < VOXEL_COLS; col++) {
          if (!isExtension(row, col)) continue;
          const idx = level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
          expect(grid[idx].active).toBe(false);
        }
      }
    }
  });

  it('EXT-4: north_deck only affects row 0', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'north_deck');
    const grid = useStore.getState().containers[id].voxelGrid!;

    // Row 0 extension (col 3) should be active deck
    const northIdx = 0 * VOXEL_COLS + 3;
    expect(grid[northIdx].active).toBe(true);
    expect(grid[northIdx].moduleId).toBe('deck_open');

    // Row 3 extension (col 3) should still be inactive
    const southIdx = 3 * VOXEL_COLS + 3;
    expect(grid[southIdx].active).toBe(false);
  });

  it('EXT-5: setAllExtensions is atomic undo', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_deck');
    const deckGrid = useStore.getState().containers[id].voxelGrid!;
    expect(deckGrid[3].active).toBe(true); // row 0, col 3

    useStore.getState().undo();
    const after = useStore.getState().containers[id];
    if (after) {
      // Extensions should be back to inactive
      expect(after.voxelGrid![3].active).toBe(false);
    }
  });

  it('EXT-6: extension config auto-doors body boundary faces but preserves moduleId', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const bodyIdx = 1 * VOXEL_COLS + 3; // row 1, col 3 (body, faces north extension)

    useStore.getState().setAllExtensions(id, 'all_deck');
    const gridAfter = useStore.getState().containers[id].voxelGrid!;
    // Auto-door: body row 1 north face becomes Door (was Solid_Steel, now facing active deck)
    expect(gridAfter[bodyIdx].faces.n).toBe('Door');
    // South face (interior, not facing extension) unchanged
    expect(gridAfter[bodyIdx].faces.s).toBe('Solid_Steel');
    // Body voxel moduleId should NOT be set by extension activation
    expect(gridAfter[bodyIdx].moduleId).toBeUndefined();
  });
});
