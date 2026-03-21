import { describe, it, expect } from 'vitest';
import { getHotbarTabForTarget } from '../hooks/useHotbarAutoSwitch';
import type { SelectionTarget } from '../hooks/useSelectionTarget';

describe('getHotbarTabForTarget', () => {
  it('returns 0 for container target', () => {
    expect(getHotbarTabForTarget({ type: 'container', containerId: 'c1' })).toBe(0);
  });

  it('returns 1 for voxel target', () => {
    expect(getHotbarTabForTarget({ type: 'voxel', containerId: 'c1', index: 5 })).toBe(1);
  });

  it('returns 1 for bay target', () => {
    expect(getHotbarTabForTarget({ type: 'bay', containerId: 'c1', indices: [9, 10], bayId: 'body_0' })).toBe(1);
  });

  it('returns 2 for face target', () => {
    expect(getHotbarTabForTarget({ type: 'face', containerId: 'c1', index: 5, face: 'n' })).toBe(2);
  });

  it('returns 2 for bay-face target', () => {
    expect(getHotbarTabForTarget({ type: 'bay-face', containerId: 'c1', indices: [9, 10], bayId: 'body_0', face: 'e' })).toBe(2);
  });

  it('returns null for none target (no switch)', () => {
    expect(getHotbarTabForTarget({ type: 'none' })).toBeNull();
  });
});
