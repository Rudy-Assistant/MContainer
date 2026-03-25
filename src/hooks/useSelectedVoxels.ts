import { useStore } from '@/store/useStore';

/** Derives legacy selectedVoxels shape from selectedElements */
export function useSelectedVoxels(): { containerId: string; indices: number[] } | null {
  return useStore((s) => {
    const sel = s.selectedElements;
    if (!sel) return null;
    if (sel.type !== 'bay' && sel.type !== 'voxel') return null;
    const containerId = sel.items[0]?.containerId ?? '';
    const indices = sel.items.map(i => parseInt(i.id)).filter(n => !isNaN(n));
    if (indices.length === 0) return null;
    return { containerId, indices };
  });
}

/**
 * Non-hook version for use in callbacks, event handlers, and store slices.
 * Reads directly from store state (no React subscription).
 */
export function getSelectedVoxels(): { containerId: string; indices: number[] } | null {
  const sel = useStore.getState().selectedElements;
  if (!sel) return null;
  if (sel.type !== 'bay' && sel.type !== 'voxel') return null;
  const containerId = sel.items[0]?.containerId ?? '';
  const indices = sel.items.map(i => parseInt(i.id)).filter(n => !isNaN(n));
  if (indices.length === 0) return null;
  return { containerId, indices };
}
