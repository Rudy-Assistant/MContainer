"use client";

/**
 * VoxelPreview3D.tsx — Realistic 3D Cube Inspector
 *
 * Renders the selected voxel using the EXACT SAME FaceVisual component
 * as the main 3D canvas (ContainerSkin), guaranteeing 1:1 visual fidelity.
 * Click any face to cycle its SurfaceType.
 * Faint ghosted neighbor voxels provide spatial context.
 */

import React, { useState, useMemo } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import type { SurfaceType, VoxelFaces } from "@/types/container";
import { VOXEL_COLS, VOXEL_ROWS, CONTAINER_DIMENSIONS } from "@/types/container";
import { FaceVisual, StairMesh } from "@/components/objects/ContainerSkin";

// ── Surface cycle ──────────────────────────────────────────────

const SURFACE_CYCLE: SurfaceType[] = [
  "Open", "Solid_Steel", "Glass_Pane", "Railing_Glass", "Railing_Cable", "Deck_Wood",
];

function cycleSurface(current: SurfaceType, delta: number): SurfaceType {
  const i = SURFACE_CYCLE.indexOf(current);
  return SURFACE_CYCLE[(i + delta + SURFACE_CYCLE.length) % SURFACE_CYCLE.length];
}

const DIM_LABEL_STYLE: React.CSSProperties = {
  fontSize: '9px', color: '#64748b', whiteSpace: 'nowrap', pointerEvents: 'none',
};

// ── Preview-only materials (not theme-dependent) ────────────────

const mOpen = new THREE.MeshBasicMaterial({
  color: 0xcbd5e1, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false,
});
const mEdgeOutline = new THREE.LineBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.9, depthTest: false });
const mHit = new THREE.MeshBasicMaterial({
  transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, colorWrite: false,
});
const mEdgeDark = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.5 });
const mGhostEdge = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.20 });
const mGhostFill = new THREE.MeshBasicMaterial({
  color: 0x94a3b8, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false,
});
const mDashedPreview = new THREE.LineDashedMaterial({
  color: 0x06b6d4, dashSize: 0.08, gapSize: 0.05,
  transparent: true, opacity: 0.8, depthTest: false,
});
const mXrayMask = new THREE.MeshBasicMaterial({
  color: 0xf1f5f9, transparent: true, opacity: 0.30,
  side: THREE.FrontSide, depthWrite: false,
});

// ── Geometry caches ─────────────────────────────────────────────

const _box = new Map<string, THREE.BufferGeometry>();
function getBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `${w.toFixed(4)}_${h.toFixed(4)}_${d.toFixed(4)}`;
  if (!_box.has(k)) _box.set(k, new THREE.BoxGeometry(w, h, d));
  return _box.get(k)!;
}

const _edges = new Map<string, THREE.BufferGeometry>();
function getEdges(w: number, h: number, d: number): THREE.BufferGeometry {
  const k = `e_${w.toFixed(4)}_${h.toFixed(4)}_${d.toFixed(4)}`;
  if (!_edges.has(k)) {
    const b = new THREE.BoxGeometry(w, h, d);
    const eg = new THREE.EdgesGeometry(b);
    const pos = eg.attributes.position;
    const dist: number[] = [];
    const v0 = new THREE.Vector3(), v1 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i += 2) {
      v0.fromBufferAttribute(pos, i);
      v1.fromBufferAttribute(pos, i + 1);
      dist.push(0, v0.distanceTo(v1));
    }
    eg.setAttribute('lineDistance', new THREE.Float32BufferAttribute(dist, 1));
    _edges.set(k, eg);
    b.dispose();
  }
  return _edges.get(k)!;
}

// ── Raycast helpers ─────────────────────────────────────────────

import { nullRaycast } from '@/utils/nullRaycast';
const PV_STRIP = 0.18;  // picture-frame strip width for inspector hitboxes

function PreviewPictureFrameHitbox({
  faceW, faceH, faceD, onPointerEnter, onPointerLeave, onClick, onContextMenu, material,
}: {
  faceW: number; faceH: number; faceD: number;
  onPointerEnter: (e: ThreeEvent<PointerEvent>) => void;
  onPointerLeave: (e: ThreeEvent<PointerEvent>) => void;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onContextMenu: (e: ThreeEvent<MouseEvent>) => void;
  material: THREE.Material;
}) {
  const S = PV_STRIP;
  const innerH = faceH - 2 * S;
  const strips: [number, number, number, number, number, number][] = [
    [faceW,   S,      faceD,  0,                faceH/2 - S/2, 0],
    [faceW,   S,      faceD,  0,               -faceH/2 + S/2, 0],
    [S,       innerH, faceD, -faceW/2 + S/2,   0,             0],
    [S,       innerH, faceD,  faceW/2 - S/2,   0,             0],
  ];
  return (
    <>
      {strips.map(([w, h, d, x, y, z], i) => (
        <mesh
          key={i}
          geometry={getBox(w, h, d)}
          material={material}
          position={[x, y, z] as [number, number, number]}
          onPointerEnter={onPointerEnter}
          onPointerLeave={onPointerLeave}
          onClick={onClick}
          onContextMenu={onContextMenu}
        />
      ))}
    </>
  );
}

// ── PreviewFace — uses ContainerSkin's FaceVisual for 1:1 fidelity ─

const PANEL_THICK = 0.06; // must match ContainerSkin's PANEL_THICK

function PreviewFace({ face, position, nW, nH, nD, isNS, isEW, isHoriz, surface, onCycle, onContextMenu, containerId, voxelIndex, xray = false }: {
  face: keyof VoxelFaces;
  position: [number, number, number];
  nW: number; nH: number; nD: number;
  isNS: boolean; isEW: boolean; isHoriz: boolean;
  surface: SurfaceType;
  onCycle: () => void;
  onContextMenu: (e: ThreeEvent<MouseEvent>) => void;
  containerId: string;
  voxelIndex: number;
  xray?: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const setHoveredPreviewFace = useStore((s) => s.setHoveredPreviewFace);
  const voxelContextMenu = useStore((s) => s.voxelContextMenu);
  const isMenuHighlighted = voxelContextMenu?.containerId === containerId
    && voxelContextMenu?.voxelIndex === voxelIndex
    && voxelContextMenu?.faceDir === face;

  // Hitbox geometry (invisible but raycastable)
  const hitGeo = getBox(
    isNS ? nW : isEW ? PANEL_THICK + 0.03 : nW,
    isHoriz ? PANEL_THICK + 0.03 : nH,
    isNS ? PANEL_THICK + 0.03 : nD,
  );

  const onEnter = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    setHoveredPreviewFace(face);
    document.body.style.cursor = 'pointer';
  };
  const onLeave = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    setHoveredPreviewFace(null);
    document.body.style.cursor = 'auto';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onCycle(); };
  const onCtx = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    (e.nativeEvent as MouseEvent)?.preventDefault?.();
    onContextMenu(e);
  };

  return (
    <group position={position}>
      {/* Invisible hitbox — solid for horiz faces, picture-frame for walls (avoids blocking floor clicks) */}
      {isHoriz ? (
        <mesh
          geometry={hitGeo}
          material={mHit}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          onClick={onClick}
          onContextMenu={onCtx}
        />
      ) : (
        <PreviewPictureFrameHitbox
          faceW={isNS ? nW : PANEL_THICK + 0.03}
          faceH={nH}
          faceD={isNS ? PANEL_THICK + 0.03 : nD}
          material={mHit}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
          onClick={onClick}
          onContextMenu={onCtx}
        />
      )}

      {/* ★ TRUE 1:1 visual — ContainerSkin's FaceVisual, not a Mini clone */}
      {surface === "Open"
        ? <mesh geometry={hitGeo} material={mOpen} />
        : <FaceVisual
            surface={surface}
            colPitch={nW}
            rowPitch={nD}
            vHeight={nH}
            isNS={isNS}
            isEW={isEW}
            isHoriz={isHoriz}
          />
      }

      {/* X-ray overlay — whitens camera-facing solid walls to semi-transparent */}
      {xray && surface !== 'Open' && (
        <mesh geometry={hitGeo} material={mXrayMask} renderOrder={20} raycast={nullRaycast} />
      )}

      {/* Hover outline — wireframe edge, no solid fill that would occlude geometry */}
      {(hovered || isMenuHighlighted) && (
        <lineSegments
          geometry={getEdges(
            (isNS ? nW : isEW ? PANEL_THICK : nW) + 0.04,
            (isHoriz ? PANEL_THICK : nH) + 0.04,
            (isNS ? PANEL_THICK : nD) + 0.04,
          )}
          material={mEdgeOutline}
          renderOrder={10}
          raycast={nullRaycast}
        />
      )}
    </group>
  );
}

// ── GhostNeighbor — faint transparent proxy at real proportions ──

function GhostNeighbor({ position, nW, nH, nD }: {
  position: [number, number, number]; nW: number; nH: number; nD: number;
}) {
  return (
    <group position={position}>
      <mesh geometry={getBox(nW * 0.98, nH * 0.98, nD * 0.98)} material={mGhostFill} />
      <lineSegments>
        <primitive object={getEdges(nW * 0.98, nH * 0.98, nD * 0.98)} attach="geometry" />
        <primitive object={mGhostEdge} attach="material" />
      </lineSegments>
    </group>
  );
}

// ── CubeScene ──────────────────────────────────────────────────

function CubeScene({ containerId, voxelIndex, overrideFaces, bayGroupIndices }: {
  containerId: string; voxelIndex: number;
  overrideFaces?: Partial<VoxelFaces>;
  bayGroupIndices?: number[];
}) {
  const voxel = useStore((s) => s.containers[containerId]?.voxelGrid?.[voxelIndex]);
  const voxelGrid = useStore((s) => s.containers[containerId]?.voxelGrid);
  const containerSize = useStore((s) => s.containers[containerId]?.size);
  const setVoxelFace = useStore((s) => s.setVoxelFace);
  const activeBrush = useStore((s) => s.activeBrush);
  const setSelectedFace = useStore((s) => s.setSelectedFace);
  const openVoxelContextMenu = useStore((s) => s.openVoxelContextMenu);

  // Dynamic voxel proportions — varies by position (body vs extension)
  const dims = containerSize ? CONTAINER_DIMENSIONS[containerSize] : { length: 12.19, width: 2.44, height: 2.90 };
  const bodyColPitch = dims.length / (VOXEL_COLS - 2);
  const bodyRowPitch = dims.width / (VOXEL_ROWS - 2);

  // Bay group: compute merged dimensions spanning all voxels
  const { nW, nH, nD } = useMemo(() => {
    const indices = bayGroupIndices && bayGroupIndices.length > 1 ? bayGroupIndices : [voxelIndex];
    let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
    for (const idx of indices) {
      const c = idx % VOXEL_COLS;
      const r = Math.floor(idx / VOXEL_COLS) % VOXEL_ROWS;
      if (c < minCol) minCol = c;
      if (c > maxCol) maxCol = c;
      if (r < minRow) minRow = r;
      if (r > maxRow) maxRow = r;
    }
    // Sum widths across columns
    let w = 0;
    for (let c = minCol; c <= maxCol; c++) w += (c === 0 || c === VOXEL_COLS - 1) ? dims.height : bodyColPitch;
    // Sum depths across rows
    let d = 0;
    for (let r = minRow; r <= maxRow; r++) d += (r === 0 || r === VOXEL_ROWS - 1) ? dims.height : bodyRowPitch;
    return { nW: w, nH: dims.height, nD: d };
  }, [voxelIndex, bayGroupIndices, dims.height, bodyColPitch, bodyRowPitch]);

  const isEmptyVoxel = !voxel || !voxel.active;

  // Face configs — EXPLODED outward 0.1 from cube surface for click accessibility
  const EX = 0.1;
  const faceConfigs = useMemo(() => [
    { face: "top"    as keyof VoxelFaces, position: [0,  nH / 2 + EX, 0]             as [number,number,number], isNS: false, isEW: false, isHoriz: true  },
    { face: "bottom" as keyof VoxelFaces, position: [0, -nH / 2 - EX, 0]             as [number,number,number], isNS: false, isEW: false, isHoriz: true  },
    { face: "n"      as keyof VoxelFaces, position: [0,  0,           -nD / 2 - EX]   as [number,number,number], isNS: true,  isEW: false, isHoriz: false },
    { face: "s"      as keyof VoxelFaces, position: [0,  0,            nD / 2 + EX]   as [number,number,number], isNS: true,  isEW: false, isHoriz: false },
    { face: "e"      as keyof VoxelFaces, position: [ nW / 2 + EX, 0, 0]             as [number,number,number], isNS: false, isEW: true,  isHoriz: false },
    { face: "w"      as keyof VoxelFaces, position: [-nW / 2 - EX, 0, 0]             as [number,number,number], isNS: false, isEW: true,  isHoriz: false },
  ], [nW, nH, nD]);

  // Neighbor offsets for ghost context
  const neighbors = useMemo(() => {
    if (!voxelGrid) return [];
    const col = voxelIndex % VOXEL_COLS;
    const row = Math.floor(voxelIndex / VOXEL_COLS);
    const GAP = 0.04;
    const offsets: { dc: number; dr: number; pos: [number, number, number] }[] = [
      { dc:  0, dr: -1, pos: [0, 0, -(nD + GAP)] },
      { dc:  0, dr:  1, pos: [0, 0, (nD + GAP)] },
      { dc:  1, dr:  0, pos: [(nW + GAP), 0, 0] },
      { dc: -1, dr:  0, pos: [-(nW + GAP), 0, 0] },
    ];
    const result: { pos: [number, number, number] }[] = [];
    for (const n of offsets) {
      const nc = col + n.dc;
      const nr = row + n.dr;
      if (nc < 0 || nc >= VOXEL_COLS || nr < 0 || nr >= VOXEL_ROWS) continue;
      const ni = nr * VOXEL_COLS + nc;
      if (voxelGrid[ni]?.active) {
        result.push({ pos: n.pos });
      }
    }
    return result;
  }, [voxelGrid, voxelIndex, nW, nD]);

  // 2-Voxel stair parts — render actual StairMesh geometry
  if (voxel?.stairPart === 'lower' || voxel?.stairPart === 'upper') {
    return (
      <>
        <ambientLight intensity={0.9} />
        <directionalLight position={[2, 4, 3]} intensity={0.6} />
        <StairMesh
          voxW={nW} voxD={nD} voxH={nH}
          ascending={voxel.stairAscending ?? 'n'}
          faces={voxel.faces}
          stairPart={voxel.stairPart}
        />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} rotateSpeed={0.7} />
      </>
    );
  }

  // Empty/inactive voxels show a dashed bounding box
  if (isEmptyVoxel) {
    return (
      <>
        <ambientLight intensity={0.9} />
        <directionalLight position={[4, 6, 3]} intensity={0.8} />
        <directionalLight position={[-3, 2, -4]} intensity={0.35} />

        {neighbors.map((n, i) => (
          <GhostNeighbor key={i} position={n.pos} nW={nW} nH={nH} nD={nD} />
        ))}

        <lineSegments renderOrder={1}>
          <primitive object={getEdges(nW, nH, nD)} attach="geometry" />
          <primitive object={mDashedPreview} attach="material" />
        </lineSegments>

        <mesh>
          <boxGeometry args={[nW, nH, nD]} />
          <meshBasicMaterial color={0x06b6d4} transparent opacity={0.04} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>

        <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} rotateSpeed={0.7} />
      </>
    );
  }

  // Apply overrideFaces on top of raw voxel.faces — overrides replace culled/adjacent faces with 'Open'
  const rawFaces = voxel!.faces;
  const faces: VoxelFaces = overrideFaces
    ? { ...rawFaces, ...Object.fromEntries(Object.entries(overrideFaces).filter(([, v]) => v !== undefined)) } as VoxelFaces
    : rawFaces;

  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 3]} intensity={0.8} />
      <directionalLight position={[-3, 2, -4]} intensity={0.35} />

      {neighbors.map((n, i) => (
        <GhostNeighbor key={i} position={n.pos} nW={nW} nH={nH} nD={nD} />
      ))}

      <group>
        <lineSegments renderOrder={1}>
          <primitive object={getEdges(nW, nH, nD)} attach="geometry" />
          <primitive object={mEdgeDark} attach="material" />
        </lineSegments>

        {faceConfigs.map((config) => (
          <PreviewFace
            key={config.face}
            face={config.face}
            position={config.position}
            nW={nW} nH={nH} nD={nD}
            isNS={config.isNS}
            isEW={config.isEW}
            isHoriz={config.isHoriz}
            surface={faces[config.face]}
            xray={config.face === 'n' || config.face === 'w'}
            containerId={containerId}
            voxelIndex={voxelIndex}
            onCycle={() => {
              // Always select the face
              setSelectedFace(config.face);
              // If active brush, also apply it
              if (activeBrush) {
                if (bayGroupIndices && bayGroupIndices.length > 1) {
                  for (const bi of bayGroupIndices) setVoxelFace(containerId, bi, config.face, activeBrush);
                } else {
                  setVoxelFace(containerId, voxelIndex, config.face, activeBrush);
                }
              }
            }}
            onContextMenu={(e: ThreeEvent<MouseEvent>) => {
              openVoxelContextMenu(
                (e.nativeEvent as MouseEvent).clientX,
                (e.nativeEvent as MouseEvent).clientY,
                containerId, voxelIndex, config.face
              );
            }}
          />
        ))}

        {voxel!.voxelType === 'stairs' && (
          <StairMesh
            voxW={nW} voxD={nD} voxH={nH}
            ascending={voxel!.stairAscending ?? 'n'}
            faces={faces}
            stairPart={voxel!.stairPart}
          />
        )}
      </group>

      {/* Dimension labels (voxel cell dimensions) */}
      <Html position={[0, -nH / 2 - 0.5, nD / 2 + EX + 0.15]} center style={DIM_LABEL_STYLE}>
        {nW.toFixed(1)}m
      </Html>
      <Html position={[nW / 2 + EX + 0.15, -nH / 2 - 0.5, 0]} center style={DIM_LABEL_STYLE}>
        {nD.toFixed(1)}m
      </Html>
      <Html position={[-nW / 2 - EX - 0.3, 0, nD / 2 + EX + 0.15]} center style={DIM_LABEL_STYLE}>
        {nH.toFixed(1)}m
      </Html>

      <OrbitControls enableZoom={false} enablePan={false} autoRotate={false} rotateSpeed={0.7} />
    </>
  );
}

// ── Public Export ───────────────────────────────────────────────

export default function VoxelPreview3D({ containerId, voxelIndex, overrideFaces, bayGroupIndices }: {
  containerId: string; voxelIndex: number;
  overrideFaces?: Partial<VoxelFaces>;
  bayGroupIndices?: number[];
}) {
  return (
    <div style={{
      width: "100%", aspectRatio: "1.6 / 1",
      borderRadius: "8px", overflow: "hidden",
      background: "var(--surface-alt, #f1f5f9)", border: "1px solid var(--border, #e2e8f0)", position: "relative",
    }}>
      <Canvas
        orthographic
        camera={{ position: [3, 3.5, 5], zoom: 30, near: -100, far: 100 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "transparent" }}
        onPointerMissed={() => {
          useStore.getState().setHoveredPreviewFace(null);
        }}
      >
        <CubeScene containerId={containerId} voxelIndex={voxelIndex} overrideFaces={overrideFaces} bayGroupIndices={bayGroupIndices} />
      </Canvas>
      {/* Hint text removed — too busy */}
    </div>
  );
}

/**
 * GroupedVoxelPreview — Shows merged dimensions for a bay group (Simple mode).
 * Computes the bounding box of the selected voxel indices and displays combined size.
 */
export function GroupedVoxelPreview({ containerId, indices }: { containerId: string; indices: number[] }) {
  const containerSize = useStore((s) => s.containers[containerId]?.size);
  if (!containerSize || indices.length === 0) return null;

  const dims = CONTAINER_DIMENSIONS[containerSize];
  const bodyColPitch = dims.length / (VOXEL_COLS - 2);
  const bodyRowPitch = dims.width / (VOXEL_ROWS - 2);

  // Compute bounding box of selected indices
  let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
  for (const idx of indices) {
    const col = idx % VOXEL_COLS;
    const row = Math.floor(idx / VOXEL_COLS) % VOXEL_ROWS;
    if (col < minCol) minCol = col;
    if (col > maxCol) maxCol = col;
    if (row < minRow) minRow = row;
    if (row > maxRow) maxRow = row;
  }

  // Compute merged dimensions
  const colSpan = maxCol - minCol + 1;
  const rowSpan = maxRow - minRow + 1;
  const hasHaloCol = minCol === 0 || maxCol === VOXEL_COLS - 1;
  const hasHaloRow = minRow === 0 || maxRow === VOXEL_ROWS - 1;

  const mergedW = hasHaloCol
    ? (colSpan - 1) * bodyColPitch + dims.height  // one halo col + body cols
    : colSpan * bodyColPitch;
  const mergedD = hasHaloRow
    ? (rowSpan - 1) * bodyRowPitch + dims.height
    : rowSpan * bodyRowPitch;
  const mergedH = dims.height;

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
      padding: "8px 12px",
      background: "var(--surface-alt, #f8fafc)",
      border: "1px solid var(--border, #e2e8f0)",
      borderRadius: 8, margin: "0 auto", maxWidth: 200,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-main)", fontFamily: "monospace" }}>
        {mergedW.toFixed(1)}m × {mergedD.toFixed(1)}m × {mergedH.toFixed(1)}m
      </div>
      <div style={{ fontSize: 9, color: "var(--text-muted)" }}>
        {indices.length} voxels · {colSpan}×{rowSpan} grid
      </div>
    </div>
  );
}
