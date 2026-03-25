"use client";

/**
 * DebugOverlay.tsx — Wireframe hitbox visualization
 *
 * Renders bay/voxel boundary wireframes + floor quadrant X-lines.
 * Floor hitboxes are made visible by toggling ContainerSkin's mHit material
 * in debug mode (see ContainerSkin useEffect on debugMode).
 * Simple mode: bay-group AABBs (15 groups) + per-voxel wireframes (32 boxes).
 * Detail mode: per-voxel wireframes (32 individual boxes).
 * Both modes: floor quadrant X-lines showing wall hitbox zones.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { nullRaycast } from "@/utils/nullRaycast";
import { computeBayGroups } from "@/config/bayGroups";
import { getVoxelLayout } from "@/components/objects/ContainerSkin";

// Bay group boundary line materials
const bayBodyLineMat = new THREE.LineBasicMaterial({
  color: 0xff2222, transparent: true, opacity: 0.8, depthTest: false,
});
const bayExtLineMat = new THREE.LineBasicMaterial({
  color: 0xff8800, transparent: true, opacity: 0.6, depthTest: false,
});
// Per-voxel boundary line materials (thinner, lower opacity than bay groups)
const voxBodyLineMat = new THREE.LineBasicMaterial({
  color: 0xff4444, transparent: true, opacity: 0.4, depthTest: false,
});
const voxExtLineMat = new THREE.LineBasicMaterial({
  color: 0xffaa44, transparent: true, opacity: 0.3, depthTest: false,
});
// Floor quadrant X-line material (yellow-green, visible on grass)
const quadLineMat = new THREE.LineBasicMaterial({
  color: 0xcccc00, transparent: true, opacity: 0.6, depthTest: false,
});

// EdgesGeometry cache
const _edgeCache = new Map<string, THREE.EdgesGeometry>();
function getEdges(w: number, h: number, d: number): THREE.EdgesGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_edgeCache.has(k)) {
    _edgeCache.set(k, new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)));
  }
  return _edgeCache.get(k)!;
}

// Floor quadrant X-line geometry cache: two diagonal lines forming an X
const _quadCache = new Map<string, THREE.BufferGeometry>();
function getQuadLines(w: number, d: number): THREE.BufferGeometry {
  const k = `q_${w.toFixed(3)}_${d.toFixed(3)}`;
  if (!_quadCache.has(k)) {
    const hw = w / 2, hd = d / 2;
    // Two crossing lines: corner-to-corner forming an X
    const verts = new Float32Array([
      -hw, 0, -hd,   hw, 0, hd,   // diagonal 1
       hw, 0, -hd,  -hw, 0, hd,   // diagonal 2
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    _quadCache.set(k, geo);
  }
  return _quadCache.get(k)!;
}

// Floor tile outline cache: rectangle at floor level
const _floorEdgeCache = new Map<string, THREE.BufferGeometry>();
function getFloorOutline(w: number, d: number): THREE.BufferGeometry {
  const k = `fo_${w.toFixed(3)}_${d.toFixed(3)}`;
  if (!_floorEdgeCache.has(k)) {
    const hw = w / 2, hd = d / 2;
    const verts = new Float32Array([
      -hw, 0, -hd,   hw, 0, -hd,
       hw, 0, -hd,   hw, 0,  hd,
       hw, 0,  hd,  -hw, 0,  hd,
      -hw, 0,  hd,  -hw, 0, -hd,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    _floorEdgeCache.set(k, geo);
  }
  return _floorEdgeCache.get(k)!;
}

const BAY_GROUPS = computeBayGroups();
function ContainerDebugWireframe({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  const isSimpleMode = useStore((s) => s.designComplexity === 'simple');
  const inspectorView = useStore((s) => s.inspectorView);
  if (!grid) return null;

  const vHeight = dims.height;
  // Floor quadrants at floor level or ceiling level based on inspector view toggle
  const quadY = inspectorView === 'ceiling' ? vHeight + 0.02 : 0.02;

  // Bay group wireframes (Simple mode only) — all 15 groups
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

  // Per-voxel wireframes — ALL 32 voxels (both Simple and Detail modes)
  const voxels = useMemo(() => {
    const TOTAL = VOXEL_ROWS * VOXEL_COLS;
    const result: { px: number; pz: number; w: number; d: number; isExt: boolean; isBody: boolean }[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const row = Math.floor(i / VOXEL_COLS);
      const col = i % VOXEL_COLS;
      const layout = getVoxelLayout(col, row, dims);
      const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
      const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
      const isBody = !isHaloCol && !isHaloRow;
      result.push({ px: layout.px, pz: layout.pz, w: layout.voxW, d: layout.voxD, isExt: !isBody, isBody });
    }
    return result;
  }, [grid, dims]);

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
      {/* Bay group boundary wireframes (Simple mode — thicker lines) */}
      {bayBoxes?.map(box => (
        <lineSegments
          key={box.id}
          position={[box.cx, box.h / 2, box.cz]}
          geometry={getEdges(box.w, box.h, box.d)}
          material={box.isBody ? bayBodyLineMat : bayExtLineMat}
          renderOrder={100}
          raycast={nullRaycast}
        />
      ))}
      {/* Per-voxel wireframes — all 32 voxels */}
      {voxels.map((v, i) => (
        <lineSegments
          key={`v${i}`}
          position={[v.px, vHeight / 2, v.pz]}
          geometry={getEdges(v.w, vHeight, v.d)}
          material={isSimpleMode
            ? (v.isExt ? voxExtLineMat : voxBodyLineMat)
            : (v.isExt ? bayExtLineMat : bayBodyLineMat)}
          renderOrder={isSimpleMode ? 99 : 100}
          raycast={nullRaycast}
        />
      ))}
      {/* Floor quadrant X-lines + outlines for body voxels (rows 1-2, cols 1-6) */}
      {voxels.map((v, i) => {
        if (!v.isBody) return null;
        return (
          <group key={`fq${i}`}>
            {/* X-line showing 4 wall quadrants */}
            <lineSegments
              position={[v.px, quadY, v.pz]}
              geometry={getQuadLines(v.w, v.d)}
              material={quadLineMat}
              renderOrder={101}
              raycast={nullRaycast}
            />
            {/* Floor tile outline */}
            <lineSegments
              position={[v.px, quadY, v.pz]}
              geometry={getFloorOutline(v.w, v.d)}
              material={quadLineMat}
              renderOrder={101}
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
