/**
 * Paint / Voxel Face Tests (PAINT-1 through PAINT-8)
 *
 * Real store actions, real state assertions. No source scanning.
 * Mocks: idb-keyval (no IndexedDB in Node).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('idb-keyval', () => {
  const store = new Map<string, unknown>();
  return {
    get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn((key: string, val: unknown) => { store.set(key, val); return Promise.resolve(); }),
    del: vi.fn((key: string) => { store.delete(key); return Promise.resolve(); }),
  };
});

import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';
import type { SurfaceType, VoxelFaces } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

/** Return a core voxel index (level 0, row 1, col 1) — guaranteed active. */
function coreVoxelIndex(): number {
  return 1 * VOXEL_COLS + 1; // row=1, col=1
}

describe('Paint / Voxel Faces', () => {
  beforeEach(() => {
    resetStore();
  });

  it('PAINT-1: setVoxelFace changes a single face on a voxel', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const idx = coreVoxelIndex();

    useStore.getState().setVoxelFace(id, idx, 'n', 'Glass_Pane');

    const voxel = useStore.getState().containers[id].voxelGrid![idx];
    expect(voxel.faces.n).toBe('Glass_Pane');
  });

  it('PAINT-2: setVoxelFace persists after re-read', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const idx = coreVoxelIndex();

    useStore.getState().setVoxelFace(id, idx, 'e', 'Railing_Cable');

    // Re-read from store (not a cached reference)
    const face = useStore.getState().containers[id].voxelGrid![idx].faces.e;
    expect(face).toBe('Railing_Cable');
  });

  it('PAINT-3: cycleVoxelFace cycles through surface types for a wall face', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const idx = coreVoxelIndex();

    // Core voxel walls start as Solid_Steel
    const before = useStore.getState().containers[id].voxelGrid![idx].faces.n;
    expect(before).toBe('Solid_Steel');

    useStore.getState().cycleVoxelFace(id, idx, 'n');

    const after = useStore.getState().containers[id].voxelGrid![idx].faces.n;
    // Should have advanced to next in WALL_CYCLE after Solid_Steel
    expect(after).not.toBe('Solid_Steel');
    expect(after).toBe('Window_Half'); // WALL_CYCLE: Solid_Steel -> Window_Half
  });

  it('PAINT-4: setVoxelAllFaces sets all 6 faces to the same material', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const idx = coreVoxelIndex();

    useStore.getState().setVoxelAllFaces(id, idx, 'Concrete');

    const faces = useStore.getState().containers[id].voxelGrid![idx].faces;
    expect(faces.top).toBe('Concrete');
    expect(faces.bottom).toBe('Concrete');
    expect(faces.n).toBe('Concrete');
    expect(faces.s).toBe('Concrete');
    expect(faces.e).toBe('Concrete');
    expect(faces.w).toBe('Concrete');
  });

  it('PAINT-5: resetVoxelGrid restores default voxel grid', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const idx = coreVoxelIndex();

    // Modify a face
    useStore.getState().setVoxelFace(id, idx, 'n', 'Glass_Pane');
    expect(useStore.getState().containers[id].voxelGrid![idx].faces.n).toBe('Glass_Pane');

    // Reset
    useStore.getState().resetVoxelGrid(id);

    // Should be back to default (Solid_Steel for core wall faces)
    expect(useStore.getState().containers[id].voxelGrid![idx].faces.n).toBe('Solid_Steel');
  });

  it('PAINT-6: paintFace applies surface to a single voxel face', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const idx = coreVoxelIndex();

    useStore.getState().paintFace(id, idx, 'w', 'Wood_Hinoki');

    const face = useStore.getState().containers[id].voxelGrid![idx].faces.w;
    expect(face).toBe('Wood_Hinoki');
  });

  it('PAINT-7: initial voxel grid body voxels have Solid_Steel walls', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const grid = useStore.getState().containers[id].voxelGrid!;

    // Check all core voxels at level 0 (rows 1-2, cols 1-6)
    for (let row = 1; row <= 2; row++) {
      for (let col = 1; col <= 6; col++) {
        const idx = row * VOXEL_COLS + col;
        const voxel = grid[idx];
        expect(voxel.active).toBe(true);
        expect(voxel.faces.n).toBe('Solid_Steel');
        expect(voxel.faces.s).toBe('Solid_Steel');
        expect(voxel.faces.e).toBe('Solid_Steel');
        expect(voxel.faces.w).toBe('Solid_Steel');
      }
    }
  });

  it('PAINT-8: stampArea applies faces to multiple voxels', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const indices = [coreVoxelIndex(), coreVoxelIndex() + 1, coreVoxelIndex() + 2];
    const faces: VoxelFaces = {
      top: 'Open', bottom: 'Deck_Wood',
      n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane',
    };

    useStore.getState().stampArea(id, indices, faces);

    for (const idx of indices) {
      const voxel = useStore.getState().containers[id].voxelGrid![idx];
      expect(voxel.faces.n).toBe('Glass_Pane');
      expect(voxel.faces.top).toBe('Open');
      expect(voxel.faces.bottom).toBe('Deck_Wood');
      expect(voxel.active).toBe(true);
    }
  });
});
