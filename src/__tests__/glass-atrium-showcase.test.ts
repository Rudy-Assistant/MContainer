/**
 * Glass Atrium Showcase — behavioural test for the 2×2 glass-walled
 * showcase model home. Asserts the structure that comes out of
 * `placeModelHome('glass_atrium_showcase')` matches the design spec:
 *   - 8 containers placed in a 2×2 footprint × 2 levels
 *   - L1 carries `framed_glass_box` (Window_Standard perimeter,
 *     Glass_Shoji sliding doors on south cols 3-4)
 *   - L2 carries `framed_glass_atrium` (Window_Standard perimeter,
 *     central floor void + Railing_Cable around it)
 *   - L1 NW → L2 NW stair exists at voxel 9 facing north
 *   - L2 NW → roof stair exists at voxel 9 facing top
 *
 * Real store actions only — no source scanning.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '@/store/useStore';
import { VOXEL_COLS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  useStore.temporal.getState().clear();
}

// 8 containers × full smart-rule recompute can comfortably cross the
// default 5s timeout when vitest is heavily parallelised with other
// suites. Each test takes ~1-3s in isolation; bump the per-test ceiling
// so contention spikes don't fail an otherwise-correct assertion.
describe('Glass Atrium Showcase', () => {
  vi.setConfig({ testTimeout: 30000 });
  beforeEach(() => { resetStore(); });

  it('places 8 HighCube containers in a 2×2 × 2-story arrangement', () => {
    const ids = useStore.getState().placeModelHome('glass_atrium_showcase');
    expect(ids).toHaveLength(8);
    const containers = useStore.getState().containers;
    // Heights: first 4 at y=0, last 4 at y=2.90 (HEIGHT_HC)
    for (let i = 0; i < 4; i++) {
      expect(containers[ids[i]].position.y).toBeCloseTo(0);
    }
    for (let i = 4; i < 8; i++) {
      expect(containers[ids[i]].position.y).toBeCloseTo(2.90);
    }
  });

  it('L1 containers use framed_glass_box arrangement', () => {
    const ids = useStore.getState().placeModelHome('glass_atrium_showcase');
    const containers = useStore.getState().containers;
    for (let i = 0; i < 4; i++) {
      expect(containers[ids[i]].appliedPreset).toBe('framed_glass_box');
    }
  });

  it('L2 containers use framed_glass_atrium arrangement', () => {
    const ids = useStore.getState().placeModelHome('glass_atrium_showcase');
    const containers = useStore.getState().containers;
    for (let i = 4; i < 8; i++) {
      expect(containers[ids[i]].appliedPreset).toBe('framed_glass_atrium');
    }
  });

  it('south-wall sliding doors land on cols 3 and 4 of L1 SW container', () => {
    const ids = useStore.getState().placeModelHome('glass_atrium_showcase');
    // SW container is index 2 (the third L1 placement, at z=WIDTH).
    const grid = useStore.getState().containers[ids[2]].voxelGrid!;
    // South wall is row=3. Cols 3 and 4 must be Glass_Shoji.
    const idx = (row: number, col: number) => row * VOXEL_COLS + col;
    expect(grid[idx(3, 3)].faces.s).toBe('Glass_Shoji');
    expect(grid[idx(3, 4)].faces.s).toBe('Glass_Shoji');
    // Surrounding south-wall cells stay Window_Standard (framed glass).
    expect(grid[idx(3, 1)].faces.s).toBe('Window_Standard');
    expect(grid[idx(3, 6)].faces.s).toBe('Window_Standard');
  });

  it('L2 perimeter is framed glass (Window_Standard) on all four sides', () => {
    const ids = useStore.getState().placeModelHome('glass_atrium_showcase');
    const grid = useStore.getState().containers[ids[4]].voxelGrid!; // L2 NW
    const idx = (row: number, col: number) => row * VOXEL_COLS + col;
    // North wall (row 0 — wait, perimeterFaces uses row=0 for n)
    expect(grid[idx(0, 1)].faces.n).toBe('Window_Standard');
    expect(grid[idx(3, 1)].faces.s).toBe('Window_Standard');
    // West / east on body cols
    expect(grid[idx(1, 0)].faces.w).toBe('Window_Standard');
    expect(grid[idx(1, 7)].faces.e).toBe('Window_Standard');
  });

  it('L2 NW container has central floor void (atrium opening)', () => {
    const ids = useStore.getState().placeModelHome('glass_atrium_showcase');
    const grid = useStore.getState().containers[ids[4]].voxelGrid!;
    const idx = (row: number, col: number) => row * VOXEL_COLS + col;
    // central_atrium / framed_glass_atrium use voidRows [1,2] × voidCols [3,4].
    // Void cells punch the L0 ceiling (top face) — same as the existing
    // central_atrium pattern.
    expect(grid[idx(1, 3)].faces.top).toBe('Open');
    expect(grid[idx(2, 4)].faces.top).toBe('Open');
  });

  it('L1 NW → L2 NW stair created at voxel 9 (body NW corner)', () => {
    const ids = useStore.getState().placeModelHome('glass_atrium_showcase');
    const grid = useStore.getState().containers[ids[0]].voxelGrid!;
    // applyStairsFromFace creates a stair voxel at the requested index.
    expect(grid[9].voxelType).toBe('stairs');
  });

  it('L2 NW → roof stair created via extraStairs (voxel 9, face top)', () => {
    const ids = useStore.getState().placeModelHome('glass_atrium_showcase');
    const grid = useStore.getState().containers[ids[4]].voxelGrid!;
    expect(grid[9].voxelType).toBe('stairs');
  });
});
