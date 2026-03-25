"use client";

/**
 * DebugOverlay.tsx — Wireframe hitbox visualization
 *
 * Uses EdgesGeometry + lineSegments for clean box outlines (12 edges per box).
 * Simple mode: merged bay-group AABBs (15 groups).
 * Detail mode: per-voxel wireframes (up to 32 individual boxes).
 * Body = red, extension = orange. Overlays on top of normal ContainerSkin.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { nullRaycast } from "@/utils/nullRaycast";
import { computeBayGroups } from "@/config/bayGroups";
import { getVoxelLayout } from "@/components/objects/ContainerSkin";

// Line materials — clean edges only, no triangle diagonals
const bodyLineMat = new THREE.LineBasicMaterial({
  color: 0xff2222, transparent: true, opacity: 0.8, depthTest: false,
});
const extLineMat = new THREE.LineBasicMaterial({
  color: 0xff8800, transparent: true, opacity: 0.6, depthTest: false,
});

// EdgesGeometry cache — produces only the 12 outer edges of each box
const _edgeCache = new Map<string, THREE.EdgesGeometry>();
function getEdges(w: number, h: number, d: number): THREE.EdgesGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_edgeCache.has(k)) {
    _edgeCache.set(k, new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)));
  }
  return _edgeCache.get(k)!;
}

// Bay groups — computed once
const BAY_GROUPS = computeBayGroups();

function ContainerDebugWireframe({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  const isSimpleMode = useStore((s) => s.designComplexity === 'simple');
  if (!grid) return null;

  const vHeight = dims.height;

  // ── Simple mode: one wireframe per bay group (merged AABB) ──
  // Renders ALL 15 bay groups regardless of active state — shows hitbox boundaries
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
      const isBody = group.role === 'body';
      return {
        cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2,
        w: maxX - minX, d: maxZ - minZ,
        h: vHeight, isBody, id: group.id,
      };
    }).filter(Boolean) as { cx: number; cz: number; w: number; d: number; h: number; isBody: boolean; id: string }[];
  }, [isSimpleMode, grid, dims, vHeight]);

  // ── Detail mode: one wireframe per voxel (all 32) ──
  // Renders ALL voxels regardless of active state — shows complete hitbox grid
  const voxels = useMemo(() => {
    if (isSimpleMode) return null;
    const TOTAL = VOXEL_ROWS * VOXEL_COLS; // 32
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

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
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
