/**
 * Brainstorm-deferred "AI-assisted placement": staggerContainers action.
 *
 * Selects N containers and offsets each by (i * offsetX, 0, i * offsetZ)
 * from the first container's position. The first container stays put;
 * subsequent ones move to staggered diagonal positions.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('staggerContainers (brainstorm deferred — AI auto-placement)', () => {
  beforeEach(() => resetStore());

  it('no-op when fewer than 2 ids are passed', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const before = useStore.getState().containers[id].position;
    useStore.getState().staggerContainers([id]);
    const after = useStore.getState().containers[id].position;
    expect(after).toEqual(before);
  });

  it('staggers 3 containers in a diagonal pattern using default offsets (1.5m)', () => {
    const a = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const b = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 5, y: 0, z: 5 }, 0, true);
    const c = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 9, y: 0, z: 9 }, 0, true);
    useStore.getState().staggerContainers([a, b, c]);
    const containers = useStore.getState().containers;
    expect(containers[a].position).toEqual({ x: 0, y: 0, z: 0 });
    expect(containers[b].position.x).toBeCloseTo(1.5, 5);
    expect(containers[b].position.z).toBeCloseTo(1.5, 5);
    expect(containers[c].position.x).toBeCloseTo(3.0, 5);
    expect(containers[c].position.z).toBeCloseTo(3.0, 5);
  });

  it('respects custom offsets', () => {
    const a = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const b = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 10, y: 0, z: 0 }, 0, true);
    useStore.getState().staggerContainers([a, b], 3, -2);
    const containers = useStore.getState().containers;
    expect(containers[b].position.x).toBeCloseTo(3, 5);
    expect(containers[b].position.z).toBeCloseTo(-2, 5);
  });

  it('preserves y position (height) — only x and z change', () => {
    const a = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const b = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 5, y: 2.9, z: 5 }, 1, true);
    useStore.getState().staggerContainers([a, b]);
    expect(useStore.getState().containers[b].position.y).toBe(2.9);
  });

  it('emits a destructive-action toast announcing the stagger', () => {
    const a = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    const b = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 5, y: 0, z: 5 }, 0, true);
    useStore.getState().staggerContainers([a, b]);
    const lda = useStore.getState().lastDestructiveAction;
    expect(lda?.description).toBe('Staggered 2 containers');
  });
});
