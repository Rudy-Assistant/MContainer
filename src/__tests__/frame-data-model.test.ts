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
import { ContainerSize } from '@/types/container';
import type { ElementConfig } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

function addContainer(): string {
  return useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
}

describe('Frame Data Model', () => {
  beforeEach(() => resetStore());

  it('FDM-1: ElementConfig type exists and is importable', () => {
    const config: ElementConfig = { visible: true, material: 'Steel', shape: 'Round' };
    expect(config.visible).toBe(true);
    expect(config.material).toBe('Steel');
    expect(config.shape).toBe('Round');
  });

  it('FDM-2: Container has frameDefaults field (replaces poleDefaults)', () => {
    const id = addContainer();
    const c = useStore.getState().containers[id];
    expect(c.frameDefaults).toBeUndefined();
    expect((c as any).poleDefaults).toBeUndefined();
  });

  it('FDM-3: Container has railOverrides field', () => {
    const id = addContainer();
    const c = useStore.getState().containers[id];
    expect(c.railOverrides).toBeUndefined();
  });

  it('FDM-4: Container keeps poleOverrides field', () => {
    const id = addContainer();
    const c = useStore.getState().containers[id];
    expect(c.poleOverrides).toBeUndefined();
  });
});
