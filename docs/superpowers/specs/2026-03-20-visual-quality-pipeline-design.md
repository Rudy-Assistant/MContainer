# Visual Quality Pipeline — Design Spec

**Date:** 2026-03-20
**Scope:** Items 1-3 from high-value follow-ups: 2K texture sourcing, KTX2 pipeline activation, GPU auto-detect quality

## Overview

A three-part pipeline that upgrades ModuHome's visual quality ceiling: source 2K textures for core materials, wire the KTX2 compressed-texture loader, and auto-detect the user's GPU to silently set the appropriate quality preset on first launch.

**Architecture:** Lazy-load pipeline. Auto-detect runs once, sets the quality preset, textures load on-demand per material as they're built. No preloading, no crossfade, no new UI.

## 1. GPU Auto-Detect

### Behavior

On first launch only (no persisted `qualityPreset` in IndexedDB), detect GPU capability and silently set the quality preset.

### Component: `QualityAutoDetect.tsx`

- New component (~40 lines), mounted inside `<Canvas>` in `Scene.tsx`
- Runs once via `useEffect` + `useThree(state => state.gl)`
- Calls `setQualityPreset()` only when the store has no persisted value

### Detection Signals

- `renderer.capabilities.maxTextureSize` (primary signal — universally available)
- `renderer.capabilities.maxCubemapSize`
- `gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)` (via `renderer.getContext()`)
- `WEBGL_debug_renderer_info` extension for GPU name string (optional — deprecated in Firefox, restricted in some Chrome builds)

### Heuristic

| Condition | Preset |
|---|---|
| maxTextureSize < 4096 | Low |
| maxTextureSize >= 8192 | High |
| Otherwise | Medium |

**GPU name refinement (best-effort):** If `WEBGL_debug_renderer_info` is available, check the unmasked renderer string against a weak-chip list (Intel HD 4000, Mali-400, etc.) and downgrade one tier. If the extension is unavailable, the `maxTextureSize` heuristic alone produces acceptable results — most weak GPUs report maxTextureSize < 4096.

### Escape Hatch

User manually sets quality in settings -> persisted -> auto-detect never fires again.

## 2. 2K Texture Sourcing

### Sources

ambientCG and Polyhaven (both CC0 licensed). Download at 2048x2048 resolution.

### Core 8 Materials

| Material Folder | Likely Source | Textures |
|---|---|---|
| Corrugated_Steel | ambientCG `CorrugatedSteel001` | color, normal, roughness |
| Concrete | ambientCG `Concrete034` | color, normal, roughness |
| Deck_Wood | Polyhaven `wood_planks` | color, normal, roughness |
| Japanese_Cedar | Polyhaven `japanese_cedar` or ambientCG `Wood052` | color, normal, roughness |
| Bamboo | ambientCG `Bamboo001` or Polyhaven `bamboo_wood` | color, normal, roughness |
| Stucco | ambientCG `Stucco001` | color, normal, roughness |
| Plaster | ambientCG `Plaster001` | color, normal, roughness |
| Bleached_Wood | Polyhaven `bleached_oak` or ambientCG `Wood048` | color, normal, roughness |

### File Naming

2K sources placed alongside 1K originals with suffix: `color-2k.jpg`, `normal-2k.jpg`, `roughness-2k.jpg` in `public/assets/materials/{folder}/`. Original 1K files untouched.

### Manual Step

Texture sourcing is a human task (browsing CC0 sites, visual matching). This spec documents what to find but does not automate downloads.

## 3. KTX2 Pipeline Activation

### Conversion Script Updates (`scripts/convert-textures.mjs`)

- Add `--source-suffix` flag (default `-2k`) to scan for `color-2k.jpg`, `normal-2k.jpg`, etc.
- **Codec split logic:**
  - Filename contains `normal` -> UASTC: `--encode uastc --uastc_quality 2 --zstd 5` (lossless, precision-critical)
  - All other textures -> ETC1S: `--encode etc1s --clevel 2` (lossy, small files)
- **Output filename:** Strip the `-2k` suffix from input before writing — `color-2k.jpg` produces `color.ktx2` (not `color-2k.ktx2`). Update the script's `basename` logic to strip the source suffix before appending `.ktx2`.
- Output directory: `public/assets/materials-ktx2/{folder}/color.ktx2`, `normal.ktx2`, `roughness.ktx2`
- Prerequisite: `toktx` CLI from KTX-Software on PATH

### Loader Wiring (`src/config/textureLoader.ts`)

- Add singleton `KTX2Loader` alongside existing `TextureLoader`
- Initialize: `ktx2Loader.setTranscoderPath('/basis/')` pointing to Basis Universal WASM transcoder
- Transcoder files (`basis_transcoder.js` + `basis_transcoder.wasm`) copied from `node_modules/three/examples/jsm/libs/basis/` to `public/basis/`. Add a `postinstall` script in `package.json` to automate this copy so it survives `three` version upgrades.
- `applyTextures()` checks file extension: `.ktx2` -> KTX2Loader, `.jpg` -> TextureLoader. Same callback shape.

### Fallback Chain

The fallback logic lives in `applyTextures()`, not in `getTexturePaths()`:

1. `getTexturePaths(folder, '2k')` returns KTX2 paths as before (pure path resolution, no I/O)
2. `applyTextures()` attempts to load via KTX2Loader
3. On KTX2Loader error (missing file, transcoder failure): catch in the `onError` callback, call `getTexturePaths(folder, '1k')` to get JPG paths, retry with TextureLoader
4. Log a console warning on fallback

This means High preset works even without running the conversion script — it degrades to 1K JPG.

### Medium Preset KTX2 Flag

The medium preset has `useKTX2: true` and `textureQuality: '1k'`. Since this sprint only produces KTX2 files from 2K sources, the medium preset's KTX2 flag is intentionally unused. Medium continues to load 1K JPGs. The flag remains for a future sprint that could convert 1K sources to KTX2 for bandwidth savings on medium-tier devices.

## 4. Integration

### Data Flow

1. **First launch:** Canvas mounts -> `<QualityAutoDetect>` reads GPU -> `setQualityPreset('medium')` (or low/high) -> persisted to IndexedDB
2. **Material rebuild:** `setQualityPreset` updates store -> `QualityManager` (Scene.tsx) reacts via `useEffect` on `config.textureQuality` -> calls `rebuildThemeMaterials(config.textureQuality)` -> for `'2k'`, `getTexturePaths` returns KTX2 paths -> `applyTextures` uses KTX2Loader -> materials update in place
3. **Demand invalidation:** `applyTextures` calls R3F `invalidate()` in each texture's `onLoad` callback to trigger a demand-mode re-render. `QualityManager` passes `invalidate` (from `useThree`) into `rebuildThemeMaterials`, which threads it to `applyTextures`. This fixes a pre-existing bug where texture loads in demand mode didn't trigger re-renders.

### Files Changed

| File | Change |
|---|---|
| `src/config/textureLoader.ts` | Add KTX2Loader singleton, extension-based loader branch, fallback catch, `invalidate()` in onLoad |
| `src/config/qualityPresets.ts` | No changes (already has `textureQuality: '2k'` for High) |
| `src/components/three/QualityAutoDetect.tsx` | New (~40 lines): GPU heuristic + one-time preset set |
| `src/components/three/Scene.tsx` | Mount `<QualityAutoDetect>` inside Canvas |
| `scripts/convert-textures.mjs` | Add `--source-suffix`, UASTC/ETC1S codec split, strip suffix from output filename |
| `public/basis/` | Copy Basis transcoder WASM from three.js |
| `public/assets/materials/*/` | Add `*-2k.jpg` files (manual sourcing) |
| `public/assets/materials-ktx2/` | Generated by script (gitignored) |

## 5. Testing

- **Unit:** GPU heuristic — mock `renderer.capabilities` with weak/mid/strong configs, assert correct preset
- **Unit:** `getTexturePaths` — assert correct extensions returned per quality level (`'flat'` -> null, `'1k'` -> `.jpg`, `'2k'` -> `.ktx2`)
- **Unit:** Fallback — mock KTX2Loader failure, assert retry with JPG paths
- **Integration:** Existing `environment-correctness.test.ts` validates material rebuild doesn't crash
- **Manual:** Toggle Low -> Medium -> High in settings, confirm textures visually change

## 6. Known Limitations / Deferred

- **Texture disposal on quality switch:** When switching from High (2K KTX2) to Medium (1K JPG), old KTX2 textures are not explicitly disposed — `rebuildThemeMaterials` disposes materials but not individual textures loaded by `applyTextures`. This is a pre-existing leak, not introduced by this spec. Deferred to a future "texture lifecycle" cleanup since 2K textures are ~16MB GPU total — acceptable for now.
- **`_currentQuality` early-return:** `rebuildThemeMaterials` no-ops when quality is unchanged. If textures were disposed externally and user re-selects the same preset, they won't reload. Acceptable — this scenario doesn't arise in normal use.

## 7. Not In Scope

- No new UI for quality settings (existing settings panel handles this)
- No texture preloading or crossfade
- Ground textures stay at 1K (not in core 8)
- Remaining 11 material folders (Ground variants, Shoji_Paper, Terracotta) — future sprint
- Corrugation normal map unification (item 4) — separate spec
- Interior light shadows (item 5) — separate spec
- Lamp model replacement (item 6) — separate spec
