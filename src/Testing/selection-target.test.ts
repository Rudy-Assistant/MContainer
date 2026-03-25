import { describe, it, expect } from 'vitest';
import { deriveSelectionTarget } from '../hooks/useSelectionTarget';

const base = {
  selectedElements: null,
  selectedFace: null,
  selection: [] as string[],
};

describe('deriveSelectionTarget', () => {
  it('returns none when nothing selected', () => {
    expect(deriveSelectionTarget(base)).toEqual({ type: 'none' });
  });

  it('returns container when selection has containerId', () => {
    expect(deriveSelectionTarget({ ...base, selection: ['c1'] }))
      .toEqual({ type: 'container', containerId: 'c1' });
  });

  it('returns voxel for single voxel without face', () => {
    expect(deriveSelectionTarget({
      ...base,
      selectedElements: { type: 'voxel', items: [{ containerId: 'c1', id: '5' }] },
    })).toEqual({ type: 'voxel', containerId: 'c1', index: 5 });
  });

  it('returns face for single voxel with face', () => {
    expect(deriveSelectionTarget({
      ...base,
      selectedElements: { type: 'voxel', items: [{ containerId: 'c1', id: '5' }] },
      selectedFace: 'n',
    })).toEqual({ type: 'face', containerId: 'c1', index: 5, face: 'n' });
  });

  it('returns voxel for extension voxel (converts col/row to index)', () => {
    expect(deriveSelectionTarget({
      ...base,
      selectedElements: { type: 'voxel', items: [{ containerId: 'c1', id: 'ext_3_0' }] },
    })).toEqual({ type: 'voxel', containerId: 'c1', index: 3 });
  });

  it('returns bay for bay selection without face', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedElements: { type: 'bay', items: [
        { containerId: 'c1', id: '9' },
        { containerId: 'c1', id: '10' },
        { containerId: 'c1', id: '17' },
        { containerId: 'c1', id: '18' },
      ] },
    });
    expect(result.type).toBe('bay');
    if (result.type === 'bay') {
      expect(result.containerId).toBe('c1');
      expect(result.indices).toEqual([9, 10, 17, 18]);
      expect(result.bayId).toBeDefined();
    }
  });

  it('returns bay-face for bay selection with face', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedElements: { type: 'bay', items: [
        { containerId: 'c1', id: '9' },
        { containerId: 'c1', id: '10' },
        { containerId: 'c1', id: '17' },
        { containerId: 'c1', id: '18' },
      ] },
      selectedFace: 'e',
    });
    expect(result.type).toBe('bay-face');
    if (result.type === 'bay-face') {
      expect(result.face).toBe('e');
    }
  });

  it('voxel selection takes priority over container selection', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedElements: { type: 'voxel', items: [{ containerId: 'c1', id: '5' }] },
      selection: ['c1'],
    });
    expect(result.type).toBe('voxel');
  });
});
