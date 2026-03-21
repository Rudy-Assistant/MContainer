import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { getTexturePaths, applyTextures } from '../config/textureLoader';

describe('getTexturePaths', () => {
  it('returns null for flat quality', () => {
    expect(getTexturePaths('Corrugated_Steel', 'flat')).toBeNull();
  });

  it('returns .jpg paths for 1k quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', '1k')!;
    expect(paths.color).toBe('/assets/materials/Corrugated_Steel/color.jpg');
    expect(paths.normal).toBe('/assets/materials/Corrugated_Steel/normal.jpg');
    expect(paths.roughness).toBe('/assets/materials/Corrugated_Steel/roughness.jpg');
  });

  it('returns .ktx2 paths for 2k quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', '2k')!;
    expect(paths.color).toBe('/assets/materials-ktx2/Corrugated_Steel/color.ktx2');
    expect(paths.normal).toBe('/assets/materials-ktx2/Corrugated_Steel/normal.ktx2');
    expect(paths.roughness).toBe('/assets/materials-ktx2/Corrugated_Steel/roughness.ktx2');
  });
});

describe('applyTextures fallback', () => {
  it('uses TextureLoader when KTX2Loader is not initialized', () => {
    const mat = new THREE.MeshStandardMaterial();
    const invalidate = vi.fn();
    const ktx2Paths = getTexturePaths('Corrugated_Steel', '2k')!;

    const loadSpy = vi.fn();
    const origLoad = THREE.TextureLoader.prototype.load;
    THREE.TextureLoader.prototype.load = loadSpy;

    applyTextures(mat, ktx2Paths, 2, 2, 0.6, invalidate, 'Corrugated_Steel');

    // Since KTX2Loader is null, falls through to TextureLoader
    expect(loadSpy).toHaveBeenCalledTimes(3);

    THREE.TextureLoader.prototype.load = origLoad;
    mat.dispose();
  });
});
