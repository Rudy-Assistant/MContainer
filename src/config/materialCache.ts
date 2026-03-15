/**
 * materialCache.ts — Shared PBR material singletons for all themes.
 *
 * Owns the ThemeMaterialSet interface, material factory, texture loading,
 * and the _themeMats singleton cache. Imported by ContainerSkin, Scene,
 * and applyPalette — NOT a component file.
 */

import * as THREE from 'three';
import { THEMES, type ThemeId, type ThemeMaterialConfig, type ThemeTextureSet } from './themes';

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

// ── Material Factory ────────────────────────────────────────

function buildThemeMaterials(cfg: ThemeMaterialConfig): ThemeMaterialSet {
  return {
    steel: new THREE.MeshStandardMaterial({
      color: cfg.steel.color,
      metalness: cfg.steel.metalness,
      roughness: cfg.steel.roughness,
      ...(cfg.steel.useCorrugation ? {
        normalMap: _corrugNormal,
        normalScale: new THREE.Vector2(0.8, 0.8),
      } : {}),
      envMapIntensity: 0.6,
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
    }),
    frame: new THREE.MeshStandardMaterial({
      color: cfg.frame.color,
      metalness: cfg.frame.metalness,
      roughness: cfg.frame.roughness,
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

// ── Per-theme Texture Loading ───────────────────────────────

let _textureLoader: THREE.TextureLoader | null = null;
export function getTextureLoader() {
  if (!_textureLoader) _textureLoader = new THREE.TextureLoader();
  return _textureLoader;
}

function loadThemeTextures(matSet: ThemeMaterialSet, textures: ThemeTextureSet) {
  const onError = (url: string) => () => console.warn(`ModuHome: Failed to load texture ${url} — using flat color fallback`);

  function applyTexture(mat: THREE.MeshStandardMaterial, dir: string, repeatX = 2, repeatY = 2) {
    const colorUrl = `${dir}color.jpg`;
    getTextureLoader().load(colorUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      t.colorSpace = THREE.SRGBColorSpace;
      mat.map = t;
      mat.color.setHex(0xffffff);
      mat.needsUpdate = true;
    }, undefined, onError(colorUrl));
    const normalUrl = `${dir}normal.jpg`;
    getTextureLoader().load(normalUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      mat.normalMap = t;
      mat.normalScale = new THREE.Vector2(0.6, 0.6);
      mat.needsUpdate = true;
    }, undefined, onError(normalUrl));
    const roughUrl = `${dir}roughness.jpg`;
    getTextureLoader().load(roughUrl, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeatX, repeatY);
      mat.roughnessMap = t;
      mat.needsUpdate = true;
    }, undefined, onError(roughUrl));
  }

  if (textures.exterior_wall) applyTexture(matSet.steel, textures.exterior_wall, 3, 1);
  if (textures.interior_wall) applyTexture(matSet.steelInner, textures.interior_wall);
  if (textures.floor)         applyTexture(matSet.wood, textures.floor, 4, 1);
  if (textures.ceiling)       applyTexture(matSet.concrete, textures.ceiling);
}

// ── Singleton Cache ─────────────────────────────────────────

export const _themeMats: Record<ThemeId, ThemeMaterialSet> = {
  industrial: buildThemeMaterials(THEMES.industrial.materials),
  japanese:   buildThemeMaterials(THEMES.japanese.materials),
  desert:     buildThemeMaterials(THEMES.desert.materials),
};

// Load textures for each theme's materials (skip during SSR — no document)
if (typeof document !== 'undefined') {
  for (const themeId of Object.keys(THEMES) as ThemeId[]) {
    loadThemeTextures(_themeMats[themeId], THEMES[themeId].textures);
  }
}
