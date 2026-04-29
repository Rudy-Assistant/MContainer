/**
 * smartRuleValidator.ts — pure scanner for Smart Rule violations.
 *
 * Runs over a snapshot of containers and reports any rule whose invariant is
 * violated. In Smart mode most of these are impossible (the store auto-applies
 * the rule). In Manual mode they become warnings surfaced in the UI.
 *
 * Every entry in SMART_RULES.md should either:
 *   (a) be enforceable by a pure scan over Container state → listed here, OR
 *   (b) be structurally impossible to violate once applied → no scanner needed.
 *
 * Keep this module pure — no store imports, no React.
 */

import {
  type Container,
  type Voxel,
  VOXEL_COLS,
  VOXEL_LEVELS,
  VOXEL_ROWS,
} from '@/types/container';
import { ASCEND_DELTA, STAIR_FLIP } from '@/utils/stairEnforcement';

export type SmartRuleId =
  | 'SR-01-stair-void'
  | 'SR-02-floor-corner-pole'
  | 'SR-03-rooftop-level'
  | 'SR-04-open-edge-railing'
  | 'SR-05-stair-entry-wall'
  | 'SR-06-stair-lateral-railing'
  | 'SR-07-rooftop-topmost'
  | 'SR-08-concave-corner-pole'
  | 'SR-09-cross-container-void'
  | 'SR-10-fall-hazard-guard';

export interface SmartRuleViolation {
  ruleId: SmartRuleId;
  message: string;
  containerId: string;
  voxelIndex?: number;
  severity: 'high' | 'medium' | 'low';
}

const LEVEL_SIZE = VOXEL_ROWS * VOXEL_COLS;

function localIdxOf(row: number, col: number, level = 0): number {
  return level * LEVEL_SIZE + row * VOXEL_COLS + col;
}

function levelOf(voxelIndex: number): number {
  return Math.floor(voxelIndex / LEVEL_SIZE);
}

function localOf(voxelIndex: number): number {
  return voxelIndex % LEVEL_SIZE;
}

/** SR-01 — every stair voxel that reaches the top internal level has either:
 *    (a) no container above, OR
 *    (b) the voxel directly above (same local idx) has its floor open. */
function checkStairVoid(c: Container, containers: Record<string, Container>): SmartRuleViolation[] {
  const out: SmartRuleViolation[] = [];
  const grid = c.voxelGrid;
  if (!grid) return out;

  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v?.voxelType !== 'stairs') continue;
    // Only the LOWER stair voxel models the overall stair — skip upper-half duplicates.
    if (v.stairPart === 'upper') continue;

    const level = levelOf(i);
    const local = localOf(i);

    // Does this stair reach the top internal level? Either it's already there,
    // or its ascent voxel is on the top level.
    const reachesTop = level === VOXEL_LEVELS - 1;
    // For stairs at level=0, check if the floor above within the container is open.
    if (!reachesTop) {
      const aboveIdx = localOf(i) + (level + 1) * LEVEL_SIZE;
      const above = grid[aboveIdx];
      if (above?.active && above.faces.bottom !== 'Open' && above.faces.top !== 'Open') {
        out.push({
          ruleId: 'SR-01-stair-void',
          message: `Stair at voxel ${i} dead-ends in a ceiling — floor above isn't opened.`,
          containerId: c.id,
          voxelIndex: i,
          severity: 'high',
        });
      }
      continue;
    }

    // Stair is at the top level → cross-container void required if supported.
    const supporting = c.supporting ?? [];
    for (const aboveId of supporting) {
      const above = containers[aboveId];
      if (!above?.voxelGrid) continue;
      const aboveVoxel = above.voxelGrid[local];
      if (aboveVoxel?.active && aboveVoxel.faces.bottom !== 'Open') {
        out.push({
          ruleId: 'SR-01-stair-void',
          message: `Stair at voxel ${i} climbs into a solid floor of container ${above.id.slice(0, 8)}.`,
          containerId: c.id,
          voxelIndex: i,
          severity: 'high',
        });
      }
    }
  }
  return out;
}

/** SR-02 — no active voxel with a floor (bottom !== 'Open') should have an
 *  outside-facing edge (neighbour is OOB or inactive) without a supporting pole.
 *  This is a **soft** check — the pole itself is rendered from the same data,
 *  so a mismatch here means something stripped the `active` flag inconsistently.
 *  We flag any active floor voxel whose 4 cardinal neighbours include ≥3 OOB/
 *  inactive AND whose row/col is on the extension border. */
function checkFloorCornerPole(c: Container): SmartRuleViolation[] {
  const out: SmartRuleViolation[] = [];
  const grid = c.voxelGrid;
  if (!grid) return out;

  const isActiveFloor = (row: number, col: number, level: number) => {
    if (row < 0 || row >= VOXEL_ROWS || col < 0 || col >= VOXEL_COLS) return false;
    const v = grid[localIdxOf(row, col, level)];
    return !!(v?.active && (v.faces.bottom !== 'Open' || v.faces.top !== 'Open'));
  };

  for (let level = 0; level < VOXEL_LEVELS; level++) {
    for (let row = 0; row < VOXEL_ROWS; row++) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        const idx = localIdxOf(row, col, level);
        const v = grid[idx];
        if (!v?.active) continue;
        if (v.faces.bottom === 'Open' && v.faces.top === 'Open') continue;

        // Count cardinal in-bounds active-floor neighbours.
        let neighbours = 0;
        if (isActiveFloor(row - 1, col, level)) neighbours++;
        if (isActiveFloor(row + 1, col, level)) neighbours++;
        if (isActiveFloor(row, col - 1, level)) neighbours++;
        if (isActiveFloor(row, col + 1, level)) neighbours++;

        // Isolated floor voxel — would be a cantilever with no neighbours, almost
        // certainly a data error. (A legitimate 1×1 pavilion uses the body region,
        // which the smart-pole algorithm covers via its corner-count branch.)
        if (neighbours === 0 && (row === 0 || row === VOXEL_ROWS - 1 || col === 0 || col === VOXEL_COLS - 1)) {
          out.push({
            ruleId: 'SR-02-floor-corner-pole',
            message: `Floor voxel at row=${row} col=${col} level=${level} is isolated — no cardinal neighbours to share a pole with.`,
            containerId: c.id,
            voxelIndex: idx,
            severity: 'medium',
          });
        }
      }
    }
  }
  return out;
}

/** SR-04 — Elevated deck voxels must not have open walls without a railing.
 *  Migrated from designValidation.ts `checkUnprotectedEdges` to deduplicate
 *  the two rules that previously flagged the same defect under different IDs.
 *
 *  A voxel violates SR-04 when ALL of these are true:
 *    - container is elevated (position.y > 0.1 OR stackedOn is set)
 *    - voxel is active and has an open top (outdoor — fall hazard if you trip)
 *    - a wall face is `Open` AND its neighbour is OOB or inactive
 *    - the user hasn't explicitly hand-painted that face
 *
 *  Accepted non-violations on a wall face: Railing_Cable, Railing_Glass,
 *  Solid_Steel, Glass_Pane, or Door. */
function checkOpenEdgeRailing(c: Container): SmartRuleViolation[] {
  const out: SmartRuleViolation[] = [];
  const grid = c.voxelGrid;
  if (!grid) return out;

  // Elevated ↔ fall hazard. Ground-level exteriors are steel walls by convention.
  const elevated = c.position.y > 0.1 || !!c.stackedOn;
  if (!elevated) return out;

  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (!v?.active) continue;
    if (v.faces.top !== 'Open') continue;

    const level = levelOf(i);
    const local = localOf(i);
    const row = Math.floor(local / VOXEL_COLS);
    const col = local % VOXEL_COLS;
    const faces: Array<[keyof Voxel['faces'], number, number]> = [
      ['n', row - 1, col],
      ['s', row + 1, col],
      ['e', row, col + 1],
      ['w', row, col - 1],
    ];
    for (const [face, nRow, nCol] of faces) {
      if (v.userPaintedFaces?.[face]) continue;
      const inBounds = nRow >= 0 && nRow < VOXEL_ROWS && nCol >= 0 && nCol < VOXEL_COLS;
      const neighborActive = inBounds && (grid[localIdxOf(nRow, nCol, level)]?.active ?? false);
      if (neighborActive) continue;

      const current = v.faces[face];
      // "Open" wall with no active neighbour = unprotected edge.
      // Other non-railing values (e.g. Deck_Wood, Glass_Shoji) on a fall-hazard
      // perimeter also fail — the user-painted guard skips those intentionally.
      const allowed = ['Railing_Cable', 'Railing_Glass', 'Solid_Steel', 'Glass_Pane', 'Door'];
      if (allowed.includes(current)) continue;

      out.push({
        ruleId: 'SR-04-open-edge-railing',
        message: `Elevated deck voxel ${i} face "${face}" faces open air without a railing (currently ${current}).`,
        containerId: c.id,
        voxelIndex: i,
        severity: 'high',
      });
    }
  }
  return out;
}

/** SR-07 — a non-topmost container must not carry a rooftop-deck signature. */
function checkRooftopTopmost(c: Container, containers: Record<string, Container>): SmartRuleViolation[] {
  const isTopmost = !Object.values(containers).some((o) => o.stackedOn === c.id);
  if (isTopmost) return [];
  const grid = c.voxelGrid;
  if (!grid) return [];

  const topLevelBase = (VOXEL_LEVELS - 1) * LEVEL_SIZE;
  for (let row = 1; row <= 2; row++) {
    for (let col = 1; col <= 6; col++) {
      const idx = topLevelBase + row * VOXEL_COLS + col;
      const v = grid[idx];
      if (v?.faces.top === 'Deck_Wood') {
        return [{
          ruleId: 'SR-07-rooftop-topmost',
          message: `Container ${c.id.slice(0, 8)} has a rooftop deck but another container is stacked on it.`,
          containerId: c.id,
          voxelIndex: idx,
          severity: 'medium',
        }];
      }
    }
  }
  return [];
}

// ───────────────────────────────────────────────────────────
// SCANNERS FOR SR-03, SR-05, SR-06, SR-08, SR-09, SR-10
// ───────────────────────────────────────────────────────────

/** SR-03 — Rooftop deck material belongs on the TOP internal level only.
 *  An AI emitting a raw `Container[]` might put Deck_Wood on a body voxel's
 *  level-0 top face — which would render as a mezzanine, not a rooftop.
 *  Excludes stair-upper voxels: `buildStairFaces('upper')` legitimately sets
 *  `top: Deck_Wood` as the stair landing, which is a valid non-top-level use. */
function checkRooftopLevel(c: Container): SmartRuleViolation[] {
  const grid = c.voxelGrid;
  if (!grid) return [];
  const out: SmartRuleViolation[] = [];
  for (let level = 0; level < VOXEL_LEVELS - 1; level++) {
    for (let row = 1; row <= 2; row++) {
      for (let col = 1; col <= 6; col++) {
        const idx = localIdxOf(row, col, level);
        const v = grid[idx];
        if (v?.voxelType === 'stairs') continue;
        if (v?.faces.top === 'Deck_Wood') {
          out.push({
            ruleId: 'SR-03-rooftop-level',
            message: `Deck_Wood on a non-top internal level (level ${level}, voxel ${idx}) renders as a mezzanine, not a rooftop.`,
            containerId: c.id,
            voxelIndex: idx,
            severity: 'high',
          });
        }
      }
    }
  }
  return out;
}

/** SR-05 — The shared wall between a stair and its entry neighbour must be Open.
 *  Otherwise the stair is walled off and unreachable. */
function checkStairEntryWall(c: Container): SmartRuleViolation[] {
  const grid = c.voxelGrid;
  if (!grid) return [];
  const out: SmartRuleViolation[] = [];
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v?.voxelType !== 'stairs' || v.stairPart === 'upper' || !v.stairAscending) continue;
    // Entry face is the FLIPPED ascending direction — click-n means ascend-s, entry from the n.
    const entryFace = STAIR_FLIP[v.stairAscending] as 'n' | 's' | 'e' | 'w';
    const entryDelta = ASCEND_DELTA[entryFace];
    if (!entryDelta) continue;
    const level = levelOf(i);
    const local = localOf(i);
    const row = Math.floor(local / VOXEL_COLS);
    const col = local % VOXEL_COLS;
    const eRow = row + entryDelta.dr;
    const eCol = col + entryDelta.dc;
    if (eRow < 0 || eRow >= VOXEL_ROWS || eCol < 0 || eCol >= VOXEL_COLS) continue;
    const entryIdx = localIdxOf(eRow, eCol, level);
    const entry = grid[entryIdx];
    if (!entry?.active) continue;
    const sharedFace = STAIR_FLIP[entryFace] as keyof Voxel['faces'];
    if (entry.faces[sharedFace] !== 'Open' && entry.faces[sharedFace] !== 'Door') {
      out.push({
        ruleId: 'SR-05-stair-entry-wall',
        message: `Stair at voxel ${i} has a walled-off entry — neighbour voxel ${entryIdx} face "${sharedFace}" is ${entry.faces[sharedFace]}.`,
        containerId: c.id,
        voxelIndex: i,
        severity: 'medium',
      });
    }
  }
  return out;
}

/** SR-06 — Exposed lateral faces of a stair run need railings.
 *  Lateral = perpendicular to ascend direction. If the neighbour along that
 *  lateral is OOB or inactive, the stair run has open air on that side. */
function checkStairLateralRailing(c: Container): SmartRuleViolation[] {
  const grid = c.voxelGrid;
  if (!grid) return [];
  const out: SmartRuleViolation[] = [];
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v?.voxelType !== 'stairs' || !v.stairAscending) continue;
    const isNS = v.stairAscending === 'n' || v.stairAscending === 's';
    const lateralFaces: Array<keyof Voxel['faces']> = isNS ? ['e', 'w'] : ['n', 's'];
    const level = levelOf(i);
    const local = localOf(i);
    const row = Math.floor(local / VOXEL_COLS);
    const col = local % VOXEL_COLS;
    for (const face of lateralFaces) {
      const delta = ASCEND_DELTA[face];
      if (!delta) continue;
      const nRow = row + delta.dr;
      const nCol = col + delta.dc;
      const inBounds = nRow >= 0 && nRow < VOXEL_ROWS && nCol >= 0 && nCol < VOXEL_COLS;
      const neighborActive = inBounds && (grid[localIdxOf(nRow, nCol, level)]?.active ?? false);
      if (neighborActive) continue;
      if (v.faces[face] !== 'Railing_Cable' && v.faces[face] !== 'Railing_Glass' && v.faces[face] !== 'Solid_Steel' && v.faces[face] !== 'Glass_Pane') {
        out.push({
          ruleId: 'SR-06-stair-lateral-railing',
          message: `Stair at voxel ${i} has an exposed lateral face "${face}" with no railing (currently ${v.faces[face]}).`,
          containerId: c.id,
          voxelIndex: i,
          severity: 'medium',
        });
      }
    }
  }
  return out;
}

/** SR-08 — Concave footprint corners get poles.
 *
 *  This is **render-derived**: the pole algorithm in `smartPoles.ts` places a
 *  post at every vertex where exactly 1 (convex) or 3 (concave) surrounding
 *  voxels are structural. Concave corners in a clean voxel arrangement are
 *  normal (every L-shape has one), so a *data-layer* scanner would be pure
 *  noise. There is no violation state in `Container` to detect.
 *
 *  Left as a named no-op so the rule ID is registered and the audit path
 *  `listRules()` can see it. If a future data-layer malformation emerges
 *  (e.g. disconnected voxel islands whose poles would float), add checks here.
 */
function checkConcaveCornerPole(_c: Container): SmartRuleViolation[] {
  return [];
}

/** SR-09 — Cross-container stair-void propagation.
 *  Complements SR-01: if a stair reaches the top internal level AND the
 *  container is supporting stacked containers, the STACKED container's
 *  voxel at the same local index must also have its floor open. */
function checkCrossContainerVoid(c: Container, containers: Record<string, Container>): SmartRuleViolation[] {
  if (!c.supporting?.length) return [];
  const grid = c.voxelGrid;
  if (!grid) return [];
  const out: SmartRuleViolation[] = [];

  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (v?.voxelType !== 'stairs' || v.stairPart === 'upper') continue;

    const level = levelOf(i);
    const reachesTop = level === VOXEL_LEVELS - 1;
    if (!reachesTop) continue;

    const local = localOf(i);
    for (const aboveId of c.supporting) {
      const above = containers[aboveId];
      const aboveGrid = above?.voxelGrid;
      if (!aboveGrid) continue;
      const target = aboveGrid[local];
      if (!target?.active) continue;
      if (target.faces.bottom !== 'Open') {
        out.push({
          ruleId: 'SR-09-cross-container-void',
          message: `Stair at voxel ${i} reaches the top level but the voxel above in container ${aboveId.slice(0, 8)} has a solid floor.`,
          containerId: c.id,
          voxelIndex: i,
          severity: 'high',
        });
      }
    }
  }
  return out;
}

/** SR-10 — Fall-hazard hole guards.
 *  Any active voxel whose BOTTOM face is Open (you could fall through it)
 *  must have Railing_Cable or Railing_Glass on every side face that abuts
 *  an inactive/OOB neighbour. This is the "hole in the floor" safety check
 *  for atriums and stair landings. */
function checkFallHazardGuard(c: Container): SmartRuleViolation[] {
  const grid = c.voxelGrid;
  if (!grid) return [];
  const out: SmartRuleViolation[] = [];
  for (let i = 0; i < grid.length; i++) {
    const v = grid[i];
    if (!v?.active || v.faces.bottom !== 'Open') continue;
    // Stairs have their own railing rule (SR-06) and are not guarded here.
    if (v.voxelType === 'stairs') continue;
    const level = levelOf(i);
    const local = localOf(i);
    const row = Math.floor(local / VOXEL_COLS);
    const col = local % VOXEL_COLS;
    const faces: Array<[keyof Voxel['faces'], number, number]> = [
      ['n', row - 1, col],
      ['s', row + 1, col],
      ['e', row, col + 1],
      ['w', row, col - 1],
    ];
    for (const [face, nRow, nCol] of faces) {
      const inBounds = nRow >= 0 && nRow < VOXEL_ROWS && nCol >= 0 && nCol < VOXEL_COLS;
      const neighborActive = inBounds && (grid[localIdxOf(nRow, nCol, level)]?.active ?? false);
      if (neighborActive) continue;
      if (v.userPaintedFaces?.[face]) continue;
      const allowed = ['Railing_Cable', 'Railing_Glass', 'Solid_Steel', 'Glass_Pane'];
      if (!allowed.includes(v.faces[face])) {
        out.push({
          ruleId: 'SR-10-fall-hazard-guard',
          message: `Open-floor voxel ${i} face "${face}" borders a fall hazard without a guard (currently ${v.faces[face]}).`,
          containerId: c.id,
          voxelIndex: i,
          severity: 'medium',
        });
      }
    }
  }
  return out;
}

export function validateSmartRules(containers: Record<string, Container>): SmartRuleViolation[] {
  const out: SmartRuleViolation[] = [];
  for (const c of Object.values(containers)) {
    out.push(...checkStairVoid(c, containers));
    out.push(...checkFloorCornerPole(c));
    out.push(...checkRooftopLevel(c));
    out.push(...checkOpenEdgeRailing(c));
    out.push(...checkStairEntryWall(c));
    out.push(...checkStairLateralRailing(c));
    out.push(...checkRooftopTopmost(c, containers));
    out.push(...checkConcaveCornerPole(c));
    out.push(...checkCrossContainerVoid(c, containers));
    out.push(...checkFallHazardGuard(c));
  }
  return out;
}
