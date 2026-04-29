import { describe, it, expect } from 'vitest';
import { WALL_CATEGORIES } from '@/config/surfaceCategories';

describe('VariantGrid active state', () => {
  it('overlay categories (shelf, cabinet) have no SurfaceType variants', () => {
    // Shelves and cabinets render as overlay configs, not SurfaceType
    // replacements, so their variants array is empty.
    const shelf = WALL_CATEGORIES.find(c => c.id === 'shelf')!;
    const cabinet = WALL_CATEGORIES.find(c => c.id === 'cabinet')!;
    expect(shelf.variants).toHaveLength(0);
    expect(cabinet.variants).toHaveLength(0);
  });

  it('volumetric category marked correctly', () => {
    const stairs = WALL_CATEGORIES.find(c => c.id === 'stairs')!;
    expect(stairs.volumetric).toBe(true);
  });

  it('door variants differentiated by finishMeta.doorStyle', () => {
    const door = WALL_CATEGORIES.find(c => c.id === 'door')!;
    const barn = door.variants.find(v => v.id === 'barn_slide')!;
    expect(barn.finishMeta?.doorStyle).toBe('barn_slide');
    expect(barn.surfaceType).toBe('Door');
    // All 8 door variants share the same surfaceType
    expect(door.variants.every(v => v.surfaceType === 'Door')).toBe(true);
  });
});
