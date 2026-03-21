import { describe, it, expect } from 'vitest';
import { deriveSelectionTarget } from '../hooks/useSelectionTarget';

const base = {
  selectedVoxel: null,
  selectedFace: null,
  selectedVoxels: null,
  selection: [],
};

describe('deriveSelectionTarget', () => {
  it('returns none when nothing selected', () => {
    expect(deriveSelectionTarget(base)).toEqual({ type: 'none' });
  });

  it('returns container when selection has containerId', () => {
    expect(deriveSelectionTarget({ ...base, selection: ['c1'] }))
      .toEqual({ type: 'container', containerId: 'c1' });
  });

  it('returns voxel for VoxelRef without face', () => {
    expect(deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', index: 5 },
    })).toEqual({ type: 'voxel', containerId: 'c1', index: 5 });
  });

  it('returns face for VoxelRef with face', () => {
    expect(deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', index: 5 },
      selectedFace: 'n',
    })).toEqual({ type: 'face', containerId: 'c1', index: 5, face: 'n' });
  });

  it('returns voxel for VoxelExtRef (converts col/row to index)', () => {
    expect(deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', isExtension: true as const, col: 3, row: 0 },
    })).toEqual({ type: 'voxel', containerId: 'c1', index: 3 });
  });

  it('returns bay for selectedVoxels without face', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedVoxels: { containerId: 'c1', indices: [9, 10, 17, 18] },
    });
    expect(result.type).toBe('bay');
    if (result.type === 'bay') {
      expect(result.containerId).toBe('c1');
      expect(result.indices).toEqual([9, 10, 17, 18]);
      expect(result.bayId).toBeDefined();
    }
  });

  it('returns bay-face for selectedVoxels with face', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedVoxels: { containerId: 'c1', indices: [9, 10, 17, 18] },
      selectedFace: 'e',
    });
    expect(result.type).toBe('bay-face');
    if (result.type === 'bay-face') {
      expect(result.face).toBe('e');
    }
  });

  it('selectedVoxels takes priority over selectedVoxel', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', index: 0 },
      selectedVoxels: { containerId: 'c1', indices: [9, 10] },
    });
    expect(result.type).toBe('bay');
  });

  it('selectedVoxel takes priority over selection', () => {
    const result = deriveSelectionTarget({
      ...base,
      selectedVoxel: { containerId: 'c1', index: 5 },
      selection: ['c1'],
    });
    expect(result.type).toBe('voxel');
  });
});
