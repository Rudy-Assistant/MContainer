"use client";

/**
 * StaircaseGhost — 3D preview overlay during staircase placement mode.
 *
 * Shows 2 translucent boxes (lower + upper voxel) at the hovered position,
 * colored cyan for valid placement or red for invalid.
 * An arrow mesh indicates the ascending direction.
 *
 * All meshes use nullRaycast to avoid blocking clicks on hitboxes beneath.
 */

import { useMemo } from "react";
import * as THREE from "three";
import { useStore } from "@/store/useStore";
import { CONTAINER_DIMENSIONS } from "@/types/container";
import { getVoxelLayout } from "@/components/objects/ContainerSkin";
import { nullRaycast } from "@/utils/nullRaycast";
import { HIGHLIGHT_HEX_SELECT } from "@/config/highlightColors";
import { validateStaircasePlacement } from "@/utils/staircaseValidation";

const INVALID_COLOR = 0xff4444;

const ghostMat = new THREE.MeshBasicMaterial({
  color: HIGHLIGHT_HEX_SELECT,
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const invalidMat = new THREE.MeshBasicMaterial({
  color: INVALID_COLOR,
  transparent: true,
  opacity: 0.25,
  depthWrite: false,
  side: THREE.DoubleSide,
});

export default function StaircaseGhost() {
  const staircaseMode = useStore((s) => s.staircasePlacementMode);
  const containerId = useStore((s) => s.staircasePlacementContainerId);
  const hoveredEdge = useStore((s) => s.hoveredVoxelEdge);
  // Narrow selector: only subscribe to the specific container being placed
  const container = useStore((s) =>
    s.staircasePlacementContainerId ? s.containers[s.staircasePlacementContainerId] : null
  );

  // Compute ghost positions
  const ghostData = useMemo(() => {
    if (!staircaseMode || !containerId || !hoveredEdge || !container) return null;
    if (hoveredEdge.containerId !== containerId) return null;
    if (!container.voxelGrid) return null;

    const voxelIndex = hoveredEdge.voxelIndex;
    const validation = validateStaircasePlacement(container.voxelGrid, voxelIndex, hoveredEdge.face);
    if (!validation.valid || !validation.ascending) return null;

    const { col, row, upperRow, upperCol, ascending } = validation;

    const dims = CONTAINER_DIMENSIONS[container.size];
    const lowerLayout = getVoxelLayout(col, row, dims);

    // Container world position
    const cx = container.position.x;
    const cy = container.position.y;
    const cz = container.position.z;

    const lowerPos: [number, number, number] = [
      cx + lowerLayout.px,
      cy + dims.height / 2,
      cz + lowerLayout.pz,
    ];

    let upperPos: [number, number, number] | null = null;
    let upperSize: [number, number, number] | null = null;
    if (upperRow != null && upperCol != null) {
      const upperLayout = getVoxelLayout(upperCol, upperRow, dims);
      upperPos = [
        cx + upperLayout.px,
        cy + dims.height / 2,
        cz + upperLayout.pz,
      ];
      upperSize = [upperLayout.voxW * 0.95, dims.height * 0.95, upperLayout.voxD * 0.95];
    }

    // Arrow direction vector for visual indicator
    const arrowDir = new THREE.Vector3(
      ascending === "e" ? -1 : ascending === "w" ? 1 : 0,
      0.5,
      ascending === "n" ? -1 : ascending === "s" ? 1 : 0,
    ).normalize();

    return {
      lowerPos,
      lowerSize: [lowerLayout.voxW * 0.95, dims.height * 0.95, lowerLayout.voxD * 0.95] as [number, number, number],
      upperPos,
      upperSize,
      arrowDir,
      arrowOrigin: new THREE.Vector3(...lowerPos),
    };
  }, [staircaseMode, containerId, hoveredEdge, container]);

  if (!ghostData) return null;

  return (
    <group>
      {/* Lower voxel ghost */}
      <mesh position={ghostData.lowerPos} raycast={nullRaycast} material={ghostMat}>
        <boxGeometry args={ghostData.lowerSize} />
      </mesh>

      {/* Upper voxel ghost */}
      {ghostData.upperPos && ghostData.upperSize && (
        <mesh position={ghostData.upperPos} raycast={nullRaycast} material={ghostMat}>
          <boxGeometry args={ghostData.upperSize} />
        </mesh>
      )}

      {/* Arrow showing ascending direction */}
      <arrowHelper
        args={[
          ghostData.arrowDir,
          ghostData.arrowOrigin,
          1.5,
          HIGHLIGHT_HEX_SELECT,
          0.4,
          0.3,
        ]}
        raycast={nullRaycast}
      />
    </group>
  );
}
