import { describe, it, expect } from 'vitest';
import type { VoxelFaces } from '@/types/container';

describe('Face schematic display logic', () => {
  it('returns correct label for each face material', () => {
    const faces: VoxelFaces = {
      top: 'Solid_Steel', bottom: 'Deck_Wood',
      n: 'Glass_Pane', s: 'Open', e: 'Railing_Glass', w: 'Door',
    };
    const labels = Object.entries(faces).map(([face, mat]) => ({
      face, short: mat.replace(/_/g, ' '),
    }));
    expect(labels).toHaveLength(6);
    expect(labels.find(l => l.face === 'n')?.short).toBe('Glass Pane');
    expect(labels.find(l => l.face === 'bottom')?.short).toBe('Deck Wood');
  });
});
