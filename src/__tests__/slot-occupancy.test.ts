import { describe, it, expect } from 'vitest';
import {
  getOccupiedSlots,
  canPlaceInSlot,
  getSlotsForPlacement,
  canPlaceFloorObject,
} from '@/utils/slotOccupancy';
import type { SceneObject, FormDefinition } from '@/types/sceneObject';

function makeObj(overrides: Partial<SceneObject> & { anchor: SceneObject['anchor'] }): SceneObject {
  return { id: 'obj-1', formId: 'test', skin: {}, ...overrides };
}

describe('Slot Occupancy', () => {
  describe('getOccupiedSlots', () => {
    it('returns empty set when no objects on face', () => {
      const result = getOccupiedSlots([], 'c1', 12, 'n');
      expect(result.size).toBe(0);
    });

    it('returns correct slots for slotWidth=1 object at slot 0', () => {
      const objects = [makeObj({ anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0 } })];
      const formMap = new Map([['test', { slotWidth: 1 } as FormDefinition]]);
      const result = getOccupiedSlots(objects, 'c1', 12, 'n', formMap);
      expect(result).toEqual(new Set([0]));
    });

    it('returns correct slots for slotWidth=2 object at slot 0', () => {
      const objects = [makeObj({ anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0 } })];
      const formMap = new Map([['test', { slotWidth: 2 } as FormDefinition]]);
      const result = getOccupiedSlots(objects, 'c1', 12, 'n', formMap);
      expect(result).toEqual(new Set([0, 1]));
    });

    it('returns correct slots for slotWidth=3 (fills face)', () => {
      const objects = [makeObj({ anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 0 } })];
      const formMap = new Map([['test', { slotWidth: 3 } as FormDefinition]]);
      const result = getOccupiedSlots(objects, 'c1', 12, 'n', formMap);
      expect(result).toEqual(new Set([0, 1, 2]));
    });

    it('ignores objects on different face', () => {
      const objects = [makeObj({ anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 's', slot: 0 } })];
      const formMap = new Map([['test', { slotWidth: 1 } as FormDefinition]]);
      const result = getOccupiedSlots(objects, 'c1', 12, 'n', formMap);
      expect(result.size).toBe(0);
    });
  });

  describe('canPlaceInSlot', () => {
    it('allows placement when all needed slots are free', () => {
      expect(canPlaceInSlot(new Set(), 0, 2)).toBe(true);
    });

    it('rejects when any needed slot is occupied', () => {
      expect(canPlaceInSlot(new Set([1]), 0, 2)).toBe(false);
    });

    it('rejects when slot + width exceeds 3', () => {
      expect(canPlaceInSlot(new Set(), 2, 2)).toBe(false);
    });
  });

  describe('getSlotsForPlacement', () => {
    it('returns [0,1,2] for slotWidth=1 on empty face', () => {
      expect(getSlotsForPlacement(new Set(), 1)).toEqual([0, 1, 2]);
    });

    it('returns [0,1] for slotWidth=2 on empty face', () => {
      expect(getSlotsForPlacement(new Set(), 2)).toEqual([0, 1]);
    });

    it('returns [0] for slotWidth=3 on empty face', () => {
      expect(getSlotsForPlacement(new Set(), 3)).toEqual([0]);
    });

    it('returns empty for slotWidth=2 when slot 1 occupied', () => {
      expect(getSlotsForPlacement(new Set([1]), 2)).toEqual([]);
    });
  });

  describe('canPlaceFloorObject', () => {
    it('allows placement when no other floor objects in voxel', () => {
      expect(canPlaceFloorObject(
        { w: 0.3, h: 0.5, d: 0.3 },
        [0, 0],
        [],
      )).toBe(true);
    });

    it('rejects overlapping floor objects', () => {
      const existing = [{ dims: { w: 0.3, h: 0.5, d: 0.3 }, offset: [0, 0] as [number, number] }];
      expect(canPlaceFloorObject(
        { w: 0.3, h: 0.5, d: 0.3 },
        [0, 0],
        existing,
      )).toBe(false);
    });
  });
});
