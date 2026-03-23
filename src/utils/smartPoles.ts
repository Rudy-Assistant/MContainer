/**
 * smartPoles.ts — Smart Corner Pole Placement Algorithm
 *
 * Computes pole positions at every 90° corner of a roof boundary.
 * A "roofed" voxel has top !== 'Open' and is active.
 * Out-of-bounds cells count as "unroofed".
 * A pole is placed at a vertex when exactly 1 or 3 of the 4 surrounding voxels are roofed.
 * This captures both convex (1 roofed) and concave (3 roofed) corners.
 *
 * Pure function — no React/store dependencies. Testable in isolation.
 */

import { type Voxel, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

export interface PolePosition {
  /** Grid row of the "anchor" voxel (the roofed voxel at a convex corner, or the unroofed gap at a concave corner) */
  row: number;
  /** Grid column of the anchor voxel */
  col: number;
  /** Which corner of the vertex: ne, nw, se, sw */
  corner: 'ne' | 'nw' | 'se' | 'sw';
  /** World-space X position */
  px: number;
  /** World-space Z position */
  pz: number;
}

/** Callback to compute world-space vertex position from grid vertex coordinates */
export type VertexPositionResolver = (vr: number, vc: number) => { px: number; pz: number };

/** Check if a voxel at (row, col) is "roofed" — active with a ceiling (top !== 'Open') */
function isRoofed(grid: Voxel[], row: number, col: number): boolean {
  if (row < 0 || row >= VOXEL_ROWS || col < 0 || col >= VOXEL_COLS) return false;
  const v = grid[row * VOXEL_COLS + col];
  return v?.active === true && v.faces.top !== 'Open';
}

/**
 * Default uniform vertex position resolver.
 * Used by tests and as fallback when no layout callback is provided.
 */
function uniformResolver(
  voxelWidth: number,
  voxelDepth: number,
  gridOffsetX: number,
  gridOffsetZ: number,
): VertexPositionResolver {
  return (vr: number, vc: number) => ({
    px: gridOffsetX + vc * voxelWidth,
    pz: gridOffsetZ + vr * voxelDepth,
  });
}

/**
 * Compute all pole positions for a voxel grid.
 *
 * Iterates over every interior vertex in the grid (including boundary vertices).
 * A vertex at (vr, vc) is shared by up to 4 voxels:
 *   top-left: (vr-1, vc-1), top-right: (vr-1, vc), bottom-left: (vr, vc-1), bottom-right: (vr, vc)
 *
 * Grid vertices range from (0,0) to (VOXEL_ROWS, VOXEL_COLS) — one more than voxel count in each direction.
 *
 * @param grid - Flat voxel array (VOXEL_ROWS * VOXEL_COLS elements for level 0)
 * @param voxelWidth - Width of a single voxel in world units (default from standard container)
 * @param voxelDepth - Depth of a single voxel in world units
 * @param gridOffsetX - World-space X offset of the grid origin
 * @param gridOffsetZ - World-space Z offset of the grid origin
 * @param resolver - Optional callback to compute vertex world positions from grid coords
 */
export function computePolePositions(
  grid: Voxel[],
  voxelWidth: number = 1.5,
  voxelDepth: number = 0.6,
  gridOffsetX: number = 0,
  gridOffsetZ: number = 0,
  resolver?: VertexPositionResolver,
): PolePosition[] {
  const positions: PolePosition[] = [];
  const posSet = new Set<string>();
  const getPos = resolver ?? uniformResolver(voxelWidth, voxelDepth, gridOffsetX, gridOffsetZ);

  // Iterate over all vertices in the grid.
  // Vertex (vr, vc) is at the corner where 4 voxels meet.
  // The 4 surrounding voxels are at (vr-1, vc-1), (vr-1, vc), (vr, vc-1), (vr, vc).
  for (let vr = 0; vr <= VOXEL_ROWS; vr++) {
    for (let vc = 0; vc <= VOXEL_COLS; vc++) {
      // Count how many of the 4 surrounding voxels are roofed
      const tl = isRoofed(grid, vr - 1, vc - 1); // top-left
      const tr = isRoofed(grid, vr - 1, vc);     // top-right
      const bl = isRoofed(grid, vr, vc - 1);     // bottom-left
      const br = isRoofed(grid, vr, vc);          // bottom-right

      const count = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);

      // Pole at 90° corners: exactly 1 roofed (convex) or exactly 3 roofed (concave)
      if (count !== 1 && count !== 3) continue;

      // World position of this vertex
      const { px, pz } = getPos(vr, vc);

      const key = `${px.toFixed(4)}_${pz.toFixed(4)}`;
      if (posSet.has(key)) continue;
      posSet.add(key);

      // Determine which voxel "owns" this corner for the key.
      // Use the roofed voxel closest to the vertex for naming.
      // For convex (count=1): the single roofed voxel
      // For concave (count=3): the single UNroofed voxel's position marks the concave elbow
      let anchorRow: number;
      let anchorCol: number;
      let corner: 'ne' | 'nw' | 'se' | 'sw';

      if (count === 1) {
        // Convex: the one roofed voxel
        if (tl) { anchorRow = vr - 1; anchorCol = vc - 1; corner = 'se'; }
        else if (tr) { anchorRow = vr - 1; anchorCol = vc; corner = 'sw'; }
        else if (bl) { anchorRow = vr; anchorCol = vc - 1; corner = 'ne'; }
        else { anchorRow = vr; anchorCol = vc; corner = 'nw'; }
      } else {
        // Concave (count=3): the one UNroofed voxel marks the concave corner
        // The pole is at the corner of the 3 roofed voxels facing the gap
        if (!tl) { anchorRow = vr - 1; anchorCol = vc; corner = 'sw'; }
        else if (!tr) { anchorRow = vr - 1; anchorCol = vc - 1; corner = 'se'; }
        else if (!bl) { anchorRow = vr; anchorCol = vc; corner = 'nw'; }
        else { anchorRow = vr; anchorCol = vc - 1; corner = 'ne'; }
      }

      positions.push({ row: anchorRow, col: anchorCol, corner, px, pz });
    }
  }

  return positions;
}
