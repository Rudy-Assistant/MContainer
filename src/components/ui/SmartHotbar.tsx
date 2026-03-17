"use client";

import { useEffect, useCallback, useState, useMemo, useRef, type CSSProperties } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { useStore, type HotbarSlot, type HotbarCategory } from "@/store/useStore";
import { ViewMode, type SurfaceType, type VoxelFaces, FURNITURE_CATALOG } from "@/types/container";
// getCycleForFace import removed (Sprint 15) — dotRingIndicator deleted
import { MODULE_PRESETS, resolveModuleFaces } from "@/config/moduleCatalog";

// ── Room module slots for the Rooms tab ─────────────────────────
const ROOM_SLOTS = MODULE_PRESETS.filter(p =>
  ['kitchen_full', 'bathroom_full', 'bedroom', 'living_room', 'office', 'deck_open', 'storage', 'stairs'].includes(p.id)
);

const ORIENT_LABEL: Record<string, string> = { n: 'N', e: 'E', s: 'S', w: 'W' };

// ── Rarity accent colors — top-border stripe only ──────────────
const RARITY_ACCENT: Record<HotbarCategory, string> = {
  basic:    "#94a3b8",    // grey (structural)
  standard: "#3b82f6",    // blue (functional)
  complex:  "#8b5cf6",    // purple (mechanical)
  prefab:   "#f59e0b",    // gold (prefabs)
};

// ── Fixed 10-slot preset list — human-friendly names ────────
const FIXED_PRESETS: Array<{
  key: number;
  label: string;
  description: string;
  category: HotbarCategory;
  color: string;
  icon: string;
  faces: VoxelFaces;
  contexts: Array<'wall' | 'floor' | 'roof'>;
}> = [
  // 1 — Open Deck: wood floor, open above and sides
  { key: 1, category: 'basic', color: '#94a3b8', label: 'Deck',
    description: 'Open wood deck — no walls or ceiling',
    icon: 'M3 18h18 M6 18v-2h12v2',
    faces: { top: 'Open', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
    contexts: ['floor', 'wall', 'roof'] },
  // 2 — Platform: enclosed floor + ceiling
  { key: 2, category: 'standard', color: '#3b82f6', label: 'Platform',
    description: 'Floor and ceiling — no walls',
    icon: 'M3 6h18 M3 18h18',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
    contexts: ['wall', 'roof'] },
  // 3 — Balcony: floor + ceiling + cable railings
  { key: 3, category: 'standard', color: '#3b82f6', label: 'Balcony',
    description: 'Railed platform — cable railings all sides',
    icon: 'M3 6h18 M3 18h18 M5 6v12 M19 6v12',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Railing_Cable', s: 'Railing_Cable', e: 'Railing_Cable', w: 'Railing_Cable' },
    contexts: ['wall'] },
  // 4 — Glass Box: full glass walls, enclosed
  { key: 4, category: 'complex', color: '#8b5cf6', label: 'Glass Box',
    description: 'Floor-to-ceiling glass on all sides',
    icon: 'M3 3h18v18H3z M12 3v18 M3 12h18',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Glass_Pane', s: 'Glass_Pane', e: 'Glass_Pane', w: 'Glass_Pane' },
    contexts: ['wall'] },
  // 5 — Entry: door on one side, steel walls elsewhere
  { key: 5, category: 'complex', color: '#8b5cf6', label: 'Entry',
    description: 'Front door with steel walls',
    icon: 'M3 3h18v18H3z M8 21v-6h8v6',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Door', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
    contexts: ['wall'] },
  // 6 — Gallery: glass front/back, steel sides
  { key: 6, category: 'prefab', color: '#f59e0b', label: 'Gallery',
    description: 'Glass windows front & back, steel sides',
    icon: 'M3 3h18v18H3z M3 12h18',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Glass_Pane', s: 'Glass_Pane', e: 'Solid_Steel', w: 'Solid_Steel' },
    contexts: ['wall'] },
  // 7 — Empty: all faces open
  { key: 7, category: 'basic', color: '#94a3b8', label: 'Empty',
    description: 'Remove all surfaces — fully open',
    icon: 'M3 3h18v18H3z',
    faces: { top: 'Open', bottom: 'Open', n: 'Open', s: 'Open', e: 'Open', w: 'Open' },
    contexts: ['wall', 'floor', 'roof'] },
  // 8 — Sealed: solid steel box with wood floor
  { key: 8, category: 'basic', color: '#94a3b8', label: 'Sealed',
    description: 'Steel walls + ceiling, wood floor',
    icon: 'M3 3h18v18H3z M3 3l18 18',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Solid_Steel', w: 'Solid_Steel' },
    contexts: ['wall', 'roof'] },
  // 9 — Corridor: steel walls N/S, open passage E/W
  { key: 9, category: 'standard', color: '#3b82f6', label: 'Corridor',
    description: 'Walk-through passage — walls on long sides',
    icon: 'M3 3v18 M21 3v18',
    faces: { top: 'Solid_Steel', bottom: 'Deck_Wood', n: 'Solid_Steel', s: 'Solid_Steel', e: 'Open', w: 'Open' },
    contexts: ['wall'] },
  // 0 — Basin: concrete pool/planter
  { key: 0, category: 'prefab', color: '#f59e0b', label: 'Basin',
    description: 'Concrete basin — pool or planter',
    icon: 'M3 6h18v12H3z M5 8h14v8H5z',
    faces: { top: 'Open', bottom: 'Concrete', n: 'Concrete', s: 'Concrete', e: 'Concrete', w: 'Concrete' },
    contexts: ['floor'] },
];

// ── Human-readable surface names for tooltips ────────────────
const SURFACE_NAME: Record<SurfaceType, string> = {
  Open: "Open",
  Solid_Steel: "Steel",
  Glass_Pane: "Glass",
  Railing_Glass: "Glass Rail",
  Railing_Cable: "Cable Rail",
  Deck_Wood: "Wood Deck",
  Concrete: "Concrete",
  Half_Fold: "Half-Fold",
  Gull_Wing: "Gull-Wing",
  Door: "Door",
  Stairs: "Stairs ↑",
  Stairs_Down: "Stairs ↓",
  Wood_Hinoki: "Hinoki",
  Floor_Tatami: "Tatami",
  Wall_Washi: "Washi",
  Glass_Shoji: "Shoji",
  Window_Standard: "Window",
  Window_Sill: "Window Sill",
  Window_Clerestory: "Clerestory",
  Window_Half: "Half Window",
};

// ── Furniture SVG silhouettes ────────────────────────────────
function FurnitureSilhouette({ type }: { type: string }) {
  switch (type) {
    case 'sofa':
      return <><rect x="4" y="18" width="24" height="8" rx="2" /><rect x="4" y="14" width="5" height="12" rx="1" /><rect x="23" y="14" width="5" height="12" rx="1" /><rect x="7" y="16" width="18" height="6" rx="1" opacity="0.5" /></>;
    case 'bed':
    case 'bed_single':
      return <><rect x="4" y="18" width="24" height="8" rx="1" /><rect x="4" y="12" width="24" height="8" rx="1" opacity="0.6" /><rect x="4" y="12" width="24" height="3" rx="1" /></>;
    case 'kitchen':
    case 'kitchen_sink':
      return <><rect x="4" y="14" width="24" height="12" rx="1" /><rect x="6" y="16" width="8" height="4" rx="1" opacity="0.4" /><circle cx="22" cy="18" r="3" opacity="0.4" /></>;
    case 'bathroom':
    case 'shower':
      return <><rect x="8" y="8" width="3" height="18" rx="1" /><rect x="8" y="8" width="14" height="3" rx="1" /><circle cx="20" cy="11" r="2" /><rect x="6" y="24" width="20" height="4" rx="1" opacity="0.5" /></>;
    case 'desk':
      return <><rect x="4" y="16" width="24" height="3" rx="1" /><rect x="6" y="19" width="3" height="8" rx="0.5" /><rect x="23" y="19" width="3" height="8" rx="0.5" /><rect x="18" y="10" width="6" height="8" rx="1" opacity="0.5" /></>;
    case 'stairs':
      return <>{[0,1,2,3,4].map(i => <rect key={i} x={4+i*5} y={24-i*4} width={24-i*5} height="3" rx="0.5" />)}</>;
    case 'storage':
      return <><rect x="6" y="6" width="20" height="20" rx="2" /><line x1="6" y1="13" x2="26" y2="13" stroke="currentColor" strokeWidth="1" /><line x1="6" y1="20" x2="26" y2="20" stroke="currentColor" strokeWidth="1" /></>;
    case 'fridge':
      return <><rect x="8" y="4" width="16" height="24" rx="2" /><line x1="8" y1="16" x2="24" y2="16" stroke="currentColor" strokeWidth="1" /><circle cx="21" cy="10" r="1" opacity="0.5" /><circle cx="21" cy="22" r="1" opacity="0.5" /></>;
    case 'dining_table':
      return <><rect x="6" y="14" width="20" height="3" rx="1" /><rect x="8" y="17" width="2" height="9" rx="0.5" /><rect x="22" y="17" width="2" height="9" rx="0.5" /></>;
    default:
      return <rect x="6" y="6" width="20" height="20" rx="3" opacity="0.4" />;
  }
}

// ── Surface → CSS color for cube icons ──────────────────────
export function surfaceColor(s: SurfaceType): CSSProperties {
  switch (s) {
    case "Solid_Steel":
      return { background: "#78909c", borderColor: "rgba(0,0,0,0.25)" };
    case "Glass_Pane":
      return { background: "rgba(96, 165, 250, 0.5)", borderColor: "rgba(59, 130, 246, 0.6)" };
    case "Railing_Cable":
      return { background: "repeating-linear-gradient(0deg, transparent, transparent 2px, #607d8b 2px, #607d8b 3px)", borderColor: "rgba(0,0,0,0.2)" };
    case "Railing_Glass":
      return { background: "rgba(96, 165, 250, 0.35)", borderColor: "rgba(59, 130, 246, 0.4)" };
    case "Deck_Wood":
      return { background: "#8d6e63", borderColor: "rgba(93, 64, 55, 0.5)" };
    case "Concrete":
      return { background: "#9e9e9e", borderColor: "rgba(0,0,0,0.2)" };
    case "Half_Fold":
      return { background: "linear-gradient(180deg, #78909c 50%, #8d6e63 50%)", borderColor: "rgba(0,0,0,0.25)" };
    case "Gull_Wing":
      return { background: "linear-gradient(180deg, #78909c 30%, #333 48%, #333 52%, #78909c 70%)", borderColor: "rgba(0,0,0,0.3)" };
    case "Door":
      return { background: "linear-gradient(180deg, #546e7a 0%, #607d8b 40%, #78909c 100%)", borderColor: "#263238" };
    case "Stairs":
      return { background: "repeating-linear-gradient(45deg, #8d6e63, #8d6e63 4px, #5d4037 4px, #5d4037 8px)", borderColor: "#4e342e" };
    case "Stairs_Down":
      return { background: "repeating-linear-gradient(-45deg, #8d6e63, #8d6e63 4px, #5d4037 4px, #5d4037 8px)", borderColor: "#3e2723" };
    case "Wood_Hinoki":
      return { background: "#f5e6c8", borderColor: "#c8a96e" };
    case "Floor_Tatami":
      return { background: "#c8d5a0", borderColor: "#8aab55" };
    case "Wall_Washi":
      return { background: "rgba(248,244,236,0.85)", borderColor: "#d4c9b0", borderStyle: "solid" };
    case "Glass_Shoji":
      return { background: "rgba(250,250,250,0.7)", borderColor: "#c8c8c8", borderStyle: "solid" };
    case "Window_Standard":
      return { background: "linear-gradient(180deg, #78909c 30%, rgba(96,165,250,0.5) 35%, rgba(96,165,250,0.5) 80%, #78909c 85%)", borderColor: "#1565c0" };
    case "Window_Sill":
      return { background: "linear-gradient(180deg, rgba(96,165,250,0.5) 65%, #78909c 70%)", borderColor: "#1565c0" };
    case "Window_Clerestory":
      return { background: "linear-gradient(180deg, rgba(96,165,250,0.5) 25%, #78909c 30%)", borderColor: "#1565c0" };
    case "Window_Half":
      return { background: "linear-gradient(180deg, rgba(96,165,250,0.5) 50%, #78909c 55%)", borderColor: "#1565c0" };
    case "Open":
      return { background: "#f9fafb", borderColor: "rgba(0,0,0,0.1)", borderStyle: "dashed" };
    default:
      return { background: "#f9fafb", borderColor: "rgba(0,0,0,0.08)" };
  }
}

// ── High-contrast surface fills for isometric icon faces ─────
function surfaceFill(s: SurfaceType): CSSProperties {
  switch (s) {
    case "Solid_Steel":
      return {
        background: "linear-gradient(180deg, #b0bec5 0%, #78909c 40%, #607d8b 100%)",
        borderColor: "#37474f",
      };
    case "Glass_Pane":
      return {
        background: "linear-gradient(135deg, #90caf9 0%, #42a5f5 50%, #bbdefb 100%)",
        borderColor: "#1565c0",
      };
    case "Railing_Cable":
      return {
        background: "repeating-linear-gradient(0deg, #546e7a 0px, #546e7a 2px, #b0bec5 2px, #b0bec5 4px)",
        borderColor: "#37474f",
      };
    case "Railing_Glass":
      return {
        background: "linear-gradient(180deg, #90caf9 0%, #64b5f6 50%, #42a5f5 100%)",
        borderColor: "#1565c0",
      };
    case "Deck_Wood":
      return {
        background: "repeating-linear-gradient(0deg, #a1887f 0px, #a1887f 3px, #6d4c41 3px, #6d4c41 4px)",
        borderColor: "#3e2723",
      };
    case "Concrete":
      return {
        background: "linear-gradient(180deg, #e0e0e0 0%, #bdbdbd 50%, #9e9e9e 100%)",
        borderColor: "#616161",
      };
    case "Half_Fold":
      return {
        background: "linear-gradient(180deg, #78909c 0%, #78909c 45%, #333 45%, #333 55%, #8d6e63 55%, #8d6e63 100%)",
        borderColor: "#37474f",
      };
    case "Gull_Wing":
      return {
        background: "linear-gradient(180deg, #546e7a 0%, #78909c 20%, #333 42%, #eee 50%, #333 58%, #78909c 80%, #546e7a 100%)",
        borderColor: "#263238",
      };
    case "Door":
      return {
        background: "linear-gradient(180deg, #546e7a 0%, #607d8b 30%, #78909c 50%, #607d8b 70%, #546e7a 100%)",
        borderColor: "#263238",
      };
    case "Stairs":
      return {
        background: "repeating-linear-gradient(180deg, #8d6e63 0px, #8d6e63 4px, #5d4037 4px, #5d4037 5px)",
        borderColor: "#3e2723",
      };
    case "Stairs_Down":
      return {
        background: "repeating-linear-gradient(0deg, #8d6e63 0px, #8d6e63 4px, #5d4037 4px, #5d4037 5px)",
        borderColor: "#3e2723",
      };
    case "Wood_Hinoki":
      return {
        background: "repeating-linear-gradient(0deg, #f5e6c8 0px, #f5e6c8 3px, #e6c98e 3px, #e6c98e 4px)",
        borderColor: "#c8a96e",
      };
    case "Floor_Tatami":
      return {
        background: "linear-gradient(135deg, #c8d5a0 0%, #b5c688 50%, #d4dfa8 100%)",
        borderColor: "#8aab55",
      };
    case "Wall_Washi":
      return {
        background: "linear-gradient(180deg, #faf7f0 0%, #f8f4ec 50%, #f0ebe0 100%)",
        borderColor: "#d4c9b0",
      };
    case "Glass_Shoji":
      return {
        background: "linear-gradient(180deg, #ffffff 0%, #f5f5f5 50%, #eeeeee 100%)",
        borderColor: "#c8c8c8",
      };
    case "Window_Standard":
    case "Window_Sill":
    case "Window_Clerestory":
    case "Window_Half":
      return {
        background: "linear-gradient(180deg, #b0bec5 0%, #90caf9 40%, #42a5f5 60%, #b0bec5 100%)",
        borderColor: "#1565c0",
      };
    case "Open":
      return {
        background: "#f1f5f9",
        borderColor: "#cbd5e1",
        borderStyle: "dashed",
      };
    default:
      return {
        background: "#f9fafb",
        borderColor: "rgba(0,0,0,0.08)",
      };
  }
}

// ── Surface Detail Overlays — inner structural elements ────────
// Renders SVG-like detail inside each cube face for physical accuracy

function FaceDetail({ surface, w, h, brightness }: { surface: SurfaceType; w: number; h: number; brightness: number }) {
  const dim = Math.min(w, h);
  if (surface === "Open") return null;

  const color = brightness > 0.7 ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.2)";

  if (surface === "Glass_Pane") {
    // Mullion cross
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", left: "50%", top: "15%", bottom: "15%", width: 1, background: color, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", top: "50%", left: "15%", right: "15%", height: 1, background: color, transform: "translateY(-50%)" }} />
        {/* Shine streak */}
        <div style={{ position: "absolute", top: "10%", left: "20%", width: "30%", height: "15%", background: "rgba(255,255,255,0.3)", borderRadius: 1, transform: "rotate(-15deg)" }} />
      </div>
    );
  }

  if (surface === "Railing_Cable") {
    // Horizontal cable lines + top rail
    const lines = Math.max(2, Math.floor(dim / 5));
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {/* Top rail */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: brightness > 0.7 ? "#37474f" : "#90a4ae" }} />
        {/* Cables */}
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", top: `${20 + (i * 60 / lines)}%`, left: 0, right: 0,
            height: 1, borderBottom: `1px solid ${color}`,
          }} />
        ))}
        {/* Posts — left, center, right */}
        <div style={{ position: "absolute", left: 1, top: 0, bottom: 0, width: 1, background: color }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: color, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", right: 1, top: 0, bottom: 0, width: 1, background: color }} />
      </div>
    );
  }

  if (surface === "Railing_Glass") {
    // Glass panel with top rail + shimmer — visually distinct from cable railing
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {/* Top rail */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: brightness > 0.7 ? "#37474f" : "#90a4ae" }} />
        {/* Glass shimmer diagonal */}
        <div style={{ position: "absolute", top: "10%", left: "15%", width: "30%", height: "60%",
          background: "rgba(255,255,255,0.25)", transform: "skewX(-15deg)" }} />
        {/* Posts — left, center, right */}
        <div style={{ position: "absolute", left: 1, top: 0, bottom: 0, width: 1, background: color }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: color, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", right: 1, top: 0, bottom: 0, width: 1, background: color }} />
      </div>
    );
  }

  if (surface === "Deck_Wood") {
    // Plank lines
    const planks = Math.max(3, Math.floor(dim / 4));
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: planks }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", top: `${(i + 1) * (100 / (planks + 1))}%`, left: 0, right: 0,
            height: 0, borderBottom: `1px solid ${color}`,
          }} />
        ))}
      </div>
    );
  }

  if (surface === "Half_Fold") {
    // Fold mechanism visual: upper steel panel + hinge bar + lower wood panel
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {/* Upper panel (steel) */}
        <div style={{ position: "absolute", top: "4%", left: "5%", right: "5%", height: "42%",
          background: "rgba(120,144,156,0.35)", borderRadius: 1 }} />
        {/* Hinge bar */}
        <div style={{ position: "absolute", top: "48%", left: 0, right: 0, height: 3, background: "#333" }} />
        {/* Lower panel (wood) */}
        <div style={{ position: "absolute", bottom: "4%", left: "5%", right: "5%", height: "42%",
          background: "rgba(141,110,99,0.35)", borderRadius: 1 }} />
        {/* Hinge circles */}
        <div style={{ position: "absolute", top: "45%", left: "10%", width: 4, height: 4, borderRadius: "50%", background: "#607d8b" }} />
        <div style={{ position: "absolute", top: "45%", right: "10%", width: 4, height: 4, borderRadius: "50%", background: "#607d8b" }} />
      </div>
    );
  }

  if (surface === "Gull_Wing") {
    // Split hinge with symmetric wings
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "49%", left: 0, right: 0, height: 2, background: "#ddd" }} />
        <div style={{ position: "absolute", top: "20%", left: "50%", transform: "translateX(-50%)", fontSize: dim * 0.2, lineHeight: 1, color, opacity: 0.5 }}>▲</div>
        <div style={{ position: "absolute", bottom: "10%", left: "50%", transform: "translateX(-50%)", fontSize: dim * 0.2, lineHeight: 1, color, opacity: 0.5 }}>▼</div>
      </div>
    );
  }

  if (surface === "Door") {
    // Steel door frame + recessed panel + handle
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {/* Frame edges */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "15%", background: "rgba(0,0,0,0.25)" }} />
        <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "15%", background: "rgba(0,0,0,0.25)" }} />
        {/* Door panel inset */}
        <div style={{ position: "absolute", left: "15%", right: "15%", top: "3%", bottom: "3%",
          background: "rgba(255,255,255,0.08)", borderRadius: 1 }} />
        {/* Handle */}
        <div style={{ position: "absolute", right: "20%", top: "50%", width: 3, height: 8,
          background: color, borderRadius: 1, transform: "translateY(-50%)" }} />
      </div>
    );
  }

  if (surface === "Solid_Steel") {
    // Subtle corrugation ridges
    const ridges = Math.max(2, Math.floor(w / 4));
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {Array.from({ length: ridges }).map((_, i) => (
          <div key={i} style={{
            position: "absolute", left: `${(i + 1) * (100 / (ridges + 1))}%`, top: 0, bottom: 0,
            width: 0, borderLeft: `1px solid rgba(255,255,255,0.08)`,
          }} />
        ))}
      </div>
    );
  }

  if (surface === "Concrete") {
    // Speckle texture
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", opacity: 0.3 }}>
        <div style={{ position: "absolute", top: "20%", left: "30%", width: 2, height: 2, borderRadius: "50%", background: color }} />
        <div style={{ position: "absolute", top: "60%", left: "60%", width: 1.5, height: 1.5, borderRadius: "50%", background: color }} />
        <div style={{ position: "absolute", top: "40%", left: "15%", width: 1, height: 1, borderRadius: "50%", background: color }} />
      </div>
    );
  }

  return null;
}

// ── WU-6A: SVG Isometric Cube Icon ────────────────────────────
// True isometric projection using face colors from surfaceColor().

const ISO_COS = Math.cos(Math.PI / 6); // 0.866
const ISO_SIN = Math.sin(Math.PI / 6); // 0.5

function getIsoPoint(x: number, y: number, z: number, cx: number, cy: number): [number, number] {
  return [(x - z) * ISO_COS + cx, (x + z) * ISO_SIN - y + cy];
}

function extractSolidColor(cssBackground: string): string {
  const hexMatch = cssBackground.match(/#([0-9a-fA-F]{3,6})/);
  if (hexMatch) return `#${hexMatch[1]}`;
  const rgbaMatch = cssBackground.match(/rgba?\([^)]+\)/);
  if (rgbaMatch) return rgbaMatch[0];
  return '#cccccc';
}

function svgFaceColor(s: SurfaceType): string {
  return extractSolidColor((surfaceColor(s).background as string) || '#cccccc');
}

export function SvgVoxelIcon({
  faces,
  size = 70,
  activeFace,
}: {
  faces: VoxelFaces;
  size?: number;
  activeFace?: keyof VoxelFaces;
}) {
  const isFloorSlab = faces.n === 'Open' && faces.s === 'Open' && faces.e === 'Open' && faces.w === 'Open';
  // Floor slab: very thin (H=6) with centered positioning so it reads as a flat platform.
  // Full cube: standard isometric box.
  const W = 42, D = 25, H = isFloorSlab ? 6 : 60;
  const cx = 25, cy = isFloorSlab ? 52 : 55;

  const p = (x: number, y: number, z: number) => getIsoPoint(x, y, z, cx, cy);
  const vx = {
    F_BL: p(0, 0, 0), F_BR: p(W, 0, 0), B_BR: p(W, 0, D), B_BL: p(0, 0, D),
    F_TL: p(0, H, 0), F_TR: p(W, H, 0), B_TR: p(W, H, D), B_TL: p(0, H, D),
  };

  const polyStr = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

  const isFloorProxy = faces.top === 'Open' && faces.bottom !== 'Open';
  const topSurface = isFloorProxy ? faces.bottom : faces.top;

  const topColor   = topSurface !== 'Open' ? svgFaceColor(topSurface) : 'none';
  const southColor = faces.s    !== 'Open' ? svgFaceColor(faces.s)    : 'none';
  const eastColor  = faces.e    !== 'Open' ? svgFaceColor(faces.e)    : 'none';

  const stroke = '#1e293b', sw = 1.2, so = 0.35;
  const dashed = '#94a3b8', activeStroke = '#06b6d4';
  const topActive   = activeFace === 'top';
  const southActive = activeFace === 's' || activeFace === 'n';
  const eastActive  = activeFace === 'e' || activeFace === 'w';
  const vW = 70, vH = 95;

  return (
    <svg width={size} height={(size / vW) * vH} viewBox={`0 0 ${vW} ${vH}`}
      style={{ filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.3))' }}>
      {/* South face — hidden for floor slab (side height is invisible at H=10) */}
      {!isFloorSlab && (southColor !== 'none'
        ? <polygon points={polyStr([vx.F_BL, vx.F_BR, vx.F_TR, vx.F_TL])} fill={southColor}
            style={{ filter: 'brightness(0.78)' }}
            stroke={stroke} strokeWidth={sw} strokeOpacity={so} strokeLinejoin="round" />
        : <polygon points={polyStr([vx.F_BL, vx.F_BR, vx.F_TR, vx.F_TL])} fill="rgba(241,245,249,0.15)"
            stroke={dashed} strokeWidth={0.8} strokeDasharray="2,2" strokeLinejoin="round" />)}
      {!isFloorSlab && southActive && <polygon points={polyStr([vx.F_BL, vx.F_BR, vx.F_TR, vx.F_TL])}
        fill="none" stroke={activeStroke} strokeWidth={1.8} />}

      {/* East face — darker, hidden for floor slab */}
      {!isFloorSlab && (eastColor !== 'none'
        ? <polygon points={polyStr([vx.F_BR, vx.B_BR, vx.B_TR, vx.F_TR])} fill={eastColor}
            style={{ filter: 'brightness(0.57)' }}
            stroke={stroke} strokeWidth={sw} strokeOpacity={so} strokeLinejoin="round" />
        : <polygon points={polyStr([vx.F_BR, vx.B_BR, vx.B_TR, vx.F_TR])} fill="rgba(241,245,249,0.08)"
            stroke={dashed} strokeWidth={0.8} strokeDasharray="2,2" strokeLinejoin="round" />)}
      {!isFloorSlab && eastActive && <polygon points={polyStr([vx.F_BR, vx.B_BR, vx.B_TR, vx.F_TR])}
        fill="none" stroke={activeStroke} strokeWidth={1.8} />}

      {/* Top face — brightest, always rendered */}
      {topColor !== 'none'
        ? <polygon points={polyStr([vx.F_TL, vx.F_TR, vx.B_TR, vx.B_TL])} fill={topColor}
            stroke={stroke} strokeWidth={sw} strokeOpacity={so} strokeLinejoin="round" />
        : <polygon points={polyStr([vx.F_TL, vx.F_TR, vx.B_TR, vx.B_TL])} fill="none"
            stroke={dashed} strokeWidth={0.8} strokeDasharray="2,2" strokeLinejoin="round" />}
      {topActive && <polygon points={polyStr([vx.F_TL, vx.F_TR, vx.B_TR, vx.B_TL])}
        fill="none" stroke={activeStroke} strokeWidth={1.8} />}

      {/* Floor proxy ↓ glyph */}
      {isFloorProxy && topColor !== 'none' && (
        <text x={vx.B_TR[0] - 1} y={vx.B_TR[1] + 8} fontSize={7}
          fill="rgba(255,255,255,0.7)" textAnchor="middle">↓</text>
      )}
    </svg>
  );
}

// ── High-Fidelity CSS-3D Isometric Cube Icon ─────────────────
// Shows 3 visible faces (top, south, east) with surface-specific fills
// and inner structural detail overlays for physical accuracy

export function CssVoxelIcon({ faces, size = 20, activeFace }: { faces: VoxelFaces; size?: number; activeFace?: keyof VoxelFaces }) {
  const shortSide = 30;                   // East/West face width (hardcoded)
  const longSide  = 60;                   // North/South face depth (hardcoded)
  const wX = longSide;                    // Maps to South face in CSS (wide = colPitch)
  const wZ = shortSide;                   // Maps to East face in CSS (narrow = rowPitch)
  // Collapse to a flat slab (8px) for floor-only presets (all walls Open, top Open, bottom non-Open)
  const isFloorPreset = faces.bottom !== 'Open' && faces.top === 'Open' &&
    faces.n === 'Open' && faces.s === 'Open' && faces.e === 'Open' && faces.w === 'Open';
  const wY = isFloorPreset ? 8 : Math.round(longSide * 1.43);
  const halfX = wX / 2;
  const halfZ = wZ / 2;
  const halfY = wY / 2;
  const containerSize = longSide + shortSide + 30; // 120px outer viewport — accommodates taller icon

  const faceBaseShared: CSSProperties = {
    position: "absolute",
    borderWidth: 1.5,
    borderStyle: "solid",
    backfaceVisibility: "hidden",
    boxSizing: "border-box",
    overflow: "hidden",
  };

  // WU-4: Floor proxy — when top is Open but bottom has material, show bottom on top face.
  const isFloorProxy = faces.top === 'Open' && faces.bottom !== 'Open';
  const topSurface = isFloorProxy ? faces.bottom : faces.top;
  const topFill = surfaceFill(topSurface);

  // Open faces render as wireframe-only (no fill)
  const topIsOpen = topSurface === "Open";

  // Active face highlight (cyan inset ring)
  const southActive = activeFace === 's' || activeFace === 'n';
  const eastActive  = activeFace === 'e' || activeFace === 'w';
  const topActive   = activeFace === 'top';

  return (
    <div style={{
      width: containerSize,
      height: containerSize,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      perspective: 200,
      filter: "drop-shadow(1px 2px 4px rgba(0,0,0,0.4))",
    }}>
      <div style={{
        width: wX,
        height: wY,
        position: "relative",
        transformStyle: "preserve-3d",
        transform: "rotateX(60deg) rotateZ(45deg)",
      }}>
        {/* Top face */}
        <div style={{
          ...faceBaseShared,
          width: wX, height: wZ,
          ...(topIsOpen ? { background: "transparent", borderColor: "#94a3b8", borderStyle: "dashed", borderWidth: 1 } : topFill),
          transform: `rotateX(90deg) translateZ(${halfY}px)`,
          ...(topActive ? { boxShadow: "inset 0 0 0 2px #06b6d4" } : {}),
        }}>
          {!topIsOpen && <FaceDetail surface={topSurface} w={wX} h={wZ} brightness={1.0} />}
          {isFloorProxy && !topIsOpen && (
            <span style={{
              position: "absolute", bottom: 1, right: 2,
              fontSize: 7, lineHeight: 1, color: "rgba(255,255,255,0.7)",
              fontFamily: "system-ui", pointerEvents: "none", userSelect: "none",
            }}>↓</span>
          )}
        </div>
        {/* Wide left face — N/S long side walls */}
        <div style={{
          ...faceBaseShared,
          width: wX, height: wY,
          ...(faces.s === "Open" ? { background: "rgba(241,245,249,0.3)", borderColor: "#94a3b8", borderStyle: "dashed", borderWidth: 1 } : surfaceFill(faces.s)),
          transform: `translateZ(${halfZ}px)`,
          filter: faces.s === "Open" ? "brightness(0.9)" : "brightness(0.78)",
          ...(southActive ? { boxShadow: "inset 0 0 0 2px #06b6d4" } : {}),
        }}>
          {faces.s !== "Open" && <FaceDetail surface={faces.s} w={wX} h={wY} brightness={0.78} />}
        </div>
        {/* Narrow right face — E/W short end walls */}
        <div style={{
          ...faceBaseShared,
          width: wZ, height: wY,
          ...(faces.e === "Open" ? { background: "rgba(241,245,249,0.2)", borderColor: "#94a3b8", borderStyle: "dashed", borderWidth: 1 } : surfaceFill(faces.e)),
          transform: `rotateY(90deg) translateZ(${halfX}px)`,
          filter: faces.e === "Open" ? "brightness(0.7)" : "brightness(0.55)",
          ...(eastActive ? { boxShadow: "inset 0 0 0 2px #06b6d4" } : {}),
        }}>
          {faces.e !== "Open" && <FaceDetail surface={faces.e} w={wZ} h={wY} brightness={0.55} />}
        </div>
        {/* Bottom face — visible through open sides */}
        {faces.bottom !== "Open" && (topIsOpen || faces.s === "Open" || faces.e === "Open") && (
          <div style={{
            ...faceBaseShared,
            width: wX, height: wZ,
            ...surfaceFill(faces.bottom),
            transform: `rotateX(-90deg) translateZ(${halfY}px)`,
            filter: "brightness(0.4)",
          }}>
            <FaceDetail surface={faces.bottom} w={wX} h={wZ} brightness={0.4} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Module-scope 3D materials — MeshBasicMaterial for immediate rendering ──
// MeshBasicMaterial bypasses PBR shader compilation, ensuring icons are NEVER
// unlit gray/black due to async shader compile + frameloop="demand" freezing.
const _mSteel     = new THREE.MeshBasicMaterial({ color: 0x78909c });
const _mSteelInner = new THREE.MeshBasicMaterial({ color: 0xb8845a });
const _mGlass     = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.70 });
const _mWood      = new THREE.MeshBasicMaterial({ color: 0x8b5a2b });
const _mRail      = new THREE.MeshBasicMaterial({ color: 0x2a2a2a });
const _mRailGlass = new THREE.MeshBasicMaterial({ color: 0xb3e5fc, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
const _mConcrete  = new THREE.MeshBasicMaterial({ color: 0x9e9e9e });
const _mOpen      = new THREE.MeshBasicMaterial({ color: 0xcbd5e1, transparent: true, opacity: 0.06, side: THREE.DoubleSide });
const _mFrame     = new THREE.MeshBasicMaterial({ color: 0x424242 });

// ── Additional surface materials (JP palette + functional types) ──
const _mDoor     = new THREE.MeshBasicMaterial({ color: 0x546e7a });          // Blue-gray steel door
const _mStairs   = new THREE.MeshBasicMaterial({ color: 0x8b6f47 });          // Dark wood treads
const _mHinoki   = new THREE.MeshBasicMaterial({ color: 0xf5e6c8 });          // Cream Hinoki cedar
const _mTatami   = new THREE.MeshBasicMaterial({ color: 0xb8c89a });          // Sage green mat
const _mWashi    = new THREE.MeshBasicMaterial({ color: 0xf8f4ec, transparent: true, opacity: 0.85 });
const _mStairsDn = new THREE.MeshBasicMaterial({ color: 0x6d4c32 });          // Darker wood, descend

// X-ray variants (camera-facing walls) — same colors, reduced opacity
const _mSteelXray    = new THREE.MeshBasicMaterial({ color: 0x78909c, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
const _mGlassXray    = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.28 });
const _mWoodXray     = new THREE.MeshBasicMaterial({ color: 0x8b5a2b, transparent: true, opacity: 0.28 });
const _mConcreteXray = new THREE.MeshBasicMaterial({ color: 0x9e9e9e, transparent: true, opacity: 0.28 });

// Real container voxel proportions, normalized to H=1.0
const MINI_W = 2.03 / 2.90;  // ≈ 0.700
const MINI_H = 1.00;
const MINI_D = 1.22 / 2.90;  // ≈ 0.421
const _miniBox   = new THREE.BoxGeometry(MINI_W, MINI_H, MINI_D);
const _miniEdges = new THREE.EdgesGeometry(_miniBox);
const _edgeMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.5 });

function getMiniMat(s: SurfaceType, xray = false): THREE.Material {
  if (xray) {
    switch (s) {
      case "Solid_Steel": case "Half_Fold": case "Gull_Wing": case "Door": return _mSteelXray;
      case "Glass_Pane": case "Railing_Glass": case "Wall_Washi": case "Glass_Shoji": return _mGlassXray;
      case "Deck_Wood": case "Stairs": case "Stairs_Down": case "Wood_Hinoki": case "Floor_Tatami": return _mWoodXray;
      case "Concrete": return _mConcreteXray;
      default: return _mOpen;
    }
  }
  switch (s) {
    case "Solid_Steel": return _mSteel;
    case "Glass_Pane": return _mGlass;
    case "Railing_Cable": return _mRail;
    case "Railing_Glass": return _mRailGlass;
    case "Deck_Wood": return _mWood;
    case "Concrete": return _mConcrete;
    case "Half_Fold": return _mSteel;
    case "Gull_Wing": return _mSteel;
    case "Door": return _mDoor;
    case "Stairs": return _mStairs;
    case "Stairs_Down": return _mStairsDn;
    case "Wood_Hinoki": return _mHinoki;
    case "Floor_Tatami": return _mTatami;
    case "Wall_Washi": return _mWashi;
    case "Glass_Shoji": return _mGlass;
    case "Open": return _mOpen;
    default: return _mOpen;
  }
}

const T3D = 0.06; // face panel thickness

/** Single face plane for the mini voxel cube */
function MiniFace({ face, surface, xray = false }: { face: keyof VoxelFaces; surface: SurfaceType; xray?: boolean }) {
  const mat = getMiniMat(surface, xray);
  const config = useMemo(() => {
    switch (face) {
      case "top":    return { pos: [0, MINI_H/2, 0] as const,   geo: [MINI_W, T3D,    MINI_D] as const };
      case "bottom": return { pos: [0, -MINI_H/2, 0] as const,  geo: [MINI_W, T3D,    MINI_D] as const };
      case "n":      return { pos: [0, 0, -MINI_D/2] as const,  geo: [MINI_W, MINI_H, T3D   ] as const };
      case "s":      return { pos: [0, 0,  MINI_D/2] as const,  geo: [MINI_W, MINI_H, T3D   ] as const };
      case "e":      return { pos: [MINI_W/2, 0, 0] as const,   geo: [T3D,    MINI_H, MINI_D] as const };
      case "w":      return { pos: [-MINI_W/2, 0, 0] as const,  geo: [T3D,    MINI_H, MINI_D] as const };
    }
  }, [face]);

  return (
    <mesh position={config.pos as unknown as [number, number, number]} material={mat}>
      <boxGeometry args={config.geo as unknown as [number, number, number]} />
    </mesh>
  );
}

/** Mini 3D voxel preview scene */
function MiniVoxelScene({ faces }: { faces: VoxelFaces }) {
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 2]} intensity={0.7} />
      <group position={[0, -0.08, 0]} rotation={[-Math.PI / 8, Math.PI / 4, 0]}>
        <lineSegments>
          <primitive object={_miniEdges} attach="geometry" />
          <primitive object={_edgeMat} attach="material" />
        </lineSegments>
        {(["top", "bottom", "n", "s", "e", "w"] as const).map((f) => (
          <MiniFace key={f} face={f} surface={faces[f]} xray={f === 'n' || f === 'w'} />
        ))}
      </group>
    </>
  );
}

/** Exported mini 3D icon component for hotbar slots. */
export function MiniVoxel3D({ faces, size = 36, activeFace }: { faces: VoxelFaces; size?: number; activeFace?: keyof VoxelFaces }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return <CssVoxelIcon faces={faces} size={size * 0.72} activeFace={activeFace} />;
  }

  return (
    <div style={{
      width: size, height: size + 6, borderRadius: 4,
      overflow: "visible",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Canvas
        orthographic
        camera={{ position: [2, 1.8, 2], zoom: size * 0.55, near: -10, far: 10 }}
        gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
        dpr={[1, 1.5]}
        frameloop="demand"
        style={{ background: "transparent", width: size, height: size + 6 }}
      >
        <MiniVoxelScene faces={faces} />
      </Canvas>
    </div>
  );
}

// ── Slot Button ─────────────────────────────────────────────

function HotbarSlotButton({
  slot, index, isActive, isCurrentMaterial, activeFace, onSelect, onHoverChange,
}: {
  slot: HotbarSlot;
  index: number;
  isActive: boolean;
  isCurrentMaterial: boolean;
  activeFace?: keyof VoxelFaces;
  onSelect: (i: number) => void;
  onHoverChange: (hoveredIndex: number | null) => void;
}) {
  const accent = RARITY_ACCENT[slot.category];

  return (
    <button
      onClick={() => onSelect(index)}
      onMouseEnter={() => onHoverChange(index)}
      onMouseLeave={() => onHoverChange(null)}
      title={slot.label || `Slot ${slot.key}`}
      style={{
        width: 64,
        height: 80,
        borderRadius: 7,
        border: `1px solid #e5e7eb`,
        background: isActive ? `${accent}12` : "#ffffff",
        cursor: "pointer",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        transition: "all 120ms ease",
        boxShadow: isActive
          ? `0 0 0 1px ${accent}30, 0 4px 12px ${accent}20`
          : "0 1px 3px rgba(0,0,0,0.06)",
        outline: "none",
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Key badge */}
      <span style={{
        position: "absolute", top: 2, left: 4,
        fontSize: 9, fontWeight: 800,
        color: isActive ? accent : "#9ca3af",
        lineHeight: 1, fontFamily: "monospace", zIndex: 2,
      }}>
        {slot.key === 0 ? "0" : String(slot.key)}
      </span>

      {/* Current-material indicator — grey bottom border */}
      {isCurrentMaterial && !isActive && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 3,
          background: "#94a3b8", borderRadius: "0 0 7px 7px",
        }} />
      )}

      {/* 3D mini voxel icon */}
      {slot.faces && (
        <div style={{ pointerEvents: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <MiniVoxel3D faces={slot.faces} size={50} activeFace={activeFace} />
        </div>
      )}

      {/* Label */}
      {slot.label && (
        <span style={{
          position: "absolute", bottom: 2,
          fontSize: 7, fontWeight: 800,
          color: isActive ? accent : "#6b7280",
          lineHeight: 1, letterSpacing: 0.5,
          textTransform: "uppercase", zIndex: 2,
        }}>
          {slot.label}
        </span>
      )}
    </button>
  );
}

// ── SmartHotbar ─────────────────────────────────────────────

export default function SmartHotbar() {
  const activeSlot = useStore((s) => s.activeHotbarSlot);
  const setActiveSlot = useStore((s) => s.setActiveHotbarSlot);
  const selection = useStore((s) => s.selection);
  const hoveredVoxelEdge = useStore((s) => s.hoveredVoxelEdge);
  const hoveredVoxel = useStore((s) => s.hoveredVoxel);
  const faceContext = useStore((s) => s.faceContext);
  // facePreview hover removed (Sprint 15) — click to select, then click to apply
  // Module preset state
  const activeModulePreset = useStore((s) => s.activeModulePreset);
  const setActiveModulePreset = useStore((s) => s.setActiveModulePreset);
  const moduleOrientation = useStore((s) => s.moduleOrientation);
  const rotateModuleOrientation = useStore((s) => s.rotateModuleOrientation);
  const activeHotbarTab = useStore((s) => s.activeHotbarTab);
  const setActiveHotbarTab = useStore((s) => s.setActiveHotbarTab);
  const cycleHotbarTab = useStore((s) => s.cycleHotbarTab);
  const hotbarMode: 'rooms' | 'materials' | 'furniture' = activeHotbarTab === 0 ? 'rooms' : activeHotbarTab === 1 ? 'materials' : 'furniture';

  // Ghost scroll removed (Sprint 15) — use number keys or click to select hotbar slot

  const viewMode = useStore((s) => s.viewMode);
  const isWalkthrough = viewMode === ViewMode.Walkthrough;
  const hasSelection = selection.length > 0;
  const [hotbarHovered, setHotbarHovered] = useState(false);
  const showHotbar = hasSelection || hotbarHovered || (hoveredVoxel !== null && !hoveredVoxel?.isExtension) || isWalkthrough;

  // Hover tooltip state
  const [hoveredSlot, setHoveredSlot] = useState<number | null>(null);

  // Eyedropper overlay — brief flash when activeBrush is set via Alt+click
  const activeBrush = useStore((s) => s.activeBrush);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const prevBrushRef = useRef<SurfaceType | null>(null);
  useEffect(() => {
    if (activeBrush && activeBrush !== prevBrushRef.current) {
      setPickedName(SURFACE_NAME[activeBrush] ?? activeBrush);
      const timer = setTimeout(() => setPickedName(null), 1500);
      prevBrushRef.current = activeBrush;
      return () => clearTimeout(timer);
    }
    prevBrushRef.current = activeBrush;
  }, [activeBrush]);

  // Context-aware tab auto-switch: face context → materials, null → rooms
  const lastManualSwitchRef = useRef(0);
  useEffect(() => {
    if (Date.now() - lastManualSwitchRef.current < 2000) return;
    const currentTab = useStore.getState().activeHotbarTab;
    if (faceContext) {
      if (currentTab !== 1) setActiveHotbarTab(1);
    } else {
      if (currentTab !== 0) setActiveHotbarTab(0);
    }
  }, [faceContext, setActiveHotbarTab]);

  // Sync FIXED_PRESETS to store on mount so ContainerSkin's getStampFaces() works
  useEffect(() => {
    useStore.getState().setHotbar(
      FIXED_PRESETS.map(p => ({
        key: p.key,
        category: p.category,
        label: p.label,
        color: p.color,
        icon: p.icon,
        faces: p.faces as VoxelFaces,
        contexts: p.contexts,
      }))
    );
  }, []);

  const handleSelect = useCallback(
    (index: number) => {
      if (index >= FIXED_PRESETS.length) return;
      setActiveSlot(activeSlot === index ? null : index);
    },
    [activeSlot, setActiveSlot]
  );

  // Keyboard: 1-8 select slots 0-7, Escape clears, 9/0 disabled
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.shiftKey || e.altKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === 'Escape') {
        setActiveSlot(null);
        setActiveModulePreset(null);
        useStore.getState().setActiveBrush(null);
        return;
      }

      // R key: rotate module orientation
      if ((e.key === 'r' || e.key === 'R') && !e.ctrlKey && !e.metaKey) {
        rotateModuleOrientation();
        return;
      }

      // Tab / = / - : switch between Rooms and Materials tabs
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        lastManualSwitchRef.current = Date.now();
        cycleHotbarTab(1);
        return;
      }
      if (e.key === '=' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        lastManualSwitchRef.current = Date.now();
        cycleHotbarTab(1);
        return;
      }
      if (e.key === '-' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        lastManualSwitchRef.current = Date.now();
        cycleHotbarTab(-1);
        return;
      }

      let slotIndex = -1;
      if (e.key >= "1" && e.key <= "9") slotIndex = parseInt(e.key) - 1;
      else if (e.key === "0") slotIndex = 9;

      // Only allow selection for the 8 fixed preset slots
      if (slotIndex >= 0 && slotIndex < FIXED_PRESETS.length) {
        e.preventDefault();
        e.stopPropagation();
        setActiveSlot(activeSlot === slotIndex ? null : slotIndex);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeSlot, setActiveSlot]);

  // Scroll-wheel cycling REMOVED (Sprint 14) — scroll now always means camera zoom.
  // Material cycling: use hotbar number keys (1-9) + click/E to apply.
  // Block preset cycling: use hotbar presets + click to stamp.

  // Face preview hover hologram REMOVED (Sprint 15) — was distracting.
  // Users now: click to select voxel/face → pick hotbar slot → click/E to apply.

  // Current material indicator — which preset slot matches the committed face
  const containers = useStore((s) => s.containers);
  const currentMaterialSlot = (() => {
    if (!hoveredVoxelEdge) return -1;
    const face = hoveredVoxelEdge.face;
    const currentSurface = containers[hoveredVoxelEdge.containerId]
      ?.voxelGrid?.[hoveredVoxelEdge.voxelIndex]
      ?.faces?.[face];
    if (!currentSurface) return -1;
    return FIXED_PRESETS.findIndex((p) => p.faces[face as keyof VoxelFaces] === currentSurface);
  })();

  const activePreset = activeSlot !== null && activeSlot < FIXED_PRESETS.length ? FIXED_PRESETS[activeSlot] : null;
  const activeAccent = activePreset ? RARITY_ACCENT[activePreset.category] : null;
  const activeLabel = activePreset?.label ?? null;

  const hoveredPreset = hoveredSlot !== null && hoveredSlot < FIXED_PRESETS.length ? FIXED_PRESETS[hoveredSlot] : null;
  const hoveredAccent = hoveredPreset ? RARITY_ACCENT[hoveredPreset.category] : null;

  // Dot+Ring indicator REMOVED (Sprint 15) — was visually noisy.

  return (
    <>
      {/* ── Main Hotbar ── */}
      <div
        onMouseEnter={() => setHotbarHovered(true)}
        onMouseLeave={() => { setHotbarHovered(false); }}
        style={{
          position: "fixed", bottom: showHotbar ? 40 : 16, left: "50%",
          transform: showHotbar ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(10px)",
          zIndex: 25, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
          opacity: showHotbar ? 1 : 0,
          transition: "opacity 150ms ease, transform 150ms ease, bottom 150ms ease",
          pointerEvents: showHotbar ? "auto" : "none",
        }}
      >
        {/* Active label */}
        {activeLabel && !hoveredPreset && (
          <div style={{
            fontSize: 11, fontWeight: 800, letterSpacing: 1.2, textTransform: "uppercase",
            color: activeAccent ?? "#374151",
            background: "rgba(255,255,255,0.8)",
            backdropFilter: "blur(8px)",
            padding: "3px 16px", borderRadius: 5,
            border: `2px solid ${activeAccent}`,
            boxShadow: `0 2px 12px ${activeAccent}30`,
            whiteSpace: "nowrap",
          }}>
            {activeLabel}
          </div>
        )}

        {/* Hover tooltip — shows name + description */}
        {hoveredPreset && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
            background: "#ffffff",
            padding: "4px 18px", borderRadius: 6,
            border: `2px solid ${hoveredAccent}`,
            boxShadow: `0 2px 10px ${hoveredAccent}30`,
            whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: "uppercase",
              color: hoveredAccent ?? "#374151" }}>
              {hoveredPreset.label}
            </span>
            <span style={{ fontSize: 9, fontWeight: 500, color: "#64748b", letterSpacing: 0.3 }}>
              {hoveredPreset.description}
            </span>
          </div>
        )}

        {/* Context chip */}
        {faceContext !== null && !hoveredPreset && !activeLabel && (
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.0, textTransform: "uppercase",
            color: faceContext === 'wall' ? "#607d8b" : faceContext === 'roof' ? "#5c6bc0" : "#8d6e63",
            background: faceContext === 'wall' ? "rgba(96,125,139,0.12)" : faceContext === 'roof' ? "rgba(92,107,192,0.12)" : "rgba(141,110,99,0.12)",
            border: `1px solid ${faceContext === 'wall' ? "rgba(96,125,139,0.3)" : faceContext === 'roof' ? "rgba(92,107,192,0.3)" : "rgba(141,110,99,0.3)"}`,
            padding: "2px 10px", borderRadius: 4, whiteSpace: "nowrap",
          }}>
            {faceContext === 'wall' ? "Wall" : faceContext === 'roof' ? "Roof" : "Floor"} tools
          </div>
        )}

        {/* ── Tab Pills ── */}
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,0.6)", borderRadius: 8, padding: 2, border: "1px solid rgba(255,255,255,0.4)", backdropFilter: "blur(8px)" }}>
          {([
            { tab: 0, label: "Rooms", mode: 'rooms' as const },
            { tab: 1, label: "Surfaces", mode: 'materials' as const },
            { tab: 2, label: "Furniture", mode: 'furniture' as const },
          ]).map(({ tab, label, mode }) => (
            <button
              key={tab}
              onClick={() => setActiveHotbarTab(tab)}
              style={{
                padding: "4px 14px", borderRadius: 6, border: "none", cursor: "pointer",
                fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                background: hotbarMode === mode ? "#3b82f6" : "transparent",
                color: hotbarMode === mode ? "#fff" : "#64748b",
                transition: "all 120ms ease",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Hotbar Bar — 10 slots, flex-start, 720px ── */}
        <div
          style={{
            display: hotbarMode === 'materials' ? "flex" : "none",
            justifyContent: "flex-start",
            gap: 4,
            padding: "7px 10px 12px",
            borderRadius: 12,
            width: 720,
            position: "relative",
            background: "rgba(255, 255, 255, 0.78)",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          }}
        >
          {/* Active slot frame — solid border box around active slot */}
          {activeSlot !== null && activeSlot < FIXED_PRESETS.length && (
            <div style={{
              position: 'absolute',
              top: 7,
              left: 10 + activeSlot * 68,
              width: 64,
              height: 80,
              border: `2px solid ${activeAccent ?? '#1565c0'}`,
              borderRadius: 8,
              boxSizing: 'border-box',
              pointerEvents: 'none',
              zIndex: 10,
              transition: 'left 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          )}

          {/* Active dot — at TOP of frame, above the icon */}
          {activeSlot !== null && activeSlot < FIXED_PRESETS.length && (
            <div style={{
              position: 'absolute',
              top: 3,
              left: (10 + activeSlot * 68) + 28,
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: activeAccent ?? '#1565c0',
              pointerEvents: 'none',
              zIndex: 11,
              transition: 'left 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          )}

          {/* Active slot underline bar */}
          {activeSlot !== null && activeSlot < FIXED_PRESETS.length && (
            <div style={{
              position: 'absolute',
              bottom: 7,
              left: 10 + activeSlot * 68 + 4,
              width: 56,
              height: 2,
              borderRadius: 1,
              background: activeAccent ?? '#1565c0',
              pointerEvents: 'none',
              zIndex: 11,
              transition: 'left 150ms cubic-bezier(0.4, 0, 0.2, 1)',
            }} />
          )}

          {/* 10 slots: 0–7 = FIXED_PRESETS, 8–9 = disabled placeholders */}
          {Array.from({ length: 10 }, (_, i) => {
            const isDisabled = i >= FIXED_PRESETS.length;
            const displayKey = i < 9 ? String(i + 1) : "0";

            if (isDisabled) {
              return (
                <div key={`disabled-${i}`} style={{
                  width: 64, height: 80, borderRadius: 7,
                  border: "1px dashed #e2e8f0",
                  background: "#fafafa",
                  display: "flex", alignItems: "flex-start", justifyContent: "flex-start",
                  padding: "2px 4px",
                  flexShrink: 0,
                  opacity: 0.5,
                  pointerEvents: 'none',
                }}>
                  <span style={{ fontSize: 9, fontWeight: 800, color: "#d1d5db", fontFamily: "monospace" }}>
                    {displayKey}
                  </span>
                </div>
              );
            }

            const preset = FIXED_PRESETS[i];
            const slot: HotbarSlot = {
              key: preset.key,
              category: preset.category,
              label: preset.label,
              color: preset.color,
              icon: preset.icon,
              faces: preset.faces as VoxelFaces,
              contexts: preset.contexts,
            };
            const isActive = activeSlot === i;
            const isFiltered = faceContext !== null && !preset.contexts.includes(faceContext);

            return (
              <div key={preset.key} style={{ opacity: isFiltered ? 0.35 : 1, transition: "opacity 150ms ease", flexShrink: 0 }}>
                <HotbarSlotButton
                  slot={slot}
                  index={i}
                  isActive={isActive}
                  isCurrentMaterial={currentMaterialSlot === i && !isActive}
                  activeFace={isActive ? hoveredVoxelEdge?.face : undefined}
                  onSelect={handleSelect}
                  onHoverChange={setHoveredSlot}
                />
              </div>
            );
          })}

          {/* Eyedropper overlay */}
          {pickedName && (
            <div style={{
              position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.75)", color: "#fff", padding: "4px 12px",
              borderRadius: 6, fontSize: 11, fontWeight: 600, whiteSpace: "nowrap",
              pointerEvents: "none", zIndex: 10,
            }}>
              Picked: {pickedName}
            </div>
          )}
        </div>

        {/* ── Rooms Bar — module presets ── */}
        <div
          style={{
            display: hotbarMode === 'rooms' ? "flex" : "none",
            justifyContent: "flex-start",
            gap: 4,
            padding: "7px 10px 12px",
            borderRadius: 12,
            width: 720,
            position: "relative",
            background: "rgba(255, 255, 255, 0.78)",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
          }}
        >
          {ROOM_SLOTS.map((mod) => {
            const isActive = activeModulePreset === mod.id;
            return (
              <div
                key={mod.id}
                onClick={() => setActiveModulePreset(isActive ? null : mod.id)}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 7,
                  border: isActive ? "2px solid #3b82f6" : "1px solid #e2e8f0",
                  background: isActive ? "rgba(59,130,246,0.08)" : "#fafafa",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 120ms ease",
                  position: "relative",
                }}
              >
                <div style={{ width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                  <CssVoxelIcon faces={resolveModuleFaces(mod, 'n')} size={40} />
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, color: isActive ? "#3b82f6" : "#64748b", textAlign: "center", lineHeight: 1.1 }}>
                  {mod.label}
                </span>
                {isActive && (
                  <span style={{
                    position: "absolute", top: 2, right: 3,
                    fontSize: 8, fontWeight: 800, color: "#3b82f6",
                    background: "rgba(59,130,246,0.12)", borderRadius: 3, padding: "1px 3px",
                  }}>
                    {ORIENT_LABEL[moduleOrientation]}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Furniture Bar ── */}
        <div
          style={{
            display: hotbarMode === 'furniture' ? "flex" : "none",
            justifyContent: "flex-start",
            gap: 4,
            padding: "7px 10px 12px",
            borderRadius: 12,
            width: 720,
            position: "relative",
            background: "rgba(255, 255, 255, 0.78)",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.04)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
            overflowX: "auto",
          }}
        >
          {FURNITURE_CATALOG.slice(0, 10).map((entry) => {
            const isActive = useStore.getState().activeFurniturePreset === entry.type;
            return (
              <div
                key={entry.type}
                onClick={() => {
                  const store = useStore.getState();
                  if (store.activeFurniturePreset === entry.type) {
                    store.setActiveFurniturePreset(null);
                  } else {
                    store.setActiveFurniturePreset(entry.type);
                  }
                }}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 7,
                  border: isActive ? "2px solid #22c55e" : "1px solid #e2e8f0",
                  background: isActive ? "rgba(34,197,94,0.08)" : "#fafafa",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                  cursor: "pointer",
                  flexShrink: 0,
                  transition: "all 120ms ease",
                }}
              >
                <svg viewBox="0 0 32 32" width={28} height={28} fill={isActive ? "#22c55e" : "#607080"} opacity={0.7}>
                  <FurnitureSilhouette type={entry.type} />
                </svg>
                <span style={{ fontSize: 8, fontWeight: 700, color: isActive ? "#22c55e" : "#64748b", textAlign: "center", lineHeight: 1.1 }}>
                  {entry.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
