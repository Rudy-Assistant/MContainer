import { describe, expect, it } from 'vitest';
import { BLOOM_CONFIG, getBloomSettings } from '@/components/three/PostProcessingStack';

describe('post-processing bloom settings', () => {
  it('keeps default bloom subtle enough to avoid sky washout', () => {
    expect(BLOOM_CONFIG.luminanceThreshold).toBeGreaterThanOrEqual(1.0);
    expect(BLOOM_CONFIG.intensity).toBeLessThanOrEqual(0.5);
  });

  it('keeps soft bloom restrained', () => {
    const settings = getBloomSettings(true);

    expect(settings.luminanceThreshold).toBeGreaterThanOrEqual(0.75);
    expect(settings.intensity).toBeLessThanOrEqual(0.85);
  });

  it('keeps soft bloom stronger than the default without reverting to overexposure', () => {
    const normal = getBloomSettings(false);
    const soft = getBloomSettings(true);

    expect(soft.luminanceThreshold).toBeLessThan(normal.luminanceThreshold);
    expect(soft.intensity).toBeGreaterThan(normal.intensity);
  });
});
