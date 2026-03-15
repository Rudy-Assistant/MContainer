/**
 * shareUrl.ts — Encode/decode container designs for shareable URLs.
 *
 * Uses LZString to compress design state into a URL-safe parameter.
 */

import LZString from 'lz-string';
import type { Container, ContainerSize, ContainerPosition, SurfaceType } from '@/types/container';

interface SharedContainer {
  size: ContainerSize;
  position: ContainerPosition;
  rotation: number;
  level: number;
  voxelGrid?: any[];
  interiorFinish?: 'raw' | 'plywood' | 'drywall' | 'painted';
}

interface SharedDesign {
  v: 1;
  containers: SharedContainer[];
  stacking: { topIndex: number; bottomIndex: number }[];
}

export function encodeDesign(containers: Record<string, Container>): string {
  const entries = Object.values(containers);
  const idToIndex = new Map<string, number>();
  entries.forEach((c, i) => idToIndex.set(c.id, i));

  const design: SharedDesign = {
    v: 1,
    containers: entries.map((c) => {
      const sc: SharedContainer = {
        size: c.size,
        position: c.position,
        rotation: c.rotation,
        level: c.level,
      };
      if (c.voxelGrid) sc.voxelGrid = c.voxelGrid;
      if (c.interiorFinish) sc.interiorFinish = c.interiorFinish;
      return sc;
    }),
    stacking: entries
      .filter((c) => c.stackedOn !== null)
      .map((c) => ({
        topIndex: idToIndex.get(c.id)!,
        bottomIndex: idToIndex.get(c.stackedOn!)!,
      }))
      .filter((s) => s.topIndex !== undefined && s.bottomIndex !== undefined),
  };

  return LZString.compressToEncodedURIComponent(JSON.stringify(design));
}

export function decodeDesign(encoded: string): SharedDesign | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded);
    if (!json) return null;
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.containers)) return null;
    return parsed as SharedDesign;
  } catch {
    return null;
  }
}

export function buildShareUrl(containers: Record<string, Container>): string {
  const encoded = encodeDesign(containers);
  const base = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
  return `${base}?d=${encoded}`;
}
