import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

function resetStore() {
  useStore.setState({
    containers: {},
    zones: {},
    furnitureIndex: {},
    selection: [],
    globalCullSet: new Set(),
  } as any);
}

describe('Interior Lights State', () => {
  let containerId: string;

  beforeEach(() => {
    resetStore();
    containerId = useStore.getState().addContainer();
  });

  it('container starts with empty lights array', () => {
    const container = useStore.getState().containers[containerId];
    expect(container.lights ?? []).toEqual([]);
  });

  it('addLight adds a ceiling light', () => {
    useStore.getState().addLight(containerId, 0, 'ceiling');
    const container = useStore.getState().containers[containerId];
    expect(container.lights).toEqual([{ voxelIndex: 0, type: 'ceiling' }]);
  });

  it('addLight adds a lamp', () => {
    useStore.getState().addLight(containerId, 5, 'lamp');
    const container = useStore.getState().containers[containerId];
    expect(container.lights).toEqual([{ voxelIndex: 5, type: 'lamp' }]);
  });

  it('removeLight removes by voxelIndex', () => {
    useStore.getState().addLight(containerId, 0, 'ceiling');
    useStore.getState().addLight(containerId, 5, 'lamp');
    useStore.getState().removeLight(containerId, 0);
    const container = useStore.getState().containers[containerId];
    expect(container.lights).toEqual([{ voxelIndex: 5, type: 'lamp' }]);
  });

  it('addLight prevents duplicate on same voxel', () => {
    useStore.getState().addLight(containerId, 0, 'ceiling');
    useStore.getState().addLight(containerId, 0, 'lamp');
    const container = useStore.getState().containers[containerId];
    expect(container.lights?.length).toBe(1);
  });
});
