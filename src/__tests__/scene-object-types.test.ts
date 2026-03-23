import { describe, it, expect } from 'vitest';
import type {
  FormDefinition, SceneObject, ObjectAnchor, StyleDefinition,
  MaterialOption, FormCategory, AnchorType, WallDirection,
  StyleId, StyleEffectType, QuickSkinPreset,
} from '@/types/sceneObject';

describe('SceneObject type definitions', () => {
  it('SceneObject can be constructed with all required fields', () => {
    const obj: SceneObject = {
      id: 'test-1',
      formId: 'door_single_swing',
      skin: { frame: 'matte_black' },
      anchor: {
        containerId: 'c-1',
        voxelIndex: 12,
        type: 'face',
        face: 'n',
        slot: 1,
      },
    };
    expect(obj.id).toBe('test-1');
    expect(obj.anchor.face).toBe('n');
  });

  it('FormDefinition can be constructed with all required fields', () => {
    const form: FormDefinition = {
      id: 'door_test',
      category: 'door',
      name: 'Test Door',
      description: 'A test door',
      styles: ['industrial', 'modern'],
      anchorType: 'face',
      slotWidth: 2,
      dimensions: { w: 1.0, h: 2.1, d: 0.1 },
      skinSlots: [{ id: 'frame', label: 'Frame', materialOptions: ['matte_black'] }],
      defaultSkin: { frame: 'matte_black' },
      geometry: 'procedural',
      costEstimate: 800,
    };
    expect(form.category).toBe('door');
    expect(form.slotWidth).toBe(2);
  });

  it('WallDirection only allows n/s/e/w', () => {
    const dirs: WallDirection[] = ['n', 's', 'e', 'w'];
    expect(dirs).toHaveLength(4);
  });

  it('ObjectAnchor floor type has optional offset', () => {
    const anchor: ObjectAnchor = {
      containerId: 'c-1',
      voxelIndex: 5,
      type: 'floor',
      offset: [0.5, 0.3],
    };
    expect(anchor.type).toBe('floor');
    expect(anchor.offset).toEqual([0.5, 0.3]);
  });
});
