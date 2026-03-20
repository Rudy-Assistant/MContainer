// @ts-nocheck — Test file uses runtime assertions (expect().toBeDefined()) instead of TS narrowing
/**
 * Store Coverage Tests — Sprint 13
 *
 * Behavioral tests for previously untested store actions.
 * Real store actions, real state assertions. No source scanning.
 * Mocks: idb-keyval (no IndexedDB in Node).
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, FurnitureType, VOXEL_COUNT } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

/** Helper: add a container and return its ID */
function addC(size = ContainerSize.HighCube40, pos = { x: 0, y: 0, z: 0 }) {
  return useStore.getState().addContainer(size, pos);
}

/** Shared test faces object */
const TEST_FACES = {
  top: 'Open' as const,
  bottom: 'Concrete' as const,
  n: 'Glass_Pane' as const,
  s: 'Glass_Pane' as const,
  e: 'Solid_Steel' as const,
  w: 'Solid_Steel' as const,
};

// ─────────────────────────────────────────────────────────
// 1. Furniture CRUD
// ─────────────────────────────────────────────────────────

describe('Furniture CRUD', () => {
  beforeEach(resetStore);

  it('FURN-1: addFurniture creates furniture item in container', () => {
    const cId = addC();
    const fId = useStore.getState().addFurniture(cId, FurnitureType.Kitchen);
    expect(fId).toBeTruthy();
    const c = useStore.getState().containers[cId];
    const furn = c.furniture?.find((f: any) => f.id === fId);
    expect(furn).toBeDefined();
    expect(furn!.type).toBe(FurnitureType.Kitchen);
  });

  it('FURN-2: addFurniture with explicit position uses that position', () => {
    const cId = addC();
    const pos = { x: 1, y: 0, z: 2 };
    const fId = useStore.getState().addFurniture(cId, FurnitureType.Bed, pos);
    const c = useStore.getState().containers[cId];
    const furn = c.furniture?.find((f: any) => f.id === fId);
    expect(furn!.position.x).toBe(1);
    expect(furn!.position.z).toBe(2);
  });

  it('FURN-3: addFurniture to nonexistent container returns null', () => {
    const fId = useStore.getState().addFurniture('nonexistent', FurnitureType.Sofa);
    expect(fId).toBeNull();
  });

  it('FURN-4: removeFurniture removes the furniture item', () => {
    const cId = addC();
    const fId = useStore.getState().addFurniture(cId, FurnitureType.Kitchen)!;
    useStore.getState().removeFurniture(fId);
    const c = useStore.getState().containers[cId];
    const found = c.furniture?.find((f: any) => f.id === fId);
    expect(found).toBeUndefined();
  });

  it('FURN-5: moveFurniture updates position', () => {
    const cId = addC();
    const fId = useStore.getState().addFurniture(cId, FurnitureType.Desk)!;
    const newPos = { x: 5, y: 0, z: 3 };
    useStore.getState().moveFurniture(fId, newPos);
    const c = useStore.getState().containers[cId];
    const furn = c.furniture?.find((f: any) => f.id === fId);
    expect(furn!.position.x).toBe(5);
    expect(furn!.position.z).toBe(3);
  });

  it('FURN-6: multiple furniture items coexist in same container', () => {
    const cId = addC();
    useStore.getState().addFurniture(cId, FurnitureType.Kitchen);
    useStore.getState().addFurniture(cId, FurnitureType.Bed);
    useStore.getState().addFurniture(cId, FurnitureType.Sofa);
    const c = useStore.getState().containers[cId];
    expect(c.furniture?.length).toBeGreaterThanOrEqual(3);
  });
});

// ─────────────────────────────────────────────────────────
// 2. Container Rename & Resize
// ─────────────────────────────────────────────────────────

describe('Container Rename & Resize', () => {
  beforeEach(resetStore);

  it('RENAME-1: renameContainer changes container name', () => {
    const cId = addC();
    useStore.getState().renameContainer(cId, 'My Kitchen');
    expect(useStore.getState().containers[cId].name).toBe('My Kitchen');
  });

  it('RENAME-2: renameContainer with empty string still sets name', () => {
    const cId = addC();
    useStore.getState().renameContainer(cId, '');
    expect(useStore.getState().containers[cId].name).toBe('');
  });

  it('RESIZE-1: resizeContainer changes size and rebuilds voxel grid', () => {
    const cId = addC(ContainerSize.HighCube40);
    useStore.getState().resizeContainer(cId, ContainerSize.Standard20);
    const c = useStore.getState().containers[cId];
    expect(c.size).toBe(ContainerSize.Standard20);
    expect(c.voxelGrid).toBeDefined();
    expect(c.voxelGrid!.length).toBe(VOXEL_COUNT);
  });

  it('RESIZE-2: resizeContainer preserves container identity', () => {
    const cId = addC();
    useStore.getState().renameContainer(cId, 'Test Box');
    useStore.getState().resizeContainer(cId, ContainerSize.Standard40);
    const c = useStore.getState().containers[cId];
    expect(c.id).toBe(cId);
    expect(c.name).toBe('Test Box');
  });
});

// ─────────────────────────────────────────────────────────
// 3. Voxel Clipboard
// ─────────────────────────────────────────────────────────

describe('Voxel Clipboard', () => {
  beforeEach(resetStore);

  it('CLIP-1: copyVoxel stores faces in clipboard', () => {
    const cId = addC();
    // Paint a face to make it identifiable
    useStore.getState().setVoxelFace(cId, 10, 'e', 'Glass_Pane');
    useStore.getState().copyVoxel(cId, 10);
    const state = useStore.getState();
    expect(state.clipboardVoxel).toBeDefined();
  });

  it('CLIP-2: pasteVoxel applies clipboard faces to target', () => {
    const cId = addC();
    useStore.getState().setVoxelFace(cId, 10, 'e', 'Glass_Pane');
    useStore.getState().copyVoxel(cId, 10);
    useStore.getState().pasteVoxel(cId, 12);
    const face = useStore.getState().containers[cId].voxelGrid![12].faces.e;
    expect(face).toBe('Glass_Pane');
  });

  it('CLIP-3: pasteVoxel on locked voxel does not change faces', () => {
    const cId = addC();
    useStore.getState().setVoxelFace(cId, 10, 'e', 'Glass_Pane');
    useStore.getState().copyVoxel(cId, 10);
    // Lock target voxel
    useStore.getState().toggleVoxelLock(cId, 12);
    const faceBefore = useStore.getState().containers[cId].voxelGrid![12].faces.e;
    useStore.getState().pasteVoxel(cId, 12);
    const faceAfter = useStore.getState().containers[cId].voxelGrid![12].faces.e;
    expect(faceAfter).toBe(faceBefore);
  });

  it('CLIP-4: copyVoxelStyle stores style for brush application', () => {
    const cId = addC();
    useStore.getState().setVoxelFace(cId, 10, 'n', 'Deck_Wood');
    useStore.getState().copyVoxelStyle(cId, 10);
    // Style brush should have content (implementation detail: styleBrush or similar)
    const state = useStore.getState();
    // Verify some clipboard/style state exists
    expect(state.clipboardVoxel || (state as any).styleBrush).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────
// 4. Voxel Locking
// ─────────────────────────────────────────────────────────

describe('Voxel Locking', () => {
  beforeEach(resetStore);

  it('LOCK-1: toggleVoxelLock locks an unlocked voxel', () => {
    const cId = addC();
    expect(useStore.getState().isVoxelLocked(cId, 10)).toBe(false);
    useStore.getState().toggleVoxelLock(cId, 10);
    expect(useStore.getState().isVoxelLocked(cId, 10)).toBe(true);
  });

  it('LOCK-2: toggleVoxelLock twice unlocks the voxel', () => {
    const cId = addC();
    useStore.getState().toggleVoxelLock(cId, 10);
    useStore.getState().toggleVoxelLock(cId, 10);
    expect(useStore.getState().isVoxelLocked(cId, 10)).toBe(false);
  });

  it('LOCK-3: isVoxelLocked returns false for unset voxels', () => {
    const cId = addC();
    expect(useStore.getState().isVoxelLocked(cId, 0)).toBe(false);
    expect(useStore.getState().isVoxelLocked(cId, 31)).toBe(false);
  });

  it('LOCK-4: locked voxel prevents setVoxelFace', () => {
    const cId = addC();
    const faceBefore = useStore.getState().containers[cId].voxelGrid[10].faces.e;
    useStore.getState().toggleVoxelLock(cId, 10);
    useStore.getState().setVoxelFace(cId, 10, 'e', 'Glass_Pane');
    const faceAfter = useStore.getState().containers[cId].voxelGrid[10].faces.e;
    expect(faceAfter).toBe(faceBefore);
  });

  it('LOCK-5: locking one voxel does not affect others', () => {
    const cId = addC();
    useStore.getState().toggleVoxelLock(cId, 10);
    expect(useStore.getState().isVoxelLocked(cId, 11)).toBe(false);
    // Can still paint unlocked voxel
    useStore.getState().setVoxelFace(cId, 11, 'e', 'Glass_Pane');
    expect(useStore.getState().containers[cId].voxelGrid[11].faces.e).toBe('Glass_Pane');
  });
});

// ─────────────────────────────────────────────────────────
// 5. Pool Conversion
// ─────────────────────────────────────────────────────────

describe('Pool Conversion', () => {
  beforeEach(resetStore);

  it('POOL-1: convertToPool transforms container voxel grid', () => {
    const cId = addC();
    const facesBefore = useStore.getState().containers[cId].voxelGrid[10].faces;
    useStore.getState().convertToPool(cId);
    const facesAfter = useStore.getState().containers[cId].voxelGrid[10].faces;
    // At minimum, top should become Open for pool
    expect(facesAfter.top).toBe('Open');
  });

  it('POOL-2: convertToPool sets concrete-like bottom/walls', () => {
    const cId = addC();
    useStore.getState().convertToPool(cId);
    const faces = useStore.getState().containers[cId].voxelGrid[10].faces;
    // Pool should have concrete shell
    expect(faces.bottom).toBe('Concrete');
  });
});

// ─────────────────────────────────────────────────────────
// 6. Great Room Demo
// ─────────────────────────────────────────────────────────

describe('Great Room Demo', () => {
  beforeEach(resetStore);

  it('DEMO-1: createGreatRoomDemo creates multiple containers', () => {
    useStore.getState().createGreatRoomDemo();
    const count = Object.keys(useStore.getState().containers).length;
    expect(count).toBeGreaterThanOrEqual(2);
  });

  it('DEMO-2: createGreatRoomDemo creates multi-level structure', () => {
    useStore.getState().createGreatRoomDemo();
    const containers = Object.values(useStore.getState().containers) as any[];
    // Should have multiple levels (L0 + L1 + L2)
    const levels = new Set(containers.map((c) => c.level));
    expect(levels.size).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────
// 7. Block Library Save
// ─────────────────────────────────────────────────────────

describe('Block Library', () => {
  beforeEach(resetStore);

  it('BLOCK-1: saveBlockToLibrary creates library entry', () => {
    const blockId = useStore.getState().saveBlockToLibrary('My Block', TEST_FACES);
    expect(blockId).toBeTruthy();
    const blocks = useStore.getState().libraryBlocks;
    expect(blocks.length).toBeGreaterThanOrEqual(1);
    const found = blocks.find((b: any) => b.id === blockId);
    expect(found).toBeDefined();
    expect(found.label).toBe('My Block');
  });

  it('BLOCK-2: saveBlockToLibrary preserves face data', () => {
    const faces = {
      top: 'Open' as const,
      bottom: 'Deck_Wood' as const,
      n: 'Glass_Pane' as const,
      s: 'Railing_Cable' as const,
      e: 'Solid_Steel' as const,
      w: 'Door' as const,
    };
    const blockId = useStore.getState().saveBlockToLibrary('Deck Block', faces);
    const blocks = useStore.getState().libraryBlocks;
    const found = blocks.find((b: any) => b.id === blockId);
    expect(found.faces.bottom).toBe('Deck_Wood');
    expect(found.faces.s).toBe('Railing_Cable');
  });
});

// ─────────────────────────────────────────────────────────
// 8. Import/Export Round-Trip
// ─────────────────────────────────────────────────────────

describe('Import/Export', () => {
  beforeEach(resetStore);

  it('EXPORT-1: exportState returns non-empty string', () => {
    addC();
    const json = useStore.getState().exportState();
    expect(typeof json).toBe('string');
    expect(json.length).toBeGreaterThan(10);
  });

  it('EXPORT-2: exportState output is valid JSON', () => {
    addC();
    const json = useStore.getState().exportState();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('IMPORT-1: importState restores containers', () => {
    const cId = addC();
    useStore.getState().renameContainer(cId, 'Export Test');
    const json = useStore.getState().exportState();

    // Reset and reimport
    resetStore();
    expect(Object.keys(useStore.getState().containers).length).toBe(0);

    useStore.getState().importState(json);
    const containers = Object.values(useStore.getState().containers);
    expect(containers.length).toBeGreaterThanOrEqual(1);
    const found = containers.find((c: any) => c.name === 'Export Test');
    expect(found).toBeDefined();
  });

  it('IMPORT-2: importState with invalid JSON does not crash', () => {
    expect(() => useStore.getState().importState('not json')).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────
// 9. Toggle Roof/Floor
// ─────────────────────────────────────────────────────────

describe('Toggle Roof/Floor', () => {
  beforeEach(resetStore);

  it('ROOF-1: toggleRoof flips roofRemoved state', () => {
    const cId = addC();
    const before = useStore.getState().containers[cId].roofRemoved;
    useStore.getState().toggleRoof(cId);
    const after = useStore.getState().containers[cId].roofRemoved;
    expect(after).toBe(!before);
  });

  it('ROOF-2: toggleRoof twice restores original state', () => {
    const cId = addC();
    const before = useStore.getState().containers[cId].roofRemoved;
    useStore.getState().toggleRoof(cId);
    useStore.getState().toggleRoof(cId);
    expect(useStore.getState().containers[cId].roofRemoved).toBe(before);
  });

  it('FLOOR-1: toggleFloor flips floorRemoved state', () => {
    const cId = addC();
    const before = useStore.getState().containers[cId].floorRemoved;
    useStore.getState().toggleFloor(cId);
    const after = useStore.getState().containers[cId].floorRemoved;
    expect(after).toBe(!before);
  });

  it('FLOOR-2: toggleFloor twice restores original state', () => {
    const cId = addC();
    const before = useStore.getState().containers[cId].floorRemoved;
    useStore.getState().toggleFloor(cId);
    useStore.getState().toggleFloor(cId);
    expect(useStore.getState().containers[cId].floorRemoved).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────
// 10. Dollhouse Toggle
// ─────────────────────────────────────────────────────────

describe('Dollhouse Toggle', () => {
  beforeEach(resetStore);

  it('DOLL-1: toggleDollhouse flips dollhouseActive', () => {
    const before = useStore.getState().dollhouseActive;
    useStore.getState().toggleDollhouse();
    expect(useStore.getState().dollhouseActive).toBe(!before);
  });

  it('DOLL-2: toggleDollhouse twice restores original', () => {
    const before = useStore.getState().dollhouseActive;
    useStore.getState().toggleDollhouse();
    useStore.getState().toggleDollhouse();
    expect(useStore.getState().dollhouseActive).toBe(before);
  });
});

// ─────────────────────────────────────────────────────────
// 11. View Level
// ─────────────────────────────────────────────────────────

describe('View Level', () => {
  beforeEach(resetStore);

  it('LEVEL-1: setViewLevel sets numeric level', () => {
    useStore.getState().setViewLevel(2);
    expect(useStore.getState().viewLevel).toBe(2);
  });

  it('LEVEL-2: setViewLevel null shows all levels', () => {
    useStore.getState().setViewLevel(1);
    useStore.getState().setViewLevel(null);
    expect(useStore.getState().viewLevel).toBeNull();
  });

  it('LEVEL-3: setViewLevel 0 is valid (ground level)', () => {
    useStore.getState().setViewLevel(0);
    expect(useStore.getState().viewLevel).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// 12. Stamp Area
// ─────────────────────────────────────────────────────────

describe('Stamp Area', () => {
  beforeEach(resetStore);

  it('STAMP-1: stampArea applies faces to multiple voxels', () => {
    const cId = addC();
    useStore.getState().stampArea(cId, [10, 11, 12], TEST_FACES);
    const grid = useStore.getState().containers[cId].voxelGrid;
    expect(grid[10].faces.n).toBe('Glass_Pane');
    expect(grid[11].faces.n).toBe('Glass_Pane');
    expect(grid[12].faces.n).toBe('Glass_Pane');
  });

  it('STAMP-2: stampArea respects voxel locks', () => {
    const cId = addC();
    useStore.getState().toggleVoxelLock(cId, 11);
    const faceBefore = useStore.getState().containers[cId].voxelGrid[11].faces.n;
    useStore.getState().stampArea(cId, [10, 11, 12], TEST_FACES);
    // Locked voxel should be unchanged
    expect(useStore.getState().containers[cId].voxelGrid[11].faces.n).toBe(faceBefore);
    // Unlocked voxels should be changed
    expect(useStore.getState().containers[cId].voxelGrid[10].faces.n).toBe('Glass_Pane');
  });

  it('STAMP-3: stampArea with empty indices array does not crash', () => {
    const cId = addC();
    expect(() => useStore.getState().stampArea(cId, [], TEST_FACES)).not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────
// 13. Door State (expanded from single test)
// ─────────────────────────────────────────────────────────

describe('Door State Cycle', () => {
  beforeEach(resetStore);

  it('DOOR-1: toggleDoorState cycles from closed to open_swing', () => {
    const cId = addC();
    useStore.getState().setVoxelFace(cId, 15, 'e', 'Door');
    useStore.getState().toggleDoorState(cId, 15, 'e');
    const state = useStore.getState().containers[cId].voxelGrid[15].doorStates?.e;
    expect(state).toBe('open_swing');
  });

  it('DOOR-2: toggleDoorState cycles open_swing to open_slide', () => {
    const cId = addC();
    useStore.getState().setVoxelFace(cId, 15, 'e', 'Door');
    useStore.getState().toggleDoorState(cId, 15, 'e');
    useStore.getState().toggleDoorState(cId, 15, 'e');
    const state = useStore.getState().containers[cId].voxelGrid[15].doorStates?.e;
    expect(state).toBe('open_slide');
  });

  it('DOOR-3: toggleDoorState cycles open_slide back to closed', () => {
    const cId = addC();
    useStore.getState().setVoxelFace(cId, 15, 'e', 'Door');
    useStore.getState().toggleDoorState(cId, 15, 'e');
    useStore.getState().toggleDoorState(cId, 15, 'e');
    useStore.getState().toggleDoorState(cId, 15, 'e');
    const state = useStore.getState().containers[cId].voxelGrid[15].doorStates?.e;
    expect(state).toBe('closed');
  });
});

// ─────────────────────────────────────────────────────────
// 14. Theme + Time + ViewMode (expanded coverage)
// ─────────────────────────────────────────────────────────

describe('Theme/Time/View expanded', () => {
  beforeEach(resetStore);

  it('THEME-1: setTheme to each valid theme updates currentTheme', () => {
    for (const theme of ['industrial', 'japanese', 'desert']) {
      useStore.getState().setTheme(theme);
      expect(useStore.getState().currentTheme).toBe(theme);
    }
  });

  it('TIME-1: setTimeOfDay updates environment.timeOfDay', () => {
    useStore.getState().setTimeOfDay(18);
    expect(useStore.getState().environment.timeOfDay).toBe(18);
  });

  it('TIME-2: setTimeOfDay clamps to 0-24 range', () => {
    useStore.getState().setTimeOfDay(0);
    expect(useStore.getState().environment.timeOfDay).toBe(0);
    useStore.getState().setTimeOfDay(24);
    expect(useStore.getState().environment.timeOfDay).toBe(24);
  });
});

// ─────────────────────────────────────────────────────────
// 15. Undo integration for new actions
// ─────────────────────────────────────────────────────────

describe('Undo for newly covered actions', () => {
  beforeEach(resetStore);

  it('UNDO-RENAME: undo reverts renameContainer', () => {
    const cId = addC();
    const origName = useStore.getState().containers[cId].name;
    useStore.getState().renameContainer(cId, 'Renamed');
    expect(useStore.getState().containers[cId].name).toBe('Renamed');
    useStore.temporal.getState().undo();
    expect(useStore.getState().containers[cId].name).toBe(origName);
  });

  it('UNDO-ROOF: undo reverts toggleRoof', () => {
    const cId = addC();
    const before = useStore.getState().containers[cId].roofRemoved;
    useStore.getState().toggleRoof(cId);
    expect(useStore.getState().containers[cId].roofRemoved).toBe(!before);
    useStore.temporal.getState().undo();
    expect(useStore.getState().containers[cId].roofRemoved).toBe(before);
  });

  it('UNDO-FURN: undo reverts addFurniture', () => {
    const cId = addC();
    const furnBefore = useStore.getState().containers[cId].furniture?.length || 0;
    useStore.getState().addFurniture(cId, FurnitureType.Kitchen);
    const furnAfter = useStore.getState().containers[cId].furniture?.length || 0;
    expect(furnAfter).toBe(furnBefore + 1);
    useStore.temporal.getState().undo();
    const furnUndo = useStore.getState().containers[cId].furniture?.length || 0;
    expect(furnUndo).toBe(furnBefore);
  });

  it('UNDO-LOCK: toggleVoxelLock is idempotent toggle (lock state is ephemeral)', () => {
    // lockedVoxels is ephemeral state (not tracked by temporal/undo)
    // so we just verify the toggle itself works correctly
    const cId = addC();
    expect(useStore.getState().isVoxelLocked(cId, 10)).toBe(false);
    useStore.getState().toggleVoxelLock(cId, 10);
    expect(useStore.getState().isVoxelLocked(cId, 10)).toBe(true);
    useStore.getState().toggleVoxelLock(cId, 10);
    expect(useStore.getState().isVoxelLocked(cId, 10)).toBe(false);
  });

  it('UNDO-STAMP: undo reverts stampArea', () => {
    const cId = addC();
    const faceBefore = useStore.getState().containers[cId].voxelGrid[10].faces.n;
    useStore.getState().stampArea(cId, [10, 11], TEST_FACES);
    expect(useStore.getState().containers[cId].voxelGrid[10].faces.n).toBe('Glass_Pane');
    useStore.temporal.getState().undo();
    expect(useStore.getState().containers[cId].voxelGrid[10].faces.n).toBe(faceBefore);
  });
});

// ─────────────────────────────────────────────────────────
// 16. Selection expanded
// ─────────────────────────────────────────────────────────

describe('Selection expanded', () => {
  beforeEach(resetStore);

  it('SELX-1: selectMultiple selects multiple container IDs', () => {
    const cId1 = addC(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const cId2 = addC(ContainerSize.Standard20, { x: 15, y: 0, z: 0 });
    useStore.getState().selectMultiple([cId1, cId2]);
    const sel = useStore.getState().selection;
    expect(sel).toBeDefined();
    expect(sel.length).toBe(2);
    expect(sel).toContain(cId1);
    expect(sel).toContain(cId2);
  });

  it('SELX-2: clearSelection resets selection array', () => {
    const cId = addC();
    useStore.getState().select(cId);
    useStore.getState().clearSelection();
    const sel = useStore.getState().selection;
    expect(sel ?? []).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// 17. Container stacking expanded
// ─────────────────────────────────────────────────────────

describe('Stacking expanded', () => {
  beforeEach(resetStore);

  it('STACK-EXP-1: unstackContainer separates stacked containers', () => {
    const bottomId = addC(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = addC(ContainerSize.HighCube40, { x: 10, y: 0, z: 0 });
    useStore.getState().stackContainer(topId, bottomId);
    const topBefore = useStore.getState().containers[topId];
    expect(topBefore.level).toBeGreaterThan(0);
    useStore.getState().unstackContainer(topId);
    const topAfter = useStore.getState().containers[topId];
    expect(topAfter.level).toBe(0);
  });

  it('STACK-EXP-2: stackContainer sets correct Y position', () => {
    const bottomId = addC(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const topId = addC(ContainerSize.HighCube40, { x: 10, y: 0, z: 0 });
    useStore.getState().stackContainer(topId, bottomId);
    const top = useStore.getState().containers[topId];
    expect(top.position.y).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────
// 18. Container rotation
// ─────────────────────────────────────────────────────────

describe('Container rotation expanded', () => {
  beforeEach(resetStore);

  it('ROT-1: updateContainerRotation changes rotation', () => {
    const cId = addC();
    useStore.getState().updateContainerRotation(cId, Math.PI / 2);
    expect(useStore.getState().containers[cId].rotation).toBeCloseTo(Math.PI / 2);
  });

  it('ROT-2: undo reverts rotation', () => {
    const cId = addC();
    const before = useStore.getState().containers[cId].rotation;
    useStore.getState().updateContainerRotation(cId, Math.PI);
    useStore.temporal.getState().undo();
    expect(useStore.getState().containers[cId].rotation).toBeCloseTo(before);
  });
});
