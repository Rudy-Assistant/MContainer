# Diagnostic Results — Between Sprints 13/14

**Date:** 2026-03-12

---

## Q1: Interior Tab Contents

**Screenshot:** `sprint13-q1-interior-tab.jpg`

The Interior tab shows a **furniture catalog** with 8 items:

| Item | Dimensions | Icon |
|------|-----------|------|
| Staircase | 1.52 x 2.4 x 2.6 m | Staircase icon |
| Kitchen Unit | 3 x 0.65 x 0.9 m | Kitchen icon |
| Double Bed | 2 x 1.6 x 0.5 m | Bed icon |
| Bathroom Pod | 2.4 x 1.5 x 2.4 m | Bathroom icon |
| Sofa | 2.2 x 0.9 x 0.8 m | Sofa icon |
| Desk | 1.4 x 0.7 x 0.75 m | Desk icon |
| Dining Table | 1.8 x 0.9 x 0.75 m | Table icon |
| Storage Unit | 1 x 0.5 x 2 m | Storage icon |

- When no container is selected: shows "Select a container first" prompt
- These are **real furniture items** (not room module presets) — they correspond to FurnitureType enum values
- Items appear to be click-to-place (requires selected container)
- The bottom hotbar also shows room module presets (Kitchen, Bathroom, Living Room, Bedroom, Office, Open Deck, Storage, Stairs) — these are a SEPARATE system from the furniture catalog

**Answer:** The Interior tab has a full furniture catalog with 8 items, not just placeholders. Room module presets are in the bottom hotbar, not the Interior tab.

---

## Q2: Export Output Verification

### What the Export button produces:
- **Format:** JSON (`.json`)
- **File name:** `moduhome-project.json` (from previous sprint verification)
- **File size:** ~194KB for a 3-container scene

### JSON structure (first level keys):
```json
{
  "containers": { ... },     // All container data with voxelGrids, walls, etc.
  "zones": { ... },
  "environment": { "timeOfDay": 15, "northOffset": 0 },
  "viewMode": "3d",
  "pricing": { ... },
  "libraryBlocks": [],
  "libraryContainers": [ ... ],
  "libraryHomeDesigns": [ ... ],
  "customHotbar": [ ... ]
}
```

### Export functions in codebase:

| Function | File | Wired to UI? |
|----------|------|-------------|
| `exportState()` | `src/store/useStore.ts` | YES — Export toolbar button |
| `importState(json)` | `src/store/useStore.ts` | YES — Import functionality exists |
| `exportGLB` | `src/utils/exportGLB.ts` | NO — Code exists, no toolbar button |
| `setExportScene(scene)` | `src/utils/exportGLB.ts` | Internal — used by SceneExporter |

### Does GLB export exist?
YES. `src/utils/exportGLB.ts` uses `GLTFExporter` from `three/addons`. It's imported and scene is registered via `SceneExporter` component in Scene.tsx. However, there is NO UI button to trigger GLB export.

**Answer:** Export produces JSON (~194KB), valid structure with all containers/zones/environment/library. GLB exporter exists in code but has no toolbar button.

---

## Q3: Performance Baseline

### Scene stats (3-container Great Room scene):

| Metric | Value |
|--------|-------|
| Mesh count | 1,385 |
| Meshes with castShadow | 262 |
| Meshes with receiveShadow | 123 |
| Textures loaded | 33 |
| Geometries | 181 |
| Shadow map enabled | true |
| Lights | 4 (Directional, Ambient, Hemisphere, Point) |

### Material types:
| Type | Count |
|------|-------|
| MeshStandardMaterial | 614 |
| MeshBasicMaterial | 749 |
| MeshPhysicalMaterial | 20 |
| ShaderMaterial | 1 |

### FPS:
- **Demand mode (idle):** ~18 FPS (expected — `frameloop="demand"` only renders when invalidated)
- **Note:** FPS during interaction (orbit, drag) would be higher since invalidate() fires continuously

### Draw calls / Triangles:
- `gl.info.render.calls = 1` and `triangles = 1` — these reset between frames in demand mode. The values shown are from the LAST demand-render frame, which was a minimal update.
- Full-scene render stats would require forcing a continuous render loop.

**Answer:** 1,385 meshes, 33 textures, 181 geometries, 4 lights, ~18 FPS in demand mode. Material breakdown: 749 BasicMaterial (hitboxes/helpers), 614 StandardMaterial (surfaces), 20 PhysicalMaterial (glass/specular).

---

## Q4: Store Action Inventory

### Total: 145 store actions

**Container CRUD (12):**
addContainer, removeContainer, updateContainerPosition, updateContainerRotation, renameContainer, resizeContainer, stackContainer, unstackContainer, rotateContainer (alias), addContainerToZone, removeContainerFromZone, addContainerWithPreset

**Face/Voxel Mutations (18):**
setVoxelFace, setVoxelAllFaces, setVoxelActive, paintFace, cycleVoxelFace, stampFromHotbar, stampAreaSmart, stampArea, stampFromCustomHotbar, stampStaircase, applyStyleToFace, copyVoxel, pasteVoxel, copyVoxelStyle, resetVoxelGrid, setFloorMaterial, setCeilingMaterial, cycleVoxelTemplate

**Selection (8):**
select, clearSelection, selectMultiple, setSelectedVoxel, setSelectedVoxels, toggleVoxelInSelection, setSelectionContext, cycleOverlappingEdges

**Roles & Modules (5):**
applyContainerRole, applyModule, rotateModuleOrientation, setActiveModulePreset, setModuleOrientation

**Extensions & Walls (4):**
setAllExtensions, setAllOuterWalls, setOuterWallType, setSideWallType

**Stacking & Smart Systems (4):**
applyStairsFromFace, applySmartRailing, convertToPool, refreshAdjacency

**Furniture (3):**
addFurniture, removeFurniture, moveFurniture

**Door System (1):**
toggleDoorState

**Locking (2):**
toggleVoxelLock, isVoxelLocked

**View/UI State (15):**
setViewMode, setTheme, setTimeOfDay, setViewLevel, setNorthOffset, toggleDollhouse, toggleBuildMode, togglePreviewMode, toggleRoof, toggleFloor, toggleTape, setBpvLevel, setCameraAngles, setCameraRestoring, saveCamera3D

**Save/Load/Export (9):**
saveHomeDesign, loadHomeDesign, placeModelHome, saveContainerToLibrary, saveBlockToLibrary, exportState, importState, removeLibraryItem, renameLibraryItem

**Hotbar/Paint (10):**
setActiveHotbarSlot, setHotbar, setCustomHotbarSlot, setActiveCustomSlot, setActiveBrush, beginBrushDrag, brushStampVoxel, startPaint, stopPaint, setBucketMode, setBucketSurface

**Context Menus (8):**
openBayContextMenu, closeBayContextMenu, openContainerContextMenu, closeContainerContextMenu, openVoxelContextMenu, closeVoxelContextMenu, openEdgeContextMenu, openFloorContextMenu

**Hover/Preview (5):**
setHoveredVoxel, setHoveredEdge, setHoveredVoxelEdge, setHoveredPreviewFace, setFacePreview

**Bay/Wall Operations (6):**
setBayModule, setBayColor, toggleBayLock, toggleBayOpen, cycleBayModule, setCornerConfig

**Drag (6):**
startContainerDrag, commitContainerDrag, cancelContainerDrag, setDragContainer, setDragFurniture, setDragWorldPos

**Structural (3):**
toggleStructuralElement, toggleOpenFace, cycleBlockPreset

**Tape Measure (2):**
addTapePoint, clearTapePoints

**Debug (2):**
createGreatRoomDemo, __debugTwoStoryStack

**System (5):**
undo, redo, getEstimate, updatePricing, getStampFaces, getStampFootprint

**Library/Misc (4):**
setLibraryDragPayload, setFaceContext, setFaceContextMenuCtx, setOverlappingEdges

### Actions with 0 test files (before Sprint 13):
13 completely untested actions were identified and now have test coverage via `store-coverage.test.ts`:
- addFurniture, removeFurniture, moveFurniture
- renameContainer, resizeContainer
- copyVoxel, pasteVoxel, copyVoxelStyle
- convertToPool, createGreatRoomDemo
- toggleVoxelLock, isVoxelLocked
- saveBlockToLibrary

### Current test coverage:
- **222 tests** across 20 test files
- **58 new tests** added in Sprint 13
- 0 completely untested high-risk actions remain

---

## Q5: Deployment Configuration

### Deployment files found:
- **NONE** — No vercel.json, netlify.toml, fly.toml, Dockerfile, docker-compose.yml, or .github/workflows/

### package.json scripts:
```json
"dev": "next dev --webpack",
"build": "next build",
"start": "next start",
"lint": "eslint",
"test": "vitest run",
"test:e2e": "npx tsx e2e/run-workflow-tests.ts"
```

### next.config:
- Next.js 16 App Router
- No `output: 'export'` (server-side rendering mode, not static)
- No base path configuration

### public/ directory:
- Contains `assets/materials/` with PBR texture files (normal maps, roughness maps, etc.)
- Static assets that must ship with the app

### Build status:
- `npm run build` was NOT run (per instructions)
- Expected output: `.next/` directory (standard Next.js SSR build)
- To deploy as static site: would need `output: 'export'` in next.config

### Estimated deployment effort:
- **Vercel (easiest):** ~5 minutes — just connect GitHub repo, auto-detects Next.js
- **Static export:** ~30 minutes — add `output: 'export'`, handle dynamic routes, test
- **Docker/self-hosted:** ~1-2 hours — write Dockerfile, configure, test

**Answer:** Zero deployment infrastructure exists. The app is development-only (localhost:3000). Vercel deployment would be trivial (minutes). Static export requires config changes (30 min).

---

## All Screenshots

| File | Description |
|------|-------------|
| `sprint13-q1-interior-tab.jpg` | Interior tab showing 8 furniture items |
| `sprint13-q1-saved-tab.jpg` | Saved tab showing 6 model homes + user saves |
| `sprint13-model-home-placed.jpg` | Family 2-Bedroom model home placed |
