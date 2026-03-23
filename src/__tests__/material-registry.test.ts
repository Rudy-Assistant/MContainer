import { describe, it, expect } from 'vitest';
import { materialRegistry, getMaterial } from '@/config/materialRegistry';

describe('Material Registry', () => {
  it('contains at least 40 materials', () => {
    expect(materialRegistry.size).toBeGreaterThanOrEqual(40);
  });

  it('every material has valid color (hex string), metalness, roughness', () => {
    for (const [id, mat] of materialRegistry) {
      expect(mat.id).toBe(id);
      expect(mat.color).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(mat.metalness).toBeGreaterThanOrEqual(0);
      expect(mat.metalness).toBeLessThanOrEqual(1);
      expect(mat.roughness).toBeGreaterThanOrEqual(0);
      expect(mat.roughness).toBeLessThanOrEqual(1);
      expect(mat.applicableTo.length).toBeGreaterThan(0);
    }
  });

  it('getMaterial returns undefined for unknown ID', () => {
    expect(getMaterial('nonexistent')).toBeUndefined();
  });

  it('getMaterial returns correct material by ID', () => {
    const steel = getMaterial('raw_steel');
    expect(steel).toBeDefined();
    expect(steel!.label).toBe('Raw Steel');
    expect(steel!.metalness).toBeGreaterThan(0.5);
  });

  it('no duplicate material IDs', () => {
    const ids = [...materialRegistry.keys()];
    expect(new Set(ids).size).toBe(ids.length);
  });
});
