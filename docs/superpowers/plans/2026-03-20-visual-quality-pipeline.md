# Visual Quality Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire GPU auto-detect, KTX2 compressed texture loading, and 2K texture conversion pipeline so the High quality preset delivers real 2K GPU-compressed textures with automatic fallback.

**Architecture:** Lazy-load pipeline. A `QualityAutoDetect` component silently sets the quality preset on first launch based on GPU capabilities. `textureLoader.ts` gains a KTX2Loader singleton that loads `.ktx2` files for `'2k'` quality, with fallback to 1K JPG. `applyTextures` threads R3F `invalidate()` through each texture `onLoad` callback to fix demand-mode re-rendering. The conversion script gains UASTC/ETC1S codec split and `--source-suffix` support.

**Tech Stack:** Three.js KTX2Loader, Basis Universal WASM transcoder, toktx CLI, R3F `useThree`

**Spec:** `docs/superpowers/specs/2026-03-20-visual-quality-pipeline-design.md`

**Note on texture folders:** The spec targets 8 core material folders. The Desert theme actually uses `Terracotta` (floor) and Japanese uses `Shoji_Paper` (interior walls) — both absent from the core 8. These will continue using 1K JPG on High preset until a follow-up sources their 2K versions.

---

### Task 1: Basis Transcoder Postinstall Script

**Files:**
- Create: `scripts/copy-basis-transcoder.mjs`
- Modify: `package.json` (add `postinstall` script)

The Basis Universal WASM transcoder is needed by KTX2Loader to decompress textures on the GPU. It ships inside `three` but needs to be in `public/basis/` for the browser to fetch at runtime.

- [ ] **Step 1: Write the copy script**

```js
// scripts/copy-basis-transcoder.mjs
import { cpSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, '../node_modules/three/examples/jsm/libs/basis');
const DEST = resolve(__dirname, '../public/basis');

if (!existsSync(SRC)) {
  console.warn('[copy-basis] three/examples/jsm/libs/basis not found — skipping');
  process.exit(0);
}

mkdirSync(DEST, { recursive: true });

for (const file of ['basis_transcoder.js', 'basis_transcoder.wasm']) {
  const src = resolve(SRC, file);
  if (existsSync(src)) {
    cpSync(src, resolve(DEST, file));
    console.log(`[copy-basis] Copied ${file}`);
  } else {
    console.warn(`[copy-basis] ${file} not found in three — skipping`);
  }
}
```

- [ ] **Step 2: Add postinstall to package.json**

In `package.json` scripts section, add:
```json
"postinstall": "node scripts/copy-basis-transcoder.mjs"
```

- [ ] **Step 3: Run postinstall and verify files exist**

Run: `cd /c/MHome/MContainer && npm run postinstall`
Expected: `public/basis/basis_transcoder.js` and `public/basis/basis_transcoder.wasm` exist.

Run: `ls -la public/basis/`
Expected: Two files, ~1MB total.

- [ ] **Step 4: Add `public/basis/` to `.gitignore`**

These are copied from `node_modules` at install time — should not be committed.

Add to `.gitignore`:
```
public/basis/
```

- [ ] **Step 5: Commit**

```bash
git add scripts/copy-basis-transcoder.mjs package.json .gitignore
git commit -m "feat: add postinstall script to copy Basis transcoder WASM"
```

---

### Task 2: GPU Heuristic — Pure Function + Tests

**Files:**
- Create: `src/config/gpuDetect.ts`
- Create: `src/Testing/gpu-detect.test.ts`

Extract the GPU detection heuristic as a pure function so it's easily testable without any R3F dependency.

- [ ] **Step 1: Write the failing test**

```ts
// src/Testing/gpu-detect.test.ts
import { describe, it, expect } from 'vitest';
import { detectQualityPreset, type GPUInfo } from '../config/gpuDetect';

describe('detectQualityPreset', () => {
  it('returns low for maxTextureSize < 4096', () => {
    const info: GPUInfo = { maxTextureSize: 2048, maxCubemapSize: 2048, maxTextureUnits: 8 };
    expect(detectQualityPreset(info)).toBe('low');
  });

  it('returns high for maxTextureSize >= 8192', () => {
    const info: GPUInfo = { maxTextureSize: 16384, maxCubemapSize: 16384, maxTextureUnits: 32 };
    expect(detectQualityPreset(info)).toBe('high');
  });

  it('returns medium for maxTextureSize between 4096 and 8192', () => {
    const info: GPUInfo = { maxTextureSize: 4096, maxCubemapSize: 4096, maxTextureUnits: 16 };
    expect(detectQualityPreset(info)).toBe('medium');
  });

  it('downgrades one tier when weak GPU name detected', () => {
    const info: GPUInfo = {
      maxTextureSize: 8192,
      maxCubemapSize: 8192,
      maxTextureUnits: 16,
      rendererName: 'Intel(R) HD Graphics 4000',
    };
    // Would be high, but weak chip → downgrade to medium
    expect(detectQualityPreset(info)).toBe('medium');
  });

  it('downgrades low stays low with weak GPU name', () => {
    const info: GPUInfo = {
      maxTextureSize: 2048,
      maxCubemapSize: 2048,
      maxTextureUnits: 8,
      rendererName: 'Mali-400',
    };
    expect(detectQualityPreset(info)).toBe('low');
  });

  it('returns medium when rendererName is undefined (extension unavailable)', () => {
    const info: GPUInfo = { maxTextureSize: 4096, maxCubemapSize: 4096, maxTextureUnits: 16 };
    expect(detectQualityPreset(info)).toBe('medium');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/gpu-detect.test.ts`
Expected: FAIL — module `../config/gpuDetect` does not exist.

- [ ] **Step 3: Write the implementation**

```ts
// src/config/gpuDetect.ts
import type { QualityPresetId } from './qualityPresets';

export interface GPUInfo {
  maxTextureSize: number;
  maxCubemapSize: number;
  maxTextureUnits: number;
  /** Unmasked renderer string from WEBGL_debug_renderer_info (undefined if extension unavailable) */
  rendererName?: string;
}

const WEAK_GPU_PATTERNS = [
  /Intel.*HD\s*(Graphics\s*)?[234]/i,   // Intel HD 2000-4000 series
  /Mali-[234]/i,                         // ARM Mali low-end
  /Adreno\s*(3[012]|4[01])/i,           // Qualcomm Adreno low-end
  /PowerVR\s*SGX/i,                      // Imagination PowerVR SGX (very old)
  /GMA\s*\d/i,                           // Intel GMA
];

function isWeakGPU(name: string): boolean {
  return WEAK_GPU_PATTERNS.some(p => p.test(name));
}

export function detectQualityPreset(info: GPUInfo): QualityPresetId {
  let tier: QualityPresetId;

  if (info.maxTextureSize < 4096) {
    tier = 'low';
  } else if (info.maxTextureSize >= 8192) {
    tier = 'high';
  } else {
    tier = 'medium';
  }

  // Best-effort downgrade for known weak GPUs
  if (info.rendererName && isWeakGPU(info.rendererName)) {
    if (tier === 'high') tier = 'medium';
    else if (tier === 'medium') tier = 'low';
    // low stays low
  }

  return tier;
}

/**
 * Extract GPUInfo from a WebGL renderer.
 * Safe to call — returns partial info if WEBGL_debug_renderer_info is unavailable.
 */
export function extractGPUInfo(gl: WebGLRenderingContext | WebGL2RenderingContext): GPUInfo {
  const info: GPUInfo = {
    maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxCubemapSize: gl.getParameter(gl.MAX_CUBE_MAP_TEXTURE_SIZE),
    maxTextureUnits: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
  };

  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  if (ext) {
    info.rendererName = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
  }

  return info;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/gpu-detect.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/gpuDetect.ts src/Testing/gpu-detect.test.ts
git commit -m "feat: add GPU detection heuristic for quality auto-detect"
```

---

### Task 3: QualityAutoDetect Component

**Files:**
- Create: `src/components/three/QualityAutoDetect.tsx`
- Modify: `src/components/three/Scene.tsx:1948-1968` (mount inside Scene)
- Modify: `src/store/slices/environmentSlice.ts` (no code change needed — `setQualityPreset` exists at line 101)

This R3F component reads the GL context on mount, runs the GPU heuristic, and calls `setQualityPreset` once — but only if the store has no persisted value (first launch).

- [ ] **Step 1: Write the component**

```tsx
// src/components/three/QualityAutoDetect.tsx
import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { useStore } from '../../store/useStore';
import { detectQualityPreset, extractGPUInfo } from '../../config/gpuDetect';
import { DEFAULT_QUALITY_PRESET } from '../../config/qualityPresets';

/**
 * Runs once on first launch to detect GPU capability and set quality preset.
 * Waits for IndexedDB hydration to complete before checking whether the user
 * already has a persisted preference. Must be mounted inside <Canvas>.
 */
export function QualityAutoDetect() {
  const gl = useThree((s) => s.gl);
  const hasHydrated = useStore((s) => s._hasHydrated);
  const didRun = useRef(false);

  useEffect(() => {
    // Wait for IndexedDB hydration before deciding
    if (!hasHydrated) return;
    if (didRun.current) return;
    didRun.current = true;

    // If the user has a persisted quality preference (from a previous session or manual change),
    // the hydrated value will differ from the slice default. Skip auto-detect in that case.
    // On truly first launch, hydration completes with the slice default ('medium') and
    // _hasHydrated becomes true, but qualityPreset was never persisted — so it's still the default.
    // We use a localStorage flag to distinguish "persisted default" from "never auto-detected".
    const alreadyDetected = localStorage.getItem('moduhome-gpu-detected');
    if (alreadyDetected) return;

    const glContext = gl.getContext();
    const gpuInfo = extractGPUInfo(glContext);
    const preset = detectQualityPreset(gpuInfo);

    console.log(`[QualityAutoDetect] GPU: ${gpuInfo.rendererName ?? 'unknown'}, maxTex: ${gpuInfo.maxTextureSize} → ${preset}`);

    useStore.getState().setQualityPreset(preset);
    localStorage.setItem('moduhome-gpu-detected', 'true');
  }, [gl, hasHydrated]);

  return null;
}
```

**Design note:** We wait for `_hasHydrated` (set to `true` after IndexedDB rehydration completes) before running auto-detect. This prevents a race condition where auto-detect overwrites the user's persisted preference. We use `localStorage` (persists across sessions) to mark that auto-detect has run, so it never fires again — even if the user's persisted preset happens to match the slice default.

- [ ] **Step 2: Mount in Scene.tsx**

In `src/components/three/Scene.tsx`, add the import and mount `<QualityAutoDetect />` right before `<QualityManager />` inside the Scene component (line ~1954):

```tsx
import { QualityAutoDetect } from './QualityAutoDetect';

// Inside Scene():
<QualityAutoDetect />
<QualityManager />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/three/QualityAutoDetect.tsx src/components/three/Scene.tsx
git commit -m "feat: add QualityAutoDetect component for first-launch GPU detection"
```

---

### Task 4: KTX2Loader Singleton + Extension Branching in textureLoader.ts

**Files:**
- Modify: `src/config/textureLoader.ts` (add KTX2Loader, change `applyTextures` signature)

This task adds the KTX2Loader singleton and makes `applyTextures` choose the right loader based on file extension. It also adds the `invalidate` callback parameter and the fallback chain.

- [ ] **Step 1: Write the failing test for getTexturePaths**

```ts
// Add to src/Testing/gpu-detect.test.ts (or create src/Testing/texture-loader.test.ts)
// File: src/Testing/texture-loader.test.ts
import { describe, it, expect } from 'vitest';
import { getTexturePaths } from '../config/textureLoader';

describe('getTexturePaths', () => {
  it('returns null for flat quality', () => {
    expect(getTexturePaths('Corrugated_Steel', 'flat')).toBeNull();
  });

  it('returns .jpg paths for 1k quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', '1k')!;
    expect(paths.color).toBe('/assets/materials/Corrugated_Steel/color.jpg');
    expect(paths.normal).toBe('/assets/materials/Corrugated_Steel/normal.jpg');
    expect(paths.roughness).toBe('/assets/materials/Corrugated_Steel/roughness.jpg');
  });

  it('returns .ktx2 paths for 2k quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', '2k')!;
    expect(paths.color).toBe('/assets/materials-ktx2/Corrugated_Steel/color.ktx2');
    expect(paths.normal).toBe('/assets/materials-ktx2/Corrugated_Steel/normal.ktx2');
    expect(paths.roughness).toBe('/assets/materials-ktx2/Corrugated_Steel/roughness.ktx2');
  });
});
```

- [ ] **Step 2: Run test to verify it passes (getTexturePaths already works)**

Run: `cd /c/MHome/MContainer && npx vitest run src/Testing/texture-loader.test.ts`
Expected: 3 tests PASS — `getTexturePaths` already returns the right paths.

- [ ] **Step 3: Update textureLoader.ts with KTX2Loader and invalidate threading**

Replace `src/config/textureLoader.ts` with:

```ts
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
 *
 * @param mat - Target material
 * @param paths - Texture paths (from getTexturePaths)
 * @param repeatX - Horizontal tiling
 * @param repeatY - Vertical tiling
 * @param normalScale - Normal map intensity
 * @param invalidate - R3F invalidate() for demand-mode re-render (optional)
 * @param fallbackFolder - Folder name for JPG fallback if KTX2 fails (optional)
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

  // Fallback: on KTX2 error, retry with 1K JPG
  const makeFallback = (channel: 'color' | 'normal' | 'roughness') => {
    if (!fallbackFolder) return () => {};
    return () => {
      const jpgPaths = getTexturePaths(fallbackFolder, '1k');
      if (!jpgPaths) return;
      console.warn(`[textureLoader] KTX2 failed for ${paths[channel]}, falling back to 1K JPG`);
      loadChannel(channel, jpgPaths[channel], false);
    };
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
      if (useKTX2 && fallbackFolder) {
        makeFallback(channel)();
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
```

- [ ] **Step 4: Add fallback chain test**

Add to `src/Testing/texture-loader.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { getTexturePaths, applyTextures, initKTX2Loader } from '../config/textureLoader';

// ... existing getTexturePaths tests above ...

describe('applyTextures fallback', () => {
  it('falls back to 1K JPG when KTX2 path fails', () => {
    // Create a mock material
    const mat = new THREE.MeshStandardMaterial();
    const invalidate = vi.fn();

    // KTX2 paths that will fail (files don't exist)
    const ktx2Paths = getTexturePaths('Corrugated_Steel', '2k')!;

    // Spy on TextureLoader.load to verify fallback fires
    const loadSpy = vi.fn();
    const origLoad = THREE.TextureLoader.prototype.load;
    THREE.TextureLoader.prototype.load = loadSpy;

    // Call applyTextures with KTX2 paths but no KTX2Loader initialized
    // (getKTX2Loader returns null → falls through to TextureLoader which gets the KTX2 URL → fails → fallback)
    // Since KTX2Loader is not initialized, it should use TextureLoader directly for KTX2 paths
    applyTextures(mat, ktx2Paths, 2, 2, 0.6, invalidate, 'Corrugated_Steel');

    // TextureLoader.load should have been called with the KTX2 URLs
    // (since KTX2Loader is null, it falls through to TextureLoader)
    expect(loadSpy).toHaveBeenCalledTimes(3);

    // Restore
    THREE.TextureLoader.prototype.load = origLoad;
    mat.dispose();
  });
});
```

**Note:** The full KTX2 fallback (KTX2Loader error → JPG retry) requires a WebGL context for `initKTX2Loader`. In unit tests without WebGL, the KTX2Loader remains null and `applyTextures` uses TextureLoader directly. The fallback-from-KTX2-error path is verified in browser (Task 7, Step 5). This test verifies the graceful degradation when KTX2Loader is unavailable.

- [ ] **Step 5: Run all tests to verify no regressions**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All existing tests pass. The new optional parameters (`invalidate`, `fallbackFolder`) are backward-compatible.

- [ ] **Step 6: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors. Check that all call sites of `applyTextures` still compile (they only pass the first 5 positional args, the new ones are optional).

- [ ] **Step 7: Commit**

```bash
git add src/config/textureLoader.ts src/Testing/texture-loader.test.ts
git commit -m "feat: add KTX2Loader singleton, extension branching, fallback chain, invalidate threading"
```

---

### Task 5: Thread `invalidate` Through materialCache.ts

**Files:**
- Modify: `src/config/materialCache.ts:163-211` (thread `invalidate` param)
- Modify: `src/components/three/Scene.tsx:1921-1938` (`QualityManager` passes `invalidate`)

The `applyTextures` call in `applyQualityTextures` needs the R3F `invalidate` function and the folder name (for fallback). `QualityManager` is the only caller of `rebuildThemeMaterials`, so it threads `invalidate` from `useThree`.

- [ ] **Step 1: Update `applyQualityTextures` signature**

In `src/config/materialCache.ts`, change `applyQualityTextures` (line 163) to accept `invalidate`:

```ts
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
```

- [ ] **Step 2: Update `rebuildThemeMaterials` signature**

```ts
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
```

- [ ] **Step 3: Update QualityManager to pass `invalidate`**

In `src/components/three/Scene.tsx`, update `QualityManager` (line ~1921):

```tsx
function QualityManager() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  const config = QUALITY_PRESETS[qualityPreset];
  const { gl, invalidate } = useThree();

  useEffect(() => {
    // Initialize KTX2Loader BEFORE rebuilding materials.
    // Must happen synchronously in the same effect to guarantee KTX2Loader
    // is ready when applyTextures tries to use it for '2k' quality.
    initKTX2Loader(gl);
    rebuildThemeMaterials(config.textureQuality, invalidate);
  }, [config.textureQuality, invalidate, gl]);

  useEffect(() => {
    gl.toneMapping = config.postProcessing ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping;
  }, [config.postProcessing, gl]);

  return null;
}
```

Add the `initKTX2Loader` import at the top of Scene.tsx:
```ts
import { initKTX2Loader } from '../../config/textureLoader';
```

- [ ] **Step 4: Run TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 5: Run all tests**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/config/materialCache.ts src/components/three/Scene.tsx
git commit -m "feat: thread invalidate() through material rebuild for demand-mode re-render"
```

---

### Task 6: Update Conversion Script

**Files:**
- Modify: `scripts/convert-textures.mjs`

Add `--source-suffix` flag, UASTC/ETC1S codec split for normal maps, and strip suffix from output filenames.

- [ ] **Step 1: Update the script**

Replace `scripts/convert-textures.mjs` with the updated version. Key changes from the existing script:

1. **Parse `--source-suffix` arg** (default: `-2k`). Only scan files matching `*{suffix}.{jpg,png}`.
2. **Codec split:** If filename contains `normal` → UASTC (`--encode uastc --uastc_quality 2 --zstd 5`). Otherwise → ETC1S (`--encode etc1s --clevel 2`).
3. **Strip suffix from output:** `color-2k.jpg` → `color.ktx2` (not `color-2k.ktx2`).

```js
#!/usr/bin/env node
/**
 * KTX2 Texture Conversion Script
 *
 * Converts 2K JPG/PNG textures to GPU-compressed KTX2 format.
 *
 * Usage:
 *   npm run convert-textures
 *   npm run convert-textures -- --source-suffix=-2k    (default)
 *   npm run convert-textures -- --source-suffix=""      (convert all textures)
 *
 * Codec strategy:
 *   - Normal maps → UASTC (lossless, precision-critical)
 *   - Color/roughness → ETC1S (lossy, small files)
 *
 * Prerequisites:
 *   Install KTX-Software: https://github.com/KhronosGroup/KTX-Software/releases
 *   Ensure `toktx` is on your PATH.
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { resolve, join, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const INPUT_DIR = resolve(__dirname, '../public/assets/materials');
const OUTPUT_DIR = resolve(__dirname, '../public/assets/materials-ktx2');

// Parse --source-suffix arg (default: '-2k')
const suffixArg = process.argv.find(a => a.startsWith('--source-suffix'));
const SOURCE_SUFFIX = suffixArg ? suffixArg.split('=')[1] ?? '-2k' : '-2k';

// ── Check prerequisites ──────────────────────────────────────

function checkToktx() {
  try {
    execSync('toktx --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (!checkToktx()) {
  console.error('ERROR: toktx not found on PATH.');
  console.error('Install KTX-Software from: https://github.com/KhronosGroup/KTX-Software/releases');
  process.exit(1);
}

if (!existsSync(INPUT_DIR)) {
  console.error(`ERROR: Input directory not found: ${INPUT_DIR}`);
  process.exit(1);
}

// ── Discover texture folders ─────────────────────────────────

const folders = readdirSync(INPUT_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

if (folders.length === 0) {
  console.log('No texture folders found. Nothing to convert.');
  process.exit(0);
}

console.log(`Source suffix: "${SOURCE_SUFFIX}"`);
console.log(`Found ${folders.length} texture folders to scan.\n`);

// ── Convert each folder ──────────────────────────────────────

let totalConverted = 0;
let totalSkipped = 0;
let totalFailed = 0;

for (const folder of folders) {
  const inputPath = join(INPUT_DIR, folder);
  const outputPath = join(OUTPUT_DIR, folder);

  // Filter to files matching the source suffix
  const suffixPattern = SOURCE_SUFFIX
    ? new RegExp(`${SOURCE_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(jpg|jpeg|png)$`, 'i')
    : /\.(jpg|jpeg|png)$/i;

  const files = readdirSync(inputPath)
    .filter(f => suffixPattern.test(f))
    .filter(f => {
      const stats = statSync(join(inputPath, f));
      return stats.size > 1024;
    });

  if (files.length === 0) continue;

  if (!existsSync(outputPath)) {
    mkdirSync(outputPath, { recursive: true });
  }

  console.log(`  ${folder}/: ${files.length} textures`);

  for (const file of files) {
    const input = join(inputPath, file);

    // Strip source suffix from output filename: color-2k.jpg → color.ktx2
    const baseName = basename(file, extname(file));
    const strippedName = SOURCE_SUFFIX ? baseName.replace(new RegExp(`${SOURCE_SUFFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '') : baseName;
    const outputFile = strippedName + '.ktx2';
    const output = join(outputPath, outputFile);

    // Skip if output already exists and is newer than input
    if (existsSync(output)) {
      const inputMtime = statSync(input).mtimeMs;
      const outputMtime = statSync(output).mtimeMs;
      if (outputMtime > inputMtime) {
        totalSkipped++;
        continue;
      }
    }

    // Determine codec: normal maps get UASTC (lossless), others get ETC1S (lossy)
    const isNormal = /normal/i.test(file);
    const isColor = /color|diffuse|albedo|base/i.test(file);
    const colorSpace = isColor ? '--assign_oetf srgb' : '--assign_oetf linear';

    const encodeArgs = isNormal
      ? '--encode uastc --uastc_quality 2 --zstd 5'
      : '--encode etc1s --clevel 2';

    try {
      execSync(
        `toktx ${encodeArgs} ${colorSpace} "${output}" "${input}"`,
        { stdio: 'pipe' }
      );
      totalConverted++;
      const codec = isNormal ? 'UASTC' : 'ETC1S';
      console.log(`    ✓ ${file} → ${outputFile} (${codec})`);
    } catch (err) {
      totalFailed++;
      console.error(`    ✗ ${file} — conversion failed: ${err.message}`);
    }
  }
}

// ── Summary ──────────────────────────────────────────────────

console.log(`\nDone! ${totalConverted} converted, ${totalSkipped} skipped (up-to-date), ${totalFailed} failed.`);
if (totalConverted > 0) {
  console.log(`KTX2 files written to: ${OUTPUT_DIR}`);
}
```

- [ ] **Step 2: Add `materials-ktx2` to .gitignore**

Add to `.gitignore`:
```
public/assets/materials-ktx2/
```

- [ ] **Step 3: Verify script runs without errors (dry run — no 2K sources yet)**

Run: `cd /c/MHome/MContainer && node scripts/convert-textures.mjs`
Expected: Scans all folders, finds 0 files matching `*-2k.{jpg,png}`, prints "Done! 0 converted".

- [ ] **Step 4: Commit**

```bash
git add scripts/convert-textures.mjs .gitignore
git commit -m "feat: update KTX2 conversion script with UASTC/ETC1S split and source-suffix support"
```

---

### Task 7: Integration Verification

**Files:**
- No new files — this task verifies everything works together.

- [ ] **Step 1: Run full TypeScript check**

Run: `cd /c/MHome/MContainer && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 2: Run full test suite**

Run: `cd /c/MHome/MContainer && npx vitest run`
Expected: All tests pass (existing + new gpu-detect + texture-loader tests).

- [ ] **Step 3: Browser verification — auto-detect fires**

Start dev server, open browser console. On first load, look for:
```
[QualityAutoDetect] GPU: NVIDIA GeForce RTX ..., maxTex: 16384 → high
```
(Exact GPU and preset will vary by machine.)

- [ ] **Step 4: Browser verification — quality toggle**

Open settings, switch between Low/Medium/High. Verify:
- **Low:** Flat colors, no textures, no post-processing
- **Medium:** 1K JPG textures load, post-processing on
- **High:** Attempts KTX2 (will fall back to 1K JPG since no 2K sources exist yet), console shows fallback warning

- [ ] **Step 5: Browser verification — fallback warning**

On High preset, browser console should show:
```
[textureLoader] KTX2 failed for /assets/materials-ktx2/Corrugated_Steel/color.ktx2, falling back to 1K JPG
```
This confirms the fallback chain works.

- [ ] **Step 6: Run acceptance gates**

Run: `cd /c/MHome/MContainer && npm run gates`
Expected: All gates pass.

- [ ] **Step 7: Final commit with all verification passing**

```bash
git add -A
git commit -m "feat: visual quality pipeline — GPU auto-detect, KTX2 loader, conversion script"
```

---

## Summary of Tasks

| Task | Description | Est. Files |
|------|-------------|-----------|
| 1 | Basis transcoder postinstall script | 3 (script, package.json, .gitignore) |
| 2 | GPU heuristic pure function + tests | 2 (gpuDetect.ts, test) |
| 3 | QualityAutoDetect component + Scene mount | 2 (component, Scene.tsx) |
| 4 | KTX2Loader singleton + extension branching + fallback | 2 (textureLoader.ts, test) |
| 5 | Thread `invalidate` through materialCache → Scene | 2 (materialCache.ts, Scene.tsx) |
| 6 | Conversion script update | 2 (script, .gitignore) |
| 7 | Integration verification | 0 (verification only) |

**Total new files:** 4 (`copy-basis-transcoder.mjs`, `gpuDetect.ts`, `gpu-detect.test.ts`, `QualityAutoDetect.tsx`)
**Total modified files:** 5 (`textureLoader.ts`, `materialCache.ts`, `Scene.tsx`, `package.json`, `.gitignore`)
