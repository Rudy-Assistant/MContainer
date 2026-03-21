# Visual Fidelity Upgrade — Design Spec

**Date:** 2026-03-20
**Goal:** Close the gap between current flat rendering and aspirational photorealistic architectural visualization. Covers post-processing, interior lighting, ground/texture pipeline, material PBR upgrades, environment maps, and a unified quality presets system.

**Approach:** Top-down — post-processing first for instant visual impact, then interior lights (bloom makes them glow), then materials/textures/environment.

---

## 1. Post-Processing Pipeline

Re-enable `@react-three/postprocessing` after resolving the v6 module-level GL initialization crash.

### Changes

- **Step 1: Investigate postprocessing version.** The current dep is `@react-three/postprocessing@^3.0.4` (wraps `postprocessing` v6.x). The context-loss crash was caused by module-level GL initialization in postprocessing v6. Check if a newer minor/patch of v6 or a v7 release fixes this. If no version resolves the crash, fall back to mounting `EffectComposer` lazily (dynamic import after first frame) or wrapping in a try/catch ErrorBoundary. The entire post-processing section is gated on this investigation succeeding.
- If the postprocessing library remains broken, Sections 2 (bloom glow) and 6 (preset matrix post-processing rows) degrade gracefully: bloom is disabled, AO is disabled, but all other visual upgrades (materials, textures, lighting, environment) still deliver value.
- Remove or convert the postprocessing import guard test (if it still exists in the codebase — it may have already been removed) to verify correct lazy usage instead of banning imports.
- New component: `PostProcessingStack.tsx` wrapping `<EffectComposer>` with quality-gated effects:
  - **N8AO** (screen-space AO): radius 0.8, intensity 1.0. halfRes on Medium, fullRes on High, disabled on Low.
  - **Bloom**: luminanceThreshold 0.85, smoothing 0.1, mipmapBlur. Disabled on Low.
  - **ToneMapping**: ACESFilmic (moves tone mapping from renderer to compositor for better effect interaction).
- Fallback: ErrorBoundary around `EffectComposer`. If mount throws (context loss), disable post-processing with console warning. Scene still renders without effects.

### What stays the same

- Renderer: PCFSoftShadowMap
- Canvas: `frameloop="always"` — note: architecture docs reference `frameloop="demand"` with `invalidate()` as the design-mode pattern. The current code uses `"always"`. Post-processing effects (bloom, AO) require continuous rendering, so `"always"` is correct for this sprint. If post-processing is disabled on Low preset, demand mode could be re-evaluated for Low quality in a future sprint.
- Existing lighting system untouched by this section

---

## 2. Interior Lighting Elements

Two placeable light types that emit real light through glass, visible at dusk/night.

### Ceiling Light

- Placeable on any voxel's ceiling face (not tied to rooms — no feature depends on room assignment)
- Visual: simple recessed disc geometry or minimal track-light .glb (CC0)
- Emits `SpotLight` downward: cone angle ~60deg, warm white (3000K ~0xffe4b5), intensity scales with time-of-day (brighter as sun dims)
- Shadow-casting: High preset only (multiple shadow-casting lights are expensive)
- Max one per voxel ceiling face

### Floor Lamp

- Furniture-category element, placeable on any voxel floor
- Visual: simple geometric shape (cylinder base + cone shade) or CC0 .glb
- Emits `PointLight`: warm white, range ~3m, no shadow casting (too expensive for furniture lights)
- Position: snaps to voxel center (no free-placement within voxel for now)

### State

- New field: `lights: LightPlacement[]` on `ContainerState`
  - `LightPlacement = { voxelIndex: number; type: 'ceiling' | 'lamp' }`
  - No `face` field needed — `type` determines placement surface: ceiling lights attach to voxel ceiling, lamps sit on voxel floor.
- Actions: `addLight(containerId, voxelIndex, type)`, `removeLight(containerId, voxelIndex)`
- Max active lights per quality preset: Low=4, Medium=8, High=16 (soft cap with warning, not hard block)
- Light color: warm default (0xffe4b5), not user-configurable in this sprint

### Glass interaction

- SpotLight/PointLight naturally illuminates through glass (transmission materials allow light to pass visually via refraction)
- **Shadow caveat:** Transmission materials still block shadow maps by default. Glass meshes should have `castShadow=false` so interior lights aren't blocked by glass faces in the shadow pass. The glass still renders visually transparent via transmission.
- Emissive boost on glass faces at low sun angles to sell "warm interior glow" even on Low quality where lights may be capped

---

## 3. Ground Texture Fix + KTX2 Pipeline

### Grass texture fix

- Files exist at `public/assets/materials/Ground_Grass/` (ambientCG 1K set: Color, NormalGL, Roughness, Displacement, AmbientOcclusion + generic color.jpg/normal.jpg/roughness.jpg)
- Current failure: `useTexture` throws Error on 404 (not a Promise — Suspense can't catch it). The actual texture files exist on disk with correct names — the issue is in the loading code path, not missing assets.
- Fix: audit `GroundManager.tsx` and `groundPresets.ts` to verify the code references the correct filenames (filenames in `groundPresets.ts` may already be correct — the real bug may be in how `GroundManager` constructs the path or handles the texture loader). Add ErrorBoundary fallback so texture load failure doesn't crash scene tree.
- Use ambientCG set (higher quality than generic files)

### KTX2 conversion pipeline

- Build-time script: `scripts/convert-textures.ts` using `toktx` or `basisu` CLI
- Output to `public/assets/materials-ktx2/` (parallel to originals, not replacing)
- KTX2 loading: verify drei v10's `useTexture` supports `.ktx2` extensions natively (it may auto-detect and use `KTX2Loader`). If not, use Three.js `KTX2Loader` from `three/addons/loaders/KTX2Loader` directly with Basis transcoder WASM. Do not assume `useKTX2` exists as a named drei export — check the actual API.
- Fallback: if KTX2 fails (old browser, missing WASM), fall back to JPG originals

### Texture loading by quality

- **Low:** JPG originals (smaller download, no transcoder overhead)
- **Medium:** KTX2 1K textures
- **High:** KTX2 2K textures (source higher-res from ambientCG/Polyhaven for key materials)

### Coverage

- Ground presets (grass, concrete, gravel, dirt)
- Container materials (corrugated steel, deck wood, concrete)
- Theme variants (Japanese cedar, bamboo, stucco, etc.)

---

## 4. Material PBR Upgrades

### Steel (exterior)

- Current: procedural corrugation normal (256x64 sine waves). PBR values vary per theme:
  - Industrial: metalness=0.50, roughness=0.55
  - Japanese Modern: metalness=0.55, roughness=0.50
  - Desert Modern: metalness=0.45, roughness=0.55
- Upgrade: use Corrugated_Steel PBR texture set (color + normal + roughness maps already in assets) instead of procedural normal. Per-theme base values are preserved; textures add detail on top.
- Add AO map if available from ambientCG. Add metalness map for realistic per-pixel variation.
- Result: visible rib shadows, per-pixel roughness variation, weathering detail

### Glass

- Current: MeshPhysicalMaterial with transmission=1.0, IOR=1.5, roughness=0.05
- Upgrade: add clearcoat=1.0, clearcoatRoughness=0.05 for double-reflection layer
- Reflectivity boost on High preset (CubeCamera provides real scene reflections)
- Tinted glass option: attenuationColor + attenuationDistance for subtle blue/green tint at glancing angles

### Wood

- Current: flat color, metalness=0, roughness=0.70
- Upgrade: apply Deck_Wood PBR texture set (color + normal + roughness)
- Per-theme variants (Japanese_Cedar, Bamboo, Bleached_Wood) already have texture folders — wire into theme material configs

### Frame (structural steel)

- Current per-theme values:
  - Industrial: metalness=0.90, roughness=0.15
  - Japanese Modern: metalness=0.70, roughness=0.25
  - Desert Modern: metalness=0.60, roughness=0.20
- Upgrade: subtle normal map for brushed-metal micro-detail applied to all themes. Per-theme metalness/roughness values preserved (not overridden with a blanket value).
- Target look: painted structural steel, not chrome. The normal map adds micro-surface variation without changing the per-theme reflectivity balance.

### Concrete (interior)

- Current: flat grey, metalness=0, roughness=0.85
- Upgrade: apply Concrete PBR texture set (already in assets)

### Material cache changes

- `buildThemeMaterials` gains a `quality` parameter
- Low: flat colors + procedural corrugation normal only (current behavior)
- Medium: 1K PBR texture sets applied
- High: 2K textures + clearcoat on glass + metalness maps

### Texture loading consolidation

- Currently two parallel texture systems exist: `materialCache.ts` has `loadThemeTextures()` and `pbrTextures.ts` has `loadAllTextures()`. These must be consolidated into a single path.
- **Decision:** `pbrTextures.ts` is retired. All texture loading moves into `materialCache.ts` (or a new `textureLoader.ts` helper it delegates to), parameterized by quality preset.
- The `_themeMats` singleton cache must support invalidation. Add a `rebuildThemeMaterials(theme, quality)` function that disposes old materials and rebuilds the cache. Called when `qualityPreset` or `theme` changes.

---

## 5. Environment Maps + CubeCamera

### Bundled HDRIs (Medium + High)

- Download 4 HDRIs from Polyhaven at 2K resolution (one per time bracket):
  - Dawn: warm amber sky (e.g. `kloofendal_48d_partly_cloudy`)
  - Day: neutral outdoor (e.g. park/field)
  - Sunset: golden hour (e.g. `venice_sunset`)
  - Night: dark with subtle stars (e.g. `moonless_golf`)
- Convert to KTX2 via same build script from Section 3
- Store in `public/assets/hdri/`
- Eliminates CDN dependency (no Polyhaven fetch at runtime)
- `<Environment>` switches HDRI based on timeOfDay brackets (same logic as current preset switching)

### CubeCamera (High only)

- drei's `<CubeCamera>` renders live cubemap including actual scene (containers, ground, sky)
- Resolution: 256px per face
- Update frequency: not every frame. Re-render cubemap on `pointerUp` after container drag (not during drag), and when `timeOfDay` changes. Debounce to at most once per second to prevent rapid updates during slider scrubbing.
- Applied to glass and frame materials via envMap override
- Result: glass reflects neighboring containers and ground; frame steel reflects sky and surroundings

### Quality tiers

- **Low:** No environment map. Materials rely on flat lighting only.
- **Medium:** Bundled 2K HDRI (static sky/surroundings reflection). Offline, no CDN.
- **High:** CubeCamera live cubemap (real scene reflections) + bundled HDRI as fallback.

### What gets removed

- drei `<Environment preset="...">` CDN fetches (replaced by bundled assets)
- `TimeOfDayEnvironment` component simplifies to HDRI switcher with local files

---

## 6. Quality Presets System

Unified quality control gating every visual feature.

### State

- `qualityPreset: 'low' | 'medium' | 'high'` in environment slice, persisted to IndexedDB
- Default: `'medium'`
- Action: `setQualityPreset(preset)`

### Preset matrix

| Feature | Low | Medium | High |
|---------|-----|--------|------|
| Post-processing | Off | AO (halfRes) + Bloom | AO (fullRes) + Bloom |
| Shadow map | 1024 | 2048 | 4096 |
| Textures | JPG, flat colors | KTX2 1K + PBR maps | KTX2 2K + PBR maps |
| Materials | Procedural normals only | Full PBR texture sets | PBR + clearcoat + metalness maps |
| Environment | None | Bundled 2K HDRI | CubeCamera (256px) + HDRI |
| Max lights | 4 | 8 | 16 |
| Light shadows | None | Sun only | Sun + ceiling lights |
| Ground | Flat color + procedural displacement | PBR textured | PBR textured + AO map |

### UI

- Settings accessible from toolbar (gear icon or dropdown)
- Simple three-button toggle: Low / Medium / High
- Changing preset triggers full material rebuild via materialCache + scene invalidate

### Auto-detect (stretch goal)

- On first launch, check `renderer.capabilities` and `navigator.hardwareConcurrency`
- Suggest preset but let user override

### Architecture

- New file: `src/config/qualityPresets.ts` — exports `QualityConfig` per preset with all values from matrix
- Components read quality via `useStore(s => s.qualityPreset)` and branch
- `materialCache.ts` accepts quality parameter, rebuilds material set on preset change
- `PostProcessingStack` reads quality to decide which effects to mount

---

## Key constraints

- **No room assignment dependencies.** Lights, furniture, materials are freely placeable on any voxel. Rooms are convenience labels, not constraints.
- **Composition over invention.** Use existing libraries (drei, postprocessing, three.js materials) rather than custom shader code.
- **Graceful degradation.** Every visual feature must have a fallback — ErrorBoundary for postprocessing, JPG fallback for KTX2, flat color for failed textures.
- **Performance budget.** Quality presets gate GPU cost. Low runs on integrated GPUs; High targets discrete GPUs (GTX 1060+).

## Files to create

- `src/components/three/PostProcessingStack.tsx`
- `src/config/qualityPresets.ts`
- `scripts/convert-textures.ts`
- `public/assets/hdri/` (4 bundled HDRI files)

## Files to modify

- `src/config/materialCache.ts` (quality parameter, texture application)
- `src/config/themes.ts` (wire texture folders into theme configs)
- `src/config/pbrTextures.ts` (retire — consolidate into materialCache.ts)
- `src/config/groundPresets.ts` (fix filenames to match actual assets)
- `src/components/three/GroundManager.tsx` (fix texture loading, ErrorBoundary)
- `src/components/three/Scene.tsx` (mount PostProcessingStack, replace CDN environment)
- `src/components/three/SceneCanvas.tsx` (shadow map size from quality preset)
- `src/state/` (environment slice: qualityPreset, lights array on ContainerState)
- `src/__tests__/no-postprocessing-import.test.ts` (convert to usage validator or remove)

## Testing strategy

- **Unit tests:** Quality preset config validation (all three presets produce valid configs), material rebuild produces correct material types per quality level, light placement state (add/remove/cap enforcement).
- **Integration tests:** Material cache rebuild on preset change disposes old materials and creates new ones. Texture path construction produces valid URLs for each quality tier.
- **Visual verification:** Since the preview tool cannot verify WebGL (screenshots show blank for 3D), verify via: console log assertions (renderer info, material counts, texture load success), `window.dumpScenePositions()` for light positions, and manual browser inspection.
- **Regression guards:** Existing environment-correctness.test.ts expanded with quality preset assertions. Anti-pattern tests extended for any new mesh components (raycast disabling, visible={false} checks).

## Bundle size

- 4 bundled HDRIs at 2K: ~2-4 MB each as KTX2, ~8-16 MB total in `/public/assets/hdri/`
- Higher-res PBR textures (2K): ~1-2 MB per material set, ~10-20 MB total for all themes
- Total estimated addition: ~20-35 MB to `/public/` (lazy-loaded at runtime, not in JS bundle)
- All assets are lazy-loaded via `useTexture`/`KTX2Loader` — they do not increase initial JS bundle size

## Dependencies

- `@react-three/postprocessing` — upgrade to latest stable (investigate whether any release fixes context-loss crash)
- `toktx` or `basisu` CLI — dev dependency for KTX2 conversion script
- 4x Polyhaven HDRIs (2K, CC0 license) — downloaded and bundled
- Optional: higher-res (2K) PBR texture sets from ambientCG for High preset
