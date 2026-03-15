/**
 * Stacking Tests (STACK-1 through STACK-5)
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
import { ContainerSize, CONTAINER_DIMENSIONS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('Container Stacking', () => {
  beforeEach(() => {
    resetStore();
  });

  it('STACK-1: stackContainer places L1 at Y = bottom.height', () => {
    const bottomId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    useStore.getState().stackContainer(topId, bottomId);

    const top = useStore.getState().containers[topId];
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    expect(top.position.y).toBeCloseTo(dims.height, 2);
  });

  it('STACK-2: stacked container has level=1 and stackedOn set', () => {
    const bottomId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    useStore.getState().stackContainer(topId, bottomId);

    const top = useStore.getState().containers[topId];
    expect(top.level).toBe(1);
    expect(top.stackedOn).toBe(bottomId);
  });

  it('STACK-3: bottom container supporting array includes top container', () => {
    const bottomId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    useStore.getState().stackContainer(topId, bottomId);

    const bottom = useStore.getState().containers[bottomId];
    expect(bottom.supporting).toContain(topId);
  });

  it('STACK-4: unstackContainer resets level=0, stackedOn=null, y=0', () => {
    const bottomId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().stackContainer(topId, bottomId);

    useStore.getState().unstackContainer(topId);

    const top = useStore.getState().containers[topId];
    expect(top.level).toBe(0);
    expect(top.stackedOn).toBeNull();
    expect(top.position.y).toBe(0);

    // Bottom should no longer list top as supporting
    const bottom = useStore.getState().containers[bottomId];
    expect(bottom.supporting).not.toContain(topId);
  });

  it('STACK-5: stackContainer on non-existent ID returns false', () => {
    const bottomId = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    const result = useStore.getState().stackContainer('non-existent-id', bottomId);
    expect(result).toBe(false);

    const result2 = useStore.getState().stackContainer(bottomId, 'non-existent-id');
    expect(result2).toBe(false);
  });
});
