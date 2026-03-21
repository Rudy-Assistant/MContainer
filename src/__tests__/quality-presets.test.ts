import { describe, it, expect } from 'vitest';
import { QUALITY_PRESETS, type QualityPresetId } from '@/config/qualityPresets';

describe('Quality Presets', () => {
  it('exports all three presets', () => {
    expect(Object.keys(QUALITY_PRESETS)).toEqual(['low', 'medium', 'high']);
  });

  it('low disables post-processing', () => {
    expect(QUALITY_PRESETS.low.postProcessing).toBe(false);
    expect(QUALITY_PRESETS.low.shadowMapSize).toBe(1024);
    expect(QUALITY_PRESETS.low.maxLights).toBe(4);
    expect(QUALITY_PRESETS.low.envMap).toBe('none');
  });

  it('medium enables AO halfRes + bloom', () => {
    expect(QUALITY_PRESETS.medium.postProcessing).toBe(true);
    expect(QUALITY_PRESETS.medium.aoHalfRes).toBe(true);
    expect(QUALITY_PRESETS.medium.shadowMapSize).toBe(2048);
    expect(QUALITY_PRESETS.medium.maxLights).toBe(8);
    expect(QUALITY_PRESETS.medium.envMap).toBe('hdri');
  });

  it('high enables AO fullRes + cubeCamera', () => {
    expect(QUALITY_PRESETS.high.postProcessing).toBe(true);
    expect(QUALITY_PRESETS.high.aoHalfRes).toBe(false);
    expect(QUALITY_PRESETS.high.shadowMapSize).toBe(4096);
    expect(QUALITY_PRESETS.high.maxLights).toBe(16);
    expect(QUALITY_PRESETS.high.envMap).toBe('cubeCamera');
    expect(QUALITY_PRESETS.high.lightShadows).toBe(true);
  });

  it('all presets have valid texture quality', () => {
    for (const preset of Object.values(QUALITY_PRESETS)) {
      expect(['flat', '1k', '2k']).toContain(preset.textureQuality);
    }
  });
});
