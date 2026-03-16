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

// Shared materials (module-level singletons)
const debugBodyMat = new THREE.LineBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.6, depthTest: false });
const debugExtMat = new THREE.LineBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.5, depthTest: false });

// Cache edge geometries by dimension key
const _edgeCache = new Map<string, THREE.EdgesGeometry>();
function getEdges(w: number, h: number, d: number): THREE.EdgesGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_edgeCache.has(k)) {
    _edgeCache.set(k, new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)));
  }
  return _edgeCache.get(k)!;
}

const nullRaycast = () => {};

function ContainerDebugWireframe({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  if (!grid) return null;

  const vHeight = dims.height;
  const bodyW = dims.length / VOXEL_COLS;
  const bodyD = dims.width / VOXEL_ROWS;

  const voxels = useMemo(() => {
    const result: { px: number; py: number; pz: number; w: number; h: number; d: number; isExt: boolean }[] = [];

    for (let i = 0; i < grid.length; i++) {
      const v = grid[i];
      if (!v.active) continue;

      const row = Math.floor(i / VOXEL_COLS);
      const col = i % VOXEL_COLS;

      // Body voxels: rows 1-2, cols 1-6
      const isBody = row >= 1 && row <= 2 && col >= 1 && col <= 6;
      const vW = isBody ? bodyW : bodyW * 1.5; // extensions slightly larger
      const vD = isBody ? bodyD : bodyD * 1.5;

      // Position: center of voxel in container-local space
      const px = (col - (VOXEL_COLS - 1) / 2) * bodyW;
      const pz = (row - (VOXEL_ROWS - 1) / 2) * bodyD;

      result.push({ px, py: vHeight / 2, pz, w: vW, h: vHeight, d: vD, isExt: !isBody });
    }
    return result;
  }, [grid, bodyW, bodyD, vHeight]);

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
