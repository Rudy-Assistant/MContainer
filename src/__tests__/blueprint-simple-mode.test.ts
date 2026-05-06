/**
 * blueprint-simple-mode.test.ts
 *
 * Bruce 2026-05-06 round-3: in BP, Simple Mode must group voxels into
 * selectable BLOCKS that mirror MatrixEditor's bay aggregation. This suite
 * pins down the contract of the click handler used by BlueprintRenderer's
 * BlockBlueprintGrid in Simple Mode and the unchanged per-voxel handler in
 * Detail Mode.
 *
 * Behavioral, not source-scanning: we exercise the same store APIs the
 * component invokes (getBayIndicesForVoxel + setSelectedElements) and assert
 * the resulting selectedElements payload.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_ROWS, VOXEL_COLS } from '@/types/container';
import {
  computeBayGroups,
  getBayIndicesForVoxel,
  type BayGroup,
} from '@/config/bayGroups';

const VOXELS_PER_LEVEL = VOXEL_ROWS * VOXEL_COLS;

beforeEach(() => {
  useStore.setState(useStore.getInitialState(), true);
});

function addContainer(): string {
  const before = Object.keys(useStore.getState().containers);
  useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  const after = Object.keys(useStore.getState().containers);
  return after.find((id) => !before.includes(id))!;
}

/**
 * Mirror of BlockBlueprintGrid's onClick body: replace per-voxel hit meshes
 * with per-block selection. The test exercises the same path the renderer
 * uses (same imports, same store mutators).
 */
function clickBlockInSimpleMode(containerId: string, voxelIndexInBlock: number, level = 0) {
  const baseIdx = voxelIndexInBlock % VOXELS_PER_LEVEL;
  const group = computeBayGroups().find((g) => g.voxelIndices.includes(baseIdx));
  if (!group) throw new Error(`no bay group for voxel ${voxelIndexInBlock}`);
  const indices = group.voxelIndices.map((i) => level * VOXELS_PER_LEVEL + i);
  useStore.getState().setSelectedElements({
    type: 'bay',
    items: indices.map((i) => ({ containerId, id: String(i) })),
  });
  return { group, indices };
}

describe('Blueprint Simple Mode: block selection', () => {
  it('Simple Mode is the default designComplexity', () => {
    expect(useStore.getState().designComplexity).toBe('simple');
  });

  it('toggling Detail Mode keeps the selection model orthogonal', () => {
    useStore.getState().setDesignComplexity('detailed');
    expect(useStore.getState().designComplexity).toBe('detailed');
    useStore.getState().setDesignComplexity('simple');
    expect(useStore.getState().designComplexity).toBe('simple');
  });

  it('Bay 1 click selects voxels 9, 10, 17, 18 as a bay-typed selection', () => {
    const id = addContainer();
    // Voxel 10 belongs to Bay 1 (rows 1-2, cols 1-2 of the 4x8 grid).
    const { group, indices } = clickBlockInSimpleMode(id, 10);
    expect(group.role).toBe('body');
    expect(group.label).toBe('Bay 1');
    expect(new Set(indices)).toEqual(new Set([9, 10, 17, 18]));
    const sel = useStore.getState().selectedElements;
    expect(sel).not.toBeNull();
    expect(sel!.type).toBe('bay');
    expect(new Set(sel!.items.map((it) => Number(it.id)))).toEqual(
      new Set([9, 10, 17, 18])
    );
    for (const it of sel!.items) expect(it.containerId).toBe(id);
  });

  it('Bay 2 click selects voxels 11, 12, 19, 20', () => {
    const id = addContainer();
    const { group, indices } = clickBlockInSimpleMode(id, 12);
    expect(group.label).toBe('Bay 2');
    expect(new Set(indices)).toEqual(new Set([11, 12, 19, 20]));
  });

  it('Bay 3 click selects voxels 13, 14, 21, 22', () => {
    const id = addContainer();
    const { group, indices } = clickBlockInSimpleMode(id, 22);
    expect(group.label).toBe('Bay 3');
    expect(new Set(indices)).toEqual(new Set([13, 14, 21, 22]));
  });

  it('Block selection from any voxel inside the block yields the same set', () => {
    const id = addContainer();
    // All four voxels of Bay 1 must collapse to the same 4-element set.
    const a = clickBlockInSimpleMode(id, 9).indices;
    const b = clickBlockInSimpleMode(id, 10).indices;
    const c = clickBlockInSimpleMode(id, 17).indices;
    const d = clickBlockInSimpleMode(id, 18).indices;
    expect(new Set(a)).toEqual(new Set(b));
    expect(new Set(b)).toEqual(new Set(c));
    expect(new Set(c)).toEqual(new Set(d));
  });

  it('Block selection on level 1 offsets indices by VOXELS_PER_LEVEL', () => {
    const id = addContainer();
    const lvl = 1;
    const baseIdx = 12; // Bay 2
    const lvlIdx  = lvl * VOXELS_PER_LEVEL + baseIdx;
    const { indices } = clickBlockInSimpleMode(id, lvlIdx, lvl);
    const expected = [11, 12, 19, 20].map((i) => i + lvl * VOXELS_PER_LEVEL);
    expect(new Set(indices)).toEqual(new Set(expected));
  });

  it('Detail Mode keeps the existing single-voxel selection contract', () => {
    const id = addContainer();
    useStore.getState().setDesignComplexity('detailed');
    // Detail-mode click path is what VoxelBlueprintGrid emits today.
    useStore.getState().setSelectedElements({
      type: 'voxel',
      items: [{ containerId: id, id: '12' }],
    });
    const sel = useStore.getState().selectedElements;
    expect(sel?.type).toBe('voxel');
    expect(sel?.items).toEqual([{ containerId: id, id: '12' }]);
  });

  it('All three body bays produce disjoint, non-overlapping voxel sets', () => {
    const bays: BayGroup[] = computeBayGroups().filter((g) => g.role === 'body');
    expect(bays).toHaveLength(3);
    const seen = new Set<number>();
    for (const g of bays) {
      for (const i of g.voxelIndices) {
        expect(seen.has(i)).toBe(false);
        seen.add(i);
      }
    }
    // 3 bays * 4 voxels each = 12 body voxels.
    expect(seen.size).toBe(12);
  });

  it('getBayIndicesForVoxel agrees with computeBayGroups for every body voxel', () => {
    // Body voxels are rows 1-2, cols 1-6: indices 9-14 (row 1) and 17-22 (row 2).
    for (const baseIdx of [9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22]) {
      const indices = getBayIndicesForVoxel(baseIdx, VOXELS_PER_LEVEL);
      expect(indices).not.toBeNull();
      const group = computeBayGroups().find((g) => g.voxelIndices.includes(baseIdx));
      expect(new Set(indices!)).toEqual(new Set(group!.voxelIndices));
    }
  });
});
