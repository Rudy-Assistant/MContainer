# ModuHome V1 — Architecture Reference

> Updated 2026-03-14. Rebuilt from code audit + Playwright regression (23/23 PASS).
> Previous versions preserved as historical record.

---

## §1 Project Overview

ModuHome V1 is a browser-based 3D shipping container home architectural design tool. Users place modular containers, configure interiors (rooms, materials, furniture), stack multi-level structures, walk through in first-person, and export designs.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js App Router | 16.1.6 |
| UI | React | 19.2.3 |
| 3D Engine | Three.js | ^0.182.0 |
| React 3D | @react-three/fiber + drei + postprocessing | v9 / v10 / v3 |
| State | Zustand (7 slices) | 5.0.11 |
| Undo | zundo (temporal middleware) | 2.3.0 |
| Persistence | idb-keyval (IndexedDB) | 6.2.2 |
| Validation | Zod | 4.3.6 |
| Testing | vitest + Playwright | 4.0.18 / 1.58.2 |

### Key Directories

```
src/
  store/
    useStore.ts          (252 lines — middleware chain + type unions only)
    slices/              (7 slice files — ALL business logic)
  components/
    objects/             ContainerSkin.tsx — per-voxel face rendering
    three/               Scene.tsx, GroundManager, ContainerMesh, Walkthrough
    ui/                  SmartHotbar, Sidebar, TopToolbar, modals
  config/                themes, materialCache, groundPresets, pbrTextures
  types/                 container.ts — primary type definitions
  utils/                 applyPalette, exportGLB, adjacencyDetection
  __tests__/             23 test files, 243 behavioral tests
```

### V2 Reference

V2 codebase at `C:\MHome\` — read-only reference, never modify.

---

## §2 Store Architecture

### Middleware Chain

```
create<StoreState>()(
  persist(                          ← outermost: idb-keyval IndexedDB
    temporal(                       ← middle: zundo undo/redo (50 snapshots)
      (set, get) => ({
        ...containerSlice,          ← 1826 lines
        ...voxelSlice,              ←  896 lines
        ...environmentSlice,        ←   89 lines
        ...uiSlice,                 ←   80 lines
        ...selectionSlice,          ←  195 lines
        ...dragSlice,               ←  217 lines
        ...librarySlice,            ←  382 lines
      })
    , { limit: 50, partialize: { containers, zones, furnitureIndex } })
  , { name: 'moduhome-project', storage: idbStorage, partialize: ... })
)
```

### 7 Slices

| Slice | Lines | Owns |
|-------|-------|------|
| `containerSlice.ts` | 1826 | Container CRUD, zones, furniture, stacking, adjacency, pricing, model homes |
| `voxelSlice.ts` | 896 | Face mutations, staircase (stampStaircase + applyStairsFromFace), door states, locking, modules, bucket tool |
| `environmentSlice.ts` | 89 | timeOfDay, theme, viewMode, camera, groundPreset, northOffset |
| `uiSlice.ts` | 80 | Hover state, face preview/context, grab mode, lastStamp, activeHotbarTab, dollhouse, furniture labels |
| `selectionSlice.ts` | 195 | Selection, brush, hotbar slots, clipboard, paint state |
| `dragSlice.ts` | 217 | Container/furniture drag, context menus, structure/floor editors |
| `librarySlice.ts` | 382 | Library (blocks/containers/homes), custom hotbar, module presets, palettes, export/import |

### Persistence Rules

| Data | Undo-tracked? | Persisted to IDB? |
|------|--------------|-------------------|
| containers, zones, furnitureIndex | Yes | Yes |
| environment, viewMode, pricing, library*, customHotbar, palettes, activePaletteId | No | Yes |
| selection, hover, drag, camera, brush, faceContext, grabMode, lastStamp, activeHotbarTab | No | No (ephemeral) |

### Critical Anti-Pattern

```ts
// NEVER do this — subscribes to ALL state changes, kills FPS:
useStore(s => s)

// ALWAYS use atomic selectors:
const containers = useStore(s => s.containers);
const timeOfDay = useStore(s => s.environment.timeOfDay);
```

---

## §3 Rendering Architecture

### Quality Presets System (`src/config/qualityPresets.ts`)

Three-tier quality system (Low/Medium/High) gating all visual features:

| Feature | Low | Medium | High |
|---------|-----|--------|------|
| Post-processing | Off | AO halfRes + Bloom | AO fullRes + Bloom |
| Shadow map | 1024 | 2048 | 4096 |
| Textures | Flat colors | JPG 1K PBR | KTX2 2K PBR |
| Environment | None | Bundled HDRI | CubeCamera (256px) |
| Max lights | 4 | 8 | 16 |

Store: `qualityPreset` in environmentSlice (persisted). UI: three-button toggle in appearance panel.

`QualityManager` component in Scene.tsx watches preset changes and triggers `rebuildThemeMaterials()` + imperative `gl.toneMapping` updates.

### Material Cache (`src/config/materialCache.ts`)

Singleton module owning all PBR materials. Exports:
- `ThemeMaterialSet` interface (9 materials: steel, steelInner, glass, frame, wood, woodGroove, rail, railGlass, concrete)
- `_themeMats: Record<ThemeId, ThemeMaterialSet>` — built at import, textures applied by QualityManager on mount
- `rebuildThemeMaterials(quality)` — disposes old materials, rebuilds at new quality level (builds new BEFORE disposing old to prevent one-frame black flicker)
- `applyQualityTextures(quality)` — applies texture maps via `textureLoader.ts`

### Texture Loader (`src/config/textureLoader.ts`)

Consolidated texture path resolver and async loader (replaces retired `pbrTextures.ts`):
- `getTexturePaths(folder, quality)` — returns JPG/KTX2 paths or null for flat quality
- `applyTextures(material, paths, repeatX, repeatY, normalScale)` — async TextureLoader with per-texture error fallback

### Post-Processing (`src/components/three/PostProcessingStack.tsx`)

EffectComposer wrapper with ErrorBoundary (catches GL context loss gracefully):
- N8AO (screen-space AO): halfRes on Medium, fullRes on High
- Bloom: luminanceThreshold 0.85, mipmapBlur
- ToneMapping: ACESFilmic (managed by PostProcessingStack, not renderer)
- Disabled entirely on Low preset (returns null)

### Interior Lighting (`src/components/three/InteriorLights.tsx`)

Two placeable light types (not tied to room assignment):
- **Ceiling Light**: SpotLight downward, warm white (3000K), castShadow on High only
- **Floor Lamp**: PointLight, range 3m, no shadow
- Glass emissive boost at low sun angles (isSunLow threshold)
- Intensity scales with time-of-day via `getLightIntensity()` from `config/timeOfDay.ts`
- State: `lights?: LightPlacement[]` on Container, `addLight`/`removeLight` actions
- UI: Ceiling Light / Floor Lamp buttons in Furniture hotbar tab, click voxel ceiling/floor to place/remove

### Time-of-Day Helpers (`src/config/timeOfDay.ts`)

Centralized phase classification for all time-dependent systems:
- `isNight`, `isGoldenHour`, `isDeepTwilight`, `isTwilight`, `isSunLow`
- `getHdriFile(t)` — selects bundled HDRI by time bracket
- `getLightIntensity(t)` — interior light intensity curve

### ContainerSkin.tsx (~2500 lines)

Per-voxel renderer. For each active voxel, renders up to 6 face planes (N/S/E/W/Top/Bottom) + hitbox meshes. Materials come from `_themeMats` via module-level aliases (`mSteel`, `mGlass`, etc.) synced per render via `syncThemeMats(theme)`.

Special renderers: `StairMesh` (6/3 treads + risers + railings), `DoorFace` (animated swing/slide).

### ContainerMesh.tsx (~2500 lines)

Orchestrates per-container rendering: bay walls (legacy), furniture GLBs via `useGLTF`, hover highlights, interior glow (activates at dawn/dusk when glass faces present).

### Scene.tsx (~1700 lines)

Scene graph for all three view modes:
- **RealisticScene**: Sky (Preetham atmospheric), TimeOfDayEnvironment (bundled HDRIs or CubeCamera on High), SunLight (PCFSoftShadow, quality-dependent shadow map), GroundManager, SceneFog (adaptive near/far), InteriorLights, PostProcessingStack (N8AO + Bloom + ToneMapping ACESFilmic)
- **BlueprintScene**: Orthographic camera, 1m grid, dimension labels
- **WalkthroughScene**: PointerLockControls, voxel collision, auto-tour, InteriorLights, PostProcessingStack

### GroundManager.tsx

Ground presets with per-preset texture filename overrides. Grass uses ambientCG 1K set (Color, NormalGL, Roughness, Displacement, AO). Other presets (concrete/gravel/dirt) use generic `color.jpg`/`normal.jpg`/`roughness.jpg`. All presets have ErrorBoundary fallback to solid color + procedural displacement. Random UV rotation per session breaks visible tiling.

### WalkthroughControls.tsx (1182 lines)

Built on drei `<PointerLockControls>`. Adds: voxel-granular wall collision, floor detection with stair support, auto-tour (interior + exterior waypoints), smart spawn, door toggling, camera save/restore, fly mode. **Not a candidate for replacement.**

### Camera System (Scene.tsx)

Three mutually exclusive modes switched by `viewMode`. CameraControls (orbit) is only mounted in RealisticScene; PointerLockControls only in WalkthroughScene.

**CameraTargetLerp** uses a "settle-and-release" pattern: when selection or containers change, it lerps the orbit target smoothly toward the new center, then **stops calling setTarget()** once within 1cm. This is critical — without settling, every frame would override the user's TRUCK pan, making right-click and WASD feel locked.

**CameraBroadcast** saves/restores 3D camera position across view mode switches (Design ↔ Walk ↔ Blueprint). Uses `controlsRef = useRef(controls)` pattern so cleanup closures always access the latest camera-controls instance (React 19 nulls ref objects during unmount).

**CameraFloorGuard** is a pure safety net: NaN recovery + diagnostic exposure via `window.__camDiag`.

---

## §4 Voxel Data Model

### Grid Layout

Each container has a voxel grid: **8 cols × 4 rows = 32 voxels per level**, up to 2 levels (64 total).

- **Body voxels**: cols 1-6, rows 1-2 (indices 9-14, 17-22 on level 0)
- **Extension voxels**: border cols (0, 7) and rows (0, 3) — deck/awning halos

### Voxel Interface

```ts
interface Voxel {
  active: boolean;
  type: 'core' | 'deck' | 'roof';
  faces: VoxelFaces;              // { top, bottom, n, s, e, w } — each a SurfaceType
  voxelType?: 'standard' | 'stairs';
  stairDir?: 'ns' | 'ew';
  stairAscending?: 'n' | 's' | 'e' | 'w';
  stairPart?: 'lower' | 'upper' | 'single';
  doorState?: 'closed' | 'open_swing' | 'open_slide';
}
```

### Coordinate System

- X = container long axis (col direction, NEGATED: col 0 = +X)
- Z = container short axis (row direction)
- Y = vertical (level 0 floor at Y=0, level 1 floor at Y=2.9m)

### Adjacency

AABB proximity detection with `CONTACT_EPSILON=0.001`. Auto-merge: adjacent Solid_Steel walls → Open. Separation restores originals via `_preMergeWalls` save/restore pattern.

---

## §5 Keyboard Controls

### Hotbar
| Key | Action |
|-----|--------|
| 1–9 | Hotbar slots 1–9 |
| 0 | Hotbar slot 10 |
| = | Next hotbar row |
| - | Previous hotbar row |
| Tab | Toggle hotbar row |

### View Modes
| Key | Action |
|-----|--------|
| Alt+3 | 3D view |
| Alt+4 | Blueprint view |
| F | Walkthrough (FP) |
| V | Cycle all views |

### Container Manipulation
| Key | Action |
|-----|--------|
| Shift+G | Grab mode (arrows move, Enter confirm, Esc cancel) |
| G | Group selected into zone |
| R | Rotate module / rotate container |
| Q | Rotate stamp faces / rotate container |
| Delete | Delete container (or clear voxel if face selected) |

### Painting
| Key | Action |
|-----|--------|
| Alt+click | Eyedropper — pick face material |
| Space | Repeat last stamp (or cycle edges) |
| C | Clear hovered face/block |
| E | Apply active hotbar stamp to hovered block |

### UI
| Key | Action |
|-----|--------|
| [ | Toggle sidebar collapse |
| Scroll | Camera zoom (always — no material cycling) |

### Reserved (do not rebind)
| Key | Reserved for |
|-----|-------------|
| W/A/S/D | FP movement |
| Q/Z | FP fly up/down |
| P | Toggle preview mode |
| B | Toggle build mode (Frame Builder) |
| Ctrl+Z/Y | Undo/Redo |
| PgUp/PgDn | Level slicer |

---

## §6 Feature Status

26/26 features at PRODUCTION quality (Sprint 13). 39/39 Playwright gates PASS. See `CURRENT-QUALITY-ASSESSMENT.md` for full ratings with evidence.

| Feature | Rating |
|---------|--------|
| Container Rendering | PRODUCTION |
| Furniture | PRODUCTION |
| Multi-Container Layouts | PRODUCTION |
| Model Homes | PRODUCTION |
| Walkthrough | PRODUCTION |
| Export | PRODUCTION |
| Blueprint | PRODUCTION |
| Theme System | PRODUCTION |
| Stacking | PRODUCTION |
| Save/Load | PRODUCTION |
| Door System | PRODUCTION |
| Extension System | PRODUCTION |
| Undo/Redo | PRODUCTION |
| Adjacency | PRODUCTION |
| Custom Palette System | PRODUCTION |
| Staircase System | PRODUCTION |
| Hotbar + Controls | PRODUCTION |
| Ground + Atmosphere | PRODUCTION |
| Extension Unpack Animations | PROTOTYPE |

---

## §7 Development Invariants

These must never be violated:

1. `npx tsc --noEmit` → 0 errors before any PR
2. `npx vitest run` → all 297 tests pass before any PR
3. Browser/visual verification is a **hard gate** separate from the test suite
4. Never split `useStore.ts` structure (only slice file content changes)
5. Never use `useStore(s => s)` — subscribe to atomic selectors only
6. `WalkthroughControls.tsx` is not a candidate for replacement
7. Sprint N+1 cannot start until Sprint N audit artifacts are in context
8. Run `/simplify` after implementation, before browser verification

---

## §8 Known Limitations / Deferred Work

- Furniture GLBs are mapped but room placement is manual (no auto-furnish algorithm)
- FP walking uses mock pointer lock in gates (G8); full manual FP verification recommended for stair climbing + door toggling
- Ground uses solid color for grass (no PBR texture) — avoids tiling but loses surface detail at close range
- `stairDir` field is DEPRECATED — `stairAscending` is canonical. Removal deferred to migration sprint
- Dead code: all 11 legacy files confirmed deleted (DEAD-CODE-AUDIT.md). Codebase is clean
- Stair system unified: `applyStairsFromFace` is single source of truth. BOM includes stair cost ($4,500/staircase)
- Walkthrough auto-tour uses voxel stairs (not furniture) for level transitions
- Camera: CameraTargetLerp uses settle-and-release pattern (see CLAUDE.md Camera Architecture)
