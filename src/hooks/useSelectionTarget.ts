import { useRef } from 'react';
import { useStore } from '../store/useStore';
import type { VoxelPayload } from '../store/useStore';
import type { VoxelFaces } from '../types/container';
import { VOXEL_COLS } from '../types/container';
import { getBayGroupForVoxel } from '../config/bayGroups';

export type FaceKey = keyof VoxelFaces;

export type SelectionTarget =
  | { type: 'none' }
  | { type: 'container'; containerId: string }
  | { type: 'voxel'; containerId: string; index: number }
  | { type: 'bay'; containerId: string; indices: number[]; bayId: string }
  | { type: 'face'; containerId: string; index: number; face: FaceKey }
  | { type: 'bay-face'; containerId: string; indices: number[]; bayId: string; face: FaceKey };

export interface SelectionState {
  selectedVoxel: VoxelPayload | null;
  selectedFace: FaceKey | null;
  selectedVoxels: { containerId: string; indices: number[] } | null;
  selection: string[];
}

export function deriveSelectionTarget(state: SelectionState): SelectionTarget {
  if (state.selectedVoxels) {
    const cid = state.selectedVoxels.containerId;
    const indices = state.selectedVoxels.indices;
    const bayId = getBayGroupForVoxel(indices[0])?.id ?? 'custom';
    if (state.selectedFace) {
      return { type: 'bay-face', containerId: cid, indices, bayId, face: state.selectedFace };
    }
    return { type: 'bay', containerId: cid, indices, bayId };
  }

  if (state.selectedVoxel) {
    const sv = state.selectedVoxel;
    if (sv.isExtension) {
      const idx = sv.row * VOXEL_COLS + sv.col;
      const cid = sv.containerId;
      if (state.selectedFace) {
        return { type: 'face', containerId: cid, index: idx, face: state.selectedFace };
      }
      return { type: 'voxel', containerId: cid, index: idx };
    } else {
      const cid = sv.containerId;
      const idx = sv.index;
      if (state.selectedFace) {
        return { type: 'face', containerId: cid, index: idx, face: state.selectedFace };
      }
      return { type: 'voxel', containerId: cid, index: idx };
    }
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
  const prevRef = useRef<SelectionTarget>({ type: 'none' });

  const target = useStore((s) => {
    const next = deriveSelectionTarget({
      selectedVoxel: s.selectedVoxel,
      selectedFace: s.selectedFace,
      selectedVoxels: s.selectedVoxels,
      selection: s.selection,
    });
    if (selectionTargetEqual(prevRef.current, next)) return prevRef.current;
    prevRef.current = next;
    return next;
  });

  return target;
}
