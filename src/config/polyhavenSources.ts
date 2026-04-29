/**
 * polyhavenSources.ts — Registry of CC0 furniture model sources.
 *
 * Each entry maps a FurnitureType to a remote CC0 source (Polyhaven by
 * default, but anything CC0 / public-domain is fair game). The registry is
 * consumed by `scripts/fetch-polyhaven-furniture.mjs`, which downloads the
 * GLBs into `public/assets/furniture/<filename>.glb` so the existing
 * FURNITURE_CATALOG entries (in `src/types/container.ts`) resolve at
 * runtime.
 *
 * **Why this is a registry and not runtime fetches:**
 *  - Same-origin loading via `/assets/furniture/*.glb` works offline (PWA
 *    cache eats it on install).
 *  - Polyhaven's CDN doesn't set CORS for arbitrary origins; downloading
 *    once at build time avoids that whole class of problem.
 *  - Attribution + license metadata stays bundled with the registry.
 *
 * **License:** Polyhaven assets are CC0 — no attribution required, but
 * we credit them in our README and the in-app About modal as good karma.
 *
 * **To extend the registry:** find a CC0 model on polyhaven.com/models,
 * grab its slug from the URL (e.g. `wooden_chair` from
 * https://polyhaven.com/a/wooden_chair), and add an entry below.
 */

import { FurnitureType } from '@/types/container';

export type CC0Source =
  | { provider: 'polyhaven'; slug: string; resolution?: '1k' | '2k' | '4k' }
  | { provider: 'kenney'; path: string }
  | { provider: 'cc0'; url: string };

export interface PolyhavenEntry {
  type: FurnitureType;
  /** Local filename (under /public/assets/furniture/) — must match the
   *  `glb` field of the corresponding FURNITURE_CATALOG entry. */
  filename: string;
  source: CC0Source;
  /** Display-only credit string. CC0 doesn't require it but we show it. */
  credit: string;
}

/** Polyhaven download URL builder. The CDN pattern is stable. */
export function polyhavenGlbUrl(slug: string, resolution: '1k' | '2k' | '4k' = '2k'): string {
  return `https://dl.polyhaven.org/file/ph-assets/Models/glb/${resolution}/${slug}/${slug}_${resolution}.glb`;
}

/** Currently empty — see file header for how to populate. The fetch script
 *  is a no-op while this list is empty, so the existing FURNITURE_CATALOG
 *  remains the source of truth and falls back to `FurnitureBox` colored
 *  primitives until someone fills in real entries. */
export const POLYHAVEN_FURNITURE: PolyhavenEntry[] = [
  // EXAMPLE — uncomment after verifying the slug exists on polyhaven.com:
  // {
  //   type: FurnitureType.DiningChair,
  //   filename: 'dining-chair.glb',
  //   source: { provider: 'polyhaven', slug: 'wooden_chair', resolution: '2k' },
  //   credit: 'Wooden Chair — Polyhaven (CC0)',
  // },
];
