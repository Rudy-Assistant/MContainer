/**
 * extension-unpack.test.ts — Behavioral tests for extension unpacking animation state.
 *
 * Verifies that setAllExtensions sets/clears unpackPhase correctly,
 * and that clearUnpackPhase removes the ephemeral animation field.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import { useStore } from '@/store/useStore';
import { ContainerSize } from '@/types/container';

function resetStore() {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
}

/** Helper: get voxelGrid with non-null assertion (safe in tests after addContainer) */
function grid(id: string) {
  return useStore.getState().containers[id].voxelGrid!;
}

describe('Extension Unpack Animation State', () => {
  beforeEach(() => resetStore());

  it('setAllExtensions("all_deck") sets unpackPhase="wall_to_floor" on extension voxels', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_deck', true);

    const g = grid(id);
    // Corner extension (row 0, col 0 = index 0)
    expect(g[0].active).toBe(true);
    expect(g[0].unpackPhase).toBe('wall_to_floor');

    // Side extension (row 0, col 3 = index 3)
    expect(g[3].active).toBe(true);
    expect(g[3].unpackPhase).toBe('wall_to_floor');

    // End extension (row 1, col 0 = index 8)
    expect(g[8].active).toBe(true);
    expect(g[8].unpackPhase).toBe('wall_to_floor');

    // Body voxel should NOT have unpackPhase
    expect(g[9].unpackPhase).toBeUndefined();
  });

  it('setAllExtensions("all_interior") sets unpackPhase="wall_to_ceiling" on extension voxels', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_interior', true);

    const g = grid(id);
    expect(g[0].active).toBe(true);
    expect(g[0].unpackPhase).toBe('wall_to_ceiling');
    expect(g[0].faces.top).toBe('Solid_Steel');
  });

  it('setAllExtensions("none") clears unpackPhase on deactivated extensions', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_deck', true);

    // Verify phase is set
    expect(grid(id)[0].unpackPhase).toBe('wall_to_floor');

    // Deactivate all
    useStore.getState().setAllExtensions(id, 'none');

    const g = grid(id);
    expect(g[0].active).toBe(false);
    expect(g[0].unpackPhase).toBeUndefined();
  });

  it('clearUnpackPhase removes the phase from a specific voxel', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_deck', true);

    // Verify phase is set
    expect(grid(id)[0].unpackPhase).toBe('wall_to_floor');

    // Clear it (simulates animation completion)
    useStore.getState().clearUnpackPhase(id, 0);

    const g = grid(id);
    expect(g[0].active).toBe(true);
    expect(g[0].unpackPhase).toBeUndefined();
    // Other extensions should still have their phase
    expect(g[7].unpackPhase).toBe('wall_to_floor');
  });

  it('body voxels never receive unpackPhase', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_deck', true);

    const g = grid(id);
    // Body voxels: rows 1-2, cols 1-6 (indices 9-14, 17-22)
    for (const idx of [9, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21, 22]) {
      expect(g[idx].unpackPhase).toBeUndefined();
    }
  });

  it('directional deck configs only set phase on affected extensions', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'north_deck', true);

    const g = grid(id);
    // Row 0 extensions should have phase
    expect(g[0].unpackPhase).toBe('wall_to_floor');
    expect(g[3].unpackPhase).toBe('wall_to_floor');
    expect(g[7].unpackPhase).toBe('wall_to_floor');

    // Row 3 extensions should NOT be affected
    expect(g[24].active).toBe(false);
    expect(g[24].unpackPhase).toBeUndefined();
  });
});

describe('Phase Chaining (unpackAnimations)', () => {
  it('getNextPhase chains floor_slide → walls_deploy', async () => {
    const { getNextPhase } = await import('@/config/unpackAnimations');
    expect(getNextPhase('floor_slide')).toBe('walls_deploy');
  });

  it('getNextPhase returns undefined for terminal phases', async () => {
    const { getNextPhase } = await import('@/config/unpackAnimations');
    expect(getNextPhase('wall_to_floor')).toBeUndefined();
    expect(getNextPhase('wall_to_ceiling')).toBeUndefined();
    expect(getNextPhase('walls_deploy')).toBeUndefined();
    expect(getNextPhase('reverse')).toBeUndefined();
  });

  it('PHASE_DAMP_SPEED defines speeds for all phases', async () => {
    const { PHASE_DAMP_SPEED } = await import('@/config/unpackAnimations');
    expect(PHASE_DAMP_SPEED.wall_to_floor).toBeGreaterThan(0);
    expect(PHASE_DAMP_SPEED.wall_to_ceiling).toBeGreaterThan(0);
    expect(PHASE_DAMP_SPEED.floor_slide).toBeGreaterThan(0);
    expect(PHASE_DAMP_SPEED.walls_deploy).toBeGreaterThan(0);
    expect(PHASE_DAMP_SPEED.reverse).toBeGreaterThan(0);
  });
});

describe('Persistence Safety — unpackPhase stripped', () => {
  it('partialize strips unpackPhase from voxels', () => {
    const id = useStore.getState().addContainer(ContainerSize.HighCube40, { x: 0, y: 0, z: 0 });
    useStore.getState().setAllExtensions(id, 'all_deck', true);

    // Verify phase is set in live state
    expect(grid(id)[0].unpackPhase).toBe('wall_to_floor');

    // Access partialize function from persist options
    const storeOptions = (useStore as any).persist;
    // The partialize fn is on the persist API — we test via getOptions
    const opts = storeOptions?.getOptions?.();
    if (opts?.partialize) {
      const partialized = opts.partialize(useStore.getState());
      const pGrid = partialized.containers[id].voxelGrid;
      // Extension voxel should have NO unpackPhase in persisted data
      expect(pGrid[0].unpackPhase).toBeUndefined();
      // Body voxels should also have no unpackPhase (they never had one)
      expect(pGrid[9].unpackPhase).toBeUndefined();
    }
  });
});
