'use client';

/**
 * HoverPreviewGhost.tsx — Shows a semi-transparent preview of a form
 * at the hovered voxel face when a BottomPanel card is hovered (not clicked).
 *
 * Active when: hoveredFormId is set AND activePlacementFormId is NOT set.
 * Blue tint, 0.25 opacity. No slot validation — purely visual preview.
 */

import { useStore } from '@/store/useStore';
import { formRegistry } from '@/config/formRegistry';
import { anchorToLocalPosition, anchorToLocalRotation, localToWorld, localRotToWorld } from '@/utils/anchorMath';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ObjectAnchor, WallDirection } from '@/types/sceneObject';

const PREVIEW_COLOR = new THREE.Color('#3b82f6');
const PREVIEW_OPACITY = 0.25;

export function HoverPreviewGhost() {
  const formId = useStore((s) => s.hoveredFormId);
  const placementActive = useStore((s) => s.activePlacementFormId);

  // Only show when hovering a card and NOT in placement mode
  if (!formId || placementActive) return null;
  return <HoverPreviewGhostInner formId={formId} />;
}

function HoverPreviewGhostInner({ formId }: { formId: string }) {
  const form = formRegistry.get(formId);
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  if (!materialRef.current) {
    materialRef.current = new THREE.MeshStandardMaterial({
      color: PREVIEW_COLOR,
      transparent: true,
      opacity: PREVIEW_OPACITY,
      depthWrite: false,
    });
  }

  const geometry = useMemo(() => {
    if (!form) return new THREE.BoxGeometry(0.5, 1, 0.1);
    return new THREE.BoxGeometry(form.dimensions.w, form.dimensions.h, form.dimensions.d);
  }, [form]);

  useEffect(() => () => { geometry.dispose(); }, [geometry]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || !form) return;

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

    if (form.anchorType === 'face' && !isWallFace) { mesh.visible = false; return; }
    if (form.anchorType === 'floor' && !isFloor) { mesh.visible = false; return; }
    if (form.anchorType === 'ceiling' && !isCeiling) { mesh.visible = false; return; }

    const container = state.containers[containerId];
    if (!container) { mesh.visible = false; return; }

    // Build synthetic anchor (slot 0, no validation — just preview)
    const anchor: ObjectAnchor = form.anchorType === 'face'
      ? { containerId, voxelIndex, type: 'face', face: face as WallDirection, slot: 0 }
      : { containerId, voxelIndex, type: form.anchorType as 'floor' | 'ceiling' };

    const localPos = anchorToLocalPosition(anchor, container);
    const localRot = anchorToLocalRotation(anchor);

    if (form.anchorType === 'floor') localPos[1] += 0.01;
    if (form.anchorType === 'ceiling') localPos[1] -= 0.01;

    const worldPos = localToWorld(localPos, container);
    const worldRot = localRotToWorld(localRot, container);

    mesh.position.set(worldPos[0], worldPos[1], worldPos[2]);
    mesh.rotation.set(worldRot[0], worldRot[1], worldRot[2]);
    mesh.visible = true;
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
