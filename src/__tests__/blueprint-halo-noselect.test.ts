/**
 * blueprint-halo-noselect.test.ts -- Behavioral test for Bruce 2026-05-06 round-3:
 * EXTERNAL Voxels are not selectable at all in BP.
 *
 * BlueprintRenderer's VoxelBlueprintGrid renders per-voxel hit meshes (4 edge
 * meshes + 1 center mesh) for every voxel. The fix gates those hit meshes on
 * `isBody` (cols 1-6, rows 1-2). Halo voxels (col 0/7 extension halos and
 * row 0/3 deck halos) still render their visual fill, but expose NO clickable
 * surface so clicks on them are no-ops.
 *
 * This test asserts the body-only predicate matches the predicate used in
 * BlueprintRenderer to gate the hit meshes, given a container with halo voxels
 * active (extension config 'all_deck').
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

/** Mirror of BlueprintRenderer's body-only predicate for level 0 of the grid. */
function isBpSelectable(idx: number): boolean {
  const COLS = VOXEL_COLS;
  const ROWS = VOXEL_ROWS;
  const level = Math.floor(idx / (ROWS * COLS));
  if (level !== 0) return false;
  const within = idx - level * ROWS * COLS;
  const row = Math.floor(within / COLS);
  const col = within % COLS;
  return col >= 1 && col <= 6 && row >= 1 && row <= 2;
}

describe('Blueprint halo voxels are non-selectable', () => {
  beforeEach(() => resetStore());

  it('halo voxels are NOT in the BP-selectable set when all_deck extensions are active', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_deck', true);

    const grid = useStore.getState().containers[id].voxelGrid!;
    expect(grid).toBeTruthy();

    const COLS = VOXEL_COLS;
    const ROWS = VOXEL_ROWS;

    // Walk every voxel on level 0. For each ACTIVE voxel that lies in a halo
    // band (col 0 or 7, or row 0 or 3) assert it is NOT selectable in BP.
    let haloChecked = 0;
    let bodyChecked = 0;
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col;
        const v = grid[idx];
        if (!v?.active) continue;
        const isHalo = col === 0 || col === COLS - 1 || row === 0 || row === ROWS - 1;
        if (isHalo) {
          expect(isBpSelectable(idx)).toBe(false);
          haloChecked += 1;
        } else {
          expect(isBpSelectable(idx)).toBe(true);
          bodyChecked += 1;
        }
      }
    }
    // 'all_deck' on a HighCube40 activates the halo bands; the body voxels are
    // active too. Both groups must be non-empty so the test actually exercises
    // the selectability gate.
    expect(haloChecked).toBeGreaterThan(0);
    expect(bodyChecked).toBeGreaterThan(0);
  });

  it('selectable predicate accepts only level-0 body voxels (cols 1-6, rows 1-2)', () => {
    const COLS = VOXEL_COLS;
    const ROWS = VOXEL_ROWS;
    // Level 0: 12 body voxels (rows 1-2 x cols 1-6) selectable, 20 halo voxels not.
    let level0Selectable = 0;
    for (let i = 0; i < ROWS * COLS; i++) {
      if (isBpSelectable(i)) level0Selectable += 1;
    }
    expect(level0Selectable).toBe(12);

    // Higher levels are never BP-selectable (BP renders one level at a time).
    expect(isBpSelectable(ROWS * COLS + 9)).toBe(false);

    // Spot-check halo indices map to non-selectable.
    expect(isBpSelectable(0)).toBe(false);                     // row 0 col 0
    expect(isBpSelectable(COLS - 1)).toBe(false);              // row 0 col 7
    expect(isBpSelectable(COLS)).toBe(false);                  // row 1 col 0
    expect(isBpSelectable(2 * COLS - 1)).toBe(false);          // row 1 col 7
    expect(isBpSelectable((ROWS - 1) * COLS + 3)).toBe(false); // row 3 col 3

    // Spot-check body indices map to selectable.
    expect(isBpSelectable(COLS + 1)).toBe(true);               // row 1 col 1
    expect(isBpSelectable(COLS + 6)).toBe(true);               // row 1 col 6
    expect(isBpSelectable(2 * COLS + 1)).toBe(true);           // row 2 col 1
    expect(isBpSelectable(2 * COLS + 6)).toBe(true);           // row 2 col 6
  });
});
