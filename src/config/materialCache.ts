/**
 * materialCache.ts — Shared PBR material singletons for all themes.
 *
 * Owns the ThemeMaterialSet interface, material factory, texture loading,
 * and the _themeMats singleton cache. Imported by ContainerSkin, Scene,
 * and applyPalette — NOT a component file.
 */

import * as THREE from 'three';
import { THEMES, type ThemeId, type ThemeMaterialConfig } from './themes';
import { getTexturePaths, applyTextures, type TextureQuality } from './textureLoader';

// ── Theme Material Set ──────────────────────────────────────

export interface ThemeMaterialSet {
  steel:      THREE.MeshStandardMaterial;
  steelInner: THREE.MeshStandardMaterial;
  glass:      THREE.MeshPhysicalMaterial;
  frame:      THREE.MeshStandardMaterial;
  wood:       THREE.MeshStandardMaterial;
  woodGroove: THREE.MeshStandardMaterial;
  rail:       THREE.MeshStandardMaterial;
  railGlass:  THREE.MeshPhysicalMaterial;
  concrete:   THREE.MeshStandardMaterial;
}

// ── Corrugation Normal Map (module singleton) ───────────────

function makeCorrugNormal(w = 256, h = 64, ribs = 12, str = 0.85): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx  = Math.cos((x / w) * ribs * Math.PI * 2) * str;
      const len = Math.sqrt(dx * dx + 1);
      const i   = (y * w + x) * 4;
      data[i]     = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      data[i + 1] = 128;
      data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 1);
  t.needsUpdate = true;
  return t;
}
const _corrugNormal = makeCorrugNormal();

// ── Brushed Metal Normal Map (module singleton) ──────────────

function makeBrushedMetalNormal(w = 256, h = 256, lines = 64, str = 0.3): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.cos((y / h) * lines * Math.PI * 2) * str;
      const len = Math.sqrt(dx * dx + 1);
      const i = (y * w + x) * 4;
      data[i]     = 128;
      data[i + 1] = Math.round(((dx / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 2);
  t.needsUpdate = true;
  return t;
}
const _brushedMetalNormal = makeBrushedMetalNormal();

// ── Material Factory ────────────────────────────────────────

function buildThemeMaterials(cfg: ThemeMaterialConfig, quality: TextureQuality = '1k'): ThemeMaterialSet {
  return {
    steel: new THREE.MeshStandardMaterial({
      color: cfg.steel.color,
      metalness: cfg.steel.metalness,
      roughness: cfg.steel.roughness,
      ...(cfg.steel.useCorrugation ? {
        normalMap: _corrugNormal,
        normalScale: new THREE.Vector2(0.8, 0.8),
      } : {}),
      envMapIntensity: 0.8,
      side: THREE.DoubleSide,
    }),
    steelInner: new THREE.MeshStandardMaterial({
      color: cfg.steelInner.color,
      metalness: cfg.steelInner.metalness,
      roughness: cfg.steelInner.roughness,
      side: THREE.DoubleSide,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: cfg.glass.color,
      metalness: 0.0,
      roughness: cfg.glass.roughness,
      transmission: cfg.glass.transmission,
      thickness: 0.1,
      ior: cfg.glass.ior,
      transparent: true,
      ...(cfg.glass.opacity != null ? { opacity: cfg.glass.opacity } : {}),
      envMapIntensity: 1.0,
      side: THREE.DoubleSide,
      // High quality: clearcoat + tinted glass
      ...(quality === '2k' ? {
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        attenuationColor: new THREE.Color(0xe8f4f8),
        attenuationDistance: 5.0,
      } : {}),
    }),
    frame: new THREE.MeshStandardMaterial({
      color: cfg.frame.color,
      metalness: cfg.frame.metalness,
      roughness: cfg.frame.roughness,
      normalMap: _brushedMetalNormal,
      normalScale: new THREE.Vector2(0.3, 0.3),
      envMapIntensity: 0.8,
      side: THREE.DoubleSide,
    }),
    wood: new THREE.MeshStandardMaterial({
      color: cfg.wood.color,
      metalness: cfg.wood.metalness,
      roughness: cfg.wood.roughness,
      side: THREE.DoubleSide,
    }),
    woodGroove: new THREE.MeshStandardMaterial({
      color: cfg.woodGroove.color,
      metalness: 0.0,
      roughness: 0.95,
      side: THREE.DoubleSide,
    }),
    rail: new THREE.MeshStandardMaterial({
      color: cfg.rail.color,
      metalness: cfg.rail.metalness,
      roughness: cfg.rail.roughness,
      envMapIntensity: 0.8,
      side: THREE.DoubleSide,
    }),
    railGlass: new THREE.MeshPhysicalMaterial({
      color: cfg.railGlass.color,
      metalness: 0.0,
      roughness: 0.08,
      transmission: cfg.railGlass.transmission,
      thickness: 0.08,
      ior: 1.5,
      transparent: true,
      opacity: cfg.railGlass.opacity,
      side: THREE.DoubleSide,
    }),
    concrete: new THREE.MeshStandardMaterial({
      color: cfg.concrete.color,
      metalness: cfg.concrete.metalness,
      roughness: cfg.concrete.roughness,
      side: THREE.DoubleSide,
    }),
  };
}

// ── Quality-aware Texture Application ────────────────────────

export function applyQualityTextures(quality: TextureQuality, invalidate?: () => void) {
  for (const themeId of Object.keys(THEMES) as ThemeId[]) {
    const matSet = _themeMats[themeId];
    const textures = THEMES[themeId].textures;

    const steelPaths = getTexturePaths(textures.exterior_wall_folder, quality);
    if (steelPaths) applyTextures(matSet.steel, steelPaths, 3, 1, 0.6, invalidate, textures.exterior_wall_folder);

    const woodPaths = getTexturePaths(textures.floor_folder, quality);
    if (woodPaths) applyTextures(matSet.wood, woodPaths, 4, 1, 0.6, invalidate, textures.floor_folder);

    const concretePaths = getTexturePaths(textures.ceiling_folder, quality);
    if (concretePaths) applyTextures(matSet.concrete, concretePaths, 2, 2, 0.6, invalidate, textures.ceiling_folder);

    const innerPaths = getTexturePaths(textures.interior_wall_folder, quality);
    if (innerPaths) applyTextures(matSet.steelInner, innerPaths, 2, 2, 0.6, invalidate, textures.interior_wall_folder);
  }
}

// ── Singleton Cache ─────────────────────────────────────────

let _currentQuality: TextureQuality = '1k';

export let _themeMats: Record<ThemeId, ThemeMaterialSet> = {
  industrial: buildThemeMaterials(THEMES.industrial.materials),
  japanese:   buildThemeMaterials(THEMES.japanese.materials),
  desert:     buildThemeMaterials(THEMES.desert.materials),
};

/**
 * Rebuild all theme materials at a new quality level.
 * Build new materials BEFORE disposing old ones to avoid a frame where the
 * scene references disposed (black/corrupt) materials.
 */
export function rebuildThemeMaterials(quality: TextureQuality, invalidate?: () => void) {
  if (quality === _currentQuality) return;
  _currentQuality = quality;
  const oldMats = Object.values(_themeMats);
  for (const themeId of Object.keys(THEMES) as ThemeId[]) {
    _themeMats[themeId] = buildThemeMaterials(THEMES[themeId].materials, quality);
  }
  for (const matSet of oldMats) {
    for (const mat of Object.values(matSet)) {
      (mat as THREE.Material).dispose();
    }
  }
  applyQualityTextures(quality, invalidate);
}

// NOTE: No module-level texture loading here — QualityManager in Scene.tsx
// owns the initial applyQualityTextures call on mount, which ensures the
// correct quality is used (from persisted store state, not a hardcoded default).
