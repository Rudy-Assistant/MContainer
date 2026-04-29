/**
 * decorMaterials.ts — Cached THREE materials per decor palette.
 *
 * Peer of cabinetrySkinMaterials.ts and fixtureMaterials.ts. Each decor
 * palette resolves to a small bundle of materials covering frame, image
 * plane, mirror, TV screen, and a soft glass cover.
 */

import * as THREE from 'three';
import { type DecorPaletteId, getDecorPalette } from '@/config/decorTemplates';

export interface DecorMaterials {
  frame: THREE.MeshStandardMaterial;
  image: THREE.MeshStandardMaterial;
  mirror: THREE.MeshStandardMaterial;
  tvScreen: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
}

const _cache = new Map<DecorPaletteId, DecorMaterials>();

export function getDecorMaterials(paletteId: DecorPaletteId): DecorMaterials {
  const cached = _cache.get(paletteId);
  if (cached) return cached;
  const palette = getDecorPalette(paletteId);
  const out: DecorMaterials = {
    frame: new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.frameColor),
      metalness: palette.frameMetal ? 0.85 : 0.1,
      roughness: palette.frameMetal ? 0.3 : 0.55,
    }),
    image: new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette.imageColor),
      metalness: 0.05,
      roughness: 0.6,
    }),
    mirror: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#f0f0f0'),
      metalness: 1.0,
      roughness: 0.05,
      envMapIntensity: 1.4,
    }),
    tvScreen: new THREE.MeshStandardMaterial({
      color: new THREE.Color('#0a0a0c'),
      metalness: 0.5,
      roughness: 0.15,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#e8eef2'),
      metalness: 0,
      roughness: 0.05,
      transmission: 0.4,
      thickness: 0.005,
      ior: 1.5,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
    }),
  };
  _cache.set(paletteId, out);
  return out;
}
