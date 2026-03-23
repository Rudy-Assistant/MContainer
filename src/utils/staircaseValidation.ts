/**
 * staircaseValidation.ts — Shared staircase placement validation logic.
 *
 * Used by both StaircaseGhost (hover preview) and ContainerSkin (click handler)
 * to avoid duplicating the body-voxel + upper-bounds checks.
 */

import { VOXEL_COLS, VOXEL_ROWS, type VoxelFaces } from '@/types/container';
import { STAIR_FLIP, ASCEND_DELTA } from '@/store/slices/voxelSlice';

export interface StaircaseValidation {
  valid: boolean;
  ascending?: 'n' | 's' | 'e' | 'w';
  col: number;
  row: number;
  upperRow?: number;
  upperCol?: number;
  upperIdx?: number;
}

/**
 * Validate whether a staircase can be placed at the given voxel + face.
 * Returns validation result with computed upper voxel position.
 */
export function validateStaircasePlacement(
  voxelGrid: Array<{ active: boolean; voxelType?: string; faces: VoxelFaces }> | undefined,
  voxelIndex: number,
  face: keyof VoxelFaces,
): StaircaseValidation {
  // Only wall faces (not top/bottom)
  if (face === 'top' || face === 'bottom') {
    return { valid: false, col: 0, row: 0 };
  }

  const col = voxelIndex % VOXEL_COLS;
  const row = Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);

  // Only body voxels (not extensions)
  const isExtension = row === 0 || row === VOXEL_ROWS - 1 || col === 0 || col === VOXEL_COLS - 1;
  if (isExtension) return { valid: false, col, row };

  // Check voxel is active and not already stairs
  const voxel = voxelGrid?.[voxelIndex];
  if (!voxel?.active || voxel.voxelType === 'stairs') {
    return { valid: false, col, row };
  }

  const ascending = STAIR_FLIP[face] as 'n' | 's' | 'e' | 'w';
  const delta = ASCEND_DELTA[ascending];
  if (!delta) return { valid: false, col, row };

  const upperRow = row + delta.dr;
  const upperCol = col + delta.dc;

  // Upper voxel must be within body zone
  if (upperRow < 1 || upperRow > VOXEL_ROWS - 2 || upperCol < 1 || upperCol > VOXEL_COLS - 2) {
    return { valid: false, col, row, ascending };
  }

  const upperIdx = upperRow * VOXEL_COLS + upperCol;

  return {
    valid: true,
    ascending,
    col,
    row,
    upperRow,
    upperCol,
    upperIdx,
  };
}
