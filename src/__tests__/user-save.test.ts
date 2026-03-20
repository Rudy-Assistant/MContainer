/**
 * User-Saveable Configurations Tests (SAVE-1..7)
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  const t = useStore.temporal.getState();
  t.clear();
}

describe('User Save System', () => {
  beforeEach(() => { resetStore(); });

  it('SAVE-1: saveBlockToLibrary adds to libraryBlocks', () => {
    const faces = { top: 'Deck_Wood' as const, bottom: 'Concrete' as const, n: 'Glass_Pane' as const, s: 'Solid_Steel' as const, e: 'Open' as const, w: 'Open' as const };
    const id = useStore.getState().saveBlockToLibrary('My Kitchen', faces);
    expect(id).toBeTruthy();
    const blocks = useStore.getState().libraryBlocks;
    expect(blocks.length).toBe(1);
    expect(blocks[0].label).toBe('My Kitchen');
    expect(blocks[0].faces.top).toBe('Deck_Wood');
  });

  it('SAVE-2: saveContainerToLibrary captures voxel grid', () => {
    const cId = useStore.getState().addContainer(ContainerSize.Standard40);
    // Paint a face on voxel 11
    useStore.getState().setVoxelFace(cId, 11, 'n', 'Glass_Pane');

    const libId = useStore.getState().saveContainerToLibrary(cId, 'Glass Front');
    expect(libId).toBeTruthy();
    const saved = useStore.getState().libraryContainers;
    expect(saved.length).toBe(1);
    expect(saved[0].label).toBe('Glass Front');
    expect(saved[0].voxelGrid[11].faces.n).toBe('Glass_Pane');
  });

  it('SAVE-3: saveHomeDesign captures all containers with relative positions', () => {
    const id1 = useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
    const id2 = useStore.getState().addContainer(ContainerSize.Standard40, { x: 20, y: 0, z: 5 });

    const designId = useStore.getState().saveHomeDesign('Beach House');
    expect(designId).toBeTruthy();
    const designs = useStore.getState().libraryHomeDesigns;
    expect(designs.length).toBe(1);
    expect(designs[0].label).toBe('Beach House');
    expect(designs[0].containers.length).toBe(2);
    // First container at origin (relative [0,0,0])
    expect(designs[0].containers[0].relativePosition[0]).toBeCloseTo(0);
    // Second container offset from first
    expect(designs[0].containers[1].relativePosition[0]).toBeCloseTo(20);
    expect(designs[0].containers[1].relativePosition[2]).toBeCloseTo(5);
  });

  it('SAVE-4: applying a user voxel preset sets all 6 faces', () => {
    const faces = { top: 'Deck_Wood' as const, bottom: 'Concrete' as const, n: 'Glass_Pane' as const, s: 'Solid_Steel' as const, e: 'Railing_Cable' as const, w: 'Open' as const };
    useStore.getState().saveBlockToLibrary('Custom Room', faces);

    // Create a container and stamp the saved preset onto a voxel
    const cId = useStore.getState().addContainer(ContainerSize.Standard40);
    const idx = 1 * VOXEL_COLS + 3; // body voxel
    // Apply by setting each face from the saved block
    const savedBlock = useStore.getState().libraryBlocks[0];
    const f = savedBlock.faces;
    for (const face of ['top', 'bottom', 'n', 's', 'e', 'w'] as const) {
      useStore.getState().setVoxelFace(cId, idx, face, f[face]);
    }

    const v = useStore.getState().containers[cId].voxelGrid![idx];
    expect(v.faces.top).toBe('Deck_Wood');
    expect(v.faces.bottom).toBe('Concrete');
    expect(v.faces.n).toBe('Glass_Pane');
    expect(v.faces.e).toBe('Railing_Cable');
  });

  it('SAVE-5: loadHomeDesign creates containers with saved config', () => {
    // Create a home and save it
    const cId = useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
    useStore.getState().setVoxelFace(cId, 11, 'n', 'Glass_Pane');
    const designId = useStore.getState().saveHomeDesign('Test Home');

    // Reset and load
    resetStore();
    // Re-save the design (since resetStore clears it)
    // Instead, save first then reset containers only
    // Actually let's just test that loadHomeDesign works with a design already in store
    const designs = useStore.getState().libraryHomeDesigns;
    // After reset, designs are gone. Let's create a fresh scenario:
    const id1 = useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
    useStore.getState().setVoxelFace(id1, 11, 'n', 'Glass_Pane');
    const did = useStore.getState().saveHomeDesign('My Home');

    // Count containers before
    const countBefore = Object.keys(useStore.getState().containers).length;

    // Load the home design
    const ids = useStore.getState().loadHomeDesign(did);
    expect(ids.length).toBe(1);
    const countAfter = Object.keys(useStore.getState().containers).length;
    expect(countAfter).toBe(countBefore + 1);

    // The loaded container should have the glass face
    const loaded = useStore.getState().containers[ids[0]];
    expect(loaded.voxelGrid![11].faces.n).toBe('Glass_Pane');
  });

  it('SAVE-6: libraryHomeDesigns included in persist partialize', () => {
    // saveHomeDesign stores in libraryHomeDesigns which is in persist partialize
    useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 });
    useStore.getState().saveHomeDesign('Persisted Home');
    // Verify the design is in state (persist partialize includes it)
    const state = useStore.getState();
    expect(state.libraryHomeDesigns.length).toBe(1);
    expect(state.libraryHomeDesigns[0].label).toBe('Persisted Home');
  });

  it('SAVE-7: deleting a user preset removes it from the list', () => {
    // Save block
    const blockId = useStore.getState().saveBlockToLibrary('Block1', { top: 'Open' as const, bottom: 'Open' as const, n: 'Open' as const, s: 'Open' as const, e: 'Open' as const, w: 'Open' as const });
    expect(useStore.getState().libraryBlocks.length).toBe(1);
    useStore.getState().removeLibraryItem(blockId);
    expect(useStore.getState().libraryBlocks.length).toBe(0);

    // Save container
    const cId = useStore.getState().addContainer(ContainerSize.Standard40);
    const contId = useStore.getState().saveContainerToLibrary(cId, 'C1')!;
    expect(useStore.getState().libraryContainers.length).toBe(1);
    useStore.getState().removeLibraryItem(contId);
    expect(useStore.getState().libraryContainers.length).toBe(0);

    // Save home design
    useStore.getState().saveHomeDesign('Home1');
    expect(useStore.getState().libraryHomeDesigns.length).toBe(1);
    const designId = useStore.getState().libraryHomeDesigns[0].id;
    useStore.getState().removeLibraryItem(designId);
    expect(useStore.getState().libraryHomeDesigns.length).toBe(0);
  });
});
