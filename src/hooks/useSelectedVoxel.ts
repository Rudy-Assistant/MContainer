import { useRef } from 'react';
import { useStore } from '@/store/useStore';
import type { VoxelPayload } from '@/store/useStore';

function deriveVoxel(sel: { type: string; items: Array<{ containerId: string; id: string }> } | null): VoxelPayload | null {
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

function voxelEqual(a: VoxelPayload | null, b: VoxelPayload | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.containerId !== b.containerId) return false;
  if ('index' in a && 'index' in b) return a.index === b.index;
  if ('isExtension' in a && 'isExtension' in b) return (a as any).col === (b as any).col && (a as any).row === (b as any).row;
  return false;
}

/** Derives legacy selectedVoxel shape from selectedElements (referentially stable) */
export function useSelectedVoxel(): VoxelPayload | null {
  const prevRef = useRef<VoxelPayload | null>(null);

  return useStore((s) => {
    const next = deriveVoxel(s.selectedElements);
    if (voxelEqual(next, prevRef.current)) return prevRef.current;
    prevRef.current = next;
    return next;
  });
}

/**
 * Non-hook version for use in callbacks, event handlers, and store slices.
 * Reads directly from store state (no React subscription).
 */
export function getSelectedVoxel(): VoxelPayload | null {
  return deriveVoxel(useStore.getState().selectedElements);
}
