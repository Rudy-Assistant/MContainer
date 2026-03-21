import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '../store/useStore';
import { ContainerSize } from '../types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}
function addTestContainer() {
  return useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
}

describe('Light fixture integration', () => {
  beforeEach(() => resetStore());

  it('setting light fixture stores the value on top face finish', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'top', { light: 'pendant' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.top?.light).toBe('pendant');
  });

  it('setting light color stores the value', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'top', { light: 'flush', lightColor: 'warm' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.top?.lightColor).toBe('warm');
  });

  it('clearing finish removes light fixture', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'top', { light: 'track' });
    useStore.getState().clearFaceFinish(id, 9, 'top');
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.top).toBeUndefined();
  });
});
