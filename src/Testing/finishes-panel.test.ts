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

describe('FinishesPanel store integration', () => {
  beforeEach(() => resetStore());

  it('setFaceFinish with paint updates voxel and adds recent item', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { paint: '#FF0000' });
    useStore.getState().addRecentItem({ type: 'finish', value: 'paint:#FF0000', label: 'Red Paint' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.paint).toBe('#FF0000');
    expect(useStore.getState().recentItems[0].value).toBe('paint:#FF0000');
  });

  it('setFaceFinish with material updates voxel', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { material: 'wood' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.material).toBe('wood');
  });

  it('setFaceFinish with electrical updates voxel', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { electrical: 'outlet' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.electrical).toBe('outlet');
  });

  it('setFaceFinish with light fixture on ceiling', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'top', { light: 'pendant', lightColor: 'warm' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.top?.light).toBe('pendant');
    expect(v.faceFinishes?.top?.lightColor).toBe('warm');
  });

  it('setFaceFinish with door style', () => {
    const id = addTestContainer();
    const s = useStore.getState();
    if (typeof s.setVoxelFace === 'function') {
      s.setVoxelFace(id, 9, 'n', 'Door');
    } else if (typeof s.paintFace === 'function') {
      s.paintFace(id, 9, 'n', 'Door');
    }
    useStore.getState().setFaceFinish(id, 9, 'n', { doorStyle: 'barn' });
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n?.doorStyle).toBe('barn');
  });

  it('clearFaceFinish removes all finish data for face', () => {
    const id = addTestContainer();
    useStore.getState().setFaceFinish(id, 9, 'n', { paint: '#FF0000', electrical: 'outlet' });
    useStore.getState().clearFaceFinish(id, 9, 'n');
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faceFinishes?.n).toBeUndefined();
  });
});
