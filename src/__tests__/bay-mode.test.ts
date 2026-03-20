import { describe, it, expect } from 'vitest';
import { computeBayGroups, getBayGroupForVoxel, getBayIndicesForVoxel } from '@/config/bayGroups';
import { VOXEL_ROWS, VOXEL_COLS } from '@/types/container';

describe('Bay Mode: Bay Grouping', () => {
  it('BAY-1: computeBayGroups returns exactly 15 groups', () => {
    const groups = computeBayGroups();
    expect(groups).toHaveLength(15);
  });

  it('BAY-2: All 32 voxels are covered exactly once', () => {
    const groups = computeBayGroups();
    const allIndices = groups.flatMap((g) => g.voxelIndices);
    expect(allIndices).toHaveLength(VOXEL_ROWS * VOXEL_COLS); // 32
    expect(new Set(allIndices).size).toBe(32); // no duplicates
  });

  it('BAY-3: Each group has gridRow, gridCol, rowSpan, colSpan for CSS Grid', () => {
    const groups = computeBayGroups();
    for (const g of groups) {
      expect(g.gridRow).toBeGreaterThanOrEqual(1);
      expect(g.gridCol).toBeGreaterThanOrEqual(1);
      expect(g.rowSpan).toBeGreaterThanOrEqual(1);
      expect(g.colSpan).toBeGreaterThanOrEqual(1);
      expect(g.label).toBeTruthy();
    }
  });

  it('BAY-4: getBayGroupForVoxel returns correct group for body voxel', () => {
    const group = getBayGroupForVoxel(9, VOXEL_ROWS * VOXEL_COLS);
    expect(group).toBeDefined();
    expect(group!.role).toBe('body');
    expect(group!.voxelIndices).toContain(9);
  });

  it('BAY-5: getBayGroupForVoxel returns correct group for corner voxel', () => {
    const group = getBayGroupForVoxel(0, VOXEL_ROWS * VOXEL_COLS);
    expect(group).toBeDefined();
    expect(group!.role).toBe('corner');
  });

  it('BAY-6: getBayIndicesForVoxel returns all voxels in the same bay', () => {
    const indices = getBayIndicesForVoxel(9, VOXEL_ROWS * VOXEL_COLS);
    expect(indices).toBeDefined();
    expect(indices!.length).toBeGreaterThanOrEqual(2);
    expect(indices).toContain(9);
  });

  it('BAY-7: computeBayGroups groups match grid layout (no gaps, no overlaps in CSS Grid)', () => {
    const groups = computeBayGroups();
    for (const g of groups) {
      expect(g.gridRow + g.rowSpan - 1).toBeLessThanOrEqual(VOXEL_ROWS);
      expect(g.gridCol + g.colSpan - 1).toBeLessThanOrEqual(VOXEL_COLS);
    }
    const cellCoverage = new Map<string, string>();
    for (const g of groups) {
      for (let r = g.gridRow; r < g.gridRow + g.rowSpan; r++) {
        for (let c = g.gridCol; c < g.gridCol + g.colSpan; c++) {
          const key = `${r},${c}`;
          expect(cellCoverage.has(key)).toBe(false);
          cellCoverage.set(key, g.id);
        }
      }
    }
    expect(cellCoverage.size).toBe(VOXEL_ROWS * VOXEL_COLS);
  });
});
