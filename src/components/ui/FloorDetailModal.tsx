"use client";

/**
 * FloorDetailModal — Top-down flat-view editor for a single container's floor.
 *
 * Center: Floor material picker (8 swatches).
 * Edges (N/S/E/W): Shows dominant outerWall treatment per wall. Click to set
 *   all deployed deck bays on that wall to a chosen treatment.
 * Corners: Visual corner indicators.
 * Footer: Remove/Restore floor toggle + Done.
 *
 * Aesthetic: Clean Professional (white/shadow) with backdrop blur.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import {
  CONTAINER_DIMENSIONS,
  type FloorMaterialType,
  type CornerConfig,
  type CornerName,
  CORNER_NAMES,
  ModuleType,
  WallSide,
} from "@/types/container";
import { X, Layers, Minus, Plus } from "lucide-react";

// ── Material Options (reused from BayContextMenu) ─────────

const FLOOR_MATERIALS: { id: FloorMaterialType | undefined; label: string; swatch: string }[] = [
  { id: undefined, label: "Wood (Light)", swatch: "#c4956a" },
  { id: "wood:cedar", label: "Cedar", swatch: "#9e5e3a" },
  { id: "wood:dark", label: "Dark Wood", swatch: "#6d4c2a" },
  { id: "concrete", label: "Concrete", swatch: "#bdbdbd" },
  { id: "tile:white", label: "White Tile", swatch: "#f5f5f5" },
  { id: "tile:dark", label: "Dark Tile", swatch: "#616161" },
  { id: "steel", label: "Steel", swatch: "#90a4ae" },
  { id: "bamboo", label: "Bamboo", swatch: "#a0c080" },
];

const EDGE_OPTIONS: { id: 'railing' | 'glass' | 'solid' | 'closet' | 'none'; label: string; color: string }[] = [
  { id: "railing", label: "Railing", color: "#2a2a2a" },
  { id: "glass", label: "Glass", color: "#039be5" },
  { id: "solid", label: "Solid", color: "#8a9199" },
  { id: "closet", label: "Closet", color: "#5d4037" },
  { id: "none", label: "Open", color: "#cfd8dc" },
];

const WALL_LABELS: Record<WallSide, string> = {
  [WallSide.Front]: "Front (South)",
  [WallSide.Back]: "Back (North)",
  [WallSide.Left]: "Left (West)",
  [WallSide.Right]: "Right (East)",
};

const WALL_SIDES = [WallSide.Front, WallSide.Back, WallSide.Left, WallSide.Right];

export default function FloorDetailModal() {
  const target = useStore((s) => s.floorDetailTarget);
  const containers = useStore((s) => s.containers);
  const setFloorMaterial = useStore((s) => s.setFloorMaterial);
  const toggleFloor = useStore((s) => s.toggleFloor);
  const setOuterWallType = useStore((s) => s.setOuterWallType);
  const setCornerConfig = useStore((s) => s.setCornerConfig);
  const closeFloorDetail = useStore((s) => s.closeFloorDetail);

  const [activeEdge, setActiveEdge] = useState<WallSide | null>(null);
  const [activeCorner, setActiveCorner] = useState<CornerName | null>(null);

  const container = target ? containers[target] : null;

  // ESC to close
  useEffect(() => {
    if (!target) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activeCorner) {
          setActiveCorner(null);
        } else if (activeEdge) {
          setActiveEdge(null);
        } else {
          closeFloorDetail();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target, activeEdge, activeCorner, closeFloorDetail]);

  // Get dominant outerWall type for a wall (most common among deployed decks)
  const getWallDominant = useCallback(
    (side: WallSide): 'railing' | 'glass' | 'solid' | 'closet' | 'none' | null => {
      if (!container) return null;
      const wall = container.walls[side];
      const deployedBays = wall.bays.filter(
        (b) =>
          b.module.type === ModuleType.HingedWall &&
          b.module.foldsDown &&
          b.module.openAmount > 0.5
      );
      if (deployedBays.length === 0) return null;
      // Find most common outerWall
      const counts: Record<string, number> = {};
      deployedBays.forEach((b) => {
        if (b.module.type === ModuleType.HingedWall) {
          const ow = b.module.outerWall;
          counts[ow] = (counts[ow] || 0) + 1;
        }
      });
      let max = 0;
      let dominant: string = "none";
      for (const [k, v] of Object.entries(counts)) {
        if (v > max) { max = v; dominant = k; }
      }
      return dominant as 'railing' | 'glass' | 'solid' | 'closet' | 'none';
    },
    [container]
  );

  // Count deployed deck bays per wall
  const deployedCount = useCallback(
    (side: WallSide): number => {
      if (!container) return 0;
      return container.walls[side].bays.filter(
        (b) =>
          b.module.type === ModuleType.HingedWall &&
          b.module.foldsDown &&
          b.module.openAmount > 0.5
      ).length;
    },
    [container]
  );

  // Apply outerWall type to all deployed bays on a wall
  const applyEdgeType = useCallback(
    (side: WallSide, type: 'railing' | 'glass' | 'solid' | 'closet' | 'none') => {
      if (!target || !container) return;
      const wall = container.walls[side];
      wall.bays.forEach((b) => {
        if (
          b.module.type === ModuleType.HingedWall &&
          b.module.foldsDown &&
          b.module.openAmount > 0.5
        ) {
          setOuterWallType(target, side, b.index, type);
        }
      });
      setActiveEdge(null);
    },
    [target, container, setOuterWallType]
  );

  if (!target || !container) return null;

  const dims = CONTAINER_DIMENSIONS[container.size];
  const currentMaterial = container.floorMaterial;
  const currentSwatch = FLOOR_MATERIALS.find((m) => m.id === currentMaterial)?.swatch ?? "#c4956a";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => { setActiveEdge(null); closeFloorDetail(); }}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-[560px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Layers size={18} className="text-gray-400" />
              Floor Detail
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {container.name} &mdash; {dims.length.toFixed(1)}m &times; {dims.width.toFixed(1)}m
            </p>
          </div>
          <button
            onClick={closeFloorDetail}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {/* Top-down schematic with edges */}
          <div className="relative flex items-center justify-center mb-5">
            <div className="relative" style={{ width: 320, height: 180 }}>
              {/* Back (North) edge */}
              <EdgeStrip
                side={WallSide.Back}
                label={WALL_LABELS[WallSide.Back]}
                dominant={getWallDominant(WallSide.Back)}
                deployed={deployedCount(WallSide.Back)}
                isActive={activeEdge === WallSide.Back}
                onClick={() => setActiveEdge(activeEdge === WallSide.Back ? null : WallSide.Back)}
                position="top"
              />

              {/* Front (South) edge */}
              <EdgeStrip
                side={WallSide.Front}
                label={WALL_LABELS[WallSide.Front]}
                dominant={getWallDominant(WallSide.Front)}
                deployed={deployedCount(WallSide.Front)}
                isActive={activeEdge === WallSide.Front}
                onClick={() => setActiveEdge(activeEdge === WallSide.Front ? null : WallSide.Front)}
                position="bottom"
              />

              {/* Left (West) edge */}
              <EdgeStrip
                side={WallSide.Left}
                label={WALL_LABELS[WallSide.Left]}
                dominant={getWallDominant(WallSide.Left)}
                deployed={deployedCount(WallSide.Left)}
                isActive={activeEdge === WallSide.Left}
                onClick={() => setActiveEdge(activeEdge === WallSide.Left ? null : WallSide.Left)}
                position="left"
              />

              {/* Right (East) edge */}
              <EdgeStrip
                side={WallSide.Right}
                label={WALL_LABELS[WallSide.Right]}
                dominant={getWallDominant(WallSide.Right)}
                deployed={deployedCount(WallSide.Right)}
                isActive={activeEdge === WallSide.Right}
                onClick={() => setActiveEdge(activeEdge === WallSide.Right ? null : WallSide.Right)}
                position="right"
              />

              {/* Center floor surface */}
              <div
                className="absolute rounded-lg border-2 border-gray-200 flex items-center justify-center cursor-default"
                style={{
                  left: 28, top: 28, right: 28, bottom: 28,
                  background: currentSwatch,
                }}
              >
                <span className="text-white text-xs font-semibold drop-shadow-md">
                  {FLOOR_MATERIALS.find((m) => m.id === currentMaterial)?.label ?? "Wood (Light)"}
                </span>
              </div>

              {/* Interactive corner indicators */}
              {([
                { name: 'back_left' as CornerName, pos: { top: 14, left: 14 } },
                { name: 'back_right' as CornerName, pos: { top: 14, right: 14 } },
                { name: 'front_left' as CornerName, pos: { bottom: 14, left: 14 } },
                { name: 'front_right' as CornerName, pos: { bottom: 14, right: 14 } },
              ]).map(({ name, pos }) => {
                const cfg = container.cornerConfig?.[name];
                const pt = cfg?.postType ?? 'solid';
                const bgColor = pt === 'solid' ? '#546e7a' : pt === 'cap' ? '#90a4ae' : '#e0e0e0';
                const isActive = activeCorner === name;
                return (
                  <div
                    key={name}
                    className={`absolute w-5 h-5 rounded-sm cursor-pointer transition-all
                      ${isActive ? 'ring-2 ring-blue-400 ring-offset-1 scale-125' : 'hover:scale-110'}`}
                    style={{ ...pos, background: bgColor, border: '2px solid #455a64' }}
                    onClick={() => { setActiveEdge(null); setActiveCorner(isActive ? null : name); }}
                    title={`${name.replace('_', ' ')} corner — ${pt}`}
                  />
                );
              })}
            </div>
          </div>

          {/* Edge picker popover (when an edge is active) */}
          {activeEdge && (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                {WALL_LABELS[activeEdge]} &mdash; Edge Treatment
              </p>
              {deployedCount(activeEdge) === 0 ? (
                <p className="text-xs text-gray-400 italic">
                  No deployed deck extensions on this wall. Deploy fold-down panels first.
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  {EDGE_OPTIONS.map((opt) => {
                    const isCurrent = getWallDominant(activeEdge) === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => applyEdgeType(activeEdge, opt.id)}
                        className={`
                          flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                          ${isCurrent
                            ? "bg-blue-50 text-blue-700 border-2 border-blue-400"
                            : "bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                          }
                        `}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-gray-300"
                          style={{ background: opt.color }}
                        />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Corner picker popover (when a corner is active) */}
          {activeCorner && container && (
            <div className="mb-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                {activeCorner.replace('_', ' ')} corner
              </p>

              {/* Post Type */}
              <div className="mb-3">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">Post Type</p>
                <div className="flex items-center gap-2">
                  {([
                    { id: 'solid' as const, label: 'Solid', color: '#546e7a' },
                    { id: 'cap' as const, label: 'Cap', color: '#90a4ae' },
                    { id: 'empty' as const, label: 'Empty', color: '#e0e0e0' },
                  ]).map((opt) => {
                    const currentPt = container.cornerConfig?.[activeCorner]?.postType ?? 'solid';
                    const isCurrent = currentPt === opt.id;
                    return (
                      <button
                        key={opt.id}
                        onClick={() => setCornerConfig(target!, activeCorner, { postType: opt.id })}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                          ${isCurrent
                            ? "bg-blue-50 text-blue-700 border-2 border-blue-400"
                            : "bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                          }`}
                      >
                        <span className="w-3 h-3 rounded-sm border border-gray-300" style={{ background: opt.color }} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Edge A & B */}
              {(['edgeA', 'edgeB'] as const).map((edgeKey, ei) => (
                <div key={edgeKey} className={ei === 0 ? "mb-3" : ""}>
                  <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                    Edge {ei === 0 ? 'A' : 'B'} Treatment
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {EDGE_OPTIONS.map((opt) => {
                      const currentVal = container.cornerConfig?.[activeCorner]?.[edgeKey];
                      const isCurrent = currentVal === opt.id;
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setCornerConfig(target!, activeCorner, { [edgeKey]: opt.id })}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all
                            ${isCurrent
                              ? "bg-blue-50 text-blue-700 border-2 border-blue-400"
                              : "bg-white text-gray-600 border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
                            }`}
                        >
                          <span className="w-2.5 h-2.5 rounded-full border border-gray-300" style={{ background: opt.color }} />
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Floor Material Picker */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Surface Material
            </p>
            <div className="grid grid-cols-4 gap-2">
              {FLOOR_MATERIALS.map((mat) => {
                const isCurrent = mat.id === currentMaterial;
                return (
                  <button
                    key={mat.id ?? "default"}
                    onClick={() => setFloorMaterial(target, mat.id)}
                    className={`
                      flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all
                      ${isCurrent
                        ? "bg-blue-50 border-2 border-blue-400 shadow-sm"
                        : "bg-white border border-gray-200 hover:border-blue-300 hover:shadow-sm"
                      }
                    `}
                  >
                    <span
                      className="w-8 h-8 rounded-md border border-gray-200"
                      style={{ background: mat.swatch }}
                    />
                    <span className="text-[10px] font-medium text-gray-600 leading-tight text-center">
                      {mat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={() => toggleFloor(target)}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border
              ${container.floorRemoved
                ? "text-green-700 border-green-300 hover:bg-green-50"
                : "text-orange-700 border-orange-300 hover:bg-orange-50"
              }
            `}
          >
            {container.floorRemoved ? <Plus size={14} /> : <Minus size={14} />}
            {container.floorRemoved ? "Restore Floor" : "Remove Floor"}
          </button>
          <button
            onClick={closeFloorDetail}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edge Strip Sub-Component ────────────────────────────────

interface EdgeStripProps {
  side: WallSide;
  label: string;
  dominant: 'railing' | 'glass' | 'solid' | 'closet' | 'none' | null;
  deployed: number;
  isActive: boolean;
  onClick: () => void;
  position: "top" | "bottom" | "left" | "right";
}

function EdgeStrip({ side, label, dominant, deployed, isActive, onClick, position }: EdgeStripProps) {
  const edgeColor = dominant
    ? EDGE_OPTIONS.find((o) => o.id === dominant)?.color ?? "#cfd8dc"
    : "#e0e0e0";

  const isHorizontal = position === "top" || position === "bottom";

  const style: React.CSSProperties = isHorizontal
    ? {
        left: 28, right: 28,
        height: 20,
        ...(position === "top" ? { top: 0 } : { bottom: 0 }),
      }
    : {
        top: 28, bottom: 28,
        width: 20,
        ...(position === "left" ? { left: 0 } : { right: 0 }),
      };

  return (
    <div
      className={`
        absolute rounded-sm cursor-pointer transition-all
        flex items-center justify-center
        ${isActive ? "ring-2 ring-blue-400 ring-offset-1" : "hover:brightness-110"}
        ${deployed === 0 ? "opacity-40" : ""}
      `}
      style={{ ...style, background: edgeColor }}
      onClick={onClick}
      title={`${label}${deployed > 0 ? ` (${deployed} deck bays)` : " (no decks)"}`}
    >
      {isHorizontal && (
        <span className="text-[8px] font-bold text-white drop-shadow-sm truncate px-1">
          {deployed > 0 ? (dominant ?? "").toUpperCase() : "---"}
        </span>
      )}
    </div>
  );
}
