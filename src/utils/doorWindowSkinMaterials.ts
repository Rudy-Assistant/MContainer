/**
 * doorWindowSkinMaterials.ts — Cached THREE materials per door/window skin.
 *
 * Each skin (oak_solid, walnut_glazed, aluminum_black_glazed, …) maps to a
 * trio of materials: panel (or glass), frame, hardware. Cached at module
 * scope so we don't allocate per-frame per-voxel.
 *
 * Materials use MeshStandardMaterial for solid surfaces and
 * MeshPhysicalMaterial for glass (transmission support).
 */

import * as THREE from 'three';
import { DOOR_SKINS, type DoorSkinId } from '@/config/doorSkins';
import { WINDOW_SKINS, type WindowSkinId } from '@/config/windowSkins';

export interface DoorSkinMaterials {
  panel: THREE.Material;
  frame: THREE.Material;
  hardware: THREE.Material;
  glazed: boolean;
}

export interface WindowSkinMaterials {
  frame: THREE.Material;
  mullion: THREE.Material;
  glass: THREE.Material;
}

const _doorCache = new Map<DoorSkinId, DoorSkinMaterials>();
const _windowCache = new Map<WindowSkinId, WindowSkinMaterials>();

function buildDoorMats(id: DoorSkinId): DoorSkinMaterials {
  const skin = DOOR_SKINS.find((s) => s.id === id) ?? DOOR_SKINS[0];

  const panel: THREE.Material = skin.glazed
    ? new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(skin.panelColor),
        metalness: 0.05,
        roughness: 0.05,
        transmission: skin.glassTransmission ?? 0.85,
        thickness: 0.02,
        ior: 1.5,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    : new THREE.MeshStandardMaterial({
        color: new THREE.Color(skin.panelColor),
        metalness: skin.swatchHint === 'metal' ? 0.55 : 0.05,
        roughness: skin.swatchHint === 'wood' ? 0.65 : skin.swatchHint === 'metal' ? 0.4 : 0.55,
      });

  const frame = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.frameColor ?? skin.panelColor),
    metalness: skin.swatchHint === 'metal' ? 0.7 : 0.15,
    roughness: 0.4,
  });

  const hardware = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.hardwareColor),
    metalness: 0.85,
    roughness: 0.25,
  });

  return { panel, frame, hardware, glazed: skin.glazed };
}

function buildWindowMats(id: WindowSkinId): WindowSkinMaterials {
  const skin = WINDOW_SKINS.find((s) => s.id === id) ?? WINDOW_SKINS[0];

  const frame = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.frameColor),
    metalness: skin.swatchHint === 'metal' ? 0.65 : 0.1,
    roughness: skin.swatchHint === 'wood' ? 0.6 : 0.4,
  });

  const mullion = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.mullionColor ?? skin.frameColor),
    metalness: skin.swatchHint === 'metal' ? 0.7 : 0.1,
    roughness: 0.4,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(skin.glassColor),
    metalness: 0.0,
    roughness: 0.05,
    transmission: skin.glassTransmission,
    thickness: 0.02,
    ior: 1.5,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });

  return { frame, mullion, glass };
}

export function getDoorSkinMaterials(id?: DoorSkinId): DoorSkinMaterials {
  const key = id ?? 'oak_solid';
  let cached = _doorCache.get(key);
  if (!cached) {
    cached = buildDoorMats(key);
    _doorCache.set(key, cached);
  }
  return cached;
}

export function getWindowSkinMaterials(id?: WindowSkinId): WindowSkinMaterials {
  const key = id ?? 'aluminum_black';
  let cached = _windowCache.get(key);
  if (!cached) {
    cached = buildWindowMats(key);
    _windowCache.set(key, cached);
  }
  return cached;
}
