import { describe, it, expect } from 'vitest';
import { getLightIntensity } from '@/components/three/InteriorLights';

describe('Interior Light Intensity', () => {
  it('returns low intensity at midday', () => {
    expect(getLightIntensity(12)).toBe(0.3);
  });

  it('returns full intensity at night', () => {
    expect(getLightIntensity(22)).toBe(2.0);
    expect(getLightIntensity(3)).toBe(2.0);
  });

  it('transitions during dawn (5-8)', () => {
    const intensity = getLightIntensity(6.5);
    expect(intensity).toBeGreaterThan(0.3);
    expect(intensity).toBeLessThan(2.0);
  });

  it('transitions during dusk (16-18)', () => {
    const intensity = getLightIntensity(17);
    expect(intensity).toBeGreaterThan(0.3);
    expect(intensity).toBeLessThan(2.0);
  });
});
