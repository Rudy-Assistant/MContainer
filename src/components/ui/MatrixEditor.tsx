"use client";

/**
 * MatrixEditor.tsx — 32-Block Command Grid + 3D Cube Inspector
 *
 * Two sections:
 *   1. Interactive 8×4 voxel grid — click to select, hover to highlight in 3D canvas
 *   2. VoxelPreview3D cube — shows the selected block's 6 faces, click to cycle
 */

import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { useStore, autoStairDir } from "@/store/useStore";
import {
  type Container,
  type SurfaceType,
  type VoxelFaces,
  type ExtensionConfig,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  CONTAINER_DIMENSIONS,
} from "@/types/container";
import { createDefaultVoxelGrid } from "@/types/factories";
import VoxelPreview3D, { GroupedVoxelPreview } from "@/components/ui/VoxelPreview3D";
import FaceSchematic from "@/components/ui/FaceSchematic";
import BatchFaceControls from "@/components/ui/BatchFaceControls";
import { BookmarkPlus } from "lucide-react";
import { computeBayGroups, type BayGroup } from "@/config/bayGroups";
import { HIGHLIGHT_COLOR_SELECT, HIGHLIGHT_COLOR_HOVER } from "@/config/highlightColors";
import { makePoleKey, makeRailKey } from "@/config/frameMaterials";

// ── Face-color mapping for grid cells ────────────────────────

export const SURFACE_COLORS: Record<SurfaceType, string> = {
  Open:           "transparent",
  Solid_Steel:    "#78909c",
  Glass_Pane:     "#60a5fa",
  Railing_Glass:  "#93c5fd",
  Railing_Cable:  "#607d8b",
  Deck_Wood:      "#8d6e63",
  Concrete:       "#9e9e9e",
  Half_Fold:      "#ab47bc",
  Gull_Wing:      "#7e57c2",
  Door:           "#607d8b",
  Stairs:         "#5d4037",
  Stairs_Down:    "#3e2723",
  Wood_Hinoki:    "#f5e6c8",
  Floor_Tatami:   "#c8d5a0",
  Wall_Washi:     "#f8f4ec",
  Glass_Shoji:    "#fafafa",
  Window_Standard: "#7dd3fc",
  Window_Sill:     "#93c5fd",
  Window_Clerestory: "#bfdbfe",
  Window_Half:     "#a5f3fc",
};

/** Derive a single representative color from a voxel's faces */
function cellColor(faces: { n: SurfaceType; s: SurfaceType; e: SurfaceType; w: SurfaceType; top: SurfaceType; bottom: SurfaceType }): string {
  for (const f of [faces.n, faces.s, faces.e, faces.w, faces.top, faces.bottom]) {
    if (f !== "Open") return SURFACE_COLORS[f] ?? "#78909c";
  }
  return "transparent";
}

// ── Grid Cell ────────────────────────────────────────────────

function GridCell({
  voxelIndex,
  containerId,
  active,
  color,
  floorColor,
  isSelected,
  isMultiSelected,
  isHovered,
  edgeFace,
  syncFace,
  isCore,
  isLocked,
  gridColumn,
  gridRow,
  onHover,
  onLeave,
  onEdgeHover,
  onEdgeLeave,
  onEdgeClick,
  onSelect,
  onCellMouseDown,
  onCellMouseEnterDrag,
  onActivate,
  onContextMenu,
}: {
  voxelIndex: number;
  containerId: string;
  active: boolean;
  color: string;
  floorColor: string;
  isSelected: boolean;
  isMultiSelected: boolean;
  isHovered: boolean;
  edgeFace: string | null; // "n"|"s"|"e"|"w" or null for center hover
  syncFace: string | null; // face synced from Cell View hover or context menu
  isCore: boolean;
  isLocked: boolean;
  gridColumn?: number;
  gridRow?: number;
  onHover: () => void;
  onLeave: () => void;
  onEdgeHover: (face: string) => void;
  onEdgeLeave: () => void;
  onEdgeClick: (face: string) => void;
  onSelect: (e: React.MouseEvent) => void;
  onCellMouseDown: (e: React.MouseEvent) => void;
  onCellMouseEnterDrag: () => void;
  onActivate: () => void;
  onContextMenu: (e: React.MouseEvent, voxelIndex: number) => void;
}) {

  // Active cells show floor material color as a subtle bottom stripe
  const hasFloor = active && floorColor !== "transparent";

  // Determine effective edge highlight: direct 3D hover > Cell View sync > context menu
  const effectiveEdge = edgeFace || syncFace;

  // Always use longhand border properties to avoid React shorthand/longhand conflict warnings
  const borderStyle: React.CSSProperties = isSelected && syncFace
    ? {
        borderTop:    syncFace === "n" ? "3px solid #06b6d4" : "2px solid #2563eb",
        borderBottom: syncFace === "s" ? "3px solid #06b6d4" : "2px solid #2563eb",
        borderRight:  syncFace === "e" ? "3px solid #06b6d4" : "2px solid #2563eb",
        borderLeft:   syncFace === "w" ? "3px solid #06b6d4" : "2px solid #2563eb",
      }
    : isSelected
      ? { borderTop: "2px solid #2563eb", borderBottom: "2px solid #2563eb", borderLeft: "2px solid #2563eb", borderRight: "2px solid #2563eb" }
    : isMultiSelected
      ? { borderTop: "2px solid #1565c0", borderBottom: "2px solid #1565c0", borderLeft: "2px solid #1565c0", borderRight: "2px solid #1565c0" }
    : isHovered && effectiveEdge
      ? (effectiveEdge === "top" || effectiveEdge === "bottom")
        ? { borderTop: "2px solid #fde047", borderBottom: "2px solid #fde047", borderLeft: "2px solid #fde047", borderRight: "2px solid #fde047", background: `rgba(253,224,71,0.25)` }
        : {
            borderTop:    effectiveEdge === "n" ? "3px solid #fde047" : "1px solid #fef08a",
            borderBottom: effectiveEdge === "s" ? "3px solid #fde047" : "1px solid #fef08a",
            borderRight:  effectiveEdge === "e" ? "3px solid #fde047" : "1px solid #fef08a",
            borderLeft:   effectiveEdge === "w" ? "3px solid #fde047" : "1px solid #fef08a",
          }
      : isHovered
        ? { borderTop: "2px solid #fef08a", borderBottom: "2px solid #fef08a", borderLeft: "2px solid #fef08a", borderRight: "2px solid #fef08a" }
        : isCore
          ? { borderTop: "2px solid var(--border, #cbd5e1)", borderBottom: "2px solid var(--border, #cbd5e1)", borderLeft: "2px solid var(--border, #cbd5e1)", borderRight: "2px solid var(--border, #cbd5e1)", borderRadius: 8 }
          : { borderTop: "2px solid #e5e7eb", borderBottom: "2px solid #e5e7eb", borderLeft: "2px solid #e5e7eb", borderRight: "2px solid #e5e7eb", borderRadius: 8 };

  // ★ Fix 5: Edge hotspot base style
  const edgeHotBase: React.CSSProperties = {
    position: "absolute",
    zIndex: 2,
    cursor: "crosshair",
    background: "transparent",
  };

  return (
    <button
      onClick={(e) => {
        if (!active) {
          onActivate();
          return;
        }
        onSelect(e);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, voxelIndex);
      }}
      onMouseDown={(e) => onCellMouseDown(e)}
      onMouseEnter={() => { onHover(); onCellMouseEnterDrag(); }}
      onMouseLeave={onLeave}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        outline: "none",
        boxSizing: "border-box",
        overflow: "hidden",
        borderRadius: 8,
        cursor: "pointer",
        ...(gridColumn ? { gridColumn } : {}),
        ...(gridRow ? { gridRow } : {}),
        ...borderStyle,
        background: active ? (color === "transparent" ? "var(--surface-alt, #f8fafc)" : color) : (isCore ? "var(--input-bg, #f1f5f9)" : "var(--surface-alt, #fafbfc)"),
        boxShadow: active ? "inset 0 0 0 1px rgba(0,0,0,0.1)" : isHovered ? "0 0 0 1px #fef08a, 0 1px 4px rgba(254,240,138,0.3)" : "none",
        transition: "all 80ms ease",
      }}
      title={`Block [C${voxelIndex % VOXEL_COLS}, R${Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS)}]${active ? "" : " (click to deploy)"}${isLocked ? " locked" : ""}`}
    >
      {/* Floor material stripe at bottom of cell */}
      {hasFloor && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: "3px", background: floorColor, opacity: 0.7,
        }} />
      )}
      {isLocked && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 7, color: "#475569", pointerEvents: "none",
        }}>
          🔒
        </div>
      )}
      {!active && !isCore && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 14, color: "var(--text-muted, #94a3b8)",
          pointerEvents: "none", opacity: 0.6,
        }}>
          +
        </div>
      )}
      {/* ★ Fix 5: Clickable edge hotspots (only on active cells) */}
      {active && (
        <>
          {/* North edge */}
          <div
            style={{ ...edgeHotBase, top: 0, left: 4, right: 4, height: (edgeFace === "n" || syncFace === "n") ? 8 : 5,
              background: (edgeFace === "n" || syncFace === "n") ? "rgba(253,224,71,0.8)" : "transparent",
              borderRadius: (edgeFace === "n" || syncFace === "n") ? "4px 4px 0 0" : 0,
            }}
            onMouseEnter={(e) => { e.stopPropagation(); onEdgeHover("n"); }}
            onMouseLeave={(e) => { e.stopPropagation(); onEdgeLeave(); }}
            onClick={(e) => { e.stopPropagation(); onEdgeClick("n"); }}
          />
          {/* South edge */}
          <div
            style={{ ...edgeHotBase, bottom: 0, left: 4, right: 4, height: (edgeFace === "s" || syncFace === "s") ? 8 : 5,
              background: (edgeFace === "s" || syncFace === "s") ? "rgba(253,224,71,0.8)" : "transparent",
              borderRadius: (edgeFace === "s" || syncFace === "s") ? "0 0 4px 4px" : 0,
            }}
            onMouseEnter={(e) => { e.stopPropagation(); onEdgeHover("s"); }}
            onMouseLeave={(e) => { e.stopPropagation(); onEdgeLeave(); }}
            onClick={(e) => { e.stopPropagation(); onEdgeClick("s"); }}
          />
          {/* East edge */}
          <div
            style={{ ...edgeHotBase, right: 0, top: 4, bottom: 4, width: (edgeFace === "e" || syncFace === "e") ? 8 : 5,
              background: (edgeFace === "e" || syncFace === "e") ? "rgba(253,224,71,0.8)" : "transparent",
              borderRadius: (edgeFace === "e" || syncFace === "e") ? "0 4px 4px 0" : 0,
            }}
            onMouseEnter={(e) => { e.stopPropagation(); onEdgeHover("e"); }}
            onMouseLeave={(e) => { e.stopPropagation(); onEdgeLeave(); }}
            onClick={(e) => { e.stopPropagation(); onEdgeClick("e"); }}
          />
          {/* West edge */}
          <div
            style={{ ...edgeHotBase, left: 0, top: 4, bottom: 4, width: (edgeFace === "w" || syncFace === "w") ? 8 : 5,
              background: (edgeFace === "w" || syncFace === "w") ? "rgba(253,224,71,0.8)" : "transparent",
              borderRadius: (edgeFace === "w" || syncFace === "w") ? "4px 0 0 4px" : 0,
            }}
            onMouseEnter={(e) => { e.stopPropagation(); onEdgeHover("w"); }}
            onMouseLeave={(e) => { e.stopPropagation(); onEdgeLeave(); }}
            onClick={(e) => { e.stopPropagation(); onEdgeClick("w"); }}
          />
        </>
      )}
      {/* Face label indicator for hovered cell */}
      {isHovered && effectiveEdge && (
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          fontSize: 7, fontWeight: 800, color: "#92400e",
          pointerEvents: "none", textTransform: "uppercase",
          textShadow: "0 0 2px rgba(255,255,255,0.8)",
        }}>
          {effectiveEdge === "n" ? "N" : effectiveEdge === "s" ? "S" : effectiveEdge === "e" ? "E" : effectiveEdge === "w" ? "W" : effectiveEdge === "top" ? "TOP" : effectiveEdge === "bottom" ? "FLR" : ""}
        </div>
      )}
    </button>
  );
}

// ── Context menu item style (module-level to avoid recreation) ──
const ctxMenuItemStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left",
  padding: "7px 12px", border: "none", cursor: "pointer",
  background: "transparent", fontSize: 12, color: "var(--text-main, #1e293b)",
};

// ── Voxel Grid (4×8 for one level) ──────────────────────────

function VoxelGrid({
  container,
  containerId,
  level,
}: {
  container: Container;
  containerId: string;
  level: number;
}) {
  const selectedVoxel = useStore((s) => s.selectedVoxel);
  const selectedVoxels = useStore((s) => s.selectedVoxels);
  const setSelectedVoxels = useStore((s) => s.setSelectedVoxels);
  const toggleVoxelInSelection = useStore((s) => s.toggleVoxelInSelection);
  const lockedVoxels = useStore((s) => s.lockedVoxels);
  const hoveredVoxel = useStore((s) => s.hoveredVoxel);
  const hoveredVoxelEdge = useStore((s) => s.hoveredVoxelEdge);
  const setHoveredVoxel = useStore((s) => s.setHoveredVoxel);
  const setHoveredVoxelEdge = useStore((s) => s.setHoveredVoxelEdge);
  const cycleVoxelFace = useStore((s) => s.cycleVoxelFace);
  const setSelectedVoxelGrid = useStore((s) => s.setSelectedVoxel);
  const hoveredPreviewFace = useStore((s) => s.hoveredPreviewFace);
  const selectedFace = useStore((s) => s.selectedFace);
  const voxelContextMenu = useStore((s) => s.voxelContextMenu);
  const setVoxelActive = useStore((s) => s.setVoxelActive);
  const setVoxelAllFaces = useStore((s) => s.setVoxelAllFaces);
  const copyVoxel = useStore((s) => s.copyVoxel);
  const pasteVoxel = useStore((s) => s.pasteVoxel);

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; idx: number } | null>(null);

  // Multi-select / marquee drag state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<number>(-1);
  const justDraggedRef = useRef(false);
  const lastClickedRef = useRef<number>(-1);
  const [marqueeCells, setMarqueeCells] = useState<number[]>([]);
  const voxelGrid = container.voxelGrid ?? createDefaultVoxelGrid();
  const dims = CONTAINER_DIMENSIONS[container.size];

  const coreWidth = dims.length / 6;         // X per core col: ~2.03m
  const coreDepth = dims.width / 2;          // Z per core row: 1.22m
  const foldDepth = dims.height;             // halo outward projection = container height

  // Grid with spacer tracks between extension and body zones.
  // Layout: ext | 2px spacer | 6×body | 2px spacer | ext  (10 columns)
  //         ext | 2px spacer | 2×body | 2px spacer | ext  (6 rows)
  const gridCols = `${foldDepth}fr 2px repeat(6, ${coreWidth}fr) 2px ${foldDepth}fr`;
  const gridRows = `${foldDepth}fr 2px repeat(2, ${coreDepth}fr) 2px ${foldDepth}fr`;
  const totalW   = 2 * foldDepth + 6 * coreWidth;  // total physical width of 8-col grid
  const totalD   = 2 * foldDepth + 2 * coreDepth;  // total physical depth of 4-row grid

  const levelOffset = level * VOXEL_ROWS * VOXEL_COLS;

  // Hover handlers — set store's hoveredVoxel so ContainerSkin highlights in 3D
  const handleHover = useCallback((idx: number) => {
    setHoveredVoxel({ containerId, index: idx });
  }, [containerId, setHoveredVoxel]);

  const handleLeave = useCallback(() => {
    setHoveredVoxel(null);
    setHoveredVoxelEdge(null);
  }, [setHoveredVoxel, setHoveredVoxelEdge]);

  // ★ Fix 5: Edge interaction callbacks for 2D grid
  const handleEdgeHover = useCallback((idx: number, face: string) => {
    setHoveredVoxel({ containerId, index: idx });
    setHoveredVoxelEdge({ containerId, voxelIndex: idx, face: face as keyof import("@/types/container").VoxelFaces });
  }, [containerId, setHoveredVoxel, setHoveredVoxelEdge]);

  const handleEdgeLeave = useCallback(() => {
    setHoveredVoxelEdge(null);
  }, [setHoveredVoxelEdge]);

  const handleEdgeClick = useCallback((idx: number, face: string) => {
    setSelectedVoxelGrid({ containerId, index: idx });
    cycleVoxelFace(containerId, idx, face as keyof import("@/types/container").VoxelFaces);
  }, [containerId, setSelectedVoxelGrid, cycleVoxelFace]);

  // Context menu: open on right-click, close on outside click
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [ctxMenu]);

  const handleContextMenu = useCallback((e: React.MouseEvent, idx: number) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, idx });
  }, []);

  // Multi-select: Ctrl/Cmd=toggle, Shift=range-fill, plain click=single select
  const handleCellSelect = useCallback((idx: number, e: React.MouseEvent) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return; // marquee drag committed on mouseUp — skip click
    }
    if (e.ctrlKey || e.metaKey) {
      // Ctrl/Cmd+Click: toggle individual voxel in/out of multi-select
      toggleVoxelInSelection(containerId, idx);
      lastClickedRef.current = idx;
    } else if (e.shiftKey && lastClickedRef.current >= 0) {
      // Shift+Click: fill linear range [anchor → idx] row-by-row
      const a = Math.min(lastClickedRef.current, idx);
      const b = Math.max(lastClickedRef.current, idx);
      setSelectedVoxels({ containerId, indices: Array.from({ length: b - a + 1 }, (_, i) => a + i) });
      // anchor is NOT updated — allows extending range with successive Shift+Clicks
    } else {
      // Normal click: single select, clear multi-select
      setSelectedVoxelGrid({ containerId, index: idx });
      setSelectedVoxels(null);
      setMarqueeCells([]);
      lastClickedRef.current = idx;
    }
  }, [containerId, setSelectedVoxelGrid, setSelectedVoxels, toggleVoxelInSelection]);

  // Marquee drag: mouseDown starts drag, mouseEnter expands rect, mouseUp commits
  const handleCellMouseDown = useCallback((idx: number, e: React.MouseEvent) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey || e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartRef.current = idx;
    lastClickedRef.current = idx;  // set anchor when drag begins
  }, []);

  const handleCellMouseEnterDrag = useCallback((idx: number) => {
    if (!isDraggingRef.current || dragStartRef.current < 0) return;
    const startRaw = dragStartRef.current - levelOffset;
    const curRaw = idx - levelOffset;
    if (startRaw < 0 || curRaw < 0) return;
    const startRow = Math.floor(startRaw / VOXEL_COLS);
    const startCol = startRaw % VOXEL_COLS;
    const curRow = Math.floor(curRaw / VOXEL_COLS);
    const curCol = curRaw % VOXEL_COLS;
    const minRow = Math.min(startRow, curRow);
    const maxRow = Math.max(startRow, curRow);
    const minCol = Math.min(startCol, curCol);
    const maxCol = Math.max(startCol, curCol);
    const cells: number[] = [];
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        cells.push(levelOffset + r * VOXEL_COLS + c);
      }
    }
    setMarqueeCells(cells);
  }, [levelOffset]);

  // Commit marquee on mouseUp (on window to catch releases outside grid)
  React.useEffect(() => {
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      if (marqueeCells.length > 1) {
        setSelectedVoxels({ containerId, indices: marqueeCells });
        justDraggedRef.current = true;
      }
      dragStartRef.current = -1;
      setMarqueeCells([]);
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [containerId, marqueeCells, setSelectedVoxels]);

  // Map data col (0-7) to CSS grid column (1-indexed, with spacer tracks at 2 and 9)
  // Grid: ext(1) | spacer(2) | body×6(3-8) | spacer(9) | ext(10)
  // Columns are REVERSED in render: col 7 renders first (leftmost), col 0 last (rightmost)
  const colToGridCol = (col: number): number => {
    if (col === 0) return 10;   // extension right
    if (col === 7) return 1;    // extension left
    return 9 - col;             // body cols 6→3, 5→4, 4→5, 3→6, 2→7, 1→8
  };
  // Map data row (0-3) to CSS grid row (1-indexed, with spacer tracks at 2 and 5)
  // Grid: ext(1) | spacer(2) | body×2(3-4) | spacer(5) | ext(6)
  const rowToGridRow = (row: number): number => {
    if (row === 0) return 1;    // extension top
    if (row === 3) return 6;    // extension bottom
    return row + 2;             // body rows 1→3, 2→4
  };

  // Build rows (0=north → 3=south), columns REVERSED so col 0 (+X, FRONT) is on RIGHT
  const rows = useMemo(() => {
    const r: { voxelIndex: number; col: number; row: number; active: boolean; color: string; floorColor: string; isCore: boolean; isLocked: boolean }[][] = [];
    for (let row = 0; row < VOXEL_ROWS; row++) {
      const cells: typeof r[0] = [];
      for (let col = VOXEL_COLS - 1; col >= 0; col--) {
        const idx = levelOffset + row * VOXEL_COLS + col;
        const v = voxelGrid[idx];
        const isCore = (row === 1 || row === 2) && col >= 1 && col <= 6;
        cells.push({
          voxelIndex: idx,
          col,
          row,
          active: v?.active ?? false,
          color: v ? cellColor(v.faces) : "transparent",
          floorColor: v ? (SURFACE_COLORS[v.faces.bottom] ?? "transparent") : "transparent",
          isCore,
          isLocked: !!lockedVoxels[`${containerId}_${idx}`],
        });
      }
      r.push(cells);
    }
    return r;
  }, [voxelGrid, levelOffset, containerId, lockedVoxels]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* ★ Aspect-ratio wrapper — forces deterministic height from width so fr tracks distribute correctly */}
      <div style={{ width: "100%", height: "auto", aspectRatio: `${totalW} / ${totalD}` }}>
          {/* Main 8×4 grid — parametric columns + rows matching physical container proportions */}
          <div style={{
            width: "100%",
            height: "100%",
            display: "grid",
            gridTemplateColumns: gridCols,
            gridTemplateRows: gridRows,
            alignItems: "stretch",
            justifyItems: "stretch",
            gap: 2,
            padding: "4px",
            background: "var(--input-bg, #f1f5f9)",
            borderRadius: 6,
            position: "relative",
          }}>
          {/* Body/Core outline — highlights the interior container cells.
              position:absolute so it doesn't occupy grid cells and displace body voxels.
              Offset places border at the grid-line between extension and body tracks,
              creating equal padding on both sides (matching the grid gap). */}
          {/* Body/core border — centered on the spacer tracks between extensions and body */}
          <div style={{
            position: "absolute",
            top: `calc(${(foldDepth / totalD) * 100}% + 3px)`,
            bottom: `calc(${(foldDepth / totalD) * 100}% + 3px)`,
            left: `calc(${(foldDepth / totalW) * 100}% + 3px)`,
            right: `calc(${(foldDepth / totalW) * 100}% + 3px)`,
            border: "2px solid var(--text-main, #1e293b)",
            borderRadius: 4,
            pointerEvents: "none",
            zIndex: 1,
          }} />
          {rows.flat().map((cell) => {
            // ★ Strict union guard: extension → match col/row, real voxel → match index
            const isThisHovered = !!(
              hoveredVoxel?.containerId === containerId && (
                hoveredVoxel.isExtension
                  ? hoveredVoxel.col === cell.col && hoveredVoxel.row === cell.row
                  : hoveredVoxel.index === cell.voxelIndex
              ));
            const edgeFace = isThisHovered &&
              hoveredVoxelEdge?.containerId === containerId &&
              hoveredVoxelEdge?.voxelIndex === cell.voxelIndex
                ? hoveredVoxelEdge.face
                : null;
            // ★ Strict union guard: extension → match col/row, real voxel → match index
            const isThisSelected = !!(
              selectedVoxel?.containerId === containerId && (
                selectedVoxel.isExtension
                  ? selectedVoxel.col === cell.col && selectedVoxel.row === cell.row
                  : selectedVoxel.index === cell.voxelIndex
              ));
            const isThisMultiSelected = !!(
              selectedVoxels?.containerId === containerId &&
              selectedVoxels.indices.includes(cell.voxelIndex)
            ) || marqueeCells.includes(cell.voxelIndex);
            // ★ Omni-sync: Cell View hover > persistent selectedFace > context menu faceDir → cyan CSS border
            const syncFace = isThisSelected
              ? (hoveredPreviewFace as string | null)
                ?? (selectedFace as string | null)
                ?? (voxelContextMenu?.containerId === containerId
                    && voxelContextMenu?.voxelIndex === cell.voxelIndex
                    ? (voxelContextMenu.faceDir ?? null)
                    : null)
              : null;
            return (
              <GridCell
                key={cell.voxelIndex}
                voxelIndex={cell.voxelIndex}
                containerId={containerId}
                active={cell.active}
                color={cell.color}
                floorColor={cell.floorColor}
                isSelected={isThisSelected}
                isMultiSelected={isThisMultiSelected}
                isHovered={isThisHovered}
                edgeFace={edgeFace}
                syncFace={syncFace}
                isCore={cell.isCore}
                isLocked={cell.isLocked}
                gridColumn={colToGridCol(cell.col)}
                gridRow={rowToGridRow(cell.row)}
                onHover={() => handleHover(cell.voxelIndex)}
                onLeave={handleLeave}
                onEdgeHover={(face) => handleEdgeHover(cell.voxelIndex, face)}
                onEdgeLeave={handleEdgeLeave}
                onEdgeClick={(face) => handleEdgeClick(cell.voxelIndex, face)}
                onSelect={(e) => handleCellSelect(cell.voxelIndex, e)}
                onCellMouseDown={(e) => handleCellMouseDown(cell.voxelIndex, e)}
                onCellMouseEnterDrag={() => handleCellMouseEnterDrag(cell.voxelIndex)}
                onActivate={() => {
                  setVoxelActive(containerId, cell.voxelIndex, true);
                  setSelectedVoxelGrid({ containerId, index: cell.voxelIndex });
                }}
                onContextMenu={handleContextMenu}
              />
            );
          })}
          </div>
      </div>
      {ctxMenu && (() => {
        const v = voxelGrid[ctxMenu.idx];
        const isActive = v?.active ?? false;
        return (
          <div style={{
            position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 100,
            background: "var(--bg-panel, #fff)", borderRadius: 8,
            border: "1px solid var(--border, #e2e8f0)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
            minWidth: 160, overflow: "hidden",
          }}>
            <button onClick={() => { setVoxelActive(containerId, ctxMenu.idx, !isActive); setCtxMenu(null); }}
              style={ctxMenuItemStyle}>
              {isActive ? "Deactivate" : "Activate"}
            </button>
            {isActive && <>
              <div style={{ height: 1, background: "var(--border, #e2e8f0)" }} />
              <button onClick={() => { setVoxelAllFaces(containerId, ctxMenu.idx, 'Glass_Pane'); setCtxMenu(null); }}
                style={ctxMenuItemStyle}>Set All → Glass</button>
              <button onClick={() => { setVoxelAllFaces(containerId, ctxMenu.idx, 'Solid_Steel'); setCtxMenu(null); }}
                style={ctxMenuItemStyle}>Set All → Steel</button>
              <button onClick={() => { setVoxelAllFaces(containerId, ctxMenu.idx, 'Open'); setCtxMenu(null); }}
                style={ctxMenuItemStyle}>Set All → Open</button>
              <div style={{ height: 1, background: "var(--border, #e2e8f0)" }} />
              <button onClick={() => { copyVoxel(containerId, ctxMenu.idx); setCtxMenu(null); }}
                style={ctxMenuItemStyle}>Copy Style</button>
              <button onClick={() => { pasteVoxel(containerId, ctxMenu.idx); setCtxMenu(null); }}
                style={ctxMenuItemStyle}>Paste Style</button>
            </>}
          </div>
        );
      })()}
    </div>
  );
}

// ── Level Toggle ─────────────────────────────────────────────

function LevelToggle({
  activeLevel,
  onChange,
}: {
  activeLevel: number;
  onChange: (l: number) => void;
}) {
  const labels = ["Floor", "Roof"];
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[0, 1].map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          style={{
            flex: 1,
            padding: "3px 0",
            borderRadius: 4,
            fontSize: 9,
            fontWeight: activeLevel === l ? 700 : 500,
            border: activeLevel === l ? "1px solid var(--accent, #2563eb)" : "1px solid var(--border, #e2e8f0)",
            background: activeLevel === l ? "var(--accent, #2563eb)" : "var(--btn-bg, #fff)",
            color: activeLevel === l ? "#fff" : "var(--text-dim, #94a3b8)",
            cursor: "pointer",
            transition: "all 100ms ease",
          }}
        >
          {labels[l]}
        </button>
      ))}
    </div>
  );
}

// ── Simple Bay Grid ──────────────────────────────────────────

const BAY_GROUPS = computeBayGroups();

function SimpleBayGrid({
  container,
  containerId,
  level,
}: {
  container: Container;
  containerId: string;
  level: number;
}) {
  const setSelectedVoxel = useStore((s) => s.setSelectedVoxel);
  const setSelectedVoxels = useStore((s) => s.setSelectedVoxels);
  const activeBrush = useStore((s) => s.activeBrush);
  const activeSlot = useStore((s) => s.activeHotbarSlot);
  const setVoxelFace = useStore((s) => s.setVoxelFace);
  const setHoveredBayGroup = useStore((s) => s.setHoveredBayGroup);
  const setSelectedFace = useStore((s) => s.setSelectedFace);
  const selectedVoxels = useStore((s) => s.selectedVoxels);
  const selectedVoxel = useStore((s) => s.selectedVoxel);
  const hoveredBayGroup = useStore((s) => s.hoveredBayGroup);
  const voxelGrid = container.voxelGrid ?? createDefaultVoxelGrid();
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);
  const dims = CONTAINER_DIMENSIONS[container.size];

  const hasTool = activeBrush !== null || activeSlot !== null;

  // Proportional grid template matching actual container dimensions
  const coreWidth = dims.length / 6;    // ~2.03m per body col
  const coreDepth = dims.width / 2;     // 1.22m per body row
  const foldDepth = dims.height;        // 2.90m extension projection
  const gridCols = `${foldDepth}fr 2px repeat(6, ${coreWidth}fr) 2px ${foldDepth}fr`;
  const gridRows = `${foldDepth}fr 2px repeat(2, ${coreDepth}fr) 2px ${foldDepth}fr`;

  const handleBayClick = useCallback((group: BayGroup) => {
    const indices = group.voxelIndices.map((i) => level * VOXEL_ROWS * VOXEL_COLS + i);

    // If brush active, paint dominant face on all voxels in group
    if (activeBrush) {
      for (const idx of indices) {
        // Paint all wall faces
        for (const face of ['n', 's', 'e', 'w'] as const) {
          setVoxelFace(containerId, idx, face, activeBrush);
        }
      }
      return;
    }

    // Select all voxels in group (store handles mutual exclusion)
    if (indices.length === 1) {
      setSelectedVoxel({ containerId, index: indices[0] });
    } else {
      setSelectedVoxels({ containerId, indices });
    }
    // Set a default face so sidebar shows face configuration (FinishesPanel)
    // Use 's' (south/front) as default — the face visible from the default camera angle
    setSelectedFace('s');
  }, [level, containerId, activeBrush, setVoxelFace, setSelectedVoxel, setSelectedVoxels, setSelectedFace]);

  const handleBayHover = useCallback((group: BayGroup) => {
    setHoveredGroupId(group.id);
    const indices = group.voxelIndices.map((i) => level * VOXEL_ROWS * VOXEL_COLS + i);
    setHoveredBayGroup({ containerId, indices });
  }, [level, containerId, setHoveredBayGroup]);

  const handleBayLeave = useCallback(() => {
    setHoveredGroupId(null);
    setHoveredBayGroup(null);
  }, [setHoveredBayGroup]);

  // Brush preview color for ghost overlay
  const brushPreviewColor = activeBrush ? (SURFACE_COLORS[activeBrush] ?? "#78909c") : null;

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: gridCols,
      gridTemplateRows: gridRows,
      gap: "2px",
      aspectRatio: `${dims.length + 2 * dims.height} / ${dims.width + 2 * dims.height}`,
    }}>
      {BAY_GROUPS.map((group) => {
        // Compute dominant color from voxels in this group
        const colors = group.voxelIndices.map((i) => {
          const idx = level * VOXEL_ROWS * VOXEL_COLS + i;
          const v = voxelGrid[idx];
          if (!v) return "transparent";
          return cellColor(v.faces);
        });
        const dominantColor = colors.find((c) => c !== "transparent") ?? "var(--input-bg, #f1f5f9)";

        // Check if this bay group is currently selected or hovered
        const levelOffset = level * VOXEL_ROWS * VOXEL_COLS;
        // Hover: local state (2D hover) OR store (3D hover reflected in 2D)
        const isHoveredFrom3D = hoveredBayGroup && hoveredBayGroup.containerId === containerId &&
          group.voxelIndices.some((i) => hoveredBayGroup.indices.includes(levelOffset + i));
        const isHovered = hoveredGroupId === group.id || !!isHoveredFrom3D;
        const groupIndicesAtLevel = group.voxelIndices.map((i) => levelOffset + i);
        const isSelected = (() => {
          // Multi-select: check if selectedVoxels matches this group
          if (selectedVoxels && selectedVoxels.containerId === containerId) {
            return groupIndicesAtLevel.every((idx) => selectedVoxels.indices.includes(idx));
          }
          // Single select: check if selectedVoxel is in this group (for 1-voxel groups)
          if (selectedVoxel && selectedVoxel.containerId === containerId && !selectedVoxel.isExtension && selectedVoxel.index !== undefined) {
            return groupIndicesAtLevel.includes(selectedVoxel.index);
          }
          return false;
        })();

        // Ghost preview: when hovering with a tool, show what the result would look like
        const showBrushPreview = isHovered && hasTool && brushPreviewColor;
        const bgColor = showBrushPreview
          ? brushPreviewColor
          : dominantColor === "transparent" ? "var(--surface-alt, #f8fafc)" : dominantColor;

        // Adjust grid positions for spacer tracks (col 2 and col 9 are 2px spacers)
        const adjCol = group.gridCol <= 1 ? group.gridCol : group.gridCol <= 7 ? group.gridCol + 1 : group.gridCol + 2;
        const adjRow = group.gridRow <= 1 ? group.gridRow : group.gridRow <= 3 ? group.gridRow + 1 : group.gridRow + 2;

        return (
          <button
            key={group.id}
            onClick={() => handleBayClick(group)}
            onMouseEnter={() => handleBayHover(group)}
            onMouseLeave={handleBayLeave}
            style={{
              gridRow: `${adjRow} / span ${group.rowSpan}`,
              gridColumn: `${adjCol} / span ${group.colSpan}`,
              background: bgColor,
              border: isSelected
                ? "2px solid #3b82f6"  // blue selection ring
                : isHovered
                  ? hasTool
                    ? "2px solid #fbbf24"  // amber ring when tool active
                    : "2px solid #94a3b8"  // neutral hover
                  : "2px solid var(--border, #e2e8f0)",  // default
              borderRadius: "6px",
              cursor: hasTool ? "crosshair" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "7px",
              fontWeight: 600,
              minWidth: 0,       // allow grid fr to control sizing
              overflow: "hidden", // prevent text from forcing wider
              color: (showBrushPreview || (dominantColor !== "transparent" && dominantColor !== "var(--input-bg, #f1f5f9)")) ? "#fff" : "#94a3b8",
              textShadow: (showBrushPreview || (dominantColor !== "transparent" && dominantColor !== "var(--input-bg, #f1f5f9)")) ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
              transition: "all 100ms ease",
              opacity: group.role === 'corner' ? 0.6 : 1,
              boxShadow: isSelected
                ? "0 0 8px rgba(59,130,246,0.4), inset 0 0 0 1px rgba(255,255,255,0.3)"
                : isHovered && hasTool
                  ? "0 0 8px rgba(251,191,36,0.5), inset 0 0 0 1px rgba(255,255,255,0.3)"
                  : isHovered
                    ? "0 0 6px rgba(148,163,184,0.3)"
                    : "none",
              position: "relative",
            }}
            title={`${group.label}${hasTool ? " — click to apply" : ""}`}
          >
            {group.label}
            {/* Ghost preview overlay when hovering with tool */}
            {showBrushPreview && (
              <div style={{
                position: "absolute", inset: 0, borderRadius: 4,
                background: "linear-gradient(135deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 100%)",
                pointerEvents: "none",
              }} />
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Frame Grid Overlay ────────────────────────────────────────

function FrameGridOverlay({ containerId, level }: { containerId: string; level: number }) {
  const selectedFrameElement = useStore((s) => s.selectedFrameElement);
  const setSelectedFrameElement = useStore((s) => s.setSelectedFrameElement);
  const container = useStore((s) => s.containers[containerId]);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  const rows = VOXEL_ROWS; // 4
  const cols = VOXEL_COLS; // 8

  const padding = 12;
  const cellW = 28;
  const cellH = 28;
  const svgW = cols * cellW + padding * 2;
  const svgH = rows * cellH + padding * 2;

  const HOVER_COLOR = HIGHLIGHT_COLOR_HOVER;
  const SELECT_COLOR = HIGHLIGHT_COLOR_SELECT;
  const GRID_COLOR = '#94a3b8';
  const BG_COLOR = '#f8fafc';
  const HIDDEN_DASH = '3,2';

  const sel = selectedFrameElement;

  const rails: React.ReactElement[] = [];
  const poles: React.ReactElement[] = [];

  // Horizontal rails: (rows+1) horizontal lines, each divided into `cols` segments
  for (let vr = 0; vr <= rows; vr++) {
    for (let c = 0; c < cols; c++) {
      const key = makeRailKey(vr, c, 'h');
      const isHovered = hoveredElement === key;
      const isSelected = sel?.key === key && sel?.containerId === containerId;
      const override = container?.railOverrides?.[key];
      const isHidden = override?.visible === false;

      const x1 = padding + c * cellW;
      const x2 = padding + (c + 1) * cellW;
      const y = padding + vr * cellH;

      rails.push(
        <line key={`line_${key}`}
          x1={x1} y1={y} x2={x2} y2={y}
          stroke={isSelected ? SELECT_COLOR : isHovered ? HOVER_COLOR : GRID_COLOR}
          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1}
          strokeDasharray={isHidden ? HIDDEN_DASH : undefined}
        />
      );
      rails.push(
        <rect key={`hit_${key}`}
          x={x1} y={y - 4} width={cellW} height={8}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHoveredElement(key)}
          onMouseLeave={() => setHoveredElement(null)}
          onClick={() => setSelectedFrameElement({ containerId, key, type: 'rail' })}
        />
      );
    }
  }

  // Vertical rails: (cols+1) vertical lines, each divided into `rows` segments
  for (let r = 0; r < rows; r++) {
    for (let vc = 0; vc <= cols; vc++) {
      const key = makeRailKey(r, vc, 'v');
      const isHovered = hoveredElement === key;
      const isSelected = sel?.key === key && sel?.containerId === containerId;
      const override = container?.railOverrides?.[key];
      const isHidden = override?.visible === false;

      const x = padding + vc * cellW;
      const y1 = padding + r * cellH;
      const y2 = padding + (r + 1) * cellH;

      rails.push(
        <line key={`line_${key}`}
          x1={x} y1={y1} x2={x} y2={y2}
          stroke={isSelected ? SELECT_COLOR : isHovered ? HOVER_COLOR : GRID_COLOR}
          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : 1}
          strokeDasharray={isHidden ? HIDDEN_DASH : undefined}
        />
      );
      rails.push(
        <rect key={`hit_${key}`}
          x={x - 4} y={y1} width={8} height={cellH}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHoveredElement(key)}
          onMouseLeave={() => setHoveredElement(null)}
          onClick={() => setSelectedFrameElement({ containerId, key, type: 'rail' })}
        />
      );
    }
  }

  // Poles at intersections: (rows+1) × (cols+1) vertices
  for (let vr = 0; vr <= rows; vr++) {
    for (let vc = 0; vc <= cols; vc++) {
      // Map vertex (vr, vc) to cell + corner: use the cell to the south-east of the vertex
      const poleRow = Math.min(vr, rows - 1);
      const poleCol = Math.min(vc, cols - 1);
      const corner = `${vr === 0 ? 'n' : 's'}${vc === 0 ? 'w' : 'e'}`;
      const key = makePoleKey(level, poleRow, poleCol, corner);

      const isHovered = hoveredElement === key;
      const isSelected = sel?.key === key && sel?.containerId === containerId;
      const override = container?.poleOverrides?.[key];
      const isHidden = override?.visible === false;

      const cx = padding + vc * cellW;
      const cy = padding + vr * cellH;
      const radius = isSelected ? 5 : isHovered ? 4.5 : 3;

      poles.push(
        <circle key={`pole_${key}`}
          cx={cx} cy={cy} r={radius}
          fill={isHidden ? 'transparent' : isSelected ? SELECT_COLOR : isHovered ? HOVER_COLOR : '#64748b'}
          stroke={isHidden ? GRID_COLOR : 'none'}
          strokeWidth={isHidden ? 1 : 0}
          strokeDasharray={isHidden ? HIDDEN_DASH : undefined}
          style={{ cursor: 'pointer' }}
          onMouseEnter={() => setHoveredElement(key)}
          onMouseLeave={() => setHoveredElement(null)}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedFrameElement({ containerId, key, type: 'pole' });
          }}
        />
      );
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
        <rect x={padding} y={padding} width={cols * cellW} height={rows * cellH}
          fill={BG_COLOR} rx={2} />
        {Array.from({ length: rows }).map((_, r) =>
          Array.from({ length: cols }).map((_, c) => (
            <rect key={`cell_${r}_${c}`}
              x={padding + c * cellW + 1} y={padding + r * cellH + 1}
              width={cellW - 2} height={cellH - 2}
              fill="#f1f5f9" rx={1}
            />
          ))
        )}
        {rails}
        {poles}
      </svg>
      <div style={{ textAlign: 'center', fontSize: 8, color: '#94a3b8', marginTop: 2 }}>
        Frame Grid — {rows}×{cols}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function MatrixEditor({
  container,
  containerId,
}: {
  container: Container;
  containerId: string;
}) {
  const selectedVoxel    = useStore((s) => s.selectedVoxel);
  const setSelectedVoxel = useStore((s) => s.setSelectedVoxel);
  const selectedVoxels   = useStore((s) => s.selectedVoxels);
  const saveBlockToLibrary = useStore((s) => s.saveBlockToLibrary);
  const globalCullSet    = useStore((s) => s.globalCullSet);
  const setAllExtensions = useStore((s) => s.setAllExtensions);
  const cycleVoxelFace = useStore((s) => s.cycleVoxelFace);

  const [deployMenuOpen, setDeployMenuOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!deployMenuOpen) return;
    const handleClickOutside = () => setDeployMenuOpen(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [deployMenuOpen]);

  const voxelGrid = container.voxelGrid ?? createDefaultVoxelGrid();

  const isVoxelSelected = selectedVoxel?.containerId === containerId;
  // Bay group selection — use first index as representative voxel
  const isBaySelected = selectedVoxels?.containerId === containerId && selectedVoxels.indices.length > 0;
  // ★ Guard: extension tiles have no grid index — skip grid lookup
  const isRealVoxel = isVoxelSelected && selectedVoxel && !selectedVoxel.isExtension;
  const isExtVoxel  = isVoxelSelected && selectedVoxel && !!selectedVoxel.isExtension;
  const selVoxel = isRealVoxel ? voxelGrid[selectedVoxel.index]
    : isBaySelected ? voxelGrid[selectedVoxels!.indices[0]]
    : null;
  // Compute a grid index for VoxelPreview3D — real voxels use .index, extensions derive from col/row
  const selIdx   = isRealVoxel ? selectedVoxel.index
    : isExtVoxel ? (selectedVoxel.row * VOXEL_COLS + selectedVoxel.col)
    : isBaySelected ? selectedVoxels!.indices[0]
    : -1;

  const selCol = isExtVoxel ? selectedVoxel.col
    : (typeof selIdx === 'number' && selIdx >= 0) ? selIdx % VOXEL_COLS : 0;
  const selRow = isExtVoxel ? selectedVoxel.row
    : (typeof selIdx === 'number' && selIdx >= 0) ? Math.floor((selIdx % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS) : 0;
  const selLevel = (typeof selIdx === 'number' && selIdx >= 0)
    ? Math.floor(selIdx / (VOXEL_ROWS * VOXEL_COLS)) : 0;

  // Compute effective faces for the preview: apply globalCullSet + within-container adjacency culling.
  // Culled faces (shared walls, global adjacency) are shown as 'Open' so the preview matches the 3D view.
  const effectiveFaces = useMemo((): Partial<VoxelFaces> | undefined => {
    if (!selVoxel || selIdx < 0) return undefined;
    const HORIZ_DIRS: (keyof VoxelFaces)[] = ['n', 's', 'e', 'w'];
    const ALL_DIRS: (keyof VoxelFaces)[] = ['n', 's', 'e', 'w', 'top', 'bottom'];
    const override: Partial<VoxelFaces> = {};

    // E/W adjacency inversion: E(+X) maps to col-1, W(-X) maps to col+1 (negated X mapping)
    const adjDelta: Record<string, [number, number]> = {
      n: [0, -1], s: [0, 1], e: [-1, 0], w: [1, 0],
    };

    for (const dir of ALL_DIRS) {
      // 1. Global cull set (cross-container adjacency)
      if (globalCullSet.has(`${containerId}:${selIdx}:${dir}`)) {
        override[dir] = 'Open';
        continue;
      }
      // 2. Within-container adjacency (horizontal only)
      if (HORIZ_DIRS.includes(dir)) {
        const [dc, dr] = adjDelta[dir];
        const nc = selCol + dc, nr = selRow + dr;
        if (nc >= 0 && nc < VOXEL_COLS && nr >= 0 && nr < VOXEL_ROWS) {
          const ni = nr * VOXEL_COLS + nc;
          if (voxelGrid[ni]?.active) {
            override[dir] = 'Open';
          }
        }
      }
    }
    return Object.keys(override).length > 0 ? override : undefined;
  }, [selVoxel, selIdx, selCol, selRow, containerId, voxelGrid, globalCullSet]);

  const inspectorView = useStore((s) => s.inspectorView);
  const setInspectorView = useStore((s) => s.setInspectorView);
  const gridLevel = inspectorView === 'ceiling' ? 1 : 0;

  const designComplexity = useStore((s) => s.designComplexity);
  const setDesignComplexity = useStore((s) => s.setDesignComplexity);

  const frameMode = useStore((s) => s.frameMode);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

      {/* ── Section Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #64748b)",
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          Container Grid
        </div>
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setDeployMenuOpen(!deployMenuOpen)}
            style={{
              fontSize: 10, fontWeight: 600, padding: "3px 8px",
              borderRadius: 6, border: "1px solid var(--border, #cbd5e1)",
              background: "var(--btn-bg, #fff)", cursor: "pointer",
              color: "var(--text-muted, #64748b)",
            }}
          >
            Deploy ▾
          </button>
          {deployMenuOpen && (
            <div style={{
              position: "absolute", top: "100%", right: 0, zIndex: 30,
              background: "var(--bg-panel, #fff)", borderRadius: 8,
              border: "1px solid var(--border, #e2e8f0)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              minWidth: 160, marginTop: 4, overflow: "hidden",
            }}>
              {([
                { label: "All Extensions", config: "all_deck" as ExtensionConfig },
                { label: "All + Interior", config: "all_interior" as ExtensionConfig },
                { label: "North Decks", config: "north_deck" as ExtensionConfig },
                { label: "South Decks", config: "south_deck" as ExtensionConfig },
                { label: "Retract All", config: "none" as ExtensionConfig },
              ]).map(item => (
                <button
                  key={item.config}
                  onClick={() => {
                    setAllExtensions(containerId, item.config);
                    setDeployMenuOpen(false);
                  }}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 12px", border: "none", cursor: "pointer",
                    background: "transparent", fontSize: 12, fontWeight: 500,
                    color: item.config === "none" ? "#ef4444" : "var(--text-main, #1e293b)",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--input-bg, #f1f5f9)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Level selector moved to TopToolbar (inspectorView: floor/ceiling) */}

      {/* ── Frame Grid, Bay Grid, or Voxel Grid ── */}
      {frameMode ? (
        <FrameGridOverlay containerId={containerId} level={gridLevel} />
      ) : designComplexity === 'simple' ? (
        <SimpleBayGrid container={container} containerId={containerId} level={gridLevel} />
      ) : (
        <VoxelGrid container={container} containerId={containerId} level={gridLevel} />
      )}

      {/* ── Grid Legend ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: "0 2px" }}>
        {([
          ["#78909c", "Steel"],
          ["#60a5fa", "Glass"],
          ["#8d6e63", "Wood"],
          ["#607d8b", "Rail"],
        ] as const).map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c, border: "1px solid rgba(0,0,0,0.1)" }} />
            <span style={{ fontSize: 8, color: "#94a3b8", fontWeight: 600 }}>{l}</span>
          </div>
        ))}
      </div>

      {/* ── CubeInspector — Interactive 3D Block Preview ──── */}
      {(isVoxelSelected || isBaySelected) && selIdx >= 0 && (
        <>
          <div style={{ height: "1px", background: "#e2e8f0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{
                fontSize: "10px", fontWeight: 700, color: "var(--text-main, #334155)",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                {selectedVoxels?.containerId === containerId && selectedVoxels.indices.length > 1
                  ? `${selectedVoxels.indices.length} Tiles`
                  : `Tile Detail`
                }
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                {selVoxel && (
                  <button
                    onClick={() => {
                      const f = selVoxel.faces;
                      const label = `${f.n === 'Glass_Pane' || f.s === 'Glass_Pane' ? 'Glass' : f.n === 'Open' ? 'Open' : 'Steel'} Block`;
                      saveBlockToLibrary(label, f);
                    }}
                    style={{
                      background: "none", border: "1px solid var(--border, #e2e8f0)", borderRadius: "4px",
                      cursor: "pointer", padding: "2px 4px",
                      color: "var(--text-muted, #64748b)", display: "flex", alignItems: "center",
                      transition: "all 100ms ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#f59e0b"; e.currentTarget.style.borderColor = "#f59e0b"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = ""; e.currentTarget.style.borderColor = ""; }}
                    title="Save block to library"
                  >
                    <BookmarkPlus size={11} />
                  </button>
                )}
                <button
                  onClick={() => { setSelectedVoxel(null); useStore.getState().setSelectedVoxels(null); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#94a3b8", padding: "0 2px" }}
                  title="Deselect block"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Room Tag */}
            {selVoxel && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted, #64748b)" }}>Room:</span>
                <select
                  value={selVoxel.roomTag ?? ""}
                  onChange={(e) => {
                    const tag = e.target.value || undefined;
                    // Bay group: apply room tag to all voxels in group
                    if (isBaySelected) {
                      for (const bi of selectedVoxels!.indices) useStore.getState().setVoxelRoomTag(containerId, bi, tag);
                    } else {
                      useStore.getState().setVoxelRoomTag(containerId, selIdx, tag);
                    }
                  }}
                  style={{
                    flex: 1, fontSize: 10, padding: "2px 4px", borderRadius: 4,
                    border: "1px solid var(--border, #e2e8f0)", background: "var(--btn-bg, #fff)", color: "var(--text-main, #374151)",
                    cursor: "pointer",
                  }}
                >
                  <option value="">None</option>
                  <option value="Kitchen">Kitchen</option>
                  <option value="Bedroom">Bedroom</option>
                  <option value="Bathroom">Bathroom</option>
                  <option value="Living Room">Living Room</option>
                  <option value="Office">Office</option>
                  <option value="Storage">Storage</option>
                  <option value="Hallway">Hallway</option>
                  <option value="Deck">Deck</option>
                </select>
              </div>
            )}

            {/* Door Configuration */}
            {selVoxel && (() => {
              // Find any face on this voxel that is Door type and has doorConfig
              const doorFaces = (['n','s','e','w'] as const).filter(
                f => selVoxel.faces[f] === 'Door' && selVoxel.doorConfig?.[f]
              );
              if (doorFaces.length === 0) return null;
              const doorFace = doorFaces[0];
              const cfg = selVoxel.doorConfig![doorFace]!;
              const constraints = useStore.getState().getDoorConstraints(containerId, selIdx, doorFace);
              return (
                <div style={{
                  marginTop: 4, padding: '8px 10px', background: 'rgba(0,0,0,0.04)',
                  borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    Door Configuration
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {([
                      { label: 'Hinge', options: ['left', 'right'] as const, value: cfg.hingeEdge, key: 'hingeEdge', disabled: (_: string) => false, tooltip: (_: string) => '' },
                      { label: 'Swing', options: ['in', 'out'] as const, value: cfg.swingDirection, key: 'swingDirection', disabled: (_: string) => cfg.type !== 'swing', tooltip: (_: string) => cfg.type !== 'swing' ? 'Only for swing doors' : '' },
                      { label: 'Type', options: ['swing', 'slide'] as const, value: cfg.type, key: 'type',
                        disabled: (opt: string) => (opt === 'swing' && !constraints.canSwing) || (opt === 'slide' && !constraints.canSlide),
                        tooltip: (opt: string) => opt === 'swing' && !constraints.canSwing ? (constraints.swingBlockReason ?? '') : opt === 'slide' && !constraints.canSlide ? (constraints.slideBlockReason ?? '') : '',
                      },
                    ] as const).map(({ label, options, value, key, disabled, tooltip }) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 9, color: '#9ca3af' }}>{label}</span>
                        <div style={{ display: 'flex', gap: 1 }}>
                          {options.map(opt => {
                            const isDisabled = disabled(opt);
                            const tip = tooltip(opt);
                            return (
                              <button
                                key={opt}
                                onClick={() => !isDisabled && useStore.getState().setDoorConfig(containerId, selIdx, doorFace, { [key]: opt } as any)}
                                title={tip || undefined}
                                style={{
                                  padding: '2px 6px', fontSize: 10, borderRadius: 4,
                                  background: value === opt ? '#3b82f6' : isDisabled ? 'rgba(0,0,0,0.03)' : 'rgba(0,0,0,0.06)',
                                  color: value === opt ? 'white' : isDisabled ? '#d1d5db' : '#374151',
                                  border: 'none', cursor: isDisabled ? 'not-allowed' : 'pointer', fontWeight: 500,
                                  opacity: isDisabled ? 0.5 : 1,
                                }}
                              >
                                {opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  {(!constraints.canSwing || !constraints.canSlide) && (
                    <span style={{ fontSize: 9, color: '#f59e0b', fontStyle: 'italic' }}>
                      {constraints.swingBlockReason || constraints.slideBlockReason}
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Batch controls for multi-selection, single-face schematic otherwise */}
            {selectedVoxels?.containerId === containerId && selectedVoxels.indices.length > 1
              ? (
                <BatchFaceControls
                  containerId={containerId}
                  indices={selectedVoxels.indices}
                />
              )
              : selVoxel && (
                <FaceSchematic
                  faces={selVoxel.faces}
                  onCycleFace={(face) => {
                    cycleVoxelFace(containerId, selIdx, face);
                  }}
                />
              )
            }

            {/* Interactive 3D Cube Inspector — collapsible */}
            <button
              onClick={() => setPreviewOpen(!previewOpen)}
              style={{
                width: "100%", textAlign: "left", padding: "6px 8px",
                fontSize: 10, fontWeight: 600, color: "var(--text-muted, #64748b)",
                background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              {previewOpen ? "▾" : "▸"} 3D Preview
            </button>
            {previewOpen && (
              <VoxelPreview3D
                containerId={containerId}
                voxelIndex={selIdx}
                overrideFaces={effectiveFaces}
                bayGroupIndices={isBaySelected ? selectedVoxels!.indices : undefined}
              />
            )}

          </div>
        </>
      )}

      {/* Empty state hint removed — unhelpful */}
    </div>
  );
}
