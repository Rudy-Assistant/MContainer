"use client";

/**
 * IsoEditor.tsx — Live-Synced Isometric Mini-Preview
 *
 * Canvas contains EXACTLY two things:
 *   1. <IsoSkeleton>  — bare steel frame (floor plate, roof plate, 4 corner posts, perimeter beam)
 *   2. <ContainerSkin> — the IDENTICAL high-fidelity surface renderer used in the main 3D scene
 *
 * LIVE SYNC:
 *   - Reads container from Zustand store (not props) for instant reactivity inside R3F Canvas
 *   - Camera angle syncs from main scene via store's cameraAzimuth/cameraElevation
 *   - User can orbit independently; "Link" toggle re-enables sync
 */

import { useLayoutEffect, useRef, useState, useCallback, useMemo } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  ContainerSize,
  CONTAINER_DIMENSIONS,
  VOXEL_COLS,
  VOXEL_ROWS,
} from "@/types/container";
import { createDefaultVoxelGrid } from "@/types/factories";
import { useStore } from "@/store/useStore";
import { Text } from "@react-three/drei";
import ContainerSkin from "@/components/objects/ContainerSkin";

// ═══════════════════════════════════════════════════════════
// SKELETON MATERIALS — module scope, never re-created
// ═══════════════════════════════════════════════════════════

const mSteelFrame = new THREE.MeshStandardMaterial({
  color: "#2e3b45", metalness: 0.85, roughness: 0.25,
});
const mFloor = new THREE.MeshStandardMaterial({
  color: "#8d6e63", metalness: 0.02, roughness: 0.88,
});
const mRoof = new THREE.MeshStandardMaterial({
  color: "#607d8b", metalness: 0.65, roughness: 0.42,
});

const POST = 0.08; // corner post cross-section
const BEAM = 0.05; // perimeter top beam cross-section

// ═══════════════════════════════════════════════════════════
// CAMERA SYNC — reads main scene angles from store
// ═══════════════════════════════════════════════════════════

function CameraSync({
  size,
  hasHaloRows,
  hasHaloCols,
  linked,
}: {
  size: ContainerSize;
  hasHaloRows: boolean;
  hasHaloCols: boolean;
  linked: boolean;
}) {
  const { camera } = useThree();
  const dims = CONTAINER_DIMENSIONS[size];
  const azimuth = useStore((s) => s.cameraAzimuth);
  const elevation = useStore((s) => s.cameraElevation);

  // Dynamic zoom — compute from actual bounding volume to fill the preview canvas
  useLayoutEffect(() => {
    if ("zoom" in camera) {
      const colPitch = dims.length / 6;
      const expandedLen = hasHaloCols ? dims.length + colPitch * 2 : dims.length;
      const expandedWid = hasHaloRows ? dims.width + 1.22 * 2 : dims.width;
      // Isometric projection: effective screen extent ≈ max(length, width) * sqrt(2)/2 + height
      const isoExtent = Math.max(expandedLen, expandedWid) * 0.85 + dims.height * 0.35;
      // Canvas is ~352px wide (sidebar 384 - padding). Target 90% fill.
      const zoom = 170 / isoExtent;
      (camera as THREE.OrthographicCamera).zoom = Math.max(8, Math.min(40, zoom));
      camera.updateProjectionMatrix();
    }
  }, [size, hasHaloRows, hasHaloCols, camera, dims]);

  // Sync camera position from main scene angles
  useLayoutEffect(() => {
    if (!linked) return;

    const colPitch = dims.length / 6;
    const expandedLen = hasHaloCols ? dims.length + colPitch * 2 : dims.length;
    const expandedWid = hasHaloRows ? dims.width + 1.22 * 2 : dims.width;
    const maxDim = Math.max(expandedLen, expandedWid);
    const dist = maxDim * 0.95;

    // Convert spherical (azimuth, elevation) to Cartesian
    const x = dist * Math.sin(elevation) * Math.sin(azimuth);
    const y = dist * Math.cos(elevation);
    const z = dist * Math.sin(elevation) * Math.cos(azimuth);

    camera.position.set(x, y, z);
    camera.lookAt(0, dims.height / 2, 0);
    camera.updateProjectionMatrix();
  }, [azimuth, elevation, linked, dims, hasHaloRows, hasHaloCols, camera]);

  return null;
}

// ═══════════════════════════════════════════════════════════
// ISO SKELETON — thin steel frame, no cladding whatsoever
// ═══════════════════════════════════════════════════════════

function IsoSkeleton({
  size,
  hideRoof,
}: {
  size: ContainerSize;
  hideRoof: boolean;
}) {
  const { length, width, height } = CONTAINER_DIMENSIONS[size];
  // ★ Match ContainerMesh convention: X=length, Z=width
  const hl = length / 2;
  const hw = width / 2;

  const corners: [number, number][] = [
    [hl, hw], [hl, -hw],
    [-hl, hw], [-hl, -hw],
  ];

  return (
    <group>
      {/* Floor plate — [length, thin, width] matches ContainerMesh */}
      <mesh position={[0, 0, 0]} receiveShadow material={mFloor}>
        <boxGeometry args={[length, 0.04, width]} />
      </mesh>

      {/* Roof plate */}
      {!hideRoof && (
        <mesh position={[0, height, 0]} castShadow material={mRoof}>
          <boxGeometry args={[length, 0.04, width]} />
        </mesh>
      )}

      {/* 4 corner posts */}
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, height / 2, z]} material={mSteelFrame} castShadow>
          <boxGeometry args={[POST, height + 0.04, POST]} />
        </mesh>
      ))}

      {/* Long beams along X (length) at Z = ±hw */}
      <mesh position={[0, height, -hw]} material={mSteelFrame}>
        <boxGeometry args={[length, BEAM, BEAM]} />
      </mesh>
      <mesh position={[0, height, hw]} material={mSteelFrame}>
        <boxGeometry args={[length, BEAM, BEAM]} />
      </mesh>

      {/* Short beams along Z (width) at X = ±hl */}
      <mesh position={[hl, height, 0]} material={mSteelFrame}>
        <boxGeometry args={[BEAM, BEAM, width]} />
      </mesh>
      <mesh position={[-hl, height, 0]} material={mSteelFrame}>
        <boxGeometry args={[BEAM, BEAM, width]} />
      </mesh>
    </group>
  );
}

// ═══════════════════════════════════════════════════════════
// ISO CANVAS — the isolated R3F scene, reads from STORE
// ═══════════════════════════════════════════════════════════

function IsoEditorCanvas({
  containerId,
  hideRoof,
  hideSkin,
  linked,
}: {
  containerId: string;
  hideRoof: boolean;
  hideSkin: boolean;
  linked: boolean;
}) {
  // Read container from store for LIVE reactivity inside Canvas tree
  const container = useStore((s) => s.containers[containerId]);
  if (!container) return null;

  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid ?? createDefaultVoxelGrid();

  // Detect active halo rows (0, 3) and halo columns (0, 7) for camera zoom
  const hasHaloRows = grid.some((v, idx) => {
    const row = Math.floor((idx % (VOXEL_ROWS * VOXEL_COLS)) / VOXEL_COLS);
    return v.active && (row === 0 || row === VOXEL_ROWS - 1);
  });
  const hasHaloCols = grid.some((v, idx) => {
    const col = idx % VOXEL_COLS;
    return v.active && (col === 0 || col === VOXEL_COLS - 1);
  });

  return (
    <>
      <CameraSync
        size={container.size}
        hasHaloRows={hasHaloRows}
        hasHaloCols={hasHaloCols}
        linked={linked}
      />

      {/* Studio lighting — matches main 3D scene quality */}
      <ambientLight intensity={0.85} />
      <directionalLight position={[10, 14, 8]} intensity={1.4} castShadow shadow-mapSize={[512, 512]} />
      <directionalLight position={[-8, 6, -6]} intensity={0.5} />
      <directionalLight position={[0, -4, 0]} intensity={0.2} />

      <group>
        {/* 1. Bare steel skeleton — floor/roof/posts/beams only, zero cladding */}
        <IsoSkeleton size={container.size} hideRoof={hideRoof} />

        {/* 2. ContainerSkin — identical component used in the main 3D scene.
              key={containerId} forces full remount when selected container changes,
              preventing stale R3F fiber tree state. */}
        {!hideSkin && <ContainerSkin key={containerId} container={container} animated={false} />}

        {/* 3. Orientation labels — "FRONT" at +X (A-End), "BACK" at -X */}
        <Text
          position={[dims.length / 2 + 0.4, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.28}
          color="#2563eb"
          fontWeight={700}
          anchorX="center"
          anchorY="middle"
        >
          FRONT
        </Text>
        <Text
          position={[-dims.length / 2 - 0.4, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.22}
          color="#94a3b8"
          fontWeight={600}
          anchorX="center"
          anchorY="middle"
        >
          BACK
        </Text>
      </group>

      <OrbitControls
        enableZoom
        enablePan={false}
        autoRotate={false}
        minZoom={5}
        maxZoom={90}
        target={[0, dims.height / 2, 0]}
        rotateSpeed={0.6}
        zoomSpeed={0.8}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// LAYER TOGGLE BUTTON
// ═══════════════════════════════════════════════════════════

function LayerBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 8px",
        borderRadius: "5px",
        border: active
          ? "1px solid rgba(255,193,7,0.6)"
          : "1px solid rgba(255,255,255,0.1)",
        background: active ? "rgba(255,193,7,0.15)" : "rgba(255,255,255,0.05)",
        color: active ? "#ffc107" : "#94a3b8",
        fontSize: "10px", fontWeight: 600, cursor: "pointer",
        transition: "all 120ms ease", letterSpacing: "0.03em",
      }}
    >
      {active ? `${label} Hidden` : `Hide ${label}`}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════
// PUBLIC EXPORT
// ═══════════════════════════════════════════════════════════

export default function IsoEditor({ containerId }: { containerId: string }) {
  const [hideRoof, setHideRoof] = useState(false);
  const [hideSkin, setHideSkin] = useState(false);
  const [linked, setLinked] = useState(true);
  const saveContainerToLibrary = useStore((s) => s.saveContainerToLibrary);
  const container = useStore((s) => s.containers[containerId]);
  const containerLabel = container?.name || "Container";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {/* Layer toggles + save + sync toggle */}
      <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
        <span style={{
          fontSize: "10px", color: "#64748b", fontWeight: 600,
          letterSpacing: "0.06em", textTransform: "uppercase", marginRight: "2px",
        }}>
          Layers
        </span>
        <LayerBtn label="Roof" active={hideRoof} onClick={() => setHideRoof((v) => !v)} />
        <LayerBtn label="Skin" active={hideSkin} onClick={() => setHideSkin((v) => !v)} />

        <div style={{ marginLeft: "auto", display: "flex", gap: "3px", alignItems: "center" }}>
          <button
            onClick={() => saveContainerToLibrary(containerId, containerLabel)}
            title="Save container to library"
            style={{
              padding: "3px 6px",
              borderRadius: "5px",
              border: "1px solid rgba(245,158,11,0.4)",
              background: "rgba(245,158,11,0.08)",
              color: "#f59e0b",
              fontSize: "10px", fontWeight: 600, cursor: "pointer",
              transition: "all 120ms ease",
              display: "flex", alignItems: "center", gap: "3px",
            }}
          >
            <svg viewBox="0 0 24 24" width={10} height={10} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              <line x1="12" y1="7" x2="12" y2="13" />
              <line x1="9" y1="10" x2="15" y2="10" />
            </svg>
          </button>
          <button
            onClick={() => setLinked((v) => !v)}
            title={linked ? "Camera synced to main view — click to unlink" : "Camera independent — click to sync"}
            style={{
              padding: "3px 8px",
              borderRadius: "5px",
              border: linked
                ? "1px solid rgba(37,99,235,0.5)"
                : "1px solid rgba(255,255,255,0.1)",
              background: linked ? "rgba(37,99,235,0.15)" : "rgba(255,255,255,0.05)",
              color: linked ? "#60a5fa" : "#94a3b8",
              fontSize: "10px", fontWeight: 600, cursor: "pointer",
              transition: "all 120ms ease", letterSpacing: "0.03em",
            }}
          >
            {linked ? "Synced" : "Free"}
          </button>
        </div>
      </div>

      {/* Mini canvas */}
      <div style={{
        width: "100%", height: "220px", borderRadius: "8px", overflow: "hidden",
        background: "#f1f5f9",
        border: "1px solid #e2e8f0",
        position: "relative",
      }}>
        <Canvas
          orthographic
          camera={{ position: [20, 14, 20], near: -200, far: 200 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
          style={{ background: "transparent" }}
        >
          <IsoEditorCanvas
            containerId={containerId}
            hideRoof={hideRoof}
            hideSkin={hideSkin}
            linked={linked}
          />
        </Canvas>
        <div style={{
          position: "absolute", bottom: "6px", right: "8px",
          fontSize: "9px", color: "#94a3b8", pointerEvents: "none",
          letterSpacing: "0.02em",
        }}>
          Drag to orbit · Click surface to select
        </div>
      </div>
    </div>
  );
}
