import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

/**
 * Phase 4 — hinged wall animation state. Stores `openAmount` (0..1) per
 * voxel face under `voxel.hingedConfig`. The renderer reads this and lerps
 * the panel rotation each frame. UI toggles between 0 and 1; tests pin the
 * data-layer contract.
 */
describe('hingedConfig store action', () => {
  beforeEach(resetStore);

  function makeContainer() {
    const id = useStore.getState().addContainer(ContainerSize.Standard40);
    if (!id) throw new Error('addContainer returned null');
    return id;
  }

  it('voxels start with no hingedConfig', () => {
    const cId = makeContainer();
    const voxel = useStore.getState().containers[cId].voxelGrid?.[9];
    expect(voxel?.hingedConfig).toBeUndefined();
  });

  it('setHingedConfig writes openAmount on the chosen face', () => {
    const cId = makeContainer();
    useStore.getState().setHingedConfig(cId, 9, 'n', { openAmount: 1 });
    const voxel = useStore.getState().containers[cId].voxelGrid?.[9];
    expect(voxel?.hingedConfig?.n?.openAmount).toBe(1);
  });

  it('setHingedConfig clamps out-of-range values to [0,1]', () => {
    const cId = makeContainer();
    useStore.getState().setHingedConfig(cId, 9, 'n', { openAmount: 5 });
    expect(useStore.getState().containers[cId].voxelGrid?.[9]?.hingedConfig?.n?.openAmount).toBe(1);
    useStore.getState().setHingedConfig(cId, 9, 'n', { openAmount: -3 });
    expect(useStore.getState().containers[cId].voxelGrid?.[9]?.hingedConfig?.n?.openAmount).toBe(0);
  });

  it('setHingedConfig merges with existing entry on the same face', () => {
    const cId = makeContainer();
    useStore.getState().setHingedConfig(cId, 9, 'n', { openAmount: 0.4 });
    // Empty partial keeps existing openAmount (defaults to existing then 0).
    useStore.getState().setHingedConfig(cId, 9, 'n', {});
    expect(useStore.getState().containers[cId].voxelGrid?.[9]?.hingedConfig?.n?.openAmount).toBe(0.4);
  });

  it('setHingedConfig does not leak across faces', () => {
    const cId = makeContainer();
    useStore.getState().setHingedConfig(cId, 9, 'n', { openAmount: 1 });
    const v = useStore.getState().containers[cId].voxelGrid?.[9];
    expect(v?.hingedConfig?.n?.openAmount).toBe(1);
    expect(v?.hingedConfig?.s).toBeUndefined();
    expect(v?.hingedConfig?.e).toBeUndefined();
  });

  it('setHingedConfig with null clears the face entry', () => {
    const cId = makeContainer();
    useStore.getState().setHingedConfig(cId, 9, 'n', { openAmount: 1 });
    useStore.getState().setHingedConfig(cId, 9, 'n', null);
    const v = useStore.getState().containers[cId].voxelGrid?.[9];
    expect(v?.hingedConfig?.n).toBeUndefined();
  });

  it('setHingedConfig with null on a missing face is a no-op', () => {
    const cId = makeContainer();
    const before = useStore.getState().containers[cId].voxelGrid?.[9];
    useStore.getState().setHingedConfig(cId, 9, 'e', null);
    const after = useStore.getState().containers[cId].voxelGrid?.[9];
    expect(after?.hingedConfig).toBe(before?.hingedConfig);
  });

  it('setHingedConfig on missing container is a no-op (does not throw)', () => {
    expect(() => useStore.getState().setHingedConfig('not-a-real-id', 9, 'n', { openAmount: 1 })).not.toThrow();
  });

  it('setHingedConfig persists through subsequent face mutations on the same voxel', () => {
    const cId = makeContainer();
    useStore.getState().setHingedConfig(cId, 9, 'n', { openAmount: 1 });
    useStore.getState().setVoxelFace(cId, 9, 's', 'Glass_Pane');
    const v = useStore.getState().containers[cId].voxelGrid?.[9];
    expect(v?.hingedConfig?.n?.openAmount).toBe(1);
    expect(v?.faces.s).toBe('Glass_Pane');
  });
});
