import { describe, it, expect } from 'vitest';
import { sceneObjectSchema } from '@/store/persistSchema';
import { migrateToSceneObjects } from '@/utils/migration/migrateToSceneObjects';
import type { SceneObject } from '@/types/sceneObject';

describe('SceneObject persist schema', () => {
  it('validates a valid SceneObject', () => {
    const result = sceneObjectSchema.safeParse({
      id: 'test-1',
      formId: 'door_single_swing',
      skin: { frame: 'matte_black' },
      anchor: { containerId: 'c1', voxelIndex: 12, type: 'face', face: 'n', slot: 1 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects SceneObject with missing formId', () => {
    const result = sceneObjectSchema.safeParse({
      id: 'test-1',
      skin: {},
      anchor: { containerId: 'c1', voxelIndex: 12, type: 'face' },
    });
    expect(result.success).toBe(false);
  });
});

describe('migrateToSceneObjects', () => {
  it('adds schemaVersion 2 and empty sceneObjects to old state', () => {
    const old = { containers: {}, zones: {} };
    const result = migrateToSceneObjects(old);
    expect(result.schemaVersion).toBe(2);
    expect(result.sceneObjects).toEqual({});
  });

  it('preserves existing sceneObjects', () => {
    const existing = { containers: {}, sceneObjects: { 'a': { id: 'a' } } };
    const result = migrateToSceneObjects(existing);
    expect(result.sceneObjects).toEqual({ 'a': { id: 'a' } });
  });

  it('returns same state if schemaVersion >= 2', () => {
    const state = { containers: {}, sceneObjects: {}, schemaVersion: 2 };
    const result = migrateToSceneObjects(state);
    expect(result).toBe(state); // same reference
  });
});

describe('migrateToSceneObjects - full migration', () => {
  it('migrates LightPlacement to ceiling light SceneObject', () => {
    const old = {
      containers: {
        'c1': {
          id: 'c1',
          lights: [{ voxelIndex: 10, type: 'ceiling' }],
          voxelGrid: [],
        },
      },
    };
    const result = migrateToSceneObjects(old);
    const objects = Object.values(result.sceneObjects as Record<string, SceneObject>);
    expect(objects).toHaveLength(1);
    expect(objects[0].formId).toBe('light_flush_mount');
    expect(objects[0].anchor.type).toBe('ceiling');
    expect(objects[0].anchor.voxelIndex).toBe(10);
  });

  it('migrates LightPlacement lamp to floor lamp SceneObject', () => {
    const old = {
      containers: {
        'c1': { id: 'c1', lights: [{ voxelIndex: 5, type: 'lamp' }], voxelGrid: [] },
      },
    };
    const result = migrateToSceneObjects(old);
    const objects = Object.values(result.sceneObjects as Record<string, SceneObject>);
    expect(objects[0].formId).toBe('light_floor_lamp');
    expect(objects[0].anchor.type).toBe('floor');
  });

  it('migrates DoorConfig to door SceneObject', () => {
    const old = {
      containers: {
        'c1': {
          id: 'c1',
          lights: [],
          voxelGrid: [
            { active: true, faces: {}, doorConfig: { n: { state: 'closed', type: 'swing', hingeEdge: 'left', swingDirection: 'in', slideDirection: 'positive' } } },
          ],
        },
      },
    };
    const result = migrateToSceneObjects(old);
    const objects = Object.values(result.sceneObjects as Record<string, SceneObject>);
    expect(objects).toHaveLength(1);
    expect(objects[0].formId).toBe('door_single_swing');
    expect(objects[0].anchor.face).toBe('n');
    expect(objects[0].state?.openState).toBe('closed');
  });

  it('migrates slide DoorConfig to glass slide door', () => {
    const old = {
      containers: {
        'c1': {
          id: 'c1', lights: [],
          voxelGrid: [
            { active: true, faces: {}, doorConfig: { s: { state: 'closed', type: 'slide', hingeEdge: 'left', swingDirection: 'in', slideDirection: 'positive' } } },
          ],
        },
      },
    };
    const result = migrateToSceneObjects(old);
    expect(Object.values(result.sceneObjects as Record<string, SceneObject>)[0].formId).toBe('door_glass_slide');
  });

  it('migrates faceFinish electrical to outlet SceneObject', () => {
    const old = {
      containers: {
        'c1': {
          id: 'c1', lights: [],
          voxelGrid: [
            { active: true, faces: {}, faceFinishes: { e: { electrical: 'outlet' } } },
          ],
        },
      },
    };
    const result = migrateToSceneObjects(old);
    const objects = Object.values(result.sceneObjects as Record<string, SceneObject>);
    expect(objects).toHaveLength(1);
    expect(objects[0].formId).toBe('electrical_outlet');
    expect(objects[0].anchor.face).toBe('e');
  });

  it('preserves existing sceneObjects during migration', () => {
    const old = {
      sceneObjects: { 'existing-1': { id: 'existing-1', formId: 'window_standard', skin: {}, anchor: { containerId: 'c1', voxelIndex: 0, type: 'face', face: 'n', slot: 0 } } },
      containers: {
        'c1': { id: 'c1', lights: [{ voxelIndex: 5, type: 'ceiling' }], voxelGrid: [] },
      },
    };
    const result = migrateToSceneObjects(old);
    expect(result.sceneObjects['existing-1']).toBeDefined();
    expect(Object.keys(result.sceneObjects).length).toBe(2); // existing + migrated
  });

  it('handles empty containers gracefully', () => {
    const old = { containers: { 'c1': { id: 'c1' } } };
    const result = migrateToSceneObjects(old);
    expect(result.schemaVersion).toBe(2);
    expect(Object.keys(result.sceneObjects)).toHaveLength(0);
  });
});
