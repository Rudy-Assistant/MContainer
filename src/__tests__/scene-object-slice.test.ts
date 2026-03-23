import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

function resetStore() {
  useStore.setState(useStore.getInitialState(), true);
}

describe('sceneObjectSlice', () => {
  beforeEach(resetStore);

  describe('placeObject', () => {
    it('creates a SceneObject with UUID and correct anchor', () => {
      const id = useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 1,
      });
      expect(id).toBeTruthy();
      const obj = useStore.getState().sceneObjects[id];
      expect(obj).toBeDefined();
      expect(obj.formId).toBe('door_single_swing');
      expect(obj.anchor.face).toBe('n');
      expect(obj.anchor.slot).toBe(1);
    });

    it('applies skin overrides when provided', () => {
      const id = useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0,
      }, { frame: 'polished_chrome' });
      const obj = useStore.getState().sceneObjects[id];
      expect(obj.skin.frame).toBe('polished_chrome');
    });

    it('rejects placement on occupied slot', () => {
      useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0,
      });
      // door_single_swing is slotWidth=2, occupies slots 0,1
      const id2 = useStore.getState().placeObject('window_standard', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 1,
      });
      expect(id2).toBe('');
    });
  });

  describe('removeObject', () => {
    it('deletes the object from sceneObjects', () => {
      const id = useStore.getState().placeObject('window_standard', {
        containerId: 'c1', voxelIndex: 5, type: 'face', face: 'e', slot: 0,
      });
      useStore.getState().removeObject(id);
      expect(useStore.getState().sceneObjects[id]).toBeUndefined();
    });
  });

  describe('updateSkin', () => {
    it('updates a single skin slot', () => {
      const id = useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0,
      });
      useStore.getState().updateSkin(id, 'frame', 'polished_chrome');
      expect(useStore.getState().sceneObjects[id].skin.frame).toBe('polished_chrome');
    });
  });

  describe('updateState', () => {
    it('updates runtime state (e.g. door open)', () => {
      const id = useStore.getState().placeObject('door_single_swing', {
        containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0,
      });
      useStore.getState().updateObjectState(id, 'openState', 'open_swing');
      expect(useStore.getState().sceneObjects[id].state?.openState).toBe('open_swing');
    });
  });

  describe('removeObjectsByContainer', () => {
    it('removes all objects anchored to a container', () => {
      useStore.getState().placeObject('window_standard', {
        containerId: 'c1', voxelIndex: 5, type: 'face', face: 'n', slot: 0,
      });
      useStore.getState().placeObject('light_pendant', {
        containerId: 'c1', voxelIndex: 5, type: 'ceiling',
      });
      useStore.getState().placeObject('window_standard', {
        containerId: 'c2', voxelIndex: 3, type: 'face', face: 'e', slot: 0,
      });

      useStore.getState().removeObjectsByContainer('c1');

      const remaining = Object.values(useStore.getState().sceneObjects);
      expect(remaining).toHaveLength(1);
      expect(remaining[0].anchor.containerId).toBe('c2');
    });
  });

  describe('duplicateObject', () => {
    it('creates a copy with new ID and different anchor', () => {
      const id1 = useStore.getState().placeObject('window_standard', {
        containerId: 'c1', voxelIndex: 5, type: 'face', face: 'n', slot: 0,
      }, { frame: 'polished_chrome' });

      const id2 = useStore.getState().duplicateObject(id1, {
        containerId: 'c1', voxelIndex: 5, type: 'face', face: 'n', slot: 2,
      });

      expect(id2).not.toBe(id1);
      expect(id2).not.toBe('');
      const obj2 = useStore.getState().sceneObjects[id2];
      expect(obj2.formId).toBe('window_standard');
      expect(obj2.skin.frame).toBe('polished_chrome');
      expect(obj2.anchor.slot).toBe(2);
    });
  });
});
