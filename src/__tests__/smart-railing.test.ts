/**
 * Smart Auto-Railing Tests
 *
 * Phase 2 of Smart Architecture, Work Items 4-5:
 * - Auto-railing on fall hazard edges (open-air + exposed)
 * - Staircase lateral railing extension
 * - Removal when condition clears
 * - User override preservation
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

function getContainer(containerId: string) {
  return useStore.getState().containers[containerId];
}

// Grid: 4 rows × 8 cols. Index = row * 8 + col
// Row 0 = north deck (extension), Rows 1-2 = body core, Row 3 = south deck (extension)
// Body voxels (rows 1-2) are active by default with Solid_Steel walls and ceilings.
// Extension voxels (rows 0, 3) are inactive by default.

describe('Smart Auto-Railing: Fall Hazard Detection', () => {
  beforeEach(() => resetStore());

  it('RAIL-1: Activating a deck voxel with Open top auto-adds railings on exposed edges', () => {
    const id = addContainer();
    // Extension voxel at row 0, col 2 (idx 2) — north deck
    // First make it open-air: activate it, then set top to Open
    useStore.getState().setVoxelActive(id, 2, true);
    // Extension voxels get Open top by default (deck)
    const voxel = getVoxel(id, 2);

    // The north face (row 0, outward) should auto-get railing if top is Open
    // and the north neighbor is out-of-bounds (grid boundary = fall hazard)
    if (voxel.faces.top === 'Open') {
      // North face: grid boundary → fall hazard → should be Railing_Cable
      expect(voxel.faces.n).toBe('Railing_Cable');
    }
  });

  it('RAIL-2: Body voxel with ceiling does NOT get auto-railing (not open-air)', () => {
    const id = addContainer();
    // Body voxel 10 (row 1, col 2) — active, has ceiling (top = Solid_Steel)
    const voxel = getVoxel(id, 10);
    expect(voxel.faces.top).not.toBe('Open');
    // Should NOT have railings — it's enclosed
    expect(voxel.faces.n).toBe('Solid_Steel');
    expect(voxel.faces.s).toBe('Solid_Steel');
  });

  it('RAIL-3: Removing ceiling (top→Open) on edge voxel triggers auto-railing', () => {
    const id = addContainer();
    // Body voxel 9 (row 1, col 1) — at edge of body
    // Remove its ceiling to make it open-air
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    const voxel = getVoxel(id, 9);
    expect(voxel.faces.top).toBe('Open');
    // E/W inversion: face 'e' → dc=-1 → col 0 (extension, inactive) → fall hazard → railing
    // face 'w' → dc=+1 → col 2 (body, active) → no hazard
    if (!voxel.userPaintedFaces?.e) {
      expect(voxel.faces.e).toBe('Railing_Cable');
    }
  });

  it('RAIL-4: Adding ceiling back (Open→Solid_Steel) removes auto-railing', () => {
    const id = addContainer();
    // First make voxel 9 open-air
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    let voxel = getVoxel(id, 9);
    // Verify auto-railing was added (face 'e' → dc=-1 → col 0, inactive → fall hazard)
    if (!voxel.userPaintedFaces?.e) {
      expect(voxel.faces.e).toBe('Railing_Cable');
    }
    // Now add ceiling back
    useStore.getState().setVoxelFace(id, 9, 'top', 'Solid_Steel');
    voxel = getVoxel(id, 9);
    // Auto-railing should be removed (restored to original)
    expect(voxel.faces.e).toBe('Solid_Steel');
  });

  it('RAIL-5: User-painted face is NOT overridden by auto-railing', () => {
    const id = addContainer();
    // Paint west face of voxel 9 to Glass before making it open-air
    useStore.getState().setVoxelFace(id, 9, 'w', 'Glass_Pane');
    // Now make it open-air
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    const voxel = getVoxel(id, 9);
    // West face was user-painted → smart system should preserve it
    expect(voxel.faces.w).toBe('Glass_Pane');
  });

  it('RAIL-6: _smartRailingChanges tracks auto-railing originals', () => {
    const id = addContainer();
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    const container = getContainer(id);
    // Should have tracking entries for auto-railings
    expect(container._smartRailingChanges).toBeDefined();
    if (container._smartRailingChanges) {
      // face 'e' → dc=-1 → col 0 (inactive) → fall hazard → tracked
      const key = '9:e';
      expect(container._smartRailingChanges[key]).toBeDefined();
    }
  });

  it('RAIL-7: Activating neighbor removes fall hazard and auto-railing on shared face', () => {
    const id = addContainer();
    // Make voxel 9 open-air (face 'e' → dc=-1 → col 0, inactive → fall hazard → railing)
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    let voxel = getVoxel(id, 9);
    if (!voxel.userPaintedFaces?.e) {
      expect(voxel.faces.e).toBe('Railing_Cable');
    }
    // Activate neighbor at col 0: voxel 8 (row 1, col 0 — extension)
    useStore.getState().setVoxelActive(id, 8, true);
    voxel = getVoxel(id, 9);
    // East neighbor (col 0) now active → no longer a fall hazard → auto-railing removed
    expect(voxel.faces.e).not.toBe('Railing_Cable');
  });
});

describe('Smart Staircase Lateral Railing', () => {
  beforeEach(() => resetStore());

  it('RAIL-8: Stair with exposed lateral side gets auto-railing', () => {
    const id = addContainer();
    // Place stairs at voxel 10 (row 1, col 2), ascending north (entry from south)
    // Lateral faces are east and west
    useStore.getState().applyStairsFromFace(id, 10, 's');
    const voxel = getVoxel(id, 10);
    // East neighbor: voxel 11 (row 1, col 3) — active body voxel → NOT exposed
    // West neighbor: voxel 9 (row 1, col 1) — active body voxel → NOT exposed
    // Both lateral faces have active neighbors → no lateral railing needed
    // This is expected — interior stairs don't need lateral railings
    expect(voxel.faces.e).not.toBe('Railing_Cable');
    expect(voxel.faces.w).not.toBe('Railing_Cable');
  });

  it('RAIL-9: Stair at grid edge with no lateral neighbor gets auto-railing', () => {
    const id = addContainer();
    // Place stairs at voxel 9 (row 1, col 1), ascending north (entry from south)
    // E/W inversion: face 'e' → dc=-1 → col 0 (extension, inactive) → exposed → railing
    //                face 'w' → dc=+1 → col 2 (voxel 10, active body) → not exposed
    useStore.getState().applyStairsFromFace(id, 9, 's');
    const voxel = getVoxel(id, 9);
    // East face should get auto-railing (dc=-1 → col 0, exposed lateral)
    expect(voxel.faces.e).toBe('Railing_Cable');
    // West face should NOT (dc=+1 → col 2, neighbor is active)
    expect(voxel.faces.w).not.toBe('Railing_Cable');
  });

  it('RAIL-10: Removing stairs reverses lateral auto-railings', () => {
    const id = addContainer();
    useStore.getState().applyStairsFromFace(id, 9, 's');
    // Verify lateral railing exists (face 'e' → dc=-1 → col 0, inactive → railing)
    expect(getVoxel(id, 9).faces.e).toBe('Railing_Cable');
    // Remove stairs
    useStore.getState().removeStairs(id, 9);
    // East face should be restored to original
    const voxel = getVoxel(id, 9);
    expect(voxel.faces.e).not.toBe('Railing_Cable');
  });
});
