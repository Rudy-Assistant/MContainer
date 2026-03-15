/**
 * FrameStore.ts — Universal Tile Cube Data Model
 *
 * Every grid cell is a potential "cube" with:
 *   12 edges  (beams)  — individually toggleable
 *   6 faces   (panels) — cycle through panel types
 *   8 corners (nodes)  — column toggles
 *
 * Grid key format: "x,y,z" (integers in CELL units)
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── ISO Constants ────────────────────────────────────────────

export const CELL = 2.44;       // Container width (meters)
export const HALF = 1.22;       // Half cell
export const WALL_H = 2.59;     // Standard wall height
export const WALL_HC = 2.90;    // High-cube
export const BAY_40FT = 5;      // 40ft = 5 cells long

// ── Edge / Face / Corner Keys ────────────────────────────────
// Each cube has 12 edges, 6 faces, 8 corners identified by string keys

export const EDGE_KEYS = [
  // Bottom ring (y=0)
  "b_front", "b_right", "b_back", "b_left",
  // Top ring (y=1)
  "t_front", "t_right", "t_back", "t_left",
  // Verticals
  "v_fl", "v_fr", "v_br", "v_bl",
] as const;
export type EdgeKey = typeof EDGE_KEYS[number];

export const FACE_KEYS = [
  "top", "bottom", "front", "back", "left", "right",
] as const;
export type FaceKey = typeof FACE_KEYS[number];

export const CORNER_KEYS = [
  "bfl", "bfr", "bbr", "bbl",  // bottom: front-left, front-right, back-right, back-left
  "tfl", "tfr", "tbr", "tbl",  // top: same pattern
] as const;
export type CornerKey = typeof CORNER_KEYS[number];

// ── Panel types for face cycling ─────────────────────────────

export type PanelKind = "open" | "floor" | "wall" | "glass" | "roof" | "railing";
export const PANEL_CYCLE: PanelKind[] = ["open", "wall", "glass", "floor", "railing", "roof"];

// ── Tile State ───────────────────────────────────────────────

export interface TileState {
  edges: Partial<Record<EdgeKey, true>>;   // present = beam exists
  faces: Partial<Record<FaceKey, PanelKind>>;
  corners: Partial<Record<CornerKey, true>>; // present = column exists
}

function emptyTile(): TileState {
  return { edges: {}, faces: {}, corners: {} };
}

// ── Grid Key helpers ─────────────────────────────────────────

/** Grid key from integer cell coordinates */
export function gridKey(gx: number, gy: number, gz: number): string {
  return `${gx},${gy},${gz}`;
}

/** Parse grid key back to integers */
export function parseKey(key: string): [number, number, number] {
  const [x, y, z] = key.split(",").map(Number);
  return [x, y, z];
}

/** World position (center of cell) from grid coords */
export function cellToWorld(gx: number, gy: number, gz: number): [number, number, number] {
  return [gx * CELL, gy * WALL_H, gz * CELL];
}

/** Grid coords from world position (nearest cell) */
export function worldToCell(wx: number, wy: number, wz: number): [number, number, number] {
  return [Math.round(wx / CELL), Math.round(wy / WALL_H), Math.round(wz / CELL)];
}

// ── Style / Tool Types ───────────────────────────────────────

export type StylePreset = "Industrial" | "Modern" | "Rustic";
export type BuildTool = "beam" | "panel" | "container" | "eraser";
export const TOOLS: BuildTool[] = ["beam", "panel", "container", "eraser"];

// ── Container Template ───────────────────────────────────────

/**
 * Stamps a 40ft container as 5×1×1 tile cubes.
 * Each cube gets all 12 edges, floor face, roof face, and all 8 corners.
 * Shared edges between adjacent cubes are NOT duplicated (they share the same tile).
 */
function stampContainer(
  tiles: Record<string, TileState>,
  gx: number, gy: number, gz: number,
  rotation: number
): Record<string, TileState> {
  const next = { ...tiles };
  const len = BAY_40FT; // 5 cells along X (or Z if rotated)

  for (let i = 0; i < len; i++) {
    // Rotation: 0=along X, 90=along Z
    const cx = rotation === 90 || rotation === 270 ? gx : gx + i;
    const cz = rotation === 90 || rotation === 270 ? gz + i : gz;
    const key = gridKey(cx, gy, cz);

    const tile = next[key] ? { ...next[key], edges: { ...next[key].edges }, faces: { ...next[key].faces }, corners: { ...next[key].corners } } : emptyTile();

    // All 12 edges (full frame)
    for (const ek of EDGE_KEYS) {
      tile.edges[ek] = true;
    }
    // Floor + roof faces
    tile.faces["bottom"] = "floor";
    tile.faces["top"] = "roof";
    // All 8 corners
    for (const ck of CORNER_KEYS) {
      tile.corners[ck] = true;
    }

    // Side walls only on outer edges of the container
    const isFirst = i === 0;
    const isLast = i === len - 1;
    const isXAxis = rotation === 0 || rotation === 180;

    if (isXAxis) {
      // Front/back walls along Z
      tile.faces["front"] = "wall";
      tile.faces["back"] = "wall";
      if (isFirst) tile.faces["left"] = "wall";
      if (isLast) tile.faces["right"] = "wall";
    } else {
      // Front/back walls along X
      tile.faces["left"] = "wall";
      tile.faces["right"] = "wall";
      if (isFirst) tile.faces["front"] = "wall";
      if (isLast) tile.faces["back"] = "wall";
    }

    next[key] = tile;
  }

  return next;
}

// ── Store ────────────────────────────────────────────────────

export interface FrameStoreState {
  tiles: Record<string, TileState>;
  style: StylePreset;
  tool: BuildTool;
  buildMode: boolean;
  brushRotation: number;

  // Tile ops
  ensureTile: (gx: number, gy: number, gz: number) => void;
  toggleEdge: (gx: number, gy: number, gz: number, edge: EdgeKey) => void;
  cycleFace: (gx: number, gy: number, gz: number, face: FaceKey) => void;
  setFace: (gx: number, gy: number, gz: number, face: FaceKey, kind: PanelKind) => void;
  toggleCorner: (gx: number, gy: number, gz: number, corner: CornerKey) => void;
  removeTile: (gx: number, gy: number, gz: number) => void;

  // Stamp
  stampContainer: (gx: number, gy: number, gz: number, rotation: number) => void;

  // Tools
  setTool: (tool: BuildTool) => void;
  cycleTool: (dir: 1 | -1) => void;
  setStyle: (style: StylePreset) => void;
  rotateBrush: () => void;
  toggleBuild: () => void;
  clearAll: () => void;
}

export const useFrameStore = create<FrameStoreState>()(
  persist(
    (set, get) => ({
      tiles: {},
      style: "Industrial",
      tool: "container",
      buildMode: false,
      brushRotation: 0,

      ensureTile: (gx, gy, gz) => {
        const key = gridKey(gx, gy, gz);
        const s = get();
        if (s.tiles[key]) return;
        set({ tiles: { ...s.tiles, [key]: emptyTile() } });
      },

      toggleEdge: (gx, gy, gz, edge) =>
        set((s) => {
          const key = gridKey(gx, gy, gz);
          const tile = s.tiles[key] ? { ...s.tiles[key], edges: { ...s.tiles[key].edges } } : emptyTile();
          if (tile.edges[edge]) {
            delete tile.edges[edge];
          } else {
            tile.edges[edge] = true;
          }
          return { tiles: { ...s.tiles, [key]: tile } };
        }),

      cycleFace: (gx, gy, gz, face) =>
        set((s) => {
          const key = gridKey(gx, gy, gz);
          const tile = s.tiles[key] ? { ...s.tiles[key], faces: { ...s.tiles[key].faces } } : emptyTile();
          const current = tile.faces[face] || "open";
          const idx = PANEL_CYCLE.indexOf(current);
          const next = PANEL_CYCLE[(idx + 1) % PANEL_CYCLE.length];
          if (next === "open") {
            delete tile.faces[face];
          } else {
            tile.faces[face] = next;
          }
          return { tiles: { ...s.tiles, [key]: tile } };
        }),

      setFace: (gx, gy, gz, face, kind) =>
        set((s) => {
          const key = gridKey(gx, gy, gz);
          const tile = s.tiles[key] ? { ...s.tiles[key], faces: { ...s.tiles[key].faces } } : emptyTile();
          if (kind === "open") {
            delete tile.faces[face];
          } else {
            tile.faces[face] = kind;
          }
          return { tiles: { ...s.tiles, [key]: tile } };
        }),

      toggleCorner: (gx, gy, gz, corner) =>
        set((s) => {
          const key = gridKey(gx, gy, gz);
          const tile = s.tiles[key] ? { ...s.tiles[key], corners: { ...s.tiles[key].corners } } : emptyTile();
          if (tile.corners[corner]) {
            delete tile.corners[corner];
          } else {
            tile.corners[corner] = true;
          }
          return { tiles: { ...s.tiles, [key]: tile } };
        }),

      removeTile: (gx, gy, gz) =>
        set((s) => {
          const key = gridKey(gx, gy, gz);
          const next = { ...s.tiles };
          delete next[key];
          return { tiles: next };
        }),

      stampContainer: (gx, gy, gz, rotation) =>
        set((s) => ({
          tiles: stampContainer(s.tiles, gx, gy, gz, rotation),
        })),

      setTool: (tool) => set({ tool }),
      cycleTool: (dir) =>
        set((s) => {
          const i = TOOLS.indexOf(s.tool);
          const next = (i + dir + TOOLS.length) % TOOLS.length;
          return { tool: TOOLS[next] };
        }),
      setStyle: (style) => set({ style }),
      rotateBrush: () => set((s) => ({ brushRotation: (s.brushRotation + 90) % 360 })),
      toggleBuild: () => set((s) => ({ buildMode: !s.buildMode })),
      clearAll: () => set({ tiles: {} }),
    }),
    {
      name: "moduhome-frame-v3",
      partialize: (s) => ({ tiles: s.tiles, style: s.style }),
    }
  )
);
