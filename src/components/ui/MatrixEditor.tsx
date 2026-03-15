"use client";

/**
 * MatrixEditor.tsx — 32-Block Command Grid + 3D Cube Inspector
 *
 * Two sections:
 *   1. Interactive 8×4 voxel grid — click to select, hover to highlight in 3D canvas
 *   2. VoxelPreview3D cube — shows the selected block's 6 faces, click to cycle
 */

import React, { useMemo, useCallback, useState, useRef } from "react";
import { useStore, autoStairDir } from "@/store/useStore";
import {
  type Container,
  type SurfaceType,
  type VoxelFaces,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  CONTAINER_DIMENSIONS,
} from "@/types/container";
import { createDefaultVoxelGrid } from "@/types/factories";
import VoxelPreview3D from "@/components/ui/VoxelPreview3D";
import { BookmarkPlus } from "lucide-react";
import { computeBayGroups, type BayGroup } from "@/config/bayGroups";

// ── Face-color mapping for grid cells ────────────────────────

const SURFACE_COLORS: Record<SurfaceType, string> = {
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
function cellColor(faces: { n: SurfaceType; s: SurfaceType; e: SurfaceType; w: SurfaceType; top: SurfaceType }): string {
  for (const f of [faces.n, faces.s, faces.e, faces.w, faces.top]) {
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
  onHover,
  onLeave,
  onEdgeHover,
  onEdgeLeave,
  onEdgeClick,
  onSelect,
  onCellMouseDown,
  onCellMouseEnterDrag,
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
  onHover: () => void;
  onLeave: () => void;
  onEdgeHover: (face: string) => void;
  onEdgeLeave: () => void;
  onEdgeClick: (face: string) => void;
  onSelect: (e: React.MouseEvent) => void;
  onCellMouseDown: (e: React.MouseEvent) => void;
  onCellMouseEnterDrag: () => void;
}) {

  // Active cells show floor material color as a subtle bottom stripe
  const hasFloor = active && floorColor !== "transparent";

  // Determine effective edge highlight: direct 3D hover > Cell View sync > context menu
  const effectiveEdge = edgeFace || syncFace;

  const borderStyle = isSelected && syncFace
    ? {
        borderTop:    syncFace === "n" ? "3px solid #06b6d4" : "2px solid #2563eb",
        borderBottom: syncFace === "s" ? "3px solid #06b6d4" : "2px solid #2563eb",
        borderRight:  syncFace === "e" ? "3px solid #06b6d4" : "2px solid #2563eb",
        borderLeft:   syncFace === "w" ? "3px solid #06b6d4" : "2px solid #2563eb",
      }
    : isSelected
      ? { border: "2px solid #2563eb" }
    : isMultiSelected
      ? { border: "2px solid #1565c0" }
    : isHovered && effectiveEdge
      ? (effectiveEdge === "top" || effectiveEdge === "bottom")
        ? { border: "2px solid #fde047", background: `rgba(253,224,71,0.25)` }
        : {
            borderTop:    effectiveEdge === "n" ? "3px solid #fde047" : "1px solid #fef08a",
            borderBottom: effectiveEdge === "s" ? "3px solid #fde047" : "1px solid #fef08a",
            borderRight:  effectiveEdge === "e" ? "3px solid #fde047" : "1px solid #fef08a",
            borderLeft:   effectiveEdge === "w" ? "3px solid #fde047" : "1px solid #fef08a",
          }
      : isHovered
        ? { border: "2px solid #fef08a" }
        : isCore
          ? { border: "2px solid #cbd5e1", borderRadius: 8 }
          : { border: "2px solid #e5e7eb", borderRadius: 8 };

  // ★ Fix 5: Edge hotspot base style
  const edgeHotBase: React.CSSProperties = {
    position: "absolute",
    zIndex: 2,
    cursor: "crosshair",
    background: "transparent",
  };

  return (
    <button
      onClick={(e) => onSelect(e)}
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
        ...borderStyle,
        background: active ? (color === "transparent" ? "#f8fafc" : color) : (isCore ? "#f1f5f9" : "#fafbfc"),
        boxShadow: active ? "inset 0 0 0 1px rgba(0,0,0,0.1)" : isHovered ? "0 0 0 1px #fef08a, 0 1px 4px rgba(254,240,138,0.3)" : "none",
        transition: "all 80ms ease",
      }}
      title={`Block [C${voxelIndex % VOXEL_COLS}, R${Math.floor((voxelIndex % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS)}]${active ? "" : " (empty)"}${isLocked ? " locked" : ""}`}
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
  const voxelContextMenu = useStore((s) => s.voxelContextMenu);

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

  const gridCols = `${foldDepth}fr repeat(6, ${coreWidth}fr) ${foldDepth}fr`;
  const gridRows = `${foldDepth}fr repeat(2, ${coreDepth}fr) ${foldDepth}fr`;
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
      {/* Orientation labels — BACK on left (col 7, -X), FRONT on right (col 0, +X) */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 14px 0 14px" }}>
        <span style={{
          fontSize: 8, fontWeight: 700, color: "#94a3b8", letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}>
          BACK
        </span>
        <span style={{
          fontSize: 8, fontWeight: 800, color: "#2563eb", letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          FRONT
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "stretch", gap: 2 }}>
        {/* Left axis label */}
        <div style={{
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "2px 0", minWidth: 10,
        }}>
          <span style={{ fontSize: 7, fontWeight: 700, color: "#94a3b8", lineHeight: 1 }}>N</span>
          <span style={{ fontSize: 7, fontWeight: 700, color: "#94a3b8", lineHeight: 1 }}>S</span>
        </div>

        {/* ★ Aspect-ratio wrapper — forces deterministic height from width so fr tracks distribute correctly */}
        <div style={{ flex: 1, width: "100%", height: "auto", aspectRatio: `${totalW} / ${totalD}` }}>
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
            background: "#f1f5f9",
            borderRadius: 6,
            border: "2px solid #1e293b",
          }}>
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
            // ★ Omni-sync: Cell View hover or context menu faceDir → cyan CSS border
            const syncFace = isThisSelected
              ? (hoveredPreviewFace as string | null)
                || (voxelContextMenu?.containerId === containerId
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
                onHover={() => handleHover(cell.voxelIndex)}
                onLeave={handleLeave}
                onEdgeHover={(face) => handleEdgeHover(cell.voxelIndex, face)}
                onEdgeLeave={handleEdgeLeave}
                onEdgeClick={(face) => handleEdgeClick(cell.voxelIndex, face)}
                onSelect={(e) => handleCellSelect(cell.voxelIndex, e)}
                onCellMouseDown={(e) => handleCellMouseDown(cell.voxelIndex, e)}
                onCellMouseEnterDrag={() => handleCellMouseEnterDrag(cell.voxelIndex)}
              />
            );
          })}
          </div>
        </div>
      </div>
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
            border: activeLevel === l ? "1px solid #2563eb" : "1px solid #e2e8f0",
            background: activeLevel === l ? "#eff6ff" : "#fff",
            color: activeLevel === l ? "#2563eb" : "#94a3b8",
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
  const setVoxelFace = useStore((s) => s.setVoxelFace);
  const voxelGrid = container.voxelGrid ?? createDefaultVoxelGrid();

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

    // Select all voxels in group
    if (indices.length === 1) {
      setSelectedVoxel({ containerId, index: indices[0] });
    } else {
      setSelectedVoxels({ containerId, indices });
    }
  }, [level, containerId, activeBrush, setVoxelFace, setSelectedVoxel, setSelectedVoxels]);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(8, 1fr)",
      gridTemplateRows: "repeat(4, 1fr)",
      gap: "2px",
      aspectRatio: "2 / 1",
    }}>
      {BAY_GROUPS.map((group) => {
        // Compute dominant color from voxels in this group
        const colors = group.voxelIndices.map((i) => {
          const idx = level * VOXEL_ROWS * VOXEL_COLS + i;
          const v = voxelGrid[idx];
          if (!v) return "transparent";
          return cellColor(v.faces);
        });
        const dominantColor = colors.find((c) => c !== "transparent") ?? "#f1f5f9";

        return (
          <button
            key={group.id}
            onClick={() => handleBayClick(group)}
            style={{
              gridRow: `${group.gridRow} / span ${group.rowSpan}`,
              gridColumn: `${group.gridCol} / span ${group.colSpan}`,
              background: dominantColor === "transparent" ? "#f8fafc" : dominantColor,
              border: "1px solid #e2e8f0",
              borderRadius: "6px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "8px",
              fontWeight: 600,
              color: dominantColor === "transparent" || dominantColor === "#f1f5f9" ? "#94a3b8" : "#fff",
              textShadow: dominantColor !== "transparent" && dominantColor !== "#f1f5f9" ? "0 1px 2px rgba(0,0,0,0.3)" : "none",
              transition: "all 100ms ease",
              opacity: group.role === 'corner' ? 0.6 : 1,
            }}
            title={group.label}
          >
            {group.label}
          </button>
        );
      })}
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

  const voxelGrid = container.voxelGrid ?? createDefaultVoxelGrid();

  const isVoxelSelected = selectedVoxel?.containerId === containerId;
  // ★ Guard: extension tiles have no grid index — skip grid lookup
  const isRealVoxel = isVoxelSelected && selectedVoxel && !selectedVoxel.isExtension;
  const isExtVoxel  = isVoxelSelected && selectedVoxel && !!selectedVoxel.isExtension;
  const selVoxel = isRealVoxel ? voxelGrid[selectedVoxel.index] : null;
  // Compute a grid index for VoxelPreview3D — real voxels use .index, extensions derive from col/row
  const selIdx   = isRealVoxel ? selectedVoxel.index
    : isExtVoxel ? (selectedVoxel.row * VOXEL_COLS + selectedVoxel.col)
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

  const [gridLevel, setGridLevel] = React.useState(0);

  // Follow selected voxel's level
  React.useEffect(() => {
    if (isVoxelSelected && selLevel >= 0 && selLevel < VOXEL_LEVELS) {
      setGridLevel(selLevel);
    }
  }, [isVoxelSelected, selLevel]);

  const designComplexity = useStore((s) => s.designComplexity);
  const setDesignComplexity = useStore((s) => s.setDesignComplexity);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>

      {/* ── Section Header + Simple/Detail Toggle ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          fontSize: "10px", fontWeight: 700, color: "#64748b",
          textTransform: "uppercase", letterSpacing: "0.08em",
        }}>
          Block Grid
        </div>
        <div style={{
          display: "flex", borderRadius: "6px", overflow: "hidden",
          border: "1px solid #e2e8f0",
        }}>
          {(['simple', 'detailed'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setDesignComplexity(mode)}
              style={{
                padding: "2px 8px", fontSize: "9px", fontWeight: 600,
                border: "none", cursor: "pointer",
                background: designComplexity === mode ? "#2563eb" : "#fff",
                color: designComplexity === mode ? "#fff" : "#64748b",
                transition: "all 100ms ease",
              }}
            >
              {mode === 'simple' ? 'Simple' : 'Detail'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Level Selector ── */}
      <LevelToggle activeLevel={gridLevel} onChange={setGridLevel} />

      {/* ── Bay Grid or Voxel Grid ── */}
      {designComplexity === 'simple' ? (
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
      {isVoxelSelected && selIdx >= 0 && (
        <>
          <div style={{ height: "1px", background: "#e2e8f0" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{
                fontSize: "10px", fontWeight: 700, color: "#334155",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                Block [C{selCol}, R{selRow}]{selVoxel ? ` — ${selVoxel.type}` : " — Empty"}
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
                      background: "none", border: "1px solid #e2e8f0", borderRadius: "4px",
                      cursor: "pointer", padding: "2px 4px",
                      color: "#64748b", display: "flex", alignItems: "center",
                      transition: "all 100ms ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#f59e0b"; e.currentTarget.style.borderColor = "#f59e0b"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#64748b"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
                    title="Save block to library"
                  >
                    <BookmarkPlus size={11} />
                  </button>
                )}
                <button
                  onClick={() => { setSelectedVoxel(null); }}
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
                <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b" }}>Room:</span>
                <select
                  value={selVoxel.roomTag ?? ""}
                  onChange={(e) => {
                    const tag = e.target.value || undefined;
                    useStore.getState().setVoxelRoomTag(containerId, selIdx, tag);
                  }}
                  style={{
                    flex: 1, fontSize: 10, padding: "2px 4px", borderRadius: 4,
                    border: "1px solid #e2e8f0", background: "#fff", color: "#374151",
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
                      { label: 'Hinge', options: ['left', 'right'] as const, value: cfg.hingeEdge, key: 'hingeEdge' },
                      { label: 'Swing', options: ['in', 'out'] as const, value: cfg.swingDirection, key: 'swingDirection' },
                      { label: 'Type', options: ['swing', 'slide'] as const, value: cfg.type, key: 'type' },
                    ] as const).map(({ label, options, value, key }) => (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 9, color: '#9ca3af' }}>{label}</span>
                        <div style={{ display: 'flex', gap: 1 }}>
                          {options.map(opt => (
                            <button
                              key={opt}
                              onClick={() => useStore.getState().setDoorConfig(containerId, selIdx, doorFace, { [key]: opt } as any)}
                              style={{
                                padding: '2px 6px', fontSize: 10, borderRadius: 4,
                                background: value === opt ? '#3b82f6' : 'rgba(0,0,0,0.06)',
                                color: value === opt ? 'white' : '#374151',
                                border: 'none', cursor: 'pointer', fontWeight: 500,
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Interactive 3D Cube Inspector — or multi-select placeholder */}
            {selectedVoxels?.containerId === containerId && selectedVoxels.indices.length > 1 ? (
              <div style={{
                width: "100%", maxWidth: "200px", aspectRatio: "1.35 / 1",
                borderRadius: "8px", background: "#f1f5f9",
                border: "1px solid #e2e8f0", margin: "0 auto",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ color: '#6b7280', fontSize: 11, textAlign: 'center', padding: 16, lineHeight: 1.6 }}>
                  <div style={{ fontSize: 22, marginBottom: 4 }}>⬛⬛</div>
                  <strong>{selectedVoxels.indices.length} voxels selected</strong>
                  <br />
                  <span style={{ color: '#9ca3af', fontSize: 10 }}>Stamp applies to all</span>
                </div>
              </div>
            ) : (
              <VoxelPreview3D
                containerId={containerId}
                voxelIndex={selIdx}
                overrideFaces={effectiveFaces}
              />
            )}

          </div>
        </>
      )}

      {/* ── Empty state ── */}
      {!isVoxelSelected && (
        <>
          <div style={{ height: "1px", background: "#e2e8f0" }} />
          <div style={{ fontSize: "10px", color: "#94a3b8", textAlign: "center", padding: "4px 0" }}>
            Click a block above or in the 3D view to inspect
          </div>
        </>
      )}
    </div>
  );
}
