import { describe, it, expect } from 'vitest';
import { detectQualityPreset, type GPUInfo } from '../config/gpuDetect';

describe('detectQualityPreset', () => {
  it('returns low for maxTextureSize < 4096', () => {
    const info: GPUInfo = { maxTextureSize: 2048, maxCubemapSize: 2048, maxTextureUnits: 8 };
    expect(detectQualityPreset(info)).toBe('low');
  });

  it('returns high for maxTextureSize >= 8192', () => {
    const info: GPUInfo = { maxTextureSize: 16384, maxCubemapSize: 16384, maxTextureUnits: 32 };
    expect(detectQualityPreset(info)).toBe('high');
  });

  it('returns medium for maxTextureSize between 4096 and 8192', () => {
    const info: GPUInfo = { maxTextureSize: 4096, maxCubemapSize: 4096, maxTextureUnits: 16 };
    expect(detectQualityPreset(info)).toBe('medium');
  });

  it('downgrades one tier when weak GPU name detected', () => {
    const info: GPUInfo = {
      maxTextureSize: 8192,
      maxCubemapSize: 8192,
      maxTextureUnits: 16,
      rendererName: 'Intel(R) HD Graphics 4000',
    };
    expect(detectQualityPreset(info)).toBe('medium');
  });

  it('downgrades low stays low with weak GPU name', () => {
    const info: GPUInfo = {
      maxTextureSize: 2048,
      maxCubemapSize: 2048,
      maxTextureUnits: 8,
      rendererName: 'Mali-400',
    };
    expect(detectQualityPreset(info)).toBe('low');
  });

  it('returns medium when rendererName is undefined (extension unavailable)', () => {
    const info: GPUInfo = { maxTextureSize: 4096, maxCubemapSize: 4096, maxTextureUnits: 16 };
    expect(detectQualityPreset(info)).toBe('medium');
  });
});
