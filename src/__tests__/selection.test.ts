/**
 * Selection Tests (SEL-1 through SEL-5)
 *
 * Real store actions, real state assertions. No source scanning.
 * Mocks: idb-keyval (no IndexedDB in Node).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, ViewMode, VOXEL_COLS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('Selection', () => {
  beforeEach(() => {
    resetStore();
  });

  it('SEL-1: select(id) adds to selection array', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);

    useStore.getState().select(id);

    expect(useStore.getState().selection).toContain(id);
    expect(useStore.getState().selection).toHaveLength(1);
  });

  it('SEL-2: clearSelection empties selection', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    useStore.getState().select(id);
    expect(useStore.getState().selection).toHaveLength(1);

    useStore.getState().clearSelection();

    expect(useStore.getState().selection).toHaveLength(0);
  });

  it('SEL-3: setSelectedVoxel tracks containerId + index', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const voxelRef = { containerId: id, index: 9 };

    useStore.getState().setSelectedVoxel(voxelRef);

    const sv = useStore.getState().selectedVoxel;
    expect(sv).toBeDefined();
    expect(sv!.containerId).toBe(id);
    expect((sv as any).index).toBe(9);
  });

  it('SEL-4: selection persists across setViewMode', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    useStore.getState().select(id);

    useStore.getState().setViewMode(ViewMode.Blueprint);

    expect(useStore.getState().selection).toContain(id);
    expect(useStore.getState().viewMode).toBe(ViewMode.Blueprint);
  });

  it('SEL-5: selectMultiple sets multiple IDs in selection', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40);
    const id2 = useStore.getState().addContainer(ContainerSize.Standard40);

    useStore.getState().selectMultiple([id1, id2]);

    const sel = useStore.getState().selection;
    expect(sel).toContain(id1);
    expect(sel).toContain(id2);
    expect(sel).toHaveLength(2);
  });
});
