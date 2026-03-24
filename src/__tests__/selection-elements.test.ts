import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('selectedElements — typed selection context', () => {
  beforeEach(resetStore);

  it('starts null', () => {
    expect(useStore.getState().selectedElements).toBeNull();
  });

  it('setSelectedElements stores typed selection', () => {
    const sel = { type: 'voxel' as const, items: [{ containerId: 'c1', id: '10' }] };
    useStore.getState().setSelectedElements(sel);
    expect(useStore.getState().selectedElements).toEqual(sel);
  });

  it('type change clears previous items', () => {
    useStore.getState().setSelectedElements({ type: 'wall', items: [{ containerId: 'c1', id: '10:n' }] });
    useStore.getState().setSelectedElements({ type: 'floor', items: [{ containerId: 'c1', id: '10' }] });
    expect(useStore.getState().selectedElements?.type).toBe('floor');
    expect(useStore.getState().selectedElements?.items).toHaveLength(1);
  });

  it('toggleElement adds to same type', () => {
    useStore.getState().setSelectedElements({ type: 'voxel', items: [{ containerId: 'c1', id: '10' }] });
    useStore.getState().toggleElement('c1', '11');
    expect(useStore.getState().selectedElements?.items).toHaveLength(2);
  });

  it('toggleElement removes existing item', () => {
    useStore.getState().setSelectedElements({ type: 'voxel', items: [{ containerId: 'c1', id: '10' }, { containerId: 'c1', id: '11' }] });
    useStore.getState().toggleElement('c1', '10');
    expect(useStore.getState().selectedElements?.items).toHaveLength(1);
    expect(useStore.getState().selectedElements?.items[0].id).toBe('11');
  });

  it('setSelectedElements(null) clears selection', () => {
    useStore.getState().setSelectedElements({ type: 'voxel', items: [{ containerId: 'c1', id: '10' }] });
    useStore.getState().setSelectedElements(null);
    expect(useStore.getState().selectedElements).toBeNull();
  });
});
