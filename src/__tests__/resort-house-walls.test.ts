/**
 * Resort House — perimeter-wall regression test.
 *
 * Bruce 2026-05-06 round-4: after multiple attempts at the resort_house
 * preset, walkthrough mode renders the building as "a flat steel roof
 * on stilts" — the exterior perimeter walls are missing. Playwright
 * voxel inspection isolated the cause to placeModelHome's stacking
 * flow stripping level-0 halo voxel activations on bottom containers
 * AFTER applyContainerArrangement has set them.
 *
 * THIS TEST IS THE FAILING ORACLE for the bug. It must turn RED on
 * the current master, GREEN once the stacking-strips-walls bug is
 * fixed at root. No subsequent attempt is "fixed" until vitest passes
 * this test alongside the existing 1116-test suite.
 *
 * Why voxel 8: the L1 NW container of resort_house is at world
 * relativePosition (-12.19, 0, -1.22). Voxel 8 = level 0, row 1,
 * col 0 — the WEST halo cell on body row 1. Under central_atrium's
 * `level0Scope: 'full_footprint'` + `perimeterWall: 'Solid_Steel'`,
 * this voxel must be active AND its west face must be Solid_Steel.
 * Voxel 0 = level 0, row 0, col 0 — the NW corner halo, also part
 * of the perimeter ring; active=true is the same invariant.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useStore } from '@/store/useStore';
import { VOXEL_COLS } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
  useStore.temporal.getState().clear();
}

describe('Resort House — perimeter wall regression (RED until placeModelHome stacking bug is fixed)', () => {
  vi.setConfig({ testTimeout: 30000 });
  beforeEach(() => { resetStore(); });

  it('L1 NW voxel 8 (west halo body row) is active with Solid_Steel west face after placeModelHome + cleanupDesign', () => {
    const ids = useStore.getState().placeModelHome('resort_house');
    expect(ids.length).toBeGreaterThanOrEqual(19);

    // The live dev-server reproduction loop calls cleanupDesign() after
    // placeModelHome (UserLibrary `replaceWithModelHome` -> share-import
    // path -> normalizeDesign cascade). vitest tests that omit this step
    // pass GREEN, but the in-browser experience is a wall-less pavilion.
    // Simulating cleanupDesign here forces the test to exercise the SAME
    // code path the user actually sees.
    useStore.getState().cleanupDesign?.();

    // CRITICAL: scheduleAdjacency() at the end of placeModelHome fires
    // inside requestAnimationFrame(), which vitest's environment never
    // executes. The browser DOES execute it, and refreshAdjacency() is
    // where shared walls get auto-melted to 'Open'. Drive it manually
    // here so the test exercises the same end-state the user observes.
    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    // L1 NW position (-12.19, 0, -1.22) per current preset.
    const l1nw = Object.values(containers).find(
      (c) =>
        c.level === 0 &&
        Math.abs(c.position.x - -12.19) < 0.05 &&
        Math.abs(c.position.z - -1.22) < 0.05 &&
        !c.subterranean,
    );
    expect(l1nw, 'L1 NW container at (-12.19, 0, -1.22) must exist').toBeDefined();
    const grid = l1nw!.voxelGrid;
    expect(grid, 'L1 NW container must have a voxelGrid').toBeDefined();

    // Voxel 8 = level 0, row 1, col 0 → west halo on body row 1.
    // VOXEL_COLS = 8 (verify), so 1*8 + 0 = 8.
    expect(VOXEL_COLS).toBe(8);
    const v8 = grid![8];
    expect(v8, 'voxelGrid[8] must exist').toBeDefined();

    // INVARIANT 1: extension halo cell must be active after central_atrium
    // applies (full_footprint scope). placeModelHome's stacking flow
    // currently flips this to false — that is the bug under test.
    expect(
      v8.active,
      "L1 NW voxel 8 (west halo body row) must be active after placeModelHome — central_atrium full_footprint should activate the extension halo. " +
        "If this assertion fails, placeModelHome's stacking flow (stackContainer side effects, scheduleAdjacency, or smart-rule cleanup cascade) is wiping the halo activation that applyContainerArrangement just set.",
    ).toBe(true);

    // INVARIANT 2: west face must be the perimeterWall surface from the
    // arrangement currently used by resort_house's L1. Originally
    // 'central_atrium' (Solid_Steel); switched to 'framed_glass_atrium'
    // (Window_Standard) on 2026-05-07 for the all-glass perimeter look.
    // What this assertion really protects: the perimeter face must be a
    // SOLID arrangement-defined surface (not 'Open'). Open here means the
    // perimeter wall data was either never set or was wiped by a
    // subsequent pass.
    expect(
      ['Window_Standard', 'Solid_Steel'],
      `L1 NW voxel 8 west face must be a solid perimeter surface (Window_Standard from framed_glass_atrium, or Solid_Steel from central_atrium). Got: ${v8.faces.w}. Open or any other value indicates the perimeter wall was never set or was wiped.`,
    ).toContain(v8.faces.w);
  });

  it('L1 NW voxel 0 (NW corner halo) is active after placeModelHome', () => {
    useStore.getState().placeModelHome('resort_house');
    const containers = useStore.getState().containers;
    const l1nw = Object.values(containers).find(
      (c) =>
        c.level === 0 &&
        Math.abs(c.position.x - -12.19) < 0.05 &&
        Math.abs(c.position.z - -1.22) < 0.05 &&
        !c.subterranean,
    );
    expect(l1nw).toBeDefined();
    const v0 = l1nw!.voxelGrid![0];
    expect(v0).toBeDefined();
    expect(
      v0.active,
      'L1 NW voxel 0 (NW corner halo) must be active after placeModelHome — same full_footprint invariant.',
    ).toBe(true);
  });

  it('L1 NW north face has at least 4 perimeter-wall voxels (north perimeter ring intact)', () => {
    useStore.getState().placeModelHome('resort_house');
    const containers = useStore.getState().containers;
    const l1nw = Object.values(containers).find(
      (c) =>
        c.level === 0 &&
        Math.abs(c.position.x - -12.19) < 0.05 &&
        Math.abs(c.position.z - -1.22) < 0.05 &&
        !c.subterranean,
    );
    expect(l1nw).toBeDefined();
    const grid = l1nw!.voxelGrid!;
    let perimWallCount = 0;
    for (const v of grid) {
      // Either Solid_Steel (central_atrium) or Window_Standard
      // (framed_glass_atrium) constitutes a valid perimeter wall. 'Open'
      // means the wall is missing -- the failure mode under test.
      if (v?.faces?.n === 'Solid_Steel' || v?.faces?.n === 'Window_Standard') perimWallCount++;
    }
    // The L1 arrangement (framed_glass_atrium since 2026-05-07) puts
    // perimeterWall on row=0 voxels' n-face, ~8 cells per container across
    // both voxel-levels. Allow tolerance for adjacency-merging with N-mid
    // neighbour: -2 cells max.
    expect(
      perimWallCount,
      `L1 NW north face must have >= 4 perimeter-wall voxels (got ${perimWallCount}). ` +
        'Counts near zero indicate the wall was never written or was wiped after arrangement.',
    ).toBeGreaterThanOrEqual(4);
  });
});
