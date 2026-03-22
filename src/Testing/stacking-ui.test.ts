import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

describe('Container stacking actions', () => {
  let baseId: string;

  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
    baseId = useStore.getState().addContainer(ContainerSize.HighCube40);
  });

  it('addContainer + stackContainer creates L1 on top of L0', () => {
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40);
    const result = useStore.getState().stackContainer(topId, baseId);
    expect(result).toBe(true);
    const top = useStore.getState().containers[topId];
    expect(top!.level).toBe(1);
    expect(top!.position.y).toBeGreaterThan(0);
    expect(top!.stackedOn).toBe(baseId);
  });

  it('unstackContainer detaches L1 and resets it to ground level', () => {
    const topId = useStore.getState().addContainer(ContainerSize.HighCube40);
    useStore.getState().stackContainer(topId, baseId);
    useStore.getState().unstackContainer(topId);
    const containers = useStore.getState().containers;
    const top = containers[topId];
    expect(top).toBeDefined();
    expect(top!.level).toBe(0);
    expect(top!.stackedOn).toBeNull();
    expect(top!.position.y).toBe(0);
  });
});
