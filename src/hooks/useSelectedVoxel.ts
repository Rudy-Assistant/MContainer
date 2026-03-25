import { useStore } from '@/store/useStore';
import type { VoxelPayload } from '@/store/useStore';

function deriveVoxel(sel: { type: string; items: Array<{ containerId: string; id: string }> } | null): VoxelPayload | null {
  if (!sel || sel.type !== 'voxel' || sel.items.length !== 1) return null;
  const item = sel.items[0];
  // Support extension voxels encoded as "ext_col_row"
  if (item.id.startsWith('ext_')) {
    const parts = item.id.split('_');
    const col = parseInt(parts[1]);
    const row = parseInt(parts[2]);
    if (isNaN(col) || isNaN(row)) return null;
    return { containerId: item.containerId, isExtension: true as const, col, row };
  }
  const index = parseInt(item.id);
  if (isNaN(index)) return null;
  return { containerId: item.containerId, index };
}

/** Derives legacy selectedVoxel shape from selectedElements */
export function useSelectedVoxel(): VoxelPayload | null {
  return useStore((s) => deriveVoxel(s.selectedElements));
}

/**
 * Non-hook version for use in callbacks, event handlers, and store slices.
 * Reads directly from store state (no React subscription).
 */
export function getSelectedVoxel(): VoxelPayload | null {
  return deriveVoxel(useStore.getState().selectedElements);
}
