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

describe('FaceFinish store actions', () => {
  beforeEach(() => resetStore());

  it('setFaceFinish sets a finish on a voxel face', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { material: 'wood', paint: '#E8DDD0' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.material).toBe('wood');
    expect(v.faceFinishes?.n?.paint).toBe('#E8DDD0');
  });

  it('setFaceFinish merges with existing finish', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { material: 'wood' });
    useStore.getState().setFaceFinish(id, 9, 'n', { paint: '#FF0000' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.material).toBe('wood');
    expect(v.faceFinishes?.n?.paint).toBe('#FF0000');
  });

  it('clearFaceFinish removes finish for a face', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { material: 'wood' });
    useStore.getState().clearFaceFinish(id, 9, 'n');
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n).toBeUndefined();
  });

  it('faceFinishes is undefined by default (no migration needed)', () => {
    const id = addTestContainer();
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes).toBeUndefined();
  });
});
