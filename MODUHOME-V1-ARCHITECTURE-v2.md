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

### Material Cache (`src/config/materialCache.ts`)

Singleton module owning all PBR materials. Exports:
- `ThemeMaterialSet` interface (9 materials: steel, steelInner, glass, frame, wood, woodGroove, rail, railGlass, concrete)
- `_themeMats: Record<ThemeId, ThemeMaterialSet>` — built once at import, textures loaded async
- `getTextureLoader()` — shared TextureLoader singleton

### ContainerSkin.tsx (~2500 lines)

Per-voxel renderer. For each active voxel, renders up to 6 face planes (N/S/E/W/Top/Bottom) + hitbox meshes. Materials come from `_themeMats` via module-level aliases (`mSteel`, `mGlass`, etc.) synced per render via `syncThemeMats(theme)`.

Special renderers: `StairMesh` (6/3 treads + risers + railings), `DoorFace` (animated swing/slide).

### ContainerMesh.tsx (~2500 lines)

Orchestrates per-container rendering: bay walls (legacy), furniture GLBs via `useGLTF`, hover highlights, interior glow (activates at dawn/dusk when glass faces present).

### Scene.tsx (~1700 lines)

Scene graph for all three view modes:
- **RealisticScene**: Sky (Preetham atmospheric), TimeOfDayEnvironment (HDRI: park/sunset/dawn/night at 0.65 intensity), SunLight (PCFSoftShadow, frustum ±30), GroundManager, SceneFog (adaptive near/far), ContactShadows, Clouds, N8AO + Bloom + ToneMapping (Neutral)
- **BlueprintScene**: Orthographic camera, 1m grid, dimension labels
- **WalkthroughScene**: PointerLockControls, voxel collision, auto-tour

### GroundManager.tsx

Grass: solid color `#4a6630` + procedural displacement (no texture tiling). Other presets (concrete/gravel/dirt): PBR textures via `useTexture` with ErrorBoundary fallback.

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
| Scroll | Cycle face material / block preset |

### Reserved (do not rebind)
| Key | Reserved for |
|-----|-------------|
| W/A/S/D | FP movement |
| Q/Z | FP fly up/down |
| E | Apply hotbar to hovered block |
| P | Toggle preview mode |
| B | Toggle build mode (Frame Builder) |
| Ctrl+Z/Y | Undo/Redo |
| PgUp/PgDn | Level slicer |

---

## §6 Feature Status

18/18 features at PRODUCTION quality. See `CURRENT-QUALITY-ASSESSMENT.md` for full ratings with evidence.

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

---

## §7 Development Invariants

These must never be violated:

1. `npx tsc --noEmit` → 0 errors before any PR
2. `npx vitest run` → all 243 tests pass before any PR
3. Browser/visual verification is a **hard gate** separate from the test suite
4. Never split `useStore.ts` structure (only slice file content changes)
5. Never use `useStore(s => s)` — subscribe to atomic selectors only
6. `WalkthroughControls.tsx` is not a candidate for replacement
7. Sprint N+1 cannot start until Sprint N audit artifacts are in context
8. Run `/simplify` after implementation, before browser verification

---

## §8 Known Limitations / Deferred Work

- Furniture GLBs are mapped but room placement is manual (no auto-furnish algorithm)
- FP walking cannot be automated in Playwright (pointer lock blocks automation) — manual verification required
- Cross-container staircase void exists but is lightly tested
- `stampStaircase` (hotbar macro) and `applyStairsFromFace` (smart path) now produce identical voxel metadata but visual parity should be manually verified
- Ground uses solid color for grass (no PBR texture) — avoids tiling but loses surface detail at close range
- Several legacy UI components exist (GameHUD, Palette, ViewToggle, etc.) but are dead code — deletion deferred until full inventory audit
