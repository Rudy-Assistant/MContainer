import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';
import { encodeDesign, decodeDesign } from '@/utils/shareUrl';

// Reset store before each test
beforeEach(() => {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
});

// Helper: add a container and return its id
function addTestContainer(): string {
  const before = Object.keys(useStore.getState().containers);
  useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
  const after = Object.keys(useStore.getState().containers);
  return after.find((id) => !before.includes(id))!;
}

describe('environmentSlice', () => {
  it('setTimeOfDay updates environment.timeOfDay', () => {
    useStore.getState().setTimeOfDay(8);
    expect(useStore.getState().environment.timeOfDay).toBe(8);
  });

  it('setTheme changes currentTheme', () => {
    useStore.getState().setTheme('japanese');
    expect(useStore.getState().currentTheme).toBe('japanese');
  });

  it('setGroundPreset updates environment.groundPreset', () => {
    useStore.getState().setGroundPreset('concrete');
    expect(useStore.getState().environment.groundPreset).toBe('concrete');
  });
});

describe('selectionSlice', () => {
  it('select then clearSelection', () => {
    const id = addTestContainer();
    useStore.getState().select(id);
    expect(useStore.getState().selection).toContain(id);
    useStore.getState().clearSelection();
    expect(useStore.getState().selection).toHaveLength(0);
  });

  it('copyVoxel stores clipboard from container', () => {
    const id = addTestContainer();
    useStore.getState().copyVoxel(id, 0);
    expect(useStore.getState().clipboardVoxel).not.toBeNull();
  });
});

describe('dragSlice', () => {
  it('setDragContainer sets and clears dragContainer', () => {
    useStore.getState().setDragContainer('Standard40' as any);
    expect(useStore.getState().dragContainer).toBe('Standard40');
    useStore.getState().setDragContainer(null);
    expect(useStore.getState().dragContainer).toBeNull();
  });
});

describe('librarySlice', () => {
  it('saveHomeDesign appends to libraryHomeDesigns', () => {
    addTestContainer();
    const before = useStore.getState().libraryHomeDesigns.length;
    useStore.getState().saveHomeDesign('Test Home');
    expect(useStore.getState().libraryHomeDesigns.length).toBe(before + 1);
  });

  it('removeLibraryItem removes from libraryHomeDesigns', () => {
    addTestContainer();
    useStore.getState().saveHomeDesign('To Remove');
    const designs = useStore.getState().libraryHomeDesigns;
    const lastId = designs[designs.length - 1].id;
    useStore.getState().removeLibraryItem(lastId);
    expect(useStore.getState().libraryHomeDesigns.find((d: any) => d.id === lastId)).toBeUndefined();
  });
});

describe('voxelSlice', () => {
  it('setVoxelFace mutates the correct face', () => {
    const id = addTestContainer();
    useStore.getState().setVoxelFace(id, 10, 'n', 'Glass_Pane');
    const face = (useStore.getState().containers[id] as any).voxelGrid[10].faces.n;
    expect(face).toBe('Glass_Pane');
  });

  it('resetVoxelGrid restores default faces', () => {
    const id = addTestContainer();
    useStore.getState().setVoxelFace(id, 10, 'n', 'Glass_Pane');
    useStore.getState().resetVoxelGrid(id);
    const face = (useStore.getState().containers[id] as any).voxelGrid[10].faces.n;
    expect(face).not.toBe('Glass_Pane');
  });
});

describe('hotbar controls', () => {
  it('activeHotbarTab cycles with cycleHotbarTab', () => {
    const before = useStore.getState().activeHotbarTab;
    useStore.getState().cycleHotbarTab(1);
    expect(useStore.getState().activeHotbarTab).toBe((before + 1) % 2);
    useStore.getState().cycleHotbarTab(-1);
    expect(useStore.getState().activeHotbarTab).toBe(before);
  });

  it('lastStamp is set after setVoxelFace', () => {
    const id = addTestContainer();
    useStore.getState().setVoxelFace(id, 9, 'n', 'Glass_Pane');
    expect(useStore.getState().lastStamp?.surfaceType).toBe('Glass_Pane');
    expect(useStore.getState().lastStamp?.face).toBe('n');
  });

  it('grabMode activates and clears', () => {
    const id = addTestContainer();
    useStore.getState().setGrabMode({ active: true, containerId: id, origin: { x: 0, y: 0, z: 0 } });
    expect(useStore.getState().grabMode.active).toBe(true);
    useStore.getState().clearGrabMode();
    expect(useStore.getState().grabMode.active).toBe(false);
    expect(useStore.getState().grabMode.containerId).toBeNull();
  });
});

describe('window profiles', () => {
  it('Window_Standard is a valid SurfaceType', () => {
    const id = addTestContainer();
    useStore.getState().setVoxelFace(id, 10, 'n', 'Window_Standard');
    const face = useStore.getState().containers[id].voxelGrid![10].faces.n;
    expect(face).toBe('Window_Standard');
  });
});

describe('door system', () => {
  it('setting Door auto-creates doorConfig', () => {
    const id = addTestContainer();
    useStore.getState().setVoxelFace(id, 10, 'n', 'Door');
    const config = useStore.getState().containers[id].voxelGrid![10].doorConfig;
    expect(config).toBeDefined();
    expect(config!.n).toBeDefined();
    expect(config!.n!.state).toBe('closed');
    expect(['left', 'right']).toContain(config!.n!.hingeEdge);
  });

  it('smart door swings away from adjacent staircase', () => {
    const id = addTestContainer();
    // Place stairs at voxel 11 (to the right of voxel 10)
    useStore.getState().applyStairsFromFace(id, 11, 'n');
    useStore.getState().setVoxelFace(id, 10, 'n', 'Door');
    const config = useStore.getState().containers[id].voxelGrid![10].doorConfig;
    expect(config).toBeDefined();
    expect(config!.n).toBeDefined();
    // Staircase at voxel 11 is to the right (+1 col) of voxel 10 — hinge should be left
    expect(config!.n!.hingeEdge).toBe('left');
  });

  it('setDoorConfig merges partial update', () => {
    const id = addTestContainer();
    useStore.getState().setVoxelFace(id, 10, 'n', 'Door');
    useStore.getState().setDoorConfig(id, 10, 'n', { hingeEdge: 'left' });
    const config = useStore.getState().containers[id].voxelGrid![10].doorConfig;
    expect(config!.n!.hingeEdge).toBe('left');
    expect(config!.n!.state).toBe('closed');
  });
});

describe('3D-first selection', () => {
  it('setSelectedFace stores face context', () => {
    const id = addTestContainer();
    useStore.getState().setSelectedVoxel({ containerId: id, index: 10 });
    useStore.getState().setSelectedFace('n');
    expect(useStore.getState().selectedFace).toBe('n');
  });

  it('clearSelection clears selectedFace', () => {
    const id = addTestContainer();
    useStore.getState().setSelectedVoxel({ containerId: id, index: 10 });
    useStore.getState().setSelectedFace('s');
    useStore.getState().clearSelection();
    expect(useStore.getState().selectedFace).toBeNull();
  });
});

describe('door rendering config', () => {
  it('doorConfig drives animation state correctly', () => {
    const id = addTestContainer();
    useStore.getState().setVoxelFace(id, 10, 'n', 'Door');
    useStore.getState().setDoorConfig(id, 10, 'n', { type: 'slide', hingeEdge: 'left' });
    const cfg = useStore.getState().containers[id].voxelGrid![10].doorConfig!.n;
    expect(cfg!.type).toBe('slide');
    expect(cfg!.hingeEdge).toBe('left');
    expect(cfg!.state).toBe('closed');
  });
});

describe('shareUrl encode/decode', () => {
  it('round-trips correctly', () => {
    const id = addTestContainer();
    const containers = useStore.getState().containers;
    const encoded = encodeDesign(containers);
    expect(typeof encoded).toBe('string');
    expect(encoded.length).toBeGreaterThan(0);
    const decoded = decodeDesign(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.containers.length).toBe(1);
    expect(decoded!.containers[0].size).toBe(ContainerSize.Standard40);
  });

  it('decodeDesign returns null for invalid input', () => {
    expect(decodeDesign('')).toBeNull();
    expect(decodeDesign('garbage-data-!!!')).toBeNull();
  });
});

describe('interiorFinish', () => {
  it('setInteriorFinish stores value', () => {
    const id = addTestContainer();
    expect(useStore.getState().containers[id].interiorFinish).toBeUndefined();
    useStore.getState().setInteriorFinish(id, 'plywood');
    expect(useStore.getState().containers[id].interiorFinish).toBe('plywood');
  });
});

describe('generateRooftopDeck', () => {
  it('sets top faces to Deck_Wood on topmost container', () => {
    const id = addTestContainer();
    useStore.getState().generateRooftopDeck(id);
    const grid = useStore.getState().containers[id].voxelGrid!;
    // Body voxel at row 1, col 1 (index 9) should have Deck_Wood top
    expect(grid[9].faces.top).toBe('Deck_Wood');
    // Perimeter body voxel at row 1, col 1 should have Railing_Cable on north face
    expect(grid[9].faces.n).toBe('Railing_Cable');
  });
});

describe('designComplexity', () => {
  it('defaults to detailed', () => {
    expect(useStore.getState().designComplexity).toBe('detailed');
  });

  it('updates with setDesignComplexity', () => {
    useStore.getState().setDesignComplexity('simple');
    expect(useStore.getState().designComplexity).toBe('simple');
    useStore.getState().setDesignComplexity('detailed');
    expect(useStore.getState().designComplexity).toBe('detailed');
  });
});
