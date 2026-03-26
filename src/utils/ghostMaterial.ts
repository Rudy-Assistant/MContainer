import * as THREE from 'three';

const GHOST_OPACITY = 0.30;

const _cache = new WeakMap<THREE.Material, THREE.Material>();

/**
 * Create a transparent clone of the given material for ghost preview rendering.
 * Cached by material reference (WeakMap) — theme changes auto-invalidate
 * because new material instances get new entries while old ones are GC'd.
 */
export function createGhostMaterial(base: THREE.Material): THREE.Material {
  const cached = _cache.get(base);
  if (cached) return cached;

  const clone = base.clone();
  clone.transparent = true;
  clone.opacity = GHOST_OPACITY;
  clone.depthWrite = false;
  clone.side = THREE.DoubleSide;
  clone.needsUpdate = true;

  _cache.set(base, clone);
  return clone;
}
