import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';

function resetStore() {
  useStore.setState({
    hoveredObjectId: null,
    hoveredFormId: null,
    selectedObjectId: null,
    selection: [],
    sceneObjects: {},
    activePlacementFormId: null,
  });
}

describe('object interaction store atoms', () => {
  beforeEach(resetStore);

  it('setHoveredObjectId sets and clears', () => {
    useStore.getState().setHoveredObjectId('obj-1');
    expect(useStore.getState().hoveredObjectId).toBe('obj-1');
    useStore.getState().setHoveredObjectId(null);
    expect(useStore.getState().hoveredObjectId).toBeNull();
  });

  it('setHoveredFormId sets and clears', () => {
    useStore.getState().setHoveredFormId('door_single_swing');
    expect(useStore.getState().hoveredFormId).toBe('door_single_swing');
    useStore.getState().setHoveredFormId(null);
    expect(useStore.getState().hoveredFormId).toBeNull();
  });
});

describe('Tab cycling logic', () => {
  beforeEach(resetStore);

  function setupObjects(containerIds: string[], objectAnchors: { id: string; containerId: string }[]) {
    const containers: Record<string, any> = {};
    for (const cid of containerIds) {
      containers[cid] = { id: cid, size: '40ft_high_cube', voxelGrid: [], level: 0 };
    }
    const sceneObjects: Record<string, any> = {};
    for (const obj of objectAnchors) {
      sceneObjects[obj.id] = {
        id: obj.id,
        formId: 'door_single_swing',
        skin: {},
        anchor: { containerId: obj.containerId, voxelIndex: 9, type: 'face', face: 'n' },
      };
    }
    useStore.setState({ containers, sceneObjects });
  }

  // Pure logic helper matching what Scene.tsx will implement
  function getNextObjectId(
    sceneObjects: Record<string, any>,
    containerId: string,
    currentId: string | null,
    reverse: boolean,
  ): string | null {
    const ids = Object.entries(sceneObjects)
      .filter(([, obj]) => obj.anchor.containerId === containerId)
      .map(([id]) => id)
      .sort();
    if (ids.length === 0) return null;
    if (!currentId || !ids.includes(currentId)) return ids[0];
    const idx = ids.indexOf(currentId);
    const next = reverse
      ? (idx - 1 + ids.length) % ids.length
      : (idx + 1) % ids.length;
    return ids[next];
  }

  it('returns first object when nothing selected', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
    ]);
    const result = getNextObjectId(useStore.getState().sceneObjects, 'c1', null, false);
    expect(result).toBe('aaa');
  });

  it('advances to next object', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
      { id: 'ccc', containerId: 'c1' },
    ]);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'aaa', false)).toBe('bbb');
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'bbb', false)).toBe('ccc');
  });

  it('wraps around forward', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
    ]);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'bbb', false)).toBe('aaa');
  });

  it('wraps around reverse (Shift+Tab)', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
    ]);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'aaa', true)).toBe('bbb');
  });

  it('returns null for empty container', () => {
    setupObjects(['c1'], []);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', null, false)).toBeNull();
  });

  it('only considers objects in the target container', () => {
    setupObjects(['c1', 'c2'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c2' },
    ]);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', null, false)).toBe('aaa');
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'aaa', false)).toBe('aaa');
  });

  it('recovers from stale selectedObjectId', () => {
    setupObjects(['c1'], [
      { id: 'aaa', containerId: 'c1' },
      { id: 'bbb', containerId: 'c1' },
    ]);
    expect(getNextObjectId(useStore.getState().sceneObjects, 'c1', 'deleted-id', false)).toBe('aaa');
  });
});
