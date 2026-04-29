/**
 * Starter Sets (model homes 12-15) — each exercises a specific Smart rule.
 *
 * These tests are more than coverage; they function as living documentation
 * for the rules themselves. If a test here fails, read SMART_RULES.md first.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStore } from '@/store/useStore';
import { VOXEL_COLS, VOXEL_LEVELS, VOXEL_ROWS } from '@/types/container';
import { validateSmartRules } from '@/utils/smartRuleValidator';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  useStore.temporal.getState().clear();
}

const TOP_LEVEL_BASE = (VOXEL_LEVELS - 1) * VOXEL_ROWS * VOXEL_COLS;

describe('Starter Sets — Smart Rule exemplars', () => {
  beforeEach(() => { resetStore(); });

  // ── SR-02 Garden Pavilion ────────────────────────────────
  it('STARTER-1: garden_pavilion is a single-container wraparound deck', () => {
    const ids = useStore.getState().placeModelHome('garden_pavilion');
    expect(ids).toHaveLength(1);
    const c = useStore.getState().containers[ids[0]];
    // The wraparound role activates all extension voxels so the perimeter
    // floor corners are exactly the test case for SR-02.
    const active = (c.voxelGrid ?? []).filter((v) => v?.active).length;
    expect(active).toBeGreaterThanOrEqual(64);
    const violations = validateSmartRules(useStore.getState().containers);
    // SR-04 railings may flag a freshly-placed deck pre-smart-pass; scope the assertion.
    const floorCornerViolations = violations.filter((v) => v.ruleId === 'SR-02-floor-corner-pole');
    expect(floorCornerViolations).toEqual([]);
  });

  // ── SR-01 Split-Level Loft ───────────────────────────────
  it('STARTER-2: split_level_loft auto-voids the cross-container floor above the stair', () => {
    const ids = useStore.getState().placeModelHome('split_level_loft');
    expect(ids).toHaveLength(2);
    const containers = useStore.getState().containers;
    const ground = containers[ids[0]];
    const loft = containers[ids[1]];
    expect(loft.stackedOn).toBe(ground.id);

    // The preset places stairs at voxel 13 on the ground. On a 2-level container,
    // voxel 13 is level 0 row 1 col 5, with the ascent voxel on level 1.
    // The voxel directly above the stair-upper in the *loft* should have its floor opened.
    const groundGrid = ground.voxelGrid!;
    const stairEntry = groundGrid[13];
    expect(stairEntry.voxelType).toBe('stairs');

    // Run the validator — SR-01 must not flag this starter.
    const violations = validateSmartRules(containers).filter((v) => v.ruleId === 'SR-01-stair-void');
    expect(violations).toEqual([]);
  });

  // ── SR-08 Corner Terrace ────────────────────────────────
  it('STARTER-3: corner_terrace places two containers in an L configuration', () => {
    const ids = useStore.getState().placeModelHome('corner_terrace');
    expect(ids).toHaveLength(2);
    const [a, b] = ids.map((id) => useStore.getState().containers[id]);
    // An L-shape has the two containers offset on BOTH X and Z axes.
    expect(a.position.x).not.toBe(b.position.x);
    expect(a.position.z).not.toBe(b.position.z);
  });

  // ── SR-09 Stacked Triplex ───────────────────────────────
  it('STARTER-4: stacked_triplex chains stairs across three levels', () => {
    const ids = useStore.getState().placeModelHome('stacked_triplex');
    expect(ids).toHaveLength(3);
    const [ground, middle, top] = ids.map((id) => useStore.getState().containers[id]);
    expect(middle.stackedOn).toBe(ground.id);
    expect(top.stackedOn).toBe(middle.id);
    // Ground has stairs at voxel 9, middle has stairs at voxel 14 — both "lower"-part.
    expect(ground.voxelGrid![9].voxelType).toBe('stairs');
    expect(middle.voxelGrid![14].voxelType).toBe('stairs');
  });

  // ── SR-07 Rooftop on topmost-only ───────────────────────
  it('STARTER-4b: stacked_triplex rooftop deck only on the topmost container', () => {
    const ids = useStore.getState().placeModelHome('stacked_triplex');
    const containers = useStore.getState().containers;
    // Only the topmost (no one stackedOn it) should have Deck_Wood on a top-level body voxel.
    const topmost = Object.values(containers).find(
      (c) => ids.includes(c.id) && !Object.values(containers).some((o) => o.stackedOn === c.id)
    );
    expect(topmost).toBeDefined();
    const grid = topmost!.voxelGrid!;
    const bodyIdx = TOP_LEVEL_BASE + 1 * VOXEL_COLS + 1;
    expect(grid[bodyIdx].faces.top).toBe('Deck_Wood');

    // The non-topmost stacked containers must not carry Deck_Wood on their top level.
    const violations = validateSmartRules(containers).filter((v) => v.ruleId === 'SR-07-rooftop-topmost');
    expect(violations).toEqual([]);
  });
});

describe('smartRuleValidator', () => {
  beforeEach(() => { resetStore(); });

  it('VAL-1: clean two_story design has no violations', () => {
    useStore.getState().placeModelHome('two_story');
    const violations = validateSmartRules(useStore.getState().containers);
    expect(violations).toEqual([]);
  });

  it('VAL-2: manually bolting Deck_Wood onto a non-topmost container fires SR-07', () => {
    const ids = useStore.getState().placeModelHome('two_story');
    const ground = ids[0];
    // Paint Deck_Wood onto the ground (non-topmost) container's top-level roof — a violation.
    useStore.getState().setVoxelFace(ground, TOP_LEVEL_BASE + 1 * VOXEL_COLS + 1, 'top', 'Deck_Wood');
    const violations = validateSmartRules(useStore.getState().containers);
    expect(violations.some((v) => v.ruleId === 'SR-07-rooftop-topmost')).toBe(true);
  });
});
