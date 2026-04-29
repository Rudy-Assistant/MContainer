/**
 * cabinetrySkinMaterials.ts — Cached THREE materials per cabinetry skin.
 *
 * Each skin maps to {body, door, handle, glass} materials. Cached at module
 * scope to avoid per-frame allocation.
 *
 * Mirrored skins (mirrorDoors: true) get a high-metalness/low-roughness
 * door material that picks up scene IBL — looks reflective without the cost
 * of a real planar reflector.
 */

import * as THREE from 'three';
import {
  type CabinetrySkinId,
  type CabinetryDoorStyle,
  DEFAULT_CABINETRY_SKIN,
  getCabinetrySkin,
} from '@/config/cabinetrySkins';

export interface CabinetrySkinMaterials {
  body: THREE.MeshStandardMaterial;
  door: THREE.Material;
  handle: THREE.MeshStandardMaterial;
  /** Glass material for glazed cabinet templates (e.g. glass_display_2door). */
  glass: THREE.MeshPhysicalMaterial;
  /** Re-exported from the skin so renderers can read it without a second lookup. */
  doorStyle: CabinetryDoorStyle;
}

const _cache = new Map<CabinetrySkinId, CabinetrySkinMaterials>();

function build(id: CabinetrySkinId): CabinetrySkinMaterials {
  const skin = getCabinetrySkin(id);

  const body = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.bodyColor),
    metalness: skin.swatchHint === 'metal' ? 0.55 : 0.05,
    roughness: skin.swatchHint === 'wood' ? 0.7 : skin.swatchHint === 'metal' ? 0.45 : 0.6,
  });

  const door: THREE.Material = skin.mirrorDoors
    ? new THREE.MeshStandardMaterial({
        color: new THREE.Color(skin.doorColor),
        metalness: 1.0,
        roughness: 0.05,
        envMapIntensity: 1.4,
      })
    : new THREE.MeshStandardMaterial({
        color: new THREE.Color(skin.doorColor),
        metalness: skin.swatchHint === 'metal' ? 0.65 : 0.06,
        roughness: skin.swatchHint === 'wood' ? 0.65 : skin.swatchHint === 'metal' ? 0.4 : 0.5,
      });

  const handle = new THREE.MeshStandardMaterial({
    color: new THREE.Color(skin.handleColor),
    metalness: 0.85,
    roughness: 0.3,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e8eef2'),
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 0.02,
    ior: 1.5,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });

  return { body, door, handle, glass, doorStyle: skin.doorStyle };
}

export function getCabinetrySkinMaterials(id?: CabinetrySkinId): CabinetrySkinMaterials {
  const key = id ?? DEFAULT_CABINETRY_SKIN;
  let mats = _cache.get(key);
  if (!mats) {
    mats = build(key);
    _cache.set(key, mats);
  }
  return mats;
}
