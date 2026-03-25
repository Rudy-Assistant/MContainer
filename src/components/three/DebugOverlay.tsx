"use client";

/**
 * DebugOverlay.tsx — Wireframe hitbox visualization for all 32 voxels
 *
 * Ported from V2: renders MeshBasicMaterial({ wireframe: true }) directly,
 * not EdgesGeometry lineSegments. Body = red, extension = orange.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { nullRaycast } from "@/utils/nullRaycast";

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

// Corner debug dots (NW=red, NE=blue, SW=green, SE=yellow)
const CORNER_COLORS: Record<number, number> = {
  0: 0xff4444,   // NW
  7: 0x4488ff,   // NE
  24: 0x00ff00,  // SW
  31: 0xffcc00,  // SE
};

function ContainerDebugWireframe({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  if (!grid) return null;

  const vHeight = dims.height;
  const coreW = dims.length / 6;
  const coreD = dims.width / 2;
  const foldDepth = dims.height;

  const voxels = useMemo(() => {
    const result: { px: number; py: number; pz: number; w: number; h: number; d: number; isExt: boolean; idx: number }[] = [];

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

      let px: number;
      if (col === 0)                   px = dims.length / 2 + foldDepth / 2;
      else if (col === VOXEL_COLS - 1) px = -(dims.length / 2 + foldDepth / 2);
      else                             px = -(col - 3.5) * coreW;

      let pz: number;
      if (row === 0)                   pz = -(dims.width / 2 + foldDepth / 2);
      else if (row === VOXEL_ROWS - 1) pz = dims.width / 2 + foldDepth / 2;
      else                             pz = (row - 1.5) * coreD;

      result.push({ px, py: vHeight / 2, pz, w: vW, h: vHeight, d: vD, isExt: !isBody, idx: i });
    }
    return result;
  }, [grid, coreW, coreD, foldDepth, vHeight, dims.length, dims.width]);

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
      {voxels.map((v, i) => (
        <mesh
          key={i}
          position={[v.px, v.py, v.pz]}
          geometry={getBox(v.w, v.h, v.d)}
          material={v.isExt ? extMat : bodyMat}
          renderOrder={100}
          raycast={nullRaycast}
        />
      ))}
      {/* Corner debug dots — positioned at top of voxel box + small offset */}
      {voxels.filter(v => CORNER_COLORS[v.idx] !== undefined).map(v => (
        <mesh key={`dot-${v.idx}`} position={[v.px, v.py + v.h / 2 + 0.2, v.pz]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={CORNER_COLORS[v.idx]} depthTest={false} />
        </mesh>
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
