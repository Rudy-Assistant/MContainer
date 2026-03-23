import type { SceneObject, ObjectAnchor } from '@/types/sceneObject';
import { formRegistry } from '@/config/formRegistry';
import { getOccupiedSlots, canPlaceInSlot, canPlaceFloorObject } from '@/utils/slotOccupancy';

export interface SceneObjectSlice {
  sceneObjects: Record<string, SceneObject>;
  placeObject: (formId: string, anchor: ObjectAnchor, skinOverrides?: Record<string, string>) => string;
  removeObject: (objectId: string) => void;
  updateSkin: (objectId: string, slotId: string, materialId: string) => void;
  applyQuickSkin: (objectId: string, slots: Record<string, string>) => void;
  updateObjectState: (objectId: string, key: string, value: unknown) => void;
  moveObject: (objectId: string, newAnchor: ObjectAnchor) => void;
  duplicateObject: (objectId: string, newAnchor: ObjectAnchor) => string;
  removeObjectsByContainer: (containerId: string) => void;
}

export function createSceneObjectSlice(set: any, get: any): SceneObjectSlice {
  return {
    sceneObjects: {},

    placeObject: (formId, anchor, skinOverrides) => {
      const form = formRegistry.get(formId);
      if (!form) return '';

      // Validate slot occupancy for face-anchored objects
      if (anchor.type === 'face' && anchor.face != null) {
        const allObjects = Object.values(get().sceneObjects) as SceneObject[];
        const occupied = getOccupiedSlots(allObjects, anchor.containerId, anchor.voxelIndex, anchor.face, formRegistry);
        if (!canPlaceInSlot(occupied, anchor.slot ?? 0, form.slotWidth)) return '';
      }

      // Validate bounding-box collision for floor/ceiling objects
      if (anchor.type === 'floor' || anchor.type === 'ceiling') {
        const allObjects = Object.values(get().sceneObjects) as SceneObject[];
        const sameVoxelObjects = allObjects.filter(o =>
          o.anchor.containerId === anchor.containerId &&
          o.anchor.voxelIndex === anchor.voxelIndex &&
          o.anchor.type === anchor.type
        ).map(o => ({
          dims: formRegistry.get(o.formId)?.dimensions ?? { w: 0, h: 0, d: 0 },
          offset: o.anchor.offset ?? [0, 0] as [number, number],
        }));
        if (!canPlaceFloorObject(form.dimensions, anchor.offset ?? [0, 0], sameVoxelObjects)) return '';
      }

      const id = crypto.randomUUID();
      const obj: SceneObject = {
        id,
        formId,
        skin: skinOverrides ?? {},
        anchor,
      };

      set((s: any) => {
        s.sceneObjects[id] = obj;
      });
      return id;
    },

    removeObject: (objectId) => {
      set((s: any) => {
        delete s.sceneObjects[objectId];
      });
    },

    updateSkin: (objectId, slotId, materialId) => {
      set((s: any) => {
        const obj = s.sceneObjects[objectId];
        if (obj) obj.skin[slotId] = materialId;
      });
    },

    applyQuickSkin: (objectId, slots) => {
      set((s: any) => {
        const obj = s.sceneObjects[objectId];
        if (obj) obj.skin = { ...slots };
      });
    },

    updateObjectState: (objectId, key, value) => {
      set((s: any) => {
        const obj = s.sceneObjects[objectId];
        if (!obj) return;
        if (!obj.state) obj.state = {};
        obj.state[key] = value;
      });
    },

    moveObject: (objectId, newAnchor) => {
      set((s: any) => {
        const obj = s.sceneObjects[objectId];
        if (obj) obj.anchor = newAnchor;
      });
    },

    duplicateObject: (objectId, newAnchor) => {
      const source = get().sceneObjects[objectId] as SceneObject | undefined;
      if (!source) return '';

      const form = formRegistry.get(source.formId);
      if (!form) return '';

      // Validate new anchor slot (face)
      if (newAnchor.type === 'face' && newAnchor.face != null) {
        const allObjects = Object.values(get().sceneObjects) as SceneObject[];
        const occupied = getOccupiedSlots(allObjects, newAnchor.containerId, newAnchor.voxelIndex, newAnchor.face, formRegistry);
        if (!canPlaceInSlot(occupied, newAnchor.slot ?? 0, form.slotWidth)) return '';
      }

      // Validate bounding-box collision (floor/ceiling)
      if (newAnchor.type === 'floor' || newAnchor.type === 'ceiling') {
        const allObjects = Object.values(get().sceneObjects) as SceneObject[];
        const sameVoxelObjects = allObjects.filter(o =>
          o.anchor.containerId === newAnchor.containerId &&
          o.anchor.voxelIndex === newAnchor.voxelIndex &&
          o.anchor.type === newAnchor.type
        ).map(o => ({
          dims: formRegistry.get(o.formId)?.dimensions ?? { w: 0, h: 0, d: 0 },
          offset: o.anchor.offset ?? [0, 0] as [number, number],
        }));
        if (!canPlaceFloorObject(form.dimensions, newAnchor.offset ?? [0, 0], sameVoxelObjects)) return '';
      }

      const id = crypto.randomUUID();
      set((s: any) => {
        s.sceneObjects[id] = {
          id,
          formId: source.formId,
          skin: { ...source.skin },
          anchor: newAnchor,
        };
      });
      return id;
    },

    removeObjectsByContainer: (containerId) => {
      set((s: any) => {
        for (const [id, obj] of Object.entries(s.sceneObjects)) {
          if ((obj as SceneObject).anchor.containerId === containerId) {
            delete s.sceneObjects[id];
          }
        }
      });
    },
  };
}
