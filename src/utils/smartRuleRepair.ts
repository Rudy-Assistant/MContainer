/**
 * smartRuleRepair.ts — Pure autofix functions for Smart Rule violations.
 *
 * Each repair takes an immutable containers map and returns a NEW map with the
 * violation fixed. Repairs are idempotent: applying the same repair twice is
 * indistinguishable from applying it once. This is the core correctness
 * property that lets `normalizeDesign` run the cascade without infinite loops.
 *
 * Repairs cover 8 of 10 rules. SR-02 (floor-corner poles) and SR-08 (concave
 * corner poles) are render-derived and have no data-layer repair.
 *
 * Cascade order — documented in `normalizeDesign` — is:
 *   SR-07 → SR-01 → SR-05 → SR-06 → SR-09 → SR-04 → SR-10 → SR-03
 * Each repair assumes prior repairs have already run.
 */

import type { Container, SurfaceType, Voxel, VoxelFaces } from '@/types/container';
import { VOXEL_COLS, VOXEL_LEVELS, VOXEL_ROWS } from '@/types/container';
import {
  ASCEND_DELTA,
  STAIR_FLIP,
  computeCrossContainerVoid,
  computeEntryWallClear,
  computeFloorVoid,
  computeLateralRailings,
} from '@/utils/stairEnforcement';

const LEVEL_SIZE = VOXEL_ROWS * VOXEL_COLS;
const TOP_LEVEL_BASE = (VOXEL_LEVELS - 1) * LEVEL_SIZE;

function levelOf(i: number): number { return Math.floor(i / LEVEL_SIZE); }
function localOf(i: number): number { return i % LEVEL_SIZE; }
function rowOf(local: number): number { return Math.floor(local / VOXEL_COLS); }
function colOf(local: number): number { return local % VOXEL_COLS; }
function idxOf(row: number, col: number, level = 0): number {
  return level * LEVEL_SIZE + row * VOXEL_COLS + col;
}

/** Higher-order helper used by most per-container repairs.
 *
 *  Every repair walks every container, clones that container's voxel grid
 *  once, lets the rule mutate the clone, and returns a new containers map
 *  only when something actually changed. Encapsulating the boilerplate here
 *  cuts ~8 lines of ceremony per repair and ensures the "cloned grid" and
 *  "commit only on mutation" invariants stay consistent across rules.
 *
 *  `work` receives a MUTABLE grid copy and the source container; it returns
 *  `true` to signal a mutation (triggers the commit) or `false` for a no-op.
 */
function mapContainers(
  containers: Record<string, Container>,
  work: (grid: Voxel[], container: Container) => boolean,
): Record<string, Container> {
  const out: Record<string, Container> = { ...containers };
  for (const [id, c] of Object.entries(out)) {
    if (!c.voxelGrid) continue;
    const grid = [...c.voxelGrid];
    if (work(grid, c)) {
      out[id] = { ...c, voxelGrid: grid };
    }
  }
  return out;
}

// ── SR-01 — Stair floor-void repair ─────────────────────────

/** For every active stair voxel in every container, punch the FLOOR of the
 *  voxel directly above on the next internal level (same row/col). Matches
 *  the scanner's `aboveIdx = local + (level+1) × LEVEL_SIZE` formula. The
 *  stair's forward-horizontal neighbour is the *upper stair voxel* at the
 *  same level — not the ceiling we need to open. */
export function repairStairVoid(containers: Record<string, Container>): Record<string, Container> {
  return mapContainers(containers, (grid) => {
    const changedFaces: Record<string, SurfaceType> = {};
    let mutated = false;
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (v?.voxelType !== 'stairs' || v.stairPart === 'upper' || !v.stairAscending) continue;
      const level = levelOf(i);
      const exitFace = STAIR_FLIP[v.stairAscending] as 'n' | 's' | 'e' | 'w';
      // Ceiling voxel = same local (row, col), next level up. `computeFloorVoid`
      // opens that voxel's bottom and installs perimeter railings.
      const aboveIdx = (level + 1) * LEVEL_SIZE + localOf(i);
      if (aboveIdx >= grid.length) continue;
      if (computeFloorVoid(grid, aboveIdx, exitFace, changedFaces)) mutated = true;
    }
    return mutated;
  });
}

// ── SR-05 — Stair entry-wall repair ─────────────────────────

export function repairStairEntryWall(containers: Record<string, Container>): Record<string, Container> {
  return mapContainers(containers, (grid) => {
    const changedFaces: Record<string, SurfaceType> = {};
    let mutated = false;
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (v?.voxelType !== 'stairs' || v.stairPart === 'upper' || !v.stairAscending) continue;
      const entryFace = STAIR_FLIP[v.stairAscending] as 'n' | 's' | 'e' | 'w';
      if (computeEntryWallClear(grid, i, entryFace, changedFaces)) mutated = true;
    }
    return mutated;
  });
}

// ── SR-06 — Stair lateral-railing repair ────────────────────

export function repairStairLateralRailing(containers: Record<string, Container>): Record<string, Container> {
  return mapContainers(containers, (grid) => {
    const changedFaces: Record<string, SurfaceType> = {};
    let mutated = false;
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (v?.voxelType !== 'stairs' || v.stairPart === 'upper' || !v.stairAscending) continue;
      const delta = ASCEND_DELTA[v.stairAscending];
      if (!delta) continue;
      const local = localOf(i);
      const level = levelOf(i);
      const upperRow = rowOf(local) + delta.dr;
      const upperCol = colOf(local) + delta.dc;
      const upperInBounds = upperRow >= 0 && upperRow < VOXEL_ROWS && upperCol >= 0 && upperCol < VOXEL_COLS;
      const upperIdx = upperInBounds ? level * LEVEL_SIZE + upperRow * VOXEL_COLS + upperCol : undefined;
      if (computeLateralRailings(grid, i, upperIdx, v.stairAscending, changedFaces) > 0) mutated = true;
    }
    return mutated;
  });
}

// ── SR-09 — Cross-container stair-void repair ───────────────

export function repairCrossContainerVoid(containers: Record<string, Container>): Record<string, Container> {
  let out = containers;
  for (const [id, c] of Object.entries(containers)) {
    if (!c.voxelGrid || !c.supporting?.length) continue;
    for (let i = 0; i < c.voxelGrid.length; i++) {
      const v = c.voxelGrid[i];
      if (v?.voxelType !== 'stairs' || v.stairPart === 'upper' || !v.stairAscending) continue;
      if (levelOf(i) !== VOXEL_LEVELS - 1) continue;
      const result = computeCrossContainerVoid(out, id, localOf(i), v.stairAscending);
      out = result.containers;
    }
  }
  return out;
}

// ── SR-04 — Open-edge railing repair ────────────────────────

/** For every elevated-deck voxel whose wall faces OOB without a railing,
 *  install `Railing_Cable`. Skip user-painted faces. */
export function repairOpenEdgeRailing(containers: Record<string, Container>): Record<string, Container> {
  const out: Record<string, Container> = { ...containers };
  for (const [id, c] of Object.entries(out)) {
    if (!c.voxelGrid) continue;
    // Only elevated containers need this — ground-level walls are solid steel.
    if ((c.level ?? 0) === 0 && !c.stackedOn) continue;
    const grid = [...c.voxelGrid];
    let mutated = false;

    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (!v?.active || v.faces.top !== 'Open') continue;
      const level = levelOf(i);
      const local = localOf(i);
      const row = rowOf(local);
      const col = colOf(local);
      const faces: Array<[keyof VoxelFaces, number, number]> = [
        ['n', row - 1, col],
        ['s', row + 1, col],
        ['e', row, col + 1],
        ['w', row, col - 1],
      ];
      let nextFaces: VoxelFaces | null = null;
      for (const [face, nRow, nCol] of faces) {
        // Match the scanner exactly: an unprotected edge is OOB OR neighbour
        // voxel is inactive. Previous form only fixed OOB — inactive-neighbour
        // violations fired in the scanner but the repair silently skipped.
        const inBounds = nRow >= 0 && nRow < VOXEL_ROWS && nCol >= 0 && nCol < VOXEL_COLS;
        const neighborActive = inBounds && (grid[idxOf(nRow, nCol, level)]?.active ?? false);
        if (neighborActive) continue;
        if (v.userPaintedFaces?.[face]) continue;
        const current = v.faces[face];
        // Protected face types — anything intentionally placed by the user
        // or a glass/door/window arrangement should NOT be silently promoted
        // to a railing. The window variants were missing from this list,
        // which silently clobbered Window_Standard perimeter walls on any
        // elevated container (caught while wiring framed_glass_atrium for
        // the Glass Atrium Showcase).
        if (
          current === 'Railing_Cable' || current === 'Railing_Glass' ||
          current === 'Solid_Steel' || current === 'Glass_Pane' || current === 'Door' ||
          current === 'Window_Standard' || current === 'Window_Sill' ||
          current === 'Window_Clerestory' || current === 'Window_Half' ||
          current === 'Glass_Shoji' || current === 'Wall_Washi'
        ) continue;
        nextFaces = nextFaces ?? { ...v.faces };
        nextFaces[face] = 'Railing_Cable';
      }
      if (nextFaces) {
        grid[i] = { ...v, faces: nextFaces };
        mutated = true;
      }
    }
    if (mutated) out[id] = { ...c, voxelGrid: grid };
  }
  return out;
}

// ── SR-10 — Fall-hazard guard repair ────────────────────────

export function repairFallHazardGuard(containers: Record<string, Container>): Record<string, Container> {
  const out: Record<string, Container> = { ...containers };
  for (const [id, c] of Object.entries(out)) {
    if (!c.voxelGrid) continue;
    const grid = [...c.voxelGrid];
    let mutated = false;

    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (!v?.active || v.faces.bottom !== 'Open') continue;
      if (v.voxelType === 'stairs') continue;
      const level = levelOf(i);
      const local = localOf(i);
      const row = rowOf(local);
      const col = colOf(local);
      const faces: Array<[keyof VoxelFaces, number, number]> = [
        ['n', row - 1, col],
        ['s', row + 1, col],
        ['e', row, col + 1],
        ['w', row, col - 1],
      ];
      let nextFaces: VoxelFaces | null = null;
      for (const [face, nRow, nCol] of faces) {
        const inBounds = nRow >= 0 && nRow < VOXEL_ROWS && nCol >= 0 && nCol < VOXEL_COLS;
        const neighborActive = inBounds && (grid[idxOf(nRow, nCol, level)]?.active ?? false);
        if (neighborActive) continue;
        if (v.userPaintedFaces?.[face]) continue;
        const current = v.faces[face];
        // Same protected-list expansion as SR-04 — window/shoji/washi faces
        // are intentional choices and must not be silently railed over.
        const allowed: SurfaceType[] = [
          'Railing_Cable', 'Railing_Glass', 'Solid_Steel', 'Glass_Pane',
          'Window_Standard', 'Window_Sill', 'Window_Clerestory', 'Window_Half',
          'Glass_Shoji', 'Wall_Washi', 'Door',
        ];
        if (allowed.includes(current)) continue;
        nextFaces = nextFaces ?? { ...v.faces };
        nextFaces[face] = 'Railing_Cable';
      }
      if (nextFaces) {
        grid[i] = { ...v, faces: nextFaces };
        mutated = true;
      }
    }
    if (mutated) out[id] = { ...c, voxelGrid: grid };
  }
  return out;
}

// ── SR-07 — Rooftop only on topmost ─────────────────────────

/** Strip Deck_Wood from any container that is not the topmost in its stack.
 *  Walls that had been promoted to Railing_Cable by `generateRooftopDeck` are
 *  restored to Solid_Steel (the ceiling state before the deck was added). */
export function repairRooftopTopmost(containers: Record<string, Container>): Record<string, Container> {
  const out: Record<string, Container> = { ...containers };
  const ids = Object.keys(out);
  for (const id of ids) {
    const c = out[id];
    if (!c.voxelGrid) continue;
    const isTopmost = !ids.some((oid) => out[oid].stackedOn === id);
    if (isTopmost) continue;

    const grid = [...c.voxelGrid];
    let mutated = false;
    for (let row = 1; row <= 2; row++) {
      for (let col = 1; col <= 6; col++) {
        const idx = TOP_LEVEL_BASE + row * VOXEL_COLS + col;
        const v = grid[idx];
        if (!v) continue;
        if (v.faces.top === 'Deck_Wood' || v.faces.n === 'Railing_Cable' || v.faces.s === 'Railing_Cable' || v.faces.e === 'Railing_Cable' || v.faces.w === 'Railing_Cable') {
          const next: VoxelFaces = { ...v.faces };
          if (next.top === 'Deck_Wood') next.top = 'Solid_Steel';
          if (row === 1 && next.n === 'Railing_Cable') next.n = 'Open';
          if (row === 2 && next.s === 'Railing_Cable') next.s = 'Open';
          if (col === 1 && next.w === 'Railing_Cable') next.w = 'Open';
          if (col === 6 && next.e === 'Railing_Cable') next.e = 'Open';
          grid[idx] = { ...v, faces: next };
          mutated = true;
        }
      }
    }
    if (mutated) out[id] = { ...c, voxelGrid: grid };
  }
  return out;
}

// ── SR-03 — Rooftop deck on wrong level ─────────────────────

/** If Deck_Wood appears on a non-top internal level body voxel (and that
 *  voxel isn't a stair landing), demote it to Solid_Steel. The renderer's
 *  convention is Deck_Wood only on the top of the top internal level. */
export function repairRooftopLevel(containers: Record<string, Container>): Record<string, Container> {
  const out: Record<string, Container> = { ...containers };
  for (const [id, c] of Object.entries(out)) {
    if (!c.voxelGrid) continue;
    const grid = [...c.voxelGrid];
    let mutated = false;
    for (let level = 0; level < VOXEL_LEVELS - 1; level++) {
      for (let row = 1; row <= 2; row++) {
        for (let col = 1; col <= 6; col++) {
          const idx = idxOf(row, col, level);
          const v = grid[idx];
          if (!v) continue;
          if (v.voxelType === 'stairs') continue;
          if (v.faces.top === 'Deck_Wood') {
            grid[idx] = { ...v, faces: { ...v.faces, top: 'Solid_Steel' } };
            mutated = true;
          }
        }
      }
    }
    if (mutated) out[id] = { ...c, voxelGrid: grid };
  }
  return out;
}
