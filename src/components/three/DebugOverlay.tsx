"use client";

/**
 * DebugOverlay.tsx — Wireframe debug visualization for voxel bounding boxes
 *
 * Renders red wireframe around each active voxel, yellow for extensions.
 * Mounted conditionally when debugMode is true.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { HIGHLIGHT_HEX_HOVER } from "@/config/highlightColors";

// Shared materials (module-level singletons)
const debugBodyMat = new THREE.LineBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.6, depthTest: false });
const debugExtMat = new THREE.LineBasicMaterial({ color: HIGHLIGHT_HEX_HOVER, transparent: true, opacity: 0.5, depthTest: false });

// Cache edge geometries by dimension key
const _edgeCache = new Map<string, THREE.EdgesGeometry>();
function getEdges(w: number, h: number, d: number): THREE.EdgesGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_edgeCache.has(k)) {
    _edgeCache.set(k, new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)));
  }
  return _edgeCache.get(k)!;
}

import { nullRaycast } from '@/utils/nullRaycast';

function ContainerDebugWireframe({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  if (!grid) return null;

  const vHeight = dims.height;
  // Must match ContainerSkin's halo architecture exactly:
  //   colPitch = length / 6 (core cols), rowPitch = width / 2 (core rows)
  //   Halo (extension) width = container height (foldDepth)
  const coreW = dims.length / 6;
  const coreD = dims.width / 2;
  const foldDepth = dims.height;

  const voxels = useMemo(() => {
    const result: { px: number; py: number; pz: number; w: number; h: number; d: number; isExt: boolean }[] = [];

    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (!v.active) continue;

      const row = Math.floor(i / VOXEL_COLS);
      const col = i % VOXEL_COLS;

      const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
      const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
      const isBody = !isHaloCol && !isHaloRow;

      const vW = isHaloCol ? foldDepth : coreW;
      const vD = isHaloRow ? foldDepth : coreD;

      // Position: match ContainerSkin's getVoxelLayout exactly (NEGATED X for cols)
      let px: number;
      if (col === 0)                   px = dims.length / 2 + foldDepth / 2;
      else if (col === VOXEL_COLS - 1) px = -(dims.length / 2 + foldDepth / 2);
      else                             px = -(col - 3.5) * coreW;

      let pz: number;
      if (row === 0)                   pz = -(dims.width / 2 + foldDepth / 2);
      else if (row === VOXEL_ROWS - 1) pz = dims.width / 2 + foldDepth / 2;
      else                             pz = (row - 1.5) * coreD;

      result.push({ px, py: vHeight / 2, pz, w: vW, h: vHeight, d: vD, isExt: !isBody });
    }
    return result;
  }, [grid, coreW, coreD, foldDepth, vHeight, dims.length, dims.width]);

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
      {voxels.map((v, i) => (
        <lineSegments
          key={i}
          position={[v.px, v.py, v.pz]}
          geometry={getEdges(v.w, v.h, v.d)}
          material={v.isExt ? debugExtMat : debugBodyMat}
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
