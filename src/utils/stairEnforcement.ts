/**
 * stairEnforcement.ts — Pure stair-placement consequence helpers.
 *
 * These functions were previously inlined inside voxelSlice.ts `applyStairsFromFace`,
 * where they could only fire as side-effects of a store action. Extracting them
 * makes the enforcement reusable by `normalizeDesign` and by AI-codepath validation
 * on designs that arrive as raw Container records (not via a store action).
 *
 * Four rules live here:
 *   - SR-01 computeFloorVoid           — punch the ceiling directly above a stair
 *   - SR-05 computeEntryWallClear       — open the wall you'd walk through to reach the stair
 *   - SR-06 computeLateralRailings      — add handrails on exposed sides of the stair run
 *   - SR-09 computeCrossContainerVoid   — propagate the floor punch into a stacked container
 *
 * Every helper is pure over its inputs and mutates only the passed-in grid/record
 * copies. No React, no store, no console. Re-run safely (idempotent) — if the
 * condition is already satisfied they no-op.
 */

import type { Container, SurfaceType, Voxel, VoxelFaces } from '@/types/container';
import { VOXEL_COLS, VOXEL_LEVELS, VOXEL_ROWS, isVoxelFaceProtected } from '@/types/container';

// ── Shared stair-direction constants ────────────────────────
// STAIR_FLIP: clicked face → ascending direction (opposite). You click the n
// wall of a voxel to put stairs that ascend *south*.
export const STAIR_FLIP: Record<string, 'n' | 's' | 'e' | 'w'> = { n: 's', s: 'n', e: 'w', w: 'e' };
export const ASCEND_DELTA: Record<string, { dr: number; dc: number }> = {
  n: { dr: -1, dc: 0 },
  s: { dr: 1, dc: 0 },
  e: { dc: -1, dr: 0 },
  w: { dc: 1, dr: 0 },
};

const LEVEL_SIZE = VOXEL_ROWS * VOXEL_COLS;

// ── Face-change tracking (for undo / smart reversal) ────────

/** Record an original face value the FIRST time it's touched, so a later removal
 *  can restore it. Subsequent writes to the same key are no-ops — the *original*
 *  state is what we want to preserve, not the latest intermediate value. */
function trackSmartFaceChange(
  changedFaces: Record<string, SurfaceType>,
  voxelIndex: number,
  face: keyof VoxelFaces,
  originalValue: SurfaceType,
): void {
  const key = `${voxelIndex}:${face}`;
  if (!(key in changedFaces)) {
    changedFaces[key] = originalValue;
  }
}

// ── Geometry helper ─────────────────────────────────────────

/** Standard stair voxel face configuration.
 *  Lower/single voxels have an open ceiling (walkway continues above).
 *  Upper voxels have a wood-deck ceiling (the landing you step onto). */
export function buildStairFaces(isNS: boolean, part: 'lower' | 'upper' | 'single'): VoxelFaces {
  const isUpper = part === 'upper';
  return {
    top: isUpper ? 'Deck_Wood' : 'Open',
    bottom: isUpper ? 'Open' : 'Deck_Wood',
    n: isNS ? 'Open' : 'Solid_Steel',
    s: isNS ? 'Open' : 'Solid_Steel',
    e: isNS ? 'Solid_Steel' : 'Open',
    w: isNS ? 'Solid_Steel' : 'Open',
  };
}

// ── SR-01: Floor-void above a stair ─────────────────────────

/**
 * SR-01 — Stairs auto-void the floor above.
 *
 * For a stair whose upper voxel lives on the same container, open the BOTTOM face
 * of the voxel directly above the ascent, convert its three non-exit walls to
 * Railing_Cable (fall-hazard guardrails), and leave the exit face Open so the
 * walker can step off.
 *
 * Mutates the passed-in grid. Returns true when the voxel was active and
 * modified; false if inactive (no-op).
 */
export function computeFloorVoid(
  grid: Voxel[],
  voxelIndex: number,
  exitFace: 'n' | 's' | 'e' | 'w',
  changedFaces: Record<string, SurfaceType>,
): boolean {
  const voxel = grid[voxelIndex];
  if (!voxel?.active) return false;

  // Idempotency: pre-compute the desired face state and bail if the voxel is
  // already in it. normalizeDesign depends on this — running repair twice
  // must be a no-op the second time (reference-equal container state).
  const desired: VoxelFaces = { ...voxel.faces, bottom: 'Open' };
  for (const wallFace of ['n', 's', 'e', 'w'] as const) {
    if (isVoxelFaceProtected(voxel, wallFace)) continue;
    desired[wallFace] = wallFace === exitFace ? 'Open' : 'Railing_Cable';
  }
  if (
    voxel.faces.bottom === desired.bottom &&
    voxel.faces.n === desired.n &&
    voxel.faces.s === desired.s &&
    voxel.faces.e === desired.e &&
    voxel.faces.w === desired.w
  ) {
    return false;
  }

  trackSmartFaceChange(changedFaces, voxelIndex, 'bottom', voxel.faces.bottom);
  for (const wallFace of ['n', 's', 'e', 'w'] as const) {
    if (isVoxelFaceProtected(voxel, wallFace)) continue;
    trackSmartFaceChange(changedFaces, voxelIndex, wallFace, voxel.faces[wallFace]);
  }
  grid[voxelIndex] = { ...voxel, faces: desired };
  return true;
}

// ── SR-05: Stair entry wall clear ───────────────────────────

/**
 * SR-05 — Stair entry walls auto-open.
 *
 * The voxel on the *entry* side of the stair (where you step in from) shares a
 * wall with the stair voxel. That shared wall has to be Open or you're walking
 * into a solid panel. If the face hasn't been claimed by the user or a preset,
 * set it to Open. Otherwise respect the intentional face.
 *
 * Mutates `grid` in place; records the pre-change value in `changedFaces` so
 * `removeStairs` can reverse it later.
 */
export function computeEntryWallClear(
  grid: Voxel[],
  stairVoxelIndex: number,
  entryFace: 'n' | 's' | 'e' | 'w',
  changedFaces: Record<string, SurfaceType>,
): boolean {
  const entryDelta = ASCEND_DELTA[entryFace];
  if (!entryDelta) return false;

  const local = stairVoxelIndex % LEVEL_SIZE;
  const level = Math.floor(stairVoxelIndex / LEVEL_SIZE);
  const row = Math.floor(local / VOXEL_COLS);
  const col = local % VOXEL_COLS;

  const entryRow = row + entryDelta.dr;
  const entryCol = col + entryDelta.dc;
  if (entryRow < 0 || entryRow >= VOXEL_ROWS || entryCol < 0 || entryCol >= VOXEL_COLS) return false;

  const entryNeighborIdx = level * LEVEL_SIZE + entryRow * VOXEL_COLS + entryCol;
  const entryNeighbor = grid[entryNeighborIdx];
  if (!entryNeighbor?.active) return false;

  const neighborFace = STAIR_FLIP[entryFace] as keyof VoxelFaces;
  if (isVoxelFaceProtected(entryNeighbor, neighborFace)) return false;
  // Idempotency: no mutation if the face is already Open — same pattern as
  // `computeFloorVoid` so repeated normalize() calls are no-ops.
  if (entryNeighbor.faces[neighborFace] === 'Open') return false;

  trackSmartFaceChange(changedFaces, entryNeighborIdx, neighborFace, entryNeighbor.faces[neighborFace]);
  grid[entryNeighborIdx] = {
    ...entryNeighbor,
    faces: { ...entryNeighbor.faces, [neighborFace]: 'Open' },
  };
  return true;
}

// ── SR-06: Lateral railings on exposed stair sides ──────────

/**
 * SR-06 — Stair lateral railings.
 *
 * For a stair ascending n/s, the east and west faces of the stair voxels face
 * "outward" along the run. If those faces look into open air (OOB or inactive
 * neighbour), they're fall hazards and need a cable railing. Respect any
 * user-painted or preset-protected face.
 *
 * Applies to both the lower AND upper stair voxels (a two-voxel stair run has
 * two sides of railings). Caller passes the indices that exist (`upperVoxelIdx`
 * may be undefined for single-voxel stairs).
 */
export function computeLateralRailings(
  grid: Voxel[],
  lowerVoxelIdx: number,
  upperVoxelIdx: number | undefined,
  ascending: 'n' | 's' | 'e' | 'w',
  changedFaces: Record<string, SurfaceType>,
): number {
  const lateralFaces: Array<'n' | 's' | 'e' | 'w'> =
    (ascending === 'n' || ascending === 's') ? ['e', 'w'] : ['n', 's'];
  const stairIndices = upperVoxelIdx !== undefined ? [lowerVoxelIdx, upperVoxelIdx] : [lowerVoxelIdx];
  const level = Math.floor(lowerVoxelIdx / LEVEL_SIZE);
  let applied = 0;

  for (const stairIdx of stairIndices) {
    const stairVoxel = grid[stairIdx];
    if (!stairVoxel) continue;
    const local = stairIdx % LEVEL_SIZE;
    const sRow = Math.floor(local / VOXEL_COLS);
    const sCol = local % VOXEL_COLS;

    for (const latFace of lateralFaces) {
      if (isVoxelFaceProtected(stairVoxel, latFace)) continue;
      const delta = ASCEND_DELTA[latFace];
      if (!delta) continue;
      const nRow = sRow + delta.dr;
      const nCol = sCol + delta.dc;
      const inBounds = nRow >= 0 && nRow < VOXEL_ROWS && nCol >= 0 && nCol < VOXEL_COLS;
      const nIdx = level * LEVEL_SIZE + nRow * VOXEL_COLS + nCol;
      const neighborActive = inBounds && (grid[nIdx]?.active ?? false);
      if (neighborActive) continue;
      if (stairVoxel.faces[latFace] === 'Railing_Cable') continue;

      trackSmartFaceChange(changedFaces, stairIdx, latFace, stairVoxel.faces[latFace]);
      grid[stairIdx] = {
        ...grid[stairIdx],
        faces: { ...grid[stairIdx].faces, [latFace]: 'Railing_Cable' },
      };
      applied++;
    }
  }

  return applied;
}

// ── SR-09: Cross-container floor void ───────────────────────

/**
 * SR-09 — Cross-container stair-void propagation.
 *
 * When a stair reaches the top internal level of its source container AND the
 * container is supporting (stacked on top of) another, the FLOOR of the stacked
 * container directly above the stair must open so the user can climb through.
 *
 * Returns an updated containers record with the target container's grid mutated.
 * If no supporting container exists or the target voxel isn't active, returns
 * the original record unchanged.
 */
export function computeCrossContainerVoid(
  containers: Record<string, Container>,
  sourceContainerId: string,
  stairLocalIdx: number,
  ascending: 'n' | 's' | 'e' | 'w',
): {
  containers: Record<string, Container>;
  externalChanges: Array<{ containerId: string; changedFaces: Record<string, SurfaceType> }>;
} {
  const source = containers[sourceContainerId];
  if (!source?.supporting?.length) return { containers, externalChanges: [] };

  const exitFace = STAIR_FLIP[ascending] as 'n' | 's' | 'e' | 'w';
  const externalChanges: Array<{ containerId: string; changedFaces: Record<string, SurfaceType> }> = [];
  let out = containers;

  for (const aboveId of source.supporting) {
    const above = out[aboveId];
    if (!above?.voxelGrid) continue;
    const aboveVoxel = above.voxelGrid[stairLocalIdx];
    if (!aboveVoxel?.active) continue;

    const aboveGrid = [...above.voxelGrid];
    const externalChangedFaces: Record<string, SurfaceType> = {};
    const modified = computeFloorVoid(aboveGrid, stairLocalIdx, exitFace, externalChangedFaces);
    if (!modified) continue;

    externalChanges.push({ containerId: aboveId, changedFaces: externalChangedFaces });
    out = {
      ...out,
      [aboveId]: { ...above, voxelGrid: aboveGrid },
    };
  }

  return { containers: out, externalChanges };
}

/** Whether a stair at `voxelIndex` reaches the top internal level of its container
 *  (either the voxel itself is on the top level, or its ascent voxel is). */
export function stairReachesTopLevel(
  grid: Voxel[],
  voxelIndex: number,
  ascending: 'n' | 's' | 'e' | 'w',
): boolean {
  const level = Math.floor(voxelIndex / LEVEL_SIZE);
  if (level === VOXEL_LEVELS - 1) return true;

  const { dr, dc } = ASCEND_DELTA[ascending];
  const local = voxelIndex % LEVEL_SIZE;
  const row = Math.floor(local / VOXEL_COLS);
  const col = local % VOXEL_COLS;
  const aboveRow = row + dr;
  const aboveCol = col + dc;
  if (aboveRow < 0 || aboveRow >= VOXEL_ROWS || aboveCol < 0 || aboveCol >= VOXEL_COLS) return false;
  const aboveIdx = level * LEVEL_SIZE + aboveRow * VOXEL_COLS + aboveCol;
  return Math.floor(aboveIdx / LEVEL_SIZE) === VOXEL_LEVELS - 1;
}
