/**
 * Unified Stairs Tests
 *
 * Verifies the single-source-of-truth stair system:
 * - applyStairsFromFace is the canonical entry point
 * - setVoxelFace('Stairs') redirects to applyStairsFromFace
 * - applyModule('stairs') redirects to applyStairsFromFace
 * - BOM includes stair cost (once per staircase, not per voxel)
 * - stairAscending is always set
 * - Legacy stairDir is derived from stairAscending
 * - Cross-container void works through unified path
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
  keys: vi.fn().mockResolvedValue([]),
  createStore: vi.fn(() => ({})),
}));

import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  const s = useStore.getState();
  for (const id of Object.keys(s.containers)) s.removeContainer(id);
}

describe('Unified Staircase System', () => {
  beforeEach(() => resetStore());

  // ── Entry Point Consistency ────────────────────────────────

  it('USTAIR-1: setVoxelFace with Stairs redirects to applyStairsFromFace', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    // Setting a wall face to 'Stairs' should trigger the full stair placement
    s().setVoxelFace(id, 10, 'n', 'Stairs');

    const v = s().containers[id].voxelGrid![10];
    expect(v.voxelType).toBe('stairs');
    expect(v.stairAscending).toBeDefined();
    expect(v.stairPart).toBeDefined();
  });

  it('USTAIR-2: applyModule stairs delegates to applyStairsFromFace', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    s().applyModule(id, 10, 'stairs', 'n');

    const v = s().containers[id].voxelGrid![10];
    expect(v.voxelType).toBe('stairs');
    expect(v.stairAscending).toBeDefined();
    expect(v.stairPart).toBeDefined();
  });

  it('USTAIR-3: all entry points produce identical voxel state', () => {
    const s = useStore.getState;

    // Path A: applyStairsFromFace directly
    const idA = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    s().applyStairsFromFace(idA, 10, 'n');
    const vA = s().containers[idA].voxelGrid![10];

    // Path B: setVoxelFace with 'Stairs'
    const idB = s().addContainer(ContainerSize.HighCube40, { x: 5, y: 0, z: 0 });
    s().setVoxelFace(idB, 10, 'n', 'Stairs');
    const vB = s().containers[idB].voxelGrid![10];

    // Path C: applyModule
    const idC = s().addContainer(ContainerSize.HighCube40, { x: 10, y: 0, z: 0 });
    s().applyModule(idC, 10, 'stairs', 'n');
    const vC = s().containers[idC].voxelGrid![10];

    // All three should produce the same voxel state
    expect(vA.voxelType).toBe(vB.voxelType);
    expect(vA.voxelType).toBe(vC.voxelType);
    expect(vA.stairAscending).toBe(vB.stairAscending);
    expect(vA.stairAscending).toBe(vC.stairAscending);
    expect(vA.stairPart).toBe(vB.stairPart);
    expect(vA.stairPart).toBe(vC.stairPart);
  });

  // ── stairAscending always set ──────────────────────────────

  it('USTAIR-4: stairAscending is always set when voxelType is stairs', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    // Test all four directions
    for (const face of ['n', 's', 'e', 'w'] as const) {
      resetStore();
      const cid = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
      s().applyStairsFromFace(cid, 10, face);
      const v = s().containers[cid].voxelGrid![10];
      expect(v.stairAscending).toBeDefined();
      expect(['n', 's', 'e', 'w']).toContain(v.stairAscending);
    }
  });

  it('USTAIR-5: stairDir is derived and consistent with stairAscending', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    s().applyStairsFromFace(id, 10, 'n');
    const v = s().containers[id].voxelGrid![10];

    // stairAscending 's' (face='n' flips to ascending='s') → stairDir should be 'ns'
    if (v.stairAscending === 'n' || v.stairAscending === 's') {
      expect(v.stairDir).toBe('ns');
    } else {
      expect(v.stairDir).toBe('ew');
    }
  });

  // ── BOM Integration ────────────────────────────────────────

  it('USTAIR-6: BOM includes stair cost', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    const beforeEst = s().getEstimate();
    s().applyStairsFromFace(id, 10, 'n');
    const afterEst = s().getEstimate();

    // Total should increase by stair cost (4500)
    expect(afterEst.breakdown.total).toBeGreaterThan(beforeEst.breakdown.total);
    expect(afterEst.breakdown.total - beforeEst.breakdown.total).toBe(4500);
  });

  it('USTAIR-7: BOM does not double-count 2-voxel stairs', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    const beforeEst = s().getEstimate();
    s().applyStairsFromFace(id, 10, 'n');
    const afterEst = s().getEstimate();

    // Should be exactly 4500, not 9000 (upper voxel is not counted)
    expect(afterEst.breakdown.total - beforeEst.breakdown.total).toBe(4500);

    // Verify upper voxel exists (confirming 2-voxel stair was created)
    const grid = s().containers[id].voxelGrid!;
    const upperVoxels = grid.filter(v => v?.voxelType === 'stairs' && v.stairPart === 'upper');
    expect(upperVoxels.length).toBeGreaterThan(0);
  });

  // ── Cross-Container Void ───────────────────────────────────

  it('USTAIR-8: cross-container void works through unified path', () => {
    const s = useStore.getState;
    const bottomId = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = s().addContainer(ContainerSize.HighCube40, { x: 5, y: 0, z: 0 });
    s().stackContainer(topId, bottomId);

    // Place stairs at level 0 voxel 14 (body voxel)
    s().applyStairsFromFace(bottomId, 14, 'n');

    // The upper container's matching voxel should have bottom face = 'Open'
    const upperVoxel = s().containers[topId].voxelGrid![14];
    expect(upperVoxel.faces.bottom).toBe('Open');
  });

  // ── Undo Integration ──────────────────────────────────────

  it('USTAIR-9: undo reverts staircase and BOM cost', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    const beforeEst = s().getEstimate();
    s().applyStairsFromFace(id, 10, 'n');
    expect(s().containers[id].voxelGrid![10].voxelType).toBe('stairs');

    s().undo();
    expect(s().containers[id].voxelGrid![10].voxelType).not.toBe('stairs');

    const afterUndoEst = s().getEstimate();
    expect(afterUndoEst.breakdown.total).toBe(beforeEst.breakdown.total);
  });
});
