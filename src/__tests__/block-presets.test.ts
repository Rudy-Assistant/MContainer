import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { BLOCK_PRESETS } from '@/config/blockPresets';
import { ContainerSize } from '@/types/container';

function resetStore() {
  const s = useStore.getState();
  Object.keys(s.containers).forEach(id => s.removeContainer(id));
  s.addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: 0 });
}

function getContainerId(): string {
  return Object.keys(useStore.getState().containers)[0];
}

describe('applyBlockConfig — single voxel', () => {
  beforeEach(resetStore);

  it('applies Void preset: all 6 faces Open, voxel inactive', () => {
    const cid = getContainerId();
    useStore.getState().applyBlockConfig(cid, [9], 'void');
    const v = useStore.getState().containers[cid]!.voxelGrid![9];
    expect(v.active).toBe(false);
    expect(v.faces).toEqual({ top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' });
  });

  it('applies Railing preset: deck + cable on all 4 walls', () => {
    const cid = getContainerId();
    useStore.getState().applyBlockConfig(cid, [10], 'railing');
    const v = useStore.getState().containers[cid]!.voxelGrid![10];
    expect(v.active).toBe(true);
    expect(v.faces.bottom).toBe('Deck_Wood');
    expect(v.faces.n).toBe('Railing_Cable');
    expect(v.faces.e).toBe('Railing_Cable');
  });

  it('skips locked voxels', () => {
    const cid = getContainerId();
    useStore.getState().toggleVoxelLock(cid, 9);
    const before = { ...useStore.getState().containers[cid]!.voxelGrid![9].faces };
    useStore.getState().applyBlockConfig(cid, [9], 'void');
    const after = useStore.getState().containers[cid]!.voxelGrid![9].faces;
    expect(after).toEqual(before);
  });

  it('all 8 presets apply to single voxel matching BLOCK_PRESETS face maps', () => {
    const cid = getContainerId();
    for (const preset of BLOCK_PRESETS) {
      useStore.getState().applyBlockConfig(cid, [12], preset.id);
      const v = useStore.getState().containers[cid]!.voxelGrid![12];
      expect(v.faces).toEqual(preset.faces);
      expect(v.active).toBe(preset.active);
    }
  });
});

describe('applyBlockConfig — bay boundary', () => {
  beforeEach(resetStore);

  it('body_0 bay (indices 9,10,17,18): internal walls become Open', () => {
    const cid = getContainerId();
    useStore.getState().applyBlockConfig(cid, [9, 10, 17, 18], 'railing');
    const grid = useStore.getState().containers[cid]!.voxelGrid!;

    // Voxel 9 (row1, col1) — boundary: west(row=min), north(col=min)
    expect(grid[9].faces.w).toBe('Railing_Cable');
    expect(grid[9].faces.n).toBe('Railing_Cable');
    expect(grid[9].faces.e).toBe('Open');
    expect(grid[9].faces.s).toBe('Open');

    // Voxel 18 (row2, col2) — boundary: east(row=max), south(col=max)
    expect(grid[18].faces.e).toBe('Railing_Cable');
    expect(grid[18].faces.s).toBe('Railing_Cable');
    expect(grid[18].faces.w).toBe('Open');
    expect(grid[18].faces.n).toBe('Open');

    // Top/bottom applied to all
    expect(grid[9].faces.top).toBe('Solid_Steel');
    expect(grid[18].faces.bottom).toBe('Deck_Wood');
  });
});
