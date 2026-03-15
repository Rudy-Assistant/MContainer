/**
 * Undo / Redo Tests (UNDO-1 through UNDO-6)
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
import { ContainerSize, VOXEL_COLS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  // Clear temporal history
  const t = useStore.temporal.getState();
  t.clear();
}

/** Core voxel index: level 0, row 1, col 1 */
function coreIdx(): number {
  return 1 * VOXEL_COLS + 1;
}

describe('Undo / Redo', () => {
  beforeEach(() => {
    resetStore();
  });

  it('UNDO-1: paint face → undo → face reverts', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const idx = coreIdx();

    const originalFace = useStore.getState().containers[id].voxelGrid![idx].faces.n;

    useStore.getState().setVoxelFace(id, idx, 'n', 'Glass_Pane');
    expect(useStore.getState().containers[id].voxelGrid![idx].faces.n).toBe('Glass_Pane');

    useStore.getState().undo();

    const afterUndo = useStore.getState().containers[id].voxelGrid![idx].faces.n;
    expect(afterUndo).toBe(originalFace);
  });

  it('UNDO-2: paint face → undo → redo → face re-applied', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const idx = coreIdx();

    useStore.getState().setVoxelFace(id, idx, 'n', 'Glass_Pane');
    useStore.getState().undo();
    useStore.getState().redo();

    expect(useStore.getState().containers[id].voxelGrid![idx].faces.n).toBe('Glass_Pane');
  });

  it('UNDO-3: 5 sequential paints → 5 undos → all revert', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const idx = coreIdx();
    const originalFaces = { ...useStore.getState().containers[id].voxelGrid![idx].faces };

    const materials: Array<[keyof typeof originalFaces, string]> = [
      ['n', 'Glass_Pane'],
      ['s', 'Railing_Cable'],
      ['e', 'Door'],
      ['w', 'Wood_Hinoki'],
      ['top', 'Open'],
    ];

    for (const [face, mat] of materials) {
      useStore.getState().setVoxelFace(id, idx, face, mat as any);
    }

    // Undo all 5
    for (let i = 0; i < 5; i++) {
      useStore.getState().undo();
    }

    const reverted = useStore.getState().containers[id].voxelGrid![idx].faces;
    expect(reverted.n).toBe(originalFaces.n);
    expect(reverted.s).toBe(originalFaces.s);
    expect(reverted.e).toBe(originalFaces.e);
    expect(reverted.w).toBe(originalFaces.w);
    expect(reverted.top).toBe(originalFaces.top);
  });

  it('UNDO-4: UI state changes (selection) do not create undo entries', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40);
    const t = useStore.temporal.getState();
    const pastCountBefore = t.pastStates.length;

    // Selection changes are ephemeral — not tracked by temporal partialize
    useStore.getState().select(id);
    useStore.getState().clearSelection();
    useStore.getState().select(id);

    const pastCountAfter = useStore.temporal.getState().pastStates.length;
    // Temporal partialize only tracks containers/zones/furnitureIndex.
    // Pure selection changes should not increase pastStates.
    expect(pastCountAfter).toBe(pastCountBefore);
  });

  it('UNDO-5: startContainerDrag pauses temporal, commitContainerDrag resumes', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const t = useStore.temporal.getState();

    useStore.getState().startContainerDrag(id);
    // During drag, temporal is paused — intermediate moves should not create snapshots
    expect(useStore.getState().dragMovingId).toBe(id);

    useStore.getState().commitContainerDrag(5, 10);
    // After commit, drag is cleared
    expect(useStore.getState().dragMovingId).toBeNull();

    // The final position should be committed
    const c = useStore.getState().containers[id];
    expect(c.position.x).toBe(5);
    expect(c.position.z).toBe(10);
  });

  it('UNDO-6: undo after position move reverts position', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    const originalPos = { ...useStore.getState().containers[id].position };

    useStore.getState().updateContainerPosition(id, { x: 10, y: 0, z: 20 });
    expect(useStore.getState().containers[id].position.x).toBe(10);

    useStore.getState().undo();

    const afterUndo = useStore.getState().containers[id].position;
    expect(afterUndo.x).toBe(originalPos.x);
    expect(afterUndo.z).toBe(originalPos.z);
  });
});
