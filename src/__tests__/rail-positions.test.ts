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
});
