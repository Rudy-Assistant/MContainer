import { describe, it, expect } from 'vitest';
import { WALL_CATEGORIES, FLOOR_CATEGORIES, CEILING_CATEGORIES, getCategoryForSurface } from '@/config/surfaceCategories';

describe('surfaceCategories', () => {
  it('WALL_CATEGORIES has 10 categories', () => {
    expect(WALL_CATEGORIES).toHaveLength(10);
    expect(WALL_CATEGORIES.map(c => c.id)).toEqual([
      'wall', 'door', 'window', 'railing', 'stairs',
      'shelf', 'cabinet', 'fixture', 'decor', 'open',
    ]);
  });

  it('Door category has 8 variants', () => {
    const door = WALL_CATEGORIES.find(c => c.id === 'door')!;
    expect(door.variants).toHaveLength(8);
    expect(door.variants[0].surfaceType).toBe('Door');
  });

  it('Wall category includes Half-Fold and Gull-Wing', () => {
    const wall = WALL_CATEGORIES.find(c => c.id === 'wall')!;
    const ids = wall.variants.map(v => v.id);
    expect(ids).toContain('half_fold');
    expect(ids).toContain('gull_wing');
  });

  it('FLOOR_CATEGORIES has 3 categories', () => {
    expect(FLOOR_CATEGORIES).toHaveLength(3);
    expect(FLOOR_CATEGORIES.map(c => c.id)).toEqual(['solid', 'glass', 'open']);
  });

  it('CEILING_CATEGORIES has 3 categories', () => {
    expect(CEILING_CATEGORIES).toHaveLength(3);
    expect(CEILING_CATEGORIES.map(c => c.id)).toEqual(['solid', 'skylight', 'open']);
  });

  it('getCategoryForSurface maps correctly', () => {
    expect(getCategoryForSurface('Door', 'wall')).toBe('door');
    expect(getCategoryForSurface('Window_Half', 'wall')).toBe('window');
    expect(getCategoryForSurface('Solid_Steel', 'wall')).toBe('wall');
    expect(getCategoryForSurface('Deck_Wood', 'floor')).toBe('solid');
  });

  it('Shelf and Cabinet categories are overlay categories with no SurfaceType variants', () => {
    // Shelves and cabinets render as overlay configs (voxel.shelfConfig /
    // voxel.cabinetConfig) on top of any wall surface — they are not
    // SurfaceType-replacing categories, so they have no variants array.
    const shelf = WALL_CATEGORIES.find(c => c.id === 'shelf')!;
    const cabinet = WALL_CATEGORIES.find(c => c.id === 'cabinet')!;
    expect(shelf.variants).toHaveLength(0);
    expect(shelf.volumetric).toBe(true);
    expect(cabinet.variants).toHaveLength(0);
    expect(cabinet.volumetric).toBe(true);
  });

  it('Stairs category is volumetric', () => {
    const stairs = WALL_CATEGORIES.find(c => c.id === 'stairs')!;
    expect(stairs.volumetric).toBe(true);
  });
});
