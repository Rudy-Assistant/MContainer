"use client";

/**
 * DebugOverlay.tsx — Wireframe hitbox visualization
 *
 * Renders wireframe boxes for all active voxels using getVoxelLayout positions.
 * Simple mode: merged bay-group AABBs (15 groups).
 * Detail mode: per-voxel wireframes (32 individual boxes).
 * Body = red, extension = orange. Overlays on top of normal ContainerSkin.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { nullRaycast } from "@/utils/nullRaycast";
import { computeBayGroups } from "@/config/bayGroups";
import { getVoxelLayout } from "@/components/objects/ContainerSkin";

// Shared wireframe materials
const bodyMat = new THREE.MeshBasicMaterial({
  color: 0xff2222, wireframe: true, transparent: true, opacity: 0.6,
  depthTest: false, depthWrite: false, side: THREE.DoubleSide,
});
const extMat = new THREE.MeshBasicMaterial({
  color: 0xff8800, wireframe: true, transparent: true, opacity: 0.4,
  depthTest: false, depthWrite: false, side: THREE.DoubleSide,
});

// Geometry cache
const _geoCache = new Map<string, THREE.BoxGeometry>();
function getBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_geoCache.has(k)) _geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return _geoCache.get(k)!;
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
  const bayBoxes = useMemo(() => {
    if (!isSimpleMode) return null;
    return BAY_GROUPS.map(group => {
      const hasActive = group.voxelIndices.some(idx => grid[idx]?.active);
      if (!hasActive) return null;

      // Compute merged AABB from constituent voxel positions
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

  // ── Detail mode: one wireframe per active voxel ──
  const voxels = useMemo(() => {
    if (isSimpleMode) return null;
    const result: { px: number; pz: number; w: number; d: number; isExt: boolean; idx: number }[] = [];
    for (let i = 0; i < grid.length; i++) {
      if (!grid[i]?.active) continue;
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
      {/* Simple mode: bay group wireframes */}
      {bayBoxes?.map(box => (
        <mesh
          key={box.id}
          position={[box.cx, box.h / 2, box.cz]}
          geometry={getBox(box.w, box.h, box.d)}
          material={box.isBody ? bodyMat : extMat}
          renderOrder={100}
          raycast={nullRaycast}
        />
      ))}
      {/* Detail mode: per-voxel wireframes */}
      {voxels?.map((v, i) => (
        <mesh
          key={i}
          position={[v.px, vHeight / 2, v.pz]}
          geometry={getBox(v.w, vHeight, v.d)}
          material={v.isExt ? extMat : bodyMat}
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
