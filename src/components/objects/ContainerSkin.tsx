"use client";

/**
 * ContainerSkin.tsx — Clean-Slate Voxel Renderer
 *
 * Grid math (per user spec):
 *   col  0..7  → X = -(c - 3.5) * colPitch  [NEGATED: col 0 = LEFT in UI = +X in 3D]
 *   row  0..3  → Z = (r - 1.5) * rowPitch   [container width  along Z]
 *   Y center   → V_OFFSET = height / 2
 *
 * HALO ARCHITECTURE:
 *   colPitch = length / 6 (not length / 8)
 *   Cols 1-6  = core container frame (6 × 2.031m = 12.19m for 40ft)
 *   Cols 0, 7 = deck/extension halos outside the steel frame
 *   Rows 1-2  = core container body
 *   Rows 0, 3 = deck/extension halos outside the container sides
 *
 * VERIFIED CORNER POSITIONS (40ft HC, colPitch=2.031m, rowPitch=1.22m, NEGATED X):
 *   (col=0, row=0): px=-(0-3.5)*2.031=+7.11m  pz=(0-1.5)*1.22=-1.83m  [UI left→3D +X front]
 *   (col=7, row=0): px=-(7-3.5)*2.031=-7.11m  pz=-1.83m                [UI right→3D -X front]
 *   (col=0, row=3): px=+7.11m  pz=(3-1.5)*1.22=+1.83m                 [UI left→3D +X back]
 *   (col=7, row=3): px=-7.11m  pz=+1.83m                              [UI right→3D -X back]
 *   Adjacency culling does NOT cull the outward-facing sides of corners (bounds check returns false).
 *
 * Face offsets from voxel-group centre (NO rotation on any group):
 *   N  → [0, 0, -halfRow]    E  → [+halfCol, 0, 0]
 *   S  → [0, 0, +halfRow]    W  → [-halfCol, 0, 0]
 *   Top→ [0, +vOff, 0]       Bot→ [0, -vOff, 0]
 *
 * Geometry is dimension-oriented (no Euler rotation tricks):
 *   N/S  : box [colPitch, vHeight, PANEL_THICK]
 *   E/W  : box [PANEL_THICK, vHeight, rowPitch]
 *   Top/B: box [colPitch, PANEL_THICK, rowPitch]
 *
 * Adjacency culling: a face is skipped when the neighbouring voxel
 * in that direction is also active — prevents interior cross-walls.
 */

import { type ReactNode, useState, useMemo, useCallback, useRef, useEffect } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import { useStore } from "@/store/useStore";
import {
  type Container,
  type SurfaceType,
  type VoxelFaces,
  CONTAINER_DIMENSIONS,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  WallSide,
  ViewMode,
} from "@/types/container";
import { createDefaultVoxelGrid } from "@/types/factories";
import { RAYCAST_LAYERS } from "@/utils/raycastLayers";
import { type ThemeId, THEMES } from "@/config/themes";
import { _themeMats, type ThemeMaterialSet } from "@/config/materialCache";
import { getCycleForFace } from "@/config/surfaceCycles";

// ── Constants ──────────────────────────────────────────────────

// Surface cycle for scroll-wheel face editing (shared with MatrixEditor)
export const SURFACE_CYCLE: SurfaceType[] = [
  'Open', 'Solid_Steel', 'Glass_Pane', 'Railing_Glass', 'Railing_Cable', 'Deck_Wood',
  'Concrete', 'Half_Fold', 'Gull_Wing',
];

// ── Face-type-aware surface cycles (canonical source: config/surfaceCycles.ts) ──
export { WALL_CYCLE, FLOOR_CYCLE, CEIL_CYCLE, getCycleForFace } from "@/config/surfaceCycles";

const PANEL_THICK = 0.06;   // steel / glass panel thickness
const PILLAR_R    = 0.035;  // auto-pillar radius for halo awning support
const FRAME_W     = 0.05;   // glass frame bar width
const POST_R      = 0.025;  // railing post radius
const RAIL_R      = 0.015;  // railing cable radius
const RAILING_H   = 1.0;    // railing height (matches ContainerMesh)
const DECK_THICK  = 0.05;   // deck plank slab thickness

// ── Material cache imported from config/materialCache.ts ──────────

// Convenience aliases — updated per render by useThemeMats() hook
let mSteel      = _themeMats.industrial.steel;
let mSteelInner = _themeMats.industrial.steelInner;
let mGlass      = _themeMats.industrial.glass;
let mFrame      = _themeMats.industrial.frame;
let mWood       = _themeMats.industrial.wood;
let mWoodGroove = _themeMats.industrial.woodGroove;
let mRail       = _themeMats.industrial.rail;
let mRailGlass  = _themeMats.industrial.railGlass;
let mConcrete   = _themeMats.industrial.concrete;

/** Call at the top of ContainerSkin to sync module-scope material aliases with the active theme. */
function syncThemeMats(theme: ThemeId) {
  const set = _themeMats[theme];
  mSteel      = set.steel;
  mSteelInner = set.steelInner;
  mGlass      = set.glass;
  mFrame      = set.frame;
  mWood       = set.wood;
  mWoodGroove = set.woodGroove;
  mRail       = set.rail;
  mRailGlass  = set.railGlass;
  mConcrete   = set.concrete;
}
// ── Japanese Modern Palette materials ─────────────────────────
const mHinoki = new THREE.MeshStandardMaterial({
  color: 0xf5e6c8, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide,
});
const mTatami = new THREE.MeshStandardMaterial({
  color: 0xc8d5a0, roughness: 0.9, metalness: 0.0, side: THREE.DoubleSide,
});
const mWashi = new THREE.MeshPhysicalMaterial({
  color: 0xf8f4ec, roughness: 0.95, metalness: 0.0,
  transmission: 0.3, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
});
const mShoji = new THREE.MeshPhysicalMaterial({
  color: 0xfafafa, roughness: 1.0, metalness: 0.0,
  transmission: 0.6, transparent: true, opacity: 0.70, side: THREE.DoubleSide,
});

const mHover = new THREE.MeshStandardMaterial({
  color: 0x00e5ff, emissive: new THREE.Color(0x00e5ff), emissiveIntensity: 0.25,
  transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false,
});
const mGhost = new THREE.MeshStandardMaterial({
  color: 0x00e5ff, emissive: new THREE.Color(0x00e5ff), emissiveIntensity: 0.22,
  transparent: true, opacity: 0.20, side: THREE.DoubleSide, depthWrite: false,
});
// ── Emissive ceiling panel light — warm interior glow visible through glass ──
const mCeilingLight = new THREE.MeshStandardMaterial({
  color: 0xfff8f0,
  emissive: new THREE.Color(0xffe8c0),
  emissiveIntensity: 0.8,
  metalness: 0.05,
  roughness: 0.5,
  side: THREE.DoubleSide,
});

// Transparent hit-box — opacity 0.001 guarantees raycaster intersection
// while remaining invisible. Pure opacity:0 can skip raycasts in some R3F versions.
const mHit = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0.001, side: THREE.DoubleSide, depthWrite: false,
  colorWrite: false,
});
const mSelect = new THREE.LineBasicMaterial({ color: "#00bcd4", depthTest: false });
// Yellow emissive hover — always visible "E-cycle" indicator
const mHoverWire = new THREE.LineBasicMaterial({ color: "#ffcc00", depthTest: false, linewidth: 2 });
// Voxel-level edge outlines — hover=yellow, selected=blue. No solid fill.
const mVoxelHoverLine  = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.55, depthTest: false });
const mVoxelSelectLine = new THREE.LineBasicMaterial({ color: 0x00bcd4, transparent: true, opacity: 0.75, depthTest: false });
const mHoverGlow = new THREE.MeshStandardMaterial({
  color: 0xffcc00, emissive: new THREE.Color(0xffcc00), emissiveIntensity: 0.3,
  transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false,
});
// Edge-specific glow for Smart Edge hover
const mEdgeGlow = new THREE.MeshStandardMaterial({
  color: 0xffcc00, emissive: new THREE.Color(0xffcc00), emissiveIntensity: 0.3,
  transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false,
});
// ★ Phase 2 WYSIWYC: Cyan highlight for structural edge beams on hover
const mEdgeBeamHover = new THREE.MeshStandardMaterial({
  color: 0x06b6d4, emissive: new THREE.Color(0x06b6d4), emissiveIntensity: 0.6,
  metalness: 0.7, roughness: 0.25,
});
// Structural edge beam dimensions
const EDGE_BEAM_W = 0.04;  // beam cross-section width
const EDGE_BEAM_D = 0.04;  // beam cross-section depth

// ── Phase 2 WYSIWYC: Dashed bounding box for empty tile selection ──
const mDashedHover = new THREE.LineDashedMaterial({
  color: 0x06b6d4, dashSize: 0.15, gapSize: 0.10,
  transparent: true, opacity: 0.7,
});
const mDashedSelect = new THREE.LineDashedMaterial({
  color: 0x00e5ff, dashSize: 0.12, gapSize: 0.06,
  transparent: true, opacity: 0.9,
});

// ── Baseplate materials (Phase 2 — Lego ground grid) ───────────
const mBaseplate = new THREE.MeshBasicMaterial({
  color: 0x455a64, transparent: true, opacity: 0.10,
  side: THREE.DoubleSide, depthWrite: false,
});
const mBaseplateHover = new THREE.MeshBasicMaterial({
  color: 0x00e5ff, transparent: true, opacity: 0.14,
  side: THREE.DoubleSide, depthWrite: false,
});
const mBaseplateSelect = new THREE.MeshBasicMaterial({
  color: 0x90caf9, transparent: true, opacity: 0.30,
  side: THREE.DoubleSide, depthWrite: false,
});
const mBaseplateWire = new THREE.LineBasicMaterial({
  color: 0x546e7a, transparent: true, opacity: 0.30,
});

// ── nullRaycast — disables raycasting on a single mesh ────────
const nullRaycast = () => {};

// ── Geometry caches ────────────────────────────────────────────

const _box = new Map<string, THREE.BufferGeometry>();
function getBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_box.has(k)) _box.set(k, new THREE.BoxGeometry(w, h, d));
  return _box.get(k)!;
}

const _cyl = new Map<string, THREE.BufferGeometry>();
function getCyl(r: number, h: number): THREE.BufferGeometry {
  const k = `${r.toFixed(3)}_${h.toFixed(3)}`;
  if (!_cyl.has(k)) _cyl.set(k, new THREE.CylinderGeometry(r, r, h, 8));
  return _cyl.get(k)!;
}

const _edges = new Map<string, THREE.BufferGeometry>();
function getEdges(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_edges.has(k)) {
    const b = new THREE.BoxGeometry(w, h, d);
    const eg = new THREE.EdgesGeometry(b);
    // computeLineDistances required for LineDashedMaterial to render dashes
    const pos = eg.attributes.position;
    const dist: number[] = [];
    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 2) {
      v0.fromBufferAttribute(pos, i);
      v1.fromBufferAttribute(pos, i + 1);
      const d2 = v0.distanceTo(v1);
      dist.push(0, d2);
    }
    eg.setAttribute('lineDistance', new THREE.Float32BufferAttribute(dist, 1));
    _edges.set(k, eg);
    b.dispose();
  }
  return _edges.get(k)!;
}

// ── 3D Face Assets ─────────────────────────────────────────────
// Each component renders in the face-group's LOCAL space, which is
// world-aligned (container local coords).  No Euler tricks needed.

/** Corrugated steel panel — solid steel on BOTH sides (no plywood interior).
 *  Sealed structural appearance matching real shipping container end-walls. */
function SteelFace({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <mesh
      geometry={getBox(w, h, d)}
      material={mSteel}
      castShadow
      receiveShadow
      raycast={nullRaycast}
    />
  );
}

/**
 * Glass panel with aluminium frame bars.
 * isNS=true  → face normal along Z (N/S walls): opening = X×Y, glass thin in Z
 * isNS=false → face normal along X (E/W walls): opening = Y×Z, glass thin in X
 */
function GlassFace({
  w, h, d, isNS,
}: { w: number; h: number; d: number; isNS: boolean }) {
  if (isNS) {
    // N/S face: spans X=w, Y=h, thin in Z=d
    return (
      <>
        <mesh geometry={getBox(w - FRAME_W * 2, h - FRAME_W * 2, 0.012)} material={mGlass} raycast={nullRaycast} />
        <mesh position={[0,  h / 2 - FRAME_W / 2, 0]} geometry={getBox(w, FRAME_W, PANEL_THICK)} material={mFrame} castShadow raycast={nullRaycast} />
        <mesh position={[0, -h / 2 + FRAME_W / 2, 0]} geometry={getBox(w, FRAME_W, PANEL_THICK)} material={mFrame} castShadow raycast={nullRaycast} />
        <mesh position={[-w / 2 + FRAME_W / 2, 0, 0]} geometry={getBox(FRAME_W, h, PANEL_THICK)} material={mFrame} castShadow raycast={nullRaycast} />
        <mesh position={[ w / 2 - FRAME_W / 2, 0, 0]} geometry={getBox(FRAME_W, h, PANEL_THICK)} material={mFrame} castShadow raycast={nullRaycast} />
      </>
    );
  }
  // E/W face: spans Z=d, Y=h, thin in X=w
  return (
    <>
      <mesh geometry={getBox(0.012, h - FRAME_W * 2, d - FRAME_W * 2)} material={mGlass} raycast={nullRaycast} />
      <mesh position={[0,  h / 2 - FRAME_W / 2, 0]} geometry={getBox(PANEL_THICK, FRAME_W, d)} material={mFrame} castShadow raycast={nullRaycast} />
      <mesh position={[0, -h / 2 + FRAME_W / 2, 0]} geometry={getBox(PANEL_THICK, FRAME_W, d)} material={mFrame} castShadow raycast={nullRaycast} />
      <mesh position={[0, 0, -d / 2 + FRAME_W / 2]} geometry={getBox(PANEL_THICK, h, FRAME_W)} material={mFrame} castShadow raycast={nullRaycast} />
      <mesh position={[0, 0,  d / 2 - FRAME_W / 2]} geometry={getBox(PANEL_THICK, h, FRAME_W)} material={mFrame} castShadow raycast={nullRaycast} />
    </>
  );
}

/** Post-and-cable railing. spanW = face opening width, spanH = face height.
 *  isNS=true → posts spaced along X, rails run along X (rotation [0,0,π/2])
 *  isNS=false→ posts spaced along Z, rails run along Z (rotation [π/2,0,0])
 *  connectedStart/End: when true, suppress end posts for seamless railing runs. */
function RailingCable({ spanW, spanH, isNS, connectedStart = false, connectedEnd = false }: {
  spanW: number; spanH: number; isNS: boolean;
  connectedStart?: boolean; connectedEnd?: boolean;
}) {
  const rH    = Math.min(spanH, RAILING_H);
  const baseY = -spanH / 2;
  const nPost = Math.max(2, Math.round(spanW / 1.0));
  const railRot: [number, number, number] = isNS ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];

  return (
    <>
      {Array.from({ length: nPost }, (_, i) => {
        // ★ Phase 4 autotiling: skip end posts when connected to adjacent railing
        if (i === 0 && connectedStart) return null;
        if (i === nPost - 1 && connectedEnd) return null;
        const off = nPost === 1 ? 0 : -spanW / 2 + (i / (nPost - 1)) * spanW;
        const pos: [number, number, number] = isNS
          ? [off, baseY + rH / 2, 0]
          : [0, baseY + rH / 2, off];
        return <mesh key={i} position={pos} geometry={getCyl(POST_R, rH)} material={mRail} castShadow raycast={nullRaycast} />;
      })}
      {([rH, rH * 0.5, rH * 0.15] as const).map((ry, i) => (
        <mesh key={i} position={[0, baseY + ry, 0]}
          rotation={railRot} geometry={getCyl(RAIL_R, spanW)} material={mRail} castShadow raycast={nullRaycast} />
      ))}
    </>
  );
}

/** Glass balustrade railing (glass panel + handrail + end posts).
 *  connectedStart/End: suppress end posts for seamless railing runs. */
function RailingGlass({ spanW, spanH, isNS, connectedStart = false, connectedEnd = false }: {
  spanW: number; spanH: number; isNS: boolean;
  connectedStart?: boolean; connectedEnd?: boolean;
}) {
  const rH    = Math.min(spanH, RAILING_H);
  const baseY = -spanH / 2;
  const railRot: [number, number, number] = isNS ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];
  const glassGeo = isNS
    ? getBox(spanW - 0.06, rH - 0.06, 0.012)
    : getBox(0.012, rH - 0.06, spanW - 0.06);

  return (
    <>
      <mesh position={[0, baseY + rH * 0.5, 0]} geometry={glassGeo} material={mRailGlass} raycast={nullRaycast} />
      {/* bottom sill */}
      <mesh position={[0, baseY + 0.03, 0]}
        geometry={isNS ? getBox(spanW, 0.06, PANEL_THICK) : getBox(PANEL_THICK, 0.06, spanW)}
        material={mFrame} castShadow raycast={nullRaycast} />
      {/* top handrail */}
      <mesh position={[0, baseY + rH, 0]}
        rotation={railRot} geometry={getCyl(RAIL_R * 1.5, spanW)} material={mRail} castShadow raycast={nullRaycast} />
      {/* ★ Phase 4 autotiling: end posts only where not connected to adjacent railing */}
      {!connectedStart && (() => {
        const pos: [number, number, number] = isNS
          ? [-spanW / 2 + 0.03, baseY + rH / 2, 0]
          : [0, baseY + rH / 2, -spanW / 2 + 0.03];
        return <mesh position={pos} geometry={getCyl(POST_R, rH)} material={mRail} castShadow raycast={nullRaycast} />;
      })()}
      {!connectedEnd && (() => {
        const pos: [number, number, number] = isNS
          ? [spanW / 2 - 0.03, baseY + rH / 2, 0]
          : [0, baseY + rH / 2, spanW / 2 - 0.03];
        return <mesh position={pos} geometry={getCyl(POST_R, rH)} material={mRail} castShadow raycast={nullRaycast} />;
      })()}
    </>
  );
}

/** Horizontal deck surface (always in XZ plane, Y is thin). */
function DeckWood({ w, d }: { w: number; d: number }) {
  const nGrooves = Math.max(1, Math.floor(d / 0.14));
  return (
    <>
      <mesh geometry={getBox(w, DECK_THICK, d)} material={mWood} receiveShadow castShadow raycast={nullRaycast} />
      {Array.from({ length: nGrooves + 1 }, (_, i) => {
        const z = -d / 2 + i * (d / (nGrooves + 1));
        return <mesh key={i} position={[0, DECK_THICK / 2 + 0.003, z]}
          geometry={getBox(w, 0.004, 0.007)} material={mWoodGroove} raycast={nullRaycast} />;
      })}
    </>
  );
}

/** Concrete face — cast-in-place slab (subterranean / basement walls). */
function ConcreteFace({ w, h, d }: { w: number; h: number; d: number }) {
  return (
    <mesh geometry={getBox(w, h, d)} material={mConcrete} castShadow receiveShadow raycast={nullRaycast} />
  );
}

/** Half-Fold face — half-height fold extension (1.45m). Renders as a steel
 *  panel covering the top half, with the bottom half open (fold-down hint). */
function HalfFoldFace({ w, h, d, isNS }: { w: number; h: number; d: number; isNS: boolean }) {
  const halfH = h / 2;
  // Top half: steel panel
  // Bottom half: wood deck plank (hinting at fold-down extension)
  return (
    <>
      {/* Upper half — steel panel */}
      <group position={[0, halfH / 2, 0]}>
        <SteelFace w={w} h={halfH} d={d} />
      </group>
      {/* Lower half — wood deck, planks horizontal (grain runs across face width) */}
      <group position={[0, -halfH / 2, 0]}>
        {isNS
          ? <mesh geometry={getBox(w, DECK_THICK, halfH)} material={mWood} castShadow receiveShadow raycast={nullRaycast} />
          : <mesh geometry={getBox(DECK_THICK, halfH, w)} material={mWood} castShadow receiveShadow raycast={nullRaycast} />}
      </group>
      {/* Hinge line at center */}
      <mesh position={[0, 0, 0]}
        geometry={isNS ? getBox(w, 0.03, PANEL_THICK + 0.01) : getBox(PANEL_THICK + 0.01, 0.03, d)}
        material={mFrame} castShadow raycast={nullRaycast} />
    </>
  );
}

/** Gull-Wing face — split horizontally: top 50% folds up (awning), bottom 50% folds down (deck).
 *  Rendered as upper awning panel + lower deck panel with visible hinge at center. */
function GullWingFace({ w, h, d, isNS }: { w: number; h: number; d: number; isNS: boolean }) {
  const halfH = h / 2;
  return (
    <>
      {/* Upper half — awning (steel exterior facing up) */}
      <group position={[0, halfH / 2, 0]}>
        <SteelFace w={w} h={halfH} d={d} />
      </group>
      {/* Lower half — deck (wood exterior facing down when folded) */}
      <group position={[0, -halfH / 2, 0]}>
        <SteelFace w={w} h={halfH} d={d} />
      </group>
      {/* Center hinge bar */}
      <mesh position={[0, 0, 0]}
        geometry={isNS ? getBox(w, 0.04, PANEL_THICK + 0.02) : getBox(PANEL_THICK + 0.02, 0.04, d)}
        material={mFrame} castShadow raycast={nullRaycast} />
      {/* Awning support hint (small triangular bracket marks at ends) */}
      {[w / 2 - 0.08, -(w / 2 - 0.08)].map((x, i) => (
        <mesh key={i}
          position={isNS ? [x, halfH / 2, 0] : [0, halfH / 2, x]}
          geometry={getCyl(0.02, halfH * 0.3)}
          material={mFrame} castShadow raycast={nullRaycast} />
      ))}
    </>
  );
}

/** Hinged steel door panel — supports swing (pivot) and slide modes via doorState/doorConfig. */
function DoorFace({ w, h, d, isNS, isOpen, doorState, doorConfig }: {
  w: number; h: number; d: number; isNS: boolean;
  isOpen?: boolean; doorState?: string;
  doorConfig?: import('@/types/container').DoorConfig;
}) {
  const doorW = w * 0.7;
  const halfSpan = doorW / 2;

  // Resolve config: doorConfig takes precedence, fallback to legacy doorState
  const cfg = doorConfig ?? {
    state: (doorState ?? 'closed') as import('@/types/container').DoorState,
    hingeEdge: 'right' as const,
    swingDirection: 'in' as const,
    slideDirection: 'positive' as const,
    type: (doorState === 'open_slide' ? 'slide' : 'swing') as 'slide' | 'swing',
  };
  const isSlide = cfg.type === 'slide' || cfg.state === 'open_slide';
  const shouldOpen = cfg.state === 'open_swing' || cfg.state === 'open_slide' || !!isOpen;

  // Pivot: hingeEdge determines which edge the door pivots from
  const hingeLeft = cfg.hingeEdge === 'left';
  const pivotSign = hingeLeft ? 1 : -1;
  const pivotOffset = isNS ? halfSpan * pivotSign : 0;
  const pivotOffsetZ = isNS ? 0 : halfSpan * pivotSign;

  // Swing angle: direction determines which way door opens
  const swingSign = hingeLeft ? 1 : -1;
  const dirSign = cfg.swingDirection === 'in' ? 1 : -1;
  const targetRotY = (shouldOpen && !isSlide) ? swingSign * dirSign * (Math.PI / 2) : 0;

  const slideSign = cfg.slideDirection === 'positive' ? 1 : -1;
  const slideTarget = (shouldOpen && isSlide) ? slideSign * w : 0;

  const rotRef = useRef(targetRotY);
  const slideRef = useRef(slideTarget);
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const lerp = 1 - Math.pow(0.001, delta);
    rotRef.current += (targetRotY - rotRef.current) * lerp;
    slideRef.current += (slideTarget - slideRef.current) * lerp;
    groupRef.current.rotation.y = rotRef.current;
    if (isNS) {
      groupRef.current.position.x = slideRef.current;
    } else {
      groupRef.current.position.z = slideRef.current;
    }
  });

  return (
    <>
      {/* Frame — steel surround (fixed) */}
      <mesh geometry={isNS ? getBox(w, h, d) : getBox(d, h, w)} material={mFrame} castShadow raycast={nullRaycast} />
      {/* Animated door panel — pivots from hinge edge (swing) or translates (slide) */}
      <group position={isSlide ? [0, 0, 0] : [-pivotOffset, 0, -pivotOffsetZ]}>
        <group ref={groupRef}>
          <mesh
            geometry={isNS ? getBox(doorW, h * 0.95, d * 0.6) : getBox(d * 0.6, h * 0.95, doorW)}
            position={isSlide ? [0, 0, 0] : [pivotOffset, 0, pivotOffsetZ]}
            material={mSteel}
            castShadow raycast={nullRaycast}
          />
          {/* Handle dot */}
          <mesh
            geometry={getCyl(0.015, 0.05)}
            position={isNS
              ? [(isSlide ? 0 : pivotOffset) + doorW * 0.35 * -pivotSign, -h * 0.1, 0]
              : [0, -h * 0.1, (isSlide ? 0 : pivotOffsetZ) + doorW * 0.35 * -pivotSign]}
            material={mFrame}
            castShadow raycast={nullRaycast}
          />
        </group>
      </group>
    </>
  );
}

/** Glass Shoji sliding panel — translates sideways when isOpen=true. */
function ShojiSlide({ w, h, d, isNS, isOpen }: { w: number; h: number; d: number; isNS: boolean; isOpen?: boolean }) {
  const slideTarget = isOpen ? (isNS ? w : w) : 0;
  const slideRef = useRef(isOpen ? slideTarget : 0);
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    slideRef.current += (slideTarget - slideRef.current) * (1 - Math.pow(0.001, delta));
    if (isNS) {
      groupRef.current.position.x = slideRef.current;
    } else {
      groupRef.current.position.z = slideRef.current;
    }
  });
  const bW = isNS ? w : d;
  const bD = isNS ? d : w;
  return (
    <group ref={groupRef}>
      {/* Thin top/bottom frame rails */}
      <mesh geometry={getBox(bW, 0.04, bD)} position={[0, h / 2 - 0.02, 0]} material={mFrame} raycast={nullRaycast} />
      <mesh geometry={getBox(bW, 0.04, bD)} position={[0, -h / 2 + 0.02, 0]} material={mFrame} raycast={nullRaycast} />
      {/* Frosted panel */}
      <mesh geometry={getBox(bW, h - 0.08, bD)} material={mShoji} castShadow raycast={nullRaycast} />
    </group>
  );
}

// ── StairMesh — volumetric ascending treads filling one voxel cell ───
// 6 evenly-spaced treads rise linearly from floor to ceiling across the voxel depth.
// ascending='n'|'s' → treads run N-S; ascending='e'|'w' → treads run E-W.
// Faces prop: Open sides get side railings with posts.

export function StairMesh({ voxW, voxD, voxH, ascending, faces, stairPart }: {
  voxW: number; voxD: number; voxH: number;
  ascending: 'n' | 's' | 'e' | 'w';
  faces: VoxelFaces;
  stairPart?: 'lower' | 'upper' | 'single';
}) {
  const isLower = stairPart === 'lower';
  const isUpper = stairPart === 'upper';
  // 2-voxel mode: 3 treads per half. Single/legacy: 6 treads full height.
  const STEPS = (isLower || isUpper) ? 3 : 6;
  const effectiveH = (isLower || isUpper) ? voxH / 2 : voxH;
  const stepH = effectiveH / STEPS;
  const isNS = ascending === 'n' || ascending === 's';
  const treadW = isNS ? voxW - 0.04 : voxD - 0.04;
  const treadD = (isNS ? voxD : voxW) / STEPS;
  const RAIL_H = 0.9;    // handrail height above tread surface
  const POST_W = 0.04;   // post cross-section
  // Y base: lower/single start at floor, upper starts at mid-voxel
  const yBase = isUpper ? 0 : -voxH / 2;
  // Slope angle for handrail — based on effective half-height (2-voxel) or full height (single)
  const slopeAngle = Math.atan2(effectiveH, isNS ? voxD : voxW);
  // Rail bar center height — midpoint between top of first and last post
  const railCenterY = (stepH + 2 * RAIL_H) / 2;
  // Slant length = hypotenuse of stair run, scaled to (STEPS-1)/STEPS to match tread span
  const run = isNS ? voxD : voxW;
  const slantLen = ((STEPS - 1) / STEPS) * Math.sqrt(effectiveH * effectiveH + run * run);

  // Open sides → add railings (N-S stairs: E/W sides; E-W stairs: N/S sides)
  const eastOpen  = isNS  && faces.e === 'Open';
  const westOpen  = isNS  && faces.w === 'Open';
  const northOpen = !isNS && faces.n === 'Open';
  const southOpen = !isNS && faces.s === 'Open';

  // Tread position along the ascending axis — tread 0 at bottom, tread N-1 at top
  const treadPos = (i: number): [number, number, number] => {
    const y = yBase + stepH * (i + 0.5);
    if (ascending === 'n') return [0, y, -voxD / 2 + treadD * (i + 0.5)];  // south→north
    if (ascending === 's') return [0, y,  voxD / 2 - treadD * (i + 0.5)];  // north→south
    if (ascending === 'e') return [-voxW / 2 + treadD * (i + 0.5), y, 0];  // west→east
    /* 'w' */               return [ voxW / 2 - treadD * (i + 0.5), y, 0]; // east→west
  };

  const riserPos = (i: number): [number, number, number] => {
    const riserH = stepH * (i + 1);
    const y = yBase + riserH / 2;
    if (ascending === 'n') return [0, y, -voxD / 2 + treadD * (i + 1)];
    if (ascending === 's') return [0, y,  voxD / 2 - treadD * (i + 1)];
    if (ascending === 'e') return [-voxW / 2 + treadD * (i + 1), y, 0];
    /* 'w' */               return [ voxW / 2 - treadD * (i + 1), y, 0];
  };

  const railPostPos = (i: number): [number, number, number] => {
    const y = yBase + stepH * (i + 1) + RAIL_H / 2;
    if (ascending === 'n') return [0, y, -voxD / 2 + treadD * (i + 1)];
    if (ascending === 's') return [0, y,  voxD / 2 - treadD * (i + 1)];
    if (ascending === 'e') return [-voxW / 2 + treadD * (i + 1), y, 0];
    /* 'w' */               return [ voxW / 2 - treadD * (i + 1), y, 0];
  };

  return (
    <group>
      {/* ── Treads ── */}
      {Array.from({ length: STEPS }, (_, i) => (
        <mesh
          key={`tread_${i}`}
          geometry={isNS ? getBox(treadW, stepH, treadD) : getBox(treadD, stepH, treadW)}
          material={mWood}
          position={treadPos(i)}
          castShadow
          receiveShadow
          raycast={nullRaycast}
        />
      ))}

      {/* ── Support risers — vertical column under front edge of each tread ── */}
      {Array.from({ length: STEPS }, (_, i) => {
        const riserH = stepH * (i + 1);
        return (
          <mesh
            key={`riser_${i}`}
            geometry={getBox(0.06, riserH, 0.06)}
            material={mFrame}
            position={riserPos(i)}
            castShadow
            raycast={nullRaycast}
          />
        );
      })}

      {/* ── Side railings — only on Open sides (N-S stair: E/W sides; E-W stair: N/S sides) ── */}
      {isNS && [eastOpen && (voxW / 2 - 0.04), westOpen && -(voxW / 2 - 0.04)].map((xOff, ri) => {
        if (xOff === false) return null;
        return (
          <group key={`rail_ns_${ri}`} position={[xOff as number, 0, 0]}>
            {/* Sloped handrail bar — rotated to match stair rise/run angle */}
            <mesh
              geometry={getBox(0.04, 0.04, slantLen)}
              material={mRail}
              position={[0, railCenterY, (ascending === 'n' ? 1 : -1) * treadD / 2]}
              rotation={[ascending === 'n' ? -slopeAngle : slopeAngle, 0, 0]}
              castShadow raycast={nullRaycast}
            />
            {/* Posts at each tread leading edge */}
            {Array.from({ length: STEPS }, (_, i) => (
              <mesh
                key={`post_${i}`}
                geometry={getBox(POST_W, RAIL_H, POST_W)}
                material={mFrame}
                position={railPostPos(i)}
                castShadow raycast={nullRaycast}
              />
            ))}
          </group>
        );
      })}

      {!isNS && [northOpen && -(voxD / 2 - 0.04), southOpen && (voxD / 2 - 0.04)].map((zOff, ri) => {
        if (zOff === false) return null;
        return (
          <group key={`rail_ew_${ri}`} position={[0, 0, zOff as number]}>
            {/* Sloped handrail bar — rotated to match stair rise/run angle */}
            <mesh
              geometry={getBox(slantLen, 0.04, 0.04)}
              material={mRail}
              position={[(ascending === 'e' ? 1 : -1) * treadD / 2, railCenterY, 0]}
              rotation={[0, 0, ascending === 'e' ? slopeAngle : -slopeAngle]}
              castShadow raycast={nullRaycast}
            />
            {/* Posts at each tread leading edge */}
            {Array.from({ length: STEPS }, (_, i) => (
              <mesh
                key={`post_${i}`}
                geometry={getBox(POST_W, RAIL_H, POST_W)}
                material={mFrame}
                position={railPostPos(i)}
                castShadow raycast={nullRaycast}
              />
            ))}
          </group>
        );
      })}
    </group>
  );
}

// ── Exported FaceVisual — pure visual render for a single face ───
// Used by VoxelPreview3D to guarantee 1:1 visual fidelity with the main canvas.
// No animation, no hitboxes, no hover glow — just the geometry and materials.

// ── Window profile ratios ──────────────────────────────────────

const WINDOW_PROFILES: Record<string, { sillRatio: number; headRatio: number }> = {
  Window_Standard:   { sillRatio: 0.35, headRatio: 0.81 },
  Window_Sill:       { sillRatio: 0.35, headRatio: 1.0  },
  Window_Clerestory: { sillRatio: 0.77, headRatio: 1.0  },
  Window_Half:       { sillRatio: 0.5,  headRatio: 1.0  },
};

/** Composite window face: stacked steel + glass + steel panels. */
function WindowFace({ w, h, d, isNS, sillRatio, headRatio }: {
  w: number; h: number; d: number; isNS: boolean;
  sillRatio: number; headRatio: number;
}) {
  const bottomH = sillRatio * h;
  const midH    = (headRatio - sillRatio) * h;
  const topH    = (1 - headRatio) * h;

  return (
    <group>
      {/* Bottom steel panel (sill) */}
      {bottomH > 0.01 && (
        <mesh position={[0, -h / 2 + bottomH / 2, 0]} castShadow receiveShadow raycast={nullRaycast}>
          <boxGeometry args={[isNS ? w : PANEL_THICK, bottomH, isNS ? PANEL_THICK : w]} />
          <primitive object={mSteel} attach="material" />
        </mesh>
      )}
      {/* Glass panel */}
      <mesh position={[0, -h / 2 + sillRatio * h + midH / 2, 0]} castShadow receiveShadow raycast={nullRaycast}>
        <boxGeometry args={[isNS ? w * 0.92 : PANEL_THICK * 0.5, midH * 0.95, isNS ? PANEL_THICK * 0.5 : w * 0.92]} />
        <primitive object={mGlass} attach="material" />
      </mesh>
      {/* Top steel panel (transom) */}
      {topH > 0.01 && (
        <mesh position={[0, h / 2 - topH / 2, 0]} castShadow receiveShadow raycast={nullRaycast}>
          <boxGeometry args={[isNS ? w : PANEL_THICK, topH, isNS ? PANEL_THICK : w]} />
          <primitive object={mSteel} attach="material" />
        </mesh>
      )}
    </group>
  );
}

export function FaceVisual({ surface, colPitch, rowPitch, vHeight, isNS, isEW, isHoriz, connectedStart, connectedEnd, isOpen, doorState, doorConfig }: {
  surface: SurfaceType;
  colPitch: number;
  rowPitch: number;
  vHeight: number;
  isNS: boolean;
  isEW: boolean;
  isHoriz: boolean;
  connectedStart?: boolean;
  connectedEnd?: boolean;
  isOpen?: boolean;
  doorState?: string;
  doorConfig?: import('@/types/container').DoorConfig;
}) {
  const bW = isNS ? colPitch : isEW ? PANEL_THICK : colPitch;
  const bH = isNS ? vHeight  : isEW ? vHeight     : PANEL_THICK;
  const bD = isNS ? PANEL_THICK : isEW ? rowPitch  : rowPitch;
  const spanW = isNS ? colPitch : rowPitch;

  if (surface === "Open" || surface === "Stairs") return null;
  if (isHoriz) {
    if (surface === "Deck_Wood")    return <DeckWood w={colPitch} d={rowPitch} />;
    if (surface === "Concrete")     return <ConcreteFace w={bW} h={bH} d={bD} />;
    if (surface === "Floor_Tatami") return <mesh geometry={getBox(colPitch, 0.04, rowPitch)} material={mTatami} castShadow receiveShadow raycast={nullRaycast} />;
    if (surface === "Wood_Hinoki")  return <mesh geometry={getBox(colPitch, 0.04, rowPitch)} material={mHinoki} castShadow receiveShadow raycast={nullRaycast} />;
    const ROOF_THICK = 0.08;
    return <mesh geometry={getBox(colPitch, ROOF_THICK, rowPitch)} material={mSteel} castShadow receiveShadow raycast={nullRaycast} />;
  }
  switch (surface) {
    case "Solid_Steel":   return <SteelFace w={bW} h={bH} d={bD} />;
    case "Glass_Pane":    return <GlassFace w={bW} h={bH} d={bD} isNS={isNS} />;
    case "Wall_Washi":    return <mesh geometry={getBox(bW, bH, bD)} material={mWashi} castShadow raycast={nullRaycast} />;
    case "Glass_Shoji":   return <ShojiSlide w={bW} h={bH} d={bD} isNS={isNS} isOpen={isOpen} />;
    case "Wood_Hinoki":   return <mesh geometry={getBox(bW, bH, bD)} material={mHinoki} castShadow raycast={nullRaycast} />;
    case "Railing_Cable": return <RailingCable spanW={spanW} spanH={vHeight} isNS={isNS}
      connectedStart={connectedStart} connectedEnd={connectedEnd} />;
    case "Railing_Glass": return <RailingGlass spanW={spanW} spanH={vHeight} isNS={isNS}
      connectedStart={connectedStart} connectedEnd={connectedEnd} />;
    case "Deck_Wood":     return <SteelFace w={bW} h={bH} d={bD} />;
    case "Concrete":      return <ConcreteFace w={bW} h={bH} d={bD} />;
    case "Half_Fold":     return <HalfFoldFace w={bW} h={bH} d={bD} isNS={isNS} />;
    case "Gull_Wing":     return <GullWingFace w={bW} h={bH} d={bD} isNS={isNS} />;
    case "Door":          return <DoorFace w={bW} h={bH} d={bD} isNS={isNS} isOpen={isOpen} doorState={doorState} doorConfig={doorConfig} />;
    case "Window_Standard":
    case "Window_Sill":
    case "Window_Clerestory":
    case "Window_Half": {
      const profile = WINDOW_PROFILES[surface];
      return <WindowFace w={bW} h={bH} d={bD} isNS={isNS} sillRatio={profile.sillRatio} headRatio={profile.headRatio} />;
    }
    default:              return null;
  }
}

// ── Adjacency culling ──────────────────────────────────────────

function adjIsActive(
  grid: (ReturnType<typeof createDefaultVoxelGrid>[number] | undefined)[],
  col: number, row: number,
  dir: keyof VoxelFaces
): boolean {
  if (dir === "top" || dir === "bottom") return false; // handle levels separately
  // ★ CRITICAL: E/W are INVERTED relative to col index because of the negated X mapping.
  // E face is at +halfCol (+X) which points toward LOWER col indices (col-1).
  // W face is at -halfCol (-X) which points toward HIGHER col indices (col+1).
  const dc = dir === "e" ? -1 : dir === "w" ? 1 : 0;
  const dr = dir === "s" ? 1 : dir === "n" ? -1 : 0;
  const nc = col + dc, nr = row + dr;
  if (nc < 0 || nc >= VOXEL_COLS || nr < 0 || nr >= VOXEL_ROWS) return false;
  return grid[nr * VOXEL_COLS + nc]?.active ?? false;
}

// ── Intelligent face melting (Req 5) ──────────────────────────

const OPPOSITE: Record<keyof VoxelFaces, keyof VoxelFaces> = {
  n: 's', s: 'n', e: 'w', w: 'e', top: 'bottom', bottom: 'top',
};

/**
 * Returns true when the face at (col,row,dir) should be CULLED because the neighbor
 * has a semantically compatible surface on the shared wall → they "melt" into one space.
 * Replaces the old adjIsActive + railing bypass dual logic.
 */
function adjIsMelting(
  grid: (ReturnType<typeof createDefaultVoxelGrid>[number] | undefined)[],
  col: number, row: number,
  dir: keyof VoxelFaces,
  surface: SurfaceType
): boolean {
  if (dir === 'top' || dir === 'bottom') return false; // vertical handled separately

  // ★ CRITICAL: E/W are INVERTED relative to col index (negated X mapping)
  const dc = dir === 'e' ? -1 : dir === 'w' ? 1 : 0;
  const dr = dir === 's' ? 1  : dir === 'n' ? -1 : 0;
  const nc = col + dc, nr = row + dr;
  if (nc < 0 || nc >= VOXEL_COLS || nr < 0 || nr >= VOXEL_ROWS) return false;

  const neighbor = grid[nr * VOXEL_COLS + nc];
  if (!neighbor?.active) return false;

  const neighborFace = neighbor.faces[OPPOSITE[dir]];

  // Case 1: Same surface type → melt unconditionally
  if (surface === neighborFace) return true;

  // Case 2: Both are railing variants → melt (unified deck perimeter)
  const isCurRailing = surface === 'Railing_Glass' || surface === 'Railing_Cable';
  const isNbrRailing = neighborFace === 'Railing_Glass' || neighborFace === 'Railing_Cable';
  if (isCurRailing && isNbrRailing) return true;

  // Case 3: Solid surfaces against any active neighbor → melt (internal walls in assemblies)
  const SOLID: SurfaceType[] = ['Solid_Steel', 'Concrete', 'Glass_Pane', 'Wood_Hinoki', 'Wall_Washi', 'Glass_Shoji'];
  if (SOLID.includes(surface) && neighbor.active) return true;

  return false;
}

// ── Railing autotiling helper ──────────────────────────────────

/** Check if a neighboring voxel has a railing surface on the same face direction. */
function adjHasRailing(
  grid: (ReturnType<typeof createDefaultVoxelGrid>[number] | undefined)[],
  col: number, row: number,
  dc: number, dr: number,
  faceDir: keyof VoxelFaces
): boolean {
  const nc = col + dc, nr = row + dr;
  if (nc < 0 || nc >= VOXEL_COLS || nr < 0 || nr >= VOXEL_ROWS) return false;
  const neighbor = grid[nr * VOXEL_COLS + nc];
  if (!neighbor?.active) return false;
  const s = neighbor.faces[faceDir];
  return s === 'Railing_Cable' || s === 'Railing_Glass';
}

// ── SingleFace — one face of a voxel cell ──────────────────────

interface FaceProps {
  dir:        keyof VoxelFaces;
  surface:    SurfaceType;
  colPitch:   number;
  rowPitch:   number;
  vHeight:    number;
  vOffset:    number;
  activeBrush:SurfaceType | null;
  faceKey:    string;
  isHovered:  boolean;
  /** When true, Open-face hitboxes are rendered (allowing click-through on unselected Open faces) */
  isVoxelSelected: boolean;
  /** Railing autotiling: suppress end post at -spanW/2 when connected to adjacent railing */
  connectedStart?: boolean;
  /** Railing autotiling: suppress end post at +spanW/2 when connected to adjacent railing */
  connectedEnd?: boolean;
  onEnter:    () => void;
  onLeave:    () => void;
  onClick:    () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: ThreeEvent<MouseEvent>) => void;
  /** Whether this face's door/shoji is open */
  isOpen?: boolean;
  /** Door state: 'closed' | 'open_swing' | 'open_slide' */
  doorState?: string;
  /** Door configuration (hinge, swing, type) */
  doorConfig?: import('@/types/container').DoorConfig;
}

function SingleFace({
  dir, surface, colPitch, rowPitch, vHeight, vOffset,
  activeBrush, isHovered, isVoxelSelected, connectedStart, connectedEnd,
  onEnter, onLeave, onClick, onDoubleClick, onContextMenu, isOpen, doorState, doorConfig,
}: FaceProps) {
  const halfCol = colPitch / 2;
  const halfRow = rowPitch / 2;

  // Face-group position relative to voxel-group centre
  const pos: [number, number, number] =
    dir === "n" ? [0, 0, -halfRow] :
    dir === "s" ? [0, 0, +halfRow] :
    dir === "e" ? [+halfCol, 0, 0] :
    dir === "w" ? [-halfCol, 0, 0] :
    dir === "top"    ? [0, +vOffset, 0] :
                       [0, -vOffset, 0];   // bottom

  const isNS    = dir === "n" || dir === "s";
  const isEW    = dir === "e" || dir === "w";
  const isHoriz = dir === "top" || dir === "bottom";

  // Box dims matching the face opening — NO rotation needed
  const [bW, bH, bD]: [number, number, number] =
    isNS ? [colPitch, vHeight, PANEL_THICK] :
    isEW ? [PANEL_THICK, vHeight, rowPitch] :
           [colPitch, PANEL_THICK, rowPitch];        // top / bottom

  // spanW for railing: width of the face opening (not the thin dimension)
  const spanW = isNS ? colPitch : rowPitch;

  // ★ Fluid Mount/Exit Lifecycle Animation
  // - Mount: initialize group at folded state → animate open
  // - Change: surface swap → fold-out animation
  // - Exit: surface → Open → reverse fold-in animation, then clear visual
  const groupRef      = useRef<THREE.Group>(null);
  const prevSurface   = useRef<SurfaceType | null>(null); // null = initial mount
  const animating     = useRef(false);
  const exitingRef    = useRef(false);   // true during reverse fold-in
  // "displaySurface" is what we RENDER — lags behind "surface" during exit animation
  const [displaySurface, setDisplaySurface] = useState<SurfaceType>(surface);

  useEffect(() => {
    if (prevSurface.current === null) {
      // ★ Fix B: INITIAL MOUNT — start folded, animate open
      prevSurface.current = surface;
      if (surface !== "Open" && groupRef.current) {
        animating.current = true;
        exitingRef.current = false;
        if (isHoriz) {
          groupRef.current.rotation.x = dir === "bottom" ? -Math.PI / 2 : Math.PI / 2;
          groupRef.current.scale.set(1, 1, 1);
        } else {
          groupRef.current.scale.set(1, 0, 1);
          groupRef.current.position.y = -vHeight / 2;
          groupRef.current.rotation.x = 0;
        }
      }
      setDisplaySurface(surface);
      return;
    }

    if (surface === prevSurface.current) return;
    const prev = prevSurface.current;
    prevSurface.current = surface;

    if (surface === "Open" && prev !== "Open") {
      // ★ Fix C: EXIT — keep rendering the OLD visual, play reverse animation
      exitingRef.current = true;
      animating.current = true;
      // displaySurface stays as the old visual (prev) — do NOT update it yet
      // The useFrame will animate toward folded state and then setDisplaySurface("Open")
      return;
    }

    // Normal surface change (non-Open → non-Open, or Open → non-Open)
    exitingRef.current = false;
    animating.current = true;
    setDisplaySurface(surface);
    if (groupRef.current) {
      if (isHoriz) {
        groupRef.current.rotation.x = dir === "bottom" ? -Math.PI / 2 : Math.PI / 2;
        groupRef.current.scale.set(1, 1, 1);
      } else {
        groupRef.current.scale.set(1, 0, 1);
        groupRef.current.position.y = -vHeight / 2;
        groupRef.current.rotation.x = 0;
      }
    }
  }, [surface, isHoriz, dir]);

  useFrame((_, dt) => {
    if (!groupRef.current || !animating.current) return;

    if (exitingRef.current) {
      // ★ REVERSE fold-in: animate AWAY from rest position
      if (isHoriz) {
        const target = dir === "bottom" ? -Math.PI / 2 : Math.PI / 2;
        const cur = groupRef.current.rotation.x;
        if (Math.abs(cur - target) > 0.01) {
          groupRef.current.rotation.x = THREE.MathUtils.damp(cur, target, 10, dt);
        } else {
          groupRef.current.rotation.x = target;
          animating.current = false;
          exitingRef.current = false;
          setDisplaySurface("Open");
        }
      } else {
        const cur = groupRef.current.scale.y;
        if (cur > 0.01) {
          const next = THREE.MathUtils.damp(cur, 0, 10, dt);
          groupRef.current.scale.set(1, next, 1);
          groupRef.current.position.y = vHeight * (next - 1) / 2;
        } else {
          groupRef.current.scale.set(1, 0, 1);
          groupRef.current.position.y = -vHeight / 2;
          animating.current = false;
          exitingRef.current = false;
          setDisplaySurface("Open");
        }
      }
      return;
    }

    // FORWARD fold-out: animate toward rest position
    if (isHoriz) {
      const cur = groupRef.current.rotation.x;
      if (Math.abs(cur) > 0.001) {
        groupRef.current.rotation.x = THREE.MathUtils.damp(cur, 0, 8, dt);
      } else {
        groupRef.current.rotation.x = 0;
        animating.current = false;
      }
    } else {
      const cur = groupRef.current.scale.y;
      if (cur < 0.999) {
        const next = THREE.MathUtils.damp(cur, 1, 8, dt);
        groupRef.current.scale.set(1, next, 1);
        groupRef.current.position.y = vHeight * (next - 1) / 2;
      } else {
        groupRef.current.scale.set(1, 1, 1);
        groupRef.current.position.y = 0;
        animating.current = false;
      }
    }
  });

  // Render the VISUAL material layer using displaySurface (lags during exit animation)
  // displaySurface holds the OLD surface during exit animation so the visual stays until fold-in completes.
  function renderVisual() {
    const s = displaySurface;
    if (s === "Open") return null;
    if (isHoriz) {
      if (s === "Deck_Wood")    return <DeckWood w={colPitch} d={rowPitch} />;
      if (s === "Concrete")     return <ConcreteFace w={bW} h={bH} d={bD} />;
      if (s === "Floor_Tatami") return <mesh geometry={getBox(colPitch, 0.04, rowPitch)} material={mTatami} castShadow receiveShadow raycast={nullRaycast} />;
      if (s === "Wood_Hinoki")  return <mesh geometry={getBox(colPitch, 0.04, rowPitch)} material={mHinoki} castShadow receiveShadow raycast={nullRaycast} />;
      const ROOF_THICK = 0.08;
      // Ceiling panels (top) get warm emissive glow; floor panels (bottom) stay steel
      const panelMat = dir === "top" ? mCeilingLight : mSteel;
      return (
        <mesh
          geometry={getBox(colPitch, ROOF_THICK, rowPitch)}
          material={panelMat}
          castShadow
          receiveShadow
          raycast={nullRaycast}
        />
      );
    }
    switch (s) {
      case "Solid_Steel":   return <SteelFace w={bW} h={bH} d={bD} />;
      case "Glass_Pane":    return <GlassFace w={bW} h={bH} d={bD} isNS={isNS} />;
      case "Wall_Washi":    return <mesh geometry={getBox(bW, bH, bD)} material={mWashi} castShadow raycast={nullRaycast} />;
      case "Glass_Shoji":   return <ShojiSlide w={bW} h={bH} d={bD} isNS={isNS} isOpen={isOpen} />;
      case "Wood_Hinoki":   return <mesh geometry={getBox(bW, bH, bD)} material={mHinoki} castShadow raycast={nullRaycast} />;
      case "Railing_Cable": return <RailingCable spanW={spanW} spanH={vHeight} isNS={isNS}
        connectedStart={connectedStart} connectedEnd={connectedEnd} />;
      case "Railing_Glass": return <RailingGlass spanW={spanW} spanH={vHeight} isNS={isNS}
        connectedStart={connectedStart} connectedEnd={connectedEnd} />;
      case "Deck_Wood":     return <SteelFace w={bW} h={bH} d={bD} />;
      case "Concrete":      return <ConcreteFace w={bW} h={bH} d={bD} />;
      case "Half_Fold":     return <HalfFoldFace w={bW} h={bH} d={bD} isNS={isNS} />;
      case "Gull_Wing":     return <GullWingFace w={bW} h={bH} d={bD} isNS={isNS} />;
      case "Door":          return <DoorFace w={bW} h={bH} d={bD} isNS={isNS} isOpen={isOpen} doorState={doorState} doorConfig={doorConfig} />;
      default:              return null;
    }
  }

  // ★ Phase 7 OCCLUSION NUKE: Event handlers live on the HITBOX MESH ONLY.
  // Visual meshes are siblings in the group but have NO handlers attached,
  // so R3F's internal raycaster never tests them → definitive anti-occlusion.
  const evtEnter = useCallback((e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onEnter(); document.body.style.cursor = 'pointer'; }, [onEnter]);
  const evtLeave = useCallback((e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onLeave(); document.body.style.cursor = 'auto'; }, [onLeave]);
  const evtClick = useCallback((e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); }, [onClick]);
  const evtDbl   = useMemo(() => onDoubleClick ? (e: any) => { e.stopPropagation(); onDoubleClick(); } : undefined, [onDoubleClick]);
  const evtCtx   = useMemo(() => onContextMenu ? (e: any) => { e.stopPropagation(); e.nativeEvent?.preventDefault?.(); onContextMenu(e); } : undefined, [onContextMenu]);

  // Drawbridge pivot: horizontal faces hinge at the -Z edge (north boundary)
  // so rotation.x creates a true fold-out/fold-down effect instead of center-spin.
  // Walls use no offset (scale animation only).
  const pivotZ  = isHoriz ? -halfRow : 0;
  const offsetZ = isHoriz ?  halfRow : 0;

  return (
    <group position={pos}>
      <group ref={groupRef} position={[0, 0, pivotZ]}>
        <group position={[0, 0, offsetZ]}>
          {renderVisual()}
        </group>
      </group>
    </group>
  );
}

// ── Edge Highlight Material ──────────────────────────────────────

const mEdgeHighlight = new THREE.MeshBasicMaterial({
  color: 0xffeb3b, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide,
});

// ── VoxelEdgeStrip — Lego-style interactive edge on halo faces ──

const EDGE_STRIP_W = 0.08; // strip width (perpendicular to face plane)

interface EdgeStripProps {
  dir:         keyof VoxelFaces;
  colPitch:    number;
  rowPitch:    number;
  vHeight:     number;
  vOffset:     number;
  containerId: string;
  voxelIndex:  number;
  isEdgeHovered: boolean;
}

function VoxelEdgeStrip({
  dir, colPitch, rowPitch, vHeight, vOffset,
  containerId, voxelIndex, isEdgeHovered,
}: EdgeStripProps) {
  // ★ Purely visual — all interaction handled by floor hitbox Smart Edge
  const isNS    = dir === "n" || dir === "s";
  const isEW    = dir === "e" || dir === "w";
  if (!isNS && !isEW) return null;

  const halfCol = colPitch / 2;
  const halfRow = rowPitch / 2;

  // Position: outer edge of the face, shifted outward by half strip width
  const facePos: [number, number, number] =
    dir === "n" ? [0, 0, -halfRow - EDGE_STRIP_W / 2] :
    dir === "s" ? [0, 0, +halfRow + EDGE_STRIP_W / 2] :
    dir === "e" ? [+halfCol + EDGE_STRIP_W / 2, 0, 0] :
                  [-halfCol - EDGE_STRIP_W / 2, 0, 0];

  // Geometry: thin strip running along the face edge
  const [sw, sh, sd]: [number, number, number] =
    isNS ? [colPitch, vHeight, EDGE_STRIP_W] :
           [EDGE_STRIP_W, vHeight, rowPitch];

  // VoxelEdgeStrip is PURELY VISUAL — no raycasting needed.
  return (
    <group position={facePos}>
      {/* Visible highlight when hovered (driven by floor hitbox Smart Edge) */}
      {isEdgeHovered && (
        <mesh
          geometry={getBox(sw + 0.01, sh + 0.01, sd + 0.01)}
          material={mEdgeHighlight}
          renderOrder={15}
          raycast={nullRaycast}
        />
      )}
    </group>
  );
}

// ── VoxelPopIn — directional "unpacking" animation on mount ────
// Floors/ceilings extrude horizontally (XZ); walls fold up vertically (Y)

function VoxelPopIn({ children, vHeight }: { children: ReactNode; vHeight: number }) {
  const ref = useRef<THREE.Group>(null);
  const t   = useRef(0);

  useFrame((_, dt) => {
    if (t.current >= 1) return;
    t.current = Math.min(t.current + dt / 0.25, 1);
    // Overshoot ease-out: f(t) = 1 - (1-t)^2
    const ease = 1 - (1 - t.current) * (1 - t.current);
    if (ref.current) {
      ref.current.scale.set(ease, ease, ease);
      // Keep the bottom of the block at floor level throughout animation
      ref.current.position.y = vHeight * (ease - 1) / 2;
    }
  });

  return <group ref={ref} scale={[0.01, 0.01, 0.01]} position={[0, -vHeight / 2, 0]}>{children}</group>;
}


// Module-scope WeakMaps — key: original material, value: cloned ghost material
//                         key: mesh instance,     value: original material (before swap)
const _ghostMatClones  = new WeakMap<THREE.Material, THREE.Material>();
const _ghostOriginals  = new WeakMap<THREE.Mesh, THREE.Material>();

function FlushGhostPreview({
  faces, colPitch, rowPitch, vHeight, isValid = true,
}: { faces: VoxelFaces; colPitch: number; rowPitch: number; vHeight: number; isValid?: boolean }) {
  const groupRef     = useRef<THREE.Group>(null!);
  const prevValidRef = useRef<boolean | null>(null);
  const vOff         = vHeight / 2;

  useFrame(() => {
    if (!groupRef.current) return;
    // Re-traverse only on first mount OR when validity toggles
    if (prevValidRef.current === isValid) return;
    prevValidRef.current = isValid;

    groupRef.current.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (Array.isArray(mesh.material)) return;

      // Preserve the original material on first visit so we always clone from source
      if (!_ghostOriginals.has(mesh)) {
        _ghostOriginals.set(mesh, mesh.material as THREE.Material);
      }
      const orig = _ghostOriginals.get(mesh)!;

      // Get or create an opacity-halved clone of that original
      if (!_ghostMatClones.has(orig)) {
        const clone = orig.clone();
        clone.transparent = true;
        (clone as THREE.MeshStandardMaterial).depthWrite = false;
        _ghostMatClones.set(orig, clone);
      }
      const clone = _ghostMatClones.get(orig)!;
      // Always write current validity opacity — fixes the "locked at first encounter" bug
      clone.opacity = isValid ? 0.50 : 0.30;
      mesh.material = clone;
    });
  });

  const FACE_CFG: { dir: keyof VoxelFaces; pos: [number, number, number]; isNS: boolean; isEW: boolean; isHoriz: boolean }[] = [
    { dir: 'n',      pos: [0, 0, -rowPitch / 2], isNS: true,  isEW: false, isHoriz: false },
    { dir: 's',      pos: [0, 0, +rowPitch / 2], isNS: true,  isEW: false, isHoriz: false },
    { dir: 'e',      pos: [+colPitch / 2, 0, 0], isNS: false, isEW: true,  isHoriz: false },
    { dir: 'w',      pos: [-colPitch / 2, 0, 0], isNS: false, isEW: true,  isHoriz: false },
    { dir: 'top',    pos: [0, +vOff, 0],          isNS: false, isEW: false, isHoriz: true  },
    { dir: 'bottom', pos: [0, -vOff, 0],          isNS: false, isEW: false, isHoriz: true  },
  ];

  return (
    <group ref={groupRef}>
      {FACE_CFG.map(({ dir, pos, isNS, isEW, isHoriz }) => {
        const surface = faces[dir];
        if (surface === 'Open') return null;
        return (
          <group key={dir} position={pos}>
            <FaceVisual
              surface={surface}
              colPitch={colPitch}
              rowPitch={rowPitch}
              vHeight={vHeight}
              isNS={isNS}
              isEW={isEW}
              isHoriz={isHoriz}
            />
          </group>
        );
      })}
    </group>
  );
}


// ── BaseplateCell — ground-level "Lego" tile for inactive voxels ─

const BASEPLATE_FLOOR_Y = 0.05;    // Floor-level edge strips (matches active voxel paradigm)
const BASEPLATE_STRIP = 0.2;       // Edge strip depth (matches active voxels)

function BaseplateCell({
  px, pz, colPitch, rowPitch, vHeight,
  containerId, voxelIndex,
  clipFaces, isValid, isLocked,
  isHovered,
  onEnter, onLeave, onClick, onPointerDown, onContextMenu,
}: {
  px: number; pz: number;
  colPitch: number; rowPitch: number; vHeight: number;
  containerId: string; voxelIndex: number;
  clipFaces: VoxelFaces | null;
  isValid: boolean;
  isLocked: boolean;
  isHovered: boolean;
  onEnter: () => void; onLeave: () => void; onClick: () => void;
  onPointerDown?: () => void;
  onContextMenu?: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const showHolo = isHovered && !!clipFaces;

  const onEnterFace = (face: keyof VoxelFaces) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onEnter();
    useStore.getState().setHoveredVoxelEdge({ containerId, voxelIndex, face });
    document.body.style.cursor = 'pointer';
  };
  const onLeaveFace = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    onLeave();
    useStore.getState().setHoveredVoxelEdge(null);
    document.body.style.cursor = 'auto';
  };
  const onClickFace = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onClick(); };
  const onDownFace = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.nativeEvent.shiftKey) {
      useStore.getState().startContainerDrag(containerId);
      return;
    }
    onPointerDown?.();
  };

  return (
    <group position={[px, 0, pz]}>
      {/* ★ Floor center hitbox — slightly below edge strips so edges win priority near borders */}
      <mesh
        position={[0, BASEPLATE_FLOOR_Y - 0.002, 0]}
        geometry={getBox(colPitch - 0.4, 0.1, rowPitch - 0.4)}
        material={mHit}
        userData={{ isBay: true, containerId, voxelIndex, face: 'bottom' }}
        onPointerEnter={onEnterFace('bottom')}
        onPointerLeave={onLeaveFace}
        onClick={onClickFace}
        onPointerDown={onDownFace}
        onContextMenu={onContextMenu ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); (e.nativeEvent as MouseEvent)?.preventDefault?.(); onContextMenu(e); } : undefined}
      />
      {/* ★ Wall-face edge strips at floor level (matches active voxel paradigm — never blocks floor quads) */}
      <mesh position={[0, BASEPLATE_FLOOR_Y, -rowPitch / 2 + BASEPLATE_STRIP / 2]} geometry={getBox(colPitch, 0.1, BASEPLATE_STRIP)} material={mHit}
        userData={{ isBay: true, containerId, voxelIndex, face: 'n' }}
        onPointerEnter={onEnterFace('n')} onPointerLeave={onLeaveFace} onClick={onClickFace} onPointerDown={onDownFace} />
      <mesh position={[0, BASEPLATE_FLOOR_Y, rowPitch / 2 - BASEPLATE_STRIP / 2]} geometry={getBox(colPitch, 0.1, BASEPLATE_STRIP)} material={mHit}
        userData={{ isBay: true, containerId, voxelIndex, face: 's' }}
        onPointerEnter={onEnterFace('s')} onPointerLeave={onLeaveFace} onClick={onClickFace} onPointerDown={onDownFace} />
      <mesh position={[colPitch / 2 - BASEPLATE_STRIP / 2, BASEPLATE_FLOOR_Y, 0]} geometry={getBox(BASEPLATE_STRIP, 0.1, rowPitch)} material={mHit}
        userData={{ isBay: true, containerId, voxelIndex, face: 'e' }}
        onPointerEnter={onEnterFace('e')} onPointerLeave={onLeaveFace} onClick={onClickFace} onPointerDown={onDownFace} />
      <mesh position={[-colPitch / 2 + BASEPLATE_STRIP / 2, BASEPLATE_FLOOR_Y, 0]} geometry={getBox(BASEPLATE_STRIP, 0.1, rowPitch)} material={mHit}
        userData={{ isBay: true, containerId, voxelIndex, face: 'w' }}
        onPointerEnter={onEnterFace('w')} onPointerLeave={onLeaveFace} onClick={onClickFace} onPointerDown={onDownFace} />

      {/* ★ Ghost hologram when stamp tool is active */}
      {showHolo && (
        <group position={[0, vHeight / 2, 0]}>
          <FlushGhostPreview
            faces={clipFaces!}
            colPitch={colPitch}
            rowPitch={rowPitch}
            vHeight={vHeight}
            isValid={!isLocked}
          />
        </group>
      )}
    </group>
  );
}

// ── Pool Water Plane ──────────────────────────────────────────
const mWater = new THREE.MeshPhysicalMaterial({
  color: 0x1e88e5,
  metalness: 0.1,
  roughness: 0.05,
  transmission: 0.6,
  thickness: 0.5,
  ior: 1.33,
  transparent: true,
  opacity: 0.75,
  side: THREE.DoubleSide,
});

/** Renders a semi-transparent water plane at 85% container height for pool containers. */
function WaterPlane({ dims }: { dims: { length: number; width: number; height: number } }) {
  const waterY = dims.height * 0.85 - dims.height / 2; // 85% of height, offset from center
  return (
    <mesh position={[0, waterY, 0]} rotation={[-Math.PI / 2, 0, 0]}
      geometry={getBox(dims.length * 0.9, dims.width * 0.9, 0.02)}
      material={mWater} raycast={nullRaycast} />
  );
}

// ── Exported layout helper (used by WalkthroughControls for roof walkability) ──

export function getVoxelLayout(
  col: number,
  row: number,
  dims: { length: number; width: number; height: number }
): { voxW: number; voxD: number; px: number; pz: number } {
  const foldDepth = dims.height;
  const coreWidth = dims.length / 6;
  const coreDepth = dims.width / 2;
  const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
  const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
  const voxW = isHaloCol ? foldDepth : coreWidth;
  const voxD = isHaloRow ? foldDepth : coreDepth;
  let px: number;
  if (col === 0)                   px = dims.length / 2 + foldDepth / 2;
  else if (col === VOXEL_COLS - 1) px = -(dims.length / 2 + foldDepth / 2);
  else                             px = -(col - 3.5) * coreWidth;
  let pz: number;
  if (row === 0)                   pz = -(dims.width / 2 + foldDepth / 2);
  else if (row === VOXEL_ROWS - 1) pz = dims.width / 2 + foldDepth / 2;
  else                             pz = (row - 1.5) * coreDepth;
  return { voxW, voxD, px, pz };
}

// ── ContainerSkin ──────────────────────────────────────────────

export default function ContainerSkin({
  container,
  debug     = false,
  animated  = true,
  ghostMode = false,
}: {
  container: Container;
  debug?:    boolean;
  /** When false, voxels render at full scale immediately (no pop-in). Use in IsoEditor preview. */
  animated?: boolean;
  /** When true, disables all hitboxes (used for drag-move ghost preview). */
  ghostMode?: boolean;
}) {
  const setSelectedVoxel  = useStore((s) => s.setSelectedVoxel);
  const setVoxelActive    = useStore((s) => s.setVoxelActive);
  const activeBrush       = useStore((s) => s.activeBrush);
  const setVoxelFace      = useStore((s) => s.setVoxelFace);
  const cycleVoxelFace    = useStore((s) => s.cycleVoxelFace);
  const cycleVoxelTemplate = useStore((s) => s.cycleVoxelTemplate);
  const cycleBlockPreset   = useStore((s) => s.cycleBlockPreset);
  const select            = useStore((s) => s.select);
  const selectedVoxel     = useStore((s) => s.selectedVoxel);
  const globalCullSet     = useStore((s) => s.globalCullSet);
  const hoveredVoxelEdge  = useStore((s) => s.hoveredVoxelEdge);
  const setHoveredVoxel   = useStore((s) => s.setHoveredVoxel);
  const setHoveredVoxelEdge = useStore((s) => s.setHoveredVoxelEdge);
  const clipboardVoxel    = useStore((s) => s.clipboardVoxel);
  const activeHotbarSlot     = useStore((s) => s.activeHotbarSlot);
  const activeModulePreset   = useStore((s) => s.activeModulePreset);
  const hasToolEquipped      = activeHotbarSlot !== null || activeModulePreset !== null;
  const stampFromHotbar      = useStore((s) => s.stampFromHotbar);
  const getStampFaces        = useStore((s) => s.getStampFaces);
  const getStampFootprint    = useStore((s) => s.getStampFootprint);
  const stampArea            = useStore((s) => s.stampArea);
  const stampAreaSmart       = useStore((s) => s.stampAreaSmart);
  const isStaircaseMacro     = useStore((s) => s.isStaircaseMacro);
  const stampStaircase       = useStore((s) => s.stampStaircase);
  const openVoxelContextMenu = useStore((s) => s.openVoxelContextMenu);
  const setFaceContextMenuCtx = useStore((s) => s.setFaceContextMenuCtx);
  const dollhouseActive      = useStore((s) => s.dollhouseActive);
  const currentTheme         = useStore((s) => s.currentTheme);
  const lockedVoxels         = useStore((s) => s.lockedVoxels);
  const setFaceContext       = useStore((s) => s.setFaceContext);
  const hoveredVoxel         = useStore((s) => s.hoveredVoxel);
  const selectedVoxels       = useStore((s) => s.selectedVoxels);
  const bucketMode           = useStore((s) => s.bucketMode);
  const bucketSurface        = useStore((s) => s.bucketSurface);
  const paintFace            = useStore((s) => s.paintFace);
  const hoveredPreviewFace   = useStore((s) => s.hoveredPreviewFace);
  const voxelContextMenu     = useStore((s) => s.voxelContextMenu);
  const viewMode             = useStore((s) => s.viewMode);
  const isWalkthrough        = viewMode === ViewMode.Walkthrough;
  const isPreviewMode        = useStore((s) => s.isPreviewMode);
  const facePreview          = useStore((s) => s.facePreview); // WU-3: in-place face preview (hover + scroll)

  // Sync module-scope material aliases whenever theme changes
  syncThemeMats(currentTheme);

  // ★ PILLAR 3: Subterranean Concrete Morph — basement containers auto-swap steel→concrete
  if (container.level < 0) {
    mSteel = mConcrete;
    mSteelInner = mConcrete;
  }

  const [hovered, setHovered] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<{ idx: number; face: string } | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Multi-Tile Footprint ─────────────────────────────────
  /** Hovered baseplate origin for footprint preview (null when not hovering baseplate) */
  const [footprintOrigin, setFootprintOrigin] = useState<{ col: number; row: number } | null>(null);

  /** Compute all voxel indices covered by the active footprint starting from origin */
  const footprintIndices = useMemo(() => {
    if (!footprintOrigin) return [] as number[];
    const [fpCols, fpRows] = getStampFootprint();
    if (fpCols <= 1 && fpRows <= 1) return [] as number[];
    const out: number[] = [];
    for (let dr = 0; dr < fpRows; dr++) {
      for (let dc = 0; dc < fpCols; dc++) {
        const c = footprintOrigin.col + dc;
        const r = footprintOrigin.row + dr;
        if (c >= 0 && c < VOXEL_COLS && r >= 0 && r < VOXEL_ROWS) {
          out.push(r * VOXEL_COLS + c);
        }
      }
    }
    return out;
  }, [footprintOrigin, getStampFootprint]);

  /** Is a cell inside the current footprint preview? */
  const isInFootprint = useCallback(
    (col: number, row: number) => {
      if (!footprintOrigin) return false;
      const [fpCols, fpRows] = getStampFootprint();
      if (fpCols <= 1 && fpRows <= 1) return false;
      return col >= footprintOrigin.col && col < footprintOrigin.col + fpCols &&
             row >= footprintOrigin.row && row < footprintOrigin.row + fpRows;
    },
    [footprintOrigin, getStampFootprint]
  );

  const brushStampVoxel  = useStore((s) => s.brushStampVoxel);

  // ★ Fix 2: Clear stale hoveredVoxelEdge + pending leave timer on unmount or container change
  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
      const s = useStore.getState();
      if (s.hoveredVoxelEdge?.containerId === container.id) {
        s.setHoveredVoxelEdge(null);
      }
      if (s.hoveredVoxel?.containerId === container.id) {
        s.setHoveredVoxel(null);
      }
    };
  }, [container.id]);

  // Copy/Paste: Ctrl+C copies hovered voxel faces; Ctrl+V pastes clipboard to hovered voxel
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const hv = useStore.getState().hoveredVoxel;
      if (!hv) return;
      const hvIndex = hv.isExtension ? hv.row * VOXEL_COLS + hv.col : hv.index;
      if (e.key === 'c') {
        e.preventDefault();
        useStore.getState().copyVoxel(hv.containerId, hvIndex);
      } else if (e.key === 'v') {
        e.preventDefault();
        useStore.getState().pasteVoxel(hv.containerId, hvIndex);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const dims      = CONTAINER_DIMENSIONS[container.size];
  const vHeight   = dims.height;                       // Y: 2.59m or 2.90m HC
  const coreWidth = dims.length / 6;                   // X per core col: ~2.03m
  const coreDepth = dims.width  / 2;                   // Z per core row: 1.22m
  const foldDepth = dims.height;                       // halo outward projection = container height
  const vOffset   = vHeight / 2;

  /** Per-voxel layout: delegates to the exported pure function. */
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const getVoxelLayout = useCallback((col: number, row: number) => {
    const fD = dims.height;
    const cW = dims.length / 6;
    const cD = dims.width / 2;
    const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
    const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
    const voxW = isHaloCol ? fD : cW;
    const voxD = isHaloRow ? fD : cD;
    let px: number;
    if (col === 0)                   px = dims.length / 2 + fD / 2;
    else if (col === VOXEL_COLS - 1) px = -(dims.length / 2 + fD / 2);
    else                             px = -(col - 3.5) * cW;
    let pz: number;
    if (row === 0)                   pz = -(dims.width / 2 + fD / 2);
    else if (row === VOXEL_ROWS - 1) pz = dims.width / 2 + fD / 2;
    else                             pz = (row - 1.5) * cD;
    return { voxW, voxD, px, pz };
  }, [dims.length, dims.width, dims.height]);

  const grid = container.voxelGrid ?? createDefaultVoxelGrid();

  // WU-10: Pre-compute unique pillar positions for all convex outer corners of active voxels.
  // A corner (sx, sz) of voxel (col, row) is convex if BOTH lateral neighbors are inactive.
  // Due to E/W inversion: X-direction neighbor is at col-sx (not col+sx).
  const pillarPositions = useMemo(() => {
    const positions: Array<{ px: number; pz: number }> = [];
    const posSet = new Set<string>();
    for (let row = 0; row < VOXEL_ROWS; row++) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        const voxel = grid[row * VOXEL_COLS + col];
        if (!voxel?.active || voxel.faces.top === 'Open') continue;
        const { voxW, voxD, px, pz } = getVoxelLayout(col, row);
        for (const sx of [-1, 1] as const) {
          for (const sz of [-1, 1] as const) {
            const xc = col - sx; // E/W inversion: +X direction = lower col
            const xActive = xc >= 0 && xc < VOXEL_COLS ? (grid[row * VOXEL_COLS + xc]?.active ?? false) : false;
            const zr = row + sz;
            const zActive = zr >= 0 && zr < VOXEL_ROWS ? (grid[zr * VOXEL_COLS + col]?.active ?? false) : false;
            if (!xActive && !zActive) {
              const cpx = px + sx * voxW / 2;
              const cpz = pz + sz * voxD / 2;
              const key = `${cpx.toFixed(3)}_${cpz.toFixed(3)}`;
              if (!posSet.has(key)) { posSet.add(key); positions.push({ px: cpx, pz: cpz }); }
            }
          }
        }
      }
    }
    return positions;
  }, [grid, getVoxelLayout]);

  const handleClick = useCallback(
    (voxelIndex: number, faceName: keyof VoxelFaces) => {
      // ★ Paint Bucket mode: change only this face's texture, no structural changes
      if (bucketMode) {
        paintFace(container.id, voxelIndex, faceName, bucketSurface);
        return;
      }

      const alreadySelected =
        selectedVoxel?.containerId === container.id &&
        !selectedVoxel?.isExtension &&
        selectedVoxel?.index === voxelIndex;

      if (!alreadySelected) {
        setSelectedVoxel({ containerId: container.id, index: voxelIndex });
        return;
      }

      // Already selected — edit the face.
      if (activeBrush) {
        setVoxelFace(container.id, voxelIndex, faceName, activeBrush);
      } else {
        cycleVoxelFace(container.id, voxelIndex, faceName);
      }
    },
    [container.id, activeBrush, bucketMode, bucketSurface, selectedVoxel, setSelectedVoxel, setVoxelFace, cycleVoxelFace, paintFace]
  );

  const handleContextMenu = useCallback(
    (voxelIndex: number, faceName: keyof VoxelFaces, nativeEvent: MouseEvent) => {
      nativeEvent.preventDefault();
      setSelectedVoxel({ containerId: container.id, index: voxelIndex });
      // WU-9: Open FaceContextMenu with surface-aware actions
      const voxel = container.voxelGrid?.[voxelIndex];
      if (voxel) {
        setFaceContextMenuCtx({
          containerId: container.id,
          voxelIndex,
          face: faceName,
          surface: voxel.faces[faceName],
          screenX: nativeEvent.clientX,
          screenY: nativeEvent.clientY,
        });
      }
      // ★ Phase 8.5: Also open legacy VoxelContextMenu (Lock/Copy/Apply)
      openVoxelContextMenu(
        nativeEvent.clientX, nativeEvent.clientY,
        container.id, voxelIndex, faceName
      );
    },
    [container.id, container.voxelGrid, setSelectedVoxel, openVoxelContextMenu, setFaceContextMenuCtx]
  );

  // ★ Phase 1: ALL 32 level-0 voxel positions — active AND inactive.
  // This is a STATIC grid (no deps). Every cell always renders its hitbox geometry.
  // Level 1 is omitted to avoid Z-fighting with ContainerMesh roof.
  const allLevel0 = useMemo(() => {
    const out: { idx: number; col: number; row: number }[] = [];
    for (let row = 0; row < VOXEL_ROWS; row++) {
      for (let col = 0; col < VOXEL_COLS; col++) {
        out.push({ idx: row * VOXEL_COLS + col, col, row });
      }
    }
    return out;
  }, []);

  // NO early return — even an empty grid renders baseplates.

  const FACE_DIRS: (keyof VoxelFaces)[] = ["n", "s", "e", "w", "top", "bottom"];

  // ★ Phase 7: Belt-and-suspenders layer isolation. Primary fix is in SingleFace
  // (handlers on hitbox mesh only), but this ensures custom raycasters also skip visual meshes.
  const skinRef = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!skinRef.current) return;
    skinRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.userData?.isBay) {
          child.layers.enable(RAYCAST_LAYERS.INTERACTABLE);
        } else {
          child.layers.disable(RAYCAST_LAYERS.INTERACTABLE);
        }
      }
    });
  });

  // ── Dollhouse Cutaway (Phase 9) ───────────────────────────
  const fadedKeyRef = useRef('');
  const [fadedDirs, setFadedDirs] = useState<Set<string>>(new Set());

  useFrame(({ camera }) => {
    if (!dollhouseActive) {
      if (fadedKeyRef.current !== '') {
        fadedKeyRef.current = '';
        setFadedDirs(new Set());
      }
      return;
    }
    const cx = container.position.x;
    const cy = container.position.y;
    const cz = container.position.z;
    const vx = camera.position.x - cx;
    const vz = camera.position.z - cz;
    const len = Math.sqrt(vx * vx + vz * vz) || 1;
    const dx = vx / len, dz = vz / len;
    const rot = container.rotation || 0;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    // Face normals in world space (Y-rotation applied)
    // n: local [0,0,-1] → [sinR, 0, -cosR]
    // s: local [0,0,+1] → [-sinR, 0, cosR]
    // e: local [+1,0,0] → [cosR, 0, sinR]
    // w: local [-1,0,0] → [-cosR, 0, -sinR]
    const dots: [string, number][] = [
      ['n', dx * sinR + dz * (-cosR)],
      ['s', dx * (-sinR) + dz * cosR],
      ['e', dx * cosR + dz * sinR],
      ['w', dx * (-cosR) + dz * (-sinR)],
    ];
    const faded = new Set<string>();
    for (const [dir, dot] of dots) {
      if (dot > 0.15) faded.add(dir);
    }
    const key = Array.from(faded).sort().join(',');
    if (key !== fadedKeyRef.current) {
      fadedKeyRef.current = key;
      setFadedDirs(faded);
    }
  });

  return (
    <group
      ref={skinRef}
      onPointerLeave={() => {
        if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
        setHoveredVoxel(null);
        setHoveredVoxelEdge(null);
        setFaceContext(null);
        document.body.style.cursor = 'auto';
      }}
    >
      {allLevel0.map(({ idx, col, row }) => {
        const voxel = grid[idx];
        if (!voxel) return null;

        // ★ Phase 8: Per-voxel layout — halo tiles use foldDepth, core tiles use coreWidth/coreDepth
        const { voxW, voxD, px, pz } = getVoxelLayout(col, row);
        const py = vOffset;

        const isActive = voxel.active;

        // ── INACTIVE VOXEL → Phase 2 Baseplate + Phase 1 permanent face hitboxes ──
        if (!isActive) {
          const baseKey = `base_${idx}`;
          return (
            <group key={idx}>
              {/* Ground-level baseplate tile (visible wireframe "Lego" indicator) */}
              <BaseplateCell
                px={px}
                pz={pz}
                colPitch={voxW}
                rowPitch={voxD}
                vHeight={vHeight}
                containerId={container.id}
                voxelIndex={idx}
                clipFaces={getStampFaces()}
                isValid={true}
                isLocked={!!lockedVoxels[`${container.id}_${idx}`]}
                isHovered={hovered === baseKey || isInFootprint(col, row)}
                onEnter={() => {
                  // Cancel any pending leave timer from body voxel debounce
                  if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                  setHovered(baseKey);
                  setFootprintOrigin({ col, row });
                  // Use non-extension form so MatrixEditor grid sync works via index match
                  setHoveredVoxel({ containerId: container.id, index: idx });
                }}
                onLeave={() => {
                  setHovered((k) => (k === baseKey ? null : k));
                  setFootprintOrigin((prev) =>
                    prev?.col === col && prev?.row === row ? null : prev
                  );
                  setFaceContext(null);
                  // Debounce clearing hoveredVoxel — matches body voxel pattern
                  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                  leaveTimerRef.current = setTimeout(() => {
                    setHoveredVoxel(null);
                    leaveTimerRef.current = null;
                  }, 250);
                }}
                onContextMenu={(e: ThreeEvent<MouseEvent>) => {
                  setSelectedVoxel({ containerId: container.id, isExtension: true, col, row });
                  openVoxelContextMenu(
                    (e.nativeEvent as MouseEvent).clientX,
                    (e.nativeEvent as MouseEvent).clientY,
                    container.id, idx
                  );
                }}
                onClick={() => {
                  select(container.id);
                  setFaceContext('floor');
                  // ★ Module preset paint — highest priority
                  const modPreset = useStore.getState().activeModulePreset;
                  if (modPreset) {
                    useStore.getState().applyModule(container.id, idx, modPreset, useStore.getState().moduleOrientation);
                    return;
                  }
                  // ★ Phase 8.5: multi-tile footprint stamp
                  const [fpC, fpR] = getStampFootprint();
                  if ((fpC > 1 || fpR > 1) && getStampFaces()) {
                    stampArea(container.id, footprintIndices, getStampFaces()!);
                    return;
                  }
                  // ★ Phase 4: Staircase macro routes through stampStaircase
                  if (isStaircaseMacro()) {
                    stampStaircase(container.id, idx);
                    return;
                  }
                  // Single-click stamp: Hotbar > brush template > clipboard > activate
                  const faces = getStampFaces();
                  if (faces) {
                    brushStampVoxel(container.id, idx);
                  } else {
                    // ★ Phase 2 WYSIWYC: Empty tiles are 1st-class citizens.
                    // Always select. On second click cycle block preset (continues infinite loop through Empty).
                    const isAlreadySel = selectedVoxel?.containerId === container.id
                      && selectedVoxel?.isExtension && selectedVoxel.col === col && selectedVoxel.row === row;
                    if (isAlreadySel) {
                      // Cycle to next preset (Empty → Default Steel → etc.)
                      cycleBlockPreset(container.id, idx);
                      // Switch to non-extension selectedVoxel so active hitbox recognizes next click
                      setSelectedVoxel({ containerId: container.id, index: idx });
                      return;
                    }
                    // ★ Synthetic extension payload — NO index (prevents grid lookups)
                    setSelectedVoxel({ containerId: container.id, isExtension: true, col, row });
                  }
                }}
              />


            </group>
          );
        }

        // ── ACTIVE VOXEL → full face rendering with permanent hitboxes ──

        const isSelected =
          selectedVoxel?.containerId === container.id &&
          !selectedVoxel?.isExtension &&
          selectedVoxel?.index === idx;

        const isHaloVoxel =
          col === 0 || col === VOXEL_COLS - 1 ||
          row === 0 || row === VOXEL_ROWS - 1;

        // Ghost hologram for active voxels when stamp/brush is active
        const isVoxelHovered =
          hoveredVoxel?.containerId === container.id &&
          !hoveredVoxel?.isExtension &&
          hoveredVoxel?.index === idx;
        const stampFaces = getStampFaces();

        // Build face nodes — hitbox rendering is CONTEXTUAL (Phase 5):
        // Open faces only get hitboxes when this voxel is selected.
        const faceNodes = FACE_DIRS.map((dir) => {
          // WU-3: Apply face-preview override if this face is being previewed (hover or scroll)
          const previewSurface = (facePreview?.containerId === container.id
            && facePreview?.voxelIndex === idx
            && facePreview?.face === dir)
            ? facePreview.surface : null;
          const surface = previewSurface ?? voxel.faces[dir];

          // ★ Phase 15: Intelligent face melting — replaces dual adjIsActive + railing bypass.
          // Culls internal walls when surfaces are semantically compatible (same type, railings, or solids).
          if (adjIsMelting(grid, col, row, dir, surface)) return null;

          // ★ Phase 4: Global adjacency culling — hide face if touching active voxel in adjacent container
          if (globalCullSet.has(`${container.id}:${idx}:${dir}`)) return null;

          // ★ Phase 9: Dollhouse cutaway — hide walls facing the camera
          if (fadedDirs.has(dir)) return null;

          // ★ Phase 4 railing autotiling: compute connectivity for seamless railing runs
          const isRailing = surface === 'Railing_Cable' || surface === 'Railing_Glass';
          const isNS = dir === 'n' || dir === 's';
          let cStart = false, cEnd = false;
          if (isRailing) {
            if (isNS) {
              // N/S faces span along X (cols). Start=-spanW/2 → "e" neighbor, End=+spanW/2 → "w" neighbor
              cStart = adjHasRailing(grid, col, row, 1, 0, dir);
              cEnd   = adjHasRailing(grid, col, row, -1, 0, dir);
            } else if (dir === 'e' || dir === 'w') {
              // E/W faces span along Z (rows). Start=-spanW/2 → "n" neighbor, End=+spanW/2 → "s" neighbor
              cStart = adjHasRailing(grid, col, row, 0, -1, dir);
              cEnd   = adjHasRailing(grid, col, row, 0, 1, dir);
            }
          }

          const faceKey = `${container.id}_${idx}_${dir}`;
          const isFaceOpen = !!(voxel.openFaces?.[dir]);
          return (
            <SingleFace
              key={`face-${dir}`}
              dir={dir}
              surface={surface}
              colPitch={voxW}
              rowPitch={voxD}
              vHeight={vHeight}
              vOffset={vOffset}
              activeBrush={activeBrush}
              faceKey={faceKey}
              isHovered={hovered === faceKey || (isSelected && hoveredPreviewFace === dir) || (voxelContextMenu?.voxelIndex === idx && voxelContextMenu?.containerId === container.id && voxelContextMenu?.faceDir === dir)}
              isVoxelSelected={isSelected}
              connectedStart={cStart}
              connectedEnd={cEnd}
              isOpen={isFaceOpen}
              doorState={voxel.doorStates?.[dir]}
              doorConfig={voxel.doorConfig?.[dir]}
              onEnter={() => { setHovered(faceKey); setHoveredVoxel({ containerId: container.id, index: idx }); }}
              onLeave={() => { setHovered((k) => (k === faceKey ? null : k)); setHoveredVoxel(null); }}
              onClick={() => handleClick(idx, dir)}
              onDoubleClick={undefined}
              onContextMenu={(e: any) => handleContextMenu(idx, dir, e.nativeEvent ?? e)}
            />
          );
        });

        // Edge strip directions: only the outward-facing sides of halo voxels
        const EDGE_DIRS: (keyof VoxelFaces)[] = ["n", "s", "e", "w"];

        return (
          <group key={idx} position={[px, py, pz]}>
            {/* animated=true → pop-in from scale 0; animated=false → instant full scale (IsoEditor) */}
            {animated
              ? <VoxelPopIn vHeight={vHeight}>{faceNodes}</VoxelPopIn>
              : <group>{faceNodes}</group>
            }

            {/* Volumetric stair geometry — rendered when voxelType === 'stairs' */}
            {voxel.voxelType === 'stairs' && (
              <StairMesh
                voxW={voxW}
                voxD={voxD}
                voxH={vHeight}
                ascending={voxel.stairAscending ?? (voxel.stairDir === 'ew' ? 'e' : 'n')}
                faces={voxel.faces}
                stairPart={voxel.stairPart}
              />
            )}

            {/* Lego-style 3D edge strips — on all active voxels */}
            {EDGE_DIRS.map((dir) => {
              if (adjIsActive(grid, col, row, dir)) return null;
              const edgeHovered =
                hoveredVoxelEdge?.containerId === container.id &&
                hoveredVoxelEdge?.voxelIndex === idx &&
                hoveredVoxelEdge?.face === dir;
              return (
                <VoxelEdgeStrip
                  key={`edge_${dir}`}
                  dir={dir}
                  colPitch={voxW}
                  rowPitch={voxD}
                  vHeight={vHeight}
                  vOffset={vOffset}
                  containerId={container.id}
                  voxelIndex={idx}
                  isEdgeHovered={edgeHovered}
                />
              );
            })}

            {/* Pillars now rendered via pre-computed pillarPositions below the voxel loop (WU-10) */}

            {/* ★ HITBOXES: 1 thin center (selection-only) + 4 edge rail hitboxes (100mm).
                Center is inset from edges so it doesn't overlap edge rails.
                Edge hitboxes = full vHeight tall for face targeting. */}
            {(() => {

              const isAlreadySelected = selectedVoxel?.containerId === container.id && !selectedVoxel?.isExtension && selectedVoxel?.index === idx;

              // Shared hover enter for center + edge hitboxes
              const onEnterShared = (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHoveredVoxel({ containerId: container.id, index: idx });
                document.body.style.cursor = 'pointer';
              };
              const onLeaveShared = (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                setHoveredVoxelEdge(null);
                setFaceContext(null);
                document.body.style.cursor = 'auto';
                // Debounce clearing hoveredVoxel — gives cursor 250ms to travel between hitboxes or to SmartHotbar
                if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = setTimeout(() => {
                  setHoveredVoxel(null);
                  leaveTimerRef.current = null;
                }, 250);
              };
              // Debounced leave for edge strips / ceiling hitboxes — same pattern as onLeaveShared
              const onLeaveEdge = () => {
                setHoveredEdge(null);
                setHoveredVoxelEdge(null);
                setFaceContext(null);
                document.body.style.cursor = 'auto';
                if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                leaveTimerRef.current = setTimeout(() => {
                  setHoveredVoxel(null);
                  leaveTimerRef.current = null;
                }, 250);
              };
              const onDownShared = (e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation();
                if (e.nativeEvent.shiftKey) {
                  useStore.getState().startContainerDrag(container.id);
                }
              };
              const onCtxShared = (face?: keyof VoxelFaces) => (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                (e.nativeEvent as MouseEvent)?.preventDefault?.();
                setSelectedVoxel({ containerId: container.id, index: idx });
                if (face) {
                  // Edge right-click → FaceContextMenu only (face-specific actions)
                  const voxel = useStore.getState().containers[container.id]?.voxelGrid?.[idx];
                  if (voxel) {
                    setFaceContextMenuCtx({
                      containerId: container.id,
                      voxelIndex: idx,
                      face,
                      surface: voxel.faces[face],
                      screenX: (e.nativeEvent as MouseEvent).clientX,
                      screenY: (e.nativeEvent as MouseEvent).clientY,
                    });
                  }
                } else {
                  // Center right-click → VoxelContextMenu (block-level actions)
                  openVoxelContextMenu(
                    (e.nativeEvent as MouseEvent).clientX,
                    (e.nativeEvent as MouseEvent).clientY,
                    container.id, idx, undefined
                  );
                }
              };

              // Click-to-Apply: Click 1=select, Click 2=stamp/cycle
              const doStamp = () => {
                // ★ Module preset paint — highest priority
                const modPreset2 = useStore.getState().activeModulePreset;
                if (modPreset2) {
                  useStore.getState().applyModule(container.id, idx, modPreset2, useStore.getState().moduleOrientation);
                  return;
                }
                const stampFaces = getStampFaces();
                const multiSel = useStore.getState().selectedVoxels;
                if (multiSel && multiSel.containerId === container.id && multiSel.indices.length > 1 && stampFaces) {
                  // Multi-voxel: stamp exterior faces only
                  stampAreaSmart(container.id, multiSel.indices, stampFaces);
                } else if (isStaircaseMacro()) {
                  stampStaircase(container.id, idx);
                } else {
                  brushStampVoxel(container.id, idx);
                }
              };
              // ★ MACRO: center click on already-selected block cycles full block presets
              // (Empty→Deck→Room→Sunroom→Balcony). Edge clicks remain face-specific (MICRO).
              const onClickCenter = (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                select(container.id);
                setFaceContext('floor');
                // ★ Multi-select bypass: if >1 voxels selected + tool equipped, stamp all immediately
                const facesNow = getStampFaces();
                const multiSel = useStore.getState().selectedVoxels;
                if (facesNow && multiSel && multiSel.containerId === container.id && multiSel.indices.length > 1) {
                  doStamp();
                  return;
                }
                // Focus gate: first click always focuses — never stamp or cycle on first contact
                // ★ STALE CLOSURE FIX: read selectedVoxel fresh at click time
                const { selectedVoxel: sv } = useStore.getState();
                const isSelected =
                  sv?.containerId === container.id &&
                  !sv?.isExtension &&
                  sv?.index === idx;
                if (!isSelected) {
                  setSelectedVoxel({ containerId: container.id, index: idx });
                  return;
                }
                // Already focused: stamp or cycle preset
                if (facesNow) {
                  doStamp();
                } else {
                  cycleBlockPreset(container.id, idx);
                }
              };
              const onClickEdge = (face: keyof VoxelFaces) => (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                // Alt+click = eyedropper: pick surface type from clicked face
                if (e.nativeEvent.altKey) {
                  const voxel = useStore.getState().containers[container.id]?.voxelGrid?.[idx];
                  if (voxel) useStore.getState().setActiveBrush(voxel.faces[face]);
                  return;
                }
                select(container.id);
                const ctx = face === 'top' ? 'roof' : face === 'bottom' ? 'floor' : 'wall';
                setFaceContext(ctx);
                // Implicit paint: when activeBrush is set, paint immediately (skip focus gate)
                if (activeBrush) {
                  select(container.id);
                  setSelectedVoxel({ containerId: container.id, index: idx });
                  setVoxelFace(container.id, idx, face, activeBrush);
                  return;
                }
                // ★ Multi-select bypass: if >1 voxels selected + tool equipped, stamp all immediately
                const facesNow = getStampFaces();
                const multiSel = useStore.getState().selectedVoxels;
                if (facesNow && multiSel && multiSel.containerId === container.id && multiSel.indices.length > 1) {
                  doStamp();
                  return;
                }
                // Single-click selection: select voxel + face in one step
                if (!isAlreadySelected) {
                  setSelectedVoxel({ containerId: container.id, index: idx });
                  useStore.getState().setSelectedFace(face);
                  return;
                }
                // Already selected: stamp, or update face selection
                const faces = getStampFaces();
                if (faces) {
                  doStamp();
                } else {
                  // Update selected face for the context widget
                  useStore.getState().setSelectedFace(face);
                }
              };
              const onEnterEdge = (face: keyof VoxelFaces) => (e: ThreeEvent<PointerEvent>) => {
                onEnterShared(e);
                setHoveredVoxelEdge({ containerId: container.id, voxelIndex: idx, face });
                setFaceContext('wall');
              };

              const handleEdgeWheel = (face: keyof VoxelFaces) => (e: ThreeEvent<WheelEvent>) => {
                e.stopPropagation();
                const store = useStore.getState();
                store.setActiveHotbarSlot(null);   // clear stamp tool when cycling face
                const voxel = store.containers[container.id]?.voxelGrid?.[idx];
                if (!voxel) return;
                const dir = (e as any).deltaY > 0 ? 1 : -1;
                const current = voxel.faces[face];
                const cycle = getCycleForFace(face);
                const i = cycle.indexOf(current as SurfaceType);
                store.setVoxelFace(container.id, idx, face, cycle[((i >= 0 ? i : 0) + dir + cycle.length) % cycle.length]);
                store.setHoveredVoxelEdge({ containerId: container.id, voxelIndex: idx, face });
              };

              const handleEdgeDblClick = (face: keyof VoxelFaces) => (e: ThreeEvent<MouseEvent>) => {
                e.stopPropagation();
                cycleVoxelFace(container.id, idx, face);
              };

              const halfX = voxW / 2;
              const halfZ = voxD / 2;
              return (
                <>
                  {/* ── All hitboxes — disabled in preview/ghost mode ── */}
                  {!isPreviewMode && !ghostMode && (
                    <>
                      {/* Floor-edge hitbox paradigm — all 5 hitboxes live at floor level (y=-vOffset+0.05).
                          Center handles floor/block cycling; 4 edge strips handle individual wall faces.
                          Camera rays from above travel downward and land on these, never blocking orbit.
                          ★ Disabled in walkthrough mode — FPV full-cube hitbox handles that. */}
                      {!isWalkthrough && (() => {
                        const FLOOR_Y = -vOffset + 0.05;
                        return (
                          <>
                            {/* CENTER — maps to floor/ceiling cycling (bottom / top faces) */}
                            <mesh
                              geometry={getBox(voxW - 0.4, 0.1, voxD - 0.4)}
                              position={[0, FLOOR_Y, 0]}
                              material={mHit}
                              userData={{ isBay: true }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredVoxel({ containerId: container.id, index: idx });
                                setHoveredVoxelEdge({ containerId: container.id, voxelIndex: idx, face: 'bottom' });
                                setFaceContext('floor');
                                document.body.style.cursor = 'pointer';
                              }}
                              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (e.nativeEvent.shiftKey) {
                                  useStore.getState().startContainerDrag(container.id);
                                  return;
                                }
                                onClickCenter(e as any);
                              }}
                              onDoubleClick={(e: ThreeEvent<MouseEvent>) => {
                                e.stopPropagation();
                                cycleBlockPreset(container.id, idx);
                              }}
                              onPointerLeave={onLeaveEdge}
                              onContextMenu={onCtxShared()}
                            />
                            {/* NORTH edge strip — maps to face 'n' */}
                            <mesh
                              geometry={getBox(voxW, 0.1, 0.2)}
                              position={[0, FLOOR_Y, -voxD / 2 + 0.1]}
                              material={mHit}
                              userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: 'n' }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredEdge({ idx, face: 'n' });
                                onEnterEdge('n')(e);
                              }}
                              onPointerLeave={onLeaveEdge}
                              onClick={onClickEdge('n')}
                              onDoubleClick={handleEdgeDblClick('n')}
                              onWheel={handleEdgeWheel('n')}
                              onPointerDown={onDownShared}
                              onContextMenu={onCtxShared('n')}
                            />
                            {/* SOUTH edge strip — maps to face 's' */}
                            <mesh
                              geometry={getBox(voxW, 0.1, 0.2)}
                              position={[0, FLOOR_Y, +voxD / 2 - 0.1]}
                              material={mHit}
                              userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: 's' }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredEdge({ idx, face: 's' });
                                onEnterEdge('s')(e);
                              }}
                              onPointerLeave={onLeaveEdge}
                              onClick={onClickEdge('s')}
                              onDoubleClick={handleEdgeDblClick('s')}
                              onWheel={handleEdgeWheel('s')}
                              onPointerDown={onDownShared}
                              onContextMenu={onCtxShared('s')}
                            />
                            {/* EAST edge strip — maps to face 'e' */}
                            <mesh
                              geometry={getBox(0.2, 0.1, voxD)}
                              position={[+voxW / 2 - 0.1, FLOOR_Y, 0]}
                              material={mHit}
                              userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: 'e' }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredEdge({ idx, face: 'e' });
                                onEnterEdge('e')(e);
                              }}
                              onPointerLeave={onLeaveEdge}
                              onClick={onClickEdge('e')}
                              onDoubleClick={handleEdgeDblClick('e')}
                              onWheel={handleEdgeWheel('e')}
                              onPointerDown={onDownShared}
                              onContextMenu={onCtxShared('e')}
                            />
                            {/* WEST edge strip — maps to face 'w' */}
                            <mesh
                              geometry={getBox(0.2, 0.1, voxD)}
                              position={[-voxW / 2 + 0.1, FLOOR_Y, 0]}
                              material={mHit}
                              userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: 'w' }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredEdge({ idx, face: 'w' });
                                onEnterEdge('w')(e);
                              }}
                              onPointerLeave={onLeaveEdge}
                              onClick={onClickEdge('w')}
                              onDoubleClick={handleEdgeDblClick('w')}
                              onWheel={handleEdgeWheel('w')}
                              onPointerDown={onDownShared}
                              onContextMenu={onCtxShared('w')}
                            />
                          </>
                        );
                      })()}

                      {/* ── CEILING HITBOXES ──── */}
                      {/* Center: overhead orbit rays land here → sets face='top' */}
                      {/* Edge strips: low/side-angle rays land here → set wall face at roof level */}
                      {!isWalkthrough && (() => {
                        const CEIL_Y = +vOffset + 0.12; // Same plane as ceiling center for consistent raycasting
                        return (
                          <>
                            {/* Ceiling CENTER — inset 0.2m per side to leave room for ceiling edge strips */}
                            <mesh
                              geometry={getBox(voxW - 0.4, 0.08, voxD - 0.4)}
                              position={[0, +vOffset + 0.12, 0]}
                              material={mHit}
                              userData={{ isBay: true }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredVoxel({ containerId: container.id, index: idx });
                                setHoveredVoxelEdge({ containerId: container.id, voxelIndex: idx, face: 'top' });
                                setFaceContext('roof');
                                document.body.style.cursor = 'pointer';
                              }}
                              onPointerLeave={onLeaveEdge}
                              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (e.nativeEvent.shiftKey) {
                                  useStore.getState().startContainerDrag(container.id);
                                  return;
                                }
                                onClickEdge('top')(e as any);
                              }}
                              onWheel={handleEdgeWheel('top')}
                              onContextMenu={onCtxShared('top')}
                            />
                            {/* NORTH ceiling edge — roof-level wall face 'n' */}
                            <mesh
                              geometry={getBox(voxW, 0.1, 0.2)}
                              position={[0, CEIL_Y, -voxD / 2 + 0.1]}
                              material={mHit}
                              userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: 'n' }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredEdge({ idx, face: 'n' });
                                setHoveredVoxel({ containerId: container.id, index: idx });
                                setHoveredVoxelEdge({ containerId: container.id, voxelIndex: idx, face: 'n' });
                                setFaceContext('roof');
                                document.body.style.cursor = 'pointer';
                              }}
                              onPointerLeave={onLeaveEdge}
                              onClick={onClickEdge('n')}
                              onDoubleClick={handleEdgeDblClick('n')}
                              onWheel={handleEdgeWheel('n')}
                              onPointerDown={onDownShared}
                              onContextMenu={onCtxShared('n')}
                            />
                            {/* SOUTH ceiling edge — roof-level wall face 's' */}
                            <mesh
                              geometry={getBox(voxW, 0.1, 0.2)}
                              position={[0, CEIL_Y, +voxD / 2 - 0.1]}
                              material={mHit}
                              userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: 's' }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredEdge({ idx, face: 's' });
                                setHoveredVoxel({ containerId: container.id, index: idx });
                                setHoveredVoxelEdge({ containerId: container.id, voxelIndex: idx, face: 's' });
                                setFaceContext('roof');
                                document.body.style.cursor = 'pointer';
                              }}
                              onPointerLeave={onLeaveEdge}
                              onClick={onClickEdge('s')}
                              onDoubleClick={handleEdgeDblClick('s')}
                              onWheel={handleEdgeWheel('s')}
                              onPointerDown={onDownShared}
                              onContextMenu={onCtxShared('s')}
                            />
                            {/* EAST ceiling edge — roof-level wall face 'e' */}
                            <mesh
                              geometry={getBox(0.2, 0.1, voxD)}
                              position={[+voxW / 2 - 0.1, CEIL_Y, 0]}
                              material={mHit}
                              userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: 'e' }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredEdge({ idx, face: 'e' });
                                setHoveredVoxel({ containerId: container.id, index: idx });
                                setHoveredVoxelEdge({ containerId: container.id, voxelIndex: idx, face: 'e' });
                                setFaceContext('roof');
                                document.body.style.cursor = 'pointer';
                              }}
                              onPointerLeave={onLeaveEdge}
                              onClick={onClickEdge('e')}
                              onDoubleClick={handleEdgeDblClick('e')}
                              onWheel={handleEdgeWheel('e')}
                              onPointerDown={onDownShared}
                              onContextMenu={onCtxShared('e')}
                            />
                            {/* WEST ceiling edge — roof-level wall face 'w' */}
                            <mesh
                              geometry={getBox(0.2, 0.1, voxD)}
                              position={[-voxW / 2 + 0.1, CEIL_Y, 0]}
                              material={mHit}
                              userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: 'w' }}
                              onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                                e.stopPropagation();
                                if (leaveTimerRef.current) { clearTimeout(leaveTimerRef.current); leaveTimerRef.current = null; }
                                setHoveredEdge({ idx, face: 'w' });
                                setHoveredVoxel({ containerId: container.id, index: idx });
                                setHoveredVoxelEdge({ containerId: container.id, voxelIndex: idx, face: 'w' });
                                setFaceContext('roof');
                                document.body.style.cursor = 'pointer';
                              }}
                              onPointerLeave={onLeaveEdge}
                              onClick={onClickEdge('w')}
                              onDoubleClick={handleEdgeDblClick('w')}
                              onWheel={handleEdgeWheel('w')}
                              onPointerDown={onDownShared}
                              onContextMenu={onCtxShared('w')}
                            />
                          </>
                        );
                      })()}
                    </>
                  )}

                  {/* Structural beams removed — face-only rendering eliminates dark-cage visual */}
                </>
              );
            })()}

            {/* ── Req 4B: FPV full-height voxel hitbox ──
                In walkthrough mode the floor-strip hitboxes are below eye level (1.7m).
                This invisible full-cube hitbox covers the entire voxel volume so the FPV
                raycaster can target any voxel face at eye height. */}
            {isWalkthrough && (
              <mesh
                geometry={getBox(voxW - 0.04, vHeight - 0.04, voxD - 0.04)}
                material={mHit}
                userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: null }}
                onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  setHoveredVoxel({ containerId: container.id, index: idx });
                }}
                onPointerLeave={() => {
                  if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
                  leaveTimerRef.current = setTimeout(() => {
                    setHoveredVoxel(null);
                    leaveTimerRef.current = null;
                  }, 250);
                }}
              />
            )}

            {/* WU-7C: FPV ceiling hitbox — inside ceiling volume so upward crosshair rays hit it.
                The 3D ceiling hitbox is guarded by !isWalkthrough. This one activates in FPV mode.
                Position: vOffset-0.12 in local space = 0.12m below the ceiling surface.
                Interaction (click) is handled by WalkthroughControls crosshair via userData. */}
            {isWalkthrough && (
              <mesh
                geometry={getBox(voxW - 0.04, 0.08, voxD - 0.04)}
                position={[0, vOffset - 0.12, 0]}
                material={mHit}
                userData={{ isBay: true, containerId: container.id, voxelIndex: idx, face: 'top' }}
                onPointerEnter={(e: ThreeEvent<PointerEvent>) => {
                  e.stopPropagation();
                  setHoveredVoxel({ containerId: container.id, index: idx });
                  setHoveredVoxelEdge({ containerId: container.id, voxelIndex: idx, face: 'top' });
                  setFaceContext('roof');
                }}
                onPointerLeave={() => {
                  setHoveredVoxel(null);
                  setHoveredVoxelEdge(null);
                  setFaceContext(null);
                }}
              />
            )}

            {/* ★ Phase 1 Atomic: Ghost hologram on active voxel hover when stamp is active */}
            {isVoxelHovered && stampFaces && (
              <FlushGhostPreview
                faces={stampFaces}
                colPitch={voxW}
                rowPitch={voxD}
                vHeight={vHeight}
                isValid={!lockedVoxels[`${container.id}_${idx}`]}
              />
            )}


            {/* Debug coordinate label */}
            {debug && (
              <Text
                position={[0, vOffset + 0.15, 0]}
                fontSize={0.18}
                color="#ffff00"
                anchorX="center"
                anchorY="bottom"
                renderOrder={1000}
                material-depthWrite={false}
              >
                {`[c${col},r${row}]`}
              </Text>
            )}

            {/* Hover/selection edge outline moved to standalone VoxelHoverHighlight in ContainerMesh.tsx
                for reliable re-rendering independent of the large ContainerSkin component. */}
          </group>
        );
      })}

      {/* WU-10: Structural pillars at convex outer corners of active voxels */}
      {pillarPositions.map(({ px, pz }, i) => (
        <mesh
          key={`pillar_${i}`}
          position={[px, vOffset, pz]}
          geometry={getCyl(PILLAR_R, vHeight)}
          material={mFrame}
          castShadow
          raycast={nullRaycast}
        />
      ))}

      {/* Pool water plane — rendered when container has pool voxel grid pattern */}
      {(() => {
        // Detect pool: all active core voxels have Open top + Concrete on other faces
        const coreVoxels = allLevel0.filter(({ col, row }) => {
          const isHC = col === 0 || col === VOXEL_COLS - 1;
          const isHR = row === 0 || row === VOXEL_ROWS - 1;
          return !isHC && !isHR;
        });
        const isPool = coreVoxels.length > 0 && coreVoxels.every(({ idx }) => {
          const v = grid[idx];
          return v?.active && v.faces.top === 'Open' && v.faces.bottom === 'Concrete';
        });
        if (!isPool) return null;
        return <WaterPlane dims={dims} />;
      })()}
    </group>
  );
}
