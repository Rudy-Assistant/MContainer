/**
 * dragSlice.ts — Drag & Context Menu state
 *
 * Extracted from useStore.ts. Contains:
 * - Container palette drag (dragContainer, dragWorldPos)
 * - Furniture palette drag (dragFurniture)
 * - Library drag payload (libraryDragPayload)
 * - Container move drag (dragMovingId, start/commit/cancel)
 * - Bay/Container/Voxel/Face context menus
 * - Edge hover state (hoveredEdge)
 */

import {
  type ContainerSize,
  type FurnitureType,
  type SurfaceType,
  type Voxel,
  type VoxelFaces,
  WallSide,
} from '@/types/container';
import type { HotbarSlot } from '../useStore';
import { checkOverlap, getFullFootprint } from '@/store/spatialEngine';
import { scheduleAdjacency } from '@/store/slices/containerSlice';

// Use a lazy StoreState reference to avoid circular imports.
// The slice function receives set/get typed to the full store.
type Set = (partial: Record<string, unknown> | ((s: any) => Record<string, unknown>)) => void;
type Get = () => any;

/** Callback to access the temporal API (pause/resume). Set by useStore.ts after creation. */
let _getTemporalApi: (() => { pause: () => void; resume: () => void }) | null = null;

/** Called by useStore.ts to inject the temporal API reference (avoids circular import). */
export function setTemporalApiAccessor(fn: () => { pause: () => void; resume: () => void }) {
  _getTemporalApi = fn;
}

function getTemporalApi() {
  if (!_getTemporalApi) throw new Error('dragSlice: temporal API not injected');
  return _getTemporalApi();
}

export interface DragSlice {
  // ── Container palette drag ──────────────────────────────
  dragContainer: ContainerSize | null;
  setDragContainer: (size: ContainerSize | null) => void;
  dragWorldPos: { x: number; y: number; z: number; stackTargetId: string | null } | null;
  setDragWorldPos: (pos: { x: number; y: number; z: number; stackTargetId: string | null } | null) => void;

  // ── Furniture palette drag ──────────────────────────────
  dragFurniture: FurnitureType | null;
  setDragFurniture: (type: FurnitureType | null) => void;

  // ── Library drag payload ────────────────────────────────
  libraryDragPayload: { type: 'block'; faces: VoxelFaces; label: string } | { type: 'container'; size: ContainerSize; voxelGrid: Voxel[]; label: string } | { type: 'hotbarSlot'; slot: HotbarSlot } | null;
  setLibraryDragPayload: (payload: DragSlice['libraryDragPayload']) => void;

  // ── Container move drag ─────────────────────────────────
  dragMovingId: string | null;
  startContainerDrag: (id: string) => void;
  commitContainerDrag: (x: number, z: number, stackTargetId?: string | null) => void;
  cancelContainerDrag: () => void;

  // ── Container context menu ──────────────────────────────
  containerContextMenu: { x: number; y: number; containerId: string } | null;
  openContainerContextMenu: (x: number, y: number, containerId: string) => void;
  closeContainerContextMenu: () => void;

  // ── Face context menu ───────────────────────────────────
  faceContextMenuCtx: {
    containerId: string; voxelIndex: number; face: keyof VoxelFaces;
    surface: SurfaceType; screenX: number; screenY: number;
  } | null;
  setFaceContextMenuCtx: (ctx: {
    containerId: string; voxelIndex: number; face: keyof VoxelFaces;
    surface: SurfaceType; screenX: number; screenY: number;
  } | null) => void;

  // ── Edge hover state ────────────────────────────────────
  hoveredEdge: { containerId: string; wall: WallSide; bayIndex: number } | null;
  setHoveredEdge: (edge: { containerId: string; wall: WallSide; bayIndex: number } | null) => void;
}

export const createDragSlice = (set: Set, get: Get): DragSlice => ({
  // ── Initial State ──────────────────────────────────────

  dragContainer: null,
  dragWorldPos: null,
  dragFurniture: null,
  libraryDragPayload: null,
  dragMovingId: null,
  containerContextMenu: null,
  faceContextMenuCtx: null,
  hoveredEdge: null,

  // ── Actions ────────────────────────────────────────────

  // Container palette drag
  setDragContainer: (size) => set({ dragContainer: size }),
  setDragWorldPos: (pos: { x: number; y: number; z: number; stackTargetId: string | null } | null) => set({ dragWorldPos: pos }),

  // Furniture palette drag
  setDragFurniture: (type) => set({ dragFurniture: type }),

  // Library drag payload
  setLibraryDragPayload: (payload) => set({ libraryDragPayload: payload }),

  /**
   * startContainerDrag — Initiates a container move drag.
   *
   * @remarks
   * Pauses temporal (undo) tracking during drag. Clears hover state to prevent
   * stale wireframes. The actual position tracking happens in DragMoveGhost
   * (Scene.tsx) which raycasts to a ground plane each frame.
   *
   * Flow: startContainerDrag → DragMoveGhost.useFrame (tracks position) →
   *       pointerup → commitContainerDrag(x, z, stackTargetId?)
   *
   * @see Scene.tsx DragMoveGhost for the ghost rendering and snap logic
   * @see commitContainerDrag for the commit/stack logic
   */
  startContainerDrag: (id) => {
    getTemporalApi().pause();
    // Clear hover state to prevent stale wireframes during drag
    set({
      dragMovingId: id,
      hoveredVoxel: null,
      hoveredVoxelEdge: null,
      faceContext: null,
    });
  },
  /**
   * commitContainerDrag — Finalizes a container move at the given position.
   *
   * @remarks
   * If stackTargetId is provided and valid, calls stackContainer SYNCHRONOUSLY
   * (not in requestAnimationFrame) to avoid a frame of wrong Y position.
   * Otherwise validates overlap and updates position.
   *
   * WHY synchronous stack: Previously used requestAnimationFrame which caused
   * one frame where the container was at Y=0 before being moved to stack height.
   * This produced a visible flicker and incorrect gate readings.
   *
   * @param x - Target X position (grid-snapped by DragMoveGhost)
   * @param z - Target Z position (grid-snapped by DragMoveGhost)
   * @param stackTargetId - If set, the container to stack onto (auto-stack on drop)
   */
  commitContainerDrag: (x, z, stackTargetId) => {
    const { dragMovingId, containers } = get();
    if (!dragMovingId) return;
    const c = containers[dragMovingId];
    if (!c) { set({ dragMovingId: null }); getTemporalApi().resume(); return; }

    // If stacking, clear drag state and stack synchronously
    if (stackTargetId && containers[stackTargetId]) {
      set({ dragMovingId: null });
      getTemporalApi().resume();
      // stackContainer sets position (x, y, z), level, and stacking relationship
      get().stackContainer(dragMovingId, stackTargetId);
      scheduleAdjacency(get);
      return;
    }

    // Check overlap at target position (using full footprint including extensions)
    const movedContainer = { ...c, position: { ...c.position, x, z } };
    const targetFoot = getFullFootprint(movedContainer);
    if (checkOverlap(containers, dragMovingId, targetFoot)) {
      // Overlap detected — cancel drag (revert to original position)
      getTemporalApi().resume();
      set({ dragMovingId: null });
      return;
    }

    getTemporalApi().resume();
    set((s: any) => ({
      dragMovingId: null,
      containers: {
        ...s.containers,
        [dragMovingId]: {
          ...s.containers[dragMovingId],
          position: { ...s.containers[dragMovingId].position, x, z },
        },
      },
    }));
    scheduleAdjacency(get);
  },
  cancelContainerDrag: () => {
    getTemporalApi().resume();
    set({ dragMovingId: null });
  },

  // Container context menu
  openContainerContextMenu: (x, y, containerId) => set({
    containerContextMenu: { x, y, containerId },
  }),
  closeContainerContextMenu: () => set({ containerContextMenu: null }),

  // Face context menu
  setFaceContextMenuCtx: (ctx) => set({ faceContextMenuCtx: ctx }),

  // Edge hover state
  setHoveredEdge: (edge) => set({ hoveredEdge: edge }),
});
