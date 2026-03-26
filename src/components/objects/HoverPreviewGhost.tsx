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
import { nullRaycast } from '@/utils/nullRaycast';
import { getCachedPlane } from '@/utils/geometryCache';
import { createGhostMaterial } from '@/utils/ghostMaterial';
import { getMaterialForFace } from '@/config/materialCache';
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
  type SurfaceType,
  type FaceFinish,
} from '@/types/container';
import { getVoxelLayout } from '@/components/objects/ContainerSkin';

const PREVIEW_COLOR = new THREE.Color('#3b82f6');
const PREVIEW_OPACITY = 0.25;

export function HoverPreviewGhost() {
  const formId = useStore((s) => s.hoveredFormId);
  const placementActive = useStore((s) => s.activePlacementFormId);
  const ghostPreset = useStore((s) => s.ghostPreset);
  const stampPreview = useStore((s) => s.stampPreview);

  return (
    <>
      {/* Form placement preview */}
      {formId && !placementActive && <HoverPreviewGhostInner formId={formId} />}
      {/* Preset hover ghost */}
      {ghostPreset && <PresetGhost />}
      {/* Stamp mode ghost — green tint on hovered face */}
      {stampPreview && <StampGhost />}
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

// ── PresetGhost — face-coded overlay on selected voxel(s) when preset card is hovered ──

// Face-coded ghost materials: solid faces blue, glass faces lighter blue, open faces invisible
const _ghostMats = {
  solid: new THREE.MeshBasicMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.30, depthWrite: false, side: THREE.DoubleSide }),
  glass: new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.20, depthWrite: false, side: THREE.DoubleSide }),
};

// Determine material based on surface type — glass-like surfaces get lighter tint
const GLASS_SURFACES: ReadonlySet<SurfaceType> = new Set([
  'Glass_Pane', 'Railing_Glass', 'Glass_Shoji', 'Wall_Washi',
  'Window_Standard', 'Window_Sill', 'Window_Clerestory',
]);
const _activeGhostMats: THREE.Material[] = [];

function ghostMatForSurface(surfaceType: SurfaceType): THREE.MeshBasicMaterial | null {
  if (surfaceType === 'Open') return null;
  if (GLASS_SURFACES.has(surfaceType)) return _ghostMats.glass;
  return _ghostMats.solid;
}

// Reusable pool: avoid creating/destroying meshes every frame
const GHOST_POOL_SIZE = 48; // max 8 voxels × 6 faces
let _ghostPool: THREE.Mesh[] | null = null;
function getGhostPool(): THREE.Mesh[] {
  if (!_ghostPool) {
    _ghostPool = [];
    const placeholder = new THREE.PlaneGeometry(1, 1);
    for (let i = 0; i < GHOST_POOL_SIZE; i++) {
      const m = new THREE.Mesh(placeholder, _ghostMats.solid);
      m.visible = false;
      m.raycast = nullRaycast;
      _ghostPool.push(m);
    }
  }
  return _ghostPool;
}

// Face layout templates — static rotations, reused to avoid per-frame allocation
const FACE_KEYS: ReadonlyArray<keyof import('@/types/container').VoxelFaces> = ['top', 'bottom', 'n', 's', 'e', 'w'];
const FACE_RX = [-Math.PI / 2, -Math.PI / 2, 0, 0, 0, 0];
const FACE_RY = [0, 0, 0, Math.PI, Math.PI / 2, -Math.PI / 2];

function PresetGhost() {
  const groupRef = useRef<THREE.Group>(null);

  // Attach pool meshes to the group once
  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const pool = getGhostPool();
    for (const m of pool) group.add(m);
    return () => {
      for (const m of pool) { m.visible = false; group.remove(m); }
    };
  }, []);

  // Single useFrame: pulse opacity + position face panels
  useFrame(({ clock }) => {
    const group = groupRef.current;
    if (!group) return;

    // Pulse opacity (flat ghost mats — always active)
    const t = (Math.sin(clock.getElapsedTime() * Math.PI * 2 / 0.8) + 1) / 2;
    _ghostMats.solid.opacity = 0.22 + t * 0.12;
    _ghostMats.glass.opacity = 0.14 + t * 0.10;

    const pool = getGhostPool();
    _activeGhostMats.length = 0;

    const state = useStore.getState();
    const { ghostPreset, containers } = state;
    const selectedVoxel = getSelectedVoxel();
    const selectedVoxels = getSelectedVoxels();

    if (!ghostPreset) {
      group.visible = false;
      for (const m of pool) m.visible = false;
      return;
    }

    // Determine target container + indices
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
      for (const m of pool) m.visible = false;
      return;
    }

    const container = containers[containerId];
    if (!container) {
      group.visible = false;
      for (const m of pool) m.visible = false;
      return;
    }

    const dims = CONTAINER_DIMENSIONS[container.size as ContainerSize];
    const vHeight = dims.height / VOXEL_LEVELS;
    const halfH = vHeight / 2;
    const { faces } = ghostPreset;

    // Pre-compute container transform (avoid recomputing cos/sin per face)
    const cp = container.position;
    const cosR = Math.cos(container.rotation);
    const sinR = Math.sin(container.rotation);
    const rot = container.rotation;

    let poolIdx = 0;

    for (const idx of indices) {
      const col = idx % VOXEL_COLS;
      const row = Math.floor(idx / VOXEL_COLS) % VOXEL_ROWS;
      const level = Math.floor(idx / (VOXEL_COLS * VOXEL_ROWS));

      const { voxW, voxD, px, pz } = getVoxelLayout(col, row, dims);
      const cy = level * vHeight + halfH;
      const halfW = voxW / 2;
      const halfD = voxD / 2;

      // Per-face: local position offsets, plane dimensions
      // [lx, ly, lz, pw, ph] for each of the 6 faces
      const faceData: [number, number, number, number, number][] = [
        [px,         cy + halfH, pz,         voxW,    voxD],     // top
        [px,         cy - halfH, pz,         voxW,    voxD],     // bottom
        [px,         cy,         pz - halfD, voxW,    vHeight],  // n
        [px,         cy,         pz + halfD, voxW,    vHeight],  // s
        [px + halfW, cy,         pz,         voxD,    vHeight],  // e
        [px - halfW, cy,         pz,         voxD,    vHeight],  // w
      ];

      for (let fi = 0; fi < 6; fi++) {
        const faceKey = FACE_KEYS[fi];
        const surfType = faces[faceKey];
        if (surfType === 'Open' || poolIdx >= GHOST_POOL_SIZE) continue;

        const [lx, ly, lz, pw, ph] = faceData[fi];
        const mesh = pool[poolIdx++];
        mesh.geometry = getCachedPlane(pw, ph);

        // Check for material-accurate path via materialMap
        const matDef = ghostPreset.materialMap?.[faceKey as keyof typeof ghostPreset.materialMap];
        let faceMat: THREE.Material;

        if (matDef) {
          // Material-accurate path: resolve MaterialDef → actual material → ghost clone
          const finish = matDef.finishMeta as FaceFinish | undefined;
          const baseMat = getMaterialForFace(matDef.surfaceType, finish, state.currentTheme ?? 'industrial');
          faceMat = createGhostMaterial(baseMat);
          _activeGhostMats.push(faceMat);
        } else {
          // Fallback: use surface type from faces field
          faceMat = GLASS_SURFACES.has(surfType) ? _ghostMats.glass : _ghostMats.solid;
        }

        mesh.material = faceMat;

        // Inline localToWorld — container transform computed once outside loop
        mesh.position.set(
          cp.x + lx * cosR - lz * sinR,
          cp.y + ly,
          cp.z + lx * sinR + lz * cosR,
        );
        mesh.rotation.set(FACE_RX[fi], FACE_RY[fi] + rot, 0);
        mesh.visible = true;
      }
    }

    // Hide unused pool meshes
    for (let i = poolIdx; i < GHOST_POOL_SIZE; i++) {
      pool[i].visible = false;
    }

    // Pulse material-accurate ghosts (after pool is populated with fresh mats)
    for (const mat of _activeGhostMats) {
      mat.opacity = 0.22 + t * 0.12;
    }

    // Pop animation
    const { ghostPopActive, ghostPopStartTime } = state;
    if (ghostPopActive) {
      const elapsed = performance.now() - ghostPopStartTime;
      const progress = Math.min(elapsed / 200, 1); // 200ms duration
      let scale: number;
      if (progress < 0.4) {
        scale = 1.0 + 0.06 * (progress / 0.4);
      } else {
        scale = 1.06 - 0.06 * ((progress - 0.4) / 0.6);
      }
      for (let i = 0; i < poolIdx; i++) {
        pool[i].scale.setScalar(scale);
      }
      if (progress >= 1.0) {
        state.clearGhostPop();
        for (let i = 0; i < poolIdx; i++) pool[i].scale.setScalar(1.0);
      }
    } else {
      for (let i = 0; i < poolIdx; i++) pool[i].scale.setScalar(1.0);
    }

    group.visible = true;
  });

  return <group ref={groupRef} />;
}

// ── StampGhost — green transparent overlay on hovered face during stamp mode ──

const STAMP_COLOR = new THREE.Color(0x22c55e);
const STAMP_THICKNESS = 0.02;

function StampGhost() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial | null>(null);

  if (!materialRef.current) {
    materialRef.current = new THREE.MeshBasicMaterial({
      color: STAMP_COLOR,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  useEffect(() => {
    const mat = materialRef.current;
    return () => { mat?.dispose(); };
  }, []);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const state = useStore.getState();
    const { stampPreview, hoveredVoxelEdge, containers } = state;

    if (!stampPreview || !hoveredVoxelEdge) {
      mesh.visible = false;
      return;
    }

    const { containerId, voxelIndex, face } = hoveredVoxelEdge;
    const container = containers[containerId];
    if (!container) { mesh.visible = false; return; }

    const dims = CONTAINER_DIMENSIONS[container.size as ContainerSize];
    const vHeight = dims.height / VOXEL_LEVELS;

    const col = voxelIndex % VOXEL_COLS;
    const row = Math.floor(voxelIndex / VOXEL_COLS) % VOXEL_ROWS;
    const level = Math.floor(voxelIndex / (VOXEL_COLS * VOXEL_ROWS));

    // Dynamic voxel dimensions — correct for both body and halo/extension voxels
    const { voxW, voxD, px, pz } = getVoxelLayout(col, row, dims);

    // Voxel center in local space
    const cx = px;
    const cy = level * vHeight + vHeight / 2;
    const cz = pz;

    // Offset to face center + geometry sizing
    let lx = cx, ly = cy, lz = cz;
    let gw = voxW, gh = vHeight, gd = voxD; // face-sized defaults

    switch (face) {
      case 'n':  lz -= voxD / 2; gw = voxW; gh = vHeight; gd = STAMP_THICKNESS; break;
      case 's':  lz += voxD / 2; gw = voxW; gh = vHeight; gd = STAMP_THICKNESS; break;
      case 'e':  lx += voxW / 2; gw = STAMP_THICKNESS; gh = vHeight; gd = voxD; break;
      case 'w':  lx -= voxW / 2; gw = STAMP_THICKNESS; gh = vHeight; gd = voxD; break;
      case 'top':    ly += vHeight / 2; gw = voxW; gh = STAMP_THICKNESS; gd = voxD; break;
      case 'bottom': ly -= vHeight / 2; gw = voxW; gh = STAMP_THICKNESS; gd = voxD; break;
      default: mesh.visible = false; return;
    }

    const worldPos = localToWorld([lx, ly, lz], container);
    mesh.position.set(worldPos[0], worldPos[1], worldPos[2]);
    mesh.rotation.y = container.rotation;
    mesh.scale.set(gw, gh, gd);
    mesh.visible = true;
  });

  const unitBox = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  return (
    <mesh
      ref={meshRef}
      geometry={unitBox}
      material={materialRef.current!}
      visible={false}
      raycast={() => {}}
    />
  );
}
