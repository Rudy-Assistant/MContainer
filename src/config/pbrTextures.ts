/**
 * pbrTextures.ts — PBR Texture Loader
 *
 * Loads CC0 PBR textures (AmbientCG) and applies them to the theme material cache.
 * Textures are loaded once and applied to all themes that use corrugation (steel) or wood.
 *
 * Texture paths (public/assets/materials/):
 *   Corrugated_Steel/ — color.jpg, normal.jpg, roughness.jpg
 *   Deck_Wood/        — color.jpg, normal.jpg, roughness.jpg
 *
 * Ground textures are now managed by GroundManager.tsx via useTexture.
 */

import * as THREE from "three";

const TEX_BASE = "/assets/materials";

// Singleton texture loader
const loader = new THREE.TextureLoader();

export interface PBRTextureSet {
  color: THREE.Texture;
  normal: THREE.Texture;
  roughness: THREE.Texture;
}

let _steelTextures: PBRTextureSet | null = null;
let _woodTextures: PBRTextureSet | null = null;
let _loadPromise: Promise<void> | null = null;

function loadTex(path: string, repeatX = 1, repeatY = 1, srgb = false, anisotropy = 1): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    loader.load(
      path,
      (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeatX, repeatY);
        if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
        if (anisotropy > 1) tex.anisotropy = anisotropy;
        resolve(tex);
      },
      undefined,
      reject,
    );
  });
}

async function loadTextureSet(
  folder: string,
  repeatX = 1,
  repeatY = 1,
  anisotropy = 1,
): Promise<PBRTextureSet> {
  const [color, normal, roughness] = await Promise.all([
    loadTex(`${TEX_BASE}/${folder}/color.jpg`, repeatX, repeatY, true, anisotropy),
    loadTex(`${TEX_BASE}/${folder}/normal.jpg`, repeatX, repeatY, false, anisotropy),
    loadTex(`${TEX_BASE}/${folder}/roughness.jpg`, repeatX, repeatY, false, anisotropy),
  ]);
  return { color, normal, roughness };
}

/**
 * Load all PBR texture sets. Returns a promise that resolves when done.
 * Safe to call multiple times — only loads once.
 */
export function loadAllTextures(): Promise<void> {
  if (_loadPromise) return _loadPromise;

  _loadPromise = (async () => {
    try {
      const [steel, wood] = await Promise.all([
        loadTextureSet("Corrugated_Steel", 3, 1),
        loadTextureSet("Deck_Wood", 4, 1),
      ]);
      _steelTextures = steel;
      _woodTextures = wood;
    } catch (err) {
      console.warn("[PBR] Texture loading failed — falling back to procedural materials:", err);
      _steelTextures = null;
      _woodTextures = null;
    }
  })();

  return _loadPromise;
}

export function getSteelTextures(): PBRTextureSet | null { return _steelTextures; }
export function getWoodTextures(): PBRTextureSet | null { return _woodTextures; }

/**
 * Apply loaded PBR textures to existing theme material instances.
 * Call after loadAllTextures resolves.
 */
export function applyTexturesToMaterial(
  mat: THREE.MeshStandardMaterial,
  textures: PBRTextureSet,
  normalScale = 1.0,
) {
  mat.map = textures.color;
  mat.normalMap = textures.normal;
  mat.normalScale.set(normalScale, normalScale);
  mat.roughnessMap = textures.roughness;
  // Set material color to white so texture albedo comes through unmodified
  // (THREE multiplies color × map)
  mat.color.setHex(0xffffff);
  mat.needsUpdate = true;
}
