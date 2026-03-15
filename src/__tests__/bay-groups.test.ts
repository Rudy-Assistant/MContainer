import { describe, it, expect } from 'vitest';
import { computeBayGroups } from '@/config/bayGroups';

describe('computeBayGroups', () => {
  const groups = computeBayGroups();

  it('covers all 32 voxels exactly once (no duplicates)', () => {
    const allIndices = groups.flatMap((g) => g.voxelIndices);
    expect(allIndices.length).toBe(32);
    const unique = new Set(allIndices);
    expect(unique.size).toBe(32);
    // Should cover indices 0-31
    for (let i = 0; i < 32; i++) {
      expect(unique.has(i)).toBe(true);
    }
  });

  it('body bays have 4 voxels each', () => {
    const bodyGroups = groups.filter((g) => g.role === 'body');
    expect(bodyGroups.length).toBe(3);
    for (const g of bodyGroups) {
      expect(g.voxelIndices.length).toBe(4);
    }
  });

  it('corner bays have 1 voxel each', () => {
    const corners = groups.filter((g) => g.role === 'corner');
    expect(corners.length).toBe(4);
    for (const g of corners) {
      expect(g.voxelIndices.length).toBe(1);
    }
  });

  it('returns 15 groups total', () => {
    expect(groups.length).toBe(15);
  });
});
