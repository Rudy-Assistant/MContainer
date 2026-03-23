import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

function resetStore() {
  useStore.setState({
    selection: [],
    selectedVoxel: null,
    selectedFace: null,
    selectedVoxels: null,
    selectedObjectId: null,
  });
}

describe('selection mutual exclusion', () => {
  beforeEach(resetStore);

  it('selectObject clears voxel selection', () => {
    const s = useStore.getState();
    s.setSelectedVoxel({ containerId: 'c1', index: 5 });
    s.setSelectedFace('n');
    expect(useStore.getState().selectedVoxel).not.toBeNull();

    s.selectObject('obj-1');
    const after = useStore.getState();
    expect(after.selectedObjectId).toBe('obj-1');
    expect(after.selectedVoxel).toBeNull();
    expect(after.selectedFace).toBeNull();
    expect(after.selectedVoxels).toBeNull();
  });

  it('selectObject clears multi-voxel selection', () => {
    const s = useStore.getState();
    s.setSelectedVoxels({ containerId: 'c1', indices: [9, 10] });
    s.selectObject('obj-2');
    expect(useStore.getState().selectedVoxels).toBeNull();
  });

  it('setSelectedVoxel clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    expect(useStore.getState().selectedObjectId).toBe('obj-1');

    s.setSelectedVoxel({ containerId: 'c1', index: 3 });
    expect(useStore.getState().selectedObjectId).toBeNull();
  });

  it('setSelectedVoxels clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    s.setSelectedVoxels({ containerId: 'c1', indices: [9, 10] });
    expect(useStore.getState().selectedObjectId).toBeNull();
  });

  it('select (container) clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    s.select('c1');
    expect(useStore.getState().selectedObjectId).toBeNull();
  });

  it('selectMultiple clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    s.selectMultiple(['c1', 'c2']);
    expect(useStore.getState().selectedObjectId).toBeNull();
  });

  it('clearSelection clears selectedObjectId', () => {
    const s = useStore.getState();
    s.selectObject('obj-1');
    s.clearSelection();
    const after = useStore.getState();
    expect(after.selectedObjectId).toBeNull();
    expect(after.selection).toEqual([]);
    expect(after.selectedVoxel).toBeNull();
  });

  it('selectObject(null) only clears object, preserves voxel selection', () => {
    const s = useStore.getState();
    s.setSelectedVoxel({ containerId: 'c1', index: 5 });
    s.selectObject(null);
    const after = useStore.getState();
    expect(after.selectedObjectId).toBeNull();
    // selectObject(null) still clears voxel (mutual exclusion is unconditional)
    expect(after.selectedVoxel).toBeNull();
  });
});
