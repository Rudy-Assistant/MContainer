/**
 * faceFilter.ts — pure helper for the FaceFilterWidget gating logic.
 *
 * The 3D viewport pointer handlers consult this to decide whether a hover/click
 * on a given face should register. When the filter is `'all'` everything passes.
 * When set to `'top'` only ceiling faces pass; `'bottom'` only floors; `'walls'`
 * only n/s/e/w. This is what makes ceiling tiles selectable in dense scenes.
 */

import type { VoxelFaces } from '@/types/container';

export type FaceFilterValue = 'all' | 'top' | 'bottom' | 'walls';

export function passesFaceFilter(
  face: keyof VoxelFaces,
  filter: FaceFilterValue,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'top')    return face === 'top';
  if (filter === 'bottom') return face === 'bottom';
  if (filter === 'walls')  return face === 'n' || face === 's' || face === 'e' || face === 'w';
  return true;
}
