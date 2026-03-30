import { describe, it, expect } from 'vitest';
import { validateStaircasePlacement } from '@/utils/staircaseValidation';
import { createDefaultVoxelGrid } from '@/types/factories';
import { VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

/** Helper: index from row + col (level 0). */
const idx = (row: number, col: number) => row * VOXEL_COLS + col;

describe('validateStaircasePlacement', () => {
  const grid = createDefaultVoxelGrid();

  // ── Top / Bottom faces rejected ──────────────────────────────
  it('rejects top face', () => {
    const r = validateStaircasePlacement(grid, idx(1, 3), 'top');
    expect(r.valid).toBe(false);
  });

  it('rejects bottom face', () => {
    const r = validateStaircasePlacement(grid, idx(1, 3), 'bottom');
    expect(r.valid).toBe(false);
  });

  // ── Extension voxels rejected ────────────────────────────────
  it('rejects extension voxel at row 0', () => {
    const r = validateStaircasePlacement(grid, idx(0, 3), 'n');
    expect(r.valid).toBe(false);
    expect(r.row).toBe(0);
  });

  it('rejects extension voxel at row VOXEL_ROWS-1', () => {
    const r = validateStaircasePlacement(grid, idx(VOXEL_ROWS - 1, 3), 's');
    expect(r.valid).toBe(false);
    expect(r.row).toBe(VOXEL_ROWS - 1);
  });

  it('rejects extension voxel at col 0', () => {
    const r = validateStaircasePlacement(grid, idx(1, 0), 'w');
    expect(r.valid).toBe(false);
    expect(r.col).toBe(0);
  });

  it('rejects extension voxel at col VOXEL_COLS-1', () => {
    const r = validateStaircasePlacement(grid, idx(1, VOXEL_COLS - 1), 'e');
    expect(r.valid).toBe(false);
    expect(r.col).toBe(VOXEL_COLS - 1);
  });

  // ── Valid interior placements (all 4 wall faces) ─────────────
  it('valid placement facing north (ascending south)', () => {
    // row 1, col 3 — ascending s means upperRow = row+1 = 2 (still body)
    const r = validateStaircasePlacement(grid, idx(1, 3), 'n');
    expect(r.valid).toBe(true);
    expect(r.ascending).toBe('s');
    expect(r.row).toBe(1);
    expect(r.col).toBe(3);
    expect(r.upperRow).toBe(2);
    expect(r.upperCol).toBe(3);
    expect(r.upperIdx).toBe(idx(2, 3));
  });

  it('valid placement facing south (ascending north)', () => {
    // row 2, col 3 — ascending n means upperRow = row-1 = 1 (still body)
    const r = validateStaircasePlacement(grid, idx(2, 3), 's');
    expect(r.valid).toBe(true);
    expect(r.ascending).toBe('n');
    expect(r.upperRow).toBe(1);
    expect(r.upperCol).toBe(3);
  });

  it('valid placement facing east (ascending west)', () => {
    // row 1, col 3 — ascending w means upperCol = col+1 = 4 (still body)
    const r = validateStaircasePlacement(grid, idx(1, 3), 'e');
    expect(r.valid).toBe(true);
    expect(r.ascending).toBe('w');
    expect(r.upperRow).toBe(1);
    expect(r.upperCol).toBe(4);
    expect(r.upperIdx).toBe(idx(1, 4));
  });

  it('valid placement facing west (ascending east)', () => {
    // row 1, col 3 — ascending e means upperCol = col-1 = 2 (still body)
    const r = validateStaircasePlacement(grid, idx(1, 3), 'w');
    expect(r.valid).toBe(true);
    expect(r.ascending).toBe('e');
    expect(r.upperCol).toBe(2);
    expect(r.upperIdx).toBe(idx(1, 2));
  });

  // ── Upper voxel out of body zone ─────────────────────────────
  it('rejects when upper voxel would be in extension row 0 (ascending north)', () => {
    // row 1, face 's' → ascending 'n' → dr=-1 → upperRow = 0 (extension)
    const r = validateStaircasePlacement(grid, idx(1, 3), 's');
    expect(r.valid).toBe(false);
    expect(r.ascending).toBe('n');
  });

  it('rejects when upper voxel lands in extension col (ascending east from col 1)', () => {
    // col 1, face 'w' → ascending 'e' → dc=-1 → upperCol = 1-1 = 0 → extension
    const r = validateStaircasePlacement(grid, idx(1, 1), 'w');
    expect(r.valid).toBe(false);
    expect(r.ascending).toBe('e');
  });

  it('rejects when upper voxel lands in extension row (ascending south from row 2)', () => {
    // row 2, face 'n' → ascending 's' → dr=+1 → upperRow = 3 → extension
    const r = validateStaircasePlacement(grid, idx(2, 3), 'n');
    expect(r.valid).toBe(false);
    expect(r.ascending).toBe('s');
  });

  it('rejects when upper voxel lands in extension col (ascending west from col 6)', () => {
    // col 6, face 'e' → ascending 'w' → dc=+1 → upperCol = 7 → extension
    const r = validateStaircasePlacement(grid, idx(1, 6), 'e');
    expect(r.valid).toBe(false);
    expect(r.ascending).toBe('w');
  });

  // ── Undefined grid ──────────────────────────────────────────
  it('rejects when grid is undefined', () => {
    const r = validateStaircasePlacement(undefined, idx(1, 3), 'n');
    expect(r.valid).toBe(false);
  });

  // ── Inactive voxel ──────────────────────────────────────────
  it('rejects when voxel is inactive', () => {
    const inactiveGrid = createDefaultVoxelGrid();
    inactiveGrid[idx(1, 3)] = { ...inactiveGrid[idx(1, 3)], active: false };
    const r = validateStaircasePlacement(inactiveGrid, idx(1, 3), 'n');
    expect(r.valid).toBe(false);
  });

  // ── Already stairs ──────────────────────────────────────────
  it('rejects when voxel is already stairs', () => {
    const stairGrid = createDefaultVoxelGrid();
    stairGrid[idx(1, 3)] = { ...stairGrid[idx(1, 3)], voxelType: 'stairs' } as any;
    const r = validateStaircasePlacement(stairGrid, idx(1, 3), 'n');
    expect(r.valid).toBe(false);
  });
});
