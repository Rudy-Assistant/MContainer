"use client";

/**
 * DebugOverlay.tsx — Wireframe hitbox visualization for voxels and bay groups
 *
 * Detail mode: one wireframe box per active voxel (32 max)
 * Simple mode: one wireframe box per bay group (15 groups) using merged AABBs
 * Body = red, extension = orange. Overlays on top of normal ContainerSkin.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { nullRaycast } from "@/utils/nullRaycast";
import { computeBayGroups, type BayGroup } from "@/config/bayGroups";
import { getVoxelLayout } from "@/components/objects/ContainerSkin";

// Shared wireframe materials (module-level singletons)
const bodyMat = new THREE.MeshBasicMaterial({
  color: 0xff2222,
  wireframe: true,
  transparent: true,
  opacity: 0.6,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const extMat = new THREE.MeshBasicMaterial({
  color: 0xff8800,
  wireframe: true,
  transparent: true,
  opacity: 0.4,
  depthTest: false,
  depthWrite: false,
  side: THREE.DoubleSide,
});

// Cache box geometries by dimension key
const _geoCache = new Map<string, THREE.BoxGeometry>();
function getBox(w: number, h: number, d: number): THREE.BoxGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_geoCache.has(k)) {
    _geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  }
  return _geoCache.get(k)!;
}

// Bay groups — computed once at module level
const BAY_GROUPS = computeBayGroups();

/** Compute merged AABB for a bay group's voxel indices */
function bayGroupAABB(group: BayGroup, dims: { length: number; width: number; height: number }) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const idx of group.voxelIndices) {
    const row = Math.floor(idx / VOXEL_COLS);
    const col = idx % VOXEL_COLS;
    const layout = getVoxelLayout(col, row, dims);
    const halfW = layout.voxW / 2;
    const halfD = layout.voxD / 2;
    minX = Math.min(minX, layout.px - halfW);
    maxX = Math.max(maxX, layout.px + halfW);
    minZ = Math.min(minZ, layout.pz - halfD);
    maxZ = Math.max(maxZ, layout.pz + halfD);
  }
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    w: maxX - minX,
    d: maxZ - minZ,
  };
}

function ContainerDebugWireframe({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  const isSimpleMode = useStore((s) => s.designComplexity === 'simple');
  if (!grid) return null;

  const vHeight = dims.height;

  // Simple mode: bay group wireframes
  const bayBoxes = useMemo(() => {
    if (!isSimpleMode) return null;
    return BAY_GROUPS.map(group => {
      // Check if ANY voxel in this group is active
      const hasActive = group.voxelIndices.some(idx => grid[idx]?.active);
      if (!hasActive) return null;
      const aabb = bayGroupAABB(group, dims);
      const isBody = group.role === 'body';
      return { ...aabb, h: vHeight, isBody, id: group.id, label: group.label };
    }).filter(Boolean) as { cx: number; cz: number; w: number; d: number; h: number; isBody: boolean; id: string; label: string }[];
  }, [isSimpleMode, grid, dims, vHeight]);

  // Detail mode: per-voxel wireframes
  const voxels = useMemo(() => {
    if (isSimpleMode) return null;
    const result: { px: number; py: number; pz: number; w: number; h: number; d: number; isExt: boolean; idx: number }[] = [];
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (!v.active) continue;
      const row = Math.floor(i / VOXEL_COLS);
      const col = i % VOXEL_COLS;
      const layout = getVoxelLayout(col, row, dims);
      const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
      const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
      const isBody = !isHaloCol && !isHaloRow;
      result.push({ px: layout.px, py: vHeight / 2, pz: layout.pz, w: layout.voxW, h: vHeight, d: layout.voxD, isExt: !isBody, idx: i });
    }
    return result;
  }, [isSimpleMode, grid, dims, vHeight]);

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
      {/* Simple mode: bay group wireframes */}
      {bayBoxes && bayBoxes.map(box => (
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
      {voxels && voxels.map((v, i) => (
        <mesh
          key={i}
          position={[v.px, v.py, v.pz]}
          geometry={getBox(v.w, v.h, v.d)}
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
      {Object.values(containers).map((c) => (
        <ContainerDebugWireframe key={c.id} container={c} />
      ))}
    </group>
  );
}
