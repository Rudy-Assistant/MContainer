"use client";

/**
 * WarningOverlay.tsx — 3D wireframe highlight for hovered validation warnings
 *
 * When hoveredWarning is set (from WarningPanel hover), this component
 * renders yellow/red wireframe boxes around the warned voxels.
 * Uses the same voxel positioning math as DebugOverlay.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS } from "@/types/container";

// Severity-colored materials (module-level singletons, depthTest false for always-visible)
const matError = new THREE.LineBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9, depthTest: false, linewidth: 2 });
const matWarning = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.85, depthTest: false, linewidth: 2 });
const matInfo = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.7, depthTest: false, linewidth: 2 });

const SEVERITY_MAT: Record<string, THREE.LineBasicMaterial> = {
  error: matError,
  warning: matWarning,
  info: matInfo,
};

// Cache edge geometries by dimension key (shared with DebugOverlay pattern)
const _edgeCache = new Map<string, THREE.EdgesGeometry>();
function getEdges(w: number, h: number, d: number): THREE.EdgesGeometry {
  const k = `${w.toFixed(3)}_${h.toFixed(3)}_${d.toFixed(3)}`;
  if (!_edgeCache.has(k)) {
    _edgeCache.set(k, new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)));
  }
  return _edgeCache.get(k)!;
}

const nullRaycast = () => {};

export default function WarningOverlay() {
  const hoveredWarning = useStore((s) => s.hoveredWarning);
  const warnings = useStore(useShallow((s) => s.warnings));
  const containers = useStore((s) => s.containers);

  const warning = useMemo(
    () => (hoveredWarning ? warnings.find((w) => w.id === hoveredWarning) : null),
    [hoveredWarning, warnings],
  );

  const voxelPositions = useMemo(() => {
    if (!warning) return [];
    const container = containers[warning.containerId];
    if (!container?.voxelGrid) return [];

    const dims = CONTAINER_DIMENSIONS[container.size];
    const vHeight = dims.height;
    const coreW = dims.length / 6;
    const coreD = dims.width / 2;
    const foldDepth = dims.height;

    const result: { px: number; py: number; pz: number; w: number; h: number; d: number }[] = [];

    // If no specific voxels, highlight entire container
    const indices = warning.voxelIndices.length > 0
      ? warning.voxelIndices
      : container.voxelGrid.map((_, i) => i).filter((i) => container.voxelGrid![i].active);

    for (const idx of indices) {
      const level = Math.floor(idx / (VOXEL_ROWS * VOXEL_COLS));
      const remainder = idx % (VOXEL_ROWS * VOXEL_COLS);
      const row = Math.floor(remainder / VOXEL_COLS);
      const col = remainder % VOXEL_COLS;

      const isHaloCol = col === 0 || col === VOXEL_COLS - 1;
      const isHaloRow = row === 0 || row === VOXEL_ROWS - 1;

      const vW = isHaloCol ? foldDepth : coreW;
      const vD = isHaloRow ? foldDepth : coreD;

      let px: number;
      if (col === 0) px = dims.length / 2 + foldDepth / 2;
      else if (col === VOXEL_COLS - 1) px = -(dims.length / 2 + foldDepth / 2);
      else px = -(col - 3.5) * coreW;

      let pz: number;
      if (row === 0) pz = -(dims.width / 2 + foldDepth / 2);
      else if (row === VOXEL_ROWS - 1) pz = dims.width / 2 + foldDepth / 2;
      else pz = (row - 1.5) * coreD;

      const py = level * vHeight + vHeight / 2;

      result.push({ px, py, pz, w: vW + 0.02, h: vHeight + 0.02, d: vD + 0.02 });
    }
    return result;
  }, [warning, containers]);

  if (!warning || voxelPositions.length === 0) return null;

  const container = containers[warning.containerId];
  if (!container) return null;

  const mat = SEVERITY_MAT[warning.severity] ?? matWarning;

  return (
    <group position={[container.position.x, container.position.y, container.position.z]}>
      {voxelPositions.map((v, i) => (
        <lineSegments
          key={i}
          position={[v.px, v.py, v.pz]}
          geometry={getEdges(v.w, v.h, v.d)}
          material={mat}
          renderOrder={101}
          raycast={nullRaycast}
        />
      ))}
    </group>
  );
}
