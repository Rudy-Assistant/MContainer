import { useStore } from '../store/useStore';
import type { VoxelFaces } from '../types/container';
import { VOXEL_COLS } from '../types/container';
import { getBayGroupForVoxel } from '../config/bayGroups';
import type { ElementType } from '../store/slices/selectionSlice';

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

function selectionTargetEqual(a: SelectionTarget, b: SelectionTarget): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'none') return true;
  if (a.type === 'container' && b.type === 'container') return a.containerId === b.containerId;
  if (a.type === 'voxel' && b.type === 'voxel') return a.containerId === b.containerId && a.index === b.index;
  if (a.type === 'face' && b.type === 'face') return a.containerId === b.containerId && a.index === b.index && a.face === b.face;
  if (a.type === 'bay' && b.type === 'bay') {
    return a.containerId === b.containerId && a.bayId === b.bayId && a.indices.length === b.indices.length;
  }
  if (a.type === 'bay-face' && b.type === 'bay-face') {
    return a.containerId === b.containerId && a.bayId === b.bayId && a.indices.length === b.indices.length && a.face === b.face;
  }
  return false;
}

export function useSelectionTarget(): SelectionTarget {
  return (useStore as any)(
    (s: any) => deriveSelectionTarget({
      selectedElements: s.selectedElements,
      selectedFace: s.selectedFace,
      selection: s.selection,
    }),
    selectionTargetEqual
  );
}
