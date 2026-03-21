import { describe, it, expect } from 'vitest';
import { getTexturePaths } from '@/config/textureLoader';

describe('Texture Loader', () => {
  it('returns null for flat quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', 'flat');
    expect(paths).toBeNull();
  });

  it('returns JPG paths for 1k quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', '1k');
    expect(paths!.color).toContain('/assets/materials/Corrugated_Steel/color.jpg');
    expect(paths!.normal).toContain('/assets/materials/Corrugated_Steel/normal.jpg');
    expect(paths!.roughness).toContain('/assets/materials/Corrugated_Steel/roughness.jpg');
  });

  it('returns KTX2 paths for 2k quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', '2k');
    expect(paths!.color).toContain('/assets/materials-ktx2/Corrugated_Steel/color.ktx2');
  });
});
