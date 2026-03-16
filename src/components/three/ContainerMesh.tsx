"use client";

import React, { useRef, useState, useEffect, useMemo, useCallback, useReducer } from "react";
import * as THREE from "three";
import { useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { Html, Text, useGLTF } from "@react-three/drei";
import { createSelectionGlowMaterial } from "./materials/SelectionGlow";
import ContainerSkin, { getVoxelLayout } from "@/components/objects/ContainerSkin";
import { detectOverlappingEdges } from "@/utils/edgeDetection";
import { RAYCAST_LAYERS } from "@/utils/raycastLayers";
import {
  type Container,
  type FloorMaterialType,
  CONTAINER_DIMENSIONS,
  LONG_WALL_BAYS,
  WallSide,
  ModuleType,
  ViewMode,
  type WallConfig,
  type BaySlot,
  type HingedWall as HingedWallType,
  type PanelSolid as PanelSolidType,
  type WallModule,
  type FurnitureItem,
  FURNITURE_CATALOG,
  FurnitureType,
  VOXEL_COLS,
} from "@/types/container";
import { useStore } from "@/store/useStore";

// ── Raycast nuke helper ─────────────────────────────────────
const nullRaycast = () => {};

// ═══════════════════════════════════════════════════════════════
// PROCEDURAL CORRUGATION NORMAL MAP
// ═══════════════════════════════════════════════════════════════

function generateCorrugationNormalMap(
  width = 256,
  height = 64,
  ribCount = 12,
  strength = 0.7
): THREE.DataTexture {
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      // Sine wave across U — creates vertical corrugation ribs
      const phase = u * ribCount * Math.PI * 2;
      const dx = Math.cos(phase) * strength; // derivative of sin = cos

      // Normal in tangent space: (dx, dy, 1) normalized
      // dx = perturbation in X, dy = 0 (ribs are vertical)
      const nx = dx;
      const ny = 0;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

      const i = (y * width + x) * 4;
      data[i + 0] = Math.round(((nx / len) * 0.5 + 0.5) * 255); // R = X
      data[i + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255); // G = Y
      data[i + 2] = Math.round(((nz / len) * 0.5 + 0.5) * 255); // B = Z
      data[i + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

const corrugationNormal = generateCorrugationNormalMap(256, 64, 12, 0.6);
// Tile: 3 reps across a bay (1.5m), 1 rep vertically
corrugationNormal.repeat.set(3, 1);

// ═══════════════════════════════════════════════════════════════
// MATERIALS — Production Quality PBR
// ═══════════════════════════════════════════════════════════════

// Phase 8: Corrugated steel — High metalness catches HDRI highlights
const steelExterior = new THREE.MeshStandardMaterial({
  color: 0x8a9199,
  metalness: 0.85,
  roughness: 0.30,
  normalMap: corrugationNormal,
  normalScale: new THREE.Vector2(1.0, 1.0),
  envMapIntensity: 0.6,
});

const steelDark = new THREE.MeshStandardMaterial({
  color: 0x6b7580,
  metalness: 0.85,
  roughness: 0.35,
  envMapIntensity: 0.5,
});

// Interior: Warm plywood
const interiorWood = new THREE.MeshStandardMaterial({
  color: 0xb8845a,
  metalness: 0.02,
  roughness: 0.78,
});

// Phase 8: Deck surface — Warm matte wood
const deckWalkSurface = new THREE.MeshStandardMaterial({
  color: 0x9c6b30,
  metalness: 0.0,
  roughness: 0.90,
});

// Phase 8: Refractive glass — full transmission, physically accurate
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0xe0f2fe,
  metalness: 0.0,
  roughness: 0.05,
  transmission: 1,
  thickness: 0.1,
  ior: 1.5,
  transparent: true,
  envMapIntensity: 1.0,
  specularIntensity: 1.0,
});

// Mullion / window frame material (dark aluminium)
const mullionMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a,
  metalness: 0.85,
  roughness: 0.2,
});

// Phase 8: Window frame / corner posts — catches HDRI highlights
const frameMat = new THREE.MeshStandardMaterial({
  color: 0x3d4a55,
  metalness: 0.90,
  roughness: 0.20,
  envMapIntensity: 0.8,
});
// Ghost material for hidden frame elements — cyan transparent, always clickable
const frameGhostMat = new THREE.MeshBasicMaterial({
  color: 0x00bcd4, transparent: true, opacity: 0,
  side: THREE.DoubleSide, depthWrite: false,
});
// Permanent hitbox for hidden frame elements — invisible but raycastable
const frameHitMat = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0.001, colorWrite: false, depthWrite: false,
  side: THREE.DoubleSide,
});

// Phase 8: Hinge exterior — matches upgraded steel PBR
const hingeExterior = new THREE.MeshStandardMaterial({
  color: 0x8a9199,
  metalness: 0.85,
  roughness: 0.30,
  normalMap: corrugationNormal,
  normalScale: new THREE.Vector2(0.6, 0.6),
  envMapIntensity: 0.6,
});

// Awning underside — light
const awningUnderside = new THREE.MeshStandardMaterial({
  color: 0xcccccc,
  metalness: 0.15,
  roughness: 0.6,
});

// Phase 8: Railing — dark metal, catches HDRI highlights
const railingMat = new THREE.MeshStandardMaterial({
  color: 0x2a2a2a,
  metalness: 0.90,
  roughness: 0.20,
  envMapIntensity: 0.8,
});

// Phase 8: Roof — corrugated, high metalness for HDRI
const roofMat = new THREE.MeshStandardMaterial({
  color: 0x727d87,
  metalness: 0.85,
  roughness: 0.32,
  normalMap: corrugationNormal,
  normalScale: new THREE.Vector2(0.8, 0.8),
});

// Wood panel materials for wall cladding
const woodPanelLight = new THREE.MeshStandardMaterial({
  color: 0xc4956a,
  metalness: 0.02,
  roughness: 0.82,
});

const woodPanelDark = new THREE.MeshStandardMaterial({
  color: 0x6d4c2a,
  metalness: 0.02,
  roughness: 0.85,
});

const woodPanelCedar = new THREE.MeshStandardMaterial({
  color: 0x9e5e3a,
  metalness: 0.02,
  roughness: 0.80,
});

// Transparent hit-test material — visible to raycaster but invisible on screen
const hitTestMat = new THREE.MeshBasicMaterial({
  transparent: true,
  opacity: 0.001,
  depthWrite: false,
  side: THREE.DoubleSide,
});


// Named wood materials lookup
const woodMaterials: Record<string, THREE.MeshStandardMaterial> = {
  'wood:light': woodPanelLight,
  'wood:dark': woodPanelDark,
  'wood:cedar': woodPanelCedar,
};

// Colored steel material cache (for custom panel colors)
const coloredSteelCache = new Map<string, THREE.MeshStandardMaterial>();
function getPanelMaterial(colorOrType: string): THREE.MeshStandardMaterial {
  // Check wood materials first
  if (woodMaterials[colorOrType]) return woodMaterials[colorOrType];

  // Colored steel with corrugation
  if (!coloredSteelCache.has(colorOrType)) {
    coloredSteelCache.set(colorOrType, new THREE.MeshStandardMaterial({
      color: colorOrType,
      metalness: 0.65,
      roughness: 0.40,
      normalMap: corrugationNormal,
      normalScale: new THREE.Vector2(1.0, 1.0),
    }));
  }
  return coloredSteelCache.get(colorOrType)!;
}
// Legacy alias
const getColoredSteel = getPanelMaterial;

// Floor material variants
const concreteMat = new THREE.MeshStandardMaterial({ color: 0xbdbdbd, metalness: 0.05, roughness: 0.85 });
const tileWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, metalness: 0.1, roughness: 0.3 });
const tileDarkMat = new THREE.MeshStandardMaterial({ color: 0x616161, metalness: 0.1, roughness: 0.35 });
const steelFloorMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, metalness: 0.7, roughness: 0.35 });
const bambooMat = new THREE.MeshStandardMaterial({ color: 0xa0c080, metalness: 0.02, roughness: 0.75 });

function getFloorMaterial(fm: FloorMaterialType | undefined): THREE.MeshStandardMaterial {
  switch (fm) {
    case 'wood:light': return woodPanelLight;
    case 'wood:cedar': return woodPanelCedar;
    case 'wood:dark': return woodPanelDark;
    case 'concrete': return concreteMat;
    case 'tile:white': return tileWhiteMat;
    case 'tile:dark': return tileDarkMat;
    case 'steel': return steelFloorMat;
    case 'bamboo': return bambooMat;
    default: return interiorWood;
  }
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════

const BAY_WIDTH = 1.5;
const HINGE_RADIUS = 0.035;
const PANEL_THICKNESS = 0.06;
const ANIM_SPEED = 1.2;

// ═══════════════════════════════════════════════════════════════
// ANIMATED HINGE PIVOT — Spring-like interpolation at 60fps
// ═══════════════════════════════════════════════════════════════

function AnimatedHingePivot({
  targetAngle,
  pivotY,
  children,
}: {
  targetAngle: number;
  pivotY: number;
  children: React.ReactNode;
}) {
  const pivotRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!pivotRef.current) return;
    const current = pivotRef.current.rotation.x;
    const diff = targetAngle - current;
    if (Math.abs(diff) < 0.0005) {
      pivotRef.current.rotation.x = targetAngle;
      return;
    }
    // Spring-like: fast start, soft deceleration
    const spring = 1 - Math.exp(-ANIM_SPEED * delta * 8);
    pivotRef.current.rotation.x += diff * spring;
  });

  return (
    <group position={[0, pivotY, 0]}>
      <group ref={pivotRef}>
        <group position={[0, -pivotY, 0]}>{children}</group>
      </group>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// DOUBLE-SIDED PANEL
// ═══════════════════════════════════════════════════════════════

function DoubleSidedPanel({
  width,
  height,
  exteriorMat,
  interiorMat,
}: {
  width: number;
  height: number;
  exteriorMat: THREE.Material;
  interiorMat: THREE.Material;
}) {
  // -Z = exterior (faces outward from container), +Z = interior (faces into container)
  return (
    <group>
      <mesh position={[0, 0, -PANEL_THICKNESS / 2]} rotation={[0, Math.PI, 0]} material={exteriorMat} castShadow receiveShadow>
        <planeGeometry args={[width, height]} />
      </mesh>
      <mesh position={[0, 0, PANEL_THICKNESS / 2]} material={interiorMat} castShadow receiveShadow>
        <planeGeometry args={[width, height]} />
      </mesh>
      <mesh material={exteriorMat} castShadow>
        <boxGeometry args={[width, height, PANEL_THICKNESS]} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// HINGED BAY — FOLD DOWN (becomes deck/floor)
// ═══════════════════════════════════════════════════════════════

const RAILING_HEIGHT = 1.0;
const RAILING_POST_RADIUS = 0.04;
const RAILING_RAIL_RADIUS = 0.03;

const COLUMN_SIZE = 0.12;

// ── Interactive Edge — clickable outer wall / side panel in deployed decks ──

const OUTER_WALL_CYCLE: Array<'railing' | 'glass' | 'solid' | 'closet' | 'none'> =
  ['railing', 'glass', 'solid', 'closet', 'none'];

function InteractiveRailingEdge({
  position, size, containerId, wallSide, bayIndex, target,
}: {
  position: [number, number, number];
  size: [number, number, number];
  containerId?: string;
  wallSide?: WallSide;
  bayIndex?: number;
  target: 'outer' | 'side';
}) {
  const setOuterWallType = useStore((s) => s.setOuterWallType);
  const setSideWallType = useStore((s) => s.setSideWallType);
  const [hovered, setHovered] = useState(false);
  const glowRef = useRef(0);
  const glowMeshRef = useRef<THREE.Mesh>(null);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: target === 'outer' ? 0x4fc3f7 : 0x81d4fa,
    transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide,
  }), [target]);

  useFrame((_, delta) => {
    if (hovered) {
      glowRef.current = Math.min(1, glowRef.current + delta * 10);
    } else if (glowRef.current > 0) {
      glowRef.current = Math.max(0, glowRef.current - delta * 2.5);
    }
    glowMat.opacity = glowRef.current * 0.3;
    if (glowMeshRef.current) {
      glowMeshRef.current.visible = glowRef.current > 0.01;
    }
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!containerId || wallSide === undefined || bayIndex === undefined) return;
    const store = useStore.getState();
    const container = store.containers[containerId];
    if (!container) return;
    const bay = container.walls[wallSide].bays[bayIndex];
    if (!bay || bay.module.type !== ModuleType.HingedWall) return;

    if (target === 'outer') {
      const current = bay.module.outerWall ?? 'railing';
      const idx = OUTER_WALL_CYCLE.indexOf(current);
      const next = OUTER_WALL_CYCLE[(idx + 1) % OUTER_WALL_CYCLE.length];
      setOuterWallType(containerId, wallSide, bayIndex, next);
    } else {
      const current = bay.module.sideWall ?? bay.module.outerWall ?? 'railing';
      const idx = OUTER_WALL_CYCLE.indexOf(current);
      const next = OUTER_WALL_CYCLE[(idx + 1) % OUTER_WALL_CYCLE.length];
      setSideWallType(containerId, wallSide, bayIndex, next);
    }
  }, [containerId, wallSide, bayIndex, target, setOuterWallType, setSideWallType]);

  return (
    <group>
      <mesh
        material={hitTestMat}
        position={position}
        onClick={handleClick}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        userData={containerId ? { isRailing: true, containerId, wallSide, bayIndex } : undefined}
      >
        <boxGeometry args={size} />
      </mesh>
      <mesh ref={glowMeshRef} material={glowMat} position={position} visible={false}>
        <boxGeometry args={[size[0] + 0.02, size[1] + 0.02, size[2] + 0.02]} />
      </mesh>
    </group>
  );
}

// ── Interactive Extension Overlay — hover/click on deployed deck or awning surface ──

function InteractiveExtensionOverlay({
  bayWidth, depth, baseY, outwardSign, kind,
  containerId, wallSide, bayIndex,
}: {
  bayWidth: number; depth: number; baseY: number; outwardSign: number;
  kind: 'deck' | 'awning';
  containerId?: string; wallSide?: WallSide; bayIndex?: number;
}) {
  const toggleBayOpen = useStore((s) => s.toggleBayOpen);
  const openBayContextMenu = useStore((s) => s.openBayContextMenu);
  const [hovered, setHovered] = useState(false);
  const glowRef = useRef(0.05); // idle glow so deployed decks are visibly interactive
  const glowMeshRef = useRef<THREE.Mesh>(null);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: kind === 'deck' ? 0x66bb6a : 0xffa726,
    transparent: true, opacity: 0.05, depthTest: false, side: THREE.DoubleSide,
  }), [kind]);

  useFrame((_, delta) => {
    const target = hovered ? 1 : 0.05; // idle glow baseline
    if (glowRef.current < target) {
      glowRef.current = Math.min(target, glowRef.current + delta * 10);
    } else if (glowRef.current > target) {
      glowRef.current = Math.max(target, glowRef.current - delta * 2.5);
    }
    glowMat.opacity = glowRef.current * 0.4;
    if (glowMeshRef.current) {
      glowMeshRef.current.visible = true; // always visible (idle glow)
    }
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!containerId || wallSide === undefined || bayIndex === undefined) return;
    // Left-click = toggle open/close (no menu)
    toggleBayOpen(containerId, wallSide, bayIndex);
  }, [containerId, wallSide, bayIndex, toggleBayOpen]);

  const handleContextMenu = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    if (!containerId || wallSide === undefined || bayIndex === undefined) return;
    // Right-click = open fan menu at cursor
    openBayContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, containerId, wallSide, bayIndex);
  }, [containerId, wallSide, bayIndex, openBayContextMenu]);

  const outerZ = outwardSign * depth;
  const midZ = outerZ / 2;

  return (
    <group>
      <mesh
        material={hitTestMat}
        position={[0, baseY + 0.10, midZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
        userData={containerId ? { isBay: true, containerId, wallSide, bayIndex, moduleType: ModuleType.HingedWall } : undefined}
      >
        <planeGeometry args={[bayWidth, Math.abs(depth)]} />
      </mesh>
      <mesh ref={glowMeshRef} material={glowMat} position={[0, baseY + 0.05, midZ]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[bayWidth + 0.02, Math.abs(depth) + 0.02]} />
      </mesh>
    </group>
  );
}

function DeckRailing({
  bayWidth, deckDepth, baseY, outwardSign, panelHeight,
  outerWall = 'railing' as const,
  sideWall,
  bayIndex = 0, bayCount = 1,
  containerId, wallSide,
  adjacentDeckAtFirst = false, adjacentDeckAtLast = false,
}: {
  bayWidth: number; deckDepth: number; baseY: number; outwardSign: number; panelHeight: number;
  outerWall?: 'railing' | 'glass' | 'solid' | 'closet' | 'none';
  sideWall?: 'railing' | 'glass' | 'solid' | 'closet' | 'none';
  bayIndex?: number; bayCount?: number;
  containerId?: string; wallSide?: WallSide;
  adjacentDeckAtFirst?: boolean; adjacentDeckAtLast?: boolean;
}) {
  // Side edges default to outerWall if not specified
  const effectiveSideWall = sideWall ?? outerWall;
  if (outerWall === 'none' && effectiveSideWall === 'none') return null;

  const outerZ = outwardSign * deckDepth;
  const midZ = outerZ / 2;
  const halfW = bayWidth / 2;
  // Structural columns: every 4 bays for glass/solid/closet, first + last always
  const isFirstBay = bayIndex === 0;
  const isLastBay = bayIndex === bayCount - 1;
  const showLeftCol = isFirstBay || bayIndex % 4 === 0;
  const showRightCol = isLastBay;
  // Suppress side panels when adjacent wall also has a deployed deck (corner piece fills the gap)
  const showFirstSide = isFirstBay && !adjacentDeckAtFirst;
  const showLastSide = isLastBay && !adjacentDeckAtLast;

  // Full-height structural columns (only for glass/solid/closet — railing uses short posts)
  const columnElements = outerWall !== 'railing' ? (
    <>
      {showLeftCol && (
        <mesh position={[-halfW, baseY + panelHeight / 2, outerZ]} material={frameMat} castShadow>
          <boxGeometry args={[COLUMN_SIZE, panelHeight, COLUMN_SIZE]} />
        </mesh>
      )}
      {showRightCol && (
        <mesh position={[halfW, baseY + panelHeight / 2, outerZ]} material={frameMat} castShadow>
          <boxGeometry args={[COLUMN_SIZE, panelHeight, COLUMN_SIZE]} />
        </mesh>
      )}
      <mesh position={[0, baseY + panelHeight, outerZ]} material={frameMat} castShadow>
        <boxGeometry args={[bayWidth, 0.06, 0.06]} />
      </mesh>
    </>
  ) : null;

  // Helper: render a side panel based on wall type
  const renderSidePanel = (xPos: number, wallType: typeof outerWall) => {
    if (wallType === 'none') return null;
    if (wallType === 'glass') {
      return (
        <group>
          <mesh position={[xPos, baseY + panelHeight / 2, midZ]} material={glassMat}>
            <boxGeometry args={[0.015, panelHeight - 0.14, deckDepth - 0.04]} />
          </mesh>
          {/* Mullion frame edges */}
          <mesh position={[xPos, baseY + 0.03, midZ]} material={mullionMat}>
            <boxGeometry args={[0.04, 0.04, deckDepth]} />
          </mesh>
          <mesh position={[xPos, baseY + panelHeight - 0.03, midZ]} material={mullionMat}>
            <boxGeometry args={[0.04, 0.04, deckDepth]} />
          </mesh>
        </group>
      );
    }
    if (wallType === 'solid' || wallType === 'closet') {
      return (
        <mesh position={[xPos, baseY + panelHeight / 2, midZ]} material={steelExterior} castShadow>
          <boxGeometry args={[PANEL_THICKNESS, panelHeight, deckDepth]} />
        </mesh>
      );
    }
    // railing
    return (
      <group>
        <mesh position={[xPos, baseY + RAILING_HEIGHT, midZ]} rotation={[Math.PI / 2, 0, 0]} material={railingMat}>
          <cylinderGeometry args={[RAILING_RAIL_RADIUS, RAILING_RAIL_RADIUS, deckDepth, 8]} />
        </mesh>
        <mesh position={[xPos, baseY + RAILING_HEIGHT * 0.5, midZ]} rotation={[Math.PI / 2, 0, 0]} material={railingMat}>
          <cylinderGeometry args={[RAILING_RAIL_RADIUS, RAILING_RAIL_RADIUS, deckDepth, 8]} />
        </mesh>
      </group>
    );
  };

  // Closet: full-height enclosed space with side walls + roof
  if (outerWall === 'closet') {
    return (
      <group>
        {columnElements}
        <mesh position={[0, baseY + panelHeight / 2, outerZ]} material={steelExterior} castShadow>
          <boxGeometry args={[bayWidth - 0.08, panelHeight, PANEL_THICKNESS]} />
        </mesh>
        {showFirstSide && renderSidePanel(-halfW, effectiveSideWall)}
        {showLastSide && renderSidePanel(halfW, effectiveSideWall)}
        <mesh position={[0, baseY + panelHeight, midZ]} material={roofMat} castShadow receiveShadow>
          <boxGeometry args={[bayWidth - 0.04, 0.04, deckDepth + 0.04]} />
        </mesh>
        <InteractiveRailingEdge
          position={[0, baseY + panelHeight / 2, outerZ]}
          size={[bayWidth, panelHeight, 0.15]}
          containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} target="outer"
        />
      </group>
    );
  }

  // Glass: full floor-to-ceiling glass wall with frame columns
  if (outerWall === 'glass') {
    return (
      <group>
        {columnElements}
        <mesh position={[0, baseY + panelHeight / 2, outerZ]} material={glassMat}>
          <boxGeometry args={[bayWidth, panelHeight - 0.14, 0.015]} />
        </mesh>
        <mesh position={[0, baseY + 0.03, outerZ]} material={frameMat}>
          <boxGeometry args={[bayWidth, 0.06, 0.06]} />
        </mesh>
        {showFirstSide && renderSidePanel(-halfW, effectiveSideWall)}
        {showLastSide && renderSidePanel(halfW, effectiveSideWall)}
        <InteractiveRailingEdge
          position={[0, baseY + panelHeight / 2, outerZ]}
          size={[bayWidth, panelHeight, 0.15]}
          containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} target="outer"
        />
      </group>
    );
  }

  // Solid: full-height solid wall
  if (outerWall === 'solid') {
    return (
      <group>
        {columnElements}
        <mesh position={[0, baseY + panelHeight / 2, outerZ]} material={steelExterior} castShadow>
          <boxGeometry args={[bayWidth, panelHeight, PANEL_THICKNESS]} />
        </mesh>
        {showFirstSide && renderSidePanel(-halfW, effectiveSideWall)}
        {showLastSide && renderSidePanel(halfW, effectiveSideWall)}
        <InteractiveRailingEdge
          position={[0, baseY + panelHeight / 2, outerZ]}
          size={[bayWidth, panelHeight, 0.15]}
          containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} target="outer"
        />
      </group>
    );
  }

  // Default: 'railing' — railing-height posts + rails, no full-height columns
  return (
    <group>
      {/* Railing-height posts at bay edges (first + last always, every 4 bays) */}
      {showLeftCol && (
        <mesh position={[-halfW, baseY + RAILING_HEIGHT / 2, outerZ]} material={railingMat}>
          <cylinderGeometry args={[RAILING_POST_RADIUS, RAILING_POST_RADIUS, RAILING_HEIGHT, 8]} />
        </mesh>
      )}
      {showRightCol && (
        <mesh position={[halfW, baseY + RAILING_HEIGHT / 2, outerZ]} material={railingMat}>
          <cylinderGeometry args={[RAILING_POST_RADIUS, RAILING_POST_RADIUS, RAILING_HEIGHT, 8]} />
        </mesh>
      )}
      {/* Center post */}
      <mesh position={[0, baseY + RAILING_HEIGHT / 2, outerZ]} material={railingMat}>
        <cylinderGeometry args={[RAILING_POST_RADIUS, RAILING_POST_RADIUS, RAILING_HEIGHT, 8]} />
      </mesh>
      {/* Horizontal rails */}
      <mesh position={[0, baseY + RAILING_HEIGHT, outerZ]} rotation={[0, 0, Math.PI / 2]} material={railingMat}>
        <cylinderGeometry args={[RAILING_RAIL_RADIUS, RAILING_RAIL_RADIUS, bayWidth, 8]} />
      </mesh>
      <mesh position={[0, baseY + RAILING_HEIGHT * 0.5, outerZ]} rotation={[0, 0, Math.PI / 2]} material={railingMat}>
        <cylinderGeometry args={[RAILING_RAIL_RADIUS, RAILING_RAIL_RADIUS, bayWidth, 8]} />
      </mesh>
      <mesh position={[0, baseY + RAILING_HEIGHT * 0.15, outerZ]} rotation={[0, 0, Math.PI / 2]} material={railingMat}>
        <cylinderGeometry args={[RAILING_RAIL_RADIUS * 0.7, RAILING_RAIL_RADIUS * 0.7, bayWidth, 8]} />
      </mesh>
      {showFirstSide && renderSidePanel(-halfW, effectiveSideWall)}
      {showLastSide && renderSidePanel(halfW, effectiveSideWall)}
      <InteractiveRailingEdge
        position={[0, baseY + RAILING_HEIGHT / 2, outerZ]}
        size={[bayWidth, RAILING_HEIGHT, 0.15]}
        containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} target="outer"
      />
    </group>
  );
}

function HingedBayFoldDown({
  mod, wallHeight, bayWidth, foldFlip = false,
  containerId, wallSide, bayIndex, bayCount = 1,
  adjacentDeckAtFirst = false, adjacentDeckAtLast = false,
}: {
  mod: HingedWallType; wallHeight: number; bayWidth: number; foldFlip?: boolean;
  containerId?: string; wallSide?: WallSide; bayIndex?: number; bayCount?: number;
  adjacentDeckAtFirst?: boolean; adjacentDeckAtLast?: boolean;
}) {
  const targetAngle = mod.openAmount * (-Math.PI / 2) * (foldFlip ? -1 : 1);
  const outwardSign = foldFlip ? 1 : -1;

  return (
    <>
      <mesh position={[0, -wallHeight / 2, 0]} rotation={[0, 0, Math.PI / 2]} material={frameMat}>
        <cylinderGeometry args={[HINGE_RADIUS, HINGE_RADIUS, bayWidth - 0.08, 8]} />
      </mesh>
      <AnimatedHingePivot targetAngle={targetAngle} pivotY={-wallHeight / 2}>
        <group rotation={foldFlip ? [0, Math.PI, 0] : [0, 0, 0]}>
          <DoubleSidedPanel width={bayWidth} height={wallHeight} exteriorMat={hingeExterior} interiorMat={deckWalkSurface} />
        </group>
      </AnimatedHingePivot>
      {mod.openAmount > 0.5 && (
        <>
          <DeckRailing bayWidth={bayWidth} deckDepth={wallHeight} baseY={-wallHeight / 2}
            outwardSign={outwardSign} panelHeight={wallHeight} outerWall={mod.outerWall}
            sideWall={mod.sideWall}
            bayIndex={bayIndex} bayCount={bayCount}
            containerId={containerId} wallSide={wallSide}
            adjacentDeckAtFirst={adjacentDeckAtFirst} adjacentDeckAtLast={adjacentDeckAtLast} />
          <InteractiveExtensionOverlay bayWidth={bayWidth} depth={wallHeight}
            baseY={-wallHeight / 2} outwardSign={outwardSign} kind="deck"
            containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} />
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// HINGED BAY — FOLD UP (awning)
// ═══════════════════════════════════════════════════════════════

function HingedBayFoldUp({
  mod, wallHeight, bayWidth, foldFlip = false,
  containerId, wallSide, bayIndex, bayCount = 1,
  adjacentDeckAtFirst = false, adjacentDeckAtLast = false,
}: {
  mod: HingedWallType; wallHeight: number; bayWidth: number; foldFlip?: boolean;
  containerId?: string; wallSide?: WallSide; bayIndex?: number; bayCount?: number;
  adjacentDeckAtFirst?: boolean; adjacentDeckAtLast?: boolean;
}) {
  const targetAngle = mod.openAmount * (Math.PI / 2) * (foldFlip ? -1 : 1);
  const outwardSign = foldFlip ? 1 : -1;

  return (
    <>
      <mesh position={[0, wallHeight / 2, 0]} rotation={[0, 0, Math.PI / 2]} material={frameMat}>
        <cylinderGeometry args={[HINGE_RADIUS, HINGE_RADIUS, bayWidth - 0.08, 8]} />
      </mesh>
      <AnimatedHingePivot targetAngle={targetAngle} pivotY={wallHeight / 2}>
        <group rotation={foldFlip ? [0, Math.PI, 0] : [0, 0, 0]}>
          <DoubleSidedPanel width={bayWidth} height={wallHeight} exteriorMat={hingeExterior} interiorMat={awningUnderside} />
        </group>
      </AnimatedHingePivot>
      {mod.openAmount > 0.5 && (
        <>
          <AwningSupports bayWidth={bayWidth} awningDepth={wallHeight}
            floorY={-wallHeight / 2} ceilingY={wallHeight / 2} outwardSign={outwardSign}
            bayIndex={bayIndex} bayCount={bayCount} />
          <InteractiveExtensionOverlay bayWidth={bayWidth} depth={wallHeight}
            baseY={wallHeight / 2} outwardSign={outwardSign} kind="awning"
            containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} />
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// AWNING SUPPORT PILLARS
// ═══════════════════════════════════════════════════════════════

function AwningSupports({
  bayWidth, awningDepth, floorY, ceilingY, outwardSign,
  bayIndex = 0, bayCount = 1,
}: {
  bayWidth: number; awningDepth: number; floorY: number; ceilingY: number; outwardSign: number;
  bayIndex?: number; bayCount?: number;
}) {
  const halfW = bayWidth / 2;
  const outerZ = outwardSign * awningDepth;
  const pillarH = ceilingY - floorY;
  // Structural columns every 4 bays + at wall ends
  const showLeftCol = bayIndex === 0 || bayIndex % 4 === 0;
  const showRightCol = bayIndex === bayCount - 1;

  return (
    <group>
      {showLeftCol && (
        <mesh position={[-halfW, floorY + pillarH / 2, outerZ]} material={frameMat} castShadow>
          <boxGeometry args={[COLUMN_SIZE, pillarH, COLUMN_SIZE]} />
        </mesh>
      )}
      {showRightCol && (
        <mesh position={[halfW, floorY + pillarH / 2, outerZ]} material={frameMat} castShadow>
          <boxGeometry args={[COLUMN_SIZE, pillarH, COLUMN_SIZE]} />
        </mesh>
      )}
      <mesh position={[0, ceilingY, outerZ]} material={frameMat} castShadow>
        <boxGeometry args={[bayWidth, 0.06, 0.06]} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// HINGED BAY — GULL WING
// ═══════════════════════════════════════════════════════════════

function HingedBayGullWing({
  mod, wallHeight, bayWidth, foldFlip = false,
  containerId, wallSide, bayIndex, bayCount = 1,
  adjacentDeckAtFirst = false, adjacentDeckAtLast = false,
}: {
  mod: HingedWallType; wallHeight: number; bayWidth: number; foldFlip?: boolean;
  containerId?: string; wallSide?: WallSide; bayIndex?: number; bayCount?: number;
  adjacentDeckAtFirst?: boolean; adjacentDeckAtLast?: boolean;
}) {
  const halfH = wallHeight / 2;
  const flipMul = foldFlip ? -1 : 1;
  const downAngle = mod.openAmount * (-Math.PI / 2) * flipMul;
  const upAngle = mod.openAmount * (Math.PI / 2) * flipMul;
  const outwardSign = foldFlip ? 1 : -1;

  return (
    <>
      <mesh position={[0, 0, 0]} material={frameMat}>
        <boxGeometry args={[bayWidth - 0.04, 0.04, PANEL_THICKNESS + 0.02]} />
      </mesh>
      <mesh position={[0, -halfH, 0]} rotation={[0, 0, Math.PI / 2]} material={frameMat}>
        <cylinderGeometry args={[HINGE_RADIUS, HINGE_RADIUS, bayWidth - 0.08, 8]} />
      </mesh>
      <mesh position={[0, halfH, 0]} rotation={[0, 0, Math.PI / 2]} material={frameMat}>
        <cylinderGeometry args={[HINGE_RADIUS, HINGE_RADIUS, bayWidth - 0.08, 8]} />
      </mesh>

      <AnimatedHingePivot targetAngle={downAngle} pivotY={-halfH}>
        <group position={[0, -halfH / 2, 0]}>
          <group rotation={foldFlip ? [0, Math.PI, 0] : [0, 0, 0]}>
            <DoubleSidedPanel width={bayWidth} height={halfH - 0.02} exteriorMat={hingeExterior} interiorMat={deckWalkSurface} />
          </group>
        </group>
      </AnimatedHingePivot>

      <AnimatedHingePivot targetAngle={upAngle} pivotY={halfH}>
        <group position={[0, halfH / 2, 0]}>
          <group rotation={foldFlip ? [0, Math.PI, 0] : [0, 0, 0]}>
            <DoubleSidedPanel width={bayWidth} height={halfH - 0.02} exteriorMat={hingeExterior} interiorMat={awningUnderside} />
          </group>
        </group>
      </AnimatedHingePivot>

      {mod.openAmount > 0.5 && (
        <>
          <DeckRailing bayWidth={bayWidth} deckDepth={halfH} baseY={-halfH}
            outwardSign={outwardSign} panelHeight={wallHeight} outerWall={mod.outerWall}
            sideWall={mod.sideWall}
            bayIndex={bayIndex} bayCount={bayCount}
            containerId={containerId} wallSide={wallSide}
            adjacentDeckAtFirst={adjacentDeckAtFirst} adjacentDeckAtLast={adjacentDeckAtLast} />
          <InteractiveExtensionOverlay bayWidth={bayWidth} depth={halfH}
            baseY={-halfH} outwardSign={outwardSign} kind="deck"
            containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} />
          <AwningSupports bayWidth={bayWidth} awningDepth={halfH}
            floorY={-halfH} ceilingY={halfH} outwardSign={outwardSign}
            bayIndex={bayIndex} bayCount={bayCount} />
          <InteractiveExtensionOverlay bayWidth={bayWidth} depth={halfH}
            baseY={halfH} outwardSign={outwardSign} kind="awning"
            containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} />
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// HINGED BAY — FULL GULL WING (full-height leaves fold both ways)
// ═══════════════════════════════════════════════════════════════

function HingedBayFullGull({
  mod,
  wallHeight,
  bayWidth,
  foldFlip = false,
  containerId, wallSide, bayIndex, bayCount = 1,
  adjacentDeckAtFirst = false, adjacentDeckAtLast = false,
}: {
  mod: HingedWallType; wallHeight: number; bayWidth: number; foldFlip?: boolean;
  containerId?: string; wallSide?: WallSide; bayIndex?: number; bayCount?: number;
  adjacentDeckAtFirst?: boolean; adjacentDeckAtLast?: boolean;
}) {
  const flipMul = foldFlip ? -1 : 1;
  const downAngle = mod.openAmount * (-Math.PI / 2) * flipMul;
  const upAngle = mod.openAmount * (Math.PI / 2) * flipMul;
  const outwardSign = foldFlip ? 1 : -1;

  return (
    <>
      <mesh position={[0, -wallHeight / 2, 0]} rotation={[0, 0, Math.PI / 2]} material={frameMat}>
        <cylinderGeometry args={[HINGE_RADIUS, HINGE_RADIUS, bayWidth - 0.08, 8]} />
      </mesh>
      <mesh position={[0, wallHeight / 2, 0]} rotation={[0, 0, Math.PI / 2]} material={frameMat}>
        <cylinderGeometry args={[HINGE_RADIUS, HINGE_RADIUS, bayWidth - 0.08, 8]} />
      </mesh>

      <AnimatedHingePivot targetAngle={downAngle} pivotY={-wallHeight / 2}>
        <group rotation={foldFlip ? [0, Math.PI, 0] : [0, 0, 0]}>
          <DoubleSidedPanel width={bayWidth} height={wallHeight} exteriorMat={hingeExterior} interiorMat={deckWalkSurface} />
        </group>
      </AnimatedHingePivot>

      <AnimatedHingePivot targetAngle={upAngle} pivotY={wallHeight / 2}>
        <group rotation={foldFlip ? [0, Math.PI, 0] : [0, 0, 0]}>
          <DoubleSidedPanel width={bayWidth} height={wallHeight} exteriorMat={hingeExterior} interiorMat={awningUnderside} />
        </group>
      </AnimatedHingePivot>

      {mod.openAmount > 0.5 && (
        <>
          <DeckRailing bayWidth={bayWidth} deckDepth={wallHeight} baseY={-wallHeight / 2}
            outwardSign={outwardSign} panelHeight={wallHeight} outerWall={mod.outerWall}
            sideWall={mod.sideWall}
            bayIndex={bayIndex} bayCount={bayCount}
            containerId={containerId} wallSide={wallSide}
            adjacentDeckAtFirst={adjacentDeckAtFirst} adjacentDeckAtLast={adjacentDeckAtLast} />
          <InteractiveExtensionOverlay bayWidth={bayWidth} depth={wallHeight}
            baseY={-wallHeight / 2} outwardSign={outwardSign} kind="deck"
            containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} />
          <AwningSupports bayWidth={bayWidth} awningDepth={wallHeight}
            floorY={-wallHeight / 2} ceilingY={wallHeight / 2} outwardSign={outwardSign}
            bayIndex={bayIndex} bayCount={bayCount} />
          <InteractiveExtensionOverlay bayWidth={bayWidth} depth={wallHeight}
            baseY={wallHeight / 2} outwardSign={outwardSign} kind="awning"
            containerId={containerId} wallSide={wallSide} bayIndex={bayIndex} />
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SOLID BAY — Corrugated Steel
// ═══════════════════════════════════════════════════════════════

function SolidBay({ wallHeight, bayWidth, color }: { wallHeight: number; bayWidth: number; color?: string }) {
  const mat = color ? getColoredSteel(color) : steelExterior;
  return (
    <mesh material={mat} castShadow receiveShadow>
      <boxGeometry args={[bayWidth, wallHeight, PANEL_THICKNESS]} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════
// GLASS BAY — Frame + Refractive Pane
// ═══════════════════════════════════════════════════════════════

function GlassBay({ wallHeight, bayWidth }: { wallHeight: number; bayWidth: number }) {
  return (
    <>
      {/* Mullion frame — four bars */}
      <mesh material={frameMat} castShadow>
        <boxGeometry args={[bayWidth, 0.06, PANEL_THICKNESS + 0.01]} />
      </mesh>
      <mesh position={[0, wallHeight / 2 - 0.03, 0]} material={frameMat} castShadow>
        <boxGeometry args={[bayWidth, 0.06, PANEL_THICKNESS + 0.01]} />
      </mesh>
      <mesh position={[0, -wallHeight / 2 + 0.03, 0]} material={frameMat} castShadow>
        <boxGeometry args={[bayWidth, 0.06, PANEL_THICKNESS + 0.01]} />
      </mesh>
      <mesh position={[-(bayWidth / 2 - 0.04), 0, 0]} material={frameMat} castShadow>
        <boxGeometry args={[0.05, wallHeight, PANEL_THICKNESS + 0.01]} />
      </mesh>
      <mesh position={[(bayWidth / 2 - 0.04), 0, 0]} material={frameMat} castShadow>
        <boxGeometry args={[0.05, wallHeight, PANEL_THICKNESS + 0.01]} />
      </mesh>
      {/* Refractive glass pane */}
      <mesh material={glassMat} position={[0, 0, 0]}>
        <boxGeometry args={[bayWidth - 0.14, wallHeight - 0.14, 0.015]} />
      </mesh>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// BAY MODULE — Dispatcher
// ═══════════════════════════════════════════════════════════════

function BayModule({
  bay, wallHeight, bayWidth, position, rotation,
  containerId, wallSide, bayIndex, bayCount,
  foldFlip = false,
  adjacentDeckAtFirst = false, adjacentDeckAtLast = false,
}: {
  bay: BaySlot; wallHeight: number; bayWidth: number;
  position: [number, number, number]; rotation: [number, number, number];
  containerId: string; wallSide: WallSide; bayIndex: number; bayCount: number;
  foldFlip?: boolean;
  adjacentDeckAtFirst?: boolean; adjacentDeckAtLast?: boolean;
}) {
  const openBayContextMenu = useStore((s) => s.openBayContextMenu);
  const cycleBayModule = useStore((s) => s.cycleBayModule);
  const bayCtx = useStore((s) => s.bayContextMenu);
  const mod = bay.module;
  const [hovered, setHovered] = useState(false);
  // Keep highlight when this bay's context menu is open
  const hasMenuOpen = bayCtx?.containerId === containerId && bayCtx?.wall === wallSide && bayCtx?.bayIndex === bayIndex;
  const showHighlight = hovered || hasMenuOpen;

  // ── Exit animation for deployed HingedWall transitions ──
  // When a deployed HingedWall changes to another type, we keep the
  // HingedWall mounted with openAmount=0 for a closing animation (800ms),
  // then show the new module with a fade-in.
  const exitModRef = useRef<WallModule | null>(null);
  const prevModRef = useRef<WallModule>(mod);
  const [, forceExitUpdate] = useReducer((x: number) => x + 1, 0);

  if (prevModRef.current.id !== mod.id) {
    if (!exitModRef.current &&
        prevModRef.current.type === ModuleType.HingedWall &&
        (prevModRef.current as HingedWallType).openAmount > 0.5) {
      // Start close animation: render old HingedWall with openAmount=0
      exitModRef.current = { ...prevModRef.current, openAmount: 0 } as WallModule;
      setTimeout(() => {
        exitModRef.current = null;
        forceExitUpdate();
      }, 800);
    }
    prevModRef.current = mod;
  }

  // Effective module: exit animation takes priority
  const renderMod = exitModRef.current ?? mod;

  // Module transition fade — tracks renderMod id, fades in when it changes
  const groupRef = useRef<THREE.Group>(null);
  const prevRenderModId = useRef(renderMod.id);
  const fadeRef = useRef(1); // 0 = invisible, 1 = fully visible
  if (prevRenderModId.current !== renderMod.id) {
    prevRenderModId.current = renderMod.id;
    fadeRef.current = 0; // start fade-in
  }

  // Trailing glow — ramps up on hover, fades on exit (neon trail effect)
  const glowRef = useRef(0);
  const glowMeshRef = useRef<THREE.Mesh>(null);
  const glowMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xffc107, transparent: true, opacity: 0, depthTest: false, side: THREE.DoubleSide,
  }), []);

  useFrame((_, delta) => {
    // Module fade-in transition
    if (fadeRef.current < 1) {
      fadeRef.current = Math.min(1, fadeRef.current + delta * 3.5);
      if (groupRef.current) {
        // Scale from 0.92 to 1.0 for a subtle pop-in
        const t = fadeRef.current;
        const s = 0.92 + t * 0.08;
        groupRef.current.scale.setScalar(s);
      }
    }

    // Glow decay — stays lit when context menu is open for this bay
    if (showHighlight) {
      glowRef.current = Math.min(1, glowRef.current + delta * 10);
    } else if (glowRef.current > 0) {
      glowRef.current = Math.max(0, glowRef.current - delta * 2.5);
    }
    glowMat.opacity = glowRef.current * 0.35;
    if (glowMeshRef.current) {
      glowMeshRef.current.visible = glowRef.current > 0.01;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    // Left-click ALWAYS cycles the bay module — never opens a menu
    cycleBayModule(containerId, wallSide, bayIndex);
  };

  const handleContextMenu = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    // Right-click opens the fan menu at exact cursor position
    openBayContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, containerId, wallSide, bayIndex);
  };

  // Attach userData for walkthrough raycasting identification
  const hitRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (hitRef.current) {
      hitRef.current.userData = {
        isBay: true,
        containerId,
        wallSide,
        bayIndex,
        moduleType: mod.type,
      };
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      rotation={rotation}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onPointerDown={(e) => { e.stopPropagation(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
    >
      {renderMod.type === ModuleType.PanelSolid && <SolidBay wallHeight={wallHeight} bayWidth={bayWidth} color={(renderMod as PanelSolidType).color} />}
      {renderMod.type === ModuleType.PanelGlass && <GlassBay wallHeight={wallHeight} bayWidth={bayWidth} />}
      {renderMod.type === ModuleType.HingedWall && (() => {
        const hingeProps = { mod: renderMod as HingedWallType, wallHeight, bayWidth, foldFlip, containerId, wallSide, bayIndex, bayCount, adjacentDeckAtFirst, adjacentDeckAtLast };
        if ((renderMod as HingedWallType).foldsDown && (renderMod as HingedWallType).foldsUp) {
          if ((renderMod as HingedWallType).gullFull) return <HingedBayFullGull {...hingeProps} />;
          return <HingedBayGullWing {...hingeProps} />;
        }
        if ((renderMod as HingedWallType).foldsDown) return <HingedBayFoldDown {...hingeProps} />;
        return <HingedBayFoldUp {...hingeProps} />;
      })()}
      {/* Hit-test mesh for walkthrough raycasting (transparent but raycastable) */}
      <mesh ref={hitRef} material={hitTestMat}>
        <boxGeometry args={[bayWidth, wallHeight, 0.12]} />
      </mesh>
      {/* Per-bay trailing glow highlight */}
      <mesh ref={glowMeshRef} material={glowMat} visible={false}>
        <boxGeometry args={[bayWidth + 0.02, wallHeight + 0.02, 0.12]} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// WALL ASSEMBLY
// ═══════════════════════════════════════════════════════════════

function WallAssembly({
  wall,
  containerDims,
  side,
  containerId,
  container,
  isMerged,
}: {
  wall: WallConfig;
  containerDims: { length: number; width: number; height: number };
  side: WallSide;
  containerId: string;
  container: Container;
  /** True when this wall faces an adjacent container and should be hidden */
  isMerged: boolean;
}) {
  const allContainers = useStore((s) => s.containers);
  const { length, width, height } = containerDims;

  // Adjacent wall — don't render (creates open floor plan)
  if (isMerged) return null;
  const isLong = side === WallSide.Left || side === WallSide.Right;
  const wallLength = isLong ? length : width;
  const bayCount = wall.bays.length;
  const actualBayWidth = wallLength / bayCount;

  // Determine which perpendicular walls are at "first bay" and "last bay" corners
  const adjacentMap: Record<WallSide, { first: WallSide; last: WallSide }> = {
    [WallSide.Left]:  { first: WallSide.Back,  last: WallSide.Front },
    [WallSide.Right]: { first: WallSide.Front, last: WallSide.Back },
    [WallSide.Front]: { first: WallSide.Right, last: WallSide.Left },
    [WallSide.Back]:  { first: WallSide.Left,  last: WallSide.Right },
  };
  const adj = adjacentMap[side];
  // Same-container check: perpendicular wall's nearest bay has a deployed deck
  const hasDeckAt = (ws: WallSide, idx: number) => {
    const b = container.walls[ws].bays[idx];
    return b ? b.module.type === ModuleType.HingedWall && b.module.foldsDown && b.module.openAmount > 0.5 : false;
  };
  // Cross-container check: when perpendicular wall is merged (shared with neighbor),
  // check if the neighbor has a deployed deck on the SAME wall side at the boundary.
  // This suppresses side panels at container junctions for continuous wraparound decks.
  const neighborHasDeckAt = (perpSide: WallSide, atFirstEnd: boolean): boolean => {
    const entry = container.mergedWalls.find(mw => mw.endsWith(`:${perpSide}`));
    if (!entry) return false;
    const neighborId = entry.substring(0, entry.lastIndexOf(':'));
    const neighbor = allContainers[neighborId];
    if (!neighbor) return false;
    const nWall = neighbor.walls[side];
    // At our "first" end the neighbor's meeting bay is the last; at "last" end it's the first
    const idx = atFirstEnd ? nWall.bays.length - 1 : 0;
    const b = nWall.bays[idx];
    if (!b || b.module.type !== ModuleType.HingedWall) return false;
    return b.module.foldsDown && b.module.openAmount > 0.5;
  };
  const adjDeckFirst = hasDeckAt(adj.first, 0) || neighborHasDeckAt(adj.first, true);
  const adjDeckLast = hasDeckAt(adj.last, container.walls[adj.last].bays.length - 1) || neighborHasDeckAt(adj.last, false);

  let groupPosition: [number, number, number] = [0, 0, 0];
  let groupRotation: [number, number, number] = [0, 0, 0];

  switch (side) {
    case WallSide.Left:
      groupPosition = [0, height / 2, -width / 2];
      break;
    case WallSide.Right:
      groupPosition = [0, height / 2, width / 2];
      groupRotation = [0, Math.PI, 0];
      break;
    case WallSide.Front:
      groupPosition = [length / 2, height / 2, 0];
      groupRotation = [0, Math.PI / 2, 0];
      break;
    case WallSide.Back:
      groupPosition = [-length / 2, height / 2, 0];
      groupRotation = [0, -Math.PI / 2, 0];
      break;
  }

  // Helper: is this bay a deployed fold-down deck?
  const isDeployedDeck = (bayIdx: number) => {
    const m = wall.bays[bayIdx]?.module;
    return m?.type === ModuleType.HingedWall && m.foldsDown && m.openAmount > 0.5;
  };

  return (
    <group position={groupPosition} rotation={groupRotation}>
      {wall.bays.map((bay, i) => {
        const xOffset = -wallLength / 2 + actualBayWidth / 2 + i * actualBayWidth;
        return (
          <BayModule
            key={bay.module.id}
            bay={bay}
            wallHeight={height}
            bayWidth={actualBayWidth}
            position={[xOffset, 0, 0]}
            rotation={[0, 0, 0]}
            containerId={containerId}
            wallSide={side}
            bayIndex={i}
            bayCount={bayCount}
            foldFlip={side === WallSide.Front || side === WallSide.Back}
            adjacentDeckAtFirst={i === 0 ? adjDeckFirst : false}
            adjacentDeckAtLast={i === bayCount - 1 ? adjDeckLast : false}
          />
        );
      })}

      {/* Inner-edge railings for elevated containers (level > 0) with deployed decks.
          These run along the wall plane (z=0) as a balcony-style barrier where
          the wall used to be before folding down to become the deck. */}
      {container.level > 0 && wall.bays.map((bay, i) => {
        if (!isDeployedDeck(i)) return null;
        const xOff = -wallLength / 2 + actualBayWidth / 2 + i * actualBayWidth;
        const halfBW = actualBayWidth / 2;
        const floorY = -height / 2;
        // Posts only at run boundaries (start/end of consecutive deployed bays)
        const prevDeployed = i > 0 && isDeployedDeck(i - 1);
        const nextDeployed = i < bayCount - 1 && isDeployedDeck(i + 1);
        return (
          <group key={`ir-${i}`}>
            {!prevDeployed && (
              <mesh position={[xOff - halfBW, floorY + RAILING_HEIGHT / 2, 0]} material={railingMat}>
                <cylinderGeometry args={[RAILING_POST_RADIUS, RAILING_POST_RADIUS, RAILING_HEIGHT, 8]} />
              </mesh>
            )}
            {!nextDeployed && (
              <mesh position={[xOff + halfBW, floorY + RAILING_HEIGHT / 2, 0]} material={railingMat}>
                <cylinderGeometry args={[RAILING_POST_RADIUS, RAILING_POST_RADIUS, RAILING_HEIGHT, 8]} />
              </mesh>
            )}
            {/* Horizontal rails */}
            <mesh position={[xOff, floorY + RAILING_HEIGHT, 0]} rotation={[0, 0, Math.PI / 2]} material={railingMat}>
              <cylinderGeometry args={[RAILING_RAIL_RADIUS, RAILING_RAIL_RADIUS, actualBayWidth, 8]} />
            </mesh>
            <mesh position={[xOff, floorY + RAILING_HEIGHT * 0.5, 0]} rotation={[0, 0, Math.PI / 2]} material={railingMat}>
              <cylinderGeometry args={[RAILING_RAIL_RADIUS, RAILING_RAIL_RADIUS, actualBayWidth, 8]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// FURNITURE RENDERING
// ═══════════════════════════════════════════════════════════════

// Cache materials by furniture type color
const furnitureMaterials = new Map<number, THREE.MeshStandardMaterial>();
function getFurnitureMaterial(color: number): THREE.MeshStandardMaterial {
  if (!furnitureMaterials.has(color)) {
    furnitureMaterials.set(color, new THREE.MeshStandardMaterial({
      color,
      metalness: 0.05,
      roughness: 0.7,
      transparent: true,
      opacity: 0.7,
    }));
  }
  return furnitureMaterials.get(color)!;
}

const furnitureEdge = new THREE.MeshBasicMaterial({
  color: 0x000000,
  wireframe: true,
  transparent: true,
  opacity: 0.12,
});

// Staircase materials
const stepMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, metalness: 0.05, roughness: 0.7 });
const stringerMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, metalness: 0.1, roughness: 0.6 });
const handrailMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.85, roughness: 0.25 });

function StaircasePiece({ item }: { item: FurnitureItem }) {
  const container = useStore((s) => s.containers[item.containerId]);
  const catalog = FURNITURE_CATALOG.find((c) => c.type === FurnitureType.Stairs)!;
  // Dynamic bay width: use container's actual bay span instead of fixed catalog dims
  const bayWidth = container
    ? CONTAINER_DIMENSIONS[container.size].length / LONG_WALL_BAYS[container.size]
    : catalog.dims.length;
  const w = bayWidth;
  const { width: d, height: h } = catalog.dims;
  const stepCount = 13;
  const stepH = h / stepCount;
  const stepD = d / stepCount;

  return (
    <group
      position={[item.position.x, item.position.y, item.position.z]}
      rotation={[0, item.rotation, 0]}
    >
      {/* Steps — ascending from -Z to +Z */}
      {Array.from({ length: stepCount }, (_, i) => (
        <mesh
          key={i}
          position={[0, (i + 0.5) * stepH, -d / 2 + (i + 0.5) * stepD]}
          material={stepMat}
          castShadow
          receiveShadow
          raycast={nullRaycast}
        >
          <boxGeometry args={[w, stepH * 0.9, stepD]} />
        </mesh>
      ))}

      {/* Side stringers */}
      {[-1, 1].map((side) => (
        <group key={side}>
          {/* Stringer board (diagonal) */}
          <mesh
            position={[side * (w / 2 - 0.015), h / 2, 0]}
            material={stringerMat}
            castShadow
            raycast={nullRaycast}
          >
            <boxGeometry args={[0.03, h, d]} />
          </mesh>
          {/* Handrail — aligned to RAILING_HEIGHT for deck connection */}
          <mesh
            position={[side * (w / 2 - 0.015), h + 0.02, 0]}
            rotation={[Math.atan2(h, d), 0, 0]}
            material={handrailMat}
            castShadow
            raycast={nullRaycast}
          >
            <boxGeometry args={[0.04, 0.04, Math.sqrt(h * h + d * d)]} />
          </mesh>
          {/* Top handrail — horizontal at RAILING_HEIGHT for connecting to deck railings above */}
          <mesh
            position={[side * (w / 2 - 0.015), RAILING_HEIGHT, d / 2 + 0.02]}
            material={handrailMat}
            castShadow
            raycast={nullRaycast}
          >
            <boxGeometry args={[0.04, 0.04, 0.08]} />
          </mesh>
          {/* Railing posts */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac, pi) => {
            const pz = -d / 2 + frac * d;
            const py = frac * h;
            const postH = RAILING_HEIGHT - py;
            if (postH <= 0.05) return null;
            return (
              <mesh
                key={pi}
                position={[side * (w / 2 - 0.015), py + postH / 2, pz]}
                material={handrailMat}
                castShadow
                raycast={nullRaycast}
              >
                <cylinderGeometry args={[0.015, 0.015, postH, 6]} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

/** Track which GLB paths have failed so we don't retry */
const _failedGlbs = new Set<string>();

/** Box fallback for when GLB is unavailable */
function FurnitureBox({ dims, color }: { dims: { length: number; width: number; height: number }; color: number }) {
  const mat = getFurnitureMaterial(color);
  return (
    <>
      <mesh material={mat} castShadow receiveShadow raycast={nullRaycast}>
        <boxGeometry args={[dims.length, dims.height, dims.width]} />
      </mesh>
      <mesh material={furnitureEdge} raycast={nullRaycast}>
        <boxGeometry args={[dims.length + 0.01, dims.height + 0.01, dims.width + 0.01]} />
      </mesh>
    </>
  );
}

/** Error boundary that catches GLB load failures and renders box fallback */
class GLBErrorBoundary extends React.Component<
  { glb: string; fallbackDims: { length: number; width: number; height: number }; fallbackColor: number; children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { _failedGlbs.add(this.props.glb); }
  render() {
    if (this.state.hasError) {
      return <FurnitureBox dims={this.props.fallbackDims} color={this.props.fallbackColor} />;
    }
    return this.props.children;
  }
}

// ── Theme-aware furniture material configs ──
const FURNITURE_THEME_CONFIGS: Record<string, { wood: number; woodRoughness: number; metal: number; metalRoughness: number }> = {
  industrial: { wood: 0x3a2a1a, woodRoughness: 0.7, metal: 0x2a2a2e, metalRoughness: 0.3 },
  japanese:   { wood: 0xc4a882, woodRoughness: 0.5, metal: 0x4a4a4a, metalRoughness: 0.4 },
  desert:     { wood: 0xd4b896, woodRoughness: 0.6, metal: 0x8a7a6a, metalRoughness: 0.5 },
};

function isWoodLike(mat: THREE.MeshStandardMaterial): boolean {
  const h = { r: 0, g: 0, b: 0 };
  mat.color.getRGB(h);
  // Heuristic: warm-toned, not too dark, not too saturated metallic
  return h.r > h.b && mat.metalness < 0.5 && mat.roughness > 0.3;
}

function isMetalLike(mat: THREE.MeshStandardMaterial): boolean {
  return mat.metalness >= 0.5 || mat.roughness < 0.3;
}

function applyThemeToFurniture(obj: THREE.Object3D, theme: string) {
  const cfg = FURNITURE_THEME_CONFIGS[theme];
  if (!cfg) return;
  obj.traverse((child: any) => {
    if (!child.isMesh || !child.material) return;
    const origMat = child.material as THREE.MeshStandardMaterial;
    if (!origMat.color) return;
    // Only clone + modify if classification matches (avoid unnecessary clones)
    if (isMetalLike(origMat)) {
      const mat = origMat.clone();
      mat.color.set(cfg.metal);
      mat.roughness = cfg.metalRoughness;
      child.material = mat;
    } else if (isWoodLike(origMat)) {
      const mat = origMat.clone();
      mat.color.set(cfg.wood);
      mat.roughness = cfg.woodRoughness;
      child.material = mat;
    }
  });
}

/** Attempts to load a GLB model, scaled to fit catalog dimensions */
function GLBModel({ glb, dims }: { glb: string; dims: { length: number; width: number; height: number } }) {
  const { scene } = useGLTF(glb);
  const theme = useStore((s) => s.currentTheme);
  const cloned = useMemo(() => {
    const c = scene.clone();
    const box = new THREE.Box3().setFromObject(c);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetMax = Math.max(dims.length, dims.height, dims.width);
    if (maxDim > 0) {
      const scaleFactor = targetMax / maxDim;
      c.scale.setScalar(scaleFactor);
      // Center the model at origin (parent group handles Y offset for floor placement)
      const center = box.getCenter(new THREE.Vector3()).multiplyScalar(scaleFactor);
      c.position.sub(center);
    }
    c.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.raycast = nullRaycast;
      }
    });
    applyThemeToFurniture(c, theme);
    return c;
  }, [scene, dims.length, dims.width, dims.height, theme]);
  return <primitive object={cloned} />;
}

function FurniturePiece({ item }: { item: FurnitureItem }) {
  // Stairs get special staircase geometry
  if (item.type === FurnitureType.Stairs) {
    return <StaircasePiece item={item} />;
  }

  const catalog = FURNITURE_CATALOG.find((c) => c.type === item.type);
  if (!catalog) return null;

  const showLabels = useStore((s) => s.showFurnitureLabels);
  const { length, width, height } = catalog.dims;
  const useGlb = catalog.glb && !_failedGlbs.has(catalog.glb);

  return (
    <group
      position={[item.position.x, item.position.y + height / 2, item.position.z]}
      rotation={[0, item.rotation, 0]}
    >
      {useGlb ? (
        <GLBErrorBoundary glb={catalog.glb!} fallbackDims={catalog.dims} fallbackColor={catalog.color}>
          <GLBModel glb={catalog.glb!} dims={catalog.dims} />
        </GLBErrorBoundary>
      ) : (
        <FurnitureBox dims={catalog.dims} color={catalog.color} />
      )}
      {showLabels && (
        <Html
          position={[0, height / 2 + 0.15, 0]}
          center
          distanceFactor={8}
          style={{
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            fontSize: 10,
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
            userSelect: 'none',
          }}
        >
          {catalog.label}
        </Html>
      )}
    </group>
  );
}

// ═══════════════════════════════════════════════════════════════
// CORNER DECK PIECES — fills gap where two adjacent deployed decks meet
// ═══════════════════════════════════════════════════════════════

const OUTER_WALL_CYCLE_3D: Array<'railing' | 'glass' | 'solid' | 'closet' | 'none'> =
  ['railing', 'glass', 'solid', 'closet', 'none'];

// Hover glow material for interactive corner pieces
const cornerHoverGlow = new THREE.MeshBasicMaterial({
  color: 0x66bb6a,
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
});


// ═══════════════════════════════════════════════════════════════
// FLOOR PLATE WITH STAIRCASE HOLES
// ═══════════════════════════════════════════════════════════════

function FloorPlate({ container, dims }: { container: Container; dims: { length: number; width: number; height: number } }) {
  const belowContainer = useStore((s) => container.stackedOn ? s.containers[container.stackedOn] : null);

  // Great Room: main floor removed for double/triple-height atrium
  if (container.floorRemoved) return null;

  const floorMat = getFloorMaterial(container.floorMaterial);
  const floorW = dims.length - 0.1;
  const floorD = dims.width - 0.1;
  const floorY = container.position.y + 0.06;
  const t = 0.06; // floor thickness
  const y = 0.03; // center Y of floor plate

  // Find staircase in container below — use actual bay width for hole sizing
  let hole: { x: number; z: number; w: number; d: number; rotation: number } | null = null;
  if (belowContainer) {
    const belowBayW = CONTAINER_DIMENSIONS[belowContainer.size].length / LONG_WALL_BAYS[belowContainer.size];
    for (const item of belowContainer.furniture ?? []) {
      if (item.type === FurnitureType.Stairs) {
        const cat = FURNITURE_CATALOG.find(c => c.type === FurnitureType.Stairs)!;
        const cos = Math.abs(Math.cos(item.rotation));
        const sin = Math.abs(Math.sin(item.rotation));
        hole = {
          x: item.position.x,
          z: item.position.z,
          w: belowBayW * cos + cat.dims.width * sin + 0.1,
          d: belowBayW * sin + cat.dims.width * cos + 0.1,
          rotation: item.rotation,
        };
        break;
      }
    }
  }

  const FLOOR_PROXY_H = 0.25; // 25cm proxy for walkthrough raycasting

  if (!hole) {
    return (
      <group>
        <mesh position={[0, y, 0]} receiveShadow castShadow material={floorMat} raycast={nullRaycast}>
          <boxGeometry args={[floorW, t, floorD]} />
        </mesh>
        {/* Fat proxy hitbox for raycasting (invisible, 25cm tall) */}
        <mesh position={[0, y + FLOOR_PROXY_H / 2 - t / 2, 0]} visible={false}
          userData={{ isFloor: true, floorY, containerId: container.id }}>
          <boxGeometry args={[floorW, FLOOR_PROXY_H, floorD]} />
        </mesh>
      </group>
    );
  }

  // Split floor into 4 pieces around the rectangular hole
  const hL = hole.x - hole.w / 2;
  const hR = hole.x + hole.w / 2;
  const hF = hole.z - hole.d / 2;
  const hB = hole.z + hole.d / 2;
  const fL = -floorW / 2;
  const fR = floorW / 2;
  const fF = -floorD / 2;
  const fB = floorD / 2;

  const pieces: Array<{ pos: [number, number, number]; size: [number, number, number] }> = [];

  // Left strip (full depth)
  if (hL > fL + 0.01) {
    const w = hL - fL;
    pieces.push({ pos: [fL + w / 2, y, 0], size: [w, t, floorD] });
  }
  // Right strip (full depth)
  if (hR < fR - 0.01) {
    const w = fR - hR;
    pieces.push({ pos: [hR + w / 2, y, 0], size: [w, t, floorD] });
  }
  // Front strip (between hole sides only)
  if (hF > fF + 0.01) {
    const d = hF - fF;
    pieces.push({ pos: [hole.x, y, fF + d / 2], size: [hole.w, t, d] });
  }
  // Back strip (between hole sides only)
  if (hB < fB - 0.01) {
    const d = fB - hB;
    pieces.push({ pos: [hole.x, y, hB + d / 2], size: [hole.w, t, d] });
  }

  // ── Stair Void Safety Railings ─────────────────────────────
  // Determine the stair entry edge (the side the user walks up from — NO railing there)
  // Normalize rotation to [0, 2π)
  const normRot = ((hole.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  // Entry edges based on stair rotation:
  // ~0 → stairs go toward -Z, entry from -Z side (front edge open)
  // ~π/2 → entry from +X side (right edge open)
  // ~π → entry from +Z side (back edge open)
  // ~3π/2 → entry from -X side (left edge open)
  const entryEdge =
    normRot < Math.PI * 0.25 || normRot > Math.PI * 1.75 ? 'front' :
    normRot < Math.PI * 0.75 ? 'right' :
    normRot < Math.PI * 1.25 ? 'back' : 'left';

  // Build railing segments for the 3 non-entry edges of the hole
  type RailSegment = { pos: [number, number, number]; size: [number, number, number]; isPost?: boolean };
  const railSegments: RailSegment[] = [];
  const rY = RAILING_HEIGHT;
  const midY = RAILING_HEIGHT * 0.5;
  const railR = RAILING_RAIL_RADIUS * 2; // rail cross-section as box width

  // Edge definitions: each edge has a center position, a rail length, and orientation
  const edges: Array<{ id: string; cx: number; cz: number; lenX: number; lenZ: number }> = [
    { id: 'front', cx: hole.x, cz: hF, lenX: hole.w, lenZ: 0 },  // -Z edge
    { id: 'back',  cx: hole.x, cz: hB, lenX: hole.w, lenZ: 0 },  // +Z edge
    { id: 'left',  cx: hL, cz: hole.z, lenX: 0, lenZ: hole.d },   // -X edge
    { id: 'right', cx: hR, cz: hole.z, lenX: 0, lenZ: hole.d },   // +X edge
  ];

  for (const edge of edges) {
    if (edge.id === entryEdge) continue; // Skip the stair entry side
    const isHoriz = edge.lenX > 0;
    const len = isHoriz ? edge.lenX : edge.lenZ;

    // Top rail
    railSegments.push({
      pos: [edge.cx, rY, edge.cz],
      size: isHoriz ? [len, railR, railR] : [railR, railR, len],
    });
    // Mid rail
    railSegments.push({
      pos: [edge.cx, midY, edge.cz],
      size: isHoriz ? [len, railR, railR] : [railR, railR, len],
    });
    // Corner posts at each end of the rail
    const half = len / 2;
    const p1: [number, number, number] = isHoriz
      ? [edge.cx - half, rY / 2, edge.cz]
      : [edge.cx, rY / 2, edge.cz - half];
    const p2: [number, number, number] = isHoriz
      ? [edge.cx + half, rY / 2, edge.cz]
      : [edge.cx, rY / 2, edge.cz + half];
    railSegments.push({ pos: p1, size: [0, 0, 0], isPost: true });
    railSegments.push({ pos: p2, size: [0, 0, 0], isPost: true });
  }

  return (
    <>
      {pieces.map((p, i) => (
        <group key={i}>
          <mesh position={p.pos} receiveShadow castShadow material={floorMat} raycast={nullRaycast}>
            <boxGeometry args={p.size} />
          </mesh>
          {/* Fat proxy for raycasting */}
          <mesh position={[p.pos[0], p.pos[1] + FLOOR_PROXY_H / 2 - t / 2, p.pos[2]]} visible={false}
            userData={{ isFloor: true, floorY, containerId: container.id }}>
            <boxGeometry args={[p.size[0], FLOOR_PROXY_H, p.size[2]]} />
          </mesh>
        </group>
      ))}
      {/* Safety railings around stair void */}
      {railSegments.map((seg, i) =>
        seg.isPost ? (
          <mesh key={`rail-${i}`} position={seg.pos} material={railingMat} castShadow raycast={nullRaycast}>
            <cylinderGeometry args={[RAILING_POST_RADIUS, RAILING_POST_RADIUS, RAILING_HEIGHT, 8]} />
          </mesh>
        ) : (
          <mesh key={`rail-${i}`} position={seg.pos} material={railingMat} raycast={nullRaycast}>
            <boxGeometry args={seg.size} />
          </mesh>
        )
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUB-ATOMIC STRUCTURAL COMPONENTS
// ═══════════════════════════════════════════════════════════════

interface FrameProps {
  container: Container;
  dims: { length: number; width: number; height: number };
  hoveredElement: string | null;
  setHoveredElement: (key: string | null) => void;
}

/** Proxy hitbox size — 40cm thick invisible collider for thin structural elements */
const PROXY_SIZE = 0.4;

/** 4 corner posts — individually hoverable + right-click to toggle visibility */
function FramePosts({ container, dims, hoveredElement, setHoveredElement }: FrameProps) {
  const toggleStructuralElement = useStore((s) => s.toggleStructuralElement);
  const h = container.structureConfig?.hiddenElements ?? [];
  const posts: [string, number, number, number][] = [
    ["post_front_right", dims.length / 2, 0, dims.width / 2],
    ["post_front_left", dims.length / 2, 0, -dims.width / 2],
    ["post_back_right", -dims.length / 2, 0, dims.width / 2],
    ["post_back_left", -dims.length / 2, 0, -dims.width / 2],
  ];
  return (
    <>
      {posts.map(([key, px, , pz]) => {
        const isHidden = h.includes(key);
        return (
          <group key={key}>
            {/* Visual geometry: full material when visible, cyan ghost when hidden — raycast nuked */}
            <mesh
              position={[px, dims.height / 2, pz]}
              castShadow={!isHidden}
              material={isHidden ? frameGhostMat : frameMat}
              raycast={nullRaycast}
            >
              <boxGeometry args={[0.1, dims.height, 0.1]} />
            </mesh>
            {/* ★ PERMANENT proxy hitbox — never unmounts, even when element is hidden */}
            <mesh
              position={[px, dims.height / 2, pz]}
              visible={false}
              userData={{ isStructural: true, elementKey: key, containerId: container.id }}
              onPointerOver={(e) => { e.stopPropagation(); setHoveredElement(key); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHoveredElement(null); document.body.style.cursor = 'auto'; }}
              onContextMenu={(e) => {
                e.stopPropagation();
                e.nativeEvent.preventDefault();
                toggleStructuralElement(container.id, key);
              }}
            >
              <boxGeometry args={[PROXY_SIZE, dims.height, PROXY_SIZE]} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** 8 edge beams (4 top + 4 bottom) — individually hoverable + right-click to toggle visibility */
function FrameBeams({ container, dims, hoveredElement, setHoveredElement }: FrameProps) {
  const toggleStructuralElement = useStore((s) => s.toggleStructuralElement);
  const h = container.structureConfig?.hiddenElements ?? [];
  const levels: [string, number][] = [
    ["bottom", 0.03],
    ["top", dims.height + 0.01],
  ];
  const beamDefs: [string, [number, number, number], [number, number, number]][] = [];
  for (const [prefix, y] of levels) {
    beamDefs.push(
      [`${prefix}_front`, [0, y, dims.width / 2], [dims.length, 0.06, 0.06]],
      [`${prefix}_back`, [0, y, -dims.width / 2], [dims.length, 0.06, 0.06]],
      [`${prefix}_right`, [dims.length / 2, y, 0], [0.06, 0.06, dims.width]],
      [`${prefix}_left`, [-dims.length / 2, y, 0], [0.06, 0.06, dims.width]],
    );
  }
  return (
    <>
      {beamDefs.map(([key, pos, args]) => {
        const isHidden = h.includes(key);
        // Proxy args: inflate the thin dimension(s) to PROXY_SIZE for easy clicking
        const proxyArgs: [number, number, number] = [
          Math.max(args[0], PROXY_SIZE),
          Math.max(args[1], PROXY_SIZE),
          Math.max(args[2], PROXY_SIZE),
        ];
        return (
          <group key={key}>
            {/* Visual geometry: full material when visible, cyan ghost when hidden — raycast nuked */}
            <mesh
              position={pos}
              material={isHidden ? frameGhostMat : frameMat}
              raycast={nullRaycast}
            >
              <boxGeometry args={args} />
            </mesh>
            {/* ★ PERMANENT proxy hitbox — right-click only (no hover to prevent click-eating) */}
            <mesh
              position={pos}
              visible={false}
              userData={{ isStructural: true, elementKey: key, containerId: container.id }}
              onContextMenu={(e) => {
                e.stopPropagation();
                e.nativeEvent.preventDefault();
                toggleStructuralElement(container.id, key);
              }}
            >
              <boxGeometry args={proxyArgs} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

/** Roof surface — togglable via container.roofRemoved */
function ContainerRoof({ container, dims }: { container: Container; dims: { length: number; width: number; height: number } }) {
  if (container.roofRemoved) return null;
  // Voxel skin is active — it provides the visual roof surface (Level 1, top face).
  // Suppress the static corrugated slab to prevent Z-fighting.
  if (container.voxelGrid?.some((v) => v?.active)) return null;
  return (
    <mesh
      position={[0, dims.height + 0.02, 0]}
      castShadow
      receiveShadow
      material={roofMat}
      userData={{ isRoof: true, containerId: container.id }}
      raycast={nullRaycast}
    >
      <boxGeometry args={[dims.length + 0.02, 0.05, dims.width + 0.02]} />
    </mesh>
  );
}

// ═══════════════════════════════════════════════════════════════
// STANDALONE VOXEL HOVER/SELECTION HIGHLIGHT
// ═══════════════════════════════════════════════════════════════
// Extracted from ContainerSkin's voxel loop IIFE to ensure it re-renders
// independently when hoveredVoxel changes. The large ContainerSkin component
// does not reliably re-render for hover state changes from pointer events.

const _hlEdgeCache = new Map<string, THREE.BufferGeometry>();
function getHlEdges(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_hlEdgeCache.has(k)) {
    const box = new THREE.BoxGeometry(w, h, d);
    _hlEdgeCache.set(k, new THREE.EdgesGeometry(box));
  }
  return _hlEdgeCache.get(k)!;
}

const hlHoverMat = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.5, depthTest: false });

// Cached box geometries for hover highlights (avoids dispose+recreate per render)
const _hlBoxCache = new Map<string, THREE.BoxGeometry>();
function getHlBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_hlBoxCache.has(k)) _hlBoxCache.set(k, new THREE.BoxGeometry(w, h, d));
  return _hlBoxCache.get(k)!;
}

// §7.1 Hover wall face overlay (amber)
const hlWallMat = new THREE.MeshBasicMaterial({
  color: 0xffcc00, transparent: true, opacity: 0.25,
  depthWrite: false, depthTest: false, side: THREE.DoubleSide,
});
// Selection: wireframe outline instead of floor glow (eliminates teal artifact)
const hlSelectEdgeMat = new THREE.LineBasicMaterial({
  color: 0x3b82f6, transparent: true, opacity: 0.6,
  depthTest: false,
});

function VoxelHoverHighlight({ container }: { container: Container }) {
  const hoveredVoxel = useStore((s) => s.hoveredVoxel);
  const hoveredVoxelEdge = useStore((s) => s.hoveredVoxelEdge);
  const selectedVoxel = useStore((s) => s.selectedVoxel);
  const selectedVoxels = useStore((s) => s.selectedVoxels);
  const dims = CONTAINER_DIMENSIONS[container.size];
  const vHeight = dims.height;
  const vOffset = vHeight / 2;

  // Collect all voxel indices that need a highlight, tracking hover+select independently
  const highlights = useMemo(() => {
    const result: { idx: number; isHover: boolean; isSelect: boolean }[] = [];
    const map = new Map<number, { idx: number; isHover: boolean; isSelect: boolean }>();

    // Hovered voxel (from hoveredVoxel OR hoveredVoxelEdge as fallback)
    let hoverIdx = -1;
    if (hoveredVoxel && hoveredVoxel.containerId === container.id) {
      if (!hoveredVoxel.isExtension && hoveredVoxel.index !== undefined) {
        hoverIdx = hoveredVoxel.index;
      } else if (hoveredVoxel.isExtension) {
        // Extension voxels store col/row instead of index — compute index
        hoverIdx = (hoveredVoxel as any).row * VOXEL_COLS + (hoveredVoxel as any).col;
      }
    }
    // Fallback to hoveredVoxelEdge if hoveredVoxel didn't resolve
    if (hoverIdx < 0 && hoveredVoxelEdge && hoveredVoxelEdge.containerId === container.id) {
      hoverIdx = hoveredVoxelEdge.voxelIndex;
    }
    if (hoverIdx >= 0) {
      const entry = { idx: hoverIdx, isHover: true, isSelect: false };
      map.set(hoverIdx, entry);
      result.push(entry);
    }

    // Selected voxel
    let selIdx = -1;
    if (selectedVoxel && selectedVoxel.containerId === container.id) {
      if (!selectedVoxel.isExtension && selectedVoxel.index !== undefined) {
        selIdx = selectedVoxel.index;
      } else if (selectedVoxel.isExtension) {
        selIdx = (selectedVoxel as any).row * VOXEL_COLS + (selectedVoxel as any).col;
      }
    }
    if (selIdx >= 0) {
      const idx = selIdx;
      const existing = map.get(idx);
      if (existing) { existing.isSelect = true; }
      else { const entry = { idx, isHover: false, isSelect: true }; map.set(idx, entry); result.push(entry); }
    }

    // Multi-selected voxels
    if (selectedVoxels && selectedVoxels.containerId === container.id) {
      for (const idx of selectedVoxels.indices) {
        const existing = map.get(idx);
        if (existing) { existing.isSelect = true; }
        else { const entry = { idx, isHover: false, isSelect: true }; map.set(idx, entry); result.push(entry); }
      }
    }

    return result;
  }, [hoveredVoxel, hoveredVoxelEdge, selectedVoxel, selectedVoxels, container.id]);

  // Determine which wall face is hovered (for orange wall overlay)
  const hoveredFace = (hoveredVoxelEdge && hoveredVoxelEdge.containerId === container.id)
    ? hoveredVoxelEdge.face : null;
  const hoveredFaceIdx = hoveredFace ? hoveredVoxelEdge!.voxelIndex : -1;

  if (highlights.length === 0) return null;

  const grid = container.voxelGrid;

  return (
    <>
      {highlights.map(({ idx, isHover, isSelect }) => {
        const row = Math.floor(idx / VOXEL_COLS);
        const col = idx % VOXEL_COLS;
        // Use actual voxel position — no remapping for extensions
        const layout = getVoxelLayout(col, row, dims);

        // Wall face overlay position + rotation for hovered edge
        let wallPos: [number, number, number] | null = null;
        let wallSize: [number, number] | null = null;
        let wallRotY = 0;
        if (isHover && hoveredFace && idx === hoveredFaceIdx) {
          const halfW = layout.voxW / 2;
          const halfD = layout.voxD / 2;
          switch (hoveredFace) {
            case 'n': wallPos = [layout.px, vOffset, layout.pz - halfD]; wallSize = [layout.voxW, vHeight]; break;
            case 's': wallPos = [layout.px, vOffset, layout.pz + halfD]; wallSize = [layout.voxW, vHeight]; break;
            case 'e': wallPos = [layout.px + halfW, vOffset, layout.pz]; wallSize = [layout.voxD, vHeight]; wallRotY = Math.PI / 2; break;
            case 'w': wallPos = [layout.px - halfW, vOffset, layout.pz]; wallSize = [layout.voxD, vHeight]; wallRotY = Math.PI / 2; break;
          }
        }

        return (
          <group key={`hl_${idx}`}>
            {/* Selection: wireframe outline around selected voxel */}
            {isSelect && (
              <lineSegments
                position={[layout.px, vOffset, layout.pz]}
                geometry={getHlEdges(layout.voxW * 0.98, vHeight * 0.98, layout.voxD * 0.98)}
                material={hlSelectEdgeMat}
                renderOrder={10}
                raycast={nullRaycast}
              />
            )}
            {/* Hover: wireframe outline only (single voxel) */}
            {isHover && (
              <lineSegments
                position={[layout.px, vOffset, layout.pz]}
                geometry={getHlEdges(layout.voxW, vHeight, layout.voxD)}
                material={hlHoverMat}
                renderOrder={21}
                raycast={nullRaycast}
              />
            )}
            {/* §7.1 Amber wall face overlay on hover */}
            {isHover && wallPos && wallSize && (
              <mesh
                position={wallPos}
                rotation={[0, wallRotY, 0]}
                geometry={getHlBox(wallSize[0] * 0.95, wallSize[1] * 0.95, 0.04)}
                material={hlWallMat}
                renderOrder={11}
                raycast={nullRaycast}
                frustumCulled={false}
              />
            )}
          </group>
        );
      })}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN CONTAINER MESH
// ═══════════════════════════════════════════════════════════════

const DRAG_THRESHOLD_3D = 5; // pixels — must drag 5px before container move starts

// ── Interior Glow — warm amber point light through glass at dawn/dusk ───

function InteriorGlow({ container, dims }: { container: Container; dims: { length: number; width: number; height: number } }) {
  const timeOfDay = useStore((s) => s.environment.timeOfDay);

  const hasGlass = useMemo(() =>
    container.voxelGrid?.some((v) =>
      Object.values(v.faces).some((f) => f === 'Glass_Pane')
    ) ?? false,
  [container.voxelGrid]);

  const isEvening = timeOfDay < 7.5 || timeOfDay > 16.5;

  if (!hasGlass || !isEvening) return null;

  return (
    <pointLight
      position={[0, dims.height * 0.4, 0]}
      color="#ffe8c0"
      intensity={1.2}
      distance={dims.length * 1.5}
      decay={2}
      castShadow={false}
    />
  );
}

export default function ContainerMesh({ container }: { container: Container }) {
  const groupRef = useRef<THREE.Group>(null);
  const dims = CONTAINER_DIMENSIONS[container.size];
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const startContainerDrag = useStore((s) => s.startContainerDrag);
  const dragMovingId = useStore((s) => s.dragMovingId);
  const viewMode = useStore((s) => s.viewMode);
  const openContainerContextMenu = useStore((s) => s.openContainerContextMenu);
  const toggleStructuralElement = useStore((s) => s.toggleStructuralElement);
  const isSelected = selection.includes(container.id);
  const isBeingDragged = dragMovingId === container.id;
  const [hovered, setHovered] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);
  const dragPendingRef = useRef<{ id: string; clientX: number; clientY: number } | null>(null);
  const { gl } = useThree();

  // Disable container body interaction in walkthrough mode (user should interact with panels only)
  const isWalkthrough = viewMode === 'walkthrough';

  // ★ Phase 4: Container-level Fresnel glow REMOVED — only voxel-level highlights now

  // Apply raycast layers to all meshes
  useEffect(() => {
    if (!groupRef.current) return;

    groupRef.current.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      // Interactive meshes (Layer 1): floors, walls, edges, furniture, structural
      if (
        child.userData.isFloor ||
        child.userData.isBay ||
        child.userData.isFloorEdge ||
        child.userData.isRailing ||
        child.userData.isCorner ||
        child.userData.isCornerEdge ||
        child.userData.isFurniture ||
        child.userData.isStructural
      ) {
        child.layers.disableAll();
        child.layers.enable(RAYCAST_LAYERS.INTERACTABLE);
      }
      // Non-interactive meshes (Layer 0): container bodies, structural elements
      else {
        child.layers.disableAll();
        child.layers.enable(RAYCAST_LAYERS.IGNORE);
      }
    });
  }, [container.id]); // Re-apply when container changes

  // Drag threshold: only initiate drag after 5px mouse movement
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const p = dragPendingRef.current;
      if (!p) return;
      const dx = e.clientX - p.clientX;
      const dy = e.clientY - p.clientY;
      if (Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD_3D) {
        startContainerDrag(p.id);
        dragPendingRef.current = null;
        // Early-registration safety: catch fast release before DragMoveGhost mounts
        const earlyUp = () => {
          if (useStore.getState().dragMovingId === p.id) {
            useStore.getState().cancelContainerDrag();
          }
        };
        gl.domElement.addEventListener("pointerup", earlyUp, { once: true });
      }
    };
    const handleUp = () => { dragPendingRef.current = null; };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [startContainerDrag, gl]);

  // During drag: dim the original container to 30% opacity so user sees where they're dragging FROM.
  const _savedOpacities = useRef<Map<THREE.Material, { opacity: number; transparent: boolean }>>(new Map());
  useEffect(() => {
    if (!groupRef.current) return;
    const saved = _savedOpacities.current;
    if (isBeingDragged) {
      // Dim all materials
      groupRef.current.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          if (!saved.has(m)) {
            saved.set(m, { opacity: (m as any).opacity ?? 1, transparent: m.transparent });
          }
          m.transparent = true;
          (m as any).opacity = 0.3;
        }
      });
    } else if (saved.size > 0) {
      // Restore all materials
      for (const [m, orig] of saved) {
        (m as any).opacity = orig.opacity;
        m.transparent = orig.transparent;
      }
      saved.clear();
    }
  }, [isBeingDragged]);

  return (
    <group
      ref={groupRef}
      position={[container.position.x, container.position.y, container.position.z]}
      rotation={[0, container.rotation, 0]}
      visible={true}
      onPointerDown={(e) => {
        e.stopPropagation();
        if (e.nativeEvent.button !== 0) return; // left-click only
        if (isSelected) {
          // Drag-to-move: any left-click-drag on a selected container initiates move.
          // The original container stays visible (dimmed) during drag, so no disappearing.
          dragPendingRef.current = {
            id: container.id,
            clientX: e.nativeEvent.clientX,
            clientY: e.nativeEvent.clientY,
          };
        } else {
          select(container.id, e.nativeEvent.shiftKey);
        }
      }}
      onPointerOver={() => { if (!isWalkthrough) setHovered(true); }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
    >
      {/* Floor plate — with staircase holes when container below has stairs */}
      <FloorPlate container={container} dims={dims} />

      {/* Floor underside — steel (skip when floor removed for Great Room atrium) */}
      {!container.floorRemoved && (
        <mesh position={[0, -0.01, 0]} material={steelDark} raycast={nullRaycast}>
          <boxGeometry args={[dims.length, 0.04, dims.width]} />
        </mesh>
      )}

      {/* Roof — extracted sub-component */}
      <ContainerRoof container={container} dims={dims} />

      {/* Structural frame — individually interactive posts and beams */}
      <FramePosts container={container} dims={dims} hoveredElement={hoveredElement} setHoveredElement={setHoveredElement} />
      <FrameBeams container={container} dims={dims} hoveredElement={hoveredElement} setHoveredElement={setHoveredElement} />

      {/* ★ PHASE 1: Legacy WallAssembly DISABLED — ContainerSkin is the sole authority.
          Legacy panels (SolidBay, GlassBay, HingedWall) rendered at identical positions
          as ContainerSkin voxel faces, causing severe Z-fighting artifacts.
          The voxel skin system replaces all wall rendering.
          TODO Phase 4: Rebuild hinged wall animations within the voxel system. */}

      {/* Furniture */}
      {(container.furniture ?? []).map((item) => (
        <FurniturePiece key={item.id} item={item} />
      ))}

      {/* ★ Phase 4: Container-level highlights KILLED — only individual voxels highlight now */}

      {/* Interior glow — warm amber point light visible through glass at dawn/dusk */}
      <InteriorGlow container={container} dims={dims} />

      {/* Voxel skin — inset interior face planes, inherits this group's transform */}
      <ContainerSkin container={container} />

      {/* Standalone hover/selection highlight — re-renders independently from ContainerSkin */}
      <VoxelHoverHighlight container={container} />

      {/* Container label — subtle pill; suppressed for grouped containers (WU-3) */}
      {(isSelected || hovered) && container.groupId === null && (
        <Html
          position={[0, dims.height + 0.3, 0]}
          center
          distanceFactor={6}
          style={{ pointerEvents: "none", whiteSpace: "nowrap" }}
        >
          <div style={{
            pointerEvents: "none",
            fontSize: "11px",
            fontWeight: 600,
            color: "rgba(255,255,255,0.85)",
            background: "rgba(0,0,0,0.45)",
            padding: "2px 8px",
            borderRadius: "10px",
            whiteSpace: "nowrap",
            backdropFilter: "blur(4px)",
            letterSpacing: "0.03em",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}>
            {container.name}
            {viewMode === ViewMode.Blueprint && (
              <span style={{ color: "rgba(255,255,255,0.6)", marginLeft: "6px" }}>
                {dims.length.toFixed(1)}×{dims.width.toFixed(1)}×{dims.height.toFixed(1)}m
              </span>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
