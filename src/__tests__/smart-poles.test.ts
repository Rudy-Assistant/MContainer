/**
 * Smart Corner Poles Tests
 *
 * Phase 2 of Smart Architecture, Work Item 3: Poles appear at every
 * 90° corner of a roof boundary. A "roofed" voxel has top !== 'Open'.
 * Out-of-bounds cells count as "unroofed". A pole is placed when
 * exactly 1 or 3 of the 4 surrounding voxels are roofed.
 *
 * TDD: RED-GREEN-REFACTOR cycle. Pure function, real assertions.
 */
import { describe, it, expect } from 'vitest';
import {
  computePolePositions,
  type PolePosition,
} from '@/utils/smartPoles';
import { type Voxel, type VoxelFaces } from '@/types/container';
import { VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

/** Create a minimal voxel grid for testing. All voxels inactive by default. */
function makeGrid(overrides: Record<number, { active: boolean; topOpen?: boolean }>): Voxel[] {
  const defaultFaces: VoxelFaces = {
    top: 'Solid_Steel', bottom: 'Solid_Steel',
    n: 'Solid_Steel', s: 'Solid_Steel',
    e: 'Solid_Steel', w: 'Solid_Steel',
  };
  const grid: Voxel[] = [];
  for (let i = 0; i < VOXEL_ROWS * VOXEL_COLS; i++) {
    const override = overrides[i];
    if (override) {
      const faces = { ...defaultFaces };
      if (override.topOpen) faces.top = 'Open';
      grid.push({ active: override.active, faces } as Voxel);
    } else {
      grid.push({ active: false, faces: { ...defaultFaces } } as Voxel);
    }
  }
  return grid;
}

describe('Smart Corner Poles: Placement Algorithm', () => {

  it('POLE-1: Single roofed voxel at grid interior gets 4 poles (all corners convex)', () => {
    // Voxel at row=1, col=2 (index 10) — active with ceiling
    const grid = makeGrid({ 10: { active: true } });
    const poles = computePolePositions(grid);
    // A single roofed voxel surrounded by inactive/OOB has 4 convex corners
    expect(poles).toHaveLength(4);
  });

  it('POLE-2: Two adjacent roofed voxels form a 1×2 rectangle with 4 corner poles', () => {
    // Voxels at row=1 col=2 (idx 10) and row=1 col=3 (idx 11) — side by side in same row
    const grid = makeGrid({ 10: { active: true }, 11: { active: true } });
    const poles = computePolePositions(grid);
    // 1×2 rectangle has 4 corners (shared internal vertices have count=2, no pole)
    expect(poles).toHaveLength(4);
  });

  it('POLE-3: L-shaped roof gets poles at both convex AND concave corners', () => {
    // L-shape: row=1 col=1-2 (idx 9,10) + row=2 col=1 (idx 17)
    //   [9 ][10]
    //   [17]
    const grid = makeGrid({
      9: { active: true },
      10: { active: true },
      17: { active: true },
    });
    const poles = computePolePositions(grid);
    // L-shape has 6 convex corners + 1 concave corner (inner elbow) = should be NOT just convex
    // Total unique 90° corners: 8 (6 outer + the concave inner elbow counts as well)
    // Actually: L-shape perimeter has 8 corners total (6 convex + 2? no...)
    // Let me think: draw it:
    //   +--+--+
    //   |9 |10|
    //   +--+--+
    //   |17|
    //   +--+
    // Vertices with exactly 1 or 3 roofed neighbors:
    // Top-left of 9: 1 roofed (9) out of 4 → POLE
    // Top-right of 9 / top-left of 10: 2 roofed (9,10) → no pole (straight edge)
    // Top-right of 10: 1 roofed (10) → POLE
    // Right of 9/10, left of nothing, between rows: this is the inner corner
    //   bottom-right of 10 / check: 10 is roofed, nothing else around that vertex → 1 → POLE
    // Bottom-left of 9 / top-left of 17: 2 roofed (9,17) → no pole (straight edge)
    // Bottom-right of 9 / top-right of 17 / top-left of nothing:
    //   9 roofed, 17 roofed, 10 is at (1,2) so bottom-right of 9 is vertex at (row=2, col=2)
    //   voxels sharing this vertex: 9(r1c1), 10(r1c2), 17(r2c1), and r2c2(idx 18, inactive)
    //   3 roofed out of 4 → POLE (concave/inner corner!)
    // Bottom-left of 17: 1 roofed → POLE
    // Bottom-right of 17: 1 roofed → POLE
    // So total: 6 poles
    expect(poles).toHaveLength(6);
  });

  it('POLE-4: Full rectangular roof (2×2 body quad) gets 4 corner poles', () => {
    // 2×2 block: rows 1-2, cols 1-2 (idx 9,10,17,18)
    const grid = makeGrid({
      9: { active: true },
      10: { active: true },
      17: { active: true },
      18: { active: true },
    });
    const poles = computePolePositions(grid);
    // Rectangle has 4 corners, all convex
    expect(poles).toHaveLength(4);
  });

  it('POLE-5: Deck voxels (top=Open) do NOT get poles — only roofed voxels', () => {
    // Voxel 10 active but top=Open (deck/open-air)
    const grid = makeGrid({ 10: { active: true, topOpen: true } });
    const poles = computePolePositions(grid);
    expect(poles).toHaveLength(0);
  });

  it('POLE-6: Mixed roof and deck — poles only at roofed voxel corners', () => {
    // Voxel 9 = roofed, voxel 10 = deck (open top)
    const grid = makeGrid({
      9: { active: true },
      10: { active: true, topOpen: true },
    });
    const poles = computePolePositions(grid);
    // Voxel 9 has 4 corners. The two corners shared with voxel 10:
    // At those vertices, 10 is "unroofed" (top=Open), so it counts as unroofed.
    // Voxel 9 gets all 4 poles (all corners are convex since 10 is not roofed).
    expect(poles).toHaveLength(4);
  });

  it('POLE-7: Voxel at grid corner (row=0, col=0) gets poles including boundary corners', () => {
    // Index 0 = row 0, col 0 — grid corner, 3 neighbors are out-of-bounds
    const grid = makeGrid({ 0: { active: true } });
    const poles = computePolePositions(grid);
    // Out-of-bounds = unroofed. Single voxel at corner still gets 4 poles.
    expect(poles).toHaveLength(4);
  });

  it('POLE-8: Inactive voxels produce no poles', () => {
    const grid = makeGrid({});
    const poles = computePolePositions(grid);
    expect(poles).toHaveLength(0);
  });

  it('POLE-9: Pole positions include row, col, and corner identifier', () => {
    const grid = makeGrid({ 10: { active: true } });
    const poles = computePolePositions(grid);
    expect(poles).toHaveLength(4);
    // Each pole should have identifiable position data
    for (const pole of poles) {
      expect(pole).toHaveProperty('row');
      expect(pole).toHaveProperty('col');
      expect(pole).toHaveProperty('corner');
      expect(pole).toHaveProperty('px');
      expect(pole).toHaveProperty('pz');
      expect(['ne', 'nw', 'se', 'sw']).toContain(pole.corner);
    }
  });

  it('POLE-10: U-shaped roof gets correct pole count', () => {
    // U-shape: 3 sides of a 2×3 rectangle (missing top-center)
    //   [9 ][  ][11]
    //   [17][18][19]
    const grid = makeGrid({
      9: { active: true },
      11: { active: true },
      17: { active: true },
      18: { active: true },
      19: { active: true },
    });
    const poles = computePolePositions(grid);
    // U-shape vertices: 6 convex corners (4 outer + 2 bottom ends) + 2 concave corners (inner elbows) = 8
    expect(poles).toHaveLength(8);
  });
});
