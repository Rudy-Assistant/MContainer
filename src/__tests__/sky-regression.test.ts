import { describe, it, expect } from 'vitest';
import { getSkyParams } from '@/components/three/Scene';

// SKY REGRESSION GUARD — tests call the real getSkyParams from Scene.tsx
// Changing turbidity above 3.0 at midday causes the white/pale sky regression

describe('Sky regression guard', () => {
  it('midday turbidity stays below 3 (above causes white sky)', () => {
    const params = getSkyParams(12);
    expect(params.turbidity).toBeLessThan(3.0);
  });

  it('midday rayleigh provides blue saturation', () => {
    const params = getSkyParams(12);
    expect(params.rayleigh).toBeGreaterThanOrEqual(1.5);
    expect(params.rayleigh).toBeLessThanOrEqual(2.5);
  });

  it('golden hour turbidity exceeds midday', () => {
    expect(getSkyParams(18).turbidity).toBeGreaterThan(getSkyParams(12).turbidity);
  });

  it('golden hour mieCoefficient exceeds midday', () => {
    expect(getSkyParams(18).mieCoefficient).toBeGreaterThan(getSkyParams(12).mieCoefficient);
  });
});
