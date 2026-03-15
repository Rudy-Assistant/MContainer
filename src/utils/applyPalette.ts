import { _themeMats } from '@/config/materialCache';
import * as THREE from 'three';
import type { MaterialPalette } from '@/store/slices/librarySlice';
import type { ThemeId } from '@/config/themes';

export function applyPalette(palette: MaterialPalette, theme: ThemeId) {
  const mats = _themeMats[theme] ?? _themeMats.industrial;
  mats.steel.color.setHex(palette.steelColor);
  mats.steel.metalness = palette.steelMetalness;
  mats.steel.roughness = palette.steelRoughness;
  mats.steel.needsUpdate = true;
  mats.frame.color.setHex(palette.frameColor);
  mats.frame.metalness = palette.frameMetalness;
  mats.frame.needsUpdate = true;
  const glass = mats.glass as THREE.MeshPhysicalMaterial;
  if (glass?.transmission !== undefined) {
    glass.transmission = palette.glassTransmission;
    glass.needsUpdate = true;
  }
  mats.wood.color.setHex(palette.woodColor);
  mats.wood.needsUpdate = true;
}
