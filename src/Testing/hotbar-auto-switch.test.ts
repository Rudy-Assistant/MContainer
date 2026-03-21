import { describe, it, expect } from 'vitest';
import { getHotbarTabForTarget, getVisibleSwatches } from '../hooks/useHotbarAutoSwitch';
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

describe('getVisibleSwatches', () => {
  it('returns all swatches when no face selected', () => {
    const result = getVisibleSwatches(null);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some(s => s.group === 'wall')).toBe(true);
    expect(result.some(s => s.group === 'floor')).toBe(true);
  });

  it('returns wall + window + special (minus stairs) for wall face', () => {
    const result = getVisibleSwatches('n');
    expect(result.every(s => s.group !== 'floor')).toBe(true);
    expect(result.some(s => s.group === 'wall')).toBe(true);
    expect(result.some(s => s.group === 'window')).toBe(true);
    expect(result.every(s => s.surface !== 'Stairs' && s.surface !== 'Stairs_Down')).toBe(true);
  });

  it('returns floor + Open for floor face (bottom)', () => {
    const result = getVisibleSwatches('bottom');
    expect(result.some(s => s.group === 'floor')).toBe(true);
    expect(result.some(s => s.surface === 'Open')).toBe(true);
    expect(result.every(s => s.group === 'floor' || s.surface === 'Open')).toBe(true);
  });

  it('returns only Steel + Open for ceiling face (top)', () => {
    const result = getVisibleSwatches('top');
    expect(result.every(s => s.surface === 'Solid_Steel' || s.surface === 'Open')).toBe(true);
    expect(result.length).toBe(2);
  });
});
