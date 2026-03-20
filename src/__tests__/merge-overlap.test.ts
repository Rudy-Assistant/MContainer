/**
 * Partial-Overlap Merge Tests (Bug #2)
 *
 * When a 20ft container is placed next to a 40ft container,
 * only the geometrically overlapping portion of the 40ft's wall
 * should be merged to Open — not the entire wall.
 *
 * Mocks: idb-keyval (no IndexedDB in Node).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import {
  ContainerSize,
  CONTAINER_DIMENSIONS,
  WallSide,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
} from '@/types/container';
import { wallSideToBoundary } from '@/store/spatialEngine';

function resetStore() {
  useStore.setState({
    containers: {},
    zones: {},
    furnitureIndex: {},
    selection: [],
    globalCullSet: new Set(),
  } as any);
}

/**
 * Helper: count how many boundary voxels on a given wall side have a specific face material.
 * Checks all levels.
 */
function countBoundaryFaces(
  containerId: string,
  wallSide: import('@/types/container').WallSide,
  expectedMaterial: string,
): number {
  const c = useStore.getState().containers[containerId];
  if (!c?.voxelGrid) return 0;

  const bound = wallSideToBoundary(wallSide);
  let count = 0;

  for (let level = 0; level < VOXEL_LEVELS; level++) {
    const lvlOff = level * VOXEL_ROWS * VOXEL_COLS;
    const range = bound.isRowBoundary ? VOXEL_COLS : VOXEL_ROWS;

    for (let iter = 0; iter < range; iter++) {
      const idx = bound.isRowBoundary
        ? lvlOff + bound.index * VOXEL_COLS + iter
        : lvlOff + iter * VOXEL_COLS + bound.index;

      const vox = c.voxelGrid[idx];
      if (!vox?.active) continue;
      if (vox.faces[bound.face] === expectedMaterial) count++;
    }
  }

  return count;
}

describe('Partial-Overlap Merge (Bug #2)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('two same-size containers flush → all boundary faces merge', () => {
    const store = useStore.getState();
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];

    // Place two 40ft containers flush along X axis (Front/Back adjacency)
    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const idB = store.addContainer(ContainerSize.HighCube40, { x: dims.length, y: 0, z: 0 });

    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;

    // Both should have mergedWalls
    expect(containers[idA].mergedWalls.length).toBeGreaterThan(0);
    expect(containers[idB].mergedWalls.length).toBeGreaterThan(0);

    // Count Open faces on the shared wall of each container
    // For same-size containers, all active boundary voxels should be merged
    const aOpenCount = countBoundaryFaces(idA, containers[idA].mergedWalls[0].split(':')[1] as any, 'Open');
    const bOpenCount = countBoundaryFaces(idB, containers[idB].mergedWalls[0].split(':')[1] as any, 'Open');

    // Both should have the same number of merged faces
    expect(aOpenCount).toBeGreaterThan(0);
    expect(aOpenCount).toBe(bOpenCount);
  });

  it('20ft next to 40ft along long axis → 40ft wall only partially merged', () => {
    const store = useStore.getState();
    const dims20 = CONTAINER_DIMENSIONS[ContainerSize.Standard20];
    const dims40 = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];

    // Both at rotation=0: length runs along X, width runs along Z.
    // Place them flush along the Z axis (short side adjacency = Left/Right walls).
    // Container A = 40ft at origin, Container B = 20ft offset by width on +Z.
    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const idB = store.addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: (dims40.width + dims20.width) / 2 });

    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;

    // Both should be detected as adjacent
    expect(containers[idA].mergedWalls.length).toBeGreaterThan(0);
    expect(containers[idB].mergedWalls.length).toBeGreaterThan(0);

    // The adjacency is along Z, so the shared walls are Right (+Z side of A) and Left (-Z side of B).
    // At rotation=0: Right = row boundary index 2, face 's'; Left = row boundary index 1, face 'n'.
    // The row boundary iterates over cols (0-7).
    //
    // 40ft has colPitch = 12.19/6 ≈ 2.032m
    // 20ft has colPitch = 6.06/6 ≈ 1.01m
    //
    // The 20ft container is ~6.06m long, centered at x=0, so it spans [-3.03, +3.03] on X.
    // The 40ft container is ~12.19m long, centered at x=0, so it spans [-6.095, +6.095] on X.
    //
    // The 40ft's cols at X positions: col 0 at x=+(3.5*2.032)=+7.11, col 7 at x=-(3.5*2.032)=-7.11
    // Using formula: aWorldX = position.x + -(iter - 3.5) * colPitch
    //   col 0: 0 + -(0-3.5)*2.032 = +7.11m
    //   col 1: 0 + -(1-3.5)*2.032 = +5.08m
    //   col 2: 0 + -(2-3.5)*2.032 = +3.05m
    //   col 3: 0 + -(3-3.5)*2.032 = +1.02m
    //   col 4: 0 + -(4-3.5)*2.032 = -1.02m
    //   col 5: 0 + -(5-3.5)*2.032 = -3.05m
    //   col 6: 0 + -(6-3.5)*2.032 = -5.08m
    //   col 7: 0 + -(7-3.5)*2.032 = -7.11m
    //
    // 20ft half extent: (8/2)*1.01 = 4.04m, with tol = 1.02
    // So 20ft X range with tolerance = [-4.04-1.02, +4.04+1.02] = [-5.06, +5.06]
    //
    // 40ft cols within 20ft range: cols 2,3,4,5 (at ±3.05, ±1.02)
    // 40ft cols OUTSIDE 20ft range: cols 0,1,6,7 (at ±7.11, ±5.08)
    //
    // So the 40ft should have at most ~4 cols merged (out of 8) per level.
    // The 20ft should have all its boundary cols merged (they all fall within 40ft range).

    // Import WallSide for explicit checking
    // WallSide imported at top level

    // Count how many of the 40ft's Right wall faces became Open
    const a40OpenCount = countBoundaryFaces(idA, WallSide.Right, 'Open');
    // Count how many of the 40ft's Right wall faces stayed Solid_Steel
    const a40SteelCount = countBoundaryFaces(idA, WallSide.Right, 'Solid_Steel');

    // Count how many of the 20ft's Left wall faces became Open
    const b20OpenCount = countBoundaryFaces(idB, WallSide.Left, 'Open');

    // The 40ft MUST NOT have all boundary faces merged — only the overlapping portion
    expect(a40SteelCount).toBeGreaterThan(0);
    // The 40ft should have SOME faces merged (the overlapping portion)
    expect(a40OpenCount).toBeGreaterThan(0);
    // The 40ft should have fewer merged faces than total boundary voxels
    expect(a40OpenCount).toBeLessThan(a40OpenCount + a40SteelCount);

    // The 20ft is shorter, so all its boundary faces should overlap with the 40ft
    // (20ft fits entirely within 40ft's extent)
    expect(b20OpenCount).toBeGreaterThan(0);
  });

  it('20ft next to 40ft along short axis → both walls fully merge (same width)', () => {
    const store = useStore.getState();
    const dims20 = CONTAINER_DIMENSIONS[ContainerSize.Standard20];
    const dims40 = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];

    // Place them flush along the X axis (long side adjacency = Front/Back walls).
    // The short axis (width=Z) is the same for both (2.44m), so full overlap expected.
    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const halfLenA = dims40.length / 2;
    const halfLenB = dims20.length / 2;
    const idB = store.addContainer(ContainerSize.Standard20, { x: halfLenA + halfLenB, y: 0, z: 0 });

    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    expect(containers[idA].mergedWalls.length).toBeGreaterThan(0);

    // WallSide imported at top level

    // Front/Back adjacency — the perpendicular axis is Z (rows).
    // Both containers have the same width (2.44m), so all rows should overlap.
    // 40ft's Front wall: all active boundary voxels should be merged
    const a40OpenCount = countBoundaryFaces(idA, WallSide.Front, 'Open');
    const a40SteelCount = countBoundaryFaces(idA, WallSide.Front, 'Solid_Steel');

    // All active boundary faces should be merged (same width)
    expect(a40OpenCount).toBeGreaterThan(0);
    // No Solid_Steel should remain on the shared wall (all rows overlap)
    expect(a40SteelCount).toBe(0);
  });

  it('separated containers → no merge at all', () => {
    const store = useStore.getState();

    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const idB = store.addContainer(ContainerSize.Standard20, { x: 50, y: 0, z: 50 });

    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    expect(containers[idA].mergedWalls.length).toBe(0);
    expect(containers[idB].mergedWalls.length).toBe(0);
  });

  it('40ft next to 20ft: _preMergeWalls only tracks actually-merged voxels', () => {
    const store = useStore.getState();
    const dims20 = CONTAINER_DIMENSIONS[ContainerSize.Standard20];
    const dims40 = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];

    // Place flush along Z (Right/Left adjacency)
    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const idB = store.addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: (dims40.width + dims20.width) / 2 });

    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    const a40PreMerge = containers[idA]._preMergeWalls ?? {};
    const b20PreMerge = containers[idB]._preMergeWalls ?? {};

    // The 40ft should NOT have all 8 cols × 2 levels = 16 entries in _preMergeWalls
    // It should only have the overlapping portion
    const a40MergeCount = Object.keys(a40PreMerge).length;

    // The 20ft is shorter, fewer voxels fit within the 40ft → fewer entries
    // But the 40ft should have FEWER merged entries than total boundary voxels (8 cols × 2 levels = 16)
    const totalBoundaryVoxels = VOXEL_COLS * VOXEL_LEVELS; // 16
    expect(a40MergeCount).toBeLessThan(totalBoundaryVoxels);
    expect(a40MergeCount).toBeGreaterThan(0);

    // The 20ft should have entries too (it overlaps fully with 40ft)
    expect(Object.keys(b20PreMerge).length).toBeGreaterThan(0);
  });

  it('restore after separation: previously-merged 40ft voxels revert when neighbor removed', () => {
    const store = useStore.getState();
    const dims20 = CONTAINER_DIMENSIONS[ContainerSize.Standard20];
    const dims40 = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];

    // First, add just the 40ft alone to record baseline Open count
    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const baselineOpenCount = countBoundaryFaces(idA, WallSide.Right, 'Open');

    // Now add the 20ft adjacent
    const idB = store.addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: (dims40.width + dims20.width) / 2 });
    useStore.getState().refreshAdjacency();

    // Record merged state — should have more Open faces than baseline
    const mergedOpenCount = countBoundaryFaces(idA, WallSide.Right, 'Open');
    expect(mergedOpenCount).toBeGreaterThan(baselineOpenCount);

    // Remove B to separate
    useStore.getState().removeContainer(idB);
    useStore.getState().refreshAdjacency();

    // After separation, Open count should revert to baseline (natural Open faces)
    const restoredOpenCount = countBoundaryFaces(idA, WallSide.Right, 'Open');
    expect(restoredOpenCount).toBe(baselineOpenCount);
  });
});
