import { describe, it, expect } from 'vitest';
import type { MaterialDef } from '@/types/container';

describe('MaterialDef type', () => {
  it('accepts minimal shape (surfaceType only)', () => {
    const def: MaterialDef = { surfaceType: 'Solid_Steel' };
    expect(def.surfaceType).toBe('Solid_Steel');
    expect(def.textureId).toBeUndefined();
    expect(def.color).toBeUndefined();
    expect(def.finishMeta).toBeUndefined();
  });

  it('accepts full shape with all optional fields', () => {
    const def: MaterialDef = {
      surfaceType: 'Glass_Pane',
      textureId: 'glassPanel',
      color: '#88ccff',
      finishMeta: { glassTint: 'blue' },
    };
    expect(def.textureId).toBe('glassPanel');
    expect(def.finishMeta!.glassTint).toBe('blue');
  });
});
