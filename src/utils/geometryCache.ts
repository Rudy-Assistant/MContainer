/**
 * geometryCache.ts — Shared THREE.PlaneGeometry cache.
 * Avoids duplicate geometry allocations across modules that need
 * planes of the same dimensions (DebugOverlay, HoverPreviewGhost, etc.).
 */

import * as THREE from 'three';

const _planeCache = new Map<string, THREE.PlaneGeometry>();

/** Get or create a cached PlaneGeometry for the given dimensions. */
export function getCachedPlane(w: number, h: number): THREE.PlaneGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}`;
  if (!_planeCache.has(k)) {
    _planeCache.set(k, new THREE.PlaneGeometry(w, h));
  }
  return _planeCache.get(k)!;
}
