/**
 * SHARED WALL MESH
 *
 * Replaces two overlapping wall meshes with a single selectable plane
 * when containers are adjacent. Prevents z-fighting and raycast failures.
 */

import { useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import { WallSide, CONTAINER_DIMENSIONS, type Container } from '@/types/container';
import { makeInteractable } from '@/utils/raycastLayers';

// Reuse materials from ContainerMesh
const steelExterior = new THREE.MeshStandardMaterial({
  color: 0xb8c0c8,
  metalness: 0.45,
  roughness: 0.60,
  envMapIntensity: 1.0,
});

interface SharedWallConfig {
  containerA: string;
  containerB: string;
  wallSideA: WallSide;
  wallSideB: WallSide;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  width: number;
  height: number;
}

/**
 * Calculate shared wall configuration from adjacency data
 */
export function getSharedWallConfig(
  containerA: Container,
  containerB: Container,
  wallSideA: WallSide,
  wallSideB: WallSide
): SharedWallConfig | null {
  const dimsA = CONTAINER_DIMENSIONS[containerA.size];
  const dimsB = CONTAINER_DIMENSIONS[containerB.size];

  // Determine wall dimensions (use larger of the two for safety)
  const isLongA = wallSideA === WallSide.Left || wallSideA === WallSide.Right;
  const isLongB = wallSideB === WallSide.Left || wallSideB === WallSide.Right;

  const widthA = isLongA ? dimsA.length : dimsA.width;
  const widthB = isLongB ? dimsB.length : dimsB.width;
  const width = Math.max(widthA, widthB);

  const heightA = dimsA.height;
  const heightB = dimsB.height;
  const height = Math.max(heightA, heightB);

  // Calculate wall position in world space
  // Start with container A's position
  const basePos = new THREE.Vector3(containerA.position.x, containerA.position.y, containerA.position.z);

  // Wall local offset from container center (in container's local space)
  let wallLocalOffset = new THREE.Vector3(0, heightA / 2, 0);
  let wallLocalRotation = 0; // Rotation relative to container's forward direction

  switch (wallSideA) {
    case WallSide.Left:
      wallLocalOffset.z = -dimsA.width / 2;
      wallLocalRotation = 0;
      break;
    case WallSide.Right:
      wallLocalOffset.z = dimsA.width / 2;
      wallLocalRotation = Math.PI;
      break;
    case WallSide.Front:
      wallLocalOffset.x = dimsA.length / 2;
      wallLocalRotation = Math.PI / 2;
      break;
    case WallSide.Back:
      wallLocalOffset.x = -dimsA.length / 2;
      wallLocalRotation = -Math.PI / 2;
      break;
  }

  // Apply container A's rotation to the local offset
  const containerRotation = new THREE.Euler(0, containerA.rotation, 0);
  wallLocalOffset.applyEuler(containerRotation);

  // Final world position
  const position = new THREE.Vector3().addVectors(basePos, wallLocalOffset);

  // Final world rotation (wall rotation + container rotation)
  const rotation = new THREE.Euler(0, wallLocalRotation + containerA.rotation, 0);

  return {
    containerA: containerA.id,
    containerB: containerB.id,
    wallSideA,
    wallSideB,
    position,
    rotation,
    width,
    height,
  };
}

/**
 * Render all shared walls for the scene
 */
export default function SharedWalls() {
  const containers = useStore((s) => s.containers);

  // Derive a stable cache key from only the fields that affect shared walls.
  // This prevents useMemo from recomputing on paint/furniture/voxelGrid changes.
  const wallCacheKey = useMemo(() =>
    Object.values(containers).map((c) =>
      `${c.id}:${c.position.x},${c.position.y},${c.position.z}:${c.rotation}:${c.size}:${c.mergedWalls.join(';')}`
    ).sort().join('|'),
    [containers],
  );

  const groupRef = useRef<THREE.Group>(null);

  // Collect all shared wall configs from adjacency data
  // eslint-disable-next-line react-hooks/exhaustive-deps -- wallCacheKey is a derived stable key
  const sharedWalls = useMemo(() => {
    const walls: SharedWallConfig[] = [];
    const processed = new Set<string>();

    Object.values(containers).forEach((containerA) => {
      containerA.mergedWalls.forEach((mergedEntry) => {
        // mergedEntry format: "containerB_id:wallSide"
        const [containerBId, wallSideStr] = mergedEntry.split(':');
        const wallSideA = wallSideStr as WallSide;

        // Create unique key to avoid duplicate processing
        const key = [containerA.id, containerBId].sort().join('-');
        if (processed.has(key)) return;
        processed.add(key);

        const containerB = containers[containerBId];
        if (!containerB) return;

        // Find the corresponding wall side on container B
        const wallSideB = containerB.mergedWalls
          .find((entry) => entry.startsWith(`${containerA.id}:`))
          ?.split(':')[1] as WallSide | undefined;

        if (!wallSideB) return;

        const config = getSharedWallConfig(containerA, containerB, wallSideA, wallSideB);
        if (config) {
          walls.push(config);
        }
      });
    });

    return walls;
  }, [wallCacheKey]);

  // Make all shared walls interactable for raycasting
  useEffect(() => {
    if (!groupRef.current) return;
    makeInteractable(groupRef.current);
  }, [sharedWalls]);

  return (
    <group ref={groupRef}>
      {sharedWalls.map((wall, i) => (
        <mesh
          key={i}
          position={wall.position}
          rotation={wall.rotation}
          material={steelExterior}
          castShadow
          receiveShadow
          userData={{
            isSharedWall: true,
            isBay: true, // Treat as clickable bay for interaction purposes
            containerA: wall.containerA,
            containerB: wall.containerB,
            wallSideA: wall.wallSideA,
            wallSideB: wall.wallSideB,
          }}
        >
          <boxGeometry args={[wall.width, wall.height, 0.12]} />
        </mesh>
      ))}
    </group>
  );
}
