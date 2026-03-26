import { describe, it, expect } from 'vitest';
import { getFrameThreeMaterial } from '@/config/materialCache';

describe('getFrameThreeMaterial', () => {
  it('maps Steel to the steel material', () => {
    const mat = getFrameThreeMaterial('Steel', 'industrial');
    expect(mat).toBeDefined();
    expect(mat.type).toBe('MeshStandardMaterial');
  });

  it('maps Wood to the wood material', () => {
    const mat = getFrameThreeMaterial('Wood', 'industrial');
    expect(mat).toBeDefined();
  });

  it('maps Concrete to the concrete material', () => {
    const mat = getFrameThreeMaterial('Concrete', 'industrial');
    expect(mat).toBeDefined();
  });

  it('maps Aluminum to the frame material', () => {
    const mat = getFrameThreeMaterial('Aluminum', 'industrial');
    expect(mat).toBeDefined();
  });

  it('falls back to steel for unknown names', () => {
    const mat = getFrameThreeMaterial('Unknown' as any, 'industrial');
    expect(mat).toBeDefined();
  });

  it('works across all three themes', () => {
    for (const theme of ['industrial', 'japanese', 'desert'] as const) {
      const mat = getFrameThreeMaterial('Wood', theme);
      expect(mat).toBeDefined();
    }
  });
});
