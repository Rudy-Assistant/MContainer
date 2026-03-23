import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('Scene Object Canary', () => {
  beforeEach(resetStore);

  it('full lifecycle: place → skin → remove → undo', () => {
    const cId = useStore.getState().addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: 0 });

    const doorId = useStore.getState().placeObject('door_single_swing', {
      containerId: cId, voxelIndex: 12, type: 'face', face: 'n', slot: 0,
    });
    const windowId = useStore.getState().placeObject('window_standard', {
      containerId: cId, voxelIndex: 5, type: 'face', face: 'e', slot: 0,
    });
    const lightId = useStore.getState().placeObject('light_pendant', {
      containerId: cId, voxelIndex: 10, type: 'ceiling',
    });

    expect(doorId).toBeTruthy();
    expect(windowId).toBeTruthy();
    expect(lightId).toBeTruthy();
    expect(Object.keys(useStore.getState().sceneObjects)).toHaveLength(3);

    // Verify BOM includes scene object costs
    const estimate = useStore.getState().getEstimate();
    expect(estimate.breakdown.sceneObjects).toBeGreaterThan(0);

    // Update skin
    useStore.getState().updateSkin(doorId, 'frame', 'polished_chrome');
    expect(useStore.getState().sceneObjects[doorId].skin.frame).toBe('polished_chrome');

    // Remove door
    useStore.getState().removeObject(doorId);
    expect(useStore.getState().sceneObjects[doorId]).toBeUndefined();
    expect(Object.keys(useStore.getState().sceneObjects)).toHaveLength(2);

    // Undo (restore door)
    useStore.temporal.getState().undo();
    expect(useStore.getState().sceneObjects[doorId]).toBeDefined();
    expect(Object.keys(useStore.getState().sceneObjects)).toHaveLength(3);
  });

  it('removeContainer cascades to delete scene objects', () => {
    const cId = useStore.getState().addContainer(ContainerSize.Standard20, { x: 0, y: 0, z: 0 });

    useStore.getState().placeObject('window_standard', {
      containerId: cId, voxelIndex: 5, type: 'face', face: 'n', slot: 0,
    });
    useStore.getState().placeObject('light_pendant', {
      containerId: cId, voxelIndex: 10, type: 'ceiling',
    });

    expect(Object.keys(useStore.getState().sceneObjects)).toHaveLength(2);

    useStore.getState().removeContainer(cId);
    expect(Object.keys(useStore.getState().sceneObjects)).toHaveLength(0);
  });

  it('placement mode state toggles correctly', () => {
    useStore.getState().setPlacementMode('door_single_swing');
    expect(useStore.getState().placementMode).toBe(true);
    expect(useStore.getState().activePlacementFormId).toBe('door_single_swing');

    useStore.getState().setPlacementMode(null);
    expect(useStore.getState().placementMode).toBe(false);
    expect(useStore.getState().activePlacementFormId).toBeNull();
  });

  it('selectObject sets and clears selectedObjectId', () => {
    useStore.getState().selectObject('obj-1');
    expect(useStore.getState().selectedObjectId).toBe('obj-1');

    useStore.getState().selectObject(null);
    expect(useStore.getState().selectedObjectId).toBeNull();
  });
});
