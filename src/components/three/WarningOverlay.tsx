"use client";

/**
 * WarningOverlay.tsx — 3D wireframe highlight for hovered validation warnings
 *
 * When hoveredWarning is set (from WarningPanel hover), this component
 * renders severity-colored wireframe boxes around the warned voxels.
 * Only mounts inner geometry when a warning is actually hovered.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/react/shallow";
import { CONTAINER_DIMENSIONS, VOXEL_COLS, VOXEL_ROWS } from "@/types/container";
import type { WarningSeverity } from "@/types/validation";
import { getVoxelLayout } from "@/components/objects/ContainerSkin";
import { SEVERITY_HEX } from "@/config/severityColors";

// Severity-colored materials (module-level singletons, depthTest false for always-visible)
const SEVERITY_MAT: Record<WarningSeverity, THREE.LineBasicMaterial> = {
  error: new THREE.LineBasicMaterial({ color: SEVERITY_HEX.error, transparent: true, opacity: 0.9, depthTest: false, linewidth: 2 }),
  warning: new THREE.LineBasicMaterial({ color: SEVERITY_HEX.warning, transparent: true, opacity: 0.85, depthTest: false, linewidth: 2 }),
  info: new THREE.LineBasicMaterial({ color: SEVERITY_HEX.info, transparent: true, opacity: 0.7, depthTest: false, linewidth: 2 }),
};

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

/** Gate component — only subscribes to containers when a warning is hovered */
export default function WarningOverlay() {
  const hoveredWarning = useStore((s) => s.hoveredWarning);
  if (!hoveredWarning) return null;
  return <WarningOverlayInner hoveredWarningId={hoveredWarning} />;
}

function WarningOverlayInner({ hoveredWarningId }: { hoveredWarningId: string }) {
  const warnings = useStore(useShallow((s) => s.warnings));
  const containers = useStore((s) => s.containers);

  const warning = useMemo(
    () => warnings.find((w) => w.id === hoveredWarningId) ?? null,
    [hoveredWarningId, warnings],
  );

  const voxelPositions = useMemo(() => {
    if (!warning) return [];
    const container = containers[warning.containerId];
    if (!container?.voxelGrid) return [];

    const dims = CONTAINER_DIMENSIONS[container.size];
    const vHeight = dims.height;

    const result: { px: number; py: number; pz: number; w: number; h: number; d: number }[] = [];

    // If no specific voxels, highlight all active voxels in the container
    const indices = warning.voxelIndices.length > 0
      ? warning.voxelIndices
      : container.voxelGrid.map((_, i) => i).filter((i) => container.voxelGrid![i].active);

    for (const idx of indices) {
      const level = Math.floor(idx / (VOXEL_ROWS * VOXEL_COLS));
      const remainder = idx % (VOXEL_ROWS * VOXEL_COLS);
      const row = Math.floor(remainder / VOXEL_COLS);
      const col = remainder % VOXEL_COLS;

      const layout = getVoxelLayout(col, row, dims);
      const py = level * vHeight + vHeight / 2;

      result.push({
        px: layout.px, py, pz: layout.pz,
        w: layout.voxW + 0.02, h: vHeight + 0.02, d: layout.voxD + 0.02,
      });
    }
    return result;
  }, [warning, containers]);

  if (!warning || voxelPositions.length === 0) return null;

  const container = containers[warning.containerId];
  if (!container) return null;

  const mat = SEVERITY_MAT[warning.severity];

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
