# ModuHome V1 — Architecture (Living Document)

> This document is the source of truth for the V1 codebase. Read it at the start of every session.
> Updated after every sprint that changes architectural state.
>
> **Last updated:** 2026-03-12 (Sprint 12 — Product Completeness, Workflow Verification)

---

## §1 Stack

| Dependency | Version | Role |
|---|---|---|
| Next.js | 16.x | App Router framework |
| React | 19.x | UI rendering |
| Three.js | latest | 3D engine |
| @react-three/fiber | 9.x | React renderer for Three.js |
| @react-three/drei | 10.x | Helpers: CameraControls, Sky, Environment, etc. |
| Zustand | 5.0.11 | Central state store |
| zundo | 2.3.0 | Undo/redo temporal middleware |
| idb-keyval | 6.x | IndexedDB persistence adapter |
| Zod | 4.x | Schema validation for hydration |
| camera-controls | 3.x | Orbit/pan/zoom |
| uuid | latest | Container ID generation |

**Dev:** TypeScript, Vitest (added Sprint 1), Tailwind CSS

---

## §2 Store Shape

**File:** `src/store/useStore.ts` (~2,800 lines)

**Middleware chain:**
```
persist (outermost — idb-keyval, async)
  → temporal/zundo (undo/redo, 50-snapshot limit)
    → plain zustand create() (innermost)
```

Note: immer is NOT used. V1's `set()` calls return partial state objects for Zustand merge. This is incompatible with immer (immer treats returns as complete replacements).

### Top-level state keys

**Persisted by BOTH temporal + persist:**

| Key | Type | Description |
|-----|------|-------------|
| `containers` | `Record<string, Container>` | All container data (voxel grids, walls, furniture, stacking) |
| `zones` | `Record<string, Zone>` | Zone groupings with container IDs and merged wall metadata |
| `furnitureIndex` | `Record<string, FurnitureItem>` | Denormalized furniture index for fast lookup |

**Persisted by persist ONLY (not undo-tracked):**

| Key | Type | Description |
|-----|------|-------------|
| `environment` | `EnvironmentSettings` | `{timeOfDay: 15, northOffset: 0}` — sun position |
| `viewMode` | `ViewMode` | Current view: Realistic3D, Blueprint, Walkthrough |
| `pricing` | `PricingConfig` | Cost database and module pricing |
| `libraryBlocks` | `LibraryBlock[]` | User-saved single-voxel face templates |
| `libraryContainers` | `LibraryContainer[]` | User-saved container templates |
| `libraryHomeDesigns` | `LibraryHomeDesign[]` | User-saved multi-container home designs |
| `customHotbar` | `(HotbarSlot \| null)[]` | 10 custom hotbar slot definitions |

**Ephemeral (not persisted, not undo-tracked):**

| Key | Type | Description |
|-----|------|-------------|
| `_hasHydrated` | `boolean` | IndexedDB hydration complete flag |
| `selection` | `string[]` | Selected container/zone IDs |
| `selectionContext` | `object \| null` | Active subpart (wall, bay) of selected container |
| `activeBrush` | `SurfaceType \| null` | Current single-face brush material |
| `selectedVoxel` | `object \| null` | Last clicked voxel for context menu/preview |
| `selectedVoxels` | `object \| null` | Multi-voxel selection for area stamping |
| `hoveredVoxel` | `object \| null` | Currently hovered voxel |
| `hoveredVoxelEdge` | `unknown \| null` | Hovered voxel edge for 3D preview |
| `hoveredPreviewFace` | `string \| null` | Hovered face in preview |
| `hoveredEdge` | `unknown \| null` | Currently hovered edge |
| `globalCullSet` | `Set<string>` | Voxel faces culled by adjacency (visual-only) |
| `cameraAzimuth` | `number` | Camera azimuth angle (radians) |
| `cameraElevation` | `number` | Camera elevation angle (radians) |
| `savedCamera3D` | `object \| null` | Saved main camera pose |
| `savedWalkthroughPos` | `object \| null` | Saved walkthrough position |
| `cameraRestoring` | `boolean` | Camera restoration in progress |
| `clipboardVoxel` | `VoxelFaces \| null` | Copied voxel config |
| `styleBrush` | `VoxelFaces \| null` | Copied style for paint bucket |
| `bucketMode` | `boolean` | Paint bucket tool toggle |
| `bucketSurface` | `SurfaceType` | Bucket tool material |
| `hotbar` | `HotbarSlot[]` | Primary hotbar: 10 structural presets |
| `activeHotbarSlot` | `number \| null` | Selected primary hotbar slot |
| `activeCustomSlot` | `number \| null` | Selected custom hotbar slot |
| `dragContainer` | `ContainerSize \| null` | Container being dragged from library |
| `dragWorldPos` | `object \| null` | Drag target world position |
| `dragMovingId` | `string \| null` | Container ID being repositioned |
| `isPainting` | `boolean` | Active brush drag-paint |
| `paintPayload` | `VoxelFaces \| null` | Face config during drag paint |
| `isPreviewMode` | `boolean` | Preview/render mode toggle |
| `dollhouseActive` | `boolean` | Dollhouse view toggle |
| `tapeActive` | `boolean` | Tape measure tool toggle |
| `tapePoints` | `Vector3[]` | Tape measure points (max 2) |
| `currentTheme` | `ThemeId` | Active UI theme |
| `viewLevel` | `number \| null` | Displayed level (null = all) |
| `bpvLevel` | `number` | Block preview viewport level |
| `buildMode` | `boolean` | Simplified build mode UI |
| `lockedVoxels` | `Record<string, boolean>` | Locked voxel keys |
| `bayContextMenu` | `object \| null` | Bay right-click menu state |
| `voxelContextMenu` | `object \| null` | Voxel right-click menu state |
| `containerContextMenu` | `object \| null` | Container right-click menu state |
| `structureEditorTarget` | `string \| null` | Structure editor target |
| `floorDetailTarget` | `string \| null` | Floor detail panel target |
| `faceContext` | `unknown \| null` | Face selection context |
| `facePreview` | `unknown \| null` | Face preview state |
| `faceContextMenuCtx` | `unknown \| null` | Face menu context |
| `libraryDragPayload` | `object \| null` | Library drag-and-drop payload |
| `overlappingEdges` | `unknown[] \| null` | Overlapping edges at same position |
| `edgeCycleIndex` | `number` | Position in overlapping edges array |

### Key actions (by domain)

**Container CRUD:** addContainer, removeContainer, renameContainer, resizeContainer, toggleRoof, toggleFloor, setFloorMaterial, setCeilingMaterial

**Position/Rotation:** updateContainerPosition, updateContainerRotation

**Stacking:** stackContainer, unstackContainer

**Voxel/Face Painting:** setActiveBrush, setVoxelFace, setVoxelAllFaces, setVoxelActive, cycleVoxelFace, cycleVoxelTemplate, paintFace, stampFromHotbar, stampFromCustomHotbar, stampArea, stampAreaSmart, brushStampVoxel, copyVoxel, pasteVoxel, copyVoxelStyle, applyStyleToFace, applyStairsFromFace, applySmartRailing, resetVoxelGrid, convertToPool, cycleBlockPreset, stampStaircase, rotateStampFaces, getStampFaces, getStampFootprint, toggleOpenFace

**Selection:** select, selectMultiple, clearSelection, setSelectionContext, setSelectedVoxel, setSelectedVoxels, toggleVoxelInSelection

**Drag:** setDragContainer, setDragWorldPos, startContainerDrag, commitContainerDrag, cancelContainerDrag, beginBrushDrag, startPaint, stopPaint

**Undo/Redo:** undo, redo (via zundo temporal)

**Bay Module:** setBayModule, toggleBayOpen, cycleBayModule, toggleBayLock, setAllOuterWalls, setOuterWallType, setSideWallType, setBayColor

**Furniture:** addFurniture, removeFurniture, moveFurniture, setDragFurniture

**Zones:** createZone, removeZone, renameZone, addContainerToZone, removeContainerFromZone

**Adjacency:** refreshAdjacency

**UI State:** openBayContextMenu, closeBayContextMenu, openFloorContextMenu, openEdgeContextMenu, openStructureEditor, closeStructureEditor, toggleStructuralElement, openFloorDetail, closeFloorDetail, openContainerContextMenu, closeContainerContextMenu, setCornerConfig, openVoxelContextMenu, closeVoxelContextMenu

**Camera:** setCameraAngles, saveCamera3D, saveWalkthroughPos, setCameraRestoring, setHoveredEdge, setHoveredVoxelEdge, setHoveredVoxel, setHoveredPreviewFace

**Hotbar:** setHotbar, setActiveHotbarSlot, setCustomHotbarSlot, setActiveCustomSlot, setBucketMode, setBucketSurface

**Environment/View:** setTimeOfDay, setNorthOffset, setViewMode, setViewLevel, setBpvLevel, toggleBuildMode, toggleDollhouse, toggleTape, addTapePoint, clearTapePoints, togglePreviewMode, setTheme

**Library:** saveBlockToLibrary, saveContainerToLibrary, removeLibraryItem, renameLibraryItem, setLibraryDragPayload

**Pricing:** updatePricing, getEstimate

**Serialization:** exportState, importState

**Demo/Debug:** createGreatRoomDemo, __debugTwoStoryStack

### Persistence

- **Storage:** idb-keyval (IndexedDB) via `src/store/idbStorage.ts`
- **Validation:** Zod schema in `src/store/persistSchema.ts`
- **Hydration guard:** `_hasHydrated` flag in store, checked in `src/app/page.tsx`
- **_preMergeWalls stripped** from containers before IndexedDB persist (ephemeral, rebuilt on load)
- **Previous system (removed):** localStorage with 5-second autosave interval

### Undo/Redo

- **Middleware:** zundo temporal, 50-snapshot limit
- **Tracked:** containers, zones, furnitureIndex (via `partialize`)
- **Equality:** Shallow key-by-key reference comparison (prevents UI-only changes from creating snapshots)
- **Drag debounce:** `pause()` on `startContainerDrag`, `resume()` on `commitContainerDrag`/`cancelContainerDrag`
- **Undo/redo actions:** pause temporal → undo/redo → refreshAdjacency (while still paused) → resume. This prevents adjacency recalculation from creating counter-snapshots.
- **Keyboard:** Ctrl+Z (undo), Ctrl+Y (redo) — wired in `src/components/three/Scene.tsx`

---

## §3 Data Model

### Container

**Interface:** `src/types/container.ts`

| Field | Type | Description |
|-------|------|-------------|
| `id` | `ContainerID` (string) | UUID v4 |
| `name` | `string` | Display name ("Container 40ft HC") |
| `size` | `ContainerSize` | Standard20 / Standard40 / HighCube40 |
| `position` | `{x, y, z}` | World position in metres (center-bottom) |
| `rotation` | `number` | Y-axis rotation in radians |
| `level` | `number` | 0=ground, 1=second floor, max 3, min -1 (basement) |
| `stackedOn` | `ContainerID \| null` | Container below (null if on ground) |
| `supporting` | `ContainerID[]` | Containers stacked on top |
| `walls` | `Record<WallSide, WallConfig>` | 4 wall configs (Front/Back/Left/Right) |
| `roofRemoved` | `boolean` | Whether roof is open |
| `floorRemoved` | `boolean` | Whether floor is open (great room atrium) |
| `floorMaterial?` | `FloorMaterialType` | Floor finish (defaults to wood) |
| `ceilingMaterial?` | `FloorMaterialType` | Ceiling finish (defaults to steel) |
| `structureConfig?` | `{hiddenElements: string[]}` | Hidden frame elements |
| `cornerConfig?` | `Record<CornerName, CornerConfig>` | Corner post overrides |
| `groupId` | `string \| null` | Zone membership |
| `mergedWalls` | `string[]` | Adjacency merge entries ("otherId:wallSide") |
| `_preMergeWalls?` | `Record<string, SurfaceType>` | Saved pre-merge face materials ("voxelIndex:face" → original material). Ephemeral — stripped from persist, rebuilt by refreshAdjacency. |
| `furniture` | `FurnitureItem[]` | Placed furniture |
| `voxelGrid?` | `Voxel[]` | 64-voxel skin grid (omitted until first edit) |

**Container sizes:**

| Size | Length (X) | Width (Z) | Height (Y) |
|------|-----------|-----------|------------|
| Standard20 | 6.06m | 2.44m | 2.59m |
| Standard40 | 12.19m | 2.44m | 2.59m |
| HighCube40 | 12.19m | 2.44m | 2.90m |

### Walls & Bays

**WallSide** enum: Front (short, door end), Back (short, opposite), Left (long), Right (long)

**WallConfig:** `{side: WallSide, bays: BaySlot[]}`

**BaySlot:** `{index: number, module: WallModule, locked?: boolean}`

**WallModule** union:
- `PanelSolid` — corrugated steel (cost_factor=0)
- `PanelGlass` — glass with variant: FixedWindow or SlidingDoor (cost_factor=1200)
- `HingedWall` — deployable wall with foldsDown/foldsUp/gullFull/openAmount/outerWall/sideWall (cost_factor=2800-3500)
- `OpenVoid` — fully removed (cost_factor=500)

Bay counts: Long walls = LONG_WALL_BAYS[size] (4 for 20ft, 8 for 40ft). Short walls = 2.

**Important:** Bay modules are the legacy system. **Voxel grid is now the visual source of truth.** Bays exist for structural/pricing calculations but do NOT control what renders on screen.

### Voxel Grid

**Dimensions:** VOXEL_COLS=8 × VOXEL_ROWS=4 × VOXEL_LEVELS=2 = 64 voxels

**Index formula:** `level * (VOXEL_ROWS * VOXEL_COLS) + row * VOXEL_COLS + col`

**Body vs Extension zones:**
- **Body (core):** rows 1-2, cols 1-6 — always active, interior space
- **Extensions (deck/halo):** rows 0,3 (side decks) and cols 0,7 (end extensions) — inactive until deployed

**Voxel interface:**
- `active`: boolean (included in scene; deck rows start inactive)
- `type`: 'core' | 'deck' | 'roof'
- `faces`: VoxelFaces — six face materials
- `voxelType?`: 'standard' | 'stairs'
- `stairAscending?`: 'n' | 's' | 'e' | 'w'
- `stairPart?`: 'lower' | 'upper' | 'single'
- `openFaces?`: Partial<Record<keyof VoxelFaces, boolean>>

**VoxelFaces:** `{top, bottom, n, s, e, w}` — each is a SurfaceType

**SurfaceType** (16 types): Open, Solid_Steel, Glass_Pane, Railing_Glass, Railing_Cable, Deck_Wood, Concrete, Gull_Wing, Half_Fold, Door, Stairs, Stairs_Down, Wood_Hinoki, Floor_Tatami, Wall_Washi, Glass_Shoji

---

## §4 Interaction System

**Primary file:** `src/systems/InteractionManager.ts`

### Priority chain (highest → lowest)

```
corner_post  (4) — corner post meshes
frame_post   (3) — structural frame posts/beams
deck_edge    (2) — edge of deployed deck
panel        (1) — wall panel / bay module
floor        (0) — floor surface
none        (-1) — no target
```

### Hit types and userData

| Hit Type | userData | Store Action |
|----------|----------|-------------|
| `corner_post` | `{hitType, containerId, cornerKey}` | select + setCornerConfig |
| `frame_post` / `frame_beam` | `{hitType, containerId, frameKey}` | select + toggleStructuralElement |
| `deck_edge` | `{hitType, containerId, wallSide, bayIndex, edge}` | select + setSelectionContext |
| `panel` | `{hitType, containerId, wallSide, bayIndex}` | select + bay context menu |
| `floor` | `{hitType, containerId}` | select container |

### Raycast resolution

`drillDown(hits)` finds the closest hit, then searches all hits within `DEPTH_TOLERANCE=0.1` for the highest-priority hit type. This prevents deeper high-priority targets from being occluded by closer low-priority ones.

### Click dispatch

`handleSkeletonClick(target)` → `store.select(containerId)` + `store.setSelectionContext()` with subPart info.

### Voxel-level interaction

Voxel faces use a separate path in `ContainerSkin.tsx`:
- `SingleFace` component renders both visual mesh and invisible hitbox mesh (`mHit` material)
- Only the hitbox mesh has pointer handlers (prevents R3F raycast occlusion)
- Click → `setVoxelFace()` (if brush active) or `setSelectedVoxel()` (selection mode)
- Scroll → `cycleVoxelFace()` through material cycle

### Known interaction issues

- Extension voxel hover unreliable for inactive extensions (BaseplateCell has thin floor-level hitbox at Y=0.015, height=0.02; only active extensions get full edge strips)
- Voxel preview (VoxelPreview3D) does not accurately reflect elongated voxel dimensions
- Scroll-to-cycle does not sync with hotbar indicator

---

## §5 Rendering Pipeline

### ContainerSkin

**File:** `src/components/objects/ContainerSkin.tsx`

**Component tree:**
```
ContainerSkin
├── VoxelPopIn (mount animation)
│   └── AllLevel0Voxels (loop over 32 cells per level)
│       ├── VoxelGroup (per active voxel)
│       │   ├── SingleFace × 6 (n, s, e, w, top, bottom)
│       │   │   ├── Visual mesh (material based on SurfaceType)
│       │   │   └── Hitbox mesh (mHit — invisible, receives pointer events)
│       │   ├── VoxelEdgeStrip (hover highlight)
│       │   ├── HoverGlow (emissive overlay)
│       │   └── SelectionGlow (emissive overlay)
│       └── BaseplateCell (inactive voxels only)
│           ├── Hitbox mesh (isBay:true userData)
│           └── FlushGhostPreview (stamp footprint hologram)
└── DollhouseCutaway (camera-relative face fading)
```

### Dual data model (CRITICAL)

- **Bay modules** (`Container.walls[side].bays[]`): Legacy V1 system. **NOT used for visual rendering.** Exists for structural/pricing calculations.
- **Voxel grid** (`Container.voxelGrid`): **Source of truth for all rendering.** Each voxel's 6 `faces` determine what renders.

### Material system

`SurfaceType` → geometry factory function in `renderVisual()`:
- Solid_Steel → SteelFace
- Glass_Pane → GlassFace
- Railing_Cable / Railing_Glass → railing geometry
- Deck_Wood → wood panel
- etc.

Theme-based material selection: `syncThemeMats(currentTheme)` updates module-scope material aliases (mSteel, mGlass, etc.) per theme (industrial, japanese, desert).

Materials are `MeshStandardMaterial` or `MeshPhysicalMaterial` with PBR parameters. Declared at module scope (not inside components).

### globalCullSet usage

`globalCullSet` is a `Set<string>` with keys `"containerId:voxelIndex:face"`. ContainerSkin calls `adjIsMelting()` to check if a face should be hidden due to adjacency. Faces in the cull set render as invisible.

### Adjacency auto-merge (Sprint 1)

Beyond visual culling, `refreshAdjacency` now also **mutates voxel face data**: Solid_Steel boundary faces are changed to Open, with originals saved in `_preMergeWalls`. When containers separate, faces are restored from `_preMergeWalls`. User-painted faces (Glass, Wood, etc.) are preserved — only Solid_Steel is auto-merged.

### Lighting & Environment

**SunLight component:**
- Directional light: castShadow=true, 4096×4096 shadow map, ortho frustum ±25m, far=150m
- Time-of-day orbit: `solarAngle = (timeOfDay - 6) / 12 * π`
- Warm↔cool color lerp, sine wave intensity 5am–9pm

**Ambient:** 0.06–0.3 intensity (time-varying)
**Hemisphere:** sky=#87ceeb, ground=#362907, intensity 0.04–0.15
**Post-processing:** N8AO ambient occlusion
**Canvas:** `frameloop="demand"` — only input events trigger re-renders

---

## §6 Coordinate Conventions

**At rotation=0:**
- **X-axis = LENGTH** (container long dimension, 12.19m for 40ft)
- **Z-axis = WIDTH** (2.44m)
- **Y-axis = HEIGHT** (vertical, 2.59–2.90m)

**Container origin:** Center-bottom of bounding box. `position: {x, y, z}` places the bottom center.

**AABB mapping:**
- minX = x - length/2, maxX = x + length/2
- minZ = z - width/2, maxZ = z + width/2
- minY = y, maxY = y + height

**Voxel grid mapping (NEGATED X):**
```
col 0-7 along LENGTH (X):
  px = -(col - 3.5) * colPitch    [col=0 → +X, col=7 → -X]
row 0-3 along WIDTH (Z):
  pz = (row - 1.5) * rowPitch     [row=0 → -Z, row=3 → +Z]
```

**WallSide to axis mapping (rotation=0):**
- Front → +X face (maxX), Back → -X face (minX)
- Right → +Z face (maxZ), Left → -Z face (minZ)

**WallSide to voxel boundary:**
- Front → col 1, face 'e'
- Back → col 6, face 'w'
- Left → row 1, face 'n'
- Right → row 2, face 's'

---

## §7 Middleware Chain

Documented in §2 (Store Shape). Cross-reference:
- zundo temporal config: `useStore.ts` (end of file, after store closing)
- persist config: same location, wrapping temporal
- idb-keyval adapter: `src/store/idbStorage.ts`
- Zod validation: `src/store/persistSchema.ts`

**Temporal partialize:** `{containers, zones, furnitureIndex}`
**Persist partialize:** `{containers (with _preMergeWalls stripped), zones, environment, viewMode, pricing, furnitureIndex, libraryBlocks, libraryContainers, libraryHomeDesigns, customHotbar}`

---

## §8 Known Issues & Deferred Work

### Known Issues

| Issue | Severity | Notes |
|-------|----------|-------|
| Extension hover unreliable (inactive voxels) | RESOLVED | **Sprint 3 fix:** BaseplateCell rewritten with 4 wall-face hitbox meshes (n/s/e/w) at vHeight/2 + floor hitbox. Each face calls `setHoveredVoxelEdge` with face identity. Store hover state populates from normal camera angles. |
| Voxel preview proportions incorrect | RESOLVED | **Sprint 2 fix:** VoxelPreview3D now reads container size dynamically via `CONTAINER_DIMENSIONS[containerSize]` instead of hardcoded 40ft HC values. |
| Scroll ↔ hotbar indicator missing | RESOLVED | **Sprint 2 fix:** `handleEdgeWheel` now calls `setHoveredVoxelEdge()` after `setVoxelFace()`, syncing the hotbar with scroll-to-cycle. |
| 37K-line monolith store | TECH DEBT | Works but hard to navigate. Splitting deferred until test coverage exists |
| Adjacency auto-merge | RESOLVED | **Sprint 2 verified:** Browser confirms facing walls visually disappear when containers are flush. Store mutates Solid_Steel→Open via `_preMergeWalls`, visual culling via `globalCullSet`, and voxel grid is the rendering source of truth. |
| Session 1 UX changes | RESOLVED | All 3 reverts confirmed applied (BaseplateCell, VoxelPreview3D, SmartHotbar) |

### Deferred Features (see MODUHOME-V1-ROADMAP.md)

- ~~Shift+drag container move~~ (Sprint 3)
- ~~Behavioral test suite (50+ tests)~~ (Sprint 3: 51 tests)
- Atomic selectors + useShallow
- GLB export
- CSG window/door cutouts
- Measure tool
- Theme/palette engine
- Store refactoring

---

## §9 Sprint History

| Sprint | Changes | Test Count |
|--------|---------|------------|
| Pre-Sprint | V1 baseline: 27 working features, 0 tests, localStorage persistence | 0 |
| Session 1 | zundo undo/redo, IndexedDB+Zod persistence, hydration guard. 3 UX changes attempted (all failed, need revert). | 0 |
| Sprint 1 | Adjacency auto-merge: findAdjacentPairs + _preMergeWalls + refreshAdjacency face mutation wired to all actions. Undo/redo fix (refreshAdjacency runs while temporal paused). 7 behavioral tests. | 7 |
| Setup | Infrastructure: CLAUDE.md, architecture doc, custom commands. Phase 0 reverts confirmed. Architecture doc populated from codebase reads. | 7 |
| Sprint 2 | Visual verification via Playwright MCP. Adjacency auto-merge confirmed working in browser. Voxel preview proportions fixed (dynamic dimensions). Scroll↔hotbar sync fixed (setHoveredVoxelEdge). Extension hover deferred (requires edge strip system). | 7 |
| Sprint 3 | Extension hover fix (BaseplateCell wall-face hitboxes). Shift+drag activation (shiftKey on onPointerDown → startContainerDrag). 44 new behavioral tests (CRUD 8, Paint 8, Undo 6, Stacking 5, Selection 5, Persistence 6, BOM 6). Permanent dev store exposure. | 51 |
| Sprint 4 | Smart Systems audit (8 systems verified). UI polish (toolbar backdrop blur, BOM highlight). GLB export via GLTFExporter. 19 new behavioral tests (smart placement 3, staircase 3, railing 2, cycles 2, drag 4, furniture 3, export 2). Architecture §10 added. | 70 |

---

## §10 Smart Systems & Modules

### Smart Systems Audit (Sprint 4)

| Smart System | Status | Notes |
|---|---|---|
| Adjacency auto-merge | WORKS | Flush containers → shared walls become Open. Separation restores walls. User-painted faces preserved. |
| Staircase auto-void | PARTIAL | Intra-container staircase works (lower/upper voxels, open passages). Cross-container auto-void (L1 stairs → L0 ceiling open) not yet implemented. |
| Smart placement | NOT IMPL | addContainer always places at given position. No auto-offset for overlapping. |
| Door state system | WORKS | `toggleDoorState` cycles Door: closed→open_swing→open_slide→closed. Glass_Shoji: closed→open_slide→closed. Syncs `openFaces` boolean. Per-face `doorStates` on Voxel. |
| Model Home system | WORKS | 6 pre-designed multi-container templates. `placeModelHome` spawns containers with roles, positions, and adjacency. UI gallery in Saved tab. |
| Level visibility tiers | WORKS | viewLevel=0 → L0 solid, L1 ghosted. viewLevel=1 → L1 solid, L0 desaturated. null = ALL visible. |
| Context-aware UI | WORKS | Hotbar appears on hover, inspector updates on selection, face-specific material cycles. |
| Smart railing | WORKS | applySmartRailing detects exposed edges → Railing_Cable. Adjacent walkable surfaces → Open. |
| Surface cycles | WORKS | Wall/floor/ceiling each have distinct material cycles (WALL_CYCLE 9, FLOOR_CYCLE 5, CEIL_CYCLE 5). |
| Bay module system | WORKS | setBayModule/cycleBayModule/toggleBayOpen functional. Parallel to voxel system (not synced). |

### Theme System

3 complete PBR themes: Industrial (default), Japanese Modern, Desert Modern. Each defines steel, glass, frame, wood, rail, concrete materials with theme-specific metalness/roughness/transmission. Switched via `setTheme(id)`.

### Material System

16 SurfaceType values, all with distinct PBR materials. No external texture files — all procedural (corrugation normal map for Industrial steel). Glass uses MeshPhysicalMaterial with transmission. Japanese palette (Hinoki, Tatami, Washi, Shoji) hardcoded separately from theme system.

### Furniture System

Store actions exist: `addFurniture`, `removeFurniture`, `moveFurniture`. 8 catalog items (Stairs, Kitchen, Bed, Bathroom, Sofa, Desk, Dining Table, Storage) with dimensions and costs. Items stored in `Container.furniture[]`. 3D rendering via colored semi-transparent boxes with floating `<Html>` labels in FurniturePiece component.

### Door State System (Sprint 8)

**Type:** `DoorState = 'closed' | 'open_swing' | 'open_slide'`

Per-face door state stored on `Voxel.doorStates?: Partial<Record<keyof VoxelFaces, DoorState>>`.

- `toggleDoorState(containerId, voxelIndex, face)` — cycles state based on surface type
- Door: closed → open_swing → open_slide → closed
- Glass_Shoji: closed → open_slide → closed (no swing)
- Non-door surfaces: no-op
- Syncs `openFaces[face]` boolean (true when open, false when closed)
- DoorFace component renders swing (rotation) and slide (translation) animations via `useFrame`
- Undoable via zundo temporal

### Model Home System (Sprint 8)

**File:** `src/config/modelHomes.ts`

6 pre-designed multi-container layouts:
1. Micro Studio (1×20ft)
2. Modern 1-Bedroom (2×40ft side-by-side)
3. Family 2-Bedroom (3×40ft L-shape)
4. Two-Story Modern (2×40ft stacked)
5. Entertainer's Dream (2×40ft, one as deck)
6. Family Compound (4×40ft, 2×2 square)

`placeModelHome(modelId, origin?)` spawns all containers with roles, relative positions, and connections. Uses temporal pause/re-pause pattern for undo grouping. Triggers `refreshAdjacency()` via rAF after placement.

UI: Model Homes gallery in UserLibrary.tsx Saved tab, above My Blocks/My Containers sections.

### Hover Debounce (Sprint 8)

All hitbox leave handlers (edge strips, ceiling quads, FPV hitboxes) use 250ms debounced `hoveredVoxel` clearing. Enter handlers cancel pending leave timers. Prevents hover flicker when mouse transits between hitboxes within same voxel. VoxelHoverHighlight is a standalone R3F component that independently subscribes to hover state.

### Module Architecture Proposal

Modules should be **voxel presets with optional furniture mesh**:
- A module preset defines all 6 faces + orientation hint (e.g., kitchen counter: Steel back, Open front, Wood floor, Steel ceiling)
- Applying a module to a voxel: (1) sets all faces per preset, (2) optionally spawns a furniture item for visual detail
- The "directional side" concept: modules have an inward face (occupant-facing) and outward face (exterior)
- Minimal viable: extend `applyHotbarToVoxel` to accept module presets that also call `addFurniture`
- Data additions: `ModulePreset` type with `faces: VoxelFaces`, `furnitureType?: FurnitureType`, `orientation: 'n'|'s'|'e'|'w'`

### Extension Overlap Prevention (Sprint 9)

`getActiveExtensions(c)` scans voxel grid rows 0/3 and cols 0/7 for non-Open faces, returning `{north, south, east, west}` booleans. `getFullFootprint(c)` expands body AABB by `dims.height` (haloExt) per active extension direction, accounting for rotation via cos/sin projection. Both are pure functions in `src/store/spatialEngine.ts`.

**Overlap enforcement points:**
- `checkOverlap()` uses `getFullFootprint` for existing containers
- `addContainer` smart placement offsets include `haloExt` in gap calculation
- `commitContainerDrag` rejects moves that would cause full-footprint overlap
- `setAllExtensions` pre-checks expanded footprint before activation, blocks with console warning if overlap detected
- `placeModelHome` passes `skipSmartPlacement` and `skipOverlapCheck` flags to bypass checks for pre-designed layouts

### User-Saveable Configurations (Sprint 9)

Three tiers of user saving:
- **libraryBlocks:** Single-voxel 6-face presets (saved from inspector)
- **libraryContainers:** Full container templates with voxel grid (saved from inspector)
- **libraryHomeDesigns:** Multi-container designs with relative positions (`LibraryHomeDesign` type in `src/types/container.ts`)

`saveHomeDesign(label)` captures all containers with positions relative to first container origin. `loadHomeDesign(designId)` spawns containers from saved data using temporal pause/resume for atomic undo. `removeLibraryItem(id)` searches all three arrays.

All three are included in persist partialize (IndexedDB) and export/import.

UI: "Saved" tab in UserLibrary.tsx shows Model Homes, My Homes (with save/load/delete), My Blocks, My Containers, and preset sections.

### PBR Texture Pipeline (Sprint 9)

CC0 textures from AmbientCG stored in `public/assets/materials/{Corrugated_Steel,Deck_Wood,Ground}/` (color.jpg, normal.jpg, roughness.jpg each).

`src/config/pbrTextures.ts` provides singleton texture loading:
- `loadAllTextures()` — idempotent, loads all 9 textures in parallel, graceful fallback on failure
- `applyTexturesToMaterial(mat, textures, normalScale)` — applies color/normal/roughness maps, sets color to white for unmodified albedo

`PBRTextureLoader` component in Scene.tsx applies steel textures to industrial theme, wood textures to wood/woodGroove, and ground textures to ground plane material. Single `invalidate()` call after all applied.

Sky tuned: midday rayleigh 2.0, turbidity 8 for blue sky. Environment preset "sunset" for HDRI reflections (changed Sprint 10).

Ground texture: 120x120 repeat with anisotropy=16 (Sprint 11). Reduces visible tiling pattern.

---

## §11 Sprint History (Sprints 7-12)

| Sprint | Focus | Key Deliverables |
|--------|-------|-----------------|
| 7 | Container Roles + Bulk Extensions | 9 container roles, bulk extension actions, applyContainerRole |
| 8 | Door System + Environment | Door states (closed/open_swing/open_slide), toggleDoorState, sky params, steel PBR config |
| 9 | Save System + Model Homes | 3-tier save (blocks/containers/homes), 6 model home presets, PBR textures, extension overlap prevention |
| 10 | Stabilization + Graphics | 23-feature audit (all pass), Great Room demo, environment sunset, ContactShadows removed (artifact), Stars, SceneFog, N8AO tuning |
| 11 | Verified Graphics | Programmatic scene inspection, ContactShadows re-added, Clouds added, ground texture 120x, 6 time-of-day screenshots, Great Room build verified |
| 12 | Product Completeness | 7 workflow audits (all WORKS), theme verification, architecture doc update |

---

## §12 User Workflows — Current State

### Save System
- **Save Container Template:** Inspector floppy disk icon → saves to "My Containers" in Saved tab. Uses container's current name (no rename prompt).
- **Save Home Design:** "+ Save Current Home" button in Saved tab → saves all containers with relative positions.
- **Model Homes:** 6 preset model homes in Saved tab gallery (Micro Studio, Modern 1-Bedroom, Family 2-Bedroom, Two-Story Modern, Entertainer's Dream, Family Compound).
- **Library organization:** Model Homes, My Homes, My Blocks, My Containers, Spatial/Styles/Structural presets.
- **Persistence:** IndexedDB via idb-keyval with Zod validation.

### Export/Import
- **Export:** "Export" button in toolbar → downloads `moduhome-project.json` (full state).
- **Import:** "Export / Import" button in status bar footer.
- **GLB:** Code exists in `src/utils/exportGLB.ts` but NOT wired to toolbar UI.

### Blueprint Mode
- **Renderer:** Dedicated 2D renderer (`BlueprintRenderer.tsx`) — flat planes at fixed Y, NOT an ortho camera.
- **Features:** Container outlines with selection highlight, name + size labels, level badges (L1), Floor/Ceiling toggle.
- **Wall colors:** `bpvWallMats` map with distinct colors per SurfaceType (Steel=#37474f, Glass=#4fc3f7, Door=#5c4033, Railing=#90a4ae).
- **Gaps:** No legend, no grid lines, no extension zone outlines.

### Walkthrough (First Person)
- **Controls:** WASD move, Arrows look, Mouse look, Shift sprint, Q/Z fly, Click/Space cycle panel, E preset, Right-click menu, T tour, ESC exit.
- **Camera:** Starts at ground level outside containers. User navigates with WASD.
- **HUD:** Full control hint bar at bottom of screen.
- **Gaps:** No collision with walls (camera passes through). No pointer lock in Playwright context. Camera starts outside (user must walk in).

### Door System
- **Data:** Per-face `doorStates` on VoxelState: `'closed' | 'open_swing' | 'open_slide'`.
- **Toggle:** `toggleDoorState(containerId, voxelIndex, face)` cycles through states.
- **Visual:** DoorFace component renders animations (swing=rotation, slide=translation).
- **Gaps:** Visual animation not verified in close-up screenshot.

### Theme System
- **3 themes:** Industrial (dark steel), Japanese Modern (lighter/bluer), Desert Modern (sandy/warm).
- **Switch:** Theme buttons in sidebar. `setTheme(id)` action.
- **Materials:** `syncThemeMats()` updates material aliases per theme.
- **Verification:** All 3 look distinct in golden hour screenshots.

---

## §13 Visual Quality Status (Scene Inspector Data)

Based on Sprint 11 programmatic scene inspection at 15:00:

| Feature | Status | Data |
|---------|--------|------|
| Environment map | Active | Sunset preset, scene.environment set |
| ContactShadows | Active | position=[0,0.01,0], scale=60, blur=2.5, opacity=0.4 |
| Shadow maps | Active | PCFSoft, 4096x4096 directional |
| Cast shadow meshes | 49 | Container shells + frame |
| Receive shadow meshes | 42 | Ground + decks |
| Normal maps | 580 | Steel corrugation PBR textures |
| Glass (MeshPhysicalMaterial) | 18 instances | transmission=1.0, ior=1.5 |
| Emissive materials | 906 | Ceiling panels warm glow |
| Clouds | Active | 3 Cloud instances at Y=30,35,40 (53 particles) |
| Stars | Active (night only) | 1 Points object, visible when timeOfDay > 21 or < 5 |
| Fog | Active | Time-adaptive: night=#060614, golden=#e8d0b4, day=#e8e0d4 |
| Ground texture | 120x repeat | Anisotropy=16, PBR (color+normal+roughness) |
| Lights | 4 | DirectionalLight, AmbientLight, HemisphereLight, PointLight |

---

## §14 Known Issues & Deferred Work (Updated Sprint 12)

### Active Issues
1. **No wall collision in FP mode** — Camera passes through walls. Rapier installed but not wired.
2. **FP camera starts outside** — User must walk into containers with WASD.
3. **No GLB export in UI** — Code exists, button not wired.
4. **Ground tiling faintly visible** — At 120x repeat, still detectable at extreme close-up in FP.
5. **WebGL context lost on FP switch** — Logs "Context Lost" warning, recovers automatically.
6. **No rename dialog on container save** — Uses current name. User must rename first.
7. **Smart placement gap** — `addContainer` at default position places offset, not flush. Manual `updateContainerPosition` needed.
8. **Screenshot timeout in Playwright** — Font loading hangs occasionally, requires retry.

### Deferred
- Orthographic BP camera (current: perspective with disabled rotation)
- BP legend/grid lines
- CSG window/door cutouts
- GLB export UI button
- Wall collision (Rapier)
- Measure tool
- Store refactoring (37K lines)
