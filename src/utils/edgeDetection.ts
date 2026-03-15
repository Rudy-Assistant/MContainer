/**
 * EDGE OVERLAP DETECTION
 *
 * Detects when multiple floor edges occupy the same spatial position.
 * Used for Spacebar cycling between overlapping edges.
 */

import * as THREE from 'three';
import { type Container, WallSide, CONTAINER_DIMENSIONS } from '@/types/container';

export interface EdgeReference {
  containerId: string;
  wall: WallSide;
  bayIndex: number;
  worldPosition: THREE.Vector3;
}

const OVERLAP_THRESHOLD = 0.1; // 10cm tolerance for edge overlap detection

/**
 * Get world position of an edge in 3D space
 */
function getEdgeWorldPosition(
  container: Container,
  wall: WallSide,
  bayIndex: number
): THREE.Vector3 {
  const dims = CONTAINER_DIMENSIONS[container.size];
  const { length, width, height } = dims;
  const isLong = wall === WallSide.Left || wall === WallSide.Right;
  const wallLength = isLong ? length : width;
  const bayCount = container.walls[wall].bays.length;
  const bayWidth = wallLength / bayCount;
  const bayCenter = -wallLength / 2 + bayWidth / 2 + bayIndex * bayWidth;

  // Container transform
  const containerPos = new THREE.Vector3(
    container.position.x,
    container.position.y,
    container.position.z
  );
  const containerRot = new THREE.Euler(0, container.rotation, 0);

  // Local edge position (relative to container)
  let localPos: THREE.Vector3;

  switch (wall) {
    case WallSide.Left:
      localPos = new THREE.Vector3(bayCenter, 0.05, -(width / 2 + height));
      break;
    case WallSide.Right:
      localPos = new THREE.Vector3(bayCenter, 0.05, width / 2 + height);
      break;
    case WallSide.Front:
      localPos = new THREE.Vector3(length / 2 + height, 0.05, bayCenter);
      break;
    case WallSide.Back:
      localPos = new THREE.Vector3(-(length / 2 + height), 0.05, bayCenter);
      break;
    default:
      localPos = new THREE.Vector3(0, 0, 0);
  }

  // Apply container rotation and position
  localPos.applyEuler(containerRot);
  localPos.add(containerPos);

  return localPos;
}

/**
 * Detect all edges from all containers that overlap with a given edge
 */
export function detectOverlappingEdges(
  targetEdge: { containerId: string; wall: WallSide; bayIndex: number },
  containers: Record<string, Container>
): EdgeReference[] {
  const targetContainer = containers[targetEdge.containerId];
  if (!targetContainer) return [];

  const targetWorldPos = getEdgeWorldPosition(
    targetContainer,
    targetEdge.wall,
    targetEdge.bayIndex
  );

  const overlapping: EdgeReference[] = [];

  // Check all containers
  for (const container of Object.values(containers)) {
    // Check all walls
    for (const wall of [WallSide.Left, WallSide.Right, WallSide.Front, WallSide.Back] as const) {
      const wallConfig = container.walls[wall];

      // Check all bays
      for (let bayIndex = 0; bayIndex < wallConfig.bays.length; bayIndex++) {
        const bay = wallConfig.bays[bayIndex];

        // Only deployed fold-down decks have edges
        if (
          bay.module.type !== 'hinged_wall' ||
          !bay.module.foldsDown ||
          bay.module.openAmount <= 0.5
        ) {
          continue;
        }

        const edgeWorldPos = getEdgeWorldPosition(container, wall, bayIndex);

        // Check if within overlap threshold
        const distance = targetWorldPos.distanceTo(edgeWorldPos);

        if (distance < OVERLAP_THRESHOLD) {
          overlapping.push({
            containerId: container.id,
            wall,
            bayIndex,
            worldPosition: edgeWorldPos,
          });
        }
      }
    }
  }

  // Sort by container ID then wall then bay index for consistent ordering
  overlapping.sort((a, b) => {
    if (a.containerId !== b.containerId) return a.containerId.localeCompare(b.containerId);
    if (a.wall !== b.wall) return a.wall.localeCompare(b.wall);
    return a.bayIndex - b.bayIndex;
  });

  return overlapping;
}

/**
 * Get a displayable string for edge direction
 */
export function getEdgeDirectionLabel(wall: WallSide): string {
  const labels: Record<WallSide, string> = {
    [WallSide.Left]: 'North',
    [WallSide.Right]: 'South',
    [WallSide.Front]: 'East',
    [WallSide.Back]: 'West',
  };
  return labels[wall] ?? 'Unknown';
}
