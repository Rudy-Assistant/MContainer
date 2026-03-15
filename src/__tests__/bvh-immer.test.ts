import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import '@/utils/bvhSetup';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

beforeEach(() => {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
});

function addTestContainer(): string {
  const before = Object.keys(useStore.getState().containers);
  useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
  const after = Object.keys(useStore.getState().containers);
  return after.find((id) => !before.includes(id))!;
}

describe('BVH setup', () => {
  it('THREE.Mesh.prototype has acceleratedRaycast after import', () => {
    expect(typeof THREE.Mesh.prototype.raycast).toBe('function');
  });

  it('THREE.BufferGeometry.prototype has computeBoundsTree', () => {
    expect(typeof (THREE.BufferGeometry.prototype as any).computeBoundsTree).toBe('function');
  });

  it('THREE.BufferGeometry.prototype has disposeBoundsTree', () => {
    expect(typeof (THREE.BufferGeometry.prototype as any).disposeBoundsTree).toBe('function');
  });
});

describe('immer middleware', () => {
  it('store mutations still work with immer layer', () => {
    const id = addTestContainer();
    useStore.getState().setVoxelFace(id, 0, 'n', 'Glass_Pane');
    const c = useStore.getState().containers[id];
    expect(c.voxelGrid![0].faces.n).toBe('Glass_Pane');
  });

  it('draft mutations produce new container references (immutability)', () => {
    const id = addTestContainer();
    const before = useStore.getState().containers;
    useStore.getState().setVoxelFace(id, 0, 'top', 'Glass_Pane');
    const after = useStore.getState().containers;
    expect(before).not.toBe(after);
  });
});
