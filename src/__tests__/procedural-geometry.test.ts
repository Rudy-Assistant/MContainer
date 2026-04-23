import { describe, expect, it } from 'vitest';

import { DOOR_FORMS } from '@/config/forms/doors';
import { ELECTRICAL_FORMS } from '@/config/forms/electrical';
import { LIGHT_FORMS } from '@/config/forms/lights';
import { WINDOW_FORMS } from '@/config/forms/windows';
import { getProceduralGeometry } from '@/utils/proceduralGeometry';

describe('procedural form geometry', () => {
  it('renders door forms as composed geometry instead of single boxes', () => {
    for (const form of DOOR_FORMS) {
      const geo = getProceduralGeometry(form.id, form.category, form.dimensions);
      const vertexCount = geo.getAttribute('position')?.count ?? 0;
      expect(vertexCount, form.id).toBeGreaterThan(24);
    }
  });

  it('caches generated door geometry by form and dimensions', () => {
    const form = DOOR_FORMS[0];
    const first = getProceduralGeometry(form.id, form.category, form.dimensions);
    const second = getProceduralGeometry(form.id, form.category, form.dimensions);
    expect(second).toBe(first);
  });

  it('renders window forms as mullion/pane geometry instead of single boxes', () => {
    for (const form of WINDOW_FORMS) {
      const geo = getProceduralGeometry(form.id, form.category, form.dimensions);
      const vertexCount = geo.getAttribute('position')?.count ?? 0;
      expect(vertexCount, form.id).toBeGreaterThan(24);
    }
  });

  it('renders light forms with non-box fixture geometry', () => {
    for (const form of LIGHT_FORMS) {
      const geo = getProceduralGeometry(form.id, form.category, form.dimensions);
      const vertexCount = geo.getAttribute('position')?.count ?? 0;
      expect(vertexCount, form.id).toBeGreaterThan(24);
    }
  });

  it('renders electrical forms as composed fixture geometry', () => {
    for (const form of ELECTRICAL_FORMS) {
      const geo = getProceduralGeometry(form.id, form.category, form.dimensions);
      const vertexCount = geo.getAttribute('position')?.count ?? 0;
      expect(vertexCount, form.id).toBeGreaterThan(24);
    }
  });
});
