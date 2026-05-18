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
import { VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

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
    // U-ring layout (2026-05-17): 5 containers/level × 3 + 1 pool = 16.
    expect(ids.length).toBeGreaterThanOrEqual(16);

    useStore.getState().cleanupDesign?.();
    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    // L1 NW position (-12.19, 0, -4.0) per U-ring preset.
    const l1nw = Object.values(containers).find(
      (c) =>
        c.level === 0 &&
        Math.abs(c.position.x - -12.19) < 0.05 &&
        Math.abs(c.position.z - -4.0) < 0.05 &&
        !c.subterranean,
    );
    expect(l1nw, 'L1 NW container at (-12.19, 0, -4.0) must exist').toBeDefined();
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
        Math.abs(c.position.z - -4.0) < 0.05 &&
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
        Math.abs(c.position.z - -4.0) < 0.05 &&
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

  it('all framed_glass_atrium containers keep an open atrium shaft visible from perimeter rooms', () => {
    useStore.getState().placeModelHome('resort_house');

    // Match the user-visible end state, not just the immediate preset write.
    useStore.getState().cleanupDesign?.();
    useStore.getState().refreshAdjacency();

    const containers = Object.values(useStore.getState().containers);
    // U-ring layout (2026-05-17): 15 framed_glass_box containers (5/level × 3).
    // The atrium is the SPATIAL GAP between the N row (z=-4.0) and S row
    // (z=+4.0), not per-container void cells. Verify the gap exists by
    // confirming no perimeter container spans z = 0.
    const perimeterContainers = containers.filter(
      (c) => !c.subterranean && c.appliedPreset === 'framed_glass_box',
    );
    expect(perimeterContainers).toHaveLength(15);

    // No perimeter container should overlap the central atrium band z ∈ [-2.78, +2.78].
    // Each container body is 2.44m deep along z; centers at z=-4 or z=+4 keep
    // body bounds entirely outside [-2.78, +2.78].
    for (const c of perimeterContainers) {
      const halfWidth = 1.22; // 40HC body half-width
      const minZ = c.position.z - halfWidth;
      const maxZ = c.position.z + halfWidth;
      const overlapsAtrium = !(maxZ <= -2.78 || minZ >= 2.78);
      expect(
        overlapsAtrium,
        `${c.name} at z=${c.position.z} overlaps the central atrium band -- atrium gap is filled`,
      ).toBe(false);
    }
  });

  it('extraVoxelFaces opens atrium-facing halo on every N-row + S-row perimeter container', () => {
    useStore.getState().placeModelHome('resort_house');
    useStore.getState().cleanupDesign?.();
    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    // N row (z=-4): atrium is to +z → south halo (row 3) s-face must be 'Open'
    // S row (z=+4): atrium is to -z → north halo (row 0) n-face must be 'Open'
    const nRow = Object.values(containers).filter(
      (c) => !c.subterranean && Math.abs(c.position.z - -4.0) < 0.05,
    );
    const sRow = Object.values(containers).filter(
      (c) => !c.subterranean && Math.abs(c.position.z - 4.0) < 0.05,
    );
    expect(nRow.length, 'expected 3 N-row containers per level × 3 levels = 9').toBe(9);
    expect(sRow.length, 'expected 2 S-row containers per level × 3 levels = 6').toBe(6);

    for (const c of nRow) {
      const grid = c.voxelGrid!;
      for (let level = 0; level < 2; level++) {
        for (let col = 0; col < VOXEL_COLS; col++) {
          const idx = level * 32 + 3 * VOXEL_COLS + col; // row 3 = south halo
          expect(
            grid[idx]?.faces?.s,
            `${c.name} L${c.level} voxel ${idx} (south halo level=${level} col=${col}) s-face must be Open`,
          ).toBe('Open');
        }
      }
    }
    for (const c of sRow) {
      const grid = c.voxelGrid!;
      for (let level = 0; level < 2; level++) {
        for (let col = 0; col < VOXEL_COLS; col++) {
          const idx = level * 32 + 0 * VOXEL_COLS + col; // row 0 = north halo
          expect(
            grid[idx]?.faces?.n,
            `${c.name} L${c.level} voxel ${idx} (north halo level=${level} col=${col}) n-face must be Open`,
          ).toBe('Open');
        }
      }
    }
  });

  it('extraVoxelFaces overrides survive smart-rule cascade and design-mode toggles (regression guard)', () => {
    useStore.getState().placeModelHome('resort_house');
    useStore.getState().cleanupDesign?.();
    useStore.getState().refreshAdjacency();

    const sampleL1NW = () => {
      const containers = useStore.getState().containers;
      return Object.values(containers).find(
        (c) => c.level === 0 && Math.abs(c.position.x - -12.19) < 0.05 && Math.abs(c.position.z - -4.0) < 0.05 && !c.subterranean,
      );
    };
    const sampleL3NW = () => {
      const containers = useStore.getState().containers;
      return Object.values(containers).find(
        (c) => c.level === 2 && Math.abs(c.position.x - -12.19) < 0.05 && Math.abs(c.position.z - -4.0) < 0.05,
      );
    };

    // Baseline assertions (post-place)
    expect(sampleL1NW()?.voxelGrid?.[24]?.faces?.s).toBe('Open');  // south halo row 3 col 0
    expect(sampleL3NW()?.voxelGrid?.[56]?.faces?.top).toBe('Open'); // L3 skylight top cell

    // Run smart-rule cascade again — overrides must survive
    useStore.getState().setDesignMode?.('smart');
    useStore.getState().refreshAdjacency();
    useStore.getState().cleanupDesign?.();
    useStore.getState().refreshAdjacency();

    expect(
      sampleL1NW()?.voxelGrid?.[24]?.faces?.s,
      'atrium-facing s-face must survive smart-mode cascade — userPaintedFaces marker protects preset override',
    ).toBe('Open');
    expect(
      sampleL3NW()?.voxelGrid?.[56]?.faces?.top,
      'L3 skylight top-face must survive smart-mode cascade',
    ).toBe('Open');

    // Toggle back to manual and re-run
    useStore.getState().setDesignMode?.('manual');
    useStore.getState().refreshAdjacency();

    expect(sampleL1NW()?.voxelGrid?.[24]?.faces?.s).toBe('Open');
    expect(sampleL3NW()?.voxelGrid?.[56]?.faces?.top).toBe('Open');
  });

  it('Resort House description matches the actual U-ring 16-container layout', async () => {
    // Codex tech-debt v2 finding 2: description was 3×2 / 19 containers /
    // NW stair chain (pre-U-ring layout, deleted in d37c005). Description
    // is user-visible in the model-home picker — stale text mismatches what
    // the user gets when they click.
    const { getModelHome } = await import('@/config/modelHomes');
    const m = getModelHome('resort_house');
    expect(m, 'resort_house preset must exist').toBeDefined();
    const desc = m!.description;
    expect(desc, `description must mention 16 containers, got: ${desc}`).toMatch(/\b16\b/);
    expect(desc, `description must mention U-ring or U shape, got: ${desc}`).toMatch(/U[- ]?(ring|shape|shaped)/i);
    expect(desc, `description must mention atrium, got: ${desc}`).toMatch(/atrium/i);
    expect(desc, `description must NOT mention 19 containers, got: ${desc}`).not.toMatch(/\b19\b/);
    expect(desc, `description must NOT mention 3x2 grid, got: ${desc}`).not.toMatch(/3\s*[×x]\s*2/);
    expect(desc, `description must NOT say "NW" stair chain (now N-center), got: ${desc}`).not.toMatch(/NW\s+(stair|from ground)/i);
  });

  it('placeModelHome("resort_house") does NOT emit "Extension blocked" warning for the pool slot', async () => {
    // Codex tech-debt v2 finding 3 (LOW/MEDIUM): the auto-expand extensions
    // loop in librarySlice.placeModelHome doesn't skip mc.pool slots,
    // so pool containers hit setAllExtensions even though
    // ModelHomeContainer.pool says extension fields are ignored. Result:
    // every Resort House placement logs "Extension 'all_deck' on <id>
    // blocked: would overlap adjacent container" for the pool slot.
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map((a) => String(a)).join(' '));
    };
    try {
      useStore.getState().placeModelHome('resort_house');
    } finally {
      console.warn = originalWarn;
    }
    const blocked = warnings.filter((w) => /Extension.*blocked/.test(w));
    expect(
      blocked,
      `pool slot triggered ${blocked.length} extension-blocked warnings: ${JSON.stringify(blocked, null, 2)}`,
    ).toHaveLength(0);
  });

  it('placeModelHome("resort_house") does NOT leak preset overrides into lastStamp (space-repeat protection)', () => {
    // Bug: extraVoxelFaces apply via setVoxelFace, which writes lastStamp
    // every call. After placeModelHome, lastStamp ends up as the preset's
    // INTERNAL override (the final atrium skylight cell), so when the user
    // hits Space (useInputHandler.ts:33), the repeat-last-stamp action
    // repeats a preset-internal override instead of their last actual paint.
    // Expectation: after placeModelHome with NO prior user paint, lastStamp
    // should be null/undefined — the preset shouldn't pre-fill it.
    useStore.getState().placeModelHome('resort_house');
    useStore.getState().cleanupDesign?.();
    useStore.getState().refreshAdjacency();

    const lastStamp = useStore.getState().lastStamp;
    expect(
      lastStamp,
      `placeModelHome leaked preset override into lastStamp (got ${JSON.stringify(lastStamp)}). ` +
        'Space-repeat would now repeat a preset-internal override instead of the user\'s last paint.',
    ).toBeNull();
  });

  it('extraVoxelFaces cuts L3 atrium skylight (top=Open on L3 atrium-facing halo)', () => {
    useStore.getState().placeModelHome('resort_house');
    useStore.getState().cleanupDesign?.();
    useStore.getState().refreshAdjacency();

    const containers = useStore.getState().containers;
    // L3 N-row (level=2, z=-4): voxel level 1, row 3, cols 0..7 → top must be Open
    // L3 S-row (level=2, z=+4): voxel level 1, row 0, cols 0..7 → top must be Open
    const l3nRow = Object.values(containers).filter(
      (c) => c.level === 2 && Math.abs(c.position.z - -4.0) < 0.05,
    );
    const l3sRow = Object.values(containers).filter(
      (c) => c.level === 2 && Math.abs(c.position.z - 4.0) < 0.05,
    );
    expect(l3nRow.length).toBe(3);
    expect(l3sRow.length).toBe(2);

    for (const c of l3nRow) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        const idx = 1 * 32 + 3 * VOXEL_COLS + col;
        expect(
          c.voxelGrid![idx]?.faces?.top,
          `L3 N-row ${c.name} voxel ${idx} (skylight cell) top-face must be Open`,
        ).toBe('Open');
      }
    }
    for (const c of l3sRow) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        const idx = 1 * 32 + 0 * VOXEL_COLS + col;
        expect(
          c.voxelGrid![idx]?.faces?.top,
          `L3 S-row ${c.name} voxel ${idx} (skylight cell) top-face must be Open`,
        ).toBe('Open');
      }
    }
  });
});
