import { describe, it, expect } from 'vitest';
import { computeRailPositions, type RailPosition } from '@/components/objects/ContainerSkin';
import type { PolePosition } from '@/utils/smartPoles';

function pole(row: number, col: number, corner: 'ne' | 'nw' | 'se' | 'sw', px: number, pz: number): PolePosition {
  return { row, col, corner, px, pz };
}

describe('computeRailPositions', () => {
  it('RAIL-1: returns empty array for empty input', () => {
    expect(computeRailPositions([])).toEqual([]);
  });

  it('RAIL-2: returns empty array for single pole (no adjacent pair)', () => {
    const poles = [pole(0, 0, 'nw', 0, 0)];
    expect(computeRailPositions(poles)).toEqual([]);
  });

  it('RAIL-3: 4-corner box returns 2 horizontal + 2 vertical rails', () => {
    const poles = [
      pole(0, 0, 'nw', -1, -1),
      pole(0, 0, 'ne', 1, -1),
      pole(0, 0, 'sw', -1, 1),
      pole(0, 0, 'se', 1, 1),
    ];
    const rails = computeRailPositions(poles);
    const hRails = rails.filter(r => r.orientation === 'h');
    const vRails = rails.filter(r => r.orientation === 'v');
    expect(hRails.length).toBe(2);
    expect(vRails.length).toBe(2);
  });

  it('RAIL-4: L-shaped poles (missing one corner) has no rail across gap', () => {
    const poles = [
      pole(0, 0, 'nw', -1, -1),
      pole(0, 0, 'ne', 1, -1),
      pole(0, 0, 'sw', -1, 1),
    ];
    const rails = computeRailPositions(poles);
    expect(rails.length).toBe(2);
  });

  it('RAIL-5: duplicate poles at same vertex are deduplicated', () => {
    const poles = [
      pole(0, 0, 'nw', -1, -1),
      pole(0, 0, 'ne', 1, -1),
      pole(0, 1, 'nw', 1, -1),
    ];
    const rails = computeRailPositions(poles);
    expect(rails.filter(r => r.orientation === 'h').length).toBe(1);
  });

  it('RAIL-6: each rail has correct endpoint positions', () => {
    const poles = [
      pole(0, 0, 'nw', -3, -1),
      pole(0, 0, 'ne', 3, -1),
    ];
    const rails = computeRailPositions(poles);
    expect(rails.length).toBe(1);
    expect(rails[0].px1).toBe(-3);
    expect(rails[0].pz1).toBe(-1);
    expect(rails[0].px2).toBe(3);
    expect(rails[0].pz2).toBe(-1);
  });

  it('RAIL-7: poles far apart (like real container corners) still connect', () => {
    // Real scenario: 40ft HC has corner poles at vertices (1,1), (1,7), (3,1), (3,7)
    const poles = [
      pole(0, 0, 'se', -5, -1),   // vertex (1,1)
      pole(0, 6, 'se', 5, -1),    // vertex (1,7)
      pole(2, 0, 'se', -5, 1),    // vertex (3,1)
      pole(2, 6, 'se', 5, 1),     // vertex (3,7)
    ];
    const rails = computeRailPositions(poles);
    const hRails = rails.filter(r => r.orientation === 'h');
    const vRails = rails.filter(r => r.orientation === 'v');
    // Should connect: (1,1)→(1,7) top-front, (3,1)→(3,7) top-back = 2 horizontal
    expect(hRails.length).toBe(2);
    // Should connect: (1,1)→(3,1) left, (1,7)→(3,7) right = 2 vertical
    expect(vRails.length).toBe(2);
    // Total = 4 rails forming a rectangle
    expect(rails.length).toBe(4);
  });
});
