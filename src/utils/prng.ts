/**
 * prng.ts — Deterministic seeded random helpers shared across visual layers.
 *
 * Both Vegetation.tsx (procedural ring scatter) and SiteFeatures.tsx
 * (per-container tree placement) need a small, fast, 32-bit PRNG with a
 * string-hash seed source. Extracted to one module so the implementation
 * stays in sync and so future visual features can reach for the same
 * canonical helpers.
 */

/**
 * Mulberry32 — small (24-line) state-machine PRNG with a 32-bit seed.
 * Returns a closure yielding floats in [0, 1).
 * Stable for a given seed across runs (SSR-safe).
 */
export function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a 32-bit hash of a string. Pair with mulberry32 when the seed
 *  needs to derive from a stable id (container id, label, etc.). */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
