"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useStore } from "@/store/useStore";
import { ModuleType, GlassVariant, type FloorMaterialType } from "@/types/container";
import {
  createPanelSolid,
  createPanelGlass,
  createHingedWall,
  createOpenVoid,
} from "@/types/factories";
import {
  Square,
  AppWindow,
  ChevronDown,
  ChevronUp,
  Maximize2,
  ChevronsUpDown,
  Lock,
  Unlock,
  SquareDashed,
  Layers,
} from "lucide-react";

// ── Module type items for radial ring ────────────────────────

const ITEMS = [
  { id: "solid", label: "Steel", icon: Square, color: "#263238", activeBg: "#263238", activeText: "#ffffff" },
  { id: "glass", label: "Glass", icon: AppWindow, color: "#00acc1", activeBg: "#00acc1", activeText: "#ffffff" },
  { id: "fold_down", label: "Deck", icon: ChevronDown, color: "#e65100", activeBg: "#e65100", activeText: "#ffffff" },
  { id: "fold_up", label: "Awning", icon: ChevronUp, color: "#f9a825", activeBg: "#f9a825", activeText: "#263238" },
  { id: "gull", label: "Gull (\u00bd)", icon: Maximize2, color: "#d84315", activeBg: "#d84315", activeText: "#ffffff" },
  { id: "gull_full", label: "Gull (Full)", icon: ChevronsUpDown, color: "#bf360c", activeBg: "#bf360c", activeText: "#ffffff" },
  { id: "open", label: "Open", icon: SquareDashed, color: "#78909c", activeBg: "#78909c", activeText: "#ffffff" },
] as const;

const EDGE_OPTIONS = [
  { id: "railing" as const, label: "Railing", color: "#2a2a2a" },
  { id: "glass" as const, label: "Glass", color: "#039be5" },
  { id: "solid" as const, label: "Solid", color: "#8a9199" },
  { id: "closet" as const, label: "Closet", color: "#5d4037" },
  { id: "none" as const, label: "Open", color: "#cfd8dc" },
];

const SIDE_OPTIONS: { id: undefined | 'railing' | 'glass' | 'solid' | 'closet' | 'none'; label: string; color: string }[] = [
  { id: undefined, label: "= Edge", color: "#b0bec5" },
  { id: "railing", label: "Railing", color: "#2a2a2a" },
  { id: "glass", label: "Glass", color: "#039be5" },
  { id: "solid", label: "Solid", color: "#8a9199" },
  { id: "none", label: "Open", color: "#cfd8dc" },
];

const FLOOR_MATERIAL_OPTIONS: { id: FloorMaterialType | undefined; label: string; swatch: string }[] = [
  { id: undefined, label: "Wood (Light)", swatch: "#c4956a" },
  { id: "wood:cedar", label: "Cedar", swatch: "#9e5e3a" },
  { id: "wood:dark", label: "Dark Wood", swatch: "#6d4c2a" },
  { id: "concrete", label: "Concrete", swatch: "#bdbdbd" },
  { id: "tile:white", label: "White Tile", swatch: "#f5f5f5" },
  { id: "tile:dark", label: "Dark Tile", swatch: "#616161" },
  { id: "steel", label: "Steel", swatch: "#90a4ae" },
  { id: "bamboo", label: "Bamboo", swatch: "#a0c080" },
];

const COLOR_OPTIONS: { hex: string | undefined; label: string; swatch: string }[] = [
  { hex: undefined, label: "Default", swatch: "#8a9199" },
  { hex: "#b71c1c", label: "Red", swatch: "#b71c1c" },
  { hex: "#0d47a1", label: "Blue", swatch: "#0d47a1" },
  { hex: "#1b5e20", label: "Green", swatch: "#1b5e20" },
  { hex: "#263238", label: "Charcoal", swatch: "#263238" },
  { hex: "#eceff1", label: "White", swatch: "#eceff1" },
  { hex: "wood:light", label: "Light Wood", swatch: "#c4956a" },
  { hex: "wood:cedar", label: "Cedar", swatch: "#9e5e3a" },
  { hex: "wood:dark", label: "Dark Wood", swatch: "#6d4c2a" },
];

// ── Layout constants ─────────────────────────────────────────

const RADIUS = 66;
const BTN = 30;
const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

// ── Glassmorphism Style Constants ────────────────────────────

const GLASS_MENU_STYLES = {
  // Glassmorphism core
  background: 'rgba(255, 255, 255, 0.15)',
  backdropFilter: 'blur(20px) saturate(180%)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',

  // Transition timing
  transition: 'all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  fadeOut: 'opacity 280ms cubic-bezier(0.4, 0.0, 0.2, 1), transform 280ms cubic-bezier(0.4, 0.0, 0.2, 1)',
} as const;

// ── Helpers ──────────────────────────────────────────────────

function getActiveId(type: ModuleType, foldsDown?: boolean, foldsUp?: boolean, gullFull?: boolean): string {
  if (type === ModuleType.PanelSolid) return "solid";
  if (type === ModuleType.PanelGlass) return "glass";
  if (type === ModuleType.OpenVoid) return "open";
  if (type === ModuleType.HingedWall) {
    if (foldsDown && foldsUp) return gullFull ? "gull_full" : "gull";
    if (foldsDown) return "fold_down";
    return "fold_up";
  }
  return "solid";
}

// ── Component ────────────────────────────────────────────────

export default function BayContextMenu() {
  const ctx = useStore((s) => s.bayContextMenu);
  const closeBayContextMenu = useStore((s) => s.closeBayContextMenu);
  const setBayModule = useStore((s) => s.setBayModule);
  const toggleBayOpen = useStore((s) => s.toggleBayOpen);
  const toggleBayLock = useStore((s) => s.toggleBayLock);
  const setFloorMaterial = useStore((s) => s.setFloorMaterial);
  const toggleFloor = useStore((s) => s.toggleFloor);
  const setOuterWallType = useStore((s) => s.setOuterWallType);
  const containers = useStore((s) => s.containers);
  const menuRef = useRef<HTMLDivElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [fanned, setFanned] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Wrapped close handler with fade-out animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      closeBayContextMenu();
      setIsClosing(false);
    }, 280); // Match GLASS_MENU_STYLES.fadeOut duration
  }, [closeBayContextMenu]);

  // Fan-out animation trigger
  useEffect(() => {
    if (!ctx) { setFanned(false); setHoveredId(null); return; }
    const raf = requestAnimationFrame(() => setFanned(true));
    return () => cancelAnimationFrame(raf);
  }, [ctx]);

  // Click outside to close
  useEffect(() => {
    if (!ctx) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [ctx, handleClose]);

  // Escape to close (Note: Global keyboard handler in useMenuKeyboardControls also handles ESC)
  useEffect(() => {
    if (!ctx) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [ctx, handleClose]);

  if (!ctx) return null;

  const container = containers[ctx.containerId];
  if (!container) return null;
  if (!ctx.wall || !container.walls?.[ctx.wall]) return null;

  // ── Edge mode: configure outer wall type for deck edges ──
  if (ctx.mode === 'edge') {
    const bay = container.walls[ctx.wall].bays[ctx.bayIndex];
    if (!bay || bay.module.type !== ModuleType.HingedWall) return null;
    const currentOuter = bay.module.outerWall ?? 'railing';

    const pad = 160;
    const fx = Math.max(pad, Math.min(ctx.x, window.innerWidth - pad));
    const fy = Math.max(pad, ctx.y);

    return (
      <div
        ref={menuRef}
        data-bay-context-menu
        className="fixed z-50"
        style={{
          left: fx,
          top: fy,
          transform: `translate(-50%, -50%) scale(${isClosing ? 0.95 : 1})`,
          opacity: isClosing ? 0 : 1,
          transition: isClosing ? GLASS_MENU_STYLES.fadeOut : GLASS_MENU_STYLES.transition,
        }}
      >
        <div
          className="rounded-xl"
          style={{
            background: GLASS_MENU_STYLES.background,
            backdropFilter: GLASS_MENU_STYLES.backdropFilter,
            border: GLASS_MENU_STYLES.border,
            boxShadow: GLASS_MENU_STYLES.boxShadow,
            padding: "12px 14px",
            minWidth: 180,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#546e7a" }}>
            Edge Treatment
          </span>
          <div className="flex flex-col gap-1">
            {EDGE_OPTIONS.map((opt) => {
              const active = currentOuter === opt.id;
              const isH = hoveredId === `edge-${opt.id}`;
              return (
                <button
                  key={opt.id}
                  onClick={() => {
                    setOuterWallType(ctx.containerId, ctx.wall, ctx.bayIndex, opt.id);
                    handleClose();
                  }}
                  onMouseEnter={() => setHoveredId(`edge-${opt.id}`)}
                  onMouseLeave={() => setHoveredId(null)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-left"
                  style={{
                    backgroundColor: active ? "#e3f2fd" : isH ? "#f5f5f5" : "transparent",
                    border: active ? "1.5px solid #1565c0" : "1px solid transparent",
                  }}
                >
                  <span
                    className="inline-block rounded-full"
                    style={{
                      width: 16,
                      height: 16,
                      backgroundColor: opt.color,
                      border: "1px solid rgba(0,0,0,0.15)",
                    }}
                  />
                  <span className="text-xs font-semibold" style={{ color: active ? "#1565c0" : "#37474f" }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Floor mode: material swatch grid + remove floor toggle ──
  if (ctx.mode === 'floor') {
    const pad = 160;
    const fx = Math.max(pad, Math.min(ctx.x, window.innerWidth - pad));
    const fy = Math.max(pad, ctx.y);
    return (
      <div
        ref={menuRef}
        data-bay-context-menu
        className="fixed z-50"
        style={{
          left: fx,
          top: fy,
          transform: `translate(-50%, -50%) scale(${isClosing ? 0.95 : 1})`,
          opacity: isClosing ? 0 : 1,
          transition: isClosing ? GLASS_MENU_STYLES.fadeOut : GLASS_MENU_STYLES.transition,
        }}
      >
        <div
          className="rounded-xl"
          style={{
            background: GLASS_MENU_STYLES.background,
            backdropFilter: GLASS_MENU_STYLES.backdropFilter,
            border: GLASS_MENU_STYLES.border,
            boxShadow: GLASS_MENU_STYLES.boxShadow,
            padding: "12px 14px",
            minWidth: 220,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#546e7a" }}>
            <Layers size={12} className="inline mr-1" style={{ verticalAlign: "middle" }} />
            Floor Material
          </span>
          <div className="flex flex-wrap gap-1.5">
            {FLOOR_MATERIAL_OPTIONS.map((opt) => {
              const active = container.floorMaterial === opt.id;
              const isH = hoveredId === `fm-${opt.id ?? "d"}`;
              return (
                <div key={opt.id ?? "default"} className="relative">
                  <button
                    onClick={() => {
                      setFloorMaterial(ctx.containerId, opt.id);
                      handleClose();
                    }}
                    onMouseEnter={() => setHoveredId(`fm-${opt.id ?? "d"}`)}
                    onMouseLeave={() => setHoveredId(null)}
                    className="transition-all"
                    style={{ transform: isH ? "scale(1.15)" : "scale(1)" }}
                  >
                    <span
                      className="inline-block rounded-full"
                      style={{
                        width: 28,
                        height: 28,
                        backgroundColor: opt.swatch,
                        border: active ? "3px solid #1565c0" : isH ? "2px solid #90a4ae" : "1.5px solid #e0e0e0",
                      }}
                    />
                  </button>
                  {isH && (
                    <div
                      className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-semibold pointer-events-none"
                      style={{ backgroundColor: "#263238", color: "#fff" }}
                    >
                      {opt.label}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid #f0f0f0" }}>
            <button
              onClick={() => {
                toggleFloor(ctx.containerId);
                handleClose();
              }}
              onMouseEnter={() => setHoveredId("rmfloor")}
              onMouseLeave={() => setHoveredId(null)}
              className="text-[10px] font-semibold px-3 py-1.5 rounded-lg transition-all"
              style={{
                color: container.floorRemoved ? "#e65100" : "#546e7a",
                border: container.floorRemoved ? "1.5px solid #e65100" : "1px solid #e3f2fd",
                backgroundColor: hoveredId === "rmfloor"
                  ? container.floorRemoved ? "#fff3e0" : "#e3f2fd"
                  : "transparent",
              }}
            >
              {container.floorRemoved ? "Restore Floor" : "Remove Floor"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bay = container.walls[ctx.wall].bays[ctx.bayIndex];
  if (!bay) return null;

  const mod = bay.module;
  const isLocked = bay.locked ?? false;
  const activeId = getActiveId(
    mod.type,
    mod.type === ModuleType.HingedWall ? mod.foldsDown : undefined,
    mod.type === ModuleType.HingedWall ? mod.foldsUp : undefined,
    mod.type === ModuleType.HingedWall ? mod.gullFull : undefined,
  );
  const isHinged = mod.type === ModuleType.HingedWall;
  const isOpen = isHinged && mod.openAmount > 0;

  // ── Handlers ───────────────────────────────────────────────
  // Note: These are regular functions (not useCallback) since they're only used in bay mode
  // Using useCallback here would cause hook order violations due to conditional returns above

  const handleSelect = (id: string) => {
    if (id === activeId && isHinged) {
      toggleBayOpen(ctx.containerId, ctx.wall, ctx.bayIndex);
      handleClose();
      return;
    }
    // Preserve outerWall/sideWall when switching between hinged types
    const prevOuter = mod.type === ModuleType.HingedWall ? mod.outerWall : undefined;
    const prevSide = mod.type === ModuleType.HingedWall ? mod.sideWall : undefined;
    switch (id) {
      case "solid": setBayModule(ctx.containerId, ctx.wall, ctx.bayIndex, createPanelSolid()); break;
      case "glass": setBayModule(ctx.containerId, ctx.wall, ctx.bayIndex, createPanelGlass(GlassVariant.FixedWindow)); break;
      case "fold_down": setBayModule(ctx.containerId, ctx.wall, ctx.bayIndex, createHingedWall(true, false, true, false, prevOuter, prevSide)); break;
      case "fold_up": setBayModule(ctx.containerId, ctx.wall, ctx.bayIndex, createHingedWall(false, true, true, false, prevOuter, prevSide)); break;
      case "gull": setBayModule(ctx.containerId, ctx.wall, ctx.bayIndex, createHingedWall(true, true, true, false, prevOuter, prevSide)); break;
      case "gull_full": setBayModule(ctx.containerId, ctx.wall, ctx.bayIndex, createHingedWall(true, true, true, true, prevOuter, prevSide)); break;
      case "open": setBayModule(ctx.containerId, ctx.wall, ctx.bayIndex, createOpenVoid()); break;
    }
    handleClose();
  };

  const handleApplyToWall = () => {
    const store = useStore.getState();
    const c = store.containers[ctx.containerId];
    if (!c) { handleClose(); return; }
    const wallConfig = c.walls[ctx.wall];
    const currentModule = wallConfig.bays[ctx.bayIndex].module;
    for (let i = 0; i < wallConfig.bays.length; i++) {
      if (i !== ctx.bayIndex && !wallConfig.bays[i].locked) {
        store.setBayModule(ctx.containerId, ctx.wall, i, { ...currentModule, id: `${currentModule.id}-${i}` });
      }
    }
    handleClose();
  };

  // ── Position: use exact mouse coordinates, minimal edge clamping ─────

  const cx = Math.max(BTN, Math.min(ctx.x, window.innerWidth - BTN));
  const cy = Math.max(BTN, Math.min(ctx.y, window.innerHeight - BTN));

  // ── Radial positions (semicircle above center) ─────────────

  const n = ITEMS.length;
  const hasSecondary = (isHinged && isOpen) || mod.type === ModuleType.PanelSolid;

  return (
    <div
      ref={menuRef}
      data-bay-context-menu
      className="fixed z-50"
      style={{
        left: cx,
        top: cy,
        opacity: isClosing ? 0 : 1,
        transform: isClosing ? 'scale(0.95)' : 'scale(1)',
        transition: isClosing ? GLASS_MENU_STYLES.fadeOut : 'none',
      }}
    >
      {/* Center: Lock button (exempt from Apply to Entire Wall) */}
      <div
        className="absolute"
        style={{
          left: -BTN / 2,
          top: -BTN / 2,
          transform: fanned ? "scale(1)" : "scale(0)",
          opacity: fanned ? 1 : 0,
          transition: `all 200ms ${SPRING}`,
        }}
      >
        <button
          className="flex items-center justify-center rounded-full transition-all"
          style={{
            width: BTN,
            height: BTN,
            backgroundColor: isLocked ? "#fff3e0" : GLASS_MENU_STYLES.background,
            color: isLocked ? "#e65100" : "#90a4ae",
            border: isLocked ? "2px solid #e65100" : GLASS_MENU_STYLES.border,
            boxShadow: hoveredId === "lock"
              ? "0 4px 16px rgba(0,0,0,0.22)"
              : GLASS_MENU_STYLES.boxShadow,
            backdropFilter: GLASS_MENU_STYLES.backdropFilter,
            transform: hoveredId === "lock" ? "scale(1.1)" : "scale(1)",
          }}
          onClick={() => toggleBayLock(ctx.containerId, ctx.wall, ctx.bayIndex)}
          onMouseEnter={() => setHoveredId("lock")}
          onMouseLeave={() => setHoveredId(null)}
        >
          {isLocked ? <Lock size={16} strokeWidth={2} /> : <Unlock size={16} strokeWidth={2} />}
        </button>
        {hoveredId === "lock" && (
          <div
            className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1 text-[10px] font-semibold pointer-events-none"
            style={{ backgroundColor: "#263238", color: "#ffffff" }}
          >
            {isLocked ? "Unlock Bay" : "Lock Bay"}
          </div>
        )}
      </div>

      {/* Radial module-type buttons */}
      {ITEMS.map((item, i) => {
        const angle = Math.PI - (i * Math.PI / (n - 1));
        const tx = RADIUS * Math.cos(angle);
        const ty = -RADIUS * Math.sin(angle);
        const isActive = activeId === item.id;
        const isHovered = hoveredId === item.id;
        const Icon = item.icon;
        const delay = i * 25;

        return (
          <div
            key={item.id}
            className="absolute"
            style={{
              left: -BTN / 2,
              top: -BTN / 2,
              transform: fanned
                ? `translate(${tx}px, ${ty}px)`
                : "translate(0px, 0px)",
              transition: `transform 280ms ${SPRING} ${delay}ms`,
            }}
          >
            <button
              className="flex items-center justify-center rounded-full"
              style={{
                width: BTN,
                height: BTN,
                backgroundColor: isActive ? item.activeBg : GLASS_MENU_STYLES.background,
                color: isActive ? item.activeText : item.color,
                border: isActive ? `2px solid ${item.activeBg}` : isHovered ? `2px solid ${item.color}40` : GLASS_MENU_STYLES.border,
                boxShadow: isActive
                  ? `0 0 16px ${item.activeBg}50, ${GLASS_MENU_STYLES.boxShadow}`
                  : isHovered
                    ? `0 4px 20px rgba(0,0,0,0.22), 0 0 12px ${item.color}25`
                    : GLASS_MENU_STYLES.boxShadow,
                backdropFilter: GLASS_MENU_STYLES.backdropFilter,
                transform: fanned ? (isHovered ? "scale(1.12)" : "scale(1)") : "scale(0)",
                opacity: fanned ? 1 : 0,
                transition: `transform 200ms ${SPRING} ${fanned ? '0ms' : delay + 'ms'}, opacity 200ms ease ${delay}ms, background-color 120ms ease, box-shadow 120ms ease, border 120ms ease`,
                cursor: "pointer",
              }}
              onClick={() => handleSelect(item.id)}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Icon size={18} strokeWidth={2} />
            </button>
            {isHovered && fanned && (
              <div
                className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1 text-[10px] font-semibold pointer-events-none"
                style={{ backgroundColor: "#263238", color: "#ffffff" }}
              >
                {item.label}
              </div>
            )}
          </div>
        );
      })}

      {/* Toggle deploy button (hinged bays only — positioned below center) */}
      {isHinged && (
        <div
          className="absolute"
          style={{
            left: -16,
            top: BTN / 2 + 8,
            transform: fanned ? "scale(1)" : "scale(0)",
            opacity: fanned ? 1 : 0,
            transition: `all 200ms ${SPRING} 100ms`,
          }}
        >
          <button
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-all"
            style={{
              backgroundColor: isOpen ? "#fff3e0" : "rgba(255,255,255,0.95)",
              color: isOpen ? "#e65100" : "#546e7a",
              border: isOpen ? "1.5px solid #e65100" : "1px solid rgba(0,0,0,0.1)",
              boxShadow: hoveredId === "toggle"
                ? "0 4px 16px rgba(0,0,0,0.22)"
                : "0 2px 10px rgba(0,0,0,0.12)",
              fontSize: "11px",
              fontWeight: 600,
              transform: hoveredId === "toggle" ? "scale(1.05)" : "scale(1)",
            }}
            onClick={() => {
              toggleBayOpen(ctx.containerId, ctx.wall, ctx.bayIndex);
            }}
            onMouseEnter={() => setHoveredId("toggle")}
            onMouseLeave={() => setHoveredId(null)}
          >
            {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {isOpen ? "Close" : "Deploy"}
          </button>
        </div>
      )}

      {/* Secondary options card (below center + toggle) */}
      <div
        className="absolute"
        style={{
          top: isHinged ? BTN / 2 + 44 : BTN / 2 + 56,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: fanned ? 1 : 0,
          transition: "opacity 300ms ease 180ms",
          pointerEvents: fanned ? "auto" : "none",
        }}
      >
        <div
          className="rounded-xl"
          style={{
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
            padding: hasSecondary ? "10px 12px" : "8px 10px",
            minWidth: hasSecondary ? 240 : undefined,
            display: "flex",
            flexDirection: "column",
            gap: "6px",
          }}
        >
          {/* Edge type (deployed hinged only) */}
          {isHinged && isOpen && (
            <div className="flex items-center gap-1.5">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0"
                style={{ color: "#90a4ae", width: 30 }}
              >
                Edge
              </span>
              {EDGE_OPTIONS.map((opt) => {
                const currentOuter = mod.type === ModuleType.HingedWall ? mod.outerWall : "railing";
                const active = currentOuter === opt.id;
                const isH = hoveredId === `e-${opt.id}`;
                return (
                  <div key={opt.id} className="relative">
                    <button
                      onClick={() => {
                        useStore.getState().setOuterWallType(ctx.containerId, ctx.wall, ctx.bayIndex, opt.id);
                      }}
                      onMouseEnter={() => setHoveredId(`e-${opt.id}`)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="flex items-center justify-center rounded-full transition-all"
                      style={{
                        width: 30,
                        height: 30,
                        backgroundColor: active ? opt.color : isH ? "#e8eaf0" : "#f4f6f8",
                        border: active ? "2px solid transparent" : isH ? `1.5px solid ${opt.color}60` : "1px solid #e0e0e0",
                        transform: isH ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: active ? "#ffffff" : opt.color }}
                      />
                    </button>
                    {isH && (
                      <div
                        className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-semibold pointer-events-none"
                        style={{ backgroundColor: "#263238", color: "#fff" }}
                      >
                        {opt.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Side edge type (deployed hinged only) */}
          {isHinged && isOpen && (
            <div className="flex items-center gap-1.5">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0"
                style={{ color: "#90a4ae", width: 30 }}
              >
                Side
              </span>
              {SIDE_OPTIONS.map((opt) => {
                const currentSide = mod.type === ModuleType.HingedWall ? mod.sideWall : undefined;
                const active = currentSide === opt.id;
                const isH = hoveredId === `s-${opt.id ?? "d"}`;
                return (
                  <div key={opt.id ?? "default"} className="relative">
                    <button
                      onClick={() => {
                        useStore.getState().setSideWallType(ctx.containerId, ctx.wall, ctx.bayIndex, opt.id);
                      }}
                      onMouseEnter={() => setHoveredId(`s-${opt.id ?? "d"}`)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="flex items-center justify-center rounded-full transition-all"
                      style={{
                        width: 30,
                        height: 30,
                        backgroundColor: active ? opt.color : isH ? "#e8eaf0" : "#f4f6f8",
                        border: active ? "2px solid transparent" : isH ? `1.5px solid ${opt.color}60` : "1px solid #e0e0e0",
                        transform: isH ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      <span
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: active ? "#ffffff" : opt.color }}
                      />
                    </button>
                    {isH && (
                      <div
                        className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-semibold pointer-events-none"
                        style={{ backgroundColor: "#263238", color: "#fff" }}
                      >
                        {opt.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Color swatches (solid panels only) */}
          {mod.type === ModuleType.PanelSolid && (
            <div className="flex items-center gap-1">
              <span
                className="text-[9px] font-bold uppercase tracking-wide shrink-0 mr-0.5"
                style={{ color: "#90a4ae", width: 30 }}
              >
                Color
              </span>
              {COLOR_OPTIONS.map((opt) => {
                const isH = hoveredId === `c-${opt.hex ?? "d"}`;
                return (
                  <div key={opt.hex ?? "default"} className="relative">
                    <button
                      onClick={() => {
                        useStore.getState().setBayColor(ctx.containerId, ctx.wall, ctx.bayIndex, opt.hex);
                      }}
                      onMouseEnter={() => setHoveredId(`c-${opt.hex ?? "d"}`)}
                      onMouseLeave={() => setHoveredId(null)}
                      className="transition-all"
                      style={{ transform: isH ? "scale(1.2)" : "scale(1)" }}
                    >
                      <span
                        className="w-5.5 h-5.5 rounded-full inline-block"
                        style={{
                          width: 22,
                          height: 22,
                          backgroundColor: opt.swatch,
                          border: mod.color === opt.hex ? "2.5px solid #1565c0" : isH ? "2px solid #90a4ae" : "1px solid #e0e0e0",
                        }}
                      />
                    </button>
                    {isH && (
                      <div
                        className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md px-2 py-0.5 text-[9px] font-semibold pointer-events-none"
                        style={{ backgroundColor: "#263238", color: "#fff" }}
                      >
                        {opt.label}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Apply to entire wall + lock indicator */}
          <div className="flex items-center justify-center gap-2 pt-1" style={{ borderTop: "1px solid #f0f0f0" }}>
            <button
              onClick={handleApplyToWall}
              onMouseEnter={() => setHoveredId("apply")}
              onMouseLeave={() => setHoveredId(null)}
              className="text-[10px] font-semibold px-3.5 py-1.5 rounded-lg transition-all"
              style={{
                color: "#1565c0",
                border: "1px solid #e3f2fd",
                backgroundColor: hoveredId === "apply" ? "#e3f2fd" : "transparent",
              }}
            >
              Apply to Entire Wall
            </button>
            {isLocked && (
              <span className="text-[9px] font-medium" style={{ color: "#e65100" }}>
                <Lock size={10} className="inline mr-0.5" style={{ verticalAlign: "middle" }} />
                Locked
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
