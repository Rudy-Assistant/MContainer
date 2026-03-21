import { describe, it, expect } from 'vitest';
import {
  EXTERIOR_MATERIALS, PAINT_COLORS, GLASS_TINTS,
  FRAME_COLORS, DOOR_STYLES, LIGHT_FIXTURES, LIGHT_COLORS,
  ELECTRICAL_TYPES, FLOOR_MATERIALS, CEILING_MATERIALS,
  getFinishOptionsForFace,
} from '../config/finishPresets';
import type { SurfaceType } from '../types/container';

describe('finishPresets', () => {
  it('EXTERIOR_MATERIALS has at least 4 entries', () => {
    expect(EXTERIOR_MATERIALS.length).toBeGreaterThanOrEqual(4);
    expect(EXTERIOR_MATERIALS[0]).toHaveProperty('id');
    expect(EXTERIOR_MATERIALS[0]).toHaveProperty('label');
    expect(EXTERIOR_MATERIALS[0]).toHaveProperty('color');
  });

  it('PAINT_COLORS has 14 preset colors', () => {
    expect(PAINT_COLORS.length).toBeGreaterThanOrEqual(14);
    PAINT_COLORS.forEach(c => {
      expect(c).toHaveProperty('hex');
      expect(c).toHaveProperty('label');
    });
  });

  it('getFinishOptionsForFace returns wall options for Solid_Steel', () => {
    const opts = getFinishOptionsForFace('Solid_Steel' as SurfaceType, 'n');
    expect(opts.exteriorMaterial).toBe(true);
    expect(opts.interiorPaint).toBe(true);
    expect(opts.electrical).toBe(true);
    expect(opts.glassTint).toBe(false);
  });

  it('getFinishOptionsForFace returns window options for Window_Standard', () => {
    const opts = getFinishOptionsForFace('Window_Standard' as SurfaceType, 'n');
    expect(opts.frameColor).toBe(true);
    expect(opts.glassTint).toBe(true);
    expect(opts.exteriorMaterial).toBe(false);
  });

  it('getFinishOptionsForFace returns door options for Door', () => {
    const opts = getFinishOptionsForFace('Door' as SurfaceType, 'n');
    expect(opts.doorStyle).toBe(true);
    expect(opts.frameColor).toBe(true);
  });

  it('getFinishOptionsForFace returns ceiling options for top face', () => {
    const opts = getFinishOptionsForFace('Solid_Steel' as SurfaceType, 'top');
    expect(opts.lightFixture).toBe(true);
    expect(opts.lightColor).toBe(true);
    expect(opts.ceilingMaterial).toBe(true);
  });

  it('getFinishOptionsForFace returns floor options for bottom face', () => {
    const opts = getFinishOptionsForFace('Deck_Wood' as SurfaceType, 'bottom');
    expect(opts.floorMaterial).toBe(true);
    expect(opts.electrical).toBe(false);
  });
});
