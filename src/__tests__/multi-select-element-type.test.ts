import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { filterSelectableGridIndices, getRectangularGridRange } from '@/utils/gridSelection';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

/**
 * Regression coverage for the multi-select element-type constraint.
 *
 * The Matrix grid offers three multi-select gestures (Ctrl+click toggle,
 * Shift+click range, marquee drag). All three must:
 *   1. Never mix element types within a single selection.
 *   2. Never include inactive or locked cells.
 *   3. Promote single-voxel selections to 'bay' on Ctrl+click rather than
 *      mixing 'voxel' and 'bay' items.
 */
describe('multi-select element-type constraint', () => {
  beforeEach(resetStore);

  it('toggleElement with a new type discards the old selection', () => {
    const store = useStore.getState();
    store.setSelectedElements({ type: 'voxel', items: [{ containerId: 'c1', id: '10' }] });
    store.toggleElement('c1', '11', 'bay');
    const sel = useStore.getState().selectedElements;
    expect(sel).toEqual({ type: 'bay', items: [{ containerId: 'c1', id: '11' }] });
  });

  it('toggleElement keeps type stable when the second target shares the same type', () => {
    const store = useStore.getState();
    store.setSelectedElements({ type: 'bay', items: [{ containerId: 'c1', id: '10' }] });
    store.toggleElement('c1', '11', 'bay');
    const sel = useStore.getState().selectedElements;
    expect(sel?.type).toBe('bay');
    expect(sel?.items).toHaveLength(2);
  });

  it('toggleElement removes the item when toggled twice', () => {
    const store = useStore.getState();
    store.setSelectedElements({ type: 'bay', items: [
      { containerId: 'c1', id: '10' },
      { containerId: 'c1', id: '11' },
    ] });
    store.toggleElement('c1', '11', 'bay');
    const sel = useStore.getState().selectedElements;
    expect(sel?.items).toEqual([{ containerId: 'c1', id: '10' }]);
  });

  it('removing the last item nulls the selection so the panel returns to library state', () => {
    const store = useStore.getState();
    store.setSelectedElements({ type: 'bay', items: [{ containerId: 'c1', id: '10' }] });
    store.toggleElement('c1', '10', 'bay');
    expect(useStore.getState().selectedElements).toBeNull();
  });

  it('selectableRectangle composition excludes inactive + locked cells while preserving rect order', () => {
    // Simulate the MatrixEditor wiring: rect range from getRectangularGridRange,
    // then filter through a predicate that mirrors isSelectableVoxelIndex.
    const inactive = new Set([2, 9]);     // rectangle holes (inactive voxels)
    const locked = new Set([10]);         // user-locked cell — must drop out
    const isSelectable = (idx: number) => !inactive.has(idx) && !locked.has(idx);

    const rect = getRectangularGridRange(1, 10, 0, 8, 4);
    expect(rect).toEqual([1, 2, 9, 10]);

    const filtered = filterSelectableGridIndices(rect, isSelectable);
    expect(filtered).toEqual([1]);
  });

  it('filterSelectableGridIndices is idempotent on duplicate-free input', () => {
    const isSelectable = (idx: number) => idx >= 0;
    const indices = [1, 2, 3, 4];
    expect(filterSelectableGridIndices(indices, isSelectable)).toEqual(indices);
  });

  it('rectangle that crosses level boundary returns empty (single-level constraint)', () => {
    expect(getRectangularGridRange(31, 32, 0, 8, 4)).toEqual([]);
  });

  it('clearSelection wipes selectedElements + selectedFace', () => {
    const store = useStore.getState();
    store.setSelectedElements({ type: 'bay', items: [{ containerId: 'c1', id: '10' }] });
    store.setSelectedFace('n');
    store.clearSelection();
    const state = useStore.getState();
    expect(state.selectedElements).toBeNull();
    expect(state.selectedFace).toBeNull();
  });
});
