/**
 * selectionSlice.ts — Selection, clipboard, brush, and paint state
 *
 * Extracted from useStore.ts. Consumer selectors unchanged — state merges into StoreState.
 */

import type { SurfaceType, VoxelFaces, WallSide } from '@/types/container';

export type ElementType = 'frame' | 'wall' | 'floor' | 'ceiling' | 'voxel' | 'bay' | 'container';

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

  /** Which face of the selected voxel is active (set by 3D click) */
  selectedFace: keyof VoxelFaces | null;
  setSelectedFace: (f: keyof VoxelFaces | null) => void;

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

  // Typed element selection context
  selectedElements: {
    type: ElementType;
    items: Array<{ containerId: string; id: string }>;
  } | null;
  setSelectedElements: (sel: { type: ElementType; items: Array<{ containerId: string; id: string }> } | null) => void;
  toggleElement: (containerId: string, id: string) => void;
}

export const createSelectionSlice = (set: Set, get: Get): SelectionSlice => ({
  // ── Initial State ──────────────────────────────────────
  selection: [],
  selectionContext: null,
  selectedFace: null,
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
  selectedElements: null,

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
        selectedElements: sameContainer ? s.selectedElements : null,
        selectedObjectId: null,
      };
    }),

  selectMultiple: (ids) => set({ selection: ids, selectedFace: null, selectedElements: null, selectionContext: null, selectedObjectId: null }),

  clearSelection: () => set({ selection: [], selectionContext: null, selectedFace: null, selectedElements: null, hoveredVoxel: null, faceContext: null, selectedObjectId: null }),

  setSelectionContext: (ctx) => set({ selectionContext: ctx }),

  setSelectedFace: (f) => set((_s: any) => {
    if (!f) return { selectedFace: null };
    return { selectedFace: f };
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
        selectedElements: { type: 'voxel' as const, items: [{ containerId, id: String(voxelIndex) }] },
      };
    });
  },

  pasteToSelection: () => {
    const clip = get().clipboardVoxel;
    if (!clip) return;
    const sel = get().selectedElements;
    if (!sel || sel.items.length === 0) return;
    const containerId = sel.items[0].containerId;
    const indices = sel.items.map((it: { containerId: string; id: string }) => parseInt(it.id)).filter((n: number) => !isNaN(n));
    if (indices.length === 0) return;
    set((s: any) => {
      const c = s.containers[containerId];
      if (!c?.voxelGrid) return {};
      const grid = [...c.voxelGrid];
      for (const idx of indices) {
        if (s.lockedVoxels[`${containerId}_${idx}`]) continue;
        const v = grid[idx];
        if (v) grid[idx] = { ...v, active: true, faces: { ...clip } };
      }
      return {
        containers: { ...s.containers, [containerId]: { ...c, voxelGrid: grid } },
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

  setSelectedElements: (sel) => set((_s: any) => {
    if (!sel) return { selectedElements: null, selectedFace: null };
    return { selectedElements: sel, selectedFace: null };
  }),

  toggleElement: (containerId, id) => set((s: any) => {
    const curr = s.selectedElements;
    // Bootstrap: if nothing selected, start a new voxel selection
    if (!curr) return { selectedElements: { type: 'voxel', items: [{ containerId, id }] } };
    const idx = curr.items.findIndex((it: any) => it.containerId === containerId && it.id === id);
    if (idx >= 0) {
      const items = [...curr.items];
      items.splice(idx, 1);
      return { selectedElements: items.length > 0 ? { ...curr, items } : null };
    }
    return { selectedElements: { ...curr, items: [...curr.items, { containerId, id }] } };
  }),
});
