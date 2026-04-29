/**
 * Behavioral tests for embed URL helpers.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildEmbedUrl, buildEmbedSnippet, decodeDesign } from '@/utils/shareUrl';
import type { Container } from '@/types/container';
import { ContainerSize } from '@/types/container';

const sample = (): Record<string, Container> => ({
  c1: {
    id: 'c1',
    size: ContainerSize.HighCube40,
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    level: 0,
    voxelGrid: undefined,
    stackedOn: null,
  } as Container,
});

describe('buildEmbedUrl + buildEmbedSnippet', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: { origin: 'https://example.com' } });
  });

  it('builds a /embed URL with an encoded design', () => {
    const url = buildEmbedUrl(sample());
    expect(url).toMatch(/^https:\/\/example\.com\/embed\?d=/);
  });

  it('round-trips the design through decodeDesign', () => {
    const url = buildEmbedUrl(sample());
    const encoded = url.split('d=')[1];
    const decoded = decodeDesign(encoded);
    expect(decoded?.containers).toHaveLength(1);
    expect(decoded?.containers[0].size).toBe(ContainerSize.HighCube40);
  });

  it('appends walk=1 when walkthrough is requested', () => {
    const url = buildEmbedUrl(sample(), { walkthrough: true });
    expect(url).toContain('walk=1');
  });

  it('produces a valid iframe HTML snippet', () => {
    const html = buildEmbedSnippet(sample());
    expect(html).toMatch(/^<iframe /);
    expect(html).toContain('src="https://example.com/embed?d=');
    expect(html).toContain('width="100%"');
    expect(html).toContain('height="600"');
    expect(html).toContain('xr-spatial-tracking');
  });

  it('respects custom width/height', () => {
    const html = buildEmbedSnippet(sample(), { width: '800', height: '450' });
    expect(html).toContain('width="800"');
    expect(html).toContain('height="450"');
  });
});
