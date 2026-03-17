/**
 * uiSlice.ts — Ephemeral UI state (hover, preview, face context, toggles)
 *
 * Extracted from useStore.ts. All state here is ephemeral — not persisted,
 * not undo-tracked. Consumer selectors unchanged.
 */

import type { SurfaceType, VoxelFaces } from '@/types/container';
import type { VoxelPayload } from '../useStore';

type Set = (partial: Record<string, unknown> | ((s: any) => Record<string, unknown>)) => void;
type Get = () => any;

export interface UiSlice {
  hoveredVoxel: VoxelPayload | null;
  setHoveredVoxel: (v: VoxelPayload | null) => void;

  hoveredVoxelEdge: { containerId: string; voxelIndex: number; face: keyof VoxelFaces } | null;
  setHoveredVoxelEdge: (edge: { containerId: string; voxelIndex: number; face: keyof VoxelFaces } | null) => void;

  hoveredPreviewFace: keyof VoxelFaces | null;
  setHoveredPreviewFace: (face: keyof VoxelFaces | null) => void;

  faceContext: 'wall' | 'floor' | 'roof' | null;
  setFaceContext: (ctx: 'wall' | 'floor' | 'roof' | null) => void;

  facePreview: { containerId: string; voxelIndex: number; face: keyof VoxelFaces; surface: SurfaceType } | null;
  setFacePreview: (p: { containerId: string; voxelIndex: number; face: keyof VoxelFaces; surface: SurfaceType } | null) => void;

  dollhouseActive: boolean;
  toggleDollhouse: () => void;

  showFurnitureLabels: boolean;
  toggleFurnitureLabels: () => void;

  // Hotbar tab (0 = rooms, 1 = materials, 2 = furniture)
  activeHotbarTab: number;
  setActiveHotbarTab: (tab: number) => void;
  cycleHotbarTab: (dir: 1 | -1) => void;

  // Active furniture preset for placing furniture via canvas click
  activeFurniturePreset: string | null;
  setActiveFurniturePreset: (type: string | null) => void;

  // Last stamp for spacebar repeat
  lastStamp: { containerId: string; voxelIndex: number; face: keyof VoxelFaces; surfaceType: SurfaceType } | null;
  setLastStamp: (s: { containerId: string; voxelIndex: number; face: keyof VoxelFaces; surfaceType: SurfaceType } | null) => void;

  // Grab mode for keyboard container movement
  grabMode: { active: boolean; containerId: string | null; origin: { x: number; y: number; z: number } | null };
  setGrabMode: (mode: { active: boolean; containerId: string | null; origin: { x: number; y: number; z: number } | null }) => void;
  clearGrabMode: () => void;

  // Design complexity toggle (Simple = bay groups, Detailed = per-voxel)
  designComplexity: 'simple' | 'detailed';
  setDesignComplexity: (c: 'simple' | 'detailed') => void;

  // Debug wireframe overlay
  debugMode: boolean;
  toggleDebugMode: () => void;

  // Collapsible sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const createUiSlice = (set: Set, _get: Get): UiSlice => ({
  // ── Initial State ──────────────────────────────────────
  hoveredVoxel: null,
  hoveredVoxelEdge: null,
  hoveredPreviewFace: null,
  faceContext: null,
  facePreview: null,
  dollhouseActive: false,
  showFurnitureLabels: false,

  // ── Actions ────────────────────────────────────────────
  setHoveredVoxel: (v) => set({ hoveredVoxel: v }),
  setHoveredVoxelEdge: (edge) => set({ hoveredVoxelEdge: edge }),
  setHoveredPreviewFace: (face) => set({ hoveredPreviewFace: face }),
  setFaceContext: (ctx) => set({ faceContext: ctx }),
  setFacePreview: (p) => set({ facePreview: p }),
  toggleDollhouse: () => set((s: any) => ({ dollhouseActive: !s.dollhouseActive })),
  toggleFurnitureLabels: () => set((s: any) => ({ showFurnitureLabels: !s.showFurnitureLabels })),

  activeHotbarTab: 0,
  setActiveHotbarTab: (tab) => set({ activeHotbarTab: tab }),
  cycleHotbarTab: (dir) => set((s: any) => ({ activeHotbarTab: ((s.activeHotbarTab + dir) % 3 + 3) % 3 })),

  activeFurniturePreset: null,
  setActiveFurniturePreset: (type) => set({ activeFurniturePreset: type, activeHotbarSlot: null, activeBrush: null } as any),

  lastStamp: null,
  setLastStamp: (s) => set({ lastStamp: s }),

  grabMode: { active: false, containerId: null, origin: null },
  setGrabMode: (mode) => set({ grabMode: mode }),
  clearGrabMode: () => set({ grabMode: { active: false, containerId: null, origin: null } }),

  designComplexity: 'detailed',
  setDesignComplexity: (c) => set({ designComplexity: c }),

  debugMode: false,
  toggleDebugMode: () => set((s: any) => ({ debugMode: !s.debugMode })),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s: any) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
});
