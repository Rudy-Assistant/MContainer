'use client';

import { useStore } from '@/store/useStore';
import { formRegistry } from '@/config/formRegistry';
import { getOccupiedSlots, getSlotsForPlacement } from '@/utils/slotOccupancy';
import { anchorToLocalPosition, anchorToLocalRotation, localToWorld, localRotToWorld } from '@/utils/anchorMath';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SceneObject, WallDirection, ObjectAnchor } from '@/types/sceneObject';

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

  // Cache last hovered face key to avoid recomputing slot occupancy every frame (Fix 9)
  const lastHoveredRef = useRef<string | null>(null);
  const cachedSlotRef = useRef<{ slot: number; valid: boolean }>({ slot: 0, valid: true });

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

  // Dispose geometry when it changes or component unmounts (Fix 4)
  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  // Read hoveredVoxelEdge in useFrame to avoid re-render storms
  useFrame(() => {
    const mesh = meshRef.current;
    const mat = materialRef.current;
    if (!mesh || !mat || !form) return;

    const state = useStore.getState();
    const hovered = state.hoveredVoxelEdge;

    if (!hovered || !hovered.face) {
      mesh.visible = false;
      lastHoveredRef.current = null;
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

    // For face-anchored forms, find valid slot — only recompute when hovered face changes (Fix 9)
    let slot = 0;
    let valid = true;

    const hoveredKey = `${containerId}:${voxelIndex}:${face}`;

    if (form.anchorType === 'face' && isWallFace) {
      if (hoveredKey !== lastHoveredRef.current) {
        const allObjects = Object.values(state.sceneObjects) as SceneObject[];
        const occupied = getOccupiedSlots(allObjects, containerId, voxelIndex, face as WallDirection, formRegistry);
        const validSlots = getSlotsForPlacement(occupied, form.slotWidth);

        if (validSlots.length === 0) {
          cachedSlotRef.current = { slot: 0, valid: false };
        } else {
          cachedSlotRef.current = { slot: validSlots[0], valid: true };
        }
      }
      slot = cachedSlotRef.current.slot;
      valid = cachedSlotRef.current.valid;
    }

    lastHoveredRef.current = hoveredKey;

    // Build a synthetic anchor for position calculation
    const anchor: ObjectAnchor = form.anchorType === 'face'
      ? { containerId, voxelIndex, type: 'face', face: face as WallDirection, slot }
      : { containerId, voxelIndex, type: form.anchorType as 'floor' | 'ceiling' };

    const localPos = anchorToLocalPosition(anchor, container);
    const localRot = anchorToLocalRotation(anchor);

    // Nudge floor/ceiling slightly to avoid z-fighting
    if (form.anchorType === 'floor') localPos[1] += 0.01;
    if (form.anchorType === 'ceiling') localPos[1] -= 0.01;

    const worldPos = localToWorld(localPos, container);
    const worldRot = localRotToWorld(localRot, container);

    mesh.position.set(worldPos[0], worldPos[1], worldPos[2]);
    mesh.rotation.set(worldRot[0], worldRot[1], worldRot[2]);
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
