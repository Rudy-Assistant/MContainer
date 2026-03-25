import { useRef } from 'react';
import { useStore } from '@/store/useStore';

function deriveVoxels(sel: { type: string; items: Array<{ containerId: string; id: string }> } | null): { containerId: string; indices: number[] } | null {
  if (!sel) return null;
  if (sel.type !== 'bay' && sel.type !== 'voxel') return null;
  const containerId = sel.items[0]?.containerId ?? '';
  const indices = sel.items.map(i => parseInt(i.id)).filter(n => !isNaN(n));
  if (indices.length === 0) return null;
  return { containerId, indices };
}

/** Derives legacy selectedVoxels shape from selectedElements (referentially stable) */
export function useSelectedVoxels(): { containerId: string; indices: number[] } | null {
  const prevRef = useRef<{ containerId: string; indices: number[] } | null>(null);

  return useStore((s) => {
    const next = deriveVoxels(s.selectedElements);
    // Return same reference if content unchanged
    if (next === null && prevRef.current === null) return null;
    if (next === null || prevRef.current === null) {
      prevRef.current = next;
      return next;
    }
    if (
      next.containerId === prevRef.current.containerId &&
      next.indices.length === prevRef.current.indices.length &&
      next.indices.every((v, i) => v === prevRef.current!.indices[i])
    ) {
      return prevRef.current;
    }
    prevRef.current = next;
    return next;
  });
}

/**
 * Non-hook version for use in callbacks, event handlers, and store slices.
 * Reads directly from store state (no React subscription).
 */
export function getSelectedVoxels(): { containerId: string; indices: number[] } | null {
  return deriveVoxels(useStore.getState().selectedElements);
}
