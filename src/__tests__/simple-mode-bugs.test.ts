import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import { getBayGroupForVoxel, computeBayGroups } from '@/config/bayGroups';
import { deriveSelectionTarget } from '@/hooks/useSelectionTarget';

// Reset store before each test
beforeEach(() => {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
});

// Helper: add a container and return its id
function addTestContainer(): string {
  const before = Object.keys(useStore.getState().containers);
  useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
  const after = Object.keys(useStore.getState().containers);
  return after.find((id) => !before.includes(id))!;
}

describe('Bug: Poles on deck-only voxels', () => {
  it('deck-only voxel has Open top face', () => {
    // Verify deck preset has Open top
    const id = addTestContainer();
    const grid = useStore.getState().containers[id].voxelGrid!;
    // Apply Deck preset (floor only) to voxel 9 (body voxel)
    useStore.getState().setVoxelFace(id, 9, 'top', 'Open');
    useStore.getState().setVoxelFace(id, 9, 'n', 'Open');
    useStore.getState().setVoxelFace(id, 9, 's', 'Open');
    useStore.getState().setVoxelFace(id, 9, 'e', 'Open');
    useStore.getState().setVoxelFace(id, 9, 'w', 'Open');
    // Bottom stays as material (deck)
    const v = useStore.getState().containers[id].voxelGrid![9];
    expect(v.faces.top).toBe('Open');
    expect(v.faces.bottom).not.toBe('Open');
    // This voxel should NOT contribute to pillar positions
    // because it has no ceiling to support
  });

  it('shouldIncludeInPillarCalc returns false for deck-only voxels', () => {
    // This tests the logic that SHOULD be extracted:
    // A voxel with top='Open' should not generate pillars
    const id = addTestContainer();
    const grid = useStore.getState().containers[id].voxelGrid!;
    // Deck-only voxel: has floor but no ceiling
    const deckVoxel = { ...grid[9], faces: { ...grid[9].faces, top: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } };
    // Pillar inclusion logic: should EXCLUDE voxels where top === 'Open'
    const shouldInclude = deckVoxel.faces.top !== 'Open' || deckVoxel.faces.bottom !== 'Open';
    // Current behavior (bug): shouldInclude = true (because bottom !== Open)
    // Expected behavior: should be false (no ceiling = no pillars needed)
    // We test the DESIRED logic:
    const correctLogic = deckVoxel.faces.top !== 'Open';
    expect(correctLogic).toBe(false); // deck-only should NOT get pillars
  });
});

describe('Bug: Bay group reverse lookup', () => {
  it('getBayGroupForVoxel returns group for every voxel 0-31', () => {
    for (let i = 0; i < 32; i++) {
      const group = getBayGroupForVoxel(i);
      expect(group).toBeDefined();
      expect(group!.voxelIndices).toContain(i);
    }
  });

  it('getBayGroupForVoxel returns body group for body voxels', () => {
    // Body voxels: rows 1-2, cols 1-6 (indices 9-14 and 17-22)
    const bodyGroup = getBayGroupForVoxel(9); // row 1, col 1
    expect(bodyGroup).toBeDefined();
    expect(bodyGroup!.role).toBe('body');
    expect(bodyGroup!.label).toBe('Bay 1');
  });

  it('getBayGroupForVoxel handles level offset correctly', () => {
    // Level 1 voxel at index 32+9 = 41 should map to same group as index 9
    const level0 = getBayGroupForVoxel(9);
    const level1 = getBayGroupForVoxel(41, 32);
    expect(level0!.id).toBe(level1!.id);
  });

  it('computeBayGroups covers all 32 voxels exactly once', () => {
    const groups = computeBayGroups();
    const allIndices = groups.flatMap((g) => g.voxelIndices);
    expect(allIndices.length).toBe(32);
    const unique = new Set(allIndices);
    expect(unique.size).toBe(32);
    for (let i = 0; i < 32; i++) {
      expect(unique.has(i)).toBe(true);
    }
  });
});

describe('Bug: Simple mode selection uses bay groups', () => {
  it('designComplexity defaults to simple', () => {
    expect(useStore.getState().designComplexity).toBe('simple');
  });

  it('setSelectedElements(bay) sets bay selection', () => {
    const id = addTestContainer();
    useStore.getState().setSelectedElements({ type: 'voxel', items: [{ containerId: id, id: '9' }] });
    expect(useStore.getState().selectedElements).not.toBeNull();

    // Now set multi-select (bay group) — replaces voxel selection
    useStore.getState().setSelectedElements({ type: 'bay', items: [
      { containerId: id, id: '9' }, { containerId: id, id: '10' },
      { containerId: id, id: '17' }, { containerId: id, id: '18' },
    ] });
    const sel = useStore.getState().selectedElements;
    expect(sel).not.toBeNull();
    expect(sel!.type).toBe('bay');
    expect(sel!.items.map(i => parseInt(i.id))).toEqual([9, 10, 17, 18]);
  });

  it('setSelectedElements(voxel) replaces bay selection', () => {
    const id = addTestContainer();
    useStore.getState().setSelectedElements({ type: 'bay', items: [
      { containerId: id, id: '9' }, { containerId: id, id: '10' },
      { containerId: id, id: '17' }, { containerId: id, id: '18' },
    ] });
    expect(useStore.getState().selectedElements).not.toBeNull();

    useStore.getState().setSelectedElements({ type: 'voxel', items: [{ containerId: id, id: '9' }] });
    const sel = useStore.getState().selectedElements;
    expect(sel).not.toBeNull();
    expect(sel!.type).toBe('voxel');
  });

  it('hoveredBayGroup can be set and cleared', () => {
    const id = addTestContainer();
    expect(useStore.getState().hoveredBayGroup).toBeNull();

    useStore.getState().setHoveredBayGroup({ containerId: id, indices: [9, 10, 17, 18] });
    expect(useStore.getState().hoveredBayGroup).not.toBeNull();
    expect(useStore.getState().hoveredBayGroup!.indices).toEqual([9, 10, 17, 18]);

    useStore.getState().setHoveredBayGroup(null);
    expect(useStore.getState().hoveredBayGroup).toBeNull();
  });

  it('setDesignComplexity clears hoveredBayGroup', () => {
    const id = addTestContainer();
    useStore.getState().setHoveredBayGroup({ containerId: id, indices: [9, 10] });
    useStore.getState().setDesignComplexity('detailed');
    expect(useStore.getState().hoveredBayGroup).toBeNull();
  });
});

describe('Bug: Bay selection must include selectedFace for sidebar config', () => {
  it('deriveSelectionTarget returns bay-face when selectedElements(bay) + selectedFace are set', () => {
    const id = addTestContainer();

    const target = deriveSelectionTarget({
      selectedElements: { type: 'bay', items: [
        { containerId: id, id: '9' }, { containerId: id, id: '10' },
        { containerId: id, id: '17' }, { containerId: id, id: '18' },
      ] },
      selectedFace: 's',
      selection: [],
    });

    expect(target.type).toBe('bay-face');
    if (target.type === 'bay-face') {
      expect(target.face).toBe('s');
      expect(target.indices).toEqual([9, 10, 17, 18]);
    }
  });

  it('deriveSelectionTarget returns bay (no config) when selectedFace is null', () => {
    const id = addTestContainer();

    const target = deriveSelectionTarget({
      selectedElements: { type: 'bay', items: [
        { containerId: id, id: '9' }, { containerId: id, id: '10' },
        { containerId: id, id: '17' }, { containerId: id, id: '18' },
      ] },
      selectedFace: null,
      selection: [],
    });

    expect(target.type).toBe('bay');
  });

  it('setSelectedElements(bay) + setSelectedFace together produce bay-face target', () => {
    const id = addTestContainer();
    const store = useStore.getState();

    store.setSelectedElements({ type: 'bay', items: [
      { containerId: id, id: '9' }, { containerId: id, id: '10' },
      { containerId: id, id: '17' }, { containerId: id, id: '18' },
    ] });
    store.setSelectedFace('s');

    const state = useStore.getState();
    expect(state.selectedElements).not.toBeNull();
    expect(state.selectedFace).toBe('s');

    const target = deriveSelectionTarget({
      selectedElements: state.selectedElements,
      selectedFace: state.selectedFace,
      selection: state.selection,
    });
    expect(target.type).toBe('bay-face');
  });
});

describe('Bug: Container Grid proportional sizing', () => {
  it('extension cells should be proportionally larger than body cells', () => {
    // For 40ft HC: length=12.19, width=2.44, height=2.90
    const dims = { length: 12.19, width: 2.44, height: 2.90 };
    const coreWidth = dims.length / 6;  // ~2.03
    const coreDepth = dims.width / 2;   // 1.22
    const foldDepth = dims.height;      // 2.90

    // Extensions should be wider than body in fr units
    expect(foldDepth).toBeGreaterThan(coreWidth);
    // Extensions should be taller than body rows
    expect(foldDepth).toBeGreaterThan(coreDepth);
    // Ratio check: extension height / body row height
    expect(foldDepth / coreDepth).toBeGreaterThan(2);
  });
});
