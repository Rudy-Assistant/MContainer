/**
 * stack-side-effects.test.ts
 *
 * Behavioral tests for two bugs found 2026-04-30 when stacking a freshly-added
 * default container onto a Glass Box (or any preset).
 *
 * BUG 1 — Glass Box outer perimeter shows interior walls on one end
 *   When the bottom container has an appliedPreset (e.g. 'largest_glass'),
 *   stacking a fresh container on top leaves the top's body voxels with
 *   default Solid_Steel walls — visible behind the bottom's transparent
 *   glass perimeter. Fix: extend the bottom's arrangement upward to the top
 *   so its body voxels match the preset's body geometry (all-Open for Glass
 *   Box) instead of default steel.
 *
 * BUG 2 — Mass voxel animations on stack
 *   stackContainer auto-calls generateRooftopDeck on the new top, which
 *   internally calls setAllExtensions(... 'all_deck' ...) and sets
 *   unpackPhase='wall_to_floor' on every halo voxel of both levels — up to
 *   40 voxels animating simultaneously as a SIDE EFFECT of stacking, not as
 *   a user-initiated extension deploy. Fix: side-effect callers pass an
 *   animate=false hint so unpackPhase is left undefined.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import {
  ContainerSize,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
} from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

const isExtension = (row: number, col: number) =>
  row === 0 || row === VOXEL_ROWS - 1 || col === 0 || col === VOXEL_COLS - 1;

function idxOf(level: number, row: number, col: number) {
  return level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col;
}

describe('stack side-effects — preset inheritance + animation gating', () => {
  beforeEach(() => resetStore());

  // ── Bug 1 ────────────────────────────────────────────────────────────────

  it("BUG1-A: stacking onto a Glass Box bottom propagates the preset to the top container's appliedPreset", () => {
    const s = useStore.getState();
    const bottomId = s.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    s.applyContainerArrangement(bottomId, 'largest_glass');

    const topId = s.addContainer(ContainerSize.HighCube40, { x: 20, y: 0, z: 0 }, 0, true);
    const ok = s.stackContainer(topId, bottomId);

    expect(ok).toBe(true);
    expect(useStore.getState().containers[topId].appliedPreset).toBe('largest_glass');
  });

  it('BUG1-B: stacking onto Glass Box leaves the top L0 body voxels with all-Open walls (no Solid_Steel walls visible inside the glass shell)', () => {
    const s = useStore.getState();
    const bottomId = s.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    s.applyContainerArrangement(bottomId, 'largest_glass');

    const topId = s.addContainer(ContainerSize.HighCube40, { x: 20, y: 0, z: 0 }, 0, true);
    s.stackContainer(topId, bottomId);

    const grid = useStore.getState().containers[topId].voxelGrid!;
    const offendingBodyVoxels: Array<{ idx: number; row: number; col: number; faces: unknown }> = [];
    for (let row = 1; row <= 2; row++) {
      for (let col = 1; col <= 6; col++) {
        const v = grid[idxOf(0, row, col)];
        if (!v) continue;
        if (
          v.faces.n === 'Solid_Steel' ||
          v.faces.s === 'Solid_Steel' ||
          v.faces.e === 'Solid_Steel' ||
          v.faces.w === 'Solid_Steel'
        ) {
          offendingBodyVoxels.push({ idx: idxOf(0, row, col), row, col, faces: v.faces });
        }
      }
    }

    expect(offendingBodyVoxels).toEqual([]);
  });

  it('BUG1-C: stacking onto a non-preset bottom leaves the top WITHOUT an appliedPreset (does not invent one)', () => {
    const s = useStore.getState();
    const bottomId = s.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    expect(useStore.getState().containers[bottomId].appliedPreset).toBeUndefined();

    const topId = s.addContainer(ContainerSize.HighCube40, { x: 20, y: 0, z: 0 }, 0, true);
    s.stackContainer(topId, bottomId);

    expect(useStore.getState().containers[topId].appliedPreset).toBeUndefined();
  });

  // ── Bug 2 ────────────────────────────────────────────────────────────────

  it('BUG2-A: stacking does NOT trigger wall_to_floor unpack animations on the top container (preset bottom)', () => {
    const s = useStore.getState();
    const bottomId = s.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    s.applyContainerArrangement(bottomId, 'largest_glass');

    const topId = s.addContainer(ContainerSize.HighCube40, { x: 20, y: 0, z: 0 }, 0, true);
    s.stackContainer(topId, bottomId);

    const grid = useStore.getState().containers[topId].voxelGrid!;
    const animating: number[] = [];
    for (let lvl = 0; lvl < VOXEL_LEVELS; lvl++) {
      for (let r = 0; r < VOXEL_ROWS; r++) {
        for (let c = 0; c < VOXEL_COLS; c++) {
          const v = grid[idxOf(lvl, r, c)];
          if (v?.unpackPhase === 'wall_to_floor') animating.push(idxOf(lvl, r, c));
        }
      }
    }

    expect(animating).toEqual([]);
  });

  it('BUG2-B (systemic): stacking does NOT trigger wall_to_floor unpack animations on the top container (non-preset bottom)', () => {
    const s = useStore.getState();
    const bottomId = s.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    // No preset applied — pure default 40HC bottom

    const topId = s.addContainer(ContainerSize.HighCube40, { x: 20, y: 0, z: 0 }, 0, true);
    s.stackContainer(topId, bottomId);

    const grid = useStore.getState().containers[topId].voxelGrid!;
    const animating: number[] = [];
    for (let lvl = 0; lvl < VOXEL_LEVELS; lvl++) {
      for (let r = 0; r < VOXEL_ROWS; r++) {
        for (let c = 0; c < VOXEL_COLS; c++) {
          const v = grid[idxOf(lvl, r, c)];
          if (v?.unpackPhase === 'wall_to_floor') animating.push(idxOf(lvl, r, c));
        }
      }
    }

    expect(animating).toEqual([]);
  });

  // ── Bug 1 corner: bottom carries a wizard preset, not an arrangement ─────

  it('BUG1-D: stacking onto a bottom that carries a wizard-preset (non-arrangement) appliedPreset must NOT throw and falls through to the rooftop deck', () => {
    const s = useStore.getState();
    const bottomId = s.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    // 'studio_apartment' is a CONTAINER_PRESET (wizard preset), not a
    // CONTAINER_ARRANGEMENT_SPEC. Both write to Container.appliedPreset, so
    // the stack dispatch must filter on arrangement-id membership before
    // calling applyContainerArrangement — otherwise the latter throws
    // `Unknown container arrangement: studio_apartment`.
    s.applyContainerPreset(bottomId, 'studio_apartment');
    const bottomPreset = useStore.getState().containers[bottomId].appliedPreset;
    expect(bottomPreset).toBe('studio_apartment');

    const topId = s.addContainer(ContainerSize.HighCube40, { x: 20, y: 0, z: 0 }, 0, true);
    expect(() => s.stackContainer(topId, bottomId)).not.toThrow();

    // Top should NOT have inherited 'studio_apartment' as its appliedPreset
    // (because that would be applying a wizard preset as an arrangement).
    const topPreset = useStore.getState().containers[topId].appliedPreset;
    expect(topPreset).not.toBe('studio_apartment');
  });

  // ── Regression guard: user-initiated setAllExtensions still animates ─────

  it("REGRESSION: a direct user-initiated setAllExtensions(id, 'all_deck') still sets unpackPhase='wall_to_floor' (default animate is true)", () => {
    const s = useStore.getState();
    const id = s.addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 }, 0, true);
    s.setAllExtensions(id, 'all_deck', true);

    const grid = useStore.getState().containers[id].voxelGrid!;
    let animatingCount = 0;
    for (let lvl = 0; lvl < VOXEL_LEVELS; lvl++) {
      for (let r = 0; r < VOXEL_ROWS; r++) {
        for (let c = 0; c < VOXEL_COLS; c++) {
          if (!isExtension(r, c)) continue;
          const v = grid[idxOf(lvl, r, c)];
          if (v?.active && v.unpackPhase === 'wall_to_floor') animatingCount++;
        }
      }
    }
    expect(animatingCount).toBeGreaterThanOrEqual(20);
  });
});
