import { describe, expect, it } from 'vitest';
import {
  CONTAINER_ARRANGEMENT_SPECS,
  getContainerArrangementPreviewFaces,
} from '@/config/containerArrangements';

describe('container arrangement specs', () => {
  it('keeps enclosed arrangements sealed in the shared preview contract', () => {
    const enclosed = CONTAINER_ARRANGEMENT_SPECS.filter((spec) => spec.outcome === 'enclosed');
    expect(enclosed.length).toBeGreaterThan(0);

    for (const spec of enclosed) {
      const faces = getContainerArrangementPreviewFaces(spec);
      expect(faces.top).not.toBe('Open');
      expect([faces.n, faces.s, faces.e, faces.w]).not.toContain('Open');
    }
  });

  it('distinguishes covered and open outdoor presets by roof policy', () => {
    const deck = CONTAINER_ARRANGEMENT_SPECS.find((spec) => spec.id === 'wraparound_deck');
    const patio = CONTAINER_ARRANGEMENT_SPECS.find((spec) => spec.id === 'wraparound_patio');

    expect(deck?.outcome).toBe('covered_outdoor');
    expect(deck?.roof).toBe('Solid_Steel');
    expect(patio?.outcome).toBe('open_outdoor');
    expect(patio?.roof).toBe('Open');
  });
});
