import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import type { VoxelFaces } from '../types/container';
import { VOXEL_COLS } from '../types/container';
import { getBayGroupForVoxel } from '../config/bayGroups';
import type { ElementType } from '../store/slices/selectionSlice';
import type { StoreState } from '../store/useStore';

export type FaceKey = keyof VoxelFaces;

export type SelectionTarget =
  | { type: 'none' }
  | { type: 'container'; containerId: string }
  | { type: 'voxel'; containerId: string; index: number }
  | { type: 'bay'; containerId: string; indices: number[]; bayId: string }
  | { type: 'face'; containerId: string; index: number; face: FaceKey }
  | { type: 'bay-face'; containerId: string; indices: number[]; bayId: string; face: FaceKey };

export interface SelectionState {
  selectedElements: {
    type: ElementType;
    items: Array<{ containerId: string; id: string }>;
  } | null;
  selectedFace: FaceKey | null;
  selection: string[];
}

export function deriveSelectionTarget(state: SelectionState): SelectionTarget {
  const sel = state.selectedElements;

  if (sel && (sel.type === 'bay' || (sel.type === 'voxel' && sel.items.length > 1))) {
    // Bay / multi-voxel selection
    const containerId = sel.items[0]?.containerId ?? '';
    const indices = sel.items.map(it => parseInt(it.id)).filter(n => !isNaN(n));
    if (indices.length > 0) {
      const bayId = getBayGroupForVoxel(indices[0])?.id ?? 'custom';
      if (state.selectedFace) {
        return { type: 'bay-face', containerId, indices, bayId, face: state.selectedFace };
      }
      return { type: 'bay', containerId, indices, bayId };
    }
  }

  if (sel && sel.type === 'voxel' && sel.items.length === 1) {
    const item = sel.items[0];
    const containerId = item.containerId;
    let index: number;
    if (item.id.startsWith('ext_')) {
      const parts = item.id.split('_');
      const col = parseInt(parts[1]);
      const row = parseInt(parts[2]);
      index = row * VOXEL_COLS + col;
    } else {
      index = parseInt(item.id);
      if (isNaN(index)) return { type: 'none' };
    }
    if (state.selectedFace) {
      return { type: 'face', containerId, index, face: state.selectedFace };
    }
    return { type: 'voxel', containerId, index };
  }

  if (state.selection.length > 0) {
    return { type: 'container', containerId: state.selection[0] };
  }

  return { type: 'none' };
}

/**
 * Derives SelectionTarget from store state.
 * Uses useShallow for stable subscription to the 3 store fields,
 * then derives + dedup in component body (not inside selector).
 */
export function useSelectionTarget(): SelectionTarget {
  const { selectedElements, selectedFace, selection } = useStore(
    useShallow((s: StoreState) => ({
      selectedElements: s.selectedElements,
      selectedFace: s.selectedFace,
      selection: s.selection,
    }))
  );
  return useMemo(
    () => deriveSelectionTarget({ selectedElements, selectedFace, selection }),
    [selectedElements, selectedFace, selection],
  );
}
