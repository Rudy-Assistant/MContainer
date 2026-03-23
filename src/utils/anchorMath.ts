/**
 * anchorMath.ts — Pure math for converting SceneObject anchors to local/world positions.
 *
 * Shared by SceneObjectRenderer (render-time) and PlacementGhost (useFrame).
 *
 * HALO ARCHITECTURE (matches ContainerSkin / WalkthroughControls / voxelSlice):
 *   colPitch = length / 6  (core cols 1-6; cols 0,7 are extension halos)
 *   rowPitch = width  / 2  (core rows 1-2; rows 0,3 are extension halos)
 *   X = -(col - 3.5) * colPitch   [NEGATED: col 0 = +X, col 7 = -X]
 *   Z = (row - 1.5) * rowPitch
 *   Y center = height / 2 per level
 */

import type { SceneObject } from '@/types/sceneObject';
import type { Container } from '@/types/container';
import {
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  CONTAINER_DIMENSIONS,
  ContainerSize,
} from '@/types/container';

export function anchorToLocalPosition(
  anchor: SceneObject['anchor'],
  container: Container,
): [number, number, number] {
  const dims = CONTAINER_DIMENSIONS[container.size as ContainerSize];
  const colPitch = dims.length / 6;
  const rowPitch = dims.width / 2;
  const vHeight = dims.height / VOXEL_LEVELS;

  const col = anchor.voxelIndex % VOXEL_COLS;
  const row = Math.floor(anchor.voxelIndex / VOXEL_COLS) % VOXEL_ROWS;
  const level = Math.floor(anchor.voxelIndex / (VOXEL_COLS * VOXEL_ROWS));

  // Voxel center in container-local coords (matching ContainerSkin math)
  const cx = -(col - 3.5) * colPitch;
  const cz = (row - 1.5) * rowPitch;
  const cy = level * vHeight + vHeight / 2;

  if (anchor.type === 'floor') {
    return [
      cx + (anchor.offset?.[0] ?? 0),
      level * vHeight,
      cz + (anchor.offset?.[1] ?? 0),
    ];
  }
  if (anchor.type === 'ceiling') {
    return [
      cx + (anchor.offset?.[0] ?? 0),
      level * vHeight + vHeight,
      cz + (anchor.offset?.[1] ?? 0),
    ];
  }

  // Face anchor: position at the face of the voxel
  // slot offset: divide the face width into 3 equal slots (slot 0=left, 1=center, 2=right)
  const slotOffset = anchor.slot != null ? (anchor.slot - 1) * (colPitch / 3) : 0;

  switch (anchor.face) {
    // N/S faces are along Z axis (container width)
    case 'n': return [cx + slotOffset, cy, cz - rowPitch / 2];
    case 's': return [cx + slotOffset, cy, cz + rowPitch / 2];
    // E/W faces are along X axis (container length, but X is negated)
    case 'e': return [cx + colPitch / 2, cy, cz + slotOffset];
    case 'w': return [cx - colPitch / 2, cy, cz + slotOffset];
    default: return [cx, cy, cz];
  }
}

export function anchorToLocalRotation(anchor: SceneObject['anchor']): [number, number, number] {
  if (anchor.type !== 'face') return [0, 0, 0];
  switch (anchor.face) {
    case 'n': return [0, 0, 0];
    case 's': return [0, Math.PI, 0];
    case 'e': return [0, -Math.PI / 2, 0];
    case 'w': return [0, Math.PI / 2, 0];
    default: return [0, 0, 0];
  }
}

export function localToWorld(
  localPos: [number, number, number],
  container: Container,
): [number, number, number] {
  const cp = container.position;
  const cosR = Math.cos(container.rotation);
  const sinR = Math.sin(container.rotation);
  return [
    cp.x + localPos[0] * cosR - localPos[2] * sinR,
    cp.y + localPos[1],
    cp.z + localPos[0] * sinR + localPos[2] * cosR,
  ];
}

export function localRotToWorld(
  localRot: [number, number, number],
  container: Container,
): [number, number, number] {
  return [localRot[0], localRot[1] + container.rotation, localRot[2]];
}
