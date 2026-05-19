'use client';

/**
 * U3: Voxel-face hover preview.
 *
 * Renders a translucent overlay of the hotbar-active surface at the
 * currently-hovered face, BEFORE click. Eliminates "did I click the
 * right face?" anxiety.
 *
 * Plan: docs/plans/2026-05-18-001-feat-building-ux-industry-parity-plan.md (U3, R3, AE2)
 * Pattern: mirrors DragGhost's translucent-clone approach.
 *
 * Subscribes to:
 * - hoveredVoxelEdge (set by ContainerSkin pointer handlers)
 * - activeHotbarSlot + hotbar (resolved by resolveHotbarFaceMaterial)
 *
 * Renders nothing when:
 * - No hovered face (hoveredVoxelEdge is null)
 * - No hotbar selection or active slot has no face data
 * - We are in walkthrough mode (FPV camera doesn't need a paint preview)
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import { resolveHotbarFaceMaterial } from '@/store/selectors/facePaintPreview';
import { getMaterialForFace } from '@/config/materialCache';
import { CONTAINER_DIMENSIONS, ViewMode, VOXEL_COLS, VOXEL_ROWS } from '@/types/container';

const PREVIEW_OPACITY = 0.45;
const NORMAL_OFFSET = 0.008; // metres, prevents z-fighting with the real face

const _previewMatCache = new Map<string, THREE.Material>();

export function FacePaintPreview() {
  const hovered = useStore((s) => s.hoveredVoxelEdge);
  const containers = useStore((s) => s.containers);
  const activeTheme = useStore((s) => s.currentTheme);
  const viewMode = useStore((s) => s.viewMode);
  const hotbarSurface = useStore((s) =>
    hovered ? resolveHotbarFaceMaterial(s, hovered.face as never) : null,
  );

  const previewMaterial = useMemo(() => {
    if (!hotbarSurface) return null;
    const key = `${activeTheme}:${hotbarSurface}`;
    const cached = _previewMatCache.get(key);
    if (cached) return cached;
    const base = getMaterialForFace(hotbarSurface, undefined, activeTheme);
    const clone = base.clone();
    clone.transparent = true;
    if ('opacity' in clone && typeof clone.opacity === 'number') {
      clone.opacity = PREVIEW_OPACITY;
    }
    clone.depthWrite = false;
    _previewMatCache.set(key, clone);
    return clone;
  }, [hotbarSurface, activeTheme]);

  if (!hovered || !previewMaterial || viewMode === ViewMode.Walkthrough) return null;

  const container = containers[hovered.containerId];
  if (!container || !container.voxelGrid) return null;

  const dims = CONTAINER_DIMENSIONS[container.size];
  const { length, width, height } = dims;
  const voxelIndex = hovered.voxelIndex;
  const level = Math.floor(voxelIndex / (VOXEL_ROWS * VOXEL_COLS));
  const cellInLevel = voxelIndex % (VOXEL_ROWS * VOXEL_COLS);
  const row = Math.floor(cellInLevel / VOXEL_COLS);
  const col = cellInLevel % VOXEL_COLS;

  // Voxel cell center in container-local coords.
  // Voxel grid maps: col axis along container length (X), row along width (Z).
  const colPitch = length / VOXEL_COLS;
  const rowPitch = width / VOXEL_ROWS;
  const levelHeight = height / 2;
  const localX = -length / 2 + (col + 0.5) * colPitch;
  const localZ = -width / 2 + (row + 0.5) * rowPitch;
  const localY = level * levelHeight + levelHeight / 2;

  // Face geometry: a thin quad on the named face.
  // Returns (size on plane axes, position offset, rotation Euler).
  const face = hovered.face;
  let planeW = colPitch;
  let planeH = rowPitch;
  let posOffset: [number, number, number] = [0, 0, 0];
  let rotation: [number, number, number] = [0, 0, 0];
  switch (face) {
    case 'top':
      planeW = colPitch; planeH = rowPitch;
      posOffset = [0, levelHeight / 2 + NORMAL_OFFSET, 0];
      rotation = [-Math.PI / 2, 0, 0];
      break;
    case 'bottom':
      planeW = colPitch; planeH = rowPitch;
      posOffset = [0, -levelHeight / 2 - NORMAL_OFFSET, 0];
      rotation = [Math.PI / 2, 0, 0];
      break;
    case 'n':
      planeW = colPitch; planeH = levelHeight;
      posOffset = [0, 0, -rowPitch / 2 - NORMAL_OFFSET];
      rotation = [0, 0, 0];
      break;
    case 's':
      planeW = colPitch; planeH = levelHeight;
      posOffset = [0, 0, rowPitch / 2 + NORMAL_OFFSET];
      rotation = [0, Math.PI, 0];
      break;
    case 'e':
      planeW = rowPitch; planeH = levelHeight;
      posOffset = [colPitch / 2 + NORMAL_OFFSET, 0, 0];
      rotation = [0, Math.PI / 2, 0];
      break;
    case 'w':
      planeW = rowPitch; planeH = levelHeight;
      posOffset = [-colPitch / 2 - NORMAL_OFFSET, 0, 0];
      rotation = [0, -Math.PI / 2, 0];
      break;
    default:
      return null;
  }

  const worldX = container.position.x + localX + posOffset[0];
  const worldY = container.position.y + localY + posOffset[1];
  const worldZ = container.position.z + localZ + posOffset[2];

  return (
    <mesh
      position={[worldX, worldY, worldZ]}
      rotation={rotation}
      material={previewMaterial}
      raycast={() => null}
    >
      <planeGeometry args={[planeW, planeH]} />
    </mesh>
  );
}
