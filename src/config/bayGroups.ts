/**
 * bayGroups.ts — Bay grouping for simplified editing mode.
 *
 * Groups the 32 voxels (4 rows × 8 cols) into logical bays for the Simple view.
 * Grid layout: rows 0,3 = extension deck; rows 1,2 = body core;
 *              cols 0,7 = extension ends; cols 1-6 = body length.
 */

export interface BayGroup {
  id: string;
  label: string;
  role: 'corner' | 'extension_side' | 'extension_end' | 'body';
  voxelIndices: number[];
  /** Grid position for CSS grid layout (1-based) */
  gridRow: number;
  gridCol: number;
  rowSpan: number;
  colSpan: number;
}

/**
 * Compute bay groups for the standard 4×8 voxel grid.
 * Returns 15 groups covering all 32 voxels exactly once:
 *   - 4 corners (1 voxel each)
 *   - 6 extension side pairs (2 voxels each, along rows 0 and 3)
 *   - 2 extension end pairs (2 voxels each, cols 0 and 7)
 *   - 3 body quads (4 voxels each, the 2×2 body interior)
 */
/**
 * Reverse lookup: given a base voxel index (level-0, 0-31), return its bay group.
 * Strips level offset automatically.
 */
let _reverseMap: Map<number, BayGroup> | null = null;
export function getBayGroupForVoxel(voxelIndex: number, voxelsPerLevel = 32): BayGroup | undefined {
  if (!_reverseMap) {
    _reverseMap = new Map();
    for (const g of computeBayGroups()) {
      for (const idx of g.voxelIndices) _reverseMap.set(idx, g);
    }
  }
  const baseIdx = voxelIndex % voxelsPerLevel;
  return _reverseMap.get(baseIdx);
}

/**
 * Get level-adjusted bay group indices for a voxel. Returns null if not in Simple mode
 * or if no bay group found. Combines getBayGroupForVoxel + level-offset mapping.
 */
export function getBayIndicesForVoxel(voxelIndex: number, voxelsPerLevel = 32): number[] | null {
  const group = getBayGroupForVoxel(voxelIndex, voxelsPerLevel);
  if (!group) return null;
  const lvl = Math.floor(voxelIndex / voxelsPerLevel);
  return group.voxelIndices.map((i) => lvl * voxelsPerLevel + i);
}

export function computeBayGroups(): BayGroup[] {
  const COLS = 8;
  const idx = (row: number, col: number) => row * COLS + col;

  const groups: BayGroup[] = [];

  // 4 corners (1 voxel each)
  groups.push({ id: 'corner_nw', label: 'NW Corner', role: 'corner', voxelIndices: [idx(0, 0)], gridRow: 1, gridCol: 1, rowSpan: 1, colSpan: 1 });
  groups.push({ id: 'corner_ne', label: 'NE Corner', role: 'corner', voxelIndices: [idx(0, 7)], gridRow: 1, gridCol: 8, rowSpan: 1, colSpan: 1 });
  groups.push({ id: 'corner_sw', label: 'SW Corner', role: 'corner', voxelIndices: [idx(3, 0)], gridRow: 4, gridCol: 1, rowSpan: 1, colSpan: 1 });
  groups.push({ id: 'corner_se', label: 'SE Corner', role: 'corner', voxelIndices: [idx(3, 7)], gridRow: 4, gridCol: 8, rowSpan: 1, colSpan: 1 });

  // 6 extension side pairs (row 0 cols 1-6, row 3 cols 1-6 — 2 cols per group)
  for (let i = 0; i < 3; i++) {
    const c1 = 1 + i * 2;
    const c2 = c1 + 1;
    const deckNum = 3 - i; // 3, 2, 1 (nearest to farthest)
    groups.push({
      id: `ext_n_${i}`,
      label: `N Deck ${deckNum}`,
      role: 'extension_side',
      voxelIndices: [idx(0, c1), idx(0, c2)],
      gridRow: 1,
      gridCol: c1 + 1,
      rowSpan: 1,
      colSpan: 2,
    });
    groups.push({
      id: `ext_s_${i}`,
      label: `S Deck ${deckNum}`,
      role: 'extension_side',
      voxelIndices: [idx(3, c1), idx(3, c2)],
      gridRow: 4,
      gridCol: c1 + 1,
      rowSpan: 1,
      colSpan: 2,
    });
  }

  // 2 extension end pairs (cols 0 and 7, rows 1-2)
  groups.push({
    id: 'ext_w',
    label: 'W End',
    role: 'extension_end',
    voxelIndices: [idx(1, 0), idx(2, 0)],
    gridRow: 2,
    gridCol: 1,
    rowSpan: 2,
    colSpan: 1,
  });
  groups.push({
    id: 'ext_e',
    label: 'E End',
    role: 'extension_end',
    voxelIndices: [idx(1, 7), idx(2, 7)],
    gridRow: 2,
    gridCol: 8,
    rowSpan: 2,
    colSpan: 1,
  });

  // 3 body quads (rows 1-2, cols 1-6 — 2 cols per quad)
  for (let i = 0; i < 3; i++) {
    const c1 = 1 + i * 2;
    const c2 = c1 + 1;
    groups.push({
      id: `body_${i}`,
      label: `Bay ${i + 1}`,
      role: 'body',
      voxelIndices: [idx(1, c1), idx(1, c2), idx(2, c1), idx(2, c2)],
      gridRow: 2,
      gridCol: c1 + 1,
      rowSpan: 2,
      colSpan: 2,
    });
  }

  return groups;
}
