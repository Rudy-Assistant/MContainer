import { describe, it, expect } from 'vitest';
import { SURFACE_SHORT_LABELS } from '@/config/surfaceLabels';

describe('Surface short labels', () => {
  it('provides short labels for all common surface types', () => {
    expect(SURFACE_SHORT_LABELS['Solid_Steel']).toBe('Steel');
    expect(SURFACE_SHORT_LABELS['Glass_Pane']).toBe('Glass');
    expect(SURFACE_SHORT_LABELS['Deck_Wood']).toBe('Wood');
    expect(SURFACE_SHORT_LABELS['Window_Standard']).toBe('Win');
    expect(SURFACE_SHORT_LABELS['Open']).toBe('Open');
  });

  it('has short labels for all 18 surface types', () => {
    expect(Object.keys(SURFACE_SHORT_LABELS).length).toBeGreaterThanOrEqual(18);
  });
});
