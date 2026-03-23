import { describe, it, expect } from 'vitest';
import { getSwatchSrc, generateNoiseSwatch } from '@/components/ui/finishes/textureThumbnail';
import { FLOOR_MATERIALS } from '@/config/finishPresets';

describe('textureThumbnail', () => {
  it('returns texture URL when textureFolder is provided', () => {
    const src = getSwatchSrc({ id: 'bamboo', label: 'Bamboo', color: '#D4B896', textureFolder: 'Bamboo' });
    expect(src).toBe('/assets/materials/Bamboo/color.jpg');
  });

  it('returns null when no textureFolder', () => {
    const src = getSwatchSrc({ id: 'tatami', label: 'Tatami', color: '#C8D5A0' });
    expect(src).toBeNull();
  });

  it('generates a data URL for noise swatch', () => {
    const dataUrl = generateNoiseSwatch('test', '#FF0000', 4);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('caches generated swatches by id', () => {
    const a = generateNoiseSwatch('cache-test', '#00FF00', 4);
    const b = generateNoiseSwatch('cache-test', '#00FF00', 4);
    expect(a).toBe(b);
  });
});

describe('TextureSwatchGrid data integration', () => {
  it('FLOOR_MATERIALS with textureFolder resolve to valid paths', () => {
    const withTexture = FLOOR_MATERIALS.filter(m => m.textureFolder);
    expect(withTexture.length).toBeGreaterThanOrEqual(4);
    for (const m of withTexture) {
      const src = getSwatchSrc(m);
      expect(src).toMatch(/^\/assets\/materials\/.+\/color\.jpg$/);
    }
  });

  it('FLOOR_MATERIALS without textureFolder have fallback color', () => {
    const noTexture = FLOOR_MATERIALS.filter(m => !m.textureFolder);
    for (const m of noTexture) {
      expect(m.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
