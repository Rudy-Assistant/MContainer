/**
 * Consolidated texture path resolver and loader.
 * Quality-aware: returns JPG, KTX2, or null paths.
 * Supports fallback from KTX2 → JPG on load failure.
 */
import * as THREE from 'three';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

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

// ── Loader singletons ────────────────────────────────────────

let _textureLoader: THREE.TextureLoader | null = null;
function getTextureLoader() {
  if (!_textureLoader) _textureLoader = new THREE.TextureLoader();
  return _textureLoader;
}

let _ktx2Loader: KTX2Loader | null = null;
let _ktx2Ready = false;

/**
 * Initialize KTX2Loader with a GL renderer (needed for transcoder).
 * Safe to call multiple times — only initializes once.
 */
export function initKTX2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
  if (!_ktx2Loader) {
    _ktx2Loader = new KTX2Loader();
    _ktx2Loader.setTranscoderPath('/basis/');
    _ktx2Loader.detectSupport(renderer);
    _ktx2Ready = true;
  }
  return _ktx2Loader;
}

function getKTX2Loader(): KTX2Loader | null {
  return _ktx2Ready ? _ktx2Loader : null;
}

// ── Texture Application ──────────────────────────────────────

/**
 * Load and apply textures to a material.
 * New optional params (invalidate, fallbackFolder) are backward-compatible.
 */
export function applyTextures(
  mat: THREE.MeshStandardMaterial,
  paths: TexturePaths,
  repeatX = 2,
  repeatY = 2,
  normalScale = 0.6,
  invalidate?: () => void,
  fallbackFolder?: string,
): void {
  const isKTX2 = paths.color.endsWith('.ktx2');
  const ktx2 = isKTX2 ? getKTX2Loader() : null;

  const configure = (t: THREE.Texture) => {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.needsUpdate = true;
  };

  const afterLoad = () => {
    mat.needsUpdate = true;
    invalidate?.();
  };

  const loadChannel = (channel: 'color' | 'normal' | 'roughness', url: string, useKTX2: boolean) => {
    const onLoad = (t: THREE.Texture) => {
      configure(t);
      if (channel === 'color') {
        t.colorSpace = THREE.SRGBColorSpace;
        mat.map = t;
        mat.color.setHex(0xffffff);
      } else if (channel === 'normal') {
        mat.normalMap = t;
        mat.normalScale.set(normalScale, normalScale);
      } else {
        mat.roughnessMap = t;
      }
      afterLoad();
    };

    const onError = () => {
      console.warn(`[textureLoader] Failed to load ${url}`);
      // Fallback: on KTX2 error, retry with 1K JPG
      if (useKTX2 && fallbackFolder) {
        const jpgPaths = getTexturePaths(fallbackFolder, '1k');
        if (jpgPaths) {
          console.warn(`[textureLoader] KTX2 failed for ${url}, falling back to 1K JPG`);
          loadChannel(channel, jpgPaths[channel], false);
        }
      }
    };

    if (useKTX2 && ktx2) {
      ktx2.load(url, onLoad, undefined, onError);
    } else {
      getTextureLoader().load(url, onLoad, undefined, onError);
    }
  };

  const useKTX2 = isKTX2 && ktx2 != null;
  loadChannel('color', paths.color, useKTX2);
  loadChannel('normal', paths.normal, useKTX2);
  loadChannel('roughness', paths.roughness, useKTX2);
}
