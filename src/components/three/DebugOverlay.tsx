"use client";

/**
 * DebugOverlay.tsx — Wireframe hitbox visualization
 *
 * Shows bay/voxel boundary boxes + floor-level hitbox regions.
 * Floor mode: shows floor center quads + N/S/E/W edge strips per voxel.
 * Ceiling mode: shows ceiling quads at roof level.
 * Simple mode: merged bay-group AABBs. Detail mode: per-voxel wireframes.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { nullRaycast } from "@/utils/nullRaycast";
import { computeBayGroups } from "@/config/bayGroups";
import { getVoxelLayout } from "@/components/objects/ContainerSkin";

// ── Bay/voxel boundary line materials ──
const bodyLineMat = new THREE.LineBasicMaterial({
  color: 0xff2222, transparent: true, opacity: 0.8, depthTest: false,
});
const extLineMat = new THREE.LineBasicMaterial({
  color: 0xff8800, transparent: true, opacity: 0.6, depthTest: false,
});

// ── Floor hitbox visualization materials (translucent flat quads) ──
const floorCenterMat = new THREE.MeshBasicMaterial({
  color: 0x4488ff, transparent: true, opacity: 0.15,
  depthTest: false, depthWrite: false, side: THREE.DoubleSide,
});
const floorEdgeNSMat = new THREE.MeshBasicMaterial({
  color: 0x44cc44, transparent: true, opacity: 0.25,
  depthTest: false, depthWrite: false, side: THREE.DoubleSide,
});
const floorEdgeEWMat = new THREE.MeshBasicMaterial({
  color: 0xcccc00, transparent: true, opacity: 0.25,
  depthTest: false, depthWrite: false, side: THREE.DoubleSide,
});
// Edge outline materials for floor hitbox borders
const floorCenterEdgeMat = new THREE.LineBasicMaterial({
  color: 0x4488ff, transparent: true, opacity: 0.6, depthTest: false,
});
const floorEdgeNSEdgeMat = new THREE.LineBasicMaterial({
  color: 0x44cc44, transparent: true, opacity: 0.6, depthTest: false,
});
const floorEdgeEWEdgeMat = new THREE.LineBasicMaterial({
  color: 0xcccc00, transparent: true, opacity: 0.6, depthTest: false,
});

// ── Geometry caches ──
const _edgeCache = new Map<string, THREE.EdgesGeometry>();
function getEdges(w: number, h: number, d: number): THREE.EdgesGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_edgeCache.has(k)) {
    _edgeCache.set(k, new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)));
  }
  return _edgeCache.get(k)!;
}

const _boxCache = new Map<string, THREE.BoxGeometry>();
function getBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_boxCache.has(k)) _boxCache.set(k, new THREE.BoxGeometry(w, h, d));
  return _boxCache.get(k)!;
}

const BAY_GROUPS = computeBayGroups();

// Hitbox dimensions matching ContainerSkin exactly
const EDGE_STRIP_DEPTH = 0.2;  // N/S/E/W edge strip thickness
const EDGE_STRIP_INSET = 0.1;  // Edge strip offset from voxel boundary
const CENTER_INSET = 0.4;      // Center quad inset from edges
const HITBOX_THICKNESS = 0.1;  // Vertical thickness of floor hitboxes

function ContainerDebugWireframe({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  const isSimpleMode = useStore((s) => s.designComplexity === 'simple');
  if (!grid) return null;

  const vHeight = dims.height;
  const vOffset = vHeight / 2;
  const FLOOR_Y = -vOffset + 0.05;

  // ── Bay group wireframes (Simple mode) ──
  const bayBoxes = useMemo(() => {
    if (!isSimpleMode) return null;
    return BAY_GROUPS.map(group => {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const idx of group.voxelIndices) {
        const row = Math.floor(idx / VOXEL_COLS);
        const col = idx % VOXEL_COLS;
        const layout = getVoxelLayout(col, row, dims);
        minX = Math.min(minX, layout.px - layout.voxW / 2);
        maxX = Math.max(maxX, layout.px + layout.voxW / 2);
        minZ = Math.min(minZ, layout.pz - layout.voxD / 2);
        maxZ = Math.max(maxZ, layout.pz + layout.voxD / 2);
      }
      return {
        cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2,
        w: maxX - minX, d: maxZ - minZ,
        h: vHeight, isBody: group.role === 'body', id: group.id,
      };
    });
  }, [isSimpleMode, grid, dims, vHeight]);

  // ── Per-voxel wireframes (Detail mode) ──
  const voxels = useMemo(() => {
    if (isSimpleMode) return null;
    const TOTAL = VOXEL_ROWS * VOXEL_COLS;
    const result: { px: number; pz: number; w: number; d: number; isExt: boolean; idx: number }[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const row = Math.floor(i / VOXEL_COLS);
      const col = i % VOXEL_COLS;
      const layout = getVoxelLayout(col, row, dims);
      const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
      const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
      result.push({ px: layout.px, pz: layout.pz, w: layout.voxW, d: layout.voxD, isExt: isHaloCol || isHaloRow, idx: i });
    }
    return result;
  }, [isSimpleMode, grid, dims]);

  // ── Floor hitbox quads for ALL 32 voxels (both modes) ──
  // These show the actual clickable regions at floor level
  const floorHitboxes = useMemo(() => {
    const TOTAL = VOXEL_ROWS * VOXEL_COLS;
    const result: { px: number; pz: number; voxW: number; voxD: number }[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const row = Math.floor(i / VOXEL_COLS);
      const col = i % VOXEL_COLS;
      const layout = getVoxelLayout(col, row, dims);
      result.push({ px: layout.px, pz: layout.pz, voxW: layout.voxW, voxD: layout.voxD });
    }
    return result;
  }, [dims]);

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
      {/* Bay group boundary wireframes (Simple mode) */}
      {bayBoxes?.map(box => (
        <lineSegments
          key={box.id}
          position={[box.cx, box.h / 2, box.cz]}
          geometry={getEdges(box.w, box.h, box.d)}
          material={box.isBody ? bodyLineMat : extLineMat}
          renderOrder={100}
          raycast={nullRaycast}
        />
      ))}
      {/* Per-voxel boundary wireframes (Detail mode) */}
      {voxels?.map((v, i) => (
        <lineSegments
          key={i}
          position={[v.px, vHeight / 2, v.pz]}
          geometry={getEdges(v.w, vHeight, v.d)}
          material={v.isExt ? extLineMat : bodyLineMat}
          renderOrder={100}
          raycast={nullRaycast}
        />
      ))}

      {/* ── Floor hitbox visualization (all 32 voxels) ── */}
      {floorHitboxes.map((h, i) => {
        const { px, pz, voxW, voxD } = h;
        return (
          <group key={`floor_${i}`} position={[px, FLOOR_Y, pz]}>
            {/* Center quad (floor/block selection) — blue */}
            <mesh
              geometry={getBox(voxW - CENTER_INSET, HITBOX_THICKNESS, voxD - CENTER_INSET)}
              material={floorCenterMat}
              renderOrder={101}
              raycast={nullRaycast}
            />
            <lineSegments
              geometry={getEdges(voxW - CENTER_INSET, HITBOX_THICKNESS, voxD - CENTER_INSET)}
              material={floorCenterEdgeMat}
              renderOrder={102}
              raycast={nullRaycast}
            />
            {/* N edge strip (north wall selection) — green */}
            <mesh
              position={[0, 0, -voxD / 2 + EDGE_STRIP_INSET]}
              geometry={getBox(voxW, HITBOX_THICKNESS, EDGE_STRIP_DEPTH)}
              material={floorEdgeNSMat}
              renderOrder={101}
              raycast={nullRaycast}
            />
            <lineSegments
              position={[0, 0, -voxD / 2 + EDGE_STRIP_INSET]}
              geometry={getEdges(voxW, HITBOX_THICKNESS, EDGE_STRIP_DEPTH)}
              material={floorEdgeNSEdgeMat}
              renderOrder={102}
              raycast={nullRaycast}
            />
            {/* S edge strip (south wall selection) — green */}
            <mesh
              position={[0, 0, +voxD / 2 - EDGE_STRIP_INSET]}
              geometry={getBox(voxW, HITBOX_THICKNESS, EDGE_STRIP_DEPTH)}
              material={floorEdgeNSMat}
              renderOrder={101}
              raycast={nullRaycast}
            />
            <lineSegments
              position={[0, 0, +voxD / 2 - EDGE_STRIP_INSET]}
              geometry={getEdges(voxW, HITBOX_THICKNESS, EDGE_STRIP_DEPTH)}
              material={floorEdgeNSEdgeMat}
              renderOrder={102}
              raycast={nullRaycast}
            />
            {/* E edge strip (east wall selection) — yellow */}
            <mesh
              position={[+voxW / 2 - EDGE_STRIP_INSET, 0, 0]}
              geometry={getBox(EDGE_STRIP_DEPTH, HITBOX_THICKNESS, voxD)}
              material={floorEdgeEWMat}
              renderOrder={101}
              raycast={nullRaycast}
            />
            <lineSegments
              position={[+voxW / 2 - EDGE_STRIP_INSET, 0, 0]}
              geometry={getEdges(EDGE_STRIP_DEPTH, HITBOX_THICKNESS, voxD)}
              material={floorEdgeEWEdgeMat}
              renderOrder={102}
              raycast={nullRaycast}
            />
            {/* W edge strip (west wall selection) — yellow */}
            <mesh
              position={[-voxW / 2 + EDGE_STRIP_INSET, 0, 0]}
              geometry={getBox(EDGE_STRIP_DEPTH, HITBOX_THICKNESS, voxD)}
              material={floorEdgeEWMat}
              renderOrder={101}
              raycast={nullRaycast}
            />
            <lineSegments
              position={[-voxW / 2 + EDGE_STRIP_INSET, 0, 0]}
              geometry={getEdges(EDGE_STRIP_DEPTH, HITBOX_THICKNESS, voxD)}
              material={floorEdgeEWEdgeMat}
              renderOrder={102}
              raycast={nullRaycast}
            />
          </group>
        );
      })}
    </group>
  );
}

export default function DebugOverlay() {
  const containers = useStore((s) => s.containers);
  return (
    <group>
      {Object.values(containers).map(c => (
        <ContainerDebugWireframe key={c.id} container={c} />
      ))}
    </group>
  );
}
