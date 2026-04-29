import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '@/store/useStore';
import { ContainerSize, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

beforeEach(() => {
  const initial = useStore.getInitialState();
  useStore.setState(initial, true);
});

function addTestContainer(): string {
  const before = Object.keys(useStore.getState().containers);
  useStore.getState().addContainer(ContainerSize.Standard40, { x: 0, y: 0, z: 0 }, 0, true);
  const after = Object.keys(useStore.getState().containers);
  return after.find((id) => !before.includes(id))!;
}

function idx(row: number, col: number, level = 0): number {
  return level * VOXEL_ROWS * VOXEL_COLS + row * VOXEL_COLS + col;
}

describe('container arrangements', () => {
  it('max_closed activates the full footprint with open interior seams', () => {
    const id = addTestContainer();
    useStore.getState().applyContainerArrangement(id, 'max_closed');
    const grid = useStore.getState().containers[id].voxelGrid!;

    expect(grid.filter((voxel) => voxel.active)).toHaveLength(64);
    expect(grid[idx(1, 1)].faces.top).toBe('Solid_Steel');
    expect(grid[idx(1, 1)].faces.w).toBe('Open');
    expect(grid[idx(1, 1)].faces.e).toBe('Open');
    expect(grid[idx(0, 1)].faces.n).toBe('Solid_Steel');
    expect(grid[idx(3, 6)].faces.s).toBe('Solid_Steel');
    expect(grid[idx(1, 1, 1)].faces.top).toBe('Solid_Steel');
  });

  it('largest_glass uses glass on exterior footprint walls', () => {
    const id = addTestContainer();
    useStore.getState().applyContainerArrangement(id, 'largest_glass');
    const grid = useStore.getState().containers[id].voxelGrid!;

    expect(grid[idx(0, 1)].faces.n).toBe('Glass_Pane');
    expect(grid[idx(0, 1)].faces.top).toBe('Solid_Steel');
    expect(grid[idx(3, 6)].faces.s).toBe('Glass_Pane');
    expect(grid[idx(1, 1)].faces.n).toBe('Open');
  });

  it('wraparound_patio activates only floor-level extensions with open sky', () => {
    const id = addTestContainer();
    useStore.getState().applyContainerArrangement(id, 'wraparound_patio');
    const grid = useStore.getState().containers[id].voxelGrid!;

    expect(grid[idx(0, 1)].active).toBe(true);
    expect(grid[idx(0, 1)].faces.top).toBe('Open');
    expect(grid[idx(0, 1)].faces.bottom).toBe('Deck_Wood');
    expect(grid[idx(0, 1)].faces.n).toBe('Railing_Cable');
    expect(grid[idx(0, 1, 1)].active).toBe(false);
    expect(grid[idx(1, 1)].faces.n).toBe('Solid_Steel');
  });

  it('central_atrium opens a shared upper-floor void and guards its perimeter', () => {
    const id = addTestContainer();
    useStore.getState().applyContainerArrangement(id, 'central_atrium');
    const grid = useStore.getState().containers[id].voxelGrid!;

    expect(grid.filter((voxel) => voxel.active)).toHaveLength(64);
    expect(grid[idx(1, 3)].faces.top).toBe('Open');
    expect(grid[idx(2, 4)].faces.top).toBe('Open');
    expect(grid[idx(1, 3, 1)].faces.bottom).toBe('Open');
    expect(grid[idx(2, 4, 1)].faces.bottom).toBe('Open');
    expect(grid[idx(1, 3, 1)].faces.n).toBe('Railing_Cable');
    expect(grid[idx(1, 3, 1)].faces.e).toBe('Open');
    expect(grid[idx(1, 3, 1)].faces.w).toBe('Railing_Cable');
    expect(grid[idx(2, 4, 1)].faces.s).toBe('Railing_Cable');
    expect(grid[idx(2, 4, 1)].faces.w).toBe('Open');
  });

  it('glass_atrium produces a single-volume pavilion with a glazed perimeter, glass skylight, and operable sliding-door pair', () => {
    const id = addTestContainer();
    useStore.getState().applyContainerArrangement(id, 'glass_atrium');
    const grid = useStore.getState().containers[id].voxelGrid!;

    // Perimeter is glazed.
    expect(grid[idx(0, 1)].faces.n).toBe('Glass_Pane');
    expect(grid[idx(3, 6)].faces.s).toBe('Glass_Pane');
    // Atrium void cells now render as glass skylight rather than a literal
    // hole (was 'Open' before 2026-04-25 — that produced an open-ceiling
    // pavilion that wasn't habitable; the user wanted a glass roof).
    expect(grid[idx(1, 3)].faces.top).toBe('Glass_Pane');
    // Two adjacent south-wall cells (cols 3 + 4) are sliding-glass doors —
    // operable as a pair. Surrounding cells stay regular Glass_Pane.
    expect(grid[idx(3, 3)].faces.s).toBe('Glass_Shoji');
    expect(grid[idx(3, 4)].faces.s).toBe('Glass_Shoji');
    // Upper level is fully removed: voxels are inactive, faces collapse to Open.
    // Previously these were Solid_Steel shell cells with Railing_Cable around the
    // void, which produced a confusing "two-shell" look on stacked containers.
    expect(grid[idx(1, 3, 1)].active).toBe(false);
    expect(grid[idx(1, 1, 1)].active).toBe(false);
  });

  it('roof_terrace creates an enclosed lower shell and upper extension terrace ring', () => {
    const id = addTestContainer();
    useStore.getState().applyContainerArrangement(id, 'roof_terrace');
    const grid = useStore.getState().containers[id].voxelGrid!;

    expect(grid[idx(1, 1)].faces.top).toBe('Solid_Steel');
    expect(grid[idx(1, 1, 1)].active).toBe(false);
    expect(grid[idx(0, 1, 1)].active).toBe(true);
    expect(grid[idx(0, 1, 1)].faces.top).toBe('Open');
    expect(grid[idx(0, 1, 1)].faces.bottom).toBe('Deck_Wood');
    expect(grid[idx(0, 1, 1)].faces.n).toBe('Railing_Cable');
  });
});
