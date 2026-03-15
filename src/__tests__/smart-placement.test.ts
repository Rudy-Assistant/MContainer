/**
 * Smart Placement Tests
 *
 * Tests for addContainer auto-offset when position overlaps.
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
import { ContainerSize } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('Smart Placement Auto-Offset', () => {
  beforeEach(() => resetStore());

  it('PLACE-1: addContainer auto-offsets when position overlaps', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const c1 = useStore.getState().containers[id1];
    const c2 = useStore.getState().containers[id2];
    // Positions should differ (auto-offset applied)
    const samePos = c1.position.x === c2.position.x && c1.position.z === c2.position.z && c1.position.y === c2.position.y;
    expect(samePos).toBe(false);
  });

  it('PLACE-2: addContainer at empty origin does NOT offset', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const c = useStore.getState().containers[id];
    expect(c.position.x).toBe(0);
    expect(c.position.z).toBe(0);
  });

  it('PLACE-3: three containers at origin get unique positions', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id3 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const positions = [id1, id2, id3].map(id => {
      const c = useStore.getState().containers[id];
      return `${c.position.x.toFixed(2)}_${c.position.y.toFixed(2)}_${c.position.z.toFixed(2)}`;
    });
    const unique = new Set(positions);
    expect(unique.size).toBe(3);
  });

  it('PLACE-4: all directions blocked → stacks vertically', () => {
    // Place containers in all 4 cardinal offset positions
    // Offsets must match smart placement: dims.length + dims.height + 0.05
    // For HC40: 12.19 + 2.90 + 0.05 = 15.14 (X), 2.44 + 2.90 + 0.05 = 5.39 (Z)
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 15.14, y: 0, z: 0 });
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: -15.14, y: 0, z: 0 });
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 5.39 });
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: -5.39 });
    // Now try to place at origin — all 4 directions should be blocked
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const c = useStore.getState().containers[id];
    // Should have been stacked vertically (y > 0)
    expect(c.position.y).toBeGreaterThan(0);
  });

  it('PLACE-5: non-overlapping position places without offset', () => {
    useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 20, y: 0, z: 0 });
    const c2 = useStore.getState().containers[id2];
    expect(c2.position.x).toBe(20);
    expect(c2.position.z).toBe(0);
  });
});
