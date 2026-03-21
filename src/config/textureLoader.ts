/**
 * Consolidated texture path resolver and loader.
 * Replaces pbrTextures.ts. Quality-aware: returns JPG, KTX2, or null paths.
 */
import * as THREE from 'three';

export type TextureQuality = 'flat' | '1k' | '2k';

export interface TexturePaths {
  color: string;
  normal: string;
  roughness: string;
  ao?: string;
  metalness?: string;
}

const BASE_JPG = '/assets/materials';
const BASE_KTX2 = '/assets/materials-ktx2';

export function getTexturePaths(folder: string, quality: TextureQuality): TexturePaths | null {
  if (quality === 'flat') return null;
  const base = quality === '2k' ? BASE_KTX2 : BASE_JPG;
  const ext = quality === '2k' ? '.ktx2' : '.jpg';
  return {
    color: `${base}/${folder}/color${ext}`,
    normal: `${base}/${folder}/normal${ext}`,
    roughness: `${base}/${folder}/roughness${ext}`,
  };
}

let _textureLoader: THREE.TextureLoader | null = null;
function getTextureLoader() {
  if (!_textureLoader) _textureLoader = new THREE.TextureLoader();
  return _textureLoader;
}

export function applyTextures(
  mat: THREE.MeshStandardMaterial,
  paths: TexturePaths,
  repeatX = 2,
  repeatY = 2,
  normalScale = 0.6,
): void {
  const onError = (url: string) => () =>
    console.warn(`[textureLoader] Failed to load ${url} — using flat color fallback`);

  const configure = (t: THREE.Texture) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.needsUpdate = true;
  };

  getTextureLoader().load(paths.color, (t) => {
    configure(t);
    t.colorSpace = THREE.SRGBColorSpace;
    mat.map = t;
    mat.color.setHex(0xffffff);
    mat.needsUpdate = true;
  }, undefined, onError(paths.color));

  getTextureLoader().load(paths.normal, (t) => {
    configure(t);
    mat.normalMap = t;
    mat.normalScale.set(normalScale, normalScale);
    mat.needsUpdate = true;
  }, undefined, onError(paths.normal));

  getTextureLoader().load(paths.roughness, (t) => {
    configure(t);
    mat.roughnessMap = t;
    mat.needsUpdate = true;
  }, undefined, onError(paths.roughness));
}
