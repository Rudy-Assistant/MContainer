/**
 * Adjacency Auto-Merge Tests (ADJ-1 through ADJ-7)
 *
 * Real store actions, real state assertions. No source scanning.
 * Mocks: idb-keyval (no IndexedDB in Node).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, CONTAINER_DIMENSIONS, WallSide, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';
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
 * Helper: place two 40ft containers flush side-by-side along Z (width axis at rotation=0).
 * At rotation=0, length runs along X, width runs along Z.
 * Container A at origin, container B offset by container width on +Z.
 */
function placeTwoFlush() {
  const store = useStore.getState();
  const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
  const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  // Offset by width along Z axis (short side adjacency)
  const idB = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: dims.width });
  // Force synchronous adjacency refresh (no requestAnimationFrame in Node)
  useStore.getState().refreshAdjacency();
  return { idA, idB, dims };
}

/**
 * Helper: get boundary voxel indices for a container's wall side.
 * Returns the voxel indices on the boundary row/col for that wall.
 */
function getBoundaryVoxels(side: WallSide): { indices: number[]; face: keyof import('@/types/container').VoxelFaces } {
  const bound = wallSideToBoundary(side);
  const indices: number[] = [];
  for (let level = 0; level < 1; level++) { // Level 0 only for simplicity
    const lvlOff = level * VOXEL_ROWS * VOXEL_COLS;
    if (!bound.isRowBoundary) {
      for (let row = 0; row < VOXEL_ROWS; row++) {
        indices.push(lvlOff + row * VOXEL_COLS + bound.index);
      }
    } else {
      for (let col = 0; col < VOXEL_COLS; col++) {
        indices.push(lvlOff + bound.index * VOXEL_COLS + col);
      }
    }
  }
  return { indices, face: bound.face };
}

describe('Adjacency Auto-Merge', () => {
  beforeEach(() => {
    resetStore();
  });

  it('ADJ-1: Two containers placed flush → facing walls become Open', () => {
    const { idA, idB } = placeTwoFlush();
    const containers = useStore.getState().containers;

    // Container A's Front (+X) wall faces Container B's Back (-X) wall
    // Check that A has mergedWalls entry for B
    expect(containers[idA].mergedWalls.length).toBeGreaterThan(0);
    expect(containers[idB].mergedWalls.length).toBeGreaterThan(0);

    // Check that the facing voxel faces are in the globalCullSet
    const cullSet = useStore.getState().globalCullSet;
    expect(cullSet.size).toBeGreaterThan(0);

    // The facing walls should have voxel faces marked for culling
    // Container A's front wall boundary (col 1, face 'e') should have entries
    const aBound = getBoundaryVoxels(containers[idA].mergedWalls[0]?.split(':')[1] as WallSide || WallSide.Front);
    // At least some faces should be in the cull set
    const aEntries = [...cullSet].filter(k => k.startsWith(idA));
    const bEntries = [...cullSet].filter(k => k.startsWith(idB));
    expect(aEntries.length).toBeGreaterThan(0);
    expect(bEntries.length).toBeGreaterThan(0);
  });

  it('ADJ-2: Move one container away → walls revert (no longer culled)', () => {
    const { idA, idB, dims } = placeTwoFlush();
    const store = useStore.getState();

    // Verify merged
    expect(store.globalCullSet.size).toBeGreaterThan(0);

    // Move B far away
    store.updateContainerPosition(idB, { x: 0, y: 0, z: 100 });
    store.refreshAdjacency();

    const after = useStore.getState();
    expect(after.containers[idA].mergedWalls.length).toBe(0);
    expect(after.containers[idB].mergedWalls.length).toBe(0);
    expect(after.globalCullSet.size).toBe(0);
  });

  it('ADJ-3: User paints a facing wall to Glass → merge skips that face (still culls in shouldMelt)', () => {
    const store = useStore.getState();
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    // Paint A's right wall boundary voxels to Glass_Pane (right wall faces +Z)
    const rightBound = getBoundaryVoxels(WallSide.Right);
    for (const idx of rightBound.indices) {
      const voxel = useStore.getState().containers[idA]?.voxelGrid?.[idx];
      if (voxel?.active) {
        useStore.getState().setVoxelFace(idA, idx, rightBound.face, 'Glass_Pane');
      }
    }

    // Now place B flush along Z
    const idB = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: dims.width });
    useStore.getState().refreshAdjacency();

    // Glass faces should still be Glass_Pane in the actual data
    const voxelGrid = useStore.getState().containers[idA]?.voxelGrid;
    for (const idx of rightBound.indices) {
      const voxel = voxelGrid?.[idx];
      if (voxel?.active) {
        expect(voxel.faces[rightBound.face]).toBe('Glass_Pane');
      }
    }
  });

  it('ADJ-4: Three containers in a row → middle container has both walls merged', () => {
    const store = useStore.getState();
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];

    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const idB = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: dims.width });
    const idC = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: dims.width * 2 });
    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    // Middle container (B) should have 2 mergedWalls entries
    expect(containers[idB].mergedWalls.length).toBe(2);
    // A and C should have 1 each
    expect(containers[idA].mergedWalls.length).toBe(1);
    expect(containers[idC].mergedWalls.length).toBe(1);
  });

  it('ADJ-5: Stack container → containers touch vertically', () => {
    const store = useStore.getState();
    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const idB = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    store.stackContainer(idB, idA);
    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    // Stacked containers share Y-level boundary
    // They won't be detected by current same-Y adjacency check
    // but they should be stacked (level 1 on top of level 0)
    expect(containers[idB].level).toBe(1);
    expect(containers[idB].stackedOn).toBe(idA);
  });

  it('ADJ-6: Remove adjacent container → remaining container wall reverts', () => {
    const { idA, idB } = placeTwoFlush();

    // Verify merged
    expect(useStore.getState().globalCullSet.size).toBeGreaterThan(0);

    // Remove B
    useStore.getState().removeContainer(idB);
    useStore.getState().refreshAdjacency();

    const after = useStore.getState();
    expect(after.containers[idA].mergedWalls.length).toBe(0);
    expect(after.globalCullSet.size).toBe(0);
  });

  it('ADJ-7: Undo a container move that caused merge → merge reverts', () => {
    const store = useStore.getState();
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const idB = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 100 });
    useStore.getState().refreshAdjacency();

    // Verify NOT merged (far apart)
    expect(useStore.getState().globalCullSet.size).toBe(0);

    // Move B flush along Z
    useStore.getState().updateContainerPosition(idB, { x: 0, y: 0, z: dims.width });
    useStore.getState().refreshAdjacency();

    // Verify merged
    expect(useStore.getState().globalCullSet.size).toBeGreaterThan(0);

    // Undo until B is back at z=100 (multiple undos since refreshAdjacency also creates snapshots)
    for (let i = 0; i < 10; i++) {
      useStore.getState().undo();
      if (useStore.getState().containers[idB]?.position.z === 100) break;
    }
    useStore.getState().refreshAdjacency();

    // B should be back at z=100, no adjacency
    const afterUndo = useStore.getState();
    expect(afterUndo.containers[idB].position.z).toBe(100);
    expect(afterUndo.containers[idA].mergedWalls.length).toBe(0);
    expect(afterUndo.globalCullSet.size).toBe(0);
  });

  it('ADJ-8: Flush short-side adjacency with large X offset → no voxel merge in non-overlapping zone', () => {
    const store = useStore.getState();
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];

    // Place two containers flush along Z (short side) with large X offset
    // Body cols have X positions from -5.08 to +5.08 (cols 1-6)
    // With X offset of 8m, only some of A's cols overlap with B's grid extent
    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const idB = store.addContainer(ContainerSize.HighCube40, { x: 8, y: 0, z: dims.width }, 0, true);
    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    const aGrid = containers[idA].voxelGrid;
    if (!aGrid) throw new Error('No voxel grid');

    // A's right boundary (row 2, face 's') — the boundary facing B along Z
    const aBound = wallSideToBoundary(WallSide.Right);
    let mergedCount = 0;
    let totalActive = 0;
    for (let col = 0; col < VOXEL_COLS; col++) {
      const idx = aBound.index * VOXEL_COLS + col;
      const voxel = aGrid[idx];
      if (!voxel?.active) continue;
      totalActive++;
      const key = `${idx}:${aBound.face}`;
      if (containers[idA]._preMergeWalls?.[key]) {
        mergedCount++;
      }
    }

    // With 8m X offset, some active cols should NOT overlap with B's grid
    // (B's grid half-extent = 4*2.032 = 8.13, centered at X=8, so B's X range = [-0.13, 16.13])
    // A's col 1 at X=+5.08 is inside B's range → merged
    // A's col 6 at X=-5.08 is inside B's range? -5.08 > -0.13? No → NOT merged
    // So not ALL active cols should be merged
    expect(totalActive).toBeGreaterThan(0);
    expect(mergedCount).toBeLessThan(totalActive);
  });

  it('ADJ-9: stackContainer via context menu action pattern', () => {
    const store = useStore.getState();
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];

    const idA = store.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const pos = { x: 0, y: dims.height, z: 0 };
    const idB = store.addContainer(ContainerSize.HighCube40, pos, 1, true);
    store.stackContainer(idB, idA);

    const containers = useStore.getState().containers;
    expect(containers[idB].level).toBe(1);
    expect(containers[idB].stackedOn).toBe(idA);
    expect(containers[idB].position.y).toBeCloseTo(dims.height, 1);
  });
});
