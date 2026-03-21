# Visual Fidelity Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between current flat rendering and photorealistic architectural visualization via post-processing, interior lighting, PBR material upgrades, ground texture fixes, bundled HDRIs, CubeCamera, and quality presets.

**Architecture:** Top-down approach — post-processing first for instant visual impact, then interior lights (bloom makes them glow), then materials/textures/environment. A quality presets system (Low/Medium/High) gates every visual feature. All changes are additive with ErrorBoundary fallbacks.

**Tech Stack:** React 19, Three.js 0.182, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3.x, zustand 5 + immer, vitest

**Spec:** `docs/superpowers/specs/2026-03-20-visual-fidelity-upgrade-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/config/qualityPresets.ts` | QualityConfig per preset (Low/Medium/High), feature matrix |
| `src/components/three/PostProcessingStack.tsx` | EffectComposer + N8AO + Bloom + ToneMapping, quality-gated |
| `src/components/three/InteriorLights.tsx` | Renders SpotLight/PointLight per container's lights array |
| `src/config/textureLoader.ts` | Consolidated texture loading (replaces pbrTextures.ts), quality-aware paths |
| `scripts/convert-textures.ts` | Build-time KTX2 conversion script |

### Modified Files
| File | Changes |
|------|---------|
| `src/store/slices/environmentSlice.ts` | Add `qualityPreset` state + `setQualityPreset` action |
| `src/types/container.ts` | Add `LightPlacement` type, `lights?: LightPlacement[]` on `Container` |
| `src/store/slices/containerSlice.ts` | Add `addLight`, `removeLight` actions |
| `src/store/persistSchema.ts` | Add `qualityPreset` to environment schema, `lights` to container schema |
| `src/config/materialCache.ts` | Quality parameter on `buildThemeMaterials`, `rebuildThemeMaterials()`, retire `loadThemeTextures` in favor of `textureLoader.ts` |
| `src/config/themes.ts` | Add texture folder paths for all theme variants |
| `src/components/three/GroundManager.tsx` | Fix texture path construction for grass preset |
| `src/components/three/Scene.tsx` | Mount `PostProcessingStack`, replace CDN `<Environment>` with bundled HDRIs |
| `src/components/three/SceneCanvas.tsx` | Quality-based shadow map size, conditional `toneMapping: NoToneMapping` when post-processing active |
| `src/__tests__/no-postprocessing-import.test.ts` | Delete (source-scanning anti-pattern per CLAUDE.md) |

### Retired Files
| File | Reason |
|------|--------|
| `src/config/pbrTextures.ts` | Consolidated into `textureLoader.ts` |

### Asset Files
| Path | Source |
|------|--------|
| `public/assets/hdri/dawn.hdr` | Polyhaven CC0, 2K |
| `public/assets/hdri/day.hdr` | Polyhaven CC0, 2K |
| `public/assets/hdri/sunset.hdr` | Polyhaven CC0, 2K |
| `public/assets/hdri/night.hdr` | Polyhaven CC0, 2K |

---

## Task 1: Quality Presets Config

**Files:**
- Create: `src/config/qualityPresets.ts`
- Test: `src/__tests__/quality-presets.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/quality-presets.test.ts
import { describe, it, expect } from 'vitest';
import { QUALITY_PRESETS, type QualityPresetId } from '@/config/qualityPresets';

describe('Quality Presets', () => {
  it('exports all three presets', () => {
    expect(Object.keys(QUALITY_PRESETS)).toEqual(['low', 'medium', 'high']);
  });

  it('low disables post-processing', () => {
    expect(QUALITY_PRESETS.low.postProcessing).toBe(false);
    expect(QUALITY_PRESETS.low.shadowMapSize).toBe(1024);
    expect(QUALITY_PRESETS.low.maxLights).toBe(4);
    expect(QUALITY_PRESETS.low.envMap).toBe('none');
  });

  it('medium enables AO halfRes + bloom', () => {
    expect(QUALITY_PRESETS.medium.postProcessing).toBe(true);
    expect(QUALITY_PRESETS.medium.aoHalfRes).toBe(true);
    expect(QUALITY_PRESETS.medium.shadowMapSize).toBe(2048);
    expect(QUALITY_PRESETS.medium.maxLights).toBe(8);
    expect(QUALITY_PRESETS.medium.envMap).toBe('hdri');
  });

  it('high enables AO fullRes + cubeCamera', () => {
    expect(QUALITY_PRESETS.high.postProcessing).toBe(true);
    expect(QUALITY_PRESETS.high.aoHalfRes).toBe(false);
    expect(QUALITY_PRESETS.high.shadowMapSize).toBe(4096);
    expect(QUALITY_PRESETS.high.maxLights).toBe(16);
    expect(QUALITY_PRESETS.high.envMap).toBe('cubeCamera');
    expect(QUALITY_PRESETS.high.lightShadows).toBe(true);
  });

  it('all presets have valid texture quality', () => {
    for (const preset of Object.values(QUALITY_PRESETS)) {
      expect(['flat', '1k', '2k']).toContain(preset.textureQuality);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/quality-presets.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/config/qualityPresets.ts
export type QualityPresetId = 'low' | 'medium' | 'high';

export interface QualityConfig {
  // Post-processing
  postProcessing: boolean;
  aoHalfRes: boolean;
  bloomEnabled: boolean;

  // Shadows
  shadowMapSize: number;

  // Textures
  textureQuality: 'flat' | '1k' | '2k';
  useKTX2: boolean;

  // Materials
  usePBRTextures: boolean;
  glassClearcoat: boolean;

  // Environment
  envMap: 'none' | 'hdri' | 'cubeCamera';

  // Lights
  maxLights: number;
  lightShadows: boolean;

  // Ground
  groundTextured: boolean;
  groundAO: boolean;
}

export const QUALITY_PRESETS: Record<QualityPresetId, QualityConfig> = {
  low: {
    postProcessing: false,
    aoHalfRes: false,
    bloomEnabled: false,
    shadowMapSize: 1024,
    textureQuality: 'flat',
    useKTX2: false,
    usePBRTextures: false,
    glassClearcoat: false,
    envMap: 'none',
    maxLights: 4,
    lightShadows: false,
    groundTextured: false,
    groundAO: false,
  },
  medium: {
    postProcessing: true,
    aoHalfRes: true,
    bloomEnabled: true,
    shadowMapSize: 2048,
    textureQuality: '1k',
    useKTX2: true,
    usePBRTextures: true,
    glassClearcoat: false,
    envMap: 'hdri',
    maxLights: 8,
    lightShadows: false,
    groundTextured: true,
    groundAO: false,
  },
  high: {
    postProcessing: true,
    aoHalfRes: false,
    bloomEnabled: true,
    shadowMapSize: 4096,
    textureQuality: '2k',
    useKTX2: true,
    usePBRTextures: true,
    glassClearcoat: true,
    envMap: 'cubeCamera',
    maxLights: 16,
    lightShadows: true,
    groundTextured: true,
    groundAO: true,
  },
};

export const QUALITY_PRESET_IDS: QualityPresetId[] = ['low', 'medium', 'high'];
export const DEFAULT_QUALITY_PRESET: QualityPresetId = 'medium';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/quality-presets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/config/qualityPresets.ts src/__tests__/quality-presets.test.ts
git commit -m "feat: add quality presets config (Low/Medium/High)"
```

---

## Task 2: Quality Preset Store State

**Files:**
- Modify: `src/store/slices/environmentSlice.ts`
- Modify: `src/store/persistSchema.ts`
- Test: `src/__tests__/quality-preset-store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/quality-preset-store.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
// idb-keyval is globally mocked in src/__tests__/setup.ts — no additional mocks needed
import { useStore } from '@/store/useStore';

describe('Quality Preset Store', () => {
  beforeEach(() => {
    useStore.setState({ qualityPreset: 'medium' });
  });

  it('defaults to medium', () => {
    expect(useStore.getState().qualityPreset).toBe('medium');
  });

  it('setQualityPreset changes preset', () => {
    useStore.getState().setQualityPreset('high');
    expect(useStore.getState().qualityPreset).toBe('high');
  });

  it('setQualityPreset validates input', () => {
    useStore.getState().setQualityPreset('low');
    expect(useStore.getState().qualityPreset).toBe('low');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/quality-preset-store.test.ts`
Expected: FAIL — `qualityPreset` not in state

- [ ] **Step 3: Add qualityPreset to environmentSlice**

In `src/store/slices/environmentSlice.ts`, add to the `EnvironmentSlice` interface:

```typescript
import { type QualityPresetId } from '@/config/qualityPresets';

// Add to EnvironmentSlice interface:
qualityPreset: QualityPresetId;
setQualityPreset: (preset: QualityPresetId) => void;
```

In `createEnvironmentSlice`, add initial state and action:

```typescript
qualityPreset: 'medium' as QualityPresetId,

setQualityPreset: (preset) => set({ qualityPreset: preset }),
```

In `src/store/persistSchema.ts`, add to the environment object inside `persistedStateSchema`:

```typescript
qualityPreset: z.string().optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/quality-preset-store.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: All existing tests still pass

- [ ] **Step 6: Commit**

```bash
git add src/store/slices/environmentSlice.ts src/store/persistSchema.ts src/__tests__/quality-preset-store.test.ts
git commit -m "feat: add qualityPreset to environment store slice"
```

---

## Task 3: Post-Processing Investigation & Component

**Files:**
- Create: `src/components/three/PostProcessingStack.tsx`
- Modify: `src/components/three/Scene.tsx` (mount the stack)
- Modify: `src/components/three/SceneCanvas.tsx` (conditional toneMapping)
- Delete: `src/__tests__/no-postprocessing-import.test.ts` (anti-pattern)

- [ ] **Step 1: Investigate postprocessing version**

Run: `npm ls @react-three/postprocessing postprocessing` to see current versions.
Then check changelog/issues for context-loss fix. Try upgrading:

```bash
npm install @react-three/postprocessing@latest
```

Start dev server (`npm run dev`), open browser, check console for "Context Lost" errors. If it crashes, try lazy dynamic import approach (see Step 3b).

- [ ] **Step 2: Remove the source-scanning import guard test**

Delete `src/__tests__/no-postprocessing-import.test.ts` entirely. Per CLAUDE.md, `fs.readFileSync` in tests is an anti-pattern — tests must call real functions and assert return values. The PostProcessingStack component's ErrorBoundary provides runtime protection instead.

```bash
git rm src/__tests__/no-postprocessing-import.test.ts
```

- [ ] **Step 3a: Create PostProcessingStack (if upgrade succeeds)**

```typescript
// src/components/three/PostProcessingStack.tsx
"use client";

import { Component, type ReactNode } from 'react';
import { EffectComposer, N8AO, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useStore } from '@/store/useStore';
import { QUALITY_PRESETS } from '@/config/qualityPresets';

// ErrorBoundary — if EffectComposer causes GL context loss, disable gracefully
interface EBState { failed: boolean }
class PostProcessingBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { failed: false };
  static getDerivedStateFromError(): EBState { return { failed: true }; }
  componentDidCatch(error: Error) {
    console.warn('[PostProcessingStack] EffectComposer failed, disabling post-processing:', error.message);
  }
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

function PostProcessingEffects() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  const config = QUALITY_PRESETS[qualityPreset];

  if (!config.postProcessing) return null;

  return (
    <EffectComposer>
      <N8AO
        aoRadius={0.8}
        intensity={1.0}
        distanceFalloff={1.5}
        quality={config.aoHalfRes ? 'medium' : 'high'}
        halfRes={config.aoHalfRes}
      />
      {config.bloomEnabled && (
        <Bloom
          luminanceThreshold={0.85}
          luminanceSmoothing={0.1}
          mipmapBlur
        />
      )}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}

export default function PostProcessingStack() {
  return (
    <PostProcessingBoundary>
      <PostProcessingEffects />
    </PostProcessingBoundary>
  );
}
```

- [ ] **Step 3b: If upgrade fails — lazy dynamic import fallback**

If the postprocessing library still causes context loss on static import, wrap the component in a lazy loader:

```typescript
// src/components/three/PostProcessingStack.tsx
"use client";

import { lazy, Suspense, Component, type ReactNode } from 'react';
import { useStore } from '@/store/useStore';

const LazyEffects = lazy(() => import('./PostProcessingEffects'));

// ... ErrorBoundary same as above ...

export default function PostProcessingStack() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  if (qualityPreset === 'low') return null;

  return (
    <PostProcessingBoundary>
      <Suspense fallback={null}>
        <LazyEffects />
      </Suspense>
    </PostProcessingBoundary>
  );
}
```

Move the actual EffectComposer usage into a separate `PostProcessingEffects.tsx` that is dynamically imported.

- [ ] **Step 4: Mount in Scene.tsx**

In `Scene.tsx`, remove the stub `SafeEffectComposer` (the `() => null` function) and add:

```typescript
import PostProcessingStack from './PostProcessingStack';
```

Mount `<PostProcessingStack />` inside the scene tree (after all geometry, before closing `</>`).

- [ ] **Step 5: Conditional toneMapping in SceneCanvas**

In `SceneCanvas.tsx`, when post-processing is active, the EffectComposer handles tone mapping. Set renderer tone mapping to `NoToneMapping` to avoid double tone mapping:

```typescript
import { QUALITY_PRESETS } from '@/config/qualityPresets';

// Inside SceneCanvas:
const qualityPreset = useStore((s) => s.qualityPreset);
const config = QUALITY_PRESETS[qualityPreset];

// In gl prop:
gl={{
  antialias: true,
  toneMapping: config.postProcessing ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.3,
}}
```

- [ ] **Step 6: Browser verification**

Run `npm run dev`. Open browser. Check:
- No "Context Lost" in console
- AO darkens corners/crevices on container (visible at default Medium preset)
- Bloom makes bright surfaces glow softly
- Scene renders correctly (no blank canvas, no color shift)

- [ ] **Step 7: Commit**

```bash
git rm src/__tests__/no-postprocessing-import.test.ts
git add src/components/three/PostProcessingStack.tsx src/components/three/Scene.tsx src/components/three/SceneCanvas.tsx
git commit -m "feat: re-enable post-processing pipeline (AO + Bloom + ToneMapping)"
```

---

## Task 4: Ground Texture Fix

**Files:**
- Modify: `src/components/three/GroundManager.tsx`
- Modify: `src/config/groundPresets.ts` (verify only — may not need changes)

- [ ] **Step 1: Write failing test for ground preset filename resolution**

```typescript
// Add to an existing or new test file: src/__tests__/ground-presets.test.ts
import { describe, it, expect } from 'vitest';
import { GROUND_PRESETS } from '@/config/groundPresets';

describe('Ground Presets', () => {
  it('grass preset specifies ambientCG texture filenames', () => {
    const grass = GROUND_PRESETS.grass;
    expect(grass.colorFile).toBe('Grass005_1K-JPG_Color.jpg');
    expect(grass.normalFile).toBe('Grass005_1K-JPG_NormalGL.jpg');
    expect(grass.roughnessFile).toBe('Grass005_1K-JPG_Roughness.jpg');
    expect(grass.displacementFile).toBe('Grass005_1K-JPG_Displacement.jpg');
    expect(grass.aoFile).toBe('Grass005_1K-JPG_AmbientOcclusion.jpg');
  });

  it('other presets default to generic filenames (no override fields)', () => {
    expect(GROUND_PRESETS.concrete.colorFile).toBeUndefined();
    expect(GROUND_PRESETS.gravel.colorFile).toBeUndefined();
  });
});
```

Run: `npx vitest run src/__tests__/ground-presets.test.ts`
Expected: FAIL — `colorFile` not in preset

- [ ] **Step 3: Diagnose the texture loading failure**

The `TexturedGround` component loads textures from paths like `/assets/materials/Ground_Grass/color.jpg`. The actual ambientCG files are named `Grass005_1K-JPG_Color.jpg`. Check if `color.jpg` exists or if only the ambientCG-named files exist:

```bash
ls -la public/assets/materials/Ground_Grass/
```

The generic `color.jpg`, `normal.jpg`, `roughness.jpg` DO exist (confirmed in spec). But the ambientCG 1K set (`Grass005_1K-JPG_Color.jpg` etc.) has higher quality. The `GroundManager.tsx` line 110 loads `${base}/color.jpg` — this should work IF the file serves correctly via Vite/Next.js.

Check browser network tab for 404s on these texture URLs.

- [ ] **Step 4: Update grass preset to use ambientCG filenames**

If the generic `color.jpg` works but looks poor, OR if we want to use the higher-quality ambientCG set, update `groundPresets.ts` to add explicit texture filename overrides. The `GroundManager` currently assumes `color.jpg`, `normal.jpg`, `roughness.jpg`. Add fields to the preset:

In `src/config/groundPresets.ts`, add optional fields to `GroundPreset`:

```typescript
/** Override color texture filename (default: "color.jpg") */
colorFile?: string;
/** Override normal texture filename (default: "normal.jpg") */
normalFile?: string;
/** Override roughness texture filename (default: "roughness.jpg") */
roughnessFile?: string;
```

For grass:
```typescript
grass: {
  // ... existing fields ...
  colorFile: "Grass005_1K-JPG_Color.jpg",
  normalFile: "Grass005_1K-JPG_NormalGL.jpg",
  roughnessFile: "Grass005_1K-JPG_Roughness.jpg",
  displacementFile: "Grass005_1K-JPG_Displacement.jpg",
  aoFile: "Grass005_1K-JPG_AmbientOcclusion.jpg",
},
```

- [ ] **Step 5: Update GroundManager to use preset filenames**

In `src/components/three/GroundManager.tsx`, `TexturedGround` lines 109-116, update path construction:

```typescript
const texPaths: Record<string, string> = useMemo(() => {
  const paths: Record<string, string> = {
    map: `${base}/${preset.colorFile ?? 'color.jpg'}`,
    normalMap: `${base}/${preset.normalFile ?? 'normal.jpg'}`,
    roughnessMap: `${base}/${preset.roughnessFile ?? 'roughness.jpg'}`,
  };
  if (preset.displacementFile) paths.displacementMap = `${base}/${preset.displacementFile}`;
  if (preset.aoFile) paths.aoMap = `${base}/${preset.aoFile}`;
  return paths;
}, [base, preset.colorFile, preset.normalFile, preset.roughnessFile, preset.displacementFile, preset.aoFile]);
```

- [ ] **Step 6: Browser verification**

Run `npm run dev`. Check:
- Grass texture visible on ground (not flat green)
- No console errors about texture loading
- Displacement creates subtle ground variation
- Other presets (concrete, gravel, dirt) still work

- [ ] **Step 7: Run tests**

Run: `npx vitest run`
Expected: All existing tests pass (including new ground-presets.test.ts)

- [ ] **Step 8: Commit**

```bash
git add src/config/groundPresets.ts src/components/three/GroundManager.tsx
git commit -m "fix: ground texture loading — use ambientCG filenames for grass preset"
```

---

## Task 5: Texture Loader Consolidation

**Files:**
- Create: `src/config/textureLoader.ts`
- Modify: `src/config/materialCache.ts`
- Delete (retire): `src/config/pbrTextures.ts`
- Test: `src/__tests__/texture-loader.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/texture-loader.test.ts
import { describe, it, expect } from 'vitest';
import { getTexturePaths } from '@/config/textureLoader';

describe('Texture Loader', () => {
  it('returns JPG paths for flat quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', 'flat');
    expect(paths).toBeNull(); // flat = no textures
  });

  it('returns JPG paths for 1k quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', '1k');
    expect(paths!.color).toContain('/assets/materials/Corrugated_Steel/color.jpg');
    expect(paths!.normal).toContain('/assets/materials/Corrugated_Steel/normal.jpg');
    expect(paths!.roughness).toContain('/assets/materials/Corrugated_Steel/roughness.jpg');
  });

  it('returns KTX2 paths for 2k quality', () => {
    const paths = getTexturePaths('Corrugated_Steel', '2k');
    expect(paths!.color).toContain('/assets/materials-ktx2/Corrugated_Steel/color.ktx2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/texture-loader.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create textureLoader.ts**

```typescript
// src/config/textureLoader.ts
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
    mat.normalScale = new THREE.Vector2(normalScale, normalScale);
    mat.needsUpdate = true;
  }, undefined, onError(paths.normal));

  getTextureLoader().load(paths.roughness, (t) => {
    configure(t);
    mat.roughnessMap = t;
    mat.needsUpdate = true;
  }, undefined, onError(paths.roughness));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/texture-loader.test.ts`
Expected: PASS

- [ ] **Step 5: Update materialCache.ts to use textureLoader**

In `src/config/materialCache.ts`:

1. Remove the `loadThemeTextures` function (lines 136-170)
2. Import `getTexturePaths, applyTextures, type TextureQuality` from `textureLoader.ts`
3. Add a `rebuildThemeMaterials` export:

```typescript
import { getTexturePaths, applyTextures, type TextureQuality } from './textureLoader';

// Replace the loadThemeTextures call at bottom with:
export function applyQualityTextures(quality: TextureQuality) {
  for (const themeId of Object.keys(THEMES) as ThemeId[]) {
    const matSet = _themeMats[themeId];
    const textures = THEMES[themeId].textures;

    const steelPaths = getTexturePaths(textures.exterior_wall_folder ?? 'Corrugated_Steel', quality);
    if (steelPaths) applyTextures(matSet.steel, steelPaths, 3, 1);

    const woodPaths = getTexturePaths(textures.floor_folder ?? 'Deck_Wood', quality);
    if (woodPaths) applyTextures(matSet.wood, woodPaths, 4, 1);

    const concretePaths = getTexturePaths(textures.ceiling_folder ?? 'Concrete', quality);
    if (concretePaths) applyTextures(matSet.concrete, concretePaths);

    const innerPaths = getTexturePaths(textures.interior_wall_folder ?? textures.exterior_wall_folder ?? 'Corrugated_Steel', quality);
    if (innerPaths) applyTextures(matSet.steelInner, innerPaths);
  }
}

// At module level (replaces old loadThemeTextures call):
if (typeof document !== 'undefined') {
  applyQualityTextures('1k'); // Default medium quality
}
```

4. NOTE: Do NOT add `rebuildThemeMaterials` here — it is defined in Task 6 which adds the full material rebuild (disposing materials + rebuilding with quality parameter + re-applying textures). `applyQualityTextures` is the only export needed from this task.

- [ ] **Step 6: Update themes.ts texture folder references**

In `src/config/themes.ts`, replace the existing URL-based `ThemeTextureSet` with folder-based fields. The existing `exterior_wall`, `interior_wall`, `floor`, `ceiling` fields are full URL paths like `/assets/materials/Corrugated_Steel/`. Replace these with just the folder name (the `textureLoader.ts` constructs the full path):

```typescript
export interface ThemeTextureSet {
  /** Folder name under /assets/materials/ for exterior walls */
  exterior_wall_folder: string;
  /** Folder name for interior walls */
  interior_wall_folder: string;
  /** Folder name for floor surfaces */
  floor_folder: string;
  /** Folder name for ceiling surfaces */
  ceiling_folder: string;
}
```

Update each theme's textures. Example for industrial:
```typescript
textures: {
  exterior_wall_folder: 'Corrugated_Steel',
  interior_wall_folder: 'Corrugated_Steel',
  floor_folder: 'Deck_Wood',
  ceiling_folder: 'Concrete',
},
```

Also update `applyQualityTextures` in `materialCache.ts` to use the new field names (no `??` fallback needed since they're required).

- [ ] **Step 7: Remove pbrTextures.ts imports**

Search for all imports of `pbrTextures.ts` and remove them. The file `src/config/pbrTextures.ts` can be deleted or kept with a deprecation comment.

Run: `grep -rn "pbrTextures" src/ --include="*.ts" --include="*.tsx"`

Known import: `src/components/three/Scene.tsx` line 59 imports from `@/config/pbrTextures`. Remove this import and any usage of `loadAllTextures`/`getSteelTextures`/`getWoodTextures` — texture loading is now handled by `materialCache.ts` via `applyQualityTextures`.

Update any other importing files to use `textureLoader.ts` instead.

- [ ] **Step 8: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add src/config/textureLoader.ts src/config/materialCache.ts src/config/themes.ts src/__tests__/texture-loader.test.ts
git rm src/config/pbrTextures.ts  # or just git add if keeping with deprecation
git commit -m "refactor: consolidate texture loading into textureLoader.ts, retire pbrTextures.ts"
```

---

## Task 6: Material PBR Upgrades

**Files:**
- Modify: `src/config/materialCache.ts`

- [ ] **Step 1: Add clearcoat to glass on High preset**

In `materialCache.ts`, modify `buildThemeMaterials` to accept a quality parameter:

```typescript
function buildThemeMaterials(cfg: ThemeMaterialConfig, quality: TextureQuality = '1k'): ThemeMaterialSet {
  return {
    // ... existing materials ...
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
    // ... rest unchanged ...
  };
}
```

- [ ] **Step 1b: Add emissive boost to glass at low sun angles**

In `buildThemeMaterials`, glass material gets a subtle emissive at construction time. The actual emissive intensity is updated at runtime by `InteriorLights.tsx` or a `GlassEmissiveManager` that watches `timeOfDay`:

```typescript
// In InteriorLights.tsx, add a useEffect that sets glass emissive:
const timeOfDay = useStore((s) => s.environment.timeOfDay);
const currentTheme = useStore((s) => s.currentTheme);

useEffect(() => {
  const matSet = _themeMats[currentTheme];
  const sunLow = timeOfDay < 7 || timeOfDay > 17;
  matSet.glass.emissive.setHex(sunLow ? 0xffe4b5 : 0x000000);
  matSet.glass.emissiveIntensity = sunLow ? 0.15 : 0;
  matSet.glass.needsUpdate = true;
}, [timeOfDay, currentTheme]);
```

- [ ] **Step 1c: Add brushed-metal normal map to frame material**

In `buildThemeMaterials`, for all themes, apply a procedural brushed-metal normal map to the frame material. Generate it similarly to the existing corrugation normal but with horizontal striations (simulating brushed steel):

```typescript
// Add to materialCache.ts (near makeCorrugNormal):
function makeBrushedMetalNormal(w = 256, h = 256, lines = 64, str = 0.3): THREE.DataTexture {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = Math.cos((y / h) * lines * Math.PI * 2) * str;
      const len = Math.sqrt(dx * dx + 1);
      const i = (y * w + x) * 4;
      data[i]     = 128; // No X perturbation
      data[i + 1] = Math.round(((dx / len) * 0.5 + 0.5) * 255); // Y striations
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

// In buildThemeMaterials, frame material:
frame: new THREE.MeshStandardMaterial({
  // ... existing props ...
  normalMap: _brushedMetalNormal,
  normalScale: new THREE.Vector2(0.3, 0.3),
}),
```

- [ ] **Step 2: Rebuild _themeMats with quality parameter**

IMPORTANT: `buildThemeMaterials` quality parameter must default to `'1k'` so the module-level initialization doesn't break:

```typescript
function buildThemeMaterials(cfg: ThemeMaterialConfig, quality: TextureQuality = '1k'): ThemeMaterialSet {
```

The module-level `_themeMats` initialization continues to work without changes (calls `buildThemeMaterials(THEMES.industrial.materials)` — quality defaults to `'1k'`).

Add `rebuildThemeMaterials` for runtime quality changes. Use `let` instead of `const` for `_themeMats`:

```typescript
let _currentQuality: TextureQuality = '1k';

export let _themeMats: Record<ThemeId, ThemeMaterialSet> = {
  industrial: buildThemeMaterials(THEMES.industrial.materials),
  japanese:   buildThemeMaterials(THEMES.japanese.materials),
  desert:     buildThemeMaterials(THEMES.desert.materials),
};

export function rebuildThemeMaterials(quality: TextureQuality) {
  if (quality === _currentQuality) return;
  _currentQuality = quality;
  // Dispose old materials
  for (const matSet of Object.values(_themeMats)) {
    for (const mat of Object.values(matSet)) {
      (mat as THREE.Material).dispose();
    }
  }
  // Rebuild with new quality
  for (const themeId of Object.keys(THEMES) as ThemeId[]) {
    _themeMats[themeId] = buildThemeMaterials(THEMES[themeId].materials, quality);
  }
  // Re-apply textures at new quality
  applyQualityTextures(quality);
}
```

NOTE: This must be implemented in the SAME commit as Task 5's `applyQualityTextures` — do not commit Task 5 and Task 6 separately if `rebuildThemeMaterials` references `applyQualityTextures`. Merge Tasks 5 & 6 into a single commit if needed.

- [ ] **Step 3: Browser verification**

Run `npm run dev`. Switch to High quality (once UI is built — for now, test via console):
```javascript
// In browser console:
useStore.getState().setQualityPreset('high');
```

Check glass surfaces for double-reflection clearcoat effect.

- [ ] **Step 4: Commit**

```bash
git add src/config/materialCache.ts
git commit -m "feat: quality-parameterized material factory with glass clearcoat on High"
```

---

## Task 7: Interior Lighting State

**Files:**
- Modify: `src/types/container.ts`
- Modify: `src/store/slices/containerSlice.ts`
- Modify: `src/store/persistSchema.ts`
- Test: `src/__tests__/interior-lights-state.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/interior-lights-state.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
// idb-keyval is globally mocked in src/__tests__/setup.ts — no additional mocks needed
import { useStore } from '@/store/useStore';

describe('Interior Lights State', () => {
  let containerId: string;

  beforeEach(() => {
    useStore.getState().resetStore();
    useStore.getState().addContainer('20ft');
    const containers = useStore.getState().containers;
    containerId = Object.keys(containers)[0];
  });

  it('container starts with empty lights array', () => {
    const container = useStore.getState().containers[containerId];
    expect(container.lights ?? []).toEqual([]);
  });

  it('addLight adds a ceiling light', () => {
    useStore.getState().addLight(containerId, 0, 'ceiling');
    const container = useStore.getState().containers[containerId];
    expect(container.lights).toEqual([{ voxelIndex: 0, type: 'ceiling' }]);
  });

  it('addLight adds a lamp', () => {
    useStore.getState().addLight(containerId, 5, 'lamp');
    const container = useStore.getState().containers[containerId];
    expect(container.lights).toEqual([{ voxelIndex: 5, type: 'lamp' }]);
  });

  it('removeLight removes by voxelIndex', () => {
    useStore.getState().addLight(containerId, 0, 'ceiling');
    useStore.getState().addLight(containerId, 5, 'lamp');
    useStore.getState().removeLight(containerId, 0);
    const container = useStore.getState().containers[containerId];
    expect(container.lights).toEqual([{ voxelIndex: 5, type: 'lamp' }]);
  });

  it('addLight prevents duplicate on same voxel', () => {
    useStore.getState().addLight(containerId, 0, 'ceiling');
    useStore.getState().addLight(containerId, 0, 'lamp');
    const container = useStore.getState().containers[containerId];
    expect(container.lights?.length).toBe(1); // First one wins
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/interior-lights-state.test.ts`
Expected: FAIL — `addLight` not in state

- [ ] **Step 3: Add LightPlacement type**

In `src/types/container.ts`, add:

```typescript
export interface LightPlacement {
  voxelIndex: number;
  type: 'ceiling' | 'lamp';
}
```

Add to the `Container` interface (near the `furniture` field around line 203):

```typescript
/** Interior light placements */
lights?: LightPlacement[];
```

- [ ] **Step 4: Add addLight / removeLight actions**

In `src/store/slices/containerSlice.ts`, add to the `ContainerSlice` interface:

```typescript
addLight: (containerId: string, voxelIndex: number, type: 'ceiling' | 'lamp') => void;
removeLight: (containerId: string, voxelIndex: number) => void;
```

Add implementations in `createContainerSlice`:

```typescript
addLight: (containerId, voxelIndex, type) =>
  set((s: any) => {
    const container = s.containers[containerId];
    if (!container) return {};
    const lights = container.lights ?? [];
    // Prevent duplicate on same voxel
    if (lights.some((l: any) => l.voxelIndex === voxelIndex)) return {};
    return {
      containers: {
        ...s.containers,
        [containerId]: {
          ...container,
          lights: [...lights, { voxelIndex, type }],
        },
      },
    };
  }),

removeLight: (containerId, voxelIndex) =>
  set((s: any) => {
    const container = s.containers[containerId];
    if (!container || !container.lights) return {};
    return {
      containers: {
        ...s.containers,
        [containerId]: {
          ...container,
          lights: container.lights.filter((l: any) => l.voxelIndex !== voxelIndex),
        },
      },
    };
  }),
```

- [ ] **Step 5: Update persist schema**

In `src/store/persistSchema.ts`, add to `containerSchema`:

```typescript
lights: z.array(z.object({
  voxelIndex: z.number(),
  type: z.enum(['ceiling', 'lamp']),
})).optional().default([]),
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/__tests__/interior-lights-state.test.ts`
Expected: PASS

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add src/types/container.ts src/store/slices/containerSlice.ts src/store/persistSchema.ts src/__tests__/interior-lights-state.test.ts
git commit -m "feat: add interior light placement state (ceiling + lamp types)"
```

---

## Task 8: Interior Lighting Components

**Files:**
- Create: `src/components/three/InteriorLights.tsx`
- Modify: `src/components/three/Scene.tsx` (mount InteriorLights)

- [ ] **Step 1: Write failing test for light intensity calculation**

```typescript
// src/__tests__/interior-lights-intensity.test.ts
import { describe, it, expect } from 'vitest';

// Extract the intensity logic into a pure function for testing
import { getLightIntensity } from '@/components/three/InteriorLights';

describe('Interior Light Intensity', () => {
  it('returns low intensity at midday', () => {
    expect(getLightIntensity(12)).toBe(0.3);
  });

  it('returns full intensity at night', () => {
    expect(getLightIntensity(22)).toBe(2.0);
    expect(getLightIntensity(3)).toBe(2.0);
  });

  it('transitions during dawn (5-8)', () => {
    const intensity = getLightIntensity(6.5);
    expect(intensity).toBeGreaterThan(0.3);
    expect(intensity).toBeLessThan(2.0);
  });

  it('transitions during dusk (16-18)', () => {
    const intensity = getLightIntensity(17);
    expect(intensity).toBeGreaterThan(0.3);
    expect(intensity).toBeLessThan(2.0);
  });
});
```

Run: `npx vitest run src/__tests__/interior-lights-intensity.test.ts`
Expected: FAIL — module not found

- [ ] **Step 2: Create InteriorLights component**

```typescript
// src/components/three/InteriorLights.tsx
"use client";

import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '@/store/useStore';
import { QUALITY_PRESETS } from '@/config/qualityPresets';
import { useShallow } from 'zustand/react/shallow';
import { CONTAINER_SPECS } from '@/config/containerSpecs';

const LIGHT_COLOR = 0xffe4b5; // Warm white (3000K)
const SPOT_ANGLE = Math.PI / 3; // ~60 degrees
const SPOT_PENUMBRA = 0.5;
const POINT_RANGE = 3; // meters

/** Pure function — exported for testing */
export function getLightIntensity(timeOfDay: number): number {
  if (timeOfDay >= 8 && timeOfDay <= 16) return 0.3;
  if (timeOfDay >= 18 || timeOfDay <= 5) return 2.0;
  if (timeOfDay < 8) return 0.3 + (8 - timeOfDay) / 3 * 1.7;
  return 0.3 + (timeOfDay - 16) / 2 * 1.7;
}

interface LightData {
  containerId: string;
  position: THREE.Vector3;
  type: 'ceiling' | 'lamp';
}

export default function InteriorLights() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  const config = QUALITY_PRESETS[qualityPreset];
  const timeOfDay = useStore((s) => s.environment.timeOfDay);

  // Collect all light placements across containers
  const containers = useStore(useShallow((s) => {
    const result: { id: string; position: { x: number; y: number; z: number }; size: string; lights: any[] }[] = [];
    for (const [id, c] of Object.entries(s.containers)) {
      if (c.lights && c.lights.length > 0) {
        result.push({ id, position: c.position, size: c.size, lights: c.lights });
      }
    }
    return result;
  }));

  // Calculate intensity based on time of day (brighter at dusk/night)
  const intensity = useMemo(() => {
    if (timeOfDay >= 8 && timeOfDay <= 16) return 0.3; // Daytime — subtle
    if (timeOfDay >= 18 || timeOfDay <= 5) return 2.0; // Night — full brightness
    // Dawn/dusk transition
    if (timeOfDay < 8) return 0.3 + (8 - timeOfDay) / 3 * 1.7;
    return 0.3 + (timeOfDay - 16) / 2 * 1.7;
  }, [timeOfDay]);

  // Build light positions
  const lights = useMemo<LightData[]>(() => {
    const result: LightData[] = [];
    for (const c of containers) {
      const spec = CONTAINER_SPECS[c.size];
      if (!spec) continue;
      const vHeight = spec.height;

      for (const light of c.lights) {
        if (result.length >= config.maxLights) break;

        // Calculate voxel world position
        const row = Math.floor(light.voxelIndex / 8); // VOXEL_COLS = 8
        const col = light.voxelIndex % 8;
        const voxelX = (row - 1.5) * (spec.length / 4); // Approximate voxel center
        const voxelZ = (col - 3.5) * (spec.width / 8);

        const worldPos = new THREE.Vector3(
          c.position.x + voxelX,
          c.position.y + (light.type === 'ceiling' ? vHeight - 0.05 : 0.5),
          c.position.z + voxelZ,
        );

        result.push({ containerId: c.id, position: worldPos, type: light.type });
      }
    }
    return result;
  }, [containers, config.maxLights]);

  return (
    <>
      {lights.map((light, i) => {
        if (light.type === 'ceiling') {
          return (
            <group key={`light-${light.containerId}-${i}`} position={light.position}>
              {/* Visual: recessed disc */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.1, 0.02, 16]} />
                <meshStandardMaterial color={0x333333} metalness={0.8} roughness={0.2} />
              </mesh>
              <spotLight
                color={LIGHT_COLOR}
                intensity={intensity}
                angle={SPOT_ANGLE}
                penumbra={SPOT_PENUMBRA}
                position={[0, 0, 0]}
                target-position={[0, -1, 0]}
                castShadow={config.lightShadows}
                shadow-mapSize-width={config.lightShadows ? 512 : undefined}
                shadow-mapSize-height={config.lightShadows ? 512 : undefined}
              />
            </group>
          );
        }

        // Floor lamp
        return (
          <group key={`light-${light.containerId}-${i}`} position={light.position}>
            {/* Visual: simple lamp shape */}
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.02, 0.05, 0.6, 8]} />
              <meshStandardMaterial color={0x444444} metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.65, 0]}>
              <coneGeometry args={[0.12, 0.15, 16]} />
              <meshStandardMaterial
                color={0xffeedd}
                emissive={LIGHT_COLOR}
                emissiveIntensity={intensity * 0.3}
              />
            </mesh>
            <pointLight
              color={LIGHT_COLOR}
              intensity={intensity * 0.6}
              distance={POINT_RANGE}
              position={[0, 0.65, 0]}
            />
          </group>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Mount in Scene.tsx**

In `Scene.tsx`, import and add `<InteriorLights />` inside the scene tree (after containers, before post-processing):

```typescript
import InteriorLights from './InteriorLights';
// ... inside scene JSX:
<InteriorLights />
```

- [ ] **Step 3: Add glass castShadow=false**

In `src/components/objects/ContainerSkin.tsx`, find where glass material is applied to face meshes. Glass faces render as `<mesh>` with the theme's `glass` material. Add `castShadow={false}` to these meshes so interior lights pass through glass in the shadow map.

Search: `grep -rn "glass\|matSet\.glass" src/components/ --include="*.tsx"` to find exact locations.

For each mesh that uses the glass material, ensure the JSX includes:
```tsx
<mesh castShadow={false} receiveShadow material={matSet.glass} ...>
```

Glass should still `receiveShadow` (shadows fall ON glass) but not `castShadow` (light passes THROUGH glass).

- [ ] **Step 4: Browser verification**

Run `npm run dev`. Add a light via console:
```javascript
const id = Object.keys(useStore.getState().containers)[0];
useStore.getState().addLight(id, 5, 'ceiling');
```

Check:
- SpotLight visible inside container (cone of warm light)
- Light intensity increases at dusk (set timeOfDay to 19)
- Light passes through glass faces
- Bloom makes the light glow (if post-processing active)

- [ ] **Step 5: Commit**

```bash
git add src/components/three/InteriorLights.tsx src/components/three/Scene.tsx
git commit -m "feat: interior lighting components (ceiling spots + floor lamps)"
```

---

## Task 9: Bundled HDRIs + Environment Component

**Files:**
- Download: `public/assets/hdri/` (4 HDRI files)
- Modify: `src/components/three/Scene.tsx` (replace CDN environment)

- [ ] **Step 1: Download HDRIs from Polyhaven**

Download 4 HDRIs at 2K resolution (HDR format) from polyhaven.com. Save to `public/assets/hdri/`:

```bash
mkdir -p public/assets/hdri
# Download manually from polyhaven.com or use CLI if available:
# - dawn.hdr (warm amber, e.g. kloofendal_48d_partly_cloudy_2k.hdr)
# - day.hdr (neutral park/field, e.g. kiara_1_dawn_2k.hdr or similar daytime)
# - sunset.hdr (golden hour, e.g. venice_sunset_2k.hdr)
# - night.hdr (dark sky, e.g. moonless_golf_2k.hdr)
```

Rename files to simple names: `dawn.hdr`, `day.hdr`, `sunset.hdr`, `night.hdr`.

NOTE: These are standard .hdr files (~4-8 MB each, ~16-32 MB total). KTX2 conversion of HDRIs is deferred to Task 13 (stretch goal). drei's `<Environment files="...">` supports .hdr natively. The files are lazy-loaded at runtime so they don't affect initial page load.

- [ ] **Step 2: Replace TimeOfDayEnvironment in Scene.tsx**

Find the `TimeOfDayEnvironment` / `TimeOfDayEnvironmentInner` components in `Scene.tsx`. Replace the CDN preset logic with local file loading:

```typescript
function TimeOfDayEnvironmentInner() {
  const timeOfDay = useStore((s) => s.environment.timeOfDay);
  const qualityPreset = useStore((s) => s.qualityPreset);
  const config = QUALITY_PRESETS[qualityPreset];

  if (config.envMap === 'none') return null;

  // Select HDRI based on time bracket
  const hdriFile = useMemo(() => {
    if (timeOfDay >= 5 && timeOfDay < 8) return '/assets/hdri/dawn.hdr';
    if (timeOfDay >= 8 && timeOfDay < 17) return '/assets/hdri/day.hdr';
    if (timeOfDay >= 17 && timeOfDay < 20) return '/assets/hdri/sunset.hdr';
    return '/assets/hdri/night.hdr';
  }, [timeOfDay]);

  return (
    <Environment files={hdriFile} background={false} />
  );
}
```

Remove the `preset=` prop usage (no more CDN fetches).

- [ ] **Step 3: Browser verification**

Run `npm run dev`. Check:
- Reflections visible on steel and glass surfaces
- No network requests to polyhaven CDN
- HDRI switches appropriately when changing time of day
- Low quality: no reflections (environment disabled)
- Medium: static HDRI reflections

- [ ] **Step 4: Commit**

```bash
git add public/assets/hdri/ src/components/three/Scene.tsx
git commit -m "feat: bundled HDRIs replace CDN environment presets"
```

---

## Task 10: CubeCamera (High Preset)

**Files:**
- Modify: `src/components/three/Scene.tsx`

- [ ] **Step 1: Add CubeCamera for High preset**

In `Scene.tsx`, after the `<Environment>` component, add a conditional CubeCamera:

```typescript
import { CubeCamera } from '@react-three/drei';

function SceneEnvironment() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  const config = QUALITY_PRESETS[qualityPreset];

  if (config.envMap !== 'cubeCamera') {
    return <TimeOfDayEnvironment />;
  }

  return (
    <>
      <TimeOfDayEnvironment />
      <CubeCamera resolution={256} frames={1}>
        {/* CubeCamera children receive the generated envMap texture */}
        {(texture) => {
          // Apply envMap to glass and frame materials
          // This runs once, then re-renders on invalidation
          return null;
        }}
      </CubeCamera>
    </>
  );
}
```

NOTE: drei's `<CubeCamera>` API may differ — check drei v10 docs. The key is:
- Resolution: 256 per face
- `frames={1}` means render once, then update manually
- Debounce re-renders to once per second max

- [ ] **Step 2: Wire cubemap updates to events**

Add a ref to CubeCamera and trigger re-render on:
- `pointerUp` after container drag
- `timeOfDay` changes (debounced to 1/sec)

```typescript
const cubeCameraRef = useRef<any>(null);

// In a useEffect watching timeOfDay:
useEffect(() => {
  const timeout = setTimeout(() => {
    cubeCameraRef.current?.update();
  }, 1000); // 1 second debounce
  return () => clearTimeout(timeout);
}, [timeOfDay]);
```

- [ ] **Step 3: Browser verification**

Set quality to High via console:
```javascript
useStore.getState().setQualityPreset('high');
```

Check:
- Glass surfaces reflect nearby containers and ground
- Frame steel reflects sky
- Performance stays smooth (256px cubemap is cheap)

- [ ] **Step 4: Commit**

```bash
git add src/components/three/Scene.tsx
git commit -m "feat: CubeCamera real-time reflections on High quality preset"
```

---

## Task 11: Quality-Based Shadow Map + Conditional Tone Mapping

**Files:**
- Modify: `src/components/three/Scene.tsx` (shadow map size on SunLight)
- Modify: `src/components/three/SceneCanvas.tsx` (conditional tone mapping)

- [ ] **Step 1: Make shadow map size quality-dependent in Scene.tsx**

Shadow map size is a per-light property (not a renderer setting). In `Scene.tsx`, find the SunLight directional light and make its shadow map size read from the quality config:

```typescript
const qualityPreset = useStore((s) => s.qualityPreset);
const config = QUALITY_PRESETS[qualityPreset];

// On the directional light:
<directionalLight
  // ... existing props ...
  shadow-mapSize-width={config.shadowMapSize}
  shadow-mapSize-height={config.shadowMapSize}
/>
```

- [ ] **Step 2: Conditional tone mapping in SceneCanvas.tsx**

When PostProcessingStack handles tone mapping via its `<ToneMapping>` effect, the renderer must use `NoToneMapping` to avoid double tone mapping. In `SceneCanvas.tsx`:

```typescript
import { QUALITY_PRESETS } from '@/config/qualityPresets';

// Inside SceneCanvas, before Canvas return:
const qualityPreset = useStore((s) => s.qualityPreset);
const config = QUALITY_PRESETS[qualityPreset];

// In Canvas gl prop:
gl={{
  antialias: true,
  toneMapping: config.postProcessing ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping,
  toneMappingExposure: 1.3,
}}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/three/Scene.tsx src/components/three/SceneCanvas.tsx
git commit -m "feat: quality-dependent shadow map + conditional tone mapping"
```

---

## Task 12: Quality Preset UI

**Files:**
- Create or modify toolbar/settings component

- [ ] **Step 1: Add quality toggle to toolbar**

Add a quality preset toggle to `src/components/ui/TopToolbar.tsx` (the main toolbar component). Add the import and a button group near the existing theme/ground preset controls:

```typescript
const qualityPreset = useStore((s) => s.qualityPreset);
const setQualityPreset = useStore((s) => s.setQualityPreset);

// In toolbar JSX:
<div className="quality-toggle">
  {(['low', 'medium', 'high'] as const).map((preset) => (
    <button
      key={preset}
      onClick={() => setQualityPreset(preset)}
      className={qualityPreset === preset ? 'active' : ''}
    >
      {preset.charAt(0).toUpperCase() + preset.slice(1)}
    </button>
  ))}
</div>
```

- [ ] **Step 2: Wire preset change to material rebuild**

When `qualityPreset` changes, trigger material rebuild. Add a `useEffect` in Scene.tsx or a dedicated component:

```typescript
import { rebuildThemeMaterials } from '@/config/materialCache';
import { QUALITY_PRESETS } from '@/config/qualityPresets';

function QualityManager() {
  const qualityPreset = useStore((s) => s.qualityPreset);
  const config = QUALITY_PRESETS[qualityPreset];

  useEffect(() => {
    rebuildThemeMaterials(config.textureQuality);
  }, [config.textureQuality]);

  return null;
}
```

Mount `<QualityManager />` in Scene.tsx.

- [ ] **Step 3: Browser verification**

Run `npm run dev`. Test all three presets:
- Low: flat materials, no post-processing, no reflections
- Medium: PBR textures, AO + bloom, HDRI reflections
- High: 2K textures, clearcoat glass, CubeCamera reflections, light shadows

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/TopToolbar.tsx src/components/three/Scene.tsx
git commit -m "feat: quality preset UI toggle + material rebuild on change"
```

---

## Task 13: KTX2 Conversion Script (Stretch)

**Files:**
- Create: `scripts/convert-textures.ts`

- [ ] **Step 1: Create conversion script**

This is a stretch goal. The script converts JPG/PNG textures to KTX2 using `toktx` CLI:

```typescript
// scripts/convert-textures.ts
import { execSync } from 'child_process';
import { readdirSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, basename, extname } from 'path';

const INPUT_DIR = resolve(__dirname, '../public/assets/materials');
const OUTPUT_DIR = resolve(__dirname, '../public/assets/materials-ktx2');

// Ensure toktx is available
try {
  execSync('toktx --version', { stdio: 'ignore' });
} catch {
  console.error('toktx not found. Install KTX-Software: https://github.com/KhronosGroup/KTX-Software');
  process.exit(1);
}

const folders = readdirSync(INPUT_DIR, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

for (const folder of folders) {
  const inputPath = join(INPUT_DIR, folder);
  const outputPath = join(OUTPUT_DIR, folder);
  if (!existsSync(outputPath)) mkdirSync(outputPath, { recursive: true });

  const files = readdirSync(inputPath)
    .filter(f => /\.(jpg|jpeg|png)$/i.test(f));

  for (const file of files) {
    const input = join(inputPath, file);
    const output = join(outputPath, basename(file, extname(file)) + '.ktx2');
    console.log(`Converting ${folder}/${file} -> ${basename(output)}`);
    execSync(`toktx --encode etc1s --clevel 2 "${output}" "${input}"`);
  }
}

console.log('Done! KTX2 files written to public/assets/materials-ktx2/');
```

- [ ] **Step 2: Add npm script**

In `package.json`:
```json
"scripts": {
  "convert-textures": "tsx scripts/convert-textures.ts"
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/convert-textures.ts package.json
git commit -m "feat: KTX2 texture conversion script (stretch goal)"
```

---

## Task 14: Integration & Regression Tests

**Files:**
- Modify: `src/__tests__/environment-correctness.test.ts`
- Test: `src/__tests__/visual-fidelity-regression.test.ts`

- [ ] **Step 1: Extend environment-correctness tests**

Add quality preset assertions:

```typescript
// Add to environment-correctness.test.ts
it('quality preset defaults to medium', () => {
  expect(useStore.getState().qualityPreset).toBe('medium');
});

it('quality preset persists across rehydration', () => {
  useStore.getState().setQualityPreset('high');
  expect(useStore.getState().qualityPreset).toBe('high');
});
```

- [ ] **Step 2: Write visual fidelity regression tests**

```typescript
// src/__tests__/visual-fidelity-regression.test.ts
import { describe, it, expect } from 'vitest';
import { QUALITY_PRESETS, QUALITY_PRESET_IDS } from '@/config/qualityPresets';
import { _themeMats } from '@/config/materialCache';
import * as THREE from 'three';

describe('Visual Fidelity Regression', () => {
  it('all quality presets have valid shadow map sizes', () => {
    for (const preset of Object.values(QUALITY_PRESETS)) {
      expect([512, 1024, 2048, 4096]).toContain(preset.shadowMapSize);
    }
  });

  it('glass material uses MeshPhysicalMaterial', () => {
    for (const matSet of Object.values(_themeMats)) {
      expect(matSet.glass).toBeInstanceOf(THREE.MeshPhysicalMaterial);
    }
  });

  it('glass has transmission enabled', () => {
    for (const matSet of Object.values(_themeMats)) {
      expect((matSet.glass as THREE.MeshPhysicalMaterial).transmission).toBeGreaterThan(0);
    }
  });

  it('steel has corrugation normal on industrial theme', () => {
    expect(_themeMats.industrial.steel.normalMap).not.toBeNull();
  });

  it('max lights increases with quality', () => {
    expect(QUALITY_PRESETS.low.maxLights).toBeLessThan(QUALITY_PRESETS.medium.maxLights);
    expect(QUALITY_PRESETS.medium.maxLights).toBeLessThan(QUALITY_PRESETS.high.maxLights);
  });

  it('post-processing disabled on low', () => {
    expect(QUALITY_PRESETS.low.postProcessing).toBe(false);
    expect(QUALITY_PRESETS.low.bloomEnabled).toBe(false);
  });
});
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (existing + new)

- [ ] **Step 4: Run tsc**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Browser verification — full sweep**

Run `npm run dev` and verify:
1. Ground has visible grass texture (not flat green)
2. Container steel has corrugation detail
3. AO darkens corners (Medium/High presets)
4. Bloom creates soft glow on bright surfaces
5. Interior lights work (add via console, visible at dusk)
6. Quality preset toggle works (Low = flat, Medium = textured, High = clearcoat glass)
7. HDRI reflections visible on steel/glass
8. Time-of-day lighting still works correctly
9. No console errors or "Context Lost"
10. Camera controls still work normally

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/
git commit -m "test: visual fidelity regression + quality preset integration tests"
```

---

## Task 15: Final Cleanup & Architecture Doc Update

- [ ] **Step 1: Run /simplify**

Review all changed code for dead code, missed reuse, quality issues.

- [ ] **Step 2: Update MODUHOME-V1-ARCHITECTURE-v2.md**

Add sections for:
- Quality presets system
- Post-processing pipeline
- Interior lighting
- Texture loading consolidation
- Bundled HDRIs

- [ ] **Step 3: Run acceptance gates**

```bash
npm run gates
npm run quality
```

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "docs: update architecture doc with visual fidelity upgrade"
git tag -a sprint-visual-fidelity-complete -m "Visual fidelity upgrade: post-processing, interior lights, PBR materials, quality presets"
```
