"use client";

/**
 * DebugOverlay.tsx — Floor tile + hitbox zone debug visualization
 *
 * Shows floor tiles for all voxels with:
 * - Outer rectangle: tile boundary
 * - Inner rectangle: center zone (floor/block click area)
 * - Corner-to-corner lines connecting outer to inner rect (quadrant boundaries)
 * Simple mode: bay-grouped tiles (merged for multi-voxel bays)
 * Detail mode: per-voxel tiles
 * Ceiling mode: tiles at ceiling level when inspectorView === 'ceiling'
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS, type Container } from "@/types/container";
import { nullRaycast } from "@/utils/nullRaycast";
import { computeBayGroups } from "@/config/bayGroups";
import { getVoxelLayout } from "@/components/objects/ContainerSkin";

// Inset from tile edge to center zone — wall quadrant width
// Matches BASEPLATE_STRIP in ContainerSkin for accurate visualization
const EDGE_INSET = 0.53;

// Tile outline materials
const tileBodyMat = new THREE.LineBasicMaterial({
  color: 0x44aaff, transparent: true, opacity: 0.7, depthTest: false,
});
const tileExtMat = new THREE.LineBasicMaterial({
  color: 0xff8800, transparent: true, opacity: 0.5, depthTest: false,
});
// Center zone outline
const centerMat = new THREE.LineBasicMaterial({
  color: 0x44ff88, transparent: true, opacity: 0.5, depthTest: false,
});
// Quadrant boundary lines (outer corner → inner corner)
const quadMat = new THREE.LineBasicMaterial({
  color: 0xcccc00, transparent: true, opacity: 0.4, depthTest: false,
});

// Geometry caches
const _geoCache = new Map<string, THREE.BufferGeometry>();

function getRectOutline(w: number, d: number): THREE.BufferGeometry {
  const k = `ro_${w.toFixed(3)}_${d.toFixed(3)}`;
  if (!_geoCache.has(k)) {
    const hw = w / 2, hd = d / 2;
    const v = new Float32Array([
      -hw, 0, -hd,  hw, 0, -hd,
       hw, 0, -hd,  hw, 0,  hd,
       hw, 0,  hd, -hw, 0,  hd,
      -hw, 0,  hd, -hw, 0, -hd,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    _geoCache.set(k, geo);
  }
  return _geoCache.get(k)!;
}

function getQuadrantLines(w: number, d: number, inset: number): THREE.BufferGeometry {
  const k = `ql_${w.toFixed(3)}_${d.toFixed(3)}_${inset.toFixed(3)}`;
  if (!_geoCache.has(k)) {
    const hw = w / 2, hd = d / 2;
    const iw = Math.max(hw - inset, 0.05);
    const id = Math.max(hd - inset, 0.05);
    // 4 lines: each outer corner → nearest inner corner
    const v = new Float32Array([
      -hw, 0, -hd,  -iw, 0, -id,
       hw, 0, -hd,   iw, 0, -id,
       hw, 0,  hd,   iw, 0,  id,
      -hw, 0,  hd,  -iw, 0,  id,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(v, 3));
    _geoCache.set(k, geo);
  }
  return _geoCache.get(k)!;
}

const BAY_GROUPS = computeBayGroups();

interface TileDef {
  cx: number; cz: number;
  w: number; d: number;
  isBody: boolean;
}

function ContainerDebugFloorTiles({ container }: { container: Container }) {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const grid = container.voxelGrid;
  const isSimpleMode = useStore((s) => s.designComplexity === 'simple');
  const inspectorView = useStore((s) => s.inspectorView);
  if (!grid) return null;

  const vHeight = dims.height;
  const tileY = inspectorView === 'ceiling' ? vHeight + 0.02 : 0.02;

  // Simple mode: bay-grouped tiles (merged AABBs)
  const bayTiles = useMemo((): TileDef[] | null => {
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
        isBody: group.role === 'body',
      };
    });
  }, [isSimpleMode, grid, dims]);

  // Detail mode: per-voxel tiles
  const voxelTiles = useMemo((): TileDef[] | null => {
    if (isSimpleMode) return null;
    const TOTAL = VOXEL_ROWS * VOXEL_COLS;
    const result: TileDef[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const row = Math.floor(i / VOXEL_COLS);
      const col = i % VOXEL_COLS;
      const layout = getVoxelLayout(col, row, dims);
      const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
      const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;
      result.push({
        cx: layout.px, cz: layout.pz,
        w: layout.voxW, d: layout.voxD,
        isBody: !isHaloCol && !isHaloRow,
      });
    }
    return result;
  }, [isSimpleMode, grid, dims]);

  const tiles = bayTiles || voxelTiles || [];

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
      {tiles.map((t, i) => {
        const centerW = Math.max(t.w - EDGE_INSET * 2, 0.1);
        const centerD = Math.max(t.d - EDGE_INSET * 2, 0.1);
        return (
          <group key={i}>
            {/* Outer tile outline */}
            <lineSegments
              position={[t.cx, tileY, t.cz]}
              geometry={getRectOutline(t.w, t.d)}
              material={t.isBody ? tileBodyMat : tileExtMat}
              renderOrder={101}
              raycast={nullRaycast}
            />
            {/* Inner center zone outline (floor/block click area) */}
            <lineSegments
              position={[t.cx, tileY, t.cz]}
              geometry={getRectOutline(centerW, centerD)}
              material={centerMat}
              renderOrder={101}
              raycast={nullRaycast}
            />
            {/* Quadrant boundary lines: outer corners → inner corners */}
            <lineSegments
              position={[t.cx, tileY, t.cz]}
              geometry={getQuadrantLines(t.w, t.d, EDGE_INSET)}
              material={quadMat}
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
        <ContainerDebugFloorTiles key={c.id} container={c} />
      ))}
    </group>
  );
}
