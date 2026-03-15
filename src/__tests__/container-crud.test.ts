/**
 * Container CRUD Tests (CRUD-1 through CRUD-8)
 *
 * Real store actions, real state assertions. No source scanning.
 * Mocks: idb-keyval (no IndexedDB in Node).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); }),
    del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  };
});

import { useStore } from '@/store/useStore';
import { ContainerSize, CONTAINER_DIMENSIONS, VOXEL_COUNT } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('Container CRUD', () => {
  beforeEach(() => {
    resetStore();
  });

  it('CRUD-1: addContainer creates container with correct size and position', () => {
    const pos = { x: 1, y: 0, z: 2 };
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, pos);

    const c = useStore.getState().containers[id];
    expect(c).toBeDefined();
    expect(c.size).toBe(ContainerSize.HighCube40);
    expect(c.position).toEqual(pos);
  });

  it('CRUD-2: addContainer generates voxelGrid with 64 voxels', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const c = useStore.getState().containers[id];

    expect(c.voxelGrid).toBeDefined();
    expect(c.voxelGrid!.length).toBe(VOXEL_COUNT);
  });

  it('CRUD-3: removeContainer deletes container and cleans up references', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    useStore.getState().select(id);
    expect(useStore.getState().selection).toContain(id);

    useStore.getState().removeContainer(id);

    expect(useStore.getState().containers[id]).toBeUndefined();
    expect(useStore.getState().selection).not.toContain(id);
  });

  it('CRUD-4: updateContainerPosition changes position', () => {
    const id = useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
    const newPos = { x: 5, y: 0, z: 10 };

    useStore.getState().updateContainerPosition(id, newPos);

    const c = useStore.getState().containers[id];
    expect(c.position).toEqual(newPos);
  });

  it('CRUD-5: updateContainerRotation cycles by Math.PI/2', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    expect(useStore.getState().containers[id].rotation).toBe(0);

    useStore.getState().updateContainerRotation(id, Math.PI / 2);

    expect(useStore.getState().containers[id].rotation).toBe(Math.PI / 2);
  });

  it('CRUD-6: stackContainer creates container at correct Y offset', () => {
    const bottomId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    const result = useStore.getState().stackContainer(topId, bottomId);

    expect(result).toBe(true);
    const top = useStore.getState().containers[topId];
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    expect(top.position.y).toBeCloseTo(dims.height, 2);
  });

  it('CRUD-7: unstackContainer resets stacked container to ground', () => {
    const bottomId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().stackContainer(topId, bottomId);

    useStore.getState().unstackContainer(topId);

    const top = useStore.getState().containers[topId];
    expect(top.level).toBe(0);
    expect(top.stackedOn).toBeNull();
    expect(top.position.y).toBe(0);
  });

  it('CRUD-8: addContainer with two containers — second gets unique ID', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    expect(id1).not.toBe(id2);
    expect(Object.keys(useStore.getState().containers)).toHaveLength(2);
  });
});
