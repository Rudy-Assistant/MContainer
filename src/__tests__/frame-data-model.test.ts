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
import { resolveFrameProperty } from '@/config/frameMaterials';

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

describe('Frame Store Actions', () => {
  beforeEach(() => resetStore());

  it('FSA-1: setFrameDefaults sets container-level defaults', () => {
    const id = addContainer();
    useStore.getState().setFrameDefaults(id, { poleMaterial: 'Wood', railShape: 'Channel' });
    const c = useStore.getState().containers[id];
    expect(c.frameDefaults?.poleMaterial).toBe('Wood');
    expect(c.frameDefaults?.railShape).toBe('Channel');
    expect(c.frameDefaults?.poleShape).toBeUndefined();
  });

  it('FSA-2: setFrameElementOverride sets a pole override (key starts with l)', () => {
    const id = addContainer();
    useStore.getState().setFrameElementOverride(id, 'l0r1c2_ne', { visible: false, material: 'Concrete' });
    const c = useStore.getState().containers[id];
    expect(c.poleOverrides?.['l0r1c2_ne']).toEqual({ visible: false, material: 'Concrete' });
  });

  it('FSA-3: setFrameElementOverride sets a rail override (key starts with r)', () => {
    const id = addContainer();
    useStore.getState().setFrameElementOverride(id, 'r1c2_h', { material: 'Wood' });
    const c = useStore.getState().containers[id];
    expect(c.railOverrides?.['r1c2_h']).toEqual({ material: 'Wood' });
  });

  it('FSA-4: clearFrameElementOverride removes a pole override', () => {
    const id = addContainer();
    useStore.getState().setFrameElementOverride(id, 'l0r1c2_ne', { visible: false });
    useStore.getState().clearFrameElementOverride(id, 'l0r1c2_ne');
    const c = useStore.getState().containers[id];
    expect(c.poleOverrides?.['l0r1c2_ne']).toBeUndefined();
  });

  it('FSA-5: clearFrameElementOverride removes a rail override', () => {
    const id = addContainer();
    useStore.getState().setFrameElementOverride(id, 'r1c2_h', { material: 'Wood' });
    useStore.getState().clearFrameElementOverride(id, 'r1c2_h');
    const c = useStore.getState().containers[id];
    expect(c.railOverrides?.['r1c2_h']).toBeUndefined();
  });

  it('FSA-6: batchSetFrameOverrides applies config to multiple elements', () => {
    const id = addContainer();
    useStore.getState().batchSetFrameOverrides(id, ['r0c0_h', 'r0c1_h', 'r0c2_h'], { material: 'Aluminum' });
    const c = useStore.getState().containers[id];
    expect(c.railOverrides?.['r0c0_h']?.material).toBe('Aluminum');
    expect(c.railOverrides?.['r0c1_h']?.material).toBe('Aluminum');
    expect(c.railOverrides?.['r0c2_h']?.material).toBe('Aluminum');
  });

  it('FSA-7: Override resolution: element override > frameDefaults > theme', () => {
    const id = addContainer();
    useStore.getState().setFrameDefaults(id, { poleMaterial: 'Wood' });
    useStore.getState().setFrameElementOverride(id, 'l0r1c2_ne', { material: 'Concrete' });
    const c = useStore.getState().containers[id];
    expect(c.poleOverrides?.['l0r1c2_ne']?.material).toBe('Concrete');
    expect(c.frameDefaults?.poleMaterial).toBe('Wood');
  });
});

describe('Override Resolution (pure function)', () => {
  beforeEach(() => resetStore());

  it('FSA-8: resolveFrameProperty cascades element > frameDefaults > theme', () => {
    // resolveFrameProperty imported at top level
    const defaults = { poleMaterial: 'Wood', poleShape: 'Square' };
    const override = { material: 'Concrete' };
    expect(resolveFrameProperty(override, defaults, 'pole', 'material')).toBe('Concrete');
    expect(resolveFrameProperty(override, defaults, 'pole', 'shape')).toBe('Square');
    expect(resolveFrameProperty(undefined, undefined, 'pole', 'material')).toBe('Steel');
  });

  it('FSA-9: resolveFrameProperty works for rails', () => {
    // resolveFrameProperty imported at top level
    const defaults = { railMaterial: 'Aluminum' };
    expect(resolveFrameProperty(undefined, defaults, 'rail', 'material')).toBe('Aluminum');
    expect(resolveFrameProperty(undefined, undefined, 'rail', 'shape')).toBe('Round');
  });
});
