import { describe, it, expect } from 'vitest';
import { QUALITY_PRESETS, QUALITY_PRESET_IDS } from '@/config/qualityPresets';
import { _themeMats } from '@/config/materialCache';
import * as THREE from 'three';

describe('Visual Fidelity Regression', () => {
  it('all quality presets have valid shadow map sizes', () => {
    for (const preset of Object.values(QUALITY_PRESETS)) {
      expect([512, 1024, 2048, 4096]).toContain(preset.shadowMapSize);
    }
  });

  it('glass material uses MeshPhysicalMaterial', () => {
    for (const matSet of Object.values(_themeMats)) {
      expect(matSet.glass).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    }
  });

  it('glass has transmission enabled', () => {
    for (const matSet of Object.values(_themeMats)) {
      expect((matSet.glass as THREE.MeshPhysicalMaterial).transmission).toBeGreaterThan(0);
    }
  });

  it('steel has corrugation normal on industrial theme', () => {
    expect(_themeMats.industrial.steel.normalMap).not.toBeNull();
  });

  it('frame has brushed-metal normal map', () => {
    for (const matSet of Object.values(_themeMats)) {
      expect(matSet.frame.normalMap).not.toBeNull();
    }
  });

  it('max lights increases with quality', () => {
    expect(QUALITY_PRESETS.low.maxLights).toBeLessThan(QUALITY_PRESETS.medium.maxLights);
    expect(QUALITY_PRESETS.medium.maxLights).toBeLessThan(QUALITY_PRESETS.high.maxLights);
  });

  it('post-processing disabled on low', () => {
    expect(QUALITY_PRESETS.low.postProcessing).toBe(false);
    expect(QUALITY_PRESETS.low.bloomEnabled).toBe(false);
  });

  it('shadow map size increases with quality', () => {
    expect(QUALITY_PRESETS.low.shadowMapSize).toBeLessThan(QUALITY_PRESETS.medium.shadowMapSize);
    expect(QUALITY_PRESETS.medium.shadowMapSize).toBeLessThan(QUALITY_PRESETS.high.shadowMapSize);
  });
});
