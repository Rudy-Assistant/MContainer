'use client';
import { useStore } from '@/store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { formRegistry } from '@/config/formRegistry';
import { resolveSkin } from '@/utils/skinResolver';
import { getStyle } from '@/config/styleRegistry';
import { getMaterial } from '@/config/materialRegistry';
import { useMemo } from 'react';
import * as THREE from 'three';
import type { SceneObject, StyleId, FormDefinition } from '@/types/sceneObject';
import {
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  CONTAINER_DIMENSIONS,
  ContainerSize,
} from '@/types/container';
import type { Container } from '@/types/container';

/**
 * Compute container-local position from a SceneObject's anchor.
 *
 * HALO ARCHITECTURE (matches ContainerSkin / WalkthroughControls / voxelSlice):
 *   colPitch = length / 6  (core cols 1-6; cols 0,7 are extension halos)
 *   rowPitch = width  / 2  (core rows 1-2; rows 0,3 are extension halos)
 *   X = -(col - 3.5) * colPitch   [NEGATED: col 0 = +X, col 7 = -X]
 *   Z = (row - 1.5) * rowPitch
 *   Y center = height / 2 per level
 */
function anchorToPosition(
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

/**
 * Compute the Y-axis rotation for a face-anchored object so it faces outward.
 */
function anchorToRotation(anchor: SceneObject['anchor']): [number, number, number] {
  if (anchor.type !== 'face') return [0, 0, 0];
  switch (anchor.face) {
    case 'n': return [0, 0, 0];
    case 's': return [0, Math.PI, 0];
    case 'e': return [0, -Math.PI / 2, 0];
    case 'w': return [0, Math.PI / 2, 0];
    default: return [0, 0, 0];
  }
}

// Suppress raycasts on non-interactive meshes (project anti-pattern rule)
const nullRaycast = () => {};

export function SceneObjectRenderer() {
  const objectIds = useStore(useShallow((s) => Object.keys(s.sceneObjects)));
  const activeStyle = useStore((s) => s.activeStyle);

  if (objectIds.length === 0) return null;

  return (
    <group>
      {objectIds.map((id) => (
        <SceneObjectMesh key={id} objectId={id} styleId={activeStyle} />
      ))}
    </group>
  );
}

function SceneObjectMesh({ objectId, styleId }: { objectId: string; styleId: StyleId }) {
  const object = useStore((s) => s.sceneObjects[objectId]);
  const container = useStore((s) =>
    object ? s.containers[object.anchor.containerId] : undefined,
  );
  const placementMode = useStore((s) => s.placementMode);
  const selectObject = useStore((s) => s.selectObject);

  if (!object || !container) return null;

  const form = formRegistry.get(object.formId);
  if (!form) return null;

  const style = getStyle(styleId);
  const resolvedSkin = resolveSkin(form.defaultSkin, object.skin, style?.defaultMaterials);

  const position = useMemo(
    () => anchorToPosition(object.anchor, container),
    [object.anchor, container],
  );
  const rotation = useMemo(() => anchorToRotation(object.anchor), [object.anchor]);

  // Look up material for the primary skin slot
  const primarySlot = form.skinSlots[0]?.id ?? 'frame';
  const matId = resolvedSkin[primarySlot] ?? 'raw_steel';
  const matDef = getMaterial(matId);

  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: matDef?.color ?? '#888888',
      metalness: matDef?.metalness ?? 0.5,
      roughness: matDef?.roughness ?? 0.5,
    });
  }, [matDef?.color, matDef?.metalness, matDef?.roughness]);

  // Container world position + container rotation
  const worldPosition = useMemo((): [number, number, number] => {
    const cp = container.position;
    const cosR = Math.cos(container.rotation);
    const sinR = Math.sin(container.rotation);
    // Apply container rotation to local position
    const wx = cp.x + position[0] * cosR - position[2] * sinR;
    const wy = cp.y + position[1];
    const wz = cp.z + position[0] * sinR + position[2] * cosR;
    return [wx, wy, wz];
  }, [container.position, container.rotation, position]);

  const worldRotation = useMemo((): [number, number, number] => {
    return [rotation[0], rotation[1] + container.rotation, rotation[2]];
  }, [rotation, container.rotation]);

  return (
    <group position={worldPosition} rotation={worldRotation}>
      {/* Procedural placeholder box — replaced with GLB models in art pipeline sprint */}
      <mesh
        material={material}
        castShadow
        receiveShadow
        {...(placementMode ? { raycast: nullRaycast } : {})}
        onClick={(e) => {
          if (placementMode) return;
          e.stopPropagation();
          selectObject(objectId);
        }}
      >
        <boxGeometry args={[form.dimensions.w, form.dimensions.h, form.dimensions.d]} />
      </mesh>
      {/* Light sources for light-category forms */}
      {form.category === 'light' && (
        <LightSource object={object} form={form} />
      )}
    </group>
  );
}

function LightSource({ object, form }: { object: SceneObject; form: FormDefinition }) {
  const brightness = (object.state?.brightness as number) ?? 75;
  const intensity = (brightness / 100) * 2; // 0-2 range

  if (form.anchorType === 'ceiling') {
    return (
      <spotLight
        intensity={intensity}
        angle={Math.PI / 4}
        penumbra={0.5}
        distance={5}
        position={[0, -0.1, 0]}
      />
    );
  }
  if (form.anchorType === 'face') {
    return (
      <spotLight
        intensity={intensity}
        angle={Math.PI / 3}
        penumbra={0.7}
        distance={4}
        position={[0, 0, 0.1]}
      />
    );
  }
  // Floor lights (lamps)
  return (
    <pointLight
      intensity={intensity}
      distance={4}
      position={[0, form.dimensions.h, 0]}
    />
  );
}
