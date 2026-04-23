import { describe, it, expect } from 'vitest';
import { getSkyParams } from '@/components/three/Scene';

// SKY REGRESSION GUARD — tests call the real getSkyParams from Scene.tsx.
// Midday values should stay clear and golden-hour haze should stay restrained
// enough that post-processing bloom does not bleach the sky.

describe('Sky regression guard', () => {
  it('midday turbidity stays clear', () => {
    const params = getSkyParams(12);
    expect(params.turbidity).toBeGreaterThanOrEqual(0.8);
    expect(params.turbidity).toBeLessThanOrEqual(1.5);
  });

  it('midday rayleigh provides deep blue saturation', () => {
    const params = getSkyParams(12);
    expect(params.rayleigh).toBeGreaterThanOrEqual(2.5);
    expect(params.rayleigh).toBeLessThanOrEqual(3.2);
  });

  it('golden hour turbidity exceeds midday', () => {
    expect(getSkyParams(18).turbidity).toBeGreaterThan(getSkyParams(12).turbidity);
  });

  it('golden hour turbidity avoids white-out haze', () => {
    expect(getSkyParams(18).turbidity).toBeLessThanOrEqual(4.0);
  });

  it('golden hour mieCoefficient exceeds midday', () => {
    expect(getSkyParams(18).mieCoefficient).toBeGreaterThan(getSkyParams(12).mieCoefficient);
  });

  it('golden hour mieDirectionalG stays broad enough to avoid a blown-out sun disc', () => {
    expect(getSkyParams(18).mieDirectionalG).toBeLessThanOrEqual(0.88);
  });
});
