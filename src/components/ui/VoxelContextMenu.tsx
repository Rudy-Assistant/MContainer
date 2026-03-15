"use client";

/**
 * RadialBlockMenu — Radial fan menu for structural block configurations.
 * Triggered by right-click on any block. 8 icons in a circle.
 * Replaces the old text-list context menu.
 */

import { useEffect, useCallback, type CSSProperties } from "react";
import { useStore } from "@/store/useStore";
import type { VoxelFaces } from "@/types/container";
import {
  X, Footprints, ArrowUpFromDot, Layers,
  Fence, AppWindow, ChevronsUpDown, Origami,
  Lock, Unlock, Copy, RotateCcw,
} from "lucide-react";

// ── Structural Configurations ───────────────────────────────
interface BlockConfig {
  label: string;
  icon: typeof X;
  faces: VoxelFaces;
  active: boolean;       // whether the voxel stays active
  accent: string;        // rarity border color
}

const CONFIGS: BlockConfig[] = [
  { label: "Void",          icon: X,              active: false,
    accent: "#94a3b8",
    faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { label: "Floor",         icon: Footprints,     active: true,
    accent: "#94a3b8",
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { label: "Ceiling",       icon: ArrowUpFromDot, active: true,
    accent: "#94a3b8",
    faces: { top: 'Solid_Steel', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { label: "Floor+Ceiling", icon: Layers,         active: true,
    accent: "#94a3b8",
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' } },
  { label: "Railing",       icon: Fence,          active: true,
    accent: "#64748b",
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' } },
  { label: "Window",        icon: AppWindow,      active: true,
    accent: "#2563eb",
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' } },
  { label: "Half-Fold",     icon: Origami,        active: true,
    accent: "#9333ea",
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Half_Fold', s: 'Half_Fold', e: 'Solid_Steel', w: 'Solid_Steel' } },
  { label: "Gull-Wing",     icon: ChevronsUpDown, active: true,
    accent: "#7c3aed",
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Gull_Wing', s: 'Gull_Wing', e: 'Solid_Steel', w: 'Solid_Steel' } },
];

const RADIUS = 90;
const BTN_SIZE = 42;
const CENTER_SIZE = 36;

export default function VoxelContextMenu() {
  const menu = useStore((s) => s.voxelContextMenu);
  const closeMenu = useStore((s) => s.closeVoxelContextMenu);
  const toggleLock = useStore((s) => s.toggleVoxelLock);
  const isLocked = useStore((s) => s.isVoxelLocked);
  const copyStyle = useStore((s) => s.copyVoxelStyle);
  const setSelectedVoxel = useStore((s) => s.setSelectedVoxel);

  // Close on Escape or click-outside
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.code === "Escape") closeMenu(); };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-radial-menu]")) closeMenu();
    };
    window.addEventListener("keydown", onKey);
    const t = setTimeout(() => window.addEventListener("click", onClick), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
      clearTimeout(t);
    };
  }, [menu, closeMenu]);

  const applyConfig = useCallback((cfg: BlockConfig) => {
    if (!menu) return;
    const { containerId, voxelIndex } = menu;
    const containers = useStore.getState().containers;
    const c = containers[containerId];
    if (!c?.voxelGrid) { closeMenu(); return; }

    // Check lock
    if (useStore.getState().lockedVoxels[`${containerId}_${voxelIndex}`]) {
      closeMenu();
      return;
    }

    const grid = [...c.voxelGrid];
    const voxel = grid[voxelIndex];
    if (!voxel) { closeMenu(); return; }

    grid[voxelIndex] = { ...voxel, active: cfg.active, faces: { ...cfg.faces } };
    useStore.setState({
      containers: { ...containers, [containerId]: { ...c, voxelGrid: grid } },
    });
    closeMenu();
  }, [menu, closeMenu]);

  const handleLock = useCallback(() => {
    if (!menu) return;
    toggleLock(menu.containerId, menu.voxelIndex);
    closeMenu();
  }, [menu, toggleLock, closeMenu]);

  const handleCopy = useCallback(() => {
    if (!menu) return;
    copyStyle(menu.containerId, menu.voxelIndex);
    closeMenu();
  }, [menu, copyStyle, closeMenu]);

  const handleReset = useCallback(() => {
    if (!menu) return;
    applyConfig({
      label: "Sealed",
      icon: RotateCcw,
      active: true,
      accent: "#64748b",
      faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
    });
  }, [menu, applyConfig]);

  if (!menu) return null;

  const locked = isLocked(menu.containerId, menu.voxelIndex);

  // Clamp center to viewport
  const cx = Math.min(Math.max(menu.x, RADIUS + BTN_SIZE), window.innerWidth - RADIUS - BTN_SIZE);
  const cy = Math.min(Math.max(menu.y, RADIUS + BTN_SIZE), window.innerHeight - RADIUS - BTN_SIZE);

  // 8 icons evenly around the circle
  const angleStep = (2 * Math.PI) / CONFIGS.length;
  const startAngle = -Math.PI / 2; // top = first item

  return (
    <div
      data-radial-menu
      style={{
        position: "fixed",
        left: cx - RADIUS - BTN_SIZE,
        top: cy - RADIUS - BTN_SIZE,
        width: (RADIUS + BTN_SIZE) * 2,
        height: (RADIUS + BTN_SIZE) * 2,
        zIndex: 100,
        pointerEvents: "auto",
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Center hub — shows Lock / Copy / Reset */}
      <div style={{
        position: "absolute",
        left: "50%", top: "50%",
        transform: "translate(-50%, -50%)",
        display: "flex",
        gap: 2,
        zIndex: 3,
      }}>
        <CenterButton icon={locked ? Unlock : Lock} label={locked ? "Unlock" : "Lock"} color="#d97706" onClick={handleLock} />
        <CenterButton icon={Copy} label="Copy" color="#059669" onClick={handleCopy} />
        <CenterButton icon={RotateCcw} label="Reset" color="#64748b" onClick={handleReset} />
      </div>

      {/* Radial items */}
      {CONFIGS.map((cfg, i) => {
        const angle = startAngle + i * angleStep;
        const x = Math.cos(angle) * RADIUS;
        const y = Math.sin(angle) * RADIUS;
        const Icon = cfg.icon;

        return (
          <RadialButton
            key={cfg.label}
            x={x}
            y={y}
            accent={cfg.accent}
            label={cfg.label}
            onClick={() => applyConfig(cfg)}
          >
            <Icon size={18} strokeWidth={2} color="#334155" />
          </RadialButton>
        );
      })}

      {/* Faint ring guide */}
      <svg
        style={{
          position: "absolute",
          left: 0, top: 0,
          width: "100%", height: "100%",
          pointerEvents: "none",
          zIndex: 0,
        }}
      >
        <circle
          cx="50%" cy="50%"
          r={RADIUS}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}

// ── Radial Button ──────────────────────────────────────────

function RadialButton({
  x, y, accent, label, onClick, children,
}: {
  x: number; y: number; accent: string; label: string;
  onClick: () => void; children: React.ReactNode;
}) {
  const style: CSSProperties = {
    position: "absolute",
    left: `calc(50% + ${x}px - ${BTN_SIZE / 2}px)`,
    top: `calc(50% + ${y}px - ${BTN_SIZE / 2}px)`,
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: "50%",
    background: "#ffffff",
    border: `3px solid ${accent}`,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)",
    transition: "all 120ms ease",
    zIndex: 2,
    outline: "none",
  };

  return (
    <button
      onClick={onClick}
      title={label}
      style={style}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.15)";
        e.currentTarget.style.boxShadow = `0 4px 16px ${accent}40, 0 0 0 2px ${accent}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.04)";
      }}
    >
      {children}
    </button>
  );
}

// ── Center Hub Button ──────────────────────────────────────

function CenterButton({
  icon: Icon, label, color, onClick,
}: {
  icon: typeof Lock; label: string; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: CENTER_SIZE,
        height: CENTER_SIZE,
        borderRadius: "50%",
        background: "#ffffff",
        border: `2px solid ${color}30`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
        transition: "all 100ms ease",
        outline: "none",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 2px 8px ${color}30`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${color}30`;
        e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.08)";
      }}
    >
      <Icon size={14} strokeWidth={2} color={color} />
    </button>
  );
}
