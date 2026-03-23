import { describe, it, expect } from 'vitest';
import { sceneObjectSchema } from '@/store/persistSchema';
import { migrateToSceneObjects } from '@/utils/migration/migrateToSceneObjects';

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
