import { describe, it, expect } from 'vitest';
import { GROUND_PRESETS } from '@/config/groundPresets';

describe('Ground Presets', () => {
  it('grass preset specifies ambientCG texture filenames', () => {
    const grass = GROUND_PRESETS.grass;
    expect(grass.colorFile).toBeDefined();
    expect(grass.normalFile).toBeDefined();
    expect(grass.roughnessFile).toBeDefined();
  });

  it('other presets default to generic filenames (no override fields)', () => {
    expect(GROUND_PRESETS.concrete.colorFile).toBeUndefined();
    expect(GROUND_PRESETS.gravel.colorFile).toBeUndefined();
  });
});
