import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState, VoxelPayload } from '@/store/useStore';
import type { SelectedElements } from '@/store/slices/selectionSlice';

function deriveVoxel(sel: SelectedElements): VoxelPayload | null {
  if (!sel || sel.type !== 'voxel' || sel.items.length !== 1) return null;
  const item = sel.items[0];
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

/**
 * Derives legacy selectedVoxel shape from selectedElements.
 * Uses useShallow to read selectedElements (stable subscription),
 * then derives in component body with ref-based dedup.
 */
export function useSelectedVoxel(): VoxelPayload | null {
  const selectedElements = useStore(useShallow((s: StoreState) => s.selectedElements));
  return useMemo(() => deriveVoxel(selectedElements), [selectedElements]);
}

/**
 * Non-hook version for use in callbacks, event handlers, and store slices.
 */
export function getSelectedVoxel(): VoxelPayload | null {
  return deriveVoxel(useStore.getState().selectedElements);
}
