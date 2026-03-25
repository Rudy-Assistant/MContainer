"use client";

/**
 * DebugOverlay.tsx — Floor tile + quadrant debug visualization
 *
 * Shows floor tile outlines and X-shaped quadrant division lines for ALL 32 voxels.
 * Each tile's 4 quadrants correspond to the N/S/E/W wall hitbox zones.
 * Center region = floor/block selection zone.
 * Ceiling mode: tiles render at ceiling level when inspectorView === 'ceiling'.
 * Hover/select highlights on walls show dimensions more clearly than wireframe boxes.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { nullRaycast } from "@/utils/nullRaycast";
import { getVoxelLayout } from "@/components/objects/ContainerSkin";

// Floor tile outline material (body voxels)
const tileBodyMat = new THREE.LineBasicMaterial({
  color: 0x44aaff, transparent: true, opacity: 0.7, depthTest: false,
});
// Floor tile outline material (extension voxels)
const tileExtMat = new THREE.LineBasicMaterial({
  color: 0xff8800, transparent: true, opacity: 0.5, depthTest: false,
});
// Quadrant X-line material
const quadMat = new THREE.LineBasicMaterial({
  color: 0xcccc00, transparent: true, opacity: 0.5, depthTest: false,
});

// Floor tile outline: 4 edges forming a rectangle
const _outlineCache = new Map<string, THREE.BufferGeometry>();
function getTileOutline(w: number, d: number): THREE.BufferGeometry {
  const k = `to_${w.toFixed(3)}_${d.toFixed(3)}`;
  if (!_outlineCache.has(k)) {
    const hw = w / 2, hd = d / 2;
    const verts = new Float32Array([
      -hw, 0, -hd,   hw, 0, -hd,
       hw, 0, -hd,   hw, 0,  hd,
       hw, 0,  hd,  -hw, 0,  hd,
      -hw, 0,  hd,  -hw, 0, -hd,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    _outlineCache.set(k, geo);
  }
  return _outlineCache.get(k)!;
}

// Quadrant X-lines: two diagonals forming an X within the tile
const _quadCache = new Map<string, THREE.BufferGeometry>();
function getQuadX(w: number, d: number): THREE.BufferGeometry {
  const k = `qx_${w.toFixed(3)}_${d.toFixed(3)}`;
  if (!_quadCache.has(k)) {
    const hw = w / 2, hd = d / 2;
    const verts = new Float32Array([
      -hw, 0, -hd,   hw, 0,  hd,
       hw, 0, -hd,  -hw, 0,  hd,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    _quadCache.set(k, geo);
  }
  return _quadCache.get(k)!;
}

function ContainerDebugFloorTiles({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  const inspectorView = useStore((s) => s.inspectorView);
  if (!grid) return null;

  const vHeight = dims.height;
  const tileY = inspectorView === 'ceiling' ? vHeight + 0.02 : 0.02;

  // Compute all 32 voxel floor tiles
  const tiles = useMemo(() => {
    const TOTAL = VOXEL_ROWS * VOXEL_COLS;
    const result: { px: number; pz: number; w: number; d: number; isBody: boolean }[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const row = Math.floor(i / VOXEL_COLS);
      const col = i % VOXEL_COLS;
      const layout = getVoxelLayout(col, row, dims);
      const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
      const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
      result.push({
        px: layout.px, pz: layout.pz,
        w: layout.voxW, d: layout.voxD,
        isBody: !isHaloCol && !isHaloRow,
      });
    }
    return result;
  }, [grid, dims]);

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
      {tiles.map((t, i) => (
        <group key={i}>
          {/* Tile outline */}
          <lineSegments
            position={[t.px, tileY, t.pz]}
            geometry={getTileOutline(t.w, t.d)}
            material={t.isBody ? tileBodyMat : tileExtMat}
            renderOrder={101}
            raycast={nullRaycast}
          />
          {/* Quadrant X-lines */}
          <lineSegments
            position={[t.px, tileY, t.pz]}
            geometry={getQuadX(t.w, t.d)}
            material={quadMat}
            renderOrder={101}
            raycast={nullRaycast}
          />
        </group>
      ))}
    </group>
  );
}

export default function DebugOverlay() {
  const containers = useStore((s) => s.containers);
  return (
    <group>
      {Object.values(containers).map(c => (
        <ContainerDebugFloorTiles key={c.id} container={c} />
      ))}
    </group>
  );
}
