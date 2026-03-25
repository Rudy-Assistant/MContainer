import { useStore } from '@/store/useStore';

function deriveVoxels(sel: { type: string; items: Array<{ containerId: string; id: string }> } | null): { containerId: string; indices: number[] } | null {
  if (!sel) return null;
  if (sel.type !== 'bay') return null;
  const containerId = sel.items[0]?.containerId ?? '';
  const indices = sel.items.map(i => parseInt(i.id)).filter(n => !isNaN(n));
  if (indices.length === 0) return null;
  return { containerId, indices };
}

function voxelsEqual(
  a: { containerId: string; indices: number[] } | null,
  b: { containerId: string; indices: number[] } | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.containerId !== b.containerId) return false;
  if (a.indices.length !== b.indices.length) return false;
  return a.indices.every((v, i) => v === b.indices[i]);
}

/**
 * Derives legacy selectedVoxels shape from selectedElements (bay type only).
 * Uses Zustand's equalityFn for referential stability instead of
 * mutating a ref inside the selector.
 */
export function useSelectedVoxels(): { containerId: string; indices: number[] } | null {
  return (useStore as any)(
    (s: any) => deriveVoxels(s.selectedElements),
    voxelsEqual
  );
}

/**
 * Non-hook version for use in callbacks, event handlers, and store slices.
 * Reads directly from store state (no React subscription).
 */
export function getSelectedVoxels(): { containerId: string; indices: number[] } | null {
  return deriveVoxels(useStore.getState().selectedElements);
}
