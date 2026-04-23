import { describe, expect, it } from 'vitest';
import { filterSelectableGridIndices, getRectangularGridRange } from '@/utils/gridSelection';

describe('grid selection helpers', () => {
  it('returns a rectangular range on the current level', () => {
    expect(getRectangularGridRange(1, 10, 0, 8, 4)).toEqual([1, 2, 9, 10]);
    expect(getRectangularGridRange(10, 1, 0, 8, 4)).toEqual([1, 2, 9, 10]);
  });

  it('rejects ranges that cross outside the active level', () => {
    expect(getRectangularGridRange(1, 33, 0, 8, 4)).toEqual([]);
    expect(getRectangularGridRange(31, 32, 0, 8, 4)).toEqual([]);
  });

  it('filters duplicate, inactive, and locked cells through a selectable predicate', () => {
    const selectable = new Set([1, 3, 5]);
    expect(filterSelectableGridIndices([1, 2, 3, 3, 4, 5], (index) => selectable.has(index))).toEqual([1, 3, 5]);
  });
});
