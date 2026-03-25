'use client';

/**
 * HoverPreviewGhost.tsx — Shows a semi-transparent preview of a form
 * at the hovered voxel face when a BottomPanel card is hovered (not clicked).
 *
 * Active when: hoveredFormId is set AND activePlacementFormId is NOT set.
 * Blue tint, 0.25 opacity. No slot validation — purely visual preview.
 *
 * Also renders a preset hover ghost (ghostPreset) over the selected voxel(s)
 * when a BlockTab or ContainerPresetRow card is hovered.
 */

import { useStore } from '@/store/useStore';
import { getSelectedVoxel } from '@/hooks/useSelectedVoxel';
import { getSelectedVoxels } from '@/hooks/useSelectedVoxels';
import { formRegistry } from '@/config/formRegistry';
import { localToWorld, anchorToLocalPosition, anchorToLocalRotation, localRotToWorld } from '@/utils/anchorMath';
import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ObjectAnchor, WallDirection } from '@/types/sceneObject';
import { isWallDirection } from '@/types/sceneObject';
import {
  CONTAINER_DIMENSIONS,
  VOXEL_COLS,
  VOXEL_ROWS,
  VOXEL_LEVELS,
  ContainerSize,
} from '@/types/container';

const PREVIEW_COLOR = new THREE.Color('#3b82f6');
const PREVIEW_OPACITY = 0.25;

export function HoverPreviewGhost() {
  const formId = useStore((s) => s.hoveredFormId);
  const placementActive = useStore((s) => s.activePlacementFormId);
  const ghostPreset = useStore((s) => s.ghostPreset);

  return (
    <>
      {/* Form placement preview */}
      {formId && !placementActive && <HoverPreviewGhostInner formId={formId} />}
      {/* Preset hover ghost */}
      {ghostPreset && <PresetGhost />}
    </>
  );
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
  useEffect(() => {
    const mat = materialRef.current;
    return () => { mat?.dispose(); };
  }, []);

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
    if (form.anchorType === 'face' && !isWallDirection(face)) { mesh.visible = false; return; }
    if (form.anchorType === 'floor' && face !== 'bottom') { mesh.visible = false; return; }
    if (form.anchorType === 'ceiling' && face !== 'top') { mesh.visible = false; return; }

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

// ── PresetGhost — overlay on selected voxel(s) when preset card is hovered ──

const GHOST_COLOR = new THREE.Color('#60a5fa'); // blue-400

function PresetGhost() {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);

  if (!materialRef.current) {
    materialRef.current = new THREE.MeshBasicMaterial({
      color: GHOST_COLOR,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  useEffect(() => {
    const mat = materialRef.current;
    return () => { mat?.dispose(); };
  }, []);

  // Pulse animation: opacity oscillates 0.25↔0.40 over 800ms
  useFrame(({ clock }) => {
    if (!materialRef.current) return;
    const t = (Math.sin(clock.getElapsedTime() * Math.PI * 2 / 0.8) + 1) / 2;
    materialRef.current.opacity = 0.25 + t * 0.15;
  });

  // Compute mesh positions from store state
  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const state = useStore.getState();
    const { ghostPreset, containers } = state;
    const selectedVoxel = getSelectedVoxel();
    const selectedVoxels = getSelectedVoxels();

    if (!ghostPreset) {
      group.visible = false;
      return;
    }

    // Determine which container + indices to highlight
    let containerId: string | null = null;
    let indices: number[] = [];

    if (selectedVoxel && !selectedVoxel.isExtension) {
      containerId = selectedVoxel.containerId;
      if (ghostPreset.targetScope === 'bay' && selectedVoxels?.containerId === selectedVoxel.containerId) {
        indices = selectedVoxels.indices;
      } else {
        indices = [(selectedVoxel as { containerId: string; index: number }).index];
      }
    } else if (selectedVoxels) {
      containerId = selectedVoxels.containerId;
      indices = selectedVoxels.indices;
    }

    if (!containerId || indices.length === 0) {
      group.visible = false;
      return;
    }

    const container = containers[containerId];
    if (!container) {
      group.visible = false;
      return;
    }

    const dims = CONTAINER_DIMENSIONS[container.size as ContainerSize];
    const colPitch = dims.length / 6;
    const rowPitch = dims.width / 2;
    const vHeight = dims.height / VOXEL_LEVELS;

    // Clear old children
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const mat = materialRef.current!;
    const boxGeo = new THREE.BoxGeometry(colPitch, vHeight, rowPitch);

    for (const idx of indices) {
      const col = idx % VOXEL_COLS;
      const row = Math.floor(idx / VOXEL_COLS) % VOXEL_ROWS;
      const level = Math.floor(idx / (VOXEL_COLS * VOXEL_ROWS));

      const localX = -(col - 3.5) * colPitch;
      const localY = level * vHeight + vHeight / 2;
      const localZ = (row - 1.5) * rowPitch;

      const worldPos = localToWorld([localX, localY, localZ], container);

      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.position.set(worldPos[0], worldPos[1], worldPos[2]);
      mesh.rotation.y = container.rotation;
      mesh.raycast = () => {};
      group.add(mesh);
    }

    group.visible = true;
  });

  useEffect(() => {
    return () => {
      const group = groupRef.current;
      if (group) {
        while (group.children.length > 0) {
          const mesh = group.children[0] as THREE.Mesh;
          mesh.geometry?.dispose();
          group.remove(mesh);
        }
      }
    };
  }, []);

  return <group ref={groupRef} />;
}
