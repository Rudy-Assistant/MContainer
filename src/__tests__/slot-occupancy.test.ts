import { describe, it, expect } from 'vitest';
import {
  getOccupiedSlots,
  canPlaceInSlot,
  getSlotsForPlacement,
  canPlaceFloorObject,
  FACE_SLOT_COUNT,
} from '@/utils/slotOccupancy';
import type { SceneObject, FormDefinition } from '@/types/sceneObject';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeObj(
  overrides: Partial<SceneObject['anchor']> & { formId?: string } = {},
): SceneObject {
  return {
    id: 'obj-' + Math.random().toString(36).slice(2, 6),
    formId: overrides.formId ?? 'door-single',
    skin: {},
    anchor: {
      containerId: overrides.containerId ?? 'c1',
      voxelIndex: overrides.voxelIndex ?? 0,
      type: 'face' as const,
      face: overrides.face ?? 'n',
      slot: overrides.slot ?? 0,
    },
  };
}

function makeFormMap(entries: [string, number][]): Map<string, FormDefinition> {
  const map = new Map<string, FormDefinition>();
  for (const [id, slotWidth] of entries) {
    map.set(id, {
      id,
      category: 'door',
      name: id,
      description: '',
      styles: ['modern'],
      anchorType: 'face',
      slotWidth: slotWidth as 1 | 2 | 3,
      dimensions: { w: 1, h: 2, d: 0.1 },
      skinSlots: [],
      defaultSkin: {},
      geometry: 'procedural',
      costEstimate: 100,
    });
  }
  return map;
}

// ---------------------------------------------------------------------------
// FACE_SLOT_COUNT
// ---------------------------------------------------------------------------

describe('FACE_SLOT_COUNT', () => {
  it('equals 3', () => {
    expect(FACE_SLOT_COUNT).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// getOccupiedSlots
// ---------------------------------------------------------------------------

describe('getOccupiedSlots', () => {
  it('returns empty set for empty objects array', () => {
    const result = getOccupiedSlots([], 'c1', 0, 'n');
    expect(result.size).toBe(0);
  });

  it('returns occupied slot for a single width-1 object', () => {
    const obj = makeObj({ slot: 1 });
    const result = getOccupiedSlots([obj], 'c1', 0, 'n');
    expect(result).toEqual(new Set([1]));
  });

  it('uses formMap slotWidth to occupy multiple slots', () => {
    const obj = makeObj({ slot: 0, formId: 'wide-door' });
    const formMap = makeFormMap([['wide-door', 2]]);
    const result = getOccupiedSlots([obj], 'c1', 0, 'n', formMap);
    expect(result).toEqual(new Set([0, 1]));
  });

  it('defaults slotWidth to 1 when formMap is undefined', () => {
    const obj = makeObj({ slot: 2 });
    const result = getOccupiedSlots([obj], 'c1', 0, 'n');
    expect(result).toEqual(new Set([2]));
  });

  it('defaults slotWidth to 1 when formId not in formMap', () => {
    const obj = makeObj({ slot: 0, formId: 'unknown' });
    const formMap = makeFormMap([['other', 3]]);
    const result = getOccupiedSlots([obj], 'c1', 0, 'n', formMap);
    expect(result).toEqual(new Set([0]));
  });

  it('ignores objects with different containerId', () => {
    const obj = makeObj({ containerId: 'c2', slot: 0 });
    const result = getOccupiedSlots([obj], 'c1', 0, 'n');
    expect(result.size).toBe(0);
  });

  it('ignores objects with different voxelIndex', () => {
    const obj = makeObj({ voxelIndex: 5, slot: 0 });
    const result = getOccupiedSlots([obj], 'c1', 0, 'n');
    expect(result.size).toBe(0);
  });

  it('ignores objects with different face', () => {
    const obj = makeObj({ face: 's', slot: 0 });
    const result = getOccupiedSlots([obj], 'c1', 0, 'n');
    expect(result.size).toBe(0);
  });

  it('ignores objects with anchor type not face', () => {
    const obj = makeObj({ slot: 0 });
    obj.anchor.type = 'floor';
    const result = getOccupiedSlots([obj], 'c1', 0, 'n');
    expect(result.size).toBe(0);
  });

  it('aggregates multiple objects on same face', () => {
    const obj1 = makeObj({ slot: 0 });
    const obj2 = makeObj({ slot: 2 });
    const result = getOccupiedSlots([obj1, obj2], 'c1', 0, 'n');
    expect(result).toEqual(new Set([0, 2]));
  });

  it('handles full occupancy (all 3 slots)', () => {
    const objs = [makeObj({ slot: 0 }), makeObj({ slot: 1 }), makeObj({ slot: 2 })];
    const result = getOccupiedSlots(objs, 'c1', 0, 'n');
    expect(result).toEqual(new Set([0, 1, 2]));
  });

  it('defaults slot to 0 when anchor.slot is undefined', () => {
    const obj = makeObj();
    obj.anchor.slot = undefined;
    const result = getOccupiedSlots([obj], 'c1', 0, 'n');
    expect(result).toEqual(new Set([0]));
  });

  it('handles width-3 object occupying all slots', () => {
    const obj = makeObj({ slot: 0, formId: 'garage-door' });
    const formMap = makeFormMap([['garage-door', 3]]);
    const result = getOccupiedSlots([obj], 'c1', 0, 'n', formMap);
    expect(result).toEqual(new Set([0, 1, 2]));
  });
});

// ---------------------------------------------------------------------------
// canPlaceInSlot
// ---------------------------------------------------------------------------

describe('canPlaceInSlot', () => {
  it('returns true for empty set, width 1, slot 0', () => {
    expect(canPlaceInSlot(new Set(), 0, 1)).toBe(true);
  });

  it('returns true for empty set, width 1, slot 2', () => {
    expect(canPlaceInSlot(new Set(), 2, 1)).toBe(true);
  });

  it('returns false when slot is occupied', () => {
    expect(canPlaceInSlot(new Set([1]), 1, 1)).toBe(false);
  });

  it('returns false when any slot in range is occupied', () => {
    expect(canPlaceInSlot(new Set([1]), 0, 2)).toBe(false);
  });

  it('returns false when placement overflows past FACE_SLOT_COUNT', () => {
    expect(canPlaceInSlot(new Set(), 2, 2)).toBe(false);
  });

  it('returns false for width-3 starting at slot 1 (overflow)', () => {
    expect(canPlaceInSlot(new Set(), 1, 3)).toBe(false);
  });

  it('returns true for width-3 at slot 0 with nothing occupied', () => {
    expect(canPlaceInSlot(new Set(), 0, 3)).toBe(true);
  });

  it('returns false for width-3 at slot 0 when slot 2 occupied', () => {
    expect(canPlaceInSlot(new Set([2]), 0, 3)).toBe(false);
  });

  it('returns true for width-2 at slot 1 with slot 0 occupied', () => {
    expect(canPlaceInSlot(new Set([0]), 1, 2)).toBe(true);
  });

  it('returns false when width exceeds FACE_SLOT_COUNT', () => {
    expect(canPlaceInSlot(new Set(), 0, 4)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSlotsForPlacement
// ---------------------------------------------------------------------------

describe('getSlotsForPlacement', () => {
  it('returns [0, 1, 2] for width 1 with nothing occupied', () => {
    expect(getSlotsForPlacement(new Set(), 1)).toEqual([0, 1, 2]);
  });

  it('returns [0, 1] for width 2 with nothing occupied', () => {
    expect(getSlotsForPlacement(new Set(), 2)).toEqual([0, 1]);
  });

  it('returns [0] for width 3 with nothing occupied', () => {
    expect(getSlotsForPlacement(new Set(), 3)).toEqual([0]);
  });

  it('returns [] for width larger than FACE_SLOT_COUNT', () => {
    expect(getSlotsForPlacement(new Set(), 4)).toEqual([]);
  });

  it('excludes slots blocked by occupancy', () => {
    expect(getSlotsForPlacement(new Set([1]), 1)).toEqual([0, 2]);
  });

  it('returns [] when fully occupied', () => {
    expect(getSlotsForPlacement(new Set([0, 1, 2]), 1)).toEqual([]);
  });

  it('returns [] when width-2 blocked by middle slot', () => {
    expect(getSlotsForPlacement(new Set([1]), 2)).toEqual([]);
  });

  it('returns [1] for width-2 when slot 0 occupied', () => {
    expect(getSlotsForPlacement(new Set([0]), 2)).toEqual([1]);
  });

  it('returns [0] for width-2 when slot 2 occupied', () => {
    expect(getSlotsForPlacement(new Set([2]), 2)).toEqual([0]);
  });
});

// ---------------------------------------------------------------------------
// canPlaceFloorObject
// ---------------------------------------------------------------------------

describe('canPlaceFloorObject', () => {
  const unit = { w: 1, h: 1, d: 1 };

  it('returns true with no existing objects', () => {
    expect(canPlaceFloorObject(unit, [0, 0], [])).toBe(true);
  });

  it('returns false when identical object overlaps exactly', () => {
    expect(
      canPlaceFloorObject(unit, [0, 0], [{ dims: unit, offset: [0, 0] }]),
    ).toBe(false);
  });

  it('returns true when objects are far apart', () => {
    expect(
      canPlaceFloorObject(unit, [5, 5], [{ dims: unit, offset: [0, 0] }]),
    ).toBe(true);
  });

  it('returns true at exact boundary (strict less-than check)', () => {
    // gap = |1-0| = 1, threshold = (1+1)/2 = 1 => 1 < 1 is false => no overlap
    expect(
      canPlaceFloorObject(unit, [1, 0], [{ dims: unit, offset: [0, 0] }]),
    ).toBe(true);
  });

  it('returns false when objects partially overlap in X', () => {
    expect(
      canPlaceFloorObject(unit, [0.5, 0], [{ dims: unit, offset: [0, 0] }]),
    ).toBe(false);
  });

  it('returns false when objects partially overlap in Z', () => {
    expect(
      canPlaceFloorObject(unit, [0, 0.5], [{ dims: unit, offset: [0, 0] }]),
    ).toBe(false);
  });

  it('returns true when overlap in X only, separated in Z', () => {
    expect(
      canPlaceFloorObject(unit, [0.5, 5], [{ dims: unit, offset: [0, 0] }]),
    ).toBe(true);
  });

  it('checks against all existing objects', () => {
    const existing = [
      { dims: unit, offset: [0, 0] as [number, number] },
      { dims: unit, offset: [3, 3] as [number, number] },
    ];
    // Overlaps second existing object
    expect(canPlaceFloorObject(unit, [3.4, 3.4], existing)).toBe(false);
  });

  it('handles different dimensions (wide existing object)', () => {
    const wide = { w: 2, h: 1, d: 1 };
    // gap 1.2, threshold (2+1)/2=1.5 => 1.2 < 1.5 => overlap
    expect(
      canPlaceFloorObject(unit, [1.2, 0], [{ dims: wide, offset: [0, 0] }]),
    ).toBe(false);
  });

  it('handles deep objects in Z axis', () => {
    const deep = { w: 1, h: 1, d: 3 };
    // X gap 0, Z gap 1.8, Z threshold (3+1)/2=2 => 1.8 < 2 => overlap
    expect(
      canPlaceFloorObject(unit, [0, 1.8], [{ dims: deep, offset: [0, 0] }]),
    ).toBe(false);
  });

  it('returns true with empty existing array and large dims', () => {
    expect(canPlaceFloorObject({ w: 2, h: 2, d: 2 }, [0, 0], [])).toBe(true);
  });
});
