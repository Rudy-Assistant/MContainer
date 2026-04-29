/**
 * Unit tests for `src/utils/smartRuleRepair.ts`.
 *
 * Each repair gets three checks:
 *   1. fix         — minimal violation → expected face mutation
 *   2. idempotency — second invocation returns the same Container reference
 *                    (the repair detects "already fixed" and short-circuits)
 *   3. no-op       — input without the violation passes through with the
 *                    Container reference preserved (mapContainers / per-rule
 *                    helpers commit only on real mutations)
 *
 * The 8 export covers SR-01, SR-03, SR-04, SR-05, SR-06, SR-07, SR-09, SR-10.
 * SR-02 / SR-08 are render-derived and have no data-layer repair (see
 * smartRuleRepair.ts header comment).
 */
import { describe, it, expect } from 'vitest';
import {
  repairCrossContainerVoid,
  repairFallHazardGuard,
  repairOpenEdgeRailing,
  repairRooftopLevel,
  repairRooftopTopmost,
  repairStairEntryWall,
  repairStairLateralRailing,
  repairStairVoid,
} from '@/utils/smartRuleRepair';
import { createContainer } from '@/types/factories';
import type { Container, Voxel, VoxelFaces } from '@/types/container';
import { VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

const LEVEL_SIZE = VOXEL_ROWS * VOXEL_COLS; // 32
const idxOf = (row: number, col: number, level = 0) =>
  level * LEVEL_SIZE + row * VOXEL_COLS + col;

function withVoxel(c: Container, i: number, patch: Partial<Voxel>): Container {
  const grid = [...c.voxelGrid!];
  grid[i] = { ...grid[i], ...patch };
  return { ...c, voxelGrid: grid };
}

function setFaces(c: Container, i: number, faces: Partial<VoxelFaces>): Container {
  const grid = [...c.voxelGrid!];
  grid[i] = { ...grid[i], faces: { ...grid[i].faces, ...faces } };
  return { ...c, voxelGrid: grid };
}

/** Force a voxel into a "lower stair" with a given ascending direction.
 *  We hand-place rather than calling `applyStairsFromFace` so the test isolates
 *  the repair functions from the store action's full consequence cascade. */
function placeStair(c: Container, i: number, ascending: 'n' | 's' | 'e' | 'w'): Container {
  return withVoxel(c, i, {
    active: true,
    voxelType: 'stairs',
    stairPart: 'lower',
    stairAscending: ascending,
  });
}

describe('smartRuleRepair', () => {
  describe('repairStairVoid (SR-01)', () => {
    it('opens the floor of the voxel directly above an active stair', () => {
      // Stair at level 0, row 1, col 2 (idx 10). Voxel above (level 1, same r/c) = idx 42.
      const c = placeStair(createContainer(), idxOf(1, 2), 's');
      expect(c.voxelGrid![idxOf(1, 2, 1)].faces.bottom).toBe('Solid_Steel');

      const result = repairStairVoid({ [c.id]: c });

      expect(result[c.id].voxelGrid![idxOf(1, 2, 1)].faces.bottom).toBe('Open');
    });

    it('is idempotent — second invocation preserves Container reference', () => {
      const c = placeStair(createContainer(), idxOf(1, 2), 's');

      const once = repairStairVoid({ [c.id]: c });
      const twice = repairStairVoid(once);

      expect(twice[c.id]).toBe(once[c.id]);
    });

    it('no-op when no stairs present — preserves Container reference', () => {
      const c = createContainer();

      const result = repairStairVoid({ [c.id]: c });

      expect(result[c.id]).toBe(c);
    });
  });

  describe('repairStairEntryWall (SR-05)', () => {
    it('opens the entry-side neighbor wall facing the stair', () => {
      // Stair at row 1, col 2 ascending 'n' → repair's entryFace = STAIR_FLIP['n'] = 's',
      // entry neighbor at row 2, col 2 (idx 18). The neighbor's north face faces the stair.
      const c = placeStair(createContainer(), idxOf(1, 2), 'n');
      expect(c.voxelGrid![idxOf(2, 2)].faces.n).toBe('Solid_Steel');

      const result = repairStairEntryWall({ [c.id]: c });

      expect(result[c.id].voxelGrid![idxOf(2, 2)].faces.n).toBe('Open');
    });

    it('is idempotent', () => {
      const c = placeStair(createContainer(), idxOf(1, 2), 'n');

      const once = repairStairEntryWall({ [c.id]: c });
      const twice = repairStairEntryWall(once);

      expect(twice[c.id]).toBe(once[c.id]);
    });

    it('no-op when no stairs present — preserves Container reference', () => {
      const c = createContainer();

      const result = repairStairEntryWall({ [c.id]: c });

      expect(result[c.id]).toBe(c);
    });
  });

  describe('repairStairLateralRailing (SR-06)', () => {
    it('adds Railing_Cable to a lateral face exposed to open air', () => {
      // Stair at row 1, col 1 ascending 'n' → lateral faces are e/w.
      // ASCEND_DELTA['e'] dc=-1 → east neighbor at col 0 (halo, inactive) → fall hazard.
      const c = placeStair(createContainer(), idxOf(1, 1), 'n');

      const result = repairStairLateralRailing({ [c.id]: c });

      expect(result[c.id].voxelGrid![idxOf(1, 1)].faces.e).toBe('Railing_Cable');
    });

    it('is idempotent', () => {
      const c = placeStair(createContainer(), idxOf(1, 1), 'n');

      const once = repairStairLateralRailing({ [c.id]: c });
      const twice = repairStairLateralRailing(once);

      expect(twice[c.id]).toBe(once[c.id]);
    });

    it('no-op when both lateral neighbors are active core voxels — preserves Container reference', () => {
      // Stair at row 1, col 3 ascending 's' → upper stair voxel lands at row 2, col 3 (still
      // active core). Lateral faces e/w of BOTH lower (idx 11) and upper (idx 19) point at
      // active core neighbors (cols 2 and 4 in rows 1-2), so no railing is added on either.
      // (Picking ascending='n' here would push the upper voxel onto the inactive halo row 0,
      //  whose halo lateral neighbors WOULD trigger a railing on the upper voxel.)
      const c = placeStair(createContainer(), idxOf(1, 3), 's');

      const result = repairStairLateralRailing({ [c.id]: c });

      expect(result[c.id]).toBe(c);
    });
  });

  describe('repairCrossContainerVoid (SR-09)', () => {
    it('opens the floor of the stacked container above a top-level stair', () => {
      // Lower carries a stair on level 1 (top internal level) at row 1 col 2.
      // SR-09 propagates the floor void to the supporting upper container.
      const lowerBase = placeStair(createContainer(), idxOf(1, 2, 1), 's');
      const upper = createContainer();
      const containers: Record<string, Container> = {
        [lowerBase.id]: { ...lowerBase, supporting: [upper.id] },
        [upper.id]: { ...upper, stackedOn: lowerBase.id },
      };
      // Upper's local idx 10 (level 0, row 1, col 2) starts with the default Deck_Wood floor.
      expect(containers[upper.id].voxelGrid![idxOf(1, 2)].faces.bottom).toBe('Deck_Wood');

      const result = repairCrossContainerVoid(containers);

      expect(result[upper.id].voxelGrid![idxOf(1, 2)].faces.bottom).toBe('Open');
    });

    it('is idempotent', () => {
      const lowerBase = placeStair(createContainer(), idxOf(1, 2, 1), 's');
      const upper = createContainer();
      const containers: Record<string, Container> = {
        [lowerBase.id]: { ...lowerBase, supporting: [upper.id] },
        [upper.id]: { ...upper, stackedOn: lowerBase.id },
      };

      const once = repairCrossContainerVoid(containers);
      const twice = repairCrossContainerVoid(once);

      expect(twice).toBe(once);
    });

    it('no-op when no container declares supporting children — returns input identity', () => {
      const c = createContainer();
      const containers = { [c.id]: c };

      const result = repairCrossContainerVoid(containers);

      expect(result).toBe(containers);
    });
  });

  describe('repairOpenEdgeRailing (SR-04)', () => {
    it('rails an unprotected edge of an active deck voxel on an elevated container', () => {
      // Elevated container (level 1) so SR-04's gate fires.
      // Halo voxel at level 1, row 0, col 1 — flip active=true; default faces are all 'Open'.
      // East neighbor (col 2 halo) is inactive → fall hazard → east face becomes Railing_Cable.
      const base = createContainer();
      const elevated = withVoxel({ ...base, level: 1 }, idxOf(0, 1, 1), { active: true });
      expect(elevated.voxelGrid![idxOf(0, 1, 1)].faces.top).toBe('Open');
      expect(elevated.voxelGrid![idxOf(0, 1, 1)].faces.e).toBe('Open');

      const result = repairOpenEdgeRailing({ [elevated.id]: elevated });

      expect(result[elevated.id].voxelGrid![idxOf(0, 1, 1)].faces.e).toBe('Railing_Cable');
    });

    it('is idempotent', () => {
      const base = createContainer();
      const elevated = withVoxel({ ...base, level: 1 }, idxOf(0, 1, 1), { active: true });

      const once = repairOpenEdgeRailing({ [elevated.id]: elevated });
      const twice = repairOpenEdgeRailing(once);

      expect(twice[elevated.id]).toBe(once[elevated.id]);
    });

    it('no-op on a ground-level un-stacked container — preserves Container reference', () => {
      // Default container has level=0 and stackedOn=null → SR-04 skips the entire container.
      const c = createContainer();

      const result = repairOpenEdgeRailing({ [c.id]: c });

      expect(result[c.id]).toBe(c);
    });
  });

  describe('repairFallHazardGuard (SR-10)', () => {
    it('rails an unprotected wall facing open air when the floor is Open', () => {
      // Voxel at row 1, col 2: flip bottom='Open' (entry condition) AND n='Open' so the
      // protected-list check does NOT skip the face. North neighbor (row 0, col 2) is an
      // inactive halo → fall hazard → north face becomes Railing_Cable.
      const c = setFaces(createContainer(), idxOf(1, 2), { bottom: 'Open', n: 'Open' });

      const result = repairFallHazardGuard({ [c.id]: c });

      expect(result[c.id].voxelGrid![idxOf(1, 2)].faces.n).toBe('Railing_Cable');
    });

    it('is idempotent', () => {
      const c = setFaces(createContainer(), idxOf(1, 2), { bottom: 'Open', n: 'Open' });

      const once = repairFallHazardGuard({ [c.id]: c });
      const twice = repairFallHazardGuard(once);

      expect(twice[c.id]).toBe(once[c.id]);
    });

    it('no-op when all walls of the open-floor voxel are protected (Solid_Steel) — preserves Container reference', () => {
      // bottom=Open enters the loop, but every wall is Solid_Steel (in the allow-list) so
      // the repair finds no unprotected exposed face.
      const c = setFaces(createContainer(), idxOf(1, 2), { bottom: 'Open' });

      const result = repairFallHazardGuard({ [c.id]: c });

      expect(result[c.id]).toBe(c);
    });
  });

  describe('repairRooftopTopmost (SR-07)', () => {
    it('demotes Deck_Wood on a non-topmost container to Solid_Steel', () => {
      // Lower carries a Deck_Wood top face on its top internal level. Upper sits on top of
      // lower, so lower is NOT topmost in the stack and SR-07 fires.
      const lowerBase = createContainer();
      const upper = createContainer();
      const deckIdx = idxOf(1, 1, 1);
      const lowerWithDeck = setFaces(lowerBase, deckIdx, { top: 'Deck_Wood' });
      const containers: Record<string, Container> = {
        [lowerWithDeck.id]: { ...lowerWithDeck, supporting: [upper.id] },
        [upper.id]: { ...upper, stackedOn: lowerWithDeck.id },
      };

      const result = repairRooftopTopmost(containers);

      expect(result[lowerWithDeck.id].voxelGrid![deckIdx].faces.top).toBe('Solid_Steel');
    });

    it('is idempotent', () => {
      const lowerBase = createContainer();
      const upper = createContainer();
      const deckIdx = idxOf(1, 1, 1);
      const lowerWithDeck = setFaces(lowerBase, deckIdx, { top: 'Deck_Wood' });
      const containers: Record<string, Container> = {
        [lowerWithDeck.id]: { ...lowerWithDeck, supporting: [upper.id] },
        [upper.id]: { ...upper, stackedOn: lowerWithDeck.id },
      };

      const once = repairRooftopTopmost(containers);
      const twice = repairRooftopTopmost(once);

      expect(twice[lowerWithDeck.id]).toBe(once[lowerWithDeck.id]);
    });

    it('no-op when the only container is topmost — preserves Container reference', () => {
      const c = createContainer();

      const result = repairRooftopTopmost({ [c.id]: c });

      expect(result[c.id]).toBe(c);
    });
  });

  describe('repairRooftopLevel (SR-03)', () => {
    it('demotes Deck_Wood that appears on a non-top internal level to Solid_Steel', () => {
      // Voxel at level 0, row 1, col 2 — Deck_Wood on its top is illegal because level 0
      // is NOT the topmost internal level (VOXEL_LEVELS=2 so only level 1 is topmost).
      const c = setFaces(createContainer(), idxOf(1, 2), { top: 'Deck_Wood' });

      const result = repairRooftopLevel({ [c.id]: c });

      expect(result[c.id].voxelGrid![idxOf(1, 2)].faces.top).toBe('Solid_Steel');
    });

    it('is idempotent', () => {
      const c = setFaces(createContainer(), idxOf(1, 2), { top: 'Deck_Wood' });

      const once = repairRooftopLevel({ [c.id]: c });
      const twice = repairRooftopLevel(once);

      expect(twice[c.id]).toBe(once[c.id]);
    });

    it('no-op when no Deck_Wood appears on a non-top level — preserves Container reference', () => {
      const c = createContainer();

      const result = repairRooftopLevel({ [c.id]: c });

      expect(result[c.id]).toBe(c);
    });
  });
});
