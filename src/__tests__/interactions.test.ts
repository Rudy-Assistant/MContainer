/**
 * Two-Level Home Workflow Tests
 *
 * End-to-end behavioral tests for the core stacking + stairs + view mode workflow.
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
import { ContainerSize, CONTAINER_DIMENSIONS, ViewMode, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

describe('two-level home workflow', () => {
  beforeEach(() => resetStore());

  it('stackContainer positions upper container correctly', () => {
    const s = useStore.getState;
    const bottomId = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    s().stackContainer(topId, bottomId);

    const top = s().containers[topId];
    const dims = CONTAINER_DIMENSIONS[ContainerSize.HighCube40];
    expect(top.position.y).toBeCloseTo(dims.height, 2);
    expect(top.level).toBe(1);
    expect(top.stackedOn).toBe(bottomId);
    expect(s().containers[bottomId].supporting).toContain(topId);
  });

  it('applyStairsFromFace sets voxelType to stairs', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    s().applyStairsFromFace(id, 17, 'n');

    const voxel = s().containers[id].voxelGrid![17];
    expect(voxel.voxelType).toBe('stairs');
    expect(voxel.stairDir).toBeDefined();
    expect(voxel.stairAscending).toBeDefined();
  });

  it('stair ceiling void opens top face of stair voxel', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    s().applyStairsFromFace(id, 17, 'n');

    // Stair at level 0, voxel 17 — auto-punch should open floor of voxel above (level 1)
    const aboveIdx = VOXEL_ROWS * VOXEL_COLS + 17; // level 1, same local position
    const aboveVoxel = s().containers[id].voxelGrid![aboveIdx];
    expect(aboveVoxel.faces.bottom).toBe('Open');
  });

  it('cross-container stair void opens bottom face of upper container', () => {
    const s = useStore.getState;
    const bottomId = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    s().stackContainer(topId, bottomId);

    // Place stairs at level 0 — should cascade through auto-punch to top level,
    // then void the floor of the container above at the matching local index
    s().applyStairsFromFace(bottomId, 14, 'n');

    const upperVoxel = s().containers[topId].voxelGrid![14];
    expect(upperVoxel.faces.bottom).toBe('Open');
  });

  it('viewMode transitions correctly', () => {
    const s = useStore.getState;
    expect(s().viewMode).toBe(ViewMode.Realistic3D);

    s().setViewMode(ViewMode.Walkthrough);
    expect(s().viewMode).toBe(ViewMode.Walkthrough);

    s().setViewMode(ViewMode.Realistic3D);
    expect(s().viewMode).toBe(ViewMode.Realistic3D);
  });
});

describe('VoxelPreview sync', () => {
  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
  });

  it('setSelectedVoxel updates selectedVoxel in store', () => {
    const s = useStore.getState;
    const id = s().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });

    expect(s().selectedVoxel).toBeNull();

    s().setSelectedVoxel({ containerId: id, index: 10 });
    expect(s().selectedVoxel).toEqual({ containerId: id, index: 10 });

    s().setSelectedVoxel(null);
    expect(s().selectedVoxel).toBeNull();
  });
});

describe('palette system', () => {
  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
  });

  it('savePalette appends to palettes array', () => {
    const s = useStore.getState;
    const before = s().palettes.length;

    const newId = s().savePalette({
      name: 'Test Palette',
      isBuiltIn: false,
      steelColor: 0xff0000,
      steelMetalness: 0.5,
      steelRoughness: 0.5,
      frameColor: 0x00ff00,
      frameMetalness: 0.5,
      glassTransmission: 0.8,
      woodColor: 0x8b4513,
      groundPreset: 'grass',
    });

    expect(s().palettes.length).toBe(before + 1);
    expect(s().palettes.find(p => p.id === newId)).toBeDefined();
    expect(s().palettes.find(p => p.id === newId)!.name).toBe('Test Palette');
  });

  it('built-in palettes cannot be deleted', () => {
    const s = useStore.getState;
    const builtIns = s().palettes.filter(p => p.isBuiltIn);
    expect(builtIns.length).toBe(3);

    for (const p of builtIns) {
      s().deletePalette(p.id);
    }

    const afterDelete = s().palettes.filter(p => p.isBuiltIn);
    expect(afterDelete.length).toBe(3);
  });

  it('custom palettes can be deleted', () => {
    const s = useStore.getState;
    const newId = s().savePalette({
      name: 'Deletable',
      isBuiltIn: false,
      steelColor: 0xff0000,
      steelMetalness: 0.5,
      steelRoughness: 0.5,
      frameColor: 0x00ff00,
      frameMetalness: 0.5,
      glassTransmission: 0.8,
      woodColor: 0x8b4513,
      groundPreset: 'grass',
    });

    expect(s().palettes.find(p => p.id === newId)).toBeDefined();
    s().deletePalette(newId);
    expect(s().palettes.find(p => p.id === newId)).toBeUndefined();
  });
});

describe('fresh launch behavior', () => {
  beforeEach(() => {
    const initial = useStore.getInitialState();
    useStore.setState(initial, true);
  });

  it('empty state has zero containers (hydration seed is a React effect, not store default)', () => {
    const s = useStore.getState();
    expect(Object.keys(s.containers).length).toBe(0);
  });

  it('placeModelHome adds containers to state', () => {
    const s = useStore.getState;
    const ids = s().placeModelHome('micro_studio');
    expect(ids.length).toBeGreaterThan(0);
    expect(Object.keys(s().containers).length).toBeGreaterThan(0);
  });

  it('placeModelHome two_story creates stacked containers', () => {
    const s = useStore.getState;
    const ids = s().placeModelHome('two_story');
    expect(ids.length).toBe(2);
    const containers = Object.values(s().containers);
    const hasStacked = containers.some(c => c.position.y > 1);
    expect(hasStacked).toBe(true);
  });
});
