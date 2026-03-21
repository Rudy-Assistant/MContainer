import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

describe('Quality Preset Store', () => {
  beforeEach(() => {
    useStore.setState({ qualityPreset: 'medium' });
  });

  it('defaults to medium', () => {
    expect(useStore.getState().qualityPreset).toBe('medium');
  });

  it('setQualityPreset changes preset', () => {
    useStore.getState().setQualityPreset('high');
    expect(useStore.getState().qualityPreset).toBe('high');
  });

  it('setQualityPreset validates input', () => {
    useStore.getState().setQualityPreset('low');
    expect(useStore.getState().qualityPreset).toBe('low');
  });
});
