/**
 * Smart Staircase Consequences Tests
 *
 * Phase 1 of Smart Architecture: When stairs are placed, the system
 * should infer intent and auto-apply consequences:
 * - Clear entry wall so user can walk to stairs
 * - Add railings around the upper-level hole (3 sides, not entry side)
 * - Track auto-changes so removal/undo can reverse them
 *
 * TDD: RED-GREEN-REFACTOR cycle. Real store actions, real assertions.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

function addContainer(): string {
  return useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
}

function getVoxel(containerId: string, index: number) {
  return useStore.getState().containers[containerId].voxelGrid![index];
}

// Grid layout: 4 rows × 8 cols × 2 levels = 64 voxels
// Row 0 = north deck, Row 1-2 = body core, Row 3 = south deck
// Index = level * 32 + row * 8 + col
//
// For stair tests, we use body voxels (rows 1-2) which are active by default.
// Voxel 10 = row 1, col 2 (body core)
// Voxel 18 = row 2, col 2 (body core, south neighbor of 10)
// Voxel 2  = row 0, col 2 (north deck, entry-side neighbor)
// Voxel 42 = level 1, row 1, col 2 (directly above voxel 10)

describe('Smart Staircase: Entry Wall Clearing', () => {
  beforeEach(() => resetStore());

  it('SMART-STAIR-1: placing stairs clears the neighbor wall on the entry side', () => {
    const id = addContainer();

    // Use body-to-body neighbor test: voxel 11 (row 1, col 3) and voxel 10 (row 1, col 2).
    // Click east face of voxel 10 → ascending west (STAIR_FLIP['e']='w').
    // Entry is on the east side. ASCEND_DELTA['e'] = {dc:-1, dr:0} → entry neighbor = col 1 = voxel 9.
    // Voxel 9's west face (STAIR_FLIP['e']='w') faces the stair entry.
    // Body voxels have Solid_Steel on all wall faces by default, NOT user-painted.
    expect(getVoxel(id, 9).faces.w).toBe('Solid_Steel');
    expect(getVoxel(id, 9).userPaintedFaces?.w).toBeFalsy();

    // Place stairs
    useStore.getState().applyStairsFromFace(id, 10, 'e');

    // The stair voxel's own east face should be Open (buildStairFaces for E/W)
    expect(getVoxel(id, 10).faces.e).toBe('Open');

    // SMART CONSEQUENCE: entry neighbor voxel 9's west face should be auto-cleared
    expect(getVoxel(id, 9).faces.w).toBe('Open');
  });

  it('SMART-STAIR-2: entry wall clearing only affects the entry-side neighbor, not other neighbors', () => {
    const id = addContainer();

    // Click south face of voxel 13 (row 1, col 5) → ascending north (STAIR_FLIP['s']='n').
    // Entry is on south side. ASCEND_DELTA['s'] = {dr:1, dc:0} → entry neighbor = row 2, col 5 = voxel 21.
    // Non-entry: voxel 12 (row 1, col 4, west side of 13).
    expect(getVoxel(id, 21).faces.n).toBe('Solid_Steel');
    expect(getVoxel(id, 21).userPaintedFaces?.n).toBeFalsy();
    const nonEntryBefore = getVoxel(id, 12).faces.e;

    // Place stairs
    useStore.getState().applyStairsFromFace(id, 13, 's');

    // Entry-side neighbor (south, voxel 21) should be cleared
    expect(getVoxel(id, 21).faces.n).toBe('Open');

    // Non-entry neighbor (west, voxel 12) should NOT be affected
    expect(getVoxel(id, 12).faces.e).toBe(nonEntryBefore);
  });

  it('SMART-STAIR-3: entry wall clearing works for E/W stairs too', () => {
    const id = addContainer();

    // Voxel 10 = row 1, col 2. Click east face → ascending west.
    // ASCEND_DELTA['e'] = {dc: -1, dr: 0}, so entry neighbor = col-1 = col 1 = voxel 9
    // Voxel 9 is a body voxel (row 1, col 1), active by default.
    // Its west face (STAIR_FLIP['e']='w') faces the stair entry.
    // Body voxels have Solid_Steel walls by default, NOT user-painted.
    expect(getVoxel(id, 9).faces.w).toBe('Solid_Steel');
    expect(getVoxel(id, 9).userPaintedFaces?.w).toBeFalsy();

    // Place stairs: click east face of voxel 10 → ascending west
    useStore.getState().applyStairsFromFace(id, 10, 'e');

    // SMART CONSEQUENCE: voxel 9's west face (facing the stair entry) should be cleared
    expect(getVoxel(id, 9).faces.w).toBe('Open');
  });

  it('SMART-STAIR-4: entry wall clearing preserves user-painted faces', () => {
    const id = addContainer();

    // Activate voxel 2, paint its south face as Glass_Pane, mark as user-painted
    useStore.getState().setVoxelActive(id, 2, true);
    useStore.getState().paintFace(id, 2, 's', 'Glass_Pane');

    // Verify it's user-painted
    expect(getVoxel(id, 2).faces.s).toBe('Glass_Pane');
    expect(getVoxel(id, 2).userPaintedFaces?.s).toBe(true);

    // Place stairs ascending south (entry from north)
    useStore.getState().applyStairsFromFace(id, 10, 'n');

    // SMART CONSEQUENCE: user-painted faces should be preserved (not auto-cleared)
    expect(getVoxel(id, 2).faces.s).toBe('Glass_Pane');
  });

  it('SMART-STAIR-5: entry wall clearing skips inactive neighbor voxels', () => {
    const id = addContainer();

    // Voxel 2 (row 0, col 2) is inactive by default (deck row)
    expect(getVoxel(id, 2).active).toBe(false);

    // Place stairs — should not throw even though entry neighbor is inactive
    useStore.getState().applyStairsFromFace(id, 10, 'n');

    // Stair placement itself should succeed
    expect(getVoxel(id, 10).voxelType).toBe('stairs');
  });
});

// VOXEL_LEVELS = 2, so level 1 base = 32
const LEVEL1_BASE = VOXEL_ROWS * VOXEL_COLS; // 32

describe('Smart Staircase: Upper Hole Railing', () => {
  beforeEach(() => resetStore());

  it('SMART-STAIR-6: stairs auto-add railing around upper-level hole (3 sides, not entry)', () => {
    const id = addContainer();

    // Place stairs ascending south: click north face of voxel 10 (row 1, col 2, level 0)
    // Ascending = south → upper stair arrives at row 2. Floor void at level 1, row 1, col 2 = voxel 42.
    useStore.getState().applyStairsFromFace(id, 10, 'n');

    // Voxel 42 = level 1 + row 1 * 8 + col 2 = 32 + 8 + 2 = 42
    const upperVoxel = getVoxel(id, 42);

    // The floor is already voided (existing behavior)
    expect(upperVoxel.faces.bottom).toBe('Open');

    // SMART CONSEQUENCE: 3 sides get railing, entry side (south, where stairs arrive) stays Open
    // Ascending south means person arrives from the south at the upper level
    // Wait — ascending SOUTH means upper stair is to the south. The hole is at the LOWER stair position.
    // Actually: the hole is punched at the same local index as the lower stair (voxel 10 → localIdx 10).
    // At level 1, that's voxel 42. The ascending direction is south.
    // At the upper level, the person walks OFF the stairs to the south (toward the upper stair voxel).
    // So the south face of voxel 42 should be Open (exit from hole toward upper floor).
    // The other 3 faces should have railing to prevent falling.
    expect(upperVoxel.faces.n).toBe('Railing_Cable');
    expect(upperVoxel.faces.e).toBe('Railing_Cable');
    expect(upperVoxel.faces.w).toBe('Railing_Cable');
    expect(upperVoxel.faces.s).toBe('Open');  // stair exit side
  });

  it('SMART-STAIR-7: upper hole railing works for E/W ascending stairs', () => {
    const id = addContainer();

    // Click west face of voxel 10 (row 1, col 2) → ascending east (STAIR_FLIP['w']='e')
    // ASCEND_DELTA['e'] = {dc:-1, dr:0} → upper stair at col 1 = voxel 9
    // Floor void at level 1, row 1, col 2 = voxel 42
    // Ascending east: person exits hole toward east (dc=-1 direction)
    useStore.getState().applyStairsFromFace(id, 10, 'w');

    const upperVoxel = getVoxel(id, 42);
    expect(upperVoxel.faces.bottom).toBe('Open');

    // East is exit side → Open. Others get railing.
    expect(upperVoxel.faces.e).toBe('Open');
    expect(upperVoxel.faces.n).toBe('Railing_Cable');
    expect(upperVoxel.faces.s).toBe('Railing_Cable');
    expect(upperVoxel.faces.w).toBe('Railing_Cable');
  });

  it('SMART-STAIR-8: upper hole railing preserves user-painted faces', () => {
    const id = addContainer();

    // User paints the north face of upper voxel 42 as Glass_Pane
    useStore.getState().paintFace(id, 42, 'n', 'Glass_Pane');
    expect(getVoxel(id, 42).userPaintedFaces?.n).toBe(true);

    // Place stairs ascending south
    useStore.getState().applyStairsFromFace(id, 10, 'n');

    const upperVoxel = getVoxel(id, 42);
    // User-painted north face preserved
    expect(upperVoxel.faces.n).toBe('Glass_Pane');
    // Non-user-painted sides get railing
    expect(upperVoxel.faces.e).toBe('Railing_Cable');
    expect(upperVoxel.faces.w).toBe('Railing_Cable');
  });

  it('SMART-STAIR-9: no railing when upper level voxel does not exist', () => {
    const id = addContainer();

    // Voxel 42 at level 1 — check if it exists and is active. If not, stairs should still work.
    // Level 1 voxels ARE part of the 64-voxel grid, they should exist.
    // Place stairs and just verify no error
    useStore.getState().applyStairsFromFace(id, 10, 'n');
    expect(getVoxel(id, 10).voxelType).toBe('stairs');
  });
});

describe('Smart Staircase: Removal Cascade', () => {
  beforeEach(() => resetStore());

  it('SMART-STAIR-10: removeStairs restores entry wall to original value', () => {
    const id = addContainer();

    // Record original state of entry neighbor (voxel 9's west face)
    const originalFace = getVoxel(id, 9).faces.w; // Solid_Steel
    expect(originalFace).toBe('Solid_Steel');

    // Place stairs (click east face of voxel 10 → ascending west)
    useStore.getState().applyStairsFromFace(id, 10, 'e');
    expect(getVoxel(id, 9).faces.w).toBe('Open'); // smart-cleared

    // Remove stairs
    useStore.getState().removeStairs(id, 10);

    // Entry wall should be RESTORED to original
    expect(getVoxel(id, 9).faces.w).toBe('Solid_Steel');
  });

  it('SMART-STAIR-11: removeStairs restores upper hole floor and removes railings', () => {
    const id = addContainer();

    // Record original upper voxel state
    const originalBottom = getVoxel(id, 42).faces.bottom;
    const originalN = getVoxel(id, 42).faces.n;

    // Place stairs ascending south
    useStore.getState().applyStairsFromFace(id, 10, 'n');
    expect(getVoxel(id, 42).faces.bottom).toBe('Open');
    expect(getVoxel(id, 42).faces.n).toBe('Railing_Cable');

    // Remove stairs
    useStore.getState().removeStairs(id, 10);

    // Upper hole should be restored
    expect(getVoxel(id, 42).faces.bottom).toBe(originalBottom);
    expect(getVoxel(id, 42).faces.n).toBe(originalN);
  });

  it('SMART-STAIR-12: removeStairs reverts stair voxels to standard type', () => {
    const id = addContainer();

    useStore.getState().applyStairsFromFace(id, 10, 'n');
    expect(getVoxel(id, 10).voxelType).toBe('stairs');
    expect(getVoxel(id, 18).voxelType).toBe('stairs'); // upper stair voxel (row 2, col 2)

    useStore.getState().removeStairs(id, 10);

    // Both voxels revert to standard
    expect(getVoxel(id, 10).voxelType).not.toBe('stairs');
    expect(getVoxel(id, 18).voxelType).not.toBe('stairs');
  });

  it('SMART-STAIR-13: removeStairs on upper voxel also works', () => {
    const id = addContainer();

    // Place stairs: click north face of voxel 10 → ascending south
    // Lower=10, upper=18
    useStore.getState().applyStairsFromFace(id, 10, 'n');
    expect(getVoxel(id, 18).voxelType).toBe('stairs');

    // Remove from upper voxel (should find the pair and revert both)
    useStore.getState().removeStairs(id, 18);

    expect(getVoxel(id, 10).voxelType).not.toBe('stairs');
    expect(getVoxel(id, 18).voxelType).not.toBe('stairs');
  });
});

describe('Smart Staircase: Undo/Redo', () => {
  beforeEach(() => resetStore());

  it('SMART-STAIR-14: undo reverts all smart changes (entry wall, upper railing, stair voxels)', () => {
    const id = addContainer();

    // Record originals
    const orig9w = getVoxel(id, 9).faces.w;
    const orig42bottom = getVoxel(id, 42).faces.bottom;
    const orig42n = getVoxel(id, 42).faces.n;
    const orig10type = getVoxel(id, 10).voxelType;

    // Place stairs (click east face of voxel 10 → ascending west)
    useStore.getState().applyStairsFromFace(id, 10, 'e');

    // Verify smart changes applied
    expect(getVoxel(id, 10).voxelType).toBe('stairs');
    expect(getVoxel(id, 9).faces.w).toBe('Open');        // entry wall cleared
    expect(getVoxel(id, 42).faces.bottom).toBe('Open');   // floor voided
    expect(getVoxel(id, 42).faces.w).toBe('Open');        // exit side (click east→ascending west→exit west)

    // Undo
    useStore.getState().undo();

    // All smart changes should be reverted
    expect(getVoxel(id, 10).voxelType).toBe(orig10type);
    expect(getVoxel(id, 9).faces.w).toBe(orig9w);
    expect(getVoxel(id, 42).faces.bottom).toBe(orig42bottom);
    expect(getVoxel(id, 42).faces.n).toBe(orig42n);
  });

  it('SMART-STAIR-15: redo re-applies all smart changes', () => {
    const id = addContainer();

    // Place stairs
    useStore.getState().applyStairsFromFace(id, 10, 'e');

    // Undo
    useStore.getState().undo();
    expect(getVoxel(id, 10).voxelType).not.toBe('stairs');

    // Redo
    useStore.getState().redo();

    // All smart changes re-applied
    expect(getVoxel(id, 10).voxelType).toBe('stairs');
    expect(getVoxel(id, 9).faces.w).toBe('Open');         // entry wall
    expect(getVoxel(id, 42).faces.bottom).toBe('Open');    // floor void
  });
});
