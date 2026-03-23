"use client";

/**
 * StructureEditorModal — 2D schematic editor for container frame visibility.
 *
 * Shows an "unfolded box" SVG diagram of the 12 structural elements
 * (4 top beams, 4 bottom beams, 4 corner posts). Clicking any element
 * toggles its visibility in the 3D scene.
 *
 * Aesthetic: Clean Professional (white/shadow) with backdrop blur.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, WallSide } from "@/types/container";
import { X, RotateCcw, Eye, EyeOff } from "lucide-react";

// ── Element Key Definitions ──────────────────────────────────

const TOP_BEAMS = [
  { key: "top_front", label: "Top Front" },
  { key: "top_back", label: "Top Back" },
  { key: "top_left", label: "Top Left" },
  { key: "top_right", label: "Top Right" },
] as const;

const BOTTOM_BEAMS = [
  { key: "bottom_front", label: "Bottom Front" },
  { key: "bottom_back", label: "Bottom Back" },
  { key: "bottom_left", label: "Bottom Left" },
  { key: "bottom_right", label: "Bottom Right" },
] as const;

const CORNER_POSTS = [
  { key: "post_front_left", label: "Front-Left Post" },
  { key: "post_front_right", label: "Front-Right Post" },
  { key: "post_back_left", label: "Back-Left Post" },
  { key: "post_back_right", label: "Back-Right Post" },
] as const;

const ALL_ELEMENTS = [
  ...TOP_BEAMS,
  ...BOTTOM_BEAMS,
  ...CORNER_POSTS,
];

// ── Colors ───────────────────────────────────────────────────

const ACTIVE_COLOR = "#3d4a55";
const ACTIVE_STROKE = "#263238";
const HIDDEN_COLOR = "#cfd8dc";
const HOVER_COLOR = "#1565c0";

// ── SVG Layout Constants ─────────────────────────────────────

const SVG_W = 520;
const SVG_H = 420;
const PAD = 60;
// The "box" in the center represents the container top-down
const BOX_L = PAD + 80;          // left edge
const BOX_R = SVG_W - PAD - 80;  // right edge
const BOX_T = PAD + 60;          // top edge (back)
const BOX_B = SVG_H - PAD - 60;  // bottom edge (front)
const BEAM_THICK = 10;
const POST_RADIUS = 10;

export default function StructureEditorModal() {
  const target = useStore((s) => s.structureEditorTarget);
  const containers = useStore((s) => s.containers);
  const toggleStructuralElement = useStore((s) => s.toggleStructuralElement);
  const closeStructureEditor = useStore((s) => s.closeStructureEditor);

  const [hovered, setHovered] = useState<string | null>(null);

  const container = target ? containers[target] : null;
  const hidden = useMemo(
    () => container?.structureConfig?.hiddenElements ?? [],
    [container?.structureConfig?.hiddenElements]
  );

  // ESC to close
  useEffect(() => {
    if (!target) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeStructureEditor();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [target, closeStructureEditor]);

  const handleResetAll = useCallback(() => {
    if (!target || !container) return;
    // Remove all hidden elements
    const current = container.structureConfig?.hiddenElements ?? [];
    current.forEach((key) => toggleStructuralElement(target, key));
  }, [target, container, toggleStructuralElement]);

  if (!target || !container) return null;

  const dims = CONTAINER_DIMENSIONS[container.size];
  const isHidden = (key: string) => hidden.includes(key);

  // ── SVG Element Rendering Helpers ─────────────────────────

  const beamProps = (key: string, x1: number, y1: number, x2: number, y2: number) => {
    const off = isHidden(key);
    const isHov = hovered === key;
    return {
      x1, y1, x2, y2,
      stroke: isHov ? HOVER_COLOR : off ? HIDDEN_COLOR : ACTIVE_STROKE,
      strokeWidth: BEAM_THICK,
      strokeLinecap: "round" as const,
      strokeDasharray: off ? "8 6" : undefined,
      opacity: off ? 0.4 : 1,
      cursor: "pointer",
      onMouseEnter: () => setHovered(key),
      onMouseLeave: () => setHovered(null),
      onClick: () => toggleStructuralElement(target, key),
    };
  };

  const postProps = (key: string, cx: number, cy: number) => {
    const off = isHidden(key);
    const isHov = hovered === key;
    return {
      cx, cy,
      r: POST_RADIUS,
      fill: isHov ? HOVER_COLOR : off ? "transparent" : ACTIVE_COLOR,
      stroke: isHov ? HOVER_COLOR : off ? HIDDEN_COLOR : ACTIVE_STROKE,
      strokeWidth: 2,
      strokeDasharray: off ? "4 3" : undefined,
      opacity: off ? 0.4 : 1,
      cursor: "pointer",
      onMouseEnter: () => setHovered(key),
      onMouseLeave: () => setHovered(null),
      onClick: () => toggleStructuralElement(target, key),
    };
  };

  // ── Tooltip label for hovered element ─────────────────────
  const hoveredLabel = hovered
    ? ALL_ELEMENTS.find((e) => e.key === hovered)?.label ?? hovered
    : null;

  const hiddenCount = hidden.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="modal-backdrop"
        onClick={closeStructureEditor}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-[600px] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              Frame Structure
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {container.name} &mdash; {dims.length.toFixed(1)}m &times; {dims.width.toFixed(1)}m &times; {dims.height.toFixed(1)}m
            </p>
          </div>
          <button
            onClick={closeStructureEditor}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — SVG Schematic */}
        <div className="px-6 py-5 flex flex-col items-center">
          {/* Legend */}
          <div className="flex items-center gap-6 mb-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-1 rounded-full" style={{ background: ACTIVE_COLOR }} />
              Visible
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-1 rounded-full border border-dashed" style={{ borderColor: HIDDEN_COLOR }} />
              Hidden
            </span>
            <span className="text-gray-400">
              Click any element to toggle
            </span>
          </div>

          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full max-w-[520px]"
            style={{ userSelect: "none" }}
          >
            {/* Background grid */}
            <rect x={0} y={0} width={SVG_W} height={SVG_H} fill="#fafafa" rx={12} />

            {/* Direction labels */}
            <text x={SVG_W / 2} y={PAD - 10} textAnchor="middle" fontSize={11} fill="#9e9e9e" fontWeight={500}>
              BACK
            </text>
            <text x={SVG_W / 2} y={SVG_H - PAD + 25} textAnchor="middle" fontSize={11} fill="#9e9e9e" fontWeight={500}>
              FRONT
            </text>
            <text x={PAD - 15} y={SVG_H / 2} textAnchor="middle" fontSize={11} fill="#9e9e9e" fontWeight={500} transform={`rotate(-90, ${PAD - 15}, ${SVG_H / 2})`}>
              LEFT
            </text>
            <text x={SVG_W - PAD + 15} y={SVG_H / 2} textAnchor="middle" fontSize={11} fill="#9e9e9e" fontWeight={500} transform={`rotate(90, ${SVG_W - PAD + 15}, ${SVG_H / 2})`}>
              RIGHT
            </text>

            {/* Container outline (light reference) */}
            <rect
              x={BOX_L} y={BOX_T}
              width={BOX_R - BOX_L} height={BOX_B - BOX_T}
              fill="none" stroke="#e0e0e0" strokeWidth={1}
              rx={4}
            />

            {/* ── TOP BEAMS (drawn at top of each edge) ───── */}
            {/* Top Back beam (along back/top edge) */}
            <line {...beamProps("top_back", BOX_L, BOX_T, BOX_R, BOX_T)} />
            {/* Top Front beam (along front/bottom edge) */}
            <line {...beamProps("top_front", BOX_L, BOX_B, BOX_R, BOX_B)} />
            {/* Top Left beam (along left edge) */}
            <line {...beamProps("top_left", BOX_L, BOX_T, BOX_L, BOX_B)} />
            {/* Top Right beam (along right edge) */}
            <line {...beamProps("top_right", BOX_R, BOX_T, BOX_R, BOX_B)} />

            {/* ── BOTTOM BEAMS (offset inward, thinner appearance) ── */}
            {/* Show as inner parallel lines */}
            <line {...beamProps("bottom_back", BOX_L + 15, BOX_T + 15, BOX_R - 15, BOX_T + 15)} strokeWidth={6} />
            <line {...beamProps("bottom_front", BOX_L + 15, BOX_B - 15, BOX_R - 15, BOX_B - 15)} strokeWidth={6} />
            <line {...beamProps("bottom_left", BOX_L + 15, BOX_T + 15, BOX_L + 15, BOX_B - 15)} strokeWidth={6} />
            <line {...beamProps("bottom_right", BOX_R - 15, BOX_T + 15, BOX_R - 15, BOX_B - 15)} strokeWidth={6} />

            {/* ── CORNER POSTS (circles at corners) ────── */}
            <circle {...postProps("post_back_left", BOX_L, BOX_T)} />
            <circle {...postProps("post_back_right", BOX_R, BOX_T)} />
            <circle {...postProps("post_front_left", BOX_L, BOX_B)} />
            <circle {...postProps("post_front_right", BOX_R, BOX_B)} />

            {/* ── Labels for bottom beams (differentiator) ── */}
            <text x={SVG_W / 2} y={BOX_T + 15 + 4} textAnchor="middle" fontSize={8} fill="#9e9e9e" pointerEvents="none">
              bottom
            </text>
            <text x={SVG_W / 2} y={BOX_B - 15 + 4} textAnchor="middle" fontSize={8} fill="#9e9e9e" pointerEvents="none">
              bottom
            </text>

            {/* Hovered element tooltip */}
            {hoveredLabel && (
              <text x={SVG_W / 2} y={SVG_H - 15} textAnchor="middle" fontSize={12} fill={HOVER_COLOR} fontWeight={600}>
                {hoveredLabel} — {isHidden(hovered!) ? "Hidden (click to show)" : "Visible (click to hide)"}
              </text>
            )}
          </svg>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2">
            {hiddenCount > 0 && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <EyeOff size={13} />
                {hiddenCount} element{hiddenCount !== 1 ? "s" : ""} hidden
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetAll}
              disabled={hiddenCount === 0}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                ${hiddenCount > 0
                  ? "text-gray-700 hover:bg-gray-100 border border-gray-200"
                  : "text-gray-400 cursor-not-allowed"
                }
              `}
            >
              <RotateCcw size={14} />
              Reset All
            </button>
            <button
              onClick={closeStructureEditor}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
