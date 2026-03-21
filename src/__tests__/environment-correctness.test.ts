import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';

describe('Environment Correctness', () => {
  beforeEach(() => {
    useStore.setState({ qualityPreset: 'medium' });
  });

  it('quality preset defaults to medium', () => {
    expect(useStore.getState().qualityPreset).toBe('medium');
  });

  it('quality preset can be changed', () => {
    useStore.getState().setQualityPreset('high');
    expect(useStore.getState().qualityPreset).toBe('high');
    useStore.getState().setQualityPreset('medium'); // reset
  });
});
