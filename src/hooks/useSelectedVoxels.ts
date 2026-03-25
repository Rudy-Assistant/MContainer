import { useRef } from 'react';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';

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
 * Uses useShallow for stable subscription, derives in component body.
 */
export function useSelectedVoxels(): { containerId: string; indices: number[] } | null {
  const selectedElements = useStore(useShallow((s: any) => s.selectedElements));
  const prevRef = useRef<{ containerId: string; indices: number[] } | null>(null);
  const next = deriveVoxels(selectedElements);
  if (voxelsEqual(next, prevRef.current)) return prevRef.current!;
  prevRef.current = next;
  return next;
}

/**
 * Non-hook version for use in callbacks, event handlers, and store slices.
 */
export function getSelectedVoxels(): { containerId: string; indices: number[] } | null {
  return deriveVoxels(useStore.getState().selectedElements);
}
