import { describe, it, expect } from 'vitest';
import { surfaceColor, SURFACE_COLOR_MAP } from '@/components/ui/svg/surfaceColorMap';
import type { SurfaceType } from '@/types/container';

describe('surfaceColorMap', () => {
  it('returns correct color for known SurfaceType', () => {
    expect(surfaceColor('Open')).toBe('#e2e8f0');
    expect(surfaceColor('Deck_Wood')).toBe('#8B6914');
    expect(surfaceColor('Glass_Pane')).toBe('#93c5fd');
    expect(surfaceColor('Solid_Steel')).toBe('#64748b');
  });

  it('returns fallback for unknown SurfaceType', () => {
    expect(surfaceColor('SomeNewType' as SurfaceType)).toBe('#cbd5e1');
  });

  it('covers all Window variants with Glass_Pane color', () => {
    expect(surfaceColor('Window_Standard')).toBe('#93c5fd');
    expect(surfaceColor('Window_Sill')).toBe('#93c5fd');
    expect(surfaceColor('Window_Clerestory')).toBe('#93c5fd');
    expect(surfaceColor('Window_Half')).toBe('#93c5fd');
  });

  it('distinguishes Railing_Cable from Railing_Glass', () => {
    expect(surfaceColor('Railing_Cable')).toBe('#94a3b8');
    expect(surfaceColor('Railing_Glass')).toBe('#7dd3fc');
  });
});
