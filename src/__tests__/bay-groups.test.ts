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

  it('S Deck 3 maps to nearest cols (1-2), S Deck 1 maps to farthest cols (5-6)', () => {
    const groups = computeBayGroups();
    const sDeck3 = groups.find(g => g.label === 'S Deck 3');
    const sDeck1 = groups.find(g => g.label === 'S Deck 1');
    expect(sDeck3).toBeDefined();
    expect(sDeck1).toBeDefined();
    expect(sDeck3!.voxelIndices).toEqual([25, 26]);
    expect(sDeck1!.voxelIndices).toEqual([29, 30]);
  });

  it('N Deck 3 maps to nearest cols (1-2), N Deck 1 maps to farthest cols (5-6)', () => {
    const groups = computeBayGroups();
    const nDeck3 = groups.find(g => g.label === 'N Deck 3');
    const nDeck1 = groups.find(g => g.label === 'N Deck 1');
    expect(nDeck3).toBeDefined();
    expect(nDeck1).toBeDefined();
    expect(nDeck3!.voxelIndices).toEqual([1, 2]);
    expect(nDeck1!.voxelIndices).toEqual([5, 6]);
  });
});
