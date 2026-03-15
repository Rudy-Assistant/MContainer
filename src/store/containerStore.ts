/**
 * containerStore.ts — "Skeleton-First" Container Data Model
 *
 * Geometry Rule:
 *   Container LENGTH runs along the Z-axis (12.19m for 40ft).
 *   Container WIDTH runs along the X-axis (2.44m).
 *   Height is Y-axis.
 *
 *   Side Walls (left/right): 6 panels along Z. x = ±1.22
 *   End Walls (front/back):  2 panels along X. z = ±6.09
 *
 * Each panel is independently configurable.
 * Frames is a FLAT Record<string, boolean> for every post, beam, and corner.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Types ────────────────────────────────────────────────────

export type ContainerSize = "20" | "40" | "40HC";
export type PanelType = "Solid" | "Glass" | "Door" | "Fold_Out" | "Removed";
export type DeckEdgeType = "Open" | "Railing" | "Glass";
export type ContainerRotation = 0 | 90 | 180 | 270;
export type WallSide = "left" | "right" | "front" | "back";

export const WALL_SIDES: WallSide[] = ["left", "right", "front", "back"];

export const PANEL_CYCLE: PanelType[] = ["Solid", "Glass", "Door", "Fold_Out", "Removed"];
export const EDGE_CYCLE: DeckEdgeType[] = ["Open", "Railing", "Glass"];

// ── Container Dimensions (ISO standard, meters) ─────────────
// CRITICAL: "length" = Z-axis, "width" = X-axis

export const CONTAINER_DIMS: Record<ContainerSize, { length: number; width: number; height: number }> = {
  "20":   { length: 6.058,  width: 2.438, height: 2.591 },
  "40":   { length: 12.192, width: 2.438, height: 2.591 },
  "40HC": { length: 12.192, width: 2.438, height: 2.896 },
};

/** Number of panels per wall side per container type */
export const SIDE_PANEL_COUNTS: Record<ContainerSize, Record<WallSide, number>> = {
  "20":   { left: 3, right: 3, front: 2, back: 2 },
  "40":   { left: 6, right: 6, front: 2, back: 2 },
  "40HC": { left: 6, right: 6, front: 2, back: 2 },
};

/** Panel width for a given side */
export function panelWidth(type: ContainerSize, side: WallSide): number {
  const dims = CONTAINER_DIMS[type];
  const count = SIDE_PANEL_COUNTS[type][side];
  // Side walls run along length (Z), End walls run along width (X)
  const wallLength = side === "left" || side === "right" ? dims.length : dims.width;
  return wallLength / count;
}

// ── Sub-Structures ───────────────────────────────────────────

export interface DeckConfig {
  active: boolean;       // true when parent panel is Fold_Out
  edges: { outer: DeckEdgeType; left: DeckEdgeType; right: DeckEdgeType };
}

function defaultDeck(): DeckConfig {
  return {
    active: false,
    edges: { outer: "Open", left: "Open", right: "Open" },
  };
}

// ── Corner Key Helpers ──────────────────────────────────────

export type CornerName = "front_left" | "front_right" | "back_left" | "back_right";
export const CORNER_NAMES: CornerName[] = ["front_left", "front_right", "back_left", "back_right"];

export function cornerFrameKey(corner: CornerName): string {
  return `corner_${corner}`;
}

// ── Hover Target ─────────────────────────────────────────────

export type HoveredPart =
  | { type: "panel"; containerId: string; panelKey: string }
  | { type: "beam"; containerId: string; frameKey: string }
  | { type: "post"; containerId: string; frameKey: string }
  | { type: "corner"; containerId: string; cornerKey: string }
  | { type: "deck_edge"; containerId: string; panelKey: string; edge: "outer" | "left" | "right" }
  | { type: "floor"; containerId: string }
  | null;

// ── Container ────────────────────────────────────────────────

export interface Container {
  id: string;
  type: ContainerSize;
  position: [number, number, number];
  rotation: ContainerRotation; // degrees: 0 | 90 | 180 | 270
  panels: Record<string, PanelType>;     // "left_0"..."left_5", "front_0"...
  decks: Record<string, DeckConfig>;     // 1:1 mapped to panels
  frames: Record<string, boolean>;       // FLAT: "post_left_0", "beam_top_left_0", "corner_front_left", etc.
}

/** Convert discrete rotation (degrees) to radians for Three.js */
export function rotationToRadians(deg: ContainerRotation): number {
  return (deg * Math.PI) / 180;
}

/** Step rotation by +90° (wrapping) */
export function stepRotation(current: ContainerRotation): ContainerRotation {
  return ((current + 90) % 360) as ContainerRotation;
}

// ── ID Generator ─────────────────────────────────────────────

let _seq = 0;
function uid(): string {
  return `c_${Date.now().toString(36)}_${(++_seq).toString(36)}`;
}

// ── Panel Key Helper ─────────────────────────────────────────

/** Generate panel key: "left_0", "front_1", etc. */
export function panelKey(side: WallSide, index: number): string {
  return `${side}_${index}`;
}

/** Parse "left_3" → { side: "left", index: 3 } */
export function parsePanelKey(key: string): { side: WallSide; index: number } {
  const parts = key.split("_");
  return { side: parts[0] as WallSide, index: parseInt(parts[1]) };
}

// ── Factory ──────────────────────────────────────────────────

export function createContainer(
  type: ContainerSize,
  position: [number, number, number] = [0, 0, 0],
  rotation: ContainerRotation = 0
): Container {
  const panels: Record<string, PanelType> = {};
  const decks: Record<string, DeckConfig> = {};
  const frames: Record<string, boolean> = {};

  for (const side of WALL_SIDES) {
    const count = SIDE_PANEL_COUNTS[type][side];
    for (let i = 0; i < count; i++) {
      const key = panelKey(side, i);
      panels[key] = "Solid";
      decks[key] = defaultDeck();
    }
    // Frame posts: count+1 (one at each panel boundary + both corners)
    for (let i = 0; i <= count; i++) {
      frames[`post_${side}_${i}`] = true;
    }
    // Frame beams: one top + one bottom per panel
    for (let i = 0; i < count; i++) {
      frames[`beam_top_${side}_${i}`] = true;
      frames[`beam_bottom_${side}_${i}`] = true;
    }
  }

  // Corner posts (4 vertical columns at container corners)
  for (const corner of CORNER_NAMES) {
    frames[cornerFrameKey(corner)] = true;
  }

  return { id: uid(), type, position, rotation, panels, decks, frames };
}

// ── Brush (active tool from HUD) ────────────────────────────

export type BrushType = "select" | "solid" | "glass" | "door" | "fold_out" | "erase" | "frame" | "paint" | "container" | "grid";

const BRUSH_TO_PANEL: Partial<Record<BrushType, PanelType>> = {
  solid: "Solid",
  glass: "Glass",
  door: "Door",
  fold_out: "Fold_Out",
  erase: "Removed",
};

// ── Store ────────────────────────────────────────────────────

export interface ContainerStoreState {
  containers: Record<string, Container>;
  selectedId: string | null;
  selectedIds: string[];          // Multi-select support (for grouping, bulk ops)
  focusedPanel: string | null;
  brush: BrushType;
  hoveredPart: HoveredPart;       // Nuanced hover tracking for visual feedback

  // Container lifecycle
  addContainer: (type: ContainerSize, position?: [number, number, number]) => string;
  removeContainer: (id: string) => void;
  moveContainer: (id: string, position: [number, number, number]) => void;
  rotateContainer: (id: string, rotation: ContainerRotation) => void;
  rotateContainerStep: (id: string) => void;

  // Selection (single + multi)
  selectContainer: (id: string | null) => void;
  selectMultiple: (ids: string[]) => void;
  selectAdditive: (id: string) => void;  // Shift+click toggle
  clearSelection: () => void;
  focusPanel: (panelKey: string | null) => void;

  // Hover
  setHoveredPart: (part: HoveredPart) => void;

  // Brush
  setBrush: (brush: BrushType) => void;

  // Panel ops
  cyclePanel: (containerId: string, key: string) => void;
  setPanel: (containerId: string, key: string, type: PanelType) => void;
  applyBrush: (containerId: string, key: string) => void;

  // Deck ops
  cycleDeckEdge: (containerId: string, key: string, edge: "outer" | "left" | "right") => void;

  // Frame ops
  toggleFrame: (containerId: string, frameKey: string) => void;

  // Bulk ops
  setAllPanels: (containerId: string, side: WallSide, type: PanelType) => void;
  setAllPanelsGlobal: (containerId: string, type: PanelType) => void;

  // Delete selected (bulk)
  deleteSelected: () => void;
  // Rotate selected (bulk)
  rotateSelected: () => void;

  clearAll: () => void;
}

export const useContainerStore = create<ContainerStoreState>()(
  persist(
    (set, get) => ({
      containers: {},
      selectedId: null,
      selectedIds: [],
      focusedPanel: null,
      brush: "select" as BrushType,
      hoveredPart: null as HoveredPart,

      addContainer: (type, position = [0, 0, 0]) => {
        const c = createContainer(type, position);
        set((s) => ({ containers: { ...s.containers, [c.id]: c } }));
        return c.id;
      },

      removeContainer: (id) =>
        set((s) => {
          const next = { ...s.containers };
          delete next[id];
          return {
            containers: next,
            selectedId: s.selectedId === id ? null : s.selectedId,
            selectedIds: s.selectedIds.filter((sid) => sid !== id),
            focusedPanel: s.selectedId === id ? null : s.focusedPanel,
          };
        }),

      moveContainer: (id, position) =>
        set((s) => {
          const c = s.containers[id];
          if (!c) return s;
          return { containers: { ...s.containers, [id]: { ...c, position } } };
        }),

      rotateContainer: (id, rotation) =>
        set((s) => {
          const c = s.containers[id];
          if (!c) return s;
          return { containers: { ...s.containers, [id]: { ...c, rotation } } };
        }),

      rotateContainerStep: (id) =>
        set((s) => {
          const c = s.containers[id];
          if (!c) return s;
          return { containers: { ...s.containers, [id]: { ...c, rotation: stepRotation(c.rotation) } } };
        }),

      selectContainer: (id) =>
        set({
          selectedId: id,
          selectedIds: id ? [id] : [],
          focusedPanel: null,
        }),

      selectMultiple: (ids) =>
        set({
          selectedId: ids.length > 0 ? ids[0] : null,
          selectedIds: ids,
          focusedPanel: null,
        }),

      selectAdditive: (id) =>
        set((s) => {
          const already = s.selectedIds.includes(id);
          const next = already
            ? s.selectedIds.filter((sid) => sid !== id)
            : [...s.selectedIds, id];
          return {
            selectedId: next.length > 0 ? next[next.length - 1] : null,
            selectedIds: next,
            focusedPanel: null,
          };
        }),

      clearSelection: () => set({ selectedId: null, selectedIds: [], focusedPanel: null }),

      focusPanel: (key) => set({ focusedPanel: key }),

      setHoveredPart: (part) => set({ hoveredPart: part }),

      setBrush: (brush) => set({ brush }),

      cyclePanel: (containerId, key) =>
        set((s) => {
          const c = s.containers[containerId];
          if (!c) return s;
          const current = c.panels[key] || "Solid";
          const idx = PANEL_CYCLE.indexOf(current);
          const next = PANEL_CYCLE[(idx + 1) % PANEL_CYCLE.length];
          const panels = { ...c.panels, [key]: next };
          const decks = { ...c.decks };
          if (decks[key]) {
            decks[key] = { ...decks[key], active: next === "Fold_Out" };
          }
          return { containers: { ...s.containers, [containerId]: { ...c, panels, decks } } };
        }),

      setPanel: (containerId, key, type) =>
        set((s) => {
          const c = s.containers[containerId];
          if (!c) return s;
          const panels = { ...c.panels, [key]: type };
          const decks = { ...c.decks };
          if (decks[key]) {
            decks[key] = { ...decks[key], active: type === "Fold_Out" };
          }
          return { containers: { ...s.containers, [containerId]: { ...c, panels, decks } } };
        }),

      applyBrush: (containerId, key) => {
        const brush = get().brush;
        const panelType = BRUSH_TO_PANEL[brush];
        if (panelType) {
          get().setPanel(containerId, key, panelType);
        } else if (brush === "select") {
          get().selectContainer(containerId);
          get().focusPanel(key);
        }
      },

      cycleDeckEdge: (containerId, key, edge) =>
        set((s) => {
          const c = s.containers[containerId];
          if (!c || !c.decks[key]) return s;
          const deck = { ...c.decks[key], edges: { ...c.decks[key].edges } };
          const current = deck.edges[edge];
          const idx = EDGE_CYCLE.indexOf(current);
          deck.edges[edge] = EDGE_CYCLE[(idx + 1) % EDGE_CYCLE.length];
          return { containers: { ...s.containers, [containerId]: { ...c, decks: { ...c.decks, [key]: deck } } } };
        }),

      toggleFrame: (containerId, frameKey) =>
        set((s) => {
          const c = s.containers[containerId];
          if (!c) return s;
          const frames = { ...c.frames };
          frames[frameKey] = !frames[frameKey];
          return { containers: { ...s.containers, [containerId]: { ...c, frames } } };
        }),

      setAllPanels: (containerId, side, type) =>
        set((s) => {
          const c = s.containers[containerId];
          if (!c) return s;
          const count = SIDE_PANEL_COUNTS[c.type][side];
          const panels = { ...c.panels };
          const decks = { ...c.decks };
          for (let i = 0; i < count; i++) {
            const key = panelKey(side, i);
            panels[key] = type;
            if (decks[key]) {
              decks[key] = { ...decks[key], active: type === "Fold_Out" };
            }
          }
          return { containers: { ...s.containers, [containerId]: { ...c, panels, decks } } };
        }),

      setAllPanelsGlobal: (containerId, type) =>
        set((s) => {
          const c = s.containers[containerId];
          if (!c) return s;
          const panels = { ...c.panels };
          const decks = { ...c.decks };
          for (const key of Object.keys(panels)) {
            panels[key] = type;
            if (decks[key]) {
              decks[key] = { ...decks[key], active: type === "Fold_Out" };
            }
          }
          return { containers: { ...s.containers, [containerId]: { ...c, panels, decks } } };
        }),

      deleteSelected: () => {
        const ids = get().selectedIds;
        if (ids.length === 0) return;
        set((s) => {
          const next = { ...s.containers };
          for (const id of ids) delete next[id];
          return {
            containers: next,
            selectedId: null,
            selectedIds: [],
            focusedPanel: null,
          };
        });
      },

      rotateSelected: () => {
        const ids = get().selectedIds;
        if (ids.length === 0) return;
        set((s) => {
          const containers = { ...s.containers };
          for (const id of ids) {
            const c = containers[id];
            if (c) containers[id] = { ...c, rotation: stepRotation(c.rotation) };
          }
          return { containers };
        });
      },

      clearAll: () => set({ containers: {}, selectedId: null, selectedIds: [], focusedPanel: null, hoveredPart: null }),
    }),
    {
      name: "moduhome-containers-v5",
      partialize: (s) => ({ containers: s.containers }),
    }
  )
);
