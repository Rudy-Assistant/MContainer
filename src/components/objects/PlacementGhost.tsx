'use client';

import { useStore } from '@/store/useStore';
import { formRegistry } from '@/config/formRegistry';
import { getOccupiedSlots, getSlotsForPlacement } from '@/utils/slotOccupancy';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject, WallDirection } from '@/types/sceneObject';
import {
  VOXEL_COLS, VOXEL_ROWS, VOXEL_LEVELS,
  CONTAINER_DIMENSIONS, ContainerSize,
} from '@/types/container';
import type { VoxelFaces } from '@/types/container';

const VALID_COLOR = new THREE.Color('#22c55e');
const INVALID_COLOR = new THREE.Color('#ef4444');
const GHOST_OPACITY = 0.4;

export function PlacementGhost() {
  const formId = useStore((s) => s.activePlacementFormId);
  if (!formId) return null;
  return <PlacementGhostInner formId={formId} />;
}

function PlacementGhostInner({ formId }: { formId: string }) {
  const form = formRegistry.get(formId);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Create material once (lazy init via ref)
  if (!materialRef.current) {
    materialRef.current = new THREE.MeshStandardMaterial({
      color: VALID_COLOR,
      transparent: true,
      opacity: GHOST_OPACITY,
      depthWrite: false,
    });
  }

  const geometry = useMemo(() => {
    if (!form) return new THREE.BoxGeometry(0.5, 1, 0.1);
    return new THREE.BoxGeometry(form.dimensions.w, form.dimensions.h, form.dimensions.d);
  }, [form]);

  // Read hoveredVoxelEdge in useFrame to avoid re-render storms
  useFrame(() => {
    const mesh = meshRef.current;
    const mat = materialRef.current;
    if (!mesh || !mat || !form) return;

    const state = useStore.getState();
    const hovered = state.hoveredVoxelEdge;

    if (!hovered || !hovered.face) {
      mesh.visible = false;
      return;
    }

    const { containerId, voxelIndex, face } = hovered;

    // Check anchor type compatibility
    const isWallFace = face === 'n' || face === 's' || face === 'e' || face === 'w';
    const isFloor = face === 'bottom';
    const isCeiling = face === 'top';

    if (form.anchorType === 'face' && !isWallFace) {
      mesh.visible = false;
      return;
    }
    if (form.anchorType === 'floor' && !isFloor) {
      mesh.visible = false;
      return;
    }
    if (form.anchorType === 'ceiling' && !isCeiling) {
      mesh.visible = false;
      return;
    }

    const container = state.containers[containerId];
    if (!container) {
      mesh.visible = false;
      return;
    }

    // For face-anchored forms, find valid slot
    let slot = 0;
    let valid = true;

    if (form.anchorType === 'face' && isWallFace) {
      const allObjects = Object.values(state.sceneObjects) as SceneObject[];
      const occupied = getOccupiedSlots(allObjects, containerId, voxelIndex, face as WallDirection, formRegistry);
      const validSlots = getSlotsForPlacement(occupied, form.slotWidth);

      if (validSlots.length === 0) {
        valid = false;
        slot = 0;
      } else {
        slot = validSlots[0];
      }
    }

    // Compute local position using same math as SceneObjectRenderer/anchorToPosition
    const dims = CONTAINER_DIMENSIONS[container.size as ContainerSize];
    const colPitch = dims.length / 6;
    const rowPitch = dims.width / 2;
    const vHeight = dims.height / VOXEL_LEVELS;

    const col = voxelIndex % VOXEL_COLS;
    const row = Math.floor(voxelIndex / VOXEL_COLS) % VOXEL_ROWS;
    const level = Math.floor(voxelIndex / (VOXEL_COLS * VOXEL_ROWS));

    const cx = -(col - 3.5) * colPitch;
    const cz = (row - 1.5) * rowPitch;
    const cy = level * vHeight + vHeight / 2;

    let localX: number, localY: number, localZ: number;
    let rotX = 0, rotY = 0, rotZ = 0;

    if (form.anchorType === 'floor') {
      localX = cx;
      localY = level * vHeight + 0.01;
      localZ = cz;
    } else if (form.anchorType === 'ceiling') {
      localX = cx;
      localY = level * vHeight + vHeight - 0.01;
      localZ = cz;
    } else {
      // Face anchor with slot offset (slots 0,1,2 → offsets -1,0,+1 × colPitch/3)
      const slotOffset = (slot - 1) * (colPitch / 3);
      switch (face as WallDirection) {
        case 'n':
          localX = cx + slotOffset; localY = cy; localZ = cz - rowPitch / 2;
          rotY = 0;
          break;
        case 's':
          localX = cx + slotOffset; localY = cy; localZ = cz + rowPitch / 2;
          rotY = Math.PI;
          break;
        case 'e':
          localX = cx + colPitch / 2; localY = cy; localZ = cz + slotOffset;
          rotY = -Math.PI / 2;
          break;
        case 'w':
          localX = cx - colPitch / 2; localY = cy; localZ = cz + slotOffset;
          rotY = Math.PI / 2;
          break;
        default:
          localX = cx; localY = cy; localZ = cz;
      }
    }

    // Apply container world transform (position + Y rotation)
    const cp = container.position;
    const cosR = Math.cos(container.rotation);
    const sinR = Math.sin(container.rotation);
    const wx = cp.x + localX * cosR - localZ * sinR;
    const wy = cp.y + localY;
    const wz = cp.z + localX * sinR + localZ * cosR;

    mesh.position.set(wx, wy, wz);
    mesh.rotation.set(rotX, rotY + container.rotation, rotZ);
    mesh.visible = true;

    // Green = valid placement, red = invalid
    mat.color.copy(valid ? VALID_COLOR : INVALID_COLOR);
  });

  if (!form) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={materialRef.current!}
      visible={false}
      raycast={() => {}}
    />
  );
}
