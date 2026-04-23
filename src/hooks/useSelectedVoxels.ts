import { useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import type { StoreState } from '@/store/useStore';
import type { SelectedElements } from '@/store/slices/selectionSlice';

function deriveVoxels(sel: SelectedElements): { containerId: string; indices: number[] } | null {
  if (!sel) return null;
  if (sel.type !== 'bay') return null;
  const containerId = sel.items[0]?.containerId ?? '';
  const indices = sel.items.map(i => parseInt(i.id)).filter(n => !isNaN(n));
  if (indices.length === 0) return null;
  return { containerId, indices };
}

/**
 * Derives legacy selectedVoxels shape from selectedElements (bay type only).
 * Uses useShallow for stable subscription, derives in component body.
 */
export function useSelectedVoxels(): { containerId: string; indices: number[] } | null {
  const selectedElements = useStore(useShallow((s: StoreState) => s.selectedElements));
  return useMemo(() => deriveVoxels(selectedElements), [selectedElements]);
}

/**
 * Non-hook version for use in callbacks, event handlers, and store slices.
 */
export function getSelectedVoxels(): { containerId: string; indices: number[] } | null {
  return deriveVoxels(useStore.getState().selectedElements);
}
