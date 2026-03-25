/**
 * uiSlice.ts — Ephemeral UI state (hover, preview, face context, toggles)
 *
 * Extracted from useStore.ts. All state here is ephemeral — not persisted,
 * not undo-tracked. Consumer selectors unchanged.
 */

import type { SurfaceType, VoxelFaces } from '@/types/container';
import type { DesignWarning } from '@/types/validation';
import type { VoxelPayload } from '../useStore';

type Set = (partial: Record<string, unknown> | ((s: any) => Record<string, unknown>)) => void;
type Get = () => any;

export interface RecentItem {
  type: 'wallType' | 'finish';
  value: string;
  label: string;
  icon?: string;
}

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

  // Hotbar tab: 0=Rooms, 1=Surfaces, 2=Materials, 3=Furniture (see SmartHotbar.tsx lines 1475-1478)
  activeHotbarTab: number;
  setActiveHotbarTab: (tab: number) => void;
  cycleHotbarTab: (dir: 1 | -1) => void;

  // Active furniture preset for placing furniture via canvas click
  activeFurniturePreset: string | null;
  setActiveFurniturePreset: (type: string | null) => void;

  // Active light type for placing lights via canvas click
  activeLightType: 'ceiling' | 'lamp' | null;
  setActiveLightType: (type: 'ceiling' | 'lamp' | null) => void;

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

  // Bay group hover (Simple mode 2D grid → 3D highlight bridge)
  hoveredBayGroup: { containerId: string; indices: number[] } | null;
  setHoveredBayGroup: (g: { containerId: string; indices: number[] } | null) => void;

  // Batched hover — sets hoveredVoxel + hoveredVoxelEdge + hoveredBayGroup atomically
  // to prevent one-frame flash of single-voxel highlight before bay group highlight kicks in.
  setHoverState: (state: {
    hoveredVoxel: UiSlice['hoveredVoxel'];
    hoveredVoxelEdge: UiSlice['hoveredVoxelEdge'];
    hoveredBayGroup: UiSlice['hoveredBayGroup'];
  }) => void;

  // Inspector view: floor shows bottom faces, ceiling shows top faces
  inspectorView: 'floor' | 'ceiling';
  setInspectorView: (v: 'floor' | 'ceiling') => void;

  // Frame Mode: shows structural skeleton, enables frame element interaction
  frameMode: boolean;
  toggleFrameMode: () => void;
  setFrameMode: (on: boolean) => void;

  // Selected frame element (pole or rail) in Frame Mode
  selectedFrameElement: { containerId: string; key: string; type: 'pole' | 'rail' } | null;
  setSelectedFrameElement: (el: { containerId: string; key: string; type: 'pole' | 'rail' } | null) => void;

  // Wall cut mode (Sims-style wall visibility)
  wallCutMode: 'full' | 'half' | 'down' | 'custom';
  wallCutHeight: number; // 0.0 (down) to 1.0 (full)
  setWallCutMode: (mode: 'full' | 'half' | 'down' | 'custom') => void;
  setWallCutHeight: (h: number) => void;

  // Design mode: 'smart' = auto-consequences fire, 'manual' = user has full control
  // Orthogonal to designComplexity (simple/detailed controls bay grouping)
  designMode: 'smart' | 'manual';
  setDesignMode: (mode: 'smart' | 'manual') => void;
  toggleDesignMode: () => void;

  // Validation warnings (ephemeral, recomputed from container state)
  warnings: DesignWarning[];
  setWarnings: (warnings: DesignWarning[]) => void;
  hoveredWarning: string | null;
  setHoveredWarning: (id: string | null) => void;

  // Debug wireframe overlay
  debugMode: boolean;
  toggleDebugMode: () => void;

  // Collapsible sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  // Paint drag mode — disables camera controls during Ctrl+drag paint
  isPaintDragging: boolean;
  setIsPaintDragging: (v: boolean) => void;

  // Dark mode
  darkMode: boolean;
  toggleDarkMode: () => void;

  // Quick Setup Wizard
  wizardOpen: boolean;
  wizardPresetId: string | null;
  openWizard: () => void;
  closeWizard: () => void;
  setWizardPresetId: (id: string | null) => void;

  // Recent items MRU list (ephemeral — reset on page load, capped at 8)
  recentItems: RecentItem[];
  addRecentItem: (item: RecentItem) => void;

  // Collapsible inspector sidebar sections (ephemeral)
  previewCollapsed: boolean;
  setPreviewCollapsed: (v: boolean) => void;
  gridCollapsed: boolean;
  setGridCollapsed: (v: boolean) => void;

  // Global roof / skin visibility toggles
  hideRoof: boolean;
  toggleHideRoof: () => void;
  hideSkin: boolean;
  toggleHideSkin: () => void;

  // Staircase placement mode (F1 feature)
  staircasePlacementMode: boolean;
  staircasePlacementContainerId: string | null;
  setStaircasePlacementMode: (on: boolean, containerId?: string | null) => void;

  // Placement mode (Task 12: PlacementGhost)
  placementMode: boolean;
  activePlacementFormId: string | null;
  setPlacementMode: (formId: string | null) => void;

  // Scene object selection (Task 14: SkinEditor)
  selectedObjectId: string | null;
  selectObject: (id: string | null) => void;

  // SceneObject hover (Feature 1: emissive tint)
  hoveredObjectId: string | null;
  setHoveredObjectId: (id: string | null) => void;

  // Form card hover → 3D preview ghost (Feature 3)
  hoveredFormId: string | null;
  setHoveredFormId: (id: string | null) => void;

  // Preset card hover → ghost preview of faces in 3D scene
  ghostPreset: {
    source: 'block' | 'container';
    faces: VoxelFaces;
    targetScope: 'voxel' | 'bay' | 'container';
  } | null;
  setGhostPreset: (g: { source: 'block' | 'container'; faces: VoxelFaces; targetScope: 'voxel' | 'bay' | 'container' } | null) => void;
  clearGhostPreset: () => void;
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

  activeHotbarTab: 1, // Default: Surfaces (was Rooms)
  setActiveHotbarTab: (tab) => set({ activeHotbarTab: tab }),
  cycleHotbarTab: (dir) => set((s: any) => ({ activeHotbarTab: ((s.activeHotbarTab + dir) % 4 + 4) % 4 })),

  activeFurniturePreset: null,
  setActiveFurniturePreset: (type) => set({ activeFurniturePreset: type, activeLightType: null, activeHotbarSlot: null, activeBrush: null } as any),

  activeLightType: null,
  setActiveLightType: (type) => set({ activeLightType: type, activeFurniturePreset: null, activeHotbarSlot: null, activeBrush: null } as any),

  lastStamp: null,
  setLastStamp: (s) => set({ lastStamp: s }),

  grabMode: { active: false, containerId: null, origin: null },
  setGrabMode: (mode) => set({ grabMode: mode }),
  clearGrabMode: () => set({ grabMode: { active: false, containerId: null, origin: null } }),

  designComplexity: 'simple',
  setDesignComplexity: (c) => set({ designComplexity: c, selectedElements: null, hoveredBayGroup: null }),

  hoveredBayGroup: null,
  setHoveredBayGroup: (g) => set({ hoveredBayGroup: g }),
  setHoverState: ({ hoveredVoxel, hoveredVoxelEdge, hoveredBayGroup }) =>
    set({ hoveredVoxel, hoveredVoxelEdge, hoveredBayGroup }),

  inspectorView: 'floor' as 'floor' | 'ceiling',
  setInspectorView: (v: 'floor' | 'ceiling') => set({ inspectorView: v }),

  frameMode: false,
  toggleFrameMode: () => set((s: any) => ({
    frameMode: !s.frameMode,
    selectedFrameElement: null, // clear selection on toggle
  })),
  setFrameMode: (on) => set({
    frameMode: on,
    selectedFrameElement: null, // always clear selection on mode change
  }),

  selectedFrameElement: null,
  setSelectedFrameElement: (el) => set({ selectedFrameElement: el }),

  wallCutMode: 'full' as 'full' | 'half' | 'down' | 'custom',
  wallCutHeight: 1.0,
  setWallCutMode: (mode: 'full' | 'half' | 'down' | 'custom') => set({ wallCutMode: mode }),
  setWallCutHeight: (h: number) => set({ wallCutHeight: h, wallCutMode: 'custom' }),

  designMode: 'smart' as 'smart' | 'manual',
  setDesignMode: (mode) => set({ designMode: mode }),
  toggleDesignMode: () => set((s: any) => ({ designMode: s.designMode === 'smart' ? 'manual' : 'smart' })),

  warnings: [] as DesignWarning[],
  setWarnings: (warnings) => set({ warnings }),
  hoveredWarning: null as string | null,
  setHoveredWarning: (id) => set({ hoveredWarning: id }),

  debugMode: false,
  toggleDebugMode: () => set((s: any) => ({ debugMode: !s.debugMode })),

  sidebarCollapsed: false,
  toggleSidebar: () => set((s: any) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

  isPaintDragging: false,
  setIsPaintDragging: (v) => set({ isPaintDragging: v }),

  darkMode: false,
  toggleDarkMode: () => {
    const next = !(_get() as any).darkMode;
    set({ darkMode: next });
    // Apply data-theme attribute to HTML element
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    }
  },

  // Quick Setup Wizard
  wizardOpen: false,
  wizardPresetId: null,
  openWizard: () => set({ wizardOpen: true, wizardPresetId: null }),
  closeWizard: () => set({ wizardOpen: false, wizardPresetId: null }),
  setWizardPresetId: (id) => set({ wizardPresetId: id }),

  // Recent items MRU list
  recentItems: [],
  addRecentItem: (item) => set((s: any) => {
    const filtered = (s.recentItems as RecentItem[]).filter((r) => r.value !== item.value);
    return { recentItems: [item, ...filtered].slice(0, 8) };
  }),

  // Collapsible inspector sidebar sections
  previewCollapsed: true,
  setPreviewCollapsed: (v) => set({ previewCollapsed: v }),
  gridCollapsed: true,
  setGridCollapsed: (v) => set({ gridCollapsed: v }),

  // Global roof / skin visibility toggles
  hideRoof: false,
  toggleHideRoof: () => set((s: any) => ({ hideRoof: !s.hideRoof })),
  hideSkin: false,
  toggleHideSkin: () => set((s: any) => ({ hideSkin: !s.hideSkin })),

  // Staircase placement mode
  staircasePlacementMode: false,
  staircasePlacementContainerId: null,
  setStaircasePlacementMode: (on, containerId = null) => set({
    staircasePlacementMode: on,
    staircasePlacementContainerId: on ? containerId : null,
  }),

  // Placement mode (Task 12: PlacementGhost)
  placementMode: false,
  activePlacementFormId: null,
  setPlacementMode: (formId) => set({
    placementMode: formId != null,
    activePlacementFormId: formId,
  }),

  // Scene object selection (Task 14: SkinEditor)
  selectedObjectId: null,
  selectObject: (id) => set({
    selectedObjectId: id,
    selectedElements: null,
    selectedFace: null,
  }),

  // SceneObject hover (Feature 1: emissive tint)
  hoveredObjectId: null,
  setHoveredObjectId: (id) => set({ hoveredObjectId: id }),

  // Form card hover → 3D preview ghost (Feature 3)
  hoveredFormId: null,
  setHoveredFormId: (id) => set({ hoveredFormId: id }),

  // Preset card hover → ghost preview of faces in 3D scene
  ghostPreset: null,
  setGhostPreset: (g) => set({ ghostPreset: g }),
  clearGhostPreset: () => set({ ghostPreset: null }),
});
