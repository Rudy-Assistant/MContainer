/**
 * selectionSlice.ts — Selection, clipboard, brush, and paint state
 *
 * Extracted from useStore.ts. Consumer selectors unchanged — state merges into StoreState.
 */

import type { SurfaceType, VoxelFaces, WallSide } from '@/types/container';
import type { VoxelPayload } from '../useStore';

type Set = (partial: Record<string, unknown> | ((s: any) => Record<string, unknown>)) => void;
type Get = () => any;

export interface SelectionSlice {
  // Container selection
  selection: string[];
  select: (id: string, additive?: boolean) => void;
  selectMultiple: (ids: string[]) => void;
  clearSelection: () => void;

  // Sub-part selection context
  selectionContext: {
    containerId: string;
    subPart?: { type: 'wall' | 'edge'; wallSide: WallSide; bayIndex: number };
  } | null;
  setSelectionContext: (
    ctx: { containerId: string; subPart?: { type: 'wall' | 'edge'; wallSide: WallSide; bayIndex: number } } | null
  ) => void;

  // Voxel selection
  selectedVoxel: VoxelPayload | null;
  setSelectedVoxel: (v: VoxelPayload | null) => void;
  /** Which face of the selected voxel is active (set by 3D click) */
  selectedFace: keyof VoxelFaces | null;
  setSelectedFace: (f: keyof VoxelFaces | null) => void;
  selectedVoxels: { containerId: string; indices: number[] } | null;
  setSelectedVoxels: (v: { containerId: string; indices: number[] } | null) => void;
  toggleVoxelInSelection: (containerId: string, index: number) => void;

  // Clipboard
  clipboardVoxel: VoxelFaces | null;
  copyVoxel: (containerId: string, voxelIndex: number) => void;
  pasteVoxel: (containerId: string, voxelIndex: number) => void;
  pasteToSelection: () => void;
  clearClipboard: () => void;

  // Overlapping edges (Spacebar cycling)
  overlappingEdges: Array<{ containerId: string; wall: WallSide; bayIndex: number }> | null;
  edgeCycleIndex: number;
  setOverlappingEdges: (edges: Array<{ containerId: string; wall: WallSide; bayIndex: number }> | null) => void;
  cycleOverlappingEdges: () => void;

  // Brush / hotbar slot
  activeBrush: SurfaceType | null;
  setActiveBrush: (mat: SurfaceType | null) => void;
  activeHotbarSlot: number | null;
  setActiveHotbarSlot: (slot: number | null) => void;
  activeCustomSlot: number | null;
  setActiveCustomSlot: (index: number | null) => void;

  // Paint drag
  paintPayload: VoxelFaces | null;
  isPainting: boolean;
  startPaint: (faces: VoxelFaces) => void;
  stopPaint: () => void;

  // Bucket tool
  bucketMode: boolean;
  bucketSurface: SurfaceType;
  setBucketMode: (on: boolean) => void;
  setBucketSurface: (s: SurfaceType) => void;

  // Style brush
  styleBrush: VoxelFaces | null;
  copyVoxelStyle: (containerId: string, voxelIndex: number) => void;
}

export const createSelectionSlice = (set: Set, get: Get): SelectionSlice => ({
  // ── Initial State ──────────────────────────────────────
  selection: [],
  selectionContext: null,
  selectedVoxel: null,
  selectedFace: null,
  selectedVoxels: null,
  clipboardVoxel: null,
  overlappingEdges: null,
  edgeCycleIndex: 0,
  activeBrush: null,
  activeHotbarSlot: null,
  activeCustomSlot: null,
  paintPayload: null,
  isPainting: false,
  bucketMode: false,
  bucketSurface: 'Solid_Steel' as SurfaceType,
  styleBrush: null,

  // ── Actions ────────────────────────────────────────────

  select: (id, additive = false) =>
    set((s: any) => {
      const newSel = additive
        ? s.selection.includes(id)
          ? s.selection.filter((sid: string) => sid !== id)
          : [...s.selection, id]
        : [id];
      // Preserve subPart if staying on same container, else clear it
      const ctx = s.selectionContext;
      const newCtx = newSel.length > 0
        ? { containerId: id, subPart: ctx?.containerId === id ? ctx.subPart : undefined }
        : null;
      // Clear single voxel selection; preserve multi-select (bay groups set from 2D grid)
      const sameContainer = s.selection.length === 1 && s.selection[0] === id;
      return {
        selection: newSel,
        selectionContext: newCtx,
        selectedVoxel: null,
        selectedVoxels: sameContainer ? s.selectedVoxels : null,
        selectedObjectId: null,
      };
    }),

  selectMultiple: (ids) => set({ selection: ids, selectedVoxel: null, selectedFace: null, selectedVoxels: null, selectionContext: null, selectedObjectId: null }),

  clearSelection: () => set({ selection: [], selectionContext: null, selectedVoxel: null, selectedFace: null, selectedVoxels: null, hoveredVoxel: null, faceContext: null, selectedObjectId: null }),

  setSelectionContext: (ctx) => set({ selectionContext: ctx }),

  setSelectedVoxel: (v) => set({ selectedVoxel: v, selectedVoxels: null, selectedObjectId: null }),
  setSelectedFace: (f) => set({ selectedFace: f }),

  setSelectedVoxels: (v) => set({ selectedVoxels: v, selectedVoxel: null, selectedObjectId: null }),

  toggleVoxelInSelection: (containerId, index) => set((state: any) => {
    const cur = state.selectedVoxels;
    if (!cur || cur.containerId !== containerId) {
      return { selectedVoxels: { containerId, indices: [index] } };
    }
    const exists = cur.indices.includes(index);
    const next = exists ? cur.indices.filter((i: number) => i !== index) : [...cur.indices, index];
    return { selectedVoxels: next.length ? { containerId, indices: next } : null };
  }),

  copyVoxel: (containerId, voxelIndex) => {
    const c = get().containers[containerId];
    if (!c?.voxelGrid) return;
    const voxel = c.voxelGrid[voxelIndex];
    if (!voxel) return;
    set({ clipboardVoxel: { ...voxel.faces } });
  },

  pasteVoxel: (containerId, voxelIndex) => {
    if (get().lockedVoxels[`${containerId}_${voxelIndex}`]) return;
    const clip = get().clipboardVoxel;
    if (!clip) return;

    set((s: any) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      const voxel = grid[voxelIndex];
      if (!voxel) return {};
      grid[voxelIndex] = { ...voxel, active: true, faces: { ...clip } };
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
        selectedVoxel: { containerId, index: voxelIndex },
      };
    });
  },

  pasteToSelection: () => {
    const clip = get().clipboardVoxel;
    if (!clip) return;
    const sel = get().selectedVoxels;
    if (!sel || sel.indices.length === 0) return;
    set((s: any) => {
      const c = s.containers[sel.containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      for (const idx of sel.indices) {
        if (s.lockedVoxels[`${sel.containerId}_${idx}`]) continue;
        const v = grid[idx];
        if (v) grid[idx] = { ...v, active: true, faces: { ...clip } };
      }
      return {
        containers: { ...s.containers, [sel.containerId]: { ...c, voxelGrid: grid } },
      };
    });
  },

  clearClipboard: () => set({ clipboardVoxel: null }),

  setOverlappingEdges: (edges) => set({ overlappingEdges: edges, edgeCycleIndex: 0 }),

  cycleOverlappingEdges: () => {
    const { overlappingEdges, edgeCycleIndex } = get();
    if (!overlappingEdges || overlappingEdges.length <= 1) return;

    const nextIndex = (edgeCycleIndex + 1) % overlappingEdges.length;
    set({
      edgeCycleIndex: nextIndex,
      hoveredEdge: overlappingEdges[nextIndex],
    });
  },

  setActiveBrush: (mat) => set({ activeBrush: mat }),

  setActiveHotbarSlot: (slot) => set({ activeHotbarSlot: slot, activeModulePreset: null }),

  setActiveCustomSlot: (index) => {
    set((s: any) => ({
      activeCustomSlot: s.activeCustomSlot === index ? null : index,
      // Clear primary hotbar selection when activating custom
      activeHotbarSlot: index !== null ? null : s.activeHotbarSlot,
    }));
  },

  startPaint: (faces) => set({ paintPayload: faces, isPainting: true }),
  stopPaint: () => set({ paintPayload: null, isPainting: false }),

  setBucketMode: (on) => set({ bucketMode: on, ...(on ? { activeBrush: null, activeHotbarSlot: null } : {}) }),
  setBucketSurface: (s) => set({ bucketSurface: s }),

  copyVoxelStyle: (containerId, voxelIndex) => {
    const c = get().containers[containerId];
    if (!c?.voxelGrid) return;
    const voxel = c.voxelGrid[voxelIndex];
    if (!voxel) return;
    set({ styleBrush: { ...voxel.faces } });
  },
});
